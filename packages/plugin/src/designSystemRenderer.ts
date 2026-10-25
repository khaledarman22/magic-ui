import {
 canonicalJson, componentRegistrySchema, componentDependencies, orderComponents, resolveToken, resolveTokenReferences,
 failure, MagicUiError, designSystemInputSchema,
 type DesignSystemInput,type DesignSystemResult,type ComponentRegistry,type NodeSpecification,
} from '@magic-ui/shared';
import { applyProperties, snapshot, loadSpecificationFonts } from './designRenderer';
import {readIdentity as read,writeIdentity as write,drift,projectVariables,applyTokenBindings} from './designSystemIdentity';
const key=(projectId:string)=>`design-system:${projectId}`;
export function readComponents(projectId:string):ComponentRegistry {
 const saved=read(figma.root,key(projectId));
 return saved?componentRegistrySchema.parse(JSON.parse(saved)): {projectId,components:[]};
}
export async function readVariables(projectId:string) {
 const variables=await projectVariables(projectId);
 const collections=(await figma.variables.getLocalVariableCollectionsAsync()).filter(c=>read(c,'projectId')===projectId);
 return {variables:variables.map(v=>({id:read(v,'id'),variableId:v.id,type:v.resolvedType,values:v.valuesByMode})),collections:collections.map(c=>({id:c.id,name:c.name,modes:[...c.modes]}))};
}
export async function findVariant(projectId:string,componentId:string,variantId?:string):Promise<ComponentNode> {
 const c=readComponents(projectId).components.find(c=>c.id===componentId);
 const variant=variantId?c?.variants.find(v=>v.id===variantId):c?.variants[0];
 const node=variant?await figma.getNodeByIdAsync(variant.nodeId):null;
 if(!node||node.type!=='COMPONENT'||read(node,'id')!==variant?.id||read(node,'projectId')!==projectId) throw new MagicUiError(failure('INVALID_INPUT',`Render component first: ${componentId}/${variantId??''}`));
 return node;
}
export async function applyInstance(node:InstanceNode,spec:Extract<NodeSpecification,{type:'component-instance'}>,projectId:string) {
 const registry=readComponents(projectId);const c=registry.components.find(c=>c.id===spec.componentId);
 if(!c)throw new MagicUiError(failure('INVALID_INPUT','Component is not rendered.'));
 const initial=c.variants.find(v=>v.id===spec.variant)!;
 const values={...initial.values,...Object.fromEntries(Object.entries(spec.overrides).filter(([id])=>c.properties.some(p=>p.id===id&&p.type==='VARIANT')))};
 const selected=c.variants.find(v=>Object.entries(values).every(([k,val])=>v.values[k]===val));
 if(!selected)throw new MagicUiError(failure('INVALID_INPUT','Variant combination is not declared.'));
 const main=await findVariant(projectId,c.id,selected.id);
 if((await node.getMainComponentAsync())?.id!==main.id)node.swapComponent(main);
 const properties:Record<string,string|boolean>={};
 for(const p of c.properties) {
  if(p.type==='VARIANT')continue;
  const value=spec.overrides[p.id]??p.defaultValue;
  const propertyKey=Object.keys(node.componentProperties).find(k=>k===p.name||k.startsWith(`${p.name}#`));
  if(!propertyKey)throw new MagicUiError(failure('INVALID_INPUT',`Missing component property ${p.id}`));
  properties[propertyKey]=p.type==='INSTANCE_SWAP'?(await findVariant(projectId,String(value))).id:value;
 }
 if(Object.entries(properties).some(([k,v])=>node.componentProperties[k]?.value!==v))node.setProperties(properties);
}
let busy=false;
export async function renderDesignSystem(raw:DesignSystemInput,cancelled:()=>boolean):Promise<DesignSystemResult> {
 if(busy)throw new MagicUiError(failure('SESSION_BUSY','Design system render in progress.'));
 busy=true;
 try {
 const input=designSystemInputSchema.parse(raw),spec=input.specification;
 if(spec.projectId!==input.projectId)throw new MagicUiError(failure('INVALID_INPUT','Project IDs differ.'));
 const active=()=>{if(cancelled())throw new MagicUiError(failure('CANCELLED','Render cancelled.'));if(figma.currentPage.id!==input.pageId)throw new MagicUiError(failure('PAGE_CHANGED','Target page changed.'));}; active();
 const previous=readComponents(input.projectId);
 const variables=await projectVariables(input.projectId);
 const collections=(await figma.variables.getLocalVariableCollectionsAsync()).filter(c=>read(c,'projectId')===input.projectId);
 const styles=(await figma.getLocalTextStylesAsync()).filter(s=>read(s,'projectId')===input.projectId);
 const unique=(items:{getSharedPluginData(ns:string,key:string):string}[])=>{const ids=items.map(v=>read(v,'id'));if(new Set(ids).size!==ids.length)drift('Duplicate design system identity.');}; unique(variables);unique(styles);
 if(collections.length>1)drift('Duplicate token collection.');
 const variableSnapshot=(v:Variable)=>canonicalJson({name:v.name,type:v.resolvedType,values:v.valuesByMode,collection:v.variableCollectionId});
 const styleSnapshot=(s:TextStyle)=>canonicalJson({name:s.name,fontName:s.fontName,fontSize:s.fontSize,lineHeight:s.lineHeight,letterSpacing:s.letterSpacing});
 for(const v of variables)if(read(v,'snapshot')!==variableSnapshot(v))drift(`Variable changed manually: ${read(v,'id')}`);
 for(const s of styles)if(read(s,'snapshot')!==styleSnapshot(s))drift(`Text style changed manually: ${read(s,'id')}`);
 let collection=collections[0];
 if(collection&&read(collection,'snapshot')!==canonicalJson({name:collection.name,modes:collection.modes}))drift('Token collection changed manually.');
 const existingNodes=new Map<string,SceneNode>();
 for(const c of previous.components) {
  const set=await figma.getNodeByIdAsync(c.nodeId);
  if(!set||set.type!=='COMPONENT_SET'||read(set,'id')!==c.id)drift(`Component set moved or missing: ${c.id}`);
  for(const n of [set,...set.findAll(n=>read(n,'projectId')===input.projectId)]) {
    if(read(n,'snapshot')!==snapshot(n))drift(`Component changed manually: ${read(n,'id')}`);
    const identity=`${c.id}:${read(n,'id')}`;if(existingNodes.has(identity))drift('Duplicate component node identity.');existingNodes.set(identity,n);
  }
 }
 for(const c of spec.components)for(const v of c.variants)await loadSpecificationFonts(resolveTokenReferences(v.root,spec.tokens));
 for(const s of spec.tokens.typography) {try {await figma.loadFontAsync({family:s.fontFamily,style:s.fontStyle});}catch {throw new MagicUiError(failure('FONT_UNAVAILABLE',`Font unavailable: ${s.fontFamily}/${s.fontStyle}`));}}
 active();
 if(spec.tokens.values.length) {
  if(!collection){collection=figma.variables.createVariableCollection('Magic UI');write(collection,'id','tokens');write(collection,'projectId',input.projectId);}
  const modes=new Map(collection.modes.map(m=>[m.name,m.modeId]));
  if(!read(collection,'snapshot')) {collection.renameMode(collection.defaultModeId,spec.tokens.modes[0]!);modes.clear();modes.set(spec.tokens.modes[0]!,collection.defaultModeId);}
  for(const mode of spec.tokens.modes)if(!modes.has(mode))modes.set(mode,collection.addMode(mode));
  const byId=new Map(variables.map(v=>[read(v,'id'),v]));
  for(const t of spec.tokens.values) {
    const type=t.type==='color'?'COLOR':t.type==='number'?'FLOAT':'STRING';let v=byId.get(t.id);
    if(v&&v.resolvedType!==type)drift('Changing token type requires migration.');
    if(!v){v=figma.variables.createVariable(t.id,collection,type);write(v,'id',t.id);write(v,'projectId',input.projectId);variables.push(v);byId.set(t.id,v);}
  }
  for(const t of spec.tokens.values) {
    const v=byId.get(t.id)!;
    for(const mode of spec.tokens.modes) {
      const raw=t.values[mode]!;const resolved=resolveToken(spec.tokens,t.id,mode);
      const value:VariableValue=typeof raw==='object'?figma.variables.createVariableAlias(byId.get(raw.token)!):t.type==='color'?{r:parseInt(String(resolved).slice(1,3),16)/255,g:parseInt(String(resolved).slice(3,5),16)/255,b:parseInt(String(resolved).slice(5,7),16)/255}:resolved;
      const modeId=modes.get(mode)!;if(canonicalJson(v.valuesByMode[modeId])!==canonicalJson(value))v.setValueForMode(modeId,value);
    }
    write(v,'snapshot',variableSnapshot(v));
  }
  write(collection,'snapshot',canonicalJson({name:collection.name,modes:collection.modes}));
 }
 for(const token of spec.tokens.typography) {
  let style=styles.find(s=>read(s,'id')===token.id);
  if(!style){style=figma.createTextStyle();write(style,'id',token.id);write(style,'projectId',input.projectId);styles.push(style);}
  style.name=token.name;style.fontName={family:token.fontFamily,style:token.fontStyle};style.fontSize=token.fontSize;style.lineHeight=token.lineHeight==='auto'?{unit:'AUTO'}:{unit:'PIXELS',value:token.lineHeight};style.letterSpacing={unit:'PIXELS',value:token.letterSpacing};write(style,'snapshot',styleSnapshot(style));
 }
 let page=figma.root.children.find(p=>read(p,'designSystemProject')===input.projectId);
 if(spec.components.length&&!page){page=figma.createPage();page.name='Components';write(page,'designSystemProject',input.projectId);}
 if(page)await page.loadAsync();active();
 let workspace=page?.children.find(n=>read(n,'id')==='workspace');
 if(page&&!workspace){workspace=figma.createFrame();workspace.name='Workspace';workspace.layoutMode='VERTICAL';workspace.itemSpacing=48;page.appendChild(workspace);write(workspace,'id','workspace');write(workspace,'projectId',input.projectId);}
 const registry:ComponentRegistry={projectId:input.projectId,components:[...previous.components]};
 for(const c of orderComponents(spec.components)) {
  active();
  if(!workspace||workspace.type!=='FRAME')drift('Missing component workspace.');
  let section=workspace.children.find(n=>read(n,'id')===`category:${c.category}`);
  if(!section){section=figma.createFrame();section.name=c.category;section.layoutMode='VERTICAL';section.itemSpacing=24;workspace.appendChild(section);write(section,'id',`category:${c.category}`);write(section,'projectId',input.projectId);}
  if(section.type!=='FRAME')drift('Category identity is not a frame.');
  let set=existingNodes.get(`${c.id}:${c.id}`) as ComponentSetNode|undefined;
  const variantRecords:ComponentRegistry['components'][number]['variants']=[];
  for(const v of c.variants) {
   const prefix=`${v.id}/`;
   const tree=async(rawNode:NodeSpecification,parent:ChildrenMixin&BaseNode,index:number,isRoot=false):Promise<SceneNode>=>{
    const id=isRoot?v.id:prefix+rawNode.id;
    let node=existingNodes.get(`${c.id}:${id}`);
    const expected=isRoot?'COMPONENT':rawNode.type==='component-instance'?'INSTANCE':rawNode.type.toUpperCase();
    if(node&&node.type!==expected)drift('Changing component node type requires migration.');
    if(!node){node=isRoot?figma.createComponent():rawNode.type==='frame'?figma.createFrame():rawNode.type==='text'?figma.createText():rawNode.type==='rectangle'?figma.createRectangle():(await findVariant(input.projectId,rawNode.componentId,rawNode.variant)).createInstance();write(node,'id',id);write(node,'projectId',input.projectId);}
    if(node.parent?.id!==parent.id||parent.children.indexOf(node)!==index)parent.insertChild(index,node);
    const resolved=resolveTokenReferences(rawNode,spec.tokens);applyProperties(node as FrameNode|ComponentNode|InstanceNode|TextNode|RectangleNode,resolved,'ltr');
    if(rawNode.type==='component-instance'&&node.type==='INSTANCE')await applyInstance(node,rawNode,input.projectId);
    await applyTokenBindings(node,rawNode,spec.tokens,variables,styles);
    if('nodes'in rawNode&&'insertChild'in node)for(const [i,child]of rawNode.nodes.entries())await tree(child,node,i);
    write(node,'intent',canonicalJson(rawNode));return node;
   };
   const root=await tree(v.root,set??section,(set??section).children.length,true) as ComponentNode;
   const variantName=Object.entries(v.values).map(([id,val])=>`${c.properties.find(p=>p.id===id)!.name}=${val}`).join(', ')||v.name;
   root.name=variantName;
   if(!set){set=figma.combineAsVariants([root],section);write(set,'id',c.id);write(set,'projectId',input.projectId);set.name=c.name;set.layoutMode='HORIZONTAL';set.itemSpacing=24;}
   else if(root.parent?.id!==set.id)set.appendChild(root);
   variantRecords.push({id:v.id,name:v.name,nodeId:root.id,values:v.values});
  }
  if(!set)throw new Error('Missing component set');
  for(const property of c.properties) {
    if(property.type==='VARIANT')continue;
    let propertyKey=Object.keys(set.componentPropertyDefinitions).find(k=>k===property.name||k.startsWith(`${property.name}#`));
    const defaultValue=property.type==='INSTANCE_SWAP'?(await findVariant(input.projectId,String(property.defaultValue))).id:property.defaultValue;
    if(!propertyKey)propertyKey=set.addComponentProperty(property.name,property.type,defaultValue);
    else {const current=set.componentPropertyDefinitions[propertyKey]!;if(current.type!==property.type)drift('Property type changed.');if(current.defaultValue!==defaultValue)set.editComponentProperty(propertyKey,{defaultValue});}
    for(const variant of c.variants) {
      const root=set.children.find(n=>read(n,'id')===variant.id) as ComponentNode;
      const target=variant.root.id===property.targetId?root:root.findOne(n=>read(n,'id')===`${variant.id}/${property.targetId}`);
      if(!target)throw new Error('Missing property target');
      target.componentPropertyReferences={...target.componentPropertyReferences,[property.type==='TEXT'?'characters':property.type==='BOOLEAN'?'visible':'mainComponent']:propertyKey};
    }
  }
  const usage:string[]=[];const countUsage=(n:NodeSpecification)=>{if(n.type==='component-instance'&&n.componentId===c.id)usage.push(n.id);if('nodes'in n)n.nodes.forEach(countUsage);};spec.pages.forEach(p=>p.screens.forEach(s=>s.nodes.forEach(countUsage)));spec.components.forEach(c=>c.variants.forEach(v=>countUsage(v.root)));
  const entry={id:c.id,name:c.name,category:c.category,nodeId:set.id,properties:c.properties,variants:variantRecords,dependencies:componentDependencies(c),usage,version:c.version};
  registry.components=registry.components.filter(e=>e.id!==c.id).concat(entry);
  write(figma.root,key(input.projectId),canonicalJson(registry));
  for(const n of [set,...set.findAll(n=>read(n,'projectId')===input.projectId)])write(n,'snapshot',snapshot(n));
 }
 const result=await readVariables(input.projectId);
 return {...registry,variables:result,componentCount:registry.components.reduce((n,c)=>n+c.variants.length,0),variableCount:result.variables.length};
 } finally {busy=false;}
}
