# vima-cli 相对 PACT 的代际优势与补强评估

> 评估日期：2026-08-14
> 当前系统：`/home/renmk/projects/vima-cli`（包含当前工作树的 A20–A30 能力）
> 对照系统：`/home/renmk/projects/PACT`（已归档的 PACT 1.0）
> 评估目标：判断 vima-cli 作为 PACT 新一代产品是否已经形成明显领先优势，并识别 PACT 中仍值得继承的能力。

## 一、结论

在“可控、快速构建 admin 业务系统”这一核心目标上，vima-cli 已经明显领先 PACT：它把
PACT 的规格控制与追溯思想，推进成了包含业务骨架、结构化规划、确定性校验、并行施工、
跨任务收敛、前端保真验证和多端支持的完整建设流水线。

但 vima-cli 目前更像一个强大的“业务系统建设系统”，尚未完全成为覆盖需求变更、交付认证、
持续演进和商务交付的“业务系统全生命周期平台”。PACT 在冻结后变更治理、多需求包并存、
持续问题台账、交付成熟度、正式规格书和估算方法方面，仍有值得继承的设计。

因此，vima-cli 的代际关系可概括为：

- 在首次规划、开发和收口阶段，已经领先 PACT；
- 在维护期变更、部署与稳定性证据阶段，仍有明显补强空间；
- 若完成 `vima change`、`vima certify` 和业务闭环主视图三项能力，就能从“更适合 admin”
  升级为“全生命周期明显领先”。

## 二、两套系统的产品定位

### 2.1 PACT

PACT 的核心定位是规格与交付控制协议：

> 让规格可施工，让实现可追溯，让低层完成状态不能冒充高层交付。

其主要产物是单文件完备规格 `PACT.md`、执行图谱 `action-graph.json`、物料状态和生成的
`pact-book.html`。Agent 负责理解与编码，PACT 负责冻结目标、检查规格、驱动步骤和保存证据。

PACT 的优势主要集中在：

- 单个大需求的完整定义与冻结；
- R-ID、验收和代码标注的追溯；
- 需求变更协议；
- 多物料包并存；
- 估算与正式规格书；
- 从 implemented 到 stable 的交付成熟度理念。

其主要问题是：

- 规格和工序较重，依赖大量 Markdown 锚点、Skill 协议和 Shell 脚本；
- Starter 与完整业务系统适配没有真正打通，归档时仍标记为 partial/blocked；
- 执行图谱和部分状态主要依赖 Agent 回写；
- 缺少面向 admin 业务系统的字段级、页面级和跨任务集成控制；
- 平台治理采用较大范围的哈希绑定，产品变化后的传播与维护成本较高。

### 2.2 vima-cli

vima-cli 的核心定位是 AI 业务系统开发脚手架与确定性控制工具箱：

> 把自然语言需求转换成结构化规格、可执行任务和可验证实现，并用确定性工具减少 Agent 的概率性行为。

它不仅提供控制协议，还直接提供 admin 业务系统骨架、组件库、多端端册、规划模板、子代理角色、
写保护 hook、批次调度和收口工具。

相对 PACT，vima-cli 已从“规定 Agent 应该怎样工作”推进到“直接提供一条可运行的生产线”。

## 三、能力对比

| 维度 | vima-cli | PACT | 判断 |
|---|---|---|---|
| Admin 起盘速度 | 完整前后端底座、RBAC、组件库和多端骨架 | Starter 归档时仍为 partial，完整适配器 blocked | vima 明显领先 |
| 规格机器可执行性 | 结构化 YAML、字段级规则、跨文档引用校验 | 30 锚点大型 Markdown 规格 | vima 更精确、成本更低 |
| AI 上下文控制 | 按任务确定性切片任务、契约、页面、规则和组件文档 | PACT.md 或按 R-ID 生成知识页 | vima 更适合并行施工 |
| 批次调度 | 确定性拓扑分批、并行度、冲突与责任田 | action graph 取活 | vima 领先 |
| 独立验收 | Builder 与 Verifier 分离，报告落盘 | step impl/test 状态 + review 抽查 | vima 更系统化 |
| 跨任务收口 | `vima converge` 检查漏实现、重复实现、越界实现 | 以 graph/trace 完成度为主 | vima 明显领先 |
| 前端保真 | PDL、Design-First、mock、画廊、Kimi 冒烟、设计稿校准 | UI Adapter 与 Recipe，未打通完整业务系统 | vima 明显领先 |
| 多端业务系统 | 一后端 × admin-web/mp-native/h5-mobile | 平台层有能力路由，但 Starter 适配未完成 | vima 明显领先 |
| 维护期变更 | 有传播纪律，缺少独立变更对象和影响图 | `/pact-change` 六步事务与状态回退 | PACT 领先 |
| 多个大需求并存 | 一个全局 spec/tasks/lifecycle | `.pact/<slug>` 多物料包 | PACT 领先 |
| 待确认问题 | `pendingConfirm`，主要服务规划评审 | 持续问题台账，记录阻塞对象与临时策略 | PACT 领先 |
| 交付成熟度 | 构建、测试、收口后进入 MAINTAINING | implemented→stable 八级模型 | PACT 理念更完整 |
| 正式对外交付 | 审计视图、线框原型、覆盖矩阵 | 业务流水线主视图、正式可打印规格书 | PACT 略强 |
| 工期与报价 | 尚无正式能力 | 分层估算、缓冲、三条交付线 | PACT 独有 |
| Agent 通用性 | 内核平台中立，工作流主要面向 Claude Code | 标准 Skills，可适配多种 Agent | PACT 领先 |

## 四、vima-cli 已形成的代际优势

### 4.1 从“控制协议”升级为“可运行生产线”

PACT 主要规定规格、步骤和证据应该如何组织；vima-cli 则把这些规则接入了真实项目生成与开发流程：

1. `vima create` 生成可运行的前后端业务骨架；
2. `vima init` 安装项目宪法、生命周期、命令、角色和 hooks；
3. PLANNING 生成结构化 spec、契约和任务；
4. `validate/render/approve` 完成规划闸门；
5. `context/plan` 生成最小施工上下文和确定性批次；
6. `/go` 驱动 Builder 与独立 Verifier；
7. `trace/converge` 完成代码追溯与跨任务收敛；
8. pipeline 执行全量测试和代码审计；
9. mock、页面画廊、浏览器冒烟和设计稿校准补足前端事实验证。

PACT 中的 Starter Adapter 最终未打通，而 vima-cli 已把控制层和业务宿主真正连接起来。这是两代
产品之间最重要的实质差异。

### 4.2 从结构完整升级为业务语义可检查

PACT 擅长检查锚点、R-ID、验收覆盖和执行图谱。vima-cli 在此基础上进一步检查：

- 页面、菜单、角色、接口、规则和任务之间的引用闭环；
- 字段输入与输出的双向一致性；
- 导航参数与目标页取值域；
- 聚合 JSON 子协议；
- API 消费端授权；
- 前后端任务接口责任田；
- 非目标越界；
- 页面区块、弹窗和布局结构；
- 并行任务产生的漏实现、重复实现和越界实现。

这意味着 vima-cli 不只检查“规格是否写了”，还开始检查“业务系统是否按同一份意图组合起来”。

### 4.3 从单次开发控制升级为并行施工与收敛

PACT 的 action graph 能找出下一批可执行步骤，但并没有形成完整的多 Agent 施工治理。
vima-cli 已具备：

- shared/business/pipeline 分层；
- 同层任务批内并行；
- `conflictsWith` 与 API 责任田；
- 共享层写令牌；
- Builder/Verifier 隔离；
- 报告文件作为代理间通信介质；
- 跨任务 convergence 回修；
- 断点续跑和合法停点。

对几十个页面的 admin 项目而言，这比 PACT 的通用 action graph 更贴近真实交付效率问题。

### 4.4 从功能正确升级为前端保真闭环

PACT 有独立 UI 产品和 Recipe，但完整业务系统适配没有形成闭环。vima-cli 已把前端质量拆成多层：

- 结构化 PDL；
- Stage A 版面语言；
- Stage B 页面视觉稿；
- 组件和版面机检；
- 契约 mock 与多数据档；
- Kimi WebBridge 默认浏览器冒烟；
- 设计稿末轮校准。

这是 vima-cli 相对 PACT 最容易被用户直接感知的领先优势。

## 五、PACT 仍值得继承的能力

### 5.1 冻结后的变更事务

PACT 的 `/pact-change` 不允许绕过规格直接改代码，而是完成：

1. 变更分类；
2. 需求和验收同步；
3. 契约同步；
4. changelog；
5. 已完成步骤回退；
6. 执行图谱更新；
7. 必要时重跑冷读门；
8. 输出影响面和工期影响。

vima-cli 已规定维护期必须先改 spec/契约再改代码，但目前仍是自然语言工作协议，没有机器管理的
“变更对象”，也无法确定性回答：

- 哪些页面、接口、规则和任务受影响；
- 哪些 done 任务应该重新打开；
- 哪些验证必须重跑；
- 本次变更是否已经完整传播；
- 变更前后差异和用户批准记录在哪里。

这是当前最值得优先补强的 PACT 能力。

### 5.2 多需求包并存

PACT 用 `.pact/<slug>` 隔离多个大型需求，适合交付后继续增加导出中心、审批流等独立需求。
vima-cli 当前只有一套全局 spec、tasks 和 lifecycle。随着项目长期演进，存在以下风险：

- tasks 目录持续膨胀；
- 新旧需求的开发状态混在一起；
- 一个维护需求难以独立冻结、批准和回滚；
- 无法同时管理多个处于不同阶段的变更。

vima 不应复制多份完整 spec，更适合引入“全局真源上的增量 change package”。

### 5.3 持续问题台账

PACT 的 `open-questions.md` 不只是记录问题，还要求每项声明：

- 卡住哪个 R-ID 或步骤；
- 当前临时策略；
- 问题状态；
- 答复后需要回填到哪个真源位置；
- 何时升级成真正阻塞。

vima 的 `pendingConfirm` 主要适用于 PLANNING 评审。第三方接口、现场数据、资质、部署环境等问题
可能横跨整个项目周期，需要成为 `plan/check/certify` 都能读取的持续状态。

### 5.4 交付成熟度证据

PACT 定义了八级完成状态：

```text
implemented
→ buildable
→ startable
→ integrated
→ business-closed-loop
→ accepted
→ deployable
→ stable
```

这个思想非常重要：写完代码、构建通过、能够启动、业务闭环、可以部署、稳定运行，是完全不同的
交付等级。

vima-cli 当前的 pipeline 已能证明 buildable、部分 startable/integrated 和业务流程冒烟，但
进入 `MAINTAINING` 不等于 deployable 或 stable。与此同时，模板自身也使用 `stable` 表示成熟度，
容易和生成项目的稳定等级发生语义混淆。

PACT 的不足是只实现了等级模型和证据聚合器，没有完整证据采集入口。vima 应当完成而不是照搬它。

### 5.5 面向业务方的业务流水线主视图

PACT 要求每条需求落入用户可到达的业务节点，并从 P4 生成业务流水线主视图。它能直观回答：

```text
用户从哪里进入
→ 做了什么
→ 系统发生什么状态变化
→ 谁能查询结果
→ 是否留下审计证据
```

vima 的审计视图、原型和覆盖矩阵分别擅长页面、交互和需求覆盖，但还缺少一张以端到端业务闭环为
中心的人类主视图。页面齐全不必然意味着业务链路闭环，这项能力值得吸收。

### 5.6 工期和商务交付能力

PACT 的估算方法包含需求分层、关键路径、串行比例、阻塞缓冲、开发完成线和对外交付线。
它的价值不在于公式一定准确，而在于禁止 Agent 随口给出单一工期数字。

vima 已经拥有比 PACT 更好的实证数据基础：

- 任务 DAG 与关键路径；
- Builder/Verifier 重试次数；
- convergence 冲突分布；
- sharedChangeRequest；
- 规则命中与豁免；
- `retro` 的项目复盘数据。

因此 vima 有机会从 PACT 的“方法论估算”升级成“历史证据驱动估算”。

### 5.7 Agent 工具适配

PACT 以标准 Skills 交付，可以服务 Claude Code、Codex、Cursor 等 Agent。vima 的确定性 CLI 本身
平台中立，但 commands、agents、hooks 和 settings 仍主要围绕 Claude Code 构建。

这不是当前 admin 交付目标的最高优先级，但如果 vima 要成为 PACT 的完整接替产品，最终应把：

- 生命周期语义；
- Builder/Verifier 角色；
- `/go` 调度协议；
- hook 能力；

抽象为 Agent Adapter，由 Claude Code、Codex 等适配层分别承接。

## 六、不应从 PACT 搬回的设计

吸收 PACT 的能力不等于恢复 PACT 的物料形态。以下设计不建议搬回：

### 6.1 巨型单文件规格和 30 锚点

vima 已有结构化 spec、独立契约、任务和多投影渲染。恢复巨型 `PACT.md` 会增加 token、冲突和维护成本，
也会削弱字段级校验能力。

### 6.2 第二套 action graph 状态

vima 的任务 frontmatter 已经是执行状态真源，`plan` 可从中确定性生成批次。再引入独立 action graph
会产生两套完成状态。应扩展现有 task/change 模型，而不是增加重复真源。

### 6.3 大量依赖 Agent 自觉执行的 Skill/Shell 工序

能由 CLI 确定性完成的变更影响、状态回退、证据聚合和漂移检查，都应进入 vima 内核。Skill 只负责
推理和操作编排，不应成为结构规则的唯一执行者。

### 6.4 大范围全树哈希锁

PACT 当前工作树中的 UI 变化导致平台治理哈希和迁移快照失锁，说明该机制能抓漂移，但传播成本较高。
vima 应使用：

- 狭窄、明确的真源哈希；
- 语义版本和 schemaVersion；
- 可确定性重建的生成物；
- 三方比较；
- 明确的 refresh/update 命令。

### 6.5 对所有需求强制完整仪式

小型文案修改、纯视觉调整和内部重构，不需要完整冷读、估算、正式成册和审批。能力应按变更等级触发，
否则控制系统会变成效率阻力。

## 七、建议的代际补强路线

### P0：形成完整的维护与交付闭环

#### A31：`vima change` 变更事务

建议命令：

```bash
vima change plan "设备列表增加批量删除"
vima change apply <changeId>
vima change check <changeId>
```

建议产物：

```text
.vima/changes/<changeId>/change.json
.vima/changes/<changeId>/impact.json
.vima/changes/<changeId>/validation.json
```

`change.json` 至少记录：

- 变更描述与类型；
- 受影响的 PAGE/API/RULE/FLOW/task；
- 变更前后真源哈希；
- 需要重新打开的任务；
- 必须重跑的检查；
- 用户批准状态；
- 当前阶段和完成状态。

验收目标：任何结构性维护需求都能确定性回答“影响了什么、传播完没有、还要重跑什么”。

#### A32：`vima certify` 交付等级认证

建议命令：

```bash
vima certify --profile admin
vima certify --profile admin --json
```

报告应列出当前最高等级、每项证据的命令/退出码/产物/快照哈希，并明确下一级缺什么。

模板字段与项目字段必须分离：

```json
{
  "templateMaturity": "stable",
  "deliveryLevel": "integrated"
}
```

验收目标：系统永远不能用“模板 stable”或“进入 MAINTAINING”冒充项目已经 deployable/stable。

#### A33：业务闭环主视图

从现有 `FLOW/PAGE/action/API/RULE/task` 确定性生成业务旅程视图，至少展示：

- 入口角色与入口页面；
- 用户动作；
- 调用接口；
- 状态变化；
- 后续查询或审计出口；
- 每一节点的验收与负责任务。

验收目标：每条核心流程都能证明“用户够得着、状态真的变、结果查得到、需要时有审计”。

### P1：让长期演进和项目经营优于 PACT

> **编号口径（2026-08-14 订正）**：本节提案原编为 A34–A37，与 `v2.1-amendments.md`
> 的**已立项**增补项编号撞车（登记册的 A34 是「视觉真源兑现机制」，与本文的
> 「持续问题台账」毫无关系）。现改为 **G1–G4**（G = 本评估的提案序号）。
> 规则：**A# 命名空间由 `v2.1-amendments.md` 登记册独占**，评估/提案类文档一律不得
> 自行占用 A# —— 提案在入册那一刻才由登记册分配 A 号。
> 对照：G1 = 原 A34、G2 = 原 A35、G3 = 原 A36、G4 = 原 A37。

#### G1：持续问题台账

增加 `.vima/questions.json`，字段包含：

- `id`；
- `question`；
- `blocks`；
- `temporaryStrategy`；
- `status`；
- `answer`；
- `writeBackTo`；
- `escalationReason`。

`validate/plan/check/certify` 按问题状态决定提示、阻断或降级交付等级。

#### G2：实证估算

`vima estimate` 使用当前 task graph 与历史 retro 数据输出：

- 工作量分层；
- 关键路径；
- 可并行宽度；
- 串行地基；
- 重试和收敛风险；
- 外部阻塞；
- 开发完成线；
- 对外交付线；
- 置信度与数据来源。

第一版没有足够历史数据时必须如实输出低置信度，禁止编造精确工期。

#### G3：多 change 并存

允许多个 `.vima/changes/<id>` 处于 planned/approved/developing/accepted 状态，主 spec 仍是唯一完整真源，
change package 只是冻结增量及其影响证据。合入时由确定性命令更新主真源并关闭 change。

### P2：扩大产品边界

#### G4：Agent Adapter

保持 `lib/` 的确定性内核不变，把 Agent 专属能力显式抽成：

```text
adapters/claude-code/
adapters/codex/
```

先统一生命周期、角色和报告协议，再处理各 Agent 的命令、hook 和权限差异。不要在内核里混入具体
Agent 语义。

## 八、建议的产品定位

PACT 的核心价值是：

> 让规格可施工，让实现可追溯。

vima-cli 新一代产品应形成更强的定位：

> 从自然语言到可运行、可验收、可增量变更、可证明交付等级的 admin 业务系统生产线。

其对外可感知的差异不应只是“命令更多”或“模板更全”，而应是以下五个承诺：

1. **更快**：完整业务底座、确定性上下文和并行施工；
2. **更准**：结构化规格、字段级机检和设计真源；
3. **更稳**：独立验收、跨任务收敛和真实浏览器证据；
4. **可持续改**：变更事务、影响图和增量 `/go`；
5. **可证明交付**：从 buildable 到 stable 的证据等级，而不是含混的“100% 完成”。

完成 P0 三项后，vima-cli 相对 PACT 的优势将不再只是“更快、更适合 admin”，而是覆盖首次建设、
维护变更和交付认证的完整代际升级。

## 九、验证记录与评估边界

本轮对两个仓库进行了只读检查：

- vima-cli 当前工作树全量测试：391/391 通过；
- PACT `pact-lint.sh --self-test`：全部变异自检通过；
- PACT 平台测试：28/34 通过，6 项失败来自当前未提交 UI 变化导致的治理哈希与迁移快照失锁。

PACT 的测试失败不能简单解释为旧系统质量差：工作树存在未提交的 UI 产品修改，而平台治理层正确
检测到了证据漂移。它同时说明两件事：证据绑定机制有效，但大范围哈希治理的维护传播成本确实较高。

本评估比较的是当前工作树能力，不代表已发布 npm 版本的逐项功能清单。后续若把 P0 三项与 G1–G4 正式立项，
应分别补入设计增补、内部契约、验收判据和实现落点，不以本文直接充当实现规格。
