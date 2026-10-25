# Phase 9 — Performance + Security + Docs + Final Report

## Pre-check
1. اقرأ `AGENTS.md` و `PROGRESS.md`، واتأكد إن Phase 8 مكتوب إنها خلصت.
2. مفيش قرارات جديدة مطلوبة. أي تحسين بيغيّر قرار Locked لازم يتسأل عليه الأول.
3. الـ Phase دي **مبتضيفش features**. بتقيس وبتحسّن وبتأمّن وبتوثّق بس.

## الهدف
أرقام أداء حقيقية قبل التحسين وبعده، ومراجعة أمان موثقة، و docs كاملة، وتقرير نهائي أمين.

## In Scope
1. **Benchmarks** (`tests/performance/`، و `pnpm test:performance`):
   - Logic (بيتشغل أوتوماتيك): spec validation، و render planning، و sync classification، و normalization، و serialization على 100 و 1,000 و 5,000 و 10,000 node.
   - Bridge مع الـ fake client: latency و throughput للـ round-trip، والـ chunking للرسايل الكبيرة.
   - النتايج تتحفظ في `tests/performance/results/<date>.json` مع الـ environment (Node و CPU).
   - **In-Figma:** script يدوي (`pnpm bench:figma`) بيقيس render و read لـ 100 و 1,000 و 5,000 node في Figma الحقيقي. **Requires User Action.**
2. **التحسين:** حدد أبطأ 3 حاجات من الأرقام وحسّنها، وسجّل قبل وبعد. **مفيش تحسين من غير رقم**، ولو التحسين معملش فرق حقيقي ارجع فيه.
3. **Security review** (ARCHITECTURE §14): checklist في `docs/security/review.md`، وكل بند معاه الدليل (اختبار أو مكان في الكود):
   - loopback بس، والـ token، والـ origin، والـ validation لكل رسالة، وحد الرسالة.
   - path traversal في كل tool بتتعامل مع ملفات.
   - مفيش shell execution، ومفيش `eval` أو `Function` في الـ Plugin.
   - read-only بطبقتين.
   - مفيش أسرار في الـ logs (اختبار بيدوّر على الـ token في الـ output).
   - SVG sanitizer.
   - صلاحيات `session.json`.
   - `pnpm audit` والنتيجة.
4. **Observability** (ARCHITECTURE §15): logger بمستويات (stderr بس في الـ MCP server، لأن stdout مستخدم للـ protocol)، و correlationId من الـ tool لحد الـ Plugin، و metrics أساسية في `magic_ui_get_performance_report`.
5. **Docs:**
   - `README.md`: ما هو Magic UI، والمتطلبات، و setup، و Figma import، و quick start، و supported clients (حسب اللي اتحقق منه فعلًا في Phase 7 و 8).
   - `docs/architecture/`: نسخة محدّثة من ARCHITECTURE تطابق الكود.
   - `docs/troubleshooting/`: الأخطاء اللي حصلت فعلًا في PROGRESS (زي `devAllowedDomains` و `crypto.randomUUID` و الـ `import()` في الـ bundle) وحلولها.
   - `docs/development/`: إزاي تضيف MCP tool، وإزاي تضيف skill، وإزاي تشغّل الاختبارات.
6. **Repo hygiene:** `.pnpm-store/` موجود جوه المشروع ومش في `.gitignore`، فيتضاف. ويتأكد إن مفيش ملفات مؤقتة أو أسرار.
7. **التقرير النهائي** في `docs/FINAL-REPORT.md` بالأقسام اللي في البرومت الأصلي (قسم 40)، بس **من PROGRESS.md الحقيقي**:
   - features اتعملت واتحقق منها.
   - features اتعملت ومتحققش منها.
   - features متعملتش.
   - Limitations، و Requires User Action.

## Out of Scope
أي feature جديدة. والأفكار تتكتب في Backlog.

## Definition of Done
| # | التحقق | الطريقة |
|---|---|---|
| 1 | `pnpm typecheck && pnpm lint && pnpm test && pnpm test:performance` | كله بيعدّي |
| 2 | benchmarks | ملف نتايج حقيقي، وفيه جدول قبل وبعد لكل تحسين |
| 3 | security | كل بند في الـ checklist ليه دليل، و `pnpm audit` متسجل |
| 4 | no secrets in logs | اختبار بيعدّي |
| 5 | docs | كل أمر مكتوب في README اتشغل فعلًا ونجح |
| 6 | clean install | clone نظيف في فولدر مؤقت، وبعدين `setup.command`، وبعدين `pnpm test`: بيعدّي |
| 7 | in-Figma benchmarks | **Requires User Action** |
| 8 | Final report | كل بند Passed فيه ليه سطر مقابل في PROGRESS Verification Log |

## في آخر الجلسة
حدّث `PROGRESS.md`: Current Phase تبقى "v1 complete" أو قائمة باللي فاضل بالظبط.
