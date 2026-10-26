// Test harness only: no production code imports this module.
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import {
  envelope,
  parseMessage,
  sessionFileSchema,
  failure,
  type Envelope,
  type Command,
  type CommandResult,
  errorSchema,
  type NodeSnapshot,
} from '../packages/shared/src/index.js';

export class FakePluginClient {
  readonly sessionId = randomUUID();
  readonly nodes = new Map<string, NodeSnapshot>();
  readonly received: Envelope[] = [];
  dropCommands = false;
  dropHeartbeat = false;
  socket: WebSocket | undefined;
  constructor(
    readonly url: string,
    readonly token: string,
    private readonly renderHandler?: (
      command: Exclude<
        Command,
        { command: 'ping' | 'createFrame' | 'readNode' }
      >,
    ) => Promise<CommandResult>,
  ) {}
  async connect() {
    const socket = new WebSocket(this.url, { origin: 'null' });
    this.socket = socket;
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.terminate();
        reject(new Error('Harness authentication timed out'));
      }, 3000);
      socket.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      socket.on('close', () => {
        clearTimeout(timeout);
        reject(new Error('Harness disconnected before authentication'));
      });
      socket.on('open', () =>
        socket.send(
          JSON.stringify(
            envelope('auth', this.sessionId, randomUUID(), {
              token: this.token,
              document: {
                name: 'Harness document',
                pageId: '0:1',
                pageName: 'Page 1',
              },
            }),
          ),
        ),
      );
      socket.on('message', (raw) => {
        const message = parseMessage(raw.toString());
        this.received.push(message);
        if (message.type === 'ready') {
          clearTimeout(timeout);
          resolve();
          return;
        }
        if (message.type === 'error') {
          clearTimeout(timeout);
          reject(
            Object.assign(new Error(message.payload.message), {
              code: message.payload.code,
            }),
          );
          return;
        }
        if (message.type !== 'command') return;
        const command = message.payload;
        if (command.command === 'ping') {
          if (!this.dropHeartbeat)
            this.send(
              envelope('result', this.sessionId, message.correlationId, {
                command: 'ping',
                result: { alive: true },
              }),
            );
          return;
        }
        if (this.dropCommands) return;
        if (
          [
            'renderDesign',
            'renderDesignSystem',
            'readComponents',
            'readVariables',
            'readFigma',
            'inspectSync',
            'syncStep',
            'trashNode',
          ].includes(command.command) &&
          command.command !== 'createFrame' &&
          command.command !== 'readNode' &&
          this.renderHandler
        ) {
          void this.renderHandler(command)
            .then((result) =>
              this.send(
                envelope(
                  'result',
                  this.sessionId,
                  message.correlationId,
                  result,
                ),
              ),
            )
            .catch((error: unknown) => {
              const detail = errorSchema.safeParse(
                error && typeof error === 'object' && 'error' in error
                  ? error.error
                  : undefined,
              );
              this.send(
                envelope(
                  'error',
                  this.sessionId,
                  message.correlationId,
                  detail.success
                    ? detail.data
                    : failure('INTERNAL_ERROR', 'Render harness failed.'),
                ),
              );
            });
          return;
        }
        if (command.command === 'createFrame') {
          const { name, width, height, x, y, pageId } = command.input;
          const node = {
            nodeId: `1:${this.nodes.size + 1}`,
            name,
            type: 'FRAME' as const,
            parentId: pageId,
            width,
            height,
            x,
            y,
          };
          this.nodes.set(node.nodeId, node);
          this.send(
            envelope('result', this.sessionId, message.correlationId, {
              command: 'createFrame',
              result: node,
            }),
          );
        } else if (command.command === 'readNode') {
          const node = this.nodes.get(command.input.nodeId);
          this.send(
            node
              ? envelope('result', this.sessionId, message.correlationId, {
                  command: 'readNode',
                  result: node,
                })
              : envelope(
                  'error',
                  this.sessionId,
                  message.correlationId,
                  failure('NODE_NOT_FOUND', 'Harness node does not exist.'),
                ),
          );
        }
      });
    });
  }
  send(message: Envelope) {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(message));
  }
  async disconnect() {
    const socket = this.socket;
    if (!socket || socket.readyState === WebSocket.CLOSED) return;
    await new Promise<void>((resolve) => {
      socket.once('close', () => resolve());
      socket.close();
    });
  }
}

async function runHarness() {
  const credentials = sessionFileSchema.parse(
    JSON.parse(
      await readFile(join(homedir(), '.magic-ui/session.json'), 'utf8'),
    ) as unknown,
  );
  const client = new FakePluginClient(
    `ws://127.0.0.1:${credentials.port}`,
    credentials.token,
  );
  let stopped = false;
  const stop = () => {
    stopped = true;
    void client.disconnect();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  let attempt = 0;
  while (!stopped) {
    try {
      await client.connect();
      attempt = 0;
      process.stderr.write('Test harness connected (no Figma operations).\n');
      await new Promise<void>((resolve) =>
        client.socket?.once('close', () => resolve()),
      );
    } catch {
      process.stderr.write(
        'Test harness could not connect. Check the running server.\n',
      );
    }
    if (!stopped)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(500 * 2 ** attempt++, 10000)),
      );
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void runHarness().catch(() => {
    process.stderr.write('Start the MCP server before the test harness.\n');
    process.exitCode = 1;
  });
