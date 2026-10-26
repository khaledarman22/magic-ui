import { AssetRegistry } from '../packages/mcp-server/src/assetRegistry.js';
import { dirname } from 'node:path';
import {
  assetRecordSchema,
  projectLayoutResultSchema,
  presentScreenResultSchema,
  renderDesignResultSchema,
  sha256,
} from '../packages/shared/src/index.js';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { BridgeServer } from '../packages/mcp-server/src/bridgeServer.js';
import { createMcpServer } from '../packages/mcp-server/src/mcpServer.js';
import { DesignWorkspace } from '../packages/mcp-server/src/designWorkspace.js';
import { FakePluginClient } from '../scripts/fake-plugin-client.js';
import { sampleSpecification } from './fixtures/sampleSpecification.js';
import { createRenderHarness } from './figmaRenderHarness.js';
import {
  designSpecificationSchema,
  type Command,
} from '../packages/shared/src/index.js';
let root: string, path: string;
let workspace: DesignWorkspace,
  bridge: BridgeServer,
  client: Client,
  server: ReturnType<typeof createMcpServer>,
  plugin: FakePluginClient,
  harness: ReturnType<typeof createRenderHarness>;
let afterCommand: ((command: Command) => Promise<void>) | undefined;
const scope = { projectId: 'phase2-smoke', screenId: 'home', pageId: '0:1' };
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'magic-ui-sync-')));
  workspace = new DesignWorkspace(root);
  path = (
    await workspace.initialize({
      projectId: scope.projectId,
      projectName: 'Sync',
    })
  ).specificationPath;
  await writeFile(path, JSON.stringify(sampleSpecification()));
  const token = randomBytes(32).toString('hex');
  bridge = new BridgeServer({ token, port: 0, heartbeatMs: 10000 });
  const port = await bridge.start();
  server = createMcpServer(bridge, workspace);
  client = new Client({ name: 'sync-tests', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  harness = createRenderHarness();
  afterCommand = undefined;
  plugin = new FakePluginClient(
    `ws://127.0.0.1:${port}`,
    token,
    async (command) => {
      const result = await harness.execute(command);
      await afterCommand?.(command);
      return result;
    },
  );
  await plugin.connect();
});
afterEach(async () => {
  await plugin?.disconnect();
  await client?.close();
  await server?.close();
  await bridge?.close();
  if (root) await rm(root, { recursive: true, force: true });
});
async function call(name: string, extra: Record<string, unknown> = {}) {
  return client.callTool({
    name: `magic_ui_${name}`,
    arguments: { sessionId: plugin.sessionId, ...scope, ...extra },
  });
}
async function success(name: string, extra: Record<string, unknown> = {}) {
  const r = await call(name, extra);
  expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
  return r;
}
const node = (id: string) =>
  harness.document.findAll(
    (n) => n.getSharedPluginData('magic_ui', 'id') === id,
  )[0]!;

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMwazsDAAJ+AYl3frXIAAAAAElFTkSuQmCC',
  'base64',
);
async function assetSpec(count = 10, id = 'photo') {
  const spec = designSpecificationSchema.parse({
    schemaVersion: '1.0.0',
    projectId: scope.projectId,
    pages: [
      {
        id: 'mobile',
        name: 'Sample',
        screens: [
          {
            id: 'home',
            name: 'Home',
            layout: { width: 393, height: 852 },
            nodes: Array.from({ length: count }, (_, i) => ({
              id: `image-${i}`,
              name: 'Photo',
              type: 'frame',
              assetId: id,
              layout: {
                width: 100,
                height: 100,
                x: (i % 3) * 110,
                y: Math.floor(i / 3) * 110,
              },
              nodes: [],
            })),
          },
        ],
      },
    ],
  });
  await writeFile(path, JSON.stringify(spec));
  return spec;
}
it('real MCP and bridge: ten image uses upload once, restart reuses image, usage and Figma hash persist', async () => {
  await writeFile(join(dirname(path), 'photo.png'), png);
  const response = await client.callTool({
    name: 'magic_ui_register_asset',
    arguments: {
      projectId: scope.projectId,
      id: 'photo',
      path: 'photo.png',
      name: 'Photo',
      source: 'fixture',
      license: 'CC0',
    },
  });
  expect(response.isError, JSON.stringify(response.content)).not.toBe(true);
  assetRecordSchema.parse(response.structuredContent);
  await assetSpec();
  const first = renderDesignResultSchema.parse(
    (await success('render_design')).structuredContent,
  );
  expect(first.assetsComplete).toBe(true);
  expect(harness.api.createImage).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 10; i++)
    expect(node(`image-${i}`).fills).toMatchObject([{ type: 'IMAGE' }]);
  harness.resetRuntime();
  await success('render_design');
  expect(harness.api.createImage).toHaveBeenCalledTimes(1);
  const manifest = await new AssetRegistry(workspace).read(scope.projectId);
  expect(manifest.assets[0]!.usages).toHaveLength(10);
  expect(manifest.assets[0]!.figma[0]!.imageHash).toBeTruthy();
});
it('missing asset is explicit and incomplete, later registration updates the same frame; manual child drift is preserved', async () => {
  await assetSpec(1, 'future');
  const result = renderDesignResultSchema.parse(
    (await success('render_design')).structuredContent,
  );
  expect(result.assetsComplete).toBe(false);
  expect(result.missingAssets).toEqual([
    { localId: 'image-0', assetId: 'future', status: 'missing' },
  ]);
  const frame = node('image-0');
  expect(frame.children[0]!.characters).toBe('Missing asset: future');
  await writeFile(join(dirname(path), 'photo.png'), png);
  await new AssetRegistry(workspace).register({
    id: 'future',
    projectId: scope.projectId,
    path: 'photo.png',
    name: 'Future',
    source: 'fixture',
    license: 'CC0',
  });
  const resolved = renderDesignResultSchema.parse(
    (await success('render_design')).structuredContent,
  );
  expect(resolved.assetsComplete).toBe(true);
  expect(node('image-0').id).toBe(frame.id);
  expect(frame.children[0]!.visible).toBe(false);
  frame.children[0]!.characters = 'Manual label';
  const changed = await call('render_design');
  expect(changed.isError).toBe(true);
  expect(frame.children[0]!.characters).toBe('Manual label');
});
it('sanitized SVG crosses bridge and becomes one reusable component', async () => {
  const svg =
    '<svg width="24" height="24"><script>alert(1)</script><path d="M0 0 L24 24" xlink:href="https://evil.test/x"/></svg>';
  await writeFile(join(dirname(path), 'icon.svg'), svg);
  await new AssetRegistry(workspace).register({
    id: 'icon',
    projectId: scope.projectId,
    path: 'icon.svg',
    name: 'Icon',
    source: 'fixture',
    license: 'CC0',
  });
  await assetSpec(2, 'icon');
  const sent: number[] = [];
  afterCommand = async (c) => {
    if (c.command === 'assetChunk') sent.push(...c.input.bytes);
  };
  await success('render_design');
  expect(Buffer.from(sent).toString()).not.toMatch(/script|xlink|evil/);
  expect(harness.api.createNodeFromSvg).toHaveBeenCalledTimes(1);
  expect(node('image-0').children[0]!.type).toBe('INSTANCE');
  expect(node('image-1').children[0]!.mainComponent).toBe(
    node('image-0').children[0]!.mainComponent,
  );
});
it('one app creates no web/dashboard pages; five screens share one mockup and preserve originals', async () => {
  const spec = await assetSpec(0);
  spec.pages[0]!.kind = 'app';
  spec.pages[0]!.screens = Array.from({ length: 5 }, (_, i) => ({
    ...spec.pages[0]!.screens[0]!,
    id: `screen-${i}`,
    name: `Screen ${i}`,
  }));
  await writeFile(path, JSON.stringify(spec));
  const prepared = await client.callTool({
    name: 'magic_ui_prepare_project',
    arguments: {
      sessionId: plugin.sessionId,
      projectId: scope.projectId,
      pageId: scope.pageId,
    },
  });
  expect(prepared.isError, JSON.stringify(prepared.content)).not.toBe(true);
  const pages = projectLayoutResultSchema.parse(
    prepared.structuredContent,
  ).pages;
  expect(pages.map((p) => p.id)).toEqual([
    'mobile',
    'components',
    'references',
    'trash',
  ]);
  expect(
    harness.document.children.some((p) => /^(Web|Dashboard) -/.test(p.name)),
  ).toBe(false);
  const page = harness.document.children.find(
    (p) => p.id === pages[0]!.nodeId,
  )!;
  harness.api.currentPage = page;
  const components = new Set<string>(),
    instances = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const args = { pageId: page.id, screenId: `screen-${i}` };
    await success('render_design', args);
    const response = await call('present_screen', {
      ...args,
      device: 'iphone',
    });
    expect(response.isError, JSON.stringify(response.content)).not.toBe(true);
    const result = presentScreenResultSchema.parse(response.structuredContent);
    components.add(result.componentId);
    instances.add(result.instanceId);
    expect(node(`screen-${i}`).type).toBe('FRAME');
    expect(node(`screen-${i}`).parent!.id).toBe(pages[0]!.workspaceId);
    const again = presentScreenResultSchema.parse(
      (await success('present_screen', { ...args, device: 'iphone' }))
        .structuredContent,
    );
    expect(again.instanceId).toBe(result.instanceId);
  }
  expect(components.size).toBe(1);
  expect(instances.size).toBe(5);
});
it('bad asset chunk hash and wrong sequence cannot import images', async () => {
  const input = {
    projectId: scope.projectId,
    documentId: 'doc',
    pageId: '0:1',
    assetId: 'photo',
    hash: sha256(png),
    transferHash: sha256(png),
    mime: 'image/png' as const,
    offset: 1,
    total: png.length,
    bytes: [...png],
  };
  await expect(
    harness.execute({ command: 'assetChunk', input }),
  ).rejects.toThrow();
  await expect(
    harness.execute({
      command: 'assetChunk',
      input: {
        ...input,
        offset: 0,
        bytes: [...png].map((b, i) => (i === 10 ? b ^ 255 : b)),
      },
    }),
  ).rejects.toThrow('SHA-256');
  expect(harness.api.createImage).not.toHaveBeenCalled();
});
it('assets inside reusable components use the same image and retain checkpoint recovery guards', async () => {
  await writeFile(join(dirname(path), 'photo.png'), png);
  await new AssetRegistry(workspace).register({
    id: 'photo',
    projectId: scope.projectId,
    path: 'photo.png',
    name: 'Photo',
    source: 'fixture',
    license: 'CC0',
  });
  const spec = await assetSpec(1);
  spec.components = [
    {
      id: 'photo-card',
      name: 'Photo card',
      category: 'Cards',
      version: 1,
      properties: [],
      dependencies: [],
      variants: [
        {
          id: 'default',
          name: 'Default',
          values: {},
          root: {
            ...spec.pages[0]!.screens[0]!.nodes[0]!,
            id: 'card',
            type: 'frame',
            nodes: [],
          },
        },
      ],
    },
  ];
  await writeFile(path, JSON.stringify(spec));
  const system = await client.callTool({
    name: 'magic_ui_render_design_system',
    arguments: {
      sessionId: plugin.sessionId,
      projectId: scope.projectId,
      pageId: scope.pageId,
    },
  });
  expect(system.isError, JSON.stringify(system.content)).not.toBe(true);
  expect(system.structuredContent).toMatchObject({ assetsComplete: true });
  await success('render_design');
  expect(harness.api.createImage).toHaveBeenCalledTimes(1);
}, 20000);
it('transfers a raster larger than the bridge limit in bounded chunks and recovers a repeated final chunk', async () => {
  const { createSamplePng } =
    await import('../scripts/samples/createSamplePng.js');
  const large = createSamplePng(200, 200, true);
  expect(large.length).toBeGreaterThan(65536);
  await writeFile(join(dirname(path), 'large.png'), large);
  await new AssetRegistry(workspace).register({
    id: 'large',
    projectId: scope.projectId,
    path: 'large.png',
    name: 'Large',
    source: 'fixture',
    license: 'CC0',
  });
  await assetSpec(1, 'large');
  const chunks: Extract<Command, { command: 'assetChunk' }>[] = [];
  afterCommand = async (c) => {
    if (c.command === 'assetChunk') chunks.push(c);
  };
  await success('render_design');
  expect(chunks.length).toBeGreaterThan(8);
  expect(chunks.every((c) => c.input.bytes.length <= 8000)).toBe(true);
  expect(Buffer.from(chunks.flatMap((c) => c.input.bytes))).toEqual(large);
  harness.resetRuntime();
  const response = await harness.execute(chunks.at(-1)!);
  expect(response.result).toMatchObject({ complete: true });
  expect(harness.api.createImage).toHaveBeenCalledTimes(1);
});
it('refresh keeps presentation identity and refuses manual slot edits', async () => {
  await assetSpec(0);
  await success('render_design');
  const first = presentScreenResultSchema.parse(
    (await success('present_screen', { device: 'laptop' })).structuredContent,
  );
  const source = node('home');
  source.exportAsync = async () =>
    new Uint8Array(Buffer.from('test-only-updated-export'));
  const refreshed = presentScreenResultSchema.parse(
    (await success('present_screen', { device: 'laptop' })).structuredContent,
  );
  expect(refreshed.instanceId).toBe(first.instanceId);
  expect(refreshed.sourceHash).not.toBe(first.sourceHash);
  const instance = harness.document.findAll(
    (n) => n.id === first.instanceId,
  )[0]!;
  const slot = instance.children[0]!;
  slot.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }];
  const result = await call('present_screen', { device: 'laptop' });
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result.content)).toContain('DRIFT_DETECTED');
  expect(slot.fills).toMatchObject([{ type: 'SOLID' }]);
});
