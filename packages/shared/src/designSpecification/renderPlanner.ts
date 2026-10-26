import { resolveTokenReferences, type Tokens } from './tokens.js';
import type {
  Layout,
  NodeSpecification,
  ScreenSpecification,
} from './schema.js';
// Bounded cache of escaped property names, never values or complete intents.
const encodedKeys = new Map<string, string>();
function encodeKey(key: string): string {
  const cached = encodedKeys.get(key);
  if (cached !== undefined) return cached;
  const encoded = JSON.stringify(key);
  if (key.length <= 128 && encodedKeys.size < 256)
    encodedKeys.set(key, encoded);
  return encoded;
}
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object')
    return JSON.stringify(value) ?? 'null';
  // Append directly: per-property callback arrays dominated measured planning.
  let result = '';
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      if (index) result += ',';
      // Preserve Array.map/join semantics for sparse arrays.
      if (index in value) result += canonicalJson(value[index]);
    }
    return `[${result}]`;
  }
  const object = value as Record<string, unknown>;
  for (const key of Object.keys(object).sort()) {
    if (result) result += ',';
    result += `${encodeKey(key)}:${canonicalJson(object[key])}`;
  }
  return `{${result}}`;
}
// Non-cryptographic sync fingerprint; exact snapshots are also retained for drift checks.
export function syncHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++)
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
export type RenderEntry = {
  id: string;
  parentId: string | null;
  index: number;
  specification: NodeSpecification;
  intent: string;
};
export type ExistingRenderNode = { id: string; nodeId: string; intent: string };
export function flattenScreen(
  screen: ScreenSpecification,
  tokens?: Tokens,
): RenderEntry[] {
  const entries: RenderEntry[] = [];
  const visit = (
    node: NodeSpecification,
    parentId: string | null,
    index: number,
    parentLayout: Layout | null,
  ) => {
    const properties: Record<string, unknown> = { ...node };
    delete properties.nodes;
    const unbound = {
      x: node.layout.x,
      y: node.layout.y,
      fillOpacity: node.styling.fills.map((p) => p.opacity),
      strokeOpacity: node.styling.strokes.map((p) => p.opacity),
    };
    if (tokens && JSON.stringify(unbound).includes('"token"'))
      properties.resolvedUnbound = resolveTokenReferences(unbound, tokens);
    entries.push({
      id: node.id,
      parentId,
      index,
      specification: node,
      intent: canonicalJson({
        ...properties,
        direction: screen.direction,
        parentId,
        parentLayout: parentLayout
          ? { type: parentLayout.type, direction: parentLayout.direction }
          : null,
        index,
      }),
    });
    if ('nodes' in node) {
      const children =
        screen.direction === 'rtl' &&
        node.layout.type === 'auto-layout' &&
        node.layout.direction === 'horizontal'
          ? [...node.nodes].reverse()
          : node.nodes;
      children.forEach((child, i) => visit(child, node.id, i, node.layout));
    }
  };
  visit(
    {
      id: screen.id,
      name: screen.name,
      layout: screen.layout,
      styling: screen.styling,
      nodes: screen.nodes,
      type: 'frame',
    },
    null,
    0,
    null,
  );
  return entries;
}
export function planRender(
  screen: ScreenSpecification,
  existing: ExistingRenderNode[],
  tokens?: Tokens,
) {
  const entries = flattenScreen(screen, tokens);
  const byId = new Map(existing.map((node) => [node.id, node]));
  const desiredIds = new Set(entries.map((entry) => entry.id));
  return {
    operations: entries.map((entry) => ({
      ...entry,
      action: !byId.has(entry.id)
        ? ('create' as const)
        : byId.get(entry.id)!.intent === entry.intent
          ? ('unchanged' as const)
          : ('update' as const),
    })),
    orphanedNodes: existing
      .filter((node) => !desiredIds.has(node.id))
      .map(({ id, nodeId }) => ({ id, nodeId })),
  };
}
