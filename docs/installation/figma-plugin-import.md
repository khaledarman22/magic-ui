# استيراد واختبار Magic UI — Phase 1

**الحالة: Passed على جهاز المشروع بتاريخ 2026-10-26.** تم الاستيراد والتشغيل والاتصال وإنشاء وقراءة frame حقيقي (`nodeId: 1:2`). الخطوات التالية لإعادة الاختبار أو الاستيراد على جهاز آخر.

## 1. تجهيز المشروع

استخدم Node.js 24 LTS أو إصدار LTS أحدث، وpnpm 11.25.0. من فولدر المشروع:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter mcp-server start --selftest
```

آخر أمر لازم يطبع الأدوات الثلاث:

```text
magic_ui_get_connection_status
magic_ui_create_frame
magic_ui_read_node
```

ملفات الـPlugin الجاهزة في `packages/plugin/dist/`: `manifest.json` و`main.js` و`ui.js` و`ui.html`. الـHTML يحتوي JavaScript وCSS داخله عشان يشتغل في iframe من غير ملفات شبكة إضافية. لا تستورد الـmanifest الموجود في فولدر المصدر؛ استورد النسخة داخل `dist`.

## 2. الاستيراد في Figma Desktop

1. افتح Figma Desktop وملف **Design** مسموح لك تعدّله، واختار الصفحة المطلوبة. يفضّل ملف تجربة.
2. من قائمة Figma افتح **Plugins → Development → Import plugin from manifest…** (ممكن توصل لنفس الأمر من البحث في Actions).
3. اختار `packages/plugin/dist/manifest.json` من المشروع.
4. من **Plugins → Development → Magic UI** شغّل الـPlugin. لازم تظهر حالة الاتصال، حقل Session token وزر Reconnect.
5. لو Figma طلب Plugin ID مخصص لحسابك، اعمل development plugin جديد من Figma، وخد الـID الذي أنشأه Figma إلى `packages/plugin/manifest.json` مكان `magic-ui-local`، ثم أعد `pnpm build` والاستيراد. لا تغيّر ID لأي plugin قائم عندك.

العنوان المسموح محليًا: `ws://localhost:3845` ضمن `devAllowedDomains`، مع `allowedDomains: ["none"]`. الخادم نفسه يظل مربوطًا بـ`127.0.0.1` فقط. لا تضف عنوان IP إلى `devAllowedDomains`؛ نسخة Figma المجربة رفضته أثناء الاستيراد. ده development plugin، مش إصدار منشور على Community. القيم وطريقة الاستيراد موثقة في [مرجع manifest الرسمي](https://developers.figma.com/docs/plugins/manifest/).

## 3. اختبار حقيقي عبر MCP وstdio

أوقف أي instance أخرى لـMagic UI MCP server قبل الاختبار. المرحلة دي تدعم server واحد وPlugin واحد في نفس الوقت، والـtest harness لا يتشغّل مع الـPlugin الحقيقي.

في Terminal من فولدر المشروع:

```bash
pnpm smoke:figma
```

الأمر يبدأ **الخادم الحقيقي المبني** عبر stdio، ويعرض الأدوات الثلاث، وينتظر اتصال الـPlugin. لا تشغّل `pnpm --filter mcp-server start` بالتوازي؛ أداة الاختبار بدأت الخادم بالفعل.

بعد ما يبدأ، في Terminal تانية انسخ token للحافظة بدون طباعته في سجل الطرفية:

```bash
node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(require('node:path').join(require('node:os').homedir(), '.magic-ui/session.json'), 'utf8')).token)" | pbcopy
```

1. الصق الـtoken في حقل **Session token** واضغط **Reconnect**. لازم الحالة تبقى **Connected**.
2. ارجع للطرفية الأولى واضغط Enter. هتعرض اسم المستند والصفحة المستهدفين.
3. اتأكد إنهم الصح، ثم اكتب `CREATE` واضغط Enter.
4. الاختبار ينشئ frame واحد باسم `Magic UI Phase 1 smoke` بحجم 400×240 وإحداثيات 40،40، ويقرأه بالأداة الثانية باستخدام نفس `nodeId`.
5. النجاح يطبع `Passed: created and read the same Figma frame.` ومعاه بيانات الـnode.
6. في Figma اتأكد من ظهور الـframe واسمه وأبعاده وإحداثياته. مش مطلوب إضافة أو حذف أي محتوى آخر.
7. الـframe يفضل موجود للمراجعة. الخادم يقفل تلقائيًا بعد الاختبار ويزيل ملف بيانات جلسته، والـPlugin يعرض إعادة الاتصال. اقفل الـPlugin عند الانتهاء.

لو الاختبار طبع `Failed`، لا تعتبر التحقق ناجحًا. سجّل الخطأ بدون الـtoken. لو الخطأ `TIMEOUT`، راجع Figma قبل إعادة الإنشاء لأن الـframe ممكن يكون اتعمل والرد ضاع.

## 4. اختبار التشغيل المستمر والانقطاع يدويًا

للاستخدام المستمر، خلي MCP client يشغّل `node` مع المسار المطلق `packages/mcp-server/dist/index.js` كـstdio server. المرحلة دي لا تعدّل إعدادات أي client ولا تسجّل MCP تلقائيًا.

- نادِ `magic_ui_get_connection_status` بدون مدخلات. النتيجة فيها `sessionId` و`document.pageId`، ويجب قراءة القيم الحالية بدل حفظها من جلسة سابقة.
- `magic_ui_create_frame` يحتاج `sessionId` و`pageId` و`name` و`width` و`height`؛ `x` و`y` اختياريين وافتراضيهما صفر.
- `magic_ui_read_node` يحتاج `sessionId` و`nodeId` الراجع من الإنشاء.
- غيّر الصفحة قبل إنشاء frame بنفس `pageId` القديم: المتوقع `PAGE_CHANGED` بدون إنشاء جديد. اضغط Reconnect ثم اقرأ حالة الاتصال مرة تانية.
- اقفل الـPlugin: المتوقع `NOT_CONNECTED` للأوامر الجديدة، والطلب الذي كان منتظرًا يرجع `TIMEOUT` خلال 10 ثوانٍ.
- افتح الـPlugin مرة تانية: يسترجع token من `figma.clientStorage`. لو الخادم ما اتغيرش، يتصل تلقائيًا. بعد إعادة تشغيل الخادم يتولد token جديد؛ انسخه واضغط Reconnect.
- جرّب قيمة مختلفة من 64 حرف hexadecimal في حقل الـtoken: المتوقع رسالة رفض واضحة، والاتصال لا يصبح Connected. أعد الـtoken الصحيح للمتابعة.
- لو الشبكة المحلية انقطعت والخادم لسه بنفس الجلسة، إعادة الاتصال تلقائية بتأخير يبدأ 0.5 ثانية ويزيد لحد 10 ثوانٍ. الـheartbeat كل 5 ثوانٍ ويتحقق من Main نفسه.

الأخطاء والنتائج موحدة، وكل رسالة مربوطة بـ`correlationId`. بعد timeout أو إلغاء عملية كتابة، لا توجد إعادة تنفيذ تلقائية ولا rollback لكتابة اكتملت.

## 5. تغيير المنفذ

لازم الخادم والـPlugin يتبنوا على نفس المنفذ. مثال:

```bash
MAGIC_UI_BRIDGE_PORT=3846 pnpm build
MAGIC_UI_BRIDGE_PORT=3846 pnpm smoke:figma
```

أعد تحميل/استيراد الـmanifest المبني، واقفل وافتح الـPlugin. الـbuild يحدّث عنوان الاتصال و`devAllowedDomains` معًا. المنفذ لازم يكون عدد صحيح بين 1024 و65535.

## 6. اختبار الـfake client فقط

`pnpm fake-plugin` test harness داخل `scripts/`، وليس مسار المنتج ولا إثباتًا للتشغيل في Figma. يستخدم ملف الجلسة الموجود ويحتفظ بالـnodes في ذاكرته فقط. يمكن تشغيله مع MCP server قائم والـPlugin الحقيقي مقفول. الاختبارات الآلية تنشئ bridge على منافذ مؤقتة وتختبر الإنشاء والقراءة، token غلط، timeout، reconnect، heartbeat، إلغاء الطلبات وحفظ الأسرار في مسارات مؤقتة.

## تسجيل النتيجة

بعد التجربة الحقيقية، حدّث `PROGRESS.md` بتاريخها، `nodeId`، ونتيجة كل خطوة: **Passed / Failed / Requires User Action / Not Tested (السبب)**. لا تضف token أو محتوى `session.json` إلى Git أو صور الشاشة أو الـlogs.
