# Validate design

Owner: validation-agent. Shared rules: [AGENTS.md](../AGENTS.md).

1. Use [design-validation](../skills/design-validation/SKILL.md) and record the initial report with its exact scope.
2. If repair is requested/authorized, return failed check codes, node IDs, evidence and intended corrections to design-agent. The coordinator invokes [update-design](update-design.md) in the writable context; the validation agent retains its read-only context.
3. Re-run [design-validation](../skills/design-validation/SKILL.md) on the same scope after the repair result. Stop when repaired or when new input/unsupported capabilities block progress; retain warnings and unverified checks.
