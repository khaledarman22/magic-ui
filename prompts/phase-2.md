# Phase 2 — Design Spec v1 + Render شاشة واحدة

## Pre-check
1. اقرأ `AGENTS.md` و `PROGRESS.md`، واتأكد إن Phase 1 مكتوب إنها خلصت.
2. القرارات المطلوبة في `docs/ARCHITECTURE.md §2`: **D7** (stable identity) و **D12** (spec schema) و **D8** (source of truth، في الجزء الخاص بإعادة الـ render). لو أي واحد منهم لسه **Proposed**: **وقّف واسأل**.
3. لو حاجة في الملف ده بتتعارض مع الكود الموجود فعلًا، **الكود هو المرجع**. اكتب التعارض في PROGRESS واقترح تعديل، ومتغيّرش معمارية شغالة من غير سبب.

## الهدف
الـ Agent يكتب Design Spec لشاشة واحدة، والـ MCP يتحقق منها ويعمل لها render في Figma بـ Auto Layout. وإعادة الـ render لنفس الـ spec **متكررش أي node**.

## In Scope
1. **تقسيم `packages/shared`:** `src/index.ts` حاليًا 237 سطر في ملف واحد. قسّمه حسب المسؤولية (`protocol/`، `errors/`، `commands/`، `designSpecification/`) من غير ما تغيّر الـ API الخارجي، وكل الاختبارات الحالية لازم تفضل شغالة.
2. **Design Specification v1** (ARCHITECTURE §7) كـ Zod schemas:
   - `schemaVersion`، `projectId`، `pages[]`، `screens[]`، وشجرة `nodes` (frame، text، rectangle) مع stable `id` لكل node.
   - Layout: `auto-layout` (direction، padding، itemSpacing، alignment، sizing بـ hug/fill/fixed) و `absolute`.
   - Styling أساسي: fills (solid)، strokes، cornerRadius، opacity. Text: content، fontFamily، fontStyle، fontSize، lineHeight، letterSpacing، textAlign.
   - `direction: "ltr" | "rtl"` على مستوى الشاشة.
   - Components والـ instances **مش** في الـ Phase دي.
   - توليد JSON Schema من Zod (لو D12 اتأكد بالشكل ده) في ملف يقدر الـ Agent يقرأه.
   - Validation بيرجع أخطاء بمسار واضح (`pages[0].screens[1].nodes[3].layout.padding`).
   - Migration: فانكشن `migrateDesignSpecification` حتى لو v1 هي النسخة الوحيدة، وبترفض أي `schemaVersion` مش معروف.
3. **Workspace محلي بسيط:** `magic_ui_initialize_project` بيعمل `<ProjectName>-Design/` فيه `project.json` و `design-spec.json` بس. القراءة والكتابة محصورين جوه root مسموح بيه، ومفيش path traversal.
4. **Render pipeline في الـ Plugin** (ARCHITECTURE §8): validate ← load fonts (مع cache) ← plan ← create/update ← layout ← styles ← mapping.
   - كل node بيتعمل بياخد `setPluginData` حسب D7.
   - **Update in place:** قبل ما تعمل node، دوّر على الـ stable ID جوه scope الشاشة بس، مش المستند كله. لو موجود حدّثه، وحدّث الـ properties اللي اتغيرت بس.
   - الـ nodes اللي اتشالت من الـ spec **متتحذفش** في الـ Phase دي. تترجع في النتيجة كـ `orphanedNodes` (الحذف و Trash في Phase 5).
   - فونت مش موجود يرجع error واضح `FONT_UNAVAILABLE`، ومفيش fallback بصمت.
5. **MCP tools:** `magic_ui_initialize_project`، و `magic_ui_validate_design_spec` (local، مش محتاج Figma)، و `magic_ui_render_design` (بياخد `sessionId` و `projectId` و `screenId`، وبيرجع created/updated/unchanged/orphaned counts و node mapping).
6. **حجم الرسايل:** لو الـ spec أكبر من حد الرسالة الحالي في الـ bridge، يرجع error واضح أو يتقسم. متكبّرش الحد بصمت.

## Out of Scope
Components و variants و variables و styles و images و sync و Trash و multi-session و read-only mode.

## Definition of Done
| # | التحقق | الطريقة |
|---|---|---|
| 1 | `pnpm typecheck && pnpm lint && pnpm test` | كله بيعدّي |
| 2 | unit: الـ schema | spec سليمة بتعدّي، و 10 حالات غلط على الأقل بترجع المسار الصح |
| 3 | unit: الـ render planner | spec ← operations متوقعة، ومن غير Figma |
| 4 | integration مع الـ fake client | render أول مرة: كله created. Render تاني لنفس الـ spec: **0 created**، والكل unchanged |
| 5 | integration: تعديل خاصية واحدة | render: 1 updated بس |
| 6 | integration: path traversal | `projectId` زي `../x` بيترفض |
| 7 | في Figma الحقيقي | **Requires User Action:** حدّث `pnpm smoke:figma` (أو اعمل `smoke:render`) يعمل render لشاشة sample فيها header و list و button بـ auto layout، وبعدين يعمل render تاني ويطبع إن عدد الـ nodes متغيرش. اكتب خطوات التشغيل في `docs/installation/` |

## في آخر الجلسة
حدّث `PROGRESS.md` بنفس الشكل اللي اتعمل في Phase 1: Done، و Verification Log بالـ output الحقيقي، والـ Dependencies ومبرراتها، والـ Blockers.
