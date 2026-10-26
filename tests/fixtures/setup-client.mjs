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
const raw = fs.existsSync(configPath)
  ? fs.readFileSync(configPath, 'utf8')
  : '';
// A deliberately small TOML fixture reader, confined to this test harness.
const data = client !== 'codex' && raw ? JSON.parse(raw) : {};
const key = 'mcpServers';
const servers =
  client === 'codex'
    ? {}
    : client === 'opencode'
      ? ((data.mcp ??= {}).servers ??= {})
      : (data[key] ??= {});
if (client === 'codex') {
  for (const section of raw.split(/(?=^\[)/m)) {
    const name = /^\[mcp_servers\.([\w-]+)\]\n/.exec(section)?.[1];
    if (!name) continue;
    const command = /^command = (.+)$/m.exec(section)?.[1];
    const argsValue = /^args = (.+)$/m.exec(section)?.[1];
    servers[name] = {
      transport: {
        type: 'stdio',
        command: command ? JSON.parse(command) : '',
        args: argsValue ? JSON.parse(argsValue) : [],
        env: {
          MAGIC_UI_BRIDGE_PORT:
            /^MAGIC_UI_BRIDGE_PORT = "(\d+)"$/m.exec(raw)?.[1] ?? '3845',
        },
      },
    };
  }
}
if (args[1] === 'list') {
  console.log(JSON.stringify(Object.keys(servers).map((name) => ({ name }))));
  process.exit(0);
}
if (args[1] === 'get') {
  if (!servers[args[2]]) process.exit(1);
  console.log(JSON.stringify(servers[args[2]]));
  process.exit(0);
}
if (args[1] !== 'add') process.exit(2);
const environment = {
  MAGIC_UI_BRIDGE_PORT: args[args.indexOf('--env') + 1].split('=')[1],
};
const command = args.slice(args.indexOf('--') + 1);
const serverName = args.includes('magic-ui-reader')
  ? 'magic-ui-reader'
  : 'magic-ui';
servers[serverName] =
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
if (client === 'codex') {
  // Simulate CLI normalization outside Magic UI; setup must restore this line.
  fs.writeFileSync(
    configPath,
    raw.replace(/^args = .*\n/gm, '') +
      `\n[mcp_servers.${serverName}]\ncommand = ${JSON.stringify(command[0])}\nargs = ${JSON.stringify(command.slice(1))}\n\n[mcp_servers.${serverName}.env]\nMAGIC_UI_BRIDGE_PORT = ${JSON.stringify(environment.MAGIC_UI_BRIDGE_PORT)}\n`,
  );
} else fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
fs.appendFileSync(path.join(process.env.HOME, 'registrations'), client + '\n');
