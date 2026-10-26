# Client compatibility — verified 2026-10-26

The formats below were checked against official documentation and installed CLI help before implementation. Phase 7 is closed; D9 and D11 remain Locked. The repository code and actual CLI behavior take precedence over older examples.

| Client              | Skills                                                                                                             | Agents and tool restriction                                                                                                                                                                               | Magic UI adapter                                                                                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code 2.1.310 | `<skill>/SKILL.md`, YAML name/description; user `~/.claude/skills`, project `.claude/skills`                       | Markdown with YAML name/description in `~/.claude/agents` or `.claude/agents`; `tools` is an allowlist; `mcpServers` can reference registered servers                                                     | Three agents; reader/validator allow Read/Glob/Grep/Skill plus only `mcp__magic-ui-reader__*`. Shell, local write tools and writable MCP are omitted.                                                                                                                                                         |
| Codex CLI 0.163.0   | SKILL.md with name/description; `~/.agents/skills` and repository `.agents/skills`; symlinks supported             | Standalone TOML files under `~/.codex/agents` / `.codex/agents` require name, description and developer_instructions. Current custom subagents inherit parent MCP/permissions; they cannot override them. | Native design-agent. Reader/validation TOML roles are stored outside the inherited subagent catalog, under `$CODEX_HOME/magic-ui/roles`. A standalone launcher applies verified CLI MCP overrides and a read-only filesystem sandbox. This is a separate session, not an isolated child of a writable parent. |
| OpenCode 2.1.4      | SKILL.md name/description; `~/.config/opencode/skills`, `.opencode/skills`, plus Claude/agents compatibility roots | Markdown in `~/.config/opencode/agents` / `.opencode/agents`; V2 uses `mode: subagent` and an ordered `permissions` array. Last matching rule wins.                                                       | Three agents with deny-by-default permissions and an explicit server tool pattern. Reader/validator permit only `magic_ui_reader_*`, plus local reads/skill loading and Code Mode execute.                                                                                                                    |

Sources: [Claude skills](https://code.claude.com/docs/en/skills), [Claude subagents and scoped MCP](https://code.claude.com/docs/en/sub-agents), [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Codex custom agents and inheritance limits](https://learn.chatgpt.com/docs/agent-configuration/subagents), [OpenCode V2 skills](https://opencode.ai/v2/docs/skills/), [OpenCode V2 agents](https://opencode.ai/v2/docs/agents/), [OpenCode V2 permission actions](https://opencode.ai/v2/docs/permissions/), [OpenCode MCP tool naming and Code Mode](https://opencode.ai/v2/docs/mcp-servers/).

## Confirmed CLI behavior and differences

- `codex --help`: `-c key=value`, `--no-daemon`, `--sandbox read-only`, `--cd` available. `codex agents` lists sessions, not custom definitions; it is not a discovery test.
- `claude agents --help`: manages background sessions; it does not list installed custom agent files. Inspect `/agents` and `/skills` interactively.
- `opencode debug --help`: supports `agents`, `config`, `paths`; no `debug skill` command in this version. `opencode agent --help` returns the main help, not a supported agent-install command. Use `opencode debug agents` for definitions and the runtime skill catalog for skills.
- OpenCode V1 examples use `permission` and `tools`; those are not the native V2 format. [Migration source](https://opencode.ai/v2/docs/migrate-v1/). Setup targets the installed V2 format, not an assumed shared client format.

The first OpenCode help read could not write its normal log under the restricted environment. Retrying with disposable XDG data/state/config paths succeeded; no user settings were changed by that check.

## Isolation and installation

Setup registers `magic-ui` and the separate `magic-ui-reader` via each client's official MCP CLI, with backups and readback. Reader launch arguments include `--read-only`, so the server exposes no write tools. Plugin enforcement remains independent. Client restrictions are a second layer.

The Codex launcher disables every MCP entry reported in the output workspace, enables only the reader entry, pins its process/arguments and allowlist to read-only selftest output, sets the export root, then verifies the effective configuration before launching. It preserves existing login/config files and passes overrides only to the new process. It does not install reader roles into the writable parent's subagent catalog. Repository/system policies may still reject launch; failure is reported rather than relaxing isolation.

```bash
node installers/launch-codex-reader.ts figma-reader-agent /absolute/output-directory
node installers/launch-codex-reader.ts validation-agent /absolute/output-directory
```

The output directory must already exist. Only an optional prompt follows it; arbitrary CLI overrides are not forwarded. Readers export through the constrained MCP export tools; direct file edits are unavailable in the Codex sandbox. Return additional framework notes in the report if file editing is unavailable.

Setup copies absent skill directories and agent files. Existing content, including modified skills, is never replaced. Shared rule references are resolved to the repository's canonical `agent/AGENTS.md`; keep the checkout available. Conflicts/missing artifacts in verify mode are Requires User Action. Upgrades that conflict with user edits require manual reconciliation.

## Runtime discovery checklist

File placement and parsability are separate from model discovery. DoD #6 remains Requires User Action until each installed client is opened/reloaded and confirms:

1. The twenty skill descriptions appear and a selected body can load.
2. The three roles are available through that client's adapter (standalone reader/validator launch for Codex).
3. The reader's tool list contains no writable Magic UI tools and connection status says readOnly=true.
4. For DoD #7, request “Create a simple login screen using Magic UI” in the design context and retain the actual Figma result and validation report.

## Architecture/tool-name reconciliation

Architecture §5 is a planned category table, not the runtime registry: it includes names such as `magic_ui_get_validation_report` that are not implemented. Phase 8 uses the actual `--selftest` registry (28 tools, 17 read-only). `magic_ui_validate_design` returns the report directly; no extra report-storage/getter tool is assumed. The proposed documentation reconciliation is to treat `--selftest` and the shared tool registry as authoritative and retain unimplemented table entries as planning notes. Skills are linted against executable registration.

Observed OpenCode 2.1.4 behavior: a fresh service can return an empty JSON agent array before catalog warming finishes. Discovery retries that empty response once after 250 ms. The native harness allocates a separate service port via the verified CLI and stops only its disposable service, avoiding the user's active port. Codex CLI dotted overrides do not interpret quoted path segments as TOML keys; the launcher accepts only safely representable MCP names and validates the allowlist through `mcp get`, because `mcp list` omits that field.
