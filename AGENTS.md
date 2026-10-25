# Magic UI — Agent Rules

## Session Protocol
1. **ابدأ** بقراءة `PROGRESS.md`، وبعدها `prompts/phase-N.md` للـ Phase الحالية.
2. ارجع لـ `docs/ARCHITECTURE.md` في الأقسام اللي محتاجها بس.
3. **اختم** الجلسة بتحديث `PROGRESS.md`: اللي خلص، واللي لسه شغال، والمشاكل، وأوامر التحقق ونتايجها.
4. اشتغل في نطاق الـ Phase الحالية بس. أي فكرة برا النطاق تتكتب في `PROGRESS.md › Backlog`.

## Decisions
- القرارات موجودة في `docs/ARCHITECTURE.md §2`.
- **Locked:** اتبعه ومتعيدش فتحه.
- **Proposed:** متبنيش عليه. اسأل صاحب المشروع الأول.
- لو احتجت قرار جديد: اقترحه في جدول §2 بحالة Proposed، واسأل، واستنى الرد.

## Honesty
- متقولش إن حاجة شغالة أو إن اختبار عدّى من غير ما تشغّله فعلًا. انقل الـ output الحقيقي.
- كل بند تحقق حالته واحدة من: **Passed / Failed / Requires User Action / Not Tested (السبب)**.
- مفيش mock ولا placeholder في المسارات الأساسية. الـ test harnesses مسموحة بس جوه `tests/` أو `scripts/`.
- مفيش `TODO` في وظيفة أساسية وبعدين نعتبرها خلصت.

## Code
- TypeScript strict. مفيش `any` إلا بتعليق بيشرح السبب.
- أسماء واضحة بتوصف المسؤولية (`pluginConnectionManager.ts` مش `conn.ts`). معرّفات ثابتة، و enums أو literal unions، ومفيش اعتماد على display names.
- كل contract بين الأجزاء يتعرّف في `packages/shared` ومتعرّفوش في حتة تانية.
- مفيش abstractions مش مستخدمة، ولا ملفات أو فولدرات فاضية عشان تطابق شجرة.
- اقرأ الملف قبل ما تعدّله. متستبدلش كود شغال من غير سبب.
- أي dependency جديدة محتاجة مبرر يتكتب في `PROGRESS.md`.

## Verification
قبل ما تقول إن أي جزء خلص، شغّل:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

بالإضافة لأوامر الـ DoD الخاصة بالـ Phase. (الأوامر دي بتفترض D1 = pnpm. عدّلها لو القرار اتغير.)

## Safety
- متمسحش بيانات المستخدم، ولا nodes بتاعته في Figma، ولا إعداداته.
- مفيش `sudo`، ولا تعديل في configs برا المشروع، إلا في Phase الـ setup ومع backup.
- مفيش أسرار في الكود ولا الـ logs ولا Git.
