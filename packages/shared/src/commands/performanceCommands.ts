import { z } from 'zod';
const measurementSchema = z
  .object({
    name: z.string(),
    completed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    totalMs: z.number().nonnegative(),
    maxMs: z.number().nonnegative(),
    nodes: z.number().int().nonnegative(),
    assets: z.number().int().nonnegative(),
  })
  .strict();
export const performanceReportSchema = z
  .object({
    scope: z.literal('this-mcp-process'),
    startedAt: z.string(),
    tools: z.array(measurementSchema),
    commands: z.array(measurementSchema),
    commandRetries: z.literal(0),
    limitations: z.array(z.string()),
  })
  .strict();
export type PerformanceMeasurement = z.infer<typeof measurementSchema>;
export type PerformanceReport = z.infer<typeof performanceReportSchema>;
