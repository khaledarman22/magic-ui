import {
  mkdtemp,
  readFile,
  stat,
  rm,
  writeFile,
  symlink,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, expect, it } from 'vitest';
import {
  generateSessionToken,
  loadOrCreateSessionCredentials,
  recordHub,
  acquireInstanceLease,
  rotateSessionToken,
} from '../packages/mcp-server/src/sessionCredentials.js';
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'magic-ui-credentials-'));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
it('publishes one private persistent token for concurrent starts and preserves it through hub changes', async () => {
  expect(generateSessionToken()).toMatch(/^[a-f0-9]{64}$/);
  const credentials = await Promise.all(
    Array.from({ length: 12 }, () =>
      loadOrCreateSessionCredentials(directory, 3845),
    ),
  );
  expect(new Set(credentials.map((c) => c.token)).size).toBe(1);
  const token = credentials[0]!.token;
  const release = await acquireInstanceLease(directory);
  await recordHub(directory, token, 3846);
  await release();
  expect((await loadOrCreateSessionCredentials(directory, 3845)).token).toBe(
    token,
  );
  expect((await stat(join(directory, 'session.json'))).mode & 0o777).toBe(
    0o600,
  );
});
it('refuses a symbolic link or invalid credentials without replacing user data', async () => {
  const target = join(directory, 'keep.txt');
  await writeFile(target, 'user data');
  const path = join(directory, 'session.json');
  await symlink(target, path);
  await expect(
    loadOrCreateSessionCredentials(directory, 3845),
  ).rejects.toThrow();
  expect(await readFile(target, 'utf8')).toBe('user data');
  await rm(path);
  await writeFile(path, '{broken', { mode: 0o600 });
  await expect(
    loadOrCreateSessionCredentials(directory, 3845),
  ).rejects.toThrow();
  expect(await readFile(path, 'utf8')).toBe('{broken');
});
it('refuses a symbolic-link session directory', async () => {
  const path = join(directory, 'linked');
  await symlink(directory, path);
  await expect(loadOrCreateSessionCredentials(path, 3845)).rejects.toThrow(
    'real directory',
  );
});
it('refuses rotation while any instance is live, then rotates without exposing the token', async () => {
  const first = await loadOrCreateSessionCredentials(directory, 43879);
  const release = await acquireInstanceLease(directory);
  await expect(rotateSessionToken(directory)).rejects.toThrow('Stop all');
  await release();
  await rotateSessionToken(directory);
  const next = await loadOrCreateSessionCredentials(directory, 43879);
  expect(next.token).not.toBe(first.token);
});
