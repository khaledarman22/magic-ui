import { z } from 'zod';
import {
  commandSchema,
  commandResultSchema,
  documentSchema,
} from '../commands/commands.js';
import { errorSchema } from '../errors/errors.js';
import {
  identifierSchema,
  PROTOCOL_VERSION,
  tokenSchema,
} from './constants.js';

export const sessionsSchema = z
  .object({
    sessions: z
      .array(
        z
          .object({
            sessionId: identifierSchema,
            document: documentSchema,
          })
          .strict(),
      )
      .max(64),
  })
  .strict();
export type Sessions = z.infer<typeof sessionsSchema>;
const fields = {
  protocolVersion: z.literal(PROTOCOL_VERSION),
  correlationId: identifierSchema,
};
export const hubMessageSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...fields,
      type: z.literal('peerAuth'),
      token: tokenSchema,
      readOnly: z.boolean(),
    })
    .strict(),
  z.object({ ...fields, type: z.literal('peerReady') }).strict(),
  z.object({ ...fields, type: z.literal('acquireWrite') }).strict(),
  z.object({ ...fields, type: z.literal('releaseWrite') }).strict(),
  z.object({ ...fields, type: z.literal('lockResult') }).strict(),
  z.object({ ...fields, type: z.literal('sessions') }).strict(),
  z
    .object({
      ...fields,
      type: z.literal('sessionsResult'),
      result: sessionsSchema,
    })
    .strict(),
  z
    .object({
      ...fields,
      type: z.literal('request'),
      sessionId: identifierSchema,
      command: commandSchema,
    })
    .strict(),
  z
    .object({
      ...fields,
      type: z.literal('response'),
      result: commandResultSchema,
    })
    .strict(),
  z
    .object({ ...fields, type: z.literal('failure'), error: errorSchema })
    .strict(),
  z.object({ ...fields, type: z.literal('abort') }).strict(),
]);
export type HubMessage = z.infer<typeof hubMessageSchema>;

// Shared transport contract used by the direct bridge and the elected hub client.
export interface BridgeConnection {
  readonly readOnly: boolean;
  withWriteLock<T>(action: () => Promise<T>): Promise<T>;
  status():
    | {
        connected: boolean;
        sessionId: string | null;
        document: z.infer<typeof documentSchema> | null;
      }
    | Promise<{
        connected: boolean;
        sessionId: string | null;
        document: z.infer<typeof documentSchema> | null;
      }>;
  listSessions(): Sessions | Promise<Sessions>;
  request(
    sessionId: string,
    command: z.infer<typeof commandSchema>,
    signal?: AbortSignal,
  ): Promise<z.infer<typeof commandResultSchema>>;
}
