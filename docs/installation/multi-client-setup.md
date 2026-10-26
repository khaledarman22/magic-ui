# Multi-client setup — Phases 7 and 8

D6, D11 and D13 were confirmed on 2026-10-26. No additional dependencies.

## Run setup

From this project:

```bash
./setup.command install
./setup.command update
./setup.command repair
./setup.command verify
```

`install` (default), `update` and `repair` validate macOS, architecture, Node >=24 and git, install the locked dependencies, rebuild, run selftest, inspect/register detected clients, validate the Plugin build and run an MCP health check. They use the checked-out source; they do not run git pull or discard local changes. Interrupted setup can be rerun. `verify` inspects existing artifacts and registrations without installing, rebuilding or registering; its health check starts a read-only server and may create/update runtime credentials. All modes leave Figma import/pairing manual.

If pnpm is absent but Corepack is present, setup invokes `corepack pnpm`; it does not install global shims. No sudo. Missing/old Node stops before configuration or installation changes. Paths with spaces are passed as individual arguments, without shell interpolation.

Registration uses the installed CLI's `--help` to confirm support. The launch command is the absolute Node executable plus `packages/mcp-server/dist/index.js`; the bridge port is registered as an environment variable. The server workspace defaults to the launching client's working directory, unless `MAGIC_UI_WORKSPACE_ROOT` is set. For a custom port, set `MAGIC_UI_BRIDGE_PORT` before setup so the build, health check and registrations agree.

Verified on 2026-10-26 against the actual installed clients:

- Claude Code 2.1.310: `claude mcp add --scope user magic-ui --env MAGIC_UI_BRIDGE_PORT=3845 -- <node> <server>`.
- Codex CLI 0.163.0: `codex mcp add magic-ui --env MAGIC_UI_BRIDGE_PORT=3845 -- <node> <server>`; inspect with `codex mcp get magic-ui --json`.
- OpenCode v2.1.4: `opencode mcp add --global magic-ui --env MAGIC_UI_BRIDGE_PORT=3845 -- <node> <server>`.

The Codex syntax also matches [official MCP documentation](https://learn.chatgpt.com/docs/extend/mcp). Local `--help` and disposable-HOME CLI runs are the primary verification for all three clients. No hand-edited config fallback is needed for these supported versions: each supplies a noninteractive registration CLI. Unsupported CLI variants, JSONC/legacy OpenCode configuration, custom Claude configuration paths and custom OpenCode config overrides are preserved and reported for manual review; setup does not guess their format or silently migrate them. Missing clients are reported as Requires User Action.

Before registration, each existing config is backed up to a timestamped `.magic-ui-backup-*` file created with mode 0600. Matching registrations are left unchanged. A Magic UI entry with different command, arguments, port or disabled state is preserved and reported for review. Other servers are never removed. Codex absence is confirmed with `codex mcp list --json`, so a trusted project path containing `magic-ui` is not mistaken for registration. Since the Codex CLI can normalize unrelated entries (including dropping `args = []`), setup keeps its newly generated Magic UI tables and atomically restores all original configuration text around them. Unsupported output or a failed registration restores the original snapshot; the timestamped backup remains available. Phase 8 additionally registers `magic-ui-reader` with `--read-only`, then installs absent skills and client-specific agents. Existing user artifacts are preserved and conflicts are reported. See [client compatibility](../skills/client-compatibility.md) for formats and the standalone Codex reader adapter.

## Plugin and multiple files

In Figma Desktop use Plugins → Development → Import plugin from manifest and choose the printed `packages/plugin/dist/manifest.json`. Open Magic UI in each intended file. Pair with the token stored privately in `~/.magic-ui/session.json`; never paste it into chat or logs. Existing Plugin storage continues to work across server restarts.

`magic_ui_list_sessions` returns every connected session's ID, file name and page. Names/pages are refreshed by the heartbeat (normally within five seconds). Figma tools retain their existing mandatory `sessionId`, including with only one file open. With several sessions, connection status reports `connected: true` and null singular session/document fields; no default file is chosen. Local workspace tools such as asset registration do not target a Figma session.

The first server to bind the configured loopback port owns the hub. Later stdio servers authenticate to its `/peer` endpoint. Plugin and peer protocols are separately validated; browser origins cannot use `/peer`. Requests, responses and cancellation have correlation IDs; replies cannot cross sockets or sessions. Clients keep their own allowed workspace roots. A shared hub write lock covers full render/sync operations and other writing tools, so concurrent writers receive SESSION_BUSY rather than racing workspace files. Reads remain concurrent.

Read-only clients omit writing tools and reject write commands. The hub propagates read-only permission on each command and Plugin Main checks it independently, even when another client uses the same writable hub. All clients must use this Phase 7 server/Plugin build; an older hub cannot handle the peer protocol.

When the hub exits, surviving clients compete for the port and reconnect. Plugin UI reconnects with backoff. In-flight requests fail with NOT_CONNECTED and are never replayed. A write may already have completed: inspect live state and explicitly resume a checkpointed operation where appropriate. A multi-step write retains its connection generation and cannot silently continue on a new hub. Session IDs can change after Plugin reconnect; list them again.

## Credentials and rotation

Credentials persist after shutdown. Creation publishes a complete private file atomically; concurrent creators reuse one random 256-bit token. Directory mode must be 0700 and file mode 0600, owned by the current user. Invalid JSON, symlinks or insecure permissions are refused without overwriting the file. Hub PID/port metadata changes without changing the token.

Stop **all** Magic UI MCP instances, then run:

```bash
node packages/mcp-server/dist/index.js --rotate-token
```

Rotation refuses live instance leases or an occupied bridge port, acquires a rotation gate, replaces the token atomically, then releases the port. Copy the new private token into each Plugin to pair again. Dead PID leases from crashed processes do not block rotation; they contain no secrets. If rotation itself is killed and leaves `rotate.lock`, stop all instances and inspect the lock before manually removing only that stale gate. Do not remove session.json to troubleshoot: that would discard the pairing secret.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm skills:lint
pnpm --filter mcp-server start --selftest
pnpm --filter mcp-server start --read-only --selftest
node --import tsx scripts/verify-setup-sandbox.ts
node --import tsx scripts/verify-agent-clients.ts
```

`tests/setup.test.ts` uses test-only client/package-manager fixtures and real MCP startup in a temporary HOME and copied project path containing spaces. It checks duplicate registration, backup contents, interrupted registration repair, verify mode, and missing/old Node. The separate `verify-setup-sandbox.ts` copies the project and dependencies and runs the **real** pnpm install/build and all three installed CLIs twice against disposable configurations. It checks byte-identical configs after rerun, other server entries and backups; it deletes only its temporary directory on success and retains it for inspection on failure. This is separate from applying setup to the user's real configuration, which requires explicit approval for Phase 7 DoD #8.

## Phase 8 agent installation and checks

Each new MCP entry receives its own backup before CLI registration. Skills are copied to the documented discovery roots; support files remain with each skill, and shared rules link to this checkout. No user skill or agent is overwritten, including during update/repair. `verify` reports missing or divergent content without creating it.

Setup performs model-free discovery where the installed client exposes it: Codex app-server `skills/list` and OpenCode `debug agents`. Claude catalog inspection remains manual. Native discovery does not prove that a model selected a skill or that a live reader tool pool is isolated; complete the interactive checklist in the compatibility guide.

Codex reader and validation use separate standalone sessions because custom subagents inherit the parent's MCP servers. From the repository, with an existing output directory:

```bash
node installers/launch-codex-reader.ts --check figma-reader-agent /absolute/output-directory
node installers/launch-codex-reader.ts figma-reader-agent /absolute/output-directory
node installers/launch-codex-reader.ts validation-agent /absolute/output-directory
```

`--check` verifies effective MCP configuration and the read-only tool allowlist without a model call. It does not write the user's config. The launcher fails closed for MCP names that cannot be safely represented in this CLI's dotted override syntax.

`magic_ui_validate_design` reports `passed`, `failed`, `warnings` and `unverified` for the live document or requested subtree. It resolves image and variable references through Figma APIs, reads missing-font status, checks component registries/identities and instances, and checks layout and text clipping bounds. Fixed-size text's internal glyph overflow and visual comparison remain unverified. An absent dependency outside a subtree is unverified rather than incorrectly reported deleted. Findings never authorize automatic repair; use the validation workflow to return them to design-agent.
