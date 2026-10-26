# Performance evidence

Measured on Apple M2 (8 logical CPUs), darwin/arm64, Node v26.11.1. The main runner uses three warmups and nine samples, reporting median/p95 and every raw sample. Inputs and correctness assertions are outside timing. There are no machine-dependent pass/fail timing thresholds.

## Supported workload

Counts include screen roots. 1000/5000/10000 nodes are processed in independent valid specifications of at most 500 nodes, respecting the production schema. These are aggregate throughput workloads, **not support for a single 10000-node specification**. The deterministic fixture has nested frames and rectangles without tokens/assets; it is not representative of every design. A separate regression confirms unresolved/invalid token values and the node cap remain rejected.

Normalization times include the real export normalizer (projection, evidence collection and schema validation). Planning times include flattening and canonical intent serialization. Sync classification times measure the production pure classifier across mixed changed/unchanged snapshots, excluding bridge scans and workspace I/O. The bridge uses a real TCP WebSocket and fake Plugin; it is not a Figma timing.

## Three measured improvements

The three slowest baseline operations at 10000 nodes were normalization, validation and render planning. No schema/message limit was raised.

| Operation, 10000 total nodes | Baseline median ms | Final median ms | Reduction |
| ---------------------------- | -----------------: | --------------: | --------: |
| normalization                |            249.592 |          95.039 |     61.9% |
| validation                   |             90.742 |          38.618 |     57.4% |
| renderPlanning               |             37.844 |          27.562 |     27.2% |

1. Validation avoids re-parsing already checked literal node values and removes a redundant full-tree resolution pass. Referenced values still resolve and validate for every mode; unused token aliases are still checked. Incremental comparison: 90.742 → 39.469 ms.
2. Normalization validates a frame's own fields after its children have passed, preserving child-count checks and raw evidence. It avoids repeatedly cloning every descendant at every ancestor. Incremental comparison after improvement 1: 197.306 → 100.151 ms.
3. Canonical serialization appends directly instead of allocating callback arrays and reuses a bounded cache of escaped property names (256 entries, keys <=128 characters). Values/intents are not cached. Exact canonical output and sparse-array behavior remain covered. Alternating paired before/after planning at 10000 nodes: 42.737 → 31.262 ms, with deep output equality asserted before timing. The frozen baseline implementation is confined to tests/performance.

The incremental and paired measurements support keeping all three changes. Absolute times fluctuate with JIT/GC and system load. The final suite ran after other verification completed. `2026-10-26T12-17-22.775Z-current.json` ran concurrently with typecheck and is retained as a noisy sample; it is not the final comparison.

## Final logic medians (ms)

| Total nodes | Validation | Planning | Sync classification | Normalization | Serialization |
| ----------: | ---------: | -------: | ------------------: | ------------: | ------------: |
|         100 |      0.774 |    0.315 |               0.007 |         1.859 |         0.249 |
|        1000 |      5.235 |    2.736 |               0.010 |         9.638 |         1.870 |
|        5000 |     19.203 |   13.815 |               0.043 |        49.972 |        11.935 |
|       10000 |     38.618 |   27.562 |               0.073 |        95.039 |        27.899 |

## Final bridge measurement

200 measured sequential round trips after 20 warmups: median **0.077 ms**, p95 **0.114 ms**, **12149 round trips/s**. This is sequential loopback throughput, not a concurrency capacity test.

A Unicode/escaped JSON payload of **2040011 UTF-8 bytes** crossed **181** 8000-character chunks and reassembled byte-for-byte in **33.187 ms** (58.62 MiB/s). Envelopes passed real production validation. Fake Plugin generation is explicitly test-only; actual Plugin reader chunking is separately covered by reader tests.

## Reproduce and inspect

Run `pnpm test:performance` for a new timestamped JSON file. For the paired planning comparison run `node --import tsx tests/performance/comparePlanning.ts`. Run measurements without concurrent builds/tests. Generated result JSON is excluded from formatting checks so saving new evidence does not make lint fail.

- [Baseline](../../tests/performance/results/2026-10-26T12-11-27.127Z-baseline.json)
- [Validation increment](../../tests/performance/results/2026-10-26T12-11-50.504Z-validation.json)
- [Normalization increment](../../tests/performance/results/2026-10-26T12-12-29.583Z-normalization.json)
- [Paired planning comparison](../../tests/performance/results/2026-10-26T12-19-56.700Z-planning-paired.json)
- [Final full suite](../../tests/performance/results/2026-10-26T12-25-48.211Z-current.json)

## Real Figma — Requires User Action

Build, reopen the Plugin in a scratch Figma file, and run `pnpm bench:figma`. Select the exact session and type BENCH. The script creates **6100 retained nodes** across workloads of 100, 1000 and 5000 total nodes, using independent 100-node projects to respect both node and file-size budgets. It measures real render/read calls, verifies returned/read counts, saves per-workload elapsed totals and partial failures, and retains workspace paths. It never deletes user content.

These are one-sample end-to-end timings including MCP, durable workspace writes, bridge and Figma. They are not isolated renderer CPU benchmarks or a single 5000-node screen. `pnpm bench:figma --help` was tested; the actual Figma path was **not run** in Phase 9. No real Figma timing is reported here.
