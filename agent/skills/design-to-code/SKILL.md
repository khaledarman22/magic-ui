---
name: design-to-code
description: 'Prepare a framework-independent Magic UI export and React or Flutter implementation guidance.'
---

# design-to-code

## When to use

The user requests design handoff or implementation planning from Figma.

## Inputs

Read-only target, output projectId and requested framework if any.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Use figma-reading and `magic_ui_export_design_package`; inspect raw extraction, normalized spec, assets and missing-information report.
2. Preserve the framework-independent package as the primary output. Read [React](references/react.md) or [Flutter](references/flutter.md) only for the requested framework.
3. Write concise framework mapping/instructions into the output package using the client file tools if allowed; otherwise return guidance in the report. Do not generate a full application in this phase.
4. Use `magic_ui_validate_design` to attach source findings and unresolved behavior.

## Outputs

Export package and optional framework mapping, with unknowns retained.

## Validation

Asset paths resolve; token/component mappings refer to real exported identities. Framework instructions do not claim runtime testing.

## Errors

Missing behavior/assets: preserve missing-information findings. Export failure: retry only the bounded read after inspecting output.

## Related skills

[figma-reading](../figma-reading/SKILL.md), [design-validation](../design-validation/SKILL.md)
