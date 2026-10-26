import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { expect, it, vi, afterEach } from 'vitest';
import { MultiClientBridge } from '../packages/mcp-server/src/multiClientBridge.js';
import { createMcpServer } from '../packages/mcp-server/src/mcpServer.js';
import { FakePluginClient } from '../scripts/fake-plugin-client.js';
import { PluginConnectionManager } from '../packages/plugin/src/pluginConnectionManager.js';
import { envelope } from '../packages/shared/src/index.js';

async function connectMcp(bridge: MultiClientBridge) {
  const server = createMcpServer(bridge);
  const client = new Client({ name: 'multi-client-test', version: '1.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}
afterEach(() => vi.unstubAllGlobals());
it('routes both clients, lists two sessions, requires explicit write targets, and enforces read-only across a writable hub', async () => {
  const token = randomBytes(32).toString('hex');
  const first = new MultiClientBridge({ token, port: 0 });
  const port = await first.start();
  const second = new MultiClientBridge({ token, port });
  const reader = new MultiClientBridge({ token, port, readOnly: true });
  const plugins = [
    new FakePluginClient(`ws://127.0.0.1:${port}`, token),
    new FakePluginClient(`ws://127.0.0.1:${port}`, token),
  ];
  const clients: Awaited<ReturnType<typeof connectMcp>>[] = [];
  try {
    await second.start();
    await reader.start();
    expect(first.role).toBe('hub');
    expect(second.role).toBe('client');
    await Promise.all(plugins.map((p) => p.connect()));
    clients.push(
      await connectMcp(first),
      await connectMcp(second),
      await connectMcp(reader),
    );
    const frame = {
      pageId: '0:1',
      name: 'Client frame',
      width: 100,
      height: 100,
    };
    for (const { client } of clients.slice(0, 2)) {
      const listed = await client.callTool({
        name: 'magic_ui_list_sessions',
        arguments: {},
      });
      expect(listed.structuredContent).toMatchObject({
        sessions: plugins.map((p) => ({
          sessionId: p.sessionId,
          document: {
            name: 'Harness document',
            pageId: '0:1',
            pageName: 'Page 1',
          },
        })),
      });
      const missing = await client.callTool({
        name: 'magic_ui_create_frame',
        arguments: frame,
      });
      expect(missing.isError).toBe(true);
      for (const plugin of plugins) {
        const result = await client.callTool({
          name: 'magic_ui_create_frame',
          arguments: { ...frame, sessionId: plugin.sessionId },
        });
        expect(result.isError).not.toBe(true);
      }
    }
    expect(plugins.map((p) => p.nodes.size)).toEqual([2, 2]);
    expect(
      (await clients[2]!.client.listTools()).tools.some(
        (t) => t.name === 'magic_ui_create_frame',
      ),
    ).toBe(false);
    await expect(
      reader.request(plugins[0]!.sessionId, {
        command: 'createFrame',
        input: { ...frame, x: 0, y: 0 },
      }),
    ).rejects.toMatchObject({ error: { code: 'PERMISSION_DENIED' } });
    await reader.request(plugins[0]!.sessionId, { command: 'ping', input: {} });
    expect(plugins[0]!.received.at(-1)).toMatchObject({
      type: 'command',
      readOnly: true,
    });
    await first.withWriteLock(async () => {
      await expect(
        second.withWriteLock(async () => true),
      ).rejects.toMatchObject({ error: { code: 'SESSION_BUSY' } });
    });
    expect(await second.withWriteLock(async () => 'released')).toBe('released');
    plugins[0]!.dropCommands = true;
    const controller = new AbortController();
    const request = second.request(
      plugins[0]!.sessionId,
      { command: 'readNode', input: { nodeId: '1:1' } },
      controller.signal,
    );
    const cancelled = expect(request).rejects.toMatchObject({
      error: { code: 'CANCELLED' },
    });
    controller.abort();
    await cancelled;
  } finally {
    await Promise.all(clients.map((c) => c.close()));
    await Promise.all(plugins.map((p) => p.disconnect()));
    await reader.close();
    await second.close();
    await first.close();
  }
});
it('elects a survivor, reconnects the actual Plugin UI manager, and never replays in-flight writes', async () => {
  class BrowserSocket extends WebSocket {
    constructor(url: string) {
      super(url, { origin: 'null' });
    }
  }
  vi.stubGlobal('WebSocket', BrowserSocket);
  const token = randomBytes(32).toString('hex');
  const first = new MultiClientBridge({ token, port: 0 });
  const port = await first.start();
  const second = new MultiClientBridge({ token, port });
  const third = new MultiClientBridge({ token, port });
  const writes: string[] = [];
  const manager = new PluginConnectionManager(
    `ws://127.0.0.1:${port}`,
    (msg) => {
      if (msg.kind !== 'bridge' || msg.message.type !== 'command') return;
      const command = msg.message;
      if (command.payload.command === 'createFrame') {
        writes.push(command.correlationId);
        return;
      }
      if (command.payload.command === 'ping')
        manager.forward(
          envelope('result', command.sessionId, command.correlationId, {
            command: 'ping',
            result: { alive: true },
          }),
        );
    },
    () => {},
  );
  try {
    await second.start();
    await third.start();
    manager.connect(token, {
      name: 'Failover file',
      pageName: 'Page 1',
      pageId: '0:1',
    });
    await vi.waitFor(async () =>
      expect((await first.listSessions()).sessions).toHaveLength(1),
    );
    const sessionId = (await first.listSessions()).sessions[0]!.sessionId;
    const pending = second.request(sessionId, {
      command: 'createFrame',
      input: {
        pageId: '0:1',
        name: 'Interrupted',
        width: 100,
        height: 100,
        x: 0,
        y: 0,
      },
    });
    const interrupted = expect(pending).rejects.toMatchObject({
      error: { code: 'NOT_CONNECTED', retryable: false },
    });
    await vi.waitFor(() => expect(writes).toHaveLength(1));
    await first.close();
    await interrupted;
    await vi.waitFor(
      async () => {
        expect([second.role, third.role].sort()).toEqual(['client', 'hub']);
        expect((await second.listSessions()).sessions).toHaveLength(1);
      },
      { timeout: 5000 },
    );
    const newSession = (await third.listSessions()).sessions[0]!.sessionId;
    expect(newSession).not.toBe(sessionId);
    expect(
      await third.request(newSession, { command: 'ping', input: {} }),
    ).toMatchObject({ command: 'ping' });
    expect(writes).toHaveLength(1);
  } finally {
    manager.stop();
    await third.close();
    await second.close();
    await first.close();
  }
});

it('rejects a peer with the wrong token without disturbing connected sessions', async () => {
  const token = randomBytes(32).toString('hex');
  const first = new MultiClientBridge({ token, port: 0 });
  const port = await first.start();
  const plugin = new FakePluginClient(`ws://127.0.0.1:${port}`, token);
  const rejected = new MultiClientBridge({
    token: randomBytes(32).toString('hex'),
    port,
  });
  try {
    await plugin.connect();
    await expect(rejected.start()).rejects.toMatchObject({
      error: { code: 'AUTH_FAILED' },
    });
    expect((await first.listSessions()).sessions).toHaveLength(1);
    expect(
      await first.request(plugin.sessionId, { command: 'ping', input: {} }),
    ).toMatchObject({ command: 'ping' });
  } finally {
    await rejected.close();
    await plugin.disconnect();
    await first.close();
  }
});
