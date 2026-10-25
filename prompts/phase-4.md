# Phase 4 — Figma Reader + Design-to-Code Package

## Pre-check
1. اقرأ `AGENTS.md` و `PROGRESS.md`، واتأكد إن Phase 3 مكتوب إنها خلصت.
2. لازم **D9** (read-only enforcement) يكون Locked. لو مش كده: **وقّف واسأل**.
3. لو حاجة هنا بتتعارض مع الكود الموجود فعلًا، الكود هو المرجع. اكتب التعارض واقترح تعديل.

## الهدف
يتقري أي تصميم في Figma، حتى لو مش معمول بـ Magic UI، ويطلع منه `figma-export/` package مستقلة عن الـ framework. وكل ده من غير ما المستند يتغير، وده **متضمون بالكود** مش بالتعليمات.

## In Scope
1. **Read-only mode** (D9):
   - `--read-only` flag: الـ write tools **مبتتسجلش أصلًا**، و `--selftest` بيأكد ده.
   - الـ session بتتعلّم read-only في الـ bridge handshake، والـ Plugin Main بيرفض أي write command جاي من session read-only بـ error `PERMISSION_DENIED`. ده دفاع تاني حتى لو الـ server فيه bug.
   - كل command في `packages/shared` معاه `permission: "read" | "write"`، وفيه اختبار بيتأكد إن مفيش command من غير permission.
2. **Reader في الـ Plugin:**
   - بيقرأ: document و pages (باستخدام `page.loadAsync()` لأن `documentAccess: dynamic-page`)، و frames، و components و component sets، و instances و overrides (`componentProperties`)، و variables (`boundVariables`)، و styles، و auto layout (`layoutMode`، و `layoutSizingHorizontal/Vertical`، و padding، و spacing، و alignment)، و constraints، و typography (`getStyledTextSegments`)، و fills و strokes و effects، و الـ text.
   - **Scoped:** بيقرأ الـ node أو الصفحة المطلوبة بس. `skipInvisibleInstanceChildren` و `findAllWithCriteria` لما يناسبوا.
   - **Pagination:** القراءات الكبيرة بتترجع على chunks بـ cursor عشان متعدّيش حد الرسالة.
3. **Normalization على الـ server:** نتيجة القراءة بتتحول لنفس الـ Design Spec schema بتاع Phase 2 و 3 لما يكون ده ممكن، والمعلومات اللي ملهاش مكان في الـ schema تتسجل في `missing-information.json` بدل ما تضيع.
4. **Asset export:** `exportAsync` لـ PNG أو SVG بالحجم المطلوب، ويتنقل للـ server على chunks، ويتكتب جوه الـ export folder بس. والـ export ده مسموح في read-only لأنه مبيغيرش المستند.
5. **`figma-export/` package** (ARCHITECTURE §12): `project.json`، و `design-spec.json`، و `tokens.json`، و `components.json`، و `screens.json`، و `assets/`، و `previews/`، و `reports/extraction-report.json`، و `reports/missing-information.json`، و `instructions/AGENTS.md` (عام، ومفيش ملفات framework غير لو اتطلبت).
6. **MCP tools:** `magic_ui_read_document`، و `magic_ui_list_pages`، و `magic_ui_read_page`، و `magic_ui_read_selection`، و `magic_ui_read_styles`، و `magic_ui_export_asset`، و `magic_ui_export_design_package`.

## Out of Scope
Code generators لأي framework، و sync، و إصلاح التصميم.

## Definition of Done
| # | التحقق | الطريقة |
|---|---|---|
| 1 | `pnpm typecheck && pnpm lint && pnpm test` | كله بيعدّي |
| 2 | read-only على مستوى الـ server | `--read-only --selftest` بيطبع read tools بس |
| 3 | read-only على مستوى الـ Plugin | الـ fake client بيبعت `createFrame` على session read-only وبيرجع `PERMISSION_DENIED` |
| 4 | كل الـ commands ليها permission | اختبار contract |
| 5 | round-trip | render لـ spec (Phase 3)، وبعدين read، وبعدين normalize: الـ tokens والـ components والـ layout بيرجعوا مطابقين للـ spec الأصلية في الحقول المدعومة |
| 6 | pagination | قراءة 2,000 node من الـ fake client بتتم على أكتر من chunk من غير error |
| 7 | في Figma الحقيقي | **Requires User Action:** export لملف Figma **مش معمول بـ Magic UI**. التحقق: الـ package اتعملت، و `missing-information.json` منطقي، و version history بتاع الملف **مفيهوش أي تعديل** |

## في آخر الجلسة
حدّث `PROGRESS.md` بنفس الشكل.
