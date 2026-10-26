import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function lintSkills(root: string, tools: Set<string>): string[] {
  const errors: string[] = [];
  const required = [
    'When to use',
    'Inputs',
    'Prerequisites',
    'Steps',
    'Outputs',
    'Validation',
    'Errors',
    'Related skills',
  ];
  const skillsRoot = join(root, 'agent/skills');
  const names = readdirSync(skillsRoot).filter((n) =>
    statSync(join(skillsRoot, n)).isDirectory(),
  );
  if (names.length !== 20)
    errors.push(`Expected 20 skills, found ${names.length}.`);
  const visit = (path: string) => {
    for (const name of readdirSync(path)) {
      const file = join(path, name);
      if (statSync(file).isDirectory()) {
        visit(file);
        continue;
      }
      if (!file.endsWith('.md')) continue;
      const text = readFileSync(file, 'utf8');
      if (name === 'SKILL.md') {
        const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
        if (
          !new RegExp(`^name: ${basename(dirname(file))}$`, 'm').test(
            frontmatter,
          )
        )
          errors.push(`${file}: missing or mismatched name.`);
        const description = /^description: (.+)$/m.exec(frontmatter)?.[1];
        if (!description || description.length > 1024)
          errors.push(`${file}: invalid description.`);
        for (const heading of required)
          if (!text.includes(`## ${heading}\n`))
            errors.push(`${file}: missing ${heading}.`);
      }
      for (const tool of text.matchAll(/\bmagic_ui_[a-zA-Z0-9_]+\b/g))
        if (!tools.has(tool[0]))
          errors.push(`${file}: unknown MCP tool ${tool[0]}.`);
      for (const link of text.matchAll(/\]\(([^)]+)\)/g)) {
        const target = link[1]!;
        if (
          !/^[a-z]+:/.test(target) &&
          !target.startsWith('#') &&
          !existsSync(resolve(dirname(file), target.split('#')[0]!))
        )
          errors.push(`${file}: broken reference ${target}.`);
      }
    }
  };
  visit(skillsRoot);
  visit(join(root, 'agent/workflows'));
  return errors;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const output = execFileSync(
    process.execPath,
    [join(root, 'packages/mcp-server/dist/index.js'), '--selftest'],
    { encoding: 'utf8' },
  );
  const tools = new Set(output.trim().split('\n'));
  const errors = lintSkills(root, tools);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else
    console.log(
      `Passed: 20 skills, required sections, local references and all MCP names checked against --selftest (${tools.size} tools).`,
    );
}
