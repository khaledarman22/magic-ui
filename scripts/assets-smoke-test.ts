import { createInterface } from 'node:readline/promises';
import { mkdtemp, realpath, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  connectionStatusSchema,
  initializeProjectResultSchema,
  assetRecordSchema,
  projectLayoutResultSchema,
  renderDesignResultSchema,
  presentScreenResultSchema,
  designSpecificationSchema,
} from '../packages/shared/src/index.js';
import { createSamplePng } from './samples/createSamplePng.js';
const root = await realpath(
  await mkdtemp(join(tmpdir(), 'magic-ui-assets-smoke-')),
);
const terminal = createInterface({
  input: process.stdin,
  output: process.stdout,
});
const client = new Client({ name: 'magic-ui-assets-smoke', version: '0.6.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    fileURLToPath(
      new URL('../packages/mcp-server/dist/index.js', import.meta.url),
    ),
  ],
  env: {
    MAGIC_UI_WORKSPACE_ROOT: root,
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
  process.stdout.write(`Workspace retained: ${root}\n`);
  await terminal.question(
    'Open a scratch Figma file, reopen the rebuilt Magic UI plugin, connect with the new session token, then press Enter: ',
  );
  let status = connectionStatusSchema.parse(
    await call('get_connection_status', {}),
  );
  if (!status.connected || !status.sessionId || !status.document)
    throw new Error('Plugin is not connected.');
  process.stdout.write(
    `Target: ${status.document.name} / ${status.document.pageName}\n`,
  );
  if (
    (await terminal.question(
      'Type RENDER to add the Phase 6 sample project pages: ',
    )) !== 'RENDER'
  )
    throw new Error('Render not requested.');
  const projectId = `phase6-${randomUUID().slice(0, 8)}`,
    project = initializeProjectResultSchema.parse(
      await call('initialize_project', { projectId, projectName: projectId }),
    );
  const spec = designSpecificationSchema.parse(
    JSON.parse(
      await readFile(
        new URL('./samples/phase-6.design-spec.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  spec.projectId = projectId;
  await writeFile(project.specificationPath, JSON.stringify(spec, null, 2));
  await writeFile(join(project.directory, 'sample.png'), createSamplePng());
  const asset = assetRecordSchema.parse(
    await call('register_asset', {
      projectId,
      id: 'sample-image',
      path: 'sample.png',
      name: 'Smoke image',
      source:
        'Deterministic gradient fixture in scripts/samples/createSamplePng.ts',
      license: 'CC0 test fixture',
    }),
  );
  const pages = projectLayoutResultSchema.parse(
    await call('prepare_project', {
      sessionId: status.sessionId,
      projectId,
      pageId: status.document.pageId,
    }),
  );
  const appPage = pages.pages.find((p) => p.id === 'mobile')!;
  await terminal.question(
    `Select the new App - Sample page (${appPage.nodeId}), then press Enter: `,
  );
  status = connectionStatusSchema.parse(
    await call('get_connection_status', {}),
  );
  if (!status.sessionId || status.document?.pageId !== appPage.nodeId)
    throw new Error(
      'Select the sample App page and reconnect if connection status is stale.',
    );
  const evidence = [];
  for (const screen of spec.pages[0]!.screens) {
    const scope = {
      sessionId: status.sessionId,
      projectId,
      pageId: appPage.nodeId,
      screenId: screen.id,
    };
    const rendered = renderDesignResultSchema.parse(
      await call('render_design', scope),
    );
    if (!rendered.assetsComplete)
      throw new Error('Unexpected missing sample asset.');
    const presentation = presentScreenResultSchema.parse(
      await call('present_screen', { ...scope, device: 'iphone' }),
    );
    evidence.push({ rendered, presentation });
  }
  if (
    new Set(evidence.map((e) => e.presentation.componentId)).size !== 1 ||
    new Set(evidence.map((e) => e.presentation.instanceId)).size !== 3
  )
    throw new Error('Mockup reuse verification failed.');
  await writeFile(
    join(project.directory, 'assets-verification.json'),
    JSON.stringify(
      {
        target: status.document,
        asset,
        pages,
        evidence,
        visualVerification: 'Requires User Action',
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    `Passed: three editable screens and three mockup instances share one component.\nRequires User Action: inspect images and iPhone screen slots visually and in Layers. Originals must remain separate; Components must contain one iPhone component.\nEvidence retained: ${join(project.directory, 'assets-verification.json')}\nNo nodes deleted.\n`,
  );
} catch (error) {
  process.stderr.write(
    `Failed: ${error instanceof Error ? error.message : 'Asset smoke failed.'}\n`,
  );
  process.exitCode = 1;
} finally {
  terminal.close();
  await client.close();
}
