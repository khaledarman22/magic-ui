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
  initializeProjectResultSchema,
  renderDesignResultSchema,
} from '../packages/shared/src/index.js';
let root: string;
let bridge: BridgeServer;
let client: Client;
let server: ReturnType<typeof createMcpServer>;
let plugin: FakePluginClient;
let harness: ReturnType<typeof createRenderHarness>;
let specificationPath: string;
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'magic-ui-render-')));
  const token = randomBytes(32).toString('hex');
  bridge = new BridgeServer({ token, port: 0, heartbeatMs: 10000 });
  const port = await bridge.start();
  server = createMcpServer(bridge, new DesignWorkspace(root));
  client = new Client({ name: 'render-integration', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  const initialized = await client.callTool({
    name: 'magic_ui_initialize_project',
    arguments: { projectId: 'phase2-smoke', projectName: 'Sample' },
  });
  specificationPath = initializeProjectResultSchema.parse(
    initialized.structuredContent,
  ).specificationPath;
  await writeFile(specificationPath, JSON.stringify(sampleSpecification()));
  harness = createRenderHarness();
  plugin = new FakePluginClient(
    `ws://127.0.0.1:${port}`,
    token,
    async (command) => harness.execute(command),
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
const render = () =>
  client.callTool({
    name: 'magic_ui_render_design',
    arguments: {
      sessionId: plugin.sessionId,
      pageId: '0:1',
      projectId: 'phase2-smoke',
      screenId: 'home',
    },
  });
it('renders via MCP and WebSocket, reuses all identities and updates exactly one changed node', async () => {
  const first = renderDesignResultSchema.parse(
    (await render()).structuredContent,
  );
  expect(first).toMatchObject({ created: 7, updated: 0, unchanged: 0 });
  const second = renderDesignResultSchema.parse(
    (await render()).structuredContent,
  );
  expect(second).toMatchObject({
    created: 0,
    updated: 0,
    unchanged: 7,
    mapping: first.mapping,
  });
  const spec = sampleSpecification();
  spec.pages[0]!.screens[0]!.nodes[0]!.styling.opacity = 0.7;
  await writeFile(specificationPath, JSON.stringify(spec));
  expect(
    renderDesignResultSchema.parse((await render()).structuredContent),
  ).toMatchObject({
    created: 0,
    updated: 1,
    unchanged: 6,
    mapping: first.mapping,
  });
  expect(harness.all()).toHaveLength(7);
});
it('validates without a Figma connection and rejects traversal at the MCP boundary', async () => {
  await plugin.disconnect();
  const valid = await client.callTool({
    name: 'magic_ui_validate_design_spec',
    arguments: { specification: sampleSpecification() },
  });
  expect(valid.structuredContent).toEqual({ valid: true, errors: [] });
  const invalid = await client.callTool({
    name: 'magic_ui_validate_design_spec',
    arguments: { specification: { schemaVersion: '2' } },
  });
  expect(invalid.structuredContent).toMatchObject({
    valid: false,
    errors: expect.arrayContaining([
      expect.objectContaining({ path: 'schemaVersion' }),
    ]),
  });
  for (const name of [
    'magic_ui_initialize_project',
    'magic_ui_render_design',
  ]) {
    const result = await client.callTool({
      name,
      arguments: name.includes('initialize')
        ? { projectId: '../x', projectName: 'Sample' }
        : {
            sessionId: plugin.sessionId,
            pageId: '0:1',
            projectId: '../x',
            screenId: 'home',
          },
    });
    expect(result.isError).toBe(true);
  }
  expect(harness.all()).toHaveLength(0);
});
it('rejects oversized UTF-8 wire messages before sending anything to the plugin', async () => {
  const spec = sampleSpecification();
  const header = spec.pages[0]!.screens[0]!.nodes[0]!;
  if (header.type !== 'text') throw new Error('Expected text');
  header.content = 'م'.repeat(20000);
  const second = spec.pages[0]!.screens[0]!.nodes[1]!;
  if (second.type !== 'frame' || second.nodes[0]!.type !== 'text')
    throw new Error('Expected text');
  second.nodes[0]!.content = 'م'.repeat(20000);
  await expect(
    bridge.request(plugin.sessionId, {
      command: 'renderDesign',
      input: {
        pageId: '0:1',
        projectId: spec.projectId,
        screenId: 'home',
        specification: spec,
      },
    }),
  ).rejects.toMatchObject({ error: { code: 'MESSAGE_TOO_LARGE' } });
  expect(
    plugin.received.filter((message) => message.type === 'command'),
  ).toHaveLength(0);
  expect(harness.all()).toHaveLength(0);
});
it('returns structured drift and font errors through the complete transport', async () => {
  harness.api.loadFontAsync.mockRejectedValueOnce(new Error('Missing'));
  expect(JSON.stringify((await render()).content)).toContain(
    'FONT_UNAVAILABLE',
  );
  const journal = (await new DesignWorkspace(root).readJournals('phase2-smoke'))
    .operations[0]!;
  const resumed = await client.callTool({
    name: 'magic_ui_resume_operation',
    arguments: {
      sessionId: plugin.sessionId,
      projectId: 'phase2-smoke',
      operationId: journal.operationId,
      decisions: [{ localId: 'header', decision: 'apply-spec' }],
    },
  });
  expect(resumed.isError).not.toBe(true);
  harness.all()[1]!.name = 'Manual';
  const result = await render();
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result.content)).toContain('DRIFT_DETECTED');
});
it('renders the design system and instances over MCP/WebSocket, persists searchable registry, and extends the same set', async () => {
  const { default: raw } =
    await import('../scripts/samples/phase-3.design-spec.json');
  const {
    designSpecificationSchema,
    designSystemResultSchema,
    componentRegistrySchema,
  } = await import('../packages/shared/src/index.js');
  const { readFile } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  const spec = designSpecificationSchema.parse({
    ...raw,
    projectId: 'phase2-smoke',
  });
  await writeFile(specificationPath, JSON.stringify(spec));
  const system = async () => {
    const response = await client.callTool({
      name: 'magic_ui_render_design_system',
      arguments: {
        sessionId: plugin.sessionId,
        pageId: '0:1',
        projectId: spec.projectId,
      },
    });
    if (response.isError) throw new Error(JSON.stringify(response.content));
    return designSystemResultSchema.parse(response.structuredContent);
  };
  const first = await system(),
    second = await system();
  expect({ ...second, operationId: first.operationId }).toEqual(first);
  expect(second.operationId).not.toBe(first.operationId);
  const screenFirst = renderDesignResultSchema.parse(
    (await render()).structuredContent,
  );
  const screenSecond = renderDesignResultSchema.parse(
    (await render()).structuredContent,
  );
  expect(screenSecond.mapping).toEqual(screenFirst.mapping);
  expect(screenSecond.created).toBe(0);
  const registry = componentRegistrySchema.parse(
    JSON.parse(
      await readFile(
        join(dirname(specificationPath), 'design-system/components.json'),
        'utf8',
      ),
    ),
  );
  expect(registry.components).toHaveLength(3);
  const lookup = await client.callTool({
    name: 'magic_ui_find_component',
    arguments: {
      projectId: spec.projectId,
      name: 'Button',
      category: 'actions',
    },
  });
  expect(JSON.stringify(lookup.structuredContent)).toContain('button');
  const variables = await client.callTool({
    name: 'magic_ui_read_variables',
    arguments: { sessionId: plugin.sessionId, projectId: spec.projectId },
  });
  expect(variables.isError).not.toBe(true);
  expect(JSON.stringify(variables.structuredContent)).toContain(
    'VARIABLE_ALIAS',
  );
  const components = await client.callTool({
    name: 'magic_ui_read_components',
    arguments: { sessionId: plugin.sessionId, projectId: spec.projectId },
  });
  expect(componentRegistrySchema.parse(components.structuredContent)).toEqual(
    registry,
  );
  const variant = structuredClone(spec.components[0]!.variants[0]!);
  variant.id = 'new-variant';
  variant.values = { type: 'Secondary', size: 'Small', state: 'Default' };
  spec.components[0]!.variants.push(variant);
  await writeFile(specificationPath, JSON.stringify(spec));
  const extended = await system();
  expect(extended.componentCount).toBe(first.componentCount + 1);
  expect(extended.components.find((c) => c.id === 'button')!.nodeId).toBe(
    first.components.find((c) => c.id === 'button')!.nodeId,
  );
  expect(
    harness.document.findAll((n) => n.type === 'COMPONENT_SET'),
  ).toHaveLength(3);
});
