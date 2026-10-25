import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { build as bundle } from 'esbuild';
import { build as viteBuild } from 'vite';
import { DEFAULT_BRIDGE_PORT, portSchema } from '@magic-ui/shared';

const port = portSchema.parse(
  process.env.MAGIC_UI_BRIDGE_PORT ?? DEFAULT_BRIDGE_PORT,
);
await mkdir('dist', { recursive: true });
await bundle({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  format: 'iife',
  target: 'es2017',
  // Figma's sandbox scans even comments for import expressions.
  minify: true,
  legalComments: 'none',
});
const result = await viteBuild({
  configFile: false,
  define: { __BRIDGE_PORT__: JSON.stringify(port) },
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: {
    write: false,
    target: 'es2020',
    minify: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/ui.tsx',
      name: 'MagicUiPlugin',
      formats: ['iife'],
      fileName: () => 'ui.js',
    },
  },
});
const output = Array.isArray(result) ? result[0] : result;
if (!output || !('output' in output))
  throw new Error('Expected one UI build output.');
const script = output.output.find((item) => item.type === 'chunk');
const css = output.output
  .flatMap((item) =>
    item.type === 'asset' && item.fileName.endsWith('.css')
      ? [item.source]
      : [],
  )
  .join('\n');
if (!script) throw new Error('Missing UI bundle.');
await writeFile('dist/ui.js', script.code);
await writeFile(
  'dist/ui.html',
  `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="app"></div><script>${script.code.replace(/<\/script/gi, '<\\/script')}</script></body></html>`,
);
const manifest: unknown = JSON.parse(await readFile('manifest.json', 'utf8'));
if (typeof manifest !== 'object' || !manifest)
  throw new Error('Invalid manifest.');
await writeFile(
  'dist/manifest.json',
  JSON.stringify(
    {
      ...manifest,
      networkAccess: {
        allowedDomains: ['none'],
        devAllowedDomains: [`ws://localhost:${port}`],
      },
    },
    null,
    2,
  ),
);
process.stdout.write(
  `Plugin built for loopback port ${port}: manifest.json, main.js, ui.js, ui.html\n`,
);
