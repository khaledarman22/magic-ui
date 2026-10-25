import { DEFAULT_BRIDGE_PORT, portSchema } from '@magic-ui/shared';
import { BridgeServer } from './bridgeServer.js';
import { listRegisteredTools } from './mcpServer.js';
import { generateSessionToken } from './sessionCredentials.js';
import { startServer } from './serverRuntime.js';

async function main() {
  if (process.argv.includes('--selftest')) {
    const bridge = new BridgeServer({
      token: generateSessionToken(),
      port: DEFAULT_BRIDGE_PORT,
    });
    for (const name of await listRegisteredTools(bridge))
      process.stdout.write(`${name}\n`);
    return;
  }
  await startServer({
    port: portSchema.parse(
      process.env.MAGIC_UI_BRIDGE_PORT ?? DEFAULT_BRIDGE_PORT,
    ),
  });
}
void main().catch((error: unknown) => {
  const portInUse =
    error instanceof Error && 'code' in error && error.code === 'EADDRINUSE';
  process.stderr.write(
    portInUse
      ? 'Bridge port is in use. Stop the other server or set MAGIC_UI_BRIDGE_PORT and rebuild the plugin with the same port.\n'
      : 'Magic UI could not start. Check the bridge port and session-directory permissions.\n',
  );
  process.exitCode = 1;
});
