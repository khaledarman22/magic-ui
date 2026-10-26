import { createInterface } from 'node:readline/promises';
import { mkdtemp, realpath, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir, cpus } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  sessionsSchema,
  initializeProjectResultSchema,
  renderDesignResultSchema,
  readerChunkSchema,
  extractionSchema,
  type NodeSpecification,
} from '../packages/shared/src/index.js';
import { performanceFixtures } from '../tests/performance/fixtures.js';

if (process.argv.includes('--help')) {
  process.stdout.write(
    'Manual Figma benchmark: build first, open/reconnect Magic UI in a scratch file, then run pnpm bench:figma. Select a session and type BENCH. Creates and retains 100 + 1000 + 5000 nodes in independent 100-node projects, respecting the 500-node/spec and 64 KiB file limits. Writes measured render/read times and partial failures in tests/performance/results. No nodes or workspaces are deleted.\n',
  );
} else {
  const workspace = await realpath(
    await mkdtemp(join(tmpdir(), 'magic-ui-figma-benchmark-')),
  );
  const client = new Client({ name: 'magic-ui-benchmark', version: '0.1.0' });
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve('packages/mcp-server/dist/index.js')],
    env: {
      MAGIC_UI_WORKSPACE_ROOT: workspace,
      ...(process.env.MAGIC_UI_BRIDGE_PORT
        ? { MAGIC_UI_BRIDGE_PORT: process.env.MAGIC_UI_BRIDGE_PORT }
        : {}),
    },
  });
  const results: {
    nodes: number;
    status: string;
    renderMs: number;
    readMs: number;
    renderedNodes: number;
    readNodes: number;
    completedBatches: number;
  }[] = [];
  const run = randomUUID().slice(0, 8);
  let target: unknown = null;
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args }, undefined, {
      timeout: 1800000,
    });
    if (result.isError)
      throw new Error(
        'Benchmark tool failed; inspect retained workspace and Figma before retrying.',
      );
    return result.structuredContent;
  };
  try {
    await client.connect(transport);
    await terminal.question(
      'Open/reconnect Magic UI in a scratch Figma file; press Enter when connected: ',
    );
    const sessions = sessionsSchema.parse(
      await call('magic_ui_list_sessions', {}),
    ).sessions;
    sessions.forEach((s, i) =>
      process.stdout.write(
        `${i + 1}: ${s.document.name} / ${s.document.pageName}\n`,
      ),
    );
    const selected =
      sessions[Number(await terminal.question('Session number: ')) - 1];
    if (!selected) throw new Error('No valid session selected.');
    target = selected;
    if (
      (await terminal.question(
        'Type BENCH to create and retain 6100 benchmark nodes in this scratch page: ',
      )) !== 'BENCH'
    )
      throw new Error('Benchmark not authorized.');
    for (const count of [100, 1000, 5000]) {
      const row = {
        nodes: count,
        status: 'running',
        renderMs: 0,
        readMs: 0,
        renderedNodes: 0,
        readNodes: 0,
        completedBatches: 0,
      };
      results.push(row);
      for (let batch = 0; batch < count / 100; batch++) {
        const projectId = `bench-${run}-${count}-${batch}`;
        const spec = performanceFixtures(100).specifications[0]!;
        const compact = (node: NodeSpecification): unknown => ({
          id: node.id,
          name: node.name,
          type: node.type,
          layout: { width: 100, height: 100 },
          ...('nodes' in node ? { nodes: node.nodes.map(compact) } : {}),
        });
        const screen = spec.pages[0]!.screens[0]!;
        const raw = {
          schemaVersion: '1.0.0',
          projectId,
          pages: [
            {
              id: 'page',
              name: 'Benchmark',
              screens: [
                {
                  id: screen.id,
                  name: projectId,
                  layout: {
                    width: 1000,
                    height: 1000,
                    x: batch * 1100,
                    y: count * 2,
                  },
                  nodes: screen.nodes.map(compact),
                },
              ],
            },
          ],
        };
        const project = initializeProjectResultSchema.parse(
          await call('magic_ui_initialize_project', {
            projectId,
            projectName: projectId,
          }),
        );
        await writeFile(project.specificationPath, JSON.stringify(raw));
        let start = performance.now();
        const rendered = renderDesignResultSchema.parse(
          await call('magic_ui_render_design', {
            sessionId: selected.sessionId,
            pageId: selected.document.pageId,
            projectId,
            screenId: screen.id,
          }),
        );
        row.renderMs += performance.now() - start;
        row.renderedNodes += rendered.nodeCount;
        const root = rendered.mapping.find((n) => n.id === screen.id);
        if (!root) throw new Error('Missing rendered root.');
        start = performance.now();
        let cursor: string | null = null,
          text = '';
        const seen = new Set<string>();
        do {
          const chunk = readerChunkSchema.parse(
            await call('magic_ui_read_page', {
              sessionId: selected.sessionId,
              nodeId: root.nodeId,
              ...(cursor ? { cursor } : {}),
            }),
          );
          text += chunk.data;
          cursor = chunk.nextCursor;
          if (text.length > 32 * 1024 * 1024 || (cursor && seen.has(cursor)))
            throw new Error(
              'Reader transfer exceeded budget or repeated cursor.',
            );
          if (cursor) seen.add(cursor);
        } while (cursor);
        row.readMs += performance.now() - start;
        row.readNodes += extractionSchema.parse(
          JSON.parse(text) as unknown,
        ).nodes.length;
        row.completedBatches++;
      }
      if (row.renderedNodes !== count || row.readNodes !== count)
        throw new Error('Unexpected real node count.');
      row.status = 'Passed';
      process.stdout.write(JSON.stringify(row) + '\n');
    }
  } catch (error) {
    const row = results.at(-1);
    if (row?.status === 'running') row.status = 'Failed';
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Benchmark failed.'}\n`,
    );
    process.exitCode = 1;
  } finally {
    terminal.close();
    await client.close();
    await mkdir('tests/performance/results', { recursive: true });
    const path = `tests/performance/results/${new Date().toISOString().replaceAll(':', '-')}-figma.json`;
    await writeFile(
      path,
      JSON.stringify(
        {
          environment: { node: process.version, cpu: cpus()[0]?.model },
          workspace,
          target,
          methodology:
            'One real render/read sample per workload, end-to-end MCP times; batches of 100 nodes; no fake Plugin; no deletion.',
          results,
        },
        null,
        2,
      ) + '\n',
    );
    process.stdout.write(
      `Retained results: ${path}; workspace: ${workspace}\n`,
    );
  }
}
