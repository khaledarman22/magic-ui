import { missingAssetsSchema } from './assetCommands.js';
import { z } from 'zod';
import { identifierSchema } from '../protocol/constants.js';
import {
  designSpecificationSchema,
  stableIdSchema,
} from '../designSpecification/schema.js';
export const initializeProjectSchema = z
  .object({ projectId: stableIdSchema, projectName: stableIdSchema })
  .strict();
export const projectMetadataSchema = initializeProjectSchema.extend({
  schemaVersion: z.literal('1.0.0'),
});
export const initializeProjectResultSchema = z
  .object({
    projectId: stableIdSchema,
    directory: z.string(),
    specificationPath: z.string(),
  })
  .strict();
export const validateDesignToolSchema = z
  .object({ specification: z.unknown() })
  .strict();
export const renderDesignToolSchema = z
  .object({
    sessionId: identifierSchema,
    projectId: stableIdSchema,
    screenId: stableIdSchema,
    pageId: identifierSchema,
    operationId: identifierSchema.optional(),
  })
  .strict();
export const renderDesignSchema = renderDesignToolSchema
  .omit({ sessionId: true })
  .extend({ specification: designSpecificationSchema });
export const nodeMappingSchema = z
  .object({ id: stableIdSchema, nodeId: identifierSchema })
  .strict();
export const renderDesignResultSchema = z
  .object({
    operationId: identifierSchema.optional(),
    missingAssets: missingAssetsSchema.optional(),
    assetsComplete: z.boolean().optional(),
    nodeCount: z.number().int().min(0),
    created: z.number().int().min(0),
    updated: z.number().int().min(0),
    unchanged: z.number().int().min(0),
    orphaned: z.number().int().min(0),
    mapping: z.array(nodeMappingSchema),
    orphanedNodes: z.array(nodeMappingSchema),
  })
  .strict();
export type RenderDesignInput = z.infer<typeof renderDesignSchema>;
export type RenderDesignResult = z.infer<typeof renderDesignResultSchema>;
