// Exercise the production runtime in a child process without touching the user's home directory.
import { startServer } from '../packages/mcp-server/src/serverRuntime.js';
const directory = process.argv[2];
if (!directory) throw new Error('Test session directory is required.');
await startServer({ port: 0, sessionDirectory: directory });
