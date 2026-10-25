# Phase 2 — Design Specification v1 والرسم

**التجربة داخل Figma الحقيقي: Passed بتاريخ 2026-10-26.** `pnpm smoke:render` خرج Exit 0 في `Untitled / Page 1`: أنشأ 7 nodes ثم أعاد الرسم بنفس العدد والمعرّفات و0 created/0 updated/7 unchanged. فُحصت الشاشة وخصائص Auto Layout بصريًا داخل Figma Desktop. [الشاشة](https://www.figma.com/design/omtkdMFHILIuKZQ6Gm94iu/Untitled?node-id=1-3) · [لقطة التحقق](phase-2-render-verified.png). الخطوات التالية لإعادة التجربة.

## تجهيز وتشغيل التجربة

من فولدر المشروع:

```bash
pnpm schema:generate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter mcp-server start --selftest
pnpm smoke:render
```

أمر selftest يعرض الأدوات الستة. `smoke:render` يشغّل الخادم المبني ويهيّئ workspace مؤقتًا مستقلًا فيه ملفا المشروع والـspec فقط. يطبع مساره ويتركه للمراجعة. لا تشغّل خادمًا آخر على نفس المنفذ.

1. افتح ملف تجربة في Figma Desktop واختار الصفحة المقصودة. لو الـPlugin مش مستورد، اتبع [دليل الاستيراد](figma-plugin-import.md).
2. اقفل وافتح **Plugins → Development → Magic UI** لتحميل البناء الجديد.
3. انسخ token الحالي للحافظة من Terminal أخرى، بدون طباعته في سجل الطرفية:

   ```bash
   node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(require('node:path').join(require('node:os').homedir(), '.magic-ui/session.json'), 'utf8')).token)" | pbcopy
   ```

4. الصق token في الـPlugin واضغط Reconnect، ثم اضغط Enter في طرفية الاختبار.
5. راجع اسم الملف والصفحة اللذين يعرضهما الاختبار، واكتب `RENDER`.
6. الاختبار يرسم شاشة من سبعة nodes: screen، header، list بعنصرين، button وlabel. يعيد نفس الطلب ويقارن عدد الـnodes الفعلي داخل الشاشة وهوياتها، مع `created=0` و`updated=0` و`unchanged=7` في الإعادة.
7. افحص بصريًا: الشاشة بعرض 400، padding=24، مسافة 24 بين الأقسام، قائمة بمسافة 12، وزر بارتفاع 48. النصوص مرئية والخلفية بيضاء والزر أزرق. العينة تستخدم Inter Regular وBold.
8. الشاشة تظل موجودة، والخادم يُغلق وينظف credentials جلسته. اقفل الـPlugin بعد الفحص.

المخرجات المتوقعة **وليست نتيجة تشغيل مسجلة**:

```text
First render: {"nodeCount":7,"created":7,"updated":0,"unchanged":0,...}
Second render: {"nodeCount":7,"created":0,"updated":0,"unchanged":7,...}
Passed: node count unchanged (7 → 7), 0 created, 0 updated, 7 unchanged; identical mapping.
```

عند تشغيل السكريبت مرة أخرى على نفس الصفحة، أول render قد يرجع أيضًا 7 unchanged؛ معرّفا المشروع والشاشة ثابتان. لو نقلت الشاشة أو عدّلتها يدويًا، يرجع `DRIFT_DETECTED` دون الكتابة عليها. لا تحذف بياناتها لتجاوز هذا الخطأ. افحص الاختلافات أولًا؛ أدوات تسوية الاختلافات خارج Phase 2.

## استخدام الأدوات

- `magic_ui_initialize_project`: `{ "projectId": "my-app", "projectName": "MyApp" }`. ينشئ `MyApp-Design/project.json` و`design-spec.json` فقط. لا يستبدل مجلدًا قائمًا أو projectId مستخدمًا.
- عدّل `design-spec.json` محليًا حسب [JSON Schema المولّد](../../packages/shared/design-spec.schema.json) و[العينة](../../scripts/samples/phase-2.design-spec.json).
- `magic_ui_validate_design_spec`: `{ "specification": { ... } }`. يرجع `valid` و`errors` بمسارات مثل `pages[0].screens[0].nodes[0].layout.width`، بدون الحاجة إلى اتصال Figma.
- `magic_ui_render_design`: `{ "sessionId": "...", "pageId": "...", "projectId": "my-app", "screenId": "home" }`. اقرأ sessionId وpageId الحاليين من أداة الاتصال. الأداة تقرأ spec من الـworkspace وتختار شاشة واحدة.
- النتيجة: `created`, `updated`, `unchanged`, `orphaned`, `mapping`, `orphanedNodes`, `nodeCount`. الحساب يشمل frame الشاشة. `nodeCount` يعد كل العناصر الفعلية داخل الشاشة، بما فيها orphans؛ لا توجد عملية حذف.

`MAGIC_UI_WORKSPACE_ROOT` يحدد root موجودًا ومساره حقيقي (canonical). الافتراضي working directory للخادم. لا تقبل الأدوات مسارات يرسلها العميل. أسماء المشاريع ومعرّفاتها حروف إنجليزية وأرقام و`_` و`-`، تبدأ بحرف أو رقم. ملفات ومجلدات symlink مرفوضة؛ الملفات الجديدة exclusive وصلاحياتها 0600. شغّل الخادم في root مخصص تحت سيطرتك؛ تغيير بنية المجلدات بالتزامن مع عمليات I/O غير مدعوم.

## عقد الـspec

- `schemaVersion: "1.0.0"` فقط. migration ترفض الإصدارات المجهولة. كل page وscreen وnode له id فريد داخل المشروع، ولا تُستخدم الأسماء للهوية.
- الشاشة نفسها frame، وأولادها في `nodes`. أنواع الأولاد: `frame`, `text`, `rectangle`. الـframe يحتوي `nodes` أيضًا. لا components أو instances في هذه النسخة.
- `layout.type`: `auto-layout` أو `absolute`؛ يصف طريقة ترتيب أولاد الـframe. `layout.positioning`: `auto` أو `absolute` لوضع العنصر نفسه داخل Auto Layout. قيم `width` و`height` رقم موجب (fixed)، أو `hug`، أو `fill`. Fill يحتاج أب Auto Layout غير hug على نفس المحور، ولا يصلح للعنصر ذي positioning absolute. Hug يصلح للنصوص وAuto Layout frames فقط.
- `layout.direction`: `horizontal` أو `vertical`، و`padding` بأربع قيم، و`itemSpacing`، و`alignment` للمحور العرضي، و`primaryAlignment` للمحور الرئيسي. المواضع x/y تُستخدم في absolute placement فقط.
- `direction` على الشاشة: ltr أو rtl. RTL يعكس ترتيب أولاد الصفوف الأفقية، ويضبط start/end للنصوص ومحاذاة الأعمدة. لا يعكس محتوى النص نفسه ولا يضيف أحرف اتجاه خفية.
- `styling`: solid fills/strokes بألوان `#RRGGBB` وopacity، وstrokeWeight وcornerRadius وopacity. cornerRadius للنصوص يجب أن يكون صفرًا.
- النص يحتاج content وfontFamily وfontStyle. fontSize افتراضيًا 16، lineHeight=`auto` أو رقم pixels، letterSpacing pixels، وtextAlign. لا fallback للفونت: غيابه يرجع `FONT_UNAVAILABLE` قبل إنشاء العناصر. [مرجع تحميل الخطوط](https://developers.figma.com/docs/plugins/api/properties/figma-loadfontasync/).
- الحد 500 node في الـspec وعمق 32. حد الملف والرسالة 65536 byte؛ غلاف الرسالة والقيم الافتراضية قد يجعلان ملفًا أصغر من الحد يتجاوز حد النقل، فيرجع `MESSAGE_TOO_LARGE` قبل الإرسال. لا chunking في هذه المرحلة.

JSON Schema يولّد البنية والقيم المسموحة من Zod. قواعد العلاقات (مثل uniqueness وصلاحية fill) تُفحص بأداة validation ووقت الرسم، ولا يعبر عنها JSON Schema المولّد وحده.

## الهوية والاختلافات

كل node في مسار الرسم تحمل `setSharedPluginData("magic_ui", ...)`: id وprojectId وscreenId وintent وhash وsnapshot وspecVersion. الصفحة تحفظ مرجع root الشاشة لمنع إنشاء نسخة إذا نُقلت الشاشة يدويًا. البحث عن الأولاد محصور في الشاشة المستهدفة. قبل أي تعديل، تُقارن خصائص Figma الفعلية المسجلة بالـsnapshot السابق، ويُرفض render كامل عند drift مع تفاصيل الاختلافات. قيم shared plugin data ليست أسرارًا.

تغيير الـspec يحدث في نفس nodes، وفقط عندما تختلف خصائصها. الأنواع لا تُستبدل آليًا. العناصر المحذوفة من الـspec تبقى كـorphans. لو حصل فشل أثناء كتابة Figma، قد تظل كتابة جزئية بهوية محفوظة؛ افحص النتيجة قبل الإعادة. المهلة لا تعني rollback، ولا يُعاد الطلب تلقائيًا. المعالجة بعد تحميل الخطوط محدودة بـ500 node ومتزامنة، فلا تقطعها رسالة إلغاء أثناء نفس دفعة الكتابة.
