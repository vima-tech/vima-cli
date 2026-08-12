# vima-cli 完整设计文档（v2.0）

> **版本说明**：本文档为 v2.0 修订版，基于 v1.0 的评估结论做了如下关键调整：
> 1. **平台收敛**：明确仅支持 Claude Code，移除多 Agent 宣称；
> 2. **调度模型重设计**：放弃"暂停/通知/监听"等不存在的事件驱动假设，改为符合 Claude Code 实际能力的**批次驱动调度模型**；
> 3. **共享依赖策略重构**：放弃运行时 Git 协调，改为**共享层前置 + 写保护**的架构手段；
> 4. **补齐后端体系**：新增后端任务文件结构与 API 契约机制；
> 5. **状态系统统一**：单一 lifecycle.json Schema、任务级状态机、单一写入者约定、断点续跑；
> 6. **实现细节修正**：hooks 采用 Claude Code 真实配置格式，修正编号与重复内容。

---

## 一、背景与目标

### 1.1 核心目标

构建一套标准化的 AI 开发脚手架框架，使得开发者只需通过自然语言沟通需求，即可依托 Claude Code 自动完成从需求拆解、规范文档生成到完整业务系统代码生成的全流程。

### 1.2 关键认知

- **不是造 Agent，而是造"宪法体系"**：Claude Code 已经具备强大的代码读写和执行能力。我们需要提供的是极其详尽的入职手册、项目宪法和操作 SOP。
- **两个脚手架产品化**：除了已有的代码生成脚手架，还需要一个"框架配置脚手架"（`vima init`），将约束体系、对话引导、任务模板打包，一键部署 Agent 的工作环境。
- **多模式扩展能力**：`vima create` 支持多种项目模板（业务系统、CLI 工具、脚本项目等），具备极强的扩展性。
- **极简命令集 + 自然语言优先**：斜杠命令仅保留 `/go`（启动开发）和 `/check`（检查完成度）两个，其余所有操作通过自然语言完成。
- **上下文管理优先**：区分"常驻"与"按需"加载，确保 Agent 的上下文窗口始终可控。
- **生命周期感知**：项目有明确的生命周期阶段（初始化 → 需求梳理 → 编码开发 → 日常维护），Agent 自动感知当前阶段并调整工作模式。
- **平台聚焦**：只支持 Claude Code。它提供的自定义子代理（`.claude/agents/`）、钩子（hooks）、斜杠命令、并行任务调用等能力与本框架的需求完全匹配，不做跨平台抽象，把一套机制做深做透。
- **批次驱动调度**：子代理并行不依赖任何"事件总线"，而是利用 Claude Code "同一轮内发起多个子代理调用即并行"的原生特性，由主 Agent 按批次驱动推进。
- **人机信息对齐是核心保障**：框架要解决的最根本问题是人与 AI 对设计与实现保持同一理解——同一份结构化源数据向人投影审计视图与交互原型、向机器投影可对账基线；任何信息差都是返工与故障的源头（见 13.2/13.3）。

### 1.3 平台支持声明

**v2.x 版本仅支持 Claude Code**，理由如下：

| 依赖能力 | Claude Code | 其他 Agent（如 Codex） |
|---------|-------------|----------------------|
| 自定义子代理（`.claude/agents/`） | ✅ 原生支持 | ❌ 无等价机制 |
| 子代理并行调用 | ✅ 同一轮多个 Task 调用 | ❌ / ⚠️ 不一致 |
| 钩子系统（PreToolUse/PostToolUse） | ✅ 原生支持 | ❌ 无等价机制 |
| 斜杠命令（`.claude/commands/`） | ✅ 原生支持 | ⚠️ 机制不同 |
| CLAUDE.md 常驻约束 | ✅ 原生支持 | ⚠️ 机制不同 |

多 Agent 支持不在 v2.x 范围内，也不预留抽象接口——过早的抽象会拖累核心机制的设计深度。若未来确有需求，将在 v3.x 以独立适配层的方式重新立项。

### 1.4 与传统开发方式的对比

| 维度 | 传统开发 | vima-cli 驱动开发 |
|------|---------|------------------|
| **开发周期** | 周/月级别 | 天级别 |
| **代码生成** | 手动编写 | AI 自动生成 |
| **质量保证** | 人工测试 | 五道防线自动验证 |
| **知识传递** | 文档 + 口口相传 | 结构化任务文件 + 自然语言 |
| **上下文管理** | 依赖个人记忆 | 文件系统 + 状态机 |
| **并行开发** | 人工协调 | 批次驱动的子代理并行 |

---

## 二、整体架构设计

### 2.1 CLI 安装

```bash
npm i -g @vima-tech/cli
```

安装完成后即可使用 `vima create` 和 `vima init` 命令。

### 2.2 核心工作流

```bash
# 1. 初始化项目（支持多模板）
vima create my-project

# 2. 初始化 Agent 工作环境
vima init

# 3. 启动 Claude Code
claude

# --- 初始化阶段：自然语言 + 极简命令 ---
# 用户：帮我把 docs/raw 里的文档整理一下，梳理出完整需求
# Agent：（读取 lifecycle.json 得知处于 PLANNING 阶段，整理文档、生成 spec.md、契约文件与任务文件）
# 用户：/go
# Agent：（切换至 DEVELOPING，按批次驱动模型调度 Builder/Verifier 子代理，支持断点续跑）
# 用户：/check
# Agent：（基于任务状态与构建结果，输出客观完成度报告）

# --- 日常开发阶段：纯自然语言，零命令 ---
# 用户：帮我在设备列表加个批量删除
# Agent：自动读取任务文件 → 改代码 → 校验 → 完成
```

### 2.3 用户角色

用户仅需停留在"沟通需求、确认规范"阶段。确认完成后，后续所有开发工作由 Agent 在框架内自主完成。日常开发阶段，用户不需要知道任何命令、任何文件路径、任何架构概念，只需要说人话。

### 2.4 两个阶段的交互模式

| 阶段 | 交互方式 | 用户心智模型 |
|------|---------|-------------|
| **项目初始化** | 结构化命令（CLI + 极简斜杠命令） | "我在配置一个系统" |
| **日常开发/维护** | 纯自然语言对话 | "我在跟一个资深同事聊天，让他帮我改东西" |

### 2.5 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      用户界面层                              │
├─────────────────────────────────────────────────────────────┤
│  CLI 命令 (vima create/init/upgrade/doctor)                  │
│  自然语言对话 │ 斜杠命令 (/go, /check)                       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      业务逻辑层                              │
├─────────────────────────────────────────────────────────────┤
│  模板管理器 │ 生命周期状态机 │ 批次调度器 │ 上下文管理器      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      数据存储层                              │
├─────────────────────────────────────────────────────────────┤
│  项目文件系统 │ lifecycle.json │ 任务文件 │ docs/文档        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Agent 接入层                            │
├─────────────────────────────────────────────────────────────┤
│  Claude Code（唯一支持的 Agent 平台）                        │
│  能力：.claude/agents/ │ hooks │ slash commands │ 并行 Task │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、多模式脚手架设计（vima create）

### 3.1 命令定义

`vima create` 支持通过 `--template` 参数指定项目类型，若未指定则进入交互式选择模式。

```bash
# 交互式选择模板
vima create my-project

# 指定模板直接创建
vima create my-project --template admin
vima create my-cli-tool --template cli
vima create data-script --template script
vima create my-sdk --template lib
vima create mobile-app --template h5
```

### 3.2 模板分类

| 模板标识 | 说明 | 适用场景 | 技术栈 |
|---------|------|---------|--------|
| `admin` | 管理后台业务系统（默认） | 前后端分离的 CRUD 业务系统 | Vue 3 + Java 21 + Spring Boot |
| `cli` | 命令行工具项目 | Node.js CLI 工具 | Node.js + Commander.js |
| `script` | 自动化脚本项目 | 数据处理、定时任务、ETL 脚本 | Python + Shell |
| `lib` | 工具库 / SDK | 可复用的 npm 包或内部 SDK | TypeScript + Rollup |
| `h5` | 移动端 H5 应用 | 移动端页面 | Vue 3 + Vant |

> **落地节奏说明**：v2.0.0 仅交付 admin 模板（含完整的前后端任务体系），其余四个模板的 `template.json` 与目录骨架同步就绪，但标注 `status: preview`，在后续版本逐个补齐。

### 3.3 交互式选择流程

当用户执行 `vima create my-project` 不带 `--template` 参数时：

1. 展示可用模板列表（带简短描述与状态标记）
2. 用户通过上下键选择或输入模板名称
3. 根据所选模板执行环境依赖预检（见 3.6）
4. 执行项目骨架生成

```
? 请选择项目模板： (Use arrow keys)
❯ 管理后台 (admin) - Vue 3 + Java 21 + Spring Boot 管理系统
  CLI 工具 (cli) [preview] - Node.js 命令行工具
  脚本项目 (script) [preview] - Python/Shell 自动化脚本
  工具库 (lib) [preview] - TypeScript SDK/库
  移动端 H5 (h5) [preview] - Vue 3 移动端应用
```

### 3.4 扩展机制

新增模板只需在 `@vima-tech/cli` 的 `templates/` 目录下添加对应模板文件夹和 `template.json` 配置文件，无需修改 CLI 核心代码。

#### 模板配置文件结构（template.json）

```json
{
  "id": "admin",
  "name": "管理后台",
  "status": "stable",
  "description": "Vue 3 + Java 21 + Spring Boot 管理系统",
  "version": "2.0.0",
  "techStack": {
    "frontend": "Vue 3 + TypeScript + Vite",
    "backend": "Java 21 + Spring Boot + JPA",
    "database": "PostgreSQL / MySQL / H2"
  },
  "features": [
    "用户认证与授权",
    "RBAC 权限管理",
    "CRUD 代码生成",
    "API 文档自动生成"
  ],
  "prerequisites": [
    { "tool": "node", "check": "node --version", "constraint": ">=20" },
    { "tool": "java", "check": "java --version", "constraint": ">=21", "optional": true,
      "hint": "缺失不阻断创建，但无法本地运行后端" }
  ],
  "scaffold": { ".": "scaffold/frontend", "backend": "scaffold/backend" },
  "sharedDirs": ["src/components", "src/utils", "vendor",
                 "backend/src/main/java/com/{{projectPkg}}/config",
                 "backend/src/main/java/com/{{projectPkg}}/security"],
  "codeDirs": ["src", "backend/src"],
  "planning": {
    "guide": "planning/planning-guide.md",
    "spec": "planning/spec.admin.md",
    "codingStandards": "planning/coding-standards.md",
    "checklist": "planning/validate.checklist.md",
    "contractExample": "planning/contract.example.md",
    "coverageExample": "planning/coverage-matrix.example.md",
    "taskTemplates": ["planning/_template-fe.md", "planning/_template-be.md"],
    "renderers": { "review": "planning/audit-view.mjs", "prototype": "planning/prototype.mjs" },
    "prototype": true,
    "goPrerequisites": ["docs/spec.md", "docs/contracts", "docs/tasks/README.md",
                        "docs/coverage-matrix.md", "docs/review/index.html",
                        "docs/review/prototype.html"]
  },
  "workspace": "workspace"
}
```

> **实现裁定（v2.0，详见 internal-contracts §6.3）**：`scaffold` 为「目标位置 → 内置目录」
> 映射，**只做 builtin 目录拷贝，不执行 `npm create` / `spring init` 外部命令**
> （偏离 3.5 初稿，理由：确定性与离线可测）；`sharedDirs` 是共享层写保护面的
> **单一真源**（guard-shared.sh 与全部红线文案与之同步）；`planning` 为资产键集
> （初稿的 `artifacts` 数组形态未采用）。

### 3.5 模板生成流程

```javascript
// lib/templates/scaffold.mjs
export async function generateScaffold(projectName, templateId, options) {
  // 1. 加载模板配置
  const config = await loadTemplateConfig(templateId);

  // 2. 环境依赖预检（见 3.6）
  await checkPrerequisites(config);

  // 3. 创建项目目录
  await createProjectDirectory(projectName);

  // 4. 复制模板文件并替换模板变量
  await copyTemplateFiles(templateId, projectName, {
    ...options,
    projectName,
    createdAt: new Date().toISOString()
  });

  // 5. 执行各端脚手架命令（含 fallback 降级）
  await runScaffoldCommands(projectName, config.scaffold);

  // 6. 安装依赖（--no-install 时跳过）
  if (!options.noInstall) {
    await installDependencies(projectName, config);
  }

  // 7. 初始化 Git 仓库（--no-git 时跳过）
  if (!options.noGit) {
    await initGitRepo(projectName);
  }

  return {
    success: true,
    path: resolve(projectName),
    template: config.name,
    nextSteps: [`cd ${projectName}`, 'vima init', 'claude']
  };
}
```

### 3.6 环境依赖预检

`template.json` 中的 `prerequisites` 声明了该模板所需的外部工具。`vima create` 在生成骨架前逐项检查：

| 检查结果 | 处理方式 |
|---------|---------|
| 必需工具缺失 | 中止创建，输出安装指引（如 `sdk install java 21`） |
| 可选工具缺失 | 警告并使用 `fallback` 方案（如内置骨架模板替代 `spring init`） |
| 版本不满足约束 | 中止创建，输出当前版本与要求版本 |

`vima doctor` 复用同一份预检逻辑，可随时复查环境状态。

### 3.7 模板驱动的规范体系（核心设计）

不同项目类型在开发前应产出的规范文档差异很大：

- **admin 业务系统**：需要数据模型、页面清单、权限矩阵、前后端 API 契约；
- **cli 工具**：需要命令清单、参数选项、退出码约定，根本没有"页面"和"契约"的概念；
- **script 脚本**：需要数据源、处理流程、输出目标的定义；
- **lib 工具库**：需要公开 API 面与兼容性承诺。

因此规范体系完全由模板驱动：`template.json` 的 `planning` 字段（见 3.4）声明该模板的**产物清单、就绪校验清单与任务模板**，PLANNING 阶段的一切行为都以此为据。**v2.0 优先全量落地 admin 模板的规范体系，其余模板的规划配置随模板补齐逐个落地（标记 preview）。**

#### 各模板产物矩阵

| 模板 | 规范文档 | 契约 | 任务模板 | 落地状态 |
|------|---------|------|---------|---------|
| `admin`（优先） | `spec.md`（八章：概述/数据模型/页面/接口/规则/权限/技术栈/关键决策记录，第八章为 A4 增补） | ✅ `docs/contracts/*.md` | 前端 + 后端两种 | v2.0 全量落地 |
| `cli` | `cli-spec.md`（命令清单、参数选项、退出码、输出格式、错误处理） | ❌ 不需要 | 命令任务一种 | preview |
| `script` | `script-spec.md`（数据源、处理规则、输出目标、触发方式、失败重试） | ❌ 不需要 | 脚本任务一种 | preview |
| `lib` | `api-spec.md`（公开 API 面、类型定义、版本兼容承诺） | ❌ 不需要 | 模块任务一种 | preview |
| `h5` | `spec.md`（页面为中心，无权限矩阵章节） | ⚠️ 可选 | 页面任务一种 | preview |

#### 模板目录结构

每个模板自带完整的规划资产，`vima init` 时按 templateId 安装到项目中：

```
templates/admin/
├── template.json              # 含 planning 配置块
├── scaffold/                  # 代码骨架
└── planning/                  # 规范体系资产
    ├── planning-guide.md      # PLANNING 阶段引导（终点清单 + 产物要求 + 确认节奏）
    ├── spec.admin.md          # spec.md 骨架模板（八章结构，含各章必填要素标注）
    ├── coding-standards.md    # 编码规范（安装为 docs/coding-standards.md，CLAUDE.md 指针落点）
    ├── contract.example.md    # 契约文件示例
    ├── validate.checklist.md  # 产物机械校验清单（结构/必填要素/引用完整性，见 13.1）
    ├── coverage-matrix.example.md  # 覆盖矩阵示例（原始需求→接口→契约→任务）
    ├── audit-view.mjs         # 人类审计视图确定性渲染器（见 13.2，参考 PACT）
    ├── review.template.html   # 审计视图的 HTML 骨架与样式（单文件、零外部请求）
    ├── prototype.mjs          # 线框原型渲染器（无样式、只展示功能与布局，见 13.3）
    ├── prototype.template.html  # 原型的 HTML 骨架（语义占位组件样式）
    ├── _template-fe.md        # 前端任务模板
    └── _template-be.md        # 后端任务模板
```

#### 运行时机制

```
1. vima create  → 记录 templateId 到 .vima/manifest.json
2. vima init    → 读 templateId → 安装该模板的 planning-guide.md、spec 骨架、校验清单、任务模板
                   lifecycle.json 中记录 templateId
3. PLANNING 阶段 → Agent 先读 docs/planning-guide.md，按终点清单引导对话；
                   产物按骨架填充式生成，每份产物落盘后立即过机械校验（见 13.1）
4. 对齐视图     → vima render-review / render-prototype 从 spec 结构化数据块确定性渲染
                   审计视图与线框原型（人审完整性/体验交互，见 13.2/13.3），
                   CLI 独立运行零 token 消耗，同时产出机器可对账的 prototype.manifest.json
5. /go 前置检查  → 第一道机械校验（vima validate，确定性）→ 第二道语义抽查
                   （Verifier 子代理对照 raw/ 原文）→ 第三道用户评审（审计视图 + 原型 +
                   覆盖矩阵 + vima approve 机械确认，见 13.1 三道校验闸门）
```

#### 扩展新模板的规范体系

新增模板时，除 scaffold 外只需补齐 `planning/` 目录下的资产：引导文档、spec 骨架、校验清单、任务模板、审计视图与原型渲染器（无页面概念的模板声明 prototype: false 跳过）、（可选）契约示例与覆盖矩阵示例，并在 `template.json` 中声明 `artifacts` 与 `goPrerequisites`。**CLI 核心代码、/go、/check 的实现完全不需要改动**——它们只认配置，不认模板。

---

## 四、框架脚手架设计（vima init）

### 4.1 命令作用

`vima init` 负责在当前项目中生成 Agent 工作所需的全部配置：

| 产出物 | 说明 | 管理属性 |
|--------|------|---------|
| `CLAUDE.md` | 项目宪法，精简版，控制在 50 行以内 | vima 生成；生成后归用户所有（upgrade 永不覆盖） |
| `docs/lifecycle.json` | 生命周期状态文件，初始为 PLANNING，含 templateId | vima 管理 |
| `docs/planning-guide.md` | 模板专属的 PLANNING 引导（终点清单 + 产物要求） | vima 管理 |
| `docs/planning-validation/` | 产物机械校验清单与覆盖矩阵示例（validate.checklist.md 等，见 13.1） | vima 管理 |
| `docs/review/` | 人机对齐产物输出目录（审计视图 + 线框原型 + manifest，由 vima render-review/render-prototype 生成，见 13.2/13.3） | CLI 生成 |
| `docs/raw/` | 存放用户提供的原始杂乱文档 | 用户所有 |
| `docs/ui-framework/` | 组件文档，自动扫描生成 | vima 管理 |
| `docs/tasks/_template*.md` | 任务文件模板（由模板配置决定，admin 为前后端两种） | vima 管理 |
| `docs/tasks/README.md` | 任务清单与依赖关系图 | Agent 维护 |
| `docs/contracts/` | API 契约目录（admin 专属，前后端任务的共享输入） | Agent 维护 |
| `.claude/commands/` | 斜杠命令（go.md、check.md） | vima 管理 |
| `.claude/agents/` | 子代理角色模板（vima-builder.md、vima-verifier.md、vima-planner.md） | vima 管理 |
| `.claude/hooks/` | 校验脚本与共享层写保护脚本 | vima 管理 |
| `.claude/settings.json` | 权限与 hooks 配置 | vima 管理 |
| `.vima/manifest.json` | vima 生成物清单与版本标记（升级迁移用） | vima 管理 |

### 4.2 核心能力：自动扫描 UI 组件库

执行 `vima init` 时，自动扫描项目中已安装的 `@vima/ui` 组件库：

- 提取组件的 TypeScript 类型定义
- 提取 JSDoc 注释
- 生成 `CAPABILITY.md` 组件索引
- 生成每个组件的用法手册

### 4.3 两脚手架联动

```
vima create my-project --template admin
    ↓
vima init
    ↓
Agent 工作环境就绪，生命周期进入 PLANNING 阶段
    ↓
用户将原始文档放入 docs/raw/，通过自然语言让 Agent 整理
    ↓
spec.md + contracts/*.md + tasks/*.md 就绪后，用户输入 /go → 切换至 DEVELOPING 阶段（以 admin 模板为例，其他模板产物见 3.7）
    ↓
所有任务开发完成后，自动切换至 MAINTAINING 阶段
```

### 4.4 init 命令实现细节

```javascript
// lib/commands/init.mjs
export async function initCommand(options) {
  const projectRoot = process.cwd();

  // 1. 检查是否已初始化
  if (await isAlreadyInitialized(projectRoot) && !options.force) {
    console.log('项目已初始化。升级请使用 vima upgrade，强制重建请加 --force');
    return;
  }

  // 2. 生成 CLAUDE.md（技术栈自动探测 + 精简模板）
  await generateClaudeMd(projectRoot, {
    techStack: await detectTechStack(projectRoot),
    conventions: await loadConventions(projectRoot)
  });

  // 3. 生成 docs/ 目录结构（lifecycle.json、raw/、tasks/）
  //    并按 templateId 安装模板专属的 planning-guide.md 与 spec 骨架
  const templateId = await readTemplateId(projectRoot);
  await generateDocsStructure(projectRoot, templateId);
  await installPlanningAssets(projectRoot, templateId);

  // 4. 生成 .claude/ 配置（commands、agents、hooks、settings.json）
  await generateClaudeConfig(projectRoot);

  // 5. 扫描 UI 组件库（--skip-scan 时跳过）
  if (!options.skipScan && await hasUiFramework(projectRoot)) {
    await scanUiComponents(projectRoot);
  }

  // 6. 生成任务模板（由模板配置决定，admin 为前端版 + 后端版）
  await generateTaskTemplates(projectRoot, templateId);

  // 7. 写入 .vima/manifest.json（记录所有生成物与版本）
  await writeManifest(projectRoot, CLI_VERSION);

  console.log(`
✅ 初始化完成！

项目结构：
  CLAUDE.md                    # 项目宪法（< 50行）
  docs/
    lifecycle.json             # 生命周期状态（当前：PLANNING）
    raw/                       # 存放原始文档
    contracts/                 # API 契约（PLANNING 阶段生成）
    tasks/                     # 任务文件目录
    ui-framework/              # UI 组件文档
  .claude/
    commands/                  # 斜杠命令（/go, /check）
    agents/                    # 子代理角色模板
    hooks/                     # 自动钩子

下一步：
  1. 将原始文档放入 docs/raw/ 目录
  2. 运行 claude 启动 Claude Code
  3. 通过自然语言描述需求，让 Agent 整理文档
  `);
}
```

### 4.5 升级与迁移机制（vima upgrade）

CLI 升级后，项目中的 vima 生成物需要同步更新，但绝不能摧毁用户定制内容。设计如下：

**清单文件 `.vima/manifest.json`**：

```json
{
  "vimaVersion": "2.0.0",
  "initializedAt": "2026-08-12T10:00:00Z",
  "files": {
    "managed": [
      { "path": ".claude/commands/go.md", "checksum": "sha256:..." },
      { "path": ".claude/agents/vima-builder.md", "checksum": "sha256:..." },
      { "path": ".claude/settings.json", "checksum": "sha256:..." }
    ],
    "userOwned": [
      "CLAUDE.md",
      "docs/tasks/README.md",
      "docs/contracts/"
    ]
  }
}
```

**`vima upgrade` 的三方比较策略**：

| 文件状态 | 处理方式 |
|---------|---------|
| vima 管理文件，用户未修改（checksum 匹配） | 直接覆盖为新版本 |
| vima 管理文件，用户已修改 | 生成 `.vima/upgrade-preview/<file>.diff`，交互确认后合并或跳过 |
| 用户所有文件（CLAUDE.md、tasks、contracts 等） | 永不覆盖，仅在模板结构变化时输出迁移提示 |

> **实现裁定（v2.0，详见 internal-contracts §14）**：「用户已修改」分支不做 diff+交互合并，
> 改为在旁路写 `<path>.vima-new` 全量新版本文件，由用户自行比对合并（实现恒非交互，
> `--yes` 兼容接受但无行为）；另有 reinstall（磁盘缺失重装）/ adopt（磁盘已等于新源）/
> deprecated（模板源已删，保留不删）/ new（模板新增，仅提示不安装）四类补充动作。

---

## 五、约束框架分层设计

### 5.1 分层结构

| 层级 | 文件位置 | 作用 | 生成方式 |
|------|---------|------|---------|
| 全局宪法 | `~/.claude/CLAUDE.md` | 跨项目通用红线 | 手动维护 |
| 项目宪法 | 项目根 `CLAUDE.md` | 技术栈 + 架构 + 编码约定（精简版，< 50 行） | `vima init` 生成 |
| 模块规则 | 子目录 `CLAUDE.md` | 模块级精细化约束 | 手动或 `vima init` 生成 |
| 流程指令 | `.claude/commands/` | 标准操作流程（仅触发时加载） | `vima init` 生成 |
| 自动校验 | `.claude/hooks/` | 工具调用前后自动检查 | `vima init` 生成 |
| 生命周期状态 | `docs/lifecycle.json` | 项目当前阶段、阶段历史、完成清单 | `vima init` 生成，主 Agent 更新 |
| 子代理角色模板 | `.claude/agents/` | Builder/Verifier/Planner 的角色定义与工具权限 | `vima init` 生成 |

> **关于 Skill 的定位**：v2.0 不使用 `.claude/skills/` 承载流程逻辑。Skill 在 Claude Code 中按描述渐进触发，行为不完全可控，且会挤占常驻上下文。所有流程逻辑一律放入斜杠命令（按需加载）或角色模板（子代理专属），Skill 仅在确有需要时用于存放纯知识参考。

### 5.2 CLAUDE.md 精简版示例

```markdown
# 项目技术栈
- 前端：Vue 3 + TypeScript + Vite + @vima/ui
- 后端：Java 21 + Spring Boot + JPA
- 数据库：PostgreSQL

# 核心编码约定
- 组件使用 .vue 单文件组件，<script setup> 语法
- API 返回值统一使用 ApiResponse 包装
- 分页参数使用 pageNum/pageSize 命名
- 前后端接口以 docs/contracts/ 下的契约文件为唯一事实来源

# 禁止事项
- 禁止业务任务修改共享层目录（src/components/、src/utils/、vendor/ 与 backend 的
  config/security 包，同 template.json sharedDirs）
- 禁止使用原生 confirm()/alert()
- 禁止在组件中写全局样式

# 工作协议
- 每次对话开始，先读取 docs/lifecycle.json，按当前阶段模式工作（详见该文件注释）
- 收到开发需求时，先定位 docs/tasks/ 下相关任务文件，再执行修改
- 使用组件前，必须先读取 docs/ui-framework/CAPABILITY.md

# 详细规范
- 编码规范：docs/coding-standards.md
- 组件用法：docs/ui-framework/CAPABILITY.md
- 任务文件：docs/tasks/ 目录
```

### 5.3 约束优先级

1. **全局宪法**：最高优先级，跨项目通用
2. **项目宪法**：项目级约束，覆盖全局
3. **模块规则**：模块级约束，覆盖项目
4. **任务文件**：任务级约束，最具体

### 5.4 CLAUDE.md 体量保护机制

CLAUDE.md 是常驻上下文，必须永远 < 50 行。为防止后续维护中膨胀，设定三条硬规则：

1. **只放指针，不放详情**：调度规则、生命周期详情、校验流程一律写入 `.claude/commands/go.md` 等按需加载文件，CLAUDE.md 中只保留一行指针。
2. **vima 体检**：`vima doctor` 会检查 CLAUDE.md 行数，超过 50 行时告警并提示迁移到 docs/。
3. **Hook 兜底**：PostToolUse hook 在 CLAUDE.md 被修改后自动统计行数，超限时输出警告（不阻断）。

---

## 六、需求沟通阶段设计（PLANNING）

### 6.1 对话引导框架

不是问卷式提问，而是以产品经理角色进行深度对话。Agent 脑中有"终点清单"，但到达路径完全自由。

### 6.2 终点清单（模板驱动）

终点清单不再全局固定，而是由各模板的 `planning-guide.md` 声明（见 3.7）。Agent 对话时脑中有当前模板的终点清单，但到达路径完全自由。

#### admin 模板终点清单（v2.0 全量落地）

- **A. 业务全貌**：系统定位、用户角色、功能模块、核心业务流程（含每条流程串联的页面链路与涉及角色）
- **B. 数据模型**：核心实体、字段定义、实体关系、字典/枚举值
- **C. 页面与交互**：页面清单、页面类型；**每个页面必须达到页面级粒度**——布局拆分（用枚举区块词表描述：toolbar/search/table/form/cards/tabs/pagination）、组件清单（搜索框/表格/功能按钮/弹窗及其位置，弹窗带 MODAL-xx ID）、交互设计（限定跳转/弹窗/接口标注三种，跳转引用 PAGE-xx）、对应接口，细致到程序员可直接实现的精度（见 13.2/13.3）
- **D. 接口定义**：每个页面的数据接口（路径、方法、参数、响应结构）→ 沉淀为契约文件
- **E. 业务规则**：校验规则、状态流转、计算规则、约束条件
- **F. 权限设计**：角色清单、**每个角色的菜单权限清单**、操作权限、数据权限；无任何角色覆盖的菜单必须显式标记
- **G. 技术约束**：前后端技术栈、脚手架命令、UI 框架信息

#### 其他模板终点清单要点（随模板补齐落地）

| 模板 | 终点清单要点 |
|------|-------------|
| `cli` | 使用场景、命令清单、每个命令的参数/选项/退出码、输出格式、错误处理策略 |
| `script` | 数据源与格式、处理规则、输出目标、触发/调度方式、失败重试与告警 |
| `lib` | 目标使用者、公开 API 面、类型定义、版本兼容承诺、示例用法 |
| `h5` | 同 admin 的 A/B/C/D/E/G，无权限矩阵（F），增加移动端适配与手势交互项 |

### 6.3 规范文档结构

规范产物由模板配置声明（见 3.7 产物矩阵）。以 admin 模板为例，对话完成后产出三类文档：

| 文档 | 位置 | 作用 |
|------|------|------|
| `spec.md` | `docs/spec.md` | 系统概述、技术栈、数据模型、页面清单（页面级粒度）、业务规则、权限矩阵、业务流程、关键决策记录（A4） |
| 契约文件 | `docs/contracts/<module>-api.md` | 每个业务模块的接口契约：路径、方法、请求体、响应体、错误码。**前后端任务的唯一共享输入** |
| 任务文件 | `docs/tasks/*.md` | 前端任务 + 后端任务，分别引用对应契约 |
| **审计视图** | `docs/review/index.html` | 人类审核用的单文件 HTML 规格书，由 CLI 从 spec 结构化数据块确定性渲染（见 13.2） |
| **线框原型** | `docs/review/prototype.html` | 无样式交互原型（只展示功能与布局），同源渲染 + `prototype.manifest.json` 机器基线（见 13.3） |

**多轨产物，同源对齐**（参考 PACT 项目的交付设计，框架核心保障见 13.3）：md 产物给 AI 施工，审计视图给人审完整性，原型给人体验交互，manifest 给机器对账实现——四者同源于 spec 的结构化数据块，永不分别维护。

**产物可靠性保证见 13.1**：所有产物均采用"骨架先行、填充生成"——Agent 不从空白页自由创作，而是在模板骨架的固定结构内逐章填充；每份产物落盘后立即过机械校验（结构、必填要素、引用完整性），不达标当场补齐，而非等到 /go 时才发现。

### 6.4 PLANNING 阶段的特殊处理

在 PLANNING 阶段，用户可能提供大量杂乱的原始文档（存放在 `docs/raw/` 目录）。Agent 的职责是：

1. 读取 `docs/lifecycle.json` → 确认当前阶段为 PLANNING、获取 templateId
2. 读取 `docs/planning-guide.md` → 确认当前模板的终点清单与产物要求
3. 扫描 `docs/raw/` → 发现所有原始文档
4. 逐个阅读，提取关键信息
5. 主动跟用户确认业务理解是否正确
6. **骨架先行**：从模板复制 spec 骨架落盘，逐章填充生成 `spec.md`（admin）或对应规范文档；
   骨架强制页面章节达到**页面级粒度**（布局拆分/组件清单/交互设计/接口映射，附 YAML
   结构化数据块作为审计视图数据源，见 13.2）；每写完一章立即更新 checkpoint，
   跨会话可从任意章断点续写（长文档防截断）
7. 生成契约文件 `docs/contracts/*.md`（仅需要契约的模板）
8. **即时机械校验**：spec / contracts / tasks 每份产物落盘后，立即按 `validate.checklist.md`
   做结构校验（章节齐全、接口必填要素、页面级粒度四要素、引用完整性），不达标当场补齐；
   全部通过后置 `artifactsValidated = true`
9. 生成 `docs/coverage-matrix.md` 覆盖矩阵（原始需求→接口→契约→任务），缺口行醒目标记
10. **渲染对齐视图**：运行 `vima render-review` 与 `vima render-prototype`，从 spec 结构化
    数据块确定性生成审计视图与线框原型（校验通过是渲染前提；CLI 独立运行零 token），
    置 `reviewRendered = true`、`prototypeRendered = true`
11. 继续跟用户确认细节
12. 最终生成 `docs/tasks/*.md` 与 `docs/tasks/README.md`（依赖图，从 frontmatter 生成）
13. **任务评审**：请用户**在浏览器打开审计视图**核对完整性（角色权限/菜单功能点/业务流程串联/
    页面 UI 详情，见 13.2），再**点击原型**体验布局与交互是否符合预期（见 13.3），
    核对覆盖矩阵无缺口，再输出任务汇总表
    （ID、标题、layer、依赖、批次、引用契约、前后端配对），
    用户确认后运行 `vima approve` 机械置 `tasksApproved = true` 并记录时间戳——确认动作由
    CLI 留痕，不依赖 Agent 对“用户已确认”的语义判断（/go 是不可逆决策点，评审是它的前置闸门）
14. 每完成一个里程碑即更新 checkpoint（见 6.5）
15. 等待用户输入 `/go` 或说"开始开发"

**用户全程自然语言，不需要敲任何命令。** Agent 因为读到了 PLANNING 状态，自动知道"我现在应该做文档整理，不写代码"。

### 6.5 会话断点与进度检查点

整理十几个文档、多轮确认、产出大量文件，PLANNING 大概率跨越多个会话。为此设计检查点机制：

**检查点存储**：进度写入 `lifecycle.json` 的 `checklists.PLANNING` 与 `docs/tasks/README.md`，不依赖对话记忆。检查点项由模板的 planning 配置声明，下表以 admin 模板为例：

| 检查点 | 判定条件 | 恢复行为 |
|--------|---------|---------|
| `rawDocsCollected` | docs/raw/ 非空且已列出清单 | 新会话直接跳过收集 |
| `modulesConfirmed` | 模块清单已获用户确认（记入 spec.md） | 新会话从模块详情梳理继续 |
| `specGenerated` | spec.md 存在且骨架各章节均已填充（机械校验通过） | 跳过 spec 生成 |
| `contractsGenerated` | contracts/ 覆盖所有业务模块 | 跳过契约生成 |
| `tasksDecomposed` | tasks/ 覆盖所有模块且 README 依赖图完整 | 进入任务评审 |
| `artifactsValidated` | 全部产物通过 validate.checklist.md 机械校验 | 重跑校验 |
| `reviewRendered` | docs/review/index.html 已渲染且与 spec 一致 | 重新渲染 |
| `prototypeRendered` | docs/review/prototype.html 与 manifest 已渲染且与 spec 一致 | 重新渲染 |
| `tasksApproved` | `vima approve` 已执行并记录时间戳（/go 的前置闸门） | 等待 /go |

**新会话恢复流程**：Agent 启动 → 读 lifecycle.json → 发现 PLANNING 未完成 → 读取 README.md 与各检查点 → 向用户报告"上次进行到哪里，接下来做什么" → 继续。

### 6.6 需求整理示例对话

```
用户：帮我把 docs/raw 里的文档整理一下，梳理出完整需求

Agent：好的，我来阅读这些文档。
      （读取 lifecycle.json → PLANNING 阶段）
      （扫描 docs/raw/ → 发现 5 个文档）

      我在文档中看到以下几个业务模块：
      1. 用户管理（包含登录、注册、权限）
      2. 设备管理（设备列表、设备详情、设备监控）
      3. 订单管理（订单创建、订单查询、订单统计）

      这些模块对吗？还有其他模块吗？

用户：对，再加上日志管理模块

Agent：好的，已添加日志管理模块（已更新 spec.md 模块清单与检查点）。
      接下来我会逐步整理每个模块的详细需求。
      首先，用户管理模块需要哪些角色？每个角色有哪些权限？
```

---

## 七、斜杠命令体系

### 7.1 设计理念

斜杠命令不是"替代自然语言"，而是为"标准化流程操作"和"标志性决策动作"提供确定性的快捷入口。日常 90% 的操作（改按钮、修 bug、加页面、加字段）全部用自然语言完成，用户零记忆负担。

| 操作特征 | 自然语言能搞定吗？ | 需要命令吗？ |
|---------|------------------|------------|
| "帮我加个按钮" | ✅ 一句话搞定 | |
| "修复这个 bug" | ✅ 描述清楚就行 | |
| "从计划进入开发执行" | ⚠️ 能说，但这是不可逆的决策点 | ✅ 需要 |
| "检查整个项目的完成度" | ⚠️ 能说，但这是标准化流程 | ✅ 可选 |

### 7.2 极简命令列表

整个框架仅定义 **2 个斜杠命令**：

| 命令 | 含义 | 触发场景 | 底层逻辑 |
|------|------|---------|---------|
| `/go` | 正式启动/恢复开发执行 | PLANNING 完成决定开发，或中断后续跑 | 读取 lifecycle.json → 校验前置产物 → 切换 DEVELOPING → 按批次驱动模型调度子代理（详见第十章） |
| `/check` | 检查项目完成度 | 任何时候想了解整体进度 | 基于任务状态字段与构建结果输出客观完成度报告 |

**为什么只有这两个？**

- `/go` 是整个项目最重要的分水岭——从"讨论和规划"到"动手执行"的不可逆决策点，需要明确的仪式感。
- `/check` 是标准化流程操作，输出格式固定，用命令更确定。
- 其他所有操作全部通过自然语言完成，Agent 根据 `lifecycle.json` 的当前阶段自动判断该做什么。

### 7.3 命令与自然语言分工

| 场景 | 用命令还是自然语言 | 原因 |
|------|-----------------|------|
| 需求梳理（PLANNING 阶段） | 自然语言 | "帮我把 docs/raw 里的文档整理一下" |
| 从规划进入开发 | `/go` | 标志性决策动作，有仪式感 |
| 开发具体页面 | 自然语言 | "帮我开发设备列表页" |
| 全量开发 | `/go` 或 "开始开发吧" | 两者等价，均进入批次调度 |
| 中断后续跑 | `/go` | 自动识别断点继续 |
| 检查完成度 | `/check`（或自然语言） | 标准化流程，命令更确定 |
| 日常改一个按钮 | 自然语言 | 一句话就够了 |
| 日常修 bug | 自然语言 | "订单详情页金额显示不对" |

### 7.4 按需加载机制

`.claude/commands/` 下的文件**只在用户主动触发时才加载**。用户不输入 `/go` 或 `/check`，Agent 的上下文里就完全没有这两个命令的详细逻辑。这从根本上解决了流程指令增长导致的上下文膨胀问题——**所有重型流程逻辑（调度规则、批次划分、重试策略）都写在 go.md 中，而不是 CLAUDE.md 中**。

```
上下文常驻（永远加载）：
  CLAUDE.md（< 50 行）

按需触发（用户输入时才加载）：
  .claude/commands/go.md      ← /go 时加载，含完整调度规则
  .claude/commands/check.md   ← /check 时加载

子代理专属（随子代理启动加载）：
  .claude/agents/vima-builder.md
  .claude/agents/vima-verifier.md
```

### 7.5 go.md 完整定义

```markdown
# /go 命令

## 触发条件
用户输入 /go，或在 DEVELOPING 阶段说"继续开发"。

## 执行流程

1. **状态检查与三道校验闸门**（产物质量不靠 Agent 自觉，见 13.1）
   - 读取 docs/lifecycle.json
   - 若 currentPhase = PLANNING：
     a. **第一道：机械校验（确定性，零 token）**——vima validate 按 validate.checklist.md 检查：
        产物结构完整（spec 八章齐全、契约接口五要素齐全）；
        引用闭环（spec 接口 ⊆ contracts、无孤儿契约、契约必有前后端任务成对引用、
        dependsOn 引用的 taskId 都存在）；
        taskStats 与 frontmatter 对账。不通过 → 输出缺失清单，终止 /go，交用户处置
     b. **第二道：语义抽查（Verifier 子代理，只读）**——抽样 2-3 个模块，对照 docs/raw/
        原文核对契约字段与 spec 章节是否遗漏/失真；发现问题回到 PLANNING 修补后重校验
     c. 两道通过且 tasksApproved = true（由 vima approve 机械置位，见 19.10）→ 切换为 DEVELOPING 并记录时间
   - 若 currentPhase = DEVELOPING：进入断点续跑模式（见步骤 4）

2. **任务分析（CLI 确定性，不劳 Agent 拓扑计算）**
   - 运行 `vima plan`：扫描全部任务 frontmatter，按 layer 与 dependsOn 拓扑排序，
     输出批次计划（.vima/reports/batch-plan.json），含环检测——发现依赖环即中止报错
   - 计划内容：批次 0 为所有 layer=shared 的任务（串行）；批次 1..N 为按 dependsOn
     拓扑分批的 layer=business 任务（批内并行）；批次末为 layer=pipeline 的顺序流水线
   - 主 Agent 照计划派发，**不自行计算批次划分**（确定性操作不留给概率性行为）

3. **批次调度（核心循环）**
   - 派发当前批次：在同一轮内为每个任务发起一个子代理调用（并行）
   - 等待本批全部返回结果摘要
   - 逐个处理结果：
     a. 成功且通过 Verifier → 任务状态置 done
     b. Verifier 不通过 → 重试（最多 2 次，见重试规则）
     c. 重试仍失败 → 任务状态置 failed，其后续任务置 blocked
   - 更新 lifecycle.json 的 taskStats 与任务文件 frontmatter
   - **批次检查点**：本批全部通过后执行 git commit（格式：vima: batch <N> completed），形成批粒度回滚点
   - **会话预算**：单次 /go 最多推进 3 个批次（或 8 个任务，先到为准），
     达标后落盘并提示用户再次 /go 续跑（避免主会话上下文过载，见 10.2）
   - 若还有未完成批次且未被阻断 → 派发下一批

4. **断点续跑**
   - 扫描任务 frontmatter，收集 done/failed/blocked/pending/running 状态
   - **running 孤儿处理**：发现 status=running 的任务一律视为上次会话中断遗留，
     重置为 pending 并在报告中说明（子代理是一次性委派，会话中断即失联，不存在"还在跑"的情况）
   - 向用户报告中断点：已完成 X 个、失败 Y 个、待执行 Z 个
   - 从第一个 pending 批次继续；failed 任务询问用户：重试 / 跳过 / 人工介入
   - 状态与报告不一致时，先运行对账（见 14.2 写入约定第 4 条）再继续

5. **完成处理**
   - 所有任务 done 且流水线通过 → 更新 lifecycle.json → MAINTAINING
   - 存在 failed/blocked → 保持 DEVELOPING，输出待处理清单
```

### 7.6 check.md 完整定义

````markdown
# /check 命令

## 触发条件
用户输入 /check。

## 完成度计算（客观信号为主）

1. **任务状态统计**：扫描 docs/tasks/*.md 的 frontmatter status 字段
2. **构建信号**：前端 npm run build:check 与 lint 结果；后端 mvn -q compile 结果
3. **验收清单**：统计各任务文件验收清单的勾选比例
4. **追溯对账**：`vima trace` 的标注数 / 野生标注 / 虚报嫌疑（A1 代码级追溯）
5. **任务点完成度**：聚合 .vima/reports/*-verifier.json 的 points——按钮·字段·连线级
   的真实完成度（v2.0.2，契约 §6.9）

## 深度检查（可选，仅当用户要求"深度检查"时）

抽样 2-3 个标记 done 的任务，派发 Verifier 子代理做语义比对，
验证"状态为 done 的任务是否真的完成"。此步骤昂贵，默认不执行。

## 输出格式

```
📊 项目完成度报告

总体完成度：75% (15/20 任务)

✅ 已完成（15）：用户管理、设备管理、订单管理 ...
🔄 进行中（2）：用户详情页（验收清单 80%）、设备详情页（60%）
❌ 失败（1）：订单详情页（重试 2 次未通过，报告：docs/tasks/order-detail.md）
⛔ 阻塞（2）：全量测试、代码审计（依赖订单详情页）

🔧 构建状态：tsc ✅ │ eslint ✅ │ mvn compile ✅

建议：处理订单详情页失败项后，输入 /go 继续
```
````

---

## 八、UI 框架集成方案

### 8.1 文档注入

- `CAPABILITY.md`：组件能力索引，Agent 第一站
- `<ComponentName>.md`：每个组件的最小示例 + 关键 API + 常见组合

### 8.2 脚手架调用

任务文件中显式声明脚手架命令，Agent 按命令生成骨架再填充业务逻辑。

### 8.3 约束锁定

- 页面结构以 spec 的 `vima:page` 数据块与线框原型为唯一真源（A2 单一真源裁定：
  任务文件不再手写组件树，V-TASK-05 机检）
- Hook 自动拦截直接从底层库导入的行为（post-write.sh，§10.5 第三道防线）
- CLAUDE.md 强制要求使用前必须读取组件文档

### 8.4 组件文档按需引用

`vima init` 扫描生成的组件文档可能有几十个文件，全部注入上下文会占掉大量窗口。因此：

- CLAUDE.md 中只写一行指令："使用组件前，必须先读取 `docs/ui-framework/CAPABILITY.md` 确认组件能力，再读取对应的 `<ComponentName>.md` 获取用法。"
- 组件文档**按需读取，不全量注入**
- 1 行指令替代 5000 行组件用法

### 8.5 CAPABILITY.md 示例

```markdown
# UI 组件能力索引

## 基础组件
- VButton: 按钮组件，支持 type/size/disabled/loading 属性
- VInput: 输入框，支持 v-model/placeholder/disabled 属性
- VSelect: 下拉选择，支持 options/multiple/filterable 属性

## 数据展示
- VTable: 表格组件，支持 columns/dataSource/loading 属性
- VPagination: 分页组件，支持 current/pageSize/total 属性

## 反馈组件
- VLayer: 对话框，支持 v-model/title/area 属性
- confirmAsync: 确认对话框函数，返回 Promise<boolean>

## 布局组件
- VLayout / VSide / VBody / VHeader

## 使用示例
详见各组件的单独文档文件
```

---

## 九、任务拆解设计

### 9.1 自包含任务文件

每个任务文件包含：元信息（frontmatter）、结构定义（后端为模块结构；前端页面任务经 `page` 字段引用 spec 数据块，不重复内联——A2）、字典值、数据接口引用、业务规则、验收清单、维护须知。**Agent 只看这一个文件加其引用的契约（前端页面任务再加当前页的 spec 数据块），就能完成开发。**

### 9.2 任务文件 frontmatter 规范

任务文件开头使用 YAML frontmatter 承载机器可读的调度信息，这是批次调度与状态管理的唯一数据源：

```yaml
---
taskId: device-list-fe
title: 设备管理列表页（前端）
status: pending          # pending | running | done | failed | blocked
layer: business          # shared | business | pipeline
side: frontend           # frontend | backend | fullstack
dependsOn: [shared-base, device-api-be]   # 依赖的任务 ID
retryCount: 0
contract: docs/contracts/device-api.md     # 引用的契约文件
page: PAGE-01                              # 前端页面任务引用 spec 页面块（A2，可选字段）
updatedAt: 2026-08-12T10:00:00Z
---
```

| 字段 | 说明 |
|------|------|
| `status` | 任务状态机（详见 14.3），**仅主 Agent 可写** |
| `layer` | 调度分层：shared=共享层（批次 0，串行）；business=业务层（批内并行）；pipeline=收尾流水线（串行） |
| `dependsOn` | 任务 ID 列表，调度器据此划分批次 |
| `contract` | 前后端任务必须引用同一份契约文件 |
| `page` | A2 单一真源：前端页面任务指向 spec 的 PAGE-xx 数据块；带此字段的任务 body 不得手写「页面结构/组件树」（V-TASK-05/06 机检） |

### 9.3 分步执行指令

任务文件正文声明执行步骤，每步有明确产出物和数量要求：

- **前端任务**：脚手架 → API 层 → 类型定义 → 组件层 → 业务逻辑 → 自检
- **后端任务**：Entity → Repository → Service → Controller → 单元测试 → 自检

### 9.4 维护须知（自解释设计）

任务文件不仅要告诉 Agent 怎么开发，还要告诉 Agent **怎么维护**：

```markdown
## 维护须知
- 此页面依赖设备管理 API（契约：docs/contracts/device-api.md）
- 表格列定义在 src/pages/DeviceList/columns.ts
- 搜索条件在 src/pages/DeviceList/SearchForm.vue
- 新增操作需在 columns.ts 中追加列定义
```

这样用户说"加一个列"，Agent 直接知道改哪个文件，不需要用户指定路径。

### 9.5 API 契约机制（前后端协同的核心）

admin 模板是前后端分离架构，前端任务与后端任务必须对齐接口定义。契约机制设计如下：

```
PLANNING 阶段：
  spec.md 中的接口定义 → 沉淀为 docs/contracts/<module>-api.md
                          ↓
DEVELOPING 阶段：        ├──▶ 后端任务（device-api-be）实现契约
                          └──▶ 前端任务（device-list-fe）按契约对接
```

**契约文件示例（docs/contracts/device-api.md）**：

```markdown
# 设备管理 API 契约

## GET /api/device/list
- 请求参数：{ name?: string, type?: string, status?: string, pageNum: number, pageSize: number }
- 响应：ApiResponse<PageResult<Device>>
- 错误码：40001 参数校验失败

## POST /api/device
- 请求体：DeviceCreateDTO（name 必填 2-50 字符，type 枚举 sensor/actuator/gateway）
- 响应：ApiResponse<Device>

## PUT /api/device/{id} / DELETE /api/device/{id} / POST /api/device/batch-delete
（同上格式）

## 共享类型定义
Device { id, name, type, status, createdAt, updatedAt }
```

**契约纪律**：

1. 契约文件是前后端任务的**唯一事实来源**，两端任务文件不得各自复制接口定义；
2. 开发过程中若需变更接口，**先改契约**，再同步修改引用它的任务文件，最后才能改代码；
3. Verifier 校验时以契约为准：后端 Controller 的路径/参数/响应必须与契约一致，前端 API 层封装必须与契约一致；
4. 契约变更由主 Agent 在 MAINTAINING 阶段或串行任务中执行，**并行批次的 Builder 不得修改契约**。
5. 契约文件文末附**YAML 结构化数据块**（接口清单：路径/方法/响应体字段表），作为原型表格列头渲染与对账的唯一字段提取源（见 13.3）；`vima validate` 校验其可解析性。契约 markdown 正文给人读、YAML 块给渲染层读，两者同文件维护、永不分离。

### 9.6 任务依赖关系与依赖图

**唯一权威是任务 frontmatter**（9.2 的 layer/dependsOn），批次划分由 `vima plan` 从 frontmatter 拓扑确定性生成（含环检测），主 Agent 不自行计算。`docs/tasks/README.md` 是**由 `vima sync` 从 frontmatter 确定性生成的人可读视图**（首行带「手改无效」生成标记），不参与调度决策；`vima doctor` 用同一生成器内存重建后字节比对两者一致性，漂移时用 `vima sync` 重建 README。

以 admin 模板的典型依赖图为例：

```markdown
# 任务依赖图

## 批次 0（共享层，串行）
- [ ] shared-base：请求封装、全局类型、基础布局组件（layer=shared）

## 批次 1（业务层，并行）
- [ ] device-api-be：设备管理后端（依赖：shared-base）
- [ ] user-api-be：用户管理后端（依赖：shared-base）
- [ ] order-api-be：订单管理后端（依赖：shared-base）

## 批次 2（业务层，并行）
- [ ] device-list-fe：设备列表页前端（依赖：shared-base、device-api-be）
- [ ] user-list-fe：用户列表页前端（依赖：shared-base、user-api-be）
- [ ] device-detail-fe：设备详情页前端（依赖：device-list-fe）

## 批次末（顺序流水线，串行，由 vima-builder 以流水线任务文件执行）
- [ ] full-test：全量测试（依赖：批次 2 全部完成）
- [ ] code-audit：代码审计（依赖：full-test 通过）
```

> **关于前端依赖后端**：示例采用保守默认——前端任务依赖对应后端任务完成（可联调真实接口）。由于契约在编码前已存在，也可将前端任务改为仅依赖 shared-base，基于契约并行开发，前后端联调放到收尾流水线。任务拆解时由用户与 Agent 在评审环节（6.4）确认采用哪种策略。

### 9.7 前端任务文件完整示例

```markdown
---
taskId: device-list-fe
title: 设备管理列表页（前端）
status: pending
layer: business
side: frontend
dependsOn: [shared-base, device-api-be]
retryCount: 0
contract: docs/contracts/device-api.md
page: PAGE-01
updatedAt: 2026-08-12T10:00:00Z
---

# 设备管理列表页

> **页面结构以 spec 中 `page: PAGE-01` 引用的 `vima:page` 数据块与线框原型
> （docs/review/prototype.html）为准**——布局区块、搜索条件、表格列、弹窗字段
> 均在数据块内定义（A2 单一真源：本文件不重复描述，V-TASK-05 机检）。
> 开工前先读：本页 `vima:page` 数据块 → 契约文件 → 共享层 CAPABILITY.md。

## 数据接口
以 docs/contracts/device-api.md 为准，禁止自行定义接口路径或字段。

## 业务规则
- 设备名称必填，长度 2-50 字符
- 删除前需二次确认（使用 confirmAsync）
- 批量删除最多 100 条

## 验收清单
- [ ] 搜索栏显示正确
- [ ] 表格列完整，分页功能正常
- [ ] 新增/编辑弹窗表单完整
- [ ] 删除需二次确认，批量删除功能正常
- [ ] 状态标签颜色正确

## 开发步骤
1. 生成页面骨架（src/views/DeviceList/）
2. 实现 API 层（src/api/device.ts，严格按契约）
3. 实现类型定义（src/views/DeviceList/types.ts，共享类型引自契约）
4. 实现组件层（对照本页 `vima:page` 数据块与原型，使用 @vima/ui，先读 CAPABILITY.md）
5. 实现业务逻辑（搜索、表单验证、错误处理）
6. 自检：对照验收清单 + npm run build:check + npm run lint

## 约束重申
- 禁止修改 src/components/、src/utils/、vendor/（共享层只读，同 template.json sharedDirs）
- 若确需修改共享层，在结果摘要中声明 sharedChangeRequest，不得直接改

## 维护须知
- 表格列定义：src/views/DeviceList/columns.ts
- 搜索条件：src/views/DeviceList/SearchForm.vue
- API 封装：src/api/device.ts
- 新增列：在 columns.ts 中追加列定义
```

### 9.8 后端任务文件完整示例

```markdown
---
taskId: device-api-be
title: 设备管理后端接口
status: pending
layer: business
side: backend
dependsOn: [shared-base]
retryCount: 0
contract: docs/contracts/device-api.md
updatedAt: 2026-08-12T10:00:00Z
---

# 设备管理后端接口

## 模块结构
- Entity：Device（对应 device 表）
- Repository：DeviceRepository（JPA）
- Service：DeviceService / DeviceServiceImpl
- Controller：DeviceController（路径严格按契约）
- DTO：DeviceCreateDTO / DeviceUpdateDTO / DeviceQueryDTO

## 实现要求
- 所有接口路径、参数、响应结构以 docs/contracts/device-api.md 为准
- 返回值统一使用 ApiResponse 包装
- 参数校验使用 jakarta.validation 注解（name: @NotBlank @Size(min=2, max=50)）
- 异常通过全局 ExceptionHandler 转换为契约定义的错误码

## 业务规则
- type 枚举校验：sensor/actuator/gateway
- 批量删除最多 100 条，超出返回 40002
- 删除前校验设备状态，维护中设备禁止删除（40003）

## 验收清单
- [ ] Controller 路径与契约完全一致
- [ ] 参数校验注解完整
- [ ] 错误码与契约一致
- [ ] Service 层单元测试覆盖核心业务规则

## 开发步骤
1. Entity + Repository
2. DTO + 校验注解
3. Service 层（业务规则实现）
4. Controller 层（严格按契约）
5. 单元测试（Service 层核心规则）
6. 自检：mvn -q compile 通过 + mvn -q test 通过

## 约束重申
- 禁止修改公共基础设施模块（common 模块只读）
- 若确需修改，在结果摘要中声明 sharedChangeRequest

## 维护须知
- Entity：backend/src/main/java/.../device/Device.java
- Controller：backend/src/main/java/.../device/DeviceController.java
- 新增接口：先改契约 docs/contracts/device-api.md，再改代码
```

---

## 十、编码开发阶段设计（批次驱动调度）

### 10.1 Claude Code 子代理能力的真实边界

调度模型必须建立在真实能力之上。以下是本框架依赖的 Claude Code 能力清单：

| 能力 | 支持情况 | 在本框架中的用法 |
|------|---------|----------------|
| 自定义子代理（`.claude/agents/*.md`） | ✅ | 定义 Builder/Verifier/Planner 角色模板 |
| 同一轮发起多个子代理调用 | ✅ 即并行执行 | 批次内并行 |
| 子代理完成后向主 Agent 返回结果摘要 | ✅ | 结果收集与状态判定 |
| 子代理拥有独立上下文 | ✅ | 上下文隔离 |
| 向运行中的子代理发送消息 | ❌ 不支持 | **不设计暂停/通知机制** |
| 暂停/恢复子代理 | ❌ 不支持 | **不设计暂停/恢复机制** |
| 事件监听/完成回调 | ❌ 不支持 | **主 Agent 轮次驱动，不监听** |
| hooks 拦截/检查工具调用 | ✅ PreToolUse/PostToolUse | 共享层写保护 + 写入后校验 |

**核心结论**：子代理是"一次性委派"模型——派发、独立执行、返回摘要，中间不可干预。所有调度逻辑必须由主 Agent 在**轮次之间**完成，而不是运行期间。

### 10.2 批次驱动调度模型（核心）

```
/go 触发（或断点续跑）
  ↓
轮次 1：主 Agent 读取 lifecycle.json，运行 vima plan 确定性产出批次计划
        （拓扑排序 + 环检测，主 Agent 不自行计算批次）
  ↓
轮次 2：派发批次 0（共享层，串行，一次一个 Task 调用）
        每个共享任务：Builder → Verifier → 状态更新
  ↓
轮次 3：派发批次 1（业务层，同一轮内发起 N 个 Task 调用 = 并行）
        等待本批全部返回摘要
  ↓
轮次 4：主 Agent 处理批次 1 结果：
        - 逐个派发 Verifier 校验（可并行）
        - 通过 → status=done；不通过 → 重试流程（10.6）
        - 更新任务文件 frontmatter 与 lifecycle.json
  ↓
轮次 5+：重复轮次 3-4，直到所有批次完成
  ↓
收尾：派发 pipeline 批次（全量测试 → 代码审计，串行）
  ↓
全部通过 → lifecycle.json 切换 MAINTAINING → 输出完成报告
```

**模型要点**：

1. **并行 = 同一轮内多个 Task 调用**，不是后台进程。主 Agent 发起后等待全部返回，天然形成屏障（barrier），无需任何同步机制。
2. **批间即检查点**：每批结束都落盘状态，任何时刻中断都能从 lifecycle.json 与任务 frontmatter 恢复。
3. **主 Agent 不做重活**：它只读状态、派发任务、处理摘要、更新状态，自己不写业务代码。
4. **批内并行度上限**：单批建议不超过 5 个 Builder，超出时拆成多个子批次顺序派发，避免资源争抢与输出混乱。
5. **编排会话短程化**：主 Agent 自己的上下文也会随批次推进累积（go.md 规则 + 所有子代理摘要），编排者本身必须按会话预算策略控制长度（见下）。

**编排会话预算**：子代理上下文已隔离，但编排者的上下文会单调增长——每完成一个任务就多一份 Builder 摘要 + Verifier 报告（重试时翻倍）。以 18 个任务估算，一次完整 /go 会在主会话累积 40+ 份返回文本，主 Agent 很可能中途先触及上限。对策（利用批间检查点特性）：

| 策略 | 做法 |
|------|------|
| **单次 /go 批次预算** | 单次会话最多推进 3 个批次（或 8 个任务，先到为准），达标后主动落盘并提示："本会话已完成 X 个任务，请再次输入 /go 继续" |
| **续跑即新会话** | 批间状态已全部落盘（frontmatter + lifecycle.json + reports/），新会话 /go 从断点恢复零损耗 |
| **摘要只留结论** | 主 Agent 只提取状态与关键结论写入文件，不在回复中复述细节 |
| **兜底信号** | 主 Agent 输出被截断或行为异常时，用户随时可中断并在新会话 /go 续跑——状态不会丢失 |

### 10.3 两种任务场景

#### 场景一：业务模块并行开发

多个页面/模块之间没有代码层面的依赖，按 `dependsOn` 拓扑分批后批内并行。每个 Builder 子代理的上下文里只有：

```
包含：                        不包含：
1. 角色模板（vima-builder.md） - spec.md（不需要全局需求）
2. CLAUDE.md（< 50 行）        - 其他任务文件
3. 当前任务文件                - 其他 Builder 的进度
4. 当前任务引用的契约文件
5. 相关组件文档（按需读取）
```

#### 场景二：顺序流水线开发

收尾阶段的任务有严格先后关系（全量测试 → 代码审计），串行执行，步骤间通过文件系统传递产出物：

| 设计点 | 说明 |
|--------|------|
| **步骤间文件通信** | 上一步的产出（测试报告等）写入文件系统，下一步读取，不依赖共享上下文 |
| **前置条件检查** | 下一步启动前，主 Agent 验证上一步产出物是否齐全 |
| **失败阻断** | 上一步失败则后续步骤不执行，报告主 Agent |
| **上下文隔离** | 每个步骤的子代理只加载当前步骤需要的信息 |
| **执行留痕** | 每步产出同时落盘 `.vima/reports/`，供下一步读取与事后审计（见下） |

**执行留痕与批后 Git 检查点**：子代理的结构化结果不能只通过返回值流转（会话中断即丢失，重试也失去依据），必须落盘：

- Builder 摘要写入 `.vima/reports/<taskId>-builder.json`，Verifier 报告写入 `.vima/reports/<taskId>-verifier.json`（含轮次号）；重试 prompt 从磁盘读取上一轮报告，而非依赖会话记忆
- **每个批次全部通过验收后，主 Agent 执行一次 git commit**（消息格式：`vima: batch <N> completed (k tasks)`），形成批粒度回滚点；某批产出整体错误时可整批回退重跑

### 10.4 子代理上下文隔离

| 子代理类型 | 常驻上下文 | 按需加载 | 禁止加载 |
|-----------|-----------|---------|---------|
| **Builder** | 角色模板 + CLAUDE.md | 当前任务文件 + 契约 + 组件文档 + 当前页 `vima:page` 数据块（A2：按 page 字段只载本页） | 其他任务文件、spec 其余章节与其他页数据块 |
| **Verifier** | 角色模板 + CLAUDE.md | 任务文件 + 契约 + 相关代码 | 业务需求细节 |
| **Planner** | 角色模板 | docs/raw/ + spec 模板 | 编码规范、组件文档 |
| **主 Agent** | CLAUDE.md + lifecycle.json + README 依赖图 | go.md（/go 触发时） | 代码细节 |

**上下文大小对比**：

```
单 Agent 全量模式：              批次驱动 + 子代理隔离：
── spec.md（页面级粒度，500-1000行）              每个 Builder：
── 15个任务文件（750行）          ── 角色模板（~30行）
── 组件文档索引（1500行）         ── CLAUDE.md（<50行）
── 编码规范（200行）              ── 当前任务文件（~100行）
── 业务规则（300行）              ── 契约文件（~50行）
→ 总计约 3000 行，严重膨胀        ── 组件文档（按需，~100行）
                                  → 总计约 330 行，始终可控
```

### 10.5 五道防线

| 防线 | 执行者 | 说明 |
|------|--------|------|
| **第一道：分步执行** | Builder 子代理 | 每步有明确产出物，按固定顺序执行 |
| **第二道：独立 Verifier** | Verifier 子代理 | 对照验收清单与契约逐项校验，只读权限。避免"自己检查自己"的偏差 |
| **第三道：Hook 强制校验** | 自动钩子 | PreToolUse 拦截共享层写入；PostToolUse 检查导入规范、类型定义 |
| **第四道：完成定义** | Builder 自检 | 验收清单全勾 + tsc/eslint 零错误（前端）或 mvn compile/test 通过（后端） |
| **第五道：主 Agent 汇总** | 主 Agent | 收集所有结果，确认依赖满足、无遗漏任务，最终批准进入下一批 |

### 10.6 失败重试与降级

```
Builder 返回摘要 → 主 Agent 派发 Verifier → 发现缺失
  ↓
重试（retryCount + 1，最多 2 次）：
  主 Agent 重新派发 Builder，prompt 进入"增量修复模式"：
  - 明确告知：代码已存在，只修复以下问题，不要重写
  - 附 Verifier 校验报告（从 .vima/reports/<taskId>-verifier.json 读取，哪些项缺失/不符）
  - 附当前相关文件清单
  ↓
再次提交 Verifier
  ↓
2 次重试仍不通过：
  - 任务状态置 failed，retryCount=2
  - 其 dependsOn 链上的后续任务置 blocked
  - 其他无依赖关系的批次继续执行（不因单点失败全线停止）
  - 最终报告中列出失败项，等待用户决策：
    a. 人工修复后手动将状态改回 pending，再 /go 续跑
    b. 说"重试订单详情页"让 Agent 再试一轮
    c. 说"跳过订单详情页"解除阻塞继续（主 Agent 评估影响后执行）
```

### 10.7 共享依赖处理：架构预防策略

v1.0 曾设计"运行时监听 Builder 变更 → 暂停依赖方 → Git 合并同步"的机制。该机制依赖了不存在的能力（向运行中的子代理发消息、事件监听），且让子代理自主做 Git 合并冲突解决风险极高。**v2.0 改为架构预防策略：让共享依赖冲突根本不会发生。**

#### 策略一：共享层前置（批次 0）

将所有可能被多个业务任务共用的代码归入共享层任务，在批次 0 串行完成：

```
共享层任务示例（shared-base）：
- 前端：request 封装、全局类型定义、基础布局组件、通用 hooks
- 后端：common 模块、ApiResponse 包装、全局异常处理器、基础 Entity

时序：批次 0 完成并验收 → 业务批次启动 → 业务 Builder 对共享层只读
```

#### 策略二：写保护（PreToolUse Hook + 令牌）

```
机制：
- .claude/hooks/guard-shared.sh 注册为 PreToolUse hook（matcher: Write|Edit）
- 默认拦截对共享目录的写入（exit 2 阻断并提示原因）；共享目录以
  template.json sharedDirs 为单一真源（v2.0 实现裁定，以骨架真实目录为准）：
    前端：src/components/、src/utils/、vendor/
    后端：backend/.../config/、backend/.../security/
- DEVELOPING 阶段同一令牌机制追加保护 docs/contracts/**（9.5 契约纪律 4：
  并行批次中 Builder 不得改契约；PLANNING/MAINTAINING 不拦）
- 主 Agent 派发共享层任务前，写入令牌文件 .vima/shared-write-token（含过期时间）
- hook 检测到有效令牌 → 放行；令牌失效或不存在 → 拦截
- 共享层任务完成后，主 Agent 删除令牌
```

共享层任务串行执行，因此令牌机制不存在并发歧义；业务批次并行时没有令牌，hook 对所有 Builder 一视同仁地拦截。

> **保护边界声明**：hook 的 matcher 仅覆盖 Write/Edit 工具通道，防的是**误伤**；Bash 通道（如 `sed -i`、重定向写入）不在 matcher 内，不构成严格边界，由 settings.json 的 deny 清单与 CLAUDE.md 红线兜底（16.3）。本机制定位为“防误不防恶意”，实现与对外描述时不得宣称其为完全写保护。

#### 策略三：变更需求走串行补偿

业务 Builder 若开发中发现确需修改共享层：

1. **不得直接修改**（hook 也会拦住）；
2. 在结果摘要中声明 `sharedChangeRequest`：需要改什么、为什么改、影响范围；
3. 主 Agent 收到后创建一个**共享层补偿任务**（layer=shared），插入到当前批次结束后串行执行；
4. 补偿任务完成并验收后，受影响的任务若在后续批次则正常继续；若已完成，主 Agent 评估是否需要对其派发 Verifier 复查。

#### 策略四：维护期共享层变更

进入 MAINTAINING 阶段后，用户可能提出合法的共享层修改需求（如"给 request 封装加个拦截器"）。此时没有批次 0 的令牌流程，规则为：

1. 主 Agent 先确认变更意图确实指向共享层目录（结合任务文件维护须知定位）；
2. 确认后**先写入 `.vima/shared-write-token`**（含过期时间），再执行修改，完成后立即删除令牌；
3. 修改完成后对相关调用方运行自检命令，确认无破坏性影响。

#### 四道策略的对比总结

| 策略 | 解决的问题 | 执行时机 |
|------|-----------|---------|
| 共享层前置 | 绝大多数共享代码在并行开始前就已就绪 | 批次 0 |
| 写保护 Hook | 防止业务 Builder 意外破坏共享层 | 全程 |
| 串行补偿 | 处理开发期前置阶段无法预见的共享层变更需求 | 批间 |
| 维护期令牌 | 维护期合法的共享层变更不被误拦 | MAINTAINING |

### 10.8 子代理角色模板

`.claude/agents/` 目录下固定三个文件，由 `vima init` 生成。流水线批次任务（full-test/code-audit）在 v2.0 中不单独设角色，由 vima-builder 以 `layer=pipeline` 的任务文件执行（Tester/Auditor 专职角色见 v2.3.0 计划）。

#### vima-builder.md

```markdown
---
name: vima-builder
description: 业务模块开发子代理，根据任务文件完成前端页面或后端接口开发
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

你是一个全栈业务开发专家。被委派任务时：

1. 读取被指定的任务文件（docs/tasks/xxx.md）
2. 若任务引用了契约文件，先读取契约
3. 按任务文件中的分步指令逐步完成开发
4. 使用 @vima/ui 组件前必须先读取 docs/ui-framework/CAPABILITY.md
5. 每一步完成后对照验收清单自检
6. 全部完成后执行自检命令（前端：build:check + lint；后端：mvn compile + test）
7. 将结构化结果摘要写入 .vima/reports/<taskId>-builder.json（落盘留痕，重试与审计的依据）
8. 在返回消息中输出同一份 JSON 摘要

约束：
- 严格遵循 CLAUDE.md 中的编码规范
- 不得跳过任务文件中的任何步骤
- 禁止修改共享层目录；确需修改时在摘要中声明 sharedChangeRequest
- 增量修复模式下只修改报告指出的问题，不得重写已有代码
- 前端页面任务：对照 spec 当前页的 YAML 数据块开发，区块结构与组件清单必须与设计一致（Verifier 按 prototype.manifest.json 对账，见 13.3）

结果摘要格式：
{ "taskId": "...", "status": "completed|failed",
  "files": ["..."], "acceptance": { "total": N, "passed": N },
  "sharedChangeRequest": null, "notes": "..." }
```

#### vima-verifier.md

```markdown
---
name: vima-verifier
description: 任务验收子代理，对照验收清单与契约逐项校验，只读不写
tools: Read, Grep, Glob, Bash
model: sonnet
---

你是一个严格的验收工程师。被委派校验任务时：

1. 读取任务文件与契约文件
2. 对照验收清单逐项检查代码实现（只读，绝不修改代码）
3. 对照契约检查接口路径、参数、响应结构的一致性
4. 前端页面任务：区块标记（data-page/data-block/data-modal）机检先行（13.3 hook 半），
   再把 prototype.manifest.json 该页条目逐点展开为 points（每个 item/rowAction/
   modal field/link 各一条）逐点判定并给证据——语义判断力集中在标记覆盖不到的
   业务规则、字段映射与交互行为（v2.0.2，契约 §6.9）
5. 将校验报告写入 .vima/reports/<taskId>-verifier.json（含轮次号，落盘留痕，
   供 Builder 增量修复与 /check 任务点完成度聚合读取）
6. 在返回消息中输出同一份报告

校验报告格式（points 为带 page 任务必填，逐任务点判定）：
{ "taskId": "...", "round": 1, "result": "pass|fail",
  "checklist": [{ "item": "...", "passed": true, "evidence": "文件:行号" }],
  "points":    [{ "point": "toolbar/新增 → modal MODAL-01", "passed": true, "evidence": "文件:行号" }],
  "missing": ["..."], "contractViolations": ["..."] }

原则：宁可误报不可漏报。找不到明确证据实现的项，一律判为未通过。
```

#### vima-planner.md

```markdown
---
name: vima-planner
description: 需求梳理子代理，阅读原始文档并协助生成规范与任务文件
tools: Read, Write, Edit, Grep, Glob
model: opus
---

你是一个资深产品经理。职责是阅读 docs/raw/ 下的原始文档，
提取业务信息，协助生成 spec.md、契约文件与任务文件。
不写任何业务代码。
```

### 10.9 角色总结

| 角色 | 职责 | 上下文大小 | 并行性 |
|------|------|-----------|--------|
| **主 Agent** | 读状态、划批次、派发、处理摘要、更新状态 | 极小 | 串行（轮次驱动） |
| **Builder** | 按任务文件完成模块开发 | ~330 行 | 批内并行（≤5） |
| **Verifier** | 对照清单与契约校验，只读 | ~200 行 | 可并行校验不同任务 |
| **Planner** | PLANNING 阶段文档整理 | 按需 | 不参与开发调度 |

---

## 十一、上下文管理策略

### 11.1 问题本质

Agent 的上下文窗口是有限的。如果所有流程指令都自动注入上下文，膨胀曲线是：

```
项目创建阶段：  3 个流程文件  → 上下文占用小，工作良好
开发阶段：     15 个流程文件 → 上下文开始紧张
维护迭代阶段：  50+ 个流程文件 → 上下文爆炸，Agent 开始"遗忘"和混淆
```

**根本原因：把"所有阶段可能需要的所有指令"同时塞进了一个上下文里。**

### 11.2 核心原则

> **只有当前阶段必须遵守的规则才常驻上下文，其余一切按需加载。**

常驻上下文只有三类：

| 类型 | 内容 | 为什么常驻 |
|------|------|-----------|
| **项目宪法** | `CLAUDE.md`（< 50 行） | 每次操作都要遵守的红线 |
| **生命周期指针** | CLAUDE.md 中的一行协议 | Agent 启动即读 lifecycle.json |
| **能力索引** | CAPABILITY.md 的引用指针 | Agent 需要知道去哪查组件 |

其余一切——调度规则（go.md）、校验流程（check.md）、组件详情、任务内容、契约——**全部按需读取**。

### 11.3 四个落地手段

| 手段 | 做法 | 效果 |
|------|------|------|
| **命令替代 Skill** | 流程逻辑放 `.claude/commands/`，触发才加载 | 上下文里永远只有触发时的 1 个命令文件 |
| **CLAUDE.md 只留红线** | 详情放 docs/，宪法只放指针（5.4 体量保护） | 常驻 < 50 行 |
| **按阶段加载** | PLANNING 读原始文档，DEVELOPING 读任务+契约，MAINTAINING 读相关文件 | 阶段天然隔离 |
| **组件文档按需** | CLAUDE.md 一行指令 + CAPABILITY.md 索引 + 单组件文档 | 1 行指令替代 5000 行用法 |

### 11.4 子代理上下文隔离（叠加收益）

批次驱动模型不仅按阶段隔离，还按**角色**和**任务**隔离（详见 10.4）：即使项目有 50 个任务、100 个组件文档，每个子代理的上下文始终控制在约 330 行以内，主 Agent 的上下文始终只有状态与依赖图。

---

## 十二、自然语言优先开发模式

### 12.1 核心设计原则：初始化"重"，日常"轻"

```
项目初始化（一次性）：
  vima create my-project
  vima init
  （自然语言对话整理文档、梳理需求）
  /go                    ← 唯一需要记住的"启动"命令
  （批次驱动调度：共享层串行 → 业务并行 → 流水线收尾）
  /check                 ← 可选，随时检查进度
  ↓
  一切就绪，进入日常开发模式

日常开发（自然语言，零命令）：
  "帮我在设备列表页加一个批量删除按钮"
  "订单管理页面的搜索条件再加一个时间范围"
  "修复订单详情页金额显示不对的问题"
```

### 12.2 Agent 的"智能路由"

```
用户输入："帮我在设备列表加一个批量删除"

Agent 内部流程：
1. 读取 lifecycle.json → MAINTAINING 阶段
2. 理解意图 → 定位 docs/tasks/device-list-fe.md（维护须知指明相关文件）
3. 读取契约 → 发现契约中已定义 POST /api/device/batch-delete
4. 执行修改 → 前端补按钮与调用；若后端缺失则按契约补齐
5. 自动校验 → PostToolUse hook 检查 + lint
6. 回复用户 → "已加好，设备列表页新增了批量删除按钮"
```

### 12.3 对框架设计的具体影响

| 影响 | 实现 |
|------|------|
| **CLAUDE.md 充当上下文锚点** | "收到开发需求时，先定位 docs/tasks/ 下相关任务文件，再执行修改" |
| **任务文件自解释** | 维护须知指明每类修改的目标文件（9.4） |
| **流程文件不常驻** | go.md/check.md 只在触发时加载 |
| **跨会话连续性** | 依赖文件系统（lifecycle.json + checkpoint + 任务状态），不依赖对话记忆 |

### 12.4 最终的用户体验画像

#### 初始化（第一次）

```bash
npm i -g @vima-tech/cli
vima create my-project
vima init
claude

# PLANNING 阶段：全程自然语言，零命令
用户：帮我把 docs/raw 里的文档整理一下，梳理出这个系统的完整需求
Agent：（阅读原始文档，逐步整理，每个里程碑落盘检查点）
用户：这个模块的字段不对，应该是...
Agent：（修正 spec.md 与对应契约）
用户：差不多了，任务也拆好了吗？
Agent：是的，spec.md、4 份契约文件和 18 个任务文件都已生成。

# 正式进入开发
用户：/go
Agent：（批次 0：共享层 → 批次 1：3 个后端接口并行 → 批次 2：前端页面并行 → 收尾流水线）
Agent：所有任务已完成，项目进入 MAINTAINING 阶段。
```

#### 日常开发（之后每次，零学习成本）

```
用户：帮我在设备列表加个批量删除
Agent：已搞定。设备列表页新增了批量删除按钮，后端接口按契约对接完成。
```

**用户只需要记住一个命令：`/go`。其余一切，说人话。**

---

## 十三、规范产物工程与人机对齐

> 本章内容（产物可靠性、审计视图、原型引擎、对齐同步、成本预期）自本次修订起从“自然语言优先开发模式”章独立成章：它们构成框架的**人机对齐保障体系**，与第十二章的日常交互模式分属不同关注点。

### 13.1 规范产物的可靠性机制（PLANNING 质量保障）

PLANNING 产物（spec / contracts / tasks）是后续全部开发的事实来源，其质量风险不能留给 Agent 概率性行为。核心思路：**把"产物质量"从"Agent 写得好不好"转化为"文件结构 + 校验闸门是否通过"**。四道手段：

| 手段 | 防的问题 | 执行者 |
|------|---------|-------|
| **骨架先行** | 自由发挥导致的漏章、跑题、格式漂移 | 模板骨架（vima 资产），Agent 只填充不创作 |
| **即时机械校验** | 产物坏了拖到 /go 才发现；长文档截断 | validate.checklist.md 逐项检查，每份产物落盘后立即执行 |
| **覆盖矩阵** | 需求遗漏在多轮整理中被静默丢弃 | coverage-matrix.md 三列对齐，缺口行醒目标记 |
| **语义抽查** | 机械校验查不出的"内容失真" | 独立 Verifier 子代理，对照 raw/ 原文抽样核对 |

**骨架先行**：`vima init` 安装的 spec 骨架（admin 为七章结构）在 PLANNING 开始时复制为 `docs/spec.md`，每章预置标题、必填要素标注与填写提示。Agent 的工作从"创作一份文档"降级为"逐章填空"，漏章在结构上即刻可见；每章写完即落盘并更新 checkpoint，天然支持跨会话断点续写，长文档截断风险降为单章级别。

**机械校验清单（validate.checklist.md，模板资产）**：以 admin 模板为例，至少覆盖：

- spec.md：七章齐全；数据模型每个实体含字段表；每个枚举/字典列出全部取值；接口清单与契约一一对应；**每个页面含页面级粒度四要素**（布局拆分/组件清单/交互设计/接口映射，YAML 数据块可解析）；**布局使用枚举区块词表，跳转目标与弹窗 ID 存在且唯一**；角色章节含菜单权限清单且无权限盲区
- contracts/*.md：每个接口含路径/方法/请求体/响应体/错误码五要素；错误码枚举化；**文末 YAML 结构化数据块可解析**（原型表格列头的提取源，见 9.5 与 13.3）
- tasks/*.md：frontmatter 七字段齐全；每个任务有验收清单；contract 引用存在
- 交叉引用：接口 ⊆ 契约、无孤儿契约、契约前后端任务成对、dependsOn 闭包完整

**覆盖矩阵（coverage-matrix.md）**：三列对齐——原始需求条目（来自 raw/）→ 承接接口/契约 → 承接任务。评审时用户核对矩阵即可确认"没有需求被遗漏"；存在缺口行（无接口或无任务承接）时禁止置 tasksApproved。

**三道校验闸门**（在 /go 前置检查中依次执行）：

1. **机械校验**：vima validate（CLI 确定性检查，零 token 消耗），对应第一道
2. **语义抽查**：派发 vima-verifier 子代理（只读），抽样核对产物与 raw/ 原文一致性，对应第二道
3. **用户评审**：在浏览器打开审计视图（13.2）核对完整性 + 点击原型（13.3）体验布局与交互 + 覆盖矩阵 + 任务汇总表，对应第三道

**失败处置**：任一道不通过即回到 PLANNING 修补对应产物并重校验；禁止带伤进入 DEVELOPING。校验结果写入 `.vima/reports/planning-validation.json` 留痕。

**用户评审的载体**：第三道闸门的用户评审在浏览器中对照**人类审计视图**（13.2）与**线框原型**（13.3）进行，而非阅读 markdown——完整性（角色权限、功能点、流程）看审计视图，体验（布局手感、交互走向）点原型，审核成本与遗漏风险同时降低。

对非 admin 模板：各模板在 `planning/validate.checklist.md` 中声明自己的结构与引用规则（如 cli 模板校验命令清单与退出码定义），CLI 核心不需要任何改动。

**风险声明：确定性渲染会忠实放大上游错误**。渲染器只保证“忠实呈现”，不保证“内容正确”——YAML 填充错误会被审计视图与原型以 100% 保真度渲染出来，且正式的产物形态反而会增强人类对错误内容的信任。内容正确性只能靠以下三道机制兜底，它们是对齐体系（13.3）最薄弱的一环，投入不得节省：

| 机制 | 做法 |
|------|------|
| **信息源分级** | 填充信息源的优先级：raw/ 原文 > 用户对话中的口头确认 > Agent 推断。**默认禁止推断**：信息缺失时向用户提问而非脑补；用户暂时无法拍板的，推断项在 YAML 块中标记 `pendingConfirm`，评审闸门时批量确认，未确认的推断项不得置 tasksApproved |
| **语义抽查强化** | 覆盖率策略：每个模块至少抽 1 处；超过 10 个页面的项目页面样本覆盖率 ≥ 30%；**所有 pendingConfirm 推断项全检**。修补-重抽闭环：发现问题回到 PLANNING 修补后，对失败模块重新抽查直至通过；抽查明细写入 `.vima/reports/planning-validation.json` |
| **评审闸门** | 用户在审计视图与原型中逐页核对（13.2/13.3）+ 覆盖矩阵缺口检查 + `vima approve` 机械确认（见 19.10） |

### 13.2 人类审计视图（HTML 产物）

规范产物的读者有两类：AI 照着施工，人照着拍板。让人类阅读几十页 markdown 做 /go 决策成本高、易漏细节——尤其是角色权限、页面布局这类需要"一眼看全"的信息。参考 PACT 项目的交付设计，引入**双轨产物**：

- `docs/*.md`：给 AI 施工——切片好检索、frontmatter 结构化
- `docs/review/index.html`：给人交付审核——网页优先的正式规格书，整合 PRD/SDD/SPEC 职能，不拆成多份文档

**渲染原则（承袭 PACT）**：

| 原则 | 做法 |
|------|------|
| **确定性渲染** | CLI 构建期渲染（模板资产 `audit-view.mjs`）；不嵌生成时间戳，同一份 spec 输入生成字节一致，`--check` 可验证 HTML 与 spec 无漂移 |
| **单文件零外部请求** | 样式全部内联，file:// 双击即开，审核方不需要安装任何东西 |
| **禁 JS 完整可读** | 粘性目录、悬停预览、明暗主题等交互仅为渐进增强 |
| **ID 交叉引用** | 角色/菜单/页面/接口/流程均带稳定 ID（ROLE-xx/MENU-xx/PAGE-xx/FLOW-xx），视图间悬停预览与跳转 | 

**数据来源**：spec.md 是唯一事实来源。角色、菜单、流程章节与页面级粒度均附**结构化数据块**（YAML 围栏块，骨架预置格式），渲染器提取这些块生成视图；markdown 与 HTML 永不分别维护，漂移由 `vima validate` 与 `render-review --check` 检出。

**admin 模板的四个视图**（对应人类审核的四个维度，均为骨架强制内容）：

1. **角色权限视图**：精准拆分角色——共几种角色、每种角色有几种菜单权限；角色 × 菜单矩阵，无任何角色覆盖的菜单醒目提示（权限盲区）
2. **菜单功能点视图**：每个菜单页面实现哪些业务流程上的功能点；菜单 × 功能点表，每个功能点链接到接口与契约
3. **业务流程串联视图**：通过业务流程和角色串联页面操作流程——每条核心流程一条泳道：哪个角色从哪个页面进入 → 点哪个按钮 → 触发哪个接口 → 跳转哪个页面
4. **页面 UI 详情视图**：每页一张卡——布局结构（区块拆分：顶部搜索区/表格区/操作区）、组件清单（搜索框/表格/功能按钮/弹窗及位置布局）、交互设计（触发条件/反馈/状态流转）、对应接口与字段映射

**粒度即门槛**：审计视图不是装饰品，而是"规范必须细致到程序员可直接开发"这一要求的验收呈现——页面级粒度四要素（布局/组件/交互/接口）缺任何一项，机械校验即失败，也就渲染不出对应视图。非 admin 模板在 planning 配置中声明自己需要的视图（如 cli 模板只渲染命令清单视图），渲染器按配置渲染，CLI 核心零改动。

**人审增强（v2.0.2，契约 §11）**：审计视图头部渲染固定的**审核指引**（四步审核动线 +
「发现问题 → 让 Agent 改 spec 重渲染，不在文档外口头拍板」）；全部 `pendingConfirm: true`
条目渲染「⚠️ 待确认」徽标并汇总为**待确认清单**区（数量入封面统计，清零前 approve 阻断）
——AI 推断项对人眼可见，人类的审核注意力被引导到最高风险处。

### 13.3 原型引擎（人机对齐产物）

**目的**：原型不是演示稿，而是让人类与 AI 对齐设计意图的体验载体，也是开发期实现对账的基准。框架的核心保障是人机信息对齐（见 1.2）：人知道 AI 要建什么，AI 知道人要什么，实现能与设计机械对账——任何一环的信息差都是返工与故障的源头。

**同源四投影**（spec 的 YAML 结构化数据块为唯一源）：

| 投影 | 产物 | 读者 | 回答 |
|------|------|------|------|
| 施工基线 | spec.md YAML 数据块 | AI（Builder） | 建什么 |
| 审计视图 | docs/review/index.html | 人 | 权限/功能/流程**全不全** |
| 线框原型 | docs/review/prototype.html | 人 | 布局/交互**是不是我想要的** |
| 机器基线 | docs/review/prototype.manifest.json | Verifier（语义对账）→ v2.1.0 区块标记确定性对账 | 实现**对不对齐**设计 |

**独立渲染与 token 控制**：

- **渲染零 token**：`vima render-prototype` 由 CLI 独立执行（模板资产 prototype.mjs，与 audit-view.mjs 共用 YAML 提取层），全程无 Agent 参与，不占对话上下文
- **AI 从不读 HTML**：对齐对账只读 prototype.manifest.json（紧凑结构化基线），不读原型页面；人类产物与机器产物各取所需，互不消耗对方预算
- **Builder 只载当前页**：前端页面任务只加载本页的 YAML 块（任务本身所需），不加载全量 spec 与原型

**渲染原则**（承袭审计视图，一处按原型目的调整）：确定性渲染（不嵌时间戳、字节一致、`--check` 验漂移）、单文件零外部请求、ID 交叉引用（PAGE-xx/MODAL-xx）、**禁 JS 降级为平铺视图**——原型的核心价值是交互体验，无 JS 时降级为全部页面线框的平铺清单（每页一卡、PAGE-xx 锚点）保证可读；跳转/弹窗/回放等交互为 JS 渐进增强，而非像审计视图那样要求禁 JS 后内容完整。

**线框表达（刻意无样式，只展示功能与布局）**：

- 组件均为语义占位符：输入框=带标签边框盒、按钮=标签按钮、表格=列头+占位行、弹窗=遮罩层；灰盒+虚线边框，无视觉装饰
- 布局区块用枚举词表：toolbar/search/table/form/cards/tabs/pagination，区块顺序即页面布局顺序
- 表格列头直接取自**契约响应体字段**（提取自契约文件的 YAML 结构化数据块，见 9.5 契约纪律第 5 条）——原型的数据结构与接口契约天然对齐，且契约 YAML 块是渲染层的唯一字段来源，不存在第二事实源
- 交互限定三种：跳转（锚点 `#page-PAGE-xx`，契约 §11 裁定的锚点格式）、开弹窗（MODAL-xx）、接口标注（契约引用）；不做完整状态机仿真
- 流程演示模式：业务流程串联视图的泳道可逐步回放为页面跳转，把每条核心流程"走一遍"
- **管理后台外壳（v2.0.2，契约 §11）**：左侧粘性侧边栏渲染菜单树（真实系统的导航结构），
  每个菜单带可见角色徽标；头部「角色视角」chips 点选后淡出该角色不可见的菜单与页面
  （JS 渐进增强；noscript 时徽标静态可读）——人类按「我是某角色 → 看到哪些菜单 →
  点进去是什么页 → 每个按钮做什么」的真实动线走查设计

**开发期对齐（spec → 原型 → 代码）**：

- Builder：前端页面任务对照当前页的 YAML 数据块与原型布局开发，区块结构与组件清单必须与设计一致（见角色模板职责）
- Verifier：页面任务额外对照 prototype.manifest.json 校验实现页面的区块结构、组件清单与跳转连线，不一致记入校验报告 fail
- **对账性质澄清与机械化路径**：Verifier 的 manifest 对账原为**语义级对账**（LLM 理解代码后比对）。机械化路径的 **hook 半已于 v2.0.2 落地**（契约 §11/§14）：约定前端页面根组件输出区块标记（`data-page="PAGE-xx"`、每个 layout 区块容器 `data-block="<词>"`、每个弹窗挂载点 `data-modal="MODAL-xx"`），post-write hook 在写入时按 manifest 逐项机检（缺失/多余/未知页面 → exit 2 当场反馈 Builder）；Builder 角色模板与前端任务模板已强制落标记，Verifier 的语义判断力聚焦标记覆盖不到的内容（业务规则/字段映射/交互行为）。构建期脚本全量扫描仍列 v2.1.0
- 意义：页面级粒度从"开发前审核材料"升级为"开发中可对账的验收基准"——人机对齐不是开发前的一次性确认，而是贯穿开发的持续不变量

**边界**：

- **保真度边界**：只表达功能与布局语义，不表达视觉层级与间距美学；视觉设计留给开发期 @vima/ui，也防止审核者被样式分心
- **交互边界**：仅三种交互，多步表单与复杂状态机不仿真，避免 YAML 填写成本陡增
- **模板边界**：admin/h5 适用；无页面概念的模板（cli/script/lib）声明 `prototype: false`，渲染器跳过

### 13.4 维护期对齐同步闭环

对齐体系不能止步于 /go。MAINTAINING 阶段每天都在产生变更，若改完代码后 spec、原型、manifest 不同步，对齐就退化为 PLANNING 阶段的一次性快照，Verifier 的对账基线即刻过期——这与 1.2 的核心主张直接矛盾，因此维护期同步是闭环的必需一环。

**同步规则（变更传播顺序）**：MAINTAINING 阶段凡涉及页面结构、组件、接口、权限的变更，一律按以下顺序执行：

```
用户自然语言需求
  ↓
1. 主 Agent 先修改 spec.md 对应页面的 YAML 数据块（涉及接口时先改契约，遵守 9.5 契约纪律）
  ↓
2. vima validate → vima render-review → vima render-prototype，刷新审计视图、原型与 manifest
  ↓
3. 重大变更时请用户在刷新后的原型上确认变更意图（小变更可事后告知）
  ↓
4. 再改代码；Verifier 按最新 manifest 对账
```

**简化路径**：纯视觉调整（配色/间距）、文案修改、不改页面结构的内部重构，直接改代码，无需传播——判定标准是**页面级粒度四要素的 YAML 块是否需要改动**。

**漂移检测**：`vima doctor` 含对齐产物漂移检查（等价于 render-review/render-prototype 的 `--check`），发现 HTML/manifest 与 spec 不一致时提示重渲染。

对齐不是开发前的一次性确认，而是贯穿全生命周期的持续不变量——本章四节合起来才是“人机信息对齐”的完整闭环。

### 13.5 成本与耗时预期

一次完整 /go 是"用 token 换时间"：

| 项目规模 | 子代理会话量级 | 说明 |
|---------|--------------|------|
| 小型（~8 任务） | 20± | 共享层 1-2 个 + 业务任务 Builder/Verifier 各一次 + 收尾流水线 |
| 中型（~18 任务） | 40-50 | 含重试预算（每任务最多额外 2 轮 Builder） |
| 大型（30+ 任务） | 70+ | 建议拆多个 /go 会话推进，配合批次预算自然达成 |

- 总成本约为单 Agent 顺序开发的 1.5-2 倍（Verifier 与重试是额外开销），换来的是批内并行压缩总耗时与独立校验带来的质量保障；
- 批次预算设计不增加总成本，只是把同样的工作量切分到多个会话执行；
- Builder 默认 sonnet、Planner 用 opus，角色模板的 model 字段可按预算调整。

**PLANNING 阶段的成本不可忽略**：上表仅覆盖 /go 之后。页面级粒度意味着中型项目需要几十页 YAML 填充、多轮澄清确认、跨会话推进，且语义抽查（13.1 强化策略）本身消耗 Verifier 会话——PLANNING 的 token 量级通常与单次 /go 相当，做预算时须一并计入。信息源分级（13.1）能减少返工，但省不掉必要的对话轮次。

---

## 十四、生命周期状态机

### 14.1 生命周期阶段定义

```
─────────────     ───────────     ───────────     ───────────
│  BOOTSTRAP  │────▶│  PLANNING   │────▶│ DEVELOPING  │────▶│ MAINTAINING │
│  项目初始化  │     │  需求梳理    │     │  编码开发    │     │  日常维护    │
─────────────     ───────────     ───────────     ───────────
      │                 │                │                │
 vima init 完成    spec+契约+任务就绪   /go 触发        全部任务完成
```

| 阶段 | 用户交互方式 | Agent 行为模式 | 上下文加载策略 |
|------|------------|---------------|--------------|
| **BOOTSTRAP** | CLI 命令 | 执行脚手架生成 | 仅核心配置 |
| **PLANNING** | 纯自然语言 | 文档整理、需求澄清、规范与契约生成 | 原始文档 + 模板 |
| **DEVELOPING** | `/go` + 自然语言 | 批次驱动调度模式 | 每个子代理只加载当前任务 + 契约 |
| **MAINTAINING** | 纯自然语言 | 定位问题、修改代码、自动校验 | 按需读取相关文件 |

### 14.2 lifecycle.json 统一 Schema

全文档唯一定义，`vima init` 与各章节示例均以此为准（示例为 admin 模板；`templateId` 与各阶段检查点项均由模板的 planning 配置声明，不同模板内容不同）：

```json
{
  "schemaVersion": "2.0",
  "vimaVersion": "2.0.0",
  "templateId": "admin",
  "currentPhase": "PLANNING",
  "phaseHistory": [
    {
      "phase": "BOOTSTRAP",
      "enteredAt": "2026-08-12T10:00:00Z",
      "completedAt": "2026-08-12T10:05:00Z",
      "note": "vima init 完成"
    },
    {
      "phase": "PLANNING",
      "enteredAt": "2026-08-12T10:05:00Z",
      "completedAt": null,
      "note": "开始需求梳理"
    }
  ],
  "checklists": {
    "PLANNING": {
      "rawDocsCollected": true,
      "modulesConfirmed": false,
      "specGenerated": false,
      "contractsGenerated": false,
      "tasksDecomposed": false,
      "tasksApproved": false,
      "artifactsValidated": false,
      "reviewRendered": false,
      "prototypeRendered": false
    },
    "DEVELOPING": {
      "sharedLayerDone": false,
      "businessTasksDone": false,
      "pipelineDone": false,
      "testsPassed": false,
      "codeAudited": false
    }
  },
  "taskStats": {
    "total": 0,
    "done": 0,
    "failed": 0,
    "blocked": 0,
    "updatedAt": "2026-08-12T10:05:00Z"
  }
}
```

**写入约定**：

1. **单一写入者**：lifecycle.json 只能由主 Agent（或 CLI 本身）写入，子代理一律只读。这从根本上消除了并发写冲突。
2. **任务明细不在此文件**：单个任务的状态存放在各任务文件的 frontmatter 中（9.2），lifecycle.json 只存聚合统计，避免大文件频繁重写。
3. **每次更新原子化**：主 Agent 先读后写完整 JSON，不做局部字符串拼接。
4. **frontmatter 为唯一权威 + CLI 确定性对账**：taskStats 只是聚合缓存，允许与 frontmatter 短暂不一致。`vima doctor` 会自动比对两者；不一致时运行 `vima sync` 以全部任务 frontmatter 为准重建 taskStats 与 README 批次视图。**状态漂移的修复永远由确定性的 CLI 完成，不交给 Agent 概率性行为**。

### 14.3 任务状态机

任务 frontmatter 的 `status` 字段遵循以下状态机：

```
pending ──(批次派发)──▶ running ──(Verifier 通过)──▶ done
   ▲                       │
   │                  (Verifier 不通过, retryCount<2)
   │                       ▼
   └──(用户人工修复/重试)── running（增量修复模式）
                           │
                      (重试 2 次仍失败)
                           ▼
                        failed ──(阻塞)──▶ 后续依赖任务置 blocked
                           │
                      (用户决策：重试/跳过/修复)
```

| 状态 | 含义 | 可转移到 |
|------|------|---------|
| `pending` | 待执行 | running |
| `running` | 子代理执行中 | done / failed |
| `done` | 完成且通过验收 | （终态，维护阶段修改不回退此状态） |
| `failed` | 重试 2 次未通过 | pending（用户决定重试时） |
| `blocked` | 依赖的任务 failed | pending（阻塞解除后） |

### 14.4 阶段切换机制

| 切换条件 | 动作 |
|---------|------|
| spec.md + contracts/ + tasks/*.md 全部生成并确认 | PLANNING → 等待 /go |
| 用户输入 /go（或自然语言"开始开发"） | 切换 DEVELOPING，启动批次调度 |
| 所有任务 done 且流水线通过 | DEVELOPING → MAINTAINING |
| 存在 failed/blocked 任务 | 保持 DEVELOPING，等待用户处理 |

阶段切换由主 Agent 自动更新 lifecycle.json；用户也可用自然语言手动要求切换（兜底），Agent 会先确认前置产物再执行。

### 14.5 各阶段的自动行为

#### PLANNING 阶段

```
用户：我有一堆文档，帮我整理一下（文档在 docs/raw/）
Agent：
1. 读取 lifecycle.json → PLANNING
2. 扫描 docs/raw/ → 发现 15 个文档
3. 逐个阅读，提取关键信息
4. 主动跟用户确认模块清单
5. 逐步生成 spec.md → 契约文件 → tasks/*.md
6. 每个里程碑更新 checklists.PLANNING
7. 全部就绪后等待 /go
```

#### DEVELOPING 阶段

```
用户：/go
Agent：（按 go.md 流程执行批次调度，见 10.2）
```

#### MAINTAINING 阶段

```
用户：帮我在设备列表加个批量删除
Agent：
1. 读取 lifecycle.json → MAINTAINING
2. 定位 docs/tasks/device-list-fe.md → 维护须知指明目标文件
3. 读取契约确认接口定义 → 完成修改 → 自动校验 → 回复用户
```

---

## 十五、完整项目结构

以下以 **admin 模板**为例（其他模板的 docs/ 产物差异见 3.7 产物矩阵，如 cli 模板无 contracts/，规范文档为 cli-spec.md）：

```
my-project/
├── CLAUDE.md                    ← vima init 生成（精简版，< 50 行）
├── docs/
│   ├── lifecycle.json           ← vima init 生成，主 Agent 更新（单一写入者，含 templateId）
│   ├── planning-guide.md        ← vima init 安装（模板专属 PLANNING 引导）
│   ├── coding-standards.md      ← vima init 安装（编码规范，CLAUDE.md「详细规范」指针落点）
│   ├── planning-validation/     ← vima init 安装（validate.checklist.md + coverage-matrix.example.md）
│   ├── spec.md                  ← PLANNING 阶段 Agent 生成（骨架先行，admin 规范文档）
│   ├── coverage-matrix.md       ← PLANNING 阶段生成（需求→接口→契约→任务覆盖矩阵）
│   ├── review/
│   │   ├── index.html           ← 人类审计视图（vima render-review 确定性渲染，单文件）
│   │   ├── prototype.html       ← 线框原型（vima render-prototype，无样式交互产物）
│   │   └── prototype.manifest.json ← 机器对齐基线（Verifier 开发期对账用）
│   ├── raw/                     ← 用户放入原始杂乱文档
│   ├── contracts/               ← PLANNING 阶段生成，前后端任务的共享契约（admin 专属）
│   │   ├── _example.md          ← vima init 安装的契约示例（_ 前缀不参与加载）
│   │   ├── device-api.md
│   │   └── user-api.md
│   ├── tasks/                   ← PLANNING 阶段 Agent 生成
│   │   ├── README.md            ← 任务清单 + 依赖关系图
│   │   ├── _template-fe.md      ← 前端任务模板（vima init 生成，admin 专属）
│   │   ├── _template-be.md      ← 后端任务模板（vima init 生成，admin 专属）
│   │   ├── shared-base.md       ← 共享层任务（layer=shared）
│   │   ├── device-api-be.md     ← 后端任务（layer=business）
│   │   ├── device-list-fe.md    ← 前端任务（layer=business）
│   │   └── ...
│   └── ui-framework/            ← vima init 自动扫描生成
│       ├── CAPABILITY.md
│       └── <ComponentName>.md
├── .claude/
│   ├── settings.json            ← 权限 + hooks（真实 Claude Code 格式）
│   ├── commands/                ← 按需触发，仅 2 个文件
│   │   ├── go.md                ← /go：批次调度 + 断点续跑
│   │   └── check.md             ← /check：完成度报告
│   ├── agents/                  ← 子代理角色模板，固定 3 个文件
│   │   ├── vima-builder.md
│   │   ├── vima-verifier.md
│   │   └── vima-planner.md
│   └── hooks/                   ← 校验与写保护脚本
│       ├── guard-shared.sh      ← PreToolUse：共享层写保护（令牌机制）
│       └── post-write.sh        ← PostToolUse：导入规范/行数检查
├── .vima/
│   ├── manifest.json            ← vima 生成物清单与版本（升级迁移用）
│   ├── reports/                 ← 子代理执行报告（Builder/Verifier JSON，审计与重试依据）
│   └── shared-write-token       ← 共享层写令牌（仅共享层任务执行期间存在）
├── src/                         ← 前端代码（vima create 生成）
│   ├── components/ utils/       ← 前端共享层（业务任务只读，同 template.json sharedDirs）
│   ├── hooks/ types/            ← 业务层预留目录（.gitkeep 占位）
│   └── views/                   ← 业务层页面
├── vendor/                      ← vendored 组件库（共享层，业务任务只读）
└── backend/                     ← 后端代码（vima create 生成）
    └── src/main/java/com/<pkg>/
        ├── config/ security/    ← 后端共享层（业务任务只读，同 sharedDirs）
        └── controller|service|… ← 业务模块
```

---

## 十六、配置文件参考

### 16.1 template.json

见第三章 3.4 节（唯一定义，此处不重复）。

### 16.2 lifecycle.json

见第十四章 14.2 节（唯一定义，此处不重复）。

### 16.3 .claude/settings.json

采用 Claude Code 真实的 hooks 配置格式（事件名 → matcher → hooks 数组）：

```json
{
  "permissions": {
    "allow": [
      "Read", "Write", "Edit",
      "Bash(npm run *)", "Bash(mvn *)",
      "Bash(git status *)", "Bash(git add *)", "Bash(git commit *)", "Bash(git log *)",
      "Bash(ls *)", "Bash(cat *)", "Bash(find *)", "Bash(grep *)",
      "Bash(vima *)"
    ],
    "deny": [
      "Bash(rm -rf *)", "Bash(sudo *)", "Bash(curl *)", "Bash(wget *)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": ".claude/hooks/guard-shared.sh" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": ".claude/hooks/post-write.sh" }
        ]
      }
    ]
  }
}
```

**`Bash(vima *)` 必须放行**：PLANNING 阶段的即时校验（vima validate）、渲染对齐视图（render-review/render-prototype）、/go 的批次计划（vima plan）与评审确认（vima approve）都依赖 Agent 自主调用 CLI；缺少该权限则每次调用都被权限弹窗打断，即时校验闭环失效。

**hook 脚本行为约定**：

| 脚本 | 触发 | 行为 |
|------|------|------|
| `guard-shared.sh` | 写入/编辑前 | 目标路径命中共享目录（template.json sharedDirs 同步）或 DEVELOPING 期的 docs/contracts/**，且 `.vima/shared-write-token` 不存在/过期 → exit 2 阻断并返回原因；否则放行 |
| `post-write.sh` | 写入/编辑后 | src/ 业务代码检查底层库深路径导入与原生 confirm()/alert() → exit 2 反馈 Agent 修复；.vue 含 `data-page` 时按 prototype.manifest.json 机检区块/弹窗标记（13.3 机械对账）→ 不符 exit 2；CLAUDE.md 行数超限仅告警（exit 0） |

> hook 通过 stdin 接收 JSON（含 `tool_input.file_path`），脚本据此判断目标路径。exit 2 表示阻断，stderr 内容会反馈给 Agent。

### 16.4 任务文件 frontmatter 规范

见第九章 9.2 节（唯一定义，此处不重复）。

---

## 十七、核心痛点与解决方案总结

| 痛点 | 解决方案 | 关键机制 |
|------|---------|---------|
| 任务拆解不详细 | 自包含任务文件 | 组件树 + 字段表 + 契约引用全内联 |
| 只实现一部分 | 五道防线 | 分步执行 + Verifier + Hook + 完成定义 + 主 Agent 汇总 |
| UI 不可控 | 三道锁 | 组件树 + 文档强制前置 + 写入后自动检查 |
| 框架配置重复 | vima init | 一键部署 Agent 工作环境 |
| 指令输入冗长 | 极简命令 + 自然语言优先 | 仅 /go + /check |
| 上下文爆炸 | 上下文管理策略 | 常驻/按需分离 + CLAUDE.md < 50 行 + 子代理隔离 |
| Agent 不知道当前阶段 | 生命周期状态机 | lifecycle.json + 自动阶段切换 |
| 单 Agent 上下文膨胀 | 子代理拆分 + 批次驱动 | 批内并行、批间屏障、角色隔离 |
| Agent 偷懒/选择性遗忘 | 独立 Verifier | 只读校验，自己不能检查自己 |
| 规范产物漏章/失真/需求遗漏 | 产物可靠性机制 | 骨架先行 + 即时机械校验 + 覆盖矩阵 + 语义抽查（13.1） |
| 规范粒度不足无法直接开发/人类审核成本高 | 页面级粒度 + 审计视图 | 页面四要素强制校验 + vima render-review 单文件 HTML（13.2） |
| 人机对设计意图理解不一致 | 同源四投影对齐体系 | 审计视图 + 原型 + manifest 同源于 spec 结构化数据块，开发期按 manifest 对账（13.3） |
| 维护期变更导致设计漂移 | 对齐同步闭环 | 变更先改 spec YAML → 重渲染对齐产物 → 再改代码（13.4） |
| YAML 填充失真被确定性渲染放大 | 信息源分级 + 抽查强化 | 默认禁推断/pendingConfirm 标记 + 覆盖率≥ 30% 与推断项全检（13.1） |
| Agent 拓扑计算/确认判断不可靠 | 确定性 CLI 命令 | vima plan 批次计划（含环检测）+ vima approve 机械确认 |
| LLM 不遵守协议/状态漂移 | 确定性 CLI 兜底 | vima sync 对账重建 + doctor 体检，修复不交给概率性行为 |
| 执行过程无据可查 | reports 落盘留痕 | Builder/Verifier 结果写入 .vima/reports/，重试与审计有依据 |
| 批次产出错误无法回退 | 批后 git commit | 每批验收通过后打提交，批粒度回滚 |
| 并行任务改共享依赖 | 架构预防四策略 | 共享层前置 + 令牌写保护 + 串行补偿 + 维护期令牌 |
| 前后端接口不一致 | API 契约机制 | contracts/ 唯一事实来源 + Verifier 按契约校验 |
| 开发中断无法恢复 | 任务状态机 + 断点续跑 | frontmatter status + /go 自动识别断点 |
| 单点失败全线停止 | 局部阻断策略 | failed 只阻塞依赖链，其他批次继续 |
| CLI 升级摧毁用户定制 | vima upgrade | manifest 清单 + 三方比较 + 用户文件永不覆盖 |
| 完成度报告不可靠 | 客观信号为主 | status 统计 + 构建结果 + 清单勾选；语义比对仅抽样 |

---

## 十八、工程落地关键建议

1. **约束驱动**：每次 Agent 犯错，转化为一条新约束
2. **持久化**：所有规范与状态写入文件，不依赖对话上下文
3. **人机协同**：人负责决策（/go、失败处置），Agent 负责执行
4. **上下文纪律**：常驻只留红线，其余按需加载；定期用 doctor 体检 CLAUDE.md 行数
5. **调度基于真实能力**：永远先确认 Claude Code 当前版本支持的能力，再设计机制
6. **确定性兜底优先**：凡能用文件系统和 CLI 确定性解决的（状态对账、报告留痕、回滚点、批次拓扑、评审确认），就不留给 Agent 概率性行为
7. **落地优先级**：
   - 第 1 周：CLAUDE.md + lifecycle.json + 组件文档扫描 + manifest 清单
   - 第 2 周：任务模板（前后端两版）+ 契约机制（含 YAML 结构化块）+ README 依赖图 + 检查点 + 任务评审环节（vima approve）
   - 第 3 周：hooks（post-write 校验 + guard-shared 写保护 + 令牌）+ /check + vima sync 对账
   - 第 4 周：PLANNING 自然语言支持 + 会话断点恢复 + 骨架先行生成 + 机械校验清单 + 覆盖矩阵 + 审计视图与原型渲染器
   - 第 5 周：/go 批次调度（vima plan 确定性批次计划）+ .claude/agents/ 角色模板 + 并行/串行执行 + 批后 git commit
   - 第 6 周：独立 Verifier（含原型 manifest 语义对账）+ 失败重试与断点续跑 + reports 落盘 + 编排会话预算 + vima upgrade + 黄金项目端到端回归
   - 持续：`vima create` 其余模板补齐 + 组件文档扫描优化
8. **框架自验收（黄金项目）**：每个模板维护一个黄金样例工程（最小模块的 spec/契约/任务夹具），端到端回归 create → init → validate → render-review/render-prototype --check → doctor → plan；CLI 每次发版以黄金项目全绿为准入门槛，防止框架自身回归

---

## 十九、CLI 命令参考

### 19.1 vima create

```bash
vima create <project-name> [options]

Options:
  -t, --template <type>  指定模板类型（缺省进入交互式选择；非 TTY 环境必须显式指定）
  -i, --interactive      强制进入交互式选择（即使给了 --template）
  -f, --force            允许在已存在目录中创建并覆盖同名文件（不清空目录）
  --no-git               不初始化 Git 仓库
  --no-install           不自动安装依赖

Examples:
  vima create my-project
  vima create my-project --template admin
  vima create my-project --no-git
```

### 19.2 vima init

```bash
vima init [options]

Options:
  --force          强制重新初始化（会覆盖用户修改，慎用）
  --skip-scan      跳过 UI 组件扫描
  --minimal        最小化初始化（仅生成必要文件）

Examples:
  vima init
  vima init --minimal
```

### 19.3 vima upgrade

```bash
vima upgrade [options]

升级项目中的 vima 生成物到当前 CLI 版本（见 4.5 三方比较策略）

Options:
  --dry-run        只输出动作预览表，不实际修改（实现裁定：不含 diff 内容，见 4.5 注）
  --yes            兼容保留（实现恒非交互，此 flag 无额外行为）

Examples:
  vima upgrade --dry-run
  vima upgrade
```

### 19.4 vima doctor

```bash
vima doctor [options]

检查项：
  - 环境依赖（模板 prerequisites：node/java/maven 等，与 vima create 复用同一份预检逻辑）
  - CLAUDE.md 行数是否 ≤ 50（超限为告警级，见 5.4，不影响退出码）
  - lifecycle.json 结构是否符合 schemaVersion 2.0
  - **taskStats 与各任务 frontmatter 一致性对账**（不一致时提示运行 vima sync）
  - **README 依赖图与 frontmatter 一致性检查**
  - .claude/ 配置完整性（commands/agents/hooks/settings）
  - hooks 脚本可执行权限
  - manifest.json 与实际文件的一致性
  - **对齐产物漂移检查**：docs/review/ 下 HTML/manifest 与 spec 的字节级一致性
    （等价 render-* --check，见 13.4 漂移检测）

Options:
  --json           JSON 格式输出
  --verbose        详细输出
```

### 19.5 vima validate

```bash
vima validate [options]

PLANNING 产物的机械校验（确定性，零 token，见 13.1）：
  - 按模板的 validate.checklist.md 检查产物结构与必填要素
    （spec 章节齐全、契约接口五要素、任务 frontmatter 七字段齐全）
  - 交叉引用闭环：接口 ⊆ 契约、无孤儿契约、前后端任务成对、dependsOn 闭包
  - 覆盖矩阵缺口行检查（存在缺口时非零退出）
  - 校验结果写入 .vima/reports/planning-validation.json 留痕
  - PLANNING 阶段 Agent 每生成一份产物后应自动运行一次（即时校验）

Options:
  --artifact <path>  只校验指定产物（默认全量）

Examples:
  vima validate
  vima validate --artifact docs/spec.md
```

### 19.6 vima render-review

```bash
vima render-review [options]

从 spec 结构化数据块确定性渲染人类审计视图（见 13.2，参考 PACT）：
  - 提取 spec.md 的角色/菜单/流程章节与页面级粒度 YAML 数据块
  - 按模板的 review.template.html 骨架渲染单文件 HTML（零外部请求，禁 JS 可读）
  - admin：角色权限视图 + 菜单功能点视图 + 业务流程串联视图 + 页面 UI 详情视图
  - 页面级粒度四要素缺失时拒绝渲染并输出缺失清单（先过 vima validate）

Options:
  --check          不重新渲染，只验证现有 HTML 与 spec 是否一致（字节级）
  --output <path>  输出路径（默认 docs/review/index.html）

Examples:
  vima render-review
  vima render-review --check
```

### 19.7 vima render-prototype

```bash
vima render-prototype [options]

从 spec YAML 数据块确定性渲染无样式交互线框原型（见 13.3）：
  - 与 render-review 共用提取层；单文件零外部请求、禁 JS 可读、字节一致输出
  - 布局区块用枚举词表（toolbar/search/table/form/cards/tabs/pagination）；
    表格列头对齐契约响应体字段
  - 交互限定三种：跳转（锚点 #page-PAGE-xx）/ 开弹窗（MODAL-xx，JS 显隐态为遮罩层）/ 接口标注
  - 含业务流程演示区：每条 vima:flow 渲染步骤列表，步骤点击回放到对应页面锚点（13.3）
  - 同时输出 prototype.manifest.json（机器可读基线，Verifier 开发期对齐对账用；flows 不进 manifest）
  - 渲染本身零 token 消耗（CLI 独立执行，无 Agent 参与）

Options:
  --check          不重新渲染，只验证现有原型与 spec 是否一致（字节级）
  --output <path>  输出路径（默认 docs/review/prototype.html）

Examples:
  vima render-prototype
  vima render-prototype --check
```

### 19.8 vima sync

```bash
vima sync [options]

确定性状态重建（不依赖 Agent）：
  - 扫描 docs/tasks/*.md frontmatter，重建 lifecycle.json 的 taskStats
  - 重新生成 docs/tasks/README.md 的批次视图
  - 清理过期的 .vima/shared-write-token

Options:
  --dry-run        只输出差异预览，不实际修改

Examples:
  vima sync --dry-run
  vima sync
```

### 19.9 vima plan

```bash
vima plan [options]

确定性生成批次计划（见 7.5 步骤 2，主 Agent 不自行拓扑计算）：
  - 扫描 docs/tasks/*.md frontmatter，按 layer + dependsOn 拓扑排序
  - 环检测：发现依赖环即非零退出并输出环路径
  - 输出 .vima/reports/batch-plan.json：批次划分、批内任务清单、并行度建议（单批 ≤ 5）
  - 只读操作，不修改任何状态

Options:
  --json           批次计划输出到 stdout（默认写文件）

Examples:
  vima plan
```

### 19.10 vima approve

```bash
vima approve

用户评审的机械确认（6.4 步骤 13，第三道闸门的落痕动作）：
  - 前置：vima validate 通过且审计视图/原型已渲染，否则中止
  - 存在未确认的 pendingConfirm 推断项时中止并列出待确认清单（见 13.1 信息源分级）
  - 输出任务汇总表供用户最后核对，确认后写 lifecycle.json：
    checklists.PLANNING.tasksApproved = true + 确认时间戳
  - 以 CLI 记录代替 Agent 对“用户已确认”的语义判断，/go 前置闸门机械可追溯

Examples:
  vima approve
```

### 19.11 vima version

```bash
vima version
vima --version
vima -v
```

---

## 二十、故障排除

### 20.1 常见问题

#### Q: vima create 失败，提示目录已存在

```bash
vima create my-project --force
```

#### Q: vima init 后 Agent 不按阶段工作

```bash
# 依次检查关键文件
cat CLAUDE.md                     # 是否存在且含"工作协议"段
cat docs/lifecycle.json           # 是否存在且 currentPhase 正确
vima doctor --verbose             # 一键体检
```

#### Q: /go 后子代理不启动

1. 检查 `.claude/agents/` 下是否有三个角色文件
2. 检查角色文件的 frontmatter 格式（name/description/tools）
3. 确认 Claude Code 版本支持自定义子代理（`claude --version`，建议最新版）

#### Q: Builder 报错"禁止修改共享目录"

这是 guard-shared hook 在正常工作。若当前确属共享层任务：检查主 Agent 是否写入了 `.vima/shared-write-token`；若属业务任务：按 10.7 策略三提交 sharedChangeRequest；若处于 MAINTAINING 阶段且确为合法的共享层修改：按 10.7 策略四由主 Agent 先写令牌再执行。

#### Q: 任务状态与 /check 报告对不上

```bash
vima doctor          # 检查 taskStats 与 frontmatter 一致性
vima sync            # 以 frontmatter 为准重建聚合状态与 README
```

#### Q: /go 中途失败后如何恢复

```bash
# 直接再次启动 Claude Code 并输入 /go，会自动进入断点续跑模式
# 或先查看现状：
/check
```

#### Q: 上下文窗口溢出

1. `vima doctor` 检查 CLAUDE.md 是否超过 50 行
2. 检查是否有组件文档被全量读取而非按需
3. 确认调度逻辑在 go.md 而非 CLAUDE.md 中

### 20.2 调试模式

```bash
# CLI 详细日志
DEBUG=vima:* vima create my-project

# 检查生命周期状态
cat docs/lifecycle.json | jq .

# 检查所有任务状态
for f in docs/tasks/*.md; do head -10 "$f" | grep -E 'taskId|status'; done

# 检查共享写令牌状态
cat .vima/shared-write-token 2>/dev/null || echo "无令牌（共享层写保护生效）"
```

---

## 二十一、版本历史

### v2.0.2 (2026-08-12) 人机对齐直观性与编码可控性增强

针对两大核心疑虑（人审材料是否直观可确认 / AI 编码是否可控）的定向增强：

- **原型管理后台外壳**：侧边菜单树 + 每菜单角色徽标 + 角色视角切换（JS 渐进增强，
  noscript 徽标静态可读）；页面卡带角色归属联动淡出——人按真实动线（角色→菜单→页面→按钮）走查
- **pendingConfirm 可视化**：两份对齐产物为全部 AI 推断项渲染「⚠️ 待确认」徽标；
  审计视图新增待确认清单区（数量入封面统计，approve 清零前阻断不变）
- **审核指引**：审计视图内置四步审核动线与「发现问题 → 改 spec 重渲染」的正确动作指引
- **区块标记机械对账（13.3 机械化路径 hook 半提前）**：data-page/data-block/data-modal
  标记约定 + post-write hook 按 manifest 逐项机检（缺失/多余/未知页面当场拦截）；
  Builder/前端任务模板强制落标记，Verifier 聚焦语义残余面
- **校验规则 V-SPEC-08**：菜单功能点引用的接口必须存在于契约——「功能点→接口→契约」
  链条闭环机检（配套测试与 checklist 镜像）
- **任务点台账三件套（B1/B2/B3，契约 §6.9/§8）**：Verifier 报告升级为逐任务点判定
  （manifest 该页条目逐点展开为 points，每点独立证据，不得整页折叠）；/check 聚合
  points 输出按钮·字段·连线级完成度；validate 新增 V-TASK-07（warn）核对验收清单
  复选框数 ≥ 页面任务点数，规划期即暴露漏点——「任务粒度=页面/模块（文件所有权），
  任务点粒度=按钮/字段/连线（机检对象）」两层定型
- 澄清：脚手架创建本身自 v2.0 起即为 CLI 确定性拷贝（含系统底座），不存在 AI 概率行为

### v2.0.1 (2026-08-12) 对齐修订

依据实现差距评估的回写与补全（业务语义不变，消除文档间矛盾）：

- A2/A4 增补项回写主文档：§7.5/§3.7/§6.3 七章→八章；§9.1/§9.2/§9.7 任务文件按 `page` 引用
  重写（删组件树示例）；§10.4 Builder 隔离表随 A2 更新；§8.3 组件树锁改为 spec 数据块真源
- 共享层目录单一真源化：全仓以 template.json `sharedDirs` 为准（前端 components/utils/vendor，
  后端 config/security），§5.2/§10.7/§15 同步；guard 增 DEVELOPING 期契约保护（§9.5 纪律 4）
- §3.4 template.json 示例更新为实现形态（builtin 拷贝/planning 键集/sharedDirs），加实现裁定注
- §4.5/§19.3 upgrade 记录 `.vima-new` 实现裁定；§19.1 create 选项语义澄清（交互回落/-i/--force）
- §13.3/§19.7 原型锚点统一 `#page-PAGE-xx`；新增流程演示区与弹窗遮罩层说明
- §19.4 doctor：CLAUDE.md 行数为告警级、预检与 create 同源、README 字节对账
- §16.3 hook 行为表与实现对齐（post-write 导入检查 exit 2 反馈）；§15 结构树对齐实际产物
  （src/views、vendor/、coding-standards.md、planning-validation/）；§7.6 /check 补追溯对账信号
- 新增 docs/coding-standards.md 资产（§5.2 指针落点）；§20.2 DEBUG=vima:* 调试落地
- 校验规则新增 V-CON-04（契约 module 与接口键跨文件唯一）；V-TASK-06 缺 spec 不再静默跳过

### v2.0.0 (2026-08-12)

- 平台收敛：仅支持 Claude Code，移除多 Agent 宣称
- 重设计调度模型：批次驱动，替代不可行的事件驱动假设
- 共享依赖处理重构：共享层前置 + 令牌写保护 + 串行补偿
- 新增后端任务体系与 API 契约机制
- 任务状态机 + 断点续跑 + 局部阻断
- lifecycle.json 统一 Schema（schemaVersion 2.0）+ 单一写入者约定
- hooks 采用 Claude Code 真实配置格式（PreToolUse/PostToolUse）
- 新增 vima upgrade 升级迁移机制
- /check 改为客观信号为主、语义抽样为辅
- 规范体系模板化：template.json 的 planning 块声明开发前产物与终点清单，admin 优先全量落地
- 编排会话管理：单次 /go 批次预算 + 续跑切短主会话，解决编排者自身上下文增长
- running 孤儿任务恢复规则 + 任务评审闸门（tasksApproved）
- reports/ 落盘留痕 + 批后 git commit 回滚点
- vima sync 确定性状态重建；frontmatter 为唯一权威，README 仅为生成视图
- 共享依赖四策略（新增维护期令牌）；/go 三道校验闸门（机械校验 + 语义抽查 + 用户评审）
- 规范产物可靠性机制（13.1）：骨架先行 + 即时机械校验 + 覆盖矩阵 + 语义抽查
- 人类审计视图（13.2，参考 PACT）：双轨产物 + 页面级粒度四要素强制 + vima render-review 确定性渲染单文件 HTML（角色权限/菜单功能点/业务流程串联/页面 UI 详情四视图）
- 原型引擎（13.3）：无样式线框原型 + prototype.manifest.json 机器基线，开发期 spec→原型→代码对齐对账；CLI 独立渲染零 token；人机信息对齐升格为框架核心保障（1.2）
- 新增成本与耗时预期（13.5）
- 冷读修订：产物工程独立成章（第十三章）；信息源分级与 pendingConfirm 标记、语义抽查覆盖率强化与修补-重抽闭环（13.1）；新增维护期对齐同步闭环（13.4）；澄清 Verifier 对账为语义级并给出区块标记确定性对账路径（13.3）；契约文件引入 YAML 结构化数据块（9.5）；原型禁 JS 降级为平铺视图；新增 vima plan（确定性批次计划）与 vima approve（机械确认闸门）；settings 权限补 Bash(vima *)；声明写保护 Bash 通道边界；补 PLANNING 成本预期；新增黄金项目自验收

### v1.0.0

- 初始版本：vima create/init、/go、/check、生命周期状态机、上下文管理策略

### 计划功能

- v2.1.0：补齐 cli / script 模板；区块标记确定性对账（data-block 约定 + 构建期脚本，见 13.3）
- v2.2.0：补齐 lib / h5 模板
- v2.3.0：Tester/Auditor 角色模板（当前由 Builder 自检与流水线任务承载）
- v3.0.0：评估多 Agent 适配层（独立立项，不影响 v2.x）

---

## 附录

### A. 术语表

| 术语 | 定义 |
|------|------|
| **子代理** | 由主 Agent 通过角色模板派发的一次性执行者，拥有独立上下文 |
| **Builder** | 负责代码开发的子代理 |
| **Verifier** | 负责验收校验的子代理（只读） |
| **Planner** | 负责需求梳理的子代理 |
| **批次驱动** | 主 Agent 按批次派发子代理、等待全部返回后再推进的调度模型 |
| **契约文件** | docs/contracts/ 下的接口定义，前后端任务的唯一事实来源 |
| **共享层** | 被多个业务任务共用的基础代码，业务任务只读 |
| **写令牌** | .vima/shared-write-token，共享层任务执行期间解除写保护的凭证 |
| **任务文件** | 含 frontmatter 状态与完整开发指令的 Markdown 文件 |
| **生命周期** | BOOTSTRAP → PLANNING → DEVELOPING → MAINTAINING |
| **执行报告** | .vima/reports/ 下的 Builder/Verifier 结构化结果，落盘留痕 |
| **对账** | vima sync 以任务 frontmatter 为准重建 taskStats 与 README 的确定性操作 |
| **批次检查点** | 每批验收通过后的 git commit，批粒度回滚点 |
| **骨架先行** | spec 等产物由模板骨架复制生成，Agent 逐章填充而非自由创作 |
| **机械校验** | 按 validate.checklist.md 对产物结构/必填要素/引用完整性的确定性检查，零 token |
| **覆盖矩阵** | coverage-matrix.md，原始需求→接口→契约→任务的三列对齐追踪表 |
| **审计视图** | docs/review/index.html，CLI 确定性渲染的人类审核用单文件 HTML 规格书 |
| **原型引擎** | vima render-prototype，将 spec YAML 数据块渲染为无样式交互线框原型，渲染零 token |
| **原型基线** | prototype.manifest.json，渲染器产出的机器可读页面结构基线，Verifier 对账实现对齐 |
| **人机对齐** | 框架核心保障：人与 AI 对设计与实现保持同一理解，同源结构化数据多形态投影 |
| **页面级粒度** | spec 页面章节的强制深度：布局拆分、组件清单、交互设计、接口映射四要素 |
| **信息源分级** | YAML 填充信息的来源优先级：raw/ 原文 > 用户确认 > Agent 推断（默认禁止，推断项标记 pendingConfirm） |
| **批次计划** | vima plan 从 frontmatter 拓扑确定性生成的批次划分（batch-plan.json），含环检测 |
| **对齐同步闭环** | 维护期变更按“先改 spec YAML → 重渲染对齐产物 → 再改代码”传播，保证对齐贯穿全生命周期（13.4） |
| **区块标记对账** | v2.1.0 计划：前端页面输出 data-block/data-modal 标记，构建期与 manifest 确定性比对 |

### B. 参考资料

- [Claude Code 官方文档](https://docs.anthropic.com/claude-code)
- [Claude Code Hooks 文档](https://docs.anthropic.com/claude-code/hooks)
- [Claude Code Subagents 文档](https://docs.anthropic.com/claude-code/sub-agents)
- PACT 项目（本地：/home/renmk/projects/PACT）：人类审计产物设计参考——双轨产物（md 给 AI / HTML 给人）、pact-book-html.mjs 确定性渲染（单文件零外部请求、禁 JS 可读、字节一致可 --check）、R-ID 交叉引用

### C. 贡献指南

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'Add your feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 创建 Pull Request

### D. 许可证

MIT License

---

**文档版本**: v2.0.0
**最后更新**: 2026-08-12
**作者**: vima-cli 团队
