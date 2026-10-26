import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, parse, resolve } from 'node:path';

export interface ArtifactInstallResult {
  item: string;
  state: 'Passed' | 'Requires User Action';
  detail: string;
}
function regularParents(path: string, create: boolean) {
  let current = parse(path).root;
  for (const segment of path.slice(current.length).split('/').filter(Boolean)) {
    current = join(current, segment);
    if (!existsSync(current)) {
      // lstat also detects dangling symlinks, which existsSync follows.
      try {
        lstatSync(current);
        throw new Error('Symlink path is not supported.');
      } catch (error) {
        if (!(
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ENOENT'
        ))
          throw error;
      }
      if (create) mkdirSync(current, { mode: 0o700 });
    } else if (
      !lstatSync(current).isDirectory() ||
      lstatSync(current).isSymbolicLink()
    )
      throw new Error('Artifact parent must be a real directory.');
  }
}
export function installAgentArtifacts(options: {
  root: string;
  client: 'claude' | 'codex' | 'opencode';
  verify: boolean;
}): ArtifactInstallResult[] {
  const { root, client, verify } = options;
  const home = homedir();
  const base =
    client === 'claude'
      ? join(home, '.claude')
      : client === 'codex'
        ? (process.env.CODEX_HOME ?? join(home, '.codex'))
        : join(
            process.env.XDG_CONFIG_HOME ?? join(home, '.config'),
            'opencode',
          );
  const skills =
    client === 'codex' ? join(home, '.agents/skills') : join(base, 'skills');
  const results: ArtifactInstallResult[] = [];
  const substitute = (text: string) =>
    text
      .replaceAll('{{RULES_PATH}}', join(root, 'agent/AGENTS.md'))
      .replaceAll('{{WORKFLOWS_PATH}}', join(root, 'agent/workflows'))
      .replaceAll(
        '{{WORKSPACE_PATH}}',
        resolve(process.env.MAGIC_UI_WORKSPACE_ROOT ?? root),
      )
      .replaceAll('(../../AGENTS.md)', `(<${join(root, 'agent/AGENTS.md')}>)`);
  const files = (
    source: string,
    prefix = '',
  ): { relative: string; contents: string }[] =>
    readdirSync(source, { withFileTypes: true }).flatMap((entry) => {
      if (entry.isSymbolicLink())
        throw new Error('Source artifacts cannot be symlinks.');
      const relative = join(prefix, entry.name);
      return entry.isDirectory()
        ? files(join(source, entry.name), relative)
        : [
            {
              relative,
              contents: substitute(
                readFileSync(join(source, entry.name), 'utf8'),
              ),
            },
          ];
    });
  const install = (
    target: string,
    expected: { relative: string; contents: string }[],
    directory: boolean,
  ) => {
    // macOS exposes /var and /tmp as system aliases. Canonicalize only these;
    // user-controlled symlinks elsewhere still cannot redirect installation.
    for (const alias of ['/var', '/tmp'])
      if (target.startsWith(`${alias}/`))
        target = realpathSync(alias) + target.slice(alias.length);
    regularParents(dirname(target), !verify);
    let exists = false;
    try {
      lstatSync(target);
      exists = true;
    } catch (e) {
      if (!(e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT'))
        throw e;
    }
    if (!exists && !verify) {
      if (directory) mkdirSync(target, { mode: 0o700 });
      for (const f of expected) {
        const path = directory ? join(target, f.relative) : target;
        regularParents(dirname(path), true);
        writeFileSync(path, f.contents, { flag: 'wx', mode: 0o600 });
      }
    }
    const matches = expected.every((f) => {
      const path = directory ? join(target, f.relative) : target;
      return (
        existsSync(path) &&
        !lstatSync(path).isSymbolicLink() &&
        lstatSync(path).isFile() &&
        readFileSync(path, 'utf8') === f.contents
      );
    });
    results.push({
      item: target,
      state: matches ? 'Passed' : 'Requires User Action',
      detail: matches
        ? 'Artifact contents verified in the documented discovery location.'
        : 'Missing or different user artifact preserved. Review manually; setup never replaces an existing skill or agent.',
    });
  };
  for (const entry of readdirSync(join(root, 'agent/skills'), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    install(
      join(skills, entry.name),
      files(join(root, 'agent/skills', entry.name)),
      true,
    );
  }
  const source = join(root, 'agent/clients', client);
  for (const entry of readdirSync(source)) {
    // Codex custom subagents cannot isolate MCP. Reader roles are launcher inputs,
    // deliberately excluded from the ordinary inherited-MCP subagent catalog.
    const roles =
      client === 'codex' && entry !== 'design-agent.toml'
        ? 'magic-ui/roles'
        : 'agents';
    const original = readFileSync(join(source, entry), 'utf8');
    let contents: string;
    if (client === 'codex') {
      // Parse our JSON-compatible TOML string values before path substitution,
      // then re-escape for TOML (paths may contain spaces, quotes or backslashes).
      contents = original.replace(
        /^(developer_instructions) = (.+)$/m,
        (_line, key: string, value: string) =>
          `${key} = ${JSON.stringify(substitute(JSON.parse(value) as string))}`,
      );
    } else if (client === 'opencode') {
      const workspace = resolve(
        process.env.MAGIC_UI_WORKSPACE_ROOT ?? root,
      ).replaceAll("'", "''");
      contents = substitute(
        original.replaceAll("'{{WORKSPACE_PATH}}/**'", `'${workspace}/**'`),
      );
    } else contents = substitute(original);
    install(join(base, roles, entry), [{ relative: entry, contents }], false);
  }
  results.push({
    item: 'discovery',
    state: 'Requires User Action',
    detail:
      client === 'codex'
        ? 'Reload skills; use installers/launch-codex-reader.ts for reader/validation. Ordinary Codex subagents inherit parent MCP servers and are not isolated.'
        : 'Reload the client, inspect skills and agent tools; confirm reader has only magic-ui-reader MCP tools. File installation alone is not runtime discovery.',
  });
  return results;
}
