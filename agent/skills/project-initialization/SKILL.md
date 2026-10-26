---
name: project-initialization
description: 'Initialize a Magic UI design workspace and prepare its Figma project pages.'
---

# project-initialization

## When to use

Starting a new project before tokens or screens exist.

## Inputs

Stable projectId, projectName, chosen session and anchor page.

## Prerequisites

Load the [shared agent rules](../../AGENTS.md) and the applicable workflow.

## Steps

1. Call `magic_ui_initialize_project` with projectId and projectName; retain directory and specificationPath.
2. Read the generated specification, populate project pages and screen intent using the client file editor, then call `magic_ui_validate_design_spec` with the full specification.
3. Call `magic_ui_prepare_project` with sessionId, projectId and anchor pageId. Keep returned page IDs/workspace IDs for subsequent rendering.

## Outputs

Local project files and explicit Figma page/workspace mappings.

## Validation

Read pages with `magic_ui_list_pages`; verify returned project metadata and schema result.

## Errors

WORKSPACE_ERROR: inspect the existing project and reuse it if intended; never overwrite it to retry. NOT_CONNECTED: reconnect before page preparation.

## Related skills

[design-planning](../design-planning/SKILL.md), [design-system](../design-system/SKILL.md)
