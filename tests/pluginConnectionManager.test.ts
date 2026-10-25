import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BridgeServer } from '../packages/mcp-server/src/bridgeServer.js';
import {
  PluginConnectionManager,
  type ConnectionState,
} from '../packages/plugin/src/pluginConnectionManager.js';
import { envelope } from '../packages/shared/src/index.js';

const browserCrypto = { getRandomValues: crypto.getRandomValues.bind(crypto) };
beforeEach(() => {
  vi.stubGlobal('crypto', browserCrypto);
});

// The browser uses the opaque Figma iframe origin. Supply the same header in this Node harness.
class BrowserSocket extends WebSocket {
  constructor(url: string) {
    super(url, { origin: 'null' });
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
});
it('the actual UI connection manager authenticates, forwards commands and reconnects after disconnection', async () => {
  vi.stubGlobal('WebSocket', BrowserSocket);
  const token = randomBytes(32).toString('hex');
  const bridge = new BridgeServer({ token, port: 0, heartbeatMs: 10000 });
  const port = await bridge.start();
  const states: ConnectionState[] = [];
  const manager = new PluginConnectionManager(
    `ws://127.0.0.1:${port}`,
    (message) => {
      if (message.kind !== 'bridge' || message.message.type !== 'command')
        return;
      const command = message.message;
      manager.forward(
        envelope('result', command.sessionId, command.correlationId, {
          command: 'ping',
          result: { alive: true },
        }),
      );
    },
    (state) => {
      states.push(state);
    },
  );
  try {
    manager.connect(token, {
      name: 'UI harness',
      pageId: '0:1',
      pageName: 'Page 1',
    });
    await vi.waitFor(() => expect(states.at(-1)?.phase).toBe('connected'));
    const firstSession = bridge.status().sessionId!;
    expect(
      await bridge.request(firstSession, { command: 'ping', input: {} }),
    ).toEqual({ command: 'ping', result: { alive: true } });
    await bridge.close();
    await vi.waitFor(() => expect(states.at(-1)?.phase).toBe('disconnected'));
    const restarted = new BridgeServer({ token, port, heartbeatMs: 10000 });
    await restarted.start();
    try {
      await vi.waitFor(() => expect(restarted.status().connected).toBe(true), {
        timeout: 3000,
      });
      expect(restarted.status().sessionId).not.toBe(firstSession);
      expect(states.at(-1)?.phase).toBe('connected');
    } finally {
      manager.stop();
      await restarted.close();
    }
  } finally {
    manager.stop();
    await bridge.close();
  }
});
it('stops retrying after token rejection and exposes a useful error', async () => {
  vi.stubGlobal('WebSocket', BrowserSocket);
  const bridge = new BridgeServer({
    token: randomBytes(32).toString('hex'),
    port: 0,
  });
  const port = await bridge.start();
  const states: ConnectionState[] = [];
  const manager = new PluginConnectionManager(
    `ws://127.0.0.1:${port}`,
    () => {},
    (state) => {
      states.push(state);
    },
  );
  try {
    manager.connect(randomBytes(32).toString('hex'), {
      name: 'UI harness',
      pageId: '0:1',
      pageName: 'Page 1',
    });
    await vi.waitFor(() => expect(states.at(-1)?.phase).toBe('error'));
    expect(states.at(-1)?.message).toContain('token is incorrect');
    expect(bridge.status().connected).toBe(false);
  } finally {
    manager.stop();
    await bridge.close();
  }
});
