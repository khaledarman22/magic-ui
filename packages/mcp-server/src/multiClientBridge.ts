import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { BridgeServer } from './bridgeServer.js';
import {
  commandPermissions,
  hubMessageSchema,
  MAX_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  REQUEST_TIMEOUT_MS,
  MagicUiError,
  failure,
  type BridgeConnection,
  type Command,
  type HubMessage,
} from '@magic-ui/shared';

type Pending = { finish: (message?: HubMessage, error?: Error) => void };
export class MultiClientBridge implements BridgeConnection {
  private operation = new AsyncLocalStorage<{
    connection: BridgeServer | WebSocket;
  }>();
  private hub: BridgeServer | undefined;
  private peer: WebSocket | undefined;
  private pending = new Map<string, Pending>();
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private electing: Promise<number> | undefined;
  private port: number;
  constructor(
    private options: {
      token: string;
      port: number;
      readOnly?: boolean;
      onHub?: (port: number) => Promise<void>;
    },
  ) {
    this.port = options.port;
  }
  get readOnly() {
    return this.options.readOnly ?? false;
  }
  get role() {
    return this.hub
      ? 'hub'
      : this.peer?.readyState === WebSocket.OPEN
        ? 'client'
        : 'reconnecting';
  }
  async start() {
    this.stopped = false;
    return this.elect();
  }
  private elect(): Promise<number> {
    if (this.electing) return this.electing;
    this.electing = this.chooseRole().finally(() => {
      this.electing = undefined;
    });
    return this.electing;
  }
  private async chooseRole() {
    const candidate = new BridgeServer({
      token: this.options.token,
      port: this.port,
    });
    try {
      const port = await candidate.start();
      if (this.stopped) {
        await candidate.close();
        throw this.disconnected();
      }
      this.hub = candidate;
      this.port = port;
      await this.options.onHub?.(port);
      return port;
    } catch (error) {
      await candidate.close();
      if (this.hub === candidate) this.hub = undefined;
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'EADDRINUSE'
      ))
        throw error;
    }
    await this.connectPeer();
    return this.port;
  }
  private disconnected() {
    return new MagicUiError(
      failure(
        'NOT_CONNECTED',
        'Hub connection lost. In-flight work is not replayed; a write may have completed. Inspect Figma before retrying.',
      ),
    );
  }
  private reconnect() {
    if (this.stopped || this.timer) return;
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        if (this.stopped) return;
        void this.elect().catch(() => this.reconnect());
      },
      200 + Math.floor(Math.random() * 200),
    );
    this.timer.unref();
  }
  private async connectPeer() {
    const socket = new WebSocket(`ws://127.0.0.1:${this.port}/peer`, {
      maxPayload: MAX_MESSAGE_BYTES,
    });
    this.peer = socket;
    socket.on('error', () => socket.terminate());
    socket.on('message', (raw, binary) => {
      try {
        if (binary) throw new Error();
        const message = hubMessageSchema.parse(
          JSON.parse(raw.toString()) as unknown,
        );
        this.pending.get(message.correlationId)?.finish(message);
      } catch {
        socket.close(1008, 'INVALID_MESSAGE');
      }
    });
    socket.on('close', () => {
      if (this.peer !== socket) return;
      this.peer = undefined;
      for (const entry of [...this.pending.values()])
        entry.finish(undefined, this.disconnected());
      this.reconnect();
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.terminate();
        reject(this.disconnected());
      }, 3000);
      socket.once('open', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once('error', () => {
        clearTimeout(timer);
        reject(this.disconnected());
      });
      socket.once('close', () => {
        clearTimeout(timer);
        reject(this.disconnected());
      });
    });
    const response = await this.exchange({
      protocolVersion: PROTOCOL_VERSION,
      correlationId: randomUUID(),
      type: 'peerAuth',
      token: this.options.token,
      readOnly: this.readOnly,
    });
    if (response.type !== 'peerReady') {
      socket.terminate();
      throw this.disconnected();
    }
  }
  private exchange(
    message: HubMessage,
    signal?: AbortSignal,
  ): Promise<HubMessage> {
    const socket = this.peer;
    if (!socket || socket.readyState !== WebSocket.OPEN)
      return Promise.reject(this.disconnected());
    if (signal?.aborted)
      return Promise.reject(
        new MagicUiError(failure('CANCELLED', 'Request cancelled.')),
      );
    const data = JSON.stringify(message);
    if (Buffer.byteLength(data) > MAX_MESSAGE_BYTES)
      return Promise.reject(
        new MagicUiError(
          failure('MESSAGE_TOO_LARGE', 'Hub request exceeds message limit.'),
        ),
      );
    return new Promise((resolve, reject) => {
      const cancel = () => {
        if (socket.readyState === WebSocket.OPEN)
          socket.send(
            JSON.stringify({
              protocolVersion: PROTOCOL_VERSION,
              type: 'abort',
              correlationId: message.correlationId,
            }),
          );
      };
      const onAbort = () => {
        cancel();
        finish(
          undefined,
          new MagicUiError(
            failure(
              'CANCELLED',
              'Request cancelled; inspect Figma before retrying.',
            ),
          ),
        );
      };
      const timer = setTimeout(() => {
        cancel();
        finish(
          undefined,
          new MagicUiError(
            failure(
              'TIMEOUT',
              'Hub timed out; request is not replayed. Inspect Figma before retrying.',
            ),
          ),
        );
      }, REQUEST_TIMEOUT_MS + 2000);
      const finish = (response?: HubMessage, error?: Error) => {
        if (!this.pending.delete(message.correlationId)) return;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (error) reject(error);
        else if (response?.type === 'failure')
          reject(new MagicUiError(response.error));
        else if (response) resolve(response);
      };
      this.pending.set(message.correlationId, { finish });
      signal?.addEventListener('abort', onAbort, { once: true });
      socket.send(data);
    });
  }
  async withWriteLock<T>(action: () => Promise<T>): Promise<T> {
    if (this.readOnly)
      throw new MagicUiError(
        failure('PERMISSION_DENIED', 'This client is read-only.'),
      );
    if (this.hub) {
      const hub = this.hub;
      return hub.withWriteLock(() =>
        this.operation.run({ connection: hub }, action),
      );
    }
    const socket = this.peer;
    const acquired = await this.exchange({
      protocolVersion: PROTOCOL_VERSION,
      correlationId: randomUUID(),
      type: 'acquireWrite',
    }).catch((error: unknown) => {
      // A missing acknowledgement may have left a lease on the hub. Closing
      // this peer releases only its own lease before a later reconnect.
      if (!(
        error instanceof MagicUiError &&
        ['SESSION_BUSY', 'PERMISSION_DENIED'].includes(error.error.code)
      ))
        socket?.terminate();
      throw error;
    });
    if (!socket || acquired.type !== 'lockResult') throw this.disconnected();
    try {
      return await this.operation.run({ connection: socket }, action);
    } finally {
      if (this.peer === socket && socket?.readyState === WebSocket.OPEN)
        await this.exchange({
          protocolVersion: PROTOCOL_VERSION,
          correlationId: randomUUID(),
          type: 'releaseWrite',
        }).catch(() => socket.terminate());
    }
  }
  async listSessions() {
    if (this.hub) return this.hub.listSessions();
    const message = await this.exchange({
      protocolVersion: PROTOCOL_VERSION,
      correlationId: randomUUID(),
      type: 'sessions',
    });
    if (message.type !== 'sessionsResult') throw this.disconnected();
    return message.result;
  }
  async status() {
    const { sessions } = await this.listSessions();
    const only = sessions.length === 1 ? sessions[0] : undefined;
    return {
      connected: sessions.length > 0,
      sessionId: only?.sessionId ?? null,
      document: only?.document ?? null,
    };
  }
  async request(
    sessionId: string,
    command: Command,
    signal?: AbortSignal,
    correlationId: string = randomUUID(),
  ) {
    const operation = this.operation.getStore();
    if (operation && operation.connection !== (this.hub ?? this.peer))
      throw this.disconnected();
    if (this.readOnly && commandPermissions[command.command] !== 'read')
      throw new MagicUiError(
        failure('PERMISSION_DENIED', 'This client is read-only.'),
      );
    if (this.hub)
      return this.hub.request(
        sessionId,
        command,
        signal,
        correlationId,
        this.readOnly,
      );
    const response = await this.exchange(
      {
        protocolVersion: PROTOCOL_VERSION,
        correlationId,
        type: 'request',
        sessionId,
        command,
      },
      signal,
    );
    if (
      response.type !== 'response' ||
      response.result.command !== command.command
    )
      throw this.disconnected();
    return response.result;
  }
  async close() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.timer = undefined;
    for (const entry of [...this.pending.values()])
      entry.finish(undefined, this.disconnected());
    this.peer?.terminate();
    this.peer = undefined;
    await this.electing?.catch(() => {});
    await this.hub?.close();
    this.hub = undefined;
  }
}
