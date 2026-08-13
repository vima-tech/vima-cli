# admin 产物机械校验清单（validate.checklist）

> 本清单逐条镜像 `vima validate` 的规则表（编号与语义与 CLI 实现一一对应，
> 真源见 docs/internal-contracts.md §8）。
> **机检入口：`vima validate`**（全量）/ `vima validate --artifact <path>`（只跑关联规则）。
> 用途：① Agent 每份产物落盘后先机检、再对照本清单人工核对；② 人评审时逐项打勾。
> 级别说明：error 不通过则 validate exit 2；warn 记入报告不阻断（approve 时 V-PEND-01 升级为阻断）。

## spec.md（docs/spec.md）

- [ ] **V-SPEC-01**（error）：九章齐全，标题前缀逐字为
  `## 1. 系统概述`、`## 2. 数据模型`、`## 3. 页面清单`、`## 4. 接口清单`、
  `## 5. 业务规则`、`## 6. 权限设计`、`## 7. 技术栈`、`## 8. 关键决策记录`、
  `## 9. 本期不做`。
- [ ] **V-SPEC-02**（error）：`vima:entities` 数据块存在；每个 entity 有非空 fields。
- [ ] **V-SPEC-03**（error）：每个 `vima:page` 页面级粒度四要素齐全——
  layout 非空、components 非空、apis 非空；每个交互 `action ∈ {nav, modal, api}`
  且字段匹配（nav/modal 带 target，api 带 api）。
- [ ] **V-SPEC-04**（error）：layout 与 components[].block 用词
  ⊆ `{toolbar, search, table, form, cards, tabs, pagination}`。
- [ ] **V-SPEC-05**（error）：nav 的 target 指向存在的 PAGE-xx；modal 的 target
  在本页 modals 中定义；PAGE/MODAL/ROLE/MENU/FLOW/RULE/NG 全部 ID 全文档唯一。
- [ ] **V-SPEC-06**（error）：每个 role.menus 非空且指向存在的 MENU；
  无角色覆盖且未标 `uncovered: true` 的菜单视为权限盲区，校验失败。
- [ ] **V-SPEC-07**（error）：每页 apis ⊆ 契约 apis（跨文件交叉引用，按 `METHOD /path` 比对）。
- [ ] **V-SPEC-08**（error）：菜单功能点接口闭环——menu.features[].api（存在时）必须在契约中
  （「功能点 → 接口 → 契约」链条不许断）。
- [ ] **V-SPEC-09**（error）：业务规则结构化（A13）——`vima:rules` 块存在且 rules 非空；
  每条规则四要素齐全：`id` 匹配 `RULE-\d{2}`、`type` ∈
  `{validation, transition, calculation, constraint}`、`entity` 非空且存在于
  `vima:entities`、`desc` 非空（写清边界值与错误码）。
- [ ] **V-SPEC-10**（error）：规则接口闭环（A13）——rule.apis 存在时每条必须在契约中
  （不关联具体接口的全局规则请整体省略 apis 字段，不要写空数组）。
- [ ] **V-SPEC-11**（error）：本期不做显式声明（A13）——第九章 `vima:non-goals` 块存在
- [ ] **V-SPEC-12**（error）：分栏版面（A14）——页面声明 `regions` 时，每带须且只须有一个非空 `blocks`（全宽带）或 `columns`（分栏带）；列 `width` 形如 `264px`/`1fr`，全部区块词 ∈ 词表；且 regions 铺开后的区块集合与 `layout` 一致（未声明 regions 的页面不触发）
  且含 `non-goals` 键；每条 `id` 匹配 `NG-\d{2}`、`desc` 非空。
  **本期确实没有 non-goals 也必须显式写 `non-goals: []`**——「声明为空」与「没声明」
  必须可区分，省略块一律 error。
- [ ] **V-DEC-01**（error）：第八章含 markdown 表格且表头含「已否决方案」列。

## 契约（docs/contracts/*.md）

- [ ] **V-CON-01**（error）：每个契约 api 五要素齐全——method/path/request/response/errors
  （request 允许空数组，但字段必须显式存在）。
- [ ] **V-CON-02**（warn）：契约 api 未被任何页面 apis 引用（孤儿接口）——确认是否确属后台任务用接口。
- [ ] **V-CON-03**（error）：每个契约 module 至少有一个 frontend 任务与一个 backend 任务
  通过 `contract` 字段引用它（admin 前后端成对纪律）。
- [ ] **V-CON-04**（error）：契约唯一性——module 名跨文件唯一；`METHOD path` 键跨全部契约唯一
  （§9.5 唯一事实来源，防后写覆盖先写）。
- [ ] **V-CON-05**（warn）：占位符特征——请求参数名形如 `q1`/`q2`，或 POST/PUT 声明空 `request: []`。
  这类内容能通过全部结构性校验却与真实需求无关，是模板套壳没填完的痕迹；确属无入参的写操作可忽略。
- [ ] **V-CON-06**（error/warn）：契约三方计数一致——人读 `## <METHOD> /path` 小节与机读 `apis`
  逐接口一一对应（error）；头部「接口 N 个」与机读条目数一致（warn）。三处会各自漂移且此前无人发现。
- [ ] **V-SRC-01**（warn，需配置）：契约端点可溯源到真源锚点。在 `docs/lifecycle.json` 写
  `endpointAnchor: "<相对路径>"` 指向一份真源端点清单后启用；未配置整条跳过。
  **这是全表唯一的外部锚点**——其余规则都是 spec ↔ 契约 ↔ 任务之间的内部一致性，
  当契约由 spec 反向生成时那个闭环恒真，虚构端点一条也查不出来。

## 任务（docs/tasks/*.md）

- [ ] **V-TASK-01**（error）：frontmatter 字段齐全且取值合法
  （taskId/title/status/layer/side/dependsOn/retryCount/updatedAt；business 任务必须有 contract）。
- [ ] **V-TASK-02**（error）：每个任务 body 含「## 验收清单」且至少 1 个复选框。
- [ ] **V-TASK-03**（error）：contract 指向的文件存在。
- [ ] **V-TASK-04**（error）：dependsOn 引用的 taskId 均存在。
- [ ] **V-TASK-05**（error）：单一真源（A2）——带 page 字段的任务 body 不得含
  手写页面结构段（页面结构以 spec 数据块 + 原型为准，任务文件不重复描述）。
- [ ] **V-TASK-06**（error）：page 字段值存在于 spec pages
  （spec 缺失/不可解析而任务带 page 时同样报错，不静默跳过）。
- [ ] **V-TASK-07**（warn）：任务点覆盖度——带 page 的任务，验收清单复选框数不得少于
  该页任务点数（交互 [items 带 action + rowActions] + 弹窗字段），少于则提醒可能漏点。
- [ ] **V-TASK-08**（warn）：任务正文引用的接口须落在作用域内——带 page 取该页 `apis`，
  否则取 `contract` 指向契约的 `apis`。V-TASK-07 只数复选框个数、不看内容，产物重建后
  验收清单会长期停在旧端点上而无人发现。写「真源无 X」「已废弃」这类否定式说明不算引用。
- [ ] **V-TASK-09**（warn）：任务正文内嵌的「契约声明的 N 个接口」与契约条目数一致——
  契约一改这个数就漂，且没有任何规则会发现。

## 覆盖矩阵（docs/coverage-matrix.md）

- [ ] **V-COV-01**（error）：文件存在，表格 ≥3 列，任何数据行不得有空单元格或 `TODO`（缺口）。
  产物由 `vima render-matrix` 从 spec/契约/任务确定性生成，**不要手改**；
  `vima render-matrix --check` 可验漂移。

## 端册与消费端（A16；单端项目全部端键可省略 = 唯一端，以下规则自动退化为现状）

- [ ] **V-SPEC-13**（error）：多端项目每个 page/menu 带 `app` 且 ∈ 端册；`nav` target 与本页同端
  （跨端交接只能写 `vima:flow`）；menu.page 与 menu.app 同端。
- [ ] **V-SPEC-14**（error）：端册每个 app 在 spec 中 ≥1 个页面（入册未设计 = 端册与规格漂移）。
- [ ] **V-CON-07**（error）：多端项目每个契约 api 带非空 `consumers` ⊆ 端册；
  每页 apis ⊆ 其归属端可见（consumers 含该端）的接口集——越权引用设计期拦截。
- [ ] **V-TASK-10**（error）：多端项目 side=frontend|fullstack 任务带 `app` ∈ 端册；
  side=backend 禁带 app；带 page 的任务 app == 页面归属端。
- [ ] 端化既有规则：V-SPEC-04 词表按端 kind 取（planning.kinds 同源）；V-SPEC-12 regions
  仅 kind 声明允许的端可用；V-SPEC-08 菜单功能点接口的 consumers 须含 menu.app；
  V-CON-03 谁消费谁承接（每消费端 ≥1 该端 fe 任务 + 每 module ≥1 be 任务）；
  V-COV-01 多端矩阵首列为「端」。

## 跨产物 YAML 纪律

- [ ] **V-YAML-01**（warn）：vima 数据块的 flow 上下文（`[...]` / `{...}` 内）不得出现未加引号的
  花括号。路径参数必须写成 `{id}`（V-CODE 的归一只认花括号），但 YAML 规范不允许 flow 里的
  plain scalar 含 `{`——本解析器容忍 flow 序列、却在 flow 映射上报「键 X 后缺少 :」，
  于是同一份文件「vima 能读、标准 YAML 读不了」，报错信息还与真实病因相去甚远。
  统一出路是给含花括号的值加引号，两边都能解析。块级序列（`- GET /api/x/{id}`）本就合法，不在此列。

## 代码 ↔ 契约对账（A6；带 `@vima` 标注的业务代码才参与，规划期无代码时自然为空）

- [ ] **V-CODE-01**（error）：端册各端 `<dir>/<codeDir>` 下带 `@vima` 标注文件中的
  `request.<method>(路径字面量)` 归一后（非 /api 开头补前缀；`${expr}` 与 `{id}` 归一为
  `{*}`）必须 ∈ 契约 apis，**且该接口 consumers 含文件归属端**（否则报越权调用，A16）。
  请求门面 `request.<verb>(path)` 是各端骨架契约，一条正则通吃全部端。
  单向对账防野生接口；实现完整性由 Verifier 逐点判定负责。
- [ ] **V-CODE-02**（error）：后端带 `@vima` 标注 Controller 的类级 `@RequestMapping`
  基路径 + `@*Mapping` 子路径拼接归一后必须 ∈ 契约 apis。

## 待确认项

- [ ] **V-PEND-01**（warn）：全部 `pendingConfirm: true` 条目已收集进报告；
  评审时逐条向用户确认并删除标记（`vima approve` 时该项升级为阻断）。

## 机检之外的人工核对项（validate 查不出，评审闸门负责）

- [ ] 内容与 `docs/raw/` 原文一致（语义抽查由 Verifier 子代理执行，pendingConfirm 项全检）。
- [ ] 覆盖矩阵行与原始需求逐条对得上，没有需求被静默丢弃。
- [ ] 审计视图与原型已在浏览器中人工核对（角色权限/菜单功能点/流程泳道/页面详情/布局交互）。
