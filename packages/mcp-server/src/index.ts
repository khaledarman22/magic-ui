import { DEFAULT_BRIDGE_PORT, portSchema } from '@magic-ui/shared';
import { BridgeServer } from './bridgeServer.js';
import { listRegisteredTools } from './mcpServer.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  rotateSessionToken,
  generateSessionToken,
} from './sessionCredentials.js';
import { startServer } from './serverRuntime.js';

async function main() {
  if (process.argv.includes('--rotate-token')) {
    try {
      await rotateSessionToken(join(homedir(), '.magic-ui'));
    } catch {
      process.stderr.write(
        'Token rotation failed. Stop every Magic UI instance and check private credential permissions and rotate.lock. No token is printed.\n',
      );
      process.exitCode = 1;
      return;
    }
    process.stderr.write(
      'Token rotated. Re-pair the Plugin using the private session.json file.\n',
    );
    return;
  }
  if (process.argv.includes('--selftest')) {
    const bridge = new BridgeServer({
      token: generateSessionToken(),
      readOnly: process.argv.includes('--read-only'),
      port: DEFAULT_BRIDGE_PORT,
    });
    for (const name of await listRegisteredTools(bridge))
      process.stdout.write(`${name}\n`);
    return;
  }
  await startServer({
    readOnly: process.argv.includes('--read-only'),
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
      ? 'Bridge port is occupied by an unavailable or incompatible service. Check the selected port; normal Magic UI clients share one hub.\n'
      : 'Magic UI could not start. Check the bridge port and session-directory permissions.\n',
  );
  process.exitCode = 1;
});
