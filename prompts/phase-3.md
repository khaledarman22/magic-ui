# Phase 3 — Design System + Components + Variants + Registry

## Pre-check
1. اقرأ `AGENTS.md` و `PROGRESS.md`، واتأكد إن Phase 2 مكتوب إنها خلصت.
2. لازم **D7** و **D12** يكونوا Locked. لو مش كده: **وقّف واسأل**.
3. لو حاجة هنا بتتعارض مع الكود الموجود فعلًا، الكود هو المرجع. اكتب التعارض واقترح تعديل.

## الهدف
الـ spec تقدر تعرّف tokens و components بـ variants. الـ render بيعمل Figma Variables و Component Sets حقيقية، والشاشات بتستخدم instances. وفيه registry بيمنع التكرار.

## In Scope
1. **Tokens في الـ spec** (ARCHITECTURE §9):
   - primitive و semantic colors، و spacing scale، و radius، و typography.
   - الـ semantic tokens بتعمل alias للـ primitives.
   - Modes (light/dark) لو موجودة في الـ spec.
   - أي قيمة في الـ nodes تقدر تكون token reference (`{ "token": "color.surface.primary" }`) بدل القيمة المباشرة. والـ validation بيرفض أي reference لـ token مش موجود.
2. **Render للـ tokens:**
   - Variables بـ `figma.variables.createVariableCollection` و `createVariable`، والـ aliases بـ `createVariableAlias`.
   - الربط بـ `setBoundVariable` (و `setBoundVariableForPaint` للـ fills).
   - Text styles للـ typography.
   - Idempotent: الـ collection أو الـ variable اللي موجود بالـ stable ID بيتحدث وميتعملش تاني.
3. **Components في الـ spec:** تعريف component بـ stable ID، و properties (`TEXT`، `BOOLEAN`، `INSTANCE_SWAP`، `VARIANT`)، و variants محددة بالاسم. **مش** cartesian product تلقائي، بيتعمل بس اللي مكتوب في الـ spec.
4. **Render للـ components:**
   - `figma.createComponent`، وبعدين `figma.combineAsVariants` للـ sets، و `addComponentProperty` للـ properties.
   - صفحة `Components` فيها Workspace frame بـ auto layout، ومقسمة sections حسب category.
   - الشاشات بتستخدم `component-instance` nodes بالـ overrides (text، boolean، swap، variant).
5. **Component Registry محلي** (`design-system/components.json`): stable id، الاسم، category، Figma node id، properties، variants، dependencies، usage، version.
   - `magic_ui_find_component`: lookup بالاسم والـ category، وsimilarity بسيط (اسم + properties). بيستخدمه الـ Agent قبل ما يقترح component جديد.
   - الـ validation بيحذّر من components شبه بعض أوي.
6. **ترتيب الـ render:** tokens ← components (حسب الـ dependencies، ولو فيه circular dependency يرجع error) ← screens.
7. **MCP tools:** `magic_ui_render_design_system`، و `magic_ui_find_component`، و `magic_ui_read_components`، و `magic_ui_read_variables`. ويتحدث `magic_ui_render_design` عشان يدعم الـ instances.

## Out of Scope
Images و icons كـ assets (Phase 6)، و mockups، و sync للتعديلات اليدوية، و Trash.

## Definition of Done
| # | التحقق | الطريقة |
|---|---|---|
| 1 | `pnpm typecheck && pnpm lint && pnpm test` | كله بيعدّي |
| 2 | unit: token resolution | aliases، و reference ناقص بيترفض، و modes |
| 3 | unit: dependency ordering | ترتيب صح، و circular dependency بيترفض |
| 4 | unit: registry | lookup و similarity، والـ duplicate بيتكشف |
| 5 | integration مع الـ fake client | render مرتين = نفس عدد الـ variables والـ components والـ instances |
| 6 | integration: variant جديد اتضاف | بيتضاف للـ set الموجود، ومفيش set جديد بيتعمل |
| 7 | في Figma الحقيقي | **Requires User Action:** sample design system (ألوان light/dark، و spacing، و Button بـ Type × Size × State حسب المكتوب في الـ spec بس، و Input، و Card)، وشاشة بتستخدمهم. التحقق: الـ variables ظاهرة في الـ Variables panel، والـ instances بتتغير لما الـ mode يتغير |

## في آخر الجلسة
حدّث `PROGRESS.md` بنفس الشكل.
