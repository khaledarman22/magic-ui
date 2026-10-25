# Phase 5 — Sync + Checkpoints + Resume + Trash

## Pre-check
1. اقرأ `AGENTS.md` و `PROGRESS.md`، واتأكد إن Phase 4 مكتوب إنها خلصت.
2. لازم **D7** و **D8** يكونوا Locked. لو مش كده: **وقّف واسأل**.
3. لو حاجة هنا بتتعارض مع الكود الموجود فعلًا، الكود هو المرجع. اكتب التعارض واقترح تعديل.

## الهدف
التعديلات اليدوية في Figma **عمرها ما تتمسح بصمت**. العملية الطويلة اللي اتقطعت بتكمل من مكانها من غير تكرار. والحذف آمن وممكن نرجع فيه.

## In Scope
1. **Sync state** (ARCHITECTURE §11):
   - لكل node: `localId`، و `figmaNodeId`، و `specVersion`، و `lastSyncedHash` (hash للـ properties اللي Magic UI بيتحكم فيها بس).
   - بيتخزن في الـ workspace (`sync-state.json`)، والـ hash كمان في `pluginData` على الـ node.
2. **Change detection** (`magic_ui_get_sync_status`): بيقارن spec و sync state و Figma الفعلي، وبيصنّف كل node:
   - `in-sync`.
   - `spec-changed`: الـ spec اتغيرت و Figma متغيرش.
   - `figma-changed`: تعديل يدوي.
   - `conflict`: الاتنين اتغيروا.
   - `missing-in-figma`: اتمسح يدويًا.
   - `orphaned`: موجود في Figma ومش في الـ spec.
3. **Preview و Apply:**
   - `magic_ui_preview_changes` بيرجع قائمة operations من غير تنفيذ.
   - `magic_ui_apply_changes` بينفذ الـ `spec-changed` بس بشكل افتراضي.
   - الـ `figma-changed` و `conflict` **مبيتلمسوش** غير بقرار صريح لكل node (`keep-figma` | `apply-spec`)، حسب D8 (مفيش auto-merge).
   - `keep-figma` بيحدّث الـ sync state، ويسجّل الفرق كـ drift في التقرير.
4. **Execution journal و checkpoints:**
   - كل render أو apply ليه `operationId`، وكل خطوة بتتسجل في `design-progress.json` قبل وبعد التنفيذ.
   - **Idempotency:** تنفيذ نفس الـ operation مرتين ميعملش nodes مكررة (بالاعتماد على الـ stable IDs).
   - **Resume** (`magic_ui_resume_operation`): يقرأ الـ journal، **ويتحقق من Figma الفعلي**، ويكمل الناقص بس. والـ checkpoint المحلي لوحده مش كفاية.
   - Progress و cancellation للعمليات الطويلة. الـ cancel بيوقف بعد الخطوة الحالية ويسيب الـ journal سليم.
5. **Trash** (ARCHITECTURE §11):
   - نقل الـ orphaned nodes اللي Magic UI عملها لصفحة `Trash` يتعمل بأمر صريح بس، مع سبب الحذف والهوية الأصلية في الـ pluginData.
   - `magic_ui_restore_from_trash`.
   - Nodes المستخدم (اللي ملهاش magicUiId) عمرها ما تتنقل ولا تتحذف.
   - Cleanup policy مكتوبة في `docs/`.

## Out of Scope
Merge تلقائي، و multi-client، و assets.

## Definition of Done
| # | التحقق | الطريقة |
|---|---|---|
| 1 | `pnpm typecheck && pnpm lint && pnpm test` | كله بيعدّي |
| 2 | unit: change classifier | الـ 6 حالات كلها بـ fixtures |
| 3 | integration: تعديل يدوي | الـ fake client بيغير لون node بإيده، وبعدين apply: **اللون اليدوي فاضل** والـ status `figma-changed` |
| 4 | integration: conflict | من غير قرار مفيش تغيير، وبعد `apply-spec` بيتطبق |
| 5 | integration: resume | الـ fake client بيقطع الاتصال بعد 60 من 100 node، وبعد الـ resume: **100 بالظبط** ومفيش تكرار |
| 6 | integration: resume مع drift | node اتمسح يدويًا وقت الانقطاع، والـ resume بيكتشفه ومبيفترضش إنه موجود |
| 7 | integration: Trash | node المستخدم مبيتنقلش، و restore بيرجّع الـ node لمكانه الأصلي |
| 8 | في Figma الحقيقي | **Requires User Action:** render، وبعدين تعديل يدوي لنص وتغيير في الـ spec لنص تاني، وبعدين preview ثم apply. التحقق: التعديل اليدوي فاضل، والتاني اتطبق |

## في آخر الجلسة
حدّث `PROGRESS.md` بنفس الشكل.
