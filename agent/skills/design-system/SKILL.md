---
name: design-system
description: 'Render and inspect Magic UI tokens, typography and reusable component foundations.'
---

# design-system

## When to use

Creating or extending a project Design System.

## Inputs

Validated project specification, sessionId and design-system pageId.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Call `magic_ui_read_variables` and `magic_ui_read_components` for the project. Compare existing stable IDs and token types with saved intent.
2. Update tokens and component definitions locally; validate using `magic_ui_validate_design_spec`.
3. Call `magic_ui_render_design_system` with sessionId, projectId and pageId; retain operationId and registry result.
4. Read variables and components again to verify actual foundations before screen rendering.

## Outputs

Figma variables/styles/components and their registry IDs.

## Validation

Counts and bindings match intent; run `magic_ui_validate_design` for structural findings and retain mode limits.

## Errors

Mode capacity or missing fonts: report the actual error and required user action. Interrupted operation: use project-recovery.

## Related skills

[component-management](../component-management/SKILL.md), [variant-management](../variant-management/SKILL.md), [design-validation](../design-validation/SKILL.md), [project-recovery](../project-recovery/SKILL.md)
