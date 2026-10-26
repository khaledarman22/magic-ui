import { z } from 'zod';
import {
  validateDesignSystem,
  componentWarnings,
} from './designSystemValidation.js';
import { tokensSchema, tokenReferenceSchema, resolveToken } from './tokens.js';
import { MagicUiError, failure } from '../errors/errors.js';

export const stableIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/);
const dimension = z.union([
  z.number().finite().positive().max(100000),
  tokenReferenceSchema,
]);
const size = z.union([dimension, z.enum(['hug', 'fill'])]);
const coordinate = z.union([
  z.number().finite().min(-1000000).max(1000000),
  tokenReferenceSchema,
]);
export const layoutSchema = z
  .object({
    type: z.enum(['auto-layout', 'absolute']).default('absolute'),
    positioning: z.enum(['auto', 'absolute']).default('auto'),
    direction: z.enum(['horizontal', 'vertical']).default('vertical'),
    width: size.default(100),
    height: size.default(100),
    x: coordinate.default(0),
    y: coordinate.default(0),
    padding: z
      .object({
        top: z.union([z.number().min(0), tokenReferenceSchema]),
        right: z.union([z.number().min(0), tokenReferenceSchema]),
        bottom: z.union([z.number().min(0), tokenReferenceSchema]),
        left: z.union([z.number().min(0), tokenReferenceSchema]),
      })
      .strict()
      .default({ top: 0, right: 0, bottom: 0, left: 0 }),
    itemSpacing: z
      .union([z.number().finite().min(0).max(100000), tokenReferenceSchema])
      .default(0),
    alignment: z.enum(['start', 'center', 'end']).default('start'),
    primaryAlignment: z
      .enum(['start', 'center', 'end', 'space-between'])
      .default('start'),
  })
  .strict();
const solidPaintSchema = z
  .object({
    color: z.union([
      z.string().regex(/^#[0-9a-fA-F]{6}$/),
      tokenReferenceSchema,
    ]),
    opacity: z
      .union([z.number().min(0).max(1), tokenReferenceSchema])
      .default(1),
  })
  .strict();
export const stylingSchema = z
  .object({
    fills: z.array(solidPaintSchema).max(16).default([]),
    strokes: z.array(solidPaintSchema).max(16).default([]),
    strokeWeight: z
      .union([z.number().min(0).max(1000), tokenReferenceSchema])
      .default(1),
    cornerRadius: z
      .union([z.number().min(0).max(100000), tokenReferenceSchema])
      .default(0),
    opacity: z
      .union([z.number().min(0).max(1), tokenReferenceSchema])
      .default(1),
  })
  .strict();
const common = {
  id: stableIdSchema,
  name: z.string().min(1).max(256),
  layout: layoutSchema,
  styling: stylingSchema.default(stylingSchema.parse({})),
};
export const textSpecificationSchema = z
  .object({
    ...common,
    type: z.literal('text'),
    content: z.union([z.string().max(20000), tokenReferenceSchema]),
    typography: z.string().optional(),
    fontFamily: z.union([z.string().min(1).max(128), tokenReferenceSchema]),
    fontStyle: z.union([z.string().min(1).max(128), tokenReferenceSchema]),
    fontSize: z
      .union([z.number().positive().max(1000), tokenReferenceSchema])
      .default(16),
    lineHeight: z
      .union([
        z.literal('auto'),
        z.union([z.number().positive().max(10000), tokenReferenceSchema]),
      ])
      .default('auto'),
    letterSpacing: z
      .union([z.number().min(-1000).max(1000), tokenReferenceSchema])
      .default(0),
    textAlign: z
      .enum(['start', 'end', 'left', 'right', 'center', 'justified'])
      .default('start'),
  })
  .strict();
export const rectangleSpecificationSchema = z
  .object({ ...common, type: z.literal('rectangle') })
  .strict();
const frameBaseSchema = z
  .object({
    ...common,
    type: z.literal('frame'),
    assetId: stableIdSchema.optional(),
  })
  .strict();
export const instanceSpecificationSchema = z
  .object({
    ...common,
    type: z.literal('component-instance'),
    componentId: stableIdSchema,
    variant: z.string().min(1),
    overrides: z
      .record(z.string(), z.union([z.string(), z.boolean()]))
      .default({}),
  })
  .strict();
export type NodeSpecification =
  | z.infer<typeof instanceSpecificationSchema>
  | z.infer<typeof textSpecificationSchema>
  | z.infer<typeof rectangleSpecificationSchema>
  | (z.infer<typeof frameBaseSchema> & { nodes: NodeSpecification[] });
type NodeSpecificationInput =
  | z.input<typeof instanceSpecificationSchema>
  | z.input<typeof textSpecificationSchema>
  | z.input<typeof rectangleSpecificationSchema>
  | (z.input<typeof frameBaseSchema> & { nodes: NodeSpecificationInput[] });
export const nodeSpecificationSchema: z.ZodType<
  NodeSpecification,
  NodeSpecificationInput
> = z.lazy(() =>
  z.discriminatedUnion('type', [
    frameSpecificationSchema,
    textSpecificationSchema,
    rectangleSpecificationSchema,
    instanceSpecificationSchema,
  ]),
);
export const frameSpecificationSchema = frameBaseSchema.extend({
  nodes: z.array(nodeSpecificationSchema).max(500),
});
export const screenSpecificationSchema = z
  .object({
    ...common,
    direction: z.enum(['ltr', 'rtl']).default('ltr'),
    nodes: z.array(nodeSpecificationSchema).max(500),
  })
  .strict();
export const componentPropertySchema = z
  .object({
    id: stableIdSchema,
    name: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[^,=#]+$/),
    type: z.enum(['TEXT', 'BOOLEAN', 'INSTANCE_SWAP', 'VARIANT']),
    defaultValue: z.union([z.string(), z.boolean()]),
    targetId: stableIdSchema.optional(),
  })
  .strict();
export const componentSpecificationSchema = z
  .object({
    id: stableIdSchema,
    name: z.string().min(1).max(256),
    category: stableIdSchema,
    version: z.number().int().positive().default(1),
    properties: z.array(componentPropertySchema).max(40).default([]),
    dependencies: z.array(stableIdSchema).default([]),
    variants: z
      .array(
        z
          .object({
            id: stableIdSchema,
            kind: z.enum(['app', 'website', 'dashboard']).optional(),
            name: z.string().min(1).max(256),
            values: z.record(
              z.string(),
              z
                .string()
                .min(1)
                .regex(/^[^,=]+$/),
            ),
            root: frameSpecificationSchema,
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export type ComponentSpecification = z.infer<
  typeof componentSpecificationSchema
>;
export const designSpecificationSchema = z
  .object({
    schemaVersion: z.literal('1.0.0'),
    projectId: stableIdSchema,
    tokens: tokensSchema.default(tokensSchema.parse({})),
    components: z.array(componentSpecificationSchema).max(100).default([]),
    pages: z
      .array(
        z
          .object({
            id: stableIdSchema,
            kind: z.enum(['app', 'website', 'dashboard']).optional(),
            name: z.string().min(1).max(256),
            screens: z.array(screenSpecificationSchema).max(100),
          })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .superRefine((spec, ctx) => {
    for (const issue of validateDesignSystem(spec))
      ctx.addIssue({ code: 'custom', ...issue });
    try {
      for (const mode of spec.tokens.modes)
        for (const token of spec.tokens.values)
          resolveToken(spec.tokens, token.id, mode);
      // validateDesignSystem resolves and validates all referenced node values.
      // Here validate even unused token aliases, without cloning the node tree again.
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        path: ['tokens'],
        message: String(error),
      });
    }
    const ids = new Set<string>();
    const check = (id: string, path: (string | number)[]) => {
      if (ids.has(id))
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'id'],
          message: 'Stable IDs must be unique within the project.',
        });
      ids.add(id);
    };
    let count = 0;
    spec.pages.forEach((page, pi) => {
      check(page.id, ['pages', pi]);
      page.screens.forEach((screen, si) => {
        const path = ['pages', pi, 'screens', si];
        const visit = (
          node: NodeSpecification | ScreenSpecification,
          p: (string | number)[],
          parent: Layout | undefined,
          depth: number,
        ) => {
          check(node.id, p);
          count++;
          if (depth > 32)
            ctx.addIssue({
              code: 'custom',
              path: p,
              message: 'Maximum nesting depth is 32.',
            });
          const frame =
            !('type' in node) ||
            node.type === 'frame' ||
            node.type === 'component-instance';
          const l = node.layout;
          if (
            'assetId' in node &&
            node.assetId &&
            'nodes' in node &&
            node.nodes.length
          )
            ctx.addIssue({
              code: 'custom',
              path: p,
              message: 'Asset frames cannot contain spec children.',
            });
          if (
            'type' in node &&
            node.type === 'text' &&
            node.styling.cornerRadius !== 0
          )
            ctx.addIssue({
              code: 'custom',
              path: [...p, 'styling', 'cornerRadius'],
              message: 'Text nodes do not support corner radius.',
            });
          if (!frame && l.type !== 'absolute')
            ctx.addIssue({
              code: 'custom',
              path: [...p, 'layout', 'type'],
              message: 'Only frames support auto-layout.',
            });
          for (const axis of ['width', 'height'] as const) {
            if (
              l[axis] === 'fill' &&
              (l.positioning === 'absolute' ||
                !parent ||
                parent.type !== 'auto-layout' ||
                parent[axis] === 'hug')
            )
              ctx.addIssue({
                code: 'custom',
                path: [...p, 'layout', axis],
                message:
                  'Fill requires a non-hug auto-layout parent on this axis.',
              });
            if (
              l[axis] === 'hug' &&
              (('type' in node && node.type === 'rectangle') ||
                (frame && l.type !== 'auto-layout'))
            )
              ctx.addIssue({
                code: 'custom',
                path: [...p, 'layout', axis],
                message: 'Hug requires text or an auto-layout frame.',
              });
          }
          if (
            'type' in node &&
            node.type === 'text' &&
            l.width === 'hug' &&
            l.height !== 'hug'
          )
            ctx.addIssue({
              code: 'custom',
              path: [...p, 'layout', 'height'],
              message: 'Auto-width text requires hug height.',
            });
          if ('nodes' in node)
            node.nodes.forEach((child, i) =>
              visit(child, [...p, 'nodes', i], l, depth + 1),
            );
        };
        visit(screen, path, undefined, 0);
      });
    });
    if (count > 500)
      ctx.addIssue({
        code: 'custom',
        path: ['pages'],
        message: 'At most 500 rendered nodes per specification.',
      });
  });
export type Layout = z.infer<typeof layoutSchema>;
export type ScreenSpecification = z.infer<typeof screenSpecificationSchema>;
export type DesignSpecification = z.infer<typeof designSpecificationSchema>;
export const validationResultSchema = z
  .object({
    valid: z.boolean(),
    warnings: z.array(z.string()).optional(),
    errors: z.array(
      z.object({ path: z.string(), message: z.string() }).strict(),
    ),
  })
  .strict();
export function validateDesignSpecification(
  value: unknown,
): z.infer<typeof validationResultSchema> {
  const result = designSpecificationSchema.safeParse(value);
  return result.success
    ? {
        valid: true,
        errors: [],
        ...(componentWarnings(result.data.components).length
          ? { warnings: componentWarnings(result.data.components) }
          : {}),
      }
    : {
        valid: false,
        errors: result.error.issues.map((issue) => ({
          path: issue.path.reduce<string>(
            (path, part) =>
              typeof part === 'number'
                ? `${path}[${part}]`
                : `${path}${path ? '.' : ''}${String(part)}`,
            '',
          ),
          message: issue.message,
        })),
      };
}
export function migrateDesignSpecification(
  value: unknown,
): DesignSpecification {
  if (
    !value ||
    typeof value !== 'object' ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== '1.0.0'
  )
    throw new MagicUiError(
      failure(
        'UNSUPPORTED_SCHEMA_VERSION',
        'Only Design Specification 1.0.0 is supported.',
      ),
    );
  const result = designSpecificationSchema.safeParse(value);
  if (!result.success)
    throw new MagicUiError({
      ...failure('INVALID_INPUT', 'Design specification is invalid.'),
      details: validateDesignSpecification(value),
    });
  return result.data;
}
