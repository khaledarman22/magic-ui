import { componentRegistrySchema, designSpecificationSchema, nodeSpecificationSchema, screenSpecificationSchema, tokensSchema, type FigmaExtraction, type RawFigmaNode, type MissingInformation, type Tokens, type NodeSpecification, type ComponentSpecification } from '@magic-ui/shared';
const obj = (v: unknown): Record<string,unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string,unknown> : {};
const arr = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const num = (v: unknown, fallback = 0) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const sid = (v: string) => `f-${Array.from(v).map(c=>c.codePointAt(0)!.toString(16)).join('-')}`.slice(0,80);
const hex = (v: unknown) => { const c=obj(v); return '#'+['r','g','b'].map(k=>Math.round(num(c[k])*255).toString(16).padStart(2,'0')).join('').toUpperCase(); };

export function normalizeFigma(data: FigmaExtraction, projectId: string) {
  const missing: MissingInformation[] = [];
  const report = (field:string, reason:string, value:unknown, nodeId?:string) => missing.push({field,reason,value,...(nodeId ? {nodeId}: {})});
  const nodes = new Map(data.nodes.map(n=>[n.id,n]));
  const registries = data.registries.flatMap(r=> { const p=componentRegistrySchema.safeParse(r); return p.success ? p.data.components : []; });
  const variableIds = new Map(data.variables.map(v=>[String(v.id), String(v.stableId || sid(String(v.id)))]));
  const collections = new Map(data.collections.map(c=>[String(c.id),c]));
  const modeNames = [...new Set(data.collections.flatMap(c=>arr(c.modes).map(m=>String(obj(m).name))))];
  const modes = modeNames.length ? modeNames.slice(0,4) : ['light'];
  if (modeNames.length>4) report('tokens.modes','Schema supports at most four modes.',data.collections);
  const values: Tokens['values'] = [];
  for (const v of data.variables) {
    const id=variableIds.get(String(v.id))!;
    const collection=collections.get(String(v.variableCollectionId));
    const byMode=obj(v.valuesByMode);
    if (!['COLOR','FLOAT','STRING'].includes(String(v.resolvedType))) {report('variable','Unsupported variable type.',v);continue;}
    const out: Record<string,string|number|{token:string}> = {};
    for (const mode of modes) {
      const modeId=arr(collection?.modes).map(obj).find(m=>m.name===mode)?.modeId;
      const value=byMode[String(modeId ?? collection?.defaultModeId)];
      if (modeId === undefined) report('variable.mode','No matching mode in this collection; default mode used.',{variableId:v.id,mode});
      const alias=obj(value);
      if(alias.type==='VARIABLE_ALIAS' && variableIds.has(String(alias.id))) out[mode]={token:variableIds.get(String(alias.id))!};
      else if(v.resolvedType==='COLOR' && 'r' in alias) {out[mode]=hex(value); if ('a' in alias && alias.a !== 1) report('variable.alpha','Color token schema has no alpha channel.',v);}
      else if(typeof value==='string'||typeof value==='number') out[mode]=value;
      else report('variable.value','Unresolved value or external alias.',v);
    }
    if(Object.keys(out).length===modes.length) values.push({id,type:v.resolvedType==='COLOR'?'color':v.resolvedType==='FLOAT'?'number':'string',category:id.startsWith('space.')?'spacing':id.startsWith('radius.')?'radius':Object.values(out).some(v=>typeof v==='object')?'semantic':'primitive',values:out});
  }
  const typography: Tokens['typography'] = [];
  for(const s of data.styles) {
    if(s.type !== 'TEXT' && !s.fontName) {report('style','Style retained in raw extraction; not represented in typography schema.',s);continue;}
    const f=obj(s.fontName), l=obj(s.lineHeight), spacing=obj(s.letterSpacing);
    const size=num(s.fontSize,16);
    typography.push({id:String(s.stableId||sid(String(s.id))),name:String(s.name),fontFamily:String(f.family),fontStyle:String(f.style),fontSize:size,lineHeight:l.unit==='AUTO'?'auto':l.unit==='PERCENT'?num(l.value)*size/100:num(l.value,size),letterSpacing:spacing.unit==='PERCENT'?num(spacing.value)*size/100:num(spacing.value)});
  }
  let tokens: Tokens = {modes, values:values.slice(0,200), typography:typography.slice(0,100)};
  const tokenCheck=tokensSchema.safeParse(tokens);
  if(!tokenCheck.success) {report('tokens','Token schema limits or identifiers unsupported; raw values retained.',tokens); tokens=tokensSchema.parse({});}
  const usableTokens=new Set(tokens.values.map(v=>v.id));
  // Drop unresolved aliases transitively, preserving each removed value in the report.
  for(let changed=true;changed;) {changed=false; tokens.values=tokens.values.filter(v=>{const valid=Object.values(v.values).every(x=>typeof x!=='object'||usableTokens.has(x.token));if(!valid){report('token','Alias target not representable.',v);usableTokens.delete(v.id);changed=true;}return valid;});}
  const ref=(value:unknown): {token:string}|undefined => {const alias=obj(Array.isArray(value)?value[0]:value);const token=variableIds.get(String(alias.id));return token && usableTokens.has(token)?{token}:undefined;};
  const nodeId=(n:RawFigmaNode) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(n.identity.id??'') ? n.identity.id! : sid(n.id);
  const metadata=new Map(registries.map(c=>[c.nodeId,c]));
  const componentRoots=data.nodes.filter(n=>n.type==='COMPONENT_SET'||(n.type==='COMPONENT' && nodes.get(n.parentId??'')?.type!=='COMPONENT_SET'));
  const variantLinks=new Map<string,{componentId:string;variant:string}>();
  for(const root of componentRoots) for(const v of root.type==='COMPONENT_SET'?root.childIds.map(id=>nodes.get(id)).filter((n):n is RawFigmaNode=>!!n):[root]) {
    const saved=metadata.get(root.id);variantLinks.set(v.id,{componentId:saved?.id??nodeId(root),variant:saved?.variants.find(x=>x.nodeId===v.id)?.id??sid(v.id)});
  }
  const convert=(n:RawFigmaNode,depth=0):NodeSpecification|undefined=>{
    if(depth>32){report('node','Schema nesting limit exceeded.',n,n.id);return;}
    const p=n.properties, b=obj(p.boundVariables);
    const bound=(field:string,fallback:unknown)=>ref(b[field])??fallback;
    const auto=p.layoutMode==='HORIZONTAL'||p.layoutMode==='VERTICAL';
    const dimension=(axis:'width'|'height')=>{
      const sizing=p[axis==='width'?'layoutSizingHorizontal':'layoutSizingVertical'];
      if(sizing==='HUG' && (auto||n.type==='TEXT')) return 'hug';
      if(sizing==='FILL') {const parent=nodes.get(n.parentId??'')?.properties; const pa=axis==='width'?'layoutSizingHorizontal':'layoutSizingVertical'; if(parent && parent.layoutMode!=='NONE' && parent[pa]!=='HUG' && p.layoutPositioning!=='ABSOLUTE')return 'fill';report(`layout.${axis}`,'Fill outside a representable parent; resolved size retained.',p,n.id);}
      if(n.type==='TEXT' && (p.textAutoResize==='WIDTH_AND_HEIGHT'||(axis==='height'&&p.textAutoResize==='HEIGHT'))) return 'hug';
      return bound(axis,Math.max(0.01,num(p[axis],100)));
    };
    const align=(v:unknown)=>v==='CENTER'?'center':v==='MAX'?'end':v==='SPACE_BETWEEN'?'space-between':'start';
    const paints=(field:'fills'|'strokes')=>arr(p[field]).flatMap(v=>{const paint=obj(v);if(paint.type!=='SOLID'||paint.visible===false){report(field,'Paint is not a visible solid fill.',v,n.id);return []; }return [{color:ref(obj(paint.boundVariables).color)??hex(paint.color),opacity:num(paint.opacity,1)}];});
    const common={id:nodeId(n),name:n.name.slice(0,256)||n.type,layout:{type:auto?'auto-layout':'absolute',positioning:p.layoutPositioning==='ABSOLUTE'?'absolute':'auto',direction:p.layoutMode==='HORIZONTAL'?'horizontal':'vertical',width:dimension('width'),height:dimension('height'),x:num(p.x),y:num(p.y),padding:{top:bound('paddingTop',num(p.paddingTop)),right:bound('paddingRight',num(p.paddingRight)),bottom:bound('paddingBottom',num(p.paddingBottom)),left:bound('paddingLeft',num(p.paddingLeft))},itemSpacing:bound('itemSpacing',Math.max(0,num(p.itemSpacing))),alignment:align(p.counterAxisAlignItems),primaryAlignment:align(p.primaryAxisAlignItems)},styling:{fills:paints('fills'),strokes:paints('strokes'),strokeWeight:bound('strokeWeight',num(p.strokeWeight,1)),cornerRadius:n.type==='TEXT'?0:bound('topLeftRadius',num(p.cornerRadius)),opacity:bound('opacity',num(p.opacity,1))}};
    // Preserve every raw property alongside the projection, including effects, constraints and mixed runs.
    report('rawProperties','Source properties retained for unsupported fields and exact reconstruction; normalized subset is in design-spec.json.',p,n.id);
    let candidate: unknown;
    if(n.type==='INSTANCE' && variantLinks.has(String(p.mainComponentId))) {
      const link=variantLinks.get(String(p.mainComponentId))!;
      const registry=registries.find(c=>c.id===link.componentId);
      const overrides:Record<string,string|boolean>={};
      for(const [key,value] of Object.entries(obj(p.componentProperties))) {
        const property=registry?.properties.find(prop=>registry.propertyKeys[prop.id]===key);
        const v=obj(value).value;
        if(property && (typeof v==='string'||typeof v==='boolean') && property.type!=='INSTANCE_SWAP') overrides[property.id]=v;
        else report('instance.override','Property retained in raw extraction.',{key,value},n.id);
      }
      candidate={...common,type:'component-instance',...link,overrides};
    } else if(n.type==='TEXT') {
      const f=obj(p.fontName),l=obj(p.lineHeight),ls=obj(p.letterSpacing), size=num(p.fontSize,16);
      if(!f.family || !f.style) {report('text','Mixed typography cannot be represented as a single text node; styled segments retained.',p.styledTextSegments,n.id);return;}
      const style=data.styles.find(s=>s.id===p.textStyleId);
      candidate={...common,type:'text',content:bound('characters',String(p.characters??'')),fontFamily:bound('fontFamily',f.family),fontStyle:bound('fontStyle',f.style),fontSize:bound('fontSize',size),lineHeight:bound('lineHeight',l.unit==='AUTO'||!l.unit?'auto':l.unit==='PERCENT'?num(l.value)*size/100:num(l.value)),letterSpacing:bound('letterSpacing',ls.unit==='PERCENT'?num(ls.value)*size/100:num(ls.value)),textAlign:String(p.textAlignHorizontal??'LEFT').toLowerCase(),...(style?{typography:String(style.stableId||sid(String(style.id)))}:{})};
    } else if(n.type==='RECTANGLE') candidate={...common,type:'rectangle'};
    else if(['FRAME','COMPONENT','COMPONENT_SET','GROUP','SECTION','INSTANCE'].includes(n.type)) {
      if(n.type==='INSTANCE') report('instance','Main component outside requested scope; expanded instance retained.',p.mainComponentId,n.id);
      candidate={...common,type:'frame',nodes:n.childIds.map(id=>nodes.get(id)).filter((x):x is RawFigmaNode=>!!x).map(c=>convert(c,depth+1)).filter((x):x is NodeSpecification=>!!x)};
    } else {report('node','Node type has no equivalent in Design Spec; use exported asset.',n,n.id);return;}
    const parsed=nodeSpecificationSchema.safeParse(candidate);
    if(!parsed.success){report('node','Node exceeds Design Spec constraints.',{candidate,errors:parsed.error.issues},n.id);return;}
    return parsed.data;
  };
  const components:ComponentSpecification[]=[];
  for(const root of componentRoots){
    const saved=metadata.get(root.id);
    const variants=(root.type==='COMPONENT_SET'?root.childIds.map(id=>nodes.get(id)).filter((n):n is RawFigmaNode=>n?.type==='COMPONENT'):[root]).flatMap(n=>{const converted=convert(n);if(converted?.type!=='frame')return [];const record=saved?.variants.find(v=>v.nodeId===n.id);return [{id:variantLinks.get(n.id)!.variant,name:record?.name??n.name,values:record?.values??{},root:converted}];});
    if(!variants.length)continue;
    components.push({id:saved?.id??nodeId(root),name:root.name,category:saved?.category??'imported',version:saved?.version??1,properties:saved?.properties??[],dependencies:[],variants});
    if(!saved)report('component.properties','Native definitions and variant properties retained; stable property mapping is unavailable.',root.properties,root.id);
  }
  const pages: {id:string;name:string;screens:ReturnType<typeof screenSpecificationSchema.parse>[]}[]=[];
  for(const rootId of data.roots){const root=nodes.get(rootId);if(!root)continue;
    const candidates=root.type==='PAGE'?root.childIds.map(id=>nodes.get(id)).filter((n):n is RawFigmaNode=>!!n):[root];
    const screens=candidates.filter(n=>!['COMPONENT','COMPONENT_SET'].includes(n.type) && !n.identity.id?.startsWith('workspace')).flatMap(n=>{const v=convert(n);if(!v)return [];if(v.type==='frame')return [screenSpecificationSchema.parse({id:v.id,name:v.name,layout:v.layout,styling:v.styling,nodes:v.nodes})];report('screen','Non-frame root represented inside a screen wrapper.',n,n.id);return [screenSpecificationSchema.parse({id:`s-${sid(n.id)}`.slice(0,80),name:n.name.slice(0,256)||'Screen',layout:{width:Math.max(1,num(n.properties.width,100)),height:Math.max(1,num(n.properties.height,100))},nodes:[v]})];});
    if(screens.length)pages.push({id:`p-${sid(root.id)}`.slice(0,80),name:root.type==='PAGE'?root.name.slice(0,256):'Extracted',screens});
  }
  let candidate={schemaVersion:'1.0.0' as const,projectId,tokens,components,pages};
  let parsed=designSpecificationSchema.safeParse(candidate);
  // Schema limits are intentionally unchanged. Never emit invalid specifications or silently discard raw data.
  if(!parsed.success){report('design-spec','Full projection exceeds schema constraints; valid independent screens/components retained where possible.',parsed.error.issues);
    const accepted:typeof candidate={schemaVersion:'1.0.0',projectId,tokens,components:[],pages:[]};
    if(!designSpecificationSchema.safeParse(accepted).success){report('tokens','Cross-token validation failed; raw resources retained.',tokens);accepted.tokens=tokensSchema.parse({});}
    for(const c of components){const next={...accepted,components:[...accepted.components,c]};if(designSpecificationSchema.safeParse(next).success)accepted.components.push(c);else report('component','Component cannot be represented with current dependencies or schema limits.',c);}
    for(const p of pages)for(const screen of p.screens){const existing=accepted.pages.find(x=>x.id===p.id);const nextPages=existing?accepted.pages.map(x=>x.id===p.id?{...x,screens:[...x.screens,screen]}:x):[...accepted.pages,{...p,screens:[screen]}];const next={...accepted,pages:nextPages};if(designSpecificationSchema.safeParse(next).success)accepted.pages=nextPages;else report('screen','Screen cannot be represented within schema limits.',screen);}
    candidate=accepted;parsed=designSpecificationSchema.safeParse(candidate);
  }
  if(!parsed.success)throw new Error('Could not produce a valid normalized specification.');
  report('responsiveBehavior','Responsive rules and application behavior are not inferred from static design.',null);
  return {specification:parsed.data,missing};
}
