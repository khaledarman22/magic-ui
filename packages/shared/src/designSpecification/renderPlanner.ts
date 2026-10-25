import type { NodeSpecification, ScreenSpecification } from './schema.js';
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}
// Non-cryptographic sync fingerprint; exact snapshots are also retained for drift checks.
export function syncHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
export type RenderEntry = { id: string; parentId: string | null; index: number; specification: NodeSpecification; intent: string };
export type ExistingRenderNode = { id: string; nodeId: string; intent: string };
export function flattenScreen(screen: ScreenSpecification): RenderEntry[] {
  const entries: RenderEntry[] = [];
  const visit = (node: NodeSpecification, parentId: string | null, index: number) => {
    const { nodes: _children, ...properties } = 'nodes' in node ? node : { ...node, nodes: undefined };
    entries.push({ id: node.id, parentId, index, specification: node, intent: canonicalJson({ ...properties, direction: screen.direction, parentId, index }) });
    if ('nodes' in node) {
      const children = screen.direction === 'rtl' && node.layout.type === 'auto-layout' && node.layout.direction === 'horizontal' ? [...node.nodes].reverse() : node.nodes;
      children.forEach((child, i) => visit(child, node.id, i));
    }
  };
  const { direction: _direction, ...root } = screen;
  visit({ ...root, type: 'frame' }, null, 0);
  return entries;
}
export function planRender(screen: ScreenSpecification, existing: ExistingRenderNode[]) {
  const entries = flattenScreen(screen);
  const byId = new Map(existing.map(node => [node.id, node]));
  const desiredIds = new Set(entries.map(entry => entry.id));
  return {
    operations: entries.map(entry => ({ ...entry, action: !byId.has(entry.id) ? 'create' as const : byId.get(entry.id)!.intent === entry.intent ? 'unchanged' as const : 'update' as const })),
    orphanedNodes: existing.filter(node => !desiredIds.has(node.id)).map(({ id, nodeId }) => ({ id, nodeId })),
  };
}
