import { z } from 'zod';
import { MagicUiError, failure } from '../errors/errors.js';

export const stableIdSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/);
const dimension = z.number().finite().positive().max(100000);
const size = z.union([dimension, z.enum(['hug', 'fill'])]);
const coordinate = z.number().finite().min(-1000000).max(1000000);
export const layoutSchema = z.object({
  type: z.enum(['auto-layout', 'absolute']).default('absolute'),
  direction: z.enum(['horizontal', 'vertical']).default('vertical'),
  width: size.default(100), height: size.default(100),
  x: coordinate.default(0), y: coordinate.default(0),
  padding: z.object({ top: z.number().min(0), right: z.number().min(0), bottom: z.number().min(0), left: z.number().min(0) }).strict().default({ top: 0, right: 0, bottom: 0, left: 0 }),
  itemSpacing: z.number().finite().min(0).max(100000).default(0),
  alignment: z.enum(['start', 'center', 'end']).default('start'),
  primaryAlignment: z.enum(['start', 'center', 'end', 'space-between']).default('start'),
}).strict();
const solidPaintSchema = z.object({ color: z.string().regex(/^#[0-9a-fA-F]{6}$/), opacity: z.number().min(0).max(1).default(1) }).strict();
export const stylingSchema = z.object({
  fills: z.array(solidPaintSchema).max(16).default([]),
  strokes: z.array(solidPaintSchema).max(16).default([]),
  strokeWeight: z.number().min(0).max(1000).default(1),
  cornerRadius: z.number().min(0).max(100000).default(0),
  opacity: z.number().min(0).max(1).default(1),
}).strict();
const common = { id: stableIdSchema, name: z.string().min(1).max(256), layout: layoutSchema, styling: stylingSchema.default(stylingSchema.parse({})) };
export const textSpecificationSchema = z.object({
  ...common, type: z.literal('text'), content: z.string().max(20000),
  fontFamily: z.string().min(1).max(128), fontStyle: z.string().min(1).max(128),
  fontSize: z.number().positive().max(1000).default(16),
  lineHeight: z.union([z.literal('auto'), z.number().positive().max(10000)]).default('auto'),
  letterSpacing: z.number().min(-1000).max(1000).default(0),
  textAlign: z.enum(['start', 'end', 'left', 'right', 'center', 'justified']).default('start'),
}).strict();
export const rectangleSpecificationSchema = z.object({ ...common, type: z.literal('rectangle') }).strict();
export const frameSpecificationSchema = z.object({
  ...common, type: z.literal('frame'),
  get nodes() { return z.array(nodeSpecificationSchema).max(500); },
}).strict();
export const nodeSpecificationSchema = z.discriminatedUnion('type', [frameSpecificationSchema, textSpecificationSchema, rectangleSpecificationSchema]);
export const screenSpecificationSchema = z.object({ ...common, direction: z.enum(['ltr', 'rtl']).default('ltr'), nodes: z.array(nodeSpecificationSchema).max(500) }).strict();
export const designSpecificationSchema = z.object({
  schemaVersion: z.literal('1.0.0'), projectId: stableIdSchema,
  pages: z.array(z.object({ id: stableIdSchema, name: z.string().min(1).max(256), screens: z.array(screenSpecificationSchema).max(100) }).strict()).max(100),
}).strict().superRefine((spec, ctx) => {
  const ids = new Set<string>();
  const check = (id: string, path: (string | number)[]) => {
    if (ids.has(id)) ctx.addIssue({ code: 'custom', path: [...path, 'id'], message: 'Stable IDs must be unique within the project.' });
    ids.add(id);
  };
  let count = 0;
  spec.pages.forEach((page, pi) => {
    check(page.id, ['pages', pi]);
    page.screens.forEach((screen, si) => {
      const path = ['pages', pi, 'screens', si];
      const visit = (node: NodeSpecification | ScreenSpecification, p: (string | number)[], parent: Layout | undefined, depth: number) => {
        check(node.id, p); count++;
        if (depth > 32) ctx.addIssue({ code: 'custom', path: p, message: 'Maximum nesting depth is 32.' });
        const frame = !('type' in node) || node.type === 'frame';
        const l = node.layout;
        if (!frame && l.type !== 'absolute') ctx.addIssue({ code: 'custom', path: [...p, 'layout', 'type'], message: 'Only frames support auto-layout.' });
        for (const axis of ['width', 'height'] as const) {
          if (l[axis] === 'fill' && (!parent || parent.type !== 'auto-layout' || parent[axis] === 'hug')) ctx.addIssue({ code: 'custom', path: [...p, 'layout', axis], message: 'Fill requires a non-hug auto-layout parent on this axis.' });
          if (l[axis] === 'hug' && (('type' in node && node.type === 'rectangle') || (frame && l.type !== 'auto-layout'))) ctx.addIssue({ code: 'custom', path: [...p, 'layout', axis], message: 'Hug requires text or an auto-layout frame.' });
        }
        if ('type' in node && node.type === 'text' && l.width === 'hug' && l.height !== 'hug') ctx.addIssue({ code: 'custom', path: [...p, 'layout', 'height'], message: 'Auto-width text requires hug height.' });
        if ('nodes' in node) node.nodes.forEach((child, i) => visit(child, [...p, 'nodes', i], l, depth + 1));
      };
      visit(screen, path, undefined, 0);
    });
  });
  if (count > 500) ctx.addIssue({ code: 'custom', path: ['pages'], message: 'At most 500 rendered nodes per specification.' });
});
export type Layout = z.infer<typeof layoutSchema>;
export type NodeSpecification = z.infer<typeof nodeSpecificationSchema>;
export type ScreenSpecification = z.infer<typeof screenSpecificationSchema>;
export type DesignSpecification = z.infer<typeof designSpecificationSchema>;
export const validationResultSchema = z.object({ valid: z.boolean(), errors: z.array(z.object({ path: z.string(), message: z.string() }).strict()) }).strict();
export function validateDesignSpecification(value: unknown): z.infer<typeof validationResultSchema> {
  const result = designSpecificationSchema.safeParse(value);
  return result.success ? { valid: true, errors: [] } : { valid: false, errors: result.error.issues.map(issue => ({ path: issue.path.reduce<string>((path, part) => typeof part === 'number' ? `${path}[${part}]` : `${path}${path ? '.' : ''}${String(part)}`, ''), message: issue.message })) };
}
export function migrateDesignSpecification(value: unknown): DesignSpecification {
  if (!value || typeof value !== 'object' || !('schemaVersion' in value) || value.schemaVersion !== '1.0.0') throw new MagicUiError(failure('UNSUPPORTED_SCHEMA_VERSION', 'Only Design Specification 1.0.0 is supported.'));
  const result = designSpecificationSchema.safeParse(value);
  if (!result.success) throw new MagicUiError({ ...failure('INVALID_INPUT', 'Design specification is invalid.'), details: validateDesignSpecification(value) });
  return result.data;
}
