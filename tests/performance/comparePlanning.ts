import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { planRender } from '../../packages/shared/src/index.js';
import { planRender as before } from './baselinePlanner.js';
import { performanceFixtures } from './fixtures.js';
const rows = [];
for (const nodes of [100, 1000, 5000, 10000]) {
  const screens = performanceFixtures(nodes).specifications.map(
    (s) => s.pages[0]!.screens[0]!,
  );
  for (const screen of screens)
    assert.deepEqual(planRender(screen, []), before(screen, []));
  const oldMs: number[] = [],
    newMs: number[] = [];
  const sample = (fn: typeof planRender, target: number[]) => {
    const start = performance.now();
    screens.forEach((s) => fn(s, []));
    target.push(performance.now() - start);
  };
  for (let i = 0; i < 19; i++) {
    if (i % 2) {
      sample(before, oldMs);
      sample(planRender, newMs);
    } else {
      sample(planRender, newMs);
      sample(before, oldMs);
    }
  }
  const median = (values: number[]) =>
    [...values].slice(4).sort((a, b) => a - b)[7]!;
  rows.push({
    nodes,
    beforeMedianMs: median(oldMs),
    afterMedianMs: median(newMs),
    beforeSamplesMs: oldMs.slice(4),
    afterSamplesMs: newMs.slice(4),
    equalOutput: true,
  });
}
const path = `tests/performance/results/${new Date().toISOString().replaceAll(':', '-')}-planning-paired.json`;
await writeFile(
  path,
  JSON.stringify(
    {
      environment: { node: process.version, cpu: cpus()[0]?.model },
      methodology:
        'Alternating before/after order in one process; four warmups, 15 measured samples; deep equality checked outside timing.',
      rows,
    },
    null,
    2,
  ) + '\n',
);
process.stdout.write(
  JSON.stringify(
    rows.map(({ nodes, beforeMedianMs, afterMedianMs }) => ({
      nodes,
      beforeMedianMs,
      afterMedianMs,
    })),
    null,
    2,
  ) + `\nPassed: ${path}\n`,
);
