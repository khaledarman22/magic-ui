import { z } from 'zod';
import {
  PROTOCOL_VERSION,
  identifierSchema,
  tokenSchema,
  portSchema,
} from './constants.js';
import {
  documentSchema,
  commandSchema,
  commandResultSchema,
} from '../commands/commands.js';
import { errorSchema } from '../errors/errors.js';
const envelopeFields = {
  protocolVersion: z.literal(PROTOCOL_VERSION),
  correlationId: identifierSchema,
  sessionId: identifierSchema,
};
export const envelopeSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...envelopeFields,
      type: z.literal('auth'),
      payload: z
        .object({ token: tokenSchema, document: documentSchema })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...envelopeFields,
      type: z.literal('ready'),
      payload: z
        .object({ heartbeatIntervalMs: z.number().positive(), readOnly: z.boolean().default(false) })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...envelopeFields,
      type: z.literal('command'),
      payload: commandSchema,
    })
    .strict(),
  z
    .object({
      ...envelopeFields,
      type: z.literal('result'),
      payload: commandResultSchema,
    })
    .strict(),
  z
    .object({
      ...envelopeFields,
      type: z.literal('error'),
      payload: errorSchema,
    })
    .strict(),
  z
    .object({
      ...envelopeFields,
      type: z.literal('cancel'),
      payload: z.object({}).strict(),
    })
    .strict(),
]);
export type Envelope = z.infer<typeof envelopeSchema>;
export function envelope<T extends Envelope['type']>(
  type: T,
  sessionId: string,
  correlationId: string,
  payload: T extends 'ready' ? { heartbeatIntervalMs: number; readOnly?: boolean } : Extract<Envelope, { type: T }>['payload'],
): Extract<Envelope, { type: T }> {
  // The generic discriminator and payload are paired by the signature and checked at runtime.
  return envelopeSchema.parse({
    protocolVersion: PROTOCOL_VERSION,
    type,
    sessionId,
    correlationId,
    payload,
  }) as Extract<Envelope, { type: T }>;
}
export function parseMessage(data: string): Envelope {
  return envelopeSchema.parse(JSON.parse(data) as unknown);
}
export const sessionFileSchema = z
  .object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    token: tokenSchema,
    port: portSchema,
    pid: z.number().int().positive(),
  })
  .strict();
// UI ↔ Main messages use the same envelope for bridge traffic and schema-checked local settings.
export const uiToMainSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('initialize'), correlationId: identifierSchema })
    .strict(),
  z
    .object({
      kind: z.literal('saveToken'),
      correlationId: identifierSchema,
      token: tokenSchema,
    })
    .strict(),
  z.object({ kind: z.literal('bridge'), message: envelopeSchema }).strict(),
]);
export const mainToUiSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('settings'),
      correlationId: identifierSchema,
      token: tokenSchema.nullable(),
      document: documentSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('localError'),
      correlationId: identifierSchema,
      message: z.string(),
    })
    .strict(),
  z.object({ kind: z.literal('bridge'), message: envelopeSchema }).strict(),
]);
export type UiToMain = z.infer<typeof uiToMainSchema>;
export type MainToUi = z.infer<typeof mainToUiSchema>;
