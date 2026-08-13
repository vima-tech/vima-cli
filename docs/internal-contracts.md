# vima-cli 内部实现契约（并行开发对齐真源）

> 本文是全部模块的**唯一接口权威**。与设计文档冲突时：文件格式/接口签名以本文为准，
> 业务语义以 `docs/design/vima-cli-design-v2.md`（下称 §N）为准。
> 增补项记为 A1–A8（A1–A5 吸收自 PACT，A6–A7 吸收自 AI-First 评估，A8 吸收自市场对标；
> 见 §12 与 docs/design/v2.1-amendments.md）。
> 更新日期：2026-08-12（对应设计文档 v2.0.5；本文随设计文档修订演进，不单独编号）。

## 目录

§1 阅读顺序 · §2 仓库结构与文件所有权 · §3 全局约定（3.1 错误码登记表）· §4 lib/util API ·
§5 lib/model API · §6 文件格式 Schema（6.1–6.11）· §7 spec 结构化数据块 · §8 validate 规则表 ·
§9 plan 批次算法 · §10 trace 规则 · §11 render 约定 · §12 增补项 A1–A12 · §13 测试与 fixtures ·
§14 命令行为裁定补遗

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
lib/commands/{create,init,upgrade}.mjs         [C1] + tests/unit/c1.*.test.mjs
lib/commands/{plan,sync,doctor}.mjs            [C2] + tests/unit/c2.*.test.mjs
lib/commands/{validate,approve,trace,context}.mjs [C3] + tests/unit/c3.*.test.mjs
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
  例外：create/init/approve/sync 记录真实时间戳的字段（createdAt 等）允许 `new Date().toISOString()`。
- 路径统一 `node:path`；项目根定位：含 `docs/lifecycle.json` 或 `.vima/manifest.json` 的当前目录
  （不向上递归查找，v2.0 简化）。

### 3.1 错误码登记表（VimaError code 全集）

stderr 首行的 `<CODE>` 是稳定输出接口，新增/改名必须先改本表；测试断言以 code 为准（文案可改，code 不可静默改）。

| code | exit | 抛出点 | 含义 |
|---|---|---|---|
| USAGE | 3 | usageError 工厂（全部命令） | 用法/输入/参数解析错误 |
| PREREQ | 4 | create | 环境依赖预检不满足（必需工具缺失/版本不足） |
| DIR_EXISTS | 4 | create | 目标目录已存在且未加 --force |
| TEMPLATE_PREVIEW | 4 | init | preview 模板拒绝 init（A5 能力诚实分级） |
| ALREADY_INIT | 4 | init | 已初始化且未加 --force |
| NO_MANIFEST | 4 | upgrade | 缺 .vima/manifest.json |
| NO_TEMPLATE_ID | 4 | upgrade | manifest 缺 templateId |
| NO_TASKS | 4 | plan | 缺 docs/tasks/ 目录（防在非 vima 项目静默产出空计划） |
| NO_RENDERER | 4 | render-review / render-prototype | 模板未声明对应渲染器 |
| NO_LIFECYCLE | 4 | model/lifecycle | 缺 docs/lifecycle.json |
| NO_SPEC | 4 | model/spec | 缺 docs/spec.md |
| NO_TEMPLATE | 3 | model/template | 未知模板 id |
| TASK_FM | 2 | model/tasks | 任务 frontmatter 缺字段/取值非法（§6.1） |
| YAML_PARSE | 2 | util/yaml、util/md（vima:* 块） | YAML 受限子集解析失败（含行号） |
| PLAN_DEP | 2 | plan computeBatches | dependsOn 指向不存在的任务 |
| PLAN_CONFLICT | 2 | plan computeBatches | conflictsWith 指向不存在的任务（A8） |
| PLAN_CYCLE | 2 | plan computeBatches | 依赖成环（message 含环路径） |
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
conflictsWith: [user-list-fe] # A8 可选：与这些任务共享代码路径，plan 保证不同批并行；
                              # 字符串数组，引用必须存在（V-TASK-04 / PLAN_CONFLICT）
updatedAt: 2026-08-12T10:00:00Z
---
```

### 6.2 docs/lifecycle.json（§14.2 原样）

`schemaVersion:"2.0"`、`vimaVersion`、`templateId`、`currentPhase`
（BOOTSTRAP|PLANNING|DEVELOPING|MAINTAINING）、`phaseHistory[]`、
`checklists.PLANNING`（rawDocsCollected, modulesConfirmed, specGenerated, contractsGenerated,
tasksDecomposed, artifactsValidated, reviewRendered, prototypeRendered, tasksApproved —— 全 boolean，
approve 额外写 `tasksApprovedAt`）、`checklists.DEVELOPING`（sharedLayerDone, businessTasksDone,
pipelineDone, testsPassed, codeAudited）、`taskStats{total,done,failed,blocked,updatedAt}`。

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

v2.0.0 骨架**只用内置 builtin 目录拷贝**（不执行 npm create/spring init 外部命令——
偏离 §3.5，理由：确定性与离线可测，记入偏离清单）。preview 模板可省 planning/workspace 字段。
**sharedDirs 是共享层保护面的单一真源**：guard-shared.mjs 的目录判定与全部红线文案
（CLAUDE.project.md / vima-builder.md / 任务模板约束重申）必须与它同步——设计 §10.7 的
`src/hooks/、src/types/、backend common` 属旧口径，v2.0 裁定以骨架真实目录为准
（前端 components/utils/vendor；后端 config/security 包）。
`planning.codingStandards` → init 安装为 `docs/coding-standards.md`（managed，
§5.2「详细规范」指针的落点）。
模板变量：拷贝 scaffold 时替换文件内容与文件名中的 `{{projectName}}`、`{{projectPkg}}`
（projectName 去掉非字母数字后的小写形式）、`{{createdAt}}`。
（曾有 `{{projectAbbr}}` 供侧栏 Logo 缩写，英文缩写对使用者无语义，已改为图标并删除该变量。）
落地改名规则：scaffold 源文件名 `_gitignore` 拷贝到生成项目时改名为 `.gitignore`
（npm 发包会剥离 `.gitignore` 文件，模板侧用下划线名规避）。

### 6.4 .vima/manifest.json（§4.5）

```json
{ "schemaVersion": "1", "vimaVersion": "2.0.0", "templateId": "admin",
  "initializedAt": "<ISO>", "createdAt": "<ISO>",
  "files": { "managed": [{ "path": ".claude/commands/go.md", "checksum": "sha256:<hex>" }],
             "userOwned": ["CLAUDE.md", "docs/spec.md", "docs/contracts/", "docs/tasks/",
                            "docs/raw/", "docs/coverage-matrix.md"] } }
```

init 安装清单的 managed 部分含 `AGENTS.md`（← workspace/AGENTS.project.md 变量替换，
A8 跨工具指针文件：声明真源为 CLAUDE.md + 三条最低红线，用户定制走 CLAUDE.md）、
`docs/ui-framework/**`（组件文档：CAPABILITY.md 索引档 + ICONS.md 图标清单 +
llms-full.txt 单文件全量档 + 每组件一份
`<Name>.md`，拷自模板 `ui-docs/`，生成自组件库 `api.generated.json`），全量计入校验和；
`--skip-scan` 表示跳过这套拷贝。managed 另含 `docs/coding-standards.md`（§6.3 codingStandards）。
init 额外接受 `--template/-t <id>`（仅当项目无 manifest/lifecycle 记录时用于指定模板；
两处都取不到且未给 → usage exit 3）。lifecycle 与 manifest 的 `vimaVersion` 同源于
CLI package.json（init 写入时覆盖模型层缺省值）。

### 6.5 .vima/reports/batch-plan.json（plan 输出）

```json
{ "schemaVersion": "1",
  "batches": [ { "index": 0, "layer": "shared", "mode": "serial", "tasks": ["shared-base"] },
               { "index": 1, "layer": "business", "mode": "parallel", "tasks": ["a","b"] } ],
  "maxParallel": 5,
  "stats": { "total": 0, "pending": 0, "done": 0, "failed": 0, "blocked": 0, "running": 0 } }
```

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
## 编码规范（docs/coding-standards.md）  ← 原文；缺失时标注跳过
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

stdout 输出分节字节计量与总字节；`--budget <bytes>` 总字节超限 → 包仍写盘（便于排查）
但 CONTEXT_BUDGET exit 2；`--stdout` 打包内容直接输出不写盘。文档缺失（如规划期无
docs/ui-framework）一律「标注跳过」不报错——存在性问题归 validate/doctor。

## 7. spec 结构化数据块（唯一机器真源，§13.2/§13.3）

写在 docs/spec.md 各章内，围栏格式：<code>```yaml vima:&lt;kind&gt;</code> … <code>```</code>。
ID 规则：`ROLE-\d{2}` `MENU-\d{2}` `PAGE-\d{2}` `MODAL-\d{2}` `FLOW-\d{2}`
`RULE-\d{2}` `NG-\d{2}`（后两者 A13），全文档唯一。
任何条目可带 `pendingConfirm: true`（A 信息源分级：Agent 推断未获用户确认）。

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
apis: [GET /api/device/list, POST /api/device, POST /api/device/batch-delete]
```
交互仅三种（§13.3）：`action: nav`（target=PAGE-xx）、`action: modal`（target=MODAL-xx）、
`action: api`（api="METHOD /path"）。

### vima:roles / vima:menus（第六章 权限）
```yaml
roles:
  - { id: ROLE-01, name: 管理员, menus: [MENU-01, MENU-02] }
```
```yaml
menus:
  - id: MENU-01
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
    request:
      - { name: name, type: string, required: false }
      - { name: pageNum, type: number, required: true }
    response:
      - { name: id, type: number }
      - { name: name, type: string }
    errors:
      - { code: 40001, msg: 参数校验失败 }
```
表格列头渲染的唯一字段来源 = 对应 api 的 response 字段（§13.3）。

## 8. validate 规则表（C3 实现；D1 的 checklist 文档逐条镜像同一编号）

| 规则 | 级别 | 内容 |
|---|---|---|
| V-SPEC-01 | error | docs/spec.md 九章齐全，标题前缀：`## 1. 系统概述` `## 2. 数据模型` `## 3. 页面清单` `## 4. 接口清单` `## 5. 业务规则` `## 6. 权限设计` `## 7. 技术栈` `## 8. 关键决策记录` `## 9. 本期不做`（第八章为 A4 吸收项，第九章为 A13） |
| V-SPEC-02 | error | vima:entities 存在；每个 entity 有非空 fields |
| V-SPEC-03 | error | 每个 vima:page 四要素齐全：layout 非空、components 非空、apis 非空、每个交互 action∈{nav,modal,api} 且 target/api 字段匹配 |
| V-SPEC-04 | error | layout 与 components[].block 词汇 ⊆ {toolbar,search,table,form,cards,tabs,pagination} |
| V-SPEC-05 | error | nav target 指向存在的 PAGE-xx；modal target 在本页 modals 中定义；PAGE/MODAL/ROLE/MENU/FLOW/RULE/NG ID 全文档唯一（后两类 A13） |
| V-SPEC-06 | error | 每个 role.menus 非空且指向存在的 MENU；无角色覆盖且未标 `uncovered: true` 的菜单 → error |
| V-SPEC-07 | error | 每页 apis ⊆ 契约 apis（跨文件交叉引用） |
| V-SPEC-08 | error | 菜单功能点接口闭环：menu.features[].api（存在时）必须 ∈ 契约 apis（「功能点→接口→契约」链条机检，§13.2 视图②） |
| V-SPEC-09 | error | 业务规则结构化（A13）：vima:rules 块存在且 rules 非空；每条 rule 四要素齐全——`id` 匹配 `RULE-\d{2}`、`type` ∈ {validation,transition,calculation,constraint}、`entity` 非空且 ∈ vima:entities[].name、`desc` 非空 |
| V-SPEC-10 | error | 规则接口闭环（A13）：rule.apis（存在时）每条归一后必须 ∈ 契约 apis（跨文件交叉引用，归一同 V-SPEC-07） |
| V-SPEC-11 | error | 本期不做显式声明（A13）：第九章 vima:non-goals 块存在且含 `non-goals` key（**空清单须显式 `non-goals: []`**，省略块 → error）；每条 `id` 匹配 `NG-\d{2}` 且 `desc` 非空 |
| V-SPEC-12 | error | 分栏版面（A14）：页面块 `regions` 可选，模型为「纵向若干带，每带全宽或横切成列」。声明时每带须且只须有一个非空 `blocks` 或 `columns`；列须为映射且 `blocks` 非空、`width` 匹配 `^\d+(\.\d+)?(px|fr)$`（缺省 `1fr`）；全部区块词 ∈ 布局词表；regions 铺开后的区块多重集必须等于 `layout`（防两处漂移）。未声明 `regions` 的页面完全不触发本规则 |
| V-DEC-01 | error | 第八章含 markdown 表格且表头含「已否决方案」列（A4） |
| V-CON-01 | error | 每个契约 api 五要素：method/path/request/response/errors（request 允许空数组，字段须显式存在） |
| V-CON-02 | warn | 契约 api 未被任何页面 apis 引用（孤儿接口） |
| V-CON-03 | error | 每个契约 module 至少有一个 frontend 任务与一个 backend 任务通过 contract 字段引用它（admin） |
| V-CON-04 | error | 契约唯一性：module 名跨文件唯一；`METHOD path` 键跨全部契约唯一（§9.5 唯一事实来源，防后写覆盖先写） |
| V-TASK-01 | error | frontmatter 字段齐全且取值合法（§6.1；business 任务必须有 contract） |
| V-TASK-02 | error | 每个任务 body 含「## 验收清单」且至少 1 个复选框 |
| V-TASK-03 | error | contract 指向的文件存在 |
| V-TASK-04 | error | dependsOn 与 conflictsWith（A8）引用的 taskId 均存在 |
| V-TASK-05 | error | A2 单一真源：带 page 字段的任务 body 不得含「组件树」或「## 页面结构」手写段（页面结构以 spec 数据块+原型为准） |
| V-TASK-06 | error | page 字段值存在于 spec pages；spec 缺失/不可解析而任务带 page 时同样报 error（不得静默跳过） |
| V-TASK-07 | warn | 任务点覆盖度（B3）：带 page 的任务，验收清单复选框数 < 该页任务点数（交互数 [items 带 action + rowActions] + 弹窗字段数）→ 提醒清单可能漏点 |
| V-COV-01 | error | docs/coverage-matrix.md 存在，表格 ≥3 列，任何数据行不得有空单元格或 `TODO`（缺口） |
| V-PEND-01 | warn | 收集全部 pendingConfirm 条目进报告（approve 时升级为阻断） |
| V-CODE-01 | error | 代码↔契约对账·前端（A6）：**带 `@vima` 标注**的 src/ 文件中 `request.<get\|post\|put\|delete\|patch>(路径字面量)` 归一后必须 ∈ 契约 apis。归一：非 `/api` 开头补 `/api` 前缀（request baseURL）；模板串 `${expr}` 与契约 `{id}` 都归一为 `{*}`。单向对账（防野生接口）；实现完整性归 Verifier。无标注文件（底座/共享层）不参与 |
| V-CODE-02 | error | 代码↔契约对账·后端（A6）：**带 `@vima` 标注**的 backend/src *.java 中，类级 `@RequestMapping` 基路径 + `@Get/Post/Put/Delete/PatchMapping` 子路径拼接归一后必须 ∈ 契约 apis。Mapping 路径只认 value=/path=/首个位置字符串参数（仅 produces= 等具名属性视为无子路径）。仅 code 组全量校验时跑（--artifact 不含） |

`vima validate`：全部 error 通过 → exit 0 并把 `checklists.PLANNING.artifactsValidated=true` 写回
lifecycle（存在时）；否则 exit 2。`--artifact <path>` 只跑关联规则。报告落盘 §6.8。

## 9. plan 批次算法（C2；§19.9）

0. `docs/tasks/` 目录不存在 → VimaError('NO_TASKS', exit 4)，不写任何报告
   （防在非 vima 项目静默产出空计划并凭空创建 .vima/reports/）。
1. loadTasks；dependsOn 引用不存在 → exit 2（V-TASK-04 同源检查）；
   conflictsWith 引用不存在 → PLAN_CONFLICT exit 2（A8）。
2. 环检测（全图 DFS）：发现环 → stderr 输出环路径，exit 2。
3. 批次 0..k：layer=shared 任务按拓扑序，**每任务单独一个 serial 批**。
4. business 任务按 dependsOn 做拓扑分层（依赖只算 business+shared；shared 视为已满足）；
   层内按任务 id 排序做**贪心首适应**切批：批容量 ≤5 且批内任务互不 conflictsWith
   （A8 声明式冲突——两任务合法共享代码路径时不同批，补文件所有权模型盲区）。
5. pipeline 任务按拓扑序放末尾，每任务一个 serial 批。
6. 任务在批内按 id 排序；写 §6.5 至 .vima/reports/batch-plan.json（--json 时输出 stdout）。
   plan 是只读命令（报告文件除外）。

## 10. trace 规则（C3；A1 吸收项）

- 标注语法：注释内 `@vima <taskId>`（正则 `/@vima\s+([a-z0-9][a-z0-9-]*)/g`）。
- 扫描范围：template.json `codeDirs`（无 manifest 时默认 `["src","backend/src"]`），
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
  // model = { projectName, spec: loadSpec 结果, contracts: loadContracts 结果 }
  ```
- 单文件 HTML：样式全内联，无任何外部 URL（href/src 只允许 # 锚点与 data: URI）；无时间戳。
- 审计视图五视图（§13.2）：角色权限矩阵（含权限盲区高亮）/菜单功能点/业务流程泳道/
  页面 UI 详情/**业务规则**（A13：按 entity 分组，type 徽标，apis 复用 `apiBadge`）。
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

## 12. 增补项（A1–A5 吸收自 PACT；A6–A7 吸收自 AI-First 评估；A8 吸收自市场对标；A9–A12 吸收自 mattpocock/skills 对标；A13 出自产品设计要素专题讨论，均见 v2.1-amendments.md）

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

## 13. 测试与 fixtures

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
  src/api/device.ts            首行注释 // @vima device-list-fe
  backend/src/main/java/demo/DeviceController.java   // @vima device-api-be
  ```
  夹具中 status：shared-base=done 且刻意不带 @vima 标注（制造 1 个虚报 warn 供 trace 测试），
  其余 pending。
- 单测不得依赖网络；可执行 `node bin/vima.mjs`（用 `node:child_process` spawnSync）。
- e2e（集成阶段统一写）：临时目录 create --no-git --no-install → init → 覆盖黄金夹具 →
  validate → render-review/-prototype（+--check）→ plan → trace → approve → doctor → upgrade。
- workspace 文字资产测试（`tests/unit/d2.workspace.test.mjs`）：A3 三条 grep 判据、
  guard-shared.mjs 目录集 ⊆ template.json sharedDirs、全部模板 status ∈ {stable,preview}
  且 admin=stable——防文字资产与配置漂移。
- CLI 路由测试（`tests/cli.test.mjs`）：help / `help <cmd>` / 子命令 `--help` / 未知命令 /
  无参数 / version 的输出流与退出码矩阵；parseArgs 中文翻译；USAGE 提示行；DEBUG 堆栈门控；
  顶层 help 的模板成熟度标注与 template.json status 一致（防 A5 文案漂移）。
- 公共 helper（`tests/helpers.mjs`）：`BIN`（bin/vima.mjs 绝对路径）与
  `runCli(args, opts) → { status, stdout, stderr, out }`（out=stdout+stderr 合并，
  统一用 `process.execPath` 而非 PATH 上的 node，保证 engines 约束下测试跑在当前解释器）。

## 14. 命令行为裁定补遗（v2.0 实现层，设计文档相应节加注）

- **upgrade（偏离 §4.5 的裁定）**：用户已修改的 managed 文件不做 diff+交互合并，
  改为在旁路写 `<path>.vima-new` 全量新版本，由用户自行比对合并；动作集
  overwrite / conflict(.vima-new) / reinstall（磁盘缺失重装）/ adopt（磁盘已等于新源）/
  unchanged / deprecated（模板源已删，保留不删）/ new（模板新增，仅提示不安装）。
  `--dry-run` 输出动作表不写盘；`--yes` 兼容接受但无行为（实现恒非交互）。
- **DEBUG 调试（§20.2）**：环境变量 `DEBUG` 匹配 `vima*` 或 `*` 时，错误经
  stderr 追加完整堆栈（首行仍为 `vima <cmd>: <CODE>: <message>` 稳定格式）。
- **doctor**：CLAUDE.md 行数检查为 **warn**（§5.4「告警」，>50 触发，不改变退出码）；
  README 一致性检查 = 用 sync 导出的生成器内存重建后与磁盘字节比对（不一致 → warn，
  提示 `vima sync`）；环境预检**复用 create.mjs 导出的同一份检查函数**（§3.6）。
- **guard-shared.mjs**：DEVELOPING 阶段追加拦截 `docs/contracts/**` 无令牌写入
  （§9.5 契约纪律 4）；PLANNING/MAINTAINING 不拦；lifecycle 缺失/损坏时放行（防误伤）。
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
