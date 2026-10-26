import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { randomBytes } from 'node:crypto';
import { BridgeServer } from '../packages/mcp-server/src/bridgeServer.js';
import { MAX_MESSAGE_BYTES } from '../packages/shared/src/index.js';

it('production server imports no shell API and Plugin source has no dynamic code execution', async () => {
  for (const root of ['packages/mcp-server/src', 'packages/plugin/src']) {
    for (const name of await readdir(root)) {
      if (!/\.tsx?$/.test(name)) continue;
      const text = await readFile(join(root, name), 'utf8');
      if (root.includes('mcp-server'))
        expect(text).not.toMatch(/(?:node:)?child_process|shell\s*:\s*true/);
      else {
        const source = ts.createSourceFile(
          name,
          text,
          ts.ScriptTarget.Latest,
          true,
        );
        const visit = (node: ts.Node) => {
          if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
            const expression = node.expression;
            const called = ts.isIdentifier(expression)
              ? expression.text
              : ts.isPropertyAccessExpression(expression)
                ? expression.name.text
                : '';
            expect(
              ['eval', 'Function'],
              `${name}: dynamic execution`,
            ).not.toContain(called);
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
    }
  }
  const bundle = await readFile('packages/plugin/dist/main.js', 'utf8');
  expect(bundle).not.toMatch(/\beval\s*\(|\bnew\s+Function\s*\(/);
});

it('closes oversized and malformed messages at the real WebSocket boundary', async () => {
  const bridge = new BridgeServer({
    token: randomBytes(32).toString('hex'),
    port: 0,
  });
  const port = await bridge.start();
  try {
    for (const payload of [
      '{broken',
      JSON.stringify({ type: 'unknown' }),
      'x'.repeat(MAX_MESSAGE_BYTES + 1),
    ]) {
      const socket = new WebSocket(`ws://127.0.0.1:${port}`, {
        origin: 'null',
      });
      socket.on('error', () => {});
      const closed = new Promise<number>((accept) =>
        socket.once('close', accept),
      );
      await new Promise<void>((accept, reject) => {
        socket.once('open', accept);
        socket.once('error', reject);
      });
      socket.send(payload);
      expect([1008, 1009, 1006]).toContain(await closed);
      expect(bridge.listSessions().sessions).toHaveLength(0);
    }
  } finally {
    await bridge.close();
  }
});
