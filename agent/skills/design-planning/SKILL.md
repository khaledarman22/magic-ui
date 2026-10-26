---
name: design-planning
description: 'Turn a Magic UI brief into a framework-independent Design Spec plan.'
---

# design-planning

## When to use

Before implementing screens or changing a project structure.

## Inputs

Brief, existing project/spec, content, target dimensions, language and reference observations.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Map pages, screens, states, stable IDs, token needs and component dependencies. Record missing content/behavior.
2. Read `magic_ui_read_components` for the project and plan reuse.
3. Edit the workspace specification against the repository JSON Schema, then call `magic_ui_validate_design_spec`. Resolve schema field paths before rendering. Route tokens/components to design-system and screen layout to the relevant domain skill.

## Outputs

Validated saved specification and ordered implementation plan.

## Validation

Schema validation succeeds; each screen references known tokens/components and required content.

## Errors

Unknown product behavior: ask a targeted question. INVALID_INPUT: correct the reported field paths without discarding existing identity.

## Related skills

[design-system](../design-system/SKILL.md), [layout-engine](../layout-engine/SKILL.md), [mobile-design](../mobile-design/SKILL.md), [web-design](../web-design/SKILL.md), [dashboard-design](../dashboard-design/SKILL.md)
