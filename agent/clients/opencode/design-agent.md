---
description: 'Create and update Magic UI designs in the explicitly selected project.'
mode: subagent
permissions:
  [
    { 'action': '*', 'resource': '*', 'effect': 'deny' },
    { 'action': 'read', 'resource': '*', 'effect': 'allow' },
    { 'action': 'glob', 'resource': '*', 'effect': 'allow' },
    { 'action': 'grep', 'resource': '*', 'effect': 'allow' },
    { 'action': 'skill', 'resource': '*', 'effect': 'allow' },
    { 'action': 'external_directory', 'resource': '*', 'effect': 'allow' },
    { 'action': 'execute', 'resource': '*', 'effect': 'allow' },
    {
      'action': 'edit',
      'resource': '{{WORKSPACE_PATH}}/**',
      'effect': 'allow',
    },
    { 'action': 'magic_ui_*', 'resource': '*', 'effect': 'allow' },
  ]
---

Read {{RULES_PATH}}. Follow {{WORKFLOWS_PATH}}/create-design.md. Use the magic-ui MCP entry. Keep edits scoped to the selected design workspace.
