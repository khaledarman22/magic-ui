import { z } from 'zod';
import { identifierSchema } from '../protocol/constants.js';
import {
  designSpecificationSchema,
  stableIdSchema,
  componentPropertySchema,
} from '../designSpecification/schema.js';
export const designSystemToolSchema = z
  .object({
    sessionId: identifierSchema,
    projectId: stableIdSchema,
    pageId: identifierSchema,
    operationId: identifierSchema.optional(),
  })
  .strict();
export const designSystemInputSchema = designSystemToolSchema
  .omit({ sessionId: true })
  .extend({ specification: designSpecificationSchema });
export const readDesignSystemSchema = z
  .object({ projectId: stableIdSchema })
  .strict();
export const readDesignSystemToolSchema = readDesignSystemSchema.extend({
  sessionId: identifierSchema,
});
export const componentRegistryEntrySchema = z
  .object({
    id: stableIdSchema,
    name: z.string(),
    category: stableIdSchema,
    nodeId: identifierSchema,
    properties: z.array(componentPropertySchema),
    propertyKeys: z.record(z.string(), z.string()).default({}),
    variants: z.array(
      z
        .object({
          id: stableIdSchema,
          name: z.string(),
          nodeId: identifierSchema,
          values: z.record(z.string(), z.string()),
        })
        .strict(),
    ),
    dependencies: z.array(stableIdSchema),
    usage: z.array(stableIdSchema),
    version: z.number().int().positive(),
  })
  .strict();
export const componentRegistrySchema = z
  .object({
    projectId: stableIdSchema,
    components: z.array(componentRegistryEntrySchema),
  })
  .strict()
  .superRefine((registry, ctx) => {
    const ids = new Set<string>(),
      nodes = new Set<string>();
    for (const [index, c] of registry.components.entries()) {
      if (ids.has(c.id) || nodes.has(c.nodeId))
        ctx.addIssue({
          code: 'custom',
          path: ['components', index],
          message: 'Duplicate component registry identity.',
        });
      ids.add(c.id);
      nodes.add(c.nodeId);
      if (new Set(c.variants.map((v) => v.id)).size !== c.variants.length)
        ctx.addIssue({
          code: 'custom',
          path: ['components', index, 'variants'],
          message: 'Duplicate variant identity.',
        });
      for (const v of c.variants) {
        if (nodes.has(v.nodeId))
          ctx.addIssue({
            code: 'custom',
            path: ['components', index, 'variants'],
            message: 'Duplicate Figma node identity.',
          });
        nodes.add(v.nodeId);
      }
    }
  });
export type ComponentRegistry = z.infer<typeof componentRegistrySchema>;
export const variablesResultSchema = z
  .object({
    variables: z.array(
      z
        .object({
          id: z.string(),
          variableId: z.string(),
          type: z.string(),
          values: z.record(z.string(), z.unknown()),
        })
        .strict(),
    ),
    collections: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          modes: z.array(
            z.object({ modeId: z.string(), name: z.string() }).strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();
export const designSystemResultSchema = componentRegistrySchema.safeExtend({
  operationId: identifierSchema.optional(),
  variables: variablesResultSchema,
  componentCount: z.number().int(),
  variableCount: z.number().int(),
});
export type DesignSystemInput = z.infer<typeof designSystemInputSchema>;
export type DesignSystemResult = z.infer<typeof designSystemResultSchema>;
export const findComponentSchema = z
  .object({
    projectId: stableIdSchema,
    name: z.string().default(''),
    category: stableIdSchema.optional(),
    properties: z
      .array(z.object({ name: z.string(), type: z.string() }).strict())
      .default([]),
  })
  .strict();
export const findComponentResultSchema = z
  .object({
    matches: z.array(
      z
        .object({
          component: componentRegistryEntrySchema,
          similarity: z.number(),
        })
        .strict(),
    ),
  })
  .strict();
