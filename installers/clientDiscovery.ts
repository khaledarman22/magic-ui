import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { ArtifactInstallResult } from './agentArtifacts.ts';

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
/** Local introspection only: no model prompt, inference, or design mutation. */
export async function inspectClientDiscovery(
  client: 'claude' | 'codex' | 'opencode',
  root: string,
  skillNames: string[],
): Promise<ArtifactInstallResult> {
  const missing: ArtifactInstallResult = {
    item: 'runtime discovery',
    state: 'Requires User Action',
    detail:
      'Open/reload the client and inspect skills and agent permissions. No automated discovery result is claimed.',
  };
  if (client === 'claude') return missing;
  if (client === 'opencode') {
    const help = spawnSync(client, ['debug', '--help'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 5000,
    });
    if (help.status !== 0 || !help.stdout.includes('agents')) return missing;
    const list = () =>
      spawnSync(client, ['debug', 'agents'], {
        cwd: root,
        encoding: 'utf8',
        timeout: 25000,
        maxBuffer: 4 * 1024 * 1024,
      });
    let result = list();
    let agents: unknown;
    try {
      agents = JSON.parse(result.stdout) as unknown;
      // OpenCode 2.1.4 returns [] while a newly started service warms its catalog.
      // One bounded retry is read-only; a non-empty mismatched catalog is preserved.
      if (result.status === 0 && Array.isArray(agents) && agents.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        result = list();
        agents = JSON.parse(result.stdout) as unknown;
      }
    } catch {
      /* No successful discovery without valid JSON. */
    }
    const catalog = Array.isArray(agents) ? agents : [];
    if (
      result.status === 0 &&
      ['design-agent', 'figma-reader-agent', 'validation-agent'].every((name) =>
        catalog.some((agent: unknown) => object(agent).id === name),
      )
    )
      return {
        item: 'agent discovery',
        state: 'Passed',
        detail:
          'Installed OpenCode CLI lists all three Magic UI agents. Runtime skill/tool availability still needs interactive verification.',
      };
    return {
      ...missing,
      detail: `OpenCode agent introspection did not confirm expected IDs (exit ${result.status ?? result.error?.name ?? 'signal'}). Reload and inspect the catalog; no successful discovery is claimed.`,
    };
  }

  return new Promise((resolve) => {
    const child = spawn(client, ['app-server', '--stdio'], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let finished = false;
    const lines = createInterface({ input: child.stdout });
    const finish = (result: ArtifactInstallResult) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      lines.close();
      child.stdin.end();
      child.kill();
      resolve(result);
    };
    const timer = setTimeout(() => finish(missing), 10000);
    child.stderr.on('data', () => {}); // Client logs may contain private paths/configuration.
    child.on('error', () => finish(missing));
    child.on('exit', () => finish(missing));
    lines.on('line', (line) => {
      try {
        const message = object(JSON.parse(line) as unknown);
        if (message.error) {
          finish(missing);
          return;
        }
        if (message.id === 1) {
          child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
          child.stdin.write(
            JSON.stringify({
              id: 2,
              method: 'skills/list',
              params: { cwds: [root], forceReload: true },
            }) + '\n',
          );
        } else if (message.id === 2) {
          const data = object(message.result).data;
          const skills = Array.isArray(data)
            ? data.flatMap((entry) => {
                const list = object(entry).skills;
                return Array.isArray(list) ? list : [];
              })
            : [];
          const names = new Set(
            skills
              .filter((skill) => object(skill).enabled !== false)
              .map((skill) => object(skill).name),
          );
          finish(
            skillNames.every((name) => names.has(name))
              ? {
                  item: 'skill discovery',
                  state: 'Passed',
                  detail: `Codex app-server skills/list discovered ${skillNames.length} Magic UI skill names without a model call. Reader isolation still needs runtime verification.`,
                }
              : missing,
          );
        }
      } catch {
        finish(missing);
      }
    });
    child.stdin.on('error', () => finish(missing));
    child.stdin.write(
      JSON.stringify({
        id: 1,
        method: 'initialize',
        params: {
          clientInfo: {
            name: 'magic-ui-setup-discovery',
            title: null,
            version: '0.1.0',
          },
          capabilities: { experimentalApi: true },
        },
      }) + '\n',
    );
  });
}
