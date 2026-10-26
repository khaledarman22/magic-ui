import type {
  ComponentSpecification,
  DesignSpecification,
  NodeSpecification,
  Layout,
} from './schema.js';
import {
  nodeSpecificationSchema,
  screenSpecificationSchema,
} from './schema.js';
import { resolveTokenReferences } from './tokens.js';
export function componentDependencies(
  component: ComponentSpecification,
): string[] {
  const found = new Set(component.dependencies);
  const visit = (node: NodeSpecification) => {
    if (node.type === 'component-instance') found.add(node.componentId);
    if ('nodes' in node) node.nodes.forEach(visit);
  };
  component.variants.forEach((v) => visit(v.root));
  component.properties
    .filter((p) => p.type === 'INSTANCE_SWAP')
    .forEach((p) => found.add(String(p.defaultValue)));
  return [...found];
}
export function orderComponents(
  components: ComponentSpecification[],
): ComponentSpecification[] {
  const byId = new Map(components.map((c) => [c.id, c]));
  const done = new Set<string>(),
    active = new Set<string>();
  const ordered: ComponentSpecification[] = [];
  const visit = (id: string) => {
    if (done.has(id)) return;
    if (active.has(id)) throw new Error(`Circular component dependency: ${id}`);
    const c = byId.get(id);
    if (!c) throw new Error(`Unknown component: ${id}`);
    active.add(id);
    componentDependencies(c).forEach(visit);
    active.delete(id);
    done.add(id);
    ordered.push(c);
  };
  components.forEach((c) => visit(c.id));
  return ordered;
}
export function componentSimilarity(
  a: { name: string; properties: { name: string; type: string }[] },
  b: { name: string; properties: { name: string; type: string }[] },
): number {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean),
    );
  const score = (x: Set<string>, y: Set<string>) => {
    const union = new Set([...x, ...y]);
    return union.size ? [...x].filter((k) => y.has(k)).length / union.size : 1;
  };
  return (
    0.7 * score(words(a.name), words(b.name)) +
    0.3 *
      score(
        new Set(a.properties.map((p) => `${p.name.toLowerCase()}:${p.type}`)),
        new Set(b.properties.map((p) => `${p.name.toLowerCase()}:${p.type}`)),
      )
  );
}
export function componentWarnings(
  components: ComponentSpecification[],
): string[] {
  return components.flatMap((a, i) =>
    components
      .slice(i + 1)
      .filter((b) => componentSimilarity(a, b) >= 0.8)
      .map(
        (b) =>
          `Similar components: ${a.id} and ${b.id}. Reuse or extend an existing component where appropriate.`,
      ),
  );
}
export function validateDesignSystem(
  spec: DesignSpecification,
): { path: (string | number)[]; message: string }[] {
  const errors: { path: (string | number)[]; message: string }[] = [];
  const fail = (path: (string | number)[], message: string) =>
    errors.push({ path, message });
  const unique = (ids: string[], path: (string | number)[]) => {
    if (new Set(ids).size !== ids.length)
      fail(path, 'Duplicate stable identity.');
  };
  unique(spec.tokens.modes, ['tokens', 'modes']);
  unique(
    spec.tokens.values.map((t) => t.id),
    ['tokens', 'values'],
  );
  unique(
    spec.tokens.typography.map((t) => t.id),
    ['tokens', 'typography'],
  );
  unique(
    spec.components.map((c) => c.id),
    ['components'],
  );
  try {
    orderComponents(spec.components);
  } catch (e) {
    fail(['components'], String(e));
  }
  for (const token of spec.tokens.values) {
    if (Object.keys(token.values).some((m) => !spec.tokens.modes.includes(m)))
      fail(['tokens', token.id], 'Unknown token mode.');
    if (
      token.category === 'semantic' &&
      Object.values(token.values).some((v) => typeof v !== 'object')
    )
      fail(['tokens', token.id], 'Semantic tokens require aliases.');
  }
  let hasTokenReferences = false;
  const checkReferences = (
    value: unknown,
    path: (string | number)[],
    key = '',
  ) => {
    if (!value || typeof value !== 'object') return;
    if ('token' in value) {
      hasTokenReferences = true;
      const token = spec.tokens.values.find((t) => t.id === value.token);
      const expected =
        key === 'color'
          ? 'color'
          : ['content', 'fontFamily', 'fontStyle'].includes(key)
            ? 'string'
            : 'number';
      if (token && token.type !== expected)
        fail(path, `Expected ${expected} token for ${key}.`);
      return;
    }
    for (const [k, v] of Object.entries(value))
      checkReferences(v, [...path, k], k);
  };
  checkReferences(spec.pages, ['pages']);
  checkReferences(spec.components, ['components']);
  let totalNodes = spec.pages.reduce((n, p) => n + p.screens.length, 0);
  const visit = (
    node: NodeSpecification,
    path: (string | number)[],
    depth = 0,
    parent?: Layout,
  ) => {
    totalNodes++;
    const layout = node.layout,
      frame = node.type === 'frame' || node.type === 'component-instance';
    if (!frame && layout.type !== 'absolute')
      fail(path, 'Only containers support auto-layout.');
    if (node.type === 'text' && node.styling.cornerRadius !== 0)
      fail(path, 'Text nodes do not support corner radius.');
    for (const axis of ['width', 'height'] as const) {
      if (
        layout[axis] === 'fill' &&
        (!parent ||
          parent.type !== 'auto-layout' ||
          parent[axis] === 'hug' ||
          layout.positioning === 'absolute')
      )
        fail(path, 'Fill requires a non-hug auto-layout parent.');
      if (
        layout[axis] === 'hug' &&
        (node.type === 'rectangle' || (frame && layout.type !== 'auto-layout'))
      )
        fail(path, 'Hug requires text or an auto-layout container.');
    }
    if (
      node.type === 'text' &&
      layout.width === 'hug' &&
      layout.height !== 'hug'
    )
      fail(path, 'Auto-width text requires hug height.');
    if (depth > 32) {
      fail(path, 'Maximum nesting depth is 32.');
      return;
    }
    if (
      node.type === 'text' &&
      node.typography &&
      !spec.tokens.typography.some((t) => t.id === node.typography)
    )
      fail(path, 'Unknown typography token.');
    if (node.type === 'component-instance') {
      const c = spec.components.find((c) => c.id === node.componentId);
      if (!c || !c.variants.some((v) => v.id === node.variant))
        fail(path, 'Unknown component or variant.');
      for (const [id, value] of Object.entries(node.overrides)) {
        const p = c?.properties.find((p) => p.id === id);
        if (
          !p ||
          (p.type === 'BOOLEAN'
            ? typeof value !== 'boolean'
            : typeof value !== 'string')
        )
          fail(path, `Invalid override: ${id}`);
        if (
          p?.type === 'VARIANT' &&
          !c?.variants.some((v) => v.values[id] === value)
        )
          fail(path, `Unknown variant value: ${id}`);
        if (
          p?.type === 'INSTANCE_SWAP' &&
          !spec.components.some((c) => c.id === value)
        )
          fail(path, `Unknown swap component: ${value}`);
      }
      if (c) {
        const selected = c.variants.find((v) => v.id === node.variant)!;
        const requested = {
          ...selected?.values,
          ...Object.fromEntries(
            Object.entries(node.overrides).filter(([id]) =>
              c.properties.some((p) => p.id === id && p.type === 'VARIANT'),
            ),
          ),
        };
        if (
          !c.variants.some((v) =>
            Object.entries(requested).every(([k, val]) => v.values[k] === val),
          )
        )
          fail(path, 'The requested variant combination was not declared.');
      }
    }
    if ('nodes' in node)
      node.nodes.forEach((n, i) =>
        visit(n, [...path, 'nodes', i], depth + 1, node.layout),
      );
  };
  for (const [ci, c] of spec.components.entries()) {
    const path = ['components', ci];
    unique(
      c.variants.map((v) => v.id),
      path,
    );
    unique(
      c.properties.map((p) => p.id),
      path,
    );
    unique(
      c.properties.map((p) => p.name),
      path,
    );
    unique(
      c.variants.map((v) => JSON.stringify(Object.entries(v.values).sort())),
      path,
    );
    for (const p of c.properties) {
      if (
        p.type === 'BOOLEAN'
          ? typeof p.defaultValue !== 'boolean'
          : typeof p.defaultValue !== 'string'
      )
        fail(path, 'Property default type mismatch.');
      if (p.type !== 'VARIANT' && !p.targetId)
        fail(path, 'Non-variant property requires targetId.');
    }
    c.variants.forEach((v, vi) => {
      const nodes: NodeSpecification[] = [];
      const collect = (n: NodeSpecification) => {
        nodes.push(n);
        if ('nodes' in n) n.nodes.forEach(collect);
      };
      collect(v.root);
      unique(
        nodes.map((n) => n.id),
        [...path, 'variants', vi],
      );
      for (const p of c.properties) {
        if (p.type === 'VARIANT') {
          if (!v.values[p.id]) fail(path, `Variant requires value for ${p.id}`);
        } else {
          const n = nodes.find((n) => n.id === p.targetId);
          if (
            !n ||
            (p.type === 'TEXT' && n.type !== 'text') ||
            (p.type === 'INSTANCE_SWAP' && n.type !== 'component-instance')
          )
            fail(path, `Invalid property target: ${p.id}`);
        }
      }
      if (
        Object.keys(v.values).some(
          (k) => !c.properties.some((p) => p.id === k && p.type === 'VARIANT'),
        )
      )
        fail(path, 'Unknown variant property.');
      visit(v.root, [...path, 'variants', vi, 'root']);
    });
  }
  spec.pages.forEach((p, pi) =>
    p.screens.forEach((s, si) =>
      s.nodes.forEach((n, ni) =>
        visit(n, ['pages', pi, 'screens', si, 'nodes', ni], 0, s.layout),
      ),
    ),
  );
  // Literal values were already checked by the enclosing Zod parse.
  // Only token references require a second parse after resolution.
  for (const mode of hasTokenReferences ? spec.tokens.modes : []) {
    try {
      for (const p of spec.pages)
        for (const s of p.screens)
          screenSpecificationSchema.parse(
            resolveTokenReferences(s, spec.tokens, mode),
          );
      for (const c of spec.components)
        for (const v of c.variants)
          nodeSpecificationSchema.parse(
            resolveTokenReferences(v.root, spec.tokens, mode),
          );
    } catch (e) {
      fail(['tokens'], `Resolved node values are invalid: ${String(e)}`);
    }
  }
  if (totalNodes > 500)
    fail(
      ['components'],
      'At most 500 nodes across screens and component definitions.',
    );
  return errors;
}
