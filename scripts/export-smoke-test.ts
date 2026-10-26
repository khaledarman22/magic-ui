import { createInterface } from 'node:readline/promises';
import { mkdtemp, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  connectionStatusSchema,
  exportResultSchema,
  designSpecificationSchema,
} from '../packages/shared/src/index.js';

const workspaceRoot = await realpath(
  await mkdtemp(join(tmpdir(), 'magic-ui-export-smoke-')),
);
const client = new Client({ name: 'magic-ui-export-smoke', version: '0.4.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    fileURLToPath(
      new URL('../packages/mcp-server/dist/index.js', import.meta.url),
    ),
    '--read-only',
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
  await client.connect(transport);
  const tools = (await client.listTools()).tools;
  if (tools.some((t) => t._meta?.permission !== 'read'))
    throw new Error('Read-only server exposed a write tool.');
  process.stdout.write('Passed: all registered tools are read-only.\n');
  await terminal.question(
    'Open a Figma file NOT created by Magic UI, record version history, reopen the rebuilt Magic UI plugin and connect using the current token. Press Enter when connected: ',
  );
  const status = connectionStatusSchema.parse(
    (
      await client.callTool({
        name: 'magic_ui_get_connection_status',
        arguments: {},
      })
    ).structuredContent,
  );
  if (!status.sessionId || !status.document)
    throw new Error('Plugin not connected.');
  process.stdout.write(
    `Target: ${status.document.name} / ${status.document.pageName}\n`,
  );
  const response = await client.callTool(
    {
      name: 'magic_ui_export_design_package',
      arguments: {
        sessionId: status.sessionId,
        nodeId: status.document.pageId,
        projectId: 'phase4-foreign',
      },
    },
    undefined,
    { timeout: 300000 },
  );
  if (response.isError) throw new Error(JSON.stringify(response.content));
  const result = exportResultSchema.parse(response.structuredContent);
  designSpecificationSchema.parse(
    JSON.parse(
      await readFile(join(result.directory, 'design-spec.json'), 'utf8'),
    ),
  );
  process.stdout.write(
    `Passed: package created with ${result.files.length} files and a valid Design Spec.\nPackage: ${result.directory}\nRequires User Action: review previews and reports/missing-information.json (${result.missingCount} entries), then verify the Figma version history has no design modifications.\n`,
  );
} catch (error) {
  process.stderr.write(
    `Failed: ${error instanceof Error ? error.message : 'Export failed.'}\n`,
  );
  process.exitCode = 1;
} finally {
  terminal.close();
  await client.close();
}
