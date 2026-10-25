import { z } from 'zod';
export const errorCodeSchema = z.enum([
  'AUTH_FAILED',
  'INVALID_MESSAGE',
  'INVALID_INPUT',
  'NOT_CONNECTED',
  'SESSION_BUSY',
  'SESSION_MISMATCH',
  'TIMEOUT',
  'CANCELLED',
  'NODE_NOT_FOUND',
  'PAGE_CHANGED',
  'INTERNAL_ERROR',
  'UNSUPPORTED_SCHEMA_VERSION',
  'FONT_UNAVAILABLE',
  'DRIFT_DETECTED',
  'MESSAGE_TOO_LARGE',
  'WORKSPACE_ERROR',
  'PROJECT_NOT_FOUND',
]);
export const errorSchema = z
  .object({
    code: errorCodeSchema,
    message: z.string(),
    retryable: z.boolean(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type MagicError = z.infer<typeof errorSchema>;
export function failure(
  code: MagicError['code'],
  message: string,
  retryable = false,
): MagicError {
  return { code, message, retryable };
}
export class MagicUiError extends Error {
  constructor(public readonly error: MagicError) {
    super(error.message);
    this.name = 'MagicUiError';
  }
}
