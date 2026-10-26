# Magic UI — Progress

## Current Phase

**Phase 5 — Sync/Preview/Apply وResume وTrash، مع استكمال جزئي للـdesign-system عبر checkpoints للموارد والـnodes.** التحقق الحقيقي داخل Figma: **Requires User Action**؛ المرحلة لم تُغلق. **Passed:** فحص النسخة النهائية: 132 اختبارًا في 15 ملفًا، مع نجاح typecheck وlint وbuild.

**Phase 4 — مغلقة بموافقة صاحب المشروع مع استثناء تحقق موثّق (2026-10-26).** التنفيذ والتحقق الآلي والتصدير الحقيقي ومراجعة الـpackage: **Passed**. تأكيد مزامنة Figma وحالة version history المتزامنة: **Requires User Action — مؤجل بموافقة صريحة، ولا يمنع إغلاق المرحلة**؛ لم يُحوّل إلى Passed. D9 يظل Locked. بدأ تنفيذ Phase 5 بطلب صاحب المشروع في هذه الجلسة.

**Phase 3 — التنفيذ والتحقق الآلي وتجربة Figma الحقيقية بوضع light: Passed. تبديل light/dark: Requires User Action لأن الملف الحالي محدود بـmode واحدة؛ المرحلة لم تُغلق بالكامل.**

Phase 2 مكتملة ومغلقة، بما فيها التجربة الحقيقية داخل Figma Desktop يوم 2026-10-26.

Phase 1 مكتملة، بما فيها التحقق الحقيقي داخل Figma Desktop.

2026-10-26: صاحب المشروع وافق صراحة على D1 وD2 وD3 وD4 وD5 وD10، وتم تحويلها إلى **Locked** في `docs/ARCHITECTURE.md §2`. باقي القرارات ما زالت Proposed، ولم يُبنَ عليها شيء.

2026-10-26: صاحب المشروع أكد D7 وD8 وD12 وبقوا **Locked**. D7 اتعدّل لـ `setSharedPluginData` بدل `setPluginData` (السبب مكتوب في §2). تم تنفيذ Phase 2 في هذه الجلسة بدون الاعتماد على قرارات Proposed.

## Done

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

- Phase 5: تجربة Figma الحقيقية بـ`pnpm smoke:sync` ما زالت Requires User Action. لا توجد عملية smoke شغالة أو جلسة تنتظر إدخالًا.

- Phase 3: الفحص الحقيقي للـVariables والـcomponents والـinstances بوضع light مكتمل. المتبقي فقط تبديل light/dark في ملف يسمح بأكثر من mode.
- لا توجد عملية smoke منتظرة؛ الخادم خرج Exit 0 وcredentials الخاصة بالتجربة نُظفت. لم يُحذف أي node أو variable للمستخدم.

## Verification Log

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

- **Phase 5:** DoD #8 Requires User Action: إعادة فتح الـPlugin المبني وتوصيله إلى scratch file، ثم `pnpm smoke:sync` والتعديل اليدوي المطلوب. لم تُغلق المرحلة. استكمال design-system الجديد نُفذ واختُبر آليًا؛ التحقق الحقيقي ما زال مطلوبًا.

- **Phase 4 — بند تحقق مؤجل، وليس عائق إغلاق:** تأكيد مزامنة Figma وversion history المتزامنة يبقى Requires User Action؛ أُغلقت المرحلة بموافقة صريحة من صاحب المشروع بتاريخ 2026-10-26 على هذا الاستثناء. التصدير الحقيقي ومراجعة الـpackage والتقرير Passed، والقائمة الظاهرة متطابقة قبل/بعد.

- **Phase 3:** المتبقي للإغلاق تجربة تبديل light/dark في ملف Figma يسمح بـmodeين. الملف الحالي أعاد `Limited to 1 modes only`. تجربة light مكتملة وPassed، ولا توجد موافقات معمارية معلقة.

- لا توجد عوائق متبقية لإغلاق Phase 1.
- إعادة تشغيل الخادم تولّد token جديدًا؛ يحتاج نسخه إلى الـPlugin مرة أخرى. الـframe التجريبي لم يُحذف.
- D6 وD11 فقط ما زالت Proposed ومؤجلة. D9 Locked ونُفّذ في Phase 4. لا multi-client hub ولا تسجيل clients أو setup آلي.
- لا توجد عوائق متبقية لـPhase 2؛ التحقق الحقيقي والمراجعة البصرية **Passed**، والمرحلة مغلقة.

## Not Verifiable in Agent Environment

- Node 24 LTS غير مثبت؛ لم تُشغّل الاختبارات عليه. هذا لا يغيّر نتيجة التجربة الحقيقية على البيئة الحالية.

## Dependencies Added (مع المبرر)

**Phase 5: لا dependencies جديدة ولا تعديل على lockfile.**

**Phase 4: لا dependencies جديدة ولا تعديل على lockfile.**

**Phase 3: لا dependencies جديدة ولا تعديل على lockfile.**

**Phase 2: لا dependencies جديدة ولا تعديل على lockfile.** استُخدم Zod 4 المثبت لتوليد JSON Schema، وPrettier المثبت لتنسيق الملف المولّد.

الإصدارات الفعلية مثبتة في `pnpm-lock.yaml`؛ مفيش تغيير لإعدادات clients خارج المشروع.

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

- لا توسع خارج Phase 5. assets/mockups/multi-session للمراحل اللاحقة؛ sync/Trash للشاشات نُفذا هنا. تجربة light/dark في Phase 3 مؤجلة بموافقة المستخدم.
- تغيير نوع node وهجرة هويته ما زالا مرفوضين دون مسار صريح؛ no auto-merge. تسوية drift والاستكمال للشاشات نُفذا في Phase 5. استكمال design-system الجزئي على مستوى token/component نُفذ في الإدخال الأحدث؛ قيد بيانات Phase 3 القديمة بدون checkpoints موثق في دليل التشغيل.
