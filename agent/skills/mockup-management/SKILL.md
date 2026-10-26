---
name: mockup-management
description: 'Present an existing Magic UI screen in a supported device mockup.'
---

# mockup-management

## When to use

The user requests presentation of a completed screen in a device.

## Inputs

Rendered screenId, projectId, sessionId, pageId and iphone or laptop device.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Read the rendered screen with `magic_ui_read_page` and resolve outstanding screen validation.
2. Call `magic_ui_present_screen` with explicit IDs and device. This creates basic geometric device artwork and a screen snapshot; record sourceHash and returned presentationId.
3. Export the presentation with `magic_ui_export_asset`. Refresh explicitly after source changes by calling present again.

## Outputs

Device presentation with source identity/hash and preview file.

## Validation

Verify preview content and documented refresh=explicit; mockup source is basic-shapes, not licensed third-party artwork.

## Errors

Missing source screen: render it first. Unsupported device: explain the two supported choices without pretending support.

## Related skills

[layout-engine](../layout-engine/SKILL.md), [design-validation](../design-validation/SKILL.md), [asset-management](../asset-management/SKILL.md)
