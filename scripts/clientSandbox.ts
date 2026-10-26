// Test harness utility: reserve a separate OpenCode service port for disposable HOME runs.
import { createServer } from 'node:net';
import { spawnSync } from 'node:child_process';
export async function isolateOpenCodeService(
  env: NodeJS.ProcessEnv,
  cwd: string,
) {
  const listener = createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const address = listener.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing test port.');
  await new Promise<void>((resolve, reject) =>
    listener.close((error) => (error ? reject(error) : resolve())),
  );
  const help = spawnSync('opencode', ['service', 'set', '--help'], {
    env,
    cwd,
    encoding: 'utf8',
    timeout: 5000,
  });
  if (help.status !== 0 || !help.stdout.includes('<key>'))
    throw new Error('OpenCode service sandbox configuration unavailable.');
  const configured = spawnSync(
    'opencode',
    ['service', 'set', 'port', String(address.port)],
    { env, cwd, encoding: 'utf8', timeout: 5000 },
  );
  if (configured.status !== 0)
    throw new Error('Unable to isolate the OpenCode sandbox service port.');
  return () => {
    const stopped = spawnSync('opencode', ['service', 'stop'], {
      env,
      cwd,
      encoding: 'utf8',
      timeout: 10000,
    });
    if (stopped.status !== 0)
      throw new Error(
        'Temporary OpenCode service could not be stopped; retain sandbox for inspection.',
      );
  };
}
