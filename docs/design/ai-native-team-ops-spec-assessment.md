# 《AI 原生软件创业团队组织与交付运行规范》对标评估

> 创建日期：2026-08-21
> 评估对象：`~/下载/AI原生软件创业团队组织与交付运行规范.md`（v1.0）与
> `~/下载/AI原生软件创业团队组织与交付运行规范_v1.1.md`（v1.1.1，2026-08-21）。
> 该文档是一份**人类团队组织学规范**（6 人配置 / 四条 Pipeline / 现场实施），
> vima-cli 是**工具**。本评估回答一个问题：它的哪些机制值得吸收进 vima-cli、
> 以什么形式；哪些不吸收、为什么。裁定：吸收项须能反查到需求基线 R#/C#（A# 立项纪律）。

## 结论

**吸收一项：v1.1 §7A「涌现决策回写机制」→ 立项 A46（涌现决策留痕）。**
其余条目分三类处置：vima 已有更强形态（不重复吸收）、属人类组织学超出工具边界（不适用）、
前提在 vima 不成立（吸收即过度设计）。逐条判定见下表。

## 取舍表

| v1.1 章节 | 机制 | 判定 | 依据 |
|---|---|---|---|
| §6.1–6.4 | Package E1/E2/E3 分级（供需数学：人写 19 节重模板不可持续） | **不吸收** | 前提不成立：vima 的规格生产者是 Agent，不存在「Architect 每天只能写 N 份规格」的人力供需约束。分级思想已在它真正起作用的轴上落地——A34 保真分级 D0/D1/D2 按页分深浅。给任务再加一个 E 档字段 = 未经 vima 侧实证的新一等对象；若日后 retro 数据显示规格深度错配是返工主因，再立项 |
| §6.5 | Ready 判定两分法（缺核心语义不能 Ready / 缺局部实现可以 Ready，由执行者决策并回写） | **吸收（并入 A46）** | 这是 A46 分类判据的来源：缺「局部实现方式」→ Builder 自决并回写；缺「语义/边界/归属」→ 走升级通道。落进 `vima-builder.md` 的分类指引，不单独立项 |
| §7 | 50% 法则（规格不可能穷举实现细节） | 已内化 | 即用户自有 ai-dev-effort 方法论的 50% 法则；A46 是它的工程化出口 |
| **§7A** | **涌现决策回写：A/B/C 分类 + Emergent Decision List + 校准回路** | **吸收 → A46** | vima 真缺口：Builder 执行中「规格没说、我替它定了」的一般性决策目前只有窄通道（sharedChangeRequest 限共享层、componentExtractionRequest 限组件抽取、contractGaps 限契约缺口且在 verifier 侧），其余落自由文本 `notes` 或无痕。需求基线 **R2 观测平台第五问「哪些是 AI 替我定的——裁定台账，可二次裁决」** 在 DEVELOPING 期没有数据源；A45 只补了设计方向一个点。校准回路（§7A.3）= A21 retro 的既有职责；「B 类固定批次确认」= A20 收敛期的既有窗口。**C 类不吸收为新通道**（见 A46 明确不做） |
| §8 | FT-042 示例 | **反面教材，佐证 A22** | v1.0 评审已指出：Inputs 缺幂等键（出院事件 ID），而 BR-001/AC-002 都引用「同一次出院事件」；§17 的 ISSUE-103 正是按此实现必然产出的生产事故。**v1.1 仍未修**。它精确演示了「模板节数齐全 ≠ 字段自洽」——字段级对账靠人填模板保证不了，须机检（A22 已立） |
| §9 | Blocked Queue + 立即切换 | 已覆盖 | A17 反停顿纪律 + A18 批次拓扑（conflictsWith / 同层流水线 / 续跑器） |
| §10 | Contract First / Mock First | 已覆盖 | 契约纪律（§9.5）+ `vima mock`（A27）+ V-CON/V-CODE 规则族 |
| §11 | 数据库并发 / Migration 升级线 | 已覆盖 | 共享层禁改（guard-shared）+ sharedChangeRequest 升级通道 |
| §12 | Git worktree 每 Agent 隔离 | 不适用于 vima 内核 | 属 Agent 宿主（Claude Code）的运行方式，vima 不管理 git 拓扑（纪律：不执行 git push） |
| §13 | 自动 Gate + 升级白名单 | 已覆盖 | validate/converge/certify 三道机检闸门 + approve 人审位 |
| §13.2 | AI Review 独立性（异源模型 / 独立上下文 / 对抗式 prompt） | 已覆盖（更强形态） | vima-verifier 是独立子代理（上下文天然隔离）；逐点证据判定（§6.9 points/B1）+ waived 须用户裁定 + hook 形状机检，比「换个对抗姿态的 prompt」约束更硬。模型档位按角色逐个实证裁定（A45 D-A45-05 先例），不做「一律异源」的无实证扩面 |
| §13.2 | 三类默认人工逐行 Review（财务口径/身份归并/隐私） | 不吸收 | 人类团队分工规则。vima 的对应物是 A5 诚实分级 + approve 人审位；按「业务域」强制人审需要 vima 判定业务域语义，做不到零假阳性 |
| §15–17 | 现场问题分级 L1/L2/L3 + Structured Field Issue Package | 已覆盖 | A31 `vima change`（基线快照/影响面/任务重开/传播闸门）是它的机检形态 |
| §18 | 需求防火墙 | 已覆盖 | 同上（A31）；「结构化后才能进研发」= change 事务的定义 |
| §19 | 第三方接口依赖台账 | 不吸收 | vima 项目的外部依赖走契约 + mock（A27）；独立台账是实施团队资产，vima 无消费端 |
| §20 | Release Package | 不吸收 | 交付实施属明确排除面；certify（A32）已按证据阶梯回答「能不能交付」，且显式不宣称 deployable |
| §21 | 状态模型 | 已覆盖 | 任务 frontmatter status + lifecycle phase |
| §22 | 指标（Ready Coverage / Emergent Decision Rate 等） | 部分吸收 | Emergent Decision 计数随 A46 进 retro；Ready Coverage 不吸收——vima 任务一次拆完，不存在「队列耗尽」；ETA 已由 A37 以拒绝无样本外推的形态回答 |
| §23A | D-ID 决策台账 | 已覆盖 | spec 第八章决策表（A4，含否决项）+ 需求基线裁定台账 + A45 `selectedBy` 留痕 |
| §25 | 估算门（三条线 / E 档费率 / 停工线） | 不吸收 | 它本就是从用户的 ai-dev-effort skill 反向吸收过去的；估算是「人对客户的承诺」，vima 只产出证据不产出承诺（与 A32「不宣称 deployable/stable」同一价值观）。skill 已独立存在，工具重复实现 = 同一方法论两套载体必然漂移 |
| §3–5, §4.5, §14, §24 | 6 人配置 / R2 Backup / Pool→Pod / 上线检查单 | 不适用 | 人类组织学与现场实施，超出工具边界 |

## 对 v1.1 修订质量的一句话评价

v1.1 修掉了 v1.0 的五个结构病（供需数学、50% 法则出口、估算门、bus factor、同源 Review），
但示例层的字段级缺陷（FT-042 幂等键）原样保留——**规范自我修订能修结构，修不了逐字段的
一致性**，这再次印证 vima 把字段对账做成机检（A22/A42）而非文档纪律的路线。

## 吸收产物

- 立项：`docs/design/v2.1-amendments.md` **A46 涌现决策留痕**
- 契约：`docs/internal-contracts.md` §6.9 / §6.13 / §6.14 / §12
- 落点：`templates/admin/workspace/hooks/post-write.mjs`、
  `templates/admin/workspace/agents/vima-builder.md`、
  `lib/model/journal.mjs`、`lib/commands/converge.mjs`、`lib/commands/retro.mjs`
