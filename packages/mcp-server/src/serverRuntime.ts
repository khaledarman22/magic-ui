import { homedir } from 'node:os';
import { join } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DEFAULT_BRIDGE_PORT } from '@magic-ui/shared';
import { BridgeServer } from './bridgeServer.js';
import { createMcpServer } from './mcpServer.js';
import {
  generateSessionToken,
  saveSessionCredentials,
} from './sessionCredentials.js';

export async function startServer(
  options: {
    port?: number;
    sessionDirectory?: string;
    readOnly?: boolean;
  } = {},
) {
  const token = generateSessionToken();
  const bridge = new BridgeServer({
    token,
    readOnly: options.readOnly ?? false,
    port: options.port ?? DEFAULT_BRIDGE_PORT,
  });
  const server = createMcpServer(bridge);
  let removeCredentials: (() => Promise<void>) | undefined;
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
    await removeCredentials?.();
  };
  try {
    const port = await bridge.start();
    removeCredentials = await saveSessionCredentials(
      options.sessionDirectory ?? join(homedir(), '.magic-ui'),
      token,
      port,
    );
    server.server.onclose = onStop;
    process.once('SIGINT', onStop);
    process.once('SIGTERM', onStop);
    process.stdin.once('end', onStop);
    await server.connect(new StdioServerTransport());
    process.stderr.write(
      `Magic UI bridge listening on 127.0.0.1:${port}. Credentials stored in session.json.\n`,
    );
    return { shutdown, port };
  } catch (error) {
    await shutdown();
    throw error;
  }
}
