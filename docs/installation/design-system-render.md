# Phase 3 — Tokens, Components, Registry

التجربة الحقيقية بتاريخ 2026-10-26: **Passed بوضع light** في [Untitled](https://www.figma.com/design/omtkdMFHILIuKZQ6Gm94iu/Untitled?node-id=1-42). 8 variables و6 variants داخل 3 sets و3 screen instances، ونفس الهويات بعد إعادة الرسم. [الشاشة](phase-3-verification/light-screen.png) و[المكونات](phase-3-verification/workspace.png).

**تبديل light/dark: Requires User Action.** الملف الحالي رفض إضافة mode ثانية برسالة `Limited to 1 modes only`. لم يُختبر التبديل بصريًا؛ يلزم ملف يسمح بـmodeين. للتشخيص الصريح بوضع واحد: `pnpm smoke:design-system --mode=light`، وهذا لا يحل محل اختبار التبديل.

## التجربة الحقيقية

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter mcp-server start --selftest
pnpm smoke:design-system
```

1. افتح ملف تجربة وصفحة مستهدفة في Figma Desktop. أعد فتح Magic UI لتحميل البناء الجديد، واتبع [خطوات الاتصال ونسخ token بأمان](design-spec-render.md).
2. السكريبت ينشئ workspace مؤقتًا ويطبع مساره. لا تشغّل خادمًا آخر على المنفذ نفسه. بعد Connected اضغط Enter، وراجع اسم الملف والصفحة ثم اكتب `RENDER`.
3. يرسم السكريبت الـdesign system مرتين ويقارن النتائج، ثم الشاشة مرتين ويقارن الهويات وعدد الـnodes. يحتفظ بكل العناصر والـworkspace للمراجعة ويغلق خادمه. لا يحذف بيانات المستخدم.
4. افحص صفحة **Components**: Workspace بـAuto Layout، وتصنيفات actions/forms/containers. توجد 3 sets و6 variants إجمالًا: Button له 4 combinations صريحة من Type × Size × State، وInput وCard لهما variant واحدة لكل منهما. لا يُنشأ حاصل الضرب الكامل.
5. افتح Variables: مجموعة المشروع تضم 8 variables وmodes باسم light/dark. تحقق أن color.surface/color.text/color.action aliases للـprimitives، وأن space.md وradius.md أرقام، وBody موجود في Text styles.
6. ارجع للشاشة الأصلية وحدد root **Phase 3 sample**. غيّر mode المجموعة إلى dark؛ يجب أن تتغير خلفية الشاشة وألوان محتوى الـinstances. افحص أن النصوص مرئية، وButton يعرض Save profile، وCard يحتوي Button instance.
7. افحص خصائص Button: Label وShow label وType/Size/State؛ خصائص Input: Value؛ وCard: Action من نوع INSTANCE_SWAP. أي تعديل يدوي احتفظ به للمراجعة؛ لا تمسح metadata لتجاوز DRIFT_DETECTED.

النتيجة المتوقعة التالية **ليست سجل تشغيل حقيقي**: 8 variables و6 variants بنفس IDs بعد الإعادة، و3 screen instances بنفس IDs، و0 created/updated في إعادة الشاشة. العدد الفعلي لـnodeCount يشمل أبناء instances الموروثة وقد يزيد عن mapping الذي يحصي العناصر المملوكة مباشرة.

## العقد والاستخدام

العينة الكاملة: [phase-3.design-spec.json](../../scripts/samples/phase-3.design-spec.json). الـschemaVersion يظل 1.0.0؛ حقلا tokens وcomponents اختياريان بقيم فارغة لدعم ملفات Phase 2.

- `tokens.modes`: أسماء modes تعمل كمعرّفات ثابتة. `tokens.values`: كل token له id/type/category/values. النوع color أو number أو string؛ القيم محددة لكل mode. semantic tokens تستخدم `{ "token": "primitive.id" }`. يُرفض المرجع الناقص، ودورات aliases، وعدم توافق النوع، وغياب mode.
- قيم الألوان والأبعاد وpadding وspacing وradius وopacity وخصائص النص تدعم token references. يتم الربط بـFigma Variables حيث تسمح الـAPI؛ x/y وopacity الخاصة بكل paint تُحل لقيم عددية عند الرسم لأن Figma لا يوفّر binding لهذه الحقول. هويات nodes ومراجع components وأسماء الخصائص البنيوية تبقى معرّفات صريحة.
- `tokens.typography`: id/name/fontFamily/fontStyle/fontSize/lineHeight/letterSpacing؛ تنشئ Text styles. النص يختارها بـ`typography`. مطلوب fontFamily/fontStyle أيضًا لتحميل الخطوط والتحقق قبل الرسم. الـstyle هو مصدر قيم typography عند تطبيقه.
- `components`: id/name/category/version/properties/dependencies/variants. كل variant له id/name/values/root؛ root شجرة frame عادية، وقد تحتوي component-instance. يتم اكتشاف dependencies من instances وINSTANCE_SWAP أيضًا. الدورات تُرفض قبل الكتابة.
- كل property لها stable id مستقل عن اسم العرض. TEXT وBOOLEAN وINSTANCE_SWAP تحتاج targetId داخل شجرة كل variant. VARIANT تحدد قيمها في `variant.values` بمفاتيح property IDs. أسماء properties وقيم variants لا تحتوي فواصل صيغة Figma `,` أو `=`.
- `component-instance`: componentId وvariant (stable ID) وoverrides بمفاتيح property IDs. swap يحدد component ID؛ تُستخدم أول variant معلنة له. تغيير VARIANT يختار combination معلنة فقط. الـinstance يرث الشكل من الـcomponent؛ تخطيطه وحجمه واسمه وproperty overrides تُطبق محليًا.
- `magic_ui_render_design_system({sessionId,pageId,projectId})`: يقرأ spec المحلية ثم يرسم tokens → components حسب الاعتمادات. pageId هو الصفحة الحالية التي وافق عليها العميل؛ صفحة Components مملوكة للمشروع وتُعرف بالـmetadata، وليس باسم العرض.
- بعدها `magic_ui_render_design({sessionId,pageId,projectId,screenId})` لرسم الشاشة. لو الـdesign system المطلوب غير مرسوم، يُرفض الطلب قبل إنشاء الشاشة.
- `magic_ui_read_components({sessionId,projectId})`: يقرأ registry المحفوظة في مستند Figma. `magic_ui_read_variables` بنفس المدخلات يقرأ القيم والمجموعات والمودات الفعلية.
- `magic_ui_find_component({projectId,name,category?,properties?})`: lookup محلي، يرتب الاسم والخصائص بنسبة similarity؛ استخدمه قبل اقتراح component جديدة. validation يرجع warnings للأسماء والخصائص المتشابهة جدًا.

بعد نجاح الرسم، تُحفظ `design-system/components.json` ذريًا بصلاحيات 0600، وتضم stable IDs وFigma IDs وproperty keys وvariants/dependencies/usage/version. لا حاجة لاتصال Figma للبحث فيها. المجلد لا ينشأ قبل الحاجة، وsymlinks مرفوضة.

## حدود هذه المرحلة

- لا حذف للـvariables أو الـstyles أو الـcomponents أو الـvariants أو الأبناء التي خرجت من الـspec؛ تظل للمراجعة. إدارة Trash وsync مؤجلة.
- الـrenderer يقارن baselines قبل الكتابة ويرفض التعديل اليدوي أو حذف هوية سابقة. تغيّر القيم المحسوبة بسبب mode لا يُعتبر drift؛ binding نفسه جزء من baseline.
- فشل كتابة design system يترك علامة pending في المستند ويمنع إعادة إنشاء نسخ عند المحاولة التالية. افحص الخطأ والنتيجة الجزئية؛ الاستعادة/التسوية ليست ضمن Phase 3. لا تمسح العلامة آليًا.
- حدود النقل والملفات ما زالت 65536 byte، و500 node وعمق 32. بعض خطط Figma تحد عدد modes؛ فشل إنشاء mode يُعاد كخطأ ولا يتحول لصورة أو mock. لا تُضاف dependencies جديدة.

## إصلاحات التوافق المثبتة بالتجربة

- اسم العرض للـVariable يستخدم `/` بدل `.`؛ stable ID يظل كما هو في metadata.
- تعريفات component properties تُقرأ من Component Set، ولا تُقرأ من variant عضو في set.
- الـvariant المنفردة تُسمى `Variant=Default` حتى يظل الـset صالحًا عند إعادة الرسم.
- `FIGMA_MODE_LIMIT` يوضح أن السعة المتاحة للـmodes غير كافية. لا fallback صامت ولا حذف للـcollection الجزئية. أي إصلاح metadata للتجربة تم بعد فحص مباشر، وليس مسار استعادة تلقائيًا في المنتج.
