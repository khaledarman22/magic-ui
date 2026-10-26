// Read-only companion to assets-smoke-test.ts for inspecting retained live results.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  connectionStatusSchema,
  projectLayoutResultSchema,
  presentScreenResultSchema,
  readerChunkSchema,
  extractionSchema,
  exportResultSchema,
} from '../packages/shared/src/index.js';
const evidencePath = resolve(process.argv[2] ?? '');
const saved = JSON.parse(await readFile(evidencePath, 'utf8')) as Record<
  string,
  unknown
>;
const pages = projectLayoutResultSchema.parse(saved.pages);
if (!Array.isArray(saved.evidence)) throw new Error('Missing smoke evidence.');
const presentations = saved.evidence.map((item: unknown) =>
  presentScreenResultSchema.parse(
    (item as Record<string, unknown>).presentation,
  ),
);
const root = dirname(evidencePath),
  terminal = createInterface({ input: process.stdin, output: process.stdout });
const client = new Client({
  name: 'magic-ui-assets-inspection',
  version: '0.6.0',
});
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    fileURLToPath(
      new URL('../packages/mcp-server/dist/index.js', import.meta.url),
    ),
    '--read-only',
  ],
  env: { MAGIC_UI_WORKSPACE_ROOT: root },
});
async function call(name: string, args: Record<string, unknown>) {
  const r = await client.callTool(
    { name: `magic_ui_${name}`, arguments: args },
    undefined,
    { timeout: 120000 },
  );
  if (r.isError) throw new Error(JSON.stringify(r.content));
  return r.structuredContent;
}
try {
  await client.connect(transport);
  await terminal.question(
    'Connect Magic UI to this read-only session in the same scratch file, then press Enter: ',
  );
  const status = connectionStatusSchema.parse(
    await call('get_connection_status', {}),
  );
  if (!status.sessionId) throw new Error('Not connected.');
  const sessionId = status.sessionId;
  const extractions = [];
  for (const page of pages.pages) {
    let cursor: string | null = null,
      data = '';
    do {
      const chunk = readerChunkSchema.parse(
        await call('read_page', {
          sessionId,
          nodeId: page.nodeId,
          ...(cursor ? { cursor } : {}),
        }),
      );
      data += chunk.data;
      cursor = chunk.nextCursor;
    } while (cursor);
    extractions.push(extractionSchema.parse(JSON.parse(data)));
  }
  const nodes = extractions.flatMap((e) => e.nodes);
  for (const presentation of presentations) {
    const source = nodes.find((n) => n.id === presentation.sourceNodeId),
      instance = nodes.find((n) => n.id === presentation.instanceId);
    if (
      source?.type !== 'FRAME' ||
      instance?.type !== 'INSTANCE' ||
      instance.properties.mainComponentId !== presentation.componentId
    )
      throw new Error('Live source/instance identity mismatch.');
  }
  const imageHashes = new Set(
    nodes
      .filter((n) => /^image-[123]$/.test(n.identity.id ?? ''))
      .flatMap((n) =>
        Array.isArray(n.properties.fills)
          ? n.properties.fills.map(
              (p: unknown) => (p as Record<string, unknown>).imageHash,
            )
          : [],
      ),
  );
  if (imageHashes.size !== 1 || imageHashes.has(undefined))
    throw new Error('Source images do not share one live imageHash.');
  const exported = [];
  for (const [index, presentation] of presentations.entries())
    for (const [kind, nodeId] of [
      ['screen', presentation.sourceNodeId],
      ['presentation', presentation.presentationId],
    ] as const) {
      const result = exportResultSchema.parse(
        await call('export_asset', {
          sessionId,
          nodeId,
          projectId: `phase6-${kind}-${index + 1}`,
          format: 'PNG',
          scale: 1,
        }),
      );
      exported.push({ kind, index: index + 1, ...result });
    }
  await writeFile(
    join(root, 'live-inspection.json'),
    JSON.stringify(
      {
        status,
        presentations,
        extractions,
        exported,
        sharedImageHash: [...imageHashes][0],
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    `Passed: real sources, instance references and shared image hash verified.\n${JSON.stringify(exported, null, 2)}\nEvidence: ${join(root, 'live-inspection.json')}\n`,
  );
} finally {
  terminal.close();
  await client.close();
}
