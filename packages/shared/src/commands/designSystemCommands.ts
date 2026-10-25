import { z } from 'zod';
import { identifierSchema } from '../protocol/constants.js';
import { designSpecificationSchema, stableIdSchema, componentPropertySchema } from '../designSpecification/schema.js';
export const designSystemToolSchema=z.object({sessionId:identifierSchema,projectId:stableIdSchema,pageId:identifierSchema}).strict();
export const designSystemInputSchema=designSystemToolSchema.omit({sessionId:true}).extend({specification:designSpecificationSchema});
export const readDesignSystemSchema=z.object({projectId:stableIdSchema}).strict();
export const readDesignSystemToolSchema=readDesignSystemSchema.extend({sessionId:identifierSchema});
export const componentRegistryEntrySchema=z.object({
 id:stableIdSchema,name:z.string(),category:stableIdSchema,nodeId:identifierSchema,
 properties:z.array(componentPropertySchema),variants:z.array(z.object({id:stableIdSchema,name:z.string(),nodeId:identifierSchema,values:z.record(z.string(),z.string())}).strict()),
 dependencies:z.array(stableIdSchema),usage:z.array(stableIdSchema),version:z.number().int().positive(),
}).strict();
export const componentRegistrySchema=z.object({projectId:stableIdSchema,components:z.array(componentRegistryEntrySchema)}).strict();
export type ComponentRegistry=z.infer<typeof componentRegistrySchema>;
export const variablesResultSchema=z.object({variables:z.array(z.object({id:z.string(),variableId:z.string(),type:z.enum(['COLOR','FLOAT','STRING','BOOLEAN']),values:z.record(z.string(),z.unknown())}).strict()),collections:z.array(z.object({id:z.string(),name:z.string(),modes:z.array(z.object({modeId:z.string(),name:z.string()}).strict())}).strict())}).strict();
export const designSystemResultSchema=componentRegistrySchema.extend({variables:variablesResultSchema,componentCount:z.number().int(),variableCount:z.number().int()});
export type DesignSystemInput=z.infer<typeof designSystemInputSchema>;
export type DesignSystemResult=z.infer<typeof designSystemResultSchema>;
export const findComponentSchema=z.object({projectId:stableIdSchema,name:z.string().default(''),category:stableIdSchema.optional(),properties:z.array(z.object({name:z.string(),type:z.string()}).strict()).default([])}).strict();
export const findComponentResultSchema=z.object({matches:z.array(z.object({component:componentRegistryEntrySchema,similarity:z.number()}).strict())}).strict();
