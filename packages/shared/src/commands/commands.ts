import { readerInputSchema, readerChunkSchema } from './readerCommands.js';
import {
  designSystemInputSchema,
  designSystemResultSchema,
  readDesignSystemSchema,
  componentRegistrySchema,
  variablesResultSchema,
} from './designSystemCommands.js';
import { z } from 'zod';
import {
  renderDesignSchema,
  renderDesignResultSchema,
} from './designCommands.js';
import { identifierSchema } from '../protocol/constants.js';
export const documentSchema = z
  .object({
    name: z.string().max(512),
    pageId: identifierSchema,
    pageName: z.string().max(512),
  })
  .strict();
export const createFrameSchema = z
  .object({
    pageId: identifierSchema,
    name: z.string().trim().min(1).max(256),
    width: z.number().finite().positive().max(100000),
    height: z.number().finite().positive().max(100000),
    x: z.number().finite().min(-1000000).max(1000000).default(0),
    y: z.number().finite().min(-1000000).max(1000000).default(0),
  })
  .strict();
export const readNodeSchema = z.object({ nodeId: identifierSchema }).strict();
export const pingSchema = z.object({}).strict();
export const commandSchema = z.discriminatedUnion('command', [
 z.object({command: z.literal('readFigma'), input: readerInputSchema}).strict(),
  z
    .object({
      command: z.literal('renderDesignSystem'),
      input: designSystemInputSchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('readComponents'),
      input: readDesignSystemSchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('readVariables'),
      input: readDesignSystemSchema,
    })
    .strict(),
  z
    .object({ command: z.literal('renderDesign'), input: renderDesignSchema })
    .strict(),
  z.object({ command: z.literal('ping'), input: pingSchema }).strict(),
  z
    .object({ command: z.literal('createFrame'), input: createFrameSchema })
    .strict(),
  z.object({ command: z.literal('readNode'), input: readNodeSchema }).strict(),
]);
export const nodeSnapshotSchema = z
  .object({
    nodeId: identifierSchema,
    name: z.string(),
    type: z.string(),
    parentId: identifierSchema.nullable(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  })
  .strict();
export const commandResultSchema = z.discriminatedUnion('command', [
 z.object({command: z.literal('readFigma'), result: readerChunkSchema}).strict(),
  z
    .object({
      command: z.literal('renderDesignSystem'),
      result: designSystemResultSchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('readComponents'),
      result: componentRegistrySchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('readVariables'),
      result: variablesResultSchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('renderDesign'),
      result: renderDesignResultSchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('ping'),
      result: z.object({ alive: z.literal(true) }).strict(),
    })
    .strict(),
  z
    .object({
      command: z.literal('createFrame'),
      result: nodeSnapshotSchema.extend({ type: z.literal('FRAME') }),
    })
    .strict(),
  z
    .object({ command: z.literal('readNode'), result: nodeSnapshotSchema })
    .strict(),
]);

export type Command = z.infer<typeof commandSchema>;
export type CommandResult = z.infer<typeof commandResultSchema>;
export type NodeSnapshot = z.infer<typeof nodeSnapshotSchema>;
export type DocumentInfo = z.infer<typeof documentSchema>;
export const connectionStatusInputSchema = z.object({}).strict();
export const createFrameToolSchema = createFrameSchema.extend({
  sessionId: identifierSchema,
});
export const readNodeToolSchema = readNodeSchema.extend({
  sessionId: identifierSchema,
});
export const connectionStatusSchema = z
  .object({
    connected: z.boolean(),
    sessionId: identifierSchema.nullable(),
    document: documentSchema.nullable(),
  })
  .strict();

export const commandPermissions = { ping: 'read', readNode: 'read', readComponents: 'read', readVariables: 'read', readFigma: 'read', createFrame: 'write', renderDesign: 'write', renderDesignSystem: 'write' } as const satisfies Record<Command['command'], 'read' | 'write'>;
