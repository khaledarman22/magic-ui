// Integration harness: real installed CLIs and pnpm, confined to a disposable HOME and project copy.
import {
  mkdtemp,
  mkdir,
  cp,
  readFile,
  writeFile,
  readdir,
  rm,
} from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import assert from 'node:assert/strict';
const temporary = await mkdtemp(join(tmpdir(), 'magic-ui-real-setup-'));
const project = join(temporary, 'Magic UI project');
const home = join(temporary, 'home');
await mkdir(project);
await mkdir(home);
for (const item of [
  'setup.command',
  'installers',
  'packages',
  'node_modules',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.json',
]) {
  await cp(resolve(item), join(project, item), {
    recursive: true,
    verbatimSymlinks: true,
  });
}
const listener = createServer();
await new Promise<void>((accept) => listener.listen(0, '127.0.0.1', accept));
const address = listener.address();
assert(address && typeof address === 'object');
const port = address.port;
await new Promise<void>((accept) => listener.close(() => accept()));
const configs = [
  join(home, '.claude.json'),
  join(home, '.codex/config.toml'),
  join(home, '.config/opencode/opencode.json'),
];
const contents = [
  JSON.stringify({
    mcpServers: { keep: { type: 'stdio', command: '/usr/bin/true', args: [] } },
  }),
  '[mcp_servers.keep]\ncommand = "/usr/bin/true"\n',
  JSON.stringify({
    mcp: { servers: { keep: { type: 'local', command: ['/usr/bin/true'] } } },
  }),
];
for (const [index, path] of configs.entries()) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents[index]!);
}
const env: NodeJS.ProcessEnv = {
  ...process.env,
  HOME: home,
  CODEX_HOME: join(home, '.codex'),
  XDG_CONFIG_HOME: join(home, '.config'),
  XDG_DATA_HOME: join(home, '.data'),
  XDG_STATE_HOME: join(home, '.state'),
  MAGIC_UI_BRIDGE_PORT: String(port),
  CI: 'true',
};
for (const key of [
  'CLAUDE_CONFIG_DIR',
  'OPENCODE_CONFIG',
  'OPENCODE_CONFIG_CONTENT',
  'OPENCODE_CONFIG_DIR',
])
  delete env[key];
async function run() {
  const child = spawn('/bin/bash', [join(project, 'setup.command')], {
    cwd: project,
    env,
  });
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString();
    process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk: Buffer) => {
    output += chunk.toString();
    process.stderr.write(chunk);
  });
  const code = await new Promise<number | null>((accept) =>
    child.on('exit', accept),
  );
  assert.equal(code, 0, 'Setup must succeed');
  for (const client of ['claude', 'codex', 'opencode'])
    assert.match(output, new RegExp(`Passed: ${client}:`));
  return output;
}
try {
  process.stdout.write(`Sandbox: ${temporary}\n`);
  await run();
  const first = await Promise.all(
    configs.map((path) => readFile(path, 'utf8')),
  );
  await run();
  const second = await Promise.all(
    configs.map((path) => readFile(path, 'utf8')),
  );
  assert.deepEqual(
    second,
    first,
    'Client configs must be byte-identical after the second setup',
  );
  for (const [index, path] of configs.entries()) {
    assert.match(second[index]!, /keep/);
    assert.match(second[index]!, /\/usr\/bin\/true/);
    const backups = (await readdir(dirname(path))).filter((name) =>
      name.startsWith(path.split('/').at(-1)! + '.magic-ui-backup-'),
    );
    assert.equal(
      backups.length,
      1,
      'One backup before the first registration; none on rerun',
    );
  }
  const claude = JSON.parse(second[0]!) as { mcpServers: { keep: unknown } };
  assert.deepEqual(claude.mcpServers.keep, {
    type: 'stdio',
    command: '/usr/bin/true',
    args: [],
  });
  const opencode = JSON.parse(second[2]!) as {
    mcp: { servers: { keep: unknown } };
  };
  assert.deepEqual(opencode.mcp.servers.keep, {
    type: 'local',
    command: ['/usr/bin/true'],
  });
  assert.match(
    second[1]!,
    /\[mcp_servers.keep\]\s*command = "\/usr\/bin\/true"/,
  );
  process.stdout.write(
    'Passed: real pnpm install/build and all three real client CLIs ran twice from a path with spaces; configs are byte-identical and unrelated servers/backups are preserved.\n',
  );
  await rm(temporary, { recursive: true, force: true });
} catch (error) {
  process.stderr.write(`Sandbox retained for diagnosis: ${temporary}\n`);
  throw error;
}
