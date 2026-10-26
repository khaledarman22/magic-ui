---
name: reference-analysis
description: 'Analyze provided reference imagery and Figma structure into design observations.'
---

# reference-analysis

## When to use

References exist and need interpretation before a Magic UI design plan.

## Inputs

Accessible images/URLs or Figma session and node IDs, intended adaptation.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Inspect the supplied image using an available image viewer; if unavailable, state that visual analysis is unverified.
2. For Figma input call `magic_ui_read_page` with sessionId and nodeId, completing all cursor chunks. Separate measured spacing, typography and hierarchy from inferred intent.
3. Summarize reusable patterns and differences required by the brief. Preserve source links and list unknown interaction/responsive states.

## Outputs

Observed reference notes and bounded design constraints.

## Validation

Cross-check notes against actual pixels or source properties; label inferences.

## Errors

Incomplete extraction: retry a smaller subtree. Unsupported visual access: request an accessible reference and retain unknowns.

## Related skills

[reference-research](../reference-research/SKILL.md), [design-planning](../design-planning/SKILL.md)
