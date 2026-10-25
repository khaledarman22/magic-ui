# Magic UI — Architecture Reference

> مرجع ثابت. الـ Agent يقرأ منه الأقسام اللي محتاجها للـ Phase الحالية فقط.
> المهمة الحالية موجودة في `prompts/phase-N.md`، والحالة في `PROGRESS.md`، والقواعد العامة في `AGENTS.md`.
> لا تعدّل هذا الملف إلا لتوثيق قرار تم تأكيده في قسم 2.

---

## 1. Vision

Magic UI نظام محلي يربط AI Coding Agents بـ Figma في اتجاهين مستقلين:

- **Direction A — AI → Figma:** فهم المتطلبات، بناء Design System وComponents وScreens كـ Design Specification محلية، ثم Render داخل Figma مع Validation وإمكانية الاستكمال.
- **Direction B — Figma → Code:** قراءة تصميم موجود (Read-Only تمامًا)، واستخراج Design-to-Code Package مستقلة عن الـ Framework يستخدمها Coding Agent.

**Stack:** TypeScript strict في كل الأجزاء. Plugin UI بـ Preact + Vite + Signals + CSS Modules. MCP Server بـ Node.js LTS + Official MCP SDK + Zod. الاختبارات بـ Vitest. أقل عدد ممكن من الـ Dependencies.

---

## 2. Decisions

> **مهم:** القرارات اللي حالتها **Proposed** دي اقتراحات، ولسه **مش متأكدة**.
> صاحب المشروع هو اللي يأكدها أو يغيّرها، وبعدها تتحول لـ **Locked**.
> لا يبدأ أي Agent تنفيذ جزء يعتمد على قرار لسه Proposed. يسأل الأول.
> القرار اللي بقى Locked لا يُعاد فتحه إلا بطلب صريح من صاحب المشروع.

| ID | الموضوع | الاقتراح | البدائل | الحالة |
|---|---|---|---|---|
| D1 | Package manager | pnpm workspaces | npm workspaces | Locked |
| D2 | Repo layout | monorepo: `packages/shared`, `packages/plugin`, `packages/mcp-server` | فولدرات منفصلة بدون workspaces | Locked |
| D3 | MCP transport للـ clients | stdio | Streamable HTTP | Locked |
| D4 | Bridge بين MCP Server والـ Plugin | الـ MCP Server يفتح WebSocket server على `127.0.0.1`، والـ Plugin UI iframe هو اللي يبدأ الاتصال (لأن الـ Plugin مبيقدرش يعمل listen) | HTTP long-polling | Locked |
| D5 | Bridge port | `3845` قابل للتغيير بـ env `MAGIC_UI_BRIDGE_PORT` | port ديناميكي + discovery file | Locked |
| D6 | أكتر من MCP client شغالين مع بعض | أول instance تمسك الـ port وتبقى **hub**، والـ instances التانية تتصل بيها كـ clients وتعدّي الطلبات من خلالها | daemon منفصل يتشغل بـ launchd | Proposed |
| D7 | Stable node identity | `node.setSharedPluginData("magic_ui", "id", <stableId>)` على كل node بينشئها Magic UI، والـ sync hash في key تاني بنفس الـ namespace. **السبب:** الـ private `setPluginData` مربوط بالـ plugin id، والـ id ده (`magic-ui-local`) هيتغير لو الـ plugin اتنشر، وساعتها كل الـ IDs هتضيع. القيم مش أسرار، فإن plugins تانية تقدر تشوفها مش مشكلة | `setPluginData` (private) | Locked |
| D8 | Source of truth | Figma = حقيقة الـ nodes الموجودة. Design Spec = حقيقة الـ intent. أي اختلاف يتسجل كـ drift ويتعرض على المستخدم. **مفيش auto-merge في v1** | الـ Local هو المصدر الأساسي | Locked |
| D9 | Read-only enforcement | الـ MCP server يدعم `--read-only`، وفي الـ mode ده الـ write tools **مبتتسجلش أصلًا**. وكمان الـ Plugin بيرفض أي write command جاي من session متعلّمة read-only | الاعتماد على تعليمات الـ Agent فقط | Proposed |
| D10 | Session auth للـ bridge | الـ server يولّد token عشوائي ويخزنه في `~/.magic-ui/session.json` بصلاحيات `0600`، والـ Plugin يستلمه من المستخدم مرة واحدة ويحفظه في `figma.clientStorage` | Origin check فقط | Locked |
| D11 | MCP registration في الـ setup | استخدام الـ CLI الرسمي لكل client (زي `claude mcp add`)، والتعديل اليدوي للـ config فقط لو مفيش CLI، مع backup | تعديل config files مباشرة | Proposed |
| D12 | Spec schema | Zod schemas في `packages/shared`، ومنها يتولّد JSON Schema للـ Agents باستخدام `z.toJSONSchema` الموجود في Zod 4 (من غير dependency جديدة) | JSON Schema مكتوب يدويًا | Locked |

---

## 3. System Boundaries

```text
AI Agent (Claude Code / Codex / OpenCode)
   │  MCP (D3)
   ▼
Local MCP Server  ── validation, permissions, sessions, workspace I/O
   │  Bridge (D4, D5, D6, D10)
   ▼
Plugin UI iframe  ── WebSocket client، يعرض الحالة
   │  figma.ui.postMessage / onmessage
   ▼
Plugin Main Runtime  ── Figma Plugin API فقط، بدون DOM
   │
   ▼
Figma Document
```

قواعد:
- الـ MCP Server **مش** عنده وصول مباشر للـ Figma API. كل عملية لازم تعدّي على الـ Plugin.
- الـ Plugin Main مفيهوش network ولا DOM. الشبكة في الـ UI iframe بس.
- كل رسالة عبر الحدود دي typed، ومتحقق منها بـ schema من `packages/shared`، وليها `correlationId`.
- الاتصال لازم يرجع بعد الانقطاع (reconnect مع backoff، heartbeat، timeout، cancellation).
- مفيش أمر كتابة ينفذ على مستند مش محدد. لو فيه أكتر من Figma session متصلة، الـ tool لازم ياخد `sessionId` صريح.

---

## 4. Shared Contracts (`packages/shared`)

- **Message envelope:** `{ protocolVersion, correlationId, sessionId, type, payload }`.
- **Commands:** typed literal union لكل command، و schema للـ payload وللـ result.
- **Errors:** شكل موحد `{ code, message, retryable, details? }`، والـ `code` جاي من enum ثابت.
- **Design Specification schema:** قسم 7.
- **IDs:** stable IDs (`kebab-case` أو مولّدة)، ومفيش اعتماد على display names كمعرّفات.

---

## 5. MCP Tools

كل tool لازم يكون ليه: name، description، input schema، output schema، error codes، permission (`read` | `write`)، timeout، ودعم cancellation لو العملية طويلة.

| Category | Tools | Permission |
|---|---|---|
| Connection | `magic_ui_get_connection_status`, `magic_ui_list_sessions` | read |
| Project | `magic_ui_initialize_project`, `magic_ui_get_project_status`, `magic_ui_list_projects` | write / read |
| Figma Reading | `magic_ui_read_document`, `magic_ui_list_pages`, `magic_ui_read_page`, `magic_ui_read_selection`, `magic_ui_read_node`, `magic_ui_read_components`, `magic_ui_read_styles`, `magic_ui_read_variables` | read |
| Creation | `magic_ui_create_page`, `magic_ui_create_frame`, `magic_ui_create_component`, `magic_ui_create_component_set`, `magic_ui_create_instance`, `magic_ui_apply_auto_layout`, `magic_ui_render_design` | write |
| Assets | `magic_ui_register_asset`, `magic_ui_get_asset`, `magic_ui_export_asset` | write / read |
| Sync | `magic_ui_get_sync_status`, `magic_ui_preview_changes`, `magic_ui_apply_changes` | read / write |
| Validation | `magic_ui_validate_design`, `magic_ui_get_validation_report` | read |

إضافة tool جديدة مسموحة لو مفيش tool موجودة بتعمل نفس الحاجة.

---

## 6. Plugin

- **Main runtime:** handlers لكل command، renderer، reader، وfont cache.
- **UI (Preact):** Connection (الحالة، الـ session، reconnect)، Project، Progress (العملية الحالية، النسبة، الأخطاء، cancel)، Settings. واجهة بسيطة ومن غير زحمة.
- **Manifest:** `networkAccess.allowedDomains: ["none"]` و `devAllowedDomains` فيها `ws://localhost:<port>` و `ws://127.0.0.1:<port>`.
- استيراد الـ Plugin في Figma خطوة يدوية يعملها المستخدم ولازم تتوثق.

---

## 7. Design Specification

العقد بين الـ Agent والـ MCP والـ Renderer. Versioned، وبيتحقق منه آليًا، وليه migration strategy.

يحتوي على: `schemaVersion`، `projectId`، pages، screens، components (مع variants وproperties)، instances و overrides، tokens، layout rules، text content، asset refs، hierarchy، responsive rules، direction (RTL/LTR)، stable IDs، و metadata.

```json
{
  "schemaVersion": "1.0.0",
  "projectId": "zfresh",
  "pages": [{
    "id": "customer-app", "name": "App - Customer",
    "screens": [{
      "id": "home-screen", "name": "Home",
      "layout": { "type": "auto-layout", "direction": "vertical" },
      "children": [{ "id": "home-header", "type": "component-instance", "componentId": "application-header" }]
    }]
  }]
}
```

ممنوع البناء بأوامر عشوائية مش ممكن نتتبعها. كل حاجة بتتعمل render لازم تكون موجودة في الـ spec.

---

## 8. Rendering Engine

**Pipeline:** parse → validate → resolve dependencies → load fonts (cached) → resolve assets → resolve existing components → plan operations → create/update nodes → layouts → styles → instances → validate → save mapping (D7).

**Performance:**
- البحث يكون في scope محدد. `findAllWithCriteria` و `skipInvisibleInstanceChildren` لما يناسبوا.
- متحدّثش properties متغيرتش، ومتعيدش بناء شاشة عشان عنصر واحد اتغير.
- الصور تتعمل بـ hash وتتعمل مرة واحدة بس.
- العمليات الطويلة: progress، cancellation، checkpoints، chunking بحيث الـ UI متهنجش.
- متفترضش وجود batch APIs مش موجودة في Figma.

**Auto Layout:** vertical/horizontal/nested، hug/fill/fixed، padding، spacing، alignment، min/max، constraints. Absolute positioning مسموح بس للعناصر الزخرفية والمتداخلة.

---

## 9. Component System

- **Registry محلي:** stable id، الاسم، category، Figma node id، properties، variants، states، dependencies، usage، version.
- **قبل إنشاء component:** lookup في الـ registry، ثم similarity check، ثم reuse، ثم extend variant، وآخر حل إنشاء component جديد.
- الـ variants تبقى جوه Component Sets. مفيش full Cartesian product. Component Properties لما تكون أنسب.
- مش كل text أو rectangle يتحول لـ component.

**صفحات Figma:** `Components`، `References`، `Trash`، وبعدهم حسب المشروع (`App - <Name>`، `Web - <Name>`، `Dashboard - <Name>`). مفيش صفحات مش مستخدمة. كل صفحة فيها Main Workspace Frame بـ Auto Layout.

**Mockups:** الشاشة الأصلية القابلة للتعديل تفضل منفصلة عن الـ presentation. Mockup component واحد بيتعمل منه instances (iPhone للموبايل، Laptop للويب والداشبورد).

**Design System قبل الشاشات:** primitive و semantic colors، typography، spacing، radius، shadows، borders، grid، breakpoints، states، themes، RTL/LTR. يتعمل بـ Figma Variables و Styles. الـ Brand guidelines من المستخدم ليها الأولوية.

---

## 10. Local Design Workspace

بيتعمل في فولدر `<ProjectName>-Design/`:

```text
<ProjectName>-Design/
├── project.json            # metadata + Figma file binding
├── design-spec.json        # §7
├── design-progress.json    # checkpoints / journal
├── references/references.json
├── design-system/{tokens,typography,components}.json
├── screens/<app-or-site>/
├── assets/assets-manifest.json
├── checkpoints/
└── reports/{validation,performance}.json
```

الفولدرات بتتعمل لما نحتاجها بس. الـ Workspace بيحفظ الـ intent والحالة. الحقيقة الفعلية للـ nodes موجودة في Figma (D8).

---

## 11. Sync, Recovery, Trash

- **Mapping:** `localId ↔ figmaNodeId ↔ specVersion ↔ lastSyncedHash`. الهوية مصدرها الـ pluginData (D7)، مش اسم الـ node.
- **Sync:** نكتشف الموجود والمتغير والناقص والتعديلات اليدوية. نعمل preview للتغييرات، ونطبقها incremental. التعديلات اليدوية **عمرها ما تتمسح بصمت**، والتعارض الحقيقي يتعرض على المستخدم.
- **Recovery:** execution journal، retry، idempotency (نفس العملية متعملش نفس الـ node مرتين). عند الاستكمال: نقرأ الـ checkpoint، **ونتحقق من Figma الفعلي**، ونكمل الناقص بس.
- **Trash:** soft delete للعناصر اللي اتولدت واتستبدلت، مع سبب الحذف والهوية الأصلية. عناصر المستخدم متتحذفش من غير إذن صريح. ولازم تكون فيه cleanup policy واضحة.

---

## 12. Figma Reader & Design-to-Code

**Reader:** read-only تمامًا (D9). بيقرأ الـ structure، والـ components، والـ instances و overrides، والـ variants، والـ variables، والـ styles، والـ auto layout، والـ constraints، والـ typography، والـ colors، والـ images و SVG، والـ text. عمليات الـ export اللي مبتغيرش المستند مسموحة.

**Output:**

```text
figma-export/
├── project.json  design-spec.json  tokens.json  components.json  screens.json
├── assets/{images,icons,svg}/
├── previews/
├── instructions/AGENTS.md (+ <framework>.md عند الطلب فقط)
└── reports/{extraction-report,missing-information}.json
```

**القواعد:** الـ spec مستقلة عن الـ framework وهي الأولوية، ومفيش code generators كاملة في v1. أي responsive behavior مش موجود في التصميم ميتألفش. أي معلومة ناقصة تتسجل في `missing-information.json`.

---

## 13. Agents & Skills

**Agents:**
- `design-agent`: write على المشروع المستهدف.
- `figma-reader-agent`: read-only (D9)، ويكتب ملفات محلية في الـ output workspace بس.
- `validation-agent`: structural و visual validation وتقارير. الإصلاح بيتعمل من خلال workflow ليه write، مش بإن الـ reader ياخد صلاحيات زيادة.

**Skills** (`agent/skills/<name>/SKILL.md`، و `references/` و `scripts/` و `templates/` لما نحتاجهم بس):
project-initialization، reference-research، reference-analysis، design-planning، design-system، component-management، variant-management، layout-engine، mobile-design، web-design، dashboard-design، asset-management، image-generation، mockup-management، figma-sync، figma-reading، design-to-code، design-validation، performance-optimization، project-recovery.

كل `SKILL.md` فيه: name، description، when to use، inputs، prerequisites، steps، outputs، validation، errors، related skills. التعليمات المشتركة مكانها `agent/AGENTS.md` ومتتكررش في كل skill. Progressive disclosure: الـ description الأول، والتفاصيل لما نحتاجها.

> الـ skills اللي معتمدة على أدوات خارجية (البحث عن references، توليد الصور، الـ visual diff) هي **تعليمات سلوك**. لو الأداة مش موجودة، الـ skill تقول كده بوضوح ومتألفش نتائج. البحث يتعمل في المصادر المسموح الوصول ليها بشكل مشروع بس، ومع احترام شروط الاستخدام.

---

## 14. Security

- الـ server يعمل bind على loopback بس، وفيه session token (D10)، و origin check، وكل رسالة بيتعمل لها validate.
- الوصول للملفات محصور في الـ workspace المسموح بيه، مع حماية من path traversal.
- مفيش tool بينفذ shell commands.
- فصل بين read و write (D9). العمليات المدمرة محتاجة تأكيد.
- مفيش أسرار في الـ logs ولا في Git.

---

## 15. Observability

Logger مستوياته debug/info/warn/error، و `correlationId` بيتتبع العملية من الـ Agent للـ MCP لـ Figma. الـ metrics: المدة، الـ latency، الـ render time، عدد الـ nodes والـ assets، الفشل، والـ retries.

---

## 16. Setup (`setup.command`)

سكريبت macOS لازم يكون idempotent، و non-destructive، ويشتغل مع المسارات اللي فيها مسافات، ومبيستخدمش `sudo`.

الخطوات: environment check ← install ← build ← اكتشاف الـ clients (Claude Code، Codex، OpenCode) ← تسجيل الـ MCP (D11، مع backup ومن غير ما يمس servers تانية) ← تثبيت الـ skills (symlink أو copy، ومن غير ما يمسح skills المستخدم) ← تجهيز الـ agents حسب اللي كل client بيدعمه ← build للـ plugin و validate للـ manifest مع تعليمات الـ import اليدوي ← health check ← summary.

كل نتيجة لازم تكون واحدة من: **Passed / Failed / Requires User Action / Not Tested**. الـ modes: install، update، repair، verify.

---

## 17. Testing Strategy

| النوع | بيتشغل فين | أمثلة |
|---|---|---|
| Unit | CI / agent | spec validation، registry، diffing، IDs، asset hashing |
| Contract | CI / agent | schemas بتاعة الـ tools والرسائل |
| Integration | CI / agent | MCP ↔ bridge ↔ **fake plugin client** (test harness، مش mock للمنتج) |
| Benchmarks (logic) | CI / agent | spec على 100 و 1k و 5k و 10k node: validation، diff، serialization |
| In-Figma | **يدوي** | render حقيقي، read حقيقي، benchmarks جوه Figma |
| Setup | يدوي أو sandbox | تثبيت نظيف، تثبيت متكرر، config موجود قبل كده، مسارات فيها مسافات |

أي اختبار مش ممكن نشغّله يتسجل **Not Tested** مع السبب.

---

## 18. Milestones (vertical slices)

| Phase | الهدف | الـ DoD الأساسي |
|---|---|---|
| 1 | **Walking skeleton:** `create_frame` و `read_node` من الأول للآخر | MCP tool ← bridge ← fake plugin، وكمان plugin حقيقي يدويًا |
| 2 | Design Spec v1 + render شاشة واحدة بـ auto layout | spec بتتعمل render، وإعادة الـ render مبتكررش الـ nodes |
| 3 | Design system (variables و styles) + components + variants + registry | reuse بدل التكرار |
| 4 | Reader + Design-to-Code package | export كامل، والـ read-only متطبق |
| 5 | Sync + checkpoints + resume + trash | resume بعد ما الشغل يتقطع في النص من غير تكرار |
| 6 | Assets + mockups + صفحات المشروع | dedup بالـ hash |
| 7 | Multi-client hub (D6) + `setup.command` + health check | تشغيله مرتين ميغيرش أي حاجة، واتنين clients شغالين مع بعض |
| 8 | Agents + skills + workflows + validation engine | الـ skills ممكن الـ clients تلاقيها، والـ reader ملوش write tools |
| 9 | Performance + security + docs | أرقام benchmarks حقيقية متسجلة |
