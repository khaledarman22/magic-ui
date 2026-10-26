# Magic UI

Magic UI is a local TypeScript bridge between coding agents and Figma Desktop. It renders a saved Design Specification into editable Figma nodes, previews changes and drift, resumes interrupted operations, and exports existing designs as a framework-independent package. The MCP connection uses stdio; the Figma Plugin connects to an authenticated loopback WebSocket.

Implementation and automated checks are complete through Phase 9. **Manual acceptance is still open:** Phase 8 client/agent sessions and login workflow, real Figma performance measurements, and the earlier deferred checks listed in [PROGRESS.md](PROGRESS.md). This is not a claim that every v1 workflow has been verified interactively.

## Requirements and setup

macOS arm64 or x86_64, Node.js **24 or newer**, Git, pnpm 11.25.0 (or available Corepack pnpm), Figma Desktop, and a supported client CLI. This delivery was tested on Node 26.11.1; Node 24 itself has not been tested. Package downloads need registry access. Run from the repository directory:

```bash
./setup.command install
./setup.command verify
```

Install checks the environment, installs the locked dependencies, builds the Plugin and server, registers both writable and reader MCP entries with official client CLIs, backs up configs, and installs missing agent artifacts. Existing conflicting user files are preserved and reported. Verify checks the current installation without installing, building, or registering anything. A Plugin connection may remain **Requires User Action** even when setup exits successfully. Read the summary.

The Phase 9 clean-install check ran these commands in a fresh Git clone and disposable HOME with real client CLIs. It did not install Phase 8/9 artifacts into the user's live client configurations. See [installation details](docs/installation/multi-client-setup.md).

## Figma import and pairing

1. In Figma Desktop, open a scratch design file. Choose Plugins → Development → Import plugin from manifest and select `packages/plugin/dist/manifest.json`.
2. Run Magic UI from Development. Copy the token from your private `~/.magic-ui/session.json` into the Plugin's token field and reconnect. Do not paste the token into chat or logs.
3. Confirm the Plugin says Connected, then ask the client for `magic_ui_list_sessions`. Use the explicit session and page identifiers returned for every Figma operation.
4. After a rebuild, close and reopen the development Plugin. A custom bridge port requires matching server configuration and a rebuilt manifest.

See [import troubleshooting](docs/installation/figma-plugin-import.md) and [known failures and fixes](docs/troubleshooting/README.md).

## Quick start

Ask the agent: “Use Magic UI to initialize a project in the configured workspace and create a simple login screen. Validate the saved specification, show the target Figma session, then render and inspect it.” This is an example request; the end-to-end model-driven login acceptance remains pending.

The agent initializes a project, writes `design-spec.json`, validates it with `magic_ui_validate_design_spec`, and renders using `magic_ui_render_design`. Existing designs use preview/apply with explicit drift decisions. Read-only clients can read, validate and export the design into their allowed local output workspace.

A specification has a **500-node total limit**, and the workspace specification file has a **64 KiB limit**. Use small scopes; benchmark totals above 500 are separate projects/batches. Exports retain unsupported source properties and missing information; responsive behavior is not invented.

## Supported clients: evidence, not assumptions

| Client              | Verified                                                                                    | Still pending                                                           |
| ------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Claude Code 2.1.310 | Phase 7 real MCP registration/readback; Phase 8/9 sandbox adapter installation              | Interactive agent/skill discovery and login workflow                    |
| Codex CLI 0.163.0   | Real MCP registration; sandbox discovery of 20 skills; reader launcher configuration checks | Interactive reader and validation sessions; login workflow              |
| OpenCode 2.1.4      | Real MCP registration; sandbox discovery of three agents                                    | Interactive permission enforcement in model sessions and login workflow |

Codex's custom subagents inherit MCP configuration. Reader/validation isolation therefore uses the separate launcher documented in [client compatibility](docs/skills/client-compatibility.md). Config checks are not evidence of a completed model session.

## Development and verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm skills:lint
pnpm test:performance
pnpm audit
```

All commands above were executed for this delivery; raw results and qualifications are recorded in the [verification log](PROGRESS.md#verification-log). Performance output is saved under `tests/performance/results/`. Manual Figma benchmarking is documented separately because it has not been run for this delivery.

- [Implemented architecture and tool inventory](docs/architecture/README.md)
- [Security review and audit evidence](docs/security/review.md)
- [Adding tools/skills and running checks](docs/development/README.md)
- [Performance methodology and before/after measurements](docs/development/performance.md)
- [Final report, including unverified and unimplemented scope](docs/FINAL-REPORT.md)
