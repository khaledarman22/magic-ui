---
name: reference-research
description: 'Find legitimately accessible design references for a Magic UI brief.'
---

# reference-research

## When to use

The brief needs external visual references or source research.

## Inputs

Brief, brand constraints, allowed source list and available search/browser tools.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. If a web/search connector is available, search permitted public or user-authorized sources. Record the exact URL, observed details and access date. Respect access restrictions and usage terms.
2. If it is unavailable, request user-supplied references or proceed from the stated brief with research marked Not Tested. Never claim a search occurred.
3. For a supplied Figma reference accessible in the selected session, call `magic_ui_read_selection` and retain the returned structure. Route visual interpretation to reference-analysis.

## Outputs

Short sourced reference list with availability and limitations.

## Validation

Every claimed reference has an inspected source; generated imagery is not research evidence.

## Errors

Access denied or paywall: use another legitimate source or ask for authorized material. Do not bypass it.

## Related skills

[reference-analysis](../reference-analysis/SKILL.md), [design-planning](../design-planning/SKILL.md)
