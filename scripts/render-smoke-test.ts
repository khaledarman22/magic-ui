import { createInterface } from 'node:readline/promises';
import { mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  connectionStatusSchema,
  initializeProjectResultSchema,
  renderDesignResultSchema,
  validateDesignSpecification,
} from '../packages/shared/src/index.js';

// A fresh allowed workspace per run; stable Figma project/screen IDs make repeated runs idempotent.
const workspaceRoot = await realpath(
  await mkdtemp(join(tmpdir(), 'magic-ui-render-smoke-')),
);
const client = new Client({ name: 'magic-ui-render-smoke', version: '0.2.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    fileURLToPath(
      new URL('../packages/mcp-server/dist/index.js', import.meta.url),
    ),
  ],
  env: {
    MAGIC_UI_WORKSPACE_ROOT: workspaceRoot,
    ...(process.env.MAGIC_UI_BRIDGE_PORT
      ? { MAGIC_UI_BRIDGE_PORT: process.env.MAGIC_UI_BRIDGE_PORT }
      : {}),
  },
});
const terminal = createInterface({
  input: process.stdin,
  output: process.stdout,
});
try {
  const specification: unknown = JSON.parse(
    await readFile(
      new URL('./samples/phase-2.design-spec.json', import.meta.url),
      'utf8',
    ),
  );
  const validation = validateDesignSpecification(specification);
  if (!validation.valid) throw new Error(JSON.stringify(validation.errors));
  await client.connect(transport);
  const initialized = await client.callTool({
    name: 'magic_ui_initialize_project',
    arguments: { projectId: 'phase2-smoke', projectName: 'Phase2Smoke' },
  });
  if (initialized.isError) throw new Error(JSON.stringify(initialized.content));
  const project = initializeProjectResultSchema.parse(
    initialized.structuredContent,
  );
  await writeFile(
    project.specificationPath,
    JSON.stringify(specification, null, 2) + '\n',
  );
  process.stdout.write(`Sample workspace: ${project.directory}\n`);
  await terminal.question(
    'Reopen the newly built Magic UI plugin, paste the current session token, click Reconnect, then press Enter when Connected: ',
  );
  const status = connectionStatusSchema.parse(
    (
      await client.callTool({
        name: 'magic_ui_get_connection_status',
        arguments: {},
      })
    ).structuredContent,
  );
  if (!status.connected || !status.sessionId || !status.document)
    throw new Error('Plugin is not connected.');
  process.stdout.write(
    `Target: ${status.document.name} / ${status.document.pageName}\n`,
  );
  if (
    (await terminal.question(
      'Type RENDER to create/update the sample header, list and button on this page: ',
    )) !== 'RENDER'
  )
    throw new Error('No render requested.');
  const render = async () => {
    const response = await client.callTool({
      name: 'magic_ui_render_design',
      arguments: {
        sessionId: status.sessionId,
        pageId: status.document!.pageId,
        projectId: 'phase2-smoke',
        screenId: 'home',
      },
    });
    if (response.isError) throw new Error(JSON.stringify(response.content));
    return renderDesignResultSchema.parse(response.structuredContent);
  };
  const first = await render();
  process.stdout.write(`First render: ${JSON.stringify(first)}\n`);
  const second = await render();
  process.stdout.write(`Second render: ${JSON.stringify(second)}\n`);
  if (
    second.created !== 0 ||
    second.updated !== 0 ||
    second.unchanged !== first.mapping.length ||
    second.nodeCount !== first.nodeCount ||
    JSON.stringify(first.mapping) !== JSON.stringify(second.mapping)
  )
    throw new Error('Repeat render changed nodes, counts or identities.');
  process.stdout.write(
    `Passed: node count unchanged (${first.nodeCount} → ${second.nodeCount}), 0 created, 0 updated, ${second.unchanged} unchanged; identical mapping.\nThe screen and sample workspace are retained for inspection.\n`,
  );
} catch (error) {
  process.stderr.write(
    `Failed: ${error instanceof Error ? error.message : 'Render smoke failed.'}\n`,
  );
  process.exitCode = 1;
} finally {
  terminal.close();
  await client.close();
}
