---
name: mobile-design
description: 'Plan and render Magic UI mobile screens with explicit device and content constraints.'
---

# mobile-design

## When to use

A phone or tablet UI is requested.

## Inputs

Viewport dimensions, platform, language, content and required states.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Capture safe-area assumptions, touch target needs, text scale and keyboard/scroll states supported by the brief. Do not infer breakpoints from a single screenshot.
2. Express the screen using layout-engine and existing components. Validate the saved specification with `magic_ui_validate_design_spec`.
3. Render via `magic_ui_render_design` for a new screen; export a preview with `magic_ui_export_asset` and inspect at intended viewport size.

## Outputs

Mobile screen plus documented viewport and state coverage.

## Validation

Run `magic_ui_validate_design`; inspect content clipping, hierarchy and target sizes in the actual preview.

## Errors

Unknown safe area or platform behavior: record assumptions for review. Missing fonts/assets: use the relevant recovery skill.

## Related skills

[layout-engine](../layout-engine/SKILL.md), [asset-management](../asset-management/SKILL.md), [mockup-management](../mockup-management/SKILL.md), [design-validation](../design-validation/SKILL.md)
