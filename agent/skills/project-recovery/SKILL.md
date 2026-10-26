---
name: project-recovery
description: 'Resume interrupted Magic UI operations or restore explicitly trashed owned nodes.'
---

# project-recovery

## When to use

A render/sync stopped, the connection was lost, or a user requests restoration.

## Inputs

Project workspace journals, operationId, sessionId and original target IDs.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Inspect the saved operation journal and `magic_ui_get_sync_status` for the original scope; confirm the same file/page.
2. Call `magic_ui_resume_operation` with sessionId, projectId and operationId from the journal; follow the actual input schema for the recorded operation.
3. For an explicitly requested restore, call `magic_ui_restore_from_trash` using the saved scope/localId. To trash an explicitly approved orphan, call `magic_ui_move_to_trash` with its scope/localId and reason.
4. Read the target and call `magic_ui_validate_design` after completion.

## Outputs

Recovered operation report or restored owned node, with preserved journal evidence.

## Validation

Completed steps and stable IDs match actual live state; no second copy of the screen/component appears.

## Errors

Missing parent, mismatched scope or legacy journal without checkpoints: stop and report required manual resolution; do not delete metadata to force success.

## Related skills

[figma-sync](../figma-sync/SKILL.md), [design-validation](../design-validation/SKILL.md)
