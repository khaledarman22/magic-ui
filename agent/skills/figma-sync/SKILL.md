---
name: figma-sync
description: 'Preview and apply explicit Magic UI design changes while preserving Figma drift.'
---

# figma-sync

## When to use

Updating a screen with existing Figma nodes or resolving a conflict.

## Inputs

projectId, screenId, pageId, sessionId, saved intent and user conflict decisions.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Call `magic_ui_get_sync_status` and `magic_ui_preview_changes` with the same explicit scope. Inspect every conflict/figma-changed/orphaned row.
2. Obtain decisions for unresolved drift: keep-figma or apply-spec keyed by localId. Preview again with those decisions.
3. Call `magic_ui_apply_changes` with the reviewed scope/decisions; retain operationId. Read sync status again and run `magic_ui_validate_design`.

## Outputs

Applied sync report, preserved identities and remaining drift.

## Validation

Completed steps match the actual report; unknown or conflicted rows are not silently counted as applied.

## Errors

Interrupted status: project-recovery. Keep-figma does not invent a rewritten local spec; record the retained intent difference.

## Related skills

[project-recovery](../project-recovery/SKILL.md), [design-validation](../design-validation/SKILL.md), [layout-engine](../layout-engine/SKILL.md)
