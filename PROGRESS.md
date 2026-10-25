# Magic UI — Progress

## Current Phase

**Phase 1 — Walking Skeleton: مكتملة، بما فيها التحقق الحقيقي داخل Figma Desktop.**

2026-10-26: صاحب المشروع وافق صراحة على D1 وD2 وD3 وD4 وD5 وD10، وتم تحويلها إلى **Locked** في `docs/ARCHITECTURE.md §2`. باقي القرارات ما زالت Proposed، ولم يُبنَ عليها شيء.

2026-10-26: صاحب المشروع أكد D7 وD8 وD12 وبقوا **Locked**. D7 اتعدّل لـ `setSharedPluginData` بدل `setPluginData` (السبب مكتوب في §2). Phase 2 جاهزة للتنفيذ.

## Done

- Monorepo بـpnpm: `packages/shared` و`packages/mcp-server` و`packages/plugin`، مع TypeScript strict، ESLint، Prettier، Vitest، وأوامر root موحدة. ملف lock محفوظ.
- العقود المشتركة: envelope بإصدار و`correlationId` و`sessionId`، أخطاء ثابتة، schemas لأوامر `ping` و`createFrame` و`readNode` ونتائجها، ورسائل UI ↔ Main. التحقق موجود على حدود الأجزاء.
- MCP server بالـSDK الرسمي عبر stdio؛ الأدوات الثلاث المطلوبة مسجلة بـinput/output schemas وبيانات الصلاحية والمهلة. `--selftest` يستعلم عن الأدوات المسجلة فعلًا عبر MCP، بدون تشغيل Bridge أو كتابة credentials.
- WebSocket Bridge على `127.0.0.1` فقط، منفذ افتراضي 3845 ومتغير `MAGIC_UI_BRIDGE_PORT`، origin allowlist، token عشوائي 256-bit، مقارنة ثابتة الوقت، مهلة مصادقة، حد لحجم الرسالة، heartbeat يصل إلى Main، مهلة الطلب 10 ثوانٍ وإلغاء مرتبط بالـcorrelationId.
- كتابة credentials في `~/.magic-ui/session.json` بصلاحيات `0600` باستبدال ذري، بدون طباعة token. الإغلاق الطبيعي ينظف بيانات جلسته فقط. اختبارات الملفات تستخدم مجلدات مؤقتة، ولم تُنشأ جلسة في home المستخدم أثناء التنفيذ.
- جلسة Plugin واحدة في هذه المرحلة. كل أداة قراءة/إنشاء تستهدف `sessionId` صريحًا؛ الإنشاء يتطلب `pageId` مطابقًا للصفحة الحالية ويرفض تغيير الصفحة قبل الكتابة. الطلب المنقطع ينتهي بـ`TIMEOUT` ولا يُعاد تنفيذه تلقائيًا.
- Plugin Main فعلي يستخدم `figma.createFrame` و`figma.getNodeByIdAsync`. لا توجد محاكاة في مسار المنتج. D7 لم يتأكد، لذلك لا يوجد `setPluginData`.
- Plugin UI بـPreact وSignals وCSS Modules: حالة الاتصال، token محفوظ في `figma.clientStorage`، Reconnect، وإعادة اتصال بتأخير متزايد. ملفات البناء: `manifest.json` و`main.js` و`ui.js` و`ui.html` مستقل يحتوي CSS/JS داخله.
- `scripts/fake-plugin-client.ts` محاكاة اختبار فقط، مع اختبارات MCP round-trip عبر WebSocket فعلي، واختبار إضافي عبر stdio وعملية مستقلة من runtime الحقيقي.
- 37 اختبارًا تشمل schemas، token غلط، origin غير موثوق، رفض جلسة ثانية، session mismatch، timeout أثناء الانقطاع، reconnect، heartbeat، cancellation، مطابقة نوع الرد، صلاحيات ملف credentials، حماية symlinks، وMain داخل VM بدون DOM/network أو توليد كود ديناميكي.
- تحقق Chromium من واجهة الـPlugin عند 360px و280px: حالة أولية، زر disabled، رسالة token خاطئ، تعافٍ باستخدام Reconnect، بلا page errors أو horizontal overflow. هذا browser harness وليس تشغيلًا داخل Figma.
- دليل الاستيراد والتجربة اليدوية في `docs/installation/figma-plugin-import.md`، وأمر `pnpm smoke:figma` يشغل الخادم المبني ويختبر إنشاء/قراءة frame حقيقي بعد أن يوصّل المستخدم الـPlugin ويؤكد المستند المستهدف.

## In Progress

- لا توجد مهام معلقة ضمن Phase 1. اكتمل الاستيراد والتشغيل الحقيقي بطلب المستخدم يوم 2026-10-26.
- `pnpm smoke:figma` خرج بنجاح (Exit 0)، والخادم أغلق جلسة الاختبار. أُغلقت نافذة الـPlugin بعد الاختبار، والـframe محفوظ ومحدد في Figma للمراجعة. لا توجد عملية smoke منتظرة.

## Verification Log

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
- D6–D9 وD11–D12 ما زالت Proposed ومؤجلة. لا multi-client hub ولا stable pluginData ولا read-only mode ولا تسجيل clients أو setup آلي.

## Not Verifiable in Agent Environment

- Node 24 LTS غير مثبت؛ لم تُشغّل الاختبارات عليه. هذا لا يغيّر نتيجة التجربة الحقيقية على البيئة الحالية.

## Dependencies Added (مع المبرر)

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

- لا توسع خارج Phase 1. القرارات والميزات المؤجلة تظل للـPhases اللاحقة كما هي في Architecture.
