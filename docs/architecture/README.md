# Implemented architecture — Phase 9

This is the implementation reference. [ARCHITECTURE.md](../ARCHITECTURE.md) retains the original design and Locked decisions D1–D13; it is not rewritten to pretend proposed tools exist. No Locked decision changed in Phase 9.

## Boundaries and ownership

`packages/shared` owns Zod contracts, message envelopes, permissions, schema version 1.0.0, canonical intent fingerprints, planning and sync classification. `packages/mcp-server` owns stdio MCP, the elected WebSocket hub/peer transport, local workspace I/O, export normalization, validation and metrics. `packages/plugin` owns the Preact connection UI and Figma Main command handlers, renderer, reader, assets and checkpoints. Main has no network or DOM; only the iframe connects to WebSocket.

The first server instance binding `127.0.0.1:3845` becomes hub. Other instances authenticate on `/peer`. On hub loss, a survivor elects a new hub; in-flight writes are not replayed. Per-client read-only flags cross the hub and are checked again in Main. The hub holds a write lease across multi-step changes. Session identity is explicit; multiple connected documents do not select a default. Page/document changes are checked before writes.

Credentials are a persistent random 256-bit token in `~/.magic-ui/session.json`, mode 0600, inside a 0700 directory. Instance leases coordinate startup/rotation. The Plugin stores the token in `figma.clientStorage`. Rotation requires all instances to stop. Token values are never logged.

## Data and limits

The actual specification uses `pages[].screens[].nodes`, not the original architecture's illustrative `children`. Node kinds are frame, rectangle, text and component-instance. IDs are stable and stored with shared Plugin data namespace `magic_ui`. Variables, text styles, component properties, selected variants, instance overrides, frame asset bindings and declared project pages are implemented.

There are at most 500 nodes across a specification's screens/components, 500 direct children, and 32 nesting levels. Local specification/registry reads are limited to 65536 bytes. Recovery histories are limited to 8 MiB. Bridge envelopes are limited to 65536 bytes. Reader snapshots use 8000-character chunks, at most four cached snapshots, a five-minute TTL and a 32 Mi-character budget, plus a 100000-node extraction limit. These are code-unit budgets where implemented as string length, not a promise about heap bytes. Asset uploads use bounded chunks; source assets are at most 8 MiB, 16384 pixels per axis and 40 million pixels.

Workspace folders are created when needed. `design-progress.json` records durable operations, and `sync-state.json` records baseline snapshots. A preview classifies in-sync, spec-changed, figma-changed, conflict, missing-in-figma and orphaned identities. Explicit decisions preserve manual changes. Trash preserves generated content; no automatic purge. Component recovery advances durable token/component/node checkpoints. Changing node type remains unsupported without an explicit migration path.

## Actual MCP tools

There are 29 tools in normal mode and 18 in read-only mode. The inventory is defined by `packages/shared/src/protocol/constants.ts` and verified against the actual SDK registration in selftest/tests.

| Category               | Tools (all names prefixed `magic_ui_`)                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connection/diagnostics | `get_connection_status`, `list_sessions`, `get_performance_report`                                                                                                     |
| Workspace/spec         | `initialize_project`, `validate_design_spec`, `find_component`                                                                                                         |
| Creation/assets        | `create_frame`, `render_design`, `render_design_system`, `register_asset`, `prepare_project`, `present_screen`                                                         |
| Reader/export          | `read_node`, `read_document`, `list_pages`, `read_page`, `read_selection`, `read_styles`, `read_components`, `read_variables`, `export_asset`, `export_design_package` |
| Sync/recovery          | `get_sync_status`, `preview_changes`, `apply_changes`, `resume_operation`, `move_to_trash`, `restore_from_trash`                                                       |
| Structural validation  | `validate_design`                                                                                                                                                      |

`get_project_status`, `list_projects`, the generic low-level page/component/instance/layout tools, `get_asset`, and `get_validation_report` in the original architecture table are not registered. Existing render/preparation/reader operations supply the implemented paths. Validation returns its report directly; there is no stored-report retrieval API.

## Observability

`Observability` creates a generated operation UUID per validated MCP callback. Every bridge command receives `<operation UUID>.<sequence>` as its correlationId; that exact ID is retained by peer, hub, UI and Main result/cancellation. Duplicate active correlation IDs are rejected before replacing pending work.

`MAGIC_UI_LOG_LEVEL=debug|info|warn|error` selects JSON logs on stderr; default is warn. Tool outcomes use info/warn, command timings use debug/warn/error. Logs contain only fixed event/tool/command names, generated IDs, numeric duration and a failure flag. No argument, document name, path, error message, or token is logged. Startup diagnostics also use stderr. `--selftest` prints names to stdout as an explicit non-MCP CLI mode.

The read-only performance report holds bounded aggregates by registered tool/command for this MCP process. It reports completed callbacks, failures, total/max elapsed time, returned nodeCount totals and successful asset registrations. Command latency includes Plugin execution; render duration includes workspace I/O. It excludes in-flight work, SDK input rejections, other clients, Figma CPU-only timing and transport reconnect counts. Automatic command retry count is zero because commands are never replayed. No recent payload history is retained.

## Known gaps from the original design

Plugin UI currently implements pairing, connection state and errors; it is not a full project/progress/settings application. Full code generators, automated visual diff, reference-search services and image generation are not included. Agent skills describe how to use available external tools and disclose their absence. The reader preserves raw evidence where normalization cannot represent the source. Structural validation leaves visual comparison unverified. See the final report for manual acceptance gaps.
