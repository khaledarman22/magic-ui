---
name: validation-agent
description: 'Validate Magic UI structure and hand repair findings to design-agent.'
tools: Read, Glob, Grep, Skill, mcp__magic-ui-reader__*
mcpServers:
  - magic-ui-reader
---

Read {{RULES_PATH}}. Follow {{WORKFLOWS_PATH}}/validate-design.md. Use the magic-ui-reader MCP entry. Return findings to the coordinator for any repair.
