import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  connectionStatusSchema,
  nodeSnapshotSchema,
  TOOL_NAMES,
} from '../packages/shared/src/index.js';

const client = new Client({ name: 'magic-ui-manual-smoke', version: '0.1.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    fileURLToPath(
      new URL('../packages/mcp-server/dist/index.js', import.meta.url),
    ),
  ],
  ...(process.env.MAGIC_UI_BRIDGE_PORT
    ? { env: { MAGIC_UI_BRIDGE_PORT: process.env.MAGIC_UI_BRIDGE_PORT } }
    : {}),
});
const terminal = createInterface({
  input: process.stdin,
  output: process.stdout,
});
try {
  await client.connect(transport);
  process.stdout.write(
    'MCP tools: ' +
      (await client.listTools()).tools.map((tool) => tool.name).join(', ') +
      '\n',
  );
  await terminal.question(
    'Open Magic UI in a Figma Design file, copy the session token into the plugin and click Reconnect. Press Enter when Connected: ',
  );
  const status = connectionStatusSchema.parse(
    (await client.callTool({ name: TOOL_NAMES[0], arguments: {} }))
      .structuredContent,
  );
  if (!status.connected || !status.sessionId || !status.document)
    throw new Error(
      'Plugin is not connected. Re-run after checking the import instructions.',
    );
  process.stdout.write(
    `Target: ${status.document.name} / ${status.document.pageName}\n`,
  );
  if (
    (await terminal.question(
      'Type CREATE to add one 400 × 240 test frame on this page: ',
    )) !== 'CREATE'
  )
    throw new Error('No frame created: confirmation was not provided.');
  const created = await client.callTool({
    name: TOOL_NAMES[1],
    arguments: {
      sessionId: status.sessionId,
      pageId: status.document.pageId,
      name: 'Magic UI Phase 1 smoke',
      width: 400,
      height: 240,
      x: 40,
      y: 40,
    },
  });
  if (created.isError) throw new Error(JSON.stringify(created.content));
  const node = nodeSnapshotSchema.parse(created.structuredContent);
  const read = await client.callTool({
    name: TOOL_NAMES[2],
    arguments: { sessionId: status.sessionId, nodeId: node.nodeId },
  });
  if (read.isError) throw new Error(JSON.stringify(read.content));
  const readNode = nodeSnapshotSchema.parse(read.structuredContent);
  if (JSON.stringify(readNode) !== JSON.stringify(node))
    throw new Error('Created frame differs from the read-back result.');
  process.stdout.write(
    `Passed: created and read the same Figma frame.\n${JSON.stringify(readNode, null, 2)}\n`,
  );
  process.stdout.write(
    'The frame is retained for visual inspection. This test does not delete any Figma content.\n',
  );
} catch (error) {
  process.stderr.write(
    `Failed: ${error instanceof Error ? error.message : 'Manual smoke test failed.'}\n`,
  );
  process.exitCode = 1;
} finally {
  terminal.close();
  await client.close();
}
