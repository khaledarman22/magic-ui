# Failures observed during implementation

These are recorded incidents from PROGRESS.md, not hypothetical troubleshooting claims.

| Observed failure                                                                     | Implemented correction / action                                                                                                                               |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Figma rejected `ws://127.0.0.1:3845` in `devAllowedDomains`                          | Manifest and UI use `ws://localhost:<port>` only; server still binds IPv4 loopback. Rebuild and re-import the current manifest.                               |
| Figma rejected a bundled comment containing `import()`                               | Main is minified with legal comments removed. Bundle checks prevent this import-expression regression.                                                        |
| `crypto.randomUUID` missing in the iframe                                            | `createMessageId` uses secure `crypto.getRandomValues`. The server may still use Node's randomUUID.                                                           |
| Figma replies arrived from an ancestor other than direct `parent`                    | UI accepts the trusted Figma origin as well as the expected parent, with schemas and correlation checks.                                                      |
| `Limited to 1 modes only`                                                            | The current Figma file/plan only allowed one variable mode. Light-mode evidence is valid; light/dark switching still needs a file that permits two modes.     |
| `listen EPERM 127.0.0.1` in automated runs                                           | Restricted execution blocked loopback sockets. Rerun the local integration checks with authorized loopback access; do not treat them as passed while blocked. |
| pnpm `ENOTFOUND registry.npmjs.org`                                                  | Registry access was unavailable in the restricted environment. Retry with network access.                                                                     |
| pnpm 11 `ERR_PNPM_IGNORED_BUILDS`                                                    | `pnpm-workspace.yaml` explicitly allows esbuild's build step. No global/sudo install is required.                                                             |
| `allowImportingTsExtensions` rejected during shared emit                             | Shared build config disables that option while the root supports Node-native installer TypeScript imports.                                                    |
| Trusted project path containing `magic-ui` mistaken for an existing Codex MCP server | Installer now reads official `codex mcp list --json` instead of textual config matching.                                                                      |
| Codex CLI serialization removed an unrelated `args = []`                             | Installer preserves original config text, adds only CLI-generated Magic UI tables, makes private backups and verifies readback.                               |
| OpenCode sandbox service collided with the real service                              | Verification harness reserves its own service port and HOME. It stops only that sandbox service.                                                              |
| OpenCode returned an empty agent catalog during warming                              | Discovery retries an empty list once after 250ms. An empty final result is not accepted as discovery success.                                                 |
| Codex quoted override keys did not isolate MCP                                       | Launcher uses the verified override syntax and checks both list/get outputs. Do not substitute a writable parent subagent for a standalone reader.            |
| Phase 9 read-only inventory test expected 17 tools                                   | The new read-only performance report makes the inventory 18; registration and explicit permissions are tested.                                                |
| Phase 9 audit reported Vitest/mocker and tinypool vulnerabilities                    | Vitest was upgraded from 3.2.7 to 4.1.12. The new lockfile removes tinypool; see before/after audit evidence.                                                 |

A disconnected or timed-out write may already have completed in Figma. Inspect the document and durable operation journal before resuming; never automatically replay it. Reopen the Plugin after build updates. A successful setup summary does not establish a connected Plugin or a successful agent model session.

No user credentials are needed in bug reports. Include the error code, tool name, generated correlation ID and reproduction steps; omit session.json contents and document payloads.
