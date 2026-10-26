import { randomUUID, timingSafeEqual } from 'node:crypto';
import { WebSocket } from 'ws';
import {
  hubMessageSchema,
  PROTOCOL_VERSION,
  failure,
  MagicUiError,
  type HubMessage,
} from '@magic-ui/shared';
import type { BridgeServer } from './bridgeServer.js';

export function acceptHubPeer(
  socket: WebSocket,
  token: string,
  bridge: BridgeServer,
) {
  const owner = randomUUID();
  let readOnly: boolean | undefined;
  const active = new Map<string, AbortController>();
  const send = (message: HubMessage) => {
    if (socket.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(message));
  };
  const timer = setTimeout(() => socket.close(1008, 'AUTH_FAILED'), 3000);
  timer.unref();
  socket.on('error', () => socket.terminate());
  socket.on('close', () => {
    clearTimeout(timer);
    for (const controller of active.values()) controller.abort();
    active.clear();
    bridge.releaseWrite(owner);
  });
  socket.on('message', (raw, binary) => {
    let message: HubMessage;
    try {
      if (binary) throw new Error();
      message = hubMessageSchema.parse(JSON.parse(raw.toString()) as unknown);
    } catch {
      socket.close(1008, 'INVALID_MESSAGE');
      return;
    }
    const base = {
      protocolVersion: PROTOCOL_VERSION,
      correlationId: message.correlationId,
    };
    if (readOnly === undefined) {
      if (
        message.type !== 'peerAuth' ||
        !timingSafeEqual(Buffer.from(message.token), Buffer.from(token))
      ) {
        send({
          ...base,
          type: 'failure',
          error: failure('AUTH_FAILED', 'Hub authentication failed.'),
        });
        socket.close(1008, 'AUTH_FAILED');
        return;
      }
      readOnly = message.readOnly;
      clearTimeout(timer);
      send({ ...base, type: 'peerReady' });
      return;
    }
    if (message.type === 'acquireWrite' || message.type === 'releaseWrite') {
      try {
        if (message.type === 'acquireWrite') {
          if (readOnly)
            throw new MagicUiError(
              failure('PERMISSION_DENIED', 'This client is read-only.'),
            );
          bridge.acquireWrite(owner);
        } else bridge.releaseWrite(owner);
        send({ ...base, type: 'lockResult' });
      } catch (error) {
        send({
          ...base,
          type: 'failure',
          error:
            error instanceof MagicUiError
              ? error.error
              : failure('INTERNAL_ERROR', 'Lock failed.'),
        });
      }
      return;
    }
    if (message.type === 'sessions') {
      send({ ...base, type: 'sessionsResult', result: bridge.listSessions() });
      return;
    }
    if (message.type === 'abort') {
      active.get(message.correlationId)?.abort();
      return;
    }
    if (
      message.type !== 'request' ||
      active.has(message.correlationId) ||
      active.size >= 128
    ) {
      socket.close(1008, 'INVALID_MESSAGE');
      return;
    }
    const controller = new AbortController();
    active.set(message.correlationId, controller);
    void bridge
      .request(
        message.sessionId,
        message.command,
        controller.signal,
        message.correlationId,
        readOnly,
      )
      .then(
        (result) => send({ ...base, type: 'response', result }),
        (error: unknown) =>
          send({
            ...base,
            type: 'failure',
            error:
              error instanceof MagicUiError
                ? error.error
                : failure(
                    'INTERNAL_ERROR',
                    'Hub command failed; inspect Figma before retrying.',
                  ),
          }),
      )
      .finally(() => active.delete(message.correlationId));
  });
}
