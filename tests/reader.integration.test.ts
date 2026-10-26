import { randomBytes } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { BridgeServer } from '../packages/mcp-server/src/bridgeServer.js';
import { createMcpServer } from '../packages/mcp-server/src/mcpServer.js';
import { DesignWorkspace } from '../packages/mcp-server/src/designWorkspace.js';
import { exportAsset } from '../packages/mcp-server/src/figmaExport.js';
import { FakePluginClient } from '../scripts/fake-plugin-client.js';
import { createRenderHarness } from './figmaRenderHarness.js';
import {
  readerChunkSchema,
  designValidationReportSchema,
  extractionSchema,
  exportResultSchema,
  designSpecificationSchema,
} from '../packages/shared/src/index.js';
let root: string,
  bridge: BridgeServer,
  client: Client,
  server: ReturnType<typeof createMcpServer>,
  plugin: FakePluginClient,
  h: ReturnType<typeof createRenderHarness>;
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'magic-ui-reader-')));
  const token = randomBytes(32).toString('hex');
  bridge = new BridgeServer({
    token,
    port: 0,
    readOnly: true,
    heartbeatMs: 60000,
  });
  const port = await bridge.start();
  h = createRenderHarness();
  plugin = new FakePluginClient(`ws://127.0.0.1:${port}`, token, (c) =>
    h.execute(c),
  );
  await plugin.connect();
  server = createMcpServer(bridge, new DesignWorkspace(root));
  client = new Client({ name: 'reader-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
});
afterEach(async () => {
  await plugin?.disconnect();
  await client?.close();
  await server?.close();
  await bridge?.close();
  if (root) await rm(root, { recursive: true, force: true });
});
it('omits every write tool, marks handshake read-only and independently refuses bridge writes', async () => {
  const tools = (await client.listTools()).tools;
  expect(tools).toHaveLength(18);
  expect(tools.every((t) => t._meta?.permission === 'read')).toBe(true);
  expect(tools.map((t) => t.name)).not.toContain('magic_ui_create_frame');
  expect(plugin.received.find((m) => m.type === 'ready')).toMatchObject({
    payload: { readOnly: true },
  });
  await expect(
    bridge.request(plugin.sessionId, {
      command: 'createFrame',
      input: {
        pageId: '0:1',
        name: 'Forbidden',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
    }),
  ).rejects.toMatchObject({ error: { code: 'PERMISSION_DENIED' } });
  expect(
    plugin.received.some(
      (m) => m.type === 'command' && m.payload.command === 'createFrame',
    ),
  ).toBe(false);
});
it('transports 2,000 foreign nodes over MCP and WebSocket with bounded responses', async () => {
  for (let i = 0; i < 2000; i++) {
    const n = h.api.createFrame();
    n.name = `Foreign ${i}`;
  }
  let cursor: string | undefined,
    text = '',
    chunks = 0;
  const writes = h.writes;
  do {
    const r = await client.callTool({
      name: 'magic_ui_read_page',
      arguments: {
        sessionId: plugin.sessionId,
        nodeId: '0:1',
        ...(cursor ? { cursor } : {}),
      },
    });
    expect(r.isError).not.toBe(true);
    const chunk = readerChunkSchema.parse(r.structuredContent);
    text += chunk.data;
    cursor = chunk.nextCursor ?? undefined;
    chunks++;
  } while (cursor);
  expect(extractionSchema.parse(JSON.parse(text)).nodes).toHaveLength(2001);
  expect(chunks).toBeGreaterThan(1);
  expect(h.writes).toBe(writes);
});
it('exports a foreign design package and binary assets inside a private workspace without document mutations', async () => {
  const frame = h.api.createFrame();
  frame.name = 'Foreign design';
  const vector = h.api.createRectangle();
  vector.type = 'VECTOR';
  frame.appendChild(vector);
  const writes = h.writes;
  const result = await client.callTool({
    name: 'magic_ui_export_design_package',
    arguments: {
      sessionId: plugin.sessionId,
      nodeId: frame.id,
      projectId: 'foreign',
    },
  });
  expect(result.isError, JSON.stringify(result.content)).not.toBe(true);
  const out = exportResultSchema.parse(result.structuredContent);
  expect(out.directory.startsWith(root + '/')).toBe(true);
  expect(out.directory.endsWith('/figma-export')).toBe(true);
  expect(out.files).toEqual(
    expect.arrayContaining([
      'project.json',
      'design-spec.json',
      'tokens.json',
      'components.json',
      'screens.json',
      'reports/extraction-report.json',
      'reports/missing-information.json',
      'instructions/AGENTS.md',
    ]),
  );
  expect(out.files.some((f) => f.startsWith('previews/'))).toBe(true);
  expect(out.files.some((f) => f.startsWith('assets/'))).toBe(true);
  expect(
    designSpecificationSchema.safeParse(
      JSON.parse(
        await readFile(join(out.directory, 'design-spec.json'), 'utf8'),
      ),
    ).success,
  ).toBe(true);
  expect(
    JSON.parse(
      await readFile(
        join(out.directory, 'reports/missing-information.json'),
        'utf8',
      ),
    ),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ nodeId: vector.id, field: 'node' }),
    ]),
  );
  expect((await stat(join(out.directory, 'project.json'))).mode & 0o777).toBe(
    0o600,
  );
  expect(h.writes).toBe(writes);
  const asset = await client.callTool({
    name: 'magic_ui_export_asset',
    arguments: {
      sessionId: plugin.sessionId,
      nodeId: vector.id,
      projectId: 'foreign',
      format: 'SVG',
    },
  });
  const a = exportResultSchema.parse(asset.structuredContent);
  expect(await readFile(join(a.directory, a.files[0]!), 'utf8')).toContain(
    '<svg',
  );
  const traversal = await client.callTool({
    name: 'magic_ui_export_asset',
    arguments: {
      sessionId: plugin.sessionId,
      nodeId: vector.id,
      projectId: '../escape',
    },
  });
  expect(traversal.isError).toBe(true);
  await symlink(root, join(root, 'link'));
  await expect(
    exportAsset(
      bridge,
      join(root, 'link'),
      {
        sessionId: plugin.sessionId,
        nodeId: vector.id,
        projectId: 'safe',
        format: 'SVG',
        scale: 1,
      },
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ error: { code: 'WORKSPACE_ERROR' } });
});

it('reassembles an asset larger than the bridge limit without corrupting bytes', async () => {
  const node = h.api.createFrame();
  const bytes = Uint8Array.from({ length: 100000 }, (_, i) => i % 256);
  node.exportAsync = async () => bytes;
  const result = await client.callTool({
    name: 'magic_ui_export_asset',
    arguments: {
      sessionId: plugin.sessionId,
      nodeId: node.id,
      projectId: 'large-asset',
      format: 'PNG',
    },
  });
  expect(result.isError).not.toBe(true);
  const output = exportResultSchema.parse(result.structuredContent);
  expect(await readFile(join(output.directory, output.files[0]!))).toEqual(
    Buffer.from(bytes),
  );
  expect(
    plugin.received.filter(
      (m) =>
        m.type === 'command' &&
        m.payload.command === 'readFigma' &&
        m.payload.input.cursor,
    ).length,
  ).toBeGreaterThan(1);
});
it('validates live evidence over MCP through the read-only Plugin path without mutations', async () => {
  const frame = h.api.createFrame();
  frame.clipsContent = true;
  frame.absoluteBoundingBox = { x: 0, y: 0, width: 100, height: 100 };
  const text = h.api.createText();
  text.hasMissingFont = true;
  text.textAutoResize = 'NONE';
  text.absoluteBoundingBox = { x: 90, y: 10, width: 30, height: 20 };
  text.boundVariables = {
    fontSize: { type: 'VARIABLE_ALIAS', id: 'missing-variable' },
  };
  text.fills = [{ type: 'IMAGE', imageHash: 'missing-image' }];
  frame.appendChild(text);
  const writes = h.writes;
  const result = await client.callTool({
    name: 'magic_ui_validate_design',
    arguments: { sessionId: plugin.sessionId, nodeId: frame.id },
  });
  expect(result.isError).not.toBe(true);
  const report = designValidationReportSchema.parse(result.structuredContent);
  expect(report.failed.map((i) => i.code)).toEqual(
    expect.arrayContaining([
      'MISSING_FONT',
      'TEXT_OUTSIDE_CLIP',
      'VARIABLE_MISSING',
      'IMAGE_MISSING',
    ]),
  );
  expect(report.unverified.map((i) => i.code)).toContain(
    'VISUAL_COMPARISON_UNAVAILABLE',
  );
  expect(h.writes).toBe(writes);
  expect(h.api.loadFontAsync).not.toHaveBeenCalled();
});
it('finds deleted component registry targets even when no owned nodes remain', async () => {
  h.document.setSharedPluginData(
    'magic_ui',
    'design-system:deleted-project',
    JSON.stringify({
      projectId: 'deleted-project',
      components: [
        {
          id: 'button',
          name: 'Button',
          category: 'control',
          nodeId: '9:99',
          properties: [],
          variants: [],
          dependencies: [],
          usage: [],
          version: 1,
        },
      ],
    }),
  );
  const writes = h.writes;
  const result = await client.callTool({
    name: 'magic_ui_validate_design',
    arguments: { sessionId: plugin.sessionId },
  });
  const report = designValidationReportSchema.parse(result.structuredContent);
  expect(report.failed.map((i) => i.code)).toContain(
    'COMPONENT_TARGET_MISSING',
  );
  expect(h.writes).toBe(writes);
});
