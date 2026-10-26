import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  MagicUiError,
  type BridgeConnection,
  type PerformanceMeasurement,
  type PerformanceReport,
} from '@magic-ui/shared';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};
export class Observability {
  private readonly context = new AsyncLocalStorage<{
    id: string;
    sequence: number;
  }>();
  private readonly tools = new Map<string, PerformanceMeasurement>();
  private readonly commands = new Map<string, PerformanceMeasurement>();
  private readonly startedAt = new Date().toISOString();
  private readonly level: LogLevel;
  constructor(
    private readonly sink: (line: string) => void = (line) => {
      process.stderr.write(line);
    },
    level = process.env.MAGIC_UI_LOG_LEVEL ?? 'warn',
  ) {
    this.level = Object.hasOwn(levels, level) ? (level as LogLevel) : 'warn';
  }
  // Deliberately no payloads, paths, names, error messages or arbitrary metadata.
  private log(
    level: LogLevel,
    event: 'tool' | 'command',
    name: string,
    correlationId: string,
    operationId: string,
    durationMs: number,
    failed: boolean,
  ) {
    if (levels[level] < levels[this.level]) return;
    this.sink(
      JSON.stringify({
        level,
        event,
        name,
        correlationId,
        operationId,
        durationMs,
        failed,
      }) + '\n',
    );
  }
  private record(
    map: Map<string, PerformanceMeasurement>,
    name: string,
    duration: number,
    failed: boolean,
    result: unknown,
  ) {
    const record = map.get(name) ?? {
      name,
      completed: 0,
      failed: 0,
      totalMs: 0,
      maxMs: 0,
      nodes: 0,
      assets: 0,
    };
    record.completed++;
    record.failed += Number(failed);
    record.totalMs += duration;
    record.maxMs = Math.max(record.maxMs, duration);
    if (!failed && result && typeof result === 'object') {
      if (
        'nodeCount' in result &&
        typeof result.nodeCount === 'number' &&
        Number.isSafeInteger(result.nodeCount) &&
        result.nodeCount >= 0
      )
        record.nodes += result.nodeCount;
      if (name === 'magic_ui_register_asset') record.assets++;
    }
    map.set(name, record);
  }
  async tool(
    name: string,
    action: () => Promise<CallToolResult> | CallToolResult,
  ) {
    const id = randomUUID();
    return this.context.run({ id, sequence: 0 }, async () => {
      const start = performance.now();
      let failed = true;
      let result: CallToolResult | undefined;
      try {
        result = await action();
        failed = result.isError === true;
        return result;
      } finally {
        const duration = performance.now() - start;
        this.record(
          this.tools,
          name,
          duration,
          failed,
          result?.structuredContent,
        );
        this.log(
          failed ? 'warn' : 'info',
          'tool',
          name,
          id,
          id,
          duration,
          failed,
        );
      }
    });
  }
  bridge(source: BridgeConnection): BridgeConnection {
    return {
      readOnly: source.readOnly,
      status: () => source.status(),
      listSessions: () => source.listSessions(),
      withWriteLock: (action) => source.withWriteLock(action),
      request: async (sessionId, command, signal) => {
        const operation = this.context.getStore();
        const correlationId = operation
          ? `${operation.id}.${++operation.sequence}`
          : randomUUID();
        const start = performance.now();
        let failed = true;
        let result;
        let level: LogLevel = 'debug';
        try {
          result = await source.request(
            sessionId,
            command,
            signal,
            correlationId,
          );
          failed = false;
          return result;
        } catch (error) {
          level = error instanceof MagicUiError ? 'warn' : 'error';
          throw error;
        } finally {
          const duration = performance.now() - start;
          this.record(
            this.commands,
            command.command,
            duration,
            failed,
            result?.result,
          );
          this.log(
            level,
            'command',
            command.command,
            correlationId,
            operation?.id ?? correlationId,
            duration,
            failed,
          );
        }
      },
    };
  }
  report(): PerformanceReport {
    return {
      scope: 'this-mcp-process',
      startedAt: this.startedAt,
      tools: [...this.tools.values()].map((r) => ({ ...r })),
      commands: [...this.commands.values()].map((r) => ({ ...r })),
      commandRetries: 0,
      limitations: [
        'Completed validated tool callbacks only; in-flight calls and MCP schema rejections are excluded. Counters reset on restart.',
        'Command duration is end-to-end bridge latency including Plugin execution, not isolated Figma CPU time. Render tool duration includes workspace I/O and checkpoints.',
        'Node counts sum reported nodeCount values; assets count successful registrations. They are work totals, not unique document inventory.',
        'Commands are never automatically replayed. Transport reconnect attempts and other processes are not counted.',
      ],
    };
  }
}
