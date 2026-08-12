# vima-cli 内部实现契约（并行开发对齐真源）

> 本文是全部模块的**唯一接口权威**。与设计文档冲突时：文件格式/接口签名以本文为准，
> 业务语义以 `docs/design/vima-cli-design-v2.md`（下称 §N）为准。
> 吸收自 PACT 的增补项记为 A1–A5（见 §12 与 docs/design/v2.1-amendments.md）。

## 1. 阅读顺序

实现任何模块前：先读本文全文 → 再读设计文档中你负责章节 → 动手。

## 2. 仓库结构与文件所有权

```
bin/vima.mjs lib/cli.mjs lib/util/errors.mjs   [已完成，任何 agent 不得修改]
lib/util/{fs,yaml,md}.mjs lib/model/*.mjs      [F  基础库]
tests/unit/{yaml,md,model}.test.mjs            [F]
templates/admin/planning/*.md                  [D1 规划资产] + tests/fixtures/golden/**
templates/admin/workspace/**                   [D2 工作环境资产]
templates/*/template.json templates/*/scaffold/** [D3 模板与骨架]
docs/pact-absorption.md docs/design/v2.1-amendments.md [A  吸收分析]
lib/commands/{create,init,upgrade}.mjs         [C1] + tests/unit/c1.*.test.mjs
lib/commands/{plan,sync,doctor}.mjs            [C2] + tests/unit/c2.*.test.mjs
lib/commands/{validate,approve,trace}.mjs      [C3] + tests/unit/c3.*.test.mjs
lib/commands/render-{review,prototype}.mjs
templates/admin/planning/{audit-view,prototype}.mjs
templates/admin/planning/{review,prototype}.template.html [C4] + tests/unit/c4.*.test.mjs
tests/e2e.test.mjs README.md                   [集成阶段统一编写，agent 不写]
```

只写你名下的文件。需要别人模块的行为时按本文签名假定，不去实现它。

## 3. 全局约定

- Node ≥20，ESM，**零依赖**（含 devDependencies）。参数解析用 `node:util` 的 `parseArgs`。
- 退出码（lib/util/errors.mjs 已定）：0 成功；1 未预期错误；2 校验/检查不通过；
  3 用法错误；4 前置条件不满足。
- 错误一律 `throw new VimaError(code, msg, {path, exitCode})` 或用 `usageError/checkFailed/precondition` 工厂。
- 命令模块接口：`export async function run(argv, ctx) → number`，
  `argv` 为命令名之后的参数数组，`ctx = { cwd, cliRoot }`。
  命令内部用 `parseArgs({ args: argv, options: {...}, allowPositionals: true })`。
- stdout 给人读（简体中文，允许 emoji 状态符 ✅❌⚠️）；`--json` 时 stdout 只输出 JSON。
- 所有写盘：`atomicWriteFile`；所有 JSON 落盘：`stableStringify`。
- 渲染器/生成器**禁止** `Date.now()`、`new Date()`、`Math.random()`——字节确定性是验收项。
  例外：create/init/approve/sync 记录真实时间戳的字段（createdAt 等）允许 `new Date().toISOString()`。
- 路径统一 `node:path`；项目根定位：含 `docs/lifecycle.json` 或 `.vima/manifest.json` 的当前目录
  （不向上递归查找，v2.0 简化）。

## 4. lib/util API（F 实现，签名冻结）

```js
// lib/util/fs.mjs
export async function ensureDir(dir)
export async function fileExists(p)            // → boolean
export async function atomicWriteFile(p, content)   // 自动 ensureDir(dirname)，tmp+rename
export function stableStringify(value)         // 深度 key 排序、2 空格缩进、结尾 \n
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
**sharedDirs 是共享层保护面的单一真源**：guard-shared.sh 的目录判定与全部红线文案
（CLAUDE.project.md / vima-builder.md / 任务模板约束重申）必须与它同步——设计 §10.7 的
`src/hooks/、src/types/、backend common` 属旧口径，v2.0 裁定以骨架真实目录为准
（前端 components/utils/vendor；后端 config/security 包）。
`planning.codingStandards` → init 安装为 `docs/coding-standards.md`（managed，
§5.2「详细规范」指针的落点）。
模板变量：拷贝 scaffold 时替换文件内容与文件名中的 `{{projectName}}`、`{{projectPkg}}`
（projectName 去掉非字母数字后的小写形式）、`{{projectAbbr}}`（projectName 去掉非字母数字后
取前 2 字符大写，空回退 `VM`）、`{{createdAt}}`。
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

init 安装清单的 managed 部分含 `docs/ui-framework/**`（组件文档：CAPABILITY.md + 每组件一份
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

## 7. spec 结构化数据块（唯一机器真源，§13.2/§13.3）

写在 docs/spec.md 各章内，围栏格式：<code>```yaml vima:&lt;kind&gt;</code> … <code>```</code>。
ID 规则：`ROLE-\d{2}` `MENU-\d{2}` `PAGE-\d{2}` `MODAL-\d{2}` `FLOW-\d{2}`，全文档唯一。
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

### vima:flow（第七章 业务流程，每条一块）
```yaml
id: FLOW-01
name: 设备上架流程
steps:
  - { role: ROLE-01, page: PAGE-01, action: 点击新增, api: POST /api/device, next: PAGE-01 }
```

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
| V-SPEC-01 | error | docs/spec.md 八章齐全，标题前缀：`## 1. 系统概述` `## 2. 数据模型` `## 3. 页面清单` `## 4. 接口清单` `## 5. 业务规则` `## 6. 权限设计` `## 7. 技术栈` `## 8. 关键决策记录`（第八章为 A4 吸收项） |
| V-SPEC-02 | error | vima:entities 存在；每个 entity 有非空 fields |
| V-SPEC-03 | error | 每个 vima:page 四要素齐全：layout 非空、components 非空、apis 非空、每个交互 action∈{nav,modal,api} 且 target/api 字段匹配 |
| V-SPEC-04 | error | layout 与 components[].block 词汇 ⊆ {toolbar,search,table,form,cards,tabs,pagination} |
| V-SPEC-05 | error | nav target 指向存在的 PAGE-xx；modal target 在本页 modals 中定义；PAGE/MODAL/ROLE/MENU/FLOW ID 全文档唯一 |
| V-SPEC-06 | error | 每个 role.menus 非空且指向存在的 MENU；无角色覆盖且未标 `uncovered: true` 的菜单 → error |
| V-SPEC-07 | error | 每页 apis ⊆ 契约 apis（跨文件交叉引用） |
| V-SPEC-08 | error | 菜单功能点接口闭环：menu.features[].api（存在时）必须 ∈ 契约 apis（「功能点→接口→契约」链条机检，§13.2 视图②） |
| V-DEC-01 | error | 第八章含 markdown 表格且表头含「已否决方案」列（A4） |
| V-CON-01 | error | 每个契约 api 五要素：method/path/request/response/errors（request 允许空数组，字段须显式存在） |
| V-CON-02 | warn | 契约 api 未被任何页面 apis 引用（孤儿接口） |
| V-CON-03 | error | 每个契约 module 至少有一个 frontend 任务与一个 backend 任务通过 contract 字段引用它（admin） |
| V-CON-04 | error | 契约唯一性：module 名跨文件唯一；`METHOD path` 键跨全部契约唯一（§9.5 唯一事实来源，防后写覆盖先写） |
| V-TASK-01 | error | frontmatter 字段齐全且取值合法（§6.1；business 任务必须有 contract） |
| V-TASK-02 | error | 每个任务 body 含「## 验收清单」且至少 1 个复选框 |
| V-TASK-03 | error | contract 指向的文件存在 |
| V-TASK-04 | error | dependsOn 的 taskId 均存在 |
| V-TASK-05 | error | A2 单一真源：带 page 字段的任务 body 不得含「组件树」或「## 页面结构」手写段（页面结构以 spec 数据块+原型为准） |
| V-TASK-06 | error | page 字段值存在于 spec pages；spec 缺失/不可解析而任务带 page 时同样报 error（不得静默跳过） |
| V-TASK-07 | warn | 任务点覆盖度（B3）：带 page 的任务，验收清单复选框数 < 该页任务点数（交互数 [items 带 action + rowActions] + 弹窗字段数）→ 提醒清单可能漏点 |
| V-COV-01 | error | docs/coverage-matrix.md 存在，表格 ≥3 列，任何数据行不得有空单元格或 `TODO`（缺口） |
| V-PEND-01 | warn | 收集全部 pendingConfirm 条目进报告（approve 时升级为阻断） |

`vima validate`：全部 error 通过 → exit 0 并把 `checklists.PLANNING.artifactsValidated=true` 写回
lifecycle（存在时）；否则 exit 2。`--artifact <path>` 只跑关联规则。报告落盘 §6.8。

## 9. plan 批次算法（C2；§19.9）

1. loadTasks；dependsOn 引用不存在 → exit 2（V-TASK-04 同源检查）。
2. 环检测（全图 DFS）：发现环 → stderr 输出环路径，exit 2。
3. 批次 0..k：layer=shared 任务按拓扑序，**每任务单独一个 serial 批**。
4. business 任务按 dependsOn 做拓扑分层（依赖只算 business+shared；shared 视为已满足）；
   每层一个 parallel 批；层内 >5 个时按任务 id 排序切成 ≤5 的子批。
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
  渲染前先跑 V-SPEC-03/04/05（复用 C3 导出的规则函数；若 C3 未就绪则在渲染器内做同规则内联校验），
  四要素缺失 → exit 2 输出缺失清单（§19.6「先过 validate」）。
- renderer 接口（模板资产，admin 实现）：
  ```js
  // templates/admin/planning/audit-view.mjs
  export function renderReview(model) → htmlString
  // templates/admin/planning/prototype.mjs
  export function renderPrototype(model) → { html, manifest }
  // model = { projectName, spec: loadSpec 结果, contracts: loadContracts 结果 }
  ```
- 单文件 HTML：样式全内联，无任何外部 URL（href/src 只允许 # 锚点与 data: URI）；无时间戳。
- 审计视图四视图（§13.2）：角色权限矩阵（含权限盲区高亮）/菜单功能点/业务流程泳道/页面 UI 详情。
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
- **审核指引块**（§13.2 读者=拍板人）：审计视图 hero 下渲染固定四步审核动线
  （①矩阵查多漏 ②功能点对需求 ③流程走一遍 ④页面四要素）+「发现问题 → 告诉
  Agent 改 spec 后重渲染，不要在文档外口头拍板」提示。内容为常量文案，不依赖输入。
- **区块标记对账约定**（§13.3 机械化路径的 hook 半，v2.1.0 提前）：前端页面根组件
  模板须含 `data-page="PAGE-xx"`；每个 layout 区块容器元素带 `data-block="<词>"`；
  每个弹窗挂载点带 `data-modal="MODAL-xx"`。post-write.sh 见 §14。
- `--check`：内存渲染与磁盘现有文件逐字节比较，不一致 → exit 2（不写盘）；文件缺失 → exit 2。
- 成功渲染后写回 lifecycle `reviewRendered/prototypeRendered = true`（lifecycle 存在时）。
- 参考移植（只读）：`/home/renmk/projects/PACT/pact/scripts/pact-book-html.mjs` 的
  单文件内联/明暗主题/锚点交叉引用手法。

## 12. 吸收自 PACT 的增补项（已获用户确认，A agent 写成 v2.1-amendments.md）

- **A1 代码级追溯**：`@vima <taskId>` 标注 + `vima trace`（§10）。Builder 角色模板必须要求写标注。
- **A2 单一真源裁定**：前端任务 frontmatter 用 `page: PAGE-xx` 引用，任务文件不手写组件树（V-TASK-05）。
- **A3 轻量冷读门**：go.md 第二道闸门提供可选深模式——零知识子代理只读 spec+契约输出必问问题清单。
- **A4 决策留否决项**：spec 第八章决策表（编号 D-01…，列：决策/理由/已否决方案/否决理由），V-DEC-01。
- **A5 能力诚实分级**：template.json status 字段；preview 模板 create 警告、init 拒绝（exit 4）。

## 13. 测试与 fixtures

- 单测框架：`node:test` + `node:assert/strict`；文件名 `tests/unit/<owner>.<topic>.test.mjs`。
- 黄金夹具 `tests/fixtures/golden/`（D1 编写，必须能全绿通过 validate/plan/render/trace）：
  ```
  docs/spec.md                 八章 + entities + 2 个 page（PAGE-01 列表含 MODAL-01；PAGE-02 详情）
                               + roles(2)/menus(2 含 1 个 uncovered 示例？不——黄金夹具须全绿：全部菜单有角色)
                               + 1 条 flow + 第八章决策表（≥1 行，含已否决方案）
  docs/contracts/device-api.md 含 vima:contract（≥3 个 api，覆盖 PAGE 页面 apis 全集）
  docs/tasks/{shared-base,device-api-be,device-list-fe,full-test}.md
                               device-list-fe 带 page: PAGE-01 且 dependsOn: [shared-base, device-api-be]
                               full-test 为 layer: pipeline，dependsOn: [device-list-fe]
  docs/coverage-matrix.md      无缺口
  docs/lifecycle.json          currentPhase: PLANNING（schemaVersion 2.0）
  src/api/device.ts            首行注释 // @vima device-list-fe
  backend/src/main/java/demo/DeviceController.java   // @vima device-api-be
  ```
  夹具中 status：shared-base=done（有标注? shared-base 无标注 → 制造 1 个虚报 warn 供 trace 测试），
  其余 pending。
- 单测不得依赖网络；可执行 `node bin/vima.mjs`（用 `node:child_process` spawnSync）。
- e2e（集成阶段统一写）：临时目录 create --no-git --no-install → init → 覆盖黄金夹具 →
  validate → render-review/-prototype（+--check）→ plan → trace → approve → doctor → upgrade。
- workspace 文字资产测试（`tests/unit/d2.workspace.test.mjs`）：A3 三条 grep 判据、
  guard-shared.sh 目录集 ⊆ template.json sharedDirs、全部模板 status ∈ {stable,preview}
  且 admin=stable——防文字资产与配置漂移。

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
- **guard-shared.sh**：DEVELOPING 阶段追加拦截 `docs/contracts/**` 无令牌写入
  （§9.5 契约纪律 4）；PLANNING/MAINTAINING 不拦；lifecycle 缺失/损坏时放行（防误伤）。
- **post-write.sh（§10.5 第三道防线）**：src/ 下 .vue/.ts(.tsx) 检查
  底层库深路径导入（…/vima-ui-admin/dist/…）与原生 confirm()/alert()，命中 exit 2
  反馈 Agent 修复；CLAUDE.md >50 行告警保持 exit 0。
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
