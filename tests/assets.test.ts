import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  realpath,
  writeFile,
  mkdir,
  rm,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AssetRegistry,
  inspectAsset,
} from '../packages/mcp-server/src/assetRegistry.js';
import { DesignWorkspace } from '../packages/mcp-server/src/designWorkspace.js';
import { sanitizeSvg, sha256 } from '../packages/shared/src/index.js';
const svg =
  '<svg width="24" height="24"><path d="M0 0 L24 24" stroke="black"/></svg>';
it('SHA-256 matches Node for empty, short and multi-block binary data', () => {
  for (const bytes of [
    Buffer.alloc(0),
    Buffer.from('abc'),
    Buffer.from(Array.from({ length: 20001 }, (_, i) => i % 256)),
  ])
    expect(sha256(bytes)).toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
});
it('sanitizer reconstructs allowed SVG without scripts, CSS, events or external references', () => {
  const result = sanitizeSvg(
    '<svg width="24" height="24" xmlns:xlink="http://www.w3.org/1999/xlink"><script>alert(1)</script><path d="M0 0" xlink:href="https://evil.test/x" onclick="alert(1)" fill="url(https://evil.test/a)"/></svg>',
  );
  expect(result).not.toMatch(/script|href|onclick|url\(/);
  expect(result).toContain('d="M0 0"');
  expect(sanitizeSvg(result)).toBe(result);
  for (const bad of [
    '<!DOCTYPE svg><svg/>',
    '<svg><foreignObject/></svg>',
    '<svg><g></svg>',
    '<svg/><svg/>',
    '<svg width=24/>',
  ])
    expect(() => sanitizeSvg(bad)).toThrow();
});
it('validates real content, dimensions, dedup, traversal, symlinks, changed files and metadata', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'magic-ui-assets-')),
  );
  try {
    const workspace = new DesignWorkspace(root);
    const project = await workspace.initialize({
      projectId: 'assets',
      projectName: 'Assets',
    });
    const registry = new AssetRegistry(workspace);
    await mkdir(join(project.directory, 'images'));
    await writeFile(join(project.directory, 'images/a.svg'), svg);
    await writeFile(join(project.directory, 'images/b.svg'), svg);
    const input = {
      projectId: 'assets',
      path: 'images/a.svg',
      name: 'Icon',
      source: 'test fixture',
      license: 'CC0',
    };
    const a = await registry.register(input),
      b = await registry.register({
        ...input,
        path: 'images/b.svg',
        name: 'Other name',
      });
    expect(b.id).toBe(a.id);
    expect((await registry.read('assets')).assets).toHaveLength(1);
    expect(a).toMatchObject({
      mime: 'image/svg+xml',
      width: 24,
      height: 24,
      optimization: 'original',
    });
    await writeFile(join(project.directory, 'images/fake.png'), 'not an image');
    await expect(
      registry.register({ ...input, path: 'images/fake.png' }),
    ).rejects.toThrow();
    await expect(
      registry.register({ ...input, path: '../outside.png' }),
    ).rejects.toThrow();
    await symlink(
      join(project.directory, 'images/a.svg'),
      join(project.directory, 'link.svg'),
    );
    await expect(
      registry.register({ ...input, path: 'link.svg' }),
    ).rejects.toThrow();
    await writeFile(join(project.directory, b.path), svg.replace('24', '25'));
    await expect(registry.resolve('assets', [a.id])).rejects.toThrow('changed');
    expect(() =>
      inspectAsset(Buffer.from('<svg width="99999" height="1"/>')),
    ).toThrow();
    expect(
      (await registry.resolve('assets', ['future-image']))[0]!.hash,
    ).toBeNull();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
