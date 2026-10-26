import { systemJournalSchema } from './designSystemRecoveryCommands.js';
import { z } from 'zod';
import { identifierSchema } from '../protocol/constants.js';
import {
  designSpecificationSchema,
  nodeSpecificationSchema,
  stableIdSchema,
} from '../designSpecification/schema.js';
import { tokensSchema } from '../designSpecification/tokens.js';
import { renderDesignToolSchema } from './designCommands.js';

export const syncStatusSchema = z.enum([
  'in-sync',
  'spec-changed',
  'figma-changed',
  'conflict',
  'missing-in-figma',
  'orphaned',
]);
export type SyncStatus = z.infer<typeof syncStatusSchema>;
export function classifySync(
  desired: string | undefined,
  baselineIntent: string | undefined,
  live: string | undefined,
  baselineLive: string | undefined,
): SyncStatus {
  if (desired === undefined) return 'orphaned';
  if (live === undefined) return 'missing-in-figma';
  const changed = baselineLive === undefined || live !== baselineLive;
  if (desired !== baselineIntent) return changed ? 'conflict' : 'spec-changed';
  return changed ? 'figma-changed' : 'in-sync';
}
export const syncScopeSchema = renderDesignToolSchema.omit({
  sessionId: true,
  operationId: true,
});
export const syncDecisionSchema = z
  .object({
    localId: stableIdSchema,
    decision: z.enum(['keep-figma', 'apply-spec']),
  })
  .strict();
export const syncToolSchema = renderDesignToolSchema.extend({
  decisions: z.array(syncDecisionSchema).max(500).default([]),
  operationId: identifierSchema.optional(),
});
export const syncEntrySchema = z
  .object({
    id: stableIdSchema,
    parentId: stableIdSchema.nullable(),
    index: z.number().int().min(0),
    specification: nodeSpecificationSchema,
    intent: z.string(),
  })
  .strict();
export const syncLiveSchema = z
  .object({
    localId: stableIdSchema,
    figmaNodeId: identifierSchema,
    intent: z.string(),
    snapshot: z.string(),
    baseline: z.string(),
    ownedHash: z.string(),
    operationId: z.string(),
    trashed: z.boolean(),
  })
  .strict();
export const syncInspectSchema = syncScopeSchema.extend({
  localId: stableIdSchema.optional(),
});
export const syncInspectResultSchema = z
  .object({
    documentId: z.string(),
    rootNodeId: z.string(),
    nodes: z.array(
      z
        .object({ localId: stableIdSchema, figmaNodeId: identifierSchema })
        .strict(),
    ),
    live: syncLiveSchema.nullable(),
  })
  .strict();
export const syncStepSchema = syncScopeSchema.extend({
  documentId: identifierSchema,
  operationId: identifierSchema,
  entry: syncEntrySchema,
  tokens: tokensSchema,
  direction: z.enum(['ltr', 'rtl']),
  specVersion: z.string(),
  expectedNodeId: identifierSchema.nullable(),
  expectedSnapshot: z.string().nullable(),
  action: z.enum(['apply-spec', 'keep-figma']),
});
export const syncRecordSchema = z
  .object({
    localId: stableIdSchema,
    figmaNodeId: identifierSchema,
    specVersion: z.string(),
    lastSyncedHash: z.string(),
    intent: z.string(),
    snapshot: z.string(),
    drift: z.string().optional(),
  })
  .strict();
export const syncStateSchema = z
  .object({
    projectId: stableIdSchema,
    screenId: stableIdSchema,
    pageId: identifierSchema,
    documentId: identifierSchema,
    nodes: z.array(syncRecordSchema),
  })
  .strict();
export const syncStatesSchema = z
  .object({ screens: z.array(syncStateSchema) })
  .strict();
export const syncReportRowSchema = z
  .object({
    localId: stableIdSchema,
    figmaNodeId: identifierSchema.nullable(),
    status: syncStatusSchema,
    action: z.enum(['create', 'update', 'keep-figma', 'skip']),
    reason: z.string(),
  })
  .strict();
export const syncReportSchema = z
  .object({
    operationId: z.string().optional(),
    status: z.enum(['preview', 'completed', 'interrupted']),
    completedSteps: z.number().int().min(0),
    totalSteps: z.number().int().min(0),
    operations: z.array(syncReportRowSchema),
  })
  .strict();
export const syncJournalSchema = z
  .object({
    operationId: identifierSchema,
    scope: syncScopeSchema,
    documentId: identifierSchema,
    specification: designSpecificationSchema,
    decisions: z.array(syncDecisionSchema),
    kind: z.enum(['render', 'apply']),
    status: z.enum(['running', 'interrupted', 'completed']),
    steps: z.array(
      z
        .object({
          localId: stableIdSchema,
          status: z.enum(['pending', 'done', 'skipped']),
          before: z.string().nullable(),
          after: z.string().nullable(),
        })
        .strict(),
    ),
    report: syncReportSchema,
  })
  .strict();
export const syncJournalsSchema = z
  .object({
    operations: z.array(syncJournalSchema),
    systems: z.array(systemJournalSchema).default([]),
  })
  .strict();
export const resumeToolSchema = z
  .object({
    sessionId: identifierSchema,
    projectId: stableIdSchema,
    operationId: identifierSchema,
    decisions: z.array(syncDecisionSchema).max(500).default([]),
  })
  .strict();
export const trashToolSchema = renderDesignToolSchema.extend({
  localId: stableIdSchema,
  reason: z.string().trim().min(1).max(1000),
});
export const restoreToolSchema = trashToolSchema.omit({ reason: true });
export const trashCommandSchema = syncScopeSchema.extend({
  localId: stableIdSchema,
  reason: z.string(),
  restore: z.boolean(),
  expectedNodeId: identifierSchema,
  expectedSnapshot: z.string(),
});
export const trashMetadataSchema = z
  .object({
    localId: stableIdSchema,
    projectId: stableIdSchema,
    screenId: stableIdSchema,
    parentId: identifierSchema,
    index: z.number().int().min(0),
    x: z.number(),
    y: z.number(),
    reason: z.string(),
    trashed: z.boolean(),
  })
  .strict();
export type SyncScope = z.infer<typeof syncScopeSchema>;
export type SyncEntry = z.infer<typeof syncEntrySchema>;
export type SyncLive = z.infer<typeof syncLiveSchema>;
export type SyncStep = z.infer<typeof syncStepSchema>;
export type SyncState = z.infer<typeof syncStateSchema>;
export type SyncJournal = z.infer<typeof syncJournalSchema>;
export type SyncReport = z.infer<typeof syncReportSchema>;
export type SyncToolInput = z.infer<typeof syncToolSchema>;
