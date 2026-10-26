---
name: component-management
description: 'Reuse or extend Magic UI components using the project registry.'
---

# component-management

## When to use

A reusable UI element is needed or an existing component changes.

## Inputs

Project ID, semantic role/category, properties, existing specification.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Query `magic_ui_find_component` with projectId, name, optional category and property descriptors. Compare returned similarity and actual property contracts, not only labels.
2. Inspect `magic_ui_read_components`; reuse a compatible stable component ID. Otherwise add a justified definition to the local specification.
3. Validate with `magic_ui_validate_design_spec`, then render through `magic_ui_render_design_system` and inspect the updated registry.

## Outputs

Reused or added component contract with stable IDs and usages.

## Validation

No duplicate stable identity; dependencies resolve and intended instance overrides are supported.

## Errors

Conflicting identity or drift: preserve existing component and route through update-design; do not create a duplicate to hide the conflict.

## Related skills

[design-system](../design-system/SKILL.md), [variant-management](../variant-management/SKILL.md), [figma-sync](../figma-sync/SKILL.md)
