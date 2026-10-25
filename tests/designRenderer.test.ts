import { expect, it } from 'vitest';
import { sampleSpecification } from './fixtures/sampleSpecification.js';
import { createRenderHarness } from './figmaRenderHarness.js';
import type { RenderDesignInput } from '../packages/shared/src/index.js';
const input = (): RenderDesignInput => ({
  pageId: '0:1',
  projectId: 'phase2-smoke',
  screenId: 'home',
  specification: sampleSpecification(),
});
it('renders nested auto layout, caches fonts, performs zero writes on repeat and changes one node', async () => {
  const harness = createRenderHarness();
  const request = input();
  const first = await harness.render(request);
  expect(first).toMatchObject({ created: 7, updated: 0, unchanged: 0 });
  expect(harness.api.loadFontAsync).toHaveBeenCalledTimes(2);
  const before = harness.writes;
  expect(await harness.render(request)).toMatchObject({
    created: 0,
    updated: 0,
    unchanged: 7,
    mapping: first.mapping,
  });
  expect(harness.writes).toBe(before);
  expect(harness.api.loadFontAsync).toHaveBeenCalledTimes(2);
  request.specification.pages[0]!.screens[0]!.nodes[0]!.name = 'Updated header';
  expect(await harness.render(request)).toMatchObject({
    created: 0,
    updated: 1,
    unchanged: 6,
  });
  expect(harness.all()).toHaveLength(7);
  expect(harness.page.children[0]).toMatchObject({
    layoutMode: 'VERTICAL',
    width: 400,
    paddingTop: 24,
    itemSpacing: 24,
  });
  const header = harness.all().find((node) => node.name === 'Updated header')!;
  expect(header).toMatchObject({
    fontName: { family: 'Inter', style: 'Bold' },
    characters: 'Your workspace',
    layoutSizingHorizontal: 'FILL',
  });
  expect(header.getSharedPluginData('magic_ui', 'id')).toBe('header');
  expect(header.getSharedPluginData('magic_ui', 'hash')).not.toBe('');
});
it('reports removed nodes as orphans and never removes them', async () => {
  const harness = createRenderHarness();
  const request = input();
  await harness.render(request);
  request.specification.pages[0]!.screens[0]!.nodes.pop();
  const result = await harness.render(request);
  expect(result.orphanedNodes.map((node) => node.id)).toEqual([
    'button',
    'button-label',
  ]);
  expect(result.orphaned).toBe(2);
  expect(harness.all()).toHaveLength(7);
});
it('refuses manual edits before applying any spec changes', async () => {
  const harness = createRenderHarness();
  const request = input();
  await harness.render(request);
  harness.all()[1]!.name = 'Manual change';
  request.specification.pages[0]!.screens[0]!.styling.opacity = 0.5;
  const before = harness.writes;
  await expect(harness.render(request)).rejects.toMatchObject({
    error: {
      code: 'DRIFT_DETECTED',
      details: {
        drift: expect.arrayContaining([
          expect.objectContaining({ id: 'header' }),
        ]),
      },
    },
  });
  expect(harness.writes).toBe(before);
});
it('refuses missing fonts without partial nodes or fallback', async () => {
  const harness = createRenderHarness();
  harness.api.loadFontAsync.mockRejectedValueOnce(new Error('font missing'));
  await expect(harness.render(input())).rejects.toMatchObject({
    error: { code: 'FONT_UNAVAILABLE' },
  });
  expect(harness.all()).toHaveLength(0);
  expect((await harness.render(input())).created).toBe(7);
});
it('checks page and cancellation again after loading fonts', async () => {
  for (const mode of ['page', 'cancel'] as const) {
    const harness = createRenderHarness();
    let cancelled = false;
    harness.api.loadFontAsync.mockImplementationOnce(async () => {
      if (mode === 'page') harness.page.id = 'other';
      else cancelled = true;
    });
    await expect(
      harness.render(input(), () => cancelled),
    ).rejects.toMatchObject({
      error: { code: mode === 'page' ? 'PAGE_CHANGED' : 'CANCELLED' },
    });
    expect(harness.all()).toHaveLength(0);
  }
});
it('serializes overlapping renders while allowing a retry after completion', async () => {
  const harness = createRenderHarness();
  let release!: () => void;
  harness.api.loadFontAsync.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const pending = harness.render(input());
  await expect(harness.render(input())).rejects.toMatchObject({
    error: { code: 'SESSION_BUSY' },
  });
  release();
  await pending;
  expect((await harness.render(input())).unchanged).toBe(7);
});
it('ignores stable IDs outside the target screen and separates projects', async () => {
  const harness = createRenderHarness();
  await harness.render(input());
  const other = input();
  other.projectId = 'other-project';
  other.specification.projectId = 'other-project';
  const second = await harness.render(other);
  expect(second.created).toBe(7);
  expect(harness.all()).toHaveLength(14);
  expect((await harness.render(input())).unchanged).toBe(7);
});
it('detects duplicate IDs, node type replacements and manual additions', async () => {
  for (const mode of ['duplicate', 'type', 'manual-child'] as const) {
    const harness = createRenderHarness();
    const request = input();
    await harness.render(request);
    if (mode === 'duplicate')
      harness.all()[2]!.setSharedPluginData('magic_ui', 'id', 'header');
    else if (mode === 'type') harness.all()[1]!.type = 'RECTANGLE';
    else {
      const child = harness.api.createRectangle();
      harness.page.children[0]!.insertChild(0, child);
    }
    const before = harness.writes;
    await expect(harness.render(request)).rejects.toMatchObject({
      error: { code: 'DRIFT_DETECTED' },
    });
    expect(harness.writes).toBe(before);
  }
});
it('renders RTL horizontal order and start alignment without modifying text content', async () => {
  const harness = createRenderHarness();
  const request = input();
  const screen = request.specification.pages[0]!.screens[0]!;
  screen.direction = 'rtl';
  screen.layout.direction = 'horizontal';
  screen.layout.width = 900;
  screen.layout.height = 400;
  await harness.render(request);
  expect(
    harness.page.children[0]!.children.map((node) =>
      node.getSharedPluginData('magic_ui', 'id'),
    ),
  ).toEqual(['button', 'list', 'header']);
  expect(harness.all().find((node) => node.name === 'Header')).toMatchObject({
    textAlignHorizontal: 'RIGHT',
    characters: 'Your workspace',
  });
  expect((await harness.render(request)).unchanged).toBe(7);
});
it('updates hierarchy in place and supports absolute rectangles', async () => {
  const harness = createRenderHarness();
  const request = input();
  const screen = request.specification.pages[0]!.screens[0]!;
  screen.nodes = [
    {
      id: 'shape',
      name: 'Shape',
      type: 'rectangle',
      layout: {
        ...screen.layout,
        type: 'absolute',
        width: 40,
        height: 50,
        x: 12,
        y: 20,
      },
      styling: screen.styling,
    },
  ];
  screen.layout.type = 'absolute';
  screen.layout.height = 500;
  const first = await harness.render(request);
  expect(harness.all()[1]).toMatchObject({
    type: 'RECTANGLE',
    x: 12,
    y: 20,
    width: 40,
    height: 50,
  });
  expect((await harness.render(request)).mapping).toEqual(first.mapping);
});
it('refuses a removed or reparented screen instead of creating duplicates', async () => {
  for (const mode of ['removed', 'moved'] as const) {
    const harness = createRenderHarness();
    const request = input();
    await harness.render(request);
    const root = harness.page.children[0]!;
    if (mode === 'removed') harness.page.children.splice(0, 1);
    else {
      const wrapper = harness.api.createFrame();
      wrapper.insertChild(0, root);
    }
    const before = harness.writes;
    await expect(harness.render(request)).rejects.toMatchObject({
      error: { code: 'DRIFT_DETECTED' },
    });
    expect(harness.writes).toBe(before);
  }
});
it('keeps unchanged Figma paint defaults untouched when changing only a name', async () => {
  const harness = createRenderHarness();
  const request = input();
  await harness.render(request);
  const header = harness.all()[1]!;
  // Figma returns optional paint defaults explicitly even when setters omit them.
  const fills = header.fills.map((fill) => ({
    ...(fill as object),
    visible: true,
    blendMode: 'NORMAL',
  }));
  header.fills = fills;
  // Update only the harness baseline to model defaults that were already present at capture time.
  const saved = JSON.parse(
    header.getSharedPluginData('magic_ui', 'snapshot'),
  ) as Record<string, unknown>;
  saved.fills = fills;
  const { canonicalJson } = await import('../packages/shared/src/index.js');
  header.setSharedPluginData('magic_ui', 'snapshot', canonicalJson(saved));
  request.specification.pages[0]!.screens[0]!.nodes[0]!.name = 'New name';
  await harness.render(request);
  expect(header.fills).toBe(fills);
});
it('places decorative rectangles absolutely inside auto layout', async () => {
  const harness = createRenderHarness();
  const request = input();
  const screen = request.specification.pages[0]!.screens[0]!;
  screen.nodes.push({
    id: 'decoration',
    type: 'rectangle',
    name: 'Decoration',
    layout: {
      ...screen.layout,
      type: 'absolute',
      positioning: 'absolute',
      width: 10,
      height: 10,
      x: 30,
      y: 40,
    },
    styling: screen.styling,
  });
  await harness.render(request);
  expect(
    harness.all().find((node) => node.name === 'Decoration'),
  ).toMatchObject({ layoutPositioning: 'ABSOLUTE', x: 30, y: 40 });
  expect((await harness.render(request)).unchanged).toBe(8);
});

it('reapplies child positioning when a parent changes from auto layout to absolute', async () => {
  const harness = createRenderHarness();
  const request = input();
  const screen = request.specification.pages[0]!.screens[0]!;
  screen.layout.height = 500;
  screen.nodes = [
    {
      id: 'shape',
      type: 'rectangle',
      name: 'Shape',
      styling: screen.styling,
      layout: {
        ...screen.layout,
        type: 'absolute',
        width: 40,
        height: 50,
        x: 20,
        y: 30,
      },
    },
  ];
  await harness.render(request);
  const shape = harness.all()[1]!;
  shape.x = 24;
  shape.y = 24; // Simulate computed auto-layout geometry, which is not owned by the child.
  screen.layout.type = 'absolute';
  const result = await harness.render(request);
  expect(result).toMatchObject({ created: 0, updated: 2, unchanged: 0 });
  expect(shape).toMatchObject({ x: 20, y: 30 });
  expect((await harness.render(request)).unchanged).toBe(2);
});
