// Test-only CLI harness. Production setup always invokes the installed clients.
import fs from 'node:fs';
import process from 'node:process';
import console from 'node:console';
import path from 'node:path';
const client = path.basename(process.argv[1]);
const args = process.argv.slice(2);
if (args.includes('--version')) {
  console.log(client + ' test-1.0');
  process.exit(0);
}
if (args.includes('--help')) {
  console.log('mcp add --scope --global --env command... -- COMMAND --json');
  process.exit(0);
}
if (client === 'pnpm') process.exit(0);
const configPath =
  client === 'codex'
    ? path.join(process.env.CODEX_HOME, 'config.toml')
    : client === 'claude'
      ? path.join(process.env.HOME, '.claude.json')
      : path.join(process.env.XDG_CONFIG_HOME, 'opencode/opencode.json');
const data = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
  : {};
const key = client === 'codex' ? 'mcp_servers' : 'mcpServers';
const servers =
  client === 'opencode'
    ? ((data.mcp ??= {}).servers ??= {})
    : (data[key] ??= {});
if (args[1] === 'list') {
  console.log(JSON.stringify(Object.keys(servers).map((name) => ({ name }))));
  process.exit(0);
}
if (args[1] === 'get') {
  if (!servers['magic-ui']) process.exit(1);
  console.log(JSON.stringify(servers['magic-ui']));
  process.exit(0);
}
if (args[1] !== 'add') process.exit(2);
const environment = {
  MAGIC_UI_BRIDGE_PORT: args[args.indexOf('--env') + 1].split('=')[1],
};
const command = args.slice(args.indexOf('--') + 1);
servers['magic-ui'] =
  client === 'opencode'
    ? { type: 'local', command, environment }
    : client === 'codex'
      ? {
          transport: {
            type: 'stdio',
            command: command[0],
            args: command.slice(1),
            env: environment,
          },
        }
      : {
          type: 'stdio',
          command: command[0],
          args: command.slice(1),
          env: environment,
        };
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
fs.appendFileSync(path.join(process.env.HOME, 'registrations'), client + '\n');
