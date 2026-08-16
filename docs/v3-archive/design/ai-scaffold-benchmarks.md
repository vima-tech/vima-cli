# AI 开发脚手架市场对标：可参考项目、学什么、不学什么

> 创建：2026-08-12。性质：**调研评估文档**（非需求真源；采纳条目须回设计文档立 §/A# 后实现）。
> 方法：3 个并行研究代理当日以最新网页证据核实（154 次检索/抓取，20+ 对象）；
> 星数/版本号除注明外为 2026-08-12 直抓 GitHub/官网所得；二手转述与项目方自述均已降权标注。
> 姊妹篇：`ai-first-assessment.md`（内部评估，2026-08-12）——本文的采纳清单与其差距编号对齐。
> **落地状态（2026-08-12）**：§4 采纳清单已落地为增补项 **A8** 并实现（设计文档 v2.0.5
> 版本历史有全清单）：T1-1/2/4（AGENTS.md、图标最近邻、llms-full）+ T2-5/6/7
> （`vima context` 带字节预算机检、waived、conflictsWith）。未落地：T2-8 变更 delta
> 语义（维护期形式化，需单独设计）、T2-9 库侧 manifest 字段（走 ui-admin 仓）。

## 0. 一页结论

**市场格局**：AI 开发脚手架在 2026 年已是红海，分三条赛道——①规格驱动工具链
（GitHub Spec Kit 126k★、AWS Kiro GA、OpenSpec 64.6k★）；②Agent 工作流框架
（Superpowers 271k★、BMAD 51.8k★、task-master 28k★、CCPM 8.3k★）；③组件库 AI 友好化
（头部 20 库中 MCP 95%、agent skill 90%、llms.txt 70% 已成标配三件套）。

**vima 的位置——三个被市场验证的差异化长板**：
1. **机械验证层**：全行业验证层普遍靠「LLM 自查 + 人工点头」，真 CLI 规则校验只有
   OpenSpec（且只查 spec 不查代码）、spec→代码机械验证只有 Kiro Correctness（IDE 限定、
   可选）。vima 的 21 条 validate 规则 + hook 拦截 + V-CODE 代码↔契约对账在同类中无对等物。
2. **并行隔离的机械强制**：市场主流是「worktree 物理隔离 + 合并期解决冲突」，
   锁与所有权极少见——vima 的「文件所有权 + 共享层写令牌 + hook 拦截」是调研对象中唯一的
   机械强制方案。
3. **确定性内核**：Tessl 的 spec-as-source 因 LLM 非确定性实质翻车转向（§3.1），
   反证 vima「渲染器字节一致」的立场；BMAD v6.11 的口号「Skills stop guessing and start
   reading evidence」说明重流程派也在向证据/机械回摆。

**两个真实落后点**：
1. **上下文经济**——这是 2026 年全行业最热的工程前沿（story 胶囊、上下文防火墙、索引层、
   step-file、多档文档分级），vima 目前只有「CLAUDE.md 50 行上限 + Builder 自觉读清单」。
2. **跨工具可移植性**——AGENTS.md 已是 60k+ 仓库、27+ 工具的事实标准，vima 只发 CLAUDE.md。

**行业空白点（差异化机会）**：没有任何一家做出**可度量的上下文预算/审计**——
「每任务上下文字节数」全行业都是主张值而非机检项。

---

## 1. 市场地图（2026-08-12 快照）

| 项目 | 赛道 | 规模/状态 | 核心机制一句话 | 与 vima 的关系 |
|---|---|---|---|---|
| GitHub Spec Kit | 规格驱动 | 126.4k★，v0.16.2（08-10） | /speckit.* 命令族 + constitution + 2026 新 workflow 引擎（gate 裁决状态机） | 同题不同解：门禁靠 LLM 自觉+人工，正在补确定性基础设施 |
| AWS Kiro | 规格驱动 IDE | GA 2025-11，高频迭代 | EARS 受控需求句式 + Correctness（需求→属性测试）+ hooks + steering 条件加载 | 机械验证唯一同路者（但 IDE 限定、可选） |
| OpenSpec | 规格驱动 | 64.6k★，v1.8（08-05） | specs/ 真源 + changes/ 变更 delta（ADDED/MODIFIED/REMOVED）+ 真 CLI validate | validate 思路最接近；delta 语义值得学 |
| Tessl | spec-as-source | Framework 9 个月未 GA，已转向 skills 治理 | spec 为真源可再生代码（失败）；skills 包管理+评测门（存活） | **反面教材 + 一个正面点**（对提示词资产上评测门） |
| BMAD-METHOD | 工作流 | 51.8k★，v6.11（08-10） | story 上下文胶囊 + 分片 + gate YAML（PASS/CONCERNS/FAIL/WAIVED）+ 确定性脚本产状态账本 | 上下文经济教科书；验证正向机械回摆 |
| claude-task-master | 任务中枢 | 28k★，OSS 停滞转商业 | tasks.json 单真源 + 跨进程文件锁 + complexity report 两段展开 + MCP 工具分层 | 账本锁/工具分层可参照 |
| CCPM | 项目管理层 | 8.3k★，v2 转 Agent Skill | GitHub Issues 即数据库 + context firewall（80-90% 压缩）+ conflicts_with 字段 | conflicts_with 与「先分析后并行」值得吸收 |
| Agent OS | 标准注入 | 5.3k★，v3（2026-01）大收缩 | index.yml 标准索引 + 按需注入；v3 砍掉被模型吃掉的层 | **减法警钟**（§3.2）+ 索引手法 |
| AGENTS.md | 开放标准 | 60k+ 仓库、27+ 工具，Linux 基金会托管 | 无 schema 的 agent 指令文件；嵌套最近者胜 | 兼容成本≈0，应发 |
| Superpowers | 工作流 | 271.1k★ | 2-5 分钟粒度任务 + 每任务新鲜子代理 + 两段评审 + 强制 TDD | 粒度哲学可对照；验证仍靠技能提示词 |
| Gas Town/Beads (Yegge) | 编排/记忆 | 2026-01 开源 | JSONL issue 账本随仓库进 git；Refinery 合并队列串行化落地 | 合并队列=锁不可行时的退路 |
| shadcn registry | 组件分发 | registry 协议+MCP+目录生态 | registry-item schema（依赖三分法/docs/categories）+ MCP 7 工具闭环 | 分发协议字段设计可抄 |
| Storybook manifest | 组件描述 | SB 10.x，preview | react-docgen 自动抽 props + snippet + `tags:['!manifest']` 策展 + MCP 架在 manifest 上 | 与 ai-manifest 同思路的事实标准候选 |
| Ant Design AI 套件 | 组件文档 | llms 矩阵 + MCP 8 工具 | llms-semantic.md（DOM 结构/样式挂点）+ antd_changelog（版本漂移防幻觉） | 语义档/变更档两个维度值得补 |
| v0（Vercel） | 生成平台 | 两篇官方工程博客 | 复合管线：流式改写 + 确定性 autofixer + 专训小模型（93.87% vs 裸模型 78.43% 无错）+ 设计系统 grounding | **图标最近邻纠正**直接可搬；grounding=「源里验证不了的不许用」 |
| Meta Astryx | AI-ready 组件库 | 2026-06 开源（二手证据，置信度中） | **评测件随库分发**：vibe-tests 五维打分 + design-judge 视觉对比 + degradation 度量 | 库侧远期方向 |

学术背书：《Protocol-Driven Development》（arXiv 2605.12981，不变量+持续证据链）与
《Productivity-Reliability Paradox》（arXiv 2605.01160，「规格纪律而非模型能力是约束」）
——与 vima 机械验收路线同频。

---

## 2. 五个跨赛道收敛发现

### 2.1 验证层普遍薄弱——vima 的长板被市场空缺验证

横向事实（研究代理 A 的对比表浓缩）：

| | Spec Kit | Kiro | OpenSpec | BMAD | vima |
|---|---|---|---|---|---|
| spec 产物机械校验 | 无（analyze/checklist 是 LLM 自查） | 无（Analyze Requirements 是 LLM） | **有**（validate --strict） | 无（validate-story 是 LLM 清单） | 21 条规则 |
| spec↔代码一致性 | converge 靠 LLM 盘点 | **Correctness：EARS→属性测试+shrinking**（IDE 限定/可选/“evidence not proof”） | 无 | 无 | V-CODE 对账 + 标记对账 + 逐点台账 |
| 写入拦截 | shell 步骤（有注入险） | hooks 可阻断 pre 事件 | 无 | 无 | hook 拦截（6 项机检） |

批评文献的共识失败模式全部指向验证缺位：spec drift（无人对账）、frozen specs、
「agent 只遵循约 70% 的 spec」（Sibylline 2026-01）、markdown 有损压缩意图。
**结论：没有机械对账与受限语言的 SDD 退化为 markdown 提示词工程**——这句话可以直接
作为 vima 的差异化定位语。

### 2.2 上下文经济是最热前沿——vima 的最大落后点，但市场已给出三种可抄拓扑

- **拓扑一：上游编译、下游禁检索**（BMAD story 胶囊）——SM 在全新会话把 dev 所需一切
  编译进 story 的 Dev Notes（带 `[Source: xx.md#section]` 来源引用），dev **只准读 story
  文件 + devLoadAlwaysFiles 白名单**（coding-standards 等小文件）。量化主张 8k vs 30k tokens。
  v6 进一步 step-file 化：每步 2-3k tokens 自包含，只加载当前步（第三方实测 -74~80%）。
- **拓扑二：摘要防火墙**（CCPM context firewall）——4 个专职 agent「详读进去、摘要出来」
  （日志分析典型压缩 80-90%），I/O 契约明写「Shielded: 实现细节/代码片段/冗长日志；
  Exposed: 完成状态/关键阻塞/可行动摘要」。
- **拓扑三：索引层 + 按需取真身**（Agent OS index.yml / BMAD tea-index.csv / Nuxt UI
  文档按节寻址 sections/headings 参数 / task-master MCP 工具分层 7/15/36 / Svelte llms.txt
  三档压缩分级）——先读 KB 级索引再取所需分片。

**对 vima 的含义**：评估报告 B1 的 `vima context <taskId>` 得到市场三重验证，且形态
应吸收三个要素——①确定性打包（该页 vima:page 块 + 契约切片 + 组件 manifest 切片 +
recipe + 共享层索引）；②devLoadAlwaysFiles 式常驻白名单显式化；③**输出附字节/token
计量并支持预算上限告警**——第三点是全行业空白（各家的 80%/8k 都是主张值），
把「上下文预算」做成机检项即是差异化。

### 2.3 门禁结论正在「数据化」——从聊天记录变成可 diff 的文件

- Spec Kit 2026 workflow 引擎：gate 步骤的裁决是声明式 enum（approve/reject +
  on_reject 策略），落盘 `runs/<id>/state.json`，可 `resume --input` 续跑。
- BMAD TEA：gate 词汇表 **PASS / CONCERNS / FAIL / WAIVED**（WAIVED=确认过并附理由的豁免），
  落盘 gate YAML；风险分数阈值机械判级（≥9 FAIL、≥6 CONCERNS）。
- Google Antigravity：完工产 **Walkthrough**——含测试、截图、录屏、命令的**验证证据收工报告**。

**对 vima 的含义**：verifier 报告已是数据（§6.9），但结论词汇只有 pass|fail——
缺 **WAIVED（豁免带理由落盘）**语义；目前豁免只存在于对话里，正是 gate 数据化要堵的洞。
Antigravity 的 Walkthrough 与 vima 的逐点证据台账同向，可作运行时证据（A7）的下一步参照。

### 2.4 并行隔离——vima 的所有权+锁模型在调研对象中独一份

| 方案 | 隔离单元 | 冲突防护 | 强制力 |
|---|---|---|---|
| CCPM | worktree per epic，epic 内多 agent 同树 | analysis 划 stream + `conflicts_with` 声明 | 纯约定 |
| Superpowers / Gas Town | worktree per 任务流 / per worker + 合并队列 | 合并期解决 | 队列机械，产出靠评审 |
| task-master | tag 账本副本 + tasks.json 跨进程文件锁 | 锁只护账本不护源码 | 数据层机械 |
| **vima** | 文件所有权 + 共享层写令牌 | frontmatter 拓扑 + hook 拦截 | **机械强制（独有）** |

可吸收的增量：①CCPM 的 **`conflicts_with` 任务字段**——两个任务都合法想改同一非共享
文件时，所有权模型有盲区，声明式冲突关系可让 `vima plan` 避免同批并行；②CCPM 的
「先产 analysis 再定并行度」（并行度是分析产物而非拍脑袋）；③Gas Town 的合并队列
作为锁不可行场景（如共享层补偿批）之外的概念备胎——现阶段不需要。

### 2.5 组件库 AI 友好化军备竞赛——vima-ui 的 manifest 领先，补齐点明确

两份行业普查定位：designsystems.one（37 系统 × 5 信号，2026-06）——MCP 11/37、
llms.txt 10/37、**规范 registry 1/37**、最高分仅 3/5，「fully agent-ready doesn't exist yet」；
state-of-ai（20 头部系统，2026-07）——MCP 95%、agent skills 90%、llms.txt 70%。
**vima-ui-admin 的 ai-manifest.json（63 组件全 props/枚举/默认值 + 85 图标 + agent builders
+ recipes）在「机器可读 manifest」维度领先绝大多数公开设计系统**；短板在字段深度与配套：

值得抄的字段/机制（按证据强度）：
1. **v0 的图标最近邻纠正**：图标名不存在时向量检索最近邻替换（<100ms）——vima 的
   post-write 图标机检目前只「拦截」，升级为「拦截 + 给出 manifest 内最相似的 3 个候选」
   （85 个名字用编辑距离即可，确定性零依赖）。
2. **组合约束字段**（dlslead 实践）：`allowedChildren / forbiddenChildren /
   forbiddenParents / maxDepth`——把「VFormItem 必须在 VForm 里」这类知识从文档搬进
   manifest，未来可机检。
3. **Storybook manifest**：story `snippet`（可运行用例比 props 表更强的 few-shot）+
   `import` 片段 + **`tags:['!manifest']` 策展开关**（AI 可见性成为一等注解）——
   ui-docs 空示例问题的正解是「示例从验证过的用例语料生成」。
4. **Ant Design 双档**：llms-semantic.md（组件各部分用途/DOM 结构/样式挂点）与
   antd_changelog（跨版本 API 变化防幻觉）——vendor 分叉背景下「变更档」尤其相关。
5. **llms.txt v2**（2026-08-10 刚发布）：每页 `.md` 孪生 URL + `rel="alternate"` 发现
   机制；对 vima 主要是「多档压缩分级」思想（CAPABILITY=索引档已有，全量档=llms-full 可
   由 gen 脚本顺手产出，成本极低但优先级不高——真实消费者是编码 agent 而非搜索引擎）。
6. **Astryx 的「评测件随库分发」**（置信度中，二手证据）：vibe-tests 五维打分 +
   design-judge 视觉对比 + degradation 度量（多轮对话中是否维持设计系统模式）——
   库侧远期方向，与 vima 的 DOM 量测探针（评估 E3）可合流。

---

## 3. 三个警示故事（反面教材，各自佐证 vima 的一条既有立场）

### 3.1 Tessl：spec-as-source 撞上非确定性墙
融资 $125M、主张「spec 为真源、代码可再生弃置」的旗舰 Framework 九个月未 GA，公司
2026-01 转向 skills 治理；第三方实测「同一 spec 多次生成得到不同实现」，用户被迫反复
改 spec 逼近想要的代码。**教训：再生性必须由确定性工具保证，不能由 LLM 保证**——
vima「渲染器字节一致 + spec→骨架用确定性生成器」的路线得到实证背书。
（Tessl 留下一个正面点：对提示词资产上「版本 + 评测 + 安全分」的包管理门。）

### 3.2 Agent OS v3 的减法：模型会吃掉框架层
v3（2026-01）公开砍掉三大块：spec 写作（交给宿主 Plan Mode）、任务拆解（「前沿模型
自己会建待办」）、实现编排（「现代模型自己会管理与委派」），只留「标准的发现-索引-注入」。
**教训：凡是与宿主/前沿模型能力重叠的层都会贬值**。对 vima 的路线图含义：
不要投资「对话式任务拆解 UX」「通用编排 DSL」这类会被模型原生能力吞掉的层；
持续投资模型吃不掉的层——**机械校验、确定性渲染、领域 DSL、证据台账**。

### 3.3 BMAD 的 issue 履历：提示词维护状态必然漂移
#1015（code-review 标 done 却不更新 sprint-status.yaml）、#1588（声明了变量却不加载）、
#912（LLM 手工分片产出不可用）——大样本公开证据证明「靠提示词自觉维护状态/执行流程
必然漂移」；BMAD v6.11 引入确定性 Python 脚本产状态账本正是承认此事。
vima 的「frontmatter 状态机 + vima sync 对账 + 状态由 CLI 回写」从一开始就在正确一侧。

---

## 4. 采纳清单（防过度设计口径：每条标注它服务的既有目标/差距）

### T1 直接可做（低成本、确定性、不需要新格式）

| # | 条目 | 来源 | 服务的目标 |
|---|---|---|---|
| 1 | **init 同时生成 AGENTS.md**（与 CLAUDE.md 同源渲染或符号链接；CLAUDE.md 仍为 Claude Code 主入口） | agents.md 标准（60k+ 仓库、27+ 工具；Claude Code 是唯一大钉子户，官方解法即 symlink） | 生成项目的跨工具可移植性 |
| 2 | **图标机检升级为「拦截 + 最近邻候选」**：post-write 拒绝时按编辑距离给出 3 个最相似图标名 | v0 LLM Suspense 的图标最近邻替换 | A6 机检的纠错效率（错误消息即出路） |
| 3 | **hook/validate 错误消息全面对齐「出路话术」审计**：每条机检报错必含「怎么改对」 | v0/bolt 的修复回路设计；vima guard-shared 已是范本，扩展到全部新检查 | A6 |
| 4 | **gen-from-manifest 顺手产 ui-docs llms-full.txt 单文件档** | llms.txt 多档分级（Svelte/Nuxt UI） | 上手面（外部工具消费） |

### T2 立需求后做（对应评估未落地项，市场给出了具体形态）

| # | 条目 | 来源与形态 | 对应差距 |
|---|---|---|---|
| 5 | **`vima context <taskId>` 确定性上下文打包**：页面块+契约切片+manifest 切片+recipe+共享层索引；显式 alwaysFiles 白名单；**输出附字节计量与预算告警**（行业空白点） | BMAD story 胶囊 + devLoadAlwaysFiles；CCPM firewall I/O 契约；Agent OS index.yml | 评估 B1（§8 步 6） |
| 6 | **verifier 结论词汇补 WAIVED（豁免带理由落盘）**：契约 §6.9 points 增加 waived+reason，approve/check 聚合区分「未过」与「确认豁免」 | BMAD gate 词汇表；Spec Kit verdict 状态机 | 豁免目前只存在于对话（2.3） |
| 7 | **任务 frontmatter 增 `conflicts_with`**：plan 调度避免声明冲突的任务同批并行 | CCPM | 所有权模型的同文件盲区（2.4） |
| 8 | **MAINTAINING 期变更 delta 语义**：变更以 ADDED/MODIFIED/REMOVED 增量文件表达，验收后机械折叠回 spec 并归档留审计 | OpenSpec delta→archive | §13.4 维护闭环的形式化 |
| 9 | 〔库侧〕**ai-manifest 补组合约束字段 + useWhen/avoidWhen 语料 + 示例从验证用例生成** | dlslead 字段设计；Storybook snippet/策展 tag；评估 F 清单 | 评估 B4/F |

### T3 明确不学（带理由）

| 不学 | 理由 |
|---|---|
| worktree-per-agent 并行 | vima 的所有权+写锁是机械强制且更轻；worktree 把冲突推迟到合并期（CCPM 自己也只是约定防护） |
| GitHub Issues 当数据库 | 破坏离线/确定性/零依赖三条硬约束；vima 的审计已由 reports + git 检查点承担 |
| spec-as-source 代码再生 | Tessl 已实证翻车（§3.1） |
| 角色人格体系（12+ persona） | BMAD 自己的最大差评是流程重；vima 三角色（planner/builder/verifier）已够职能分离 |
| swarm 拓扑/共识协议叙事（Ruflo 类） | 与确定性路线相性差，宣传口径可验证性存疑 |
| LLM 复杂度打分驱动任务展开 | 概率性行为进调度层违反「确定性优先」；vima 的批次由拓扑机械计算 |
| 对话式任务拆解/通用编排 DSL 的深度投资 | Agent OS v3 减法警钟（§3.2）：会被前沿模型原生能力吞掉 |

### 观察项（不立项，持续盯）

- **Kiro Correctness**（EARS→属性测试+shrinking）：若 vima 未来要把 spec 第五章业务规则
  变成可执行断言，EARS 受控句式是现成语法基础——属重型方向，现阶段逐点验收+冒烟已够。
- **Spec Kit workflow 引擎**：gate/verdict/resume 的状态机设计可作 /go 闸门数据化的参照。
- **Storybook Component Manifest**：若成为 React 世界事实标准，其字段集是 ai-manifest
  的对齐/互转目标。
- **Agent Plugins 规范**（Kiro Powers 采用的厂商中立打包格式）：跨 agent 资产分发标准化
  的风向标，涉及 vima workspace 资产的分发形态。

---

## 5. 定位语（对外表述可直接用）

市场把「AI 开发脚手架」做成了三种东西：**提示词工艺品**（把流程写成 markdown 让 agent
自觉遵守——Spec Kit/BMAD/CCPM 的主体）、**平台围栏**（把验证做进专有 IDE/云——Kiro/v0）、
**分发协议**（让资产可被 agent 消费——shadcn registry/llms.txt/MCP）。
vima 走的是第四条：**把工程纪律编译成确定性代码**——受限 DSL、机械校验、写入拦截、
证据台账、字节一致渲染。2026 年的市场动向（BMAD 向证据回摆、Spec Kit 补 workflow 状态机、
学术界提出不变量+证据链）正在向这条路线收敛，而 vima 已经在这条路线上有完整实现。
差异化不是「也有 spec」，而是「**spec 是被机器执行的，不是被 agent 参考的**」。

---

## 附：核心出处索引（全量 URL 见各研究代理笔记，此处只列决策依赖项）

- Spec Kit：github.com/github/spec-kit（v0.16.2）；spec-driven.md（constitution/门禁）；
  github.github.io/spec-kit/reference/workflows.html（gate/verdict）
- Kiro：kiro.dev/docs/specs/correctness/（EARS→PBT）；/docs/hooks/；/docs/steering/；
  /blog/general-availability/（GA 2025-11-17）
- OpenSpec：github.com/Fission-AI/OpenSpec docs/concepts.md（delta 语义）、docs/cli.md（validate）
- Tessl 转向：tessl.io/blog/skills-are-software…；codemyspec.com/blog/tessl-review（非确定性实测）
- BMAD：docs.bmad-method.org/reference/workflow-map/；TEA overview（gate 词汇表）；
  issues #1015/#1588/#912（提示词维护状态漂移证据）
- CCPM：raw.githubusercontent.com/automazeio/ccpm/v1/AGENTS.md（context firewall 原文）
- Agent OS v3 减法：buildermethods.com/agent-os/migration
- AGENTS.md：agents.md（60k+ 仓库口径）；anthropics/claude-code#6235（symlink 现状）
- 组件库普查：designsystems.one/ai-ready/systems；state-of-ai-in-design-systems.netlify.app
- shadcn：ui.shadcn.com/docs/registry/registry-item-json；skills/shadcn/mcp.md（7 工具）
- Storybook：storybook.js.org/docs/ai/manifests（manifest 字段/策展 tag）
- v0：vercel.com/blog/how-we-made-v0-an-effective-coding-agent（93.87%/图标最近邻/autofixer）
- llms.txt v2：llmstxt.org（2026-08-10）
- 学术：arxiv.org/abs/2605.12981（PDD）；arxiv.org/abs/2605.01160（SGM）
- 批评文献：nearform.com/insights/lessons-from-real-world-failures-using-spec-driven-development；
  augmentcode.com/blog/what-spec-driven-development-gets-wrong；Sibylline（2026-01-28）
