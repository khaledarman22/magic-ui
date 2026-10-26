import { isolateOpenCodeService } from './clientSandbox.js';
// Model-free integration harness. Uses actual clients with an isolated HOME.
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  realpath,
} from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const temp = await realpath(
  await mkdtemp(join(tmpdir(), 'magic-ui-discovery-')),
);
const home = join(temp, 'home'),
  output = join(temp, 'output with spaces');
await mkdir(join(home, '.codex'), { recursive: true });
await mkdir(output);
const env = {
  ...process.env,
  HOME: home,
  CODEX_HOME: join(home, '.codex'),
  XDG_CONFIG_HOME: join(home, '.config'),
  XDG_DATA_HOME: join(home, '.data'),
  XDG_STATE_HOME: join(home, '.state'),
};
const config =
  '[mcp_servers.magic-ui]\ncommand = "/usr/bin/true"\nargs = []\n\n[mcp_servers.unrelated]\ncommand = "/usr/bin/true"\nargs = []\n';
await writeFile(join(home, '.codex/config.toml'), config);
const stopService = await isolateOpenCodeService(env, output);
try {
  const installCode = `import { installAgentArtifacts } from ${JSON.stringify(resolve('installers/agentArtifacts.ts'))}; import { inspectClientDiscovery } from ${JSON.stringify(resolve('installers/clientDiscovery.ts'))}; import { readdirSync } from 'node:fs'; const root=${JSON.stringify(resolve('.'))}; for(const client of ['claude','codex','opencode']) { const results=installAgentArtifacts({root,client,verify:false}); if(results.filter(r=>r.state==='Passed').length!==23) throw new Error('Incomplete artifacts'); console.log(JSON.stringify(await inspectClientDiscovery(client,root,readdirSync(root+'/agent/skills')))); }`;
  const installed = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', installCode],
    { env, cwd: output, encoding: 'utf8', timeout: 45000 },
  );
  assert.equal(installed.status, 0, installed.stderr);
  process.stdout.write(installed.stdout);
  assert.match(installed.stdout, /Codex app-server skills\/list discovered 20/);
  assert.match(installed.stdout, /Installed OpenCode CLI lists all three/);
  for (const role of ['figma-reader-agent', 'validation-agent']) {
    const checked = spawnSync(
      process.execPath,
      [resolve('installers/launch-codex-reader.ts'), '--check', role, output],
      { env, cwd: output, encoding: 'utf8', timeout: 30000 },
    );
    assert.equal(checked.status, 0, checked.stderr);
    process.stdout.write(checked.stdout);
  }
  assert.equal(
    await readFile(join(home, '.codex/config.toml'), 'utf8'),
    config,
  );
  console.log(
    'Passed: actual client discovery and Codex reader/validator configuration checks; original config unchanged; no model calls.',
  );
  stopService();
  await rm(temp, { recursive: true, force: true });
} catch (error) {
  stopService();
  console.error(`Sandbox retained: ${temp}`);
  throw error;
}
