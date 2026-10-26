---
name: web-design
description: 'Plan and render Magic UI web screens with explicit responsive intent.'
---

# web-design

## When to use

A website or web application screen is requested.

## Inputs

Content hierarchy, target widths, brand constraints and required interactions.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Plan navigation, content order and component reuse at supplied widths. Record unknown responsive behavior.
2. Use layout-engine for containers and components; call `magic_ui_validate_design_spec` before `magic_ui_render_design` on a new screen.
3. Export each requested viewport using `magic_ui_export_asset` and inspect readable line lengths, alignment and navigation states.

## Outputs

Web screen designs and explicitly supported viewport/state notes.

## Validation

Run `magic_ui_validate_design`; compare the rendered views against the brief without inventing unseen breakpoints.

## Errors

Unsupported layout features: document the gap and use supported intent only. Existing design changes go through figma-sync.

## Related skills

[layout-engine](../layout-engine/SKILL.md), [component-management](../component-management/SKILL.md), [design-validation](../design-validation/SKILL.md)
