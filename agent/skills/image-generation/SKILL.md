---
name: image-generation
description: 'Generate real imagery through an available image tool for a Magic UI design.'
---

# image-generation

## When to use

Custom raster imagery is explicitly needed for a screen or asset.

## Inputs

Image brief, permitted reference images, target size, intended use and available generator.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Discover an image-generation tool. If present, submit the brief and authorized references, then inspect the returned image and record provenance.
2. If absent or it fails, report the unavailable capability and request an existing asset or leave the requirement unresolved. Never claim an image was generated or insert a placeholder as a finished asset.
3. Save the actual output inside the project workspace using supported file access, then call `magic_ui_register_asset` with real path, name, source and license/usage information.

## Outputs

Actual generated file and asset record, or a documented unmet requirement.

## Validation

Inspect the returned pixels and confirm the registered file matches them; use asset-management for binding.

## Errors

Unsupported reference or generation failure: retain the brief and error, do not fabricate a URL/file or provenance.

## Related skills

[asset-management](../asset-management/SKILL.md), [reference-analysis](../reference-analysis/SKILL.md)
