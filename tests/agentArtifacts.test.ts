import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
  symlinkSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it, vi } from 'vitest';
import { installAgentArtifacts } from '../installers/agentArtifacts.ts';
import { lintSkills } from '../scripts/lint-skills.js';
import { execFileSync } from 'node:child_process';
const temporary: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const p of temporary.splice(0))
    rmSync(p, { recursive: true, force: true });
});
function home() {
  const path = mkdtempSync(join(tmpdir(), 'magic-ui-agents-'));
  temporary.push(path);
  vi.stubEnv('HOME', path);
  vi.stubEnv('CODEX_HOME', join(path, '.codex'));
  vi.stubEnv('XDG_CONFIG_HOME', join(path, '.config'));
  return path;
}
it('installs absent skills for all clients, preserves modified skills, and is idempotent', () => {
  const path = home();
  for (const client of ['claude', 'codex', 'opencode'] as const) {
    const base =
      client === 'claude'
        ? '.claude'
        : client === 'codex'
          ? '.agents'
          : '.config/opencode';
    const skill = join(path, base, 'skills/layout-engine/SKILL.md');
    mkdirSync(resolve(skill, '..'), { recursive: true });
    writeFileSync(skill, 'User-custom skill; preserve exactly.');
    const first = installAgentArtifacts({
      root: resolve('.'),
      client,
      verify: false,
    });
    expect(
      first.some(
        (r) =>
          r.state === 'Requires User Action' &&
          r.item.endsWith('layout-engine'),
      ),
    ).toBe(true);
    expect(readdirSync(join(path, base, 'skills'))).toHaveLength(20);
    const generated = join(path, base, 'skills/figma-reading/SKILL.md');
    const before = readFileSync(generated, 'utf8');
    expect(before).toContain(resolve('agent/AGENTS.md'));
    expect(
      installAgentArtifacts({ root: resolve('.'), client, verify: false }),
    ).toEqual(first);
    expect(readFileSync(skill, 'utf8')).toBe(
      'User-custom skill; preserve exactly.',
    );
    expect(readFileSync(generated, 'utf8')).toBe(before);
  }
  expect(existsSync(join(path, '.codex/agents/figma-reader-agent.toml'))).toBe(
    false,
  );
  expect(
    readFileSync(
      join(path, '.codex/magic-ui/roles/figma-reader-agent.toml'),
      'utf8',
    ),
  ).toContain('magic-ui-reader');
  expect(
    readFileSync(join(path, '.claude/agents/figma-reader-agent.md'), 'utf8'),
  ).toContain('mcp__magic-ui-reader__*');
  expect(
    readFileSync(join(path, '.claude/agents/figma-reader-agent.md'), 'utf8'),
  ).not.toContain('mcp__magic-ui__*');
  expect(
    readFileSync(
      join(path, '.config/opencode/agents/validation-agent.md'),
      'utf8',
    ),
  ).toContain('magic_ui_reader_*');
});
it('verify creates nothing and symlink parents cannot redirect an installation', () => {
  const path = home();
  installAgentArtifacts({ root: resolve('.'), client: 'claude', verify: true });
  expect(readdirSync(path)).toEqual([]);
  const outside = join(path, 'outside');
  mkdirSync(outside);
  symlinkSync(outside, join(path, '.claude'));
  expect(() =>
    installAgentArtifacts({
      root: resolve('.'),
      client: 'claude',
      verify: false,
    }),
  ).toThrow('real directory');
  expect(readdirSync(outside)).toEqual([]);
});
it('lints all skills against actual selftest names and rejects fictional tools', () => {
  const names = execFileSync(
    process.execPath,
    ['--import', 'tsx', 'packages/mcp-server/src/index.ts', '--selftest'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n');
  expect(lintSkills(resolve('.'), new Set(names))).toEqual([]);
  expect(
    lintSkills(
      resolve('.'),
      new Set(names.filter((n) => n !== 'magic_ui_validate_design')),
    ).some((e) => e.includes('unknown MCP tool magic_ui_validate_design')),
  ).toBe(true);
});
