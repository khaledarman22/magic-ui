import { randomBytes, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  mkdir,
  open,
  rename,
  unlink,
  link,
  lstat,
  readdir,
} from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { PROTOCOL_VERSION, sessionFileSchema } from '@magic-ui/shared';

export function generateSessionToken() {
  return randomBytes(32).toString('hex');
}
function hasCode(error: unknown, code: string) {
  return error instanceof Error && 'code' in error && error.code === code;
}
async function ensureDirectory(directory: string) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error('Session directory must be a real directory.');
  if ((info.mode & 0o777) !== 0o700 || info.uid !== process.getuid?.())
    throw new Error(
      'Session directory must be owned by this user with mode 0700.',
    );
}
export async function readSessionCredentials(directory: string) {
  const file = await open(
    join(directory, 'session.json'),
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const info = await file.stat();
    if (
      !info.isFile() ||
      info.size > 4096 ||
      (info.mode & 0o777) !== 0o600 ||
      info.uid !== process.getuid?.()
    )
      throw new Error(
        'Credentials must be a private regular file owned by this user (0600).',
      );
    return sessionFileSchema.parse(
      JSON.parse(await file.readFile('utf8')) as unknown,
    );
  } finally {
    await file.close();
  }
}
async function writeCredentials(
  directory: string,
  token: string,
  port: number,
  replace: boolean,
) {
  const temporary = join(directory, `.session-${randomUUID()}.tmp`);
  const file = await open(temporary, 'wx', 0o600);
  try {
    try {
      await file.writeFile(
        JSON.stringify(
          sessionFileSchema.parse({
            protocolVersion: PROTOCOL_VERSION,
            token,
            port,
            pid: process.pid,
          }),
        ),
      );
      await file.sync();
    } finally {
      await file.close();
    }
    if (replace) await rename(temporary, join(directory, 'session.json'));
    else await link(temporary, join(directory, 'session.json')); // Atomic publication: competing creators never observe partial JSON.
  } finally {
    await unlink(temporary).catch((error: unknown) => {
      if (!hasCode(error, 'ENOENT')) throw error;
    });
  }
}
export async function loadOrCreateSessionCredentials(
  directory: string,
  port: number,
) {
  await ensureDirectory(directory);
  try {
    return await readSessionCredentials(directory);
  } catch (error) {
    if (!hasCode(error, 'ENOENT')) throw error;
  }
  try {
    await writeCredentials(directory, generateSessionToken(), port, false);
  } catch (error) {
    if (!hasCode(error, 'EEXIST')) throw error;
  }
  return readSessionCredentials(directory);
}
export async function recordHub(
  directory: string,
  token: string,
  port: number,
) {
  const current = await readSessionCredentials(directory);
  if (current.token !== token)
    throw new Error('Credentials changed while starting. Restart this client.');
  await writeCredentials(directory, token, port, true);
}
// Instance leases include a PID and unique suffix; only our own lease is removed on shutdown.
export async function acquireInstanceLease(directory: string) {
  await ensureDirectory(directory);
  const path = join(directory, `instance-${process.pid}-${randomUUID()}.lease`);
  const file = await open(path, 'wx', 0o600);
  await file.close();
  try {
    await lstat(join(directory, 'rotate.lock'));
    throw new Error('Token rotation is in progress; retry after it completes.');
  } catch (error) {
    if (!hasCode(error, 'ENOENT')) {
      await unlink(path);
      throw error;
    }
  }
  return async () => {
    await unlink(path).catch((error: unknown) => {
      if (!hasCode(error, 'ENOENT')) throw error;
    });
  };
}
export async function rotateSessionToken(directory: string) {
  await ensureDirectory(directory);
  const lock = join(directory, 'rotate.lock');
  const file = await open(lock, 'wx', 0o600);
  const listener = createServer();
  try {
    await file.writeFile(String(process.pid));
    await file.close();
    for (const name of await readdir(directory)) {
      const match = /^instance-(\d+)-[\da-f-]+\.lease$/.exec(name);
      if (!match) continue;
      try {
        process.kill(Number(match[1]), 0);
      } catch (error) {
        if (hasCode(error, 'ESRCH')) continue;
        throw error;
      }
      throw new Error('Stop all Magic UI instances before rotating the token.');
    }
    const current = await readSessionCredentials(directory);
    await new Promise<void>((resolve, reject) => {
      listener.once('error', reject);
      listener.listen(current.port, '127.0.0.1', resolve);
    });
    await writeCredentials(
      directory,
      generateSessionToken(),
      current.port,
      true,
    );
  } finally {
    await file.close();
    if (listener.listening)
      await new Promise<void>((resolve) => listener.close(() => resolve()));
    await unlink(lock);
  }
}
