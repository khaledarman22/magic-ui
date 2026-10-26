---
name: variant-management
description: 'Define and verify Magic UI component variants and supported overrides.'
---

# variant-management

## When to use

A component needs sizes, states, themes or other explicit variant axes.

## Inputs

Existing component ID, variant values/property definitions and intended state coverage.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Inspect `magic_ui_read_components` for current variants and property keys.
2. Update the component variants in the saved spec, retaining stable variant IDs and using unique combinations. Keep runtime interaction behavior separate from visual states.
3. Call `magic_ui_validate_design_spec` then `magic_ui_render_design_system`; inspect `magic_ui_read_components` again and render the requested screen instances through layout-engine.

## Outputs

Variant matrix and verified registry property/variant mapping.

## Validation

Every requested state exists exactly once and instance references use returned identities.

## Errors

Unsupported override types or missing variants: correct the spec or explain the gap; do not claim unrepresented behavior.

## Related skills

[component-management](../component-management/SKILL.md), [layout-engine](../layout-engine/SKILL.md), [design-validation](../design-validation/SKILL.md)
