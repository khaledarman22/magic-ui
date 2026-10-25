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
  saveSessionCredentials,
} from '../packages/mcp-server/src/sessionCredentials.js';
import { sessionFileSchema } from '../packages/shared/src/index.js';
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'magic-ui-credentials-'));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
it('generates unique secrets, writes 0600 credentials and cleans up only its own session', async () => {
  const token = generateSessionToken();
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  expect(generateSessionToken()).not.toBe(token);
  const removeFirst = await saveSessionCredentials(directory, token, 3845);
  const path = join(directory, 'session.json');
  expect((await stat(path)).mode & 0o777).toBe(0o600);
  expect(
    sessionFileSchema.parse(JSON.parse(await readFile(path, 'utf8')) as unknown)
      .token,
  ).toBe(token);
  const removeSecond = await saveSessionCredentials(
    directory,
    generateSessionToken(),
    3846,
  );
  await removeFirst();
  expect(await stat(path)).toBeDefined();
  await removeSecond();
  await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' });
});
it('replaces a session-file symlink without modifying its target', async () => {
  const target = join(directory, 'keep.txt');
  await writeFile(target, 'user data');
  await symlink(target, join(directory, 'session.json'));
  const cleanup = await saveSessionCredentials(
    directory,
    generateSessionToken(),
    3845,
  );
  expect(await readFile(target, 'utf8')).toBe('user data');
  await cleanup();
});
it('refuses a symbolic-link session directory', async () => {
  const link = join(directory, 'linked');
  await symlink(directory, link);
  await expect(
    saveSessionCredentials(link, generateSessionToken(), 3845),
  ).rejects.toThrow('real directory');
});
