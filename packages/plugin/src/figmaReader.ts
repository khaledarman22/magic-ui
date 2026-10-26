import { failure, MagicUiError, type ReaderInput, type ReaderChunk, type RawFigmaNode, type FigmaExtraction } from '@magic-ui/shared';

const snapshots = new Map<string, { key: string; text: string; encoding: ReaderChunk['encoding']; expires: number }>();
let sequence = 0;
const MAX_SNAPSHOT = 32 * 1024 * 1024;
export function resetReaderSnapshots() { snapshots.clear(); }
function check(cancelled: () => boolean) {
  if (cancelled()) throw new MagicUiError(failure('CANCELLED', 'Read cancelled.'));
}
function copy(value: unknown): unknown {
  if (typeof value === 'symbol') return { mixed: true };
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value)) as unknown;
}
const fields = ['x','y','width','height','visible','opacity','rotation','relativeTransform','constraints','layoutMode','layoutSizingHorizontal','layoutSizingVertical','layoutPositioning','primaryAxisAlignItems','counterAxisAlignItems','primaryAxisSizingMode','counterAxisSizingMode','paddingTop','paddingRight','paddingBottom','paddingLeft','itemSpacing','layoutWrap','counterAxisSpacing','clipsContent','fills','strokes','strokeWeight','strokeAlign','strokeCap','strokeJoin','dashPattern','cornerRadius','topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius','effects','blendMode','boundVariables','explicitVariableModes','resolvedVariableModes','fillStyleId','strokeStyleId','effectStyleId','textStyleId','characters','fontName','fontSize','lineHeight','letterSpacing','textAlignHorizontal','textAlignVertical','textAutoResize','textCase','textDecoration','paragraphSpacing','paragraphIndent','componentPropertyReferences','variantProperties','vectorPaths','exportSettings'] as const;
async function readNode(node: BaseNode): Promise<RawFigmaNode> {
  const properties: Record<string, unknown> = {};
  for (const key of fields) if (key in node) properties[key] = copy(Reflect.get(node, key));
  if (node.type === 'COMPONENT_SET' || (node.type === 'COMPONENT' && node.parent?.type !== 'COMPONENT_SET')) properties.componentPropertyDefinitions = copy(node.componentPropertyDefinitions);
  if (node.type === 'INSTANCE') {
    properties.componentProperties = copy(node.componentProperties);
    properties.overrides = copy(node.overrides);
    properties.mainComponentId = (await node.getMainComponentAsync())?.id ?? null;
  }
  if (node.type === 'TEXT') properties.styledTextSegments = copy(node.getStyledTextSegments(['fontName','fontSize','fills','textStyleId','lineHeight','letterSpacing','textCase','textDecoration','hyperlink','listOptions','indentation']));
  const identity: Record<string,string> = {};
  for (const key of ['id','projectId','screenId','intent','snapshot','specVersion','registry','propertyKeys']) {
    const value = node.getSharedPluginData('magic_ui', key);
    if (value) identity[key] = value;
  }
  return {id: node.id, name: node.name, type: node.type, parentId: node.parent?.id ?? null, childIds: 'children' in node ? node.children.map(c => c.id) : [], properties, identity};
}
async function resources() {
  const variables = await figma.variables.getLocalVariablesAsync();
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const styles = [...await figma.getLocalTextStylesAsync(), ...await figma.getLocalPaintStylesAsync(), ...await figma.getLocalEffectStylesAsync(), ...await figma.getLocalGridStylesAsync()];
  const pick = (item: object, keys: string[]) => Object.fromEntries(keys.filter(k => k in item).map(k => [k, copy(Reflect.get(item,k))]));
  return {
    variables: variables.map(v => ({...pick(v,['id','name','resolvedType','variableCollectionId','valuesByMode','scopes','description']), stableId: v.getSharedPluginData('magic_ui','id')})),
    collections: collections.map(c => pick(c,['id','name','modes','defaultModeId'])),
    styles: styles.map(s => ({...pick(s,['id','name','type','fontName','fontSize','lineHeight','letterSpacing','paints','effects','layoutGrids','description']), stableId: s.getSharedPluginData('magic_ui','id')})),
  };
}
async function extract(input: ReaderInput, cancelled: () => boolean): Promise<FigmaExtraction> {
  let roots: readonly BaseNode[];
  if (input.scope === 'document' || input.scope === 'pages') roots = figma.root.children;
  else if (input.scope === 'selection') roots = figma.currentPage.selection;
  else if (input.scope === 'styles') roots = [];
  else {
    if (!input.nodeId) throw new MagicUiError(failure('INVALID_INPUT','nodeId is required for a scoped read.'));
    const target = await figma.getNodeByIdAsync(input.nodeId);
    if (!target) throw new MagicUiError(failure('NODE_NOT_FOUND','Read target was not found.'));
    roots = [target];
  }
  const nodes: RawFigmaNode[] = [], seen = new Set<string>();
  const stack = [...roots].reverse();
  let size = 0;
  while (stack.length) {
    check(cancelled);
    const node = stack.pop()!;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    if (node.type === 'PAGE' && input.scope !== 'pages') await node.loadAsync();
    const record = input.scope === 'pages' ? {id:node.id,name:node.name,type:node.type,parentId:figma.root.id,childIds:[],properties:{},identity:{}} : await readNode(node);
    nodes.push(record);
    size += JSON.stringify(record).length;
    if (size > MAX_SNAPSHOT || nodes.length > 100000) throw new MagicUiError(failure('MESSAGE_TOO_LARGE','Scope exceeds snapshot budget; read a smaller subtree.'));
    if (input.scope !== 'pages' && 'children' in node) stack.push(...[...node.children].reverse());
  }
  check(cancelled);
  const data = input.scope === 'pages' ? {variables:[],collections:[],styles:[]} : await resources();
  check(cancelled);
  const registries: unknown[] = [];
  for (const projectId of new Set(nodes.map(n => n.identity.projectId).filter(Boolean))) {
    const saved = figma.root.getSharedPluginData('magic_ui', `design-system:${projectId}`);
    if (saved) { try { registries.push(JSON.parse(saved) as unknown); } catch { /* Invalid metadata is not a source of truth. */ } }
  }
  return {document:{id:figma.root.id,name:figma.root.name}, roots:roots.map(n=>n.id), nodes, registries, ...data};
}
export async function readFigma(input: ReaderInput, cancelled: () => boolean): Promise<ReaderChunk> {
  check(cancelled);
  const key = JSON.stringify({...input,cursor:undefined});
  for (const [id,s] of snapshots) if (s.expires < Date.now()) snapshots.delete(id);
  let id: string, offset = 0;
  if (input.cursor) {
    const match = /^(\d+):(\d+)$/.exec(input.cursor);
    if (!match) throw new MagicUiError(failure('INVALID_CURSOR','Invalid read cursor.'));
    id = match[1]!; offset = Number(match[2]);
    const snapshot = snapshots.get(id);
    if (!snapshot || snapshot.key !== key || offset <= 0 || offset >= snapshot.text.length || offset % 8000 !== 0) throw new MagicUiError(failure('INVALID_CURSOR','Cursor expired or belongs to another scope.'));
  } else {
    let text: string, encoding: ReaderChunk['encoding'] = 'json';
    if (input.scope === 'asset') {
      if (!input.nodeId) throw new MagicUiError(failure('INVALID_INPUT','nodeId is required.'));
      const node = await figma.getNodeByIdAsync(input.nodeId);
      check(cancelled);
      if (!node || !('exportAsync' in node)) throw new MagicUiError(failure('NODE_NOT_FOUND','Target cannot be exported.'));
      const bytes = await node.exportAsync(input.format === 'PNG' ? {format:'PNG',constraint:{type:'SCALE',value:input.scale}} : {format:'SVG'});
      text = figma.base64Encode(bytes); encoding = 'base64';
    } else text = JSON.stringify(await extract(input,cancelled));
    check(cancelled);
    if (text.length > MAX_SNAPSHOT) throw new MagicUiError(failure('MESSAGE_TOO_LARGE','Export exceeds snapshot budget.'));
    if (snapshots.size >= 4) snapshots.delete(snapshots.keys().next().value!);
    id = String(++sequence);
    snapshots.set(id,{key,text,encoding,expires:Date.now()+300000});
  }
  const snapshot = snapshots.get(id)!;
  const end = Math.min(offset+8000,snapshot.text.length);
  return {data:snapshot.text.slice(offset,end),encoding:snapshot.encoding,nextCursor:end < snapshot.text.length ? `${id}:${end}` : null};
}
