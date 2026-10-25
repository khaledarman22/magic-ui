# Phase 8 — Agents + Skills + Workflows

## Pre-check
1. اقرأ `AGENTS.md` و `PROGRESS.md`، واتأكد إن Phase 7 مكتوب إنها خلصت.
2. لازم **D9** و **D11** يكونوا Locked (وهما المفروض اتأكدوا في Phases 4 و 7).
3. لو حاجة هنا بتتعارض مع الكود الموجود فعلًا، الكود هو المرجع. اكتب التعارض واقترح تعديل.

## الهدف
الـ AI clients يعرفوا يستخدموا Magic UI صح من غير ما المستخدم يشرح: agents بصلاحيات منفصلة، و skills بتتلاقي وتتحمّل حسب الحاجة، و workflows للمهام الأساسية.

## In Scope
1. **تحقق من الـ formats الحقيقية الأول:** لكل client (Claude Code و Codex و OpenCode)، اعرف من الـ docs الرسمية أو من `--help`:
   - شكل الـ skill وفين بتتحط.
   - شكل الـ agent أو الـ subagent، ولو بيدعم tool allowlist.
   اكتب النتيجة في `docs/skills/client-compatibility.md` مع مصدر كل معلومة. **متفترضش إن الـ formats زي بعض.** ولو client مبيدعمش حاجة، اكتب أقرب بديل والفرق بينهم.
2. **`agent/AGENTS.md`:** القواعد المشتركة لكل الـ agents، زي الـ workflow العام، والأمانة، واستخدام الـ registry قبل إنشاء component، والـ Design System قبل الشاشات. **مكانها هنا بس، ومتتكررش في الـ skills.**
3. **Agents** (ARCHITECTURE §13):
   - `design-agent`: يستخدم الـ server العادي.
   - `figma-reader-agent`: يستخدم entry منفصلة للـ server بـ `--read-only` (D9)، فـ write tools **مش موجودة عنده أصلًا**. ولو الـ client بيدعم tool allowlist، يتضاف كطبقة تانية.
   - `validation-agent`: read tools، و `magic_ui_validate_design`. والإصلاح بيتعمل من خلال workflow بيرجع للـ design-agent.
4. **Validation engine** (ARCHITECTURE §17 وقسم 26 في البرومت الأصلي):
   - `magic_ui_validate_design` بيعمل structural checks: components ناقصة أو مكررة، و auto layout غلط، و text overflow، و fonts ناقصة، و instances بايظة، و token references بايظة، و assets ناقصة.
   - التقرير: passed و failed و warnings و **unverified**. والـ visual comparison بيتسجل unverified لو مفيش أداة مقارنة.
5. **20 skill** (القائمة في ARCHITECTURE §13): كل `SKILL.md` فيه description قصير وواضح (عشان الـ discovery)، وبعدين when to use، و inputs، و steps بالـ MCP tools الحقيقية الموجودة **بأسمائها الفعلية**، و outputs، و validation، و errors، و related skills.
   - `references/` و `scripts/` و `templates/` بتتعمل بس لو ليها محتوى حقيقي.
   - الـ skills اللي معتمدة على أدوات خارجية (`reference-research`، و `image-generation`): تكتب إيه اللي تعمله لو الأداة موجودة ولو مش موجودة. ومفيش نتائج متألفة. والبحث يتعمل في المصادر المسموح الوصول ليها بشكل مشروع بس.
   - `design-to-code`: workflow عام، وبعدين ملفات قصيرة لكل framework (Flutter و React) في `references/`.
6. **Workflows** (`agent/workflows/`): `create-design`، و `update-design`، و `read-figma`، و `prepare-code`، و `validate-design`. كل واحد عبارة عن خطوات بتشاور على skills، ومفيش تعليمات متكررة.
7. **Setup integration:** تحديث `setup.command` عشان يثبّت الـ skills والـ agents في المكان الصح لكل client. Symlink أو copy، ومن غير ما يمسح أو يكتب فوق skills المستخدم. وبعدين يتأكد إن الـ client لاقاهم.

## Out of Scope
Code generators، و visual diff engine حقيقي.

## Definition of Done
| # | التحقق | الطريقة |
|---|---|---|
| 1 | `pnpm typecheck && pnpm lint && pnpm test` | كله بيعدّي |
| 2 | lint للـ skills | script بيتأكد إن كل `SKILL.md` فيه الأقسام المطلوبة، و **كل MCP tool مذكور فيه موجود فعلًا** في `--selftest` |
| 3 | reader isolation | الـ config بتاع `figma-reader-agent` بيشاور على `--read-only`، واختبار بيتأكد من ده |
| 4 | validation engine | fixtures لكل نوع مشكلة بتطلع في التقرير، والـ visual بيظهر unverified |
| 5 | setup: skills | في sandbox، skill متعدّلة من المستخدم **فاضلة زي ما هي**، والناقص اتضاف، وتشغيل التثبيت مرتين نتيجته واحدة |
| 6 | discovery حقيقي | **Requires User Action:** في Claude Code، الـ skills تظهر، والـ reader agent ملوش write tools. وكمان في كل client تاني متثبت |
| 7 | end-to-end | **Requires User Action:** تجربة "Create a simple login screen using Magic UI" والنتيجة تتكتب في PROGRESS |

## في آخر الجلسة
حدّث `PROGRESS.md` بنفس الشكل.
