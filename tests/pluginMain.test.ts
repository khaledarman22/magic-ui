import { runInNewContext } from 'node:vm';
import { buildSync } from 'esbuild';
import { beforeEach, expect, it, vi } from 'vitest';
import {
  envelope,
  mainToUiSchema,
  type MainToUi,
} from '../packages/shared/src/index.js';

const bundle = buildSync({
  entryPoints: ['packages/plugin/src/main.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2017',
  minify: true,
  legalComments: 'none',
  write: false,
}).outputFiles[0]!.text;
const node = {
  id: '1:2',
  name: 'Existing frame',
  type: 'FRAME',
  parent: { id: '0:1' },
  x: 1,
  y: 2,
  width: 30,
  height: 40,
};
let replies: MainToUi[];
let figmaHarness: ReturnType<typeof createHarness>;
function createHarness() {
  return {
    root: { name: 'Test document' },
    currentPage: { id: '0:1', name: 'Page 1' },
    showUI: vi.fn(),
    ui: {
      postMessage: (message: unknown) =>
        replies.push(mainToUiSchema.parse(message)),
      onmessage: async (_message: unknown) => {},
    },
    clientStorage: {
      getAsync: vi.fn(async () => null),
      setAsync: vi.fn(async () => {}),
    },
    createFrame: vi.fn(() => {
      const frame = {
        ...node,
        resize: (width: number, height: number) => {
          frame.width = width;
          frame.height = height;
        },
      };
      return frame;
    }),
    getNodeByIdAsync: vi.fn(
      async (_id: string): Promise<typeof node | null> => node,
    ),
  };
}
beforeEach(async () => {
  replies = [];
  figmaHarness = createHarness();
  runInNewContext(
    bundle,
    {
      figma: figmaHarness,
      __html__: '<html></html>',
      console,
    },
    { contextCodeGeneration: { strings: false, wasm: false } },
  );
  await figmaHarness.ui.onmessage({
    kind: 'bridge',
    message: envelope('ready', 'session', 'auth', {
      heartbeatIntervalMs: 5000,
      readOnly: false,
    }),
  });
});
it('runs the bundled Main without DOM/network and creates the exact requested frame', async () => {
  await figmaHarness.ui.onmessage({
    kind: 'bridge',
    message: envelope('command', 'session', 'create', {
      command: 'createFrame',
      input: {
        pageId: '0:1',
        name: 'Created frame',
        width: 400,
        height: 300,
        x: 12,
        y: 34,
      },
    }),
  });
  expect(figmaHarness.createFrame).toHaveBeenCalledOnce();
  expect(replies.at(-1)).toMatchObject({
    kind: 'bridge',
    message: {
      type: 'result',
      correlationId: 'create',
      payload: {
        command: 'createFrame',
        result: {
          nodeId: '1:2',
          name: 'Created frame',
          type: 'FRAME',
          width: 400,
          height: 300,
          x: 12,
          y: 34,
        },
      },
    },
  });
});
it('refuses a changed page before writing', async () => {
  await figmaHarness.ui.onmessage({
    kind: 'bridge',
    message: envelope('command', 'session', 'create', {
      command: 'createFrame',
      input: {
        pageId: 'another-page',
        name: 'Frame',
        width: 400,
        height: 300,
        x: 0,
        y: 0,
      },
    }),
  });
  expect(figmaHarness.createFrame).not.toHaveBeenCalled();
  expect(replies.at(-1)).toMatchObject({
    kind: 'bridge',
    message: { type: 'error', payload: { code: 'PAGE_CHANGED' } },
  });
});
it('returns real node geometry and a structured not-found error', async () => {
  const message = {
    kind: 'bridge',
    message: envelope('command', 'session', 'read', {
      command: 'readNode',
      input: { nodeId: '1:2' },
    }),
  };
  await figmaHarness.ui.onmessage(message);
  expect(replies.at(-1)).toMatchObject({
    kind: 'bridge',
    message: {
      type: 'result',
      payload: { result: { nodeId: '1:2', width: 30 } },
    },
  });
  figmaHarness.getNodeByIdAsync.mockResolvedValue(null);
  await figmaHarness.ui.onmessage(message);
  expect(replies.at(-1)).toMatchObject({
    kind: 'bridge',
    message: { type: 'error', payload: { code: 'NODE_NOT_FOUND' } },
  });
});
it('honors cancellation while an asynchronous read is pending', async () => {
  let resolveRead: ((value: typeof node) => void) | undefined;
  figmaHarness.getNodeByIdAsync.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveRead = resolve;
      }),
  );
  const pending = figmaHarness.ui.onmessage({
    kind: 'bridge',
    message: envelope('command', 'session', 'read', {
      command: 'readNode',
      input: { nodeId: '1:2' },
    }),
  });
  await figmaHarness.ui.onmessage({
    kind: 'bridge',
    message: envelope('cancel', 'session', 'read', {}),
  });
  resolveRead!(node);
  await pending;
  expect(replies.at(-1)).toMatchObject({
    kind: 'bridge',
    message: { type: 'error', payload: { code: 'CANCELLED' } },
  });
});
it('validates local messages and handles storage failures without leaking credentials', async () => {
  await figmaHarness.ui.onmessage({
    kind: 'saveToken',
    correlationId: 'invalid',
    token: 'short',
  });
  expect(figmaHarness.clientStorage.setAsync).not.toHaveBeenCalled();
  figmaHarness.clientStorage.setAsync.mockRejectedValue(
    new Error('private diagnostic'),
  );
  await figmaHarness.ui.onmessage({
    kind: 'saveToken',
    correlationId: 'save',
    token: 'a'.repeat(64),
  });
  expect(replies.at(-1)).toMatchObject({
    kind: 'localError',
    correlationId: 'save',
  });
  expect(JSON.stringify(replies)).not.toContain('private diagnostic');
  expect(JSON.stringify(replies)).not.toContain('a'.repeat(64));
});

it('does not ship import expressions, including comments rejected by the Figma sandbox', () => {
  expect(bundle).not.toMatch(/\bimport\s*\(/);
});

it('replaces oversized responses with an explicit size error', async () => {
  figmaHarness.getNodeByIdAsync.mockResolvedValue({
    ...node,
    name: 'x'.repeat(70000),
  });
  await figmaHarness.ui.onmessage({
    kind: 'bridge',
    message: envelope('command', 'session', 'oversize', {
      command: 'readNode',
      input: { nodeId: '1:2' },
    }),
  });
  expect(replies.at(-1)).toMatchObject({
    kind: 'bridge',
    message: {
      type: 'error',
      correlationId: 'oversize',
      payload: { code: 'MESSAGE_TOO_LARGE' },
    },
  });
  expect(Buffer.byteLength(JSON.stringify(replies.at(-1)))).toBeLessThan(65536);
});

it('rejects a write injected into a read-only Main session independently of server enforcement', async () => {
  await figmaHarness.ui.onmessage({
    kind: 'bridge',
    message: envelope('ready', 'readonly', 'auth', {
      heartbeatIntervalMs: 5000,
      readOnly: true,
    }),
  });
  await figmaHarness.ui.onmessage({
    kind: 'bridge',
    message: envelope('command', 'readonly', 'bypass', {
      command: 'createFrame',
      input: {
        pageId: '0:1',
        name: 'Forbidden',
        width: 100,
        height: 100,
        x: 0,
        y: 0,
      },
    }),
  });
  expect(figmaHarness.createFrame).not.toHaveBeenCalled();
  expect(replies.at(-1)).toMatchObject({
    kind: 'bridge',
    message: { type: 'error', payload: { code: 'PERMISSION_DENIED' } },
  });
  await figmaHarness.ui.onmessage({
    kind: 'bridge',
    message: envelope('command', 'readonly', 'read', {
      command: 'readNode',
      input: { nodeId: '1:2' },
    }),
  });
  expect(replies.at(-1)).toMatchObject({
    kind: 'bridge',
    message: { type: 'result' },
  });
});
