# Magic UI — Progress

## Current Phase

**Phase 9 — التنفيذ والتحقق الآلي مكتملان؛ ليست v1 complete (2026-10-26).** المتبقي: benchmark Figma الحقيقي 100/1000/5000 node (DoD #7)، تحقق Phase 8 التفاعلي في العملاء وتجربة login، وتجارب Phases 3/4/5 المؤجلة أدناه. Passed: 169 اختبارًا/24 ملفًا، typecheck وlint وbuild وbenchmarks وclean clone setup/test. audit النهائي صفر advisories. لا موافقة معمارية معلقة.

**Phase 8 — التنفيذ والتحقق الآلي مكتملان؛ التحقق التفاعلي DoD #6/#7 ما زال Requires User Action (2026-10-26).** أُضيفت 20 skill و3 adapters للـagents و5 workflows ومحرك `magic_ui_validate_design`؛ اختبارها الأصلي: **Passed — 162 اختبارًا في 21 ملفًا**. اكتشاف Codex للـ20 skill وOpenCode للـ3 agents وفحص جلستي Codex reader/validation داخل sandbox: **Passed**. لاحقًا نُفّذ setup repair الحقيقي وأثبت Claude CLI استدعاء `design-agent`؛ التجربة الكاملة داخل Figma واختبار reader في كل client ما زالا معلقين.

**Phase 7 — مكتملة ومغلقة، بما فيها تشغيل setup على جهاز المستخدم بموافقته (2026-10-26).** D6 وD11 وD13 Locked. تسجيل Magic UI الحقيقي في Claude Code وCodex وOpenCode والتحقق من backups وبقاء إعدادات السيرفرات الأخرى وhealth check: **Passed**. **Requires User Action (خطوة تشغيل يدوية):** فتح/إعادة فتح Plugin في Figma وربطها؛ لا جلسة Plugin كانت متصلة وقت الفحص، ولا يُعد اتصالها Passed.

**Phase 6 — مكتملة ومغلقة، بما فيها تجربة Figma الحقيقية DoD #8 (2026-10-26).** التنفيذ والتحقق الآلي وتجربة الصور والـmockups والـLayers: **Passed**. وافق صاحب المشروع صراحة على تأجيل تحقق Phase 5 والسماح ببدء Phase 6. تحقق Phase 5 الحقيقي يبقى **Requires User Action — مؤجل بموافقة**، ولا يُعتبر Passed.

**Phase 5 — Sync/Preview/Apply وResume وTrash، مع استكمال جزئي للـdesign-system عبر checkpoints للموارد والـnodes.** التحقق الحقيقي داخل Figma: **Requires User Action**؛ المرحلة لم تُغلق. **Passed:** فحص النسخة النهائية: 132 اختبارًا في 15 ملفًا، مع نجاح typecheck وlint وbuild.

**Phase 4 — مغلقة بموافقة صاحب المشروع مع استثناء تحقق موثّق (2026-10-26).** التنفيذ والتحقق الآلي والتصدير الحقيقي ومراجعة الـpackage: **Passed**. تأكيد مزامنة Figma وحالة version history المتزامنة: **Requires User Action — مؤجل بموافقة صريحة، ولا يمنع إغلاق المرحلة**؛ لم يُحوّل إلى Passed. D9 يظل Locked. بدأ تنفيذ Phase 5 بطلب صاحب المشروع في هذه الجلسة.

**Phase 3 — التنفيذ والتحقق الآلي وتجربة Figma الحقيقية بوضع light: Passed. تبديل light/dark: Requires User Action لأن الملف الحالي محدود بـmode واحدة؛ المرحلة لم تُغلق بالكامل.**

Phase 2 مكتملة ومغلقة، بما فيها التجربة الحقيقية داخل Figma Desktop يوم 2026-10-26.

Phase 1 مكتملة، بما فيها التحقق الحقيقي داخل Figma Desktop.

2026-10-26: صاحب المشروع وافق صراحة على D1 وD2 وD3 وD4 وD5 وD10، وتم تحويلها إلى **Locked** في `docs/ARCHITECTURE.md §2`. باقي القرارات ما زالت Proposed، ولم يُبنَ عليها شيء.

2026-10-26: صاحب المشروع أكد D7 وD8 وD12 وبقوا **Locked**. D7 اتعدّل لـ `setSharedPluginData` بدل `setPluginData` (السبب مكتوب في §2). تم تنفيذ Phase 2 في هذه الجلسة بدون الاعتماد على قرارات Proposed.

## Done

### Phase 9 — Performance + Security + Docs — 2026-10-26

- قُرئت قواعد المشروع وPhase 9 وأقسام القرارات والأمان والتشغيل والتقرير الأصلي §40. طلب المستخدم تنفيذ Phase 9 مع إبقاء Phase 8 التفاعلية معلقة؛ لا ادعاء إغلاقها. حُفظت تعديلات Phase 8 السابقة للجلسة.
- لا قرار Locked تغير. قياس 100/1000/5000/10000 node بدفعات صالحة حتى 500 يحافظ على حدود العقد؛ لا رفع للحدود لإظهار benchmark وهمي.
- تحسينات بعد القياس: حذف validation/resolution المتكرر للقيم literal، فحص normalization للـframe دون إعادة فحص الأبناء الذين اجتازوا بالفعل، وتحسين canonical serialization مع حفظ snapshots حرفيًا. ملفات baseline والمراحل الوسيطة محفوظة؛ تشغيل متزامن مع typecheck موثق كقياس noisy ولا يُستخدم وحده لاستنتاج التحسن.
- أداة أداء read-only وlogger بمستويات stderr، IDs مولدة على tool/command وتُحفظ عبر peer/hub/Plugin. لا payloads أو error text في logs. اختبار correlation collision يمنع استبدال طلب معلّق.
- **Failed ثم Passed — audit:** البداية 3 moderate و2 critical advisory entries في أدوات الاختبار. Vitest رُفع إلى 4.1.12 لإصلاح advisories وإزالة tinypool؛ لا runtime dependency جديدة. audit النهائي Exit 0 وكل مستويات vulnerabilities = 0؛ الدليل docs/security/audit-before.json وaudit-after.json.
- **Failed ثم Passed:** أول suite بعد التحديث نجح 166/167، والفشل الوحيد توقع 17 أداة قراءة بدل 18 بعد إضافة performance report. بعد التصحيح وإضافة اختبارات الأمان: 169/169 Passed في 24 ملفًا، وكذلك في clone نظيف.

### Phase 8 — Agents + Skills + Workflows — 2026-10-26

- **Passed — Pre-check:** قُرئت `AGENTS.md` و`PROGRESS.md` و`prompts/phase-8.md`؛ Phase 7 مغلقة، وD9/D11 Locked. حُفظت تعديلات Phase 7 الموجودة قبل الجلسة. لا قرارات معمارية جديدة ولا dependencies جديدة.
- **Passed — توافق العملاء:** `docs/skills/client-compatibility.md` يوثق المصادر الرسمية وCLI help للإصدارات Claude Code 2.1.310، Codex 0.163.0 وOpenCode 2.1.4. OpenCode يستخدم permissions الخاصة بـV2؛ Codex custom subagents تورث MCP ولا تستطيع عزله بملف role. لذلك design-agent native، والـreader/validation لهما standalone launcher منفصل ضمن البديل المسموح في البرومبت، وليس ادعاء عزل داخل parent قابل للكتابة. يحجب كل MCP entries المكتشفة، ويثبت reader بـ`--read-only` وallowlist وoutput root، ويتحقق بـlist/get قبل إطلاق جلسة read-only؛ `--check` لا يشغّل نموذجًا. لا تغيير لملف إعدادات المستخدم بواسطة launcher.
- **Passed — المحتوى:** القواعد المشتركة وحدها في `agent/AGENTS.md`. عشرون `SKILL.md` بأوصاف اكتشاف وأقسام when/inputs/prerequisites/steps/outputs/validation/errors/related؛ كل الأدوات المذكورة موجودة في selftest. خمسة workflows تشير إلى skills؛ مراجع React وFlutter قصيرة للـhandoff فقط. البحث وتوليد الصور يوضحان غياب الأداة ولا يختلقان نتائج. لا code generator ولا visual diff engine.
- **Passed — validation:** أداة read-only جديدة `magic_ui_validate_design`، وعقود التقرير/الأدلة في shared. تقرأ مستندًا أو subtree عبر القارئ الحقيقي، وتفحص component registry/IDs والtargets المحذوفة، layout/fill-parent، حدود النص بالنسبة للقص، hasMissingFont، mainComponent، variable aliases وimage hashes عبر Figma APIs، ووسم missing asset الفعلي. التقارير تحتوي passed/failed/warnings/unverified. المقارنة البصرية دائمًا unverified؛ glyph overflow للنص الثابت، الدوران، الأجداد خارج النطاق والبيانات الناقصة لا تتحول إلى نجاح. المصادر الخارجية لا تُعد مفقودة لمجرد عدم وجودها في subtree. التقرير يصرّح بحدود القراءة المتتابعة مع تعديلات المستخدم المتزامنة.
- **Passed — setup:** يسجّل `magic-ui-reader` منفصلًا بالـCLI الرسمي مع backup/readback، ولا يثبّت adapters إذا تعذر تأكيد التسجيل. ينسخ الناقص من skills/agents دون استبدال ملفات المستخدم، ويبلغ عن التعارضات. يرفض توجيه التثبيت عبر symlinks المستخدم، مع دعم aliases macOS القياسية `/var` و`/tmp`. verify لا ينشئ artifacts. Codex reader roles خارج catalog الموروث، ويستخدمها launcher؛ Claude/OpenCode لديهما allowlist/permissions إضافية.
- **Passed — discovery دون نموذج:** setup يفحص Codex عبر app-server `skills/list`، وOpenCode عبر JSON من `debug agents`. أظهر فحص native 20 skill وثلاثة agents. OpenCode 2.1.4 قد يعيد `[]` أثناء warming؛ retry واحدة بعد 250ms للحالة الفارغة فقط. sandbox يستخدم منفذ خدمة مستقل ويوقف خدمته في النهاية. Claude CLI لا يوفر catalog صالحًا لهذا الفحص؛ بقي التحقق التفاعلي Requires User Action.
- **Passed — الاختبارات:** fixtures لكل أنواع المشاكل، وMCP → WebSocket → Plugin handlers الحقيقي داخل harness يثبت كشف المشاكل دون mutations أو تحميل fonts. يتضمن حالة حذف جميع component nodes مع بقاء registry. اختبارات setup تمر مرتين من مسار به مسافات، وتحافظ على skill معدلة وservers الأخرى، وتؤكد `--read-only` للentries الثلاثة وrepair/verify. linter يرفض أسماء أدوات غير موجودة ويراجع الروابط والأقسام وعدد الـskills.
- **تعارض موثق:** جدول ARCHITECTURE §5 يحتوي أسماء تخطيطية غير منفذة مثل `magic_ui_get_validation_report`. لم تُخترع في skills؛ الأداة الجديدة تعيد التقرير مباشرة، وselftest هو المرجع الفعلي. اقتراح تسوية الجدول موثق في compatibility guide، دون توسيع Phase 8 بأدوات تخزين تقارير غير مطلوبة.
- **Requires User Action — DoD #6/#7:** تطبيق setup repair للنسخة الجديدة على البيئة الفعلية بعد مراجعتها، وإعادة فتح Plugin والعملاء؛ التحقق من discovery وصلاحيات reader داخل جلسة فعلية في كل client، ثم تجربة “Create a simple login screen using Magic UI” وتسجيل Figma result. فحص config وcatalog آليًا لا يُعتبر تجربة agent فعلية ولا إغلاقًا للمرحلة.

### Phase 7 — التثبيت الحقيقي وإغلاق DoD #8 — 2026-10-26

- **Passed — الموافقة:** رد المستخدم «موافق» أذن صراحةً بتشغيل `./setup.command install` على إعداداته الفعلية مع backups. لا موافقة أخرى معلقة على التثبيت.
- **Passed — DoD #8:** تشغيل setup الحقيقي انتهى Exit 0 بعد الإصلاح أدناه: environment وpnpm install/build وselftest (27 أداة) وmanifest، وتسجيل/قراءة Magic UI في Claude Code 2.1.310 وCodex CLI 0.163.0 وOpenCode v2.1.4. health check الحقيقي نجح مع 16 أداة read-only واستعلام bridge مصادق.
- **Passed:** `./setup.command verify` — Exit 0، والتسجيلات الثلاثة مطابقة دون كتابة جديدة. Install/build بحالة **Not Tested (verify لا يعيدهما)**؛ كانا Passed في install الحقيقي.
- **Failed ثم Passed:** المحاولة الأولى سجلت Claude وOpenCode، وتوقفت خطوة Codex لأن فحصًا نصيًا قديمًا اعتبر مسار trusted project يحتوي `magic-ui` تسجيلًا مسبقًا. استُبدل بفحص `codex mcp list --json` بعد التحقق من `--help`. أُضيف regression للـtrusted project path، ثم نجح استكمال التسجيل دون تكرار الآخرين.
- **Failed ثم Passed — مقارنة configs:** CLI Codex 0.163.0 حذف `args = []` من server آخر أثناء serialization. استُعيد كل نص الإعدادات الأصلية من backup مع إبقاء جداول Magic UI المولّدة بالـCLI فقط، وحُفظت نسخة 0600 إضافية للحالة بعد CLI قبل الإصلاح. تحقق TOML مستقل أثبت أن جميع قيم config الأصلية عادت، مع إضافة Magic UI فقط. أصبح installer يطبق هذه الحماية تلقائيًا بعد CLI، ويستعيد الأصل عند فشل التسجيل أو شكل خرج غير مدعوم؛ ليس هناك استبدال تسجيل CLI بأوامر متخيلة.
- **Passed — backups/الحفاظ على الإعدادات:** مقارنة مستقلة لـJSON/TOML مع backups الأصلية أثبتت بقاء كل servers الأخرى: Claude عدد 0، Codex عدد 2، OpenCode عدد 2. كل backup بصلاحية 0600، ولم تُطبع أسرار أو token. الملفات: `~/.claude.json.magic-ui-backup-2026-10-26T11-32-51.126Z-36417`؛ `~/.codex/config.toml.magic-ui-backup-2026-10-26T11-34-19.166Z-37673`؛ `~/.config/opencode/opencode.json.magic-ui-backup-2026-10-26T11-32-52.381Z-36417`.
- **Passed:** typecheck وlint بعد الإصلاحات. اختبار setup المعزول يحاكي تطبيع CLI الجانبي ويتحقق من حفظ نص Codex الأصلي كاملًا؛ تشغيله المنفرد: 2/2 Passed في 12.28s. **Passed — المجموعة النهائية:** `pnpm test` — Exit 0: `Test Files 19 passed (19)` و`Tests 152 passed (152)`، Duration `26.15s`. `node --import tsx scripts/verify-setup-sandbox.ts` أُعيد على النسخة النهائية — Exit 0؛ تشغيلان بالـCLIs الحقيقية، وحفظ نص Codex الأصلي حرفيًا بما فيه args الفارغة وtrusted project، وتطابق configs بعد الإعادة. `git diff --check` — Exit 0.
- **Requires User Action:** summary يطبع Plugin import/pairing كخطوة يدوية؛ لا جلسة Plugin متصلة وقت الفحص. Import السابق في Phase 6 موثق، لكن تشغيل النسخة الجديدة واتصالها لم يُتحققا في هذه الجلسة. هذا لا يمنع إغلاق DoD #8 الذي يشترط تشغيل setup الحقيقي ونسخ summary، ويفحص Plugin فقط لو مفتوحة.

Summary التشغيل الحقيقي:

```text
Summary (install): Environment=Passed; Dependencies=Passed; Build=Passed; Selftest=Passed; Plugin manifest=Passed; Plugin import=Requires User Action; claude version=Passed; claude=Passed; codex version=Passed; codex=Passed; opencode version=Passed; opencode=Passed; Server / tools / bridge port=Passed; Plugin connection=Requires User Action
Summary (verify): Environment=Passed; Install / build=Not Tested; Selftest=Passed; Plugin manifest=Passed; Plugin import=Requires User Action; claude version=Passed; claude=Passed; codex version=Passed; codex=Passed; opencode version=Passed; opencode=Passed; Server / tools / bridge port=Passed; Plugin connection=Requires User Action
```

### Phase 7 — Multi-client + setup — 2026-10-26

- **Passed — القرارات:** موافقة المستخدم «موافق اعتمد وكمل» اعتمدت D6 وD11 وD13، وأصبحت Locked في §2. لا dependencies جديدة ولا تغييرات lockfile. Phase 8 (agents/skills) خارج النطاق.
- `MultiClientBridge`: أول instance تملك loopback port تصبح hub؛ البقية تستخدم WebSocket peer channel مصادقًا بنفس token. العقود وZod schemas وواجهة transport في `packages/shared`. Plugin origins منفصلة عن `/peer` الذي يرفض browser origins؛ كل hop يربط الرد بالطلب وcorrelationId، مع validation وcancellation وحد الحجم.
- انتقال الملكية تلقائي عند إغلاق/قتل hub؛ العمليات المتقطعة ترجع NOT_CONNECTED مع تنبيه لاحتمال اكتمال كتابة ولا تُعاد تلقائيًا. عمليات الكتابة متعددة الخطوات تحتفظ بجيل الاتصال فلا تواصل صامتًا على hub جديد. قفل كتابة مشترك على hub يحمي عمليات sync/render والكتابة المحلية وprepare/present/create من clients المتزامنة، مع SESSION_BUSY عند التعارض.
- دعم عدة Plugin sessions حتى 64، وأداة `magic_ui_list_sessions` (الإجمالي 27 أداة عادية و16 read-only). ترجع sessionId واسم الملف والصفحة؛ metadata تُحدّث مع heartbeat خلال نحو 5 ثوانٍ. عقود أدوات Figma الحالية تحتفظ بـsessionId إلزامي حتى في جلسة واحدة؛ مع عدة جلسات يعيد status هوية مفردة null بدل اختيار ملف افتراضي. أدوات workspace المحلية لا تستهدف Figma أصلًا.
- read-only محفوظ على مستوى كل client: الأدوات الكتابية لا تُسجّل، النقل يرفض writes، والـhub يمرر readOnly لكل command وتتحقق Main منه مستقلةً عن حالة hub. إعادة الاتصال تستعمل آخر document metadata الواردة في heartbeat.
- D13: token عشوائي 256-bit مشترك ودائم في `~/.magic-ui/session.json`؛ نشر أول ملف كامل ذريًا عبر hard link يمنع اختلاف tokens بين التشغيلات المتزامنة. يتحقق من regular file/ownership/0600 وdirectory/0700 ويرفض symlinks والملف التالف دون استبداله. تحديث PID/port لا يغيّر token، وshutdown يحذف lease الخاصة بالعملية فقط.
- `--rotate-token`: يتطلب توقف جميع instances؛ يفحص PID leases ويحتجز المنفذ وrotation gate قبل الاستبدال الذري، ثم يحتاج Plugin pairing من جديد. لا يطبع secrets. الانقطاع القسري أثناء rotate قد يترك `rotate.lock`؛ إجراء الفحص اليدوي موثق، ولا يُحذف ملف credentials تلقائيًا.
- `setup.command` Bash مع منطق TypeScript داخل `installers/setup.ts`، يبدأ مباشرة بـNode دون الاعتماد على tsx قبل التثبيت. install/update/repair يعيدون التحقق والتثبيت المقفل والبناء؛ verify لا يثبت أو يبني أو يسجل. preflight لـmacOS/arch/Node>=24/git؛ pnpm أو `corepack pnpm` بدون sudo أو تغيير global shims. health check يستخدم MCP stdio حقيقيًا بوضع read-only ويفحص الأدوات وbridge ووجود sessions.
- تسجيل رسمي للعملاء الثلاثة بعد فحص help وتحديد versions، وreadback بعد التسجيل. backup خاص 0600 باسم timestamp قبل تغيير config؛ التطابق يمنع التكرار، والتعارض يُحفظ ويُبلغ عنه. custom/legacy/JSONC configs غير المدعومة لا تُعدّل بتخمين. لا manual-config fallback مطلوب للإصدارات الحالية لأن الثلاثة توفر CLI noninteractive. setup يمرر المنفذ للـclients ويتحقق من تطابق manifest، ويطبع تعليمات import اليدوي. update لا يعمل git pull أو يمس التغييرات المحلية.
- **Passed — DoD #2/#3:** اختبار عميلين MCP في عمليتي Node منفصلتين على نفس port، يكتبان للـfake Plugin؛ SIGKILL للـhub يعيد خطأ للطلب المعلّق، ويرقّي الناجي بنفس token، دون تكرار كتابة. اختبار مستقل بثلاث instances يستخدم PluginConnectionManager الحقيقي ويتحقق من reconnect ومن وجود hub واحدة وclient بعد الانتخاب.
- **Passed — DoD #4:** جلستا Figma، عرض الملف/الصفحة لكل منهما، ورفض write بلا sessionId، والتوجيه الصريح لكل جلسة. اختبارات إضافية لقفل الكتابة، cancellation، token خاطئ دون تعطيل الجلسة، ورفض Main لطلب read-only رغم أن hub writable.
- **Passed — DoD #5/#6/#7:** `tests/setup.test.ts` يبني artifacts حقيقية ثم يستخدم CLI/package-manager fixtures داخل tests فقط وHOME مؤقت. تشغيل setup مرتين من `project with spaces`، تطابق configs byte-for-byte، بقاء servers الأخرى ومحتويات backups، استكمال تسجيل جزئي بـrepair، verify دون تسجيل جديد، وNode مفقود/قديم دون تعديل جزئي.
- **Passed — تحقق إضافي بالبرامج الحقيقية:** `node --import tsx scripts/verify-setup-sandbox.ts` — Exit 0. ينسخ المشروع وdependencies إلى `Magic UI project` وHOME مؤقت، ويشغل pnpm install/build والـsetup كاملًا مرتين مع Claude Code **2.1.310** وCodex CLI **0.163.0** وOpenCode **v2.1.4**. النتيجة: `Passed: real pnpm install/build and all three real client CLIs ran twice from a path with spaces; configs are byte-identical and unrelated servers/backups are preserved.` حُذف مجلد التجربة فقط بعد النجاح. لم تُمس configs المستخدم الفعلية.
- **Passed — النسخة النهائية:** `pnpm typecheck` — Exit 0؛ `pnpm lint` — Exit 0: `All matched files use Prettier code style!`؛ `pnpm test` — Exit 0: `Test Files 19 passed (19)` و`Tests 152 passed (152)`، Duration `25.11s`. `pnpm build` — Exit 0 مع تحذيري Zod/Rollup المعروفين فقط. selftest العادي و`--read-only` — Exit 0: 27 و16 أداة. `git diff --check` — Exit 0 قبل إضافة هذا السجل.
- **Passed — مراجعة أخيرة:** اختبارات setup تستخدم الآن منفذًا مؤقتًا منفصلًا حتى لو hub المستخدم شغالة على 3845. تعذّر تأكيد acquire/release لقفل peer يغلق ذلك الاتصال لتحرير ملكيته بدل ترك قفل عالق؛ SESSION_BUSY لا يقطع الاتصال. أُعيد `pnpm typecheck` و`pnpm lint` بنجاح، واختبارات الجزأين المتأثرين: `Test Files 2 passed (2)` و`Tests 5 passed (5)`، Duration `12.38s`؛ تبني اختبارات setup artifacts الحالية قبل تشغيلها.
- **Failed ثم Passed بعد الإصلاح:** sockets أولًا أعادت `listen EPERM 127.0.0.1` ثم نجحت بصلاحية loopback. typecheck كشف typing لـverifyClient وStream وبيئة test، واختبارات credentials القديمة احتاجت عقد D13 الجديد. full suite الأولى: 147 passed و2 failed بسبب عدد الأدوات القديم وسباق فحص حدث إغلاق الجلسة؛ أُصلح المتوقع وانتظار الحدث. lint كشف تنسيق وCommonJS fixture؛ تحولت إلى ESM دون تعطيل قواعد lint. لا اختبارات أُسقطت.
- **Requires User Action — DoD #8:** التشغيل على configs المستخدم الحقيقية لم يُنفّذ؛ موافقة القرارات الثلاثة لا تُسجّل كموافقة على هذه الخطوة المنفصلة المحددة في prompt. دليل التشغيل والمراجعة: `docs/installation/multi-client-setup.md`.
- **Not Tested (تجربة Figma حقيقية جديدة غير منفذة ضمن هذه المرحلة):** عدة ملفات Figma Desktop في نفس الوقت وإعادة pairing بعد rotate الحقيقي. التحقق من reconnect هنا يستخدم مدير اتصال Plugin الفعلي داخل harness. Node 24 غير مثبت؛ جميع التشغيلات على Node **26.11.1** الذي يحقق شرط >=24.

Summary تجربة setup المعزولة باستخدام البرامج الحقيقية (لا يُعد Summary تشغيل إعدادات المستخدم):

```text
Environment=Passed; Dependencies=Passed; Build=Passed; Selftest=Passed;
Plugin manifest=Passed; Plugin import=Requires User Action;
claude=Passed; codex=Passed; opencode=Passed;
Server / tools / bridge port=Passed; Plugin connection=Requires User Action
```

### Phase 7 — فحص البداية — 2026-10-26

- **Passed:** قراءة `AGENTS.md` و`PROGRESS.md` و`prompts/phase-7.md`، وفحص القرارات في §2 وsetup في §16، والتأكد من إغلاق Phase 6 بما فيها التحقق الحقيقي.
- **Requires User Action:** D6 (أول instance تصبح hub والبقية تتصل بها) وD11 (CLI رسمي للتسجيل، وconfig مع backup عند غياب CLI) ما زالتا Proposed؛ شرط البداية يطلب التوقف وسؤال صاحب المشروع.
- **Requires User Action:** أُضيف D13 بحالة Proposed بناءً على الطلب الصريح في Phase 7: token ثابت مشترك يستمر بعد restart، محفوظ بنفس مسار D10 وصلاحية 0600، مع rotate صريح عند توقف instances وإعادة pairing. لا تنفيذ قبل الموافقة.
- **Passed — فحص الكود الحالي:** `serverRuntime.ts` يولّد token جديدًا لكل تشغيل؛ `sessionCredentials.ts` يحذف ملف credentials عند shutdown؛ و`index.ts` يعيد خطأ عند `EADDRINUSE`. هذه فجوات التنفيذ الحالية بالنسبة لمتطلبات Phase 7، والتعديل المقترح بعد التأكيد هو إعادة استخدام credentials مع حفظها بعد shutdown وإضافة hub forwarding/failover. مسار المشروع الفعلي `magic-ui` ولا يحتوي مسافة، خلافًا لعبارة prompt؛ اختبار نسخة داخل مسار بمسافة يظل مطلوبًا.
- لا تغييرات إنتاج أو dependencies أو إعدادات clients. تغييرات المراحل السابقة الموجودة في working tree محفوظة.
- **Passed:** `git diff --check` — Exit 0 بعد تعديل التوثيق.
- **Not Tested (توقف عند بوابة القرارات؛ تغييرات توثيق فقط):** `pnpm typecheck` و`pnpm lint` و`pnpm test` وDoD #2–#8 لم تُشغّل في هذه المحاولة؛ لا ادعاء بإتمام المرحلة.

### Phase 6 — إغلاق التحقق الحقيقي — 2026-10-26

- **Passed — فحوص الإغلاق بعد إضافة سكريبت الفحص:** `pnpm typecheck`؛ `pnpm lint` — `All matched files use Prettier code style!`؛ `pnpm test` — Exit 0: `Test Files 17 passed (17)`، `Tests 144 passed (144)`، Duration `44.93s`. `git diff --check` — Exit 0.
- **Passed — DoD #8:** تشغيل `pnpm smoke:assets` على ملف Drafts جديد في Figma Desktop، Exit 0: `Passed: three editable screens and three mockup instances share one component.` الملف: https://www.figma.com/design/mo3pQKE6Rz5W5NkyJ7twTD/Untitled?node-id=1-2.
- **Passed:** الفحص الحقيقي للـLayers وقراءة المستند عبر bridge بوضع read-only: 3 شاشات أصلية FRAME بهويات `1:10`, `1:19`, `1:26`، و3 instances بهويات `1:17`, `1:24`, `1:31` مرتبطة بنفس component `1:14`. صور المصادر تشترك في imageHash واحدة `06c81b9efb466ada1dd106bdc19068887def94ff`. صفحات App - Sample وComponents وReferences وTrash موجودة؛ لم تُنشأ Web أوDashboard.
- **Passed:** فحص الصور الست المصدرة فعليًا من Figma: المصادر 393×852 والـpresentations 425×900؛ الصور والنصوص سليمة داخل screen slots دون قص غير مقصود. الأدلة في `docs/installation/phase-6-verification/`، و`visual-review.json` يسجل اكتمال الفحص البصري الذي كان pending وقت كتابة تقرير smoke الأول.
- أُضيف `scripts/inspect-assets-smoke.ts` لإعادة قراءة نتائج التجربة وتصدير الصور عبر أدوات read-only. لا dependencies جديدة ولا تغيير في كود الإنتاج خلال هذه التجربة.
- **Passed:** `pnpm build` — Exit 0، مع تحذيرات Zod/Rollup المعروفة فقط. انتهت عمليتا smoke والفحص بـExit 0، أُغلق Plugin ونُظفت credentials المؤقتة؛ لم تُحذف nodes أو إعدادات المستخدم.

### Phase 6 — Assets + Mockups + Project Pages — 2026-10-26

- Pre-check: موافقة صاحب المشروع «ماشى» سمحت ببدء Phase 6 مع تأجيل التحقق الحقيقي لـPhase 5. نتيجة التحقق المؤجل لم تتحول إلى Passed. لا قرارات معمارية جديدة، ولا اعتماد على D6/D11 المقترحتين، ولا dependencies جديدة.
- عقود Zod في `packages/shared` للأصول والنقل والصفحات والـpresentations، و`assetId` اختياري للـframe الخالية من spec children، و`kind` اختياري للصفحات (app/website/dashboard) للحفاظ على توافق specs القديمة. JSON Schema أُعيد توليده.
- `magic_ui_register_asset`: قراءة regular files محدودة داخل مجلد المشروع، رفض absolute/traversal/symlinks، فحص PNG/JPEG/SVG من المحتوى والأبعاد والحجم. PNG CRC وبيانات الضغط وحجم الصفوف متحققة؛ JPEG يتحقق من segments/dimensions/scan/EOI. Figma هو decoder النهائي، وليس هناك ادعاء بتنفيذ decoder مستقل كامل. الحدود: 8 MiB، 16384 لكل محور، 40 مليون pixel.
- `assets/assets-manifest.json` يُكتب ذريًا بصلاحية 0600، ويحتوي ID والاسم والمسار وSHA-256 وMIME والأبعاد والمصدر والـlicense والاستخدامات وoptimization وموارد Figma حسب documentId. dedup يرجع نفس ID؛ تسجيل مسار جديد لنفس المحتوى يحدّث مسار السجل دون تكراره. ID اختياري لتسمية أصل منتظر. تغيير bytes لملف مسجل يُرفض حتى التسجيل الصريح بهوية جديدة. الاستخدامات تعكس spec للعملية؛ ليست بحثًا حيًا في كل ملفات Figma.
- نقل بحد 8000 byte لكل chunk، مع تحقق SHA-256 في Main. cache دائمة لكل hash داخل المستند تحفظ imageHash أو componentId، وتتحقق من وجود المورد قبل إعادة استخدامه. إعادة تشغيل Plugin أو تكرار آخر chunk لا تكرر الاستيراد. الصور تعمل في الشاشات وداخل المكونات القابلة لإعادة الاستخدام، مع استمرار screen checkpoints وdesign-system checkpoints الحالية.
- SVG sanitizer يعيد بناء subset محدودة من الأشكال؛ يزيل scripts/style/foreignObject blocks والأحداث وexternal refs قبل النقل، ثم يعيد التحقق في Main. لا CSS ولا entities ولا تحميل خارجي. الـSVG المستوردة داخل component على Components، واستخداماتها instances. subset وحدود التعقيد موثقة في دليل التشغيل.
- الأصل غير المسجل/ملفه المفقود ينتج frame مكتوبًا عليها `Missing asset: <id>`، و`missingAssets` بحالة missing و`assetsComplete: false`. اكتمال خطوات العملية ليس اكتمالًا للأصول. تسجيل الملف لاحقًا يحدّث نفس frame؛ label القديمة تُخفى ولا تُحذف. guards تشمل محتوى الأصول المولّد وتحمي التعديلات اليدوية، بما فيها النقل إلى Trash.
- `magic_ui_prepare_project` ينشئ صفحات الأنواع المطلوبة فقط، إضافةً إلى Components/References/Trash، مع Main Workspace Auto Layout وهويات ثابتة. يعيد استخدام Components الموجودة. الـscreens الجديدة داخل workspace الصفحة. حذف/نقل صفحة أو workspace مرتبطة لا يؤدي لإعادة إنشائها صامتًا. الفشل الجزئي الملتبس محفوظ للفحص ولا يُعد نجاحًا.
- توافق مع قيد الكود الحالي: إنشاء/تجهيز الصفحات أداة مستقلة، ثم يختار المستخدم الصفحة ويرسم بـpageId صريح؛ لم يُلغَ شرط current-page ولم تُنقل الشاشات القديمة ضمنيًا. specs ذات `kind` تُرفض على صفحة أخرى. هذا يحل التعارض بين تجهيز عدة صفحات ومسار الرسم الحالي المقيّد بالصفحة المختارة.
- `magic_ui_present_screen`: component واحد لكل iPhone/Laptop داخل Components، وpresentation frame تحتوي instance وscreen slot بصورة PNG مرتبطة بـsourceNodeId وSHA-256. الأصل يظل frame قابلة للتعديل ومنفصلة. refresh صريح بنفس الأداة يحافظ على identities ويمنع overwrite بعد تعديل presentation/mockup يدويًا. لا refresh تلقائي بين الاستدعاءات.
- لم تُقدَّم ملفات mockups مرخصة؛ تُستخدم أشكال هندسية أصلية وتُسجّل `mockupSource: basic-shapes`، وتوضع بياناتها في `assets/mockups/basic-shapes.json`. لا استيراد ضمني لملفات طرف ثالث. لا compression/conversion، حفاظًا على الأصل؛ لا سبب لتغيير الجودة أو إضافة مكتبة.
- ثلاث أدوات MCP جديدة: الإجمالي 26 عادية و15 read-only. أدوات الكتابة غير مسجلة في read-only؛ Main يرفض assetChunk/assetBindings/projectLayout/presentScreen أيضًا. لا حذف nodes أو تعديل إعدادات خارج المشروع.
- **Passed — DoD #2–#7:** dedup لنفس الملف باسمين، رفض fake PNG وtraversal/symlink، sanitizer scripts وexternal xlink، 10 استخدامات تنادي createImage مرة واحدة مع إعادة تشغيل VM، 5 شاشات = component واحد و5 instances، app-only بدون Web/Dashboard.
- **Passed:** missing → registration يحتفظ بهوية الـframe؛ manual label drift محفوظ؛ SVG sanitized فعلًا على الـwire ومكون واحد للاستخدامات؛ نقل PNG فعلية أكبر من 65,536 byte على chunks وإعادة آخر chunk دون تكرار؛ صور داخل component عبر checkpoints؛ refresh presentation بنفس الهوية ورفض manual slot fill؛ حظر الأوامر الأربعة داخل Main read-only.
- **Passed — النسخة النهائية:** `pnpm typecheck`؛ `pnpm lint` — `All matched files use Prettier code style!`؛ `pnpm test` — Exit 0: `Test Files 17 passed (17)` و`Tests 144 passed (144)`، Duration `48.91s`. `pnpm build` — Exit 0 مع تحذيري Zod/Rollup السابقين فقط. `pnpm --filter mcp-server start --selftest` ونسخته `--read-only --selftest` — Exit 0، ويعرضان 26 و15 أداة بالترتيب. `git diff --check` — Exit 0 قبل تحديث هذا السجل.
- **Failed ثم Passed بعد الإصلاح:** sandbox منع sockets بـ`listen EPERM 127.0.0.1`؛ أُعيد التحقق بصلاحية loopback. PNG fixture الأولى كان CRC الخاص بها غير صحيح فاستُبدلت بصورة صالحة. fake client لم يوجّه الأوامر الجديدة فحُدّث. اختبار large image كشف أن test harness يعيد base64 كـimageHash بدل hash قصيرة، فأُصلح المحاكي. قائمة أدوات الاختبار القديمة وunused import أُصلحا. timeouts تحت الحمل عولجت بعمال اختبار اثنين و30 ثانية للـsuite و45 ثانية لاختبارات recovery الطويلة، دون تغيير مهلة أو سلوك الإنتاج أو تعطيل assertions؛ اختبار design-system الكامل قيس منفردًا بنحو 13 ثانية. التشغيل السابق قبل اختبار حماية presentation: 143/143 Passed.
- **سجل سابق قبل تجربة الإغلاق أعلاه — Requires User Action — DoD #8:** لم تُنفّذ تجربة Phase 6 في Figma Desktop. أُضيف `pnpm smoke:assets` مع sample بثلاث شاشات موبايل وPNG fixture حقيقية مشتركة، وiPhone presentations، وتقرير `assets-verification.json`. السكريبت يطلب الاتصال واختيار App - Sample؛ فحص الصور والـslots والـLayers بصريًا ما زال مطلوبًا. **Not Tested (يحتاج اتصال وتفاعل Figma):** تشغيل السكريبت الحي نفسه. دليل التشغيل: `docs/installation/assets-mockups-pages.md`.

### Phase 6 — فحص البداية — 2026-10-26

- **Passed:** قراءة `AGENTS.md` و`PROGRESS.md` و`prompts/phase-6.md`.
- **Requires User Action:** شرط البداية في `prompts/phase-6.md` يتطلب اكتمال Phase 5، بينما المرحلة ما زالت مفتوحة لتجربة Figma الحقيقية (DoD #8). يلزم إتمام التحقق أو موافقة صريحة على تأجيله والسماح ببدء Phase 6؛ طلب تنفيذ ملف التعليمات لا يُسجَّل كنجاح للتحقق أو موافقة على استثناء غير مذكور.
- لم يبدأ تنفيذ Phase 6؛ لا تغييرات كود أو dependencies. التعديل الوحيد توثيق نتيجة فحص البداية.
- **Not Tested (توقف عند شرط البداية؛ تعديل سجل فقط):** `pnpm typecheck` و`pnpm lint` و`pnpm test` وأوامر DoD الخاصة بـPhase 6 لم تُشغّل في هذه المحاولة.

### Phase 5 — استكمال جزئي للـdesign-system — 2026-10-26

- اكتمل تنفيذ الطلب الإضافي ضمن Phase 5 دون قرارات معمارية جديدة أو dependencies. القيد المسجل في الجلسة السابقة عن عدم دعم design-system recovery أُزيل للمسار الجديد؛ السجل القديم أدناه يصف الحالة السابقة.
- `magic_ui_render_design_system` يقبل/يرجع `operationId`. الـMCP يجمّد spec في `design-progress.json › systems` ويسجل pending قبل إرسال كل خطوة وdone بعد استلامها. `magic_ui_resume_operation` يوجه نفس الهوية لمسار النظام أو الشاشة، مع session جديدة عند اللزوم. يوجد lock مشترك للكتابة وتحقق من project/page/document، ولا تبدأ عملية جديدة فوق أخرى متقطعة.
- renderer القائم مقسم إلى checkpoints للـcollection، وكل mode، وحجز المتغيرات قبل aliases، وكل قيمة token/mode، وكل text style، وpage/workspace/category، وكل component node وbindings، وتجميع variants، وخصائص المكونات ومراجعها، والـregistry والـmanifest. reused stable IDs تشمل `componentId` للأجزاء التي لم تدخل registry بعد؛ لا إعادة بناء component كامل لتجاوز انقطاع.
- Plugin يحفظ spec المجمدة وprefix الخطوات والـresource IDs في shared plugin data، مع guards دقيقة على الموارد وهويتها وترتيبها ومراجع properties. قبل كل خطوة وحتى إعادة تشغيل عملية مكتملة: قراءة Figma والتحقق من الموارد الفعلية والـregistry/manifest. رد checkpoint ضائع يُؤكَّد قبل أي خطوة جديدة، فلا يسبق التنفيذ سجل pending المحلي.
- أخطاء setters التي تترك موردًا جزئيًا معروف الهوية تُحفظ كحالة جزئية غير مكتملة، ثم تُستكمل بعد فحصها. manual drift أو deletion أو تغير ownership يوقف الاستكمال ولا ينشئ بديلًا صامتًا؛ الخطأ يحوي resource ID وexpected/actual snapshots محدودة الحجم أو missing/added IDs مع operationId. قرارات الشاشة لا تمنح إذن overwrite لموارد design-system.
- تخزين checkpoint مقسّم إلى أجزاء 8,000 UTF-16 units، بفتحتين للتخزين وتحديث المؤشر أخيرًا. فشل كتابة fragment يبقي النسخة السابقة قابلة للقراءة. لا مسح بيانات المستخدم ولا purge. الـguard وحدود قراءة/كتابة المصدر المحلي السابقة ما زالت فعالة.
- الحماية من concurrency تشمل مرحلة فتح checkpoint والتحقق والإكمال. الموارد غير التابعة للخطوة لا تُقبل تغييراتها ضمن baseline جديدة؛ فشل legacy preflight لا ينشر baseline معتمدة ولا يسمح بتجاوز التعديل اليدوي عند retry. الـsource resolving للـinstances يسبق swap/setProperties لتقليل فجوات الكتابة غير المتحققة.
- **Passed:** اختبار unit لكل خطوة، والاستكمال بعد فشل إضافة mode، وفشل إنشاء نص داخل component، وفشل setter بعد تغيير قيمة فعلية، مع بقاء الهويات. manual token drift وmissing node يوقفان التنفيذ؛ رد ضائع لا ينفذ الخطوة التالية؛ تغيّر spec للعملية نفسها مرفوض.
- **Passed:** اختبار MCP/WebSocket يفصل الاتصال بعد checkpoint رقم 60 ويفقد ردها، ثم يعيد تهيئة Plugin VM وsession والخادم؛ استكمال باقي الخطوات يحافظ على node/variable IDs، ونسخة spec المحفوظة، ثم إعادة نفس operationId لا تكرر الموارد. اختبار إلغاء العملية بعد 20 checkpoint ثم محاولة resume مع تعديل token يدوي يحافظ على التعديل ويعيد DRIFT_DETECTED؛ استعادة الحالة السابقة تسمح بالاستكمال.
- **Passed:** `pnpm typecheck` — Exit 0؛ `pnpm build` — Exit 0 مع تحذيري Zod/Rollup المعروفين فقط؛ `pnpm --filter mcp-server start --selftest` — Exit 0 ويعرض الأدوات الـ23. `pnpm lint` — Exit 0: `All matched files use Prettier code style!`.
- **Passed (النسخة النهائية):** `pnpm test` — Exit 0: `Test Files 15 passed (15)` و`Tests 132 passed (132)`، Duration `47.54s`. يشمل اختبار فشل كتابة storage fragment مع بقاء المؤشر السابق صالحًا ثم الاستكمال بعد إعادة تهيئة VM، واختبار رفض `advanceDesignSystem` في Main read-only. التشغيل السابق قبل هذين الاختبارين: 130/130 Passed.
- **Failed ثم Passed بعد الإصلاح:** typecheck كشف فقد narrowing داخل callbacks فأُصلح؛ أول اختبارات recovery كشفت تمرير documentId/expectedCompletedSteps إلى schema الـrenderer القديمة strict؛ فُصل عقد الاستكمال عن مدخل renderer، ثم نجحت الاختبارات. لم يُستخدم mock في مسار الإنتاج.
- **Requires User Action:** تجربة Figma الحقيقية لـPhase 5 لم تُشغَّل هنا. **Not Tested (لا جلسة Figma حقيقية في هذا التحقق):** إعادة تشغيل design-system recovery داخل Desktop؛ الأدلة الحالية اختبارات production handlers داخل VM ونقل MCP/WebSocket حقيقي. يجب إعادة بناء/فتح Plugin لاستخدام العقد الجديد.
- حدود موثقة: عمليات Phase 3 القديمة المتقطعة التي لم تسجل checkpoints لا تُحوَّل تلقائيًا إلى عمليات قابلة للاستكمال؛ الدليل التاريخي غير موجود ويظل pending guard مانعًا للتخمين. لو انقطعت كتابة غامضة دون guard موثوق، يلزم فحص الحالة. لا auto-merge ولا تحويل نوع node ولا تجاوز لحدود Figma modes. دليل التشغيل محدث في `docs/installation/sync-recovery-trash.md`.

### Phase 5 — Sync + checkpoints + resume + Trash — 2026-10-26

- Pre-check: Phase 4 مغلقة بالاستثناء المعتمد؛ D7 وD8 وD9 Locked. لم تُستخدم D6 أوD11 المقترحتان، ولم تُضف dependencies أو تُعدّل إعدادات خارج المشروع.
- عقود Zod جديدة في `packages/shared`: الحالات الست، القرارات لكل node، live inspection، optimistic write، mapping، journal، وتقارير التنفيذ وTrash. ست أدوات MCP جديدة؛ الإجمالي 23 في الوضع العادي و15 في read-only. أدوات الكتابة الجديدة لا تُسجَّل في read-only، وPlugin Main يرفضها كذلك وفق جدول permissions.
- `sync-state.json` يحفظ localId وfigmaNodeId وspecVersion وlastSyncedHash مع intent وsnapshot حقيقية. الـhash للخصائص التي يديرها renderer محفوظ أيضًا في shared plugin data وفق D7؛ guard إضافي يحمي التنسيقات اليدوية وrich text وترتيب العناصر، مع مقارنة snapshots كاملة بجانب الـhash. `specVersion` نسخة schema، وتغييرات المحتوى تُكتشف من intent الدقيقة.
- `get_sync_status` و`preview_changes` يقرآن المصدر المحلي وFigma بدون كتابة. `apply_changes` يطبّق spec-changed فقط افتراضيًا؛ figma-changed/conflict/missing تتطلب قرارًا لكل node. `keep-figma` لا يغير الخصائص المرئية، ويحفظ الفرق المقبول كـdrift. لا auto-merge ولا إعادة إنشاء صامتة بعد حذف يدوي.
- مسار MCP لـ`render_design` وapply يسجل `operationId` وspec مجمدة وخطوة pending قبل كل node ثم done/skipped وbefore/after بعد التنفيذ. ملفات recovery خاصة 0600، مع كتابة ذرية ورفض symlinks/تعارض هوية المشروع. حدها 8 MiB؛ حد spec والرسالة يبقى 65,536 bytes. الفشل الكبير لا يُخفى ولا تُحذف سجلات قديمة تلقائيًا.
- Resume يقرأ الهويات والخصائص الفعلية، بما فيها nodes المنقولة وTrash، ولا يعتمد على checkpoint وحده. رد ضائع بعد commit يُكتشف بلا تكرار. إعادة تشغيل `operationId` لا تعيد استخدام قرار قديم فوق تعديل يدوي أحدث. الإلغاء يوقف بعد الخطوة الحالية المحفوظة؛ MCP progress notifications تعمل عند وجود progressToken.
- Trash بأمر صريح ولـorphaned owned nodes فقط؛ يحفظ السبب والهوية وparent/index/coordinates. يرفض user content والـcontainers التي ما زالت تحتوي descendants في spec. Restore يعيد نفس node، ويرفض parent مفقودًا أو داخل Trash. الصفحة تُعرف بـshared identity لا بالاسم؛ لا `remove()` ولا purge تلقائي. السياسة والتشغيل موثقان في `docs/installation/sync-recovery-trash.md`.
- نطاق recovery الجديد هو screen render وsync apply. مسار Phase 3 المستقل `render_design_system` ما زال يحتفظ بحماية pending/drift القديمة؛ لم تُضف له checkpoints لكل token/component في هذه الجلسة. لا يُدّعى دعم استكمال تلقائي لكتابة design-system جزئية.
- **Passed:** DoD #2: تصنيف الحالات الست بـfixtures. **Passed:** #3 تعديل لون يدوي ثم apply يحافظ عليه ويظل figma-changed بينما يتغير نص آخر من spec. **Passed:** #4 conflict لا يتغير دون قرار ثم يتطبق بعد apply-spec؛ keep-figma محفوظ مع drift.
- **Passed:** DoD #5: انقطاع بعد 60 من 100 node، مع فقد رد الخطوة الستين، ثم session جديدة وإعادة إنشاء MCP server؛ الاستكمال ينتج 100 node بالضبط بلا تكرار. إعادة نفس العملية لا تضاعفها.
- **Passed:** DoD #6: حذف node أثناء الانقطاع يُكتشف؛ الاستكمال يبقي 99 ويعرض missing-in-figma، ثم 100 فقط بعد apply-spec صريح. **Passed:** #7 رفض نقل user node/محتواه وrestore يعيد parent وترتيب sibling الأصلي.
- **Passed:** اختبارات إضافية للحفظ الخاص وsymlink، cancellation، stale optimistic write، duplicate identities، تبنّي render قديم بعد التحقق، manual sibling reorder، وعدم استرجاع descendants من Trash ضمنيًا.
- **Passed:** `pnpm typecheck` — Exit 0؛ `pnpm lint` — Exit 0: `All matched files use Prettier code style!`؛ `pnpm test` — Exit 0: `Test Files 14 passed (14)`، `Tests 121 passed (121)`. `pnpm build` — Exit 0؛ تحذيرا Zod/Rollup المعتادان لم يمنعا البناء. `pnpm --filter mcp-server start --selftest` — Exit 0، ويعرض الأدوات الـ23.
- **Requires User Action:** DoD #8 لم يُشغَّل داخل Figma الحقيقي. أُضيف `pnpm smoke:sync`: ينتظر اتصال Plugin المبني في scratch file، ويطلب تعديل Header يدويًا، ثم يغيّر نصًا آخر في spec ويشغّل preview/apply ويقرأ النصين الحقيقيين، ويحفظ `sync-verification.json` في workspace التجربة. **Not Tested (يتطلب التفاعل اليدوي المذكور):** تشغيل السكريبت الحي نفسه؛ نجاح typecheck/build لا يُعتبر نجاح التجربة.
- **Failed ثم إصلاح:** typecheck الأول بسبب عدم استثناء ملف Main الجديد من DOM tsconfig ثم optional typing وunion؛ أُصلحت. اختبارات الشبكة داخل sandbox فشلت بـ`listen EPERM 127.0.0.1`، ثم شُغلت بالصلاحية المناسبة. اختبارات قديمة تطلب عدد الأدوات القديم عُدلت، واختبار font failure أصبح يستأنف journal بدل بدء عملية جديدة. fixtures لـ100 node وduplicate createPage أُصلحت. ESLint كشف import غير مستخدم وأُزيل؛ النتائج النهائية أعلاه.

### Phase 4 — الإغلاق باستثناء معتمد — 2026-10-26

- طلب صاحب المشروع صراحة: «اعتبر تأكيد مزامنة Figma بند تحقق مؤجل بموافقتي، واقفل Phase 4 مع توثيق الاستثناء في PROGRESS.md، وخلي اختبار light/dark مؤجل برضه».
- **Phase 4 مغلقة بهذه الموافقة.** الاستثناء يخص فقط تأكيد مزامنة Figma وحالة version history على الخادم من DoD #7؛ يبقى **Requires User Action — مؤجل**، وليس Passed. مقارنة القائمة الظاهرة والتصدير الحقيقي ومراجعة الـpackage ناجحة كما هو موثق أدناه.
- **Requires User Action — مؤجل بموافقة صاحب المشروع:** اختبار light/dark في Phase 3 ما زال معلّقًا ولم يُشغّل أو يُعتبر ناجحًا ضمن هذا الإغلاق.
- **Passed:** فحوص الإغلاق `pnpm typecheck` — Exit 0، و`pnpm test` — Exit 0: `Test Files 13 passed (13)` و`Tests 108 passed (108)`.
- **Failed ثم إصلاح التنسيق:** أول `pnpm lint` رفض تنسيق `PROGRESS.md` فقط؛ جرى تشغيل Prettier ثم إعادة lint: **Passed** — Exit 0، `All matched files use Prettier code style!`.
- السجلات الأقدم التي تقول إن Phase 4 لم تُغلق تصف الحالة قبل هذه الموافقة؛ هذا الإدخال وCurrent Phase هما الحالة الحالية. لا إعادة كتابة لنتائج الأدلة القديمة ولا تغيير للكود أو القرارات المعمارية.

### Phase 4 — إعادة فحص المزامنة وversion history — 2026-10-26

- **Passed (القائمة الظاهرة):** أُعيد فتح Version history في test4؛ ما زالت تعرض `Current version` و`12:36 AM` للمحرر `khaled waleed`، دون نسخة جديدة مقارنةً بما قبل smoke:export. الدليل: `docs/installation/phase-4-verification/version-history-recheck.txt`.
- **Requires User Action:** النص `Some changes won't be synced until Figma is able to reconnect.` ما زال في accessibility state. لا يوجد تأكيد مستقل بأن هذا تنبيه نشط أو إعلان قديم، ولا دليل واضح على اكتمال مزامنة جلسة Desktop؛ لذلك لم تُغلق Phase 4.
- **Passed (إمكانية قراءة الملف من الخادم فقط):** فتح رابط test4 في جلسة متصفح جديدة حمّل التصميم وصفحاته. **Requires User Action:** فتح قائمة الملف للوصول إلى version history في تلك الجلسة عرض `Sign up for Figma`، فلم يكن سجل النسخ الموثّق متاحًا دون تسجيل دخول. أُغلق تبويب الفحص المؤقت.
- لم تتغير nodes أو إعدادات الملف، ولم تُضف نسخة إلى version history. أُبقي السجل ظاهرًا في Desktop. اختبار light/dark ما زال مؤجلًا كما طلب صاحب المشروع.
- **Not Tested (تعديل توثيق فقط، لا تغيير كود ولا إعلان إغلاق):** لم تُعَد typecheck/test أو smoke:export في هذه المراجعة؛ نتائجها السابقة Passed. **Passed:** `pnpm lint` بعد تحديث التوثيق — Exit 0، ESLint وPrettier.

### Phase 4 — التحقق الحقيقي على test4 — 2026-10-26

- **Passed:** تشغيل `pnpm smoke:export` الحقيقي — Exit 0، باستخدام الخادم المبني بوضع `--read-only` وPlugin Magic UI داخل [test4 / Web](https://www.figma.com/design/N4T7RvY4oQpZrJR73QFD2I/test4). الملف مختلف عن Untitled المستخدم في تجارب Magic UI. كل 126 node مقروءة خالية من هوية Magic UI، والصفحة تحتوي تصميم موقع «مدار» desktop/mobile موجودًا مسبقًا.
- **Passed:** الـPlugin عرض `Connected. Read-only: document writes are blocked.`؛ السكريبت تحقق أن كل الأدوات المسجلة read-only. لم يُنشأ أو يُعدّل أي node أثناء هذه الجلسة؛ لم تُضف نسخة يدوية إلى version history.
- **Passed:** package فعلية من 13 ملفًا، وDesign Spec صالحة. البيانات الخام: 126 node تشمل الصفحة؛ التحويل: 125 scene node بينها 71 text، و25 variable و8 text styles. لا screens ساقطة أو schema-limit errors في هذا التصدير. المكونان خارج scope صفحة Web، لذلك instance محتواهما موسع في spec ومرجعهما الأصلي محفوظ في التقرير.
- **Passed:** فحص الصورة المصدّرة بصريًا: Website board كامل، desktop/mobile، النص العربي والأقسام والشعار ظاهرة. Preview بحجم 2041×2700، و3 PNG assets بأحجام 54×54 و40×40 و40×40، وكل headers سليمة. [صورة التحقق](docs/installation/phase-4-verification/website-board.png).
- **Passed:** مراجعة 132 بندًا في `missing-information.json`: 125 سجل rawProperties لحفظ الخصائص الإضافية، و3 image fills غير ممثلة في solid-paint schema مع assets مقابلة، و2 instance لمكونات خارج الصفحة، وبند تصنيف tokens وبند غياب responsive behavior. لا asset export failures. التقرير متسق مع المصدر والـscope ولا يخفي فقدًا في عدد العناصر.
- **Passed (المقارنة المرئية فقط):** فتحت Version history قبل التصدير وبعده؛ القائمتان تعرضان `Current version` و`12:36 AM`، والمحرر `khaled waleed`، دون entry جديدة ظاهرة. [دليل AX بعد التصدير](docs/installation/phase-4-verification/version-history-after.txt).
- **Requires User Action:** ظهر قبل التجربة تنبيه `Connection issue affecting saving`، واستمر نص `Some changes won't be synced until Figma is able to reconnect.` في accessibility state بعد التجربة. لذلك تطابق القائمة الظاهرة لا يثبت حالة الخادم المتزامنة، ولا يُعلَن DoD #7 مكتملًا بالكامل. المتبقي استعادة اتصال Figma ثم إعادة مراجعة version history؛ لا حاجة لإعادة إنشاء package لمجرد هذا القيد.
- **Passed:** حفظ نسخة كاملة قابلة للمراجعة من package في [figma-export.zip](docs/installation/phase-4-verification/figma-export.zip)، وملخص بأعداد الملفات والصور وSHA-256 في [verification.json](docs/installation/phase-4-verification/verification.json). الأصل محفوظ في `/private/var/folders/32/ttvmzbn52j73k1vlyl56r5mw0000gn/T/magic-ui-export-smoke-nxCrHp/phase4-foreign-export-dy4o03/figma-export`.
- **Passed:** إغلاق الـPlugin وانتهاء الخادم؛ فحص غياب `~/.magic-ui/session.json` أعاد `Passed: smoke session credentials removed.`. أُبقي سجل النسخ ظاهرًا للمراجعة، ولم تُحذف بيانات المستخدم.
- **Passed:** `pnpm typecheck`، `pnpm lint`، `pnpm test` — Exit 0؛ 108 tests في 13 files. لا تغييرات production code ولا dependencies في هذه الجلسة.
- **Failed (أداة UI مساعدة):** محاولة تنشيط التطبيق عبر Dock انتهت بـ`Computer Use server error -10005: timeoutReached`؛ لم تُستخدم كدليل على المزامنة، ولم تؤثر على نجاح التصدير أو فحص الملفات.
- اختبار light/dark الخاص بـPhase 3 يظل مؤجلًا ومعلّقًا بموافقة صاحب المشروع.

مخرجات smoke الفعلية:

```text
Passed: all registered tools are read-only.
Target: test4 / Web
Passed: package created with 13 files and a valid Design Spec.
Package: /private/var/folders/32/ttvmzbn52j73k1vlyl56r5mw0000gn/T/magic-ui-export-smoke-nxCrHp/phase4-foreign-export-dy4o03/figma-export
Requires User Action: review previews and reports/missing-information.json (132 entries), then verify the Figma version history has no design modifications.
```

مراجعة الـpackage المطلوبة في السطر الأخير أُنجزت أعلاه؛ المتبقي فقط قيد تأكيد مزامنة version history.

### Phase 4 — التنفيذ والتحقق الآلي 2026-10-26

- **Passed:** D9 أصبح Locked بموافقة صاحب المشروع. تجاوز شرط إغلاق Phase 3 مصرح به لهذه المرحلة فقط؛ تجربة light/dark تظل **Requires User Action** ومؤجلة صراحة.
- Read-only من البداية للنهاية: `--read-only` يمنع تسجيل أدوات الكتابة، وready handshake يحمل `readOnly` إلزاميًا، والـbridge وPlugin Main يرفضان الكتابة بـ`PERMISSION_DENIED`. جدول permissions شامل لكل commands في shared، مع اختبار يطابقه بالـunion. يلزم إعادة فتح الـPlugin المبني لتوافق الـhandshake الجديد.
- Reader عام لأي مستند، بدون اعتماد على ملكية Magic UI: document/pages/page أو subtree/selection/styles، تحميل الصفحات بـ`loadAsync`، خصائص Auto Layout والقيود والنص والـstyled segments والـpaints/effects والـcomponent properties والـoverrides وbindings وVariables وStyles. المعرّفات والبيانات الخام محفوظة؛ لا document setters ولا تغيير صفحة أو selection.
- نقل JSON وbase64 في fragments مع cursor مربوط بالمدخلات؛ 8,000 UTF-16 units لكل fragment، مع بقاء حد الرسالة 65,536 bytes. Cache لأربع snapshots لمدة خمس دقائق، invalidation عند session ready، ميزانية 32 MiB من serialized characters و100,000 node، وفحص cancellation. القارئ يحتفظ بالأبناء غير المرئيين لإكمال القراءة؛ لا بحث شامل إضافي خارج scope الشجرة.
- Normalization على server إلى schema 1.0.0 الحالية: ألوان/aliases/modes/typography، frames/text/rectangles/instances، المكونات والـvariants وخصائصها المدعومة، bindings وlayout. يستخدم القيم الفعلية؛ بيانات intent تُستخدم لاستعادة stable ID فقط. التصنيفات التي لا يخزنها Figma تُستنتج من IDs/aliases مع توثيق ذلك.
- حدود schema الأصلية (ومنها 500 node) لم تتغير. البيانات غير الممثلة، mixed typography، transforms/effects/constraints والمراجع الخارجية وحدود التحويل محفوظة في `reports/raw-extraction.json` و`reports/missing-information.json`. لا اختراع responsive behavior أو framework code. قراءة الصفحات والموارد متتابعة وليست snapshot ذرية أمام تعديلات المستخدم المتزامنة.
- تصدير PNG/SVG بواسطة `exportAsync`، ونقل base64 مجزأ؛ scale للـPNG عبر Figma ولـSVG عبر viewport مع الاحتفاظ بالهندسة. Package في directory جديدة خاصة `<projectId>-export-*/figma-export/` تحت workspace فقط، بدون overwrite، مع رفض traversal/symlink roots وصلاحيات ملفات 0600. ملفات project/spec/tokens/components/screens وassets/previews/reports/instructions موجودة. فشل asset يُسجّل؛ الإلغاء قد يترك directory جزئية بدون تقرير اكتمال.
- سبع أدوات جديدة؛ الإجمالي 17 في الوضع العادي و13 في read-only. `pnpm smoke:export` يشغّل الخادم الحقيقي بـread-only ويصدر الصفحة المتصلة. دليل التشغيل: `docs/installation/figma-reader-export.md`.
- **Passed:** round-trip عبر handlers الإنتاجية لـPhase 3 tokens والـvariants وخصائص المكونات والـlayout المدعوم؛ رفض write محقونة مباشرة إلى Plugin Main في session read-only؛ قراءة 2,000 node عبر MCP/WebSocket على عدة chunks؛ إعادة تجميع asset حجمها 100,000 bytes بدون اختلاف؛ package لتصميم أجنبي في harness، ورفض traversal/symlink، وصفر document writes أثناء القراءة.
- **Passed:** `pnpm typecheck` — Exit 0. **Passed:** `pnpm lint` — Exit 0، ESLint وPrettier.
- **Passed:** `pnpm test` — Exit 0؛ **108 tests / 13 files**.
- **Passed:** `pnpm build` — Exit 0؛ shared/server/plugin. تحذيرا Zod المعروفان عن `@__PURE__` فقط، دون إخفائهما.
- **Passed:** `pnpm --filter mcp-server start --read-only --selftest` — Exit 0، الأدوات الـ13 أدناه، ولا write tools.
- **Failed ثم Passed:** أول `pnpm test` داخل sandbox منع sockets المحلية بـ`listen EPERM: operation not permitted 127.0.0.1`؛ أعيد بالصلاحية المناسبة ونجح. أول round-trip كشف اختلاف stable IDs لأبناء variants؛ أُصلح بإعادة الهوية الأصلية دون قراءة الخصائص المرئية من intent. اختبار خصائص المكونات كشف اختلاف الترتيب وvariant اصطناعية Default؛ أُصلح مع الإبقاء على القيم الفعلية.
- **Requires User Action / Not Tested (لم تُنفّذ تجربة على ملف Figma خارجي في هذه الجلسة):** `pnpm smoke:export`، مراجعة package وmissing-information بصريًا، وإثبات عدم وجود تعديل في version history حسب DoD #7. لا ادعاء بتحقق Figma حقيقي.
- لا dependencies جديدة ولا تغييرات lockfile أو إعدادات clients خارج المشروع.

مخرجات التحقق الفعلية:

```text
$ tsc --noEmit && tsc -p packages/plugin/tsconfig.main.json --noEmit
$ eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
Test Files  13 passed (13)
     Tests  108 passed (108)
```

مخرجات selftest:

```text
magic_ui_get_connection_status
magic_ui_read_node
magic_ui_validate_design_spec
magic_ui_find_component
magic_ui_read_components
magic_ui_read_variables
magic_ui_read_document
magic_ui_list_pages
magic_ui_read_page
magic_ui_read_selection
magic_ui_read_styles
magic_ui_export_asset
magic_ui_export_design_package
```

### Phase 4 — فحص البداية السابق 2026-10-26 (حُلّ بموافقة صاحب المشروع)

- **Passed:** قراءة `AGENTS.md` و`PROGRESS.md` و`prompts/phase-4.md` وجدول القرارات في `docs/ARCHITECTURE.md §2`.
- **Requires User Action:** D9 ما زال Proposed؛ تعليمات Phase 4 تشترط تحويله إلى Locked بعد موافقة صاحب المشروع، وتنص صراحة على التوقف والسؤال قبل التنفيذ.
- **Requires User Action:** Phase 3 لم تُغلق بسبب تجربة light/dark في ملف يسمح بـmodeين. يلزم إتمام التجربة أو موافقة صريحة على تأجيلها والسماح ببدء Phase 4 مع إبقاء نتيجتها معلّقة.
- لم يبدأ تنفيذ Phase 4؛ التعديل الوحيد لهذه المحاولة هو توثيق فحص البداية هنا. لا dependencies جديدة.
- **Not Tested (توقف عند شروط البداية؛ لا تعديل كود):** `pnpm typecheck` و`pnpm lint` و`pnpm test` وأوامر DoD الخاصة بـPhase 4 لم تُشغّل في هذه المحاولة.

### Phase 3 — 2026-10-26

- **Passed — التجربة الحقيقية بوضع light:** `pnpm smoke:design-system --mode=light` خرج Exit 0 في `Untitled / Page 1`. 8 variables و6 variants داخل 3 sets بنفس الهويات، و3 screen instances. إعادة الشاشة: 0 created / 0 updated / 4 unchanged وعدد فعلي 9 nodes.
- إصلاحات اكتُشفت في Figma الحقيقي: أسماء Variables تعرض `/` بدل `.` مع الاحتفاظ بالـstable ID؛ snapshot لا يقرأ componentPropertyDefinitions من variant؛ والـset ذو variant واحدة يستخدم اسمًا صحيحًا `Variant=Default`. أُضيف خطأ `FIGMA_MODE_LIMIT` بدل إخفاء حد modes تحت INTERNAL_ERROR، والـharness صار يفرض قيود الـAPI الثلاثة.
- **Requires User Action:** تجربة light/dark الأصلية اصطدمت برسالة Figma `in addMode: Limited to 1 modes only`. لم تُحاكَ dark ولم يُدّعَ نجاح تبديل modes. يوجد خيار تشخيص صريح `--mode=light`؛ العينة الأصلية ما زالت تحتوي light/dark.
- [الشاشة الحقيقية](https://www.figma.com/design/omtkdMFHILIuKZQ6Gm94iu/Untitled?node-id=1-42) محفوظة عند x=1000/y=40 بجوار التجارب السابقة. [صورة الشاشة](docs/installation/phase-3-verification/light-screen.png) و[صورة المكونات](docs/installation/phase-3-verification/workspace.png).

- توسيع Design Specification 1.0.0 بصورة متوافقة مع Phase 2: tokens/modes/typography/components/variants وcomponent-instance. العقود وschemas والـregistry في `packages/shared`؛ JSON Schema أُعيد توليده من Zod. لا اعتماد على D6/D9/D11 المقترحة، ولا dependencies جديدة.
- Tokens للألوان primitive/semantic وspacing/radius وخصائص typography. aliases متحققة في جميع modes، مع رفض المراجع الناقصة والدورات وعدم توافق النوع والقيم بعد resolution. مراجع token متاحة لقيم التصميم؛ معرفات البنية والمكونات تبقى صريحة.
- Renderer ينشئ Variables وCollection حقيقية وaliases وText styles، ويربط الخصائص المدعومة بـsetBoundVariable وsetBoundVariableForPaint. x/y وpaint opacity تُحل عند الرسم لأن Figma لا يدعم binding مباشرًا لها؛ تغيّرها يدخل في render intent.
- Components بخصائص TEXT/BOOLEAN/INSTANCE_SWAP/VARIANT وvariants صريحة فقط، وترتيب dependencies مستنتجة من nested instances وswap defaults. الدورات والـvariant combinations غير المعلنة تُرفض قبل الكتابة، والتحقق يشمل تخطيط شجرات المكونات.
- إنشاء صفحة Components مملوكة بالمشروع، وWorkspace/تصنيفات Auto Layout، وComponent Sets/Components فعلية. إعادة الرسم تستخدم نفس الهويات؛ إضافة variant تلحقها بالـset الموجودة. أسماء العرض لا تستخدم كهوية للخصائص: property keys محفوظة تحت stable property IDs، وتغيير الاسم يحافظ على suffix الخاص بها.
- شاشات component-instance تستخدم createInstance وswapComponent وsetProperties للـoverrides، وترث مظهر المكونات دون تصفير fills. البحث والتحديث لا يدخلان في أبناء instances الموروثة.
- Registry في `design-system/components.json` تُحفظ ذريًا بصلاحيات 0600، مع منع symlinks، وتضم IDs/name/category/properties/propertyKeys/variants/dependencies/usage/version. lookup بالاسم والتصنيف وsimilarity الاسم والخصائص، وتحذيرات validation للتشابه ورفض هويات registry المكررة.
- الأدوات الجديدة: `magic_ui_render_design_system`، `magic_ui_find_component`، `magic_ui_read_components`، `magic_ui_read_variables`؛ الإجمالي 10. read_components يقرأ registry المحفوظة في مستند Figma، وread_variables يقرأ Variables الفعلية. الأخطاء/المدخلات/النتائج/المهلة والصلاحيات محددة.
- كشف drift للـvariables/styles/components والهوية المفقودة، مع baselines لا تعتبر لونًا محسوبًا من mode تغييرًا يدويًا. قفل render مشترك، وإعادة فحص الصفحة والإلغاء بين الخطوات غير المتزامنة. علامة pending تمنع تكرار موارد design system بعد فشل جزئي؛ التسوية خارج نطاق المرحلة.
- العينة `scripts/samples/phase-3.design-spec.json`: 8 variables، light/dark، Body style، وButton بأربع combinations من Type × Size × State، وInput وCard، و3 instances في الشاشة. `pnpm smoke:design-system` ودليل `docs/installation/design-system-render.md` جاهزان للتجربة الحقيقية؛ السكريبت لا يحذف أي محتوى.
- الاختبارات توسّع الـVM harness لتشغيل handlers الإنتاجية وتضيف تكامل MCP/WebSocket للرسم المكرر والـregistry والقراءة وإضافة variant إلى نفس set. لا mocks في مسارات الإنتاج.

### Phase 2 — 2026-10-26

- **Passed — التحقق الحقيقي والإغلاق:** `pnpm smoke:render` خرج Exit 0 داخل `Untitled / Page 1`. أول render أنشأ 7 nodes، والثاني 0 created/0 updated/7 unchanged وبنفس mapping. فحص بصري وخصائص Auto Layout ناجحان، والشاشة `1:3` محفوظة ومحددة للمراجعة. أُغلق الـPlugin والخادم ونُظفت credentials الجلسة.

- تقسيم `packages/shared/src/index.ts` إلى exports فقط، والعقود موزعة على `protocol/`, `errors/`, `commands/`, `designSpecification/` مع الحفاظ على exports السابقة واختبارات Phase 1.
- Zod Design Specification 1.0.0: pages/screens وشجرة frame/text/rectangle، مع stable IDs فريدة، ltr/rtl، Auto Layout وabsolute positioning، fixed/hug/fill، padding/spacing/alignment، solid fills/strokes، radius/opacity، typography. لا components أو instances.
- توليد `packages/shared/design-spec.schema.json` بـ`z.toJSONSchema` عبر `pnpm schema:generate`. اختبار يطابق الملف المولّد بالمصدر. validation يرجع المسار الكامل، وmigration ترفض أي إصدار غير معروف. قواعد العلاقات تفحص بـZod؛ JSON Schema وحده لا يفرض uniqueness أو علاقات fill/hug.
- Workspace محصور في `MAGIC_UI_WORKSPACE_ROOT` (افتراضيًا cwd): إنشاء `<ProjectName>-Design/` بملفي `project.json` و`design-spec.json` فقط، قراءة بالـprojectId، منع traversal وsymlinks والكتابة فوق الملفات، حد قراءة 64 KiB وصلاحيات 0600، ومنع تعارض عمليتي initialization متزامنتين. لا dependencies جديدة.
- ثلاث أدوات MCP جديدة بـinput/output schemas: `magic_ui_initialize_project`، `magic_ui_validate_design_spec` محلية بلا Figma، و`magic_ui_render_design` بـsessionId/projectId/screenId وpageId صريح لحماية الصفحة الحالية.
- Renderer فعلي في Main: validate → fonts/cache → plan → create/update → layout/styles → mapping. يحمّل الخطوط المطلوبة فقط، ويعيد FONT_UNAVAILABLE قبل الكتابة بدون fallback. planner مستقل عن Figma.
- الهوية حسب D7 بـ`setSharedPluginData("magic_ui", ...)` مع id/projectId/screenId وintent/hash/snapshot/specVersion. العثور على الأولاد داخل scope الشاشة فقط؛ مرجع root على الصفحة يمنع إنشاء نسخة إذا نُقلت الشاشة أو حُذفت يدويًا.
- تحديث nodes في مكانها، مع مقارنة الخصائص قبل setters ومراعاة فروق float32 والقيم الافتراضية للـpaints. إعادة spec سليمة دون تغييرات لا تكتب أي property أو plugin data. تغيير خاصية واحدة يعدّل node واحدة. تغيير طريقة layout الأب يعيد تطبيق خصائص الأبناء المتأثرة.
- D8: مقارنة خصائص Figma الفعلية بالـsnapshot قبل أي كتابة، وإرجاع DRIFT_DETECTED بتفاصيل عند التعديلات اليدوية أو الهوية المكررة أو اختلاف النوع. لا auto-merge ولا حذف. العناصر المحذوفة من spec ترجع orphanedNodes وتظل موجودة.
- نتائج الرسم تشمل created/updated/unchanged/orphaned، mapping، orphanedNodes، وnodeCount الفعلي داخل الشاشة. حالات RTL تعكس الصفوف الأفقية ومحاذاة start/end بدون تغيير محتوى النص.
- حد النقل الأصلي 65536 byte لم يتغير: طلبات UTF-8 الزائدة تُرفض قبل إرسالها بـMESSAGE_TOO_LARGE، والرد الزائد يتحول لخطأ واضح بدل قطع الاتصال. إلغاء وتغيير الصفحة يُفحصان بعد تحميل الخطوط وقبل الكتابة. الطلبات المتزامنة للرسم تُرفض بـSESSION_BUSY.
- `pnpm smoke:render` وعينة header/list/button في `scripts/samples/phase-2.design-spec.json`. السكريبت يرسم مرتين ويقارن عدد العناصر الفعلي والـmapping مع صفر created/updated في الإعادة. دليل التشغيل في `docs/installation/design-spec-render.md`، وتحديث دليل الاستيراد ليذكر الأدوات الستة.
- **85 اختبارًا ناجحًا**: القديم + schema/planner/workspace/renderer، وMCP/WebSocket مع fake client يشغّل نفس renderer الإنتاج داخل VM، وstdio بعملية مستقلة وworkspace مؤقت.

### Phase 1 — سجل سابق

- Monorepo بـpnpm: `packages/shared` و`packages/mcp-server` و`packages/plugin`، مع TypeScript strict، ESLint، Prettier، Vitest، وأوامر root موحدة. ملف lock محفوظ.
- العقود المشتركة: envelope بإصدار و`correlationId` و`sessionId`، أخطاء ثابتة، schemas لأوامر `ping` و`createFrame` و`readNode` ونتائجها، ورسائل UI ↔ Main. التحقق موجود على حدود الأجزاء.
- MCP server بالـSDK الرسمي عبر stdio؛ الأدوات الثلاث المطلوبة مسجلة بـinput/output schemas وبيانات الصلاحية والمهلة. `--selftest` يستعلم عن الأدوات المسجلة فعلًا عبر MCP، بدون تشغيل Bridge أو كتابة credentials.
- WebSocket Bridge على `127.0.0.1` فقط، منفذ افتراضي 3845 ومتغير `MAGIC_UI_BRIDGE_PORT`، origin allowlist، token عشوائي 256-bit، مقارنة ثابتة الوقت، مهلة مصادقة، حد لحجم الرسالة، heartbeat يصل إلى Main، مهلة الطلب 10 ثوانٍ وإلغاء مرتبط بالـcorrelationId.
- كتابة credentials في `~/.magic-ui/session.json` بصلاحيات `0600` باستبدال ذري، بدون طباعة token. الإغلاق الطبيعي ينظف بيانات جلسته فقط. اختبارات الملفات تستخدم مجلدات مؤقتة، ولم تُنشأ جلسة في home المستخدم أثناء التنفيذ.
- جلسة Plugin واحدة في هذه المرحلة. كل أداة قراءة/إنشاء تستهدف `sessionId` صريحًا؛ الإنشاء يتطلب `pageId` مطابقًا للصفحة الحالية ويرفض تغيير الصفحة قبل الكتابة. الطلب المنقطع ينتهي بـ`TIMEOUT` ولا يُعاد تنفيذه تلقائيًا.
- Plugin Main فعلي يستخدم `figma.createFrame` و`figma.getNodeByIdAsync`. وقت تنفيذ Phase 1 لم يكن D7 مؤكدًا؛ هوية مسار الرسم أُضيفت الآن في Phase 2 بالقرار Locked.
- Plugin UI بـPreact وSignals وCSS Modules: حالة الاتصال، token محفوظ في `figma.clientStorage`، Reconnect، وإعادة اتصال بتأخير متزايد. ملفات البناء: `manifest.json` و`main.js` و`ui.js` و`ui.html` مستقل يحتوي CSS/JS داخله.
- `scripts/fake-plugin-client.ts` محاكاة اختبار فقط، مع اختبارات MCP round-trip عبر WebSocket فعلي، واختبار إضافي عبر stdio وعملية مستقلة من runtime الحقيقي.
- 37 اختبارًا تشمل schemas، token غلط، origin غير موثوق، رفض جلسة ثانية، session mismatch، timeout أثناء الانقطاع، reconnect، heartbeat، cancellation، مطابقة نوع الرد، صلاحيات ملف credentials، حماية symlinks، وMain داخل VM بدون DOM/network أو توليد كود ديناميكي.
- تحقق Chromium من واجهة الـPlugin عند 360px و280px: حالة أولية، زر disabled، رسالة token خاطئ، تعافٍ باستخدام Reconnect، بلا page errors أو horizontal overflow. هذا browser harness وليس تشغيلًا داخل Figma.
- دليل الاستيراد والتجربة اليدوية في `docs/installation/figma-plugin-import.md`، وأمر `pnpm smoke:figma` يشغل الخادم المبني ويختبر إنشاء/قراءة frame حقيقي بعد أن يوصّل المستخدم الـPlugin ويؤكد المستند المستهدف.

## In Progress

- **Phase 9:** لا تنفيذ آلي متبقٍ. benchmark Figma الحقيقي Requires User Action؛ باقي قبول المراحل السابقة كما يلي، دون تحويلها إلى Passed.

- Phase 8: التنفيذ والتحقق الآلي مكتملان. setup الحقيقي وsmoke لاستدعاء Claude `design-agent` Passed؛ المتبقي DoD #6/#7 التفاعلي داخل Figma وباقي العملاء. Phase 6 وPhase 7 مغلقتان.

- Phase 5: تجربة Figma الحقيقية بـ`pnpm smoke:sync` ما زالت Requires User Action. لا توجد عملية smoke شغالة أو جلسة تنتظر إدخالًا.

- Phase 3: الفحص الحقيقي للـVariables والـcomponents والـinstances بوضع light مكتمل. المتبقي فقط تبديل light/dark في ملف يسمح بأكثر من mode.
- لا توجد عملية smoke منتظرة؛ الخادم خرج Exit 0 وcredentials الخاصة بالتجربة نُظفت. لم يُحذف أي node أو variable للمستخدم.

## Verification Log

### Phase 8 — إصلاح تثبيت Claude الحقيقي 2026-10-26

- **Failed ثم Passed — اكتشاف design-agent:** المستخدم شغّل `claude --agent design-agent` من مشروع `snaabble` فأعاد Claude `--agent 'design-agent' not found`. الفحص وجد `~/.claude/agents/design-agent.md` وskill `design-planning` غير مثبتين.
- **Passed — setup الحقيقي:** `./setup.command repair` — Exit 0. Claude 2.1.310: تسجيل `magic-ui` الأصلي مطابق وبقي دون كتابة، `magic-ui-reader` سُجّل بالـCLI الرسمي مع backup/readback؛ الـ20 skills وثلاثة agent files ظهرت Passed في مواضع Claude الافتراضية. setup أعاد build/selftest (29 tools) وhealth check؛ لم يُطبع token. لا استبدال لملفات مستخدم موجودة.
- **Passed — تشغيل agent في Claude CLI:** `claude --agent design-agent --print 'Reply READY only. Do not use tools or modify files.'` — Exit 0، خرج `READY`. يثبت اكتشاف role وتشغيل جلسة نموذج قصيرة، دون ادعاء استخدام MCP/Plugin أو نجاح شاشة login. يلزم بدء جلسة Claude جديدة في `snaabble` لتلقط ملفات user-scope المثبتة.
- **Passed — تحققات الجلسة:** بعد repair، `pnpm typecheck` — Exit 0؛ `pnpm lint` — Exit 0 (`All matched files use Prettier code style!`)؛ `pnpm test` — Exit 0: `Test Files 24 passed (24)`، `Tests 169 passed (169)`، Duration `31.91s`. لم تُشغّل تجربة Figma ضمن هذه المجموعة.
- **Requires User Action:** فتح/ربط Plugin في Figma والتأكد من الصلاحيات التفاعلية لـreader/validation في كل client، ثم تجربة login مع Figma result. DoD #6/#7 الكاملان لم يتحولا إلى Passed.

### Phase 9 — التحقق النهائي 2026-10-26

- **Passed — P9-types:** `pnpm typecheck` — Exit 0، `tsc --noEmit && tsc -p packages/plugin/tsconfig.main.json --noEmit`.
- **Passed — P9-lint:** `pnpm lint` — Exit 0، `All matched files use Prettier code style!`؛ أُعيد بعد كتابة التقرير والسجل. أول lint كشف صياغة fixture sparse-array وملفات JSON مولدة غير منسقة؛ أُصلحت fixture واستُثنيت نتائج القياس المولدة من formatting.
- **Passed — P9-tests:** `pnpm test` — Exit 0: `Test Files 24 passed (24)`، `Tests 169 passed (169)`، `Duration 27.72s`. مقارنة token في stderr تشمل startup وsuccess/failure بعد نهاية العملية. suite تشمل metrics/read-only/correlation، malformed/oversize، validation/canonical equivalence وregressions المراحل السابقة.
- **Passed — P9-build:** `pnpm build` — Exit 0؛ `✓ 125 modules transformed.` و`✓ built in 735ms` و`Plugin built for loopback port 3845: manifest.json, main.js, ui.js, ui.html`. تحذيرا Zod @**PURE** السابقان باقِيان.
- **Passed — P9-skills:** `pnpm skills:lint` — Exit 0: `Passed: 20 skills, required sections, local references and all MCP names checked against --selftest (29 tools).` reader inventory: 18؛ أُضيف performance report فقط ضمن نطاق observability المطلوب.
- **Passed — P9-performance:** `pnpm test:performance` — Exit 0؛ `tests/performance/results/2026-10-26T12-25-48.211Z-current.json`؛ Node v26.11.1 / Apple M2 / darwin arm64. 10000 node: validation 90.742→38.618ms، normalization 249.592→95.039ms، planning 37.844→27.562ms. القيم medians، والـraw samples محفوظة مع environment. القياس aggregate في specs حتى 500 node؛ لا رفع لحد العقد. نقل 2040011 bytes في 181 chunks مع exact reassembly Passed. ملف current عند 12:17:22 كان noisy مع typecheck متزامن؛ النهائي عند 12:25:48 منفصل.
- **Passed — P9-performance-paired:** `node --import tsx tests/performance/comparePlanning.ts` — Exit 0؛ مقارنة متبادلة 15 عينة بعد 4 warmups مع deep equality خارج التوقيت. planning 10000 node: 42.737→31.262ms. جدول incremental لكل تحسين وروابط JSON في docs/development/performance.md.
- **Passed — P9-security:** مراجعة §14 والأدلة في docs/security/review.md. اختبارات real bridge boundaries وread-only بطبقتين وtoken-free logs ضمن P9-tests؛ مصادر runtime لا تستورد shell APIs، وPlugin source/Main bundle بلا direct eval/new Function في الفحص المحدد. حدود TOCTOU والثقة في نفس المستخدم موثقة، وليس ادعاء audit احترافي شامل.
- **Failed ثم Passed — P9-audit:** `pnpm audit --json` الأول Exit 1: moderate=3، critical=2. بعد Vitest 4.1.12: Exit 0 وكل المستويات=0. `pnpm audit` نفسه كما في README — Exit 0: `No known vulnerabilities found`. أدلة before/after داخل docs/security.
- **Failed ثم Passed — P9-clean:** المحاولة الأولى لم تبدأ Codex config inspection لأن harness عيّن CODEX_HOME غير موجود؛ أُنشئ directory فارغ قبل CLI دون config مُسبق. إعادة `node --import tsx scripts/verify-clean-install.ts` — Exit 0، clone Git جديد من snapshot العمل الحالي، لا node_modules منسوخة، `./setup.command install` ثم `./setup.command verify` ثم `pnpm test`: `24 passed (24)`، `169 passed (169)`، `Duration 32.26s`. النص: `Passed: clean Git clone without node_modules; real setup install + verify + pnpm test.` الدليل محفوظ في `/private/var/folders/32/ttvmzbn52j73k1vlyl56r5mw0000gn/T/magic-ui-clean-3mKHaw/verification.txt`؛ خدمة OpenCode المؤقتة أُوقفت. لا تعديل لـconfigs المستخدم الحقيقي. import/pairing وinteractive discovery في summary يظلان Requires User Action.
- **Failed ثم Passed — P9-hygiene:** الفحص وجد 3 ملفات .pnpm-store/v11/index.db* متتبّعة. أُضيف ignore لـGit/lint/format وأُزيل تتبّع الثلاثة بـ`git rm --cached` فقط، والملفات باقية على القرص. scanner على 205 ملفات نصية tracked/non-ignored أعاد `matchingPathsOnly: []`؛ فحص محدود لcredential filenames/private-key/token patterns وليس ضمانًا ضد أي secret محتمل. `git diff --check` و`git diff --cached --check` — Exit 0.
- **Passed — P9-docs:** README وأدلة architecture/security/troubleshooting/development وFINAL-REPORT مبنية على هذا السجل. كل أوامر README التنفيذية شُغلت فعلًا: setup install/verify في sandbox النظيفة؛ typecheck/lint/test/build/skills:lint/test:performance/audit في المشروع. محتوى docs تغيّر بعد clone؛ source runtime المختبَر مطابق. الأوامر اليدوية غير المشغلة موضحة خارج quick-start commands على أنها Requires User Action.
- **Passed — P9-history (نقل دليل سابق، ليس إعادة تجربة):** Phase 1/2 create/read/render داخل Figma وPhase 3 light mode كما في سطور Verification Log أدناه؛ Phase 4 export/preview على test4 كما في Done › Phase 4 — التحقق الحقيقي، وPhase 6 assets/mockups/Layers كما في Done › Phase 6 — إغلاق التحقق الحقيقي؛ Phase 7 registration الحقيقي بbackups كما في Done › Phase 7 — التثبيت الحقيقي؛ Phase 8 catalog/config كما في Verification Log › Phase 8. هذه السطور هي مرجع ادعاءات التاريخ في التقرير النهائي ولا تؤكد تشغيل build Phase 9 في Figma.
- **Passed — P9-help / Requires User Action — P9-figma:** `pnpm bench:figma --help` — Exit 0. render/read الحقيقي 100/1000/5000 لم يُشغّل؛ لا نتائج Figma مُختلقة. script يحفظ النتائج الجزئية ويتطلب اختيار session وBENCH في scratch file ويحافظ على كل nodes/workspaces.
- **Failed ثم Passed — البيئة:** أول benchmark المحلي تعذّر عند `listen EPERM 127.0.0.1` داخل القيود؛ أُعيد بالأذونات المناسبة. أول typecheck بعد observability كشف literal type لـUUID، ثم fixture inferred union؛ صُححت annotations وأصبح Passed.

### Phase 8 — التحقق النهائي 2026-10-26

- **Passed:** `pnpm typecheck` — Exit 0: `tsc --noEmit && tsc -p packages/plugin/tsconfig.main.json --noEmit`.
- **Passed:** `pnpm lint` — Exit 0: ESLint و`All matched files use Prettier code style!`؛ أُعيد بعد تحديث هذا السجل.
- **Passed:** `pnpm test` — Exit 0 على التنفيذ النهائي: `Test Files 21 passed (21)`، `Tests 162 passed (162)`، `Duration 28.43s`. لا Figma أو model session حقيقية ضمن هذه الاختبارات.
- **Passed:** `pnpm build` — Exit 0؛ Plugin: `✓ built in 519ms` و`Plugin built for loopback port 3845: manifest.json, main.js, ui.js, ui.html`. تحذيرا Zod `@__PURE__` السابقان ما زالا ظاهرين ولم يمنعا البناء.
- **Passed — DoD #2:** `pnpm skills:lint` — Exit 0: `Passed: 20 skills, required sections, local references and all MCP names checked against --selftest (28 tools).`
- **Passed — DoD #3/#4/#5:** tests/reader.integration.test.ts وdesignValidation.test.ts وagentArtifacts.test.ts وsetup.test.ts ضمن المجموعة أعلاه؛ read-only لديه 17 أداة دون write tools، ومشاكل component/layout/text/fonts/instances/tokens/assets تظهر؛ visual unverified. skill المستخدم المعدلة محفوظة والناقص اتضاف، والتشغيل الثاني مطابق.
- **Passed:** `node --import tsx scripts/verify-setup-sandbox.ts` — Exit 0 على النسخة النهائية، تشغيل setup مرتين بالـCLIs الحقيقية من `Magic UI project` وHOME مؤقت. المخرج: `Passed: real pnpm install/build and all three real client CLIs ran twice from a path with spaces; configs are byte-identical and unrelated servers/backups are preserved.` تسجيلان لكل client؛ backup قبل كل entry جديدة؛ الخدمة المؤقتة لـOpenCode أُوقفت ثم أُزيل sandbox الناجح فقط.
- **Passed:** `node --import tsx scripts/verify-agent-clients.ts` — Exit 0؛ Codex `skills/list` اكتشف 20 اسمًا؛ OpenCode `debug agents` أعاد IDs الثلاثة. السطران: `Passed: figma-reader-agent; only magic-ui-reader enabled with --read-only, 17 allowlisted tools and the requested output root. No model session launched.` ونفس النتيجة لـvalidation-agent. تأكد بقاء ملف Codex الأصلي دون تغيير، وإيقاف خدمة sandbox وتنظيفه.
- **Passed:** `git diff --check` — Exit 0.
- **Failed ثم Passed:** التشغيل الأول للاختبارات داخل القيود رفض loopback بـ`listen EPERM`، وبعض setup fixtures انتهت timeout؛ أُعيدت بالأذونات المناسبة داخل sandbox فقط. فشل أول تشغيل كامل بسبب توقعات registry القديمة، وتصنيف aliases macOS كـsymlinks، واعتبار pattern الخاص بعميل OpenCode اسم MCP حقيقيًا؛ أُصلحت، ثم Passed في المجموعة النهائية.
- **Failed ثم Passed:** `pnpm build` الأول رفض allowImportingTsExtensions مع emit؛ أُضيف override خاص ببناء shared ثم نجح البناء. فحص Codex launcher الأول أثبت أن quoted override keys لا تعمل وأن list لا يعيد enabled_tools؛ صُحح الأمر وفُحصت allowlist عبر get الحقيقي.
- **Failed ثم Passed:** native OpenCode discovery في HOME جديد اصطدم بمنفذ managed service الافتراضي؛ الـharness أصبح يخصص منفذًا منفصلًا بالـCLI. بعد ذلك رصد `[]` في أول قراءة قبل warming؛ retry محدودة واحدة أصلحت التحقق. لا تعديل لخدمة أو إعدادات المستخدم لحل المشكلة.
- **Failed — تحقق اختياري بسبب البيئة:** `skill-creator/scripts/quick_validate.py` لم يعمل على Python المتاح ولا bundled Python: `ModuleNotFoundError: No module named 'yaml'`. لم تُضف dependency للمشروع لهذا الغرض. lint المشروع واكتشاف Codex الحقيقي تحققا من skills بنجاح، لكن هذا السكريبت الاختياري نفسه ليس Passed.
- **Requires User Action:** DoD #6 التفاعلي وDoD #7 login E2E لم يُنفذا. نجاح native catalog/config checks لا يحوّلهما إلى Passed.

### Phase 3 — التجربة الحقيقية والإصلاحات 2026-10-26

- **Failed / Requires User Action:** تجربة العينة الأصلية ذات modeين في `Untitled` توقفت عند إضافة dark. إعادة التحقق مباشرة عبر Figma API أعادت `Error: in addMode: Limited to 1 modes only`. هذا قيد الملف/خطة Figma، لا خطأ تم تجاوزه في الكود. خطأ النقل صار `FIGMA_MODE_LIMIT`، واختباره الآلي Passed.
- **Failed ثم Passed:** `createVariable('primitive.white', ...)` أعاد `invalid variable name`. عُدّل اسم العرض إلى `primitive/white` وبقي shared stable ID هو `primitive.white`. المتغيرات الحقيقية `VariableID:1:11` حتى `VariableID:1:18` محفوظة.
- **Failed ثم Passed:** Figma رفض قراءة componentPropertyDefinitions من variant برسالة `Can only get component property definitions of a component set or non-variant component`. يُقرأ التعريف على الـset فقط؛ snapshot للـvariants لا يستدعي getter غير صالح.
- **Failed ثم Passed:** إعادة تسمية variant الوحيدة إلى `Default` جعلت set غير صالحة عند الرسم الثاني (`Component set has existing errors`). أصبح الاسم `Variant=Default` قبل قراءة التعريفات.
- **Passed:** قبل كل إعادة تمت قراءة الحالة الجزئية. أُصلحت metadata الخاصة بعينة `phase3-smoke` فقط بعد تحديد موضع الفشل: collection الفارغة ثم snapshots التي تعذر تسجيلها بسبب getter ثم اسما variant المنفردتين. لا حذف، ولا نسخ جديدة، ولا تجاوز آلي عام لـpending/drift في المنتج. بقيت collection `VariableCollectionId:1:10` ونفس sets طوال الإصلاح.
- **Passed:** `pnpm smoke:design-system --mode=light` عبر stdio → WebSocket → Magic UI الحقيقي، Exit 0. 8 variables و6 component variants بنفس IDs في الإعادة. الشاشة `1:42`، instances: Button `1:43` وInput `1:45` وCard `1:47`، وعدد nodes الحقيقي 9 بما فيها الأطفال الموروثة.
- **Passed:** فحص خصائص Figma الفعلية: Button set `1:25` بأربع variants وTEXT/BOOLEAN/VARIANT، Input set `1:35` وTEXT، Card set `1:41` وINSTANCE_SWAP. Body Text style فعلي Inter Regular 16. semantic aliases تشير إلى primitive variables الحقيقية، وspacing=12 وradius=8 من نوع FLOAT.
- **Passed:** لوحة Variables أظهرت Magic UI و8 variables وعمود light، وقيم primitive الفعلية. فُحصت الشاشة والمكونات بصور Figma export؛ لا قص للنصوص أو تداخل بينها. root الشاشة 520×304، ومكانها 1000/40. أُبقيت محددة للمراجعة.
- **Passed:** الخادم أغلق ونظّف `~/.magic-ui/session.json`؛ لا smoke منتظرة. آخر workspace محفوظ في `/private/var/folders/32/ttvmzbn52j73k1vlyl56r5mw0000gn/T/magic-ui-render-smoke-EZdNsq/Phase3Smoke-Design`.
- **Passed:** `pnpm typecheck` و`pnpm lint` و`pnpm test` بعد الإصلاحات؛ 96 اختبارًا في 11 ملفًا. `pnpm build` ناجح مع تحذيري Zod المعروفين فقط. لا dependencies جديدة.
- **Not Tested (قيد Figma):** التغير البصري للـinstances عند تبديل light/dark؛ يتطلب ملفًا يسمح بـmodeين. المرحلة تبقى مفتوحة لهذا البند وحده.

المخرجات الفعلية لآخر تشغيل — Exit 0:

```text
Target: Untitled / Page 1
Passed: 8 variables and 6 component variants retained their identities.
First render: {"nodeCount":9,"created":0,"updated":1,"unchanged":3,"orphaned":0,"mapping":[{"id":"home","nodeId":"1:42"},{"id":"home-button","nodeId":"1:43"},{"id":"home-input","nodeId":"1:45"},{"id":"home-card","nodeId":"1:47"}],"orphanedNodes":[]}
Second render: {"nodeCount":9,"created":0,"updated":0,"unchanged":4,"orphaned":0,"mapping":[{"id":"home","nodeId":"1:42"},{"id":"home-button","nodeId":"1:43"},{"id":"home-input","nodeId":"1:45"},{"id":"home-card","nodeId":"1:47"}],"orphanedNodes":[]}
Passed: node count unchanged (9 → 9), 0 created, 0 updated, 4 unchanged; identical mapping.
```

التحديث الوحيد في أول render لهذا التشغيل هو نقل root العينة بجوار Phase 2؛ تشغيل النجاح السابق أنشأ root والـ3 instances ثم أعادها بلا تغيير.

### Phase 3 — 2026-10-26

- **Passed:** `pnpm typecheck` — Exit 0، TypeScript strict للجذر وPlugin Main.
- **Passed:** `pnpm lint` — Exit 0؛ ESLint وPrettier.
- **Passed:** `pnpm schema:generate` — `Generated packages/shared/design-spec.schema.json from Zod v1.`؛ اختبار مطابقة الملف بالمصدر ناجح.
- **Passed:** `pnpm test` — 95 اختبارًا في 11 ملفًا. يتضمن aliases/modes/reference errors/dependency ordering/cycles/similarity/duplicate registry، النقل الكامل عبر fake client، ثبات الأعداد والهويات، إضافة variant لنفس set، حماية symlinks، font/drift/cancellation/page/concurrency/partial failure، وmode-resolved paint changes.
- **Passed:** `pnpm build` — shared/server/plugin؛ ملفات manifest/main/ui جاهزة. تحذيرا Zod السابقان بخصوص `@__PURE__` ما زالا ظاهرين دون تعطيل البناء.
- **Passed:** `pnpm --filter mcp-server start --selftest` — Exit 0 وأظهر الأدوات العشرة، منها الأدوات الأربع الجديدة.
- **Requires User Action:** `pnpm smoke:design-system` داخل Figma الحقيقي، وفحص Variables panel وText styles وخصائص المكونات وتبديل light/dark بصريًا. لم يُشغّل في هذه الجلسة ولم تُدّعَ نتيجة Figma حقيقية.
- **Failed ثم Passed:** التشغيل الأول للاختبارات داخل sandbox منع WebSocket بـ`listen EPERM: operation not permitted 127.0.0.1`؛ أعيد التشغيل بالصلاحية المحلية المناسبة ونجح.
- **Failed ثم Passed:** اختبار إعادة تسمية property كشف أن الـharness لم ينقل property key الجديدة إلى instances كما تفعل Figma؛ أُصلحت المحاكاة واختُبرت المحافظة على suffix دون إنشاء property إضافية. أخطاء typing الأولية عولجت، والنتيجة النهائية لـtypecheck ناجحة.

مقتطف من مخرجات الاختبارات الفعلية:

```text
Test Files  11 passed (11)
     Tests  95 passed (95)
```

### Phase 2 — التحقق الحقيقي وإغلاق المرحلة 2026-10-26

- **Passed:** أُعيد `pnpm build` بنجاح، ثم أُعيد فتح Plugin Magic UI من قائمة Development لتشغيل البناء الحالي. تحذيرا Zod المعروفان فقط، ولا تعديلات كود لازمة.
- **Passed:** اتصال محلي حقيقي داخل `Untitled / Page 1` ثم تنفيذ `pnpm smoke:render` على الخادم المبني عبر stdio. إدخال token تم مباشرة إلى الحقل الآمن، دون عرضه في المخرجات أو الصور.
- **Passed:** الشاشة [Magic UI Phase 2 smoke](https://www.figma.com/design/omtkdMFHILIuKZQ6Gm94iu/Untitled?node-id=1-3)، root `1:3`، و6 أبناء بهويات `1:4` حتى `1:9`. عدد العناصر لم يتغير في الإعادة، ولم تُحذف أو تُعدّل تجربة Phase 1.
- **Passed:** فحص الشاشة بصريًا في Figma Desktop: النصوص واضحة بدون قص أو تداخل. الشاشة width=400 وheight=223 Hug وpadding=24 وgap=24 وcornerRadius=16؛ القائمة width=352 Fill وheight=50 Hug وgap=12؛ الزر width=352 Fill وheight=48 Fixed وHorizontal Auto Layout بمحاذاة center وcornerRadius=8 وfill=#2463EB.
- **Passed:** حفظ [لقطة التحقق](docs/installation/phase-2-render-verified.png)، وإبقاء الشاشة محددة في Figma للمراجعة.
- **Passed:** السكريبت خرج Exit 0، والخادم أغلق وحذف `~/.magic-ui/session.json` الخاص بالاختبار. أُغلقت نافذة الـPlugin، ولا عملية منتظرة. الـworkspace المؤقت متروك للمراجعة في `/private/var/folders/32/ttvmzbn52j73k1vlyl56r5mw0000gn/T/magic-ui-render-smoke-7a9MQD/Phase2Smoke-Design`.
- **Passed:** `pnpm typecheck` و`pnpm lint` و`pnpm test` بعد التجربة؛ 85 اختبارًا في 10 ملفات. لا dependencies أو تعديلات إعدادات خارج المشروع.

المخرجات الفعلية لـ`pnpm smoke:render` — Exit 0:

```text
Target: Untitled / Page 1
First render: {"nodeCount":7,"created":7,"updated":0,"unchanged":0,"orphaned":0,"mapping":[{"id":"home","nodeId":"1:3"},{"id":"header","nodeId":"1:4"},{"id":"list","nodeId":"1:5"},{"id":"item-one","nodeId":"1:6"},{"id":"item-two","nodeId":"1:7"},{"id":"button","nodeId":"1:8"},{"id":"button-label","nodeId":"1:9"}],"orphanedNodes":[]}
Second render: {"nodeCount":7,"created":0,"updated":0,"unchanged":7,"orphaned":0,"mapping":[{"id":"home","nodeId":"1:3"},{"id":"header","nodeId":"1:4"},{"id":"list","nodeId":"1:5"},{"id":"item-one","nodeId":"1:6"},{"id":"item-two","nodeId":"1:7"},{"id":"button","nodeId":"1:8"},{"id":"button-label","nodeId":"1:9"}],"orphanedNodes":[]}
Passed: node count unchanged (7 → 7), 0 created, 0 updated, 7 unchanged; identical mapping.
The screen and sample workspace are retained for inspection.
```

فحوص الإغلاق — Exit 0:

```text
$ tsc --noEmit && tsc -p packages/plugin/tsconfig.main.json --noEmit
$ eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
$ vitest run

 RUN  v3.2.7 /Users/khaled/Desktop/programming/tools/magic-ui

 ✓ tests/designWorkspace.test.ts (11 tests) 86ms
 ✓ tests/pluginMain.test.ts (7 tests) 221ms
 ✓ tests/render.integration.test.ts (4 tests) 290ms
 ✓ tests/pluginConnectionManager.test.ts (2 tests) 721ms
   ✓ the actual UI connection manager authenticates, forwards commands and reconnects after disconnection  663ms
 ✓ tests/designRenderer.test.ts (14 tests) 681ms
 ✓ tests/sessionCredentials.test.ts (3 tests) 55ms
 ✓ tests/designSpecification.test.ts (17 tests) 33ms
 ✓ tests/bridge.integration.test.ts (11 tests) 1097ms
 ✓ tests/shared.test.ts (15 tests) 12ms
 ✓ tests/stdio.integration.test.ts (1 test) 1160ms
   ✓ runs production startup, MCP negotiation and frame/render round-trips over stdio with private credentials  1160ms

 Test Files  10 passed (10)
      Tests  85 passed (85)
   Start at  02:44:48
   Duration  2.55s (transform 614ms, setup 0ms, collect 4.12s, tests 4.36s, environment 1ms, prepare 1.19s)

Passed: smoke session credentials were removed after shutdown.
```

### Phase 2 — التحقق النهائي 2026-10-26

البيئة: macOS، Node **v26.11.1**، pnpm **11.25.0**.

| التحقق / الأمر                                      | النتيجة                                                                                             |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Phase 1 مكتملة وD7/D8/D12 Locked                    | **Passed** — تم فحص الملفات قبل التنفيذ                                                             |
| `pnpm schema:generate`                              | **Passed** — JSON Schema من Zod 4، قابل لإعادة التوليد ومتوافق مع formatter                         |
| `pnpm typecheck`                                    | **Passed** — Exit 0، بما فيه Main بدون DOM typings                                                  |
| `pnpm lint`                                         | **Passed** — Exit 0، ESLint وPrettier                                                               |
| `pnpm test`                                         | **Passed** — 10 ملفات، 85 اختبارًا، Exit 0؛ الاتصالات المحلية احتاجت صلاحية البيئة المناسبة         |
| Schema: spec صحيحة و14 حالة خاطئة بمساراتها         | **Passed** — بالإضافة إلى migration وإعادة توليد JSON Schema                                        |
| Render planner بدون Figma                           | **Passed** — create/unchanged/update/orphaned operations                                            |
| Integration أول render ثم إعادته                    | **Passed** — 7 created، ثم 0 created/0 updated/7 unchanged، ونفس mapping                            |
| Integration تعديل opacity لعنصر واحد                | **Passed** — 1 updated فقط، 6 unchanged، لا إنشاء إضافي                                             |
| Path traversal وsymlink وملفات تالفة/كبيرة          | **Passed** — unit + MCP boundary، دون قراءة spec خارج root المسموح                                  |
| Fonts/drift/orphans/RTL/cancel/page/concurrency     | **Passed** — harness يشغّل renderer الإنتاج في VM؛ لا يعتبر فحصًا بصريًا في Figma                   |
| stdio production startup + frame/render round-trips | **Passed** — عملية مستقلة، workspace مؤقت وcredentials بصلاحيات 0600 وتنظيفها عند الإغلاق           |
| حد طلبات UTF-8 والردود الكبيرة                      | **Passed** — MESSAGE_TOO_LARGE بدون رفع الحد الأصلي                                                 |
| `pnpm build`                                        | **Passed** — Exit 0، shared/server/plugin؛ تحذيرا Zod السابقان فقط                                  |
| `pnpm --filter mcp-server start --selftest`         | **Passed** — الأدوات الستة من المصدر                                                                |
| `node packages/mcp-server/dist/index.js --selftest` | **Passed** — الأدوات الستة من البناء النهائي                                                        |
| `pnpm smoke:render` داخل Figma + الفحص البصري       | **Passed** — Exit 0؛ 7 nodes ثم نفس العدد والمعرّفات، وفحص بصري وخصائص Auto Layout في Figma Desktop |
| Node 24 LTS                                         | **Not Tested (غير مثبت؛ الاختبارات على v26.11.1)**                                                  |

#### المخرجات الفعلية النهائية

```text
$ tsc --noEmit && tsc -p packages/plugin/tsconfig.main.json --noEmit
$ eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
$ vitest run

 RUN  v3.2.7 /Users/khaled/Desktop/programming/tools/magic-ui

 ✓ tests/pluginMain.test.ts (7 tests) 390ms
 ✓ tests/designWorkspace.test.ts (11 tests) 287ms
 ✓ tests/render.integration.test.ts (4 tests) 366ms
 ✓ tests/designRenderer.test.ts (14 tests) 808ms
 ✓ tests/pluginConnectionManager.test.ts (2 tests) 787ms
   ✓ the actual UI connection manager authenticates, forwards commands and reconnects after disconnection  702ms
 ✓ tests/sessionCredentials.test.ts (3 tests) 37ms
 ✓ tests/stdio.integration.test.ts (1 test) 880ms
   ✓ runs production startup, MCP negotiation and frame/render round-trips over stdio with private credentials  880ms
 ✓ tests/shared.test.ts (15 tests) 11ms
 ✓ tests/designSpecification.test.ts (17 tests) 107ms
 ✓ tests/bridge.integration.test.ts (11 tests) 1150ms

 Test Files  10 passed (10)
      Tests  85 passed (85)
   Start at  02:40:16
   Duration  2.88s (transform 332ms, setup 0ms, collect 3.67s, tests 4.82s, environment 1ms, prepare 1.45s)
```

توليد schema:

```text
$ node --import tsx scripts/generate-design-schema.ts
Generated packages/shared/design-spec.schema.json from Zod v1.
```

مقتطف البناء النهائي:

```text
packages/shared build: Done
packages/mcp-server build: Done
packages/plugin build: ✓ 112 modules transformed.
packages/plugin build: rendering chunks...
packages/plugin build: ✓ built in 1.76s
packages/plugin build: Plugin built for loopback port 3845: manifest.json, main.js, ui.js, ui.html
packages/plugin build: Done
```

كل من selftest المصدر والمبني طبع:

```text
magic_ui_get_connection_status
magic_ui_create_frame
magic_ui_read_node
magic_ui_initialize_project
magic_ui_validate_design_spec
magic_ui_render_design
```

#### تعارضات وملاحظات التنفيذ

- نص Phase 2 يذكر `setPluginData`، لكنه يحيل إلى D7 الذي تم تأكيده لاحقًا بـ`setSharedPluginData`. اتُّبع القرار Locked؛ اقتراح تصحيح سطر prompt إلى الاسم المعتمد، بدون تغيير Architecture أو إعادة فتح القرار.
- رقم أسطر `shared/src/index.ts` في prompt وصف للحالة السابقة؛ تم تقسيم الملف الفعلي مع إبقاء exports القديمة.
- §7 في Architecture يعرض مثالًا بخصائص `children` وcomponent-instance تخص مراحل لاحقة. عقد Phase 2 المطلوب يستخدم `nodes` وثلاثة أنواع فقط، ولم تُنفذ components.
- root الـworkspace يجب أن يكون مسارًا حقيقيًا موجودًا وتحت سيطرة المستخدم. تغيير بنية المجلدات خارجيًا بالتزامن مع I/O غير مدعوم؛ symlinks الثابتة وtraversal مرفوضان ومختبران.
- الرسم محدود بـ500 node وعمق 32. كتابة Figma بعد preflight دفعة متزامنة محدودة، لذلك الإلغاء الذي يصل أثناء تلك الدفعة لا يعمل rollback. الفشل الجزئي يحتفظ بالهوية ويحتاج فحصًا؛ لا حذف أو إعادة إنشاء تلقائية.
- أول فحص أنواع **Failed** بسبب recursive schema inference؛ أُضيفت أنواع recursive صريحة بلا any ثم **Passed**. ظهر خطأ SceneNode/layoutPositioning وأُصلح بـtype guard.
- أول ESLint **Failed** بسبب متغيري destructuring غير مستخدمين؛ استُبدلا ثم **Passed**.
- أول `pnpm test` داخل البيئة المقيدة **Failed**: 14 فشل اتصال بـ`listen EPERM 127.0.0.1`/Connection closed، و50 اختبارًا ناجحًا وقتها. إعادة التشغيل بصلاحية الاتصالات المحلية نجحت، ثم نجحت المجموعة النهائية 85/85 بعد الإضافات.
- تحذيرا Rollup من `@__PURE__` في Zod 4.6.7 ظلا كما في Phase 1؛ لم يمنعا البناء ولم تُعدّل الحزمة لإخفائهما.

### Phase 1 — سجل التحقق السابق

التاريخ: **2026-10-26**. البيئة الفعلية: macOS، Node **v26.11.1**، pnpm **11.25.0**. Node 24 LTS لم يكن مثبتًا، لذلك لم تُشغّل الاختبارات عليه.

| التحقق / الأمر                                                                       | النتيجة                                                                                              |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Pre-check والقرارات الستة                                                            | **Passed** — تأكيد المستخدم ثم تحويل الستة فقط إلى Locked                                            |
| `pnpm install`                                                                       | **Passed** — اكتمل بعد إتاحة تنزيل الحزم وتحديد `allowBuilds: { esbuild: true }` المتوافق مع pnpm 11 |
| `pnpm typecheck`                                                                     | **Passed** — Exit 0، يشمل تحقق منفصل لـPlugin Main بدون DOM typings                                  |
| `pnpm lint`                                                                          | **Passed** — Exit 0، ESLint وPrettier                                                                |
| `pnpm test`                                                                          | **Passed** — 6 ملفات، 37 اختبارًا، Exit 0؛ تشغيل الاتصالات المحلية احتاج صلاحيات البيئة المناسبة     |
| round-trip عبر MCP وWebSocket وfake plugin                                           | **Passed** — إنشاء nodeId ثم قراءة نفس بيانات الـframe                                               |
| round-trip عبر stdio وعملية مستقلة                                                   | **Passed** — runtime الحقيقي وملف credentials مؤقت بصلاحيات 0600، وتنظيف عند إغلاق العميل            |
| token خاطئ                                                                           | **Passed** — `AUTH_FAILED`، والجلسة القائمة لم تتغير                                                 |
| انقطاع أثناء طلب ثم reconnect                                                        | **Passed** — الطلب القديم `TIMEOUT`، والطلب الجديد ينجح بدون إعادة إنشاء الطلب القديم                |
| heartbeat وcancellation ورفض origin/session غير صالحين                               | **Passed**                                                                                           |
| `pnpm --filter mcp-server start --selftest`                                          | **Passed** — طبع الأدوات الثلاث                                                                      |
| `node packages/mcp-server/dist/index.js --selftest`                                  | **Passed** — نفس الأدوات من النسخة المبنية                                                           |
| `pnpm build`                                                                         | **Passed** — ملفات shared وserver والـPlugin؛ يوجد تحذيرا annotation في Zod موضحان أدناه             |
| `MAGIC_UI_BRIDGE_PORT=3846 pnpm --filter @magic-ui/plugin build` ثم فحص manifest وUI | **Passed** — المنفذ متطابق في الاثنين. أُعيد `pnpm build` بعدها، والمخرجات النهائية على 3845         |
| `.../webapp-testing/.venv/bin/python scripts/verify-plugin-ui.py`                    | **Passed** — Chromium، حالات الاتصال وأحجام 360/280، دون Figma حقيقي                                 |
| Impeccable detector للواجهة                                                          | **Passed** — output: `[]`                                                                            |
| مراجعة مستقلة للصور والكود                                                           | **Passed** — disposition `ship` للنطاق المحدود، بدون ملاحظات مؤثرة                                   |
| `pnpm smoke:figma` والـPlugin داخل Figma Desktop                                     | **Passed** — استيراد وتشغيل واتصال حقيقي، وإنشاء وقراءة node `1:2` في `Untitled / Page 1`؛ Exit 0    |
| مظهر الـPlugin داخل Figma بالثيم الداكن                                              | **Passed** — عُرضت الواجهة داخل Figma بالثيم الداكن، وحالات الاتصال وعناصر التحكم ظهرت بوضوح         |
| الاختبارات على Node 24 LTS                                                           | **Not Tested (غير مثبت في البيئة؛ التشغيل تم على Node v26.11.1)**                                    |

### مخرجات التحقق الفعلية

`pnpm typecheck` — Exit 0:

```text
$ tsc --noEmit && tsc -p packages/plugin/tsconfig.main.json --noEmit
```

`pnpm lint` — Exit 0:

```text
$ eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

`pnpm test` — Exit 0:

```text
$ vitest run

 RUN  v3.2.7 /Users/khaled/Desktop/programming/tools/magic-ui

 ✓ tests/shared.test.ts (14 tests) 18ms
 ✓ tests/sessionCredentials.test.ts (3 tests) 69ms
 ✓ tests/pluginMain.test.ts (5 tests) 77ms
 ✓ tests/stdio.integration.test.ts (1 test) 375ms
   ✓ runs production startup, MCP negotiation and frame round-trip over stdio with private credentials  375ms
 ✓ tests/pluginConnectionManager.test.ts (2 tests) 627ms
   ✓ the actual UI connection manager authenticates, forwards commands and reconnects after disconnection  575ms
 ✓ tests/bridge.integration.test.ts (11 tests) 955ms

 Test Files  6 passed (6)
      Tests  36 passed (36)
   Start at  02:04:26
   Duration  1.55s (transform 159ms, setup 0ms, collect 1.11s, tests 2.12s, environment 1ms, prepare 476ms)
```

`pnpm --filter mcp-server start --selftest` — Exit 0:

```text
$ node --import tsx src/index.ts --selftest
magic_ui_get_connection_status
magic_ui_create_frame
magic_ui_read_node
```

مقتطف ختام `pnpm build` — Exit 0:

```text
packages/shared build: Done
packages/mcp-server build: Done
packages/plugin build: ✓ 104 modules transformed.
packages/plugin build: rendering chunks...
packages/plugin build: ✓ built in 355ms
packages/plugin build: Plugin built for loopback port 3845: manifest.json, main.js, ui.js, ui.html
packages/plugin build: Done
```

تحذيرا البناء صادران من تعليقات `@__PURE__` في Zod 4.6.7، في `v4/core/util.js` و`v4/core/regexes.js`. الرسالة الفعلية المشتركة:

```text
contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.
```

التحذيران لم يمنعا البناء، ولم يتم إخفاؤهما أو تعديل dependency لتجاهلهما.

التحقق من المنفذ والواجهة:

```text
Passed: custom port 3846 matches manifest and UI bundle.
Passed: browser UI load, disabled input state, incorrect-token error, reconnect recovery, no page errors, no horizontal overflow at 360px / 280px.
```

### التحقق الحقيقي وإصلاحات Figma — 2026-10-26

- **Passed:** ظهر `Magic UI has been imported` بعد استيراد `packages/plugin/dist/manifest.json` عبر واجهة Figma Desktop.
- **Passed:** ظهرت حالة `Connected. Ready for frame commands.` داخل الـPlugin في الملف `Untitled`، صفحة `Page 1`.
- **Passed:** `pnpm smoke:figma` نفّذ الإنشاء والقراءة الفعليين ثم خرج Exit 0. الملف: `https://www.figma.com/design/omtkdMFHILIuKZQ6Gm94iu/Untitled?node-id=1-2`.
- **Passed:** فحص لوحة خصائص Figma أكد X=40 وY=40 وWidth=400 وHeight=240، ووجود طبقة `Magic UI Phase 1 smoke`. لم تُحذف nodes أو إعدادات المستخدم.
- **Failed ثم Passed بعد الإصلاح:** Figma رفض `ws://127.0.0.1:3845` في `devAllowedDomains` برسالة `must be a valid URL`. الـmanifest وUI يستخدمان الآن `ws://localhost:3845` فقط؛ الـserver ما زال مربوطًا بـ`127.0.0.1` حسب D4. هذا تصحيح توافق للـmanifest الموصوف في §6 وليس تغييرًا للقرار Locked.
- **Failed ثم Passed بعد الإصلاح:** بيئة Figma رفضت تعليقًا في Zod يحتوي `import()` برسالة `possible import expression rejected`. Main يُبنى الآن بـminification وبدون legal comments. أُضيف اختبار يمنع وجود import expressions في الحزمة النهائية.
- **Failed ثم Passed بعد الإصلاح:** iframe الفعلي لا يوفّر `crypto.randomUUID`. `createMessageId` يستخدم `crypto.getRandomValues` الآمن، واختبارات مدير الاتصال تعمل الآن بدون randomUUID.
- **Failed ثم Passed بعد الإصلاح:** ردود Figma تصل من نافذة أعلى من `parent` المباشر؛ تم السماح بمصدر `https://www.figma.com` الموثوق بجانب parent، مع استمرار schemas وcorrelationId. تشخيص metadata المؤقت أُزيل من الكود دون تسجيل محتوى الرسائل أو token.
- **Passed:** `pnpm typecheck` و`pnpm lint` و`pnpm test` بعد الإصلاحات؛ 37 اختبارًا. لا dependencies جديدة.

مخرجات الاختبار الحقيقي:

```text
Target: Untitled / Page 1
Passed: created and read the same Figma frame.
{
  "nodeId": "1:2",
  "name": "Magic UI Phase 1 smoke",
  "type": "FRAME",
  "parentId": "0:1",
  "x": 40,
  "y": 40,
  "width": 400,
  "height": 240
}
The frame is retained for visual inspection. This test does not delete any Figma content.
```

مخرجات التحقق الآلي النهائية بعد إصلاح توافق Figma:

```text
$ tsc --noEmit && tsc -p packages/plugin/tsconfig.main.json --noEmit
$ eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
$ vitest run

 RUN  v3.2.7 /Users/khaled/Desktop/programming/tools/magic-ui

 ✓ tests/shared.test.ts (14 tests) 15ms
 ✓ tests/sessionCredentials.test.ts (3 tests) 78ms
 ✓ tests/pluginMain.test.ts (6 tests) 388ms
 ✓ tests/pluginConnectionManager.test.ts (2 tests) 735ms
   ✓ the actual UI connection manager authenticates, forwards commands and reconnects after disconnection  647ms
 ✓ tests/stdio.integration.test.ts (1 test) 1097ms
   ✓ runs production startup, MCP negotiation and frame round-trip over stdio with private credentials  1097ms
 ✓ tests/bridge.integration.test.ts (11 tests) 1346ms

 Test Files  6 passed (6)
      Tests  37 passed (37)
   Start at  02:17:56
   Duration  2.51s (transform 293ms, setup 0ms, collect 1.52s, tests 3.66s, environment 3ms, prepare 882ms)
```

### محاولات فاشلة تم التعامل معها

- فحص المرحلة في الجلسة السابقة: **Requires User Action** بسبب Proposed؛ تم حلّه بموافقة المستخدم الحالية.
- أول تنزيل داخل البيئة المقيدة: **Failed** — `ENOTFOUND registry.npmjs.org`؛ نجح التنزيل بعد إتاحة الوصول المناسب.
- أول تثبيت pnpm 11: **Failed** — `ERR_PNPM_IGNORED_BUILDS`؛ استُبدل إعداد pnpm القديم بـ`allowBuilds` لـesbuild فقط، ثم نجح التثبيت. جرى تحديث ESLint إلى 10 بدل النسخة 9 غير المدعومة التي ظهرت في المحاولة الأولى.
- أول typecheck: **Failed** — أنواع callback وVite output وPreact `spellcheck` وقراءة نتيجة MCP؛ أُصلحت ونجح التحقق النهائي.
- أول اختبارات اتصال داخل البيئة المقيدة: **Failed** — `listen EPERM 127.0.0.1`؛ نجحت بالاتصالات المحلية المسموحة. أُصلحت أيضًا cleanup الاختبارات عند فشل التهيئة.
- أول build باستخدام CLI الخاص بـtsx: **Failed** — IPC `listen EPERM`؛ scripts تستخدم الآن `node --import tsx` بدون IPC غير لازم.
- أول Vite packaging: **Failed** — `Expected one UI build output.`؛ تم التعامل مع مصفوفة المخرجات ثم نجح build.
- اختبار origin أول مرة: **Failed** — توقع HTTP 403 بينما ws يرفض فعلًا بـ401؛ اتعدل التوقع للنتيجة الحقيقية وأصبح Passed.
- أول lint: **Failed** — تنسيق PROGRESS؛ تمت تسوية التنسيق ونجح lint.
- أمر معلومات اختياري `pnpm list -r --depth 0`: **Failed** — `ERR_SQLITE_ERROR unable to open database file` بسبب الوصول إلى مخزن pnpm. قُرئت إصدارات الحزم من ملفاتها المثبتة مباشرة؛ لا يؤثر على أوامر DoD الناجحة.

## Blockers / Requires User Action

- **Phase 9 DoD #7:** تشغيل `pnpm bench:figma` بعد بناء/فتح Plugin في scratch file؛ يختار المستخدم session ويكتب BENCH، وينشئ 6100 node محتفظًا بها. لم يُشغّل هذا المسار الحقيقي؛ help فقط Passed. التقرير لا يعلن v1 complete بسبب هذا البند والبنود السابقة أدناه.

- **Phase 8:** DoD #6/#7 Requires User Action كما هو موضح أعلاه. setup repair الحقيقي طُبّق، واستدعاء Claude design-agent Passed. المطلوب إعادة فتح العملاء/Plugin، وفحص صلاحيات reader داخل جلسة فعلية في كل client، وتجربة login حقيقية في Figma. لا موافقة معمارية معلقة.

- **Phase 7:** لا عائق إغلاق متبقٍ؛ DoD #8 Passed بالتشغيل الحقيقي الموافق عليه. فتح Plugin وربطها في Figma خطوة تشغيل يدوية ما زالت Requires User Action وليست تحقق اتصال ناجحًا.

- **Phase 6:** لا عوائق متبقية؛ DoD #8 **Passed** بالتجربة الحقيقية والفحص البصري والـLayers الموضحين أعلاه.

- **Phase 5 — تحقق مؤجل بموافقة صاحب المشروع:** لا يمنع بدء Phase 6؛ الموافقة تخص التأجيل فقط ولا تحوّل التحقق الحقيقي إلى Passed.

- **Phase 5:** DoD #8 Requires User Action: إعادة فتح الـPlugin المبني وتوصيله إلى scratch file، ثم `pnpm smoke:sync` والتعديل اليدوي المطلوب. لم تُغلق المرحلة. استكمال design-system الجديد نُفذ واختُبر آليًا؛ التحقق الحقيقي ما زال مطلوبًا.

- **Phase 4 — بند تحقق مؤجل، وليس عائق إغلاق:** تأكيد مزامنة Figma وversion history المتزامنة يبقى Requires User Action؛ أُغلقت المرحلة بموافقة صريحة من صاحب المشروع بتاريخ 2026-10-26 على هذا الاستثناء. التصدير الحقيقي ومراجعة الـpackage والتقرير Passed، والقائمة الظاهرة متطابقة قبل/بعد.

- **Phase 3:** المتبقي للإغلاق تجربة تبديل light/dark في ملف Figma يسمح بـmodeين. الملف الحالي أعاد `Limited to 1 modes only`. تجربة light مكتملة وPassed، ولا توجد موافقات معمارية معلقة.

- لا توجد عوائق متبقية لإغلاق Phase 1.
- D13 نُفّذ: إعادة تشغيل الخادم لا تغيّر token. تغييرها يكون عبر rotate صريح ثم إعادة pairing؛ الـframe التجريبي القديم لم يُحذف.
- D6 وD11 وD13 أصبحت Locked ونُفّذت في Phase 7. D9 ما زال Locked ويُطبق لكل client وداخل Main. لا قرارات معمارية معلقة.
- لا توجد عوائق متبقية لـPhase 2؛ التحقق الحقيقي والمراجعة البصرية **Passed**، والمرحلة مغلقة.

## Not Verifiable in Agent Environment

- Node 24 LTS غير مثبت؛ لم تُشغّل الاختبارات عليه. هذا لا يغيّر نتيجة التجربة الحقيقية على البيئة الحالية.

## Dependencies Added (مع المبرر)

**Phase 9:** تحديث dev dependency الموجودة Vitest من 3.2.7 إلى 4.1.12 لمعالجة audit advisories في Vitest/mocker وإزالة tinypool المتأثرة. lockfile تحدّث؛ لا runtime dependencies جديدة.

**Phase 8: لا dependencies جديدة ولا تعديل lockfile.** استُخدمت Node APIs وZod وMCP SDK المثبتة. إعداد TypeScript يسمح بواردات `.ts` الخاصة بالـinstaller الذي يعمل بـNode native؛ بناء shared يستثني هذا الخيار عند emit.

**Phase 7: لا dependencies جديدة ولا تعديل على lockfile.** استُخدمت Node APIs وws/Zod/MCP SDK المثبتة؛ installer يعمل بـNode native TypeScript قبل تثبيت dependencies.

**Phase 6: لا dependencies جديدة ولا تعديل على lockfile.** SHA-256 مشتركة وSVG subset sanitizer والتحقق البنيوي للصور باستخدام JavaScript وNode APIs المتاحة؛ لا ضغط أو تحويل.

**Phase 5: لا dependencies جديدة ولا تعديل على lockfile.**

**Phase 4: لا dependencies جديدة ولا تعديل على lockfile.**

**Phase 3: لا dependencies جديدة ولا تعديل على lockfile.**

**Phase 2: لا dependencies جديدة ولا تعديل على lockfile.** استُخدم Zod 4 المثبت لتوليد JSON Schema، وPrettier المثبت لتنسيق الملف المولّد.

الإصدارات الفعلية مثبتة في `pnpm-lock.yaml`؛ إعدادات clients الحقيقية عُدّلت فقط لإضافة Magic UI في Phase 7 بموافقة المستخدم وbackups والتحقق من حفظ الباقي.

| الحزم                                   | الإصدار المثبت            | المبرر                                                                      |
| --------------------------------------- | ------------------------- | --------------------------------------------------------------------------- |
| TypeScript                              | 5.9.3                     | strict typing وبناء shared declarations                                     |
| ESLint / @eslint/js / typescript-eslint | 10.13.0 / 10.0.1 / 8.72.0 | فحص JavaScript وTypeScript ومنع explicit any غير المبرر                     |
| Prettier                                | 3.9.10                    | تنسيق موحد والتحقق منه في lint                                              |
| Vitest                                  | 3.2.7                     | اختبارات schemas وintegration وPlugin harnesses                             |
| tsx                                     | 4.23.15                   | تشغيل مصادر TypeScript وسكريبتات التطوير والاختبار                          |
| esbuild                                 | 0.25.12                   | تجميع Node server وFigma Main دون runtime imports غير صالحة في Figma        |
| Vite                                    | 7.3.7                     | تجميع Preact UI وCSS Modules؛ يسحب esbuild 0.28.2 كاعتماد داخلي             |
| @modelcontextprotocol/sdk               | 1.32.2                    | SDK رسمي لخادم وعميل MCP وstdio؛ موجود في root أيضًا لاستخدام scripts/tests |
| Zod                                     | 4.6.7                     | schemas والتحقق على الحدود وMCP                                             |
| ws / @types/ws                          | 8.22.0 / 8.18.2           | WebSocket bridge وtest client مع typing                                     |
| Preact / @preact/signals                | 10.29.8 / 2.11.3          | واجهة Plugin صغيرة وحالة اتصال تفاعلية حسب الـstack المحدد                  |
| @figma/plugin-typings                   | 1.142.0                   | فحص Main وفق Figma Plugin API بدون DOM                                      |
| @types/node                             | 24.19.2                   | أنواع Node server وملفات النظام وأدوات الاختبار                             |

Playwright استُخدم من بيئة `webapp-testing` المثبتة مسبقًا، ولم يُضف dependency للمشروع. سكريبت `scripts/verify-plugin-ui.py` يحتاج Python مع Playwright وChromium لو هيتشغّل على جهاز آخر.

## Backlog

- Phase 9 نُفذت بطلب المستخدم؛ لا توسع لاحق دون طلب. Phase 8 المتبقي منها تحققها التفاعلي الموثق فقط. تأجيلات Phases 3/4/5 تبقى كما هي ولا تتحول إلى Passed. Code generators وvisual diff engine خارج نطاق Phase 8.
- تغيير نوع node وهجرة هويته ما زالا مرفوضين دون مسار صريح؛ no auto-merge. تسوية drift والاستكمال للشاشات نُفذا في Phase 5. استكمال design-system الجزئي على مستوى token/component نُفذ في الإدخال الأحدث؛ قيد بيانات Phase 3 القديمة بدون checkpoints موثق في دليل التشغيل.
