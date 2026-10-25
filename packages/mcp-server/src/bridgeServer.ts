import { randomUUID, timingSafeEqual } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import {
  HEARTBEAT_INTERVAL_MS,
  MAX_MESSAGE_BYTES,
  REQUEST_TIMEOUT_MS,
  MagicUiError,
  envelope,
  failure,
  parseMessage,
  type Command,
  type CommandResult,
  type DocumentInfo,
  type Envelope,
  type MagicError,
} from '@magic-ui/shared';

type PendingRequest = {
  socket: WebSocket;
  command: Command['command'];
  resolve: (result: CommandResult) => void;
  reject: (error: MagicUiError) => void;
  timer: ReturnType<typeof setTimeout>;
  dispose: () => void;
};
type PluginConnection = {
  socket: WebSocket;
  sessionId: string;
  document: DocumentInfo;
};
export class BridgeServer {
  private server: WebSocketServer | undefined;
  private plugin: PluginConnection | undefined;
  private readonly pending = new Map<string, PendingRequest>();
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  constructor(
    private readonly options: {
      token: string;
      port: number;
      timeoutMs?: number;
      heartbeatMs?: number;
    },
  ) {}
  async start(): Promise<number> {
    const server = new WebSocketServer({
      host: '127.0.0.1',
      port: this.options.port,
      maxPayload: MAX_MESSAGE_BYTES,
      verifyClient: ({ origin }: { origin: string }) =>
        origin === 'null' ||
        origin === 'https://www.figma.com' ||
        origin === 'https://figma.com',
    });
    this.server = server;
    server.on('connection', (socket) => this.accept(socket));
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    // Keep runtime socket errors handled without logging payloads or credentials.
    server.on('error', () => {
      this.plugin?.socket.terminate();
    });
    this.heartbeat = setInterval(() => {
      const current = this.plugin;
      if (!current) return;
      void this.request(current.sessionId, {
        command: 'ping',
        input: {},
      }).catch(() => current.socket.terminate());
    }, this.options.heartbeatMs ?? HEARTBEAT_INTERVAL_MS);
    this.heartbeat.unref();
    const address = server.address();
    if (typeof address !== 'object' || address === null)
      throw new Error('Bridge has no TCP address.');
    return address.port;
  }
  status() {
    return {
      connected: Boolean(this.plugin),
      sessionId: this.plugin?.sessionId ?? null,
      document: this.plugin?.document ?? null,
    };
  }
  private send(socket: WebSocket, message: Envelope) {
    if (socket.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(message));
  }
  private rejectConnection(
    socket: WebSocket,
    message: Envelope,
    error: MagicError,
  ) {
    this.send(
      socket,
      envelope('error', message.sessionId, message.correlationId, error),
    );
    socket.close(1008, error.code);
  }
  private accept(socket: WebSocket) {
    let authenticated = false;
    const authTimer = setTimeout(() => socket.close(1008, 'AUTH_FAILED'), 3000);
    authTimer.unref();
    socket.on('error', () => socket.terminate());
    socket.on('close', () => {
      clearTimeout(authTimer);
      if (this.plugin?.socket === socket) this.plugin = undefined;
    });
    socket.on('message', (raw, binary) => {
      let message: Envelope;
      try {
        if (binary) throw new Error('Binary messages unsupported');
        message = parseMessage(raw.toString());
      } catch {
        socket.close(1008, 'INVALID_MESSAGE');
        return;
      }
      if (!authenticated) {
        if (message.type !== 'auth') {
          this.rejectConnection(
            socket,
            message,
            failure('AUTH_FAILED', 'Authenticate before sending commands.'),
          );
          return;
        }
        const token = Buffer.from(message.payload.token);
        const expected = Buffer.from(this.options.token);
        if (
          token.length !== expected.length ||
          !timingSafeEqual(token, expected)
        ) {
          this.rejectConnection(
            socket,
            message,
            failure(
              'AUTH_FAILED',
              'Session token is incorrect. Copy the current token and reconnect.',
            ),
          );
          return;
        }
        if (this.plugin) {
          this.rejectConnection(
            socket,
            message,
            failure(
              'SESSION_BUSY',
              'One Figma session is already connected. Close it before connecting another.',
            ),
          );
          return;
        }
        authenticated = true;
        clearTimeout(authTimer);
        this.plugin = {
          socket,
          sessionId: message.sessionId,
          document: message.payload.document,
        };
        this.send(
          socket,
          envelope('ready', message.sessionId, message.correlationId, {
            heartbeatIntervalMs:
              this.options.heartbeatMs ?? HEARTBEAT_INTERVAL_MS,
          }),
        );
        return;
      }
      if (
        message.sessionId !== this.plugin?.sessionId ||
        this.plugin.socket !== socket
      ) {
        socket.close(1008, 'SESSION_MISMATCH');
        return;
      }
      if (message.type !== 'result' && message.type !== 'error') {
        socket.close(1008, 'INVALID_MESSAGE');
        return;
      }
      const pending = this.pending.get(message.correlationId);
      if (!pending || pending.socket !== socket) return; // Ignore late replies; never match across connections.
      if (
        message.type === 'result' &&
        pending.command !== message.payload.command
      ) {
        socket.close(1008, 'INVALID_MESSAGE');
        return;
      }
      this.pending.delete(message.correlationId);
      clearTimeout(pending.timer);
      pending.dispose();
      if (message.type === 'error')
        pending.reject(new MagicUiError(message.payload));
      else pending.resolve(message.payload);
    });
  }
  request(
    sessionId: string,
    command: Command,
    signal?: AbortSignal,
  ): Promise<CommandResult> {
    const connection = this.plugin;
    if (!connection)
      return Promise.reject(
        new MagicUiError(
          failure('NOT_CONNECTED', 'Open Magic UI in Figma and connect.', true),
        ),
      );
    if (connection.sessionId !== sessionId)
      return Promise.reject(
        new MagicUiError(
          failure(
            'SESSION_MISMATCH',
            'Choose the current session from connection status.',
          ),
        ),
      );
    if (signal?.aborted)
      return Promise.reject(
        new MagicUiError(failure('CANCELLED', 'Request cancelled.')),
      );
    const correlationId = randomUUID();
    const message = envelope('command', sessionId, correlationId, command);
    if (Buffer.byteLength(JSON.stringify(message), 'utf8') > MAX_MESSAGE_BYTES)
      return Promise.reject(
        new MagicUiError(
          failure(
            'MESSAGE_TOO_LARGE',
            'Render request exceeds the 65536-byte bridge limit. Reduce the specification.',
          ),
        ),
      );
    return new Promise((resolve, reject) => {
      const finishWithError = (error: MagicError) => {
        const pending = this.pending.get(correlationId);
        if (!pending) return;
        this.pending.delete(correlationId);
        clearTimeout(pending.timer);
        pending.dispose();
        this.send(
          connection.socket,
          envelope('cancel', sessionId, correlationId, {}),
        );
        reject(new MagicUiError(error));
      };
      const onAbort = () =>
        finishWithError(
          failure(
            'CANCELLED',
            'Request cancelled; an already completed write cannot be undone.',
          ),
        );
      const timer = setTimeout(
        () =>
          finishWithError(
            failure(
              'TIMEOUT',
              'Plugin response timed out. The write may have completed; inspect Figma before retrying.',
              true,
            ),
          ),
        this.options.timeoutMs ?? REQUEST_TIMEOUT_MS,
      );
      this.pending.set(correlationId, {
        socket: connection.socket,
        command: command.command,
        resolve,
        reject,
        timer,
        dispose: () => signal?.removeEventListener('abort', onAbort),
      });
      signal?.addEventListener('abort', onAbort, { once: true });
      this.send(connection.socket, message);
    });
  }
  async close() {
    clearInterval(this.heartbeat);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.dispose();
      pending.reject(
        new MagicUiError(failure('NOT_CONNECTED', 'Bridge stopped.', true)),
      );
    }
    this.pending.clear();
    this.plugin = undefined;
    const server = this.server;
    if (server) {
      for (const socket of server.clients) socket.terminate();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
}
