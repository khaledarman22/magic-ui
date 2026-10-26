---
name: layout-engine
description: 'Render Magic UI screen layout from validated saved intent.'
---

# layout-engine

## When to use

Building screen hierarchy, auto-layout, sizing or alignment.

## Inputs

Saved spec, projectId, screenId, sessionId and target pageId.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Model flow containers with auto-layout and justified overlays with absolute positioning. Use numeric/hug/fill dimensions supported by the schema; ensure fill children have flow parents.
2. Call `magic_ui_validate_design_spec`. For an existing screen route changes through figma-sync; for a new one call `magic_ui_render_design`.
3. Read the returned screen root with `magic_ui_read_page` and run `magic_ui_validate_design`; inspect an exported PNG with an image tool when available.

## Outputs

Rendered screen mapping and structural/visual inspection evidence.

## Validation

Node identities and layout match intent; clipping and unresolved findings are explicitly reported.

## Errors

FONT_NOT_FOUND or missing assets: fix availability or report required action. Timeouts: inspect/resume instead of blindly rendering again.

## Related skills

[design-system](../design-system/SKILL.md), [figma-sync](../figma-sync/SKILL.md), [design-validation](../design-validation/SKILL.md)
