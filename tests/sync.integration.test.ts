import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, realpath, rm, readFile } from 'node:fs/promises';
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
  classifySync,
  designSpecificationSchema,
  syncReportSchema,
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
async function resume(
  operationId: string,
  decisions: { localId: string; decision: 'apply-spec' | 'keep-figma' }[] = [],
) {
  const r = await client.callTool({
    name: 'magic_ui_resume_operation',
    arguments: {
      sessionId: plugin.sessionId,
      projectId: scope.projectId,
      operationId,
      decisions,
    },
  });
  expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
  return syncReportSchema.parse(r.structuredContent);
}
it('classifies all six states from independent spec and live baselines', () => {
  expect(classifySync('a', 'a', 'x', 'x')).toBe('in-sync');
  expect(classifySync('b', 'a', 'x', 'x')).toBe('spec-changed');
  expect(classifySync('a', 'a', 'y', 'x')).toBe('figma-changed');
  expect(classifySync('b', 'a', 'y', 'x')).toBe('conflict');
  expect(classifySync('a', 'a', undefined, 'x')).toBe('missing-in-figma');
  expect(classifySync(undefined, 'a', 'x', 'x')).toBe('orphaned');
});
it('preserves a manual color while applying another text edit; preview is read-only', async () => {
  await success('render_design');
  const manual = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }];
  node('header').fills = manual;
  const spec = sampleSpecification();
  const list = spec.pages[0]!.screens[0]!.nodes[1]!;
  if (list.type !== 'frame' || list.nodes[0]!.type !== 'text')
    throw new Error('fixture');
  list.nodes[0]!.content = 'Changed in specification';
  await writeFile(path, JSON.stringify(spec));
  const before = harness.writes;
  const preview = syncReportSchema.parse(
    (await success('preview_changes')).structuredContent,
  );
  expect(harness.writes).toBe(before);
  expect(preview.operations.find((r) => r.localId === 'header')?.status).toBe(
    'figma-changed',
  );
  await success('apply_changes');
  expect(node('header').fills).toEqual(manual);
  expect(node('item-one').characters).toBe('Changed in specification');
  const status = syncReportSchema.parse(
    (await success('get_sync_status')).structuredContent,
  );
  expect(status.operations.find((r) => r.localId === 'header')?.status).toBe(
    'figma-changed',
  );
});
it('requires a per-node conflict decision and persists accepted keep-figma drift', async () => {
  await success('render_design');
  node('header').characters = 'Manual';
  const spec = sampleSpecification();
  const header = spec.pages[0]!.screens[0]!.nodes[0]!;
  if (header.type !== 'text') throw new Error('fixture');
  header.content = 'Spec';
  await writeFile(path, JSON.stringify(spec));
  const report = syncReportSchema.parse(
    (await success('apply_changes')).structuredContent,
  );
  expect(report.operations.find((r) => r.localId === 'header')?.status).toBe(
    'conflict',
  );
  expect(node('header').characters).toBe('Manual');
  await success('apply_changes', {
    decisions: [{ localId: 'header', decision: 'apply-spec' }],
  });
  expect(node('header').characters).toBe('Spec');
  node('header').characters = 'Accepted manual';
  await success('apply_changes', {
    decisions: [{ localId: 'header', decision: 'keep-figma' }],
  });
  expect(node('header').characters).toBe('Accepted manual');
  const record = (
    await workspace.readSyncData(scope.projectId)
  ).screens[0]!.nodes.find((n) => n.localId === 'header')!;
  expect(record.drift).toContain('Accepted manual');
  expect(record.lastSyncedHash).toBe(
    node('header').getSharedPluginData('magic_ui', 'hash'),
  );
  expect(
    syncReportSchema
      .parse((await success('get_sync_status')).structuredContent)
      .operations.find((r) => r.localId === 'header')?.status,
  ).toBe('in-sync');
});
async function interruptAt60() {
  const spec = designSpecificationSchema.parse({
    schemaVersion: '1.0.0',
    projectId: scope.projectId,
    pages: [
      {
        id: 'app',
        name: 'App',
        screens: [
          {
            id: 'home',
            name: '100 nodes',
            layout: { width: 500, height: 500 },
            nodes: Array.from({ length: 99 }, (_, i) => ({
              id: `node-${i}`,
              name: `Node ${i}`,
              type: 'rectangle',
              layout: { width: 10, height: 10 },
            })),
          },
        ],
      },
    ],
  });
  await writeFile(path, JSON.stringify(spec));
  let count = 0;
  afterCommand = async (command) => {
    if (command.command === 'syncStep' && ++count === 60)
      await plugin.disconnect();
  };
  const response = await call('render_design', { operationId: 'resume-100' });
  expect(response.isError).toBe(true);
  expect(harness.all()).toHaveLength(60);
  afterCommand = undefined;
  await plugin.connect();
}
it('resumes after 60/100 nodes including a lost response, validates live state and never duplicates', async () => {
  await interruptAt60();
  await resume('resume-100');
  expect(harness.all()).toHaveLength(100);
  expect(
    new Set(harness.all().map((n) => n.getSharedPluginData('magic_ui', 'id')))
      .size,
  ).toBe(100);
  await resume('resume-100');
  expect(harness.all()).toHaveLength(100);
  const journal = (await workspace.readJournals(scope.projectId))
    .operations[0]!;
  expect(journal.status).toBe('completed');
  expect(journal.steps).toHaveLength(100);
  expect(journal.steps.every((s) => s.after !== null)).toBe(true);
}, 20000);
it('detects a checkpointed node deleted during disconnection; explicit recreation is required', async () => {
  await interruptAt60();
  const deleted = node('node-5');
  deleted.parent!.children = deleted.parent!.children.filter(
    (n) => n !== deleted,
  );
  deleted.parent = null;
  const report = await resume('resume-100');
  expect(harness.all()).toHaveLength(99);
  expect(report.operations.find((r) => r.localId === 'node-5')).toMatchObject({
    status: 'missing-in-figma',
    action: 'skip',
  });
  await resume('resume-100', [{ localId: 'node-5', decision: 'apply-spec' }]);
  expect(harness.all()).toHaveLength(100);
  expect(node('node-5').id).not.toBe(deleted.id);
}, 20000);
it('moves only orphaned owned content to Trash and restores exact original parent and position', async () => {
  await success('render_design');
  const original = node('header');
  const parent = original.parent;
  const index = parent!.children.indexOf(original);
  const spec = sampleSpecification();
  spec.pages[0]!.screens[0]!.nodes.shift();
  await writeFile(path, JSON.stringify(spec));
  await success('move_to_trash', {
    localId: 'header',
    reason: 'Removed from specification',
  });
  expect(original.parent?.name).toBe('Trash');
  expect(original.getSharedPluginData('magic_ui', 'trash')).toContain(
    'Removed from specification',
  );
  await success('restore_from_trash', { localId: 'header' });
  expect(original.parent).toBe(parent);
  expect(parent!.children.indexOf(original)).toBe(index);
  const userNode = harness.api.createFrame();
  userNode.name = 'User data';
  const rejected = await call('move_to_trash', {
    localId: userNode.id,
    reason: 'Not owned',
  });
  expect(rejected.isError).toBe(true);
  expect(userNode.parent).toBe(harness.page);
  const button = node('button');
  button.appendChild(userNode);
  spec.pages[0]!.screens[0]!.nodes = [];
  await writeFile(path, JSON.stringify(spec));
  expect(
    (await call('move_to_trash', { localId: 'button', reason: 'Removed' }))
      .isError,
  ).toBe(true);
  expect(userNode.parent).toBe(button);
});
it('refuses a stale optimistic write and refuses duplicate identity instead of overwriting', async () => {
  await success('render_design');
  const item = node('header');
  const inspection = await harness.execute({
    command: 'inspectSync',
    input: { ...scope, localId: 'header' },
  });
  if (inspection.command !== 'inspectSync' || !inspection.result.live)
    throw new Error('inspection');
  item.name = 'Manual racing edit';
  const entry = (await import('../packages/shared/src/index.js')).flattenScreen(
    sampleSpecification().pages[0]!.screens[0]!,
  )[1]!;
  await expect(
    harness.execute({
      command: 'syncStep',
      input: {
        ...scope,
        entry,
        documentId: inspection.result.documentId,
        operationId: 'stale-write',
        tokens: sampleSpecification().tokens,
        direction: 'ltr',
        specVersion: '1.0.0',
        action: 'apply-spec',
        expectedNodeId: item.id,
        expectedSnapshot: inspection.result.live.snapshot,
      },
    }),
  ).rejects.toMatchObject({ error: { code: 'DRIFT_DETECTED' } });
  expect(item.name).toBe('Manual racing edit');
  const duplicate = harness.api.createText();
  for (const key of ['id', 'projectId', 'screenId'])
    duplicate.setSharedPluginData(
      'magic_ui',
      key,
      item.getSharedPluginData('magic_ui', key),
    );
  expect((await call('apply_changes')).isError).toBe(true);
});
it('cancels between durable steps and resumes safely', async () => {
  const { SyncEngine } =
    await import('../packages/mcp-server/src/syncEngine.js');
  const engine = new SyncEngine(bridge, workspace);
  const abort = new AbortController();
  await expect(
    engine.run(
      {
        ...scope,
        sessionId: plugin.sessionId,
        decisions: [],
        operationId: 'cancel-test',
      },
      abort.signal,
      'render',
      async (done) => {
        if (done === 3) abort.abort();
      },
    ),
  ).rejects.toMatchObject({ error: { code: 'CANCELLED' } });
  expect(harness.all()).toHaveLength(3);
  const journal = (await workspace.readJournals(scope.projectId))
    .operations[0]!;
  expect(journal.steps).toHaveLength(3);
  expect(journal.status).toBe('interrupted');
  await resume('cancel-test');
  expect(harness.all()).toHaveLength(7);
  const raw = await readFile(
    join(root, 'Sync-Design/design-progress.json'),
    'utf8',
  );
  expect(JSON.parse(raw).operations[0].status).toBe('completed');
});
