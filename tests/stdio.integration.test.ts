import {
  mkdtemp,
  readFile,
  stat,
  rm,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { expect, it, vi } from 'vitest';
import { createRenderHarness } from './figmaRenderHarness.js';
import { sampleSpecification } from './fixtures/sampleSpecification.js';
import { FakePluginClient } from '../scripts/fake-plugin-client.js';
import {
  nodeSnapshotSchema,
  initializeProjectResultSchema,
  renderDesignResultSchema,
  sessionFileSchema,
  TOOL_NAMES,
} from '../packages/shared/src/index.js';

it('runs production startup, MCP negotiation and frame/render round-trips over stdio with private credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'magic-ui-stdio-'));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      '--import',
      'tsx',
      resolve('scripts/stdio-test-server.ts'),
      directory,
    ],
    stderr: 'pipe',
    env: { MAGIC_UI_WORKSPACE_ROOT: await realpath(directory) },
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const client = new Client({ name: 'stdio-integration', version: '1.0' });
  let plugin: FakePluginClient | undefined;
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual([
      ...TOOL_NAMES,
    ]);
    const credentials = sessionFileSchema.parse(
      JSON.parse(
        await readFile(join(directory, 'session.json'), 'utf8'),
      ) as unknown,
    );
    expect((await stat(join(directory, 'session.json'))).mode & 0o777).toBe(
      0o600,
    );
    expect(stderr).not.toContain(credentials.token);
    const harness = createRenderHarness();
    plugin = new FakePluginClient(
      `ws://127.0.0.1:${credentials.port}`,
      credentials.token,
      async (command) => harness.execute(command),
    );
    await plugin.connect();
    const created = await client.callTool({
      name: TOOL_NAMES[1],
      arguments: {
        sessionId: plugin.sessionId,
        pageId: '0:1',
        name: 'Stdio frame',
        width: 320,
        height: 200,
      },
    });
    const node = nodeSnapshotSchema.parse(created.structuredContent);
    const read = await client.callTool({
      name: TOOL_NAMES[2],
      arguments: { sessionId: plugin.sessionId, nodeId: node.nodeId },
    });
    expect(read.structuredContent).toEqual(node);
    const initialized = await client.callTool({
      name: 'magic_ui_initialize_project',
      arguments: { projectId: 'phase2-smoke', projectName: 'Sample' },
    });
    const project = initializeProjectResultSchema.parse(
      initialized.structuredContent,
    );
    await writeFile(
      project.specificationPath,
      JSON.stringify(sampleSpecification()),
    );
    const render = async () =>
      renderDesignResultSchema.parse(
        (
          await client.callTool({
            name: 'magic_ui_render_design',
            arguments: {
              sessionId: plugin!.sessionId,
              pageId: '0:1',
              projectId: 'phase2-smoke',
              screenId: 'home',
            },
          })
        ).structuredContent,
      );
    const firstRender = await render();
    expect(firstRender).toMatchObject({ nodeCount: 7, created: 7, updated: 0 });
    expect(await render()).toMatchObject({
      nodeCount: 7,
      created: 0,
      updated: 0,
      unchanged: 7,
      mapping: firstRender.mapping,
    });
    await plugin.disconnect();
    await client.close();
    await vi.waitFor(async () => {
      await expect(stat(join(directory, 'session.json'))).rejects.toMatchObject(
        { code: 'ENOENT' },
      );
    });
  } finally {
    await plugin?.disconnect();
    await client.close();
    await rm(directory, { recursive: true, force: true });
  }
});
