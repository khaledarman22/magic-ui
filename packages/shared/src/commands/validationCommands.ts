import { z } from 'zod';
import { identifierSchema } from '../protocol/constants.js';

export const validationEvidenceSchema = z
  .object({
    references: z.array(
      z
        .object({
          kind: z.enum(['variable', 'image', 'component']),
          id: z.string(),
          status: z.enum(['resolved', 'missing', 'unverified']),
        })
        .strict(),
    ),
  })
  .strict();
export type ValidationEvidence = z.infer<typeof validationEvidenceSchema>;
export const validateLiveDesignToolSchema = z
  .object({
    sessionId: identifierSchema,
    nodeId: identifierSchema.optional(),
  })
  .strict();
export const designCheckSchema = z
  .object({
    check: z.enum([
      'components',
      'auto-layout',
      'text-overflow',
      'fonts',
      'instances',
      'tokens',
      'assets',
      'visual',
    ]),
    code: z.string(),
    message: z.string(),
    nodeId: z.string().optional(),
  })
  .strict();
export type DesignCheck = z.infer<typeof designCheckSchema>;
export const designValidationReportSchema = z
  .object({
    scope: z.string(),
    nodeCount: z.number().int().nonnegative(),
    passed: z.array(designCheckSchema),
    failed: z.array(designCheckSchema),
    warnings: z.array(designCheckSchema),
    unverified: z.array(designCheckSchema),
    consistency: z.literal(
      'Sequential snapshot; concurrent edits are not locked.',
    ),
  })
  .strict();
export type DesignValidationReport = z.infer<
  typeof designValidationReportSchema
>;
