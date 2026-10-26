---
name: performance-optimization
description: 'Inspect and improve Magic UI design complexity with measured evidence.'
---

# performance-optimization

## When to use

A design render/read is slow or the user requests a performance review.

## Inputs

Affected scope, observed latency, node counts and authorized optimization target.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Read the smallest relevant subtree with `magic_ui_read_page`; count nodes and repeated structures from the completed snapshot. Read `magic_ui_get_performance_report` before and after the operation for process-local timing/failure counters; bridge timings include Plugin work. For reproducible local benchmarks use the development performance guide; in-Figma timings require the manual benchmark.
2. Use `magic_ui_find_component` to identify reusable structures and inspect excessive nesting/assets. Propose only changes supported by observed complexity.
3. Apply accepted intent changes through figma-sync; run `magic_ui_validate_design` and repeat the same measurement. Never claim in-Figma speed from a unit benchmark.

## Outputs

Before/after measurements, scoped design changes and limitations.

## Validation

Compare like-for-like scope and environment; preserve appearance using actual preview inspection when possible.

## Errors

Missing timing data: record node counts only. Read budget exceeded: split the scope instead of removing content.

## Related skills

[component-management](../component-management/SKILL.md), [figma-sync](../figma-sync/SKILL.md), [design-validation](../design-validation/SKILL.md)
