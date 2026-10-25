import { randomBytes } from 'node:crypto';
import { mkdir, open, rename, unlink, readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { PROTOCOL_VERSION, sessionFileSchema } from '@magic-ui/shared';

export function generateSessionToken() {
  return randomBytes(32).toString('hex');
}
export async function saveSessionCredentials(
  directory: string,
  token: string,
  port: number,
) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const directoryInfo = await lstat(directory);
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink())
    throw new Error('Session directory must be a real directory.');
  const path = join(directory, 'session.json');
  // Atomic replacement never follows an existing session-file symlink and keeps tokens private from creation.
  const temporaryPath = join(
    directory,
    `.session-${randomBytes(12).toString('hex')}.tmp`,
  );
  const credentials = sessionFileSchema.parse({
    protocolVersion: PROTOCOL_VERSION,
    token,
    port,
    pid: process.pid,
  });
  const file = await open(temporaryPath, 'wx', 0o600);
  try {
    try {
      await file.writeFile(JSON.stringify(credentials));
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath);
    throw error;
  }
  return async () => {
    try {
      const current = sessionFileSchema.safeParse(
        JSON.parse(await readFile(path, 'utf8')) as unknown,
      );
      if (current.success && current.data.token === token) await unlink(path);
    } catch (error) {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ))
        throw error;
    }
  };
}
