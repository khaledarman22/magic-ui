import { expect, it } from 'vitest';
import {
  commandSchema,
  commandPermissions,
  designSpecificationSchema,
  extractionSchema,
  readerInputSchema,
  envelope,
  type ReaderInput,
} from '../packages/shared/src/index.js';
import { normalizeFigma } from '../packages/mcp-server/src/figmaNormalization.js';
import { createRenderHarness } from './figmaRenderHarness.js';
import sample from '../scripts/samples/phase-3.design-spec.json';
async function read(
  h: ReturnType<typeof createRenderHarness>,
  input: ReaderInput,
) {
  let cursor: string | undefined,
    text = '',
    chunks = 0;
  do {
    const r = await h.execute({
      command: 'readFigma',
      input: { ...input, ...(cursor ? { cursor } : {}) },
    });
    if (r.command !== 'readFigma') throw new Error();
    expect(
      Buffer.byteLength(
        JSON.stringify(envelope('result', 'session', 'request', r)),
      ),
    ).toBeLessThan(65536);
    text += r.result.data;
    cursor = r.result.nextCursor ?? undefined;
    chunks++;
  } while (cursor);
  return { data: extractionSchema.parse(JSON.parse(text)), chunks };
}
it('has an explicit permission for every command contract', () => {
  const names = commandSchema.options.map((s) => s.shape.command.value);
  expect(Object.keys(commandPermissions).sort()).toEqual(names.sort());
  expect(
    Object.values(commandPermissions).every(
      (p) => p === 'read' || p === 'write',
    ),
  ).toBe(true);
});
it('reads 2,000 foreign nodes in bounded JSON chunks without touching the document', async () => {
  const h = createRenderHarness();
  for (let i = 0; i < 2000; i++) {
    const n = h.api.createFrame();
    n.name = 'محتوى '.repeat(10) + i;
  }
  const writes = h.writes;
  const { data, chunks } = await read(
    h,
    readerInputSchema.parse({ scope: 'page', nodeId: '0:1' }),
  );
  expect(data.nodes).toHaveLength(2001);
  expect(chunks).toBeGreaterThan(1);
  expect(h.writes).toBe(writes);
  expect(data.nodes[1]!.identity).toEqual({});
});
it('scopes reads, rejects cross-scope cursors and honors cancellation', async () => {
  const h = createRenderHarness(),
    a = h.api.createFrame(),
    b = h.api.createFrame();
  a.name = 'x'.repeat(20000);
  const input = readerInputSchema.parse({ scope: 'page', nodeId: a.id });
  const first = await h.execute({ command: 'readFigma', input });
  if (first.command !== 'readFigma') throw new Error();
  expect(first.result.nextCursor).toBeTruthy();
  await expect(
    h.execute({
      command: 'readFigma',
      input: { ...input, nodeId: b.id, cursor: first.result.nextCursor! },
    }),
  ).rejects.toMatchObject({ error: { code: 'INVALID_CURSOR' } });
  await expect(
    h.execute({ command: 'readFigma', input }, () => true),
  ).rejects.toMatchObject({ error: { code: 'CANCELLED' } });
  const { data } = await read(h, input);
  expect(data.nodes.map((n) => n.id)).toEqual([a.id]);
});
it('round-trips rendered Phase 3 tokens, component variants and bound layouts through actual reader handlers', async () => {
  const h = createRenderHarness(),
    spec = designSpecificationSchema.parse(sample);
  await h.execute({
    command: 'renderDesignSystem',
    input: { projectId: spec.projectId, pageId: '0:1', specification: spec },
  });
  await h.render({
    projectId: spec.projectId,
    pageId: '0:1',
    screenId: 'home',
    specification: spec,
  });
  const writes = h.writes;
  const { data } = await read(
    h,
    readerInputSchema.parse({ scope: 'document' }),
  );
  const result = normalizeFigma(data, spec.projectId);
  expect(h.writes).toBe(writes);
  expect(result.specification.tokens).toEqual(spec.tokens);
  expect(
    result.specification.components.map((c) => [c.id, c.variants.length]),
  ).toEqual(spec.components.map((c) => [c.id, c.variants.length]));
  const screen = result.specification.pages
    .flatMap((p) => p.screens)
    .find((s) => s.id === 'home');
  expect(screen?.layout).toEqual(spec.pages[0]!.screens[0]!.layout);
  for (const c of spec.components) {
    const actual = result.specification.components.find((v) => v.id === c.id)!;
    expect(actual.properties).toEqual(c.properties);
    for (const v of c.variants) {
      const av = actual.variants.find((x) => x.id === v.id)!;
      expect(av.values).toEqual(v.values);
      expect(av.root.layout).toEqual(v.root.layout);
    }
  }
  expect(
    designSpecificationSchema.safeParse(result.specification).success,
  ).toBe(true);
});
it('retains unsupported foreign content in a loss report instead of inventing a rectangle', async () => {
  const h = createRenderHarness();
  const frame = h.api.createFrame();
  const vector = h.api.createRectangle();
  vector.type = 'VECTOR';
  frame.appendChild(vector);
  vector.effects = [{ type: 'DROP_SHADOW', radius: 8 }];
  const { data } = await read(
    h,
    readerInputSchema.parse({ scope: 'page', nodeId: frame.id }),
  );
  const { specification, missing } = normalizeFigma(data, 'foreign');
  expect(specification.pages[0]!.screens[0]!.nodes).toHaveLength(0);
  expect(
    missing.some((m) => m.nodeId === vector.id && m.field === 'node'),
  ).toBe(true);
  expect(JSON.stringify(missing)).toContain('DROP_SHADOW');
});

it('normalizes native variant sets and reflects manual changes instead of saved intent', async () => {
  const h = createRenderHarness();
  const a = h.api.createComponent(),
    b = h.api.createComponent();
  a.name = 'State=Enabled';
  b.name = 'State=Disabled';
  const set = h.api.combineAsVariants([a, b], h.page);
  set.name = 'Native button';
  const first = await read(
    h,
    readerInputSchema.parse({ scope: 'page', nodeId: '0:1' }),
  );
  const normalized = normalizeFigma(first.data, 'native');
  expect(normalized.specification.components).toHaveLength(1);
  expect(normalized.specification.components[0]!.properties).toEqual([
    expect.objectContaining({ name: 'State', type: 'VARIANT' }),
  ]);
  expect(normalized.specification.components[0]!.variants).toHaveLength(2);
  a.width = 219;
  a.setSharedPluginData(
    'magic_ui',
    'intent',
    JSON.stringify({ id: 'original', layout: { width: 12 } }),
  );
  const second = await read(
    h,
    readerInputSchema.parse({ scope: 'page', nodeId: '0:1' }),
  );
  expect(
    normalizeFigma(second.data, 'native').specification.components[0]!
      .variants[0]!.root.layout.width,
  ).toBe(219);
});

it('scales SVG viewports without changing vector geometry', async () => {
  const { decodeAsset } =
    await import('../packages/mcp-server/src/figmaExport.js');
  const source =
    '<svg width="20" height="10" viewBox="0 0 20 10"><path d="M0 0"/></svg>';
  const result = decodeAsset(
    Buffer.from(source).toString('base64'),
    'SVG',
    2,
  ).toString();
  expect(result).toContain('width="40" height="20" viewBox="0 0 20 10"');
  expect(result).toContain('<path d="M0 0"/>');
});
