---
name: figma-reading
description: 'Read or export Figma structure using Magic UI read-only tools.'
---

# figma-reading

## When to use

Inspecting a design or creating a framework-independent handoff without Figma mutations.

## Inputs

Read-only session, target node/scope and output projectId.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Call `magic_ui_list_pages` or `magic_ui_read_selection` to confirm scope. Read targeted structure using `magic_ui_read_page`; concatenate data across nextCursor chunks before JSON parsing.
2. Read project resources through `magic_ui_read_components`, `magic_ui_read_variables` and `magic_ui_read_styles` as needed.
3. For a complete handoff call `magic_ui_export_design_package` with sessionId, nodeId and projectId. Inspect returned files and reports/missing-information.json.

## Outputs

Raw extraction or export directory with spec, resources, previews and missing-information report.

## Validation

Run `magic_ui_validate_design` on the source; review missingCount and sequential-snapshot consistency limits.

## Errors

Expired cursor: restart the bounded read, never combine snapshots. MESSAGE_TOO_LARGE: use a smaller subtree.

## Related skills

[design-to-code](../design-to-code/SKILL.md), [design-validation](../design-validation/SKILL.md)
