# Phase 1 — Walking Skeleton

## Pre-check
اقرأ `AGENTS.md` و `PROGRESS.md`.
لو أي قرار من **D1، D2، D3، D4، D5، D10** في `docs/ARCHITECTURE.md §2` لسه **Proposed**: **وقّف واسأل**. متبدأش.

## الهدف
مسار واحد شغال من الأول للآخر:

```text
MCP client ─► magic_ui_create_frame / magic_ui_read_node
           ─► MCP Server ─► Bridge ─► Plugin UI ─► Plugin Main ─► Figma
```

الهدف هنا شغل مثبت ومتحقق منه، مش نطاق كبير.

## In Scope
1. **Monorepo** حسب D1 و D2: TypeScript strict، و ESLint، و Prettier، و Vitest، و scripts موحدة على الـ root (`typecheck`، `lint`، `test`، `build`).
2. **`packages/shared`:**
   - message envelope و error shape (ARCHITECTURE §4).
   - schemas للـ commands: `ping`، `createFrame`، `readNode`.
3. **`packages/mcp-server`:**
   - MCP server بالـ transport بتاع D3، وفيه 3 tools: `magic_ui_get_connection_status`، `magic_ui_create_frame`، `magic_ui_read_node`.
   - Bridge server حسب D4 و D5 و D10: bind على loopback، token، heartbeat، timeout، correlationId.
   - validation لكل input قبل التنفيذ.
   - `--selftest` بيطبع الـ tools المسجلة ويخرج.
4. **`packages/plugin`:**
   - `manifest.json` بالـ networkAccess الصح.
   - Main: handlers لـ `createFrame` و `readNode`، و `setPluginData` لو D7 اتأكد.
   - UI بـ Preact: حالة الاتصال، وإدخال الـ token، وزرار reconnect. بس كده.
5. **`scripts/fake-plugin-client.ts`:** test harness بيتصل بالـ bridge زي الـ plugin بالظبط، وبيرد على الـ commands. ده للاختبار بس.
6. **Tests:**
   - unit: الـ schemas والـ envelope.
   - integration: MCP tool ← bridge ← fake client ← response، بما فيهم timeout و token غلط و reconnect.

## Out of Scope (متعملهوش)
Design spec، components، sync، assets، skills، agents، setup.command، read-only mode، multi-client hub (D6). الحاجات دي في Phases جاية.

## Definition of Done
| # | التحقق | الطريقة |
|---|---|---|
| 1 | `pnpm typecheck && pnpm lint && pnpm test` | كله بيعدّي، والـ output يتنسخ في PROGRESS |
| 2 | `pnpm --filter mcp-server start --selftest` | بيطبع الـ 3 tools |
| 3 | integration test للـ round-trip | `create_frame` بيرجع nodeId، و `read_node` بيرجع نفس الـ frame من الـ fake client |
| 4 | token غلط | الاتصال بيترفض، والـ error code صح |
| 5 | الـ fake client بيقفل ويرجع | الـ reconnect بينجح، والطلب اللي كان شغال ساعتها بيرجع timeout error واضح |
| 6 | `pnpm build` | بيطلّع `manifest.json` و main bundle و UI bundle من غير errors |
| 7 | Plugin حقيقي جوه Figma | **Requires User Action**: اكتب في `docs/installation/figma-plugin-import.md` خطوات الـ import والاختبار اليدوي بالظبط |

## في آخر الجلسة
- حدّث `PROGRESS.md`: الـ Done، وجدول التحقق بالنتايج الحقيقية، والـ dependencies اللي اتضافت ومبرراتها، والـ blockers.
- لو فيه حاجة متعملتش، اكتبها صراحة ومتخبيهاش.
