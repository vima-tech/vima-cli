# vima-cli 内部实现契约（并行开发对齐真源）

> 本文是全部模块的**唯一接口权威**。与设计文档冲突时：文件格式/接口签名以本文为准，
> 业务语义以 `docs/design/vima-cli-design-v2.md`（下称 §N）为准。
> 增补项记为 A1–A33（来源分档见 §12 与 docs/design/v2.1-amendments.md）。
> 更新日期：2026-08-13（对应设计文档 v2.0.5；本文随设计文档修订演进，不单独编号。
> A16 多端应用模型为契约先行：本文 schema/规则已定稿，按 A16 三波次落实现）。

## 目录

§1 阅读顺序 · §2 仓库结构与文件所有权 · §3 全局约定（3.1 错误码登记表）· §4 lib/util API ·
§5 lib/model API · §6 文件格式 Schema（6.1–6.20）· §7 spec 结构化数据块 ·
§8 validate 规则表（8.1 V-INT 规则族 / converge）· §9 plan 批次算法 · §10 trace 规则 ·
§11 render 约定 · §12 增补项 A1–A34 · §13 测试与 fixtures · §14 命令行为裁定补遗

## 1. 阅读顺序

实现任何模块前：先读本文全文 → 再读设计文档中你负责章节 → 动手。

## 2. 仓库结构与文件所有权

```
bin/vima.mjs lib/cli.mjs lib/util/errors.mjs   [核心路由与错误通道：并行开发期冻结，
                                                集成后改动须同步本文 §3/§4] + tests/cli.test.mjs
lib/util/{fs,yaml,md}.mjs lib/model/*.mjs      [F  基础库]
tests/unit/{f.yaml,f.md,f.model}.test.mjs      [F]（命名按 §13 <owner>.<topic> 规范）
templates/admin/planning/*.md                  [D1 规划资产] + tests/fixtures/golden/**
templates/admin/workspace/**                   [D2 工作环境资产] + tests/unit/d2.workspace.test.mjs
templates/*/template.json templates/*/scaffold/** [D3 模板与骨架]
docs/pact-absorption.md docs/design/v2.1-amendments.md [A  吸收分析]
lib/commands/{create,init,update,upgrade,app}.mjs [C1] + tests/unit/c1.*.test.mjs
                                                （update=更新项目产物；upgrade=升级 CLI 自身，A15；
                                                 app=端册管理 add/list，A16 Wave 3）
lib/commands/{plan,sync,doctor}.mjs            [C2] + tests/unit/c2.*.test.mjs
lib/commands/{validate,approve,trace,context,converge,retro,change,certify}.mjs [C3] + tests/unit/c3.*.test.mjs
                                                （converge=跨任务集成对账，A20；复用
                                                 validate 导出的代码扫描原语，不复制实现；
                                                 change=维护期变更事务，A31；
                                                 certify=交付等级认证，A32）
lib/commands/render-{review,prototype}.mjs
templates/admin/planning/{audit-view,prototype}.mjs
templates/admin/planning/{review,prototype}.template.html [C4] + tests/unit/c4.*.test.mjs
scripts/{dev.sh,sync.mjs}                      [开发工具：沙箱演练与模板→沙箱增量同步，不随 npm 包发布]
scripts/gen-from-manifest.mjs                  [A6/A8 同源生成器：ai-manifest → ICONS.md + components.d.ts + llms-full.txt]
tests/e2e.test.mjs tests/helpers.mjs README.md [集成阶段统一编写，agent 不写]
```

只写你名下的文件。需要别人模块的行为时按本文签名假定，不去实现它。

## 3. 全局约定

- Node ≥20，ESM，**零依赖**（含 devDependencies）。参数解析用 `node:util` 的 `parseArgs`。
- 退出码（lib/util/errors.mjs 已定）：0 成功；1 未预期错误；2 校验/检查不通过；
  3 用法错误；4 前置条件不满足。
- 错误一律 `throw new VimaError(code, msg, {path, exitCode})` 或用 `usageError/checkFailed/precondition` 工厂。
  code 全集登记于 §3.1；stderr 首行稳定格式 `vima <cmd>: <CODE>: <message> (<path>)`，
  code=USAGE 时追加一行 `提示: 运行 vima <cmd> --help 查看用法`（未知命令为
  `提示: 运行 vima help 查看全部命令`）；DEBUG 匹配 `vima*`/`*` 时再附完整堆栈（§14），
  非 VimaError 的未预期异常同样只输出 message、堆栈受 DEBUG 门控。
- 命令模块接口：`export async function run(argv, ctx) → number`，
  `argv` 为命令名之后的参数数组，`ctx = { cwd, cliRoot }`。
  命令内部用 `parseArgs({ args: argv, options: {...}, allowPositionals: true })`；
  parseArgs 抛出的英文异常一律经 `usageFromParseArgs(err)`（§4）翻译为中文 usage 错误（exit 3）。
- 输出流向（stdout/stderr 分工，简体中文，允许 emoji 状态符 ✅❌⚠️）：
  - **结果性输出走 stdout**：命令产物与成功摘要（plan 批次表、sync 差异预览、approve 任务汇总表、
    validate 的「校验完成」统计行与待确认清单、trace 的 ✅ 摘要、render 的 ✅ 行、create/init 的
    完成输出与环境预检块）；doctor 的体检报告整体（含 ❌ 行）即产物，全走 stdout；
    `--json` 时 stdout 只输出 JSON。
  - **失败诊断与警告走 stderr**：validate 的 ❌ 错误块与 ⚠️ 警告块、trace 的 ❌ 野生与 ⚠️ 虚报清单、
    approve 的 ❌ 前置未满足块、render 的 ❌ 校验/--check 失败清单、create/init 的独立 ⚠️ 提示
    （git/npm 失败、已存在跳过）。保证 `vima validate > report.txt` 不吞错误。
- 顶层路由（lib/cli.mjs）：`vima help [command]` / `--help` / `-h` → stdout exit 0
  （help 的 topic 未知 → exit 3）；`vima <cmd> --help|-h`（在 `--` 分隔符之前出现即生效）→
  该命令用法 stdout exit 0；无参数 `vima` → 完整用法输出到 stderr、exit 3（用法错误）；
  未知命令 → 一行错误 + 提示（不倾倒全量帮助）、exit 3；`version|--version|-v` → 裸版本号 stdout exit 0。
  顶层 help 的 create 行须标注模板成熟度（admin=stable，其余 preview，A5 诚实分级）。
- 所有写盘：`atomicWriteFile`；所有 JSON 落盘：`stableStringify`。
- 渲染器/生成器**禁止** `Date.now()`、`new Date()`、`Math.random()`——字节确定性是验收项。
  例外：create/init/approve/sync/change 记录真实时间戳的字段（createdAt、openedAt 等）
  允许 `new Date().toISOString()`（change 仅限 change.json 状态文件；impact.json 属推导产物，无时间戳）。
- 路径统一 `node:path`；项目根定位：含 `docs/lifecycle.json` 或 `.vima/manifest.json` 的当前目录
  （不向上递归查找，v2.0 简化）。

### 3.1 错误码登记表（VimaError code 全集）

stderr 首行的 `<CODE>` 是稳定输出接口，新增/改名必须先改本表；测试断言以 code 为准（文案可改，code 不可静默改）。

| code | exit | 抛出点 | 含义 |
|---|---|---|---|
| USAGE | 3 | usageError 工厂（全部命令） | 用法/输入/参数解析错误 |
| PREREQ | 4 | create | 环境依赖预检不满足（必需工具缺失/版本不足） |
| DIR_EXISTS | 4 | create | 目标目录已存在且未加 --force |
| TEMPLATE_MISMATCH | 4 | create | --force 重跑时目录已有 manifest 且 templateId 不同（A16：防端册/生成物清单被覆写） |
| APP_EXISTS | 4 | app add | 端 id 已存在于端册（A16 Wave 3） |
| TEMPLATE_PREVIEW | 4 | init | preview 模板拒绝 init（A5 能力诚实分级） |
| ALREADY_INIT | 4 | init | 已初始化且未加 --force |
| NO_MANIFEST | 4 | update | 缺 .vima/manifest.json |
| NO_TEMPLATE_ID | 4 | update | manifest 缺 templateId |
| UPGRADE_UNSUPPORTED | 4 | upgrade | 安装方式不支持自升级（源码/npm link 态、npx 临时运行）且给了 --yes（A15） |
| REGISTRY_UNREACHABLE | 2 | upgrade | npm registry 请求失败/超时/响应缺 version（A15；不静默降级为「已是最新」） |
| INSTALL_FAILED | 2 | upgrade | 全局安装器无法执行或以非零码结束（A15） |
| NOT_IN_PROJECT | 4 | 全部项目内命令（A24） | 当前目录及其任何祖先都不是 vima 项目（无 `.vima/` 也无 `docs/lifecycle.json`）。**不写任何文件**——原行为按 cwd 静默工作，会把错误结论落盘（实测：在 `backend/` 下 validate 报「2 错误」并写出 `pass: false` 的报告） |
| NO_TASKS | 4 | plan / converge / retro / certify | 缺 docs/tasks/ 目录（防在非 vima 项目静默产出空计划 / 空对账报告，且不凭空创建 .vima/reports/） |
| CHANGE_ACTIVE | 4 | change open | 已存在非 closed 的变更包（A31 单变更在途：先 close 再开） |
| NO_CHANGE | 4 | change impact/apply/close | 未指定 id 且无在途（非 closed）变更包可默认 |
| CHANGE_UNPROPAGATED | 2 | change close | 传播闸门未过：受影响任务未全 done / validate 有 error / converge 未通过（A31） |
| NO_CONTRACTS | 4 | mock | 缺 docs/contracts/ 目录或零接口（A27：mock 由契约生成，无契约即无可 mock，不写空文件） |
| NO_RENDERER | 4 | render-review / render-prototype | 模板未声明对应渲染器 |
| NO_LIFECYCLE | 4 | model/lifecycle | 缺 docs/lifecycle.json |
| NO_SPEC | 4 | model/spec | 缺 docs/spec.md |
| NO_TEMPLATE | 3 | model/template | 未知模板 id |
| TASK_FM | 2 | model/tasks | 任务 frontmatter 缺字段/取值非法（§6.1） |
| YAML_PARSE | 2 | util/yaml、util/md（vima:* 块） | YAML 受限子集解析失败（含行号） |
| PLAN_DEP | 2 | plan computeBatches | dependsOn 指向不存在的任务 |
| PLAN_CONFLICT | 2 | plan computeBatches | conflictsWith 指向不存在的任务（A8） |
| PLAN_CYCLE | 2 | plan computeBatches | 依赖成环（message 含环路径） |
| PLAN_PARALLEL | 2 | plan | --max-parallel 取值非整数或不在 1–10（A18） |
| CONTEXT_BUDGET | 2 | context | 上下文包总字节超出 --budget 预算（A8；包仍写盘） |
| BAD_RENDERER | 1 | render-review / render-prototype | 渲染器缺少约定导出 |
| YAML_STRINGIFY | 1 | util/yaml | 超出 YAML 子集无法序列化 |
| LIFECYCLE_PARSE | 1 | model/lifecycle | lifecycle.json JSON 解析失败 |
| MANIFEST_PARSE | 1 | model/manifest | manifest.json JSON 解析失败 |
| TEMPLATE_PARSE | 1 | model/template | template.json JSON 解析失败 |

## 4. lib/util API（F 实现，签名冻结）

```js
// lib/util/errors.mjs
export const EXIT = { OK: 0, ERROR: 1, CHECK_FAILED: 2, USAGE: 3, PRECONDITION: 4 }
export class VimaError extends Error          // (code, message, { path, exitCode })
export function usageError(message)           // → VimaError('USAGE', …, exit 3)
export function checkFailed(code, message, path)   // → exit 2
export function precondition(code, message, path)  // → exit 4
export function formatError(cmd, err)         // → `vima <cmd>: <CODE>: <message> (<path>)`
export function usageFromParseArgs(err)       // node:util parseArgs 异常 → 中文 usageError（§3）

// lib/util/fs.mjs
export async function ensureDir(dir)
export async function fileExists(p)            // → boolean
export async function atomicWriteFile(p, content)   // 自动 ensureDir(dirname)，tmp+rename
export function stableStringify(value)         // 深度 key 排序、2 空格缩进、结尾 \n
export async function driftOf(pairs)           // [绝对路径,相对路径,期望内容][] → 漂移单行清单
                                               // （渲染 --check 与 approve 前置 2 共用，A12）
export function sha256(text)                   // → hex string
export async function sha256File(p)
export async function walkFiles(root, { exclude = [] } = {})
// → 相对路径数组（'/'分隔，稳定排序）；exclude 为目录名数组（如 node_modules）

// lib/util/yaml.mjs —— YAML 受限子集（本项目全部结构化数据块/frontmatter 都写在此子集内）
export function parseYaml(text, { path } = {})  // → any；错误 VimaError('YAML_PARSE', ..., {path})
export function stringifyYaml(value)            // 输出同子集，稳定 key 顺序（保持输入顺序不排序）
// 子集：映射 k: v；嵌套靠 2 空格缩进；列表 "- item"（项可为标量/内联对象/嵌套映射）；
// 内联数组 [a, b]；内联对象 { k: v, k2: v2 }（值仅标量）；标量 字符串/数字/true/false/null；
// 单双引号字符串；# 注释；不支持锚点/多行标量/多文档。

// lib/util/md.mjs
export function splitFrontmatter(text)   // → { fm: string|null, body }（--- 围栏，仅文件头）
export function extractBlocks(text, kind)
// 扫描 ```yaml vima:<kind> 围栏 → [{ kind, raw, data, line }]（data 已 parseYaml）
// kind 省略时返回全部 vima:* 块
export function listChapters(text)       // → [{ level, title, line }]（# 前缀标题）
export function hasCheckbox(text)        // → 是否含 "- [ ]" / "- [x]"
```

**A24 新增**：`findProjectRoot(startDir) → string|null`（`lib/util/fs.mjs`）——从 `startDir`
逐级向上查找含 `.vima/` 或 `docs/lifecycle.json` 的最近祖先目录，返回绝对路径；到文件系统根
仍未命中返回 `null`。纯文件系统遍历，不读内容、不写盘。

## 5. lib/model API（F 实现，签名冻结）

```js
// lib/model/tasks.mjs
export async function loadTasks(root)
// 读 docs/tasks/*.md（跳过 _ 前缀与 README.md）→ [{ file, id, fm, body }]
// fm 必含 taskId,title,status,layer,side,dependsOn,retryCount,updatedAt（contract 可选）
// 缺字段 → VimaError('TASK_FM', ..., {path})；status/layer/side 取值非法同上
export async function saveTaskFrontmatter(task, updates)  // 整体重写 frontmatter，保留 body

// lib/model/lifecycle.mjs
export function defaultLifecycle(templateId)   // §14.2 结构，currentPhase=PLANNING，
                                               // phaseHistory 含 BOOTSTRAP（completedAt 由调用方填）
export async function loadLifecycle(root)      // 缺文件 → VimaError('NO_LIFECYCLE', exitCode 4)
export async function saveLifecycle(root, obj)

// lib/model/spec.mjs
export async function loadSpec(root)  // 读 docs/spec.md →
// { text, chapters, entities, enums, pages, roles, menus, flows }
// pages: Map<PAGE-xx, pageData>（vima:page 块）；roles/menus 数组；flows 数组；
// entities/enums 来自 vima:entities 块。docs/spec.md 缺失 → VimaError('NO_SPEC', exitCode 4)

// lib/model/contracts.mjs
export async function loadContracts(root)  // 读 docs/contracts/*.md（跳过 _ 前缀）→
// [{ file, module, apis: [{ method, path, request, response, errors }] }]（vima:contract 块）
export function apiKey(api)               // → `${method} ${path}`（method 大写）

// lib/model/manifest.mjs
export async function loadManifest(root)       // .vima/manifest.json；缺 → null
export async function saveManifest(root, m)

// lib/model/template.mjs
export function templatesRoot(cliRoot)         // → <cliRoot>/templates
export async function listTemplates(cliRoot)   // → [{ id, name, status, description }]（按 id 排序）
export async function loadTemplate(cliRoot, id) // → template.json 对象 + { dir }；未知 id → VimaError('NO_TEMPLATE', exit 3)
export async function readProjectTemplateId(root) // manifest.templateId ?? lifecycle.templateId ?? null

// lib/model/apps.mjs（A16 端册解析，Wave 1 新建）
export async function resolveApps(root, { cliRoot })
// → { multi: boolean,                                  // 端数 >1
//     apps: [{ id, name, kind, dir, codeDir, sharedDirs }],   // sharedDirs 相对各自 dir
//     backend: { dir, sharedDirs } | null,
//     kinds: { <kind>: { layoutVocab, regions, shell, status } } }
// 解析顺序：manifest v2 apps/backend → v1 manifest/模板合成默认单端端册
// （admin：dir "."、codeDir "src"、现行 sharedDirs 字面量）→ 无前端模板（cli/lib/script）
// 返回 apps: []。kinds 取 template.planning.kinds，缺省内置 admin-web（现行 7 词词表）。
// 全部消费方（validate/trace/context/render/guard/doctor）经本函数取端信息，禁止旁路硬编码。
export function appOf(entry, roster)      // entry.app ?? 单端唯一 id ?? null（多端未声明 → 校验报错）
export function consumersOf(api, roster)  // api.consumers ?? 单端 [唯一 id] ?? null
```

## 6. 文件格式 Schema

### 6.1 任务 frontmatter（§9.2，YAML 子集）

```yaml
---
taskId: device-list-fe        # ^[a-z0-9][a-z0-9-]*$
title: 设备管理列表页（前端）
status: pending               # pending|running|done|failed|blocked
layer: business               # shared|business|pipeline
side: frontend                # frontend|backend|fullstack
dependsOn: [shared-base]      # 可为空数组
retryCount: 0
contract: docs/contracts/device-api.md   # admin 业务任务必填；pipeline 可省
page: PAGE-01                 # A2：前端页面任务引用 spec 页面块（可选字段）
app: patient                  # A16：任务归属端。多端项目 side=frontend|fullstack 必填（∈ 端册）、
                              # side=backend 禁止携带；单端项目可省略（= 唯一端）。V-TASK-10
conflictsWith: [user-list-fe] # A8 可选：与这些任务共享代码路径，plan 保证不同批并行；
                              # 字符串数组，引用必须存在（V-TASK-04 / PLAN_CONFLICT）
apis: ['GET /api/foods', 'POST /api/foods']   # A18 可选：本任务负责的契约接口子集。
                              # 缺省 = 负责该契约全部接口（向后兼容）。条目形如 `METHOD /path`，
                              # 归一后须 ∈ 契约 apis；同契约 backend 任务两两不相交、
                              # 全声明时并集 = 契约全集（V-TASK-12）。规模上限 V-TASK-11。
                              # 声明时 `vima context` 按此切片契约人读小节与机读条目
updatedAt: 2026-08-12T10:00:00Z
---
```

### 6.2 docs/lifecycle.json（§14.2 原样）

`schemaVersion:"2.0"`、`vimaVersion`、`templateId`、`currentPhase`
（BOOTSTRAP|PLANNING|**DESIGNING**|DEVELOPING|MAINTAINING，A34）、`phaseHistory[]`、
`checklists.PLANNING`（rawDocsCollected, modulesConfirmed, specGenerated, contractsGenerated,
tasksDecomposed, artifactsValidated, reviewRendered, prototypeRendered, tasksApproved —— 全 boolean，
approve 额外写 `tasksApprovedAt`）、`checklists.DEVELOPING`（sharedLayerDone, businessTasksDone,
pipelineDone, testsPassed, codeAudited）、`taskStats{total,done,failed,blocked,updatedAt}`。

**A34 加性四组状态**（存量 lifecycle 缺能力标记时按 legacy 处理，D-A34-18 不倒退阶段）：

- `designCapability`：`'a34' | 'legacy'`。新建项目为 `a34`；pre-A34 项目缺此键 ⇒ 按 `legacy`，
  V-DSN-12 与 approve 的设计闸门整体豁免（A19 存量可达性）。
- `checklists.DESIGNING` —— **只有两个持久键**：`briefReady`、`directionsExplored`
  （人工里程碑，无从推导）。其余**六项一律不落盘**，由 `vima design status/check`
  每次从 spec、设计目录 manifest、`designApproval` 摘要确定性派生：
  `directionApproved`、`signaturePagesApproved`、`fidelityClassified`（V-DSN-12）、
  `designArtifactsComplete`（V-DSN-09）、`designApprovalFresh`（digest）、`designSystemFrozen`。
  **落盘就会与 `designApproval` 表达同一事实，退回 A2 的双真源问题**——这是 A34 自己要治的病。
- `designApproval`：`{ directions: { <appId>: {approvedAt, digest} },
  pages: { <pageId>: {approvedAt, fidelity, specDigest, designDigest, downgradeWaiver?} } }`
  ——**唯一持久化批准状态**。批准后的保真降级必须由用户显式给出 `--allow-downgrade`
  与非空 `--reason`，理由随页面批准留痕。
  按端存 `directions`（A0 已改按端发散，多端各选方向时单数键表达不了）。
  作废时另写 `designApprovalInvalidatedAt` / `designApprovalInvalidatedReason`（留痕，不许悄悄清空）。
- `designScope.pages[]`：仅 legacy 项目使用的局部 A34 页面集合。`vima change apply` 遇到新增/修改
  页面时将受影响页并入 scope、作废相关页批准与 `tasksApproved`、转入 DESIGNING；删除页从 scope 移除。
  新建 A34 项目由 `designCapability: a34` 覆盖全页，不复制一份全量 scope。

**方向冻结包**：每端固定落 `docs/review/design/_shell/<appId>/`，必须包含
`brief.md`、`direction-a.png`、`direction-b.png`、`direction-c.png`、`comparison.md`、
`selection.md` 与 `manifest.json`；manifest 的 `appId` 必须匹配端册 id，`files` 必须声明前六项。
`vima design approve direction` 在包不完整、路径不安全或文件缺失时 exit 4，不得记录 `digest:null`。

**阶段推进事件表（D-A34-28）**——谁推进哪一段，是状态机语义、属确定性内核职责：

| 迁移 | 由谁推进 | 闸门 |
|---|---|---|
| PLANNING → DESIGNING | `vima approve --planning` | 独立校验 profile：spec/契约/权限/pendingConfirm + V-DSN-10/11/12，**不要求 V-TASK-\*/V-COV-01**（任务拆解发生在设计冻结之后）；同时建立 `.vima/changes/designing-baseline/` 快照 |
| DESIGNING 内部 | `vima design approve direction` → `vima design reconcile`（仅当方向改了产品）→ `vima design approve pages` | 人工裁定 + 受控回写 |
| DESIGNING → DEVELOPING | `vima approve` | 原三道前置 + **设计闸门六项派生全绿** |

`currentPhase` 的消费方必须整体同步（漏一个即状态机分叉）：
`lib/model/lifecycle.mjs`（`PHASES` 单一真源）、`lib/commands/{init,doctor,approve,design,change}.mjs`、
`templates/*/workspace/commands/{go,design}.md`、`templates/*/workspace/hooks/guard-shared.mjs`。

> **`guard-shared.mjs` 的契约保护相位是明示决定**：该 hook 只在 **DEVELOPING** 追加保护
> `docs/contracts/**`；**DESIGNING 必须维持「不保护」**，否则 `vima design reconcile`
> 的契约回写被 hook 直接锁死。它的默认行为恰好正确——正因如此才容易被「好心」改错。

### 6.3 template.json（§3.4 精化）

```json
{
  "id": "admin", "name": "管理后台", "status": "stable|preview",
  "description": "...", "version": "2.0.0",
  "techStack": { "frontend": "...", "backend": "...", "database": "..." },
  "prerequisites": [
    { "tool": "node", "check": "node --version", "constraint": ">=20" },
    { "tool": "java", "check": "java --version", "constraint": ">=21", "optional": true,
      "hint": "缺失不阻断创建，但无法本地运行后端" }
  ],
  "apps": [
    { "id": "admin", "name": "管理后台", "kind": "admin-web", "default": true,
      "scaffold": "scaffold/frontend", "uiDocs": "ui-docs", "codeDir": "src",
      "sharedDirs": ["src/components", "src/utils", "vendor"] },
    { "id": "patient", "name": "患者端", "kind": "mp-native",
      "scaffold": "scaffold/mp-native", "uiDocs": "ui-docs-vm", "codeDir": "src",
      "sharedDirs": ["src/components", "src/utils"] }
  ],
  "backend": { "scaffold": "scaffold/backend", "dir": "backend",
               "sharedDirs": ["src/main/java/com/{{projectPkg}}/config",
                              "src/main/java/com/{{projectPkg}}/security"] },
  "planning": {
    "guide": "planning/planning-guide.md",
    "spec": "planning/spec.admin.md",
    "designLanguage": "planning/design-language.md",
    "codingStandards": "planning/coding-standards.md",
    "checklist": "planning/validate.checklist.md",
    "contractExample": "planning/contract.example.md",
    "coverageExample": "planning/coverage-matrix.example.md",
    "taskTemplates": ["planning/_template-fe.md", "planning/_template-be.md",
                      "planning/_template-full-test.md", "planning/_template-code-audit.md"],
    "renderers": { "review": "planning/audit-view.mjs", "prototype": "planning/prototype.mjs" },
    "prototype": true,
    "kinds": {
      "admin-web": { "layoutVocab": ["toolbar","search","table","form","cards","tabs","pagination"],
                     "regions": true,  "shell": "desktop-admin", "status": "stable" },
      "mp-native": { "layoutVocab": ["search","list","cards","form","tabs","banner","detail","actionbar"],
                     "regions": false, "shell": "phone-tabbar",  "status": "preview" }
    },
    "goPrerequisites": ["docs/spec.md", "docs/contracts", "docs/tasks/README.md",
                        "docs/coverage-matrix.md", "docs/review/index.html",
                        "docs/review/prototype.html"]
  },
  "workspace": "workspace"
}
```

**A16 端册化**：`apps[] + backend` 取代旧顶层 `scaffold`/`sharedDirs`/`codeDirs` 三键
（sharedDirs 一律相对各自 dir；`backend.dir` 缺省 `"backend"`；app 条目**不含 dir**——
落地目录由 create 计算写入 manifest：**一律 `apps/<id>/`**（A28，改判 D-A16-03 的按 N 分叉；
改判前创建的 N=1 项目为 `"."`，仍合法）。可选顶层键 `root.scaffold`（A28 D-A28-04）：
项目根卫生资产源目录（项目级 `.gitignore`/`README.md`），create 以 destKey 项目根拷贝、
进 A19 骨架基线；骨架遍历一律排除 `node_modules`/`target`（构建产物防污染）。
loader 兼容旧三键（合成单端端册），新模板一律写新形态。`planning.kinds` 是
**词表/分栏能力/原型外壳/kind 成熟度的唯一真源**（V-SPEC-04/12 与渲染器同源于此，
词表从 validate 代码常量迁出）；kind `status: preview` = PLANNING 全流程可用、
create/app add 跳过骨架拷贝并显式警告（A5 分级下推到 kind）。`apps[].default: true`
标记 `--apps` 缺省时的端册（admin 模板缺省仅 admin 端）。
kinds 条目另可带 **`componentMap`**（A16：布局词/控件 type → 组件文档名数组，
`vima context` 组件切片的映射真源；admin-web 可省略 = lib 内置现行缺省表，
mp-native / h5-mobile 随 ui-docs 显式声明——无表则该端切片恒空，即半截实现）。
`componentMap` 另认一个**非词表键 `modal`**（A23）：页面声明 `modals` 时注入的弹层
组件名。缺省 `['VLayer']`（admin-web 现行行为），mp/h5 端为 `['VmPopup']`——
原实现把 `VLayer` 硬编码在 `componentsOfPage` 里，绕过了 componentMap 这个真源，
等于该端弹窗切片恒空。同理弹窗字段的 `type` 映射也走 componentMap，不再走内置表。
两个 mobile kind（`mp-native` / `h5-mobile`，A25）共用同一份 `layoutVocab`、
`shell: phone-tabbar` 与 `componentMap`——同一种手机形态不该有两套词表。
**goPrerequisites 的多端展开（A16）**：清单保持模板级静态；消费方（doctor 漂移检查、
approve 前置、go.md 文案）遇 `docs/review/prototype.html` 条目时经 resolveApps 展开为
逐端 `prototype.<appId>.html`（单端项目即旧名，零变化）——静态清单不得直接按字面
路径检查，否则多端项目假阻塞。

v2.0.0 骨架**只用内置 builtin 目录拷贝**（不执行 npm create/spring init 外部命令——
偏离 §3.5，理由：确定性与离线可测，记入偏离清单）。preview 模板可省 planning/workspace 字段。
**sharedDirs 是共享层保护面的单一真源**：guard-shared.mjs 的目录判定与全部红线文案
（CLAUDE.project.md / vima-builder.md / 任务模板约束重申）必须与它同步——设计 §10.7 的
`src/hooks/、src/types/、backend common` 属旧口径，v2.0 裁定以骨架真实目录为准
（前端 components/utils/vendor；后端 config/security 包）。
`planning.codingStandards` → init 安装为 `docs/coding-standards.md`（managed，
§5.2「详细规范」指针的落点）。
`planning.designLanguage`（**A30**，可选键）→ init 安装为 `docs/design-language.md`
（**userOwned**，变量替换，与 spec 同口径）：缺省风格取向（house style）+ 五条取向轴
的项目定档位 + Stage A 版面模式库容器。三者都是项目自己的决定，故 update 永不覆盖。
**纯文档资产**：不进 schema、不进机检、无渲染消费方（A30 D-A30-05）；缺此键的模板
（preview 四模板）不安装该文件，行为逐字节不变。
模板变量：拷贝 scaffold 时替换文件内容与文件名中的 `{{projectName}}`、`{{projectPkg}}`
（projectName 去掉非字母数字后的小写形式）、`{{createdAt}}`；**A16 增 `{{appId}}`**——
create/app add 按端拷贝各 app scaffold 时注入该端 id（backend 与单端根布局同样注入其
归属 id），骨架用它命名 A7 上报文件（§6.10）等自身份场景。
（曾有 `{{projectAbbr}}` 供侧栏 Logo 缩写，英文缩写对使用者无语义，已改为图标并删除该变量。）
落地改名规则：scaffold 源文件名 `_gitignore` 拷贝到生成项目时改名为 `.gitignore`
（npm 发包会剥离 `.gitignore` 文件，模板侧用下划线名规避）。

### 6.4 .vima/manifest.json（§4.5）

```json
{ "schemaVersion": "2", "vimaVersion": "2.0.0", "templateId": "admin",
  "initializedAt": "<ISO>", "createdAt": "<ISO>",
  "apps": [ { "id": "admin", "name": "管理后台", "kind": "admin-web",
              "dir": ".", "codeDir": "src",
              "sharedDirs": ["src/components", "src/utils", "vendor"] } ],
  "backend": { "dir": "backend",
               "sharedDirs": ["src/main/java/com/myapp/config",
                              "src/main/java/com/myapp/security"] },
  "install": { "minimal": false, "skipScan": false },
  "files": { "managed": [{ "path": ".claude/commands/go.md", "checksum": "sha256:<hex>" }],
             "scaffold": [{ "path": "src/App.vue", "checksum": "sha256:<hex>" }],
             "userOwned": ["CLAUDE.md", "docs/spec.md", "docs/design-language.md",
                            "docs/contracts/", "docs/tasks/",
                            "docs/raw/", "docs/coverage-matrix.md"] } }
```

**A16 端册（schemaVersion "1" → "2"）**：`apps[]`/`backend` 由 create 写入（`{{projectPkg}}`
等变量已渲染为具体路径；sharedDirs 相对各自 dir）。create 写入的 dir **一律 `apps/<id>/`**（A28；
改判前的单端项目为 `"."`——存量布局不迁移）；存量根布局与 `vima app add` 后补端
形成的混合布局**永久合法**（dir 是数据，消费方经 resolveApps 无感）。v1 manifest（无 apps 键）由 resolveApps 合成默认端册，
`vima update` 迁移为 v2。**（A19 落实）**：update 检测到缺 `apps` 键时，把 `resolveApps`
合成的端册写入并置 `schemaVersion: "2"`；**后端共享层按模板 `backend.sharedDirs` 渲染且逐个
校验目录在位**，缺一个就整体放弃迁移（保持 v1）——因为 guard-shared 对 v1 走内置字面量兜底、
写入 apps 后改走 v2 分支且不再回退，写出空 sharedDirs 会使后端共享层失去全部保护。**create 在已有 manifest 的目录 `--force` 重跑时合并端册与
files，不得清空**；templateId 不同 → TEMPLATE_MISMATCH exit 4（§3.1）。

**A18 `install` 键**：init 写入本次安装形态（`--minimal` / `--skip-scan`）。`vima update` 据此
重建与本项目形态一致的计划，从而能判断「模板新增的受管文件」该不该装；旧 manifest 无该键时
按已记录文件**确定性反推**（无任何 `docs/` 条目 = minimal；有 `docs/` 但无 `docs/ui-framework/`
= skip-scan），反推结果由 update 固化写回。
**A19 `files.scaffold` 骨架基线**：`vima create` 记录每个骨架文件**落盘后实际内容**的 sha256
（变量已渲染、`_gitignore` 已改名为 `.gitignore`、路径一律 `/` 分隔），`--force` 重跑时按本次落盘重建。
供 `vima update --scaffold-diff` 做三方比较（基线／磁盘现状／当前模板源用同一组变量重渲染）：
磁盘==基线且模板≠基线 → 可安全更新；两者皆≠基线 → 需人工；其余不列。
**该子模式只产报告、不写任何文件**（骨架即用户业务代码）；无基线的存量项目如实说明能力边界，不猜。
渲染/改名/文本判定由 `create.resolveScaffoldEntries` 单一实现，写盘路径与哈希路径同源，防两份逻辑漂移。**init 对 manifest 是合并写**：create 写入的
`apps`/`backend`/`schemaVersion` 等既有键原样保留（整体覆盖会把多端项目降级成 v1，
resolveApps 合成的默认端册与真实布局不符）。**init 不重写 `docs/lifecycle.json`**：
状态不是生成物，已存在则保留并提示（`--force` 的语义是重建生成物，不是清空进度）。

init 安装清单的 managed 部分含 `AGENTS.md`（← workspace/AGENTS.project.md 变量替换，
A8 跨工具指针文件：声明真源为 CLAUDE.md + 三条最低红线，用户定制走 CLAUDE.md）、
`docs/ui-framework/**`（组件文档：CAPABILITY.md 索引档 + ICONS.md 图标清单 +
llms-full.txt 单文件全量档 + 每组件一份
`<Name>.md`，拷自模板 `ui-docs/`，生成自组件库 `api.generated.json`），全量计入校验和；
`--skip-scan` 表示跳过这套拷贝。**A16 多端**：init 按端册逐端拷入
`docs/ui-framework/<appId>/**`（源 = 各 app 条目的 `uiDocs` 目录；单端项目保留
平铺旧形态，`vima context` 两种形态都认——按端目录优先、平铺回退）。managed 另含 `docs/coding-standards.md`（§6.3 codingStandards）。
init 额外接受 `--template/-t <id>`（仅当项目无 manifest/lifecycle 记录时用于指定模板；
两处都取不到且未给 → usage exit 3）。lifecycle 与 manifest 的 `vimaVersion` 同源于
CLI package.json（init 写入时覆盖模型层缺省值）。

### 6.5 .vima/reports/batch-plan.json（plan 输出）

```json
{ "schemaVersion": "1",
  "batches": [ { "index": 0, "layer": "shared", "level": 0, "mode": "serial", "tasks": ["shared-base"] },
               { "index": 1, "layer": "business", "level": 0, "mode": "parallel", "tasks": ["a","b"] } ],
  "maxParallel": 8,
  "stats": { "total": 0, "pending": 0, "done": 0, "failed": 0, "blocked": 0, "running": 0 } }
```

`level`（A18）：批次的**依赖层号**，同 layer 内 level 相同的批次之间**没有任何依赖**
（它们是同一拓扑层因并行度上限被贪心切开的子批）。主 Agent 据此确定性判断
「上一子批的 Verifier 可与下一子批的 Builder 同轮派发」，不靠推断。
shared/pipeline 每任务一批，level 取其组内拓扑序号（各不相同 ⇒ 天然不流水线化）。
`maxParallel`：默认 **8**（A18，原 5），可由 `vima plan --max-parallel <1..10>` 覆盖。

### 6.6 .vima/reports/trace.json（A1 吸收项，trace 输出）

```json
{ "schemaVersion": "1",
  "markers": [ { "taskId": "device-list-fe", "file": "src/api/device.ts", "line": 3 } ],
  "wild": [ { "taskId": "unknown-id", "file": "...", "line": 9 } ],
  "unmarked": [ "device-api-be" ],
  "summary": { "markers": 3, "wildTaskIds": 0, "doneWithoutMarker": 1 } }
```

### 6.7 docs/review/prototype.manifest.json（§13.3）

```json
{ "schemaVersion": "1",
  "pages": [ { "id": "PAGE-01", "title": "设备列表", "menu": "MENU-01",
    "layout": ["search", "toolbar", "table", "pagination"],
    "components": [ { "block": "toolbar",
      "items": [ { "type": "button", "label": "新增", "action": "modal", "target": "MODAL-01" } ] } ],
    "modals": [ { "id": "MODAL-01", "title": "设备表单",
      "fields": [ { "field": "name", "label": "设备名称", "type": "input", "required": true } ] } ],
    "links": [ { "kind": "nav|modal|api", "from": "PAGE-01", "to": "PAGE-02 或 MODAL-01 或 GET /api/x" } ] } ] }
```

pages 按 id 排序、links 按 (kind,to) 排序——保证字节稳定。

页面声明 `regions`（A14 分栏）时，条目内 `layout` 之后追加同名 `regions` 键（原样透传）；
未声明的页面**不写该键**，因此既有 manifest 字节不变（HTML 侧因样式表新增会变动一次）。`regions` 只描述版面分栏，
不参与任务点计数（口径仍为 components 交互数 + modal 字段数）。

**A16 多端**：HTML 产物按端拆分为 `docs/review/prototype.<appId>.html`（单端项目保留
旧名 `prototype.html`）；manifest 仍单文件，顶层由 `pages` 改为
`apps: { "<appId>": { "pages": [...] } }`（apps 按 id 排序；页面条目结构不变，
**N=1 同样用新形态**——两种内层结构并存是双真源）。消费方同步：Verifier 对账、
approve 新鲜度机检（逐端产物）、post-write 区块标记对账（§14）。外壳按 kind：
admin-web 沿用桌面侧栏外壳；mp-native 为 375px 手机框 + 底部 tabbar
（取该端 vima:menus）。侧边栏/tabbar/外壳一律不进 manifest（既有约定不变）。

### 6.8 .vima/reports/planning-validation.json（validate 输出）

`{ "schemaVersion":"1", "pass": bool, "errors": [{rule, message, path}], "warnings": [...],
  "pendingConfirm": [{ "where": "PAGE-01.components[2]", "path": "docs/spec.md" }] }`

### 6.9 .vima/reports/<taskId>-{builder,verifier}.json（子代理报告，D2 资产产出）

```json
// builder（vima-builder.md 产出）
{ "taskId": "...", "status": "completed|failed",
  "files": ["..."], "acceptance": { "total": 0, "passed": 0 },
  "sharedChangeRequest": null, "notes": "..." }

// verifier（vima-verifier.md 产出；round 从 1 起）
{ "taskId": "...", "round": 1, "result": "pass|fail",
  "checklist": [{ "item": "...", "passed": true, "evidence": "文件:行号" }],
  "points":    [{ "point": "toolbar/新增 → modal MODAL-01", "passed": true, "evidence": "文件:行号" }],
  "missing": ["..."], "contractViolations": ["..."] }
```

**points 为逐任务点判定（B1）**：带 `page` 的前端任务**必填**——从
prototype.manifest.json 该页条目逐点展开（components 的每个 item 与 rowAction、
每个 modal field、每条 link 各一条），每点独立给证据；其他任务可省。
`/check` 聚合全部报告的 points 输出任务点级完成度（B2）；报告是审计与
增量修复的依据，Agent 不得只写任务级结论。

**A13 扩展（不改 schema，复用 points）**：上下文包「业务规则切片」里的每条
`RULE-xx` 各占一条 point（`point: "RULE-xx <desc 摘要>"`），**前后端任务同样必填**
——规则不分前后端。发现实现触碰「本期不做」时，追加一条
`point: "NG-xx 越界：<越界处>"` 且 `passed: false`（越界不适用 waived——
要豁免应先改 spec 第九章，让边界回到真源）。

**豁免语义（A8）**：checklist/points 条目可带 `waived: true` + 非空 `reason`
（必须写明豁免理由与用户裁定来源）。waived 条目不算 fail、不阻塞 result=pass；
`/check` 按 通过/豁免/未过 三分计数并逐条列出豁免点。**Verifier 不得自行发明豁免**
——没有用户明确裁定的未实现项照常 fail。

### 6.10 .vima/reports/runtime-errors.jsonl（A7 运行时证据，admin 骨架产出）

JSON Lines（每行一个 JSON 对象），由骨架 vite dev 中间件 `/__vima/runtime-error`
接收浏览器侧上报追加写入；服务端补 `receivedAt`（真实时间戳，允许 new Date）：

```json
{ "kind": "error|unhandledrejection|vue", "message": "...",
  "source": "文件:行:列（kind=error 时）", "info": "Vue errorInfo（kind=vue 时）",
  "page": "/pathname?search#hash", "receivedAt": "<ISO>" }
```

- 上报端（骨架 main.ts，仅 `import.meta.env.DEV`）：window error / unhandledrejection /
  Vue app.config.errorHandler 三通道；同错误去重、每次页面加载最多 20 条（防错误风暴）。
- 消费端：`/check` 报告条数与最近条目；Verifier 验收带 page 任务时可按 `page` 字段取证。
- 文件在 `.vima/reports/`（骨架 .gitignore 已忽略）；排查完成后可直接删除，随时重建。
- 构建产物（vite build）不含上报代码路径（插件 apply: 'serve' + DEV 守卫）。
- **A16 多端**：文件按端拆分为 `runtime-errors.<appId>.jsonl`（单端项目保留旧名）。
  admin-web 端机制如上；mp-native 端（Wave 2）由 miniprogram-automator 驱动微信
  开发者工具采集 `App.onError` / 未捕获 rejection 落同构 JSONL；开发者工具不在场时
  **不捕获**——诚实降级，`/check` 如实报「该端无运行时证据通道」，不宣称做不到的事。
  文件名由骨架用 `{{appId}}` 变量（§6.3）在 create 时固化；多端布局下骨架的
  dev 采集器**向上定位项目根**（含 `.vima/` 的最近祖先目录）再写
  `.vima/reports/`——不得假设 dev server cwd 即项目根。

### 6.11 .vima/context/<taskId>.md（A8，`vima context` 输出）

任务开工的**确定性上下文包**（单 markdown 文件，无时间戳，字节稳定）：

```
<!-- 生成说明注释（真源变更后重跑重建） -->
# 任务上下文包：<taskId> — <title>
（分节字节计量表）
## 任务文件（docs/tasks/<id>.md）        ← 原文全文（frontmatter + body）
## 契约（<fm.contract>）                 ← 契约文件原文；缺失时标注跳过
## spec 页面块（PAGE-xx）                ← 该页 vima:page 块原文（yaml 围栏）；无 page 字段跳过
## 组件文档切片                          ← 按受限词表映射出的组件，各附 docs/ui-framework/<名>.md 全文
## 业务规则切片                          ← A13：按 apis 交集过滤的 vima:rules 条目 + 全局规则；spec 缺失时标注跳过
## 本期不做（范围红线）                  ← A13：vima:non-goals 全量；空清单渲染为「本期无 non-goals 声明」
## 系统底座接口索引                      ← A22：**无 @vima 标注**代码（= 底座/共享层）提供的能力：
                                            各端 <dir>/<codeDir>/api/** 的导出函数名 + 请求路径、
                                            后端无标注 controller 的 Mapping 路径。只出名字与路径，
                                            不贴实现（字节预算是硬约束）。无命中时渲染一句说明
## 真源片段                              ← A22：spec 已纳入本包的文本中形如 `docs/raw/<路径>` 的引用
                                            （可带 :行号 / :起-止），附被引用文件片段。带行号取该行
                                            前后各 20 行，不带行号取整文件；单文件上限 8 KB，超出截断注明
## 编码规范（docs/coding-standards.md）  ← 原文；缺失时标注跳过
## 项目补充规范                          ← A24：`docs/coding-standards.local.md` 存在时附于此。
                                            **不入 manifest、不受管、doctor 不校验**——受管的
                                            coding-standards.md 是唯一随 context 分发到每个任务的
                                            规范文件，项目往里加内容会让 doctor ⑧ 长期报「被手改」；
                                            本节让项目定制不污染受管基线。init 不创建它（按需新建）
```

**业务规则切片的过滤口径**（A13，确定性无启发式）：任务 apis 集合 =
`fm.page` 对应 `page.apis` ∪ `fm.contract` 对应契约的全部 apis；规则入选 ⟺
该规则**无 `apis` 字段**（全局规则），或 `rule.apis ∩ 任务 apis 集合 ≠ ∅`。
接口串归一同 V-SPEC-07（method 大写 + 单空格）。输出按 `id` 升序，同一任务同一输入
必得同一字节。**本期不做**不过滤（范围红线对每个 Builder 一律可见）。

**受限词表 → 组件映射**（打包切片的唯一依据，与 spec 词表同步演进）：
block：table→VTable；pagination→VPagination；search/form→VForm+VFormItem；
tabs→VTab+VTabItem；cards→VCard；toolbar→VButton。
item/field type：input→VInput；select→VSelect；textarea→VTextarea；number→VInputNumber；
date→VDatePicker；time→VTimePicker；radio→VRadioGroup+VRadio；
checkbox→VCheckboxGroup+VCheckbox；switch→VSwitch；button→VButton；upload→VUpload；
tree→VTree。modals 非空 → 追加 VLayer。未知词静默跳过（词表由 V-SPEC-04 把关）。

**契约切片口径**（A18，仅当任务 frontmatter 声明 `apis` 时启用；确定性无启发式）：
契约原文按 `^##\s+<METHOD>\s+<path>` 小节切开——**不属于本任务负责集的接口小节整段删除**，
非接口小节（头部说明、错误码表、文末 `vima:contract` 块之外的正文）原样保留；
文末 `vima:contract` 块的 `apis` 数组同步过滤为负责集，其余键不动。
小节标题的多接口写法（`## GET /a / POST /b`，见既有契约）按 `/` 拆开逐个判定，
**任一接口属于负责集即整段保留**（保守侧，宁多勿漏）。未声明 `apis` 时零改变。

stdout 输出分节字节计量与总字节；`--budget <bytes>` 总字节超限 → 包仍写盘（便于排查）
但 CONTEXT_BUDGET exit 2；`--stdout` 打包内容直接输出不写盘。文档缺失（如规划期无
docs/ui-framework）一律「标注跳过」不报错——存在性问题归 validate/doctor。

### 6.12 .vima/go-state.json（A18，/go 停因状态；主 Agent 写，Stop hook 读）

```json
{ "schemaVersion": "1",
  "phase": "DEVELOPING",
  "stopReason": "in-progress",
  "consecutiveResumes": 0,
  "updatedAt": "2026-08-13T12:00:00Z" }
```

| 字段 | 说明 |
|---|---|
| `phase` | 写盘时的 lifecycle currentPhase；`≠ DEVELOPING` 时 hook 一律放行 |
| `stopReason` | `in-progress`＝调度未完成（非法停顿，hook 阻止停轮并注入续跑指令）；`budget`／`terminal`／`gate`／`user` ＝ A17 合法停点白名单四项，hook 放行 |
| `consecutiveResumes` | 连续被 hook 续跑的次数；主 Agent 每成功推进 ≥1 个任务后归零；≥ **5** 时 hook 放行并提示（防死循环兜底） |
| `updatedAt` | 写盘时的真实 ISO 时间 |

**hook 判定表**（`.claude/hooks/go-continue.mjs`，「防误不防恶意」——任何不确定一律放行）：

| 情形 | 行为 |
|---|---|
| 文件缺失 / JSON 解析失败 / 字段缺失非法 | 放行（exit 0） |
| `phase ≠ DEVELOPING` | 放行 |
| `stopReason ≠ in-progress` | 放行 |
| `consecutiveResumes ≥ 5` | 放行 + stderr 提示已达续跑上限 |
| 其余（`in-progress` 且未达上限） | 阻止停轮，stdout 输出续跑指令 JSON |

### 6.13 .vima/reports/convergence.json（A20，`vima converge` 输出）

跨任务集成对账报告。**每次扫描的确定性快照**——不含手工状态与豁免字段：
修好了就扫不出来（A20「不做」第 2 条）。

```json
{ "schemaVersion": "1",
  "scope": { "markedBackendFiles": 12, "markedFrontendFiles": 30, "contractApis": 251,
             "skipped": null },
  "summary": { "errors": 2, "warnings": 1, "openPoints": 3, "runtimeErrors": 0,
               "unmarkedDone": 0 },
  "findings": [
    { "rule": "V-INT-02", "level": "error", "key": "GET /api/food/list",
      "owners": ["food-api-be", "diet-api-be"],
      "paths": ["backend/src/.../FoodController.java", "backend/src/.../DietController.java"],
      "message": "接口 GET /api/food/list 在 2 处后端文件重复实现（…）" }
  ],
  "openPoints": [ { "taskId": "order-detail-fe", "point": "RULE-03 …", "kind": "failed" } ],
  "unmarkedDone": ["shared-base"],
  "byTask": { "food-api-be": ["V-INT-02 GET /api/food/list"],
              "diet-api-be": ["V-INT-02 GET /api/food/list"] } }
```

| 字段 | 说明 |
|---|---|
| `scope.skipped` | `null` 或 `"no-marked-backend"`——带 `@vima` 标注的后端文件为 0 时 V-INT-01/02/03 整族跳过（纯前端项目 / 未开工项目不假红） |
| `findings[].owners` | 该 finding 归属的 taskId 数组（责任田判定见 §8 V-INT 组说明）；无法归属时为 `[]` |
| `findings[].paths` | 相关文件相对项目根、`/` 分隔、升序 |
| `openPoints` | 聚合 `.vima/reports/<taskId>-verifier.json` 的 points：`kind` ∈ `failed`（未过）/ `ng`（A13 `NG-xx 越界`，不计豁免）。**豁免（waived）不计入** |
| `summary.runtimeErrors` | `runtime-errors.jsonl` 条数；**只报告不计退出码**（追加式历史含已修复旧条目） |
| `summary.unmarkedDone` | 顶层 `unmarkedDone` 数组的长度 |
| `unmarkedDone` | `status=done` 且 `layer ∈ {shared,business}` 却无任何 `@vima` 标注的 taskId（升序；§10 trace 同口径，内联计算不 shell out）。warn 语义，不计退出码 |
| `byTask` | taskId → 该任务名下 finding 摘要数组，**修复调度的确定性输入**（`/go` 收口闸门按此归组派发，主 Agent 不自行判断派给谁） |

排序：`findings` 按 `rule` → `key` → 首个 `path` 升序；`byTask` 的 key 与数组元素均升序
（`stableStringify` 已保证 key 排序，数组由生成端排）。**同一输入必须字节一致**。

退出码：`errors > 0 || openPoints.length > 0` → 2；`--strict` 时 `warnings > 0` 也 → 2。

### 6.14 .vima/reports/retro.json + docs/retro/vima-feedback.md（A21，`vima retro` 输出）

项目复盘的确定性采集。**离线、只读、默认脱敏**——机读 JSON 与人读 issue 正文同源，
同一输入字节一致（阶段时长取 `phaseHistory` 已落盘的时间戳，**不读系统时钟**）。

```json
{ "schemaVersion": "1",
  "anonymized": true,
  "fingerprint": { "templateId": "admin", "vimaVersion": "3.0.3", "apps": 2,
                   "phases": [{ "phase": "PLANNING", "days": 3 }] },
  "tasks": { "total": 42, "byLayer": {"shared":1,"business":39,"pipeline":2},
             "bySide": {"backend":12,"frontend":27,"fullstack":3},
             "retried": 9, "maxRetry": 2, "failed": 0, "blocked": 0,
             "declaredApis": 12, "conflictsWith": 3 },
  "batches": { "count": 11, "maxParallel": 8, "sizes": [1,8,8,6,2], "levels": 5 },
  "convergence": { "V-INT-01": 0, "V-INT-02": 2, "V-INT-03": 1, "V-INT-04": 5, "V-INT-05": 0,
                   "openPoints": 3, "unmarkedDone": 0 },
  "verification": { "reports": 40, "maxRound": 3, "points": 812, "failedPoints": 3,
                    "waived": 4, "ngViolations": 1 },
  "shared": { "changeRequests": 2 },
  "planning": { "pendingConfirm": 0, "ruleHits": { "V-TASK-07": 12, "V-CON-02": 3 } },
  "runtime": { "errors": 0 },
  "scale": { "pages": 48, "entities": 66, "rules": 31, "nonGoals": 7,
             "contractApis": 206, "matrixRows": 48 },
  "observations": [ { "id": "OBS-retry", "signal": "retried/total = 21%",
                      "note": "…", "target": "docs/tasks/_template-*.md 验收清单粒度" } ] }
```

| 字段 | 说明 |
|---|---|
| `anonymized` | 默认 `true`：产物**只有计数与分布**，不含 taskId / 接口路径 / 页面 ID / 业务规则文本。`--with-ids` 置 `false` 并携带标识（自用仓库时用）。**安全默认值的方向是「泄露要显式」** |
| `fingerprint.phases[].days` | 由 `phaseHistory` 的 `enteredAt`/`completedAt` 差值算出；缺时间戳记 `null`，不猜 |
| `planning.ruleHits` | validate 报告里 error/warn **按规则 id 的命中分布**——哪条规则最常被违反 = 框架引导最缺的地方 |
| `observations` | **阈值驱动的静态表**（条件 → 观察句 + 建议落点），命中才输出。每条 `target` 必须指向 **vima-cli 的框架资产**，不指向业务代码——反哺的是框架，不是项目 |

`docs/retro/vima-feedback.md` 是同一份数据的 issue 正文投影（标题 + 指纹表 + 信号表 +
观察项 + 供人工补充的空白段）。**两者必须同源渲染**，不分别维护。

退出码：0（采集成功）。`docs/tasks/` 不存在 → `NO_TASKS`（exit 4），不写任何文件
（同 plan/converge 守卫）。

### 6.15 .vima/retro-state.json（A21，反哺询问的一次性记录）

```json
{ "schemaVersion": "1", "asked": true, "answer": "yes|no", "askedAt": "<ISO>" }
```

由**主 Agent** 在 `/go` 步骤 6 询问后写入（CLI 不写）。`asked=true` 时同一项目不再自动
弹反哺询问——拒绝一次就不该被反复骚扰。用户主动说「反哺一下」时不受此限。

### 6.16 .vima/mock/contract-mock.json（A27，`vima mock` 输出）

从 `docs/contracts/*.md` 的机读块确定性生成（stableStringify，同输入同字节）：

```json
{ "schemaVersion": "1",
  "apis": [ { "method": "GET", "path": "/api/device/list",
              "datasets": { "default": <resp>, "empty": <resp>, "many": <resp>, "long": <resp> } } ] }
```

- **8 种字段类型 8 条固定规则**（零随机零时间戳）：`string`→`"<name>_<i>"`、`number`→`i`、
  `boolean`→`i%2==0`、`date`→`2026-01-<01+i>`、`datetime`→`2026-01-<01+i>T08:00:00Z`、
  `array`→`[]`、`object`/`json`→`{}`（有 `fields` 子结构则按子字段递归）；enum/options 有值时
  string 取 `values[i % len]`。
- **数据量四档**：`default` 3 行 / `empty` 0 行 / `many` 20 行 / `long` 1 行且 string 字段为
  >120 字定长超长文本——空与超长恰是暴露版面缺陷最有效的两档。响应字段含 `records`/分页语义时
  包 `{ records, total, pageNum, pageSize }`，否则平铺对象（列表判定：GET + response 含 id 类字段
  的启发不做——**只按契约声明**：response 即样本对象；多行仅对 GET 生成，写操作恒 default 单对象）。
- 统一包装 `{ code: 200, message: "ok", data: … }` 由**消费端**（骨架 demo 分支）补，文件本体只存 data。
- 无契约目录/零接口 → `NO_CONTRACTS` exit 4（§3.1 登记）。

### 6.17 .vima/reports/layout-smoke.json（A27，Kimi WebBridge 默认输出）

```json
{ "schemaVersion": "1", "source": "kimi-webbridge", "viewports": [375, 1280, 1920],
  "pages": [ { "route": "/device", "viewport": 1280,
               "findings": [ { "probe": "overflow-x", "selector": ".opt-card", "value": 30 } ] } ],
  "bad": 0 }
```

七探针：`overflow-x`（横向溢出且祖先无滚动容器）/ `void`（无纵向滚动且页底空洞 >120px）/
`clipped`（overflow hidden 裁切）/ `gap`（相邻兄弟间隙 >40px）/ `scale`（gap/padding 计算值
∉ 令牌取值集）/ `overlap`（兄弟盒相交）/ `wrap`（动作行内元素 offsetTop 不一致 = 意外换行）。
默认通道加载 `$kimi-webbridge`，从 `/__gallery` 取业务路由，用 CDP 设置三视口，并在页面
动态导入骨架 `scripts/layout-probe.mjs` 执行同一组探针。`source` 可取 `kimi-webbridge` 或
`playwright`；兼容旧报告，字段缺失时消费方显示 `unknown`。Kimi WebBridge 启动/重试后仍
不可用才运行骨架 `npm run smoke`（`scripts/layout-smoke.mjs`）作为 Playwright 回退。

**诚实降级**：默认与回退通道均不可用，或 dev server 未起 → **不写文件**——空报告会被
读成「跑过且零问题」，比没有更糟（A7 同款纪律）。/check 无报告时如实报「无版面冒烟通道」。

### 6.18 .vima/changes/<changeId>/（A31，`vima change` 变更包）

changeId 形如 `chg-001`（三位序号，取现存最大 +1）。**同一时间只允许一个非 closed
变更包**（CHANGE_ACTIVE）。目录三件套：

```
change.json            # 状态文件（允许真实时间戳，§3 例外）
baseline/docs/spec.md              # open 时的逐字节快照（spec 缺失则不拷、记 null）
baseline/docs/contracts/*.md       # open 时全部契约快照（目录镜像 docs/，供 loadSpec/loadContracts 直读）
impact.json            # 影响面推导产物（无时间戳，同基线 + 同现状 → 同字节）
```

```json
// change.json
{ "schemaVersion": "1", "id": "chg-001", "description": "设备列表增加批量删除",
  "status": "open",                       // open|applied|closed
  "openedAt": "<ISO>", "appliedAt": null, "closedAt": null,
  "baseline": { "spec": "<sha256|null>",
                "contracts": { "docs/contracts/device-api.md": "<sha256>" } },
  "reopened": [],                         // apply 写入：被重开（done→pending）的 taskId 升序
  "closedSourceHash": null }              // close 写入：{ spec, contracts } 现状哈希（同 baseline 形态）
```

```json
// impact.json
{ "schemaVersion": "1", "changeId": "chg-001",
  "spec": { "pages":   { "added": [], "removed": [], "modified": ["PAGE-01"] },
            "menus":   { "added": [], "removed": [], "modified": [] },
            "roles":   { "added": [], "removed": [], "modified": [] },
            "flows":   { "added": [], "removed": [], "modified": [] },
            "rules":   { "added": [], "removed": [], "modified": [] },
            "nonGoals":{ "added": [], "removed": [], "modified": [] },
            "entities":{ "added": [], "removed": [], "modified": [] } },
  "apis": { "added": ["POST /api/device/batch-delete"], "removed": [], "modified": [] },
  "affectedTasks": [ { "taskId": "device-list-fe", "status": "done",
                       "reasons": ["页面 PAGE-01 变更", "契约 docs/contracts/device-api.md 接口变更命中负责集"] } ],
  "reopen": ["device-list-fe"],
  "recheck": ["vima validate", "vima render-review", "vima render-prototype",
              "vima render-matrix", "vima converge"],
  "summary": { "specChanges": 1, "apiChanges": 1, "affectedTasks": 1, "reopen": 1 } }
```

- diff 口径：pages/menus/roles/flows/rules/nonGoals 按 id、entities 按 name、接口按归一键
  （method 大写 + 单空格，同 V-SPEC-07）；`modified` = 条目 `stableStringify` 不等。
  各数组升序，字节确定。
- 受影响任务推导（reasons 逐条留痕）：`fm.page` ∈ 变更页（modified/removed）；
  `fm.contract` 契约的变更键 ∩ 任务负责集（`ownedApisOf`，A18 缺省语义）非空；
  变更规则 `rule.apis` ∩ 任务接口集（page.apis ∪ 契约负责集，A13 context 同口径）非空；
  **全局规则变更 → 全部 business 任务**。`reopen` = 受影响 ∩ `status=done`。
- `recheck` 静态推导：validate 恒在列；spec 任一类变更 → render-review / render-prototype；
  页面或接口变更 → render-matrix；任务或接口受影响 → converge。
- 子命令行为：`open` 建包（描述必填）；`impact` 只重算并写 impact.json；`apply` = 重算 +
  重开 reopen 清单（saveTaskFrontmatter：status→pending、updatedAt 刷新）+ 回写 reopened/
  appliedAt/status=applied；`close` = 重算 + 三重闸门（①受影响任务全 done ②进程内
  `validateProject` 零 error ③存在 reopen 或接口变更时进程内跑 converge 且 exit 0）→
  通过写 closedSourceHash/closedAt/status=closed，否则 CHANGE_UNPROPAGATED exit 2；
  `list` 打印全部包（id/状态/描述/影响计数）。baseline 保留不删（审计证据）。

### 6.19 .vima/reports/certify.json（A32，`vima certify` 输出）

只读证据聚合，**无时间戳，同输入同字节**；exit 恒 0（评估不是闸门）。
`docs/tasks/` 缺失 → NO_TASKS exit 4，不写文件。

```json
{ "schemaVersion": "1",
  "templateMaturity": "stable",           // A5 template.json status；模板不可解析时 null
  "deliveryLevel": "spec-approved",       // none | spec-approved | implemented | converged | pipeline-green
  "notCertified": "deployable/stable 需要部署环境与运行期证据，vima 不采集、也不认证",
  "levels": [
    { "level": "spec-approved", "satisfied": true,
      "evidence": ["docs/lifecycle.json checklists.PLANNING.tasksApproved=true (tasksApprovedAt 2026-08-14T00:00:00Z)"],
      "missing": [] },
    { "level": "implemented", "satisfied": false, "evidence": [],
      "missing": ["任务未 done：device-list-fe（共 3 个）", "缺 Verifier 通过报告：device-api-be"] },
    { "level": "converged", "satisfied": false, "evidence": [],
      "missing": ["未生成 .vima/reports/convergence.json（先跑 vima converge）"] },
    { "level": "pipeline-green", "satisfied": false, "evidence": [],
      "missing": ["pipeline 任务未全部 done：full-test"] } ] }
```

| 等级 | 判据（全部取自磁盘既有真源） |
|---|---|
| `spec-approved` | lifecycle `checklists.PLANNING.tasksApproved === true` |
| `implemented` | shared+business 任务数 >0 且全 done；每个 done 的 business 任务有 `<taskId>-verifier.json` 且 `result: "pass"` |
| `converged` | convergence.json 存在且 `summary.errors=0`、`summary.openPoints=0`（证据附该文件 sha256） |
| `pipeline-green` | ≥1 个 pipeline 任务且全部 done |

`deliveryLevel` = 自底向上**连续**满足的最高级（跳级不算）。stdout 摘要须同时明示
templateMaturity 与 deliveryLevel 的语义区别（「模板 stable ≠ 项目 stable」）与
notCertified 行。**不写 lifecycle**（等级由证据推导，不落第二状态真源）。

### 6.20 设计与体验验收报告（A34 D-A34-21）

不定报告契约就是在验收层重演「流程资产承诺验收、内核无消费方」——A29 正是那样失效的。

**落点**：`.vima/reports/design/<PAGE-id>.json`、`.vima/reports/experience/<PAGE-id>.json`
（与既有 `.vima/reports/<taskId>-verifier.json` 同层同惯例）。

**字段**：

```jsonc
{
  "pageId": "PAGE-20",
  "specDigest": "sha256:…",           // 三个 digest 由 vima design verify --prepare 计算，报告作者抄写不自算
  "designDigest": "sha256:…",
  "implementationDigest": "sha256:…",
  "mustPreserveResults": [            // 按 design.mustPreserve 的 id **逐条**对账，漏一条即 uncovered
    { "id": "live-preview-sync", "verdict": "pass", "evidence": "…" }
  ],
  "primaryTaskResult": {              // 仅 experience 报告；completed:false ⇒ verdict 必须 fail
    "statement": "…", "completed": true, "steps": 6, "interruptions": []
  },
  "evidence": [                       // 结构化对象，不是字符串
    { "kind": "screenshot", "path": "…", "viewport": "1600x900", "scenarioId": null, "mustPreserveId": null }
  ],
  "verdict": "pass"                   // pass | fail；拿不准判 fail 并写清拿不准什么
}
```

**三个 digest 的计算范围**（不定范围则实现者必在两种错误间二选一：hash 整库 ⇒ 无关改动令全部
报告 stale；只 hash 页面目录 ⇒ 共享领域组件与 Stage A 变化不使页面失效，正是要防的漂移）：

| digest | 范围 |
|---|---|
| `specDigest` | 本页 `vima:page` 数据块 + 本页 `apis` 引用到的契约切片 |
| `designDigest` | 本页 `manifest.json` **及其声明的全部文件内容** + 本页所属端的 Stage A 样式真源 + `docs/design-language.md` + D1/D2 的 `docs/interaction-language.md`。逐文件哈希，非目录哈希——Stage A 或交互语言变化必须让旧页批准/报告 stale |
| `implementationDigest` | 本页任务 `@vima <taskId>` 标注的文件（A1 既有归属）+ **静态 import 可达图**收敛到 `src/features/**` 与 `src/styles/**` 的文件。可达图按本 app 的 vite alias（`@/`）与相对路径解析；遇到非字面量动态 import 时保守纳入该 app 全部 `src/features/**`，并标记 `fallback:true`，**确定性计算，不交给 Agent 判断** |

实现依赖集另写只读派生报告 `.vima/reports/implementation-deps/<PAGE-id>.json`，字段为
`{schemaVersion,pageId,entries:[{file,sha}],fallback,digest}`；它不得写回设计 manifest，
否则首次实现就会污染设计真源并让批准自我失效。

报告作者的确定性准备入口是 `vima design verify --prepare`：生成
`.vima/reports/design-verify-inputs.json`，字段为
`{schemaVersion,pages:[{id,fidelity,required,specDigest,designDigest,implementationDigest}]}`，并同步刷新
逐页 implementation-deps。准备模式**不要求报告已存在、缺报告仍 exit 0，且不覆盖最终
`design-verify.json`**；否则报告要求携带 digest、而 digest 又只能在报告写完后取得，会形成循环依赖。

**报告矩阵**（`vima design verify` 据此算 `uncovered`）：

| 保真级 | 必需报告 |
|---|---|
| D0 | Semantic（既有 `<taskId>-verifier.json`） |
| D1 | Semantic + Design |
| D2 | Semantic + Design + Experience |

任一 digest 与现状不符 ⇒ 该报告判 **stale**，必须重跑。顶层 `verdict:pass` 不是特权：
`mustPreserveResults` 必须逐 id 存在且各自 `verdict:pass`，experience 的
`primaryTaskResult.statement` 必须逐字对应 spec、`completed` 必须为 true、`steps` 为正整数且
`interruptions` 为空；`evidence` 必须是至少含 `kind/path` 的非空结构化对象数组，且 path 为
项目内确实存在的安全相对路径，否则仍算 uncovered。
`vima design verify` 汇总落 `.vima/reports/design-verify.json`；`/go` 收口硬门**只消费汇总结果**。
`vima certify` 的 `implemented` 级复用同一评估器**重算现状**，并要求磁盘汇总与重算结果一致，
不信任缓存中的 `pass`（D-A34-31）——否则伪造或改稿前的汇总可把未验收项目评为 pipeline-green。

**命令与时间点严格分离**（同一命令跨两阶段用两套未声明的通过条件 = 死锁）：
`vima design check` 是 DESIGNING 出口，只看设计面（页面尚未实现，**不看任何实现期报告**）；
`vima design verify --prepare` 只准备报告输入；无 `--prepare` 的 `vima design verify` 才是
DEVELOPING 收口硬门，检查报告矩阵与 `implementationDigest`。

## 7. spec 结构化数据块（唯一机器真源，§13.2/§13.3）

写在 docs/spec.md 各章内，围栏格式：<code>```yaml vima:&lt;kind&gt;</code> … <code>```</code>。
ID 规则：`ROLE-\d{2}` `MENU-\d{2}` `PAGE-\d{2}` `MODAL-\d{2}` `FLOW-\d{2}`
`RULE-\d{2}` `NG-\d{2}`（后两者 A13），全文档唯一。
任何条目可带 `pendingConfirm: true`（A 信息源分级：Agent 推断未获用户确认）。

**A16 端归属总则**：多端项目（端册 >1 端）里 `vima:page`/`vima:menus` 条目必须带
`app`、契约 api 必须带 `consumers`，缺省即 error（V-SPEC-13 / V-CON-07）；单端项目
可省略（= 唯一端）。声明时取值必须 ∈ 端册（任意 N）。ID 全局唯一规则不因端而变。
spec 保持**单一文件**——实体/规则/契约/跨端流程是系统级真源，不按端拆分。

### vima:entities（第二章 数据模型）
```yaml
entities:
  - name: Device
    fields:
      - { name: id, type: number, required: true, desc: 主键 }
      - { name: name, type: string, required: true, desc: 设备名称 2-50 字符 }
enums:
  - { name: DeviceType, values: [sensor, actuator, gateway] }
```

### vima:page（第三章 页面清单，每页一块；四要素=layout/components/interactions(links)/apis）
```yaml
id: PAGE-01
app: admin           # A16：归属端（多端项目必填 ∈ 端册；单端可省 = 唯一端）
title: 设备列表
menu: MENU-01
layout: [search, toolbar, table, pagination]     # 词表：toolbar|search|table|form|cards|tabs|pagination
components:
  - block: search
    items:
      - { type: input, label: 设备名称 }
      - { type: select, label: 状态, options: [在线, 离线, 维护中] }
  - block: toolbar
    items:
      - { type: button, label: 新增, action: modal, target: MODAL-01 }
      - { type: button, label: 批量删除, action: api, api: POST /api/device/batch-delete }
  - block: table
    api: GET /api/device/list
    rowActions:
      - { label: 编辑, action: modal, target: MODAL-01 }
      - { label: 详情, action: nav, target: PAGE-02 }
  - block: pagination
    items: []
modals:
  - id: MODAL-01
    title: 设备表单
    fields:
      - { field: name, label: 设备名称, type: input, required: true }
    submit: { api: POST /api/device }
params:                      # A22 可选：本页接受的导航参数与取值域（F3 跨页 key 一致性）
  - { name: step, values: [screening, assessment, followup] }
apis: [GET /api/device/list, POST /api/device, POST /api/device/batch-delete]
```
交互仅三种（§13.3）：`action: nav`（target=PAGE-xx）、`action: modal`（target=MODAL-xx）、
`action: api`（api="METHOD /path"）。

**A22 导航参数（F3）**：`action: nav` 可带 `params: { step: screening }`——跳转时携带的参数。
声明时 key 必须 ∈ 目标页 `params[].name`、value 必须 ∈ 该项 `values`（V-SPEC-16）。
页面的 `params` 是**该页导航参数取值域的唯一声明处**：多个入口各用各的 key 约定、
目标页静默落兜底分支是实测过的功能级故障，且每个页面单看都自洽、只有跨页对照才暴露。
不携带 `params` 的 nav 完全不触发本规则——规则由声明主动开启，存量项目零影响。

**nav 的 target 必须与本页同端**（A16，V-SPEC-13
——小程序页面无法「导航」到桌面后台页；跨端交接只表达在 `vima:flow`，step 的端由其
page 推导，flow 不加新键）。`regions`（A14）仅 kind 声明 `regions: true` 的端可用（A16）。

**A27 PDL 设计声明（全部可选；「声明即承诺」——缺省行为与现状逐字节一致，一旦声明即全量校验）**：

```yaml
design:                      # 页面级设计声明
  # ── A27 键（可选；用了其中任一，pattern 与 density 就必填，V-DSN-01）──
  pattern: workbench         # ∈ list|detail|form|workbench|master-detail|board|custom
                             #   custom（A34）= 六种模式都解释不了的独特版面，须带 intent + fidelity: D2
  density: default           # ∈ compact|default|loose（页面基准密度档）
  fold: [待办清单, 患者卡片]  # 首屏承诺：组件实例 name 数组（V-DSN-07 引用必须存在）
  # ── A34 键（另一关注点，住同一个块但不触发 A27 完整性）──
  fidelity: D1               # ∈ D0|D1|D2，**必填**（V-DSN-12；designCapability: legacy 项目豁免）
                             #   D0 是一次明确裁定，「缺失」不等价于 D0
  primaryTask: 处置一位高风险患者   # D1/D2 必填（V-DSN-11）；D2 收口由 Experience Verifier 真跑
  mustPreserve:              # D2 必填（V-DSN-11）：不得被降级掉的交互事实
    - id: live-preview-sync  #   id 页内唯一，报告按 id 逐条对账
      kind: interaction      #   ∈ visual|interaction|runtime —— **类型即执行者路由**
      statement: 编辑字段后患者端预览即时同步
      verifier: experience   #   visual→design；interaction/runtime→experience（相容性强制）
  # 设计目录**不在这里声明**：路径由 pageId 推导为 docs/review/design/<PAGE-id>/
  # （A34 D-A34-02——路径既已固定，字段就是可推导冗余，留着只多一个能与真源不一致的写入口）
regions:
  - columns:
      - { name: 主工作区, width: 1fr, blocks: [cards], role: primary, density: compact }
        # A27：列可带 role: primary（视觉主次）与 density（局部密度档）
components:
  - block: cards
    name: 待办清单            # 实例名。V-DSN-03：同词多例必须逐例带 name 且页内唯一
    intent: 医师进入后第一眼要处理的事   # 一句话存在理由（人审对象）
    data:                    # 内容语义（V-DSN-04）
      shape: list            # ∈ list|record|metrics|timeline|chart|freeform；freeform 必带 intent
      of: 随访待办            # 数据是什么（自由文本）
      keyFields: [患者, 逾期天数]   # 信息优先级（V-DSN-08：shape:list 缺它 → warn）
    density: compact         # 块级密度档（覆盖页面基准）
    actions:                 # A27 操作附着点：贴本块标题行，不新起横带；
      - { type: button, label: 开处方, action: nav, target: PAGE-12, priority: primary }
        # 条目 schema 同 toolbar button，参与既有全部交互校验与 V-TASK-07 计点
```

- `items[]` 按钮与 `rowActions[]` 可带 `priority: primary|secondary|overflow`（V-DSN-05：
  枚举校验；**页面级动作**（items+actions）primary 合计 ≤1；每块 `rowActions` 内 primary ≤1；
  单块行内动作 >3 且无一个 overflow → V-DSN-06 warn）。
- `modals[]` 可带 `presentation: dialog|drawer`（缺省 dialog；drawer 渲染为右侧抽屉，
  componentMap 的 modal 映射按 presentation 取 VLayer/VDrawer——A27 C-A27-03）。
- 附着点选「宿主块收编」而非按钮声明 anchor：天然表达「贴谁」，无引用解析、无悬空引用
  这一类新错误。「放不放得下」不在规格期判定——由 L2 探针在运行期量测（换行是事实）。

### vima:roles / vima:menus（第六章 权限）
```yaml
roles:
  - { id: ROLE-01, name: 管理员, menus: [MENU-01, MENU-02] }
```
```yaml
menus:
  - id: MENU-01
    app: admin           # A16：归属端（多端必填；menu.page 须与 menu.app 同端；
                         # mobile 端的「菜单」即 tabbar（3–5 项），同一模型两种外壳投影）
    name: 设备管理
    page: PAGE-01
    features:
      - { name: 设备查询, api: GET /api/device/list }
  - id: MENU-99
    name: 暂无角色的菜单
    page: PAGE-09
    uncovered: true        # 权限盲区必须显式声明才能过校验
```

### vima:flow（第五章「业务流程」小节，每条一块）
```yaml
id: FLOW-01
name: 设备上架流程
steps:
  - { role: ROLE-01, page: PAGE-01, action: 点击新增, api: POST /api/device, next: PAGE-01 }
```

### vima:rules（第五章 业务规则，A13）
```yaml
rules:
  - id: RULE-01
    type: validation                                  # validation|transition|calculation|constraint
    entity: Device                                    # 必填，∈ vima:entities[].name
    apis: [POST /api/device, PUT /api/device/{id}]    # 可选；缺省 = 全局规则
    desc: 设备名称 2-50 字符且同名不可重复，违者 40001
```
`entity` 管语义归属与引用机检；`apis` 管消费端过滤，是前后端任务共同的 join key
（前端经 `page.apis`、后端经 `contract.apis` 匹配同一条规则）。**无 `apis` = 全局规则**，
注入全部任务上下文。`type` 四值对应 planning-guide 终点清单 E 的四类。

### vima:non-goals（第九章 本期不做，A13）
```yaml
non-goals:
  - { id: NG-01, desc: 不做移动端适配，本期仅桌面浏览器 }
  - { id: NG-02, desc: 不做数据导出，用户临时用数据库直连应对 }
```
**空清单必须显式写 `non-goals: []`**——块与 key 都存在才算声明过，不允许省略块蒙混
（对抗模型「没写就当没有约束」的默认行为）。

### vima:contract（每份 docs/contracts/*.md 文末一块，§9.5 契约纪律第 5 条）
```yaml
module: device
apis:
  - method: GET
    path: /api/device/list
    consumers: [admin]   # A16：消费端（多端项目必填非空 ⊆ 端册；单端可省 = 唯一端）
    request:
      - { name: name, type: string, required: false }
      - { name: pageNum, type: number, required: true }
    response:
      - { name: id, type: number }
      - { name: name, type: string }
    errors:
      - { code: 40001, msg: 参数校验失败 }
```

**A22 字段可选键**（三个都可选，缺省即现状；出自 sustain-v3 实测的两类字段级盲区）：

| 键 | 用途 |
|---|---|
| `readOnly: true` / `writeOnly: true` | 显式声明单向字段，豁免 V-CON-08 四面对账。**豁免必须显式，不靠猜**——`password` 只写、`createdAt` 只读、计算字段只出现在响应都是合法的，但「只加了 POST 忘了 GET/PUT」也长这样，机器分不清 |
| `fields: [{name, type, required}]` | `type: json` 聚合字段的**子协议**（一层，不递归）。声明后 V-SPEC-15 把子字段名并入弹窗对账集 |
| `enforced: false` | 声明该 `type: json` 字段**确实没有权威结构**（实测存在：`summarize(Object surveyDays)` 按键名递归求和、`PrintTemplateService` 对 `fieldConfig` 整体透传不解析）。「无强制结构」应当能被如实表达，而不是留白让人以为漏写了 |

`type: json` 而 `fields` 与 `enforced` 皆无 → V-CON-09 warn。**不强制同名聚合字段统一子结构**
——实测 `content` 在 6 个模块里是 6 种领域对象且确实是有意的，统一成一套是过度抽象。
表格列头渲染的唯一字段来源 = 对应 api 的 response 字段（§13.3）。
**A16 契约纪律**：不同端需要不同数据形状 ⇒ 必须是不同端点（不建模 per-consumer
response 变体；一个 module 可同时服务多端，端点单一真源不拆）。授权闭环见 §8 V-CON-07。

## 8. validate 规则表（C3 实现；D1 的 checklist 文档逐条镜像同一编号）

| 规则 | 级别 | 内容 |
|---|---|---|
| V-SPEC-01 | error | docs/spec.md 九章齐全，标题前缀：`## 1. 系统概述` `## 2. 数据模型` `## 3. 页面清单` `## 4. 接口清单` `## 5. 业务规则` `## 6. 权限设计` `## 7. 技术栈` `## 8. 关键决策记录` `## 9. 本期不做`（第八章为 A4 吸收项，第九章为 A13） |
| V-SPEC-02 | error | vima:entities 存在；每个 entity 有非空 fields |
| V-SPEC-03 | error | 每个 vima:page 四要素齐全：layout 非空、components 非空、apis 非空、每个交互 action∈{nav,modal,api} 且 target/api 字段匹配。**A27**：交互条目 = components[].items[] 带 action + components[].actions[] + rowActions[]（三处同校验同计点）；`modals[].presentation` 若声明须 ∈ {dialog,drawer} |
| V-SPEC-04 | error | layout 与 components[].block 词汇 ⊆ 页面归属端 kind 的 `layoutVocab`（A16 端化：词表取自 template `planning.kinds`，与渲染器同源；缺省 = admin-web 10 词 {toolbar,search,table,form,cards,tabs,pagination,steps,collapse,anchor}（A27 +3）；mp-native 8 词 {search,list,cards,form,tabs,banner,detail,actionbar}） |
| V-SPEC-05 | error | nav target 指向存在的 PAGE-xx；modal target 在本页 modals 中定义；PAGE/MODAL/ROLE/MENU/FLOW/RULE/NG ID 全文档唯一（后两类 A13） |
| V-SPEC-06 | error | 每个 role.menus 非空且指向存在的 MENU；无角色覆盖且未标 `uncovered: true` 的菜单 → error |
| V-SPEC-07 | error | 每页 apis ⊆ 契约 apis（跨文件交叉引用） |
| V-SPEC-08 | error | 菜单功能点接口闭环：menu.features[].api（存在时）必须 ∈ 契约 apis（「功能点→接口→契约」链条机检，§13.2 视图②）；多端项目该接口的 consumers 还须含 menu.app（A16，与 V-CON-07 同口径——患者端菜单挂后台专属接口同属越权） |
| V-SPEC-09 | error | 业务规则结构化（A13）：vima:rules 块存在且 rules 非空；每条 rule 四要素齐全——`id` 匹配 `RULE-\d{2}`、`type` ∈ {validation,transition,calculation,constraint}、`entity` 非空且 ∈ vima:entities[].name、`desc` 非空 |
| V-SPEC-10 | error | 规则接口闭环（A13）：rule.apis（存在时）每条归一后必须 ∈ 契约 apis（跨文件交叉引用，归一同 V-SPEC-07） |
| V-SPEC-11 | error | 本期不做显式声明（A13）：第九章 vima:non-goals 块存在且含 `non-goals` key（**空清单须显式 `non-goals: []`**，省略块 → error）；每条 `id` 匹配 `NG-\d{2}` 且 `desc` 非空 |
| V-SPEC-12 | error | 分栏版面（A14）：页面块 `regions` 可选，模型为「纵向若干带，每带全宽或横切成列」。声明时每带须且只须有一个非空 `blocks` 或 `columns`；列须为映射且 `blocks` 非空、`width` 匹配 `^\d+(\.\d+)?(px|fr)$`（缺省 `1fr`）；全部区块词 ∈ 布局词表；regions 铺开后的区块多重集必须等于 `layout`（防两处漂移）。未声明 `regions` 的页面完全不触发本规则；仅 kind 声明 `regions: true` 的端可用——mobile 端页面声明 regions 即 error（A16，手机单列） |
| V-SPEC-13 | error | 端归属（A16）：多端项目每个 page/menu 必须带 `app` 且 ∈ 端册（单端可省略 = 唯一端；声明时任意 N 均须合法）；`action: nav` 的 target 页面须与本页同端；menu.page 须与 menu.app 同端 |
| V-SPEC-14 | error | 端覆盖（A16）：端册每个 app 在 spec 中 ≥1 个页面（防「入册未设计」漂移） |
| V-SPEC-15 | warn | **弹窗字段 ↔ 提交入参双向对账（A22/F1）**：正向 `modal.fields[].required==true` 的 `field` ∈ 该 modal `submit.api` 对应契约 api 的入参名集合；反向该 api `request[].required==true` 的 `name` ∈ 该 modal `fields[].field`。**三条排除项（缺一则误报率高到没人看）**：① `submit.api` 为 `GET` → 整个 modal 跳过（选择/参考类弹窗字段本就不提交）；② 契约必填入参名 ∈ 该 api 路径的 `{name}` 占位符 → 反向跳过（路径参数由上下文提供）；③ api 存在 `type: json` 入参且未声明 `fields` 子结构 → 该 api 双向整体跳过（聚合字段可由多个弹窗字段拼成），已声明 `fields` 时把子字段名并入比对集、必填子字段参与反向对账。**定位是候选清单不是判决**，故恒为 warn 不升 error |
| V-SPEC-16 | error | **跨页导航参数取值域闭环（A22/F3）**：`action: nav` 携带 `params` 时，每个 key ∈ 目标页 `params[].name`、每个 value ∈ 该项 `values`；目标页未声明 `params` 却收到携带参数的 nav → error。不携带 `params` 的 nav 完全不触发（规则由声明主动开启，存量项目零影响） |
| V-SPEC-17 | error | **flow 步骤引用闭环（A33）**：每条 vima:flow 须有非空 `steps`；步骤**声明的** `role` ∈ roles、`page` / `next` ∈ pages、`api` 归一后 ∈ 契约 apis（归一同 V-SPEC-07）。只校验已声明字段（省略即不触发对应子项，声明即承诺同 A27）；悬空引用是确凿缺陷，error 不误伤存量 |
| V-SPEC-18 | warn | **flow 步骤角色可达性（A33）**：步骤同时声明 `role` 与 `page` 且该页挂有菜单（`page.menu`）时，该 role 的 `menus` 须含此菜单，否则提示「角色对该步页面不可达」。恒 warn：页面可经 nav 从他页到达，菜单不是唯一入口——候选清单请人复核，同 V-SPEC-15 定位 |
| V-DSN-01 | error | **PDL 设计声明完整性（A27，声明即承诺）**：页面带 `design` 键时，`pattern` 必填 ∈ {list,detail,form,workbench,master-detail,board}、`density` 必填 ∈ {compact,default,loose}；未带 `design` 的页面完全不触发（存量零影响，下同） |
| V-DSN-03 | error | **同词多例实例名（A27）**：同一 `block` 词在 components 出现 >1 次时，每例必须带 `name` 且页内唯一（否则渲染/对账/评审三处都分不清「哪个 cards」）；单例可省 |
| V-DSN-04 | error | **内容形态枚举（A27）**：`data.shape` ∈ {list,record,metrics,timeline,chart,freeform}；`shape: freeform` 必须同时带 `intent`（自由发挥区必须声明意图，诚实标注好过假覆盖） |
| V-DSN-05 | error | **动作优先级（A27）**：`priority` ∈ {primary,secondary,overflow}（items 按钮 / actions / rowActions 三处通用）；**页面级动作**（items 按钮 + actions 合计）`primary` ≤1；每块 `rowActions` 内 `primary` ≤1。未声明 priority 的动作不参与计数 |
| V-DSN-06 | warn | **行内动作收纳提示（A27）**：单块 `rowActions` >3 条且无一条 `overflow` → 提示收进「更多」（骨架 ActionGroup 按密度档收纳：compact 2 / default 3 / loose 4） |
| V-DSN-07 | error | **首屏承诺引用闭环（A27）**：`design.fold` 的每个元素 ∈ 本页 components[].name 集合（悬空承诺 = 谎言） |
| V-DSN-08 | warn | **列表信息优先级（A27）**：`data.shape: list` 的块未声明 `keyFields` → 提示信息优先级未定（列表没有主字段，渲染与实现都只能瞎排） |
| V-CON-08 | warn | **字段四面对账·疑似只进不出（A22/F2）**：同一契约 module 内按 `create`（POST 的 request）/ `update`（PUT·PATCH 的 request）/ `read`（GET 的 response）三桶归集字段名，**只出现在其中一个桶**的字段 → warn。带 `readOnly: true` 或 `writeOnly: true` 的字段不参与。**GET 列表与详情响应合并为一个 `read` 桶**（原议为四面）：合并后判据更保守，`id`/`createdAt` 这类天然出现在多个 GET 响应的字段自然免疫，而三条实测实例（只在 `create` 桶）照样命中 |
| V-CON-09 | warn | **聚合 json 子协议（A22/F4）**：`type: json` 的字段既无 `fields` 子结构又无 `enforced: false` → warn（内部结构零约束时写入方/读取方/后端计算方各写各的，编译期与机检都看不见，运行时表现为「存进去了但算不对」）。第二条子检查：同名聚合字段在不同契约 module 给出**不同子结构** → warn「同名不同义，确认是否有意」——只提示不判错，实测同名不同义确实可以是有意的 |
| V-DEC-01 | error | 第八章含 markdown 表格且表头含「已否决方案」列（A4） |
| V-CON-01 | error | 每个契约 api 五要素：method/path/request/response/errors（request 允许空数组，字段须显式存在） |
| V-CON-02 | warn | 契约 api 未被任何页面 apis 引用（孤儿接口） |
| V-CON-03 | error | 谁消费谁承接（A16 端化）：每个契约 module ≥1 个 backend 任务经 contract 字段引用；且对每个消费该 module ≥1 个 api 的端（按 consumers 判定），须有 ≥1 个该端的 frontend\|fullstack 任务经 contract 字段引用（单端项目退化为原「前后端成对」语义） |
| V-CON-04 | error | 契约唯一性：module 名跨文件唯一；`METHOD path` 键跨全部契约唯一（§9.5 唯一事实来源，防后写覆盖先写） |
| V-CON-05 | warn | 占位符特征：请求参数名匹配 `^q\d+$`，或 POST/PUT 声明空 `request: []`。能通过全部结构性校验却与真实需求无关的模板套壳残留；零配置、纯形态判断 |
| V-CON-06 | error/warn | 契约三方计数一致：人读 `## <METHOD> /path` 小节与机读 `apis` 逐接口一一对应（error，含键集合比对）；头部「接口 N 个」与机读条目数一致（warn） |
| V-CON-07 | error | 消费端授权闭环（A16）：多端项目每个契约 api 必须带非空 `consumers` ⊆ 端册；每页 `apis` ⊆ 其归属端可见（consumers 含该端）的接口集——越权引用在设计期拦截 |
| V-SRC-01 | warn | 端点溯源（需配置）：`lifecycle.endpointAnchor` 指向真源端点清单时启用，契约每个 path 归一后须在锚点中出现。**全表唯一的外部锚点**——其余规则皆为 spec↔契约↔任务的内部一致性，契约由 spec 反向生成时该闭环恒真、虚构端点查不出 |
| V-TASK-01 | error | frontmatter 字段齐全且取值合法（§6.1；business 任务必须有 contract） |
| V-TASK-02 | error | 每个任务 body 含「## 验收清单」且至少 1 个复选框 |
| V-TASK-03 | error | contract 指向的文件存在 |
| V-TASK-04 | error | dependsOn 与 conflictsWith（A8）引用的 taskId 均存在 |
| V-TASK-05 | error | A2 单一真源：带 page 字段的任务 body 不得含「组件树」或「## 页面结构」手写段（页面结构以 spec 数据块+原型为准） |
| V-TASK-06 | error | page 字段值存在于 spec pages；spec 缺失/不可解析而任务带 page 时同样报 error（不得静默跳过） |
| V-TASK-07 | warn | 任务点覆盖度（B3）：带 page 的任务，验收清单复选框数 < 该页任务点数（交互数 [items 带 action + rowActions] + 弹窗字段数）→ 提醒清单可能漏点 |
| V-TASK-08 | warn | 任务正文引用的接口须 ∈ 作用域（带 page 取该页 apis，否则取 contract 契约 apis）。V-TASK-07 只数复选框不看内容，产物重建后清单会长期停在旧端点上。含否定式措辞（真源无/已废弃/不请求…）的行不计入 |
| V-TASK-09 | warn | 任务正文内嵌「契约声明的 N 个接口」与契约条目数一致（契约一改即漂，此前无规则覆盖） |
| V-TASK-10 | error | 任务端归属（A16）：多端项目 side=frontend\|fullstack 任务必须带 `app` ∈ 端册；side=backend 禁止携带 app（任意 N）；带 page 的任务 task.app 必须 == 该页归属端 |
| V-TASK-11 | warn | 任务规模上限（A18）：`layer=business` 且 `side ∈ {backend,fullstack}` 的任务，负责接口数 > **10** → 提示按子域拆分。负责集 = `fm.apis`（声明时）否则契约 apis 全集。理由见 A18：批次时长取批内最大值，超大任务把本可并行的工作串行化。**A24：`status=done` 的任务不参与**——本规则的唯一行动项是「拆分任务」，对已完成任务不可执行；永不消失的 warn 会训练用户忽略整张 warn 列表，把 A22 那批同为 warn 的字段级规则一起废掉 |
| V-TASK-12 | error | 任务负责接口集闭环（A18）：`fm.apis` 每条归一后 ∈ 该契约 apis；同一契约下 side=backend 的任务中，声明了 `apis` 的**两两不相交**（防重复实现）；若该契约下全部 backend 任务都声明了 `apis`，其并集须 == 契约全集（防漏实现）。未声明 `apis` 的任务不触发后两项 |
| V-TASK-13 | warn | 收尾流水线存在性（A20）：存在 `layer=business` 任务却无任何 `layer=pipeline` 任务 → 提示补 `full-test`/`code-audit`。**设计期只 warn**（不阻断存量项目开工，守 A19 升级可达性）；收口期由 V-INT-05 升级为 error |
| V-DSN-09 | error | **设计产物存在性（A34）**：`design.fidelity ∈ {D1,D2}` 的页面，`docs/review/design/<PAGE-id>/manifest.json` 必须存在，`manifest.files` 须声明该级必需产物（D1: `default.png`+`empty.png`；D2 另加 `prototype.html`+`scenarios.md`），且声明的每个文件真的在。**只在 DESIGNING 出口由 `vima design check` 触发，`vima validate` 不查**——设计文件在 DESIGNING 才产生，在 PLANNING 查它会让阶段永远过不去 |
| V-DSN-10 | error | **custom 的诚实标注三件套（A34）**：`design.pattern: custom` 必须同时带非空 `design.intent` 与 `fidelity: D2`。沿用 A27 `shape: freeform` 口径——承认某些页面就是独特的，好过继续扩枚举（10 词词表仍装不下三栏设计器） |
| V-DSN-11 | error | **保真级的必填声明（A34）**：D1/D2 必填 `design.primaryTask`（唯一回答「这页为何存在」的键）；D2 再必填 `design.mustPreserve` 非空数组，每条四键齐全（`id` 页内唯一 / `kind` ∈ {visual,interaction,runtime} / 非空 `statement` / `verifier` ∈ {design,experience}），且 **kind↔verifier 相容**：visual→design，interaction·runtime→experience。带类型而非字符串数组的理由：「配置与预览同步」「切换患者不重挂载」无法靠一张截图裁定，无 kind 就无执行者（违反 A6） |
| V-DSN-12 | error | **保真级必须显式声明（A34）**：每个页面须有 `design.fidelity`；**`designCapability: legacy` 的存量项目整体豁免**（D-A34-18）。A27 的「未声明零影响」口径适用于增量润色，**不适用于一条以「堵逃生口」为目的的机制**——不写 fidelity → 不是 D1/D2 → 跳过全部设计流程、全绿进开发，正是 A34 要治的洞。派生状态 `fidelityClassified` 由本规则计算，不是人工布尔 |
| V-COV-01 | error | docs/coverage-matrix.md 存在，表格 ≥3 列，任何数据行不得有空单元格或 `TODO`（缺口）。产物由 `vima render-matrix` 确定性生成；多端项目首列为「端」（A16） |
| V-YAML-01 | warn | 跨产物 YAML 纪律：vima 块的 flow 上下文（`[...]`/`{...}` 内）不得有未加引号的花括号。路径参数须用 `{id}`（V-CODE 归一只认花括号），但 YAML 规范禁止 flow 内 plain scalar 含 `{`；本解析器容忍 flow 序列却在 flow 映射上报「键 X 后缺少 :」，形成「vima 能读、标准 YAML 读不了」的灰区。块级序列不在此列 |
| V-PEND-01 | warn | 收集全部 pendingConfirm 条目进报告（approve 时升级为阻断） |
| V-CODE-01 | error | 代码↔契约对账·前端（A6，A16 端化）：**带 `@vima` 标注**的端册各端 `<dir>/<codeDir>` 文件（弃字面量 `'src'`）中 `request.<get\|post\|put\|delete\|patch>(路径字面量)` 归一后必须 ∈ 契约 apis，**且该接口的 consumers 须含文件归属端**（否则报越权调用）。归一：非 `/api` 开头补 `/api` 前缀（request baseURL）；模板串 `${expr}` 与契约 `{id}` 都归一为 `{*}`。请求门面 `request.<verb>(path)` 是各 kind 骨架契约（mp-native 为 wx.request 同签名封装），一条正则通吃全部端。单向对账（防野生接口）；实现完整性归 Verifier。无标注文件（底座/共享层）不参与 |
| V-CODE-02 | error | 代码↔契约对账·后端（A6）：**带 `@vima` 标注**的 backend/src *.java 中，类级 `@RequestMapping` 基路径 + `@Get/Post/Put/Delete/PatchMapping` 子路径拼接归一后必须 ∈ 契约 apis。Mapping 路径只认 value=/path=/首个位置字符串参数（仅 produces= 等具名属性视为无子路径）。仅 code 组全量校验时跑（--artifact 不含） |

`vima validate`：全部 error 通过 → exit 0 并把 `checklists.PLANNING.artifactsValidated=true` 写回
lifecycle（存在时）；否则 exit 2。`--artifact <path>` 只跑关联规则。报告落盘 §6.8。

### 8.1 V-INT 规则族（A20；`vima converge` 实现，**不属 validate**）

跨任务集成对账。V-CODE-01/02 是**单向**对账（代码不得出现契约之外的接口，作用域是
单个文件）；V-INT 是**跨任务合并视角**（契约的每个接口在整个代码库里被实现了几次、
被谁实现）。二者互补，共用同一套扫描原语（`scanMarkedFiles` / `feApiKey` /
`mappingPath` / `normalizePathParams`，由 `lib/commands/validate.mjs` 导出，converge 复用不复制）。

**责任田判定**（贯穿 V-INT-01/03）：某契约 api 的**负责任务集** = 该契约下
`layer=business` 且 **`side ∈ {backend, fullstack}`**（与 V-TASK-11「承担实现的 side」
同口径——只认 backend 会让「一个任务做完前后端」的形态整体逃过 V-INT-01/03）
的任务中，负责接口集含该 api 的任务。
单个任务的负责集取 `ownedApisOf`（A18 缺省语义）——声明 `apis` 时取其归一集，
**未声明时取契约全集**。因此「无人声明 apis」自然退化为「全部 backend 任务都负责」，
而「A 声明了 [x]、B 未声明」时 B 仍负责全集，不会把 y 判成无人负责。
负责任务集为空（该契约无 backend 任务）时 V-INT-01 不报——那是 V-CON-03 的职责，
converge 不重复报同一件事。

**后端作用域守卫**：带 `@vima` 标注的后端文件数为 0 → V-INT-01/02/03 整族跳过，
报告标 `scope.skipped = "no-marked-backend"`（纯前端项目 / 未开工项目不假红）。

| 规则 | 级别 | 判据 |
|------|------|------|
| V-INT-01 | error | **接口零实现**：契约 api 归一后在带 `@vima` 标注的后端 Mapping 集合中出现 0 次。**仅当该接口的负责任务全部 `status=done`** 时判定——开发中途跑不假红 |
| V-INT-02 | error | **接口重复实现**：同一归一键出现在 **≥2 个不同后端文件**（同文件多处不报——方法重载/多注解属正常）。报告列出全部文件及其 `@vima` 归属 |
| V-INT-03 | error | **越界实现**：某接口的实现文件 `@vima` taskId 集合 ∩ 该接口负责任务集 = ∅。**仅当该契约下 ≥1 个 backend 任务声明了 `apis`** 时启用（否则责任田 = 契约全集，恒不越界） |
| V-INT-04 | warn | **消费端调用缺失**：契约 api 的 `consumers` 含端 X，但端 X 的带标注代码中无任何该接口调用（单端项目退化为「无任何带标注前端调用」）。**仅当该端存在带 `@vima` 标注的文件**时判定 |
| V-INT-05 | error | **缺收尾流水线**：存在 `layer=business` 任务却无任何 `layer=pipeline` 任务——收口的载体不存在，闸门形同虚设（设计期同一判据为 V-TASK-13 warn） |

`vima converge`：报告落盘 §6.13；退出码见 §6.13。`--json` 时报告同时输出 stdout；
`--strict` 时 warn 也阻断。converge 是**只读命令**（报告文件除外），不改任何产物与状态。
第 0 步与 plan 同一道守卫（§9 第 0 步）：`docs/tasks/` 不存在 → `NO_TASKS`（exit 4），
**不写任何文件**——空报告会被误读成「集成对账通过」。

## 9. plan 批次算法（C2；§19.9）

0. `docs/tasks/` 目录不存在 → VimaError('NO_TASKS', exit 4)，不写任何报告
   （防在非 vima 项目静默产出空计划并凭空创建 .vima/reports/）。
1. loadTasks；dependsOn 引用不存在 → exit 2（V-TASK-04 同源检查）；
   conflictsWith 引用不存在 → PLAN_CONFLICT exit 2（A8）。
2. 环检测（全图 DFS）：发现环 → stderr 输出环路径，exit 2。
3. 批次 0..k：layer=shared 任务按拓扑序，**每任务单独一个 serial 批**，`level` = 组内拓扑序号。
4. business 任务按 dependsOn 做拓扑分层（依赖只算 business+shared；shared 视为已满足）；
   层内按任务 id 排序做**贪心首适应**切批：批容量 ≤ `maxParallel` 且批内任务互不 conflictsWith
   （A8 声明式冲突——两任务合法共享代码路径时不同批，补文件所有权模型盲区）。
   同一层切出的全部子批 `level` 相同（A18：同 level ⇒ 批间无依赖 ⇒ 可流水线化）。
5. pipeline 任务按拓扑序放末尾，每任务一个 serial 批，`level` = 组内拓扑序号。
6. 任务在批内按 id 排序；写 §6.5 至 .vima/reports/batch-plan.json（--json 时输出 stdout）。
   plan 是只读命令（报告文件除外）。
7. `--max-parallel <N>`（A18）：整数 1–10，缺省 **8**；越界或非整数 → VimaError
   `PLAN_PARALLEL`（exit 2）。取值写入报告 `maxParallel` 供追溯。

## 10. trace 规则（C3；A1 吸收项）

- 标注语法：注释内 `@vima <taskId>`（正则 `/@vima\s+([a-z0-9][a-z0-9-]*)/g`）。
- 扫描范围：端册各端 `<dir>/<codeDir>` + backend（resolveApps，A16；v1 项目由其合成
  等价于旧默认 `["src","backend/src"]` 的端册；template.json `codeDirs` 降为兼容回退），
  扩展名 `.ts .tsx .vue .js .mjs .cjs .java`，排除 node_modules/dist/target/.vima。
- **野生**：标注的 taskId 不存在于任务清单 → error，exit 2。
- **虚报嫌疑**：status=done 且 layer∈{shared,business} 的任务无任何标注 → warn（`--strict` 时 exit 2）。
- `--dir <path>`（可重复）：在 codeDirs 之外追加扫描目录（A1 之外的实现层裁定）。
- 报告落盘 §6.6 + stdout 摘要。

## 11. render 约定（C4；§13.2/§13.3/§19.6/§19.7）

- 命令流程：loadSpec + loadContracts → 动态 import 模板 renderer → 产物 atomicWriteFile。
  渲染前先跑 V-SPEC-03/04/05：静态导入复用 validate.mjs 的 `validatePages`
  （并行开发期的动态探测 + 内联兜底已随集成移除），四要素缺失 → exit 2 输出缺失清单
  （§19.6「先过 validate」）。
- **新鲜度助手（A12）**：render-review.mjs 导出 `checkReviewFresh(root, cliRoot)` →
  `{ drift: string[] }`；render-prototype.mjs 导出 `checkPrototypeFresh(root, cliRoot)` →
  `{ skip: boolean, drift: string[] }`（模板声明 prototype:false 时 skip）。语义 =
  内存渲染与磁盘产物逐字节比对（原型含 manifest），与 `--check` 分支共用同一比对
  实现（漂移判定单一真源）。消费方：approve 前置 2（存在性检查升级为新鲜度检查，
  漂移 → exit 4 并指名重渲命令）。调用前提：validate 已通过（approve 由前置 1 保证）。
- renderer 接口（模板资产，admin 实现）：
  ```js
  // templates/admin/planning/audit-view.mjs
  export function renderReview(model) → htmlString
  // templates/admin/planning/prototype.mjs
  export function renderPrototype(model) → { html, manifest }
  // model = { projectName, spec: loadSpec 结果, contracts: loadContracts 结果,
  //           apps: resolveApps 结果,    // A16：渲染器词表/外壳与 validate 同源于 kinds
  //                                      // 配置，渲染器自身的 BLOCK_WORDS 常量退役
  //           tasks: 任务切片 | null }   // A33（仅 renderReview 消费）：loadTasks 后只取
  //                                      // {id,layer,side,app,page,contract,apis}——刻意不含
  //                                      // status/retryCount/updatedAt（D-A33-01：运行态入渲染
  //                                      // 产物会把 A12 新鲜度机检搅成常红）。docs/tasks 缺失或
  //                                      // 不可解析（TASK_FM）→ null，第⑥视图如实标注。
  //                                      // run 与 checkReviewFresh 必须同口径构建（单一实现）
  ```
- 单文件 HTML：样式全内联，无任何外部 URL（href/src 只允许 # 锚点与 data: URI）；无时间戳。
- 审计视图六视图（§13.2）：角色权限矩阵（含权限盲区高亮）/菜单功能点/业务流程泳道/
  页面 UI 详情/**业务规则**（A13：按 entity 分组，type 徽标，apis 复用 `apiBadge`）/
  **业务闭环**（A33：逐 flow 旅程表——入口行带角色可达性徽标（判据与 V-SPEC-18 同源）、
  步骤行带接口徽标 + 状态效应规则（rule.apis join，type ∈ {transition,calculation}）、
  出口行列终步去向页的 GET 接口为「结果查询出口」（无则如实标注）、承接行 join
  model.tasks（fm.page 命中步骤页 + backend|fullstack 任务负责集命中步骤接口；
  tasks 为 null 时整行如实标注不可用））。
  另渲染 **「本期不做」范围红线区**（A13：vima:non-goals 逐条，位置在审核指引之后；
  空清单时渲染「本期未声明 non-goals」而非整段省略——声明为空与没声明必须可区分）。
  禁 JS 完整可读（JS 仅渐进增强）。
- 原型（§13.3）：语义占位线框（灰盒虚线），表格列头取契约 response 字段；交互三种：
  锚点跳转 `#page-PAGE-xx`、弹窗显隐（无 JS 时平铺展示 modal 卡片）、接口徽标；
  无 JS 降级为全页平铺清单。同时产出 §6.7 manifest。
  **流程演示区**（§13.3）：spec.flows 每条渲染一段步骤列表，步骤内 page/next 为
  `#page-PAGE-xx` 锚点链接（点击即「回放」到对应页面卡），api 渲染为徽标；
  flows **不进 §6.7 manifest**（manifest schema 不变）。
  弹窗 JS 显隐态渲染为遮罩层（§13.3「弹窗=遮罩层」）；noscript 平铺降级不变。
  审计视图顶部导航 `position: sticky`（§13.2 粘性目录，渐进增强）。
- **原型管理后台外壳**（人机对齐直观性）：左侧粘性侧边栏渲染菜单树
  （vima:menus → 链接对应 `#page-PAGE-xx`，未挂菜单的页面单列一组），每个菜单带
  可见角色徽标（roles.menus 反查）；头部提供角色视角 chips——JS 增强态点选后
  对不属于该角色的菜单与页面卡加 `wf-dim` 类淡出；noscript 隐藏 chips，
  角色徽标静态可读。侧边栏与 chips **不进 manifest**。
  **A16 多端**：原型按端各渲染一份（文件名与 manifest 新形态见 §6.7）；外壳按 kind——
  admin-web 沿用本段桌面侧栏外壳，mp-native 渲染 375px 手机框 + 底部 tabbar（取该端
  vima:menus，链至 `#page-PAGE-xx`）。审计视图仍单文件：五视图内按端分组（角色×菜单
  矩阵按端分段、页面详情按端分章、流程泳道步骤加端徽标）——完整性产物一眼看全，
  体验产物按端分身。render-matrix 多端项目首列加「端」。approve 的 A12 新鲜度机检
  遍历各端原型产物。render-prototype 多端项目缺省渲染全部端；`--app <id>` 单端渲染
  （**只写该端 html，manifest 不重写**——全端 manifest 是 Verifier 对账基线，单端
  局部重渲不得让基线缺失其他端），`--output` 仅在单端产物语境（N=1 或配合 `--app`）
  下有效，多端全量渲染时给 `--output` → usage exit 3（一个路径接不住 N 份产物，
  不做静默截断）。
- **pendingConfirm 可视化**（§13.1 信息源分级的人眼投影）：两份 HTML 对任何
  `pendingConfirm: true` 条目渲染「⚠️ 待确认」徽标（`.pend` 类）；审计视图
  头部渲染「待确认清单」区（逐条 where+锚点；数量入 stats），清单为空时整段省略。
- **审核指引块**（§13.2 读者=拍板人）：审计视图 hero 下渲染固定**五步**审核动线
  （①矩阵查多漏 ②功能点对需求 ③流程走一遍 ④页面四要素 ⑤规则查边界值与错误码，A13）
  +「发现问题 → 告诉 Agent 改 spec 后重渲染，不要在文档外口头拍板」提示。
  内容为常量文案，不依赖输入。
- **区块标记对账约定**（§13.3 机械化路径的 hook 半，v2.1.0 提前）：前端页面根组件
  模板须含 `data-page="PAGE-xx"`；每个 layout 区块容器元素带 `data-block="<词>"`；
  每个弹窗挂载点带 `data-modal="MODAL-xx"`。post-write.mjs 见 §14。
- `--check`：内存渲染与磁盘现有文件逐字节比较，不一致 → exit 2（不写盘）；文件缺失 → exit 2。
- 成功渲染后写回 lifecycle `reviewRendered/prototypeRendered = true`（lifecycle 存在时）。
- 参考移植（只读）：`/home/renmk/projects/PACT/pact/scripts/pact-book-html.mjs` 的
  单文件内联/明暗主题/锚点交叉引用手法。

## 12. 增补项（A1–A5 吸收自 PACT；A6–A7 吸收自 AI-First 评估；A8 吸收自市场对标；A9–A12 吸收自 mattpocock/skills 对标；A13 出自产品设计要素专题讨论；A14 出自 sustain-v3 分栏版面实战；A15 出自命令语义对调裁定；A16 出自多前端支持专题讨论；A17 出自 /go 批间阻塞排查裁定；A18 出自 sustain-v3 批次调度效率实测评估；A19 出自存量项目升级可达性核实；A20 出自「开发完成后的冲突与错误」用户反馈；A21 出自「开发完成后把项目经验反哺回 vima-cli」用户提议；A22 出自 sustain-v3 完整开发期实战反馈（四类机检盲区 + context 两条检索线）；A23 出自「自研企业 UI 框架」用户裁定（改判 A16 的 D-A16-02）；A25 出自「同步补齐 h5 的 UI 库」用户要求（H5 收编为 kind）；A27 出自 Design-First 前端体系七轮专题讨论的第一批落地；A28 出自 carelink-admin 验收实测（改判 D-A16-03）；A29 出自 carelink-admin 试点实证（Claude Design 视觉真源工序）；A30 出自「layout 与页面分开设计 + 产品风格取向」用户裁定（兑现 A27 延后项 P28）；A31–A33 出自 PACT 代际评估（docs/design/pact-vs-vima-generational-assessment.md）P0 三项经深评收敛后的共识落地（A31 变更事务并兑现 T2-8、A32 收敛版交付等级、A33 业务闭环视图），均见 v2.1-amendments.md；**A34 出自 Sustain 视觉退化取证 + codex 六轮评审收敛**（docs/design/sustain-vima-visual-regression-{analysis,solution}.md）——视觉真源的兑现机制：保真分级 D0/D1/D2 + Builder 三层授权 + DESIGNING 阶段与 A0 三方向发散 + 三类验收报告契约 + 批准摘要驱动失效）

- **A1 代码级追溯**：`@vima <taskId>` 标注 + `vima trace`（§10）。Builder 角色模板必须要求写标注。
- **A2 单一真源裁定**：前端任务 frontmatter 用 `page: PAGE-xx` 引用，任务文件不手写组件树（V-TASK-05）。
- **A3 轻量冷读门**：go.md 第二道闸门提供可选深模式——零知识子代理只读 spec+契约输出必问问题清单。
- **A4 决策留否决项**：spec 第八章决策表（编号 D-01…，列：决策/理由/已否决方案/否决理由），V-DEC-01。
- **A5 能力诚实分级**：template.json status 字段；preview 模板 create 警告、init 拒绝（exit 4）。
- **A6 规范执行者阶梯**：编码规范逐条标执行者标签（无标签不入册）；post-write 机检扩展
  （幻包名/vui-page/字面量色值/操作列 width/图标名，§14）；V-CODE-01/02 代码↔契约对账（§8）；
  hooks 为 node 直跑 .mjs；ICONS.md 与 components.d.ts 由 ai-manifest 同源生成。
- **A7 运行时证据**：骨架 vite dev 错误落盘 `.vima/reports/runtime-errors.jsonl`（§6.10）
  + `/check` 聚合；后端 `@SpringBootTest` 上下文冒烟测试使 `mvn test` 成为真实信号。
- **A8 市场对标采纳**：init 安装 AGENTS.md 跨工具指针（§6.4）；post-write 图标拦截给
  编辑距离近似候选（§14）；gen 脚本追加 llms-full.txt 全量档；验收词汇补 waived
  （§6.9，豁免带理由落盘）；任务 `conflictsWith` 字段（§6.1/§8/§9，声明式冲突不同批）；
  `vima context` 确定性上下文打包 + 字节预算机检（§6.11，CONTEXT_BUDGET）。
- **A9 提问三规则**：PLANNING 对话的 frontier 纪律（先查后问 / 一轮问全＋每问必附
  推荐答案 / 前置未定不问），落 planning-guide §5 + vima-planner 镜像；
  不新增文件、命令或状态字段，判据为 grep 文本条件（d2 防漂移断言）。
- **A10 同构断言禁令**：单测期望值必须来自独立事实源（契约示例 / spec 业务规则 /
  已知值），禁止与实现同构的计算生成期望——同构断言视同无测试；
  落 coding-standards 后端节〔L5·verifier〕+ `_template-be` 步骤 5 措辞。
- **A11 红绿修复纪律**：维护期修 bug 先固化一条能跑红的命令（A7 信号源：失败测试 /
  build:check / runtime-errors.jsonl 复现），修复判定 = 同一命令转绿；
  落 CLAUDE.project.md 工作协议。
- **A12 原型先行节拍**：planning-guide §5 里程碑 2 改为逐模块「草→渲→看→定」
  （页面对齐完成判据 = 用户在原型上看过并确认，非文本复述）；approve 前置 2 从
  存在性检查升级为新鲜度机检（§11 新鲜度助手，漂移 exit 4）——「用户看的图 =
  当前 spec」成为机检项。
- **A13 规格边界机检**：业务规则从散文升级为 `vima:rules` 块（entity 必填 + apis 可选，
  §7）并接齐四个消费端——V-SPEC-09/10（§8）、`vima context` 业务规则切片（§6.11）、
  审计视图第⑤视图（§11）、Verifier 逐条核对；spec 新增第九章「本期不做」承载
  `vima:non-goals`（V-SPEC-11 强制显式声明，空清单须写 `non-goals: []`），
  越界实现由 Verifier 记 fail——把「防过度设计」从 vima 自身纪律下推为它生成项目的机检项。
- **A14 分栏版面**：`vima:page` 可选键 `regions`（带 + 列两级，不递归），V-SPEC-12 强制
  铺开后区块多重集 == `layout`；`layout` 语义与既有台账不动。
- **A15 命令语义对调**：`vima update` = 更新项目产物（原 `vima upgrade` 行为原样承接），
  `vima upgrade` = 升级 CLI 自身（查 registry + 识别安装方式，默认只检查、`--yes` 才安装，
  §3.1 三个新错误码）。不做自动转发；`--dry-run` 在新语义下天然兼容故老用法不报错。
- **A16 多端应用模型**：一后端 × 多前端。端册（manifest v2 `apps`/`backend`，§6.4）是
  「有哪些端、在哪、什么形态」的唯一真源，全部消费方经 `resolveApps`（§5）读取；
  多端项目页面/菜单/任务/契约 api 必须显式端归属（§6.1/§7 总则）；新增 V-SPEC-13/14、
  V-CON-07、V-TASK-10，端化 V-SPEC-04/12、V-CON-03、V-CODE-01、V-COV-01（§8）；
  kind 词表/外壳/成熟度配置化（§6.3 `planning.kinds`）；原型按端渲染（§6.7/§11）；
  请求门面 `request.<verb>(path)` 为各 kind 骨架契约；A7 证据按端拆文件（§6.10）；
  guard/trace/context 全部改读端册（§10/§14）。选型（用户裁定）：患者端 kind=mp-native
  （微信原生+TS，vendored Vant Weapp）；~~N=1 保持根布局~~（A28 改判：create 一律
  `apps/<id>/`，存量根布局仍合法）；consumers 多端必填。
  三波次交付与验收判据见 v2.1-amendments.md A16。
- **A17 /go 批间连续性**：会话预算改单一任务计数（8 任务/次，批次数不设上限——
  shared/pipeline 串行批下按批计数会在 3 个任务后过早截断）；用户输入 /go 即构成对
  全部批次检查点提交的明确授权，提交被环境规则拒绝时跳过并注明「未形成回滚点」、
  不中断调度；批间合法停点白名单（预算耗尽 / 全部终态 / 需用户裁定 / 用户中断，
  其余不得停轮）。零文件格式/模块接口变更，落点仅 go.md、CLAUDE.project.md、
  设计 §7.5/§10.2 文案与 d2 防漂移断言。
- **A18 批次调度效率**（sustain-v3 实测评估落地，部分取代 A17）：任务 frontmatter 增
  可选 `apis` 负责接口集（§6.1）+ V-TASK-11 规模上限（>10 warn）/ V-TASK-12 闭环（§8）
  + `vima context` 契约切片（§6.11）；batch-plan 增 `level` 字段、`maxParallel` 默认 5→8
  且由 `vima plan --max-parallel` 可配（§6.5/§9，越界 `PLAN_PARALLEL`）；
  go.md 会话预算 8→24（前提：子代理回传摘要 ≤15 行）、续跑提示改 `/clear` 再 `/go`、
  同 level 子批流水线化派发；**检查点提交改 `/go --commit` 显式授权**（取代 A17
  「/go 即授权」——不带 flag 完全不碰 git）；新增 `.vima/go-state.json`（§6.12）+
  Stop hook `go-continue.mjs` 确定性续跑器（**推翻 A17「不用 Stop hook」**：
  A17 的否决理由是 hook 无法区分合法停点，写机读停因文件后 hook 不必猜）。
  **交付路径修复（同批，A18 暴露）**：manifest 增 `install` 键（§6.4）；`vima update` 对
  模板新增的受管文件按同一套三方比较**安装并登记**（原为只提示不装——settings.json 被更新成
  引用新 hook 而 hook 没装，配置指向不存在的文件）；`vima init` 改为**合并写 manifest**
  （不再清空 create 的端册）且**不重写已存在的 lifecycle**（原 `--force` 会把 DEVELOPING
  打回 PLANNING 并丢 taskStats/tasksApproved）。
- **A19 存量项目升级可达性**：`vima update` 兑现 manifest v1→v2 端册迁移（§6.4 既有宣称，
  写入 resolveApps 合成的同一份端册，行为等价）；`vima doctor` 增第 ⑫ 项「产物形态与当前
  规则的差距」（A4 决策表 / A13 vima:rules / A13 vima:non-goals / A2 前端任务 page 四条判据，
  级别与对应 validate 规则对齐，附「哪个增补项引入、补在哪」指引；spec 缺失时跳过）；
  manifest 增 `files.scaffold` 骨架基线（create 记录落盘内容哈希）+ `vima update --scaffold-diff`
  只读三方比较报告（**只报告不写盘**；无基线的存量项目如实说明能力边界）。

- **A20 开发完成后的收敛期**：新增 `vima converge` 跨任务集成对账（V-INT 规则族 §8.1，
  报告 §6.13）——现有校验全是「单任务对自己」，漏实现 / 重复实现 / 越界实现三类并行产出
  冲突此前全部漏网；`/go` 步骤 5 由「直接进 MAINTAINING」改为**收口闸门**（converge →
  按 `byTask` 归组增量修复 → 重跑，最多 3 轮 → pipeline 批次 → MAINTAINING），
  收敛循环不是停点；补上 `layer=pipeline` 收尾流水线的任务模板
  （`templates/admin/planning/_template-full-test.md` + `_template-code-audit.md` + planning-guide 第 5 步 +
  `planning.taskTemplates`）——此前 plan/go 都消费 pipeline 任务，却无任何资产生成它，
  致「流水线全部通过」的进阶条件恒真；新增 V-TASK-13（warn，设计期早提示）
  与 V-INT-05（error，收口期强制）。

- **A21 经验反哺回路**：新增 `vima retro`（§6.14）——项目跑完那一刻磁盘上恰好躺着最完整的
  一手证据（retryCount 分布、V-INT 命中、sharedChangeRequest、豁免与越界、批次形态、
  validate 规则命中分布），过后即散；A18/A20 都是靠事后人工重建证据才立的项，本项把这条
  回路做成固定环节。采集**离线只读、默认脱敏**（只出计数与分布，`--with-ids` 才带标识——
  vima-cli 是公开仓库而使用它的常是客户项目）；观察项是**阈值驱动的静态表**，每条 target
  指向框架资产而非业务代码。交互询问与 `gh issue create` 提交都在工作区层（`/go` 步骤 6，
  含「有没有想表达但框架表达不了的东西」必问项 + `.vima/retro-state.json` 防重复骚扰），
  **CLI 不联网、不提交、不提 PR**——守「`vima upgrade` 是全仓唯一联网命令」与
  「不执行真实 git push」两条既有纪律。

- **A22 字段级机检 + 上下文两条检索线**（出自 `docs/design/sustain-v3-field-feedback.md`）：
  此前全部规则都停在**引用级**（页面 apis ⊆ 契约、菜单功能点 ∈ 契约、代码路径 ∈ 契约），
  **没有一条查到字段级**——于是在 doctor 全绿、validate 0 错误的前提下仍藏着功能级阻断
  （弹窗必填字段契约里没有 ⇒ 提交必被 40001 拒绝）。新增 V-SPEC-15（弹窗字段↔入参双向对账，
  warn + 三条实测排除项）、V-SPEC-16（跨页导航参数取值域，error 但由声明主动开启）、
  V-CON-08（字段三桶对账查「只进不出」，`readOnly`/`writeOnly` 显式豁免）、
  V-CON-09（聚合 json 子协议 `fields` / `enforced: false`）；`vima:page` 增 `params`、
  `action: nav` 增 `params`、契约字段增 `readOnly`/`writeOnly`/`fields`/`enforced`（全可选）。
  `vima context` 增两节——**系统底座接口索引**与 **spec 指名的 `docs/raw/` 真源片段**：
  实测最大的系统性返工源是 Builder 把契约当唯一事实来源，「契约里没写」= 「系统里没有」
  ⇒ 降级实现，连 spec 正文指名的真源都不去看，因为上下文包里没有它。

- **A24 工具可信度与项目定制**（同源反馈的第二批，经逐条核实后重排优先级）：新增
  `findProjectRoot`（§4）与顶层 `NOT_IN_PROJECT` 守卫（§3.1）——CLI 原先按 cwd 静默工作，
  在子目录会给出**假结论并把它落盘**；V-TASK-11 增 `status=done` 豁免（§8，防「永不消失的
  warn」连累 A22 那批 warn 规则的可信度）；`vima context` 增「项目补充规范」节（§6.11，
  `docs/coding-standards.local.md` 不受管，让项目定制不污染受管基线）；`vima retro` 增
  `worked`（§6.14，正面信号）。**三条核实结论**：`conflictsWith` 早已存在（缺的是引导）、
  A18 默认并行度 8 已消解预算不整除、冷启动检查因需运行时而降级为 pipeline 验收项。

- 单测框架：`node:test` + `node:assert/strict`；文件名 `tests/unit/<owner>.<topic>.test.mjs`。
- 黄金夹具 `tests/fixtures/golden/`（D1 编写，必须能全绿通过 validate/plan/render/trace）：
  ```
  docs/spec.md                 九章 + entities + 2 个 page（PAGE-01 列表含 MODAL-01；PAGE-02 详情）
                               + roles(2)/menus(2)——黄金夹具须全绿，全部菜单有角色覆盖、不含 uncovered 示例
                               + 1 条 flow + 第八章决策表（≥1 行，含已否决方案）
                               + vima:rules（A13：≥1 条带 apis、≥1 条全局规则，覆盖 ≥2 种 type）
                               + 第九章 vima:non-goals（A13：≥1 条 NG-xx）
  docs/contracts/device-api.md 含 vima:contract（≥3 个 api，覆盖 PAGE 页面 apis 全集）
  docs/tasks/{shared-base,device-api-be,device-list-fe,full-test}.md
                               device-list-fe 带 page: PAGE-01 且 dependsOn: [shared-base, device-api-be]
                               full-test 为 layer: pipeline，dependsOn: [device-list-fe]
  docs/coverage-matrix.md      无缺口
  docs/lifecycle.json          currentPhase: PLANNING（schemaVersion 2.0）
  apps/admin/src/api/device.ts 首行注释 // @vima device-list-fe（A28 布局）
  backend/src/main/java/demo/DeviceController.java   // @vima device-api-be
  ```
  夹具中 status：shared-base=done 且刻意不带 @vima 标注（制造 1 个虚报 warn 供 trace 测试），
  其余 pending。
- 多端夹具 `tests/fixtures/golden-multi/`（A16 Wave 1）：双端（admin-web + mp-native）
  最小项目——manifest v2 端册、双端 page/menus（含 tabbar 菜单）、带 consumers 的契约
  （≥1 个仅 patient 可见接口，供 V-CON-07/V-CODE-01 越权用例）、双端任务（含 app 字段）。
  单端黄金夹具随 A28 迁至 `apps/admin/` 布局（此前「保持不动充当 N=1 兼容回归」的使命
  改由存量形态承接：手写 manifest（dir `"."`）的单测夹具覆盖旧布局寻址分支）。
- 单测不得依赖网络；可执行 `node bin/vima.mjs`（用 `node:child_process` spawnSync）。
- e2e（集成阶段统一写）：临时目录 create --no-git --no-install → init → 覆盖黄金夹具 →
  validate → render-review/-prototype（+--check）→ plan → trace → converge → approve → doctor → update。
- workspace 文字资产测试（`tests/unit/d2.workspace.test.mjs`）：A3 三条 grep 判据、
  guard-shared.mjs 目录集 ⊆ template.json sharedDirs、全部模板 status ∈ {stable,preview}
  且 admin=stable——防文字资产与配置漂移。
- CLI 路由测试（`tests/cli.test.mjs`）：help / `help <cmd>` / 子命令 `--help` / 未知命令 /
  无参数 / version 的输出流与退出码矩阵；parseArgs 中文翻译；USAGE 提示行；DEBUG 堆栈门控；
  顶层 help 的模板成熟度标注与 template.json status 一致（防 A5 文案漂移）。
- 公共 helper（`tests/helpers.mjs`）：`BIN`（bin/vima.mjs 绝对路径）与
  `runCli(args, opts) → { status, stdout, stderr, out }`（out=stdout+stderr 合并，
  统一用 `process.execPath` 而非 PATH 上的 node，保证 engines 约束下测试跑在当前解释器）。

- **A23 自研 vima-ui-mp**：mp-native 的组件库改为自研 vendored 类契约框架
  （112 个 `.vm-*` 类 + 75 个 `--vm-*` 令牌，零 JS/零依赖/零自定义组件），
  改判 A16 的 D-A16-02（不再 vendor Vant Weapp）；`componentMap` 增非词表键 `modal`
  并让弹窗字段 type 也走 componentMap（§6.3）；类名闭包由单测双向锁死，**不设白名单**。
- **A25 h5-mobile 收编为 kind**：H5 由空壳独立模板收编为 admin 模板第三个 kind；
  `vima-ui-h5` 与 `vima-ui-mp` **共用同一份类契约与令牌**（`.css` 由 `.wxss` 按
  「`wxss`→`css`」全局替换一一对应，单测锁死），只为浏览器缺失的四件事加组件；
  两个 mobile kind 共用 `layoutVocab`/`shell`/`componentMap`（§6.3）。
- **A27 Design-First 第一批**：PDL 页面设计语言（`design`/`name`/`intent`/`data.shape`/
  `actions`+`priority`/`fold`/列 `role`·`density`/modal `presentation`，全部可选、声明即承诺，
  §7）+ V-DSN 规则族（§8）+ L0 渲染器 shape 驱动升级 + admin 词表 +3（steps/collapse/anchor）+
  `vima mock`（§6.16）+ demo 态/画廊 + 七探针版面冒烟（§6.17）+ post-write 裸尺寸与根类
  覆写机检 + 骨架版面原语/密度/ActionGroup。库侧（令牌化收敛/行为层抽取）与主题显式延后。
- **A28 create 布局对称化**（改判 D-A16-03）：create 端册布局一律 `apps/<id>/`（含 N=1，
  kind 无关，§6.3/§6.4）；存量根布局（dir `"."`）与混合布局永久合法——init（A19 存量升级）
  继续如实写 `"."`，不提供迁移命令（D-A28-02）；单端 ui-docs 保持平铺（D-A28-03）。
  新增**项目根卫生资产**（D-A28-04）：模板 `root.scaffold`（§6.3）落项目级
  `.gitignore`/`README.md` 到项目根，create 与 A19 基线同源拷贝；骨架遍历排除
  `node_modules`/`target`（防模板本地构建污染进基线）。单端黄金夹具随之迁至
  `apps/admin/`（§13）。
- **A29 Claude Design 视觉真源工序**（carelink-admin 试点实证定案）：**纯工序资产，
  零文件格式/模块接口变更**——视觉真源 = 逐页高保真稿（PLANNING 出稿并登记
  `docs/review/design-links.md`，D-A29-05：文档约定不进 schema），开发按稿 1:1，
  /go 收口新增 5.2.6 设计稿校准轮（冒烟归零后逐页对照稿校准样式，修复走 5.2 回修
  通道再复跑冒烟）；与 A27 分工：线框/PDL/七探针守结构下限原样不减，稿守视觉上限。
  开启说明（`/design consent` / claude.ai/design/settings）与未接入降级口径写进
  planning-guide 第 8 节；`_template-fe.md` 增设计稿登记行。
- **A30 设计工序两段化 + 产品风格取向**（兑现 A27 延后项 P28 / 提案 §12.1 的 R2）：
  A29 的逐页整页稿改为两段——**Stage A 版面语言**（全项目一次：每个 `design.pattern`
  一张模式参考页 → 人审定版面 → **固化进仓库**：版面类落 `src/styles/layout.css`、
  刻度取值落 `src/styles/tokens.css`、模式库条目落 `docs/design-language.md`，云端稿作废）
  + **Stage B 逐页内容稿**（只决策内容区，不动壳层/间距刻度/卡片形态；新版面走
  sharedChangeRequest 回 Stage A 收编）。新增 `planning.designLanguage` 键（§6.3）→
  init 装 `docs/design-language.md`（**userOwned**，§6.4）——**风格推导方法论**
  （D-A30-06/07，非配好的主题）：不变层 8 条（不参与推导）+ 观察量 8 项（**从 spec/契约
  读，读不到就问，推断项标 `pendingConfirm`**，复用信息源分级纪律）+ 推导规则 8 条
  → 取向轴 7 条（内容密度/容器化程度/装饰度/强调手法/形状性格/深色锚/底色温度）
  + 色彩纲领 3 判据 + 旧信号 grep 清单 + 自检判据 6 条（**刻意不做成 CLI 规则**）
  + 定档产物（含规则冲突裁定位）+ 3 份已推导范例（禁直接套用）+ 模式库容器 + 出稿提示骨架。
  go.md 5.2.6 增**回修分流**（版面级回 Stage A 一处修全站 / 页面级派回本页任务）；
  `_template-fe.md` 增「所属 pattern」行。**零 schema / 零机检 / 零渲染器改动**
  （D-A30-05：主观取向机检不出来，假机检比没有更坏），`lib/` 仅 init 落点清单加一条。
- **A31 维护期变更事务**：新增 `vima change`（open/list/impact/apply/close，§6.18）——
  变更包 = 基线快照 + 确定性影响面 + 传播闸门；受影响任务推导与 reopen（done→pending）、
  recheck 静态表、close 三重闸门（受影响任务全 done + 进程内 validateProject 零 error +
  有任务/接口影响时 converge exit 0）。三个新错误码（§3.1）。**单变更在途**（多 change
  并存未立项）。同时兑现 ai-scaffold-benchmarks T2-8（该条自此以 A31 为唯一规格）；
  与 A20「不做缺陷台账状态机」的边界论证见 v2.1-amendments A31。
- **A32 交付等级认证**：新增 `vima certify`（§6.19）——四级阶梯
  spec-approved → implemented → converged → pipeline-green，每级证据取自磁盘既有真源；
  **显式非宣称** deployable/stable（PACT 八级「宣称大于实现」的教训对症吸收）；
  templateMaturity（A5 status）与 deliveryLevel 双轴分离展示；不写 lifecycle
  （等级由证据推导，不落第二状态真源）；exit 恒 0。
- **A33 业务闭环主视图**：flows 补引用机检（V-SPEC-17 error 步骤引用闭环 /
  V-SPEC-18 warn 角色可达性，§8）+ 审计视图第⑥视图「业务闭环」（§11）；
  渲染 model 增 tasks 切片（不含 status，D-A33-01）。不新建产物文件、
  不把 flows 塞进 prototype.manifest.json（无消费方即镀金）。

## 14. 命令行为裁定补遗（v2.0 实现层，设计文档相应节加注）

- **update（偏离 §4.5 的裁定；A15 前命令名为 upgrade）**：用户已修改的 managed 文件不做
  diff+交互合并，改为在旁路写 `<path>.vima-new` 全量新版本，由用户自行比对合并；动作集
  overwrite / conflict(.vima-new) / reinstall（磁盘缺失重装）/ adopt（磁盘已等于新源）/
  unchanged / deprecated（模板源已删，保留不删）/ new（模板新增，仅提示不安装）。
  `--dry-run` 输出动作表不写盘；`--yes` 兼容接受但无行为（实现恒非交互）。
- **upgrade（自升级，A15）**：全仓唯一联网、唯一会改 cwd 之外文件的命令，因此**默认只检查
  不安装**（打印 当前版本 / 最新版本 / 安装方式 / 安装位置 / 升级指令，exit 0），`--yes` 才跑
  安装器（`spawnSync(..., { stdio: 'inherit' })`）。最新版取自
  `https://registry.npmjs.org/<name>/latest`（Node 20 内建 fetch，5s 超时；
  环境变量 `VIMA_UPGRADE_LATEST` 非空时短路该请求，供单测兑现「不依赖网络」）。
  安装方式只按 `cliRoot` 的路径与文件存在性判定，不执行外部命令探测：
  `.git` 存在 → source（拒装，提示 git pull）；路径含 `_npx` → npx（拒装）；
  含 `.pnpm`/`pnpm` → pnpm；含 `.bun` → bun；其余 → npm。已是最新时 `--yes` 也不装。
  cwd 有 `.vima/manifest.json` 时输出末尾追加指向 `vima update` 的迁移提示。
- **DEBUG 调试（§20.2）**：环境变量 `DEBUG` 匹配 `vima*` 或 `*` 时，错误经
  stderr 追加完整堆栈（首行仍为 `vima <cmd>: <CODE>: <message>` 稳定格式）。
- **doctor**：CLAUDE.md 行数检查为 **warn**（§5.4「告警」，>50 触发，不改变退出码）；
  README 一致性检查 = 用 sync 导出的生成器内存重建后与磁盘字节比对（不一致 → warn，
  提示 `vima sync`）；环境预检**复用 create.mjs 导出的同一份检查函数**（§3.6）。
  **A16**：对齐产物漂移检查里的 `docs/review/prototype.html` 条目按端册展开为逐端
  `prototype.<appId>.html`（§6.3 展开规则，单端即旧名）——不得按字面路径检查。
- **guard-shared.mjs**：DEVELOPING 阶段追加拦截 `docs/contracts/**` 无令牌写入
  （§9.5 契约纪律 4）；PLANNING/MAINTAINING 不拦；lifecycle 缺失/损坏时放行（防误伤）。
  **A16**：保护面从硬编码字面量改为运行时读 manifest 端册（apps[].sharedDirs 相对
  各自 dir 解析 + backend.sharedDirs）；v1 manifest（无 apps 键）回退现行字面量，
  存量项目不裸奔。
- **post-write.mjs（§10.5 第三道防线 + A6 机检扩展）**：src/ 下 .vue/.ts(.tsx) 检查
  底层库深路径导入（…/vima-ui-admin/dist/…）、幻包名 `@vima/ui` 导入与原生
  confirm()/alert()，命中 exit 2 反馈 Agent 修复；CLAUDE.md >50 行告警保持 exit 0。
  **业务页面规范机检（A6，仅带 `data-page` 的 .vue，内置壳层页不涉及）**：
  ①页面根须挂 `.vui-page` 类；②字面量色值（#hex/rgb/hsl）只允许出现在自定义属性
  定义片段（`--x: …`）中，属性值须 var() 引用；③操作列（title「操作」或
  key/customSlot 以 operator 结尾）禁止手写字面量 width（宽度由 VTable 按行内按钮
  文案自动计算，L1 已吸收）。**VIcon 图标名机检（A6，全部 .vue）**：`name`/`type`
  静态字面量必须 ∈ vendor/vima-ui-admin/dist/ai-manifest.json 的 icons（含别名，
  忽略大小写）；动态绑定 `:name` 不查；manifest 缺失时跳过；**拦截时按编辑距离给出
  前 3 个近似候选（A8，报错即纠错）**。任一命中 → exit 2
  逐项反馈；hooks 均为 node 直跑的 .mjs（settings.json `node .claude/hooks/<name>.mjs`），
  定位「防误不防恶意」。
  **A16 端册化（Wave 1，.vue 侧）**：文件归属判定从 `rel.startsWith('src/')` 字面量改为
  端册各端 `<dir>/<codeDir>/` 前缀（读 manifest，v1 回退 `src/`——与 guard-shared 同款
  回退口径）；vendor ai-manifest 路径按归属端的 dir 解析（多端时 vendor 在
  `apps/<id>/vendor/`）；区块标记对账改读 §6.7 新形态（`manifest.apps[<归属端>].pages`）。
  否则多端项目全部业务代码逃逸 2/3/4/5 项机检——正是 A16 立项要杀死的静默失覆盖。
  wxml 侧对账为 Wave 2（mp 骨架落地时同步）。
- **context（A8，`vima context <taskId>`）**：按 §6.11 打包任务开工上下文到
  `.vima/context/<taskId>.md`（atomicWriteFile，无时间戳字节稳定）；stdout 输出分节
  字节计量；`--budget <bytes>` 超限 → 包仍写盘、CONTEXT_BUDGET exit 2；`--stdout`
  输出包内容不写盘；docs/tasks 缺失 → NO_TASKS exit 4；未知 taskId → USAGE exit 3；
  资产缺失（契约文件/ui-framework/coding-standards）→ 标注跳过不报错。
  /go 派发 Builder 前先跑本命令，Builder 把包列为第一必读（上游编译、下游不自由检索）。
- **init 的 AGENTS.md（A8）**：workspace/AGENTS.project.md 存在时渲染为项目根
  `AGENTS.md`（managed）——agents.md 标准的指针文件；缺失时静默跳过（其他模板不受影响）。
  **区块标记机械对账**（§13.3 v2.1.0 提前落地的 hook 半）：写入的 .vue 文件含
  `data-page="PAGE-xx"` 时，读 docs/review/prototype.manifest.json 对账——
  ①PAGE-xx 必须存在于 manifest（否则提示 spec/原型未同步或标记拼错）；
  ②manifest 该页 layout 的每个词都必须有对应 `data-block`，文件里多出的
  layout 词表外 data-block 同样报错；③manifest 该页每个 modal id 必须有对应
  `data-modal`。任一不符 → exit 2 反馈清单。manifest 缺失时静默跳过（原型未渲染
  不阻塞）；文件不含 data-page 则不做本项检查（标记存在性由任务验收清单 +
  Verifier 把关，hook 只机检已声明标记的页面根）。
- **create**：`-i/--interactive` 强制进入交互选单（即使给了 `--template`）；
  无 `--template` 且非 TTY → usage exit 3；`--force` 允许在已存在目录中创建并
  覆盖同名文件，**不清空目录**。
  **A16**：`--apps <id:kind,...>`（如 `--apps admin:admin-web,patient:mp-native`）声明
  端册；缺省 = 模板 `apps[].default` 端；布局一律 `apps/<id>/`（A28，含单端；
  改判前的存量单端项目为 `dir "."`，仍合法）。id 须唯一且匹配 `^[a-z0-9][a-z0-9-]*$`（同 taskId 词法）、
  kind ∈ `planning.kinds`（非法 → usage exit 3）；
  kind status=preview → 入册但跳过骨架拷贝并显式警告（PLANNING 可先行）；逐端执行
  npm install（有 package.json 的端）。已有 manifest 的目录 `--force` 重跑：合并端册
  与 files 不清空；templateId 不同 → TEMPLATE_MISMATCH exit 4（§3.1/§6.4）。
- **mock（A27，`vima mock`）**：读 `docs/contracts/*.md` 机读块，按 §6.16 规则确定性生成
  `.vima/mock/contract-mock.json`（stableStringify + atomicWriteFile，两跑同字节）。
  消费方：admin 骨架的 vite `/__vima/mock` 中间件与 request 层 demo 分支（`?__mock=` 切档）、
  h5 骨架 request 层 demo 分支、`scripts/layout-smoke.mjs` 的页面数据来源。
  **mock 必须由契约生成不得手写**——手写 mock = 第二份契约 = 必然漂移。
- **app（A16 Wave 3）**：`vima app add <id> --kind <kind>` = 拷贝该 kind 骨架到
  `apps/<id>/`（首端在根的存量项目允许混合布局）+ 端册追加 + 该端 ui-docs 安装到
  `docs/ui-framework/<id>/`；id 已存在 → APP_EXISTS exit 4；kind preview 同 create
  口径。`vima app list` 打印端册（id/kind/dir/骨架在位状态）。
- **context（A16 端化）**：组件文档切片按 `docs/ui-framework/<task.app>/` 取
  （平铺旧路径回退兼容存量单端项目）；coding-standards 按 kind 分节切片注入
  ——患者端任务不再被注入后台组件文档。
- **doctor（A16 新增检查项）**：端册完整性——apps[].dir 在位、id 合法 slug、kind ∈
  planning.kinds、各端骨架完整性（preview kind 未生成骨架如实报告；进 DEVELOPING 前
  该项为 ❌ 阻断级）。
