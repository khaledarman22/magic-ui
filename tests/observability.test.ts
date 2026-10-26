import { randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { expect, it } from 'vitest';
import { MultiClientBridge } from '../packages/mcp-server/src/multiClientBridge.js';
import { BridgeServer } from '../packages/mcp-server/src/bridgeServer.js';
import { Observability } from '../packages/mcp-server/src/observability.js';
import { createMcpServer } from '../packages/mcp-server/src/mcpServer.js';
import { FakePluginClient } from '../scripts/fake-plugin-client.js';
import { performanceReportSchema } from '../packages/shared/src/index.js';

it('preserves tool correlation through a peer/hub and records failures without logging payloads or tokens', async () => {
  const token = randomBytes(32).toString('hex');
  const hub = new MultiClientBridge({ token, port: 0 });
  const port = await hub.start();
  const peer = new MultiClientBridge({ token, port, readOnly: true });
  const logs: string[] = [];
  const observer = new Observability((line) => logs.push(line), 'debug');
  const server = createMcpServer(peer, undefined, observer);
  const client = new Client({ name: 'metrics-test', version: '1' });
  const plugin = new FakePluginClient(`ws://127.0.0.1:${port}`, token);
  try {
    await peer.start();
    await plugin.connect();
    plugin.nodes.set('1:1', {
      nodeId: '1:1',
      name: token,
      type: 'FRAME',
      parentId: '0:1',
      width: 10,
      height: 10,
      x: 0,
      y: 0,
    });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(b);
    await client.connect(a);
    expect(
      (await client.listTools()).tools.every(
        (t) => t._meta?.permission === 'read',
      ),
    ).toBe(true);
    for (const nodeId of ['1:1', 'missing'])
      await client.callTool({
        name: 'magic_ui_read_node',
        arguments: { sessionId: plugin.sessionId, nodeId },
      });
    const report = performanceReportSchema.parse(
      (
        await client.callTool({
          name: 'magic_ui_get_performance_report',
          arguments: {},
        })
      ).structuredContent,
    );
    expect(report.commands.find((r) => r.name === 'readNode')).toMatchObject({
      completed: 2,
      failed: 1,
    });
    expect(
      report.tools.find((r) => r.name === 'magic_ui_read_node'),
    ).toMatchObject({ completed: 2, failed: 1 });
    expect(report.commands[0]!.totalMs).toBeGreaterThan(0);
    expect(logs.join('')).not.toContain(token);
    expect(logs.join('')).not.toContain('missing');
    const records = logs.map(
      (line) =>
        JSON.parse(line) as {
          event: string;
          correlationId: string;
          operationId: string;
        },
    );
    const command = records.find((r) => r.event === 'command')!;
    expect(
      plugin.received.some(
        (m) =>
          m.type === 'command' && m.correlationId === command.correlationId,
      ),
    ).toBe(true);
    expect(
      records.some(
        (r) => r.event === 'tool' && r.correlationId === command.operationId,
      ),
    ).toBe(true);
    const before = observer.report();
    before.tools[0]!.completed = 999;
    expect(observer.report().tools[0]!.completed).toBe(2);
  } finally {
    await plugin.disconnect();
    await client.close();
    await server.close();
    await peer.close();
    await hub.close();
  }
});

it('rejects duplicate in-flight correlation IDs without replacing another request', async () => {
  const token = randomBytes(32).toString('hex');
  const bridge = new BridgeServer({ token, port: 0 });
  const port = await bridge.start();
  const plugin = new FakePluginClient(`ws://127.0.0.1:${port}`, token);
  try {
    await plugin.connect();
    plugin.dropCommands = true;
    const controller = new AbortController();
    const pending = bridge.request(
      plugin.sessionId,
      { command: 'readNode', input: { nodeId: '1:1' } },
      controller.signal,
      'same-correlation',
    );
    const rejected = expect(pending).rejects.toMatchObject({
      error: { code: 'CANCELLED' },
    });
    await expect(
      bridge.request(
        plugin.sessionId,
        { command: 'readNode', input: { nodeId: '1:1' } },
        undefined,
        'same-correlation',
      ),
    ).rejects.toMatchObject({ error: { code: 'SESSION_BUSY' } });
    controller.abort();
    await rejected;
  } finally {
    await plugin.disconnect();
    await bridge.close();
  }
});

it('filters debug/info logs at warn and records thrown failures without error text', async () => {
  const secret = randomBytes(32).toString('hex');
  const logs: string[] = [];
  const observer = new Observability((line) => logs.push(line), 'warn');
  await observer.tool('success', () => ({ content: [] }));
  await expect(
    observer.tool('failure', () => {
      throw new Error(secret);
    }),
  ).rejects.toThrow(secret);
  expect(logs).toHaveLength(1);
  expect(logs[0]).not.toContain(secret);
});
