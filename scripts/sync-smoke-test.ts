import { createInterface } from 'node:readline/promises';
import { mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  connectionStatusSchema,
  initializeProjectResultSchema,
  renderDesignResultSchema,
  designSpecificationSchema,
  syncReportSchema,
  readerChunkSchema,
  extractionSchema,
} from '../packages/shared/src/index.js';

const workspaceRoot = await realpath(
  await mkdtemp(join(tmpdir(), 'magic-ui-sync-smoke-')),
);
const terminal = createInterface({
  input: process.stdin,
  output: process.stdout,
});
const client = new Client({ name: 'magic-ui-sync-smoke', version: '0.5.0' });
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
async function call(name: string, args: Record<string, unknown>) {
  const response = await client.callTool(
    { name: `magic_ui_${name}`, arguments: args },
    undefined,
    { timeout: 120000, resetTimeoutOnProgress: true },
  );
  if (response.isError) throw new Error(JSON.stringify(response.content));
  return response.structuredContent;
}
try {
  await client.connect(transport);
  process.stdout.write(`Workspace retained: ${workspaceRoot}\n`);
  await terminal.question(
    'Open a scratch Figma file, reopen the rebuilt Magic UI plugin, paste the new session token and connect. Press Enter when Connected: ',
  );
  const status = connectionStatusSchema.parse(
    await call('get_connection_status', {}),
  );
  if (!status.connected || !status.sessionId || !status.document)
    throw new Error('Plugin is not connected.');
  process.stdout.write(
    `Target: ${status.document.name} / ${status.document.pageName}\n`,
  );
  if (
    (await terminal.question(
      'Type RENDER to add the Phase 5 test screen here: ',
    )) !== 'RENDER'
  )
    throw new Error('Render not requested.');
  const projectId = `phase5-${randomUUID().slice(0, 8)}`;
  const project = initializeProjectResultSchema.parse(
    await call('initialize_project', { projectId, projectName: projectId }),
  );
  const raw: unknown = JSON.parse(
    await readFile(
      new URL('./samples/phase-2.design-spec.json', import.meta.url),
      'utf8',
    ),
  );
  const spec = designSpecificationSchema.parse(raw);
  spec.projectId = projectId;
  spec.pages[0]!.screens[0]!.name = 'Magic UI Phase 5 sync verification';
  await writeFile(project.specificationPath, JSON.stringify(spec, null, 2));
  const scope = {
    sessionId: status.sessionId,
    projectId,
    screenId: 'home',
    pageId: status.document.pageId,
  };
  const rendered = renderDesignResultSchema.parse(
    await call('render_design', scope),
  );
  const manualNode = rendered.mapping.find((n) => n.id === 'header')!,
    specNode = rendered.mapping.find((n) => n.id === 'item-one')!;
  const readText = async (nodeId: string) => {
    let cursor: string | null = null,
      data = '';
    do {
      const chunk = readerChunkSchema.parse(
        await call('read_page', {
          sessionId: scope.sessionId,
          nodeId,
          ...(cursor ? { cursor } : {}),
        }),
      );
      data += chunk.data;
      cursor = chunk.nextCursor;
    } while (cursor);
    return extractionSchema
      .parse(JSON.parse(data))
      .nodes.find((n) => n.id === nodeId)?.properties.characters;
  };
  process.stdout.write(
    `Change Header (${manualNode.nodeId}) manually to exactly: Manual text survives\n`,
  );
  await terminal.question('Press Enter after editing the text in Figma: ');
  if ((await readText(manualNode.nodeId)) !== 'Manual text survives')
    throw new Error('Expected manual edit is not visible in Figma.');
  const list = spec.pages[0]!.screens[0]!.nodes.find((n) => n.id === 'list');
  if (list?.type !== 'frame') throw new Error('Sample list not found.');
  const item = list.nodes.find((n) => n.id === 'item-one');
  if (item?.type !== 'text') throw new Error('Sample text not found.');
  item.content = 'Specification update applied';
  await writeFile(project.specificationPath, JSON.stringify(spec, null, 2));
  const preview = syncReportSchema.parse(await call('preview_changes', scope));
  if (
    preview.operations.find((n) => n.localId === 'header')?.status !==
      'figma-changed' ||
    preview.operations.find((n) => n.localId === 'item-one')?.status !==
      'spec-changed'
  )
    throw new Error('Unexpected preview classification.');
  const applied = syncReportSchema.parse(await call('apply_changes', scope));
  const manualText = await readText(manualNode.nodeId),
    specText = await readText(specNode.nodeId);
  if (
    manualText !== 'Manual text survives' ||
    specText !== 'Specification update applied'
  )
    throw new Error(
      'Figma texts do not match the preservation/update requirements.',
    );
  const evidence = {
    target: status.document,
    projectId,
    preview,
    applied,
    manualText,
    specText,
  };
  await writeFile(
    join(project.directory, 'sync-verification.json'),
    JSON.stringify(evidence, null, 2),
  );
  process.stdout.write(
    `Passed: manual text retained; independent specification text applied.\nEvidence: ${join(project.directory, 'sync-verification.json')}\nScreen and workspace retained; no nodes deleted.\n`,
  );
} catch (error) {
  process.stderr.write(
    `Failed: ${error instanceof Error ? error.message : 'Sync smoke failed.'}\n`,
  );
  process.exitCode = 1;
} finally {
  terminal.close();
  await client.close();
}
