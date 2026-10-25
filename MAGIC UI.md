# MAGIC UI
## Complete System Architecture, Engineering Standards & Implementation Instructions

**Project Name:** Magic UI  
**Project Type:** Figma Plugin + Local MCP Server + AI Agents + Skills System  
**Primary Language:** TypeScript  
**Architecture:** Feature-Based Clean Architecture  
**Main Priorities:** Performance, Reliability, Design Quality, Maintainability

---

# 1. ROLE & RESPONSIBILITIES

أنت تعمل كفريق هندسي متكامل يضم:

- Principal Software Architect
- Senior TypeScript Engineer
- Senior Figma Plugin Engineer
- MCP Protocol Engineer
- AI Agent Engineer
- Senior UI/UX Designer
- Design Systems Engineer
- Performance Engineer
- QA Automation Engineer
- Security Engineer

المطلوب منك **بناء مشروع Magic UI بالكامل**، وليس مجرد كتابة تصور أو Documentation.

يجب تنفيذ المشروع بملفات حقيقية، وكود قابل للتشغيل، واختبارات، وإعدادات، وSkills، وAgents، وأدوات تثبيت.

لا تكتفِ بإنشاء فولدرات فارغة أو Functions وهمية.

لا تستخدم Mock Implementations في الوظائف الأساسية عند التسليم النهائي.

لا تدّعِ أن ميزة تعمل قبل التحقق منها فعليًا.

نفذ المشروع على مراحل، واختبر كل مرحلة أثناء تنفيذها، ولا تؤجل جميع الاختبارات للنهاية.

**استمر في التنفيذ حتى إتمام جميع الأجزاء الممكنة في بيئة العمل.**

عندما تحتاج خطوة إلى تدخل خارجي لا تستطيع القيام به، مثل تسجيل الدخول إلى Figma أو منح صلاحية من نظام التشغيل، جهز كل ما يمكن تجهيزه، ثم وثق الخطوة المطلوبة بدقة، واستكمل باقي المهام المستقلة.

لا تختلق نجاح الاختبارات التي لم تُنفذ.

---

# 2. PROJECT VISION

Magic UI هو نظام متكامل يربط AI Coding Agents مع Figma لإنشاء وإدارة وقراءة التصميمات.

يجب أن يدعم اتجاهين مستقلين:

### Direction A — AI to Figma

يقوم الـ AI Agent بـ:

1. فهم متطلبات المستخدم.
2. تحليل المشروع.
3. البحث عن UI References أو استخدام المراجع المقدمة.
4. إنشاء Design Workspace محلي.
5. إعداد Design System.
6. إنشاء Reusable Components.
7. إنشاء Variants.
8. تجهيز Assets.
9. إنشاء Screens.
10. عرض Screens داخل Mockups.
11. إرسال التصميم إلى Figma من خلال Local MCP.
12. التحقق من جودة التصميم.
13. إصلاح الأخطاء.
14. حفظ المشروع لإمكانية استكماله.

### Direction B — Figma to Code

يقوم Agent مستقل بـ:

1. الاتصال بـ Figma.
2. قراءة التصميم الموجود.
3. تحليل الصفحات والشاشات.
4. استخراج Components وVariants.
5. قراءة Auto Layout وConstraints.
6. قراءة Typography وColors وVariables.
7. استخراج Assets المطلوبة.
8. بناء Design Specification.
9. تجهيز Design-to-Code Package.
10. تسليم معلومات منظمة إلى Coding Agent لتنفيذ التصميم بالكود.

هذا الـ Agent يجب أن يكون **Read-Only تجاه Figma**.

ممنوع عليه تعديل أو إنشاء أو حذف أي Node داخل Figma.

هدفه قراءة التصميم وتحليله وتجهيزه لتنفيذ الكود بدقة.

---

# 3. CORE ENGINEERING PRINCIPLES

التزم دائمًا بالمبادئ التالية:

1. Performance First.
2. Correctness Before Completion.
3. Feature-Based Architecture.
4. Clean Architecture Without Overengineering.
5. Single Responsibility Principle.
6. Explicit Naming.
7. Strong Type Safety.
8. Reusable Components.
9. Component Registry.
10. Typed Communication.
11. Minimal Dependencies.
12. Incremental Rendering.
13. Incremental Synchronization.
14. Error Recovery.
15. Automated Validation.
16. Clear Documentation.
17. Security by Default.
18. No Silent Failures.

### Naming Rules

ممنوع استخدام مسميات غير واضحة مثل:

```text
a.ts
s.ts
c.ts
v.ts
x.ts
data1.ts
helper2.ts
temp.ts
fn1
obj2
```

استخدم أسماء معبرة:

```text
figmaComponentRegistry.ts
designSpecificationBuilder.ts
referenceResearchService.ts
figmaNodeRenderer.ts
assetOptimizationService.ts
designValidationEngine.ts
pluginConnectionManager.ts
```

يجب أن تكون أسماء:

- Files
- Functions
- Variables
- Classes
- Interfaces
- Types
- Events
- Commands
- Skills
- MCP Tools

واضحة وتشرح مسؤوليتها.

لا تعتمد على Display Names أو نصوص مترجمة كمعرّفات ثابتة.

استخدم Stable IDs وEnums أو Typed Literal Unions عندما تكون مناسبة.

---

# 4. TECHNOLOGY STACK

## 4.1 Figma Plugin Runtime

- TypeScript
- Official Figma Plugin API
- Strict TypeScript
- Native Figma Node Operations

لا تستخدم DOM APIs داخل Plugin Main Runtime.

## 4.2 Plugin UI

- Preact
- TypeScript
- Vite
- Signals
- CSS Modules

استخدم Preact لتقليل حجم الواجهة، ما لم تظهر أسباب تقنية واضحة لاختيار بديل.

لا تضف State Management Library ضخمة دون حاجة.

## 4.3 Local MCP Server

- Node.js LTS
- TypeScript
- Official MCP SDK
- Zod أو Schema Validator مناسب
- Local IPC / WebSocket / HTTP Bridge حسب الحاجة

يجب اختيار Transport متوافق فعليًا مع MCP Clients المستهدفين.

## 4.4 Testing

- Vitest
- Unit Tests
- Integration Tests
- Contract Tests
- Performance Benchmarks
- Figma Runtime Tests عند توفر بيئة فعلية

## 4.5 Tooling

- ESLint
- Prettier
- TypeScript Strict Mode
- Vite
- Package Manager موحد
- Workspace Scripts

لا تستخدم مكتبات غير ضرورية.

---

# 5. PROJECT STRUCTURE

أنشئ المشروع بالاستراكشر التالي:

```text
magic-ui/
│
├── manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── setup.command
├── README.md
├── AGENTS.md
├── .gitignore
├── .env.example
│
├── src/
│   │
│   ├── plugin/
│   │   ├── main.ts
│   │   ├── handlers/
│   │   ├── services/
│   │   ├── adapters/
│   │   ├── commands/
│   │   ├── renderer/
│   │   └── messaging/
│   │
│   ├── ui/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── providers/
│   │   ├── router/
│   │   ├── components/
│   │   └── styles/
│   │
│   ├── features/
│   │   ├── generate-design/
│   │   ├── export-design/
│   │   ├── import-design/
│   │   ├── component-management/
│   │   ├── reference-management/
│   │   ├── asset-management/
│   │   ├── project-management/
│   │   └── settings/
│   │
│   ├── shared/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types/
│   │   ├── contracts/
│   │   ├── constants/
│   │   ├── utils/
│   │   └── errors/
│   │
│   ├── infrastructure/
│   │   ├── api/
│   │   ├── messaging/
│   │   ├── storage/
│   │   ├── figma/
│   │   └── synchronization/
│   │
│   └── config/
│
├── mcp-server/
│   ├── src/
│   │   ├── main.ts
│   │   ├── tools/
│   │   ├── resources/
│   │   ├── prompts/
│   │   ├── bridge/
│   │   ├── services/
│   │   ├── validation/
│   │   ├── security/
│   │   └── sessions/
│   ├── package.json
│   └── tsconfig.json
│
├── agent/
│   ├── AGENTS.md
│   │
│   ├── agents/
│   │   ├── design-agent/
│   │   ├── figma-reader-agent/
│   │   └── validation-agent/
│   │
│   ├── skills/
│   │   ├── project-initialization/
│   │   ├── reference-research/
│   │   ├── reference-analysis/
│   │   ├── design-planning/
│   │   ├── design-system/
│   │   ├── component-management/
│   │   ├── variant-management/
│   │   ├── layout-engine/
│   │   ├── mobile-design/
│   │   ├── web-design/
│   │   ├── dashboard-design/
│   │   ├── asset-management/
│   │   ├── image-generation/
│   │   ├── mockup-management/
│   │   ├── figma-sync/
│   │   ├── figma-reading/
│   │   ├── design-to-code/
│   │   ├── design-validation/
│   │   ├── performance-optimization/
│   │   └── project-recovery/
│   │
│   └── workflows/
│       ├── create-design/
│       ├── update-design/
│       ├── read-figma/
│       ├── prepare-code/
│       └── validate-design/
│
├── installers/
│   ├── environment-check/
│   ├── client-detection/
│   ├── mcp-configuration/
│   ├── skills-installation/
│   └── health-check/
│
├── assets/
│   ├── mockups/
│   └── templates/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contracts/
│   ├── performance/
│   └── fixtures/
│
├── docs/
│   ├── architecture/
│   ├── installation/
│   ├── mcp/
│   ├── skills/
│   ├── figma/
│   └── troubleshooting/
│
└── dist/
```

هذا الاستراكشر هو الأساس المنطقي للمشروع.

أنشئ الفولدرات حسب الحاجة الفعلية، ولا تنشئ ملفات فارغة لمجرد مطابقة الشجرة.

احتفظ بالفصل بين Plugin Runtime وUI وMCP Server وAgents.

يمكن تنظيم ملفات الإعدادات حسب متطلبات أدوات البناء طالما تم الحفاظ على المسؤوليات.

---

# 6. ARCHITECTURE BOUNDARIES

النظام يتكون من خمسة أجزاء رئيسية:

## 6.1 AI Agents

مسؤولة عن فهم المتطلبات والتخطيط واختيار Skills واستدعاء MCP Tools.

## 6.2 Skills Engine

يوفر قواعد متخصصة لكل نوع من المهام.

## 6.3 Local Design Workspace

يحتفظ بخطة التصميم والمراجع والصور والمكونات والحالة.

## 6.4 Local MCP Server

ينفذ أدوات التحكم والقراءة والتواصل مع Figma.

## 6.5 Figma Plugin

ينفذ عمليات إنشاء وتعديل وقراءة عناصر التصميم عبر Figma Plugin API.

### Required Communication Flow

```text
AI Agent
    |
    v
Skills + Workflows
    |
    v
Local MCP Server
    |
    v
Connection Bridge
    |
    v
Magic UI Figma Plugin
    |
    v
Figma Document
```

يجب تصميم الاتصال بحيث يكون آمنًا وقابلًا للاستعادة بعد انقطاعه.

لا تفترض أن Figma Plugin API متاح مباشرة من MCP Server.

---

# 7. LOCAL MCP SERVER

أنشئ MCP Server فعليًا يدعم الأدوات اللازمة.

## 7.1 Connection Management

يجب دعم:

- Connect
- Disconnect
- Connection Status
- Session Management
- Reconnection
- Heartbeat عند الحاجة
- Request Timeout
- Cancellation
- Error Reporting

يجب دعم أكثر من مشروع دون خلط بيانات المشروعات.

عند وجود أكثر من Figma Session، يجب تحديد الهدف بوضوح.

لا تنفذ أوامر كتابة على مستند غير محدد.

## 7.2 MCP Tool Categories

### Project Tools

```text
magic_ui_initialize_project
magic_ui_get_project_status
magic_ui_list_projects
magic_ui_get_project_details
```

### Figma Reading Tools

```text
magic_ui_read_document
magic_ui_list_pages
magic_ui_read_page
magic_ui_read_selection
magic_ui_read_node
magic_ui_read_components
magic_ui_read_styles
magic_ui_read_variables
```

### Design Creation Tools

```text
magic_ui_create_page
magic_ui_create_frame
magic_ui_create_component
magic_ui_create_component_set
magic_ui_create_instance
magic_ui_apply_auto_layout
magic_ui_render_design
```

### Asset Tools

```text
magic_ui_register_asset
magic_ui_get_asset
magic_ui_prepare_image
magic_ui_export_asset
```

### Synchronization Tools

```text
magic_ui_get_sync_status
magic_ui_preview_changes
magic_ui_apply_changes
magic_ui_resolve_conflicts
```

### Validation Tools

```text
magic_ui_validate_design
magic_ui_get_validation_report
magic_ui_get_performance_report
```

لا تقتصر الأدوات على القائمة إذا احتاج التنفيذ وظائف إضافية.

لكن لا تضف Tools متكررة أو متداخلة دون داعٍ.

## 7.3 Tool Contracts

كل Tool يجب أن تمتلك:

- Clear Name
- Description
- Input Schema
- Output Schema
- Error Schema
- Permission Requirement
- Timeout Policy
- Cancellation Support عند الحاجة

يجب التحقق من جميع المدخلات قبل تنفيذها.

---

# 8. AGENT SYSTEM

أنشئ ثلاثة Agents رئيسية.

## 8.1 Design Agent

مسؤول عن إنشاء التصميمات.

قدراته:

- Research
- Planning
- Component Creation
- Layout Generation
- Asset Preparation
- Figma Rendering
- Validation
- Recovery

يملك صلاحيات كتابة داخل Figma ضمن المشروع المستهدف.

## 8.2 Figma Reader Agent

مسؤول عن قراءة التصميم الموجود وتجهيزه لتحويله إلى كود.

**Read-Only تجاه Figma بشكل كامل.**

يجب ألا يمتلك أدوات إنشاء أو تعديل أو حذف عناصر Figma.

يسمح له بإنشاء ملفات محلية فقط داخل Output Workspace المصرح به.

## 8.3 Validation Agent

مسؤول عن:

- Structural Validation
- Visual Validation
- Component Validation
- Layout Validation
- Asset Validation
- Performance Reporting

عمليات الإصلاح يجب أن تتم عبر Workflow بصلاحيات كتابة محددة، وليس عبر منح Reader Agent صلاحيات إضافية.

---

# 9. SKILLS SYSTEM

أنشئ Skill مستقلة لكل مسؤولية أساسية.

## Mandatory Skills

1. `project-initialization`
2. `reference-research`
3. `reference-analysis`
4. `design-planning`
5. `design-system`
6. `component-management`
7. `variant-management`
8. `layout-engine`
9. `mobile-design`
10. `web-design`
11. `dashboard-design`
12. `asset-management`
13. `image-generation`
14. `mockup-management`
15. `figma-sync`
16. `figma-reading`
17. `design-to-code`
18. `design-validation`
19. `performance-optimization`
20. `project-recovery`

## Skill Structure

```text
skill-name/
├── SKILL.md
├── references/
├── scripts/
└── templates/
```

الفولدرات الإضافية اختيارية وتُنشأ فقط عند الحاجة.

كل `SKILL.md` يجب أن يحتوي على:

- Name
- Description
- Purpose
- When to Use
- Required Inputs
- Prerequisites
- Execution Steps
- Expected Outputs
- Validation Rules
- Error Handling
- Related Skills

اكتب Skills متوافقة قدر الإمكان مع تنسيقات العملاء المستهدفين.

إذا اختلف تنسيق أو موقع تثبيت Skills بين Claude Code وCodex وOpenCode، أنشئ Adapter أو Installation Mapping لكل عميل بدل افتراض التوافق المطلق.

## Progressive Disclosure

لا تحمل كل ملفات Skills مرة واحدة.

يقرأ الـ Agent وصف المهارة أولًا، ثم يفتح تفاصيل المهارات المطلوبة فقط.

لا تكرر التعليمات المشتركة في كل Skill.

ضع Global Rules في `AGENTS.md` وملفات مشتركة.

---

# 10. DESIGN WORKSPACE INITIALIZATION

عند طلب إنشاء تصميم جديد، أنشئ فولدر باسم المشروع مع اللاحقة `-Design`.

مثال:

```text
ZFresh-Design/
├── AGENTS.md
├── project.json
├── design-spec.json
├── design-progress.json
│
├── skills/
│   └── project-rules.md
│
├── references/
│   ├── references.json
│   └── images/
│
├── design-system/
│   ├── tokens.json
│   ├── typography.json
│   └── components.json
│
├── screens/
│   ├── customer-app/
│   ├── driver-app/
│   └── admin-dashboard/
│
├── assets/
│   ├── images/
│   ├── icons/
│   ├── mockups/
│   └── assets-manifest.json
│
├── prompts/
│   └── image-prompts.md
│
├── checkpoints/
│
└── reports/
    ├── validation.json
    └── performance.json
```

لا تنشئ فولدرات التطبيقات والمواقع والداشبورد إلا عند الحاجة.

## Local Workspace Rules

- الملفات المحلية هي المصدر الأساسي للـ Design Plan.
- يجب حفظ مراجع التصميم محليًا عندما تسمح حقوق الوصول والاستخدام.
- يجب حفظ Assets المستخدمة.
- يجب حفظ حالة التنفيذ.
- يجب تسجيل المكونات التي تم إنشاؤها.
- يجب ربط العناصر المحلية بعناصر Figma.
- يجب الحفاظ على إمكانية استكمال المشروع بعد إعادة التشغيل.

لا تعتبر الملفات المحلية بديلًا تلقائيًا عن آخر حالة فعلية في Figma؛ يجب مزامنة الحالتين واكتشاف التغييرات.

---

# 11. REFERENCE RESEARCH ENGINE

## 11.1 User-Provided References

إذا قدم المستخدم مراجع:

1. اقرأ المراجع.
2. حلل أسلوب التصميم.
3. استخرج الأنماط المشتركة.
4. حدد Color Palette.
5. حدد Typography.
6. حدد Spacing.
7. حدد Components.
8. حدد Layout Patterns.
9. أنشئ Reference Analysis Report.
10. جهز Design System مناسبًا.

لا ترفع المرجع إلى Figma باعتباره التصميم النهائي.

يمكن إضافة Thumbnail إلى صفحة `References` للتوثيق والتذكير.

## 11.2 Automatic Reference Research

إذا لم يقدم المستخدم مراجع، ابحث عن مراجع مناسبة من مصادر متنوعة مثل:

- Dribbble
- Behance
- Pinterest
- Mobbin
- Awwwards
- UI Libraries
- Real Product Websites

لا تستخدم نفس التصميم أو نفس الموقع لكل مشروع.

ابحث بناءً على:

- Product Category
- Industry
- Target Audience
- Platform
- Design Style
- Language
- Layout Requirements

استخدم النتائج التي يمكن الوصول إليها بشكل مشروع.

إذا لم تتوفر أدوات بحث أو تعذر الوصول للمصادر، صرح بذلك، واعتمد على Design Patterns موثقة بدل اختلاق مراجع.

## 11.3 Reference Registry

سجل لكل Reference:

- Reference ID
- Title
- Source
- Original URL
- Local File Path إن وجد
- Design Category
- Visual Characteristics
- Usage Notes
- Access Date
- License/Usage Notes

يجب منع تكرار نفس المرجع بلا داعٍ.

---

# 12. FIGMA PAGE STRUCTURE

أنشئ الصفحات حسب نوع المشروع.

## Core Pages

- `Components`
- `Trash`
- `References`

## Application Pages

- `App - Customer`
- `App - Driver`
- `App - Provider`

## Website Pages

- `Web - Marketing`
- `Web - Store`

## Dashboard Pages

- `Dashboard - Admin`
- `Dashboard - Merchant`

لا تنشئ صفحات غير مستخدمة.

إذا احتوى المشروع على أكثر من تطبيق، أنشئ صفحة مستقلة لكل تطبيق.

ونفس القاعدة للمواقع ولوحات التحكم.

## Main Auto Layout Rule

كل صفحة تحتوي على Main Workspace Frame يستخدم Auto Layout.

داخله أقسام أصغر، وتستخدم هذه الأقسام Auto Layout حسب احتياجاتها.

مثال:

```text
Components
└── Components Workspace
    ├── Foundations Section
    ├── Buttons Section
    ├── Inputs Section
    ├── Cards Section
    ├── Navigation Section
    └── Feedback Section
```

استخدم Auto Layout كقاعدة عامة، وليس بشكل أعمى.

يمكن استخدام Absolute Positioning في العناصر الزخرفية والمتداخلة التي تحتاجه.

---

# 13. DESIGN SYSTEM ENGINE

لا تبدأ بناء الشاشات الأساسية قبل إنشاء Design System مناسب.

يجب أن يحتوي على:

- Primitive Colors
- Semantic Colors
- Typography Styles
- Spacing Scale
- Border Radius
- Shadows
- Borders
- Grid Rules
- Responsive Breakpoints
- Icons
- Component States
- Themes عند الحاجة
- RTL/LTR Rules

استخدم Figma Variables وStyles المناسبة.

عند وجود Brand Guidelines من المستخدم، يجب أن تكون لها الأولوية على المراجع العامة.

لا تستخدم Hardcoded Colors أو Spacing عشوائي عندما يكون Token مناسب متوفرًا.

---

# 14. COMPONENT-FIRST ENGINE

## Core Rule

كل UI Element قابل لإعادة الاستخدام يجب أن يعتمد على Component.

لكن لا تحول كل Text أو Rectangle داخلي إلى Component مستقل.

## Component Registry

يجب إنشاء Registry محلي يضم:

- Stable Component ID
- Component Name
- Category
- Figma Node ID
- Properties
- Variants
- States
- Dependencies
- Usage Locations
- Version

## Before Creating a Component

نفذ:

1. Registry Lookup.
2. Similarity Check.
3. Reuse Existing Component.
4. Extend Variant عند الحاجة.
5. Create New Component فقط عند الضرورة.

## Components Organization

```text
Components
├── Foundations
├── Buttons
├── Inputs
├── Cards
├── Navigation
├── Dialogs
├── Tables
├── Feedback
└── Specialized
```

## Variant Management

اجمع الأنواع والحالات داخل Component Sets.

مثال:

```text
Button
├── Type
│   ├── Primary
│   ├── Secondary
│   └── Destructive
├── Size
│   ├── Small
│   ├── Medium
│   └── Large
└── State
    ├── Default
    ├── Hover
    ├── Pressed
    ├── Disabled
    └── Loading
```

لا تنشئ Cartesian Product كاملًا لكل الخصائص بدون حاجة.

استخدم Component Properties عندما تكون أنسب.

المكونات يجب أن تدعم إعادة الاستخدام والتعديل المستقبلي.

---

# 15. DESIGN SPECIFICATION ENGINE

يجب إنشاء صيغة بيانات محلية تمثل التصميم قبل Render.

هذه الصيغة هي العقد الأساسي بين Agent وMCP وFigma Renderer.

يجب أن تكون Versioned وقابلة للتحقق آليًا.

## Design Specification Includes

- Specification Version
- Project ID
- Pages
- Screens
- Components
- Component Instances
- Variants
- Design Tokens
- Layout Rules
- Text Content
- Asset References
- Node Hierarchy
- Relationships
- Responsive Rules
- Localization Direction
- Stable Node IDs
- Metadata

مثال مبسط:

```json
{
  "schemaVersion": "1.0.0",
  "projectId": "zfresh",
  "pages": [
    {
      "id": "customer-app",
      "name": "App - Customer",
      "screens": [
        {
          "id": "home-screen",
          "name": "Home",
          "layout": {
            "type": "auto-layout",
            "direction": "vertical"
          },
          "children": [
            {
              "id": "home-header",
              "componentId": "application-header",
              "type": "component-instance"
            }
          ]
        }
      ]
    }
  ]
}
```

هذا مثال على الشكل العام وليس Schema نهائيًا.

أنشئ Schemas قوية مع Validation وMigration Strategy عند تغير الإصدارات.

ممنوع بناء التصميم اعتمادًا على أوامر عشوائية لا يمكن تتبعها أو إعادة استخدامها.

---

# 16. FIGMA RENDERING ENGINE

يجب أن يكون Rendering Engine سريعًا وفعالًا.

## Rendering Strategy

1. Parse Design Specification.
2. Validate Specification.
3. Resolve Dependencies.
4. Load Required Fonts.
5. Resolve Assets.
6. Resolve Existing Components.
7. Prepare Render Operations.
8. Create/Update Nodes.
9. Apply Layouts.
10. Apply Styles.
11. Create Instances.
12. Validate Result.
13. Save Node Mapping.

## Performance Rules

- تجنب Traversing كامل المستند بدون حاجة.
- قلل عمليات Figma API.
- نفذ البحث داخل Scope محدد.
- استخدم `findAllWithCriteria` عند ملاءمته.
- استخدم `skipInvisibleInstanceChildren` عندما لا تحتاج العناصر المخفية.
- اعمل Cache لعمليات Font Loading.
- لا تنشئ نفس الصورة أكثر من مرة عند إمكانية إعادة استخدامها.
- لا تحدث Properties لم تتغير.
- لا تعيد بناء الشاشات بالكامل عند تعديل عنصر واحد.
- نفذ عمليات إنشاء Nodes بترتيب مناسب للاعتماديات.
- تجنب التحديثات المتكررة غير الضرورية.

## Long Operations

عند تنفيذ تصميمات كبيرة:

- اعرض Progress.
- دعم Cancellation.
- دعم Checkpoints.
- اسمح باستكمال التنفيذ.
- تجنب تجميد الواجهة.
- استخدم Chunking عندما يكون مناسبًا وآمنًا.
- احفظ تقدم التنفيذ بعد مراحل واضحة.

لا تفترض أن جميع عمليات Figma تدعم Batch API؛ صمم التحسينات وفق الإمكانيات الفعلية.

---

# 17. AUTO LAYOUT ENGINE

يجب دعم:

- Vertical Auto Layout
- Horizontal Auto Layout
- Nested Auto Layout
- Hug Contents
- Fill Container
- Fixed Sizing
- Padding
- Item Spacing
- Alignment
- Min/Max Size عند الدعم
- Constraints
- Responsive Behavior

كل شاشة يجب أن تكون قابلة للتعديل بدون انهيار التصميم.

تجنب استخدام Fixed Positioning إلا عندما يكون مطلوبًا.

---

# 18. MOBILE DESIGN SYSTEM

عند إنشاء تطبيق موبايل:

- جهز الشاشات بمقاسات مناسبة.
- دعم Safe Areas.
- دعم RTL/LTR.
- استخدم Mobile UI Patterns.
- راعِ Touch Targets.
- دعم حالات Loading/Empty/Error عند الحاجة.
- أنشئ Components مشتركة.

## iPhone Mockups

كل شاشة موبايل يجب أن يكون لها عرض داخل iPhone Mockup.

افصل بين:

- Editable Screen
- Mockup Presentation

احتفظ بالشاشة الأصلية القابلة للتعديل.

استخدم Mockup Component قابلًا لإعادة الاستخدام، ولا تنشئ نسخة كاملة جديدة من الموكب لكل شاشة.

يمكن دعم أجهزة إضافية لاحقًا بدون تغيير النظام الأساسي.

---

# 19. WEB & DASHBOARD DESIGN

## Web

دعم:

- Desktop
- Tablet
- Mobile
- Responsive Sections
- Navigation
- Footer
- Reusable Components

## Dashboard

دعم:

- Sidebar
- Header
- Navigation
- Tables
- Filters
- Forms
- Cards
- Charts
- Dialogs
- States

يجب عدم إنشاء Features لا يحتاجها المشروع.

## Laptop Mockups

اعرض شاشات Web وDashboard داخل Laptop Mockups.

مع الاحتفاظ بالشاشات الأصلية منفصلة وقابلة للتعديل.

---

# 20. ASSET MANAGEMENT ENGINE

أنشئ Asset Registry لمنع التكرار وتحسين الأداء.

## Asset Types

- Images
- Icons
- Illustrations
- Backgrounds
- Product Images
- Mockups
- Generated Images

## Asset Metadata

- Asset ID
- File Name
- File Path
- Content Hash
- MIME Type
- Dimensions
- Source
- License
- Usage Locations
- Optimization Status

## Asset Processing

- Deduplication
- Compression
- Format Conversion عند الحاجة
- Dimension Validation
- File Integrity Validation
- Caching

حافظ على جودة الصور المناسبة.

لا تستخدم صورًا منخفضة الجودة لمجرد تقليل الحجم.

## Asset Extraction

استخدم Assets المتوفرة داخل مصادر مصرح بها عندما تكون مناسبة.

تجنب إعادة إنشاء الصورة نفسها بلا داعٍ.

## Image Generation

إذا احتاج التصميم صورة جديدة:

1. حدد الصورة المطلوبة.
2. جهز Prompt مفصلًا.
3. استخدم أداة توليد الصور إن كانت متاحة.
4. تحقق من النتيجة.
5. احفظ الصورة.
6. سجلها في Asset Registry.
7. اربطها بالتصميم.

إذا لم تتوفر أداة توليد:

احفظ Prompt احترافيًا جاهزًا للتنفيذ، وحدد أن الصورة ما زالت غير متوفرة.

لا تستخدم Placeholder وهميًا وتعتبر المهمة مكتملة.

يمكن استخدام صور مرخصة من الإنترنت عند الحاجة.

---

# 21. SMART SYNCHRONIZATION

يجب أن يدعم النظام مزامنة ذكية بين Local Workspace وFigma.

## Sync Capabilities

- Detect Existing Nodes
- Detect Changed Nodes
- Detect Missing Nodes
- Detect Manual Changes
- Preview Updates
- Apply Incremental Changes
- Resolve Conflicts
- Preserve User Edits
- Save Sync State

## Stable Mapping

احتفظ بربط بين:

```text
Local Node ID
Figma Node ID
Specification Version
Last Synced State
```

لا تعتمد على اسم العنصر فقط لتحديد هويته.

## Conflict Resolution

لو المستخدم عدّل عنصرًا يدويًا داخل Figma:

- اكتشف التغيير.
- لا تمسحه بصمت.
- حدد هل يمكن دمج التغييرات.
- اطلب قرارًا عند وجود تعارض حقيقي لا يمكن حسمه بأمان.

## Incremental Updates

لا تحذف الصفحة وتعيد بناءها عند كل تعديل.

حدث فقط العناصر المتأثرة قدر الإمكان.

---

# 22. TRASH & DELETION POLICY

استخدم صفحة `Trash` لحفظ العناصر المستبدلة أو المحذوفة منطقيًا عندما يكون ذلك مناسبًا.

## Rules

- لا تحذف عناصر المستخدم بدون تصريح واضح.
- دعم Soft Delete للعمليات المناسبة.
- تسجيل سبب الحذف.
- الاحتفاظ بهوية العنصر الأصلية.
- دعم الاستعادة حيثما كان ذلك ممكنًا.

لا تنقل كل العناصر المؤقتة تلقائيًا إلى Trash إذا كان ذلك سيسبب تضخمًا غير ضروري.

ضع Cleanup Policy واضحة.

---

# 23. FIGMA READER AGENT

أنشئ Agent مستقل باسم:

**Magic UI Figma Reader**

وظيفته قراءة التصميمات وتجهيزها للتنفيذ البرمجي.

هذا الـ Agent لا يملك صلاحيات تعديل Figma.

## Reader Capabilities

- Read Document Structure
- Read Pages
- Read Frames
- Read Components
- Read Instances
- Read Variants
- Read Variables
- Read Styles
- Read Auto Layout
- Read Constraints
- Read Typography
- Read Colors
- Read Images
- Read SVG Assets
- Read Icons
- Read Component Properties
- Read Text Content
- Read Screen Hierarchy

## Reader Workflow

1. Connect to Figma.
2. Identify Target File.
3. Identify Pages.
4. Identify Screens.
5. Read Component Hierarchy.
6. Read Design Tokens.
7. Read Layout Rules.
8. Read Assets.
9. Build Structured Representation.
10. Export Design-to-Code Package.
11. Validate Export Completeness.

لا تُجرِ تعديلات على مستند Figma خلال هذه العملية.

عمليات Export التي لا تغير المستند مسموحة.

---

# 24. DESIGN-TO-CODE ENGINE

الهدف ليس توليد Screenshot فقط.

يجب استخراج معلومات كافية لتمكين Coding Agent من تنفيذ تصميم مطابق قدر الإمكان.

## Required Extraction

### Layout

- Dimensions
- Padding
- Spacing
- Alignment
- Flex Direction
- Sizing Rules
- Constraints
- Positioning

### Typography

- Font Family
- Font Size
- Font Weight
- Line Height
- Letter Spacing
- Text Alignment
- Text Direction

### Styling

- Colors
- Backgrounds
- Borders
- Radius
- Shadows
- Effects
- Opacity

### Components

- Component Names
- Component Hierarchy
- Variants
- Component Properties
- Instance Overrides
- States

### Assets

- Images
- Icons
- SVG
- Illustrations
- Asset References

### Screens

- Screen Names
- Hierarchy
- Reusable Sections
- Design Relationships

## Output Structure

```text
figma-export/
├── project.json
├── design-spec.json
├── tokens.json
├── components.json
├── screens.json
│
├── components/
├── screens/
│
├── assets/
│   ├── images/
│   ├── icons/
│   └── svg/
│
├── previews/
│
├── instructions/
│   ├── AGENTS.md
│   ├── flutter.md
│   ├── react.md
│   └── nextjs.md
│
└── reports/
    ├── extraction-report.json
    └── missing-information.json
```

أنشئ الملفات المطلوبة فقط بناءً على التقنية المستهدفة.

## Supported Development Targets

يجب أن يكون النظام قابلًا للاستخدام مع:

- Flutter
- React
- Next.js
- Vue
- Angular
- HTML/CSS

لا يلزم بناء Code Generators كاملة لكل Framework في المرحلة الأولى.

الأولوية لاستخراج Design Specification مستقلة عن لغة البرمجة.

يمكن للـ Coding Agent استخدام Specification وSkills المناسبة لبناء الكود.

## Design-to-Code Rules

- Reuse Components.
- Preserve Design Tokens.
- Preserve Hierarchy.
- Preserve Layout Behavior.
- Preserve Typography.
- Preserve Spacing.
- Preserve Asset References.
- Avoid Arbitrary Values.
- Avoid Duplicate Components.
- Respect Target Framework Best Practices.

لا تختلق Responsive Behavior غير موجود داخل التصميم.

إذا كانت بعض المعلومات غير موجودة، سجلها كافتراضات أو معلومات ناقصة.

---

# 25. DESIGN-TO-CODE SKILL

أنشئ Skill باسم:

`design-to-code`

تحتوي على تعليمات لكيفية تنفيذ التصميم باستخدام الـ Coding Agent.

## Workflow

1. Read Exported Specification.
2. Understand Design System.
3. Identify Reusable Components.
4. Build Component Architecture.
5. Prepare Assets.
6. Implement Screens.
7. Compare with Figma Preview.
8. Fix Visual Differences.
9. Validate Responsive Behavior.
10. Run Project Tests.

يجب أن تختلف تفاصيل التنفيذ حسب Framework.

مثال:

### Flutter

- Reusable Widgets
- ThemeData
- Design Tokens
- Responsive Layout
- Asset Management
- Clear Widget Hierarchy

### React

- Reusable Components
- CSS Modules أو Styling System المستخدم بالمشروع
- Design Tokens
- Responsive Layout
- Clear Props
- Feature-Based Structure

لا تفرض نفس تنظيم Flutter على React أو العكس.

---

# 26. VISUAL VALIDATION ENGINE

لا تعتبر إنشاء Nodes دليلًا على جودة التصميم.

يجب تنفيذ Validation على مستويين.

## 26.1 Structural Validation

تحقق من:

- Missing Components
- Duplicate Components
- Invalid Auto Layout
- Text Overflow
- Frame Overflow
- Incorrect Constraints
- Missing Assets
- Missing Fonts
- Broken Component Instances
- Invalid Variants
- Invalid Node References

## 26.2 Visual Validation

يجب:

1. استخراج Preview للتصميم المنفذ.
2. مقارنته بالمواصفات أو المرجع المناسب.
3. كشف المشكلات البصرية.
4. تحديد أسباب الاختلاف.
5. تنفيذ إصلاحات آمنة.
6. إعادة التحقق.

عند عدم توفر أداة مقارنة بصرية فعلية، لا تدّعِ تنفيذها.

## Validation Report

احفظ:

- Passed Checks
- Failed Checks
- Warnings
- Unverified Checks
- Fixed Issues
- Remaining Issues

---

# 27. PERFORMANCE ENGINEERING

**الأداء من أهم متطلبات Magic UI.**

لا يكفي أن يعمل النظام؛ يجب قياس سرعته وتحسينها.

## 27.1 Performance Principles

- Lazy Loading
- Incremental Rendering
- Minimal Plugin API Calls
- Cached Font Loading
- Asset Deduplication
- Efficient Traversal
- Scoped Queries
- Small Communication Payloads
- Avoid Unnecessary Re-rendering
- Efficient State Updates
- Cancellation Support
- Optimized Serialization

## 27.2 UI Performance

- استخدام Preact.
- استخدام Signals عند الحاجة.
- تقسيم الواجهة إلى Components صغيرة.
- تجنب Re-renders غير الضرورية.
- Lazy Load للواجهات الثقيلة.
- تجنب تحميل بيانات المشروع بالكامل عند فتح البلَاجين.

## 27.3 Figma Performance

- لا تقرأ المستند كله لو المطلوب Frame واحد.
- لا تحدث Node Properties دون تغيير.
- استخدم Component Instances.
- قلل عمليات إنشاء Nodes المكررة.
- اعمل Cache للبيانات المناسبة.
- افصل الحسابات الثقيلة القابلة للفصل عن عمليات Figma API.
- راقب حجم البيانات والذاكرة.

## 27.4 MCP Performance

- Minimize Round Trips.
- Prefer Structured Operations.
- Support Large Operations Without Huge Messages.
- Use Correlation IDs.
- Avoid Excessive Serialization.
- Validate Payload Size.

## 27.5 Performance Benchmarks

أنشئ اختبارات تشمل:

- 100 Nodes
- 1,000 Nodes
- 5,000 Nodes
- 10,000 Nodes عندما تسمح البيئة

واختبر:

- Cold Start
- Warm Start
- Component Creation
- Large Page Reading
- Incremental Sync
- Asset Loading
- Rendering Duration
- Memory Usage

قارن نتائج التحسينات بأرقام حقيقية.

لا تستخدم أرقام أداء تخمينية باعتبارها نتائج مؤكدة.

---

# 28. ERROR HANDLING & RECOVERY

يجب أن يكون النظام قادرًا على التعافي من الأخطاء.

## Required Capabilities

- Checkpoint System
- Execution Journal
- Operation Retry
- Request Timeout
- Reconnection
- Resume Workflow
- Partial Failure Reporting
- Safe Rollback عندما يكون ممكنًا
- Idempotency Protection

## Important Rule

لو الـ Agent بدأ إنشاء 100 شاشة وتوقف بعد 60 شاشة:

لا يبدأ من الصفر.

يجب قراءة آخر Checkpoint، والتحقق من الحالة الفعلية داخل Figma، ثم استكمال الشاشات غير المكتملة.

لا تعتمد على Checkpoint محلي فقط دون التحقق من Figma.

---

# 29. SECURITY SYSTEM

يجب تأمين الاتصال بين MCP والبلَاجين.

## Rules

- Bind Local Server to Loopback by Default.
- Use Session Authentication.
- Validate Connection Origin.
- Validate Incoming Messages.
- Restrict File System Access.
- Prevent Path Traversal.
- Prevent Arbitrary Command Execution.
- Protect Tokens and Credentials.
- Avoid Logging Secrets.
- Separate Read and Write Permissions.
- Restrict Destructive Operations.

لا تجعل MCP Tool تقبل Shell Commands عشوائية غير مقيدة.

لا تسمح لـ Reader Agent بالحصول على Write Tools.

لا تخزن بيانات حساسة في Git.

استخدم Environment Variables أو آليات إدارة الأسرار المناسبة.

---

# 30. SETUP.COMMAND — AUTOMATIC INSTALLATION

أنشئ ملفًا أساسيًا باسم:

`setup.command`

يجب أن يكون مناسبًا للتشغيل المباشر على macOS.

الهدف أن يتمكن المستخدم من إعداد Magic UI بسهولة، وبأقل تدخل ممكن.

## Required Setup Workflow

عند تشغيل:

```bash
./setup.command
```

أو فتح الملف مباشرة من Finder:

يجب تنفيذ الخطوات التالية.

### Step 1 — Environment Detection

افحص:

- Operating System
- Architecture
- Node.js Version
- Package Manager
- Git
- Required Dependencies

تحقق من توافق الإصدارات قبل المتابعة.

إذا كان Dependency غير موجود، قدم طريقة تثبيت مناسبة أو نفذ التثبيت إذا كان ذلك آمنًا ومصرحًا به.

لا تستخدم `sudo` دون ضرورة وموافقة واضحة.

### Step 2 — Install Dependencies

- Install Project Dependencies.
- Install MCP Server Dependencies.
- Build Plugin.
- Build MCP Server.
- Validate Output.
- Run Essential Checks.

### Step 3 — AI Client Detection

اكتشف أدوات الـ AI المتوفرة على الجهاز.

الأولوية:

1. Claude Code
2. Codex
3. OpenCode

مع دعم التوسع لأدوات أخرى مثل:

- Cursor
- VS Code AI Integrations
- Compatible MCP Clients

لا تفترض أن جميع هذه الأدوات مثبتة.

لا تُظهر نجاح إعداد أداة لم يتم اكتشافها أو التحقق منها.

### Step 4 — Automatic MCP Configuration

لكل Client مدعوم ومثبت:

1. اكتشف إصدار العميل.
2. حدد طريقة MCP Configuration الرسمية المدعومة.
3. تحقق من Configuration الحالية.
4. افحص وجود Magic UI مسبقًا.
5. أضف MCP Server عند الحاجة.
6. لا تكرر نفس الإعداد.
7. احتفظ بنسخة احتياطية قبل تعديل الملفات.
8. تحقق من صحة Configuration بعد التعديل.

### Claude Code

استخدم آلية MCP Configuration المدعومة في الإصدار المكتشف.

### Codex

استخدم آلية MCP Configuration الرسمية المدعومة في الإصدار المكتشف.

### OpenCode

استخدم آلية MCP Configuration الرسمية المدعومة في الإصدار المكتشف.

لا تفترض أن أسماء الأوامر أو مسارات الإعدادات متطابقة بين الأدوات.

يجب التحقق من طريقة الإعداد الفعلية قبل تنفيذها.

### Step 5 — Install Skills

ثبّت أو اربط Skills في المواقع التي يدعمها كل Client.

يجب:

- Detect Existing Skills.
- Prevent Duplicates.
- Preserve User Customizations.
- Install Missing Skills.
- Update Compatible Skills.
- Validate Skill Metadata.
- Verify Skill Discovery.

استخدم Symlinks عندما تكون مناسبة ومدعومة، أو نسخًا منظمة عند الحاجة.

لا تحذف Skills المستخدم.

### Step 6 — Register Agents

جهز تعليمات الـ Agents للعمل مع كل Client حسب إمكانياته.

إذا كان Client لا يدعم تسجيل Agent مخصص بنفس الصيغة، استخدم أقرب Workflow مدعوم ووثق الفرق.

لا تدّعِ وجود Agent Registration Native إذا لم يكن العميل يدعمه.

### Step 7 — Figma Plugin Preparation

- Build Plugin.
- Validate `manifest.json`.
- Validate Main Entry.
- Validate UI Entry.
- Validate Network Permissions.
- Prepare Development Plugin Import Instructions.
- Verify Plugin Bundle.

لا تفترض إمكانية تسجيل البلَاجين داخل تطبيق Figma تلقائيًا دون تدخل المستخدم.

إذا احتاج Figma استيراد Manifest يدويًا، اشرح الخطوة بدقة.

### Step 8 — Connection Health Check

اختبر:

- MCP Server Startup.
- MCP Tool Registration.
- Server Communication.
- Local Bridge.
- Plugin Connection إذا كان البلَاجين مفتوحًا.
- Read Operations إذا كان مستند متاحًا.
- Skill Installation.

ميز بوضوح بين:

- Passed
- Failed
- Requires User Action
- Not Tested

### Step 9 — Final Setup Summary

اعرض:

```text
Magic UI Setup

Node.js: Ready
Dependencies: Installed
Plugin Build: Passed
MCP Server: Ready

Claude Code: Configured
Codex: Configured
OpenCode: Configured

Skills: Installed
Agents: Prepared

Figma Plugin: Ready to Import
Figma Connection: Awaiting Plugin Launch
```

هذه مجرد صيغة عرض، ويجب أن تعكس النتائج الفعلية.

---

# 31. SETUP SCRIPT SAFETY

يجب أن يكون `setup.command`:

- Idempotent.
- Safe to Run Multiple Times.
- Non-Destructive.
- Clear in Error Reporting.
- Compatible with Paths Containing Spaces.
- Able to Detect Missing Dependencies.
- Able to Recover from Partial Installation.

## Backup Policy

قبل تعديل أي Configuration للمستخدم:

- احفظ نسخة احتياطية.
- تجنب استبدال الملف بالكامل.
- حافظ على الإعدادات الحالية.
- لا تمسح MCP Servers الأخرى.
- لا تعدل إعدادات لا تخص Magic UI.

## Update Support

يجب أن يدعم تشغيل `setup.command` مرة أخرى لتحديث Magic UI وإصلاح الإعدادات.

افصل بين:

- First Installation
- Update
- Repair
- Verification

مع الحفاظ على سهولة الاستخدام.

---

# 32. MAGIC UI PLUGIN USER INTERFACE

أنشئ واجهة بسيطة وسريعة ومنظمة للبلَاجين.

## Main Sections

### Connection

- MCP Connection Status
- Connected Agent
- Session Information
- Reconnect Action

### Project

- Current Project
- Project Status
- Current Design Task

### Operations

- Create Design
- Update Design
- Read Design
- Export Design
- Validate Design

### Progress

- Current Operation
- Progress Indicator
- Completed Steps
- Errors
- Cancellation

### Settings

- Connection Settings
- Performance Settings
- Asset Settings
- Debug Settings

لا تزدحم الواجهة بخيارات غير ضرورية.

استخدم Design System بسيطًا للبلَاجين نفسه.

اجعل الواجهة Responsive داخل المساحة المتاحة لها.

---

# 33. LOGGING & OBSERVABILITY

أنشئ Logging System منظمًا.

## Log Levels

- Debug
- Info
- Warning
- Error

## Required Metrics

- Operation Duration
- MCP Latency
- Render Duration
- Node Count
- Asset Count
- Memory Measurements عندما تتوفر
- Failed Operations
- Retry Count

استخدم Correlation IDs لتتبع العملية من Agent إلى MCP ثم Figma.

لا تخزن أسرارًا أو بيانات حساسة داخل Logs.

---

# 34. TESTING STRATEGY

لا تكتفِ بتشغيل TypeScript Compiler.

## Unit Tests

اختبر:

- Design Specification
- Registry
- Layout Calculations
- Validation Rules
- Asset Deduplication
- ID Generation
- Mapping Logic

## Integration Tests

اختبر:

- MCP Tool Contracts
- Agent-to-MCP Messages
- MCP-to-Plugin Bridge
- Request/Response Handling
- Error Handling
- Recovery

## Synchronization Tests

اختبر:

- First Sync
- Incremental Sync
- Duplicate Prevention
- Manual Change Detection
- Conflict Resolution
- Resume After Failure

## Reader Tests

اختبر:

- Component Extraction
- Variant Extraction
- Typography Extraction
- Auto Layout Extraction
- Asset Export
- Read-Only Enforcement

## Setup Tests

اختبر:

- Clean Installation
- Repeated Installation
- Existing MCP Configuration
- Missing Dependencies
- Interrupted Installation
- Paths With Spaces
- Partial Client Availability

## Performance Tests

اختبر على أحجام بيانات مختلفة.

احتفظ بنتائج Benchmarks للمقارنة.

إذا كانت هناك اختبارات تحتاج تشغيل Figma فعليًا ولم يتوفر، سجلها كاختبارات غير منفذة بدل اعتبارها ناجحة.

---

# 35. DOCUMENTATION

أنشئ Documentation واضحة تشمل:

## README.md

- What is Magic UI?
- Features
- Requirements
- Installation
- Supported AI Clients
- Figma Plugin Setup
- Quick Start
- Troubleshooting

## Architecture Documentation

- System Overview
- Runtime Boundaries
- Communication Protocol
- Design Specification
- Rendering Engine
- Component Registry
- Synchronization
- Security Model

## Agent Documentation

- Available Agents
- Skills
- Workflows
- Tool Permissions
- Usage Examples

## Developer Documentation

- Local Development
- Build
- Testing
- Debugging
- Adding Features
- Adding Skills
- Adding MCP Tools

---

# 36. BUILD & DEVELOPMENT COMMANDS

وفر Scripts واضحة مثل:

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run test
npm run test:integration
npm run test:performance
npm run setup:verify
```

يمكن استخدام Package Manager آخر إذا تم اختياره بشكل موحد.

يجب أن تتوافق الأوامر مع التنفيذ الحقيقي في `package.json`.

لا تنشئ Scripts تشير إلى ملفات غير موجودة.

---

# 37. IMPLEMENTATION PLAN

نفذ المشروع بالترتيب التالي.

## Phase 1 — Foundation

- Initialize Project
- TypeScript Configuration
- Build Configuration
- Architecture
- Logging
- Shared Contracts
- Basic Tests

## Phase 2 — Figma Plugin

- Plugin Runtime
- Plugin UI
- Figma Connection
- Node Reading
- Node Creation
- Messaging

## Phase 3 — Local MCP

- MCP Server
- Tool Registration
- Connection Bridge
- Session Management
- Validation
- Permissions

## Phase 4 — Design Engine

- Design Specification
- Design System
- Component Registry
- Layout Engine
- Rendering Engine
- Asset Management

## Phase 5 — Agent & Skills

- Design Agent
- Reader Agent
- Validation Agent
- Skills
- Workflows
- Global Instructions

## Phase 6 — Advanced Design Features

- Reference Research
- Reference Analysis
- Component Variants
- Mobile Screens
- Web Screens
- Dashboards
- Mockups

## Phase 7 — Design-to-Code

- Figma Reader
- Structured Extraction
- Asset Export
- Design-to-Code Package
- Framework Instructions

## Phase 8 — Synchronization & Recovery

- Smart Sync
- Change Detection
- Conflict Resolution
- Checkpoints
- Resume
- Rollback Strategy

## Phase 9 — Setup Automation

- setup.command
- Environment Detection
- Claude Code Configuration
- Codex Configuration
- OpenCode Configuration
- Skills Installation
- Health Checks

## Phase 10 — Optimization & Testing

- Performance Profiling
- Benchmarking
- Integration Testing
- Security Validation
- Build Verification
- Documentation

---

# 38. EXECUTION RULES

أثناء التنفيذ التزم بالآتي:

1. اقرأ الملفات الموجودة قبل تعديلها.
2. لا تستبدل كودًا يعمل دون سبب.
3. لا تجمع منطقًا كبيرًا داخل ملف واحد.
4. لا تكرر Business Logic.
5. لا تنشئ Abstractions غير مستخدمة.
6. لا تستخدم `any` بدون سبب موثق.
7. لا تترك `TODO` في وظائف أساسية وتعتبرها مكتملة.
8. لا تستخدم Placeholder Implementations في المسارات الأساسية.
9. اختبر كل Module عند الانتهاء منه.
10. حدّث Documentation باستمرار.
11. سجل المشكلات التي لا يمكن حلها بسبب قيود خارجية.
12. حافظ على أسماء واضحة.
13. تجنب التبعيات غير الضرورية.
14. لا تفترض نجاح الاتصالات الخارجية.
15. لا تحذف بيانات المستخدم.
16. لا تكرر المكونات والأصول.
17. لا تنشئ صفحات أو Features غير مطلوبة.
18. اجعل الكود قابلًا للصيانة والتوسع.
19. أعطِ الأولوية للأداء الحقيقي المقاس.
20. تحقق من النتيجة النهائية.

---

# 39. DEFINITION OF DONE

لا تعتبر Magic UI مكتملًا إلا بعد التحقق من المتطلبات التالية.

## Plugin

- Figma Plugin Builds Successfully.
- UI Loads.
- Messaging Works.
- Nodes Can Be Read.
- Nodes Can Be Created.
- Components Can Be Created.
- Variants Can Be Managed.
- Auto Layout Can Be Applied.

## MCP

- Server Starts.
- Tools Registered.
- Inputs Validated.
- Requests Routed.
- Responses Returned.
- Errors Handled.
- Connection State Managed.

## Agents

- Design Agent Instructions Complete.
- Reader Agent Instructions Complete.
- Validation Agent Instructions Complete.
- Permissions Separated.
- Skills Discoverable.

## Design Engine

- Design Specification Validated.
- Component Registry Works.
- Incremental Rendering Works.
- Asset Deduplication Works.
- Design Validation Works.

## Reader

- Reads Figma Structures.
- Extracts Component Information.
- Extracts Layout Information.
- Exports Assets.
- Creates Design-to-Code Package.
- Cannot Modify Figma.

## Setup

- `setup.command` Works on Supported macOS Environment.
- Dependencies Installed.
- Build Verified.
- Installed AI Clients Detected.
- MCP Configurations Validated.
- Skills Installed.
- Repeated Execution Safe.

## Quality

- TypeScript Checks Pass.
- Lint Passes.
- Automated Tests Pass.
- Security Checks Completed.
- Performance Benchmarks Documented.
- Documentation Complete.

أي جزء لا يمكن التحقق منه يجب إدراجه صراحة في التقرير النهائي مع سبب عدم التحقق منه.

---

# 40. FINAL DELIVERY

عند الانتهاء، قدم تقريرًا منظمًا يحتوي على:

### 1. Project Summary

وصف ما تم بناؤه.

### 2. Architecture

ملخص مكونات النظام والعلاقات بينها.

### 3. Implemented Features

الوظائف المنفذة فعليًا.

### 4. MCP Integration

الأدوات المدعومة وحالة تشغيلها.

### 5. Agents & Skills

الـ Agents والـ Skills التي تم إنشاؤها.

### 6. Installation

طريقة استخدام:

`setup.command`

### 7. Figma Setup

خطوات استيراد البلَاجين وبدء الاتصال.

### 8. Testing Results

نتائج الاختبارات الفعلية.

### 9. Performance Results

Benchmarks الفعلية والتحسينات.

### 10. Limitations

أي قيود فعلية أو متطلبات خارجية.

### 11. Usage Examples

أمثلة عملية مثل:

**Create Design:**
> Create a complete food delivery mobile app design using Magic UI.

**Update Design:**
> Update the checkout screens while preserving existing components.

**Read Design:**
> Read the current Figma design and prepare it for Flutter implementation.

**Export Design:**
> Export the selected dashboard screens as a React-ready design specification.

### 12. Final Verification

راجع المشروع كاملًا وتأكد من:

- عدم وجود Dependencies مفقودة.
- عدم وجود Import Errors.
- عدم وجود Broken Paths.
- عدم وجود Missing Scripts.
- عدم وجود Duplicate Components غير مبررة.
- عدم وجود أسماء مبهمة.
- عدم وجود وظائف أساسية وهمية.
- توافق إعدادات MCP الفعلية.
- إمكانية الاستكمال بعد التوقف.

---

# 41. FINAL INSTRUCTION

**Build Magic UI as a real, production-oriented engineering system, not a prototype or demonstration.**

ابدأ بفحص بيئة العمل، ثم أنشئ المعمارية الأساسية، وبعدها نفذ الوظائف واحدة تلو الأخرى.

لا تكتفِ بالشرح أو التخطيط.

لا تكرر نفس التعليمات في ملفات كثيرة.

لا تضع تعقيدات غير ضرورية.

لا تضحي بالأداء مقابل Architecture مبالغ فيها.

لا تضحي بقابلية الصيانة مقابل اختصارات سريعة.

يجب أن يكون النظام:

- Fast
- Modular
- Reliable
- Maintainable
- Extensible
- Secure
- Agent-Friendly
- Figma-Native
- Component-Driven
- Design-System-Aware

والنتيجة النهائية المطلوبة هي:

**Magic UI: A complete local AI-powered Figma design creation, synchronization, inspection, and design-to-code preparation system, with reusable skills, dedicated agents, and automated setup for supported AI coding clients.**

ابدأ التنفيذ الآن، واتبع المراحل بالتسلسل، واختبر كل مرحلة، واحتفظ بحالة التقدم، واستكمل إلى أن تنتهي من كل الأجزاء التي تسمح بها البيئة الفعلية.
