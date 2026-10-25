import { randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BridgeServer } from '../packages/mcp-server/src/bridgeServer.js';
import { createMcpServer } from '../packages/mcp-server/src/mcpServer.js';
import { FakePluginClient } from '../scripts/fake-plugin-client.js';
import {
  TOOL_NAMES,
  envelope,
  nodeSnapshotSchema,
} from '../packages/shared/src/index.js';

const frame = {
  pageId: '0:1',
  name: 'Round trip frame',
  width: 420,
  height: 280,
  x: 12,
  y: 34,
};
describe('MCP → real WebSocket bridge → fake plugin', () => {
  let bridge: BridgeServer;
  let server: ReturnType<typeof createMcpServer>;
  let client: Client;
  let plugin: FakePluginClient;
  let token: string;
  let port: number;
  beforeEach(async () => {
    token = randomBytes(32).toString('hex');
    bridge = new BridgeServer({
      token,
      port: 0,
      timeoutMs: 250,
      heartbeatMs: 10000,
    });
    port = await bridge.start();
    server = createMcpServer(bridge);
    client = new Client({ name: 'integration', version: '1.0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(b);
    await client.connect(a);
    plugin = new FakePluginClient(`ws://127.0.0.1:${port}`, token);
    await plugin.connect();
  });
  afterEach(async () => {
    await plugin?.disconnect();
    await client?.close();
    await server?.close();
    await bridge?.close();
  });
  it('lists the phase tools, reports session, creates and reads the same frame', async () => {
    const tools = (await client.listTools()).tools;
    expect(tools.map((tool) => tool.name)).toEqual([...TOOL_NAMES]);
    expect(tools.every((tool) => tool.inputSchema && tool.outputSchema)).toBe(
      true,
    );
    const status = await client.callTool({
      name: TOOL_NAMES[0],
      arguments: {},
    });
    expect(status.structuredContent).toMatchObject({
      connected: true,
      sessionId: plugin.sessionId,
      document: { pageId: '0:1' },
    });
    const created = await client.callTool({
      name: TOOL_NAMES[1],
      arguments: { ...frame, sessionId: plugin.sessionId },
    });
    expect(created.isError).not.toBe(true);
    expect(created.structuredContent).toMatchObject({
      nodeId: '1:1',
      name: frame.name,
      width: 420,
      height: 280,
    });
    const read = await client.callTool({
      name: TOOL_NAMES[2],
      arguments: {
        sessionId: plugin.sessionId,
        nodeId: nodeSnapshotSchema.parse(created.structuredContent).nodeId,
      },
    });
    expect(read.structuredContent).toEqual(created.structuredContent);
  });
  it('rejects invalid MCP inputs before reaching the plugin', async () => {
    const result = await client.callTool({
      name: TOOL_NAMES[1],
      arguments: { ...frame, width: -1, sessionId: plugin.sessionId },
    });
    expect(result.isError).toBe(true);
    expect(plugin.nodes.size).toBe(0);
    expect(
      plugin.received.filter((message) => message.type === 'command'),
    ).toHaveLength(0);
  });
  it('rejects an incorrect token with AUTH_FAILED', async () => {
    const bad = new FakePluginClient(
      `ws://127.0.0.1:${port}`,
      randomBytes(32).toString('hex'),
    );
    try {
      await expect(bad.connect()).rejects.toMatchObject({
        code: 'AUTH_FAILED',
      });
    } finally {
      await bad.disconnect();
    }
    expect(bridge.status().sessionId).toBe(plugin.sessionId);
  });
  it('rejects a second authenticated session without replacing the first', async () => {
    const second = new FakePluginClient(`ws://127.0.0.1:${port}`, token);
    try {
      await expect(second.connect()).rejects.toMatchObject({
        code: 'SESSION_BUSY',
      });
    } finally {
      await second.disconnect();
    }
    expect(bridge.status().sessionId).toBe(plugin.sessionId);
  });
  it('rejects untrusted browser origins before authentication', async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`, {
      origin: 'https://evil.example',
    });
    await expect(
      new Promise((resolve, reject) => {
        socket.on('open', resolve);
        socket.on('error', reject);
      }),
    ).rejects.toThrow('401');
    socket.terminate();
  });
  it('rejects stale session IDs without executing writes', async () => {
    const result = await client.callTool({
      name: TOOL_NAMES[1],
      arguments: { ...frame, sessionId: 'another-session' },
    });
    expect(JSON.stringify(result.content)).toContain('SESSION_MISMATCH');
    expect(plugin.nodes.size).toBe(0);
  });
  it('times out an in-flight request across disconnect and accepts new requests after reconnect', async () => {
    plugin.dropCommands = true;
    const pending = client.callTool({
      name: TOOL_NAMES[1],
      arguments: { ...frame, sessionId: plugin.sessionId },
    });
    await vi.waitFor(() =>
      expect(
        plugin.received.some((message) => message.type === 'command'),
      ).toBe(true),
    );
    await plugin.disconnect();
    await vi.waitFor(() => expect(bridge.status().connected).toBe(false));
    plugin.dropCommands = false;
    await plugin.connect();
    const interrupted = await pending;
    expect(interrupted.isError).toBe(true);
    expect(JSON.stringify(interrupted.content)).toContain('TIMEOUT');
    const result = await client.callTool({
      name: TOOL_NAMES[1],
      arguments: { ...frame, sessionId: plugin.sessionId },
    });
    expect(nodeSnapshotSchema.parse(result.structuredContent).nodeId).toBe(
      '1:1',
    );
    expect(plugin.nodes.size).toBe(1);
  });
  it('returns NOT_CONNECTED when the plugin is absent', async () => {
    await plugin.disconnect();
    await vi.waitFor(() => expect(bridge.status().connected).toBe(false));
    const result = await client.callTool({
      name: TOOL_NAMES[2],
      arguments: { nodeId: '1:1', sessionId: plugin.sessionId },
    });
    expect(JSON.stringify(result.content)).toContain('NOT_CONNECTED');
  });
  it('cancels waiting work and sends the correlation ID to the plugin', async () => {
    plugin.dropCommands = true;
    const controller = new AbortController();
    const pending = bridge.request(
      plugin.sessionId,
      { command: 'readNode', input: { nodeId: '1:1' } },
      controller.signal,
    );
    const result = expect(pending).rejects.toMatchObject({
      error: { code: 'CANCELLED' },
    });
    await vi.waitFor(() =>
      expect(
        plugin.received.some((message) => message.type === 'command'),
      ).toBe(true),
    );
    controller.abort();
    await result;
    await vi.waitFor(() =>
      expect(plugin.received.some((message) => message.type === 'cancel')).toBe(
        true,
      ),
    );
    expect(
      plugin.received.find((message) => message.type === 'cancel')
        ?.correlationId,
    ).toBe(
      plugin.received.find((message) => message.type === 'command')
        ?.correlationId,
    );
  });
  it('does not accept a result for a different command', async () => {
    plugin.dropCommands = true;
    const pending = bridge.request(plugin.sessionId, {
      command: 'readNode',
      input: { nodeId: '1:1' },
    });
    const result = expect(pending).rejects.toMatchObject({
      error: { code: 'TIMEOUT' },
    });
    await vi.waitFor(() =>
      expect(
        plugin.received.some((message) => message.type === 'command'),
      ).toBe(true),
    );
    const command = plugin.received.find(
      (message) => message.type === 'command',
    );
    plugin.send(
      envelope('result', plugin.sessionId, command!.correlationId, {
        command: 'ping',
        result: { alive: true },
      }),
    );
    await result;
    expect(bridge.status().connected).toBe(false);
  });
});

it('heartbeats keep a healthy plugin and disconnect an unresponsive runtime', async () => {
  const token = randomBytes(32).toString('hex');
  const bridge = new BridgeServer({
    token,
    port: 0,
    timeoutMs: 80,
    heartbeatMs: 50,
  });
  const port = await bridge.start();
  const plugin = new FakePluginClient(`ws://127.0.0.1:${port}`, token);
  try {
    await plugin.connect();
    await vi.waitFor(() =>
      expect(
        plugin.received.some(
          (message) =>
            message.type === 'command' && message.payload.command === 'ping',
        ),
      ).toBe(true),
    );
    expect(bridge.status().connected).toBe(true);
    plugin.dropHeartbeat = true;
    await vi.waitFor(() => expect(bridge.status().connected).toBe(false));
  } finally {
    await plugin.disconnect();
    await bridge.close();
  }
});
