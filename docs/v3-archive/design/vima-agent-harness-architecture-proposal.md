# vima Agent Harness 架构升级提案

> 创建日期：2026-08-14
> 更新日期：2026-08-14（第 1 轮评审收敛：补前置裁定、证据分级、命名空间合规、重复立项裁定）
> 状态：**战略架构提案，未立项、未进入实施契约**
> 目标：将 vima-cli 从「AI 开发流程脚手架」升级为「AI Agent 的确定性外置 Harness」
> 适用范围：本文件定义目标形态、架构缺口、候选 Module 与演进顺序；不提前冻结具体 Interface、文件 schema 或 CLI 命令。

> **命名空间声明（遵 A35 D-A35-08）**：A# 编号的分配权由 `v2.1-amendments.md` 独占，
> 本文在入册前**不得自行占用 A#**。本文自有前缀为 **`H`**：候选 Module 记为 `H-M1…H-M7`，
> 前置裁定记为 `H-ADR-01…H-ADR-05`。入册那一刻由登记册分配 A 号，`H-ADR-##` 同时转写为
> 登记册的 `D-A##-##` 决策记录。**本文不新建 `docs/adr/` 目录**（理由见 §5 Phase 0）。

> **本文所有量化断言均来自可复跑命令，取值时间 2026-08-14，全量测试 473/473 通过。**
> 断言与行号是**该时刻的快照**：本轮取值期间已观察到并行会话在改动
> `lib/commands/{validate,converge,certify}.mjs` 与相应测试，导致两次测量间行数漂移。
> 因此凡引用行号处均附锚点文本；引用任何数字前请重跑对应命令核验。

---

## 0. 一句话结论

当前 vima-cli 已经拥有一套较完整的 Agent 工作协议，但还没有 Agent Runtime。

它能生成规范、安装工作区、计算批次、校验产物、汇总报告；但真正的任务派发、状态推进、重试、补偿、恢复与停止判断，仍由主 Agent 阅读长提示词后自行解释和执行。

本次升级不应继续以「增加更多命令」为中心，而应把 vima 建设成确定性的外置控制平面：

- Agent 负责需要模型判断的语义工作；
- vima 负责运行事实、状态迁移、调度、权限、上下文、证据和恢复；
- Claude Code、Codex 等宿主通过 Adapter 接入，而不是各自复制一套工作流；
- 文件系统真源、零运行时依赖、原子写入和稳定输出等既有优势继续保留。

完整 Harness 的判断标准不是「能调用 Agent」，而是：即使 Agent 中断、遗忘提示、重复提交或给出不可信结果，运行仍然可观察、可恢复、可约束、可审计。

**但这个标准能否达到，取决于一个尚未裁定的前提——vima 是被 Agent 调用的一方，还是调用 Agent 的一方（§1.4）。该前提未定之前，本文第 5 节以后的路线图只有一半成立。**

---

## 1. 战略定位变化

### 1.1 旧定位

现有设计明确采用以下前提：

- 「不是造 Agent，而是造宪法体系」；
- v2.x 只支持 Claude Code；
- 不为其他 Agent 预留抽象 Interface；
- 批次推进依赖 Claude Code 主 Agent 解释 `/go` 协议。

依据见 [`vima-cli-design-v2.md`](./vima-cli-design-v2.md) §1.2、§1.3、§10。

该决策在「Claude Code 专用脚手架」目标下是合理的，避免了没有第二个 Implementation 时制造假 Seam。

### 1.2 新定位

新的产品目标是：

> vima 是 AI Agent 的确定性外置 Harness，而不是某个宿主内部的一组提示词资产。

这意味着旧设计中的「只支持 Claude Code」和「不预留 Adapter」需要正式重开，而不是在旧文档上追加少量例外。

同时，新定位不等于 vima 自己实现另一个通用 Agent。vima 不负责替代模型推理，而负责把概率性 Agent 放进一个确定性的运行、策略和证据框架中。

### 1.3 领域词汇

在入册并把术语并入登记册前，本提案暂时采用以下术语。**下表须覆盖正文全部承重词**——一篇以「建立领域语言」为 Phase 0 的文档，不得使用未定义的承重词：

| 术语 | 本文含义 |
|---|---|
| Harness | 包围 Agent 的外置执行与治理体系，拥有运行状态、调度、策略、证据与恢复能力 |
| Run | 一次有身份、可恢复、可终止、可审计的执行实例 |
| Work Graph | 任务、依赖、重试、补偿与闸门组成的可执行工作图 |
| Host | 实际承载模型与工具调用的 Agent 环境，如 Claude Code、Codex |
| Module | 隐藏复杂 Implementation、向调用方暴露较小 Interface 的领域模块 |
| Interface | 调用方必须理解才能正确使用该 Module 的全部知识（不止函数签名，含隐含前置条件与副作用） |
| Implementation | Module 内部、调用方无须理解即可正确使用的部分 |
| Depth | Implementation 体量与 Interface 体量之比；比值高 = 深 Module。**判据**：删掉该 Module 后，复杂度是消失还是原样落回每个调用者——落回即说明它浅 |
| Locality | 修改一条规则时需要同步改动的位置数量；位置越少 Locality 越高 |
| Leverage | 一处改动能同时惠及的下游消费者数量 |
| Seam | 两个实现可以真正独立替换或演进的位置 |
| Adapter | 将 Host、CLI、hook 或 CI 的具体协议转换为核心 Module 可消费语义的实现 |
| Evidence | 带来源、新鲜度和输入关联的可验证运行产物，不等同于 Agent 自述 |
| Attestation | Evidence 的出具方式：`machine`（vima 或确定性工具产出、可原样复现）／`agent`（模型叙述，不可复现）。详见 §4.3 |
| Policy | 对工具、文件范围、人工批准、预算与闸门的确定性约束 |
| 控制模型 | vima 与 Agent 之间的进程关系：**协作式**（Agent 调用 vima）或**监督式**（vima 派生 Agent）。见 §1.4 |

术语最终落点是登记册的术语小节，**不新增顶层 `CONTEXT.md`**——理由同 §5 Phase 0：仓库不应出现第二个定义真源。

### 1.4 前置分叉：控制模型（本提案最重要的未决问题）

本文原稿从头到尾没有回答一个问题：**vima 是被调用方还是调用方。**

今天的事实是 **协作式**：Agent 主动调用 `vima plan` / `vima validate`，读输出，自行决定下一步。在这个形态下，vima 是一个纯 callee，没有任何进程在监督 Agent。

由此产生一条硬约束：**§7 的成功判据第 2 条（租约是否仍有效）、第 4 条（中断后如何从磁盘恢复）、第 7 条（能否取消、恢复、重放）在协作式模型下不可达。** 原因不是实现难度，而是定义缺失——没有监督进程，就不存在「中断」这个可观测事件，只存在「Agent 再也没有调过来」，而后者与「Agent 正在思考」在磁盘上无法区分。任何基于文件 mtime 的推断都是启发式，不是运行事实。

[`go-continue.mjs`](../../templates/admin/workspace/hooks/go-continue.mjs) 是这条约束的现役证据（详见 §2.2）。

因此 Phase 0 必须先做出裁定：

**`H-ADR-01`：vima 采用协作式控制模型还是监督式控制模型？**

| | 协作式（今天） | 监督式 |
|---|---|---|
| 进程关系 | Agent → 调用 vima | vima → 派生 Agent（如 `node:child_process` 拉起 headless Host 进程） |
| 能拿到 | 守门：拒绝非法状态迁移、拒绝无证据的 done、拒绝越权写入 | 上述全部 + Run 身份、租约、超时、取消、崩溃恢复、重放 |
| 拿不到 | §7 的 2 / 4 / 7 条 | —— |
| 零运行时依赖 | 保持 | 保持（`node:child_process` 是内建模块） |
| 产品 UX 影响 | 无 | 改变「用户对着谁说话」；需双模：交互态沿用今天的工作区资产，无人值守态由 vima 驱动 |
| 对 §7.8（同一 Work Graph 跑两个 Host） | 只能靠两套提示词各自遵守，不可验证 | 唯一可验证的实现路径 |

两条路都是正当选择，但**必须显式选一条并同步修订 §7**：

- 若选协作式，应主动把 §7 的第 2 / 4 / 7 条删除或降级为「尽力而为」，并把产品叙述从「Harness/Runtime」收回到「确定性守门人」，不得对外宣称运行时能力；
- 若选监督式，则 §5 的垂直切片必须从第一天就包含「谁派生 Builder 进程」，否则做到一半会发现判据不可达。

**在 `H-ADR-01` 裁定之前，不得启动 §8 的垂直切片立项。** 这是本轮评审新增的唯一硬闸门。

---

## 2. 当前架构的真实缺口

### 2.1 调度仍是一份散文协议

[`templates/admin/workspace/commands/go.md`](../../templates/admin/workspace/commands/go.md) 共 **316 行**（`wc -l`，2026-08-14），其中要求主 Agent 自行完成：

- 计算并领取可运行任务；
- 启动 Builder 与 Verifier；
- 写入 `running/done/failed/blocked`；
- 执行最多两次重试；
- 阻断失败任务的下游依赖；
- 创建补偿任务；
- 维护任务预算与收敛轮次；
- 写入合法停因并决定是否继续。

[`lib/commands/plan.mjs`](../../lib/commands/plan.mjs)（239 行）只生成静态批次，不拥有一次 Run，也不负责推进 Work Graph。

这是一条浅 Interface：调用者必须理解几乎全部调度 Implementation。按 §1.3 的 Depth 判据——删除 `go.md` 后，复杂度不会消失，只会重新落回主 Agent。

### 2.2 Stop hook 不拥有恢复，且被约束方自己出具约束依据

[`go-continue.mjs`](../../templates/admin/workspace/hooks/go-continue.mjs)（78 行）只读取 `.vima/go-state.json` 并决定是否阻止停止。

它不拥有：

- Run 身份；
- 状态推进；
- 重试次数的可信计算；
- 任务租约与超时；
- 崩溃后的重建；
- 事件记录与回放。

**更关键的是信任方向**：该 hook 的判定输入 `stopReason` 与 `consecutiveResumes` **全部由被它约束的主 Agent 自己写入**（契约 §6.12「主 Agent 写，Stop hook 读」）。Agent 想结束回合，只需把 `stopReason` 从 `in-progress` 改成 `budget` 即可合法脱身；`consecutiveResumes` 归零时机同样由 Agent 自觉执行。hook 源码第 12 行已诚实写明定位是「防误不防恶意」。

因此目前的「断点续跑」是**提示词约定，不是运行时保证**。

这条对 §4.2 有直接推论：**若把同一套逻辑原样搬进「Agent Run Module」而不改控制模型（§1.4），只是把同一个信任漏洞从提示词挪进内核**，§7 的第 10 条判据依然不达标。

### 2.3 状态真源分散

当前至少有四个重叠的状态面：

1. `docs/lifecycle.json`：项目阶段、批准和 checklist；
2. `tasks/*.md` frontmatter：任务状态、依赖和尝试次数；
3. `.vima/reports/**`：执行与验收结果；
4. `.vima/go-state.json`：`/go` 停止和恢复状态。

[`lib/model/lifecycle.mjs`](../../lib/model/lifecycle.mjs) 的 `saveLifecycle(root, obj)` 是**整对象写回**，不校验迁移合法性；实测有 **8 个命令共 11 处调用点**（`design` ×3、`approve` ×2、`init`、`sync`、`change`、`render-review`、`render-prototype`、`validate` 各 1），各自维护阶段历史、批准失效、设计范围和 taskStats。任务状态又允许 Agent 直接修改 Markdown frontmatter。

因此，跨文件不变量没有统一 Seam，单次状态迁移也无法保证原子协调。

### 2.4 报告存在，但没有统一证据语义——也没有真伪之分

`.vima/reports` 已经是事实上的跨 Module 数据通道，但不同消费者对同一类异常采用不同语义（实测）：

| 消费者 | 报告 JSON 解析失败时的行为 | 位置 |
|---|---|---|
| `converge` | `continue`，跳过该报告，不阻断对账 | `converge.mjs:110`（锚：`// 报告损坏不阻断对账`） |
| `certify` | `ok = false`，与「缺失」同等对待，计入缺证据 | `certify.mjs:73`（锚：`// 缺失或损坏都算无通过证据`） |
| `retro` | 返回 `null`，宽松读取 | `retro.mjs:39`（锚：`readJsonSafe`） |
| `design` | 记为 `reason: '报告缺失'` | `design.mjs:640`（锚：`reason: '报告缺失'`） |

其中 `design.mjs:640` 是**错误归因**而非仅语义不一致——报告存在但内容损坏，被上报成「缺失」，运维据此会去找一个其实已经存在的文件。

报告的来源、输入摘要、轮次、重复、过期、豁免和损坏没有统一的 Evidence Store Module。

**更根本的缺口**：现有全部报告语义都只处理「格式是否可读」，**没有任何一处区分「这条结论是机器跑出来的还是模型说出来的」**。`vima validate` 的 findings、探针输出、render digest、命令退出码是可原样复现的机器事实；`<taskId>-verifier.json` 里的 points 结论是模型叙述。二者在 `.vima/reports/` 里形态相同、权重相同。这是 §4.3 必须先解决的问题，也是本轮评审认定**优先级最高、且不依赖 `H-ADR-01`** 的一项。

### 2.5 命令层承载了领域 Implementation

体量事实（`wc -l`，2026-08-14）：

- `lib/commands/`：**9,030 行**（21 个文件）；
- `lib/model/`：**675 行**。

所谓「模型层」只是文件读取与解析器（`loadTasks` / `loadLifecycle` / `saveTaskFrontmatter` 等），**领域实现全部在命令层**。

命令之间的直接导入实测共 **22 条边**（`grep -n "from '\./" lib/commands/*.mjs`），远多于原稿列举的 4 组：

- `approve → validate / render-review / render-prototype / design`；
- `doctor → sync / plan / create`；
- `design → change / validate`；
- `certify → design`；
- `change → validate / converge`；
- `converge → validate`；
- `render-prototype → validate`、`render-review → validate`；
- `init → create`、`update → create / init`、`app → create / init`、`upgrade → create`、`sync → plan`。

其中 [`validate.mjs`](../../lib/commands/validate.mjs) 已达 **2,265 行**并被 **6 个命令**导入（`approve`／`change`／`converge`／`design`／`render-review`／`render-prototype`）——**它事实上已经是领域层了，只是没有被这样命名，因而也没有对应的边界纪律。** [`context.mjs`](../../lib/commands/context.mjs)（739 行）同时承担读取、关联、筛选和渲染职责。

这说明 CLI Adapter 与领域 Module 尚未形成清晰 Seam。命令文件不仅呈现结果，还拥有其他命令必须复用的 Implementation。

### 2.6 Claude 工作区资产等同于运行时

`init/update/doctor` 围绕 `.claude/**` 的固定目录和文件名安装、升级、检查资产；`AGENTS.md` 只是指针，并不是第二个可执行 Host Adapter。

因此当前只有一个 Implementation。此时直接创建抽象 provider registry 会形成假 Seam；只有确定同时交付第二个 Host 后，Host Adapter 才具备真实价值。

---

## 3. 目标架构

```text
┌──────────────────────────────────────────────────────────────┐
│ 用户 / CLI / CI / IDE                                       │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                 Deterministic Control Plane                  │
│                                                              │
│  Agent Run Module      State Transition Module               │
│  Work Graph            Validation and Policy Module          │
│  Project Graph         Artifact Lineage Module               │
│  Context Compiler      Evidence Store Module                 │
│                                                              │
│            Durable Run Ledger / Filesystem Truth             │
└──────────────────────────────┬───────────────────────────────┘
                               │
                         Host Adapter Seam
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
       Claude Code Adapter                Codex Adapter
              │                                 │
              └──────── Agent / Tool ───────────┘
```

> 上图描述的是**监督式**控制模型下的目标形态。若 `H-ADR-01` 裁定为协作式，
> 图中 `Agent Run Module` 与 `Durable Run Ledger` 应替换为「守门与证据层」，
> 并删除 Run 生命周期相关能力。**该图不得在裁定前被当作既定架构引用。**

### 3.1 Control Plane 必须拥有的事实

Harness 至少应确定性拥有：

- Run 的身份、输入、当前状态和结束原因；
- Work Graph 中哪些任务可运行、正在运行、已完成或被阻断；
- 每次领取、提交、验收、重试和补偿的事件；
- 文件写入范围、工具能力、预算和人工批准 Policy；
- Agent 收到的上下文版本及其来源；
- 验收结论对应的 Evidence、其 Attestation 与新鲜度；
- 中断后如何从落盘事实恢复，而不是依赖聊天上下文猜测。

> 其中第 1、3、7 条**仅在监督式模型下可完整拥有**（§1.4）。

### 3.2 Agent 继续拥有的工作

下列能力仍应留给 Agent：

- 理解需求和业务语义；
- 设计与实现代码；
- 分析非结构化反馈；
- 在受控范围内选择工具；
- 对无法机器判定的体验问题给出结构化判断（**其产出的 Attestation 恒为 `agent`**）；
- 在 Harness 要求人工裁定时整理决策材料。

### 3.3 应保留的现有原则

- **确定性核心**：状态、调度、校验与证据消费不依赖模型自觉；
- **文件系统真源**：运行事实可检查、可版本迁移、可离线恢复；
- **零运行时依赖优先**：不因升级为 Harness 就立即引入重型运行框架；
- **稳定输出**：错误码、JSON、排序和摘要保持可测试；
- **平台语义隔离**：Claude/Codex 的工具协议只能存在于各自 Adapter；
- **不制造假 Seam**：只有一个 Implementation 时保持直接，第二个 Implementation 落地时再抽取真实共性；
- **不制造第二个真源**：新增治理机制前先检查登记册是否已有同类机制（本轮评审在 §5 Phase 0 撤回了两处违反项）。

---

## 4. 候选深层 Module

> 编号为本文自有前缀（§命名空间声明），入册时由登记册重新分配。

### 4.1 `H-M1` State Transition Module

**Files**

`lib/model/lifecycle.mjs`、`lib/model/tasks.mjs`、`approve.mjs`、`design.mjs`、`change.mjs`、`sync.mjs`。

**Problem**

多个命令和 Agent 都能直接改写状态：`saveLifecycle` 整对象写回、8 个命令 11 处调用点、任务 frontmatter 由 Agent 直接编辑（§2.3）。阶段、批准、任务尝试和统计的不变量分散在调用者中；删除现有保存函数只会使各调用者直接执行文件写入，按 §1.3 的 Depth 判据即说明当前 Module 浅。

**Solution**

建立 State Transition Module，集中阶段迁移、批准与失效、任务尝试、统计重建、并发写保护和崩溃恢复。磁盘格式作为内部 Implementation 保留，不再要求所有调用者掌握完整结构。

**Benefits**

- 为 Agent Run 提供唯一状态 Seam；
- 非法迁移和重复提交可被确定性拒绝；
- 状态规则具有更强 Locality；
- CLI、hook、测试和未来 Host Adapter 共享同一 Implementation。

**依赖**：不依赖 `H-ADR-01`，两种控制模型下都成立。

### 4.2 `H-M2` Agent Run Module

**Files**

`templates/admin/workspace/commands/go.md`、`go-continue.mjs`、`plan.mjs`、`sync.mjs`、`converge.mjs`、Builder/Verifier 资产。

**Problem**

可运行任务判定、重试、依赖传播、补偿、预算、收敛和合法停因全部由 Agent 解释长提示词完成。vima 不能启动、查询、取消、恢复或重放一次真正的 Run。

**Solution**

建立 Agent Run Module，让 Work Graph 推进、任务领取、重试与补偿、恢复和停止判定进入确定性内核。Agent 只领取语义工作并提交结构化结果。

**Benefits**

- 从「Agent 自觉执行 SOP」升级为「Harness 执行工作图」；
- 获得无人值守、断点续跑、取消和重放能力；
- 可以直接测试完整运行轨迹；
- 同一 Implementation 可服务交互式运行、CI 和不同 Host。

**依赖**：**强依赖 `H-ADR-01`**。若裁定为协作式，本 Module 的可交付范围收缩为「可运行集计算 + 非法迁移拒绝」，上列 Benefits 的第 2、3 条不成立，不得写入验收判据（§2.2）。

### 4.3 `H-M3` Evidence Store Module（含证据分级）

**Files**

`.vima/reports/**`、Agent 报告、`converge.mjs`、`certify.mjs`、`retro.mjs`、`design.mjs`、`check.md`。

**Problem**

两层，必须分开处理：

1. **格式层**：报告已是 Harness 的核心事实，但接收、损坏、缺失、重复、轮次、过期与豁免语义由消费者自行决定（§2.4 表）。
2. **真伪层（更根本）**：现有语义**只回答「报告是否可读」，不回答「结论是否可信」**。schema 合法的假报告与真报告完全等价。因此原稿把「Agent 不能仅靠写一个 `pass` 报告绕过闸门」作为 Evidence Store 的完成标志，是**不可兑现的**：Store 管来源、轮次与新鲜度，管不了内容真假。

**Solution**

**第一步——证据分级（Attestation），先于 Store 落地：**

给每条 Evidence 增加一等字段：

| 值 | 含义 | 例 |
|---|---|---|
| `machine` | 由 vima 或确定性工具产出，携带可复现命令与退出码，Harness 能原样重跑得到相同结论 | `vima validate` findings、A27 七探针输出、render digest、测试退出码、截图 diff |
| `agent` | 模型叙述，不可复现 | `<taskId>-verifier.json` 的 points 结论、体验判断 |

规则：

- **闸门只认 `machine`**；
- `agent` 结论仅在机器证据**缺位**时作为显式降级通道，且必须留痕；
- 降级次数与覆盖面直接挂到 **A32 交付等级认证的四级证据阶梯**——A32 已有现成的等级挂点，不必新造评分机制。

**第二步——Evidence Store：**

集中证据接收、结构校验、来源、轮次、输入摘要、新鲜度、豁免和查询投影，统一 §2.4 表中四种分歧行为（并修正 `design.mjs:640` 把损坏归因为缺失的缺陷）。各类报告可以保留各自内容，但不能再由消费者任意解释可信度。

**Benefits**

- `converge/certify/retro/design/check` 共享证据语义；
- 损坏或伪造不再静默降级；
- 验收结论可追溯到输入、执行轮次与出具方式；
- 为后续运行审计与优化提供高 Leverage 数据基础。

**依赖**：**不依赖 `H-ADR-01`**。这是本文全部候选项中唯一「优先级最高且无前置」的一项，故在 §5 中被提到 Phase 1。

### 4.4 `H-M4` Project Graph Module

**Files**

`lib/model/{spec,contracts,tasks,lifecycle,manifest,apps}.mjs` 及 `validate/context/change/design/converge/certify`。

**Problem**

现有模型层主要负责读文件和解析（675 行 vs 命令层 9,030 行，§2.5），页面归端、契约引用、任务责任田、消费者、设计范围和 legacy 回退等交叉语义由命令重复建立。

**Solution**

在现有加载器之上形成规范化 Project Graph Module，集中项目身份、阶段、端册、规格、契约、任务和交叉索引。目标不是制造一个巨型可变对象，而是隐藏重复的关联 Implementation。

**Benefits**

- 验证、上下文、影响分析、调度和认证消费相同项目事实；
- 减少重复读取和 fixture 拼装；
- 解析失败与 legacy 行为具有统一语义；
- 领域关系拥有更高 Locality。

**依赖与排期**：本项为**纯重构收益、不带来新能力**，且其形状随 `H-ADR-01` 变化（监督式下需承载 Run 视角的查询投影）。**建议明确压后至 Phase 5，裁定完成前不动。**

### 4.5 `H-M5` Validation and Policy Module

**Files**

`validate.mjs`、`post-write.mjs`、`guard-shared.mjs`、`doctor.mjs`、`render-*`。

**Problem**

CLI 全量校验和工作区 hook 增量保护分别维护规则、路径归一、legacy 回退和 finding 语义。新增规则需要同步多个 Implementation（Locality 低）。

现有写入范围策略实测是**割裂的两段，而不是一条规则的两个执行点**：

- `guard-shared.mjs`（PreToolUse hook）**只覆盖共享目录**（`manifest.json` 的 `apps[].sharedDirs` + `backend.sharedDirs`），凭 `.vima/shared-write-token` 放行，且自述「防误不防恶意，只覆盖 Write/Edit 工具通道」；
- A18 的 `apis` **责任田越界**（越出任务声明的接口集去实现）**在写入时完全不拦**，只由 `converge` 的 **V-INT-03** 在收口期事后发现（`converge.mjs:252-263`）。

即：同一条「不许越界写」的规则，一半在写时、一半在收口，且两半的 finding 语义不通用。这正是本 Module 要消除的形态。

**Solution**

形成深 Validation and Policy Module，集中规则评估、适用 profile、finding 规范、稳定排序、文件范围、工具权限、预算和人工批准策略。CLI 与 hook 是两个真实 Adapter（**已有两个 Implementation，非假 Seam**）。

**Benefits**

- 一条规则同时覆盖写入时和收口时（以 V-INT-03 责任田为首个验证用例）；
- Policy 不再依赖提示词是否被 Agent 遵守；
- Adapter 一致性可以独立测试；
- `validate.mjs` 可从 2,265 行的巨型命令逐步退回呈现职责。

**依赖**：不依赖 `H-ADR-01`。

### 4.6 `H-M6` Artifact Lineage Module

**Files**

`context.mjs`、`change.mjs`、`design.mjs`、`render-*`、`manifest.mjs`、`doctor.mjs`。

**Problem**

仓库存在多套独立的派生产物机制：render 漂移、change baseline、design digest、context 切片、manifest checksum 和批准时效。它们都在回答「哪些输入变化会使哪些产物失效」，但知识散落在调用者中。

**Solution**

建立 Artifact Lineage Module，集中派生产物的输入集合、内容摘要、失效传播和可重建性。先收口现有重复事实，不提前设计任意通用 DAG。

**Benefits**

- 支持精准重验和增量上下文；
- 统一批准、报告、缓存和设计产物的新鲜度；
- 修改一份真源后，失效传播可以确定性计算；
- 减少每个命令各自实现 hash 与漂移规则。

**依赖与排期**：同 `H-M4`，纯重构收益，**建议压后至 Phase 5**。

### 4.7 `H-M7` Workspace Distribution Module 与 Host Adapter

**Files**

`init.mjs`、`update.mjs`、`doctor.mjs`、`templates/admin/template.json`、`templates/admin/workspace/**`、`.vima/manifest.json`。

**Problem**

当前 workspace 是目录约定和隐式逻辑：安装、升级和体检硬编码 Claude 文件名，模板无法完整声明角色、命令、hook、工具要求、Evidence 类型和兼容 Host。

**Solution**

先深化 Workspace Distribution Module，让能力包、资产所有权、安装形态、升级迁移和完整性检查由同一声明驱动。若战略上承诺同时交付 Claude Code 与 Codex，再从两个真实 Implementation 中提取 Host Adapter Seam。

**Benefits**

- 新增角色或 hook 不再同步修改多个命令；
- 能力包可以版本化、迁移和验证；
- 避免在只有一个 Host 时制造假抽象；
- 第二个 Host 落地后获得真实跨宿主 Leverage。

**与既有提案的关系（重要）**：本项的后半段与 `pact-vs-vima-generational-assessment.md` 的 **G4「Agent Adapter」**（`adapters/claude-code/` + `adapters/codex/`）是**同一件事**。两处不得各自立项，须在 Phase 0 由 `H-ADR-03` 裁定归并方向（详见 §9）。

---

## 5. 推荐实施顺序

> 本节相对原稿有三处结构性修订：① Phase 0 撤回两个新真源；② 新增 Phase 1「证据分级」作为唯一可先行的实现项；③ `H-M4`/`H-M6` 压后。

### Phase 0：领域语言、命名空间与前置裁定

**撤回原稿的两项做法**，理由是它们与仓库既有治理机制正面冲突、并会制造本文自己反对的第二真源：

| 原稿做法 | 撤回理由 | 改为 |
|---|---|---|
| 新增 `docs/adr/` | 登记册 `v2.1-amendments.md` 已有 **58 条 `D-A##-##` 决策记录**与 **16 处「改判」语义**，且每条带被否方案与理由，比标准 ADR 更严。新建目录 = 第二个决策真源 | `H-ADR-##` 入册时转写为登记册的 `D-A##-##` |
| 新增 `CONTEXT.md` | §1.3 术语表已经写好，登记册有术语落点 | 入册时并入登记册术语小节 |
| 本文无编号 | **A35 D-A35-08 刚立规：A# 由登记册独占，提案在入册前须用自有前缀**（该规则正是因「代际评估 A34 与登记册 A34 撞车」而立） | 本文启用自有前缀 `H`；A 号入册时申请（当前登记册已用至 A35） |

Phase 0 的交付物是**五条裁定**，全部记为 `H-ADR-##`：

- **`H-ADR-01`（前置闸门）**：控制模型——协作式 vs 监督式（§1.4）。**未裁定则后续全部阻塞。**
- **`H-ADR-02`**：vima 是外置 Harness 还是 Claude 专用脚手架（重开 design-v2 §1.2/§1.3 的旧决策）。
- **`H-ADR-03`**：本文 `H-M7` 与代际评估 **G4** 的归并方向；是否明确承诺 Claude Code + Codex 两个 Host。
- **`H-ADR-04`**：Run 的事实以快照、事件账本或二者组合保存；**并同时裁定与已入册的 A35 `journal.jsonl` 的关系**（§9）。
- **`H-ADR-05`**：核心继续使用文件系统真源，还是引入其他持久化方式。

未完成这些裁定前，不应先写 provider registry 或大规模搬迁命令代码。

### Phase 1：证据分级（唯一不依赖前置裁定的实现项）

落地 §4.3 第一步：Evidence 的 `attestation: machine | agent` 一等字段、闸门只认 `machine`、`agent` 降级留痕并挂 A32 等级。

**为什么排在垂直切片之前**：

- 它堵的是当前最大的信任漏洞（§2.4 真伪层、§2.2 自证漏洞的同源问题）；
- 它**不依赖 `H-ADR-01`**，两种控制模型下都成立，不会因裁定结果返工；
- 改动面小：vima 已经同时握有两类证据，缺的只是把它们分开命名并在闸门处区别对待；
- 它为后续所有 Module 提供可信输入——先有可信证据，再谈基于证据的调度。

### Phase 2：最小可运行垂直切片

只覆盖一个最短闭环：

```text
一个待办任务
  → Builder 领取
  → 提交结果
  → Verifier 验收
  → done 或重试
  → Run 结束
```

该切片必须具备：

- Run 身份；
- State Transition Module（`H-M1`）；
- 落盘运行事实；
- 中断恢复；
- 取消；
- Evidence 关联（消费 Phase 1 的 attestation）；
- 对现有 Claude 工作区的兼容。

**本轮评审补入的三项必备件**（原稿缺失，缺一则切片不可交付）：

1. **谁派生 Builder**——由 `H-ADR-01` 决定。协作式下「领取」是 Agent 主动拉取，切片必须显式说明此时「中断恢复」「取消」两项如何定义或如何删除；
2. **并发与写入冲突的既有实现接线**——切片必须复用 `guard-shared.mjs`（sharedDirs 令牌）与 A18 `apis` 责任田（V-INT-03），而不是另起一套范围控制。§4.5 已指出这两段今天是割裂的，切片是把它们合一的第一个真实用例；
3. **最小 `vima run status`**——第一次无人值守跑挂了必须能诊断。这**不是 Phase 7 的可观测性需求**，是切片自带件；没有它，切片无法验收自己。

此阶段不做多 Host、不做通用插件系统、不做远程队列。

### Phase 3：接管 `/go` 的 Work Graph

逐项把 `go.md` 中的确定性行为迁入 Agent Run Module（`H-M2`）：

1. 可运行任务判定；
2. 依赖阻断；
3. 并行上限；
4. 重试和补偿任务；
5. 收敛轮次；
6. 任务预算；
7. 合法停因；
8. 恢复与重放（**仅监督式模型下成立**，§1.4）。

迁移完成后，`go.md` 应退化为薄 Adapter，而不是继续保存第二套调度真源。

**存量项目迁移（本轮评审补入）**：调度真源从工作区资产迁入内核，会影响所有已在跑的项目（sustain-v3、carelink-admin 等）。**A19 已提供存量项目升级可达性通道（`vima upgrade` + 端册迁移 + 产物形态体检）**，本阶段的迁移步骤必须挂到 A19 的升级流程上，并明确：迁移期内 `go.md` 与内核谁是唯一执行真源、旧项目在未升级时的行为、升级失败的回退路径。原稿完全未涉及在途项目，是必须补齐的交付项。

### Phase 4：证据与策略收口

在 Phase 1 的分级基础上建立完整 Evidence Store（`H-M3` 第二步）和 Validation and Policy Module（`H-M5`），使 Builder/Verifier 报告、设计验收、收敛、认证和 hook 共享可信语义。

完成标志（**已按评审修订，原表述不可兑现**）：

- ~~Agent 不能仅靠修改 task 状态或写一个 `pass` 报告绕过闸门~~ ← 单靠 Store 做不到；
- **改为**：① 任何闸门放行都能列出所依赖的 `machine` Evidence 及其复现命令；② 状态迁移只能经 `H-M1`，Agent 直写 frontmatter 被确定性拒绝或标记；③ 仅有 `agent` Evidence 时闸门必须显式降级并在 A32 等级中扣分，不得静默通过。

### Phase 5：项目图与派生关系

建立 Project Graph（`H-M4`）与 Artifact Lineage（`H-M6`），为精准上下文、影响分析、新鲜度和增量重验提供共同 Implementation。

**排期理由**：二者是纯重构收益、不带来新能力，且形状受 `H-ADR-01` 影响。在前四个阶段完成前动它们，等于赌一次形状。

### Phase 6：第二个 Host 证明 Adapter Seam

在 Claude Implementation 可稳定运行后，实现 Codex Implementation。两者都完成同一个最小 Run 闭环后，再冻结 Host Adapter 的共同 Interface。

如果没有第二个可执行 Implementation，本阶段不得以「未来扩展」为理由提前建立复杂抽象。

### Phase 7：可观测与产品化

在已有可靠运行事实后，再提供：

- Run 状态与事件查询（在 Phase 2 的最小 `vima run status` 之上扩展）；
- 取消、恢复和重放入口；
- Agent、工具、文件和 Evidence 的执行轨迹；
- token、耗时和预算信息（仅在 Host 能可靠提供时）；
- Workflow/Role 能力包的发现、安装与升级；
- 面向 CI 和 IDE 的 Adapter。

可观测界面必须消费已经存在的运行事实，不能为了做界面再创建一套状态真源。

---

## 6. 明确不做

为防止「超强 Harness」演变成不可控的大平台，第一阶段明确不做：

- 不自己实现大模型推理循环；
- 不内置模型路由市场；
- 不先造通用插件生态；
- 不先上远程控制中心或分布式队列；
- 不把所有命令一次性重写；
- 不为了多 Host 宣称而创建只有 Claude 一个 Implementation 的 Adapter；
- 不让事件记录、指标或界面成为新的交付闸门，除非另行立项；
- 不用概率性 Agent 维护可由确定性代码维护的状态；
- **不新增第二个决策真源**（`docs/adr/`）或第二个术语真源（`CONTEXT.md`）——沿用登记册（本轮评审撤回项，§5 Phase 0）；
- **不自行分配 A# 编号**——遵 A35 D-A35-08，入册前只用自有前缀 `H`；
- **不在 `H-ADR-01` 裁定前启动垂直切片立项**，也不在裁定前把 §3 的架构图当作既定架构引用；
- **不在协作式模型下对外宣称 Run 生命周期能力**（租约、崩溃恢复、取消、重放）。

---

## 7. 成功判据

当以下问题都能由 vima 本身而不是聊天上下文回答时，才可称为完整 Harness。

**「控制模型」列标注该判据在协作式模型下是否可达（§1.4）——裁定为协作式时，标 ✗ 的三条必须从判据表中删除，而不是留着不做：**

| # | 判据 | 协作式下可达 |
|---|---|---|
| 1 | 现在运行的是哪一个 Run，输入和版本是什么？ | 部分（可有输入身份，无「正在运行」） |
| 2 | 哪些任务可运行、由谁领取、租约是否仍有效？ | **✗**（无监督进程即无租约） |
| 3 | 某任务为什么重试、阻断或生成补偿任务？ | ✓ |
| 4 | Agent 中断后，vima 如何从磁盘事实恢复？ | **✗**（「中断」不可观测，§1.4） |
| 5 | 谁修改了什么文件，是否越过 Policy？ | ✓（hook + 收口双执行点，§4.5） |
| 6 | 某个通过结论依赖哪些 Evidence，其 Attestation 与新鲜度如何？ | ✓（Phase 1） |
| 7 | 用户能否取消、恢复或重放 Run？ | **✗** |
| 8 | 同一 Work Graph 能否在两个 Host Implementation 上执行？ | 不可验证（只能靠两套提示词各自遵守） |
| 9 | 去掉长篇 `/go` 提示后，调度复杂度是否仍由 vima 内核承担？ | ✓ |
| 10 | Agent 错写状态、漏写报告或重复提交时，Harness 是否能确定性发现并处理？ | 部分（「发现」可达；「实时处理」需监督式） |

> 第 6 条已按 §4.3 修订：原表述只问「是否 stale」，未问出具方式，会让一份新鲜的模型自述通过判据。

---

## 8. 首个立项建议

**本轮评审把首个立项拆成两个，原「单一垂直切片」建议不再成立**——因为它内含一个未裁定的前提（§1.4），且存在一个不依赖该前提、优先级更高的实现项（§4.3）。

### 立项 1（先行，无前置）：证据分级 Attestation

> **给 Evidence 增加 `machine | agent` 一等字段，闸门只认 `machine`，`agent` 降级留痕并挂 A32 等级阶梯。**

原因：

- 它堵的是当前最大的信任漏洞——schema 合法的模型自述与机器事实同权（§2.4）；
- 它**不依赖 `H-ADR-01`**，不会因控制模型裁定结果返工；
- 改动面小、可独立验收，且顺带修正 `design.mjs:640` 的错误归因；
- 它为之后每一个 Module 提供可信输入。

### 立项 2（须在 `H-ADR-01` 之后）：State Transition + Agent Run 的单任务垂直切片

> **`H-M1` + `H-M2` 的单任务 Builder → Verifier 垂直切片。**

原因：

- 它直接验证 vima 能否从「协议」跨到「Runtime」；
- 它能最早暴露 Run、状态、Evidence 与 Host 之间真正需要的 Seam；
- 它不会要求先重构全部命令；
- 它为后续 Evidence Store、Policy 和第二 Host 提供可运行基线；
- 如果该切片无法可靠恢复和审计，继续扩展更多 Agent 角色没有意义。

**前置条件（硬闸门）**：`H-ADR-01` 已裁定。若裁定为协作式，本立项的验收判据必须同步删除 §7 的第 2、4、7 条，并把交付叙述从「Runtime」收回到「守门人」。

两个立项的产物都应包括：领域词汇、必要 `H-ADR` 记录、行为规格、失败语义、迁移策略（含 A19 升级通道接线）和可执行验收测试。具体 Interface 与 schema 应在立项中基于真实切片确定，而不是在本战略提案中提前猜测。

---

## 9. 与现有文档的关系

| 文档 | 关系 | 本轮评审新增的裁定要求 |
|---|---|---|
| [`vima-cli-design-v2.md`](./vima-cli-design-v2.md) | 当前已实现设计基线；其 Claude-only 与「宪法体系」定位需要经 `H-ADR-02` 重开，不能由本提案静默覆盖 | —— |
| [`v2.1-amendments.md`](./v2.1-amendments.md) | 已立项增补项的正式规格 + **A# 命名空间与决策记录的唯一真源**；本提案尚未获得增补编号，遵 D-A35-08 使用自有前缀 `H` | 本文入册时申请 A 号；`H-ADR-##` 转写为 `D-A##-##` |
| [`internal-contracts.md`](../internal-contracts.md) | 当前实现契约；首个立项前不得直接写入不存在的 Run 契约 | Phase 1 的 attestation 字段须先改契约再改实现（项目纪律） |
| [`pact-vs-vima-generational-assessment.md`](./pact-vs-vima-generational-assessment.md) | **G4「Agent Adapter」（`adapters/claude-code/` + `adapters/codex/`）与本文 `H-M7` + Phase 6 是同一件事**，原稿未引用 | **`H-ADR-03` 必须裁定归并方向**：本文吸收 G4，或 G4 先立项而本文只引用。两处不得各自立项 |
| [`process-journal-proposal.md`](./process-journal-proposal.md) / **A35（已入册）** | A35「过程轨迹 `journal.jsonl`」**已在登记册立项**（append-only 事件流，内核出口 + post-write hook 双采集口），不再只是提案 | **`H-ADR-04` 必须裁定**：Run Ledger 直接落在 `journal.jsonl` 上（扩 run/event 字段），还是 A35 被本项吸收。原稿「目标不等价」的表述不足以避免返工——A35 先落地后 Phase 7 再起第二套事件流 schema，返工是确定的 |
| **A32 交付等级认证** | 提供现成的四级证据阶梯 | Phase 1 的 `agent` 降级直接挂 A32 等级，不新造评分机制 |
| **A19 存量项目升级可达性** | 提供现成的 `vima upgrade` 迁移通道 | Phase 3 的调度迁移必须挂到 A19 流程上（§5 Phase 3） |
| **A18 `apis` 责任田 / `guard-shared.mjs`** | 现有写入范围策略的两半（收口期 V-INT-03 + 写入期 sharedDirs 令牌） | `H-M5` 的首个验证用例；Phase 2 切片必须复用而非另起 |

本文件是战略方向与架构候选清单，不是代码已经具备相关能力的宣称。若后续立项，应在变更记录中明确：哪些旧设计决策被保留、哪些被替代、迁移期谁是唯一执行真源。

---

## 10. 修订记录

| 轮次 | 日期 | 主要变更 |
|---|---|---|
| 初稿 | 2026-08-14 | 提出 Harness 定位、6 项缺口诊断、7 个候选 Module、7 阶段路线图、10 条成功判据 |
| 第 1 轮评审收敛 | 2026-08-14 | ① 新增 §1.4 控制模型前置分叉（`H-ADR-01`），并据此标注 §7 判据在协作式下的可达性；② §4.3 增加证据分级 Attestation（`machine`/`agent`），并据此修订 Phase 4 不可兑现的完成标志；③ Phase 0 撤回 `docs/adr/` 与 `CONTEXT.md` 两个新真源，启用自有前缀 `H` 以遵 A35 D-A35-08；④ §9 补入 G4 与 A35 的重复立项裁定要求；⑤ Phase 2 切片补入三项必备件（派生方、既有范围策略接线、最小 `run status`）；⑥ Phase 3 补入 A19 存量项目迁移；⑦ `H-M4`/`H-M6` 压后至 Phase 5；⑧ §8 首个立项拆为两项；⑨ §1.3 补齐 Depth/Locality/Leverage/Interface/Implementation/Attestation/控制模型 等承重词定义；⑩ §2 全部量化断言换成实测值（`go.md` 316 行、`validate.mjs` 2,265 行、命令间 22 条导入边、`lib/commands` 9,030 行 vs `lib/model` 675 行、`saveLifecycle` 8 命令 11 处调用点、四消费者损坏语义表、`design.mjs:640` 错误归因） |
