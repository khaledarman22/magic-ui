---
name: dashboard-design
description: 'Plan and render Magic UI dashboards with honest data and explicit states.'
---

# dashboard-design

## When to use

A dashboard, analytics screen or operational console is requested.

## Inputs

Audience, decisions supported, real authorized data or clearly labeled sample design content, states and density.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Arrange summary metrics, primary analysis and detailed records according to the task. Record data provenance; no fabricated live statistics.
2. Reuse component-management for filters, navigation and tables; express supported shapes/text in the specification. Actual data processing is outside Magic UI.
3. Validate using `magic_ui_validate_design_spec`, render new screens with `magic_ui_render_design`, then inspect exported previews.

## Outputs

Dashboard structure and data/state assumptions attached to the design.

## Validation

Run `magic_ui_validate_design`; inspect labels, units, empty/error states and text fit.

## Errors

Unavailable source data: ask for it or explicitly label illustrative design content; never imply a connected live dashboard.

## Related skills

[web-design](../web-design/SKILL.md), [layout-engine](../layout-engine/SKILL.md), [component-management](../component-management/SKILL.md), [design-validation](../design-validation/SKILL.md)
