# Phase 6 — Assets + Mockups + Project Pages

## Pre-check
1. اقرأ `AGENTS.md` و `PROGRESS.md`، واتأكد إن Phase 5 مكتوب إنها خلصت.
2. مفيش قرارات جديدة مطلوبة. لو احتجت قرار (زي مكتبة لضغط الصور)، اقترحه في §2 بحالة Proposed، واسأل، واستنى الرد.
3. لو حاجة هنا بتتعارض مع الكود الموجود فعلًا، الكود هو المرجع. اكتب التعارض واقترح تعديل.

## الهدف
الصور والأيقونات بتتسجل مرة واحدة وتتستخدم في أي مكان من غير تكرار. الشاشات بتتعرض جوه mockups من غير ما تتنسخ. وصفحات المشروع بتتعمل حسب نوعه.

## In Scope
1. **Asset Registry** (`assets/assets-manifest.json`): asset id، والاسم، والمسار، و content hash (SHA-256)، و MIME، والأبعاد، والمصدر، والـ license، والاستخدامات، و optimization status.
   - `magic_ui_register_asset`: بيتأكد من الملف (نوع حقيقي من الـ magic bytes، والأبعاد، والحجم) ويعمل dedup بالـ hash.
   - المسارات محصورة جوه الـ workspace.
   - Compression أو conversion بس لو فيه سبب واضح، ومن غير ما الجودة تقل تحت حد مكتوب في الـ config. لو ده محتاج dependency، اسأل الأول (Pre-check 2).
2. **Images في Figma:**
   - `figma.createImage(bytes)` مرة واحدة لكل hash، والـ `imageHash` بيتخزن في الـ registry ويتستخدم تاني.
   - النقل على chunks عبر الـ bridge.
   - الـ spec بتشاور على `assetId`، ومفيش bytes جواها.
3. **Icons:** SVG بـ `figma.createNodeFromSvg` جوه component، والـ SVG بيتعمل له sanitize قبل الإرسال (مفيش scripts ولا external refs).
4. **Asset مش موجود:** لو الـ spec بتشاور على asset ملوش ملف (مثلًا صورة لسه هتتولد)، الـ render بيعمل frame واضح مكتوب عليه `Missing asset: <id>` ويسجله في التقرير كـ **missing**. **مبيعتبرهوش تم**.
5. **Mockups** (ARCHITECTURE §9):
   - Mockup component واحد لكل جهاز (iPhone و Laptop) على صفحة `Components`، بـ screen slot.
   - الـ presentation frame فيه instance من الـ mockup، وجواه instance أو صورة مربوطة بالشاشة الأصلية. والشاشة الأصلية القابلة للتعديل فاضلة منفصلة.
   - **مفيش نسخة كاملة من الـ mockup لكل شاشة.**
   - مكان ملفات الـ mockup الأساسية في `assets/mockups/`. لو مفيش ملفات مرخصة، يتعمل mockup بسيط بالأشكال الأساسية ويتكتب ده في التقرير.
6. **Project pages** (ARCHITECTURE §9): الـ spec بتحدد نوع المشروع (apps و websites و dashboards بالأسماء)، والـ render بيعمل الصفحات المطلوبة بس (`App - <Name>`، و `Web - <Name>`، و `Dashboard - <Name>`، و `Components`، و `References`، و `Trash`). وكل صفحة فيها Main Workspace Frame بـ auto layout.

## Out of Scope
توليد الصور، والبحث عن references (دي skills في Phase 8)، و visual validation.

## Definition of Done
| # | التحقق | الطريقة |
|---|---|---|
| 1 | `pnpm typecheck && pnpm lint && pnpm test` | كله بيعدّي |
| 2 | unit: dedup | نفس الملف باسمين بيترجع asset واحد |
| 3 | unit: validation | ملف `.png` بس محتواه مش صورة بيترفض، وكمان path traversal بيترفض |
| 4 | unit: SVG sanitizer | `<script>` و `xlink:href` الخارجي بيتشالوا |
| 5 | integration | صورة متستخدمة في 10 أماكن = `createImage` اتنادت **مرة واحدة** (تتعد في الـ fake client) |
| 6 | integration: mockups | 5 شاشات = mockup component واحد و 5 instances |
| 7 | integration: pages | مشروع فيه app واحد بس = مفيش صفحات Web ولا Dashboard |
| 8 | في Figma الحقيقي | **Requires User Action:** مشروع sample فيه 3 شاشات موبايل بالصور، جوه iPhone mockups. التحقق بالنظر وفي الـ Layers panel |

## في آخر الجلسة
حدّث `PROGRESS.md` بنفس الشكل.
