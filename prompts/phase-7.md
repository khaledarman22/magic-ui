# Phase 7 — Multi-Client + `setup.command`

## Pre-check
1. اقرأ `AGENTS.md` و `PROGRESS.md`، واتأكد إن Phase 6 مكتوب إنها خلصت.
2. لازم **D6** (multi-client) و **D11** (MCP registration) يكونوا Locked. لو مش كده: **وقّف واسأل**.
3. **قرار جديد لازم يتاخد:** إعادة تشغيل الـ server حاليًا بتولّد token جديد، والمستخدم لازم ينسخه للـ Plugin تاني (مكتوب في PROGRESS بتاع Phase 1). اقترح حل في §2 كـ **D13** بحالة Proposed، زي إن الـ token يفضل ثابت لحد ما المستخدم يعمل rotate، أو pairing code قصير. واسأل.
4. لو حاجة هنا بتتعارض مع الكود الموجود فعلًا، الكود هو المرجع. اكتب التعارض واقترح تعديل.

## الهدف
أكتر من AI client يقدروا يشتغلوا في نفس الوقت من غير port conflict، والمستخدم يثبّت كل حاجة بأمر واحد يقدر يعيده براحته من غير ما يبوّظ حاجة.

## In Scope
### A. Multi-client (D6)
1. أول instance بتمسك الـ port وتبقى hub. الـ instances اللي بعدها بتكتشف إن الـ port مستخدم، فتتصل بالـ hub بنفس الـ token كـ clients، وتعدّي الطلبات من خلاله بـ correlationId.
2. لو الـ hub وقف، instance من الباقيين تمسك الـ port. والطلبات اللي كانت شغالة وقتها بترجع error واضح ومش بتتعاد تلقائيًا.
3. **Multi-session:** لو فيه أكتر من ملف Figma مفتوح، `magic_ui_list_sessions` بيرجع الـ file name والـ page لكل session. وأي write tool من غير `sessionId` صريح بيترفض لما يكون فيه أكتر من session.
4. D13 حسب القرار اللي يتاخد.

### B. `setup.command` (ARCHITECTURE §16)
5. Bash script لـ macOS، والـ logic المعقد يبقى في TypeScript جوه `installers/` ويتنادى من الـ script. Modes: `install` (الافتراضي)، و `update`، و `repair`، و `verify`.
6. **الخطوات:**
   1. Environment: OS، و arch، و Node (`>=24` حسب `engines`)، و pnpm (أو تفعيله بـ corepack)، و git.
   2. `pnpm install` و `pnpm build`، وبعدين `--selftest`.
   3. Client detection: Claude Code و Codex و OpenCode، ويتكشف الـ version لكل واحد.
   4. MCP registration حسب D11: **تحقق من الأوامر الحقيقية لكل client من الـ `--help` بتاعه أو الـ docs الرسمية قبل ما تستخدمها. متكتبش أوامر من الذاكرة.** لو الـ server متسجل قبل كده، متكررش التسجيل. لو هتعدّل config file، اعمل backup بـ timestamp، وغيّر الـ entry بتاعة Magic UI بس، ومتلمسش servers تانية.
   5. Plugin: build، و validate للـ manifest، وتطبع مسار `manifest.json` وخطوات الـ import اليدوي.
   6. Health check: server startup، و tools، و bridge port. والـ Plugin connection بس لو الـ Plugin مفتوح.
   7. Summary: كل بند حالته Passed أو Failed أو Requires User Action أو Not Tested.
7. **السلامة:** مفيش `sudo`. يشتغل مع المسارات اللي فيها مسافات (والمشروع نفسه مساره فيه `MAGIC UI.md`). Idempotent. وبيكمل لو تثبيت سابق وقف في النص. والـ skills والـ agents مش في الـ Phase دي (Phase 8 هتضيفهم للـ setup).

## Out of Scope
Skills و agents و registration بتاع agents.

## Definition of Done
| # | التحقق | الطريقة |
|---|---|---|
| 1 | `pnpm typecheck && pnpm lint && pnpm test` | كله بيعدّي |
| 2 | integration: اتنين servers | الاتنين شغالين، والطلبات من الاتنين بتوصل للـ fake plugin |
| 3 | integration: الـ hub وقف | التاني بيمسك الـ port، والـ Plugin بيعمل reconnect |
| 4 | integration: اتنين sessions | write من غير `sessionId` بيترفض |
| 5 | setup في sandbox | `HOME` مؤقت فيه configs وهمية للـ clients (منها config فيه servers تانية)، و `setup.command` يتشغل **مرتين**: الـ configs بعد التانية مطابقة للأولى، والـ servers التانية فاضلة زي ما هي، والـ backups اتعملت |
| 6 | setup: مسار فيه مسافات | يتشغل من نسخة في فولدر فيه مسافة |
| 7 | setup: Node ناقص أو قديم | رسالة واضحة، ومفيش تعديلات جزئية |
| 8 | على جهاز المستخدم | **Requires User Action:** تشغيل حقيقي بموافقة المستخدم، لأنه هيعدّل configs حقيقية. والـ summary يتنسخ في PROGRESS |

## في آخر الجلسة
حدّث `PROGRESS.md` بنفس الشكل.
