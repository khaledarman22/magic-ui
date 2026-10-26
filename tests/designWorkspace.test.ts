import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { DesignWorkspace } from '../packages/mcp-server/src/designWorkspace.js';
import { sampleSpecification } from './fixtures/sampleSpecification.js';
let root: string;
let workspace: DesignWorkspace;
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'magic-ui-workspace-')));
  workspace = new DesignWorkspace(root);
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
it('creates exactly two files, discovers by stable ID and refuses overwrites', async () => {
  const result = await workspace.initialize({
    projectId: 'phase2-smoke',
    projectName: 'Sample',
  });
  expect(await readdir(result.directory)).toEqual([
    'design-spec.json',
    'project.json',
  ]);
  const original = await readFile(result.specificationPath, 'utf8');
  await expect(
    workspace.initialize({ projectId: 'different', projectName: 'Sample' }),
  ).rejects.toThrow();
  await expect(
    workspace.initialize({ projectId: 'phase2-smoke', projectName: 'Renamed' }),
  ).rejects.toThrow();
  expect(await readFile(result.specificationPath, 'utf8')).toBe(original);
  await writeFile(
    result.specificationPath,
    JSON.stringify(sampleSpecification()),
  );
  expect(await workspace.readSpecification('phase2-smoke')).toEqual(
    sampleSpecification(),
  );
});
it.each(['../x', '/tmp/escape', '..', 'a/b', 'a\\b', '%2e%2e', 'a\u0000b'])(
  'rejects path traversal %s before filesystem access',
  async (value) => {
    await expect(
      workspace.initialize({ projectId: value, projectName: 'Sample' }),
    ).rejects.toThrow();
    await expect(
      workspace.initialize({ projectId: 'sample', projectName: value }),
    ).rejects.toThrow();
    await expect(workspace.readSpecification(value)).rejects.toThrow();
    expect(await readdir(root)).toEqual([]);
  },
);
it('refuses symlink project directories and symlink JSON files', async () => {
  const external = join(root, 'external');
  await mkdir(external);
  await writeFile(
    join(external, 'project.json'),
    JSON.stringify({
      schemaVersion: '1.0.0',
      projectId: 'external',
      projectName: 'External',
    }),
  );
  await symlink(external, join(root, 'Link-Design'));
  await expect(workspace.readSpecification('external')).rejects.toThrow();
  await expect(
    workspace.initialize({ projectId: 'link', projectName: 'Link' }),
  ).rejects.toThrow();
  const project = await workspace.initialize({
    projectId: 'sample',
    projectName: 'Sample',
  });
  await rm(project.specificationPath);
  await writeFile(
    join(root, 'outside.json'),
    JSON.stringify(sampleSpecification()),
  );
  await symlink(join(root, 'outside.json'), project.specificationPath);
  await expect(workspace.readSpecification('sample')).rejects.toThrow();
});
it('rejects mismatched IDs, malformed and oversized files', async () => {
  const project = await workspace.initialize({
    projectId: 'sample',
    projectName: 'Sample',
  });
  await writeFile(
    project.specificationPath,
    JSON.stringify(sampleSpecification()),
  );
  await expect(workspace.readSpecification('sample')).rejects.toMatchObject({
    error: { code: 'INVALID_INPUT' },
  });
  await writeFile(project.specificationPath, '{');
  await expect(workspace.readSpecification('sample')).rejects.toThrow();
  await writeFile(project.specificationPath, ' '.repeat(65537));
  await expect(workspace.readSpecification('sample')).rejects.toMatchObject({
    error: { code: 'MESSAGE_TOO_LARGE' },
  });
});

it('does not race two initializations with the same project identity', async () => {
  const results = await Promise.allSettled([
    workspace.initialize({ projectId: 'same', projectName: 'First' }),
    workspace.initialize({ projectId: 'same', projectName: 'Second' }),
  ]);
  expect(
    results.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(1);
  expect(await readdir(root)).toHaveLength(1);
});
it('persists registry atomically with private permissions and refuses directory/file symlinks', async () => {
  const { stat } = await import('node:fs/promises');
  const project = await workspace.initialize({
    projectId: 'registry',
    projectName: 'Registry',
  });
  const registry = { projectId: 'registry', components: [] };
  expect(await workspace.readRegistry('registry')).toEqual(registry);
  await workspace.writeRegistry(registry);
  await workspace.writeRegistry(registry);
  const directory = join(project.directory, 'design-system'),
    path = join(directory, 'components.json');
  expect(await workspace.readRegistry('registry')).toEqual(registry);
  expect((await stat(path)).mode & 0o777).toBe(0o600);
  expect(await readdir(directory)).toEqual(['components.json']);
  const outside = join(root, 'outside-registry.json');
  await writeFile(outside, 'original');
  await rm(path);
  await symlink(outside, path);
  await expect(workspace.writeRegistry(registry)).rejects.toThrow();
  expect(await readFile(outside, 'utf8')).toBe('original');
  await rm(directory, { recursive: true });
  const outsideDir = join(root, 'outside-directory');
  await mkdir(outsideDir);
  await symlink(outsideDir, directory);
  await expect(workspace.writeRegistry(registry)).rejects.toThrow();
  expect(await readdir(outsideDir)).toEqual([]);
});
