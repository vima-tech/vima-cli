# admin 产物机械校验清单（validate.checklist）

> 本清单逐条镜像 `vima validate` 的规则表（编号与语义与 CLI 实现一一对应，
> 真源见 docs/internal-contracts.md §8）。
> **机检入口：`vima validate`**（全量）/ `vima validate --artifact <path>`（只跑关联规则）。
> 用途：① Agent 每份产物落盘后先机检、再对照本清单人工核对；② 人评审时逐项打勾。
> 级别说明：error 不通过则 validate exit 2；warn 记入报告不阻断（approve 时 V-PEND-01 升级为阻断）。

## spec.md（docs/spec.md）

- [ ] **V-SPEC-01**（error）：八章齐全，标题前缀逐字为
  `## 1. 系统概述`、`## 2. 数据模型`、`## 3. 页面清单`、`## 4. 接口清单`、
  `## 5. 业务规则`、`## 6. 权限设计`、`## 7. 技术栈`、`## 8. 关键决策记录`。
- [ ] **V-SPEC-02**（error）：`vima:entities` 数据块存在；每个 entity 有非空 fields。
- [ ] **V-SPEC-03**（error）：每个 `vima:page` 页面级粒度四要素齐全——
  layout 非空、components 非空、apis 非空；每个交互 `action ∈ {nav, modal, api}`
  且字段匹配（nav/modal 带 target，api 带 api）。
- [ ] **V-SPEC-04**（error）：layout 与 components[].block 用词
  ⊆ `{toolbar, search, table, form, cards, tabs, pagination}`。
- [ ] **V-SPEC-05**（error）：nav 的 target 指向存在的 PAGE-xx；modal 的 target
  在本页 modals 中定义；PAGE/MODAL/ROLE/MENU/FLOW 全部 ID 全文档唯一。
- [ ] **V-SPEC-06**（error）：每个 role.menus 非空且指向存在的 MENU；
  无角色覆盖且未标 `uncovered: true` 的菜单视为权限盲区，校验失败。
- [ ] **V-SPEC-07**（error）：每页 apis ⊆ 契约 apis（跨文件交叉引用，按 `METHOD /path` 比对）。
- [ ] **V-SPEC-08**（error）：菜单功能点接口闭环——menu.features[].api（存在时）必须在契约中
  （「功能点 → 接口 → 契约」链条不许断）。
- [ ] **V-DEC-01**（error）：第八章含 markdown 表格且表头含「已否决方案」列。

## 契约（docs/contracts/*.md）

- [ ] **V-CON-01**（error）：每个契约 api 五要素齐全——method/path/request/response/errors
  （request 允许空数组，但字段必须显式存在）。
- [ ] **V-CON-02**（warn）：契约 api 未被任何页面 apis 引用（孤儿接口）——确认是否确属后台任务用接口。
- [ ] **V-CON-03**（error）：每个契约 module 至少有一个 frontend 任务与一个 backend 任务
  通过 `contract` 字段引用它（admin 前后端成对纪律）。
- [ ] **V-CON-04**（error）：契约唯一性——module 名跨文件唯一；`METHOD path` 键跨全部契约唯一
  （§9.5 唯一事实来源，防后写覆盖先写）。

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

## 覆盖矩阵（docs/coverage-matrix.md）

- [ ] **V-COV-01**（error）：文件存在，表格 ≥3 列，任何数据行不得有空单元格或 `TODO`（缺口）。

## 待确认项

- [ ] **V-PEND-01**（warn）：全部 `pendingConfirm: true` 条目已收集进报告；
  评审时逐条向用户确认并删除标记（`vima approve` 时该项升级为阻断）。

## 机检之外的人工核对项（validate 查不出，评审闸门负责）

- [ ] 内容与 `docs/raw/` 原文一致（语义抽查由 Verifier 子代理执行，pendingConfirm 项全检）。
- [ ] 覆盖矩阵行与原始需求逐条对得上，没有需求被静默丢弃。
- [ ] 审计视图与原型已在浏览器中人工核对（角色权限/菜单功能点/流程泳道/页面详情/布局交互）。
