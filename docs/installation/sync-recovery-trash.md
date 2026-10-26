# Phase 5 — Sync, recovery and Trash

Build with `pnpm build`, reopen the Magic UI development plugin, and reconnect with the current session token. MCP schema and plugin commands must come from the same build.

## Sync workflow

1. `magic_ui_render_design` reads the workspace specification and renders one screen with a durable operation journal. Supply `operationId` to make retries address the same operation; otherwise one is returned. Existing manual drift stops render before writes. Use preview/apply for selective updates.
2. `magic_ui_get_sync_status` and `magic_ui_preview_changes` accept `sessionId`, `projectId`, `screenId`, `pageId`. They read Figma and local state without document or workspace writes. The six statuses are `in-sync`, `spec-changed`, `figma-changed`, `conflict`, `missing-in-figma`, `orphaned`.
3. `magic_ui_apply_changes` applies `spec-changed` by default. Missing identities are reported, never silently recreated by apply. Resolve each node explicitly with `decisions: [{ "localId": "header", "decision": "keep-figma" }]` or `apply-spec`. Decisions must identify distinct nodes in this screen. No auto-merge.
4. `keep-figma` accepts the live baseline without changing visible properties and saves the desired intent and accepted snapshot as drift in `sync-state.json`. It does not rewrite the specification. Later spec edits are classified against this accepted baseline.

The local mapping records `localId`, `figmaNodeId`, `specVersion`, `lastSyncedHash`, exact intent and live snapshot. `specVersion` is the Design Spec schema version; exact intent comparison detects content revisions. The `magic_ui` shared plugin namespace stores identity, intent, owned-property hash and a separate conservative live guard. The guard additionally protects manual styles and rich text that renderer setters might affect. Hash collisions alone cannot authorize overwrites: exact guard strings are compared. Legacy renders are adopted only after validating their actual saved snapshots.

Inspect scans document pages for this project's screen identities, including moved nodes and Trash. Duplicate identities stop the operation. Reads do not change the current page or selection. Writes require the target page to remain active and use an optimistic node ID/snapshot check after preflight. Reads are sequential, not an atomic document snapshot.

## Checkpoints, cancellation and resume

`design-progress.json` stores frozen specification, operation ID, scope, decisions, report, and per-node `pending` / `done` / `skipped` records, with before/after snapshots. A step is persisted before dispatch and after completion. Recovery files are private (0600), atomically replaced, and capped at 8 MiB; specification and bridge messages retain their existing 65,536-byte limits. Oversized steps fail explicitly and leave the operation inspectable. No dependency was added.

Call `magic_ui_resume_operation` with `sessionId`, `projectId`, `operationId`, and any new per-node decisions. Resume uses the saved spec, not a possibly edited working copy. It reads actual Figma identities and guards even for locally completed steps. A committed response lost in transit is recognized without recreating its node. An incomplete mutation with drift, or a checkpointed node deleted during interruption, requires a fresh decision. Repeated resume cannot reuse an old approval to overwrite newer manual edits. A copied document with duplicate shared identities should be explicitly rebound in a future workflow; no automatic rebinding is performed.

Only one workspace mutation runs at a time. Resume an interrupted render/apply before starting another one. MCP progress notifications report completed node inspections/steps when the client supplies a progress token. MCP cancellation stops between steps, after saving the current bounded step. A lost bridge connection can still leave an uncertain final step; resume verifies Figma rather than treating the local checkpoint as proof.

`completed` means every planned node has been evaluated. Inspect the report: skipped conflicts, missing nodes and orphans remain unresolved. A completed operation can be resumed with explicit decisions. Node type replacement remains refused; it is not silently implemented as delete/recreate.

## Design-system recovery

`magic_ui_render_design_system` also returns `operationId` and accepts one for idempotent retries. Its frozen input and ordered pending/done steps are saved in `design-progress.json › systems`, alongside screen operations. `magic_ui_resume_operation` routes that ID to design-system recovery, using the newly connected session and the original page/document binding. The returned component registry is saved only after all steps finish. Screen and design-system mutations share the workspace lock; an interrupted operation must be resumed before another starts.

Checkpoints cover collection allocation, each mode, variable allocation before alias assignment, each variable/mode value, each text style, page/workspace/category scaffolding, individual component nodes and bindings, variant assembly, component properties/references, each registry entry and the final manifest. Dependencies use the same stable component IDs and dependency order as the renderer. Partial nodes are discoverable before their component is committed to the registry.

Each bridge command advances at most one checkpoint. Before every advancement or replay, the plugin re-reads actual resources and compares exact guards, ownership and parent/child structure. Figma records the operation ID, frozen spec, completed prefix and resource IDs in shared plugin data; each resource keeps its live guard. State is fragmented into values of at most 8,000 UTF-16 units using two storage slots, and the active pointer is published last. A failed fragment write leaves the previous state readable. No old user data is removed to recover space.

A response lost after commit is acknowledged before the next step runs, so the server can persist its pending checkpoint first. Reopening the plugin or restarting the MCP server does not require rerendering completed steps. A setter failure that leaves an identifiable partial resource records its actual partial state without marking the step done; retry validates that state, reuses the resource, and completes only the unfinished step. Cancellation stops between durable steps. Progress notifications include the deterministic total step count.

Manual edits, removed checkpointed resources, changed ownership, corrupt checkpoint fragments, and unrelated mutations during a step stop with `DRIFT_DETECTED`; they are never accepted merely because a local journal says done. Drift errors include the resource and bounded expected/actual snapshots, or missing/added IDs, plus the operation ID. Restore the reported checkpoint state before resuming. Screen `keep-figma`/`apply-spec` decisions do not authorize design-system resource overrides. A crash at an uncertain mutation boundary without a trustworthy resource guard also requires inspection; no speculative deletion or duplicate creation is attempted.

Legacy Phase 3 partial writes made **before** this checkpoint format remain protected by their old pending guard: the missing historical evidence cannot be reconstructed automatically. Completed legacy systems can enter the new workflow after the original live preflight passes. A failed legacy preflight does not publish an accepted baseline or grant overwrite permission on retry. The checks are sequential, not a transaction against concurrent Figma editors.

New public tools are not required: tool counts remain 23 in normal mode and 15 read-only. The internal `advanceDesignSystem` command is write-only and Main independently rejects it in a read-only session. Rebuild and reopen the plugin before using these contracts.

## Trash and cleanup policy

- `magic_ui_move_to_trash` requires screen scope, `localId`, and a non-empty `reason`. The node must be orphaned in the current spec and owned by that project/screen. User nodes are never eligible. A container with user content or still-specified descendants is refused.
- The target page is identified by shared `role=trash` and `projectId`, never by the display name. It is created as `Trash` only when needed; an existing user page named Trash is untouched.
- Metadata preserves original identity, parent ID, sibling index, coordinates and reason. No Figma `remove()` is called.
- `magic_ui_restore_from_trash` restores the same node to the saved parent and sibling position. If the parent is absent or still in Trash, restore stops and asks for that dependency to be resolved first. Auto Layout may recalculate coordinates after insertion. Descendants inside a trashed container cannot be implicitly restored by apply.
- There is **no automatic expiry, purge or permanent delete**. Trash remains until the user explicitly restores or manually manages it in Figma. This phase exposes no destructive cleanup tool.
- Completed journals can be archived manually outside the active `design-progress.json` after retaining a backup. Never delete an interrupted journal or `sync-state.json` to bypass drift. The server never silently prunes history to meet its size limit.

## Real Figma verification — Requires User Action

Run `pnpm build` then `pnpm smoke:sync` in an interactive terminal. The script creates a private temporary workspace, waits for the rebuilt plugin to connect to a scratch file, and asks before rendering the test screen. Edit its Header manually to `Manual text survives`. The script changes a different text in the spec, checks preview classification, applies, then reads both actual Figma texts through the read-only reader. It saves `sync-verification.json`, the workspace, journal and test screen for inspection. No successful live verification is implied merely by building this script.
