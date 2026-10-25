# Magic UI — Progress

## Current Phase

**Phase 2 — Design Spec v1 + Render شاشة واحدة: مكتملة ومغلقة، بما فيها التجربة الحقيقية داخل Figma Desktop يوم 2026-10-26.**

Phase 1 مكتملة، بما فيها التحقق الحقيقي داخل Figma Desktop.

2026-10-26: صاحب المشروع وافق صراحة على D1 وD2 وD3 وD4 وD5 وD10، وتم تحويلها إلى **Locked** في `docs/ARCHITECTURE.md §2`. باقي القرارات ما زالت Proposed، ولم يُبنَ عليها شيء.

2026-10-26: صاحب المشروع أكد D7 وD8 وD12 وبقوا **Locked**. D7 اتعدّل لـ `setSharedPluginData` بدل `setPluginData` (السبب مكتوب في §2). تم تنفيذ Phase 2 في هذه الجلسة بدون الاعتماد على قرارات Proposed.

## Done

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

- لا توجد مهام معلقة ضمن Phase 2. اكتمل التحقق الحقيقي بطلب المستخدم، وأُغلقت المرحلة.
- لا توجد عملية smoke منتظرة. لم يبدأ تنفيذ Phase 3.

## Verification Log

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

- لا توجد عوائق متبقية لإغلاق Phase 1.
- إعادة تشغيل الخادم تولّد token جديدًا؛ يحتاج نسخه إلى الـPlugin مرة أخرى. الـframe التجريبي لم يُحذف.
- D6 وD9 وD11 فقط ما زالت Proposed ومؤجلة. D7 وD8 وD12 Locked واستُخدمت في Phase 2. لا multi-client hub ولا read-only mode ولا تسجيل clients أو setup آلي.
- لا توجد عوائق متبقية لـPhase 2؛ التحقق الحقيقي والمراجعة البصرية **Passed**، والمرحلة مغلقة.

## Not Verifiable in Agent Environment

- Node 24 LTS غير مثبت؛ لم تُشغّل الاختبارات عليه. هذا لا يغيّر نتيجة التجربة الحقيقية على البيئة الحالية.

## Dependencies Added (مع المبرر)

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

- لا توسع خارج Phase 2. components/variants/variables/styles/images/sync/Trash/multi-session/read-only تظل للمراحل اللاحقة.
- تسوية drift وتغيير نوع node واستكمال الفشل الجزئي بقرارات المستخدم تبقى لمسار sync/recovery في المرحلة المحددة لها؛ لا auto-merge في Phase 2.
