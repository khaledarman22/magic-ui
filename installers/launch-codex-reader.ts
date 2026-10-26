import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// A standalone session is required: current Codex subagent files cannot override MCP.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv[2] === '--check';
const args = process.argv.slice(checkOnly ? 3 : 2);
const [role, outputDirectory, prompt] = args;
if (
  !['figma-reader-agent', 'validation-agent'].includes(role ?? '') ||
  !outputDirectory ||
  args.length > 3
)
  throw new Error(
    'Usage: node installers/launch-codex-reader.ts [--check] <figma-reader-agent|validation-agent> <existing-output-directory> [prompt]',
  );
const output = realpathSync(outputDirectory);
if (!statSync(output).isDirectory())
  throw new Error('Output workspace must be an existing directory.');
const run = (args: string[]) =>
  spawnSync('codex', args, {
    cwd: output,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  });
const help = run(['--help']);
if (
  help.status !== 0 ||
  !help.stdout.includes('--no-daemon') ||
  !help.stdout.includes('--config')
)
  throw new Error(
    'Installed Codex lacks the verified standalone configuration flags.',
  );
const listed = run(['mcp', 'list', '--json']);
if (listed.status !== 0)
  throw new Error(
    'Unable to inspect Codex MCP configuration. No session launched.',
  );
const servers: unknown = JSON.parse(listed.stdout);
if (
  !Array.isArray(servers) ||
  servers.some(
    (s: unknown) =>
      !s ||
      typeof s !== 'object' ||
      !('name' in s) ||
      typeof s.name !== 'string',
  )
)
  throw new Error('Unexpected MCP listing.');
const overrides: string[] = [];
for (const server of servers as { name: string }[]) {
  // This CLI splits override keys on dots; quoted segments are not TOML keys.
  if (!/^[a-zA-Z0-9_-]+$/.test(server.name))
    throw new Error(
      'An MCP name cannot be safely overridden by this Codex CLI. No session launched.',
    );
  overrides.push('-c', `mcp_servers.${server.name}.enabled=false`);
}
const entrypoint = join(root, 'packages/mcp-server/dist/index.js');
const selftest = spawnSync(
  process.execPath,
  [entrypoint, '--read-only', '--selftest'],
  { encoding: 'utf8', timeout: 30_000 },
);
if (selftest.status !== 0) throw new Error('Read-only selftest failed.');
const tools = selftest.stdout.trim().split('\n');
if (
  !tools.includes('magic_ui_validate_design') ||
  tools.some((n) => !/^magic_ui_[a-z_]+$/.test(n))
)
  throw new Error('Invalid read-only tool list.');
const prefix = 'mcp_servers.magic-ui-reader';
for (const [key, value] of Object.entries({
  enabled: true,
  command: process.execPath,
  args: [entrypoint, '--read-only'],
  enabled_tools: tools,
}))
  overrides.push('-c', `${prefix}.${key}=${JSON.stringify(value)}`);
overrides.push(
  '-c',
  `${prefix}.env.MAGIC_UI_WORKSPACE_ROOT=${JSON.stringify(output)}`,
);
const inspected = run([...overrides, 'mcp', 'list', '--json']);
const active: unknown =
  inspected.status === 0 ? JSON.parse(inspected.stdout) : undefined;
if (
  !Array.isArray(active) ||
  active.filter((s) => s.enabled !== false).length !== 1 ||
  !active.some(
    (s) =>
      s.name === 'magic-ui-reader' &&
      s.enabled !== false &&
      s.transport?.command === process.execPath &&
      JSON.stringify(s.transport?.args) ===
        JSON.stringify([entrypoint, '--read-only']) &&
      s.transport?.env?.MAGIC_UI_WORKSPACE_ROOT === output,
  )
)
  throw new Error(
    'Read-only configuration could not be verified. No session launched.',
  );
const readerDetails = run([
  ...overrides,
  'mcp',
  'get',
  'magic-ui-reader',
  '--json',
]);
const reader: unknown =
  readerDetails.status === 0 ? JSON.parse(readerDetails.stdout) : undefined;
if (
  !reader ||
  typeof reader !== 'object' ||
  !('enabled_tools' in reader) ||
  JSON.stringify(reader.enabled_tools) !== JSON.stringify(tools)
)
  throw new Error(
    'Reader tool allowlist could not be verified. No session launched.',
  );
// Use the installed role when present, preserving user edits. JSON-compatible
// single-line TOML strings are the supported format for these launcher roles.
const installedRole = join(
  process.env.CODEX_HOME ?? join(homedir(), '.codex'),
  'magic-ui/roles',
  `${role}.toml`,
);
const roleSource = readFileSync(
  existsSync(installedRole)
    ? installedRole
    : join(root, 'agent/clients/codex', `${role}.toml`),
  'utf8',
);
if (!roleSource.includes(`name = "${role}"`))
  throw new Error('Missing reader role.');
const encodedInstructions = /^developer_instructions = (.+)$/m.exec(
  roleSource,
)?.[1];
if (!encodedInstructions)
  throw new Error(
    'Unsupported reader role format. Preserve it and review manually.',
  );
const roleInstructions: unknown = JSON.parse(encodedInstructions);
if (typeof roleInstructions !== 'string')
  throw new Error('Invalid reader instructions.');
const instructions =
  roleInstructions
    .replaceAll('{{RULES_PATH}}', join(root, 'agent/AGENTS.md'))
    .replaceAll('{{WORKFLOWS_PATH}}', join(root, 'agent/workflows')) +
  ` Export files only inside ${output}.`;
if (checkOnly) {
  console.log(
    `Passed: ${role}; only magic-ui-reader enabled with --read-only, ${tools.length} allowlisted tools and the requested output root. No model session launched.`,
  );
  process.exit(0);
}
const session = spawnSync(
  'codex',
  [
    '--no-daemon',
    '--cd',
    output,
    '--sandbox',
    'read-only',
    ...overrides,
    '-c',
    `developer_instructions=${JSON.stringify(instructions)}`,
    ...(prompt ? ['--', prompt] : []),
  ],
  { cwd: output, stdio: 'inherit' },
);
process.exitCode = session.status ?? 1;
