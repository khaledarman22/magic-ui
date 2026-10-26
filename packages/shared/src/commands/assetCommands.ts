import { z } from 'zod';
import { stableIdSchema } from '../designSpecification/schema.js';
import { identifierSchema } from '../protocol/constants.js';
export const MAX_ASSET_BYTES = 8 * 1024 * 1024;
export const assetHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const assetRecordSchema = z
  .object({
    id: stableIdSchema,
    name: z.string().min(1).max(256),
    path: z.string().min(1),
    hash: assetHashSchema,
    mime: z.enum(['image/png', 'image/jpeg', 'image/svg+xml']),
    width: z.number().positive().max(16384),
    height: z.number().positive().max(16384),
    size: z.number().int().positive().max(MAX_ASSET_BYTES),
    source: z.string().max(2048),
    license: z.string().min(1).max(2048),
    usages: z.array(stableIdSchema),
    optimization: z.literal('original'),
    figma: z
      .array(
        z
          .object({
            documentId: identifierSchema,
            imageHash: z.string().optional(),
            componentId: z.string().optional(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();
export const assetManifestSchema = z
  .object({
    projectId: stableIdSchema,
    assets: z.array(assetRecordSchema).max(1000),
  })
  .strict();
export const registerAssetSchema = z
  .object({
    id: stableIdSchema.optional(),
    projectId: stableIdSchema,
    path: z.string().min(1).max(4096),
    name: z.string().min(1).max(256),
    source: z.string().max(2048),
    license: z.string().min(1).max(2048),
  })
  .strict();
export const assetChunkSchema = z
  .object({
    projectId: stableIdSchema,
    documentId: identifierSchema,
    pageId: identifierSchema,
    assetId: stableIdSchema,
    hash: assetHashSchema,
    transferHash: assetHashSchema,
    mime: assetRecordSchema.shape.mime,
    offset: z.number().int().min(0),
    total: z.number().int().positive().max(MAX_ASSET_BYTES),
    bytes: z.array(z.number().int().min(0).max(255)).max(8000),
  })
  .strict();
export const assetChunkResultSchema = z
  .object({
    received: z.number().int().min(0),
    complete: z.boolean(),
    imageHash: z.string().optional(),
    componentId: z.string().optional(),
  })
  .strict();
export const assetResolutionSchema = z
  .object({ id: stableIdSchema, hash: assetHashSchema.nullable() })
  .strict();
export const missingAssetsSchema = z.array(
  z
    .object({
      localId: stableIdSchema,
      assetId: stableIdSchema,
      status: z.literal('missing'),
    })
    .strict(),
);
export type AssetRecord = z.infer<typeof assetRecordSchema>;
export type AssetManifest = z.infer<typeof assetManifestSchema>;
export type AssetResolution = z.infer<typeof assetResolutionSchema>;

export const assetBindingsSchema = z
  .object({
    projectId: stableIdSchema,
    pageId: identifierSchema,
    documentId: identifierSchema,
    assets: z.array(assetResolutionSchema).max(500),
  })
  .strict();
export const assetBindingsResultSchema = z
  .object({ bound: z.number().int().min(0) })
  .strict();
