import assert from 'node:assert/strict';
import { cpus, platform, arch } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import {
  canonicalJson,
  classifySync,
  designSpecificationSchema,
  planRender,
} from '../../packages/shared/src/index.js';
import { normalizeFigma } from '../../packages/mcp-server/src/figmaNormalization.js';
import { collectFigma } from '../../packages/mcp-server/src/figmaExport.js';
import { BridgeServer } from '../../packages/mcp-server/src/bridgeServer.js';
import { FakePluginClient } from '../../scripts/fake-plugin-client.js';
import { performanceFixtures } from './fixtures.js';

const label = process.argv[2] ?? 'current';
assert(/^[a-z0-9-]+$/.test(label));
const samples = 9;
function measure(action: () => unknown) {
  for (let i = 0; i < 3; i++) action();
  const timings = Array.from({ length: samples }, () => {
    const start = performance.now();
    action();
    return performance.now() - start;
  });
  const ordered = [...timings].sort((a, b) => a - b);
  return {
    medianMs: ordered[Math.floor(samples / 2)]!,
    p95Ms: ordered[Math.ceil(samples * 0.95) - 1]!,
    samplesMs: timings,
  };
}
const logic = [];
for (const nodes of [100, 1000, 5000, 10000]) {
  const { specifications, extractions } = performanceFixtures(nodes);
  const screens = specifications.map((s) => s.pages[0]!.screens[0]!);
  const entries = screens.flatMap((s) => planRender(s, []).operations);
  assert.equal(entries.length, nodes);
  extractions.forEach((e, i) =>
    assert.equal(
      planRender(
        normalizeFigma(e, `bench-${i * 500}`).specification.pages[0]!
          .screens[0]!,
        [],
      ).operations.length,
      e.nodes.length,
    ),
  );
  const actions = {
    validation: () =>
      specifications.forEach((s) => designSpecificationSchema.parse(s)),
    renderPlanning: () => screens.forEach((s) => planRender(s, [])),
    syncClassification: () =>
      entries.forEach((e, i) =>
        classifySync(
          e.intent,
          i % 3 ? e.intent : 'previous',
          'snapshot',
          i % 4 ? 'snapshot' : 'old',
        ),
      ),
    normalization: () =>
      extractions.forEach((e, i) => normalizeFigma(e, `bench-${i * 500}`)),
    serialization: () => canonicalJson(specifications),
  };
  for (const [operation, action] of Object.entries(actions)) {
    const result = {
      nodes,
      specificationBatches: specifications.length,
      operation,
      ...measure(action),
    };
    logic.push(result);
    process.stdout.write(
      `${nodes} ${operation}: ${result.medianMs.toFixed(3)} ms\n`,
    );
  }
}
const token = randomBytes(32).toString('hex');
const bridge = new BridgeServer({ token, port: 0, heartbeatMs: 60000 });
const port = await bridge.start();
// Unicode and escaping exercise the real 64 KiB envelope boundary.
const payload = JSON.stringify({ text: 'مرحبا "\\\n'.repeat(120000) });
const plugin = new FakePluginClient(
  `ws://127.0.0.1:${port}`,
  token,
  async (command) => {
    assert.equal(command.command, 'readFigma');
    if (command.command !== 'readFigma') throw new Error('Unexpected command');
    const start = Number(command.input.cursor ?? 0),
      end = Math.min(start + 8000, payload.length);
    return {
      command: 'readFigma',
      result: {
        data: payload.slice(start, end),
        nextCursor: end < payload.length ? String(end) : null,
        encoding: 'json',
      },
    };
  },
);
let bridgeResult;
try {
  await plugin.connect();
  const latencyMs = [];
  for (let i = 0; i < 220; i++) {
    const start = performance.now();
    await bridge.request(plugin.sessionId, { command: 'ping', input: {} });
    if (i >= 20) latencyMs.push(performance.now() - start);
  }
  const start = performance.now();
  const result = await collectFigma(
    bridge,
    plugin.sessionId,
    { scope: 'document', format: 'PNG', scale: 1 },
    new AbortController().signal,
  );
  assert.equal(result, payload);
  const chunkMs = performance.now() - start;
  bridgeResult = {
    transport: 'real loopback WebSocket with fake Plugin',
    latencySamplesMs: latencyMs,
    sequentialRoundTripsPerSecond:
      (1000 * latencyMs.length) / latencyMs.reduce((a, b) => a + b, 0),
    chunking: {
      bytes: Buffer.byteLength(payload),
      chunks: Math.ceil(payload.length / 8000),
      durationMs: chunkMs,
      bytesPerSecond: (Buffer.byteLength(payload) * 1000) / chunkMs,
      exactReassembly: true,
    },
  };
} finally {
  await plugin.disconnect();
  await bridge.close();
}
const recordedAt = new Date().toISOString();
const output = {
  recordedAt,
  label,
  environment: {
    node: process.version,
    cpu: cpus()[0]?.model,
    cpuCount: cpus().length,
    platform: platform(),
    arch: arch(),
  },
  methodology: {
    samples,
    warmup: 3,
    units: 'milliseconds per full workload',
    specificationLimit: 500,
    note: '1000–10000 total nodes processed in valid batches, not a single supported specification. Fixture generation and correctness checks excluded from timing; no Figma API time.',
  },
  logic,
  bridge: bridgeResult,
};
await mkdir('tests/performance/results', { recursive: true });
const path = `tests/performance/results/${recordedAt.replaceAll(':', '-')}-${label}.json`;
await writeFile(path, JSON.stringify(output, null, 2) + '\n');
process.stdout.write(`Passed: ${path}\n`);
