# mattpocock/skills 对标评估：学什么、不学什么

> 创建：2026-08-13。性质：**评估文档**（非需求真源；采纳条目须回设计文档立 §/A# 后实现）。
> 对象：github.com/mattpocock/skills（"Skills For Real Engineers"，Total TypeScript 作者
> Matt Pocock 的日常工程 skill 库）。快照：2026-08-13 clone，共 35 个 skill——
> engineering 18 + productivity 7（随插件正式分发的 25 个）+ misc 4 + in-progress 6。
> 方法：全部 35 份 SKILL.md 原文逐篇研读（非 README 转述），逐项对照 vima 设计文档
> v2.0 / 增补项 A1–A8 / `templates/admin/**` 资产现状做缺口判定；每条采纳/不吸收结论
> 附 vima 侧证据。姊妹篇：`ai-scaffold-benchmarks.md`（市场对标）——该文调研赛道格局，
> 本文深读单一同类物的**手法**。
> **落地状态（2026-08-13）**：§3 采纳清单已落地为增补项 **A9/A10/A11**
> （v2.1-amendments.md）并实现（设计文档 §21 版本历史 v2.0.6 有全清单）。
> 更新（2026-08-13）：追加 §6「原型先行」时序分析（作者访谈观点 + 用户采信），
> §4 prototype 行的结论范围随之修正为「产物层」；§6 方案经用户裁定后已落地为
> 增补项 **A12** 并实现（设计文档 §21 版本历史 v2.0.7 有全清单）。

## 0. 一页结论

该库与 vima-cli 是同一问题域的**镜像解**：它明确反对 GSD/BMAD/Spec-Kit 式「框架接管
流程」，主张小、可改、可组合的纯提示纪律；vima 则押注确定性内核（渲染字节一致、
机检规则、状态机）。因此它的**流程编排层对 vima 几乎全部不可吸收**（vima 已用更强的
机械形式承担同等职能），而它把「模糊要求变成可判定门禁」的三个**纪律内核**恰好落在
vima 的三处真实缺口上：

1. **PLANNING 怎么问没有纪律**（grilling 的 frontier 三规则）→ A9；
2. **Builder 写单测但没有断言质量约束**，同构断言会把 A7 做实的 `mvn test`
   信号退化回恒绿假门（tdd 的 tautological 反模式）→ A10；
3. **维护期修 bug 无协议**，而 A7 已铺好红绿信号源，差一条接线（diagnosing-bugs
   的「先有一条能跑红的命令」硬门）→ A11。

三项全部是文字资产级吸收：不新增命令、不新增文件、不新增报告格式；
执行者 = d2 防漂移测试断言（grep 判据）+ A6 阶梯既有的 L5·verifier 位。

## 1. 对象概览

- **定位**（README 原文）：反流程接管——"Approaches like GSD, BMAD, and Spec-Kit try
  to help by owning the process. But while doing so, they take away your control."
- **核心划分**：skill 按**谁能调用**二分。人调用（`disable-model-invocation: true`）
  负责编排：grill-with-docs / triage / to-spec / to-tickets / implement / wayfinder 等；
  模型调用承载可复用纪律：grilling / tdd / diagnosing-bugs / codebase-design /
  code-review / domain-modeling 等。规则：人调用的可调模型调用的，反向禁止。
- **主流程**：grill-with-docs（对齐面试）→ to-spec → to-tickets（tracer-bullet
  垂直切片 + blocking edges）→ implement（内部驱动 tdd，收尾跑 code-review）。
- **形态**：纯 markdown 提示纪律，无任何确定性校验层——所有纪律靠模型自觉遵守。
  这是它与 vima 的根本分野，也是双方可互补的原因。

## 2. 吸收判据（三条，全过才采纳）

1. **缺口可反查**：对应 vima 的一处真实缺口，缺口有资产级证据（文件:内容），
   不是「更完备」；
2. **能落成可检条件**：确定性 CLI 行为，或至少 A3 式可 grep 文本条件 + d2 测试断言
   （吸收原则同 v2.1-amendments 头部：不落成纯靠 Agent 自觉的流程文字）；
3. **不造平行结构**：不与既有机制构成双真源（A2 教训）或第二套平行工序
   （PACT 不吸收清单的同一口径）。

## 3. 采纳清单（→ 增补项 A9/A10/A11）

| # | 对方机制内核 | vima 缺口证据 | 落点 |
|---|---|---|---|
| A9 | **grilling**：设计树 + frontier 轮次——事实归 agent 自查、决策归人；每问附推荐答案；前置未定的问题不问 | planning-guide.md §5 只有里程碑节奏（复述确认/一次一主题/pendingConfirm），**提问方式零约束**：挤牙膏一问一答、把可自查的事实抛给用户、问前提未定的问题，三种浪费都不违反现行任何一条 | planning-guide §5「提问三规则」+ vima-planner 纪律镜像 |
| A10 | **tdd 反模式**：tautological test——断言用与实现同构的计算生成期望值，按构造必过、永不失败 | `_template-be.md` L61/L70 要求 Builder 写 Service 层单测，且 A7 刚把 `mvn test` 做成真实信号；但 coding-standards 后端节对断言质量零约束——AI 生成测试恰以「复述实现作期望」为高发失败模式，一套同构断言让 A7 信号退化回恒绿假门 | coding-standards 后端节新增〔L5·verifier〕条 + `_template-be` 步骤 5 措辞 |
| A11 | **diagnosing-bugs** Phase 1 硬门：先有一条**已跑过、能对本 bug 变红**的命令，才许建立假设改代码；修复判定 = 同一命令转绿 | CLAUDE.project.md 工作协议对维护期 bug 只有「先定位任务文件再修改」；而 A7 已备齐信号源（runtime-errors.jsonl / 真实 mvn test / build:check），缺的只是接线协议 | CLAUDE.project.md 工作协议一条 |

判据 2 的执行者：三项 grep 判据全部进 `tests/unit/d2.workspace.test.mjs`
（该文件正是为「A3 判据曾漂移 2/3 失配而无报警」建的防漂移机制）；
A10 的运行时执行者按 A6 阶梯判层落 L5·verifier（同构判定需语义比对，L3 正则抓不住
一般情形，L1/L2/L4 不适用）。

## 4. 不吸收清单（含理由，防后人当新点子重提）

口径同 PACT 不吸收清单：避免把对方的工序重量走私回 vima——它的编排层为「无确定性
内核的纯提示环境」而设，vima 已用机械形式承担同等职能，重复吸收即第二套平行工序。

| 不吸收项 | 一句话理由 |
|---|---|
| **tracer-bullet 垂直切片 + blocking edges**（to-tickets） | vima 任务模型是契约配对的前后端**并行**批（§9.5/§10.2，契约必有前后端任务成对引用），单兵竖切会把并行改回串行；其 expand–contract 宽重构序列对应的场景在 admin 维护面未出现（YAGNI） |
| **TDD 红绿循环整套工序**（tdd） | vima 验收真源是 Verifier 逐点证据 + 构建信号（§6.9），再引测试先行工序即第二套平行验收；只吸收其反模式内核（A10） |
| **CONTEXT.md 术语表 / 共享语言**（domain-modeling、grill-with-docs） | spec 八章 + `vima:*` 数据块已是落盘共享语言（实体/字段/页面/接口标识全部机读锚定，并经 `vima context` 分发给每个 Builder），另设术语表 = 双真源——正是 A2 裁定禁止的结构 |
| **ADR 决策记录**（domain-modeling） | A4 已吸收等效物：spec 第八章决策表含「已否决方案」列，V-DEC-01 机检 |
| **深模块词汇 + deletion test**（codebase-design） | admin 业务代码的架构形状由骨架 + spec 数据块 + recipe 决定，业务任务没有模块设计自由度；YAGNI 判据已由全局防过度设计红线承担 |
| **双轴 code-review 并行子代理评审**（code-review） | vima 已用更强形式分离两轴：Standards 轴 = hook/validate 确定性机检（A6 阶梯），Spec 轴 = Verifier 逐点判定——把确定性机检退回概率性双评审是倒退 |
| **phase-boundaries 五选一决策树** | vima 主循环已把该决策具体化：会话预算（3 批/8 任务）、断点续跑、检查点表（§6.5）、子代理隔离（§10.4）；通用决策树对固定流程无增量 |
| **wayfinder 决策票地图（fog of war）** | 多会话规划由检查点表 + pendingConfirm 承担；admin 问题域是有界业务系统，fog-of-war 台账是为无界工程准备的仪式 |
| **triage 状态机** | vima 无 issue tracker 集成（刻意：零依赖 + 本地文件真源），外来工单分诊不在问题域 |
| **prototype**（throwaway HTML/UI 变体） | **仅产物层不吸收**：`vima render-prototype` 已是确定性上位替代（spec 数据块渲染、字节一致、`--check` 抓漂移，§13.3）；但其**时序观念**（原型先于 spec 定稿、在对齐过程中反复出现）是 vima 的真实缺口——分析见 §6，已落地为 A12 |
| **resolving-merge-conflicts** | 并行冲突由所有权模型**预防**（sharedDirs 只读 + conflictsWith 不同批 + 写令牌），流程内不产生 merge 冲突 |
| **research / handoff / teach / to-questionnaire / wait-what / wizard / ask-matt** | 会话工具面：智能路由（§12.2）、检查点续写（§6.5）、pendingConfirm 已覆盖对应需求；其余（教学/问卷/人工向导）不在脚手架问题域 |

## 5. 借鉴手法（不立项）

**writing-for-agents**（给 agent 写文档的元技能）的主张与 v2.1-amendments 头部吸收
原则同义——「规范先判确定性层，流程文字是最后选择」即 A6 阶梯的另一种表述，无需
立项。其三个编辑手法在本次 A9–A11 的资产编辑中直接使用，供后续模板资产维护参考：

- **no-op 测试**：一句指令相对模型默认行为无增量就整句删（衡量的是模型默认值，
  不是读者感受）；
- **正向表述**：禁令尽量配正向目标（「期望值取自契约示例」先于「禁止同构断言」），
  纯禁令会把被禁概念拉进上下文反而提高其可用性；
- **指针带触发条件**：常驻上下文的指针（CLAUDE.md 一行、skill description）措辞
  决定命中率——写「什么情况下去读」，不只写「它是什么」（vima 现行资产已多处如此，
  如「使用组件前，必须先读取 CAPABILITY.md」；新指针照此标准写）。

## 6. 原型先行（prototype-first）：时序分析与落地方案（→ A12，已落地）

> 追加：2026-08-13。缘起：作者在访谈中主张「先出原型再出 spec 会让需求实现更准确」，
> 用户采信并指出 vima 已有类原型的人类审核产物（`docs/review/prototype.html`），
> 要求进一步分析该观念的落地改进。本节全部现状论断经代码实证（附文件:行号）。

### 6.1 观念内核：原型不是验收工具，是催化表达的工具

该库自身的流程即为佐证（非仅访谈言论）：ask-matt 主流程里 prototype 是 grilling
期间的**支路**——「问题需要可运行的答案时，绕行原型再回来」；to-spec 模板明写
「原型产出的片段比散文更精确时，内联进 spec」。即：**原型先于 spec 定稿，
spec 吸收原型教会你的东西**。其机制有二：

1. **人类反应不对称**：对抽象问题的回答不可靠（「设备详情要展示哪些字段？」得到的
   是即兴清单），对具体物的反应可靠（看到线框立刻说「这里少了审核记录」）。
   原型把对齐从「让用户描述」翻转为「让用户反应」。
2. **纠偏成本随时序递增**：对话期改一句话 ≈ 0；spec 定稿后改动要连带契约/任务/
   覆盖矩阵；approve 后改动要走维护期同步闭环（§13.4）。原型出现得越早，
   同一处误解的修复成本越低。

推论：**终点原型只能验收，过程原型才能催化**。原型的价值密度取决于它在流程中
出现的时刻与次数，而不只是它是否存在。

### 6.2 vima 现状：产物层已强于对方，时序层落后一档

**强项（保持，不动）**——vima 的原型在产物层全面优于对方的 throwaway 代码：
确定性渲染（同一 spec 字节一致）、`--check` 逐字节抓漂移（render-prototype.mjs
L59-79）、manifest 机械对账闭环到实现（post-write 区块标记 + Verifier points）、
pendingConfirm 徽标人眼投影（prototype.template.html「待确认徽标」）、approve
阻断未确认推断项。对方的原型没有任何一项——防漂移全靠自觉。

**时序缺口（实证）**——原型出现在流程**终点**：

- planning-guide §7：渲染排在三道闸门收尾（全部产物就绪、validate 全绿之后）；
  §2 就绪判据表中审计视图/原型列最后两行。
- planning-guide §5：五个里程碑的确认全部是**文本复述**（「先向用户复述你的理解，
  获确认后再落盘」）——用户在看到第一张图之前，已用纯文本回答了几十个抽象问题
  （A9 的 frontier 轮次也全是文本问答）。
- 结果：误解在文本对齐中积累，集中到终点评审才暴露，此时每处纠偏都要回改
  spec + 可能连带契约/任务/矩阵——恰是 6.1 推论中最贵的时刻。

**技术前提（实证，增量渲染已成立，无需大改）**：

- 渲染前置只有 validatePages（V-SPEC-03/04/05，render-prototype.mjs L36-42），
  **不要求**八章齐全（V-SPEC-01）、任务/矩阵存在、契约交叉引用（V-SPEC-07）；
- contracts 目录缺失时 loadContracts 返回 `[]`（contracts.mjs），不阻塞渲染——
  「页面草成、契约未写」的中间态可渲染；
- 渲染成本 ≈ 0（纯函数，无网络无构建），重复渲染无副作用（原子写覆盖）。

**粒度约束（实证，决定节拍落点）**：

- V-SPEC-03 要求四要素非空 → 页面**骨架桩不可渲染**（防残图误导反应，应保持）；
- V-SPEC-05 要求 nav 目标 PAGE 存在 → **逐页渲染**会被模块内悬空 nav 卡住
  （列表页 nav 指向尚未写的详情页）；
- 两条约束共同把节拍推向**模块簇粒度**：一个模块的页面块全部草成后渲染——
  恰与 §5 里程碑 2「逐模块梳理」的既有结构对齐，零摩擦。

**新鲜度缺口（实证，增量节拍会放大的潜伏洞）**：

- approve 前置 2 只查 `fileExists`（approve.mjs L50-58）。现行终点式流程下
  「存在 ≈ 新鲜」；改为增量节拍后，模块 1 时渲染的原型文件始终存在——
  **用户可能对着过期原型 approve**。现行流程本身也有此潜伏洞（渲染后再改 spec、
  不重渲也能 approve），增量节拍把它从理论变成必然。
- 机械补法现成：`--check` 的内存渲染 vs 磁盘逐字节比对逻辑已存在，
  approve 复用即可，零新机制。

### 6.3 落地方案（按 §2 吸收判据筛过）

**P0-1【流程资产】逐模块「草→渲→看→定」节拍**（planning-guide §5 改造）：

里程碑 2「逐模块梳理」的页面环节改为：该模块页面块落盘 → `vima validate
--artifact` 通过 → `vima render-prototype` → **请用户在浏览器看该模块每一页并反应**
（含顺手裁定页上的 pendingConfirm 徽标）→ 修正回 YAML 块 → 重渲染，直至用户
对图确认。页面对齐的完成判据从「谈到页面级粒度」升级为「**用户在原型上看过并
确认**」。§7 终点评审保留但降级为最后一次全量过目（此前每个模块已看过）。
探索备选形态用「改 YAML → 重渲染」的时间序列迭代承担（两个候选布局 = 渲两次
给用户比），不引入 side-by-side 变体机制。

**P0-2【lib 机检】approve 前置 2 升级为新鲜度校验**：

从 `fileExists` 升级为复用渲染器 `--check` 语义（内存渲染 vs 磁盘逐字节，
含 manifest），漂移 → exit 4 并指名重渲命令。把「用户看的图 = 当前 spec」
从流程约定变成机检项——这同时修掉现行流程的潜伏洞，且与 A2 单一真源、
「确定性优先」硬约束同构。涉及 approve.mjs + 契约 approve 前置链描述 +
e2e 用例（渲染 → 改 spec → approve 应 exit 4 → 重渲 → approve 通过）。

**本方案内的不做清单（YAGNI 线）**：

| 不做项 | 理由 |
|---|---|
| side-by-side 变体渲染 | 时间序列迭代（改 YAML 重渲）已覆盖探索需求；真实需求出现再议 |
| 页面级渲染（放宽 V-SPEC-05 容忍悬空 nav） | 弱化门禁换粒度不值；模块簇粒度与 §5 结构零摩擦 |
| 渲染前置放宽到零校验 | 四要素缺失的页渲出来是残图，误导反应比不渲更糟 |
| 可运行交互原型（状态流转模拟） | 线框 + 连线已覆盖 admin 域对齐需要；业务流程有审计视图泳道 |
| CLI 新命令/新状态字段 | P0-1 纯流程资产；P0-2 改既有命令前置，均无新表面 |

### 6.4 与既有增补项的关系

- **A9 提问三规则**管「怎么问」，本项管「怎么看」——frontier 轮次里涉及页面形态的
  问题，推荐答案可直接是「已按推荐草入 PAGE-xx 并渲染，请看图裁定」；
  两者组合成「问 → 草 → 看 → 定」的小循环，文本问答收敛事实与决策，
  原型反应收敛形态。
- **A2 单一真源不被触碰**：原型始终是 spec 的纯函数——用户反应改的是 YAML 块，
  永远不是 HTML；「原型先行」在 vima 语境的正确翻译不是「先做个自由原型再补 spec」
  （那是双真源），而是「**页面块草稿与渲染即时联动，spec 页面章节被原型反应
  打磨到定稿**」——先于定稿，而非先于 spec 本身。
- **A3 冷读门 / 三道闸门结构不变**：本项只前移并加密第三道闸门素材的生成时刻，
  闸门本身（validate → 语义抽查 → approve 落痕）原样。

### 6.5 建议立项（已裁定采纳——正式规格见 v2.1-amendments.md A12，此处存草案）

- 名称：**A12 原型先行节拍：逐模块「草→渲→看→定」+ approve 新鲜度机检**；
- 规格 = 6.3 P0-1 + P0-2；验收判据草案：
  - grep planning-guide「在原型上看过并确认」等文本条件（d2 防漂移断言）；
  - e2e：渲染 → 修改 spec 页面块 → `vima approve` exit 4 且指名重渲 →
    重渲后 approve 通过；
- 落点：planning-guide.md（D1）、approve.mjs（C3）、契约 approve 前置链、
  tests（c3.approve + d2）。
