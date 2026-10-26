# Development

Read AGENTS.md, PROGRESS.md and the current phase prompt first. Decisions D1–D13 remain Locked. Shared contracts belong in `packages/shared`; test doubles belong in `tests/` or `scripts/`.

## Add an MCP tool

1. Define input/output Zod schemas and types in shared and export them from its index. Reuse an existing operation where possible.
2. If a Figma command is needed, extend the shared command/result union, assign its explicit read/write permission, and implement it in Plugin Main's handler dispatch. Keep browser networking in the Plugin UI.
3. Register through `registerTool` inside `createMcpServer` so observability wraps the SDK-validated callback. Include description, input/output schema, annotations, error codes and timeout metadata. Wrap writes in the shared write lease; omit write registrations entirely under read-only.
4. Use the instrumented bridge for every request. Forward AbortSignal, preserve the generated correlation ID and return typed errors without secret-bearing payloads. Multi-step work needs checkpoints and explicit recovery rather than blind retries.
5. Update TOOL_NAMES in registration order. Verify normal/read-only discovery, malformed inputs, permission enforcement in Main, cancellation and a meaningful round trip using the real bridge/harness. Never infer Figma compatibility from a harness test alone.

## Add or maintain a skill

Create `agent/skills/<name>/SKILL.md` with discovery frontmatter and the existing When to use, Inputs, Prerequisites, Steps, Outputs, Validation, Errors and Related skills sections. Link shared rules instead of copying them. Reference only registered MCP names; disclose missing external tools. Keep workflows as composition of skills. Run `pnpm skills:lint`, then client catalog/config verification in disposable HOME. Interactive model sessions remain a separate acceptance check. Installation preserves conflicting user artifacts.

## Checks

- `pnpm typecheck`: strict TypeScript, including Figma Main separately.
- `pnpm lint`: ESLint and Prettier; no explicit any without documented cause.
- `pnpm test`: Vitest 4.1.12; real loopback networking and temporary filesystem/config fixtures. Tests are not real Figma acceptance. Plugin bundle tests need a built artifact; setup tests also build it.
- `pnpm build`: shared declarations, MCP bundle, Plugin manifest/Main/UI. The two known Zod `@__PURE__` warnings do not prevent output.
- `pnpm test:performance`: measured logic and real-WebSocket/fake-Plugin benchmarks, JSON results, no wall-clock threshold assertions.
- `pnpm bench:figma --help`: manual benchmark instructions without starting a server or mutating Figma.
- `node --import tsx scripts/verify-clean-install.ts`: copies the current tracked/untracked non-ignored source into a disposable Git snapshot, clones it without dependencies, then runs real setup install/verify and tests with isolated HOME/client service. It preserves the sandbox for evidence. It does not change the working repository's index or user configs.

The clean-install script requires installed Claude/Codex/OpenCode CLIs, network/registry and loopback access. It intentionally verifies the current uncommitted working snapshot; it is not a claim that those files have been committed to the user's branch. Review the summary because manual Plugin import/pairing remains Requires User Action.
