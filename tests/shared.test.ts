import { describe, expect, it } from 'vitest';
import {
  createFrameSchema,
  createFrameToolSchema,
  envelope,
  envelopeSchema,
  parseMessage,
  errorSchema,
  portSchema,
  uiToMainSchema,
} from '../packages/shared/src/index.js';

describe('shared boundary validation', () => {
  it('accepts a frame with finite dimensions and defaults its position', () => {
    expect(
      createFrameSchema.parse({
        pageId: '0:1',
        name: 'Frame',
        width: 400,
        height: 300,
      }),
    ).toMatchObject({ x: 0, y: 0 });
  });
  it.each([-1, 0, Infinity, NaN, 100001])(
    'rejects invalid dimension %s',
    (width) => {
      expect(
        createFrameSchema.safeParse({
          pageId: '0:1',
          name: 'Frame',
          width,
          height: 10,
        }).success,
      ).toBe(false);
    },
  );
  it('requires an explicit session and rejects unknown inputs', () => {
    const input = { pageId: '0:1', name: 'Frame', width: 400, height: 300 };
    expect(createFrameToolSchema.safeParse(input).success).toBe(false);
    expect(
      createFrameToolSchema.safeParse({
        ...input,
        sessionId: 'session',
        execute: 'code',
      }).success,
    ).toBe(false);
  });
  it('round-trips the versioned envelope', () => {
    const message = envelope('command', 'session', 'correlation', {
      command: 'ping',
      input: {},
    });
    expect(parseMessage(JSON.stringify(message))).toEqual(message);
    expect(
      envelopeSchema.safeParse({ ...message, protocolVersion: 2 }).success,
    ).toBe(false);
    expect(
      envelopeSchema.safeParse({ ...message, correlationId: '' }).success,
    ).toBe(false);
    expect(
      envelopeSchema.safeParse({
        ...message,
        payload: { command: 'deleteEverything', input: {} },
      }).success,
    ).toBe(false);
  });
  it('rejects malformed JSON, error codes and stored tokens', () => {
    expect(() => parseMessage('{')).toThrow();
    expect(
      errorSchema.safeParse({ code: 'oops', message: 'bad', retryable: true })
        .success,
    ).toBe(false);
    expect(
      uiToMainSchema.safeParse({
        kind: 'saveToken',
        correlationId: 'id',
        token: 'short',
      }).success,
    ).toBe(false);
  });
  it.each(['abc', 0, 80, 65536, 3845.5])(
    'rejects invalid configured port %s',
    (port) => {
      expect(portSchema.safeParse(port).success).toBe(false);
    },
  );
});

it('counts UTF-8 bytes without browser or Node globals in the shared helper', async () => {
  const { utf8ByteLength } = await import('../packages/shared/src/index.js');
  for (const value of ['ascii', 'مرحبا', '🎨', '\ud800', 'a🎨مرحبا'])
    expect(utf8ByteLength(value)).toBe(Buffer.byteLength(value));
});
