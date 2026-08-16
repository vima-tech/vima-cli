# vima v4 重写版优化建议

> 日期：2026-08-16  
> 对象：`vima-v4-rewrite` worktree（`4.0.0-alpha.1`）  
> 性质：首发前架构与产品闭环建议，不是 v3 兼容规格

## 1. 结论

v4 的重写方向成立：它把 v3 的“任务状态 + Agent 自写验收报告”重构为
“命题 + 证据 + append-only 事件”，并以 CLI、MCP、Web 三个前端共享同一动作层。
来源可信度与验证强度分轴、规格真源与派生投影分离、代码事实集中提取、接缝测试，
都是实质性的架构提升。

但当前版本仍是一个**高质量的新内核原型**，尚不能视为对 v3 的完整产品升级：

- “验形”已有基本闭环，但失效传播和证据策略仍有关键可靠性缺口；
- “定形”已有词表、令牌和规则，但对真实生成质量的约束仍然偏弱；
- “供料”有注册表和样例业务块，却没有接入 CLI、MCP、`next` 或安装流程；
- v3 的脚手架、批次调度、变更事务、交付认证、视觉设计、升级迁移等成熟能力被删除，
  尚未逐项说明由什么替代；
- 当前没有 v3 → v4 升级路径，也不适合直接占用 npm `latest`。

首发目标不应是恢复 v3 的全部命令，而应先确保 v4 的核心承诺可信：

> 同一份规格重复执行不制造噪音；任何语义变化都会准确失效相关证据；
> AI 拿得到规则和资产；每一份“达标”都能证明与该命题相关；并行执行不会重复领题或丢事件。

### 1.1 先固定产品定位

当前设计同时包含两种产品身份：

1. **AI 交付控制面**：把 PRD/SDD 编译为可追溯命题，调度 Agent，实现后取证、失效、审计；
2. **AI 应用工厂**：提供风格系统、业务块、脚手架与设计资产，让 AI 直接产出更完整的应用。

两者有关联，但成熟度和投入量完全不同。如果不先定主次，v4 会在“极简可信内核”和
“全套应用生成平台”之间反复摆动：命令面不断收缩，产品承诺却不断扩大。

建议把 v4 的主定位定为：

> **可携带资产的 AI 交付控制面。** 核心负责规格编译、上下文供给、执行协调、独立取证、
> 变更失效与交付呈现；业务块和风格资产是可插拔供料层，不再把特定技术栈的完整脚手架视为内核。

这个定位意味着：

- `core/ops/front` 必须跨技术栈成立，是首发阻断面；
- `assets` 必须至少有一条真实消费链，否则“可携带资产”只是口号；
- v3 的 admin 全栈模板可以作为独立资产包或兼容发行物继续存在，不必重新塞回 core；
- `create/design/mock` 是否恢复取决于产品是否另建“应用工厂”发行面，不能模糊地宣称已被新模型替代；
- Web UI 是控制面的可观测前端，不承担业务应用设计器职责。

### 1.2 建议的目标架构

```text
原始物料 / PRD / SDD / ADR / 既有代码
                    │
                    ▼
           Source Adapter（保留原文锚点）
                    │
                    ▼
        Spec Compiler + Reconciler（干跑后提交）
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
   Claim Graph          Ruling / Risk Ledger
          │
          ▼
 Context Resolver（规则 + 词表 + token + block 切片）
          │
          ▼
 Scheduler / Lease / Worktree Executor
          │
          ▼
 Evidence Policy Runner（derived / executed / observed）
          │
          ▼
 Audit + Delivery Profile + Web / CI
          │
          ▼
 Harvest Candidate（人工批准后进入资产仓）
```

其中只有原始规格、项目配置、资产版本选择和事件流是持久真源；claim 状态、进度、失效清单、
交付等级和 Web 页面全部是可重建投影。

## 2. 当前优势，应当保留

以下部分不建议因补功能而重新做重：

1. **三概念模型**：claim、evidence、event 足以承载核心状态，不恢复独立任务状态机。
2. **双强度轴**：来源可信度 S 与验证强度 E 保持正交，不合并为单一完成状态。
3. **Markdown 真源**：`docs/` 继续作为人写、人审、可 diff 的规格真源。
4. **共享动作层**：CLI 与 MCP 只做参数适配和渲染，判据继续集中在 actions/ops/core。
5. **代码事实单一提取点**：所有代码扫描继续经 `core/extract.mjs`，不在规则或命令中复制正则。
6. **诚实呈现能力边界**：扫不到、没执行、未实现应继续与“检查通过”严格区分。
7. **接缝测试**：模板、规则投影、MCP、hook、README 与真实消费方之间的测试应继续作为硬门。
8. **零运行时依赖和确定性输出**：在不妨碍正确性的前提下继续保持。

## 3. P0：首发阻断项

### P0-1 修复命题修订与失效传播

#### 当前问题

`upsertClaim()` 每收到一条 claim 事件都会增加 `revision` 并刷新 `lastTouched`，即使规格内容完全没变。
下游失效又以“上游 revision > 1 且证据早于 lastTouched”为条件，因此重复执行一次未变化的
`vima compile`，也可能把下游误判为 stale。

反方向上，当前语义变化判断只比较 `statement`、`need`、`from`，以下变化不会清除旧证据：

- `impl` 端点或实现落点；
- `trust`；
- `source`；
- `layer`；
- 后续新增的其它有验证意义的命题字段。

这会同时产生两种错误：**没改却失效**和**改了却不失效**。

此外，compile 当前只有 upsert，没有 reconciliation：

- 从 `docs/` 删除一条命题后，旧命题仍永久留在事件投影中；
- 重命名 ID 会表现成“新增一条”，旧 ID 不会退休；
- 一个规格文件移出编译范围后，它曾生成的命题仍继续参与进度和 audit；
- compile 逐批写事件，中途出现拒绝时会留下部分新状态，却没有 compilation ID 说明它属于一次未完全成功的编译。

因此 v4 需要解决的不只是“内容变化”，而是完整的**声明集对账**。

#### 建议方案

不要用一个 hash 同时处理所有变化。S/E 两轴既然正交，命题也应至少拆成三个指纹：

```text
definitionHash = hash({ layer, statement, from, impl })
provenanceHash = hash({ trust, source })
policyHash     = hash({ need, evidencePolicyId })
```

三类变化的处置不同：

| 变化 | 本命题旧证据 | 下游证据 | 风险/交付状态 |
|---|---|---|---|
| `definitionHash` 变化 | 失效 | 沿 `from` 传播失效 | 必须重新取证 |
| `provenanceHash` 变化 | 实现证据可以保留 | 不因来源元数据机械清空 | 重算 S 轴、风险和交付资格 |
| `policyHash` 提高门槛 | 保留但可能不再达标 | 通常不传播定义失效 | 重新计算 meets |
| `policyHash` 降低门槛 | 保留 | 不传播 | 记录是谁、为什么降低，防止静默放水 |
| 纯背景散文变化 | 不变 | 不变 | 仅文档 diff |

这样可以避免“来源从 stated 改成 fact，已经执行过的测试却被无意义清空”，同时也不会把
“来源已 superseded”隐藏在一个仍然绿色的交付结论后面。

建议增加 reconcile 阶段：

1. 读取并完整解析全部规格，得到目标 claim set；
2. 与当前活动 claim set 比较，生成 `add/change/retire/noop` 计划；
3. 先校验所有引用、层序、重复 ID、证据策略和 retirement 影响；
4. 默认展示计划，或在一次 compile transaction 中提交全部事件；
5. 删除命题使用现有 `claim` 事件的 `op: retire`/`active:false` 表达，不必增加第五种事件；
6. 重命名默认是 retire + add；只有显式 `renames: old → new` 才迁移可迁移的引用，旧证据仍不得自动继承；
7. 每次提交写入稳定的 `compilationId/sourceDigest`，投影只采纳完整 transaction；
8. 相同目标集再次 compile 为 noop，不增加语义 revision。

其它实现纪律：

- 失效依据使用语义修订号/修订事件，不再使用任意 claim 写入时间；
- 数组是否排序必须按字段语义决定：集合字段排序，顺序有含义的字段保序；
- 将失效传播改为显式遍历依赖图，覆盖多层传播、菱形依赖和循环防御；
- retirement 是强变化：直接依赖已退休命题的活动命题进入 broken/stale，而不是把缺失上游当成已满足；
- append-only 保留历史，但 status/audit 默认只统计活动命题，历史视图可回看退休版本。

#### 验收标准

- 同一棵 `docs/` 连续 compile 两次，第二次 `written=0`，事件流与状态不发生语义变化；
- 只改背景散文，不失效任何命题；
- 修改 `statement/from/impl/layer` 会失效实现证据和相关下游；
- 修改 `trust/source` 只重算来源风险，不错误清空仍然有效的执行证据；
- 提高/降低 `need` 都按上表处理，降低门槛必须留下可审计理由；
- 上游真实变化后全部相关下游 stale，无关分支不 stale；
- 删除命题后它不再进入活动进度，其下游明确报 broken/stale；
- 重命名不会留下两个活动命题，也不会让旧证据未经取证转移到新 ID；
- 任一批次拒绝时，要么整次 compile 零写入，要么投影明确标记并忽略不完整 transaction；
- 重新取证后 stale 清空；
- smoke 增加“compile → 取证 → 原样 compile → 状态仍达标”的真实 CLI 链路。

### P0-2 让证据与命题真正绑定

#### 当前问题

默认 `submit` 使用 `derived`，而 derived 当前只验证代码中是否存在
`@vima <claimId>`。这只能证明命题 ID 被写进文件，不能证明实现存在或正确。

`executed` 只验证某条命令退出码为 0，但命令由调用方选择；无关测试、空过滤器甚至恒成功命令
都可能获得 executed 证据。MCP 禁止 Agent 自选命令是正确方向，但默认 derived 又使
`need: executed` 的命题无法通过 MCP 自主完成。

#### 建议方案

把“如何取证”从交活时临时输入，前移到规格或受管策略中：

```yaml
evidence:
  policy: test/login-contract@1
  mode: executed
  command: [npm, test, --, tests/login.test.ts]
  observes:
    - contract-login
  expects:
    testsMin: 3
    report: .vima/evidence/junit/login.xml
  fingerprintInputs:
    - apps/web/src/features/login/**
    - tests/login.test.ts
```

证据策略本身应当是可 review、可版本化的资产。claim 只引用 `policy id + version`，避免每条命题复制
一份命令。项目可以覆盖策略，但覆盖必须产生 ruling，并在 Web/CI 中显示“项目定制”。

四档证据应各有清楚、不可互相冒充的语义：

| 强度 | 最多能证明什么 | 正式证据的最低要求 |
|---|---|---|
| `claimed` | 某个 actor 陈述过什么 | note + actor；永不替代更高档 |
| `derived` | 静态产物中存在可机械推出的结构 | claim 落点匹配 + 提取器能力声明 + 输入指纹 |
| `executed` | 与 claim 绑定的可重放检查成功运行 | 受管 recipe + 非零检查量 + 结构化结果 + 输入指纹 |
| `observed` | 目标行为在指定环境中实际出现 | 环境身份 + 操作脚本 + 观察断言 + 原始制品 |

`executed` 不能只看 exit code。不同 recipe 应声明最低有效输出，例如测试数量、断言数量、构建产物、
JUnit/coverage/contract-test 报告路径；命令退出 0 但零测试、报告缺失或结果解析失败时，结论应为
“执行成功但未取到正式证据”。

证据有效性建议由四个值共同决定：

```text
evidenceKey = hash({
  claimDefinitionHash,
  policyId,
  policyVersion,
  inputDigest,
  environmentDigest
})
```

这样可以精确回答：是需求变了、测试策略变了、实现输入变了，还是运行环境变了。不要只以时间先后
判断证据是否过期。

建议原则：

- Agent/MCP 只能触发预登记证据策略，不能临时提供任意命令；
- CLI 可保留临时命令作为诊断，但临时命令证据标成 `ad-hoc`，默认不满足交付门槛；
- derived 至少校验标注文件是否落在 claim 的 `impl` 范围内；
- 对 contract claim，derived 应同时检查声明端点与提取到的路由/调用是否关联；
- executed 证据记录命令、工作目录、相关输入指纹、退出码和工具版本；
- executed 解析结构化结果，零测试和缺报告不能算正式证据；
- 输入指纹变化后，旧 executed 证据自动失效；
- `observed` 未实现期间，任何需要 observed 的命题都不得被声明为最高交付等级。

测试策略也需要“反向验证”：每个正式 policy 至少有一次 mutation/negative control，证明被测能力故意
破坏时该 policy 会失败。否则只能证明命令会绿，不能证明它会因目标能力出错而红。

#### 验收标准

- 仅新增一行 `@vima` 注释不能让存在 `impl` 约束的命题达标；
- `true`、`echo ok`、零用例过滤等命令不能满足正式 executed 策略；
- MCP 可以触发预登记 executed 策略，但不能修改命令；
- 测试文件或实现输入变化后旧证据失效；
- recipe 版本或运行环境发生实质变化后，证据状态明确变为 stale/needs-review；
- 每个首发正式 policy 都有通过和故意破坏后的失败用例；
- audit 能区分正式证据、临时诊断证据与尚未取证。

### P0-3 将资产仓接入生成主链路

#### 当前问题

`loadStyle()`、`listBlocks()`、`readBlock()` 已有实现和测试，但当前没有生产调用链：

- 没有 block/style 的 list、show、install 或 check 命令；
- MCP 没有读取资产的工具；
- `vima next` 只返回 theme 和 block ID，不返回词表、令牌或业务块内容；
- 项目需手改 `.vima/project.json` 登记 apps、blocks、theme；
- 当前唯一业务块的后端层仍是占位说明。

因此“供料”尚未真正发生。

#### 建议方案

先实现最小闭环，不急于扩充资产数量：

```text
vima asset list [--kind=block|theme|rule]
vima asset show <id>
vima asset add <id>
vima asset check
```

- `asset add` 原子更新项目配置，并记录安装事件；
- `next` 根据当前 claim 的 layer/side/app/block 返回裁剪后的资产内容，而不只是 ID；
- MCP 增加一个统一的 `asset` 只读工具，避免为每类资产增加独立工具；
- block 的 L1–L4 按命题层和端裁剪，控制上下文体积；
- `audit` 检查已登记 block 是否缺层、依赖是否满足、是否实际被任何 claim 消费；
- theme 安装后生成项目可消费的 token 投影，而不是只在配置里记录名字；
- 先把一个 `role-management` 块做成完整黄金链路，再扩大块库。

资产引用不能只存一个可漂移的名字。建议项目配置声明意图，另生成可提交的锁定投影：

```json
{
  "requested": "admin/role-management",
  "resolved": "admin/role-management@1.0.0",
  "digest": "sha256:...",
  "source": "builtin",
  "overrides": []
}
```

- `project.json` 保存“想用什么”，`assets.lock.json` 保存“实际用了哪一版”；
- `sync --check` 同时检查资产锁与派生投影漂移；
- 项目覆盖必须形成独立 overlay，不直接改安装包里的资产；
- `next` 返回每段上下文的来源、版本、digest 和命中原因；
- block 依赖形成可验证 DAG，缺能力、版本冲突和循环都在安装前拒绝；
- 资产升级走 plan/check/apply 三步，禁止静默替换已用于取证的块内容。

Context Resolver 应形成单一接口，例如：

```text
resolveContext(claimId) → {
  required,       // 必须注入的短规则与契约
  available,      // 可按需读取的块/词表引用
  sources,        // 每项来源、版本、digest
  bytes,
  uncoveredDims   // 声明了维度但没有资产覆盖
}
```

CLI、MCP、Builder 和 Web 均消费这个结果，不能分别拼上下文。

#### 验收标准

- 新项目能通过 CLI/MCP 发现、安装并读取业务块；
- 安装 block 后 `vima next --json` 能看到与当前命题相关的真实 L 层内容；
- 删除或改坏块层文件后 `asset check/audit` 跑红；
- 未被任何命题消费的已安装块可见，不静默计为已复用；
- 同一 lock 在不同机器上解析到字节一致的资产；
- 资产升级前能列出受影响 claim，升级后相关证据准确失效；
- CLI 与 MCP 对同一 claim 得到相同的 context digest；
- 从安装块到生成代码、取证、audit 至少有一条端到端 smoke。

### P0-4 补齐并行领题、事件合并与调度语义

#### 当前问题

Builder 使用独立 worktree，但：

- 每个 Builder 都从 `vima next` 取第一条 pending claim；
- claim 只是 run 事件，不构成租约；
- `next` 不排除已被其它执行者认领的 claim；
- 不同 worktree 的 `.vima/events.jsonl` 各自分叉，缺少合并规则；
- 当前架构又明确不支持多人多会话协作。

结果可能是多个 Builder 重复实现同一 claim，或者合并代码时丢失/冲突事件。

#### 建议方案

并行场景必须先拆开当前被“项目根”混在一起的三个概念：

| 根 | 用途 | 是否共享 |
|---|---|---|
| `stateRoot` | 规格、项目配置、已提交事件和 claim 投影 | 同一批 Builder 共享只读基线 |
| `codeRoot` | 当前 Builder 实际修改和取证的 worktree | 每个 Builder 独立 |
| `coordRoot` | lease、心跳、outbox、批次状态 | 同一调度器共享，不进入产品真源 |

若仍用一个 `root` 同时解释三者，worktree 隔离越成功，事件与状态分叉就越严重。

推荐采用“**父协调器 + 子 outbox**”而不是让多个 worktree 并发 append 一个热文件：

1. 父协调器从共享 stateRoot 计算 ready claim set；
2. 以原子 `create-if-absent` 在 coordRoot 建 lease；
3. 父协调器把明确 claim ID、state digest、context digest 传给 Builder；
4. Builder 不再自行 `next` 选题，只对指定 claim 执行；
5. Builder 在 codeRoot 取证，但把 run/evidence 草稿写入自己的 outbox；
6. 父协调器验证 outbox 的 state digest、claim ID、证据输入和代码合并结果；
7. 代码合并成功后，父协调器才把 outbox 事件导入主事件流；
8. 代码未合并或发生冲突时，证据保持 pending，不得进入主投影制造假绿。

事件草稿建议至少携带：

```text
streamId      // 哪个执行流
seq           // 流内严格递增
causedBy      // assignment/claim/run 的事件 id
stateDigest   // 开工时看到的命题图版本
contextDigest // 实际收到的上下文版本
codeDigest    // 取证对应的代码状态
```

全局展示顺序可以用 `ts + streamId + seq` 稳定排序，但因果判断只能依赖 `causedBy/stateDigest`，
不能依赖不同机器的墙钟先后。

其它调度规则：

- 增加 claim lease：`claimId/actor/worktree/claimedAt/expiresAt/stateDigest`；
- `next` 默认排除未过期租约，显式 `--include-claimed` 才显示；
- 为并行批次增加确定性选择函数：按依赖、落点交集、app、共享配置、证据策略分组；
- `impl` 未声明落点的 claim 默认串行，不能因为“看不见冲突”就当作无冲突；
- lease 只是运行态协调，不是需求或完成真源；最终历史由 assignment/run/evidence 事件重建；
- lease 超时、Agent 异常退出、worktree 被删除都必须可恢复；
- 第一版只支持**单协调器、多 Builder**，不要同时宣称多人多协调器。

#### 验收标准

- 同时请求 N 次 `next` 不会得到同一个可执行 claim；
- Builder 收到的 claim ID 与其修改落点、submit 对象一致；
- 两个 worktree 同时完成后，代码和事件都能无损合并；
- 代码合并失败时，对应 evidence 不进入主投影；
- Builder 基于旧 state/context 完成时，导入阶段明确拒绝或要求重新取证；
- 人为制造相同时间戳、跨机器时钟倒退不破坏因果顺序；
- 执行者崩溃后租约可过期并重新派发；
- 依赖未达标、落点未知或落点冲突的 claim 不进入同一并行批次；
- 100 轮双 Builder 压测中无重复领题、无丢事件、无交织坏行。

### P0-5 完成二次裁决闭环

#### 当前问题

Web 会生成新的 `vima rule` 命令，但 CLI 不能写 `overriddenBy`，因此旧 ruling 永远显示未复核；
新 ruling 也不会自动修订相关命题或触发失效传播。

#### 建议方案

提供明确动作，而不是依赖 rationale 文本匹配：

```text
vima rule override <rulingId>
  --chosen=...
  --confidence=...
  --blast=...
  [--subject=<claimId>]
```

- 新 ruling 事件携带 `overrides:<oldId>`；
- 投影将旧 ruling 标为 `overriddenBy:<newId>`；
- 若裁决关联命题，override 必须生成对应命题修订事件；
- 命题修订走同一语义哈希和失效传播，不另造回滚机制；
- Web 只生成命令仍可保持只读，但命令执行后状态必须闭环。

#### 验收标准

- override 后旧裁定从“未复核”变为“已复核”；
- 新旧裁定可双向追溯；
- 被改判命题及相关下游准确失效；
- 对不存在、已覆盖或无 subject 的 ruling 有明确处置；
- SessionStart/UserPromptSubmit 不再重复注入已复核裁定。

### P0-6 恢复需求基线的可追溯性

#### 当前问题

`ARCHITECTURE.md` 声称 R1–R11 与 C1–C4 都定义在该文件，但实际没有这些条目的正文。
代码和模板中的“反查 R2/R5/C1”因而无法完成真正反查。

#### 建议方案

在 `ARCHITECTURE.md` 增加精简但完整的需求基线：

- 每条 R/C 包含：陈述、动机、验收结果、明确不做；
- 模块与命令只引用稳定 ID，不在注释里重复需求全文；
- 增加脚本检查所有 `R#`、`C#`、`AR-#` 引用都存在；
- 已接受风险单列台账，至少登记 observed 缺失、多人协作缺失、业务块兼容缺失；
- 需求发生改判时追加决策记录，不悄悄修改历史理由。

#### 验收标准

- 全仓不存在悬空 R/C/AR 引用；
- 每个生产模块至少能反查到一个真实需求；
- README、ARCHITECTURE、CHANGELOG 的能力声明与实现双向对齐；
- CI 对删掉需求定义、拼错引用、实现无出处均会失败。

### P0-7 让 PRD/SDD 编译保持无损来源链

#### 当前问题

当前 markdown 编译格式要求 AI 把原始材料重新整理成一组短命题。这个方向有利于执行，但也存在一个
新的风险：整理过程可能丢掉限定条件、例外、表格字段、非功能要求和原文语气，随后结构化命题反而
成为一份“看起来更清楚但内容已经缩水”的新真源。

如果 source 只保存 `docs/raw/x.md` 这样的路径，后续无法回答：

- 命题具体来自文件的哪一段；
- 原文那一段现在是否变化；
- 一个表格行被拆成哪些 claim；
- AI 合并两段材料时省略了什么；
- SDD 中接口字段、时序和错误分支是否完整进入 contract claim。

#### 建议方案

把 intake 明确拆成 Source Adapter 和 Spec Compiler 两步：

```text
Source Adapter: 原始格式 → 带稳定锚点的 source units
Spec Compiler:  source units → claim drafts + coverage report
```

每条命题至少保留结构化来源：

```yaml
sources:
  - uri: docs/raw/login-prd.md
    anchor: prd-login#failure-policy
    digest: sha256:...
    quoteDigest: sha256:...
    relation: derives-from
```

规则：

- `anchor` 优先使用显式 ID/标题/表格主键，不把易漂移的行号作为唯一身份；
- `quoteDigest` 只保存摘录指纹，不在事件日志复制大段原文；
- 一个 claim 可以来自多个 source unit，但每个关系要区分 derives-from、constrains、conflicts-with；
- AI 自己补出的内容没有 source unit，只能走 ruling，不能伪装成 PRD 来源；
- 编译必须输出 coverage：哪些 source unit 已映射、部分映射、冲突、明确忽略；
- 非功能需求、约束、例外、字段表和时序图使用专门 adapter，不全部压成普通列表句；
- source digest 变化时先给出 impact plan，再由 reconcile 决定哪些 claim 需要修订；
- 原始 PRD/SDD 仍是外部输入真源，vima 规格是可执行真源，两者通过映射关联，而不是互相取代。

首发不必支持所有格式。建议只做 Markdown PRD/SDD profile，但把 adapter 接口冻结，避免未来为 PDF、
OpenAPI、数据库 schema、设计稿重新发明来源模型。

#### 验收标准

- 任意 claim 可反查到稳定原文锚点和 source digest；
- 删除或修改原文锚点后，compile 明确报告受影响 claim，不静默沿用旧来源；
- 一份 PRD 的 source coverage 能达到 100% 分类：mapped/partial/conflict/ignored，不允许 unclassified；
- 表格字段、错误分支、非功能约束有否定用例，故意漏一项时 coverage 会跑红；
- AI 新增的推断全部出现在 ruling 台账；
- 相同 PRD/SDD 和相同 adapter 版本产生相同 claim draft 与 coverage report。

### P0-8 校准“Agent 不能写事件”的威胁模型

#### 当前问题

“Agent 不能写事件，只能触发事件”目前是接口设计，不是物理安全边界。拥有 Write/Bash 的 Agent 仍可：

- 直接修改或重写 `.vima/events.jsonl`；
- 调 CLI 并自报 `--actor`；
- 选择无关但恒成功的 executed 命令；
- 修改证据策略、测试或 `.vima/project.json` 后再取证；
- 删除失败事件或把事件日志恢复到旧版本。

这不否定当前设计的价值：MCP submit 不接收“我完成了”已经消除最直接的自述通道。但产品文案必须
区分“官方写入口不采信 Agent 结论”与“Agent 在物理上无法篡改账本”。当前只能可靠宣称前者。

#### 建议方案

先固定威胁等级：

| 等级 | 对手模型 | v4 应承诺什么 |
|---|---|---|
| T0 意外 | 工具崩溃、半写、坏行、时钟偏差 | 能检测、容错、恢复，不静默假绿 |
| T1 合作但会偷懒 | Agent 会绕步骤、选最省事路径、错误自述 | 官方 API 不采信自述；正式证据策略不可临时放水 |
| T2 主动篡改 | Agent 故意改账、伪造身份或证据 | 当前不承诺；若要承诺必须隔离写权限和身份 |

v4 alpha 建议明确承诺 T0 + T1，不宣称 T2。对应措施：

- README 将“Agent 不能写事件”改成“Agent 不能通过正式接口提交证据结论”；
- 事件写入前做 schema 校验，读出时校验 hash chain/stream sequence，检测意外改写；
- actor 拆成 `channel`（cli/mcp/hook）、`reportedActor` 与可验证的 `sessionId`，不把字符串当身份认证；
- evidence 记录 policy 与输入 digest，策略/测试/实现同轮被修改时明确标记 self-authored；
- verifier 使用独立只读执行环境，正式证据不由 Builder 同一身份签发；
- audit 显示 ledger integrity、actor assurance 和 evidence independence，不用一个绿色徽标概括。

若未来要支持 T2，应把事件服务放到工作区外，由独立进程持有写权限和签名密钥；仓库内只存签名事件
或定期快照。不要在同一可写目录里加一个普通 hash 后就宣称防篡改——Agent 同样能重算 hash。

#### 验收标准

- 文档、CLI、MCP、Web 对威胁边界使用同一措辞；
- 直接改写、删行、重排、重复事件时 integrity 状态可见；
- `--actor` 只作为 reported metadata，不被展示为已认证身份；
- Builder 同轮修改测试并用其取证时，证据标明非独立或要求 verifier 重跑；
- 在 T2 未实现前，任何界面都不出现 tamper-proof、不可伪造等宣称。

### P0-9 分离“命题图”和“执行工作项”

#### 当前问题

当前 `next()` 把所有未达标 claim 按 intent → behavior 层序当成待办，并要求上游 claim 全部 meets
后下游才优先。Builder 又被定义为“一次实现一条命题”。这把两个不同概念重新混在了一起：

- claim 是一句可判真假的陈述；
- work item 是某个执行者这次应做的动作。

intent 并不天然是编码任务。例如“降低登录失败率”可能只有上线后的 observed 数据才能达标；若要求它
先 meets 才允许做 spec/contract/impl，项目永远无法开始。反过来，让 Builder 在代码里写一行
`@vima intent-x` 使 intent 达标，又失去了该层存在的意义。

同时，`from` 表示“这条命题由什么推导而来”，不等于“执行时必须先完成什么”。把推导边直接当调度
依赖，会让来源追溯和执行顺序彼此污染。

#### 建议方案

保留 claim 作为唯一产品陈述，但增加**派生、可丢弃的 work item 投影**，不恢复 v3 的第二套任务真源：

```text
Claim       说什么为真，长期存在，挂来源与证据
Work Item   下一次做什么，由 claim 图、证据缺口、策略和落点实时生成
Lease       谁正在做，短期运行态
```

边类型至少分开：

| 边 | 含义 | 是否参与调度阻塞 |
|---|---|---|
| `derivesFrom` | 下游陈述来自哪些上游陈述 | 否；用于追溯和变更影响 |
| `dependsOn` | 这个执行动作必须等待什么 | 是 |
| `implements` | impl/文件/符号兑现哪些 spec/contract | 用于生成 build item |
| `verifies` | policy/evidence 验证哪些 claim | 用于生成 verify item |

`next` 应显式区分工作队列，而不是返回一个含糊的“下一条命题”：

```text
vima next --lane=decide   # 待裁定/待人审来源
vima next --lane=spec     # 规格缺口或 source coverage 缺口
vima next --lane=build    # 可编码 work item
vima next --lane=verify   # 待正式取证项
vima next --lane=repair   # stale/broken/closure 缺口
```

MCP 可以仍保留一个 `next` 工具，但响应必须带 `lane/workItemId/claims/action/exitCriteria`。Builder 只接
build/repair，Verifier 只接 verify；intake 处理 decide/spec。一个 work item 可以兑现多个 claim，
一个 claim 也可以需要多个 work item，不强行一一对应。

层与典型证据也应形成默认矩阵，而不是所有层默认 `need: derived`：

| 层 | 典型命题 | 常见证据 | 是否直接成为 build item |
|---|---|---|---|
| intent | 目标、成功指标 | 来源确认；最终可能需业务数据 observed | 否 |
| spec | 用户可见行为 | executable example / acceptance test / observed | 通常否，派生实现项 |
| contract | 接口、字段、错误码 | schema/closure derived + contract test executed | 可派生 |
| impl | 文件、符号、实现责任 | extract derived + unit/build executed | 是 |
| behavior | 运行时真实表现 | integration executed / observed | 否，进入 verify |

来源可信度决定命题是否可作为派生输入，验证强度决定它本身是否已被证实；这两个判断都不应被简化成
一个 `meets()` 决定所有调度。

#### 验收标准

- 空项目从 intent/spec 开始时能生成 intake/spec 工作项，不要求先写代码标注；
- 未 observed 的长期业务 intent 不阻塞相关实现开工，但交付页如实显示结果尚未观测；
- `derivesFrom` 上游变化会产生 repair/impact，不被误当成普通执行依赖；
- Builder 永远不会收到纯 intent 裁定或纯 observed 验证任务；
- 一个跨前后端行为可生成多个 build item，并由同一 verify item 汇总取证；
- work item 可完全从真源和事件重建，不引入需要手工同步的任务状态文件；
- CLI/MCP/Web 对同一时刻的 lane 和 work item 口径一致。

## 4. P1：形成可用产品闭环

### P1-1 建立 v3 能力迁移矩阵

不要按旧命令名逐一恢复，而要按用户能力回答“保留、替代、放弃”：

| v3 能力 | v4 决策建议 |
|---|---|
| `create` 脚手架 | 与资产安装统一，至少保留一个黄金项目起盘链路 |
| `plan/go` 批次执行 | 用 claim graph + lease + worktree scheduler 替代 |
| `validate/trace/converge` | 收敛到 audit，但必须列出规则覆盖映射 |
| `approve/certify` | 用证据门槛和 delivery profile 替代 |
| `change` | 用语义修订 + 失效传播替代，补变更范围视图 |
| `retro` | 用事件回放 + harvest 替代，补结构化提名出口 |
| `design/mock` | 不能只删除；要么接入设计资产与 observed，要么明确 v4 不负责视觉交付 |
| `doctor` | 保留环境/安装/投影可达性体检，不能全部交给 audit |
| `update/upgrade` | 区分 CLI 自升级、项目资产升级和 v3→v4 迁移 |

每项必须有真实用户路径和验收测试，不能只写“由新模型自然覆盖”。

### P1-2 增加交付等级，而不是用单一 audit 绿灯代表一切

建议定义少量、连续的 delivery profile：

1. `specified`：目标范围的 source coverage 完整，命题链无悬空来源、冲突均有 ruling；
2. `implemented`：目标范围的 impl 命题达到正式 derived/executed 门槛，无野生实现；
3. `integrated`：contract 闭合、正式集成策略通过、无 broken/stale；
4. `observed`：声明为关键路径的 behavior 经过真实运行或浏览器采集。

高等级必须包含低等级，`observed` 未实现时如实停在 `integrated`，不要宣称 deployable/stable。

交付等级必须是纯投影，不写回一个可漂移的 `deliveryLevel` 状态字段。profile 自身应声明：

```yaml
id: integrated
scope: release
requires:
  sourceCoverage: complete
  claims: [intent, spec, contract, impl]
  minEvidence:
    impl: derived
    contract: executed
  closureErrors: 0
  stale: 0
```

禁止使用“90% 达标所以整体通过”的平均数掩盖关键缺口。profile 应支持 `critical:true` claim：
任何关键命题不达标都阻断对应等级；非关键命题允许以明确 waiver/ruling 处理。`not-applicable` 必须
有可审计理由，不能用空集合自动通过。

等级旁边还应显示来源风险，例如 `integrated · 3 ruled · 1 superseded`。E 轴达到 integrated
不代表 S 轴没有风险。

### P1-3 区分 audit 与 doctor

- `audit`：项目是否符合规格、证据是否达标；
- `doctor`：工具是否安装正确、hook 是否真的触发、MCP/规则投影是否可达、版本是否兼容。

v3 已经证明“资产文件存在”不等于“会话里生效”。v4 不应因命令面追求极简而再次丢掉这层诊断。

### P1-4 配置写入必须有受管入口

当前 adopt/reskin 规程要求 Agent 手改 `.vima/project.json`。建议提供：

```text
vima app add/list/remove
vima theme set/show
vima block add/list/remove
```

这些动作应验证 schema、使用原子写、记录事件并自动 `sync`。项目配置可以是人工可读真源，
但不应要求 Agent 手工维护所有一致性关系。

### P1-5 建立至少一个真实项目基准

单元测试证明实现符合设计，不能证明设计能有效改善 AI 生成结果。建议选一个 v3 已跑过的真实项目，
使用同一份需求分别运行：

- 直接 PRD/SDD → AI；
- v3；
- v4。

三组必须固定模型版本、权限、运行环境、初始代码、需求版本和最大预算；评测者不能参与实现，
并在揭盲前按同一缺陷清单评分。否则结果只是在比较不同提示、不同模型状态或不同人工投入。

记录以下指标：

- 首次可构建时间；
- 人工纠偏轮数；
- 需求覆盖率与错误漏报率；
- 重复页面/接口的一致性；
- 变更后一致收敛时间；
- token、墙钟、并行加速比；
- 资产复用比例；
- 假绿数量；
- 人为维护 vima 元数据的成本。

建议预埋同一组缺陷变异：缺接口、错字段、空测试、未授权端点、视觉退化、需求变更后漏传播。
比较三组能发现多少、误报多少、修复多少。框架价值应主要体现为更低假绿率和更短变更收敛时间，
而不只是生成文件更多。

首轮至少重复 3 次，报告中同时给原始样本，不只给平均值。若 v4 的 token/人工维护成本增加，
必须用质量或变更效率收益抵消，不能把框架开销排除在统计之外。

只有这些数据才能证明 v4 不只是模型更漂亮，而是最终结果更好。

### P1-6 提供诚实的 v3 接管路径

不建议把 v3 的 task、lifecycle 和 Agent 报告直接转换成 v4 的高强度证据。安全迁移应是“接管”，
不是“继承绿灯”：

1. 保存 v3 真源与报告的只读快照及 digest；
2. 从 v3 spec/contract/task 反推 claim draft，并保留原文件锚点；
3. 来源通常标 `stated`，已明确废弃内容标 `superseded`；
4. v3 的 done/pass 只能导入为 `claimed` 或历史备注，不能自动成为 executed；
5. 从现有代码重新跑 extract，形成新的 derived 证据；
6. 输出“成功映射、部分映射、无法映射、冲突”四张清单；
7. 人确认范围后再提交 v4 事件流。

迁移工具必须支持 dry-run 和重复执行幂等。无法可靠映射的 v3 能力要明确留在 archive，不为追求
迁移率编造对应 claim。

## 5. P2：增强项

### P2-1 为 extract 设计可替换能力等级

保持单一入口，但允许逐步从 regex/file 升级为 AST/symbol/import graph。证据必须记录生成它时的
engine、granularity 和版本；提取器升级不应自动把旧证据冒充成新能力等级。

### P2-2 事件日志的工程化

- 定义事件 schema 版本和迁移策略；
- append 前做结构校验；
- 坏行既可容错读取，也应能定位、修复或隔离；
- 明确并发 append 的原子性边界；
- 为大日志提供快照/压缩，但快照只能是可重建投影；
- 成本统计区分“真实 0”和“未采集”。

### P2-3 资产生命周期

- block 版本与兼容范围；
- 项目覆盖与上游更新的三方比较；
- harvest 提名、人工批准、发布、废弃的状态流；
- 死规则、未消费块、整体覆盖 token 的反向清单；
- 资产质量由真实项目证据背书，而不是仅凭文档完整。

### P2-4 控制上下文成本

`next` 不应把所有规则和块全文一次性塞给 Agent。建议按 claim 维度裁剪，并在响应中同时给：

- 必须读的短摘要；
- 可按需读取的资产 ID；
- 为什么命中；
- 预计上下文字节数；
- 本次没有覆盖到的维度。

## 6. 与直接 PRD/SDD 生成的定位

vima 不应把自己定位成 PRD/SDD 的替代品。更准确的定位是：

> PRD/SDD 是设计输入，vima 是 AI 执行的控制面和证据面。

推荐主链：

```text
PRD / SDD
    ↓ 结构化编译
可追溯命题图
    ↓ 规则、词表、令牌、业务块供料
AI 分批实现
    ↓ 预登记策略取证
证据 / 失效传播 / 对账 / 交付等级
    ↓
事件回放与资产沉淀
```

框架相对直接生成的核心收益应当通过以下结果体现：

- 同一项目跨页面、跨批次保持一致；
- 任意实现能反查到需求来源；
- 需求变化后自动列出真正需要重做的范围；
- “做完”和“验过”在数据上明确分离；
- 重复业务能力不再从零生成；
- 长会话只拿当前任务需要的上下文；
- CI 能基于退出码和正式证据做机械判断。

对于一次性原型、小项目、高度创新或无资产可复用的场景，直接 PRD/SDD 生成仍可能更快。
vima 的固定成本只有在项目会持续变化、需要多代理协作、质量可追责或资产可复用时才值得。

## 7. v4 alpha 的明确边界

首个可发布 alpha 应主动收窄，避免一边补可信内核、一边重建 v3 全部应用工厂能力。

### 7.1 Alpha 必须包含

- Markdown PRD/SDD → source units → claim graph 的无损可追溯编译；
- claim add/change/retire 的幂等 reconcile；
- derivesFrom/dependsOn/implements/verifies 分边，以及可重建 work item lanes；
- 正式 derived/executed 证据策略和准确失效；
- CLI/MCP/Web 共用同一 action/context/evidence 判据；
- 单协调器下的多 Builder 领题与 outbox 导入；
- 至少一个完整业务块和一套 theme 的真实消费链；
- ruling override、audit、doctor、specified/implemented/integrated 投影；
- v3 接管 dry-run；
- T0/T1 威胁边界的诚实呈现。

### 7.2 Alpha 明确不包含

- 多人、多协调器、远程分布式调度；
- 防主动恶意篡改的 T2 安全承诺；
- PDF/图片/设计稿等多格式 source adapter；
- 通用 AST/import graph 全语言支持；
- 全行业业务块市场与跨大版本兼容；
- 完整 observed 浏览器采集；
- “deployable”“production-ready”“stable”等交付宣称；
- 自动把 v3 的 done/pass 升格成 v4 正式证据。

### 7.3 主要风险台账

| 风险 | 早期信号 | 缓解 | 接受条件 |
|---|---|---|---|
| 元数据成本超过收益 | Agent 花大量时间补 claim/impl/source | adapter 自动产草稿、按需字段、统计维护时间 | 元数据人工时间不超过总工程时间约 15% |
| 证据看似更硬但仍无关 | executed 全绿、变异后仍绿 | policy + report parser + mutation control | 关键 policy 变异检出率 100% |
| claim 粒度失控 | 数百条 claim 无人阅读 | 粒度准则、合并建议、关键命题标记 | 真实项目中每条 claim 有明确验证出口 |
| 资产导致同质化 | 页面一致但不适合业务 | 皮/骨/业务块分层，允许项目 overlay | 一致性提升且用户任务成功率不下降 |
| append-only 日志无限增长 | hook 变慢、每轮注入超时 | 分流、快照、增量投影 | P95 状态投影时间在目标阈值内 |
| worktree 证据与合并代码错位 | 子树绿、主干红 | codeDigest + 合并后重验 | 正式证据只对应已合并代码 digest |
| 极简命令面隐藏诊断能力 | 用户只能看到 INTERNAL/空白 | audit/doctor 分工、能力报告 | 关键故障均有确定性定位动作 |

上述百分比与性能阈值可在首轮基准后调整，但必须在正式对照实验开始前冻结，避免看到结果后移动门槛。

## 8. 建议实施顺序

### 8.1 编码前必须形成的 ADR

用户当前要求“先不修改代码”是正确顺序。以下是一旦落库就会影响大量数据和调用者的 one-way-door
决策，应先各写一份短 ADR，并配一个最小示例和被否方案：

| ADR | 必须裁定的问题 |
|---|---|
| ADR-V4-001 产品边界 | 控制面与应用工厂谁是主产品，v3 模板放在哪个发行面 |
| ADR-V4-002 真源与投影 | docs、project config、asset lock、events 各自拥有什么事实 |
| ADR-V4-003 Claim 修订 | 三类指纹、retire/rename、compile transaction 的精确定义 |
| ADR-V4-004 图边与工作项 | derivesFrom/dependsOn/implements/verifies，以及 lane 生成规则 |
| ADR-V4-005 证据策略 | 正式/ad-hoc、policy 版本、input/environment digest、independence |
| ADR-V4-006 并行根模型 | stateRoot/codeRoot/coordRoot、lease、outbox、导入时机 |
| ADR-V4-007 资产解析 | requested/resolved/lock/overlay/upgrade 的所有权 |
| ADR-V4-008 威胁模型 | T0/T1 承诺、T2 非目标、actor assurance 和账本完整性措辞 |
| ADR-V4-009 PRD/SDD 来源 | source unit、稳定 anchor、coverage 分类和 adapter 边界 |
| ADR-V4-010 交付等级 | profile 的作用域、critical/N/A/waiver 和连续性 |

每份 ADR 必须回答：选择、理由、被否方案、数据迁移、失败模式、可逆性和对应验收。ADR 未定前可以
继续做探索性 spike，但不应修改冻结接口或事件 schema。

### 8.2 依赖关系

| 工作包 | 依赖 | 解锁 |
|---|---|---|
| W0 需求基线与威胁模型 | 无 | 所有能力声明和验收口径 |
| W1 source adapter + claim reconcile | W0 | 幂等编译、删除/变更、迁移 |
| W2 typed edges + work item lanes | W0、W1 | 正确 next、角色分工、调度输入 |
| W3 evidence policy + digest | W0、W1、W2 | 可信 submit、delivery profile |
| W4 context/asset resolver | W0、W1、W2 | 真正供料、上下文预算 |
| W5 coordinator/lease/outbox | W1、W2、W3 | 多 Builder 并行 |
| W6 ruling override + delivery profile | W1、W2、W3 | 人审闭环、交付呈现 |
| W7 doctor + v3 adopt | W0、W1、W3 | 存量接管与安装诊断 |
| W8 真实项目基准 | W4、W5、W6、W7 | 发布决策 |

W0/W1 不能被并行实现细节绕过：如果 claim revision 和威胁承诺没有先冻结，后面的证据、资产、
调度都会各自发明一套版本与身份语义。

### 8.3 里程碑 M0：修复内核可信度

1. 补 R1–R11、C1–C4、AR 台账，冻结 T0/T1 威胁承诺；
2. source unit、三类指纹与 claim add/change/retire reconcile；
3. typed edges、work item lanes 与角色分工；
4. 幂等、事务化 compile 与拓扑失效传播；
5. 预登记证据策略、结构化结果和 evidence digest；
6. ruling override 闭环；
7. delivery profile 的纯投影口径。

**退出条件**：重复执行不制造状态变化，命题增删改均能准确投影和失效，正式证据与 claim/policy/input
digest 绑定，文档不再超出 T0/T1 能力宣称。

### 8.4 里程碑 M1：让“供料”真正发生

1. asset list/show/add/check；
2. `next`/MCP 返回按维度裁剪的资产；
3. 做透一个黄金业务块；
4. app/theme/block 配置命令；
5. block → 代码 → 取证 → audit 的端到端 smoke。

**退出条件**：AI 无需自行在安装包里找文件，也能消费规则、风格与业务块。

### 8.5 里程碑 M2：补执行与交付闭环

1. stateRoot/codeRoot/coordRoot 分离；
2. claim lease 与父协调器定向派题；
3. worktree outbox 验证和合并后事件导入；
4. 确定性批次调度；
5. doctor；
6. v3 能力迁移矩阵与 adopt dry-run 落地。

**退出条件**：多个 Builder 不重复领题，代码和事件均可合并，并能给出不夸大的交付等级。

### 8.6 里程碑 M3：真实项目验证

1. 同需求三组对照实验；
2. 记录质量、成本、耗时和假绿；
3. 根据结果删掉无收益机制；
4. 完成 v3→v4 迁移或明确长期并存策略；
5. 使用 `next` dist-tag 发布 alpha，验证后再考虑 `latest`。

**退出条件**：有真实数据证明 v4 相比直接 PRD/SDD 生成和 v3，在目标场景下带来净收益。

### 8.7 建议的量化放行门槛

首轮可采用以下门槛，项目开始实测前冻结：

| 维度 | Alpha 放行门槛 |
|---|---|
| 幂等 | 相同输入连续 compile/sync/audit 字节与状态一致，100% |
| 失效 | 预设增删改变异全部命中相关 claim，无关分支零误伤 |
| 证据 | 关键 policy 的 negative control/变异检出率 100% |
| 假绿 | 预埋 critical 缺陷零假绿；major 假绿显著少于直接生成基线 |
| 并行 | 100 轮双 Builder 无重复领题、无丢事件、无证据错绑 |
| 来源覆盖 | PRD/SDD source unit 100% 被分类，无 unclassified |
| 资产 | 至少一个 block 在两个独立项目真实复用并完成取证 |
| 性能 | 万级事件下 status/audit P95 阈值预先定义并达标 |
| 成本 | 元数据人工维护时间占总工程时间不高于约 15% |
| 迁移 | v3 dry-run 重复执行幂等，旧 pass 不被升格为正式证据 |
| 发布 | tarball 实装、CI、smoke、`next` dist-tag 全链真跑 |

“显著少于”应在基准计划中换成具体数值；在获得第一轮方差前不宜伪造一个过于精确的百分比。

## 9. 首发判断清单

以下条件全部满足前，不建议替换 v3 或占用 npm `latest`：

- [ ] compile 对未变化输入幂等；
- [ ] claim 新增、修改、删除、重命名均被 reconcile，且不留下幽灵活动命题；
- [ ] definition/provenance/policy 三类变化按矩阵精确处置；
- [ ] 推导边与执行依赖边分离，work item lanes 可从真源重建；
- [ ] PRD/SDD source coverage 无未分类片段；
- [ ] 正式 executed 证据不能由 Agent 临时指定任意命令；
- [ ] derived 不再等价于“有一行标注”；
- [ ] 关键 evidence policy 有 negative control/mutation 证明会跑红；
- [ ] 资产注册表至少有一条完整消费链；
- [ ] context resolver 在 CLI/MCP/Builder 间保持同一 digest；
- [ ] worktree 并行不会重复领题、丢事件或让未合并代码获得正式证据；
- [ ] 二次裁决能关闭旧 ruling 并触发失效；
- [ ] R/C/AR 引用无悬空；
- [ ] 产品文案只承诺已实现的 T0/T1 威胁边界；
- [ ] v3 核心能力均有保留、替代或放弃说明；
- [ ] v3 接管不会把旧 done/pass 自动升级为正式证据；
- [ ] 发布链路用 `next` dist-tag 真跑通过；
- [ ] 至少一个真实项目完成与直接 PRD/SDD 生成的对照评估。

## 10. 最终建议

继续保留 v4 的新内核，不回退到 v3 的多状态源和 Agent 自写验收报告；同时不要因为架构更简洁，
就把“删掉的能力”视为已经被新模型自然替代。

下一阶段应聚焦四个问题：

1. **来源是否无损**：PRD/SDD 的每个有效片段都能被映射、分类和反查；
2. **账是否可信**：幂等 reconcile、准确失效、证据与命题及代码 digest 绑定；
3. **料是否真的送到 AI 手里**：资产仓必须进入统一 context resolver，而非只存在于包内；
4. **流程是否能真实跑完**：父协调器、worktree outbox、裁决、交付和迁移形成闭环。

完成这四点后，v4 才会从“比 v3 更好的架构模型”，变成“比直接让 AI 读取 PRD/SDD 生成更可靠、
并且值得承担框架成本的工程系统”。
