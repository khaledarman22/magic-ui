---
name: asset-management
description: 'Register and bind real image or SVG assets in a Magic UI design workspace.'
---

# asset-management

## When to use

A screen requires images/icons or an asset needs replacement.

## Inputs

Local workspace-relative file path, source, license, name and projectId.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Confirm an actual PNG, JPEG or supported SVG file is inside the allowed workspace; record its source and license.
2. Call `magic_ui_register_asset` with projectId, path, name, source and license. Retain returned id/hash/size; files over 8 MiB or unsupported SVG must be corrected explicitly.
3. Reference the returned assetId in supported frame nodes in the saved spec. Validate with `magic_ui_validate_design_spec`, render/update the screen and inspect missingAssets/assetsComplete.

## Outputs

Asset registry entry and actual Figma binding evidence.

## Validation

No missingAssets remain; inspect `magic_ui_validate_design` asset results and exported preview.

## Errors

Path traversal/symlinks or invalid format: copy an authorized original into the workspace using file tools. No fabricated replacements.

## Related skills

[image-generation](../image-generation/SKILL.md), [layout-engine](../layout-engine/SKILL.md), [project-recovery](../project-recovery/SKILL.md)
