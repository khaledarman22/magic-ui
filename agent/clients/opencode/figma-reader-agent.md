---
description: 'Read and export Figma with the isolated Magic UI read-only server.'
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
    { 'action': 'magic_ui_reader_*', 'resource': '*', 'effect': 'allow' },
  ]
---

Read {{RULES_PATH}}. Follow {{WORKFLOWS_PATH}}/read-figma.md. Use the magic-ui-reader MCP entry. Return findings to the coordinator for any repair.
