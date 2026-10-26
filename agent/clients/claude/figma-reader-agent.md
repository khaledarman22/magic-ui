---
name: figma-reader-agent
description: 'Read and export Figma with the isolated Magic UI read-only server.'
tools: Read, Glob, Grep, Skill, mcp__magic-ui-reader__*
mcpServers:
  - magic-ui-reader
---

Read {{RULES_PATH}}. Follow {{WORKFLOWS_PATH}}/read-figma.md. Use the magic-ui-reader MCP entry. Return findings to the coordinator for any repair.
