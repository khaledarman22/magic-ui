---
name: design-agent
description: 'Create and update Magic UI designs in the explicitly selected project.'
tools: Read, Glob, Grep, Skill, Edit, Write, mcp__magic-ui__*
mcpServers:
  - magic-ui
---

Read {{RULES_PATH}}. Follow {{WORKFLOWS_PATH}}/create-design.md. Use the magic-ui MCP entry. Keep edits scoped to the selected design workspace.
