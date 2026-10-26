import { homedir } from 'node:os';
import { join } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DEFAULT_BRIDGE_PORT } from '@magic-ui/shared';
import { MultiClientBridge } from './multiClientBridge.js';
import { createMcpServer } from './mcpServer.js';
import {
  acquireInstanceLease,
  loadOrCreateSessionCredentials,
  recordHub,
} from './sessionCredentials.js';

export async function startServer(
  options: {
    port?: number;
    sessionDirectory?: string;
    readOnly?: boolean;
  } = {},
) {
  const directory = options.sessionDirectory ?? join(homedir(), '.magic-ui');
  const releaseLease = await acquireInstanceLease(directory);
  let token: string;
  try {
    token = (
      await loadOrCreateSessionCredentials(
        directory,
        options.port || DEFAULT_BRIDGE_PORT,
      )
    ).token;
  } catch (error) {
    await releaseLease();
    throw error;
  }
  const bridge = new MultiClientBridge({
    token,
    onHub: (port) => recordHub(directory, token, port),
    readOnly: options.readOnly ?? false,
    port: options.port ?? DEFAULT_BRIDGE_PORT,
  });
  const server = createMcpServer(bridge);
  let stopping = false;
  const onStop = () => {
    void shutdown().catch(() => {
      process.exitCode = 1;
    });
  };
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    process.stdin.off('end', onStop);
    process.off('SIGINT', onStop);
    process.off('SIGTERM', onStop);
    await bridge.close();
    await server.close();
    await releaseLease();
  };
  try {
    const port = await bridge.start();
    server.server.onclose = onStop;
    process.once('SIGINT', onStop);
    process.once('SIGTERM', onStop);
    process.stdin.once('end', onStop);
    await server.connect(new StdioServerTransport());
    process.stderr.write(
      `Magic UI ${bridge.role} connected on 127.0.0.1:${port}. Credentials stored in session.json.\n`,
    );
    return { shutdown, port, bridge };
  } catch (error) {
    await shutdown();
    throw error;
  }
}
