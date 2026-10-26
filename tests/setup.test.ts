import {
  mkdtemp,
  mkdir,
  cp,
  symlink,
  writeFile,
  readFile,
  readdir,
  rm,
} from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { beforeAll, expect, it } from 'vitest';

beforeAll(() => {
  execFileSync(process.execPath, ['build.mjs'], {
    cwd: resolve('packages/mcp-server'),
    stdio: 'pipe',
  });
  execFileSync(process.execPath, ['--import', 'tsx', 'build.ts'], {
    cwd: resolve('packages/plugin'),
    stdio: 'pipe',
  });
});

async function sandbox() {
  const temporary = await mkdtemp(join(tmpdir(), 'magic-ui-setup-'));
  const root = join(temporary, 'project with spaces');
  const home = join(temporary, 'home');
  const bin = join(temporary, 'bin');
  for (const directory of [
    root,
    home,
    bin,
    join(root, 'packages/mcp-server'),
    join(root, 'packages/plugin'),
  ])
    await mkdir(directory, { recursive: true });
  for (const file of [
    'setup.command',
    'installers',
    'packages/mcp-server/dist',
    'packages/plugin/dist',
  ])
    await cp(resolve(file), join(root, file), { recursive: true });
  await symlink(resolve('node_modules'), join(root, 'node_modules'));
  await symlink(process.execPath, join(bin, 'node'));
  for (const name of ['pnpm', 'claude', 'codex', 'opencode']) {
    await writeFile(
      join(bin, name),
      `#!${process.execPath}\n${await readFile('tests/fixtures/setup-client.mjs', 'utf8')}`,
      { mode: 0o700 },
    );
  }
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${bin}:/usr/bin:/bin`,
    HOME: home,
    CODEX_HOME: join(home, '.codex'),
    XDG_CONFIG_HOME: join(home, '.config'),
    XDG_DATA_HOME: join(home, '.data'),
    XDG_STATE_HOME: join(home, '.state'),
  };
  const listener = createServer();
  await new Promise<void>((accept) => listener.listen(0, '127.0.0.1', accept));
  const address = listener.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing test port');
  const port = address.port;
  await new Promise<void>((accept) => listener.close(() => accept()));
  env.MAGIC_UI_BRIDGE_PORT = String(port);
  // Isolate the copied test artifacts from any real user hub on the default port.
  for (const name of ['manifest.json', 'ui.js', 'ui.html']) {
    const path = join(root, 'packages/plugin/dist', name);
    await writeFile(
      path,
      (await readFile(path, 'utf8')).replaceAll(
        /ws:\/\/localhost:\d+/g,
        `ws://localhost:${port}`,
      ),
    );
  }
  delete env.CLAUDE_CONFIG_DIR;
  delete env.OPENCODE_CONFIG;
  delete env.OPENCODE_CONFIG_CONTENT;
  const configs = [
    join(home, '.claude.json'),
    join(home, '.codex/config.toml'),
    join(home, '.config/opencode/opencode.json'),
  ];
  const other = { command: 'keep-user-server', args: ['unchanged'] };
  for (const [index, file] of configs.entries()) {
    await mkdir(resolve(file, '..'), { recursive: true });
    const value =
      index === 2
        ? { mcp: { servers: { existing: other } }, theme: 'keep' }
        : {
            [index === 0 ? 'mcpServers' : 'mcp_servers']: { existing: other },
            settings: 'keep',
            projects: {
              '/trusted/project/magic-ui': { trust_level: 'trusted' },
            },
          };
    await writeFile(file, JSON.stringify(value));
  }
  async function run(mode = 'install') {
    const child = spawn('/bin/bash', [join(root, 'setup.command'), mode], {
      env,
      cwd: root,
    });
    let output = '';
    child.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });
    child.stderr.on('data', (data: Buffer) => {
      output += data.toString();
    });
    const code = await new Promise<number | null>((accept) =>
      child.on('exit', accept),
    );
    return { code, output };
  }
  return { temporary, root, home, bin, configs, run };
}
it('runs setup twice from a path with spaces, preserves other servers, backs up, and supports repair and verify', async () => {
  const fixture = await sandbox();
  try {
    const before = await Promise.all(
      fixture.configs.map((p) => readFile(p, 'utf8')),
    );
    const first = await fixture.run();
    expect(first.output).toContain('Server / tools / bridge port: Startup');
    expect(first.code, first.output).toBe(0);
    const after = await Promise.all(
      fixture.configs.map((p) => readFile(p, 'utf8')),
    );
    for (const [index, file] of fixture.configs.entries()) {
      expect(after[index]).toContain('keep-user-server');
      expect(after[index]).toContain('unchanged');
      const backups = (await readdir(resolve(file, '..'))).filter((name) =>
        name.startsWith(file.split('/').at(-1)! + '.magic-ui-backup-'),
      );
      expect(backups).toHaveLength(1);
      expect(
        await readFile(join(resolve(file, '..'), backups[0]!), 'utf8'),
      ).toBe(before[index]);
    }
    const second = await fixture.run();
    expect(second.code, second.output).toBe(0);
    expect(
      await Promise.all(fixture.configs.map((p) => readFile(p, 'utf8'))),
    ).toEqual(after);
    expect(
      (await readFile(join(fixture.home, 'registrations'), 'utf8'))
        .trim()
        .split('\n'),
    ).toHaveLength(3);
    await writeFile(fixture.configs[2]!, before[2]!);
    const repair = await fixture.run('repair');
    expect(repair.code, repair.output).toBe(0);
    expect(
      (await readFile(join(fixture.home, 'registrations'), 'utf8'))
        .trim()
        .split('\n'),
    ).toHaveLength(4);
    const verified = await fixture.run('verify');
    expect(verified.code, verified.output).toBe(0);
    expect(verified.output).toContain('Not Tested: Install / build');
    expect(
      (await readFile(join(fixture.home, 'registrations'), 'utf8'))
        .trim()
        .split('\n'),
    ).toHaveLength(4);
  } finally {
    await rm(fixture.temporary, { recursive: true, force: true });
  }
});
it('fails before any configuration mutation when Node is missing or too old', async () => {
  const fixture = await sandbox();
  try {
    const before = await Promise.all(
      fixture.configs.map((p) => readFile(p, 'utf8')),
    );
    await rm(join(fixture.bin, 'node'));
    const missing = await fixture.run();
    expect(missing.code).not.toBe(0);
    expect(missing.output).toContain('install Node.js >=24');
    await writeFile(join(fixture.bin, 'node'), '#!/bin/sh\nexit 1\n', {
      mode: 0o700,
    });
    const old = await fixture.run();
    expect(old.code).not.toBe(0);
    expect(old.output).toContain('Node.js >=24 is required');
    expect(
      await Promise.all(fixture.configs.map((p) => readFile(p, 'utf8'))),
    ).toEqual(before);
    expect(await readdir(fixture.home)).not.toContain('registrations');
    expect(await readdir(fixture.home)).not.toContain('.magic-ui');
  } finally {
    await rm(fixture.temporary, { recursive: true, force: true });
  }
});
