import { z } from 'zod';
import {
  designSpecificationSchema,
  stableIdSchema,
} from '../designSpecification/schema.js';
import { identifierSchema } from '../protocol/constants.js';
export const projectLayoutSchema = z
  .object({
    projectId: stableIdSchema,
    pageId: identifierSchema,
    specification: designSpecificationSchema,
  })
  .strict();
export const projectLayoutResultSchema = z
  .object({
    pages: z.array(
      z
        .object({
          id: stableIdSchema,
          nodeId: identifierSchema,
          workspaceId: identifierSchema,
        })
        .strict(),
    ),
  })
  .strict();
export const prepareProjectToolSchema = z
  .object({
    sessionId: identifierSchema,
    projectId: stableIdSchema,
    pageId: identifierSchema,
  })
  .strict();
export const presentScreenSchema = z
  .object({
    projectId: stableIdSchema,
    pageId: identifierSchema,
    screenId: stableIdSchema,
    device: z.enum(['iphone', 'laptop']),
  })
  .strict();
export const presentScreenToolSchema = presentScreenSchema.extend({
  sessionId: identifierSchema,
});
export const presentScreenResultSchema = z
  .object({
    componentId: identifierSchema,
    instanceId: identifierSchema,
    presentationId: identifierSchema,
    sourceNodeId: identifierSchema,
    sourceHash: z.string(),
    mockupSource: z.literal('basic-shapes'),
    refresh: z.literal('explicit'),
  })
  .strict();

export const basicMockupSources = {
  source: 'basic-shapes',
  license: 'Original geometric shapes; no third-party device artwork',
  iphone: {
    width: 425,
    height: 900,
    cornerRadius: 48,
    insetX: 16,
    insetY: 24,
    bottomInset: 24,
    screenRadius: 32,
  },
  laptop: {
    width: 1488,
    height: 980,
    cornerRadius: 16,
    insetX: 16,
    insetY: 24,
    bottomInset: 56,
    screenRadius: 4,
  },
} as const;
