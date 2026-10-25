import { createMessageId } from './createMessageId';
import {
  envelope,
  parseMessage,
  REQUEST_TIMEOUT_MS,
  type DocumentInfo,
  type Envelope,
  type UiToMain,
} from '@magic-ui/shared';

export type ConnectionState = {
  phase: 'disconnected' | 'connecting' | 'connected' | 'error';
  message: string;
};
export class PluginConnectionManager {
  private socket: WebSocket | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private watchdog: ReturnType<typeof setInterval> | undefined;
  private attempt = 0;
  private stopped = true;
  private token = '';
  private document: DocumentInfo | undefined;
  private sessionId = '';
  private readonly requests = new Set<string>();
  constructor(
    private readonly url: string,
    private readonly post: (message: UiToMain) => void,
    private readonly onState: (state: ConnectionState) => void,
  ) {}
  connect(token: string, document: DocumentInfo) {
    this.stop();
    this.token = token;
    this.document = document;
    this.stopped = false;
    this.attempt = 0;
    this.open();
  }
  private open() {
    if (this.stopped || !this.document) return;
    this.sessionId = createMessageId();
    this.requests.clear();
    this.onState({
      phase: 'connecting',
      message: 'Connecting to the local server…',
    });
    const socket = new WebSocket(this.url);
    this.socket = socket;
    const sessionId = this.sessionId;
    const authId = createMessageId();
    let lastReceived = Date.now();
    let receiveDeadline = 5000;
    this.watchdog = setInterval(() => {
      if (Date.now() - lastReceived > receiveDeadline) socket.close();
    }, 1000);
    socket.onopen = () => {
      if (this.document)
        socket.send(
          JSON.stringify(
            envelope('auth', sessionId, authId, {
              token: this.token,
              document: this.document,
            }),
          ),
        );
    };
    socket.onmessage = (event: MessageEvent<unknown>) => {
      if (this.socket !== socket) return;
      let message: Envelope;
      try {
        if (typeof event.data !== 'string') throw new Error('Invalid message');
        message = parseMessage(event.data);
      } catch {
        this.block(
          'Server sent an invalid message. Restart the server, then reconnect.',
        );
        return;
      }
      if (message.sessionId !== sessionId) {
        this.block('Session mismatch. Reconnect to select this document.');
        return;
      }
      lastReceived = Date.now();
      if (message.type === 'ready' && message.correlationId === authId) {
        receiveDeadline =
          message.payload.heartbeatIntervalMs * 2 + REQUEST_TIMEOUT_MS;
        this.attempt = 0;
        this.post({ kind: 'bridge', message });
        this.onState({
          phase: 'connected',
          message: 'Connected. Ready for frame commands.',
        });
      } else if (message.type === 'command') {
        this.requests.add(message.correlationId);
        this.post({ kind: 'bridge', message });
      } else if (message.type === 'cancel') {
        this.requests.delete(message.correlationId);
        this.post({ kind: 'bridge', message });
      } else if (message.type === 'error') this.block(message.payload.message);
    };
    socket.onerror = () => {
      /* The close event owns reconnect, avoiding duplicate attempts. */
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      clearInterval(this.watchdog);
      this.requests.clear();
      if (this.stopped) return;
      if (event.code === 1008) {
        this.block(
          'Connection rejected. Check the token and close any other Magic UI plugin, then reconnect.',
        );
        return;
      }
      const delay = Math.min(500 * 2 ** this.attempt++, 10000);
      this.onState({
        phase: 'disconnected',
        message: 'Server unavailable. Reconnecting automatically…',
      });
      this.retryTimer = setTimeout(() => this.open(), delay);
    };
  }
  forward(message: Envelope) {
    if (
      message.sessionId !== this.sessionId ||
      !this.requests.delete(message.correlationId)
    )
      return;
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(message));
  }
  private block(message: string) {
    this.stop();
    this.onState({ phase: 'error', message });
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.watchdog);
    this.requests.clear();
    const socket = this.socket;
    this.socket = undefined;
    socket?.close();
  }
}
