import { inspectClientDiscovery } from './clientDiscovery.ts';
import { installAgentArtifacts } from './agentArtifacts.ts';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  openSync,
  closeSync,
  writeFileSync,
  lstatSync,
  renameSync,
  unlinkSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type State = 'Passed' | 'Failed' | 'Requires User Action' | 'Not Tested';
const results: { item: string; state: State; detail: string }[] = [];
const report = (item: string, state: State, detail: string) => {
  results.push({ item, state, detail });
  console.log(`${state}: ${item}: ${detail}`);
};
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] ?? 'install';
const verify = mode === 'verify';
const run = (command: string, args: string[], timeout = 30_000) =>
  spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout,
    maxBuffer: 4 * 1024 * 1024,
  });
function checked(command: string, args: string[], timeout?: number) {
  const result = run(command, args, timeout);
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.slice(0, 2).join(' ')} failed (${result.status ?? result.error?.name ?? 'signal'}). Inspect the command locally; output is withheld to avoid logging configuration secrets.`,
    );
  return result.stdout;
}
function json(path: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new Error('Expected a JSON object.');
  return parsed as Record<string, unknown>;
}
function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function backup(path: string) {
  if (!existsSync(path)) return;
  if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())
    throw new Error('Configuration must be a regular file, not a symlink.');
  const destination = `${path}.magic-ui-backup-${new Date().toISOString().replaceAll(':', '-')}-${process.pid}`;
  const descriptor = openSync(destination, 'wx', 0o600);
  try {
    writeFileSync(descriptor, readFileSync(path));
  } finally {
    closeSync(descriptor);
  }
}
function replacePrivateConfig(path: string, contents: string) {
  const temporary = `${path}.magic-ui-${randomUUID()}.tmp`;
  const descriptor = openSync(temporary, 'wx', 0o600);
  try {
    try {
      writeFileSync(descriptor, contents);
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}
function preserveCodexConfiguration(
  path: string,
  original: string,
  serverName: string,
) {
  // The official CLI can normalize unrelated servers (e.g. drop args=[]).
  // Keep only its canonical new table and restore all pre-existing text.
  // This is scoped to the new entry; existing entries never reach this branch.
  const generated = readFileSync(path, 'utf8');
  const sections = generated
    .split(/(?=^\[)/m)
    .filter((section) =>
      new RegExp(`^\\[mcp_servers\\.${serverName}(?:\\.env)?\\]\\s*\\n`).test(
        section,
      ),
    );
  if (
    sections.length !== 2 ||
    !sections.some((section) =>
      section.startsWith(`[mcp_servers.${serverName}]`),
    ) ||
    !sections.some((section) =>
      section.startsWith(`[mcp_servers.${serverName}.env]`),
    )
  )
    throw new Error(
      'Unsupported Codex CLI output; original configuration restored.',
    );
  replacePrivateConfig(
    path,
    `${original}\n\n${sections.map((section) => section.trimEnd()).join('\n\n')}\n`,
  );
}
function configPaths(client: string) {
  if (client === 'codex')
    return [
      join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'config.toml'),
    ];
  if (client === 'claude') {
    if (process.env.CLAUDE_CONFIG_DIR)
      throw new Error(
        'Custom CLAUDE_CONFIG_DIR requires manual registration; its config location is not assumed.',
      );
    return [join(homedir(), '.claude.json')];
  }
  if (process.env.OPENCODE_CONFIG || process.env.OPENCODE_CONFIG_CONTENT)
    throw new Error(
      'Custom OpenCode configuration requires manual registration.',
    );
  const directory = join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
    'opencode',
  );
  return [join(directory, 'opencode.json'), join(directory, 'opencode.jsonc')];
}
const bridgePort = process.env.MAGIC_UI_BRIDGE_PORT ?? '3845';
const entrypoint = join(root, 'packages/mcp-server/dist/index.js');
function matches(command: unknown, args: unknown, readOnly: boolean) {
  return (
    command === process.execPath &&
    JSON.stringify(args) ===
      JSON.stringify([entrypoint, ...(readOnly ? ['--read-only'] : [])])
  );
}
async function register(
  client: 'claude' | 'codex' | 'opencode',
  serverName = 'magic-ui',
  readOnly = false,
  readback = false,
): Promise<boolean> {
  const version = run(client, ['--version']);
  if (version.status !== 0) {
    report(
      serverName === 'magic-ui' ? client : `${client} reader`,
      'Requires User Action',
      'CLI unavailable; install it and rerun repair.',
    );
    return false;
  }
  if (!readback)
    report(
      `${client} version`,
      'Passed',
      version.stdout.trim().split('\n')[0] ?? 'detected',
    );
  const help = checked(client, ['mcp', 'add', '--help']);
  const paths = configPaths(client);
  let existing: Record<string, unknown> | undefined;
  if (client === 'codex') {
    const getHelp = checked(client, ['mcp', 'get', '--help']);
    if (!getHelp.includes('--json'))
      throw new Error('Installed Codex lacks verified JSON inspection.');
    const get = run(client, ['mcp', 'get', serverName, '--json']);
    if (get.status === 0) existing = object(JSON.parse(get.stdout) as unknown);
    else {
      const listHelp = checked(client, ['mcp', 'list', '--help']);
      if (!listHelp.includes('--json'))
        throw new Error('Installed Codex lacks verified JSON listing.');
      const listed: unknown = JSON.parse(
        checked(client, ['mcp', 'list', '--json']),
      );
      if (
        !Array.isArray(listed) ||
        listed.some((entry: unknown) => typeof object(entry).name !== 'string')
      )
        throw new Error('Codex returned an invalid MCP server list.');
      if (listed.some((entry: unknown) => object(entry).name === serverName))
        throw new Error('Existing Magic UI entry could not be inspected.');
    }
  } else {
    if (paths.some((path) => path.endsWith('.jsonc') && existsSync(path)))
      throw new Error(
        'JSONC configuration requires manual review; preserving it unchanged.',
      );
    if (existsSync(paths[0]!)) {
      const config = json(paths[0]!);
      const servers =
        client === 'claude'
          ? object(config.mcpServers)
          : object(object(config.mcp).servers);
      if (serverName in servers) existing = object(servers[serverName]);
      // Older OpenCode uses mcp.<name>; preserve it and ask for explicit migration.
      if (client === 'opencode' && serverName in object(config.mcp))
        throw new Error(
          'Legacy OpenCode Magic UI entry requires manual migration.',
        );
    }
  }
  if (existing) {
    const transport =
      client === 'codex' ? object(existing.transport) : existing;
    const same =
      client === 'opencode'
        ? JSON.stringify(existing.command) ===
          JSON.stringify([
            process.execPath,
            entrypoint,
            ...(readOnly ? ['--read-only'] : []),
          ])
        : matches(transport.command, transport.args, readOnly);
    const configuredEnvironment = object(
      client === 'opencode' ? existing.environment : transport.env,
    );
    const environmentMatches =
      (configuredEnvironment.MAGIC_UI_BRIDGE_PORT ?? '3845') === bridgePort;
    if (
      !same ||
      !environmentMatches ||
      existing.enabled === false ||
      existing.disabled === true
    ) {
      report(
        serverName === 'magic-ui' ? client : `${client} reader`,
        'Requires User Action',
        'Magic UI already exists with different launch settings. Preserved; review it before replacing.',
      );
      return false;
    }
    report(
      serverName === 'magic-ui' ? client : `${client} reader`,
      'Passed',
      readback
        ? 'Magic UI registered through the official CLI and verified.'
        : 'Matching Magic UI registration already exists; no write.',
    );
    return true;
  }
  if (readback)
    throw new Error(
      'CLI returned success but no matching registration was found.',
    );
  if (verify) {
    report(
      serverName === 'magic-ui' ? client : `${client} reader`,
      'Requires User Action',
      'Magic UI is not registered; run install or repair.',
    );
    return false;
  }
  const args =
    client === 'claude'
      ? [
          'mcp',
          'add',
          '--scope',
          'user',
          serverName,
          '--',
          process.execPath,
          entrypoint,
        ]
      : client === 'opencode'
        ? [
            'mcp',
            'add',
            '--global',
            serverName,
            '--',
            process.execPath,
            entrypoint,
          ]
        : ['mcp', 'add', serverName, '--', process.execPath, entrypoint];
  if (readOnly) args.push('--read-only');
  args.splice(
    args.indexOf('--'),
    0,
    '--env',
    `MAGIC_UI_BRIDGE_PORT=${bridgePort}`,
  );
  if (
    !help.includes('--env') ||
    !help.includes('--') ||
    (client === 'claude' && !help.includes('--scope')) ||
    (client === 'opencode' &&
      (!help.includes('--global') || !help.includes('command...')))
  )
    throw new Error(
      'CLI help does not match the supported registration command.',
    );
  paths.forEach(backup);
  if (client === 'codex')
    mkdirSync(dirname(paths[0]!), { recursive: true, mode: 0o700 });
  const originalCodex =
    client === 'codex' && existsSync(paths[0]!)
      ? readFileSync(paths[0]!, 'utf8')
      : undefined;
  try {
    checked(client, args);
    if (originalCodex !== undefined)
      preserveCodexConfiguration(paths[0]!, originalCodex, serverName);
  } catch (error) {
    if (originalCodex !== undefined)
      replacePrivateConfig(paths[0]!, originalCodex);
    throw error;
  }
  // Read back via the same inspection path. Failure is reported, never silently counted as registered.
  return register(client, serverName, readOnly, true);
}
async function health() {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } =
    await import('@modelcontextprotocol/sdk/client/stdio.js');
  const client = new Client({ name: 'magic-ui-setup', version: '0.1.0' });
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entrypoint, '--read-only'],
    cwd: root,
    env,
    stderr: 'pipe',
  });
  transport.stderr?.on('data', () => {});
  try {
    await client.connect(transport);
    const tools = (await client.listTools()).tools;
    if (
      !tools.some((tool) => tool.name === 'magic_ui_list_sessions') ||
      tools.some((tool) => tool.annotations?.readOnlyHint !== true)
    )
      throw new Error('Unexpected health-check tool registry.');
    const sessions = await client.callTool({
      name: 'magic_ui_list_sessions',
      arguments: {},
    });
    if (sessions.isError) throw new Error('Bridge session query failed.');
    report(
      'Server / tools / bridge port',
      'Passed',
      `Startup and authenticated session query succeeded; ${tools.length} read-only tools.`,
    );
    const active = object(sessions.structuredContent).sessions;
    report(
      'Plugin connection',
      Array.isArray(active) && active.length > 0
        ? 'Passed'
        : 'Requires User Action',
      Array.isArray(active) && active.length > 0
        ? `${active.length} connected Figma session(s).`
        : 'Open the Plugin in Figma and pair with the private ~/.magic-ui/session.json token.',
    );
  } finally {
    await client.close();
  }
}
async function main() {
  if (!['install', 'update', 'repair', 'verify'].includes(mode))
    throw new Error('Unknown setup mode.');
  if (
    process.platform !== 'darwin' ||
    !['arm64', 'x64'].includes(process.arch) ||
    Number(process.versions.node.split('.')[0]) < 24
  )
    throw new Error('macOS arm64/x64 with Node >=24 is required.');
  checked('git', ['--version']);
  report(
    'Environment',
    'Passed',
    `${process.platform} ${process.arch}, Node ${process.versions.node}, git available.`,
  );
  let packageManager = 'pnpm';
  let prefix: string[] = [];
  if (run('pnpm', ['--version']).status !== 0) {
    if (run('corepack', ['--version']).status !== 0) {
      report(
        'pnpm',
        'Requires User Action',
        'Install pnpm or Corepack, then rerun.',
      );
      return;
    }
    packageManager = 'corepack';
    prefix = ['pnpm']; // No global shim/config writes or sudo.
  }
  checked(packageManager, [...prefix, '--version']);
  if (!verify) {
    checked(
      packageManager,
      [...prefix, 'install', '--frozen-lockfile'],
      300_000,
    );
    report('Dependencies', 'Passed', 'pnpm install --frozen-lockfile');
    checked(packageManager, [...prefix, 'build'], 180_000);
    report('Build', 'Passed', 'pnpm build');
  } else
    report(
      'Install / build',
      'Not Tested',
      'verify does not install dependencies or rebuild artifacts.',
    );
  const output = checked(process.execPath, [entrypoint, '--selftest']);
  if (!output.includes('magic_ui_list_sessions'))
    throw new Error('Selftest did not expose session discovery.');
  report('Selftest', 'Passed', `${output.trim().split('\n').length} tools.`);
  const manifestPath = join(root, 'packages/plugin/dist/manifest.json');
  const manifest = json(manifestPath);
  if (
    manifest.api !== '1.0.0' ||
    manifest.documentAccess !== 'dynamic-page' ||
    typeof manifest.main !== 'string' ||
    typeof manifest.ui !== 'string'
  )
    throw new Error('Invalid Plugin manifest.');
  for (const file of [manifest.main, manifest.ui])
    if (!existsSync(join(dirname(manifestPath), file)))
      throw new Error('Plugin build file missing.');
  const network = object(manifest.networkAccess);
  const port = bridgePort;
  if (
    JSON.stringify(network.allowedDomains) !== '["none"]' ||
    !Array.isArray(network.devAllowedDomains) ||
    !network.devAllowedDomains.includes(`ws://localhost:${port}`)
  )
    throw new Error('Manifest bridge port/domain mismatch.');
  report('Plugin manifest', 'Passed', manifestPath);
  report(
    'Plugin import',
    'Requires User Action',
    'Figma Desktop → Plugins → Development → Import plugin from manifest; select the path above.',
  );
  for (const client of ['claude', 'codex', 'opencode'] as const) {
    try {
      const writableRegistered = await register(client);
      const readerRegistered = await register(client, 'magic-ui-reader', true);
      if (writableRegistered && readerRegistered) {
        const artifacts = installAgentArtifacts({ root, client, verify });
        for (const item of artifacts)
          report(`${client} ${item.item}`, item.state, item.detail);
        const discovery = await inspectClientDiscovery(
          client,
          root,
          readdirSync(join(root, 'agent/skills')),
        );
        report(
          `${client} ${discovery.item}`,
          discovery.state,
          discovery.detail,
        );
      }
    } catch (error) {
      report(
        client,
        'Failed',
        error instanceof Error ? error.message : 'Registration failed.',
      );
    }
  }
  await health();
}
try {
  await main();
} catch (error) {
  report(
    'Setup',
    'Failed',
    error instanceof Error ? error.message : 'Setup failed.',
  );
}
console.log(
  `Summary (${mode}): ${results.map(({ item, state }) => `${item}=${state}`).join('; ')}`,
);
if (results.some((entry) => entry.state === 'Failed')) process.exitCode = 1;
