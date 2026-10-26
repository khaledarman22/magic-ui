# Phase 4 — Read-only reader and export

## Start

```bash
pnpm build
pnpm --filter mcp-server start --read-only --selftest
pnpm --filter mcp-server start --read-only
```

Reimport/reopen the rebuilt Magic UI plugin and connect with the current session token. The ready handshake now carries the session permission. In read-only mode, write tools are absent; the bridge and Plugin Main also reject write commands with `PERMISSION_DENIED`. Export tools may write local output files but do not change the Figma document.

## Reader tools

- `magic_ui_read_document`: load all pages asynchronously and read their trees.
- `magic_ui_list_pages`: page identities only; does not load page contents.
- `magic_ui_read_page`: required `nodeId`, either a page or a subtree.
- `magic_ui_read_selection`: the current selection and descendants.
- `magic_ui_read_styles`: local styles, collections and variables.
- `magic_ui_export_asset`: `sessionId`, `nodeId`, `projectId`, `format` (`PNG`/`SVG`) and `scale`.
- `magic_ui_export_design_package`: `sessionId`, `nodeId`, `projectId`, optional `previewScale`.

All reader tools require `sessionId`. A reader result contains `data`, `encoding` and `nextCursor`. `data` is a JSON fragment, not independently parseable. Repeat the same inputs with `cursor: nextCursor`, concatenate the fragments and parse once `nextCursor` is null. A single large node or styled text can span fragments. Asset transport uses the same mechanism with base64.

Snapshots expire after five minutes and retain at most four transfers per plugin session; reconnect invalidates cursors. Each transfer is capped at 32 MiB of serialized characters and 100,000 nodes. Read smaller subtrees if the budget is exceeded. The bridge's 65,536-byte message limit is unchanged. Cancellation is checked between asynchronous reads and transfers.

The reader retains invisible descendants; it does not switch pages, select nodes, set plugin data, create resources or invoke document setters. Local resources accompany scoped node reads so bindings and styles can be resolved. Remote/unavailable dependencies are retained as references and reported. Sequential extraction is not an atomic snapshot against concurrent user edits.

## Package

Each export creates a new private `<projectId>-export-*/figma-export/` under `MAGIC_UI_WORKSPACE_ROOT` (server working directory by default), with no overwrite. Traversal IDs and symlink roots are refused. Files are mode 0600. No framework files are generated.

- `project.json`, `design-spec.json`, `tokens.json`, `components.json`, `screens.json`
- `assets/`: vectors and image-bearing nodes exported from Figma
- `previews/`: scoped roots or page children
- `reports/raw-extraction.json`: the complete scoped reading, including native IDs and unsupported source properties
- `reports/extraction-report.json`: file list, node count, asset mapping and consistency limits
- `reports/missing-information.json`: unrepresentable properties, missing references, schema limits and source properties needed for reconstruction
- `instructions/AGENTS.md`: framework-independent usage instructions

The existing Design Spec limits remain (including 500 nodes). A design beyond those limits is fully retained in the raw extraction; only valid representable subsets enter `design-spec.json`, with omissions reported. Gradients, effects, constraints, mixed typography and unknown node types are retained rather than invented. Static designs do not establish responsive or application behavior. Token categories without explicit metadata are classified from the available identity/alias information. A failed/cancelled export can leave a private partial directory; only a completed export has a final extraction report. Asset failures are reported individually.

## Real Figma verification — Requires User Action

```bash
pnpm smoke:export
```

1. Use a Figma file **not created by Magic UI**; record its version history before the test.
2. Reopen the built plugin, connect, then continue the smoke script. It starts the actual server with `--read-only` and verifies the registered tool permissions.
3. Inspect the resulting package, previews, native component properties, variable bindings and `reports/missing-information.json` against the source.
4. Check version history after export: no design modifications. This is a separate manual check; automated tests and an empty write-tool list do not prove version history.

Phase 3's light/dark verification remains deferred by the owner; passing this smoke test does not close that item.
