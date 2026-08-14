# 视觉真源的兑现机制：A34 立项方案（v5 · 可实施版 · 不分期）

> 创建日期：2026-08-14　更新日期：2026-08-14（v5：**撤销分期**，改为一次完整落地；收敛 codex 第六轮三项内部矛盾 + 两处接线）
> 出处：`docs/design/sustain-vima-visual-regression-analysis.md`（codex 评估报告，六轮）
> + 本仓独立取证复核（Sustain 旧版 `d6f4382^` ↔ 重建版 `HEAD`）
> 性质：**立项方案**，待裁定后升为增补项 A34（A33 为当前最大号，A26 被在途草案预占）
> 范围：本文只定方案与落点，不含实现；`lib/` 与模板资产零改动
>
> **版本演进**（详见 §11 改判记录，仅作防重犯留痕，**不构成执行依据**）：
> v1 追加式修订造出两套真源 → v2 全文重写收敛；
> v2 仍有四处会导致**绕过 / 死锁 / 双真源 / 验收无消费方**的缺陷 → v3 逐条修复；
> v3 仍有三处**契约级留白**（回写闸门死锁 / 状态键混义 / digest 无范围）→ v4 逐条补齐。
> **其中两处是本方案重犯了它自己诊断出的病**：
> `fidelity` 设为「可选键、未声明零影响」＝重建了 G2 的零成本逃生口（v3 修）；
> 三类 Verifier 只写职责不定报告契约＝在验收层重演 G1 的「有承诺、无消费方」（v3 修）。
> **v4 另修一处同型**：V-DSN-09 与批准摘要原排一期，但其唯一执行者在二期才落地——
> **规则先于执行者存在，又是一条无执行者的规范**（违反 A6）。
> **v5 按用户裁定撤销分期**：本方案一次完整落地，§9 只保留**实施依赖序**（什么必须先于什么），
> 不再有「某期可先发布」的口径——该口径正是上述同型缺陷的温床。
> v5 另修三处内部矛盾：`design check` 跨两阶段用两套未声明的通过条件、
> checklist 持久键自相矛盾、`approve --planning` 会被 V-TASK/V-COV 阻断。

---

## 0. 先更正三条前提（不更正会做错方案）

codex 报告的诊断方向正确、证据扎实，但它第一轮分析的对象是 **vima 2.0.2**，
而当前仓库是 **3.0.2**。直接照单实施会重复建设已落地的能力，违反防过度设计红线。

| codex 前提 | 实测 | 影响 |
|---|---|---|
| 「页面词表只有七词」 | `lib/model/apps.mjs:13` 现为 **10 词**（增 `steps`/`collapse`/`anchor`） | 根因描述需按 3.0.2 重述 |
| 「PDL 无法回答『哪块是主角』『数据该用图还是表』」 | A27 已落 `design.pattern`(6) / `density` / `fold`（V-DSN-07 引用闭环）/ `data.shape` ∈ {list,record,metrics,**timeline**,**chart**,freeform} / `regions[].role: primary` / `actions.priority` / V-DSN-01–08 共 7 条机检 | codex 首轮 §6.7 建议的大半**已实现**；`shape: freeform + intent` 就是它要的块级逃生口 |
| 「Sustain 是 vima 的产物，故 vima 有此缺陷」 | Sustain `lifecycle.json:62` = `"vimaVersion": "2.0.2"`；其 `spec.md` 中 `design:` 块 **0 个**、`data.shape` **0 处**、`fold` **0 处** | **Sustain 是 pre-A27 样本**，不能用它证明 3.0.2 的现状 |

**更正后的结论不是「问题不存在」，而是「问题换了位置」**：A27 补齐了*声明*能力，
A29/A30 补齐了*工序*，但三者都没有补齐**兑现机制与实现权限**。

codex 报告中被本次复核**证实**的关键证据（应予采信）：

1. **spec 自认信息丢失并照常交付**——`Sustain/docs/spec.md` 四处原文：
   > 「区块词表无『三栏外壳』『持久侧栏』『锚点条』对应词，下方 YAML 是最接近的**降级表达**」（863 行）
   > 「区块词表无对应词，下方以 cards + form + table **降级表达**」（2468 行，随访模板设计器）
   > 「区块词表无『两栏工作台』对应词，下方以 tabs + table + form **降级表达**」（2633 行，咨询处理）

   并登记成决策 `D-03`。**管线记录了自己的有损压缩，然后照常放行。**
2. **PAGE-03 反证**：同一管线、同一组件库、同一 Builder，只因 spec 给了 1:1 版面说明，
   就产出 1085 行三列工作台。瓶颈是**信息与授权**，不是组件能力。
3. **Builder/Verifier 不对称激励**：`vima-builder.md:59` + `:14`；
   `vima-verifier.md` 中「设计稿/视觉/构图/截图」命中数 = **0**。

---

## 1. 根因：违反的是 vima 自己的三条既有原则

| 既有原则 | 原文要义 | 视觉轨道的现状 | 判定 |
|---|---|---|---|
| **A6 规范执行者阶梯** | 每条规范必须有**唯一机器执行者**；落不到 L1/L3 的才上 L5 人审 | A29/A30 引入的全部视觉规范**零执行者**，且未走 L5 登记 | **违反** |
| **A5 能力诚实分级** | 不宣称采集不到的等级 | `approve` 是单一布尔，结构审与视觉审混为一个状态 | **违反** |
| **A2 单一真源裁定** | 页面结构以 spec 数据块为唯一真源 | A29 引入设计稿作**第二真源**，但两源裁定规则只写在文档，无机检、无冲突判定位 | **半违反** |

**一句话根因**：A29/A30 把「视觉」升格为一等公民**在措辞上**，
却没配 vima 对待其他一等公民的三件套——**声明位、执行者、状态位**；
同时 Builder 侧**没有实现它所需的权限**。
于是它退化成一条 *有承诺、无兑现、降级零成本、且即便看见稿也无权实现* 的空轨道。

---

## 2. 缺口清单（八条，每条可复现）

| # | 缺口 | 复现命令 / 位置 | 严重度 |
|---|---|---|---|
| G1 | **`design-links.md` 是幽灵文件**：被 3 份程序资产引用，但无模板、无 init 落点、无机检消费方 | `grep -rn design-links lib/ \| wc -l` → **0**；而 `go.md:197`、`_template-fe.md:71`、`planning-guide.md:300,313` 都依赖它 | **致命** |
| G2 | **降级是零成本且被明文祝福** | `planning-guide.md:314`「**只做 Stage A、不做 Stage B**：**合法**」；`_template-fe.md:72`「无稿页写『无稿』」 | **致命** |
| G3 | **Builder 无构图权** | `_template-fe.md:70`「不在页面里自写 `display: grid`」+ `vima-builder.md:14,59`。**即便设计稿到位，实现端也无权落地** | **致命** |
| G4 | **5.2.6 校准轮是条件性空转** | `go.md:197`「**有登记稿的页面**」——零登记则整轮 no-op，且无环节检查登记数 | 高 |
| G5 | **verifier 视觉验收面为空** | `grep -c '设计稿\|视觉\|构图\|截图' templates/admin/workspace/agents/vima-verifier.md` → **0** | 高 |
| G6 | **`pattern` 六枚举封闭，无 `custom`** | `V-DSN-01`。三栏设计器 / 会话工作台无归属，只能降级 | 中 |
| G7 | **领域组件无所有权落点** | `vima-builder.md:44` 禁改 `src/components/` 整目录 | 中 |
| G8 | **风格由确定性函数直推，无发散环节** | A30 `D-A30-06`：观察量(8) → 推导规则(8) → 取向轴档位(7)。**同一输入恒得同一输出** | 中（**上限侧根因**） |

> **v1 的一处错误主张已删除**：v1 称「G1+G2 是充要条件」。不成立——G3 独立成立时，
> 即使 G1/G2 修好，Builder 仍无权实现设计稿。G1/G2/G3 是三条**并列**关键原因。

---

## 3. 方案总纲

```text
M1 最小声明位      fidelity / primaryTask / typed mustPreserve / pattern:custom（设计目录由 pageId 推导）
M2 授权与构图权    Builder 三层授权 + 内容区自由构图 + 领域组件落点          ← 必选，非可选
M3 真源与新鲜度    真源权威表 + Stage B 冻结 + 批准摘要失效 + 只读派生 INDEX
M4 DESIGNING 阶段  独立阶段与闸门 + A0 三方向发散 + 顺序反转 + 受控回写环
M5 三类验收        Semantic / Design / Experience + 报告契约 + context 注入 + /go 硬门
M6 项目化沉淀      interaction-language + retro 反哺 + Sustain 四页样本
```

**M1 + M2 必须同批**：M1 让设计**进得来且不丢**，M2 让它**落得下**。
只做 M1 的结果是「退化被发现并阻断，但无人能修好」。

---

## 4. 选型决策表（A4 体例 · 最终裁定，共 31 条）

### M1 最小声明位

| 编号 | 决策 | 理由 | 已否决方案 | 否决理由 |
|---|---|---|---|---|
| D-A34-01 | PDL `design.fidelity` ∈ `{D0,D1,D2}`。**新增 V-DSN-12**(error)：A34 后创建的项目、以及 `vima change` 新增的页面，**必须显式声明** `fidelity`——**D0 是一次明确裁定，不能用「缺失」等价替代**；仅 `designCapability: legacy` 的存量页允许缺失。`fidelityClassified` **由本规则确定性计算**，不是人工布尔（**不是** `designArtifactsComplete`——那归 V-DSN-09，见 D-A34-13） | **v2 把它设为「可选键、未声明零影响」，等于把 G2 的逃生口原样重建**：不写 fidelity → 不是 D1/D2 → 跳过全部设计流程，全绿进开发。A27 的「全部可选」口径适用于增量润色，**不适用于一条以「堵逃生口」为目的的机制** | v2「可选键、未声明零影响」 | 见左，这是 v2 最大剩余漏洞 |
| D-A34-02 | **删除 `designRef` 字段**：设计目录路径由 `pageId` 确定性推导为 `docs/review/design/<PAGE-id>/`（其 `manifest.json` 为该页设计文件清单）。**V-DSN-09**(error) 检查目录与 manifest 存在及清单完备——但**只在 DESIGNING 出口由 `vima design check` 触发，PLANNING 期的 `vima validate` 不检查设计文件存在性** | ① 治阶段死锁：设计文件在 DESIGNING 才产生，而 `/go` 在离开 PLANNING 前跑 validate；v2 让 V-DSN-09 在 PLANNING 生效 = **PLANNING 永远过不去**。② **承重假设**：`V-SPEC-05` 已强制「PAGE/MODAL/ROLE/MENU/FLOW/RULE/NG ID **全文档唯一**」，多端项目同样适用，故 `docs/review/design/<PAGE-id>/` 无撞路径风险——**本条决策依赖该规则，放宽 id 唯一性即失效**。③ 路径既已固定，`designRef` 就是可推导冗余——留着它就多一个能与真源不一致的写入口（v3 的真源权威表里它无处安放正是信号）。**删字段比给字段找归属更干净** | ① v2「designRef 为单文件路径 + V-DSN-09 全期生效」；② v3「designRef 保留但归 spec」 | ① 死锁，且与 D-A34-11 的目录形态自相矛盾；② 可推导值进 schema = 镀金，且必然出现「路径写错但文件存在」的第三种状态 |
| D-A34-03 | 分级**由 spec 可判定判据自动建议**（`custom`/`freeform` → D2；`shape ∈ {metrics,timeline,chart}` 或 `regions` ≥2 列 → D1；其余 → D0）；**首次裁定时人可选任意级别**（机器建议仅供参考）；**批准之后的降级**才需用户显式豁免并记录理由 | v2 的「只许升不许降」与「自动建议」冲突——机器建议错时，人在**首次**裁定就被锁死。约束应落在「已批准的东西不许悄悄降级」，而非「首次不许选低」 | v2「一律只许升不许降」 | 见左 |
| D-A34-04 | `design.primaryTask`（一句话：本页用户最重要的任务），**D1/D2 必填** | 全套声明里唯一回答「这页为何存在」的键，且是 Experience 验收的被测对象 | 用 `intent` 兼任 | `intent` 是**块级**「自由发挥区意图」（A27 既有语义），页级任务是另一层 |
| D-A34-05 | **`design.mustPreserve` 为带类型的结构**：每条 `{id, kind ∈ {visual,interaction,runtime}, statement, verifier ∈ {design,experience}}`。D2 必填（**V-DSN-11**, error：四键齐全且 `verifier` 与 `kind` 相容） | 登记本页**不得被降级掉**的交互事实，直击 Sustain「降级表达」病根。**类型即执行者路由**——`visual` 看图可裁，`interaction`/`runtime` 必须跑链路，满足 A6「每条规范有唯一执行者」 | 字符串数组 | 「配置与预览同步」「切换患者不重挂载」**无法靠一张截图裁定**，无类型就无执行者 |
| D-A34-06 | `V-DSN-01` 的 `pattern` 枚举增 **`custom`**；`custom` 必须同时带 `intent` + `fidelity: D2`（**V-DSN-10**, error。设计目录由 pageId 推导，其存在性归 V-DSN-09 在 DESIGNING 出口检查，本规则不查文件） | 沿用 A27 `shape: freeform` 口径——「自由发挥区必须声明意图，**诚实标注好过假覆盖**」 | 继续扩 `layoutVocab` / `pattern` 枚举 | 枚举必然膨胀且永远表达不完整页构图。**已有反例**：10 词词表仍装不下三栏设计器 |

### M2 授权与构图权（**与 M1 不可拆**）

| 编号 | 决策 | 理由 | 已否决方案 | 否决理由 |
|---|---|---|---|---|
| D-A34-07 | Builder 越界口径**三层重写**：**锁定层**（字段/API/权限/业务规则/页面能力/本期范围——擅改即 fail，不变）＋**遵循层**（D1/D2 必须遵循已批准稿：主区域关系、动作主次、信息层级、状态与空态、`mustPreserve`）＋**自由层**（页面级 grid/flex、表现层子结构、图表或卡片内部组织、微交互、hover/transition、page-local CSS、响应式细节、**提出**领域组件提取请求）。关键措辞：**不得把设计稿中的图表、消息流、画布、时间线或实时预览降级为表格或 textarea** | 治 G3。当前口径把「多一个按钮」（业务扩权）与「把表格画成趋势图」（表现层）判为同类违规，Agent 选保守实现是**理性最优解** | ① 维持单一「与 spec 一致」口径；② v2 自由层写「领域组件提取」 | ① 见左；② **与 D-A34-09「页面任务只读消费」直接冲突**——页面 Builder 只能*提请求*，不能自己建 |
| D-A34-08 | **D-A30-04 范围澄清**：壳层 / 间距刻度 / 卡片形态**仍然冻结**（原判不变）；**页面内容区**允许 page-local grid。同一构图**第二次出现**时触发上收 Stage A | D-A30-04 的顾虑「Stage B 自由发挥 = 等于没分段」成立，故壳层与刻度维持冻结。但被禁的「不在页面里自写 grid」波及的是**内容区构图**，而内容区构图恰是页面辨识度所在。「第二次出现」给上收一个**可判定触发点** | ① 维持全面禁止；② 全面放开 | ① 两段式退化为「从六种模式里挑一个」，只是把 10 词表换成 6 模式表；② 回到旧版漂移问题 |
| D-A34-09 | 共享层三分：`src/components/`（框架层+项目级，只读，不变）＋新增 `src/features/<domain>/components/`。**走「领域级 shared task 先建、页面任务只读消费 + 可提提取请求（由 shared task 或补偿批执行）」路线**（沿用既有 `dependsOn` 串行模型，**本条不引入新 schema 键**——注意这只针对领域所有权，M1 的最小 schema 照落）；实测不足再引入任务 `domain` 字段与计划器互斥。**落点精确到 `sharedDirs`**：`features/` **不得加入** `template.json` 的 `apps[].sharedDirs`——`guard-shared.mjs` 的写保护面运行时读 `manifest.json` 的该键，进了 sharedDirs 则领域 shared task 自己也写不了 | 治 G7。旧版 `PatientContextBar` 被 8 页共用——这类跨页领域结构在「只能写自己目录」的边界下**结构上不可能产生** | ① 维持整目录只读；② 直接引入 `domain` 字段 + 计划器互斥 | ① 项目永远只能消费模板组件；② 无实证前先加字段与计划器逻辑 = 镀金，且**当前任务 frontmatter 无 `domain` 字段**，加它要动计划器一整圈 |

### M3 真源与新鲜度

| 编号 | 决策 | 理由 | 已否决方案 | 否决理由 |
|---|---|---|---|---|
| D-A34-10 | **真源权威表**（治 v2 的四处并存写入口）：<br>· `fidelity` / `primaryTask` / `mustPreserve` → **spec 唯一真源**<br>· 设计目录路径 → **由 `pageId` 推导，不存储**（D-A34-02）<br>· 设计文件清单 → **`docs/review/design/<PAGE>/manifest.json`**<br>· 批准时间与被批准摘要 → **`lifecycle.designApproval`（唯一持久化批准状态）**<br>· `docs/review/design/INDEX.json` → **确定性生成的只读索引**（同 render-* 产物口径，`--check` 验漂移，**不含 `approved`**）<br>· **批准摘要按端/按页存储**：`lifecycle.designApproval.directions.<appId>` 与 `.pages.<pageId>`（**`direction` 不能是单数**——A0 已改为按端发散，多端各选方向时单键无法表达）<br>· **DESIGNING checklist 只有 2 个持久键**：`briefReady` / `directionsExplored` **写入 lifecycle**（人工里程碑，无从推导）；其余 **6 键一律不写入**，由 `vima design status` 确定性派生——`directionApproved`（从 `designApproval.directions.*` 摘要有效性推导）、`signaturePagesApproved`（从 `designApproval.pages.*` 推导）、`fidelityClassified`、`designArtifactsComplete`、`designApprovalFresh`、`designSystemFrozen` | v2 让 spec / INDEX / lifecycle / checklist 四处都能表达 fidelity 或 approved，**正是本文 §1 指控 A29 的 A2 双真源问题，在本方案内部重现**。v3 虽定了权威表，但没说清 checklist 哪些键落盘——不说清就等于默许两种实现 | ① v2「INDEX.json 存 fidelity/designRef/approved/digest」；② v3「批准项从摘要推导」但未区分其余键 | ① 见左；② 「可推导」与「已存储」混在一张 checklist 里，实现者必然把六个键一律落盘，退回双真源 |
| D-A34-11 | **Stage B 逐页稿冻结进仓库** `docs/review/design/<PAGE-id>/`（D1：`default.png` + `empty.png` + `manifest.json`；D2：额外 `prototype.html` + `scenarios.md`）。**D2 的 `prototype.html` 必须自包含**——字体/图片/脚本内联或与之同目录冻结并登记进 `manifest.json`，**零外部网络请求**。**Stage A 稿仍按 D-A30-02「用完即弃」** | 对 D-A30-02 的**范围澄清而非推翻**：Stage A 的产物是 `layout.css`/`tokens.css`，稿确可弃；Stage B 的稿是校准轮的**比较基线**，弃了就没有被比较项。**自包含是既有先例**：本仓 `prototype.template.html` 文件头即写「单文件零外部请求（href 仅 # 锚点）」——冻结物依赖外链等于冻结了一个会过期的基线 | ① 两段稿都冻结；② 都不冻结；③ 冻结但允许外链资源 | ① Stage A 稿已有代码化产物，再冻是冗余；② 即 G4 现状；③ 数月后外链失效，校准轮拿不到基线，等同没冻 |
| D-A34-12 | **批准带内容摘要与自动失效，且按批准类型分开计算**：<br>· `lifecycle.designApproval.directions.<appId>` 各记 `approvedAt` + `digest`，其 digest = **该端 Design Brief + 三方向产物 + 差异矩阵 + 用户选择结果**；它不包含 reconcile 后的 spec/契约，故「用已批准方向回写规格」不会让方向批准自我失效<br>· `lifecycle.designApproval.pages.<pageId>` 各记 `approvedAt` + `digest`，其 digest = **页 `design` 块 + `primaryTask`/`mustPreserve` + 相关契约切片 + 本页设计目录 + 该端 Stage A 核心资产 + `interaction-language.md`（D1/D2）**<br>任一摘要输入变化时，由 `vima design status/check` **派生 stale**；不另写失效布尔。`designApprovalFresh` = 当前项目全部必需方向与页面批准均存在且未 stale | **直接复用 A12 既有机制**——`render-review.mjs` 已导出 `checkReviewFresh(root, cliRoot)` 作「漂移判定单一真源」，approve 前置检查漂移即 exit 4。本条只是把同一模式套到设计批准上，**不新造机制**。方向批准与页面批准若共用一套 digest，reconcile 修改 spec 时会把触发它的方向批准自己作废 | ① 纯布尔 `directionApproved: true`；② 方向与页面共用同一摘要范围 | ① 陈旧布尔：批准旧稿、开发新稿，状态位永真；② reconcile 自我失效，或为避免死循环而放弃页面级新鲜度 |

### M4 DESIGNING 阶段与发散

| 编号 | 决策 | 理由 | 已否决方案 | 否决理由 |
|---|---|---|---|---|
| D-A34-13 | **新增 DESIGNING 阶段**（PLANNING → **DESIGNING** → DEVELOPING）。checklists **拆为三类不同事实**（v3 的 `designCoverageComplete` 一个键混了两件事）：<br>· **人工里程碑（写入 lifecycle，仅 2 键）**：`briefReady`、`directionsExplored`<br>· **确定性派生（不写入，6 键）**：`directionApproved` 与 `signaturePagesApproved`（**从 `designApproval` 摘要有效性推导**——写进 checklist 就会与 `designApproval` 表达同一事实，退回双真源）、`fidelityClassified`（**V-DSN-12**）、`designArtifactsComplete`（**V-DSN-09**）、`designApprovalFresh`（digest）、`designSystemFrozen`（Stage A 核心三产物存在且未漂移；项目含 D1/D2 时再要求 `interaction-language.md` 存在且未漂移）<br>**全页均为 D0 的项目确定性跳过 DESIGNING**（阶段自动置完成并在报告注明「无 D1/D2 页」），其设计语言**继续由 A30 的确定性推导产出 Stage A 核心三产物**——D0-only 不是「没有设计语言」，只是不走发散，也不凭空生成未经实例验证的交互语言 | 设计有独立产物、独立闸门、独立失败模式；挂在 PLANNING 末尾必然被压缩成一小步。v3 用一个 `designCoverageComplete` 同时表示「都分级了」和「文件都齐了」——**两者不是同一事实**，且分属 PLANNING 与 DESIGNING 两个阶段，混在一个键里无法定位失败点。D0-only 的 Stage A 来源若不写明，「D0 由 Stage A 覆盖」就没有产出方 | ① approve 拆双布尔；② 沿用 v3 的 `designCoverageComplete` 单键；③ D0-only 项目无 Stage A | ① 双键只是状态位，无阶段则无强制点；② 一个键两种事实，且跨两个阶段；③ D0 页失去版面语言，退回逐页各自为政 |
| D-A34-14 | **Stage A0 三方向发散**：产出**三个在信息架构、交互重心、视觉重心上真正不同**的方向。**每个方向的交付物不止静态图**，必须含：核心任务流、关键状态转换、**三方向差异矩阵**。→ **用户选择或融合**（可要求第四轮）。**Agent 不得自行选定胜者**。<br>**发散标的按端（A16 端册）划分**：每个 `apps[]` 条目**按其 shell / app kind 各选一张标志性页面**（admin 一张、mp 一张、h5 一张…），不是全项目共用一张 | 治 G8。A30 的推导是**确定性函数**——同一输入恒得同一输出，**输出里不会有惊喜**。**只交三张静态图，三个「方向」很可能只是三套配色**——差异矩阵是把「真的不同」变成可核对的东西。多端项目的壳层与交互模型本就不同（A16/A23/A25 三套 UI 框架），一张 admin 页推不出小程序的版面语言 | ① 维持 A30 直推；② 三方向只交静态图；③ 全项目只做一张标志性页面 | ① 见左；② 无法判定方向是否真的不同，发散退化为换肤；③ 非首端的 Stage A 无产出来源，退回 A29 逐页各自决策 |
| D-A34-15 | **顺序反转**：设计系统从**获胜实例反向提炼**（shell / tokens / 密度 / 卡片形态 / 状态表达 / 动作层级 / 图表语言 / 空态语言 / 页面模式 / 交互语言）。**改判 A30 Stage A 的产出方式**：核心落点仍是 `layout.css` + `tokens.css` + `design-language.md`；项目含 D1/D2 时同步产出 `interaction-language.md`（D-A34-24） | **先有优秀实例，再抽象规则**。先定的语言只能来自推导（见 D-A34-14 病根），逐页再受其约束 = 平庸被固化成资产。交互语言若不从同一获胜实例提炼，视觉与交互会再次分叉 | 维持 Stage A 先定语言再逐页 | 见左 |
| D-A34-16 | **A30 推导规则重新定位**（不废弃）：8 项观察量 → **Design Brief 的事实输入**；8 条推导规则 + 7 轴 → **发散方向的边界与审查清单**。即：**规则负责「不跑偏」，不负责「唯一答案」** | A30 的资产本身有效，只是被放在了「生成器」而非「约束器」的位置 | ① 废弃 A30 推导；② 推导与发散并存各出一版 | ① 丢掉已验证的「不退回老样子」保障；② 两套答案无裁定规则 |
| D-A34-17 | **MCP 编排边界**：`lib/` **只做确定性文件操作**（`vima design status/check/verify/approve/invalidate/reconcile`——校验存在、计算哈希、登记批准摘要、更新状态、生成索引、汇总验收报告）；**Claude Design MCP 调用、无头浏览器、截图冻结全部落 `templates/admin/workspace/`**（新增 `commands/design.md` + `agents/vima-designer.md`）。**具体 MCP 工具名不写进内核契约**；MCP 不可用时 D1/D2 **停在 DESIGNING，不允许静默回退** | **本仓硬约束**：`lib/` 平台中立、不实现任何 Claude Code 语义；零运行时依赖。实测 `lib/` 全仓零 playwright/puppeteer，仅 `upgrade.mjs` 有一处 fetch（查 npm 版本，自升级器本职）——把 MCP + 浏览器塞进 `lib/` 会是**首例破口** | v1 的 `lib/commands/design.mjs` 直接编排 MCP + 无头浏览器 | **直接违反两条硬约束**；且 MCP 连接由 Claude Code 会话持有，普通 Node 进程无法天然调用 |
| D-A34-18 | **存量迁移语义**：存量项目**不自动倒退阶段**；pre-A34 项目标记 `designCapability: legacy`（A5 诚实分级，并据此豁免 V-DSN-12）；新增 D1/D2 页按 **`vima change`（A31）的 scope 局部启用** DESIGNING，不要求整项目回炉；`vima change` 须触发相关设计批准失效（接 D-A34-12） | 治 A19（存量项目升级可达性）在本项上的空白。不标注 legacy 就是宣称存量项目具备它没有的能力 | 存量项目一律回退 DESIGNING | 已交付项目被强制回炉，A19 可达性直接崩 |
| D-A34-19 | **受控回写环 = 新增 `vima design reconcile`**，**复用 A31 已导出的 `computeImpact(root, change)`**（`lib/commands/change.mjs:165` 实测已是 `export`），但**用 DESIGNING 口径的关闭闸门**：只检查 **spec/契约引用闭环**（validate 的 V-SPEC/V-CON 族）与设计批准新鲜度，**不要求受影响任务 done、不跑 converge**；关闭后**重建任务拆解**。<br>**最终任务拆解与 `tasksApproved` 必须发生在设计冻结之后**；设计变更后旧批准与旧拆解一并失效（接 A12/D-A34-12） | **这是「设计能改变产品」与「设计只是装修」的分界**——不许回写，则 A0 发散声称的「信息架构真正不同」无处落地，发散退化为换肤。<br>**但不能直接复用 `vima change close`**：实测 `cmdClose` 要求「受影响任务全部 done」+ validate 零 error（必要时 converge），而 DESIGNING 期任务**尚未拆解**，已有临时任务也多为 pending → **必然死锁**。算法可复用、闸门必须分离 | ① v2「PLANNING 完成后进 DESIGNING，设计不得回写」；② v3「直接走 `vima change` 事务」；③ 给 `change` 加 `mode: design-reconciliation` 枚举 | ① 与 D-A34-14 立项目的直接矛盾；② **实测死锁**（见左）；③ `change` 的语义是「维护期变更事务」，塞进一个规划期分支会让它同时服务两个阶段两套闸门；而 `computeImpact` 已导出，独立入口零重复代价 |

| D-A34-28 | **阶段推进事件表**（明确「谁推进哪一段」，治当前 `/go` 只认 PLANNING→DEVELOPING）：<br>· `PLANNING → DESIGNING`：`vima approve --planning`（使用 D-A34-29 的 planning-brief profile，V-DSN-12 分级完备）<br>· `DESIGNING` 内部：按端执行 `vima design approve direction <appId>`（方向裁定，人工）→ `vima design reconcile`（若方向改动了能力/交互/信息架构）→ `vima design approve pages`（逐页稿裁定，人工）<br>· `DESIGNING → DEVELOPING`：`vima approve`（现有语义，置 `tasksApproved`）——**但前置增加 `vima design check` 六项派生全绿**（`directionApproved` / `signaturePagesApproved` / `fidelityClassified` / `designArtifactsComplete` / `designApprovalFresh` / `designSystemFrozen`）<br>`/go` 步骤 1 相应改为按 `currentPhase` 分派三条路径，**不再假定 PLANNING 的下一站是 DEVELOPING** | 不写事件表，则 `/go`、`vima approve`、`vima design approve` 三者谁推进阶段仍然含糊，实现时必然各写一套。实测 `go.md` 现为「若 currentPhase = PLANNING，依次通过三道闸门」后直进 DEVELOPING，**完全不认 DESIGNING** | 让 `/go` 自行判断该进哪个阶段 | 阶段推进是状态机语义，属确定性内核职责；交给 Agent 判断即 A6 所禁的「规范无唯一执行者」 |
| D-A34-29 | **校验 profile 与 reconcile 顺序定死**：<br>· `vima approve --planning` 使用独立 **`planning-brief` profile**——执行 V-SPEC / V-DEC / V-CON / V-PEND / V-SRC、V-DSN-01…08 与 V-DSN-10/11/12；**不执行 V-TASK-\*、V-COV-01、V-CODE-\***。设计冻结、reconcile 完成、任务重建之后再跑**完整 validate** 与最终 `vima approve`<br>· `vima design reconcile` 六步固定顺序：① 前置要求**所选端的方向批准有效** → ② 回写 spec/契约 → ③ 重算影响面 → ④ **旧页面批准与旧任务批准失效** → ⑤ 方向批准继续以 D-A34-12 的 A0 输入摘要判定，不把 reconcile 后 spec 纳入其摘要，故不会自我失效 → ⑥ Stage B 完成后再批准页面 | ① 实测 `validate` 有 **13 条 V-TASK + V-COV-01**，而 `V-COV-01` 要求 `coverage-matrix.md` 无空格无 TODO（由任务生成）——**任务未拆解时跑完整 validate 必然报错**，PLANNING→DESIGNING 走不通。<br>② 第 ⑤ 步是关键：方向批准证明用户选择了哪套 A0 方向，页面批准才证明该方向已与最终 spec/契约对齐；混用同一 digest 会形成自我失效死循环 | ① `--planning` 跑完整 validate；② 方向与页面批准共用 specDigest | ① 见左，必然阻断；② reconcile 修改 spec 后方向批准自我失效，流程无法收敛 |
| D-A34-30 | **新增阶段的连带面（实测清单，不得漏改）**：<br>· `currentPhase` 共 **5 个消费方**——`lib/model/lifecycle.mjs`、`lib/commands/init.mjs`、**`lib/commands/doctor.mjs`（状态一致性体检）**、`templates/.../commands/go.md`、**`templates/.../hooks/guard-shared.mjs`**<br>· **`guard-shared.mjs` 的契约保护相位显式裁定**：该 hook 现只在 **DEVELOPING** 追加保护 `docs/contracts/**`；**DESIGNING 必须维持「不保护」**，否则 D-A34-19 的契约回写被 hook 直接锁死。此为**明示决定**，防实现时「顺手把 DESIGNING 也加进保护集」<br>· **golden 夹具基线**：`tests/fixtures/golden/docs/lifecycle.json` 会因新增阶段与 checklist 键而改变，须同步更新<br>· **V-DSN-02 为空号**（已退役），新规则用 09/10/11/12，非编号错误 | 阶段是横切概念，漏改一个消费方就产生「状态机分叉」：doctor 报状态不一致、hook 按旧相位判定。`guard-shared` 那条尤其隐蔽——**它的默认行为恰好正确，正因如此才容易被「好心」改错** | 只在 lifecycle 与 go.md 改阶段 | doctor 会把 DESIGNING 判为未知阶段；hook 相位判定错则回写环或被锁死、或在 DEVELOPING 期漏保护契约 |

### M5 三类验收

| 编号 | 决策 | 理由 | 已否决方案 | 否决理由 |
|---|---|---|---|---|
| D-A34-20 | **Verifier 拆三角色**：`Semantic Verifier`（现状不变）＋`Design Reviewer`（对照设计目录：主角一致性 / 动作主次 / 信息层级 / 空态 / **表达降级检测** / 模板化痕迹 / `mustPreserve` 中 `kind: visual` 条目）＋`Experience Verifier`（D2 跑 primaryTask 链路 + `mustPreserve` 中 `kind: interaction\|runtime` 条目） | 治 G5。三种检查的判据来源与失败含义不同，混在一个 agent 里会互相稀释 | 单 verifier 增视觉检查项 | 见左 |
| D-A34-21 | **验收证据契约**（治「只有措辞没有执行者」）：报告落 **`.vima/reports/design/<PAGE>.json`** 与 **`.vima/reports/experience/<PAGE>.json`**，字段 `{pageId, specDigest, designDigest, implementationDigest, mustPreserveResults[], primaryTaskResult, evidence[], verdict}`；`mustPreserveResults[]` **按 `mustPreserve.id` 逐条对账**；**命令按阶段拆开**（同一命令跨两阶段用两套未声明的通过条件 = 又一次死锁）：<br>· `vima design check` —— **DESIGNING 出口**：只检设计声明、manifest 完备、Stage A 与 interaction-language 冻结、设计批准新鲜度（**此时页面尚未实现，不要求任何实现期报告**）<br>· `vima design verify` —— **DEVELOPING 收口**：汇总 design/experience 报告、计算 `implementationDigest`、算 `uncovered` 与 `stale`；`/go` **只消费其汇总结果**。<br>（`vima converge` 维持 A20 原范围——漏实现/重复实现/越界实现三类，不扩到视觉验收）<br>**三个 digest 的计算范围写进契约**（不定范围 = 两种都错）：<br>· `specDigest` = 规范化后的**本页 `vima:page` 数据块 + 本页 `apis` 引用到的契约切片**<br>· `designDigest` = 本页 `manifest.json` 及其声明的全部文件内容 **+ 本页所属端的 Stage A 核心资产 + `interaction-language.md`（D1/D2）**<br>· `implementationDigest` = 本页任务 `@vima <taskId>` 标注的文件（A1 已有归属）**+ 本页静态依赖可达的 `src/features/**` 组件与 `src/styles/**` 资产**。**依赖集由确定性解析得出，不交给 Agent 判断**：从页面入口做静态 import 可达图（按本 app 的 vite alias 与相对路径解析，只收敛到上述两类落点）；结果写入派生报告 **`.vima/reports/implementation-deps/<PAGE>.json`**，**不得回写设计 `manifest.json`**，否则实现行为会修改设计真源并使页面批准自我失效。非字面量动态 import 无法解析时，保守纳入该 app 的全部 `src/features/**` 并在报告标 `fallback: true`<br>**`evidence[]` 为结构化对象**：`{kind, path, viewport, scenarioId, mustPreserveId}`。<br>**报告矩阵**：D0 = Semantic；D1 = Semantic + Design；D2 = Semantic + Design + Experience | **不定报告契约就是在验收层重演 G1**——流程资产承诺验收、内核无消费方。落点贴合既有惯例：`.vima/reports/` 下已有 `batch-plan/certify/convergence/planning-validation/retro/trace.json`，Sustain 更已有逐任务 `*-verifier.json`。<br>**digest 范围必须固定**：hash 整库 → 无关页面改动令全部报告 stale（噪声淹没信号）；只 hash 页面目录 → **共享领域组件与 Stage A 样式变化不会使相关页面失效**（正是 A34 要防的漂移）。实现依赖若写回设计 manifest，则又会用实现期派生产物污染设计真源 | ① v2「只在 go.md 写『派 Reviewer、未过则阻断』」；② v3 有字段无范围；③ import 图写回设计 manifest | ① 正是 A29 的失败模式；② 实现者必在两种错误范围里二选一；③ 页面批准在首次实现时必然 stale |
| D-A34-22 | **`vima context` 增第三条检索线**：注入本页设计目录 + shell 基线 + `design-language` + **`interaction-language`（D1/D2）** + `primaryTask` + `mustPreserve` + **相邻页面截图** + 正常/空态 mock 档位 | 「相邻页面截图」治跨页同质化与漂移——当前每个 Builder 只见自己那一页。`interaction-language` 若不进入 Builder 上下文，就算被批准和冻结也无法约束实现。A22 已有 context 两条检索线，本条是第三条 | 只注入本页稿 | 跨页节奏无从感知，各页仍在各自格子里装修；交互语言退化为无人读取的附加文档 |
| D-A34-23 | **`/go` 收口硬门**（挂 **A20 已有收口闸门**，5.2.6 之后）：运行并消费 **`vima design verify`** 的汇总结果，D1/D2 截图对照 + D2 primaryTask 场景全过才进收尾流水线。触发条件从「有登记稿的页面」改为「**全部 D1/D2 页**」 | 治 G4：条件性空转的根源是触发条件挂在可绕过的「有没有登记」上，改挂在已被 V-DSN-12 强制的 `fidelity` 上。**兑现 A7「运行时证据：从『长得对』到『跑得通』」**——把 A7 从接口层扩到交互层 | ① 维持现状；② 新增 `CALIBRATING` 阶段 | ① 零登记 → 整轮 no-op；② **撞 A20**（收敛期已定义于 DEVELOPING→MAINTAINING），且波及 A19/A31/A32 |
| D-A34-31 | **`vima certify`（A32）的 `implemented` 级证据扩面**：从「任务全 done + Semantic Verifier 通过报告」扩为「**+ `design-verify.json` 新鲜且按报告矩阵无 uncovered/stale**」（D0=Semantic / D1=+Design / D2=+Experience）。`certify` 复用 `vima design verify` 的汇总/新鲜度助手，**不自行重写第二套聚合逻辑**。不新增等级，`spec-approved → implemented → converged → pipeline-green` 四级模型不动 | A34 的立项前提就是 **A5 诚实分级**。certify 现只采集 `convergence.json`，落地后仍可能把「视觉与体验一次没跑」的项目评为 `pipeline-green`——**这正是 A34 要治的「全绿但不能用」假成功，只是换到了认证报告里**。扩面即可闭合，无需新等级；复用汇总助手保证 `/go` 与 certify 不会对同一批报告给出不同判决 | ① 不接线，视觉验收只由 `/go` 硬门把关；② 在 converged 与 pipeline-green 之间新增 `design-verified` 级；③ certify 自行扫描原始报告 | ① certify 报告与实际交付质量之间留一个已知缺口；② 改动 A32 的等级模型且「视觉」本就是 implemented 的一部分；③ 两套聚合逻辑会漂移 |

### M6 项目化沉淀

| 编号 | 决策 | 理由 | 已否决方案 | 否决理由 |
|---|---|---|---|---|
| D-A34-24 | Stage A 增**交互产出** `docs/interaction-language.md`（条目化交互决策，每条带可判定判据）。条目**不得凭空写**，两个合法来源：① 由获胜实例反推；② **A21 `vima retro` 复盘反哺**。可判定部分下沉为 Design/Experience Reviewer 检查项。**必须接进闭环的五处**（否则版面语言受完整保护、交互语言仍只是附加文档）：① `designSystemFrozen` 的摘要输入；② 页面 `designApproval`/`designDigest` 的失效输入；③ `vima context` 注入内容；④ Design/Experience Reviewer 的检查输入；⑤ Experience 报告的 stale 判定。D0-only 不凭空生成交互条目，含 D1/D2 时必需 | 兑现 A27 延后项 P28「模式库资产化」的**交互半边**（A30 只兑现了版面半边）。旧 Sustain 真正出彩的是交互判断（「换患者不整页遮罩」「变长区块给定高度防跳动」），一条都不在现有 Stage A 产物里 | ① 预置「最佳实践」条目；② 塞进 `design-language.md` | ① 无实证来源，反查不到需求，必沦为没人读的清单；② 两种关注点混一个文件，Stage A 冻结口径会打架 |
| D-A34-25 | **Sustain 四页黄金样本**：PAGE-01 工作台(D1) / PAGE-03 患者档案(D2) / PAGE-20 随访模板设计器(D2) / PAGE-23 咨询处理(D2)。基线固定为旧版提交 **`d6f4382^`** 的对应页面与原 Claude Design 冻结物；测试夹具记录基线 commit、页面路由、viewport、mock 档位和场景 ID，避免“达稿”随评审会话漂移。判定：spec·契约·权限全绿 **且** 四页未被翻译成标准 CRUD **且** 达稿 **且** primaryTask 可完成。**作为 A34 对外宣称可用之前的最后一道发布硬门**（§9 依赖序第 6 位） | 本方案基于事后取证、无正向试点（与 A29 的 carelink-admin 实证不同）。黄金样本若只写页号、不冻结来源与运行条件，下一轮无法复现实验；**把样本推到最后再补＝在未验证时就宣称能力**，违反 A5 | ① 不做试点直接宣称；② 样本放到最后补；③ 只写页号不记基线来源 | ① 违反 A5；② 会出现「已宣称未验证」的窗口；③ 每轮人工选择不同基线，硬门不可复现 |
| D-A34-26 | `docs/review/design/INDEX.json` 由 `vima design status` 确定性重生成，纳入 `--check` 漂移体检（同 render-* 口径） | 只读派生物必须可验漂移，否则它会被手改成第二真源 | 允许手工维护 INDEX | 手改即双真源，退回 D-A34-10 要治的问题 |
| D-A34-27 | `design-links.md` 废止（其三处引用改指 `docs/review/design/`）；`planning-guide.md` **删除「只做 Stage A、不做 Stage B：合法」的无条件祝福**，改为「**D0 页合法降级；D1/D2 页不得降级**，除非用户显式豁免并记入完成报告」 | 治 G1+G2 的直接落点 | 保留 `design-links.md` 作兼容 | 幽灵文件继续存在就是继续「宣称与实现两张皮」 |

---

## 5. 规格与落点表

| 类型 | 路径 / 内容 |
|---|---|
| **契约**（先改，落地前置） | `docs/internal-contracts.md` §7 PDL 增 `design.fidelity` / `primaryTask` / `mustPreserve`（typed，**无 `designRef`——路径由 pageId 推导**），`pattern` 枚举增 `custom`；校验规则增 **V-DSN-09/10/11/12**（**逐条标注触发阶段**：09 → DESIGNING 出口，10/11/12 → PLANNING）；§14 生命周期增 **DESIGNING** 阶段、**checklist 存储/派生边界**（**2 键写入 + 6 键派生**）、`designApproval.directions.<appId>` / `.pages.<pageId>` 摘要结构与各自 digest 输入、`designCapability` 标记、**阶段推进事件表**（D-A34-28）；§8/§11 增 `planning-brief` 校验 profile 与设计批准失效口径；**新增报告契约节**：`.vima/reports/{design,experience}/<PAGE>.json`、`.vima/reports/implementation-deps/<PAGE>.json` 字段表、**三个 digest 的计算范围**、`evidence[]` 结构、**报告矩阵**（D0/D1/D2）与 stale 判定；§12 A34 条目 |
| **内核** `lib/`（**只做确定性文件操作，零网络零浏览器**） | `lib/model/apps.mjs` PDL 三键 + `pattern: custom`；`lib/commands/validate.mjs` 四条新规则（**按阶段分派触发**）+ `planning-brief` profile；`lib/model/lifecycle.mjs` DESIGNING 阶段 + checklist 存储边界 + `designApproval` + `designCapability` + 存量迁移；`lib/commands/init.mjs` 落点增 `docs/review/design/`；**`lib/commands/doctor.mjs` 阶段一致性体检认 DESIGNING**；新增 `lib/commands/design.mjs`（`status`/`check`/**`verify`**/`approve`/`invalidate`/**`reconcile`**——`reconcile` import `change.mjs` 已导出的 `computeImpact`，用 DESIGNING 口径闸门；含 INDEX 生成、批准摘要、三 digest、静态 import 可达图与报告汇总）；`render-review.mjs` 新鲜度助手扩设计摘要；`lib/commands/approve.mjs` 增 `--planning` 与 design check 前置；**`lib/commands/certify.mjs` 的 `implemented` 级复用 design verify 汇总助手（D-A34-31）** |
| **工作流资产**（**MCP 与浏览器只在此层**） | 新增 `agents/vima-designer.md`（调 Claude Design MCP 出三方向与逐页稿、render_preview 截图、冻结落盘、产出差异矩阵）+ `commands/design.md`；`agents/vima-builder.md` 三层授权（D-A34-07）+ features 只读消费与提取请求；**拆分** `agents/vima-verifier.md` → `vima-verifier.md`(Semantic) + `vima-design-reviewer.md` + `vima-experience-verifier.md`（三者均按 D-A34-21 写报告）；`commands/go.md` 收口硬门；`commands/retro.md` 增交互条目反哺询问 |
| **规划资产** | 新增 `planning/interaction-language.md`；`planning-guide.md` 新增 DESIGNING 章（Brief → A0 发散 → 方向批准 → 受控回写 → 反向提炼 → Stage B → 冻结），**删除无条件降级祝福**；`_template-fe.md` 设计稿节增 fidelity / primaryTask / mustPreserve 三行（**不含 designRef**），**删「无稿页写『无稿』」**；**废止 `design-links.md` 全部引用** |
| **骨架 / 配置** | `scaffold/frontend/src/features/.gitkeep`；`template.json` 登记 features 层——**且确认其不在 `apps[].sharedDirs` 内**（`guard-shared.mjs` 的保护面源）；`templates/admin/workspace/hooks/guard-shared.mjs` **契约保护相位维持只认 DEVELOPING**（D-A34-30） |
| **测试** | V-DSN-09/10/11/12 用例，**每条必须含否定用例**（**推导出的设计目录**不存在必报错、custom 缺 intent 必报错、mustPreserve 缺 `kind` 必报错、**新项目缺 fidelity 必报错**——否则规则永远绿）；V-DSN-09 **不在 PLANNING 触发**的阶段用例；lifecycle DESIGNING + D0-only 跳过 + 存量迁移用例；`designApproval` 摘要失效用例；报告 stale 判定用例；`d2.workspace.test.mjs` 防漂移断言（三 verifier 资产存在、planning-guide 不含旧措辞、`lib/` 不出现 MCP 工具名与浏览器依赖、**`guard-shared.mjs` 契约保护相位仍只认 DEVELOPING**）；**`tests/fixtures/golden/docs/lifecycle.json` 基线随新增阶段与 checklist 键同步更新** |
| **文档** | `CLAUDE.md` A34 条目；`CHANGELOG.md`；`docs/design/v2.1-amendments.md` A34 正文 |

---

## 6. 验收判据（可跑命令 / 可检条件）

> **v2 勘误**：v2 此节写了 `vima status --json` 与 `vima validate --json` 两条命令，
> 实测**均不存在**（`vima help` 无顶层 `status`；`validate` 不带 `--json`，
> 它写 `.vima/reports/planning-validation.json`）。已按实测改写；
> 新增命令一律来自 §5 落点表，不凭空杜撰。

```bash
npm test                                   # 全量含新增规则用例（含否定用例）与防漂移断言

# G1/G2 已治：幽灵文件废止，降级不再无条件合法
grep -rn "design-links" lib/ templates/ | wc -l                     # 应为 0
grep -n "只做 Stage A" templates/admin/planning/planning-guide.md   # 应带 D0 限定或已删
grep -n "无稿" templates/admin/planning/_template-fe.md             # 应为 0 命中

# G3 已治：Builder 有构图权
grep -n "自由层\|page-local\|降级为表格" templates/admin/workspace/agents/vima-builder.md   # 应 >0
grep -n "不在页面里自写" templates/admin/planning/_template-fe.md                            # 应为 0 命中

# G5 已治：三类 verifier 资产存在
ls templates/admin/workspace/agents/vima-{verifier,design-reviewer,experience-verifier}.md

# 硬约束回归：内核仍平台中立、零运行时依赖
grep -rniE "playwright|puppeteer|claude_design|render_preview|create_project" lib/ | wc -l   # 应为 0
node -p "Object.keys(require('./package.json').dependencies||{}).length"                     # 应为 0

# 新规则真的会红（否定用例，防「永远绿」）——validate 写报告文件，不是 --json
node bin/vima.mjs validate ; jq -r '[.findings[].rule] | unique' .vima/reports/planning-validation.json
#   应含 V-DSN-10/11/12；**不应含 V-DSN-09**——它只在 DESIGNING 出口由 design check 触发

# 阶段与批准新鲜度（lifecycle 状态读文件，无顶层 status 命令）
jq '.checklists.DESIGNING | keys' docs/lifecycle.json     # 应只有 2 个持久键：briefReady/directionsExplored
jq '.designApproval.directions, .designApproval.pages' docs/lifecycle.json   # 唯一持久化批准状态，按端/按页

# DESIGNING 出口（此时页面尚未实现，不涉任何实现期报告）
node bin/vima.mjs design check      # 触发 V-DSN-09
jq '.derived' .vima/reports/design-check.json
#   应含 directionApproved / signaturePagesApproved / fidelityClassified
#        / designArtifactsComplete / designApprovalFresh / designSystemFrozen —— 共 6 个派生键

# DEVELOPING 收口（汇总实现期报告）
node bin/vima.mjs design verify
jq '.stale, .uncovered' .vima/reports/design-verify.json

# 只读派生索引
node bin/vima.mjs design status            # 重生成 INDEX.json
node bin/vima.mjs design status --check    # 漂移体检，同 render-* 口径

# certify 的 implemented 级已消费视觉证据（D-A34-31）
node bin/vima.mjs certify --json | jq '.levels[] | select(.id=="implemented") | .evidence'
#   应含 design/experience 报告矩阵项；D1/D2 缺报告时该级不得判过
```

**试点判据**：Sustain 四页黄金样本（D-A34-25）通过前，**只能宣称「具备承载与保护创新设计的机制」，
不得宣称「vima 已具备稳定产生优秀设计的能力」**（A5 诚实分级口径）。

---

## 7. 明确不做（防过度设计）

| 不做项 | 理由 |
|---|---|
| `interactionModel` 枚举键 | **三次否决**：无执行者（违反 A6）；`mustPreserve`(typed) 已覆盖且可判定；A27 `data.shape + intent` 二重覆盖 |
| `persistentRegions` 键 | A14 的 `regions`（带 `role: primary` + 列密度）已能表达持久分栏，Sustain 实际用了 10 处 |
| 新增 `CALIBRATING` 生命周期阶段 | **撞 A20**（收敛期已定义于 DEVELOPING→MAINTAINING），且波及 A19/A31/A32。校准挂进 A20 已有闸门 |
| `vima calibrate` 独立命令 | 校准是 `/go` 收口的一步；独立命令会产生「有命令但没人跑」的第二个 `design-links.md` |
| 继续扩 `layoutVocab` 或 `pattern` 枚举 | 走 `pattern: custom` + 由 pageId 推导的设计目录 |
| 组件库拆三层 / headless / unstyled | **本批不立项，降为观察项**。与 codex 自身结论矛盾（其报告 §3.4「PAGE-03 反证 vima-ui 足以承载复杂页面」、§10.2「只重做组件库皮肤无效」）；跨仓库重构且**零实证支持** |
| 引入任务 `domain` 字段 + 计划器互斥 | 先走「领域级 shared task」无新键路线；**实测不足再立项**（D-A34-09） |
| 对构图/审美做机检打分 | 保留 D-A30-05 口径：主观取向机检不出来，加了就是**假机检**。V-DSN-09/10/11/12 只检**存在性、类型完整性、声明完备性与引用闭环** |
| 给 D0 页面配设计稿或视觉验收 | 纯成本；D0 由 Stage A 模式库覆盖已足 |
| 全站像素级 diff 硬失败 | 抖动噪声高；结构性判定 + `mustPreserve` 逐条 + 人审已足 |
| 由 Agent 选定发散胜者 | 「科技现代感」是口味裁定，必须用户执行（D-A34-14） |
| 重写 A27 PDL 或推翻 A29/A30 | 三者方向正确；A30 推导规则只是重定位（D-A34-16）而非废弃 |

---

## 8. 风险与代价（据实标注）

| 风险 | 说明 | 缓解 |
|---|---|---|
| **回写环使 PLANNING 产物可变** | D-A34-19 允许设计回写 spec/契约，动摇「PLANNING 定稿」的既有心智 | 走 `vima design reconcile`——**复用** A31 已导出的 `computeImpact`（不新造算法），但用 DESIGNING 口径闸门（不要求任务 done）；`tasksApproved` 在设计冻结后重生成 |
| **DESIGNING 阶段是破坏性变更** | 影响 `lifecycle.json` 结构、A19 存量升级、A31 `change`、A32 `certify` | D-A34-18 明确迁移语义：不倒退、legacy 标注、按 change scope 局部启用 |
| **M2 授权放宽可能反噬** | 「自由层」若被误读为「表现层可以顺手加个按钮」，会重新引入越界 | 三层措辞须给出**正反例清单**；`V-INT-03` 越界实现规则不变，仍对业务面生效 |
| **V-DSN-12 会让存量项目变红** | 强制声明 fidelity 对 pre-A34 项目是破坏性的 | `designCapability: legacy` 豁免；`vima update` 体检项提示而非阻断 |
| **MCP 可用性是外部依赖** | DESIGNING 依赖 Claude Design 服务与会话授权 | 不可用时**停在 DESIGNING 并如实报告**，不静默回退（D-A34-17）；D0-only 项目确定性跳过 |
| **冻结物会让仓库变大** | D1 每页 2 张 PNG、D2 额外 HTML | 只冻 Stage B、只冻 D1/D2；D0 零成本 |
| **本方案自身未经实证** | 基于 Sustain 事后取证，无正向试点 | D-A34-25 四页黄金样本作**发布硬门**；通过前按 §6 口径限制宣称 |

---

## 9. 实施依赖序（**不分期，一次完整落地**）

> **用户裁定：不分期。**本方案作为一个整体实施，不存在「某期可先发布」的中间态。
> 下表只回答**什么必须先于什么**（技术依赖），不是发布批次。
>
> 撤销分期同时消除了一类结构性风险：分期口径天然会制造「规则已落地、其唯一执行者还没落地」
> 的窗口——v4 曾把 V-DSN-09 排在其执行者之前，正是这类缺陷，而它恰是 A34 要治的病本身（A6）。

| 序 | 必须先完成 | 因为 |
|---|---|---|
| 1 | `docs/internal-contracts.md`（PDL 三键 + `pattern: custom` + V-DSN-09/10/11/12 及其触发阶段 + DESIGNING 阶段与 checklist 存储边界 + `designApproval` 按端结构 + 报告契约与三 digest 范围 + 阶段推进事件表） | 本仓纪律：**改文件格式/模块接口前先改契约**，它是并行开发的对齐真源 |
| 2 | `lib/` 确定性内核（apps / validate / lifecycle / init / approve / design / doctor / certify **八处**） | 规则与其**唯一执行者必须同时存在**——否则就是又一条无执行者的规范（A6） |
| 3 | 工作流资产（builder 三层授权、三类 verifier、designer agent、go.md 阶段分派与收口硬门） | 依赖 ① 的声明位与 ② 的命令 |
| 4 | 规划资产与骨架（planning-guide DESIGNING 章、`_template-fe.md`、`interaction-language.md`、`features/` 落点） | 依赖 ① ③ 的口径定稿 |
| 5 | 测试（四条规则的正反用例、阶段触发用例、checklist 存储边界用例、报告 stale 用例、防漂移断言） | 覆盖 ①–④ 的全部改动面 |
| 6 | **Sustain 四页黄金样本（D-A34-25）** | **对外宣称 A34 可用之前的最后一道硬门**——本方案基于事后取证、无正向试点，未过样本即宣称能力违反 A5 |

## 10. DESIGNING 前后的校验分工（治阶段死锁）

```text
PLANNING ── vima validate ─────────────────────────────────┐
  功能规格 / 契约 / 权限 / 规则                             │ 触发：V-DSN-01…08、V-DSN-10/11/12
  + fidelity（必须显式声明，V-DSN-12）                      │ 【不触发 V-DSN-09，不检查设计文件】
  + primaryTask / mustPreserve                              │
        │ vima approve --planning                           ┘
        ↓
DESIGNING
  ① Stage A0 三方向发散（按端各一张标志性页面 + 差异矩阵）
        │ vima design approve direction        ← 人工裁定，Agent 不得自选
        ↓
  ② 若方向改动了页面能力 / 交互模型 / 信息架构
        │ vima design reconcile                ← 复用 computeImpact，DESIGNING 口径闸门
        │   （只检 spec/契约闭环，不要求任务 done、不跑 converge）→ 重建任务拆解
        ↓
  ③ 从获胜实例反向提炼 Stage A → Stage B 逐页稿 → 冻结进仓库（自包含）
        │ vima design approve pages            ← 人工裁定
        ↓
  ④ vima design check ────────────────────────────────────┐
       directionApproved / signaturePagesApproved ← 摘要   │ 【V-DSN-09 在此触发】
       fidelityClassified        ← V-DSN-12               │  6 项派生全绿才可离开
       designArtifactsComplete   ← V-DSN-09               │ 【此时页面尚未实现，
       designApprovalFresh       ← digest                 │   不涉任何实现期报告】
       designSystemFrozen        ← Stage A + 交互语言      │
        │ 完整 validate（含 V-TASK/V-COV）→ vima approve  ┘
        ↓
DEVELOPING → A20 收口闸门
              ├ /go 5.2.6 设计稿校准轮
              └ vima design verify ← 汇总 design/experience 报告、
                                      算 implementationDigest / uncovered / stale
                                      （D-A34-23 硬门只消费其结果）
        ↓
MAINTAINING
```

**三个关键点**：
1. `vima validate` 在 PLANNING 只管**声明完备性**（fidelity 必须表态），**不管文件是否已产出**；
   文件存在性归 `vima design check` 在 DESIGNING 出口管——两级分工同时解开死锁与「声明可缺失」。
2. **任务拆解与 `tasksApproved` 在设计冻结之后**；`design reconcile` 使旧拆解与旧批准一并失效。
3. `/go` 步骤 1 按 `currentPhase` 分派三条路径（D-A34-28），
   **不再假定 PLANNING 的下一站是 DEVELOPING**。
4. **`design check` 与 `design verify` 是两个命令，不是一个命令的两次调用**：
   前者在 DESIGNING 出口只看设计面（页面尚未实现），后者在 DEVELOPING 收口才看实现面。
   合并会让同一命令在两个阶段用两套未声明的通过条件——那正是 V-DSN-09 那次死锁的同型。
5. `vima approve --planning` 用**独立校验 profile**（不含 V-TASK/V-COV），
   完整 validate 推迟到设计冻结、reconcile、任务重建之后（D-A34-29）。

---

## 11. 改判记录（防重犯留痕 · **不构成执行依据**）

| 版本 | 原表述 / 外部建议 | 处置 | 理由 |
|---|---|---|---|
| v1 | approve 拆双布尔 | 被 D-A34-13 取代 | 双键只是状态位，无阶段则无强制点 |
| v1 | 单 verifier 增视觉 6 项 | 被 D-A34-20 取代 | 三种检查判据来源与失败含义不同 |
| v1 | `lib/commands/design.mjs` 编排 MCP + 无头浏览器 | 被 D-A34-17 取代 | **违反两条硬约束**；实测 `lib/` 全仓零浏览器依赖，此举将是首例破口 |
| v1 | `mustPreserve` 为字符串数组 | 被 D-A34-05 取代 | 「配置与预览同步」「不重挂载」无法靠截图裁定；无类型即无执行者 |
| v1 | 「G1+G2 是充要条件」 | **删除** | G3 独立成立，故非充分；表述本身是过度主张 |
| v1 | 五期路线、M2 排三/五期 | 被 §9 四期取代 | 无构图权则无法实现设计稿 |
| **v2** | **`fidelity` 为「可选键、未声明零影响」** | **被 D-A34-01 + V-DSN-12 取代** | **重建了 G2 的零成本逃生口**：不写 fidelity → 不是 D1/D2 → 跳过全部设计流程 |
| **v2** | **V-DSN-09 全期生效 + designRef 为单文件** | **被 D-A34-02 + §10 取代** | **PLANNING/DESIGNING 阶段死锁**；且与 D-A34-11 的目录形态自相矛盾 |
| **v2** | **INDEX.json 存 fidelity/designRef/approved/digest** | **被 D-A34-10 真源权威表取代** | **四处并存写入口 = 本方案内部重现它指控 A29 的 A2 双真源问题** |
| **v2** | **三类 Verifier 只写职责，不定报告契约** | **被 D-A34-21 取代** | **在验收层重演 G1**：流程资产承诺验收、内核无消费方 |
| **v2** | 「只许升不许降」 | 被 D-A34-03 取代 | 与「自动建议」冲突；机器建议错时人在首次裁定被锁死 |
| **v2** | 自由层含「领域组件提取」 | 被 D-A34-07 取代 | 与 D-A34-09「只读消费」直接冲突，改为「提出提取请求」 |
| **v2** | 黄金样本排四期 | 被 D-A34-25 取代 | 等于未验证先宣称，违反 A5 |
| **v2** | §6 写了 `vima status --json` / `validate --json` | **勘误** | **两条命令实测均不存在**——`vima help` 无顶层 `status`；`validate` 写报告文件而非 `--json` |
| **v3** | **回写环「走 A31 `vima change` 事务」** | **被 D-A34-19 取代** | **实测死锁**：`change.mjs` 的 `cmdClose` 要求「受影响任务全部 done」+ validate 零 error，而 DESIGNING 期任务尚未拆解。改为 `vima design reconcile`——复用已导出的 `computeImpact`，闸门分离 |
| **v3** | **`designCoverageComplete` 单键** | **被 D-A34-13 取代** | 一个键混了「都分级了」（PLANNING/V-DSN-12）与「文件都齐了」（DESIGNING/V-DSN-09）**两种不同事实、跨两个阶段**，无法定位失败点。拆为 `fidelityClassified` / `designArtifactsComplete` / `designApprovalFresh` |
| **v3** | **三个 digest 有字段无计算范围** | **被 D-A34-21 取代** | 不定范围则实现者必在两种错误间二选一：hash 整库 → 全部 stale；只 hash 页面目录 → **共享领域组件与 Stage A 变化不使页面失效**（正是 A34 要防的漂移） |
| **v3** | `designRef` 字段保留 | **被 D-A34-02 取代（删字段）** | 路径已固定为 `docs/review/design/<PAGE-id>/`，字段即可推导冗余；它在 v3 真源权威表里无处安放正是信号 |
| **v3** | DESIGNING checklist 六键未分存储/派生 | **被 D-A34-10 + D-A34-13 取代** | 「可推导」与「已存储」混在一张 checklist，实现者必然六键一律落盘，退回双真源 |
| **v3** | 阶段推进主体未定义 | **被 D-A34-28 取代** | 实测 `go.md` 仍是 PLANNING 直进 DEVELOPING，不认 DESIGNING；不写事件表则三个命令谁推进阶段含糊 |
| **v3** | 一期含 V-DSN-09 与批准摘要 | **移入二期**（§9） | 两者的执行命令 `vima design check` 在二期才实现——**规则先于其唯一执行者落地 = 又一条无执行者的规范**（违反 A6） |
| **v3** | 全项目一张标志性页面 | 被 D-A34-14 取代 | 多端项目壳层与交互模型本就不同（A16/A23/A25 三套 UI 框架），非首端 Stage A 无产出来源 |
| **v3** | D0-only 跳过 DESIGNING 后 Stage A 无来源 | 被 D-A34-13 取代 | 明确继续由 **A30 确定性推导**产出 Stage A 三产物——D0-only 不是「没有设计语言」，只是不走发散 |
| **v3** | D2 `prototype.html` 未要求自包含 | 被 D-A34-11 取代 | 外链资源数月后失效，校准轮拿不到基线；本仓 `prototype.template.html` 的「单文件零外部请求」已是先例 |
| **v4** | **`vima design check` 同时管 DESIGNING 出口与实现期报告汇总** | **被 D-A34-21 取代（拆 check/verify）** | 离开 DESIGNING 时页面尚未实现，既无 `implementationDigest` 也无截图与报告——同一命令要求报告矩阵完整则**永远进不了 DEVELOPING**。与 V-DSN-09 那次是**同型死锁**：一个命令跨两阶段用两套未声明的通过条件 |
| **v4** | **checklist 持久键自相矛盾**（D-A34-10 写 2 键，D-A34-13 写 4 键，§6 期待 4 键） | **被 D-A34-10 + D-A34-13 取代（统一为 2 键）** | `directionApproved` 若落盘，就与 `lifecycle.designApproval` 表达同一事实，**退回本方案自己要治的双真源** |
| **v4** | **`designApproval.direction` 为单数** | 被 D-A34-10 取代（`directions.<appId>`） | A0 已改为按端发散，多端各选不同方向时单键无法表达 |
| **v4** | **`approve --planning` 跑完整 validate** | **被 D-A34-29 取代（独立 profile）** | 实测 validate 含 **13 条 V-TASK + V-COV-01**，而 V-COV-01 要求 `coverage-matrix.md` 无空格无 TODO（由任务生成）——**任务未拆解时必然报错**，PLANNING→DESIGNING 走不通 |
| **v4** | reconcile 未定批准顺序 | 被 D-A34-29 取代（六步定序） | 关键是第 ⑤ 步：`specDigest` 含 spec 而 reconcile 正在改 spec，若要求方向批准回写后仍新鲜，**方向批准会被自己触发的回写作废**，自我失效死循环 |
| **v4** | `interaction-language.md` 未接闭环 | 被 D-A34-24 取代（五处接线） | 否则版面语言受完整保护，交互语言仍只是附加文档 |
| **v4** | `implementationDigest` 的「依赖组件」未定解析方式 | 被 D-A34-21 取代（静态 import 可达图） | 交给 Agent 判断即无确定性；范围收敛到 `src/features/**` 与 `src/styles/**` 两类落点 |
| **v1–v4** | **分期路线（四期/五期）** | **按用户裁定整体撤销**，§9 改为实施依赖序 | 分期口径天然制造「规则已落地、其唯一执行者未落地」的窗口——v4 曾把 V-DSN-09 排在其执行者之前，**正是 A34 要治的病本身** |
| codex | `interactionModel` 键 | **三次否决** | 无执行者；`mustPreserve`(typed) 与 `data.shape+intent` 双重覆盖 |
| codex | `CALIBRATING` 阶段 | **不采纳** | 撞 A20 收敛期；波及 A19/A31/A32 |
| codex | 组件库拆三层 / headless | **降为观察项** | 与其自身 §3.4/§10.2 结论矛盾；零实证；跨仓库工程量不在同一量级 |
| codex | `vima calibrate` 独立命令 | **降级并入 `/go`** | 独立命令会重演 `design-links.md` 的命运 |

---

## 12. 与 codex 六轮评审的关系说明

**采纳**：首轮的诊断主线、D0/D1/D2 分级、分面授权、三层共享、双层验收、四页回归样本；
二轮的 Stage A0 发散、顺序反转、`mustPreserve`、DESIGNING 阶段、三类 Verifier、
`vima design` 子命令族、context 注入；三轮的六项 P0；四轮的四项 P0 与七条细节；
**五轮的三项契约级问题与五处勘误；六轮的三项内部矛盾与两处接线**。

**未采纳**：`interactionModel`（三次否决）、`persistentRegions`（A14 已覆盖）、
`CALIBRATING` 阶段（撞 A20）、组件库三层重构（无实证且与其自身结论矛盾）、
`vima calibrate` 独立命令（并入 `/go`）。

**方法差异**：codex 按「应该有什么」自上而下开列；本方案按「**已承诺但无执行者的**是什么」
自下而上收敛，每条决策都能反查到既有原则（A2/A5/A6/A7/A12/A19/A20/A21/A27/A31/A32）
或对既有决策的范围澄清（D-A29-05 / D-A30-02 / D-A30-04 / D-A30-06）。

**本方案的边界（不可越界宣称）**：它只建立**创新发生与存活的机制**，
不能机械保证每次设计都优秀。「科技现代感」需要 Claude Design 的产出质量、
用户的口味裁定与多轮迭代共同完成；vima 的职责是**生成、解释、比较、保存与保护**，
**不替用户完成裁定**，也不会在脱离 Claude Design 后自动拥有同等审美能力。
