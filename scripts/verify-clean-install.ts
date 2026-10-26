// Test harness: a clean Git clone of the current working snapshot, including
// authorized uncommitted source, without changing this repository's Git index.
import { spawn } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  cp,
  lstat,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { isolateOpenCodeService } from './clientSandbox.js';
const temporary = await realpath(
  await mkdtemp(join(tmpdir(), 'magic-ui-clean-')),
);
const source = join(temporary, 'snapshot');
const project = join(temporary, 'Clean project with spaces');
const home = join(temporary, 'home');
await mkdir(source);
await mkdir(home);
// Codex requires an explicitly overridden CODEX_HOME to already exist.
// Leave it empty: no client config or dependency is preinstalled.
await mkdir(join(home, '.codex'), { mode: 0o700 });
async function run(
  command: string,
  args: string[],
  cwd: string,
  env = process.env,
  quiet = false,
) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (b: Buffer) => {
    output += b.toString();
    if (!quiet) process.stdout.write(b);
  });
  child.stderr.on('data', (b: Buffer) => {
    output += b.toString();
    if (!quiet) process.stderr.write(b);
  });
  const code = await new Promise<number | null>((accept, reject) => {
    child.on('error', reject);
    child.on('close', accept);
  });
  if (code !== 0)
    throw new Error(`${command} failed (${code}); sandbox: ${temporary}`);
  return output;
}
const files = (
  await run(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    process.cwd(),
    process.env,
    true,
  )
)
  .split('\0')
  .filter(Boolean);
for (const file of new Set(files)) {
  const from = resolve(file);
  const stat = await lstat(from).catch(() => null);
  if (!stat) continue;
  if (
    !stat.isFile() ||
    /(^|\/)(node_modules|\.pnpm-store|\.env|session\.json)(\/|$)/.test(file)
  )
    throw new Error('Unsafe snapshot entry.');
  await mkdir(dirname(join(source, file)), { recursive: true });
  await cp(from, join(source, file));
}
const env: NodeJS.ProcessEnv = {
  ...process.env,
  HOME: home,
  CODEX_HOME: join(home, '.codex'),
  XDG_CONFIG_HOME: join(home, '.config'),
  XDG_DATA_HOME: join(home, '.data'),
  XDG_STATE_HOME: join(home, '.state'),
  CI: 'true',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
};
for (const key of [
  'CLAUDE_CONFIG_DIR',
  'OPENCODE_CONFIG',
  'OPENCODE_CONFIG_CONTENT',
  'OPENCODE_CONFIG_DIR',
])
  delete env[key];
await run('git', ['init', '-q'], source, env);
await run('git', ['add', '.'], source, env);
await run(
  'git',
  [
    '-c',
    'user.name=Verification',
    '-c',
    'user.email=verification@localhost',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-qm',
    'Current working snapshot for clean install verification',
  ],
  source,
  env,
);
await run('git', ['clone', '--no-local', source, project], temporary, env);
if (await lstat(join(project, 'node_modules')).catch(() => null))
  throw new Error('Clone unexpectedly has dependencies.');
const listener = createServer();
await new Promise<void>((accept, reject) => {
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', accept);
});
const address = listener.address();
if (!address || typeof address === 'string') throw new Error('No port');
env.MAGIC_UI_BRIDGE_PORT = String(address.port);
await new Promise<void>((accept) => listener.close(() => accept()));
const stop = await isolateOpenCodeService(env, project);
try {
  const install = await run('./setup.command', ['install'], project, env);
  const verify = await run('./setup.command', ['verify'], project, env);
  const tests = await run('pnpm', ['test'], project, env);
  await writeFile(
    join(temporary, 'verification.txt'),
    install + verify + tests,
  );
  process.stdout.write(
    `Passed: clean Git clone without node_modules; real setup install + verify + pnpm test. Retained sandbox/evidence: ${temporary}\n`,
  );
} finally {
  stop();
}
