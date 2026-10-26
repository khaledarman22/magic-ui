import { z } from 'zod';
import { identifierSchema } from '../protocol/constants.js';
import {
  designSystemInputSchema,
  designSystemResultSchema,
} from './designSystemCommands.js';
import { orderComponents } from '../designSpecification/designSystemValidation.js';
import type {
  DesignSpecification,
  NodeSpecification,
} from '../designSpecification/schema.js';

export const systemRecoveryInputSchema = designSystemInputSchema.extend({
  operationId: identifierSchema,
  documentId: identifierSchema,
  expectedCompletedSteps: z.number().int().nonnegative().default(0),
});
export const systemRecoveryResultSchema = z
  .object({
    operationId: identifierSchema,
    stepId: z.string().nullable(),
    completedSteps: z.number().int().nonnegative(),
    totalSteps: z.number().int().nonnegative(),
    done: z.boolean(),
    result: designSystemResultSchema.nullable(),
  })
  .strict();
export const systemResourceSchema = z
  .object({
    kind: z.enum(['node', 'variable', 'style', 'collection']),
    id: identifierSchema,
  })
  .strict();
export const systemRecoveryStateSchema = z
  .object({
    operationId: identifierSchema,
    documentId: identifierSchema,
    pageId: identifierSchema,
    specification: z.string(),
    completed: z.array(z.string()),
    preflightPassed: z.boolean(),
    registry: z.string(),
    manifest: z.string(),
    resources: z.array(systemResourceSchema),
    status: z.enum(['running', 'completed']),
  })
  .strict();
export const systemJournalSchema = z
  .object({
    operationId: identifierSchema,
    input: systemRecoveryInputSchema,
    status: z.enum(['running', 'interrupted', 'completed']),
    steps: z.array(
      z
        .object({
          stepId: z.string(),
          status: z.enum(['pending', 'done']),
          completedBefore: z.number().int(),
          completedAfter: z.number().int().nullable(),
        })
        .strict(),
    ),
    result: designSystemResultSchema.nullable(),
  })
  .strict();
export type SystemRecoveryInput = z.infer<typeof systemRecoveryInputSchema>;
export type SystemRecoveryResult = z.infer<typeof systemRecoveryResultSchema>;
export type SystemRecoveryState = z.infer<typeof systemRecoveryStateSchema>;
export type SystemResource = z.infer<typeof systemResourceSchema>;
export function designSystemStepIds(spec: DesignSpecification): string[] {
  const keys: string[] = [];
  if (spec.tokens.values.length) {
    keys.push('collection');
    spec.tokens.modes.forEach((m) => keys.push(`mode:${m}`));
    spec.tokens.values.forEach((t) => keys.push(`allocate:${t.id}`));
    spec.tokens.values.forEach((t) =>
      spec.tokens.modes.forEach((m) => keys.push(`value:${t.id}:${m}`)),
    );
  }
  spec.tokens.typography.forEach((t) => keys.push(`style:${t.id}`));
  if (spec.components.length) keys.push('page', 'workspace');
  const categories = new Set<string>();
  for (const c of orderComponents(spec.components)) {
    if (!categories.has(c.category)) {
      keys.push(`category:${c.category}`);
      categories.add(c.category);
    }
    for (const v of c.variants) {
      const visit = (n: NodeSpecification, root = false) => {
        const id = `${c.id}:${root ? v.id : `${v.id}/${n.id}`}`;
        keys.push(`node:${id}`, `bindings:${id}`);
        if ('nodes' in n) n.nodes.forEach((n) => visit(n));
      };
      visit(v.root, true);
      keys.push(`variant:${c.id}:${v.id}`);
    }
    keys.push(`set:${c.id}`);
    c.properties
      .filter((p) => p.type !== 'VARIANT')
      .forEach((p) => keys.push(`property:${c.id}:${p.id}`));
    keys.push(`registry:${c.id}`);
  }
  keys.push('manifest');
  return keys;
}

export const systemRecoveryStorageSchema = z
  .object({
    version: z.literal(1),
    slot: z.union([z.literal(0), z.literal(1)]),
    parts: z.number().int().min(1).max(512),
  })
  .strict();
