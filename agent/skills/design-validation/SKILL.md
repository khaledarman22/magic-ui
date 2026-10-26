---
name: design-validation
description: 'Structurally validate a live Magic UI design and report unverified visual checks.'
---

# design-validation

## When to use

Reviewing a screen, checking a render, or verifying a repair.

## Inputs

Read-only session and optional target nodeId; brief or expected visual reference when available.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Call `magic_ui_validate_design` with sessionId and optional nodeId. Keep passed, failed, warnings and unverified separate.
2. Inspect a PNG from `magic_ui_export_asset` with an image viewer when available; describe only observations. A manual visual inspection does not convert the engine visual-comparison check to Passed.
3. Hand failed check codes, node IDs and proposed corrections to the design-agent using the validate-design workflow. Re-run the same scope after authorized repair.

## Outputs

Structural report, visual observations if inspected, and precise repair handoff.

## Validation

Missing metrics, out-of-scope dependencies and visual comparison remain unverified. No writes are required for checking.

## Errors

Disconnected session: reconnect and rerun read. Malformed snapshot or API error: report failure, not an empty passing report.

## Related skills

[figma-reading](../figma-reading/SKILL.md), [figma-sync](../figma-sync/SKILL.md), [project-recovery](../project-recovery/SKILL.md)
