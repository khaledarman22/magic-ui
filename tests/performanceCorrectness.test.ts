import { expect, it } from 'vitest';
import {
  canonicalJson,
  designSpecificationSchema,
  planRender,
} from '../packages/shared/src/index.js';
import { normalizeFigma } from '../packages/mcp-server/src/figmaNormalization.js';
import { performanceFixtures } from './performance/fixtures.js';

it('preserves canonical fingerprints, including escaped keys and sparse array semantics', () => {
  const sparse = new Array<number>(3);
  sparse[1] = 1;
  const values: unknown[] = [
    null,
    undefined,
    { z: undefined, a: ['مرحبا', '\n', 1, false, null], '"': {} },
    sparse,
    Object.fromEntries([
      ['__proto__', 1],
      ['constructor', 2],
    ]),
  ];
  const previous = (value: unknown): string => {
    if (value === null || typeof value !== 'object')
      return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value)) return `[${value.map(previous).join(',')}]`;
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${previous(object[key])}`)
      .join(',')}}`;
  };
  const spec = performanceFixtures(100).specifications[0]!;
  values.push(spec);
  for (const value of values)
    expect(canonicalJson(value)).toBe(previous(value));
});
it('keeps the node cap, nested normalization, token validation and raw evidence', () => {
  const { specifications, extractions } = performanceFixtures(1000);
  for (const extraction of extractions) {
    const normalized = normalizeFigma(extraction, 'bench');
    expect(
      planRender(normalized.specification.pages[0]!.screens[0]!, []).operations,
    ).toHaveLength(500);
    expect(
      normalized.missing.filter((m) => m.field === 'rawProperties'),
    ).toHaveLength(500);
  }
  const spec = specifications[0]!;
  spec.pages[0]!.screens[0]!.nodes.push({
    id: 'overflow',
    name: 'Overflow',
    type: 'rectangle',
    layout: spec.pages[0]!.screens[0]!.layout,
    styling: spec.pages[0]!.screens[0]!.styling,
  });
  expect(designSpecificationSchema.safeParse(spec).success).toBe(false);
  const valid = performanceFixtures(100).specifications[0]!;
  valid.pages[0]!.screens[0]!.layout.width = { token: 'missing' };
  expect(designSpecificationSchema.safeParse(valid).success).toBe(false);
  valid.tokens.values.push({
    id: 'missing',
    type: 'number',
    category: 'primitive',
    values: { light: -1 },
  });
  expect(designSpecificationSchema.safeParse(valid).success).toBe(false);
});
