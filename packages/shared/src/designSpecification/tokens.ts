import { z } from 'zod';
export const tokenReferenceSchema = z.object({ token: z.string().min(1).max(160) }).strict();
export type TokenReference = z.infer<typeof tokenReferenceSchema>;
export const tokenSchemaDefinition = z.object({
  id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,159}$/),
  type: z.enum(['color', 'number', 'string']),
  category: z.enum(['primitive', 'semantic', 'spacing', 'radius', 'typography']),
  values: z.record(z.string(), z.union([z.string(), z.number().finite(), tokenReferenceSchema])),
}).strict();
export const typographyTokenSchema = z.object({
  id: z.string().min(1).max(160), name: z.string().min(1),
  fontFamily: z.string().min(1), fontStyle: z.string().min(1),
  fontSize: z.number().positive(), lineHeight: z.union([z.literal('auto'), z.number().positive()]).default('auto'),
  letterSpacing: z.number().default(0),
}).strict();
export const tokensSchema = z.object({
  modes: z.array(z.string().min(1).max(40)).min(1).max(4).default(['light']),
  values: z.array(tokenSchemaDefinition).max(200).default([]),
  typography: z.array(typographyTokenSchema).max(100).default([]),
}).strict();
export type Tokens = z.infer<typeof tokensSchema>;
export type Resolved<T> = T extends TokenReference ? never : T extends readonly (infer V)[] ? Resolved<V>[] : T extends object ? { [K in keyof T]: Resolved<T[K]> } : T;
export function resolveToken(tokens: Tokens, id: string, mode = tokens.modes[0]!, visiting = new Set<string>()): string | number {
  if (visiting.has(id)) throw new Error(`Circular token alias: ${id}`);
  const token = tokens.values.find(t => t.id === id);
  if (!token) throw new Error(`Unknown token: ${id}`);
  const value = token.values[mode];
  if (value === undefined) throw new Error(`Missing mode ${mode} for token ${id}`);
  visiting.add(id);
  const resolved = typeof value === 'object' ? resolveToken(tokens, value.token, mode, visiting) : value;
  if (typeof value === 'object' && tokens.values.find(t => t.id === value.token)?.type !== token.type) throw new Error(`Alias type mismatch: ${id}`);
  if (token.type === 'number' ? typeof resolved !== 'number' : typeof resolved !== 'string') throw new Error(`Token type mismatch: ${id}`);
  if (token.type === 'color' && !/^#[0-9a-fA-F]{6}$/.test(String(resolved))) throw new Error(`Invalid color: ${id}`);
  return resolved;
}
export function resolveTokenReferences<T>(value: T, tokens: Tokens, mode = tokens.modes[0]!): Resolved<T> {
  if (value && typeof value === 'object') {
    if ('token' in value) return resolveToken(tokens, String(value.token), mode) as Resolved<T>;
    if (Array.isArray(value)) return value.map(v => resolveTokenReferences(v, tokens, mode)) as Resolved<T>;
    return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, resolveTokenReferences(v, tokens, mode)])) as Resolved<T>;
  }
  return value as Resolved<T>;
}
