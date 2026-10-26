import { z } from 'zod';
import { identifierSchema } from '../protocol/constants.js';
import { stableIdSchema } from '../designSpecification/schema.js';

export const readerInputSchema = z.object({
  scope: z.enum(['document', 'pages', 'page', 'selection', 'styles', 'asset']),
  nodeId: identifierSchema.optional(),
  cursor: z.string().max(200).optional(),
  format: z.enum(['PNG', 'SVG']).default('PNG'),
  scale: z.number().positive().max(4).default(1),
}).strict();
export type ReaderInput = z.infer<typeof readerInputSchema>;
// JSON fragments may split a large node or styled text; join before parsing.
export const readerChunkSchema = z.object({
  data: z.string().max(12000),
  nextCursor: z.string().nullable(),
  encoding: z.enum(['json', 'base64']),
}).strict();
export type ReaderChunk = z.infer<typeof readerChunkSchema>;
export const rawNodeSchema = z.object({
  id: z.string(), name: z.string(), type: z.string(), parentId: z.string().nullable(),
  childIds: z.array(z.string()), properties: z.record(z.string(), z.unknown()),
  identity: z.record(z.string(), z.string()),
}).strict();
export type RawFigmaNode = z.infer<typeof rawNodeSchema>;
export const extractionSchema = z.object({
  document: z.object({id: z.string(), name: z.string()}).strict(),
  roots: z.array(z.string()), nodes: z.array(rawNodeSchema),
  variables: z.array(z.record(z.string(), z.unknown())),
  collections: z.array(z.record(z.string(), z.unknown())),
  styles: z.array(z.record(z.string(), z.unknown())),
  registries: z.array(z.unknown()).default([]),
}).strict();
export type FigmaExtraction = z.infer<typeof extractionSchema>;
export type MissingInformation = { nodeId?: string; field: string; reason: string; value?: unknown };
export const readerToolSchema = readerInputSchema.extend({sessionId: identifierSchema});
export const exportPackageSchema = z.object({
  sessionId: identifierSchema, nodeId: identifierSchema,
  projectId: stableIdSchema,
  previewScale: z.number().positive().max(4).default(1),
}).strict();
export const exportAssetSchema = z.object({
  sessionId: identifierSchema, nodeId: identifierSchema, projectId: stableIdSchema,
  format: z.enum(['PNG', 'SVG']).default('PNG'), scale: z.number().positive().max(4).default(1),
}).strict();
export const exportResultSchema = z.object({directory: z.string(), files: z.array(z.string()), missingCount: z.number().int().nonnegative()}).strict();
