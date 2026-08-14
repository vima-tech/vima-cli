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
- [ ] **V-SPEC-15**（warn，A22/F1）：弹窗字段 ↔ 提交入参双向对账。正向弹窗必填字段须在
  `submit.api` 的入参里（否则用户填了即丢）；反向该端点必填入参须有弹窗字段可填
  （否则提交必被 40001 拒绝）。**缺的那个字段往往正是某个业务判断的输入。**
  三条排除项：submit 指向 GET 的弹窗跳过、路径参数跳过、存在未声明子结构的 json 聚合入参时
  该端点整体跳过。**恒为 warn**——定位是候选清单，最终定性靠实现者实地验证。
- [ ] **V-SPEC-16**（error，A22/F3）：跨页导航参数取值域闭环。`action: nav` 携带 `params` 时，
- [ ] **V-DSN-01**（error，A27）：页面带 `design` 键时 `pattern` ∈ list/detail/form/workbench/master-detail/board、`density` ∈ compact/default/loose（页/块/列三级密度同规则；列 `role` 唯一取值 primary）。未声明 design 的页面不触发
- [ ] **V-DSN-03**（error，A27）：同一区块词出现多例时逐例带 `name` 且页内唯一——否则渲染/对账/评审分不清「哪个 cards」
- [ ] **V-DSN-04**（error，A27）：`data.shape` ∈ list/record/metrics/timeline/chart/freeform；`freeform` 必带 `intent`（自由发挥区必须声明意图）
- [ ] **V-DSN-05**（error，A27）：`priority` ∈ primary/secondary/overflow；页面级动作（items 按钮 + actions）primary 合计 ≤1、每块 rowActions 内 primary ≤1——两个主按钮 = 没有主按钮
- [ ] **V-DSN-06**（warn，A27）：单块 rowActions >3 条且无一条 overflow → 提示收进「更多」（ActionGroup 按密度档收纳）
- [ ] **V-DSN-07**（error，A27）：`design.fold` 引用的组件实例名必须存在（首屏承诺不许悬空）
- [ ] **V-DSN-08**（warn，A27）：`shape: list` 未声明 `keyFields` → 信息优先级未定
  key 须 ∈ 目标页 `params[].name`、value 须 ∈ 该项 `values`。每个页面单看都自洽，
  只有跨页对照才暴露——目标页对未知 key 静默落兜底分支且不报错。不携带 params 的 nav 不触发。
- [ ] **V-SPEC-17**（error，A33）：flow 步骤引用闭环。每条流程须有非空 `steps`；步骤声明的
  `role` / `page` / `next` / `api` 必须存在（api 归一后 ∈ 契约）。只校验已声明字段——
  悬空引用是确凿缺陷：写 `page: PAGE-99` 的流程此前能通过全部规则。
- [ ] **V-SPEC-18**（warn，A33）：flow 步骤角色可达性。步骤角色未拥有该步页面的菜单 →
  提示不可达。恒 warn——页面可经 nav 从他页到达，菜单不是唯一入口，请人工复核。
- [ ] **V-DEC-01**（error）：第八章含 markdown 表格且表头含「已否决方案」列。

## 契约（docs/contracts/*.md）

- [ ] **V-CON-01**（error）：每个契约 api 五要素齐全——method/path/request/response/errors
  （request 允许空数组，但字段必须显式存在）。
- [ ] **V-CON-02**（warn）：契约 api 未被任何页面 apis 引用（孤儿接口）——确认是否确属后台任务用接口。
- [ ] **V-CON-03**（error）：每个契约 module 至少有一个 frontend 任务与一个 backend 任务
  通过 `contract` 字段引用它（admin 前后端成对纪律）。
- [ ] **V-CON-04**（error）：契约唯一性——module 名跨文件唯一；`METHOD path` 键跨全部契约唯一
  （§9.5 唯一事实来源，防后写覆盖先写）。
- [ ] **V-CON-08**（warn，A22/F2）：字段四面对账。同一契约 module 内按 create（POST 入参）/
  update（PUT·PATCH 入参）/ read（GET 响应）三桶归集；**写面出现而任何 GET 响应里都没有**的字段
  → 疑似「只进不出」（新建能填、之后查不到改不了，且前端不报错）。确属只写字段
  （密码、批量操作入参）标 `writeOnly: true` 豁免。**只查「只进」方向**——id/createdAt/计算字段
  天然只在响应里，反方向报出来是纯噪声。
- [ ] **V-CON-09**（warn，A22/F4）：聚合 json 子协议。`type: json` 的字段既无 `fields` 子结构
  又无 `enforced: false` → warn（内部零约束时写入方/读取方/后端计算方各写各的，
  编译期与机检都看不见，运行时「存进去了但算不对」）。确实没有权威结构的显式标
  `enforced: false`。第二条：同名聚合字段在不同 module 给出不同子结构 → 提示同名不同义，
  **只提示不判错**（不同领域对象重名是允许的，统一成一套反而是过度抽象）。
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
- [ ] **V-TASK-11**（warn，A18）：`layer=business` 且 `side ∈ {backend,fullstack}` 的任务，
  负责接口数 ≤ **10**（负责集 = frontmatter `apis`，未声明则取契约全集）。
  超限即按子域拆分——批次时长取批内最大值，超大任务把本可并行的工作串行化
  （sustain-v3 实测：单任务 4527 行 = 同批最小任务 7 倍，并行槽空转率 52–54%）。
  **A24：`status=done` 的任务不参与**——唯一行动项「拆分」已不可执行，
  留着只会变成永不消失的 warn 并连累整张列表的可信度。
- [ ] **V-TASK-12**（error，A18）：`apis` 每条 ∈ 该契约 apis；同契约 side=backend 的任务
  之间**负责集不重叠**（防重复实现）；若该契约下全部 backend 任务都声明了 `apis`，
  并集须等于契约全集（防漏实现）。未声明 `apis` 的任务按「负责全集」语义，不触发后两项。
- [ ] **V-TASK-13**（warn，A20）：存在 `layer=business` 任务时，须有 `layer=pipeline` 的
  收尾流水线任务（`full-test` + `code-audit`，模板见 `docs/tasks/_template-full-test.md`
  与 `_template-code-audit.md`）。缺失时 `/go` 的「流水线全部通过」条件恒真，
  全量测试与代码审计从不执行。设计期只 warn（不阻断存量项目开工），
  收口期由 `vima converge` 的 V-INT-05 升级为 error。

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

## 跨任务集成对账（A20；`vima converge` 执行，**不属 validate**，收口期跑）

V-CODE 是**单向**对账（单个文件不得出现契约之外的接口）；下列 V-INT 是**跨任务合并
视角**——契约的每个接口在整个代码库里被实现了几次、被谁实现。全部批次开发完成后由
`/go` 收口闸门自动执行，也可随时手动跑 `vima converge`。

- [ ] **V-INT-01**（error）：契约每个接口在带 `@vima` 标注的后端代码中至少有一处实现
  （**仅当其负责任务全部 `status=done`** 时判定，开发中途跑不假红）。
- [ ] **V-INT-02**（error）：同一接口不得在 ≥2 个后端文件重复实现（运行期路由冲突）。
- [ ] **V-INT-03**（error）：实现者须在该接口的 `apis` 责任田内（仅当该契约下有任务
  声明了 `apis` 时启用）。
- [ ] **V-INT-04**（warn）：契约授权端（`consumers`）在其带标注代码中确有调用，
  否则是联调断点或契约冗余。
- [ ] **V-INT-05**（error）：存在 business 任务时必须有 pipeline 收尾任务（同 V-TASK-13）。
- [ ] 报告 `.vima/reports/convergence.json` 的 `byTask` 已作为修复调度输入
  （谁的问题派回谁改，不由主 Agent 自行判断归属）。

## 待确认项

- [ ] **V-PEND-01**（warn）：全部 `pendingConfirm: true` 条目已收集进报告；
  评审时逐条向用户确认并删除标记（`vima approve` 时该项升级为阻断）。

## 机检之外的人工核对项（validate 查不出，评审闸门负责）

- [ ] 内容与 `docs/raw/` 原文一致（语义抽查由 Verifier 子代理执行，pendingConfirm 项全检）。
- [ ] 覆盖矩阵行与原始需求逐条对得上，没有需求被静默丢弃。
- [ ] 审计视图与原型已在浏览器中人工核对（角色权限/菜单功能点/流程泳道/页面详情/布局交互）。
