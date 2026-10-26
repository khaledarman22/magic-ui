# Phase 6: assets, project pages and presentations

Build with `pnpm build`, then reopen Magic UI in Figma. Three new MCP tools are available: `magic_ui_register_asset`, `magic_ui_prepare_project`, and `magic_ui_present_screen`. None is registered in read-only mode; Main also refuses the underlying write commands independently.

## Register and reuse assets

Put files inside the initialized project's directory. Paths passed to registration are relative to that directory, with no absolute paths, traversal or symlinks. Registration requires `projectId`, `path`, `name`, `source`, and `license`; optional `id` reserves a logical name such as `hero-image`. License text records the user's supplied provenance; it does not establish permission to use external artwork.

```json
{
  "projectId": "sample",
  "id": "hero-image",
  "path": "assets/images/hero.png",
  "name": "Hero",
  "source": "User-provided artwork",
  "license": "Owned by project owner"
}
```

PNG, JPEG and SVG are supported. Validation uses file contents, bounded regular-file reads, dimensions and structure. PNG checks chunk CRCs, compressed data and its terminal chunk; JPEG requires frame dimensions, scan data and EOI. Bounds are 8 MiB, 16384 pixels per axis and 40 million pixels. This is preflight validation, not a complete independent image decoder: Figma performs final raster decoding. Unsupported or corrupt files fail explicitly.

`assets/assets-manifest.json` stores SHA-256 of original bytes, MIME, dimensions, byte size, source, license, usage IDs, optimization status and per-document Figma resource mappings. Identical content under another name returns the existing asset ID. Registering different bytes under an existing ID is rejected; register a new ID and update the spec explicitly. Files changed after registration are rejected; reusing a stale hash is never automatic. Original files are preserved, without compression or conversion (`optimization: original`), so no quality threshold/dependency is needed.

Use the returned ID in a frame with no spec children:

```json
{
  "id": "hero",
  "name": "Hero image",
  "type": "frame",
  "assetId": "hero-image",
  "layout": { "width": 345, "height": 320 },
  "nodes": []
}
```

Images work in screens and reusable components. Normal screen render/apply/resume resolves assets through the existing per-node checkpoint workflow. Files cross the bridge in chunks of at most 8000 bytes, with an independently verified transfer hash. A document-level content-hash cache persists in shared plugin data, so repeated uses and a restarted Plugin reuse the same image. SVG bytes are sanitized on the server **before transfer** and revalidated in Main, then imported inside a reusable component on Components. Instances are placed in asset frames.

The SVG sanitizer reconstructs an intentionally limited subset: svg, g, path, rect, circle, ellipse, line, polyline and polygon. It strips script/style/foreignObject blocks and unapproved attributes, including events and external hrefs; CSS, entities, declarations, URL paints and unsupported elements fail or are omitted. It does not fetch external resources. SVGs needing text, filters, gradients or references must be converted to a supported local asset explicitly.

Unknown IDs or absent source files produce a frame labeled `Missing asset: <id>`. Results list `missingAssets` with `status: missing` and `assetsComplete: false`. A completed transport/checkpoint operation does **not** mean its missing assets are complete. Register the missing file under the same requested ID and render again: the frame keeps its identity. Generated labels are hidden, not deleted. Manual edits to generated content remain protected by sync guards.

## Project pages

Add `kind: app`, `kind: website`, or `kind: dashboard` to each spec page. Its stable `id` identifies the page, and `name` supplies the product name. IDs `components`, `references`, and `trash` are reserved for structural pages. Old specs without `kind` retain their previous explicit-current-page behavior.

Call `magic_ui_prepare_project` with the project ID and currently connected `sessionId`/`pageId`. It returns mappings for the declared product pages and Components, References, Trash, each with an Auto Layout workspace. An app-only spec creates no Web or Dashboard pages. Existing pages are reused by stored identity; unrelated user pages are preserved. Deleted/moved bound pages or workspaces are reported instead of being recreated silently.

Preparation keeps the active page unchanged. Select the returned product page and read connection status again (reconnect if needed), then call `magic_ui_render_design` with that page's ID and the screen ID. Screens render inside its workspace. Existing legacy pages are not migrated implicitly. This explicit two-step flow preserves the earlier requirement that render target the selected page.

## Presentations

Call `magic_ui_present_screen` with `sessionId`, `pageId`, `projectId`, `screenId` and `device: iphone | laptop`. The original editable frame remains in place. A presentation frame contains an instance of the shared device component; its screen slot receives a PNG exported from the original. Five screens therefore use one component and five instances.

No licensed external mockup was supplied. Built-in original geometric shapes are used and reported as `mockupSource: basic-shapes`. Their dimensions/provenance are recorded in `assets/mockups/basic-shapes.json`; existing local files are preserved. Third-party mockup import is not implicit.

The presentation stores the original node ID and rendered image SHA-256. Refresh is **explicit**: call the same tool after editing the original. Repeated refreshes reuse the same component, presentation and instance; an unchanged source does not create another preview image. Manual changes to the mockup or presentation stop the refresh. A failed partial creation preserves its identity for inspection; it never deletes or silently replaces user content. The image preview is not a second editable screen and does not automatically update between calls.

## Real Figma verification

```bash
pnpm build
pnpm smoke:assets
```

Use a scratch file. The script asks for connection, confirmation of the target, and selection of `App - Sample`. It registers one deterministic PNG fixture, renders three mobile screens, and creates three iPhone presentations sharing one component. It retains `assets-verification.json` in the printed temporary workspace and does not delete any nodes.

Inspect the images, screen slots and original frames in Figma and the Layers panel. The script's structural checks are separate from this visual inspection. Until performed, DoD #8 is **Requires User Action**.

### Verified live run — 2026-10-26

**Passed:** the real smoke test, read-only inspection, six PNG exports and visual/Layers review in [the Phase 6 scratch file](https://www.figma.com/design/mo3pQKE6Rz5W5NkyJ7twTD/Untitled?node-id=1-2).

The three source frames are 393×852; presentations are 425×900. Instances `1:17`, `1:24`, `1:31` reference the same component `1:14`. All three source image fills share `06c81b9efb466ada1dd106bdc19068887def94ff`. Evidence and previews are in `phase-6-verification/`; `visual-review.json` records the completed visual review after the original smoke report's pending marker.

To inspect a retained smoke run again without document writes:

```bash
node --import tsx scripts/inspect-assets-smoke.ts /absolute/path/to/assets-verification.json
```

Connect the Plugin with the current read-only session token when prompted. This checks the live source/instance references and image hash, exports each source and presentation, and saves `live-inspection.json` beside the supplied evidence file. Repeated inspection creates new export folders and preserves earlier evidence.
