# PACT 驱动的可控 AI 系统生成设计

> 状态：审核草案，未冻结，不可直接作为施工规格  
> 创建日期：2026-08-11  
> 更新日期：2026-08-11（加入 ClearWorks 失败复盘与独立交付门）  
> 适用范围：PACT、Vima UI Admin、Vima Starter 与未来项目 Adapter 的协作设计

## 文档目的

本文回答三个问题：

1. 如何把 PACT 从规格文档方法升级为 AI Agent 的生成控制协议；
2. 如何让 PACT 在需要时对接 `@vima-tech/ui-admin` 和 `vima-starter`；
3. 如何保证 Vima 能力是按交付形态选择的 Adapter，而不是 PACT 的强制依赖。

本文是供架构、产品和工程审核的完整设计草案。它覆盖 Product、Architecture、Contracts、Tests
四层，但尚未执行正式 PACT 的访谈、熔合、冷读和冻结工序，因此不能替代未来的
`.pact/<slug>/PACT.md`。

---

## 审核摘要

结论不是“把 PACT、UI 框架和脚手架合并成一个大 Skill 或 MCP”，而是建立以下分层：

```text
PACT Core                         通用规格与施工协议，不依赖 Vima
    │
    ▼
Capability Router                根据交付形态选择能力
    │
    ├── Generic Project Adapter  非 Vima、存量系统、库、CLI、服务
    ├── UI Admin Adapter         需要 Vue 3 政企后台 UI 时启用
    └── Vima Starter Adapter     确认是业务系统开发时才启用
             │
             ▼
      FullStack Generator        前端、后端、数据库、权限、测试
```

核心规则：

- PACT 是通用能力，任何项目都可以使用；
- `ui-admin` 是后台 UI 能力，不是所有 PACT 项目的默认依赖；
- `vima-starter` 是业务系统工程底座，只在需求分析确认交付物是业务系统时使用；
- Skill 和 MCP 都只是入口 Adapter，不能成为生成规则的唯一实现；
- AI 负责把自然语言变成受约束规格，规格到产物尽量由确定性 Module 完成。

ClearWorks 的只读复盘进一步证明：`PACT.md`、R-ID、action graph、代码标注和单测全部存在，仍可能
只得到“图谱内 100%”而不是可用系统。因此本设计新增一个**独立于项目自写图谱的 Delivery
Profile**，用它定义业务系统天然必须具备的装配、启动、迁移、API、权限、浏览器业务闭环和运维门。
项目 action graph 负责回答“计划中的工作做完了吗”，Delivery Profile 负责回答“要交付这种产品，
有没有漏掉整类工作”。二者必须同时通过。

---

# 第零部分 · Product

## P1 · 一句话定义与交付形态

面向 AI Coding Agent 的可控生成平台：以 PACT 作为需求、架构、契约与验收真源，先识别项目交付
形态，再按需选择 UI、脚手架或项目专用 Adapter，最终通过确定性规划、受控写入、执行图谱和验证
闭环交付可追溯的软件系统。

平台自身的交付形态包括：

- 通用 PACT Core；
- Capability Router 与能力目录；
- 确定性 Spec、Planner、ArtifactPlan、Applier、Verifier；
- PACT Skill Adapter；
- 可选 MCP Adapter；
- `ui-admin`、`vima-starter` 和其他项目能力 Adapter。

## P2 · 背景与问题

`ui-admin` 和 `vima-starter` 解决的是生产资料问题：前者提供后台 UI、Manifest、Template DSL 和页面
Builder，后者提供 Vue/Spring Boot 宿主、鉴权、数据库与项目模板。

稳定生成完整系统还需要同等重要的生产控制能力：

- 需求不完整时拒绝施工；
- 不让 Agent 猜测权限、必填、危险操作和公开名称；
- 让一个业务字段跨数据库、后端、接口、前端和测试保持一致；
- 写文件前输出可审核的计划和差异；
- 在上下文压缩、Agent 更换和并行施工后仍能续跑；
- 通过证据而不是 Agent 自述判断是否完成；
- 需求变化时更新规格、契约、验收和执行图谱，而不是直接改代码；
- 防止模板、文档、发布版本和实际能力长期漂移。

与此同时，PACT 不能退化成“Vima 专用工作流”。库、CLI、纯后端服务、非后台网站和既有非 Vima
项目仍应能使用 PACT，但不应被安装 `vima-starter` 或迁移到 Vima 技术栈。

## P3 · 用户与角色

| 角色 | 主要目标 | 可见范围 | 可执行操作 |
|---|---|---|---|
| 产品/领域负责人 | 业务语义正确、范围可控 | PACT 全文、计划与验收 | 回答访谈、裁定冲突、批准计划 |
| 实施 Agent | 在规格范围内完成施工 | 冻结 PACT、当前图谱步骤、必要代码 | 规划、实现、测试、回写证据 |
| 冷读/审查 Agent | 发现规格漏洞和完成度虚报 | 仅 PACT 或只读工程 | 提问、反扫、审查，不写业务代码 |
| 框架维护者 | 能力版本稳定、契约可信 | Manifest、Schema、Recipe、兼容矩阵 | 发布能力、维护 Adapter 和基准 |
| 项目开发者 | 接管生成后的系统 | PACT、代码、图谱、运行文档 | 按变更协议继续开发 |
| 平台管理员 | 控制 MCP 或远程能力 | 授权根目录、工具策略、审计记录 | 配置权限，不参与业务裁定 |

## P4 · 核心场景

### S1 · 通用项目规格化

适用于库、CLI、服务、既有非 Vima 项目等。

```text
需求/代码 → PACT S0–S8 → 冻结 PACT → 项目自有施工方式 → PACT review
```

- PACT 不引入 `ui-admin` 或 `vima-starter`；
- Capability Router 输出 `generic`；
- 项目既有语言、框架、测试和目录优先；
- 没有合适 Adapter 时，Agent 仍受 PACT、action graph、trace 和测试约束。

### S2 · 后台 UI 页面或组件开发

适用于 Vue 3 后台页面、组件、表单、列表、详情和仪表盘，但不要求创建完整后端系统。

```text
需求 → PACT → Capability Router(ui-admin) → AppSpec/PageSpec → UI ArtifactPlan
```

- 使用 `ui-admin` Manifest 校验公开组件、属性和 SVG 图标；
- 从 Recipe 索引选择适用页面模式；
- 不自动启用 `vima-starter`；
- 后端契约缺失时生成诊断或集成要求，不虚构后端实现。

### S3 · 新建完整业务系统

适用于需要长期业务数据、身份认证、角色权限、后台 UI、服务端接口和数据库的完整系统。

```text
业务需求 → PACT → Capability Router(business-system)
         → ui-admin + vima-starter → FullStackSpec
         → DB/Backend/API/UI/Security/Test ArtifactPlan
```

- 此场景才默认考虑 `vima-starter`；
- 是否真正采用仍要检查用户技术约束、既有资产和明确偏好；
- 用户指定其他技术栈时，使用项目专用 Adapter，不强制迁移到 Starter；
- 业务系统的每个功能必须形成可独立验收的垂直切片。

### S4 · 向既有业务系统追加模块

```text
检查现有系统 → PACT S3 八维评估 → 识别宿主
             → 选择 Starter Adapter 或既有项目 Adapter
             → plan → preview → apply → verify
```

- 发现项目是 Vima Starter 时才能使用 Starter Adapter；
- 发现是其他 Spring/Vue 工程时，不以目录相似为理由强行套 Starter；
- 不重建 App、main、主布局、鉴权和路由根；
- 只在已识别的宿主接缝上生成或修改。

### S5 · 冻结后需求变更

```text
用户变更 → /pact-change → R-ID/T1/C 层/D-ID/changelog
         → 重新编译 Spec → 旧计划失效 → 新影响面与图谱
```

### S6 · 多 Agent 续跑与并行

```text
board.md + action-graph.json + PACT hash → 取活
→ 检查依赖和写集合 → 并行或串行施工 → 回写证据
```

## P5 · 需求清单

| R-ID | 类型 | 可判真假需求 | 验收概要 |
|---|---|---|---|
| R001 | 治理 | PACT Core 不依赖任何 Vima 包 | 非 Vima 样例不安装、不读取 Vima 能力 |
| R002 | 路由 | 每次施工前必须输出能力选择和理由 | 选择结果含证据、启用项和禁止项 |
| R003 | 路由 | 只有识别为业务系统开发时才允许选择 `vima-starter` | UI-only、库、CLI 样例均不选择 Starter |
| R004 | 路由 | 用户明确指定其他技术栈时不得选择 Starter | 选择 project adapter 或报告缺少 Adapter |
| R005 | 契约 | PACT 结构化契约可编译为机器 Spec | 相同输入生成相同 Spec hash |
| R006 | 计划 | 写文件前必须生成 ArtifactPlan 和 diff | 未批准计划不能 Apply |
| R007 | 完整性 | 业务系统功能贯通 DB、后端、接口、权限、UI 和测试 | 黄金垂直切片全部门禁通过 |
| R008 | 安全 | 权限、必填、危险操作只来自显式需求 | 缺失时追问或拒绝，不推断 |
| R009 | 安全 | 不可信输入不得执行函数、脚本、任意表达式或任意命令 | 恶意样例全部被结构化拒绝 |
| R010 | 追踪 | 所有生成产物和测试可追溯到 R-ID | trace 覆盖率 100% |
| R011 | 幂等 | 相同冻结输入重复规划和执行无非预期差异 | 第二次计划为空或仅含明确可重复项 |
| R012 | 版本 | Adapter 使用前必须通过能力与版本兼容检查 | 同版本不同内容或出口缺失时停止 |
| R013 | 变更 | 冻结后需求变化必须走 PACT change 协议 | 直接改业务代码被 trace/review 拦截 |
| R014 | 完成 | action graph 和测试证据是完成判据 | 无证据的 done 被审查判失败 |
| R015 | 修复 | 自动修复最多两轮且不得降低门禁 | 超限返回结构化阻塞项 |
| R016 | 回归 | 生成控制平台必须维护冻结任务集 | 每次发布运行完整基准 |
| R017 | 完整性 | 交付完整度的必需项由版本化 Delivery Profile 提供，不由项目 action graph 自己定义 | 删除装配、启动或 E2E 步骤后仍被独立门发现 |
| R018 | 分级 | 完成态必须区分已实现、可构建、可启动、已集成、已验收和可部署 | 任一低层状态不得显示为“系统 100% 完成” |
| R019 | 运行 | 业务系统每个里程碑必须有装配、真实启动和至少一次真实请求 | 只有单测或类型检查时里程碑不得完成 |
| R020 | 闭环 | 业务 UI 必须连接真实 API，关键提交动作必须产生可观测后端状态变化 | 演示数据、无 handler 按钮和静态页面被判失败 |
| R021 | 证据 | 完成证据必须可重放并绑定代码快照、命令、退出码、环境和产物 | 仅文件路径、代码注释或 Agent 自述不能作为 pass |
| R022 | 阻塞 | 最新冷读 FAIL、硬阻塞问题未裁定或必跑门未执行时不得冻结或宣称完成 | 状态只能是 needs-input/blocked，不得将未跑记为通过 |
| R023 | 真相源 | Agent 入口文档、PACT、图谱、代码快照和 source hash 必须一致 | 任一哈希或状态文案漂移即停止取活 |
| R024 | 外部门 | 外部输入和上线 Gate 必须进入独立完成度账本 | 可实现完成与可上线完成分别展示，不能用前者覆盖后者 |
| R025 | 异常门 | 实际施工速度与冻结估算出现数量级偏差时触发独立抽检 | 只能降级为 prototype/scaffold，复核前不得称全量交付 |

## P6 · 非目标

- 不把 PACT 改造成 Vima 专用规格格式；
- 不因为需求中出现“表格”“CRUD”就自动选择 `vima-starter`；
- 不要求所有后台页面都来自 Starter；
- 不在浏览器运行时解释自然语言；
- 不允许 Skill 或 MCP 绕过结构化 Spec 直接自由写整个系统；
- 第一阶段不自动执行生产部署；
- 不默认执行依赖安装、数据库迁移、删除和覆盖；
- 不把前端隐藏按钮视为服务端权限；
- 不承诺支持所有技术栈和所有行业，缺少 Adapter 时明确报告。

## P7 · 约束

| 约束 | 类型 | 硬约束/倾向 | 说明 |
|---|---|---|---|
| PACT 必须保持通用 | 架构 | 硬 | Vima 是 Adapter，不是 Core 依赖 |
| 公开 UI 名称来自 Manifest | 正确性 | 硬 | 禁止猜测组件、属性和 SVG 名称 |
| 不可信模板不可执行函数或脚本 | 安全 | 硬 | Skill、CLI、MCP 一致 |
| 权限由服务端裁定 | 安全 | 硬 | 前端只做体验优化 |
| 先 Plan 后 Apply | 数据安全 | 硬 | Apply 需要 plan hash 与批准 |
| 现有项目优先保持技术栈 | 存量 | 硬 | 除非用户明确要求迁移 |
| Skill 优先、MCP 后置 | 交付顺序 | 倾向 | 多客户端需求出现后再建设 MCP |

## P8 · 成功定义

- 非业务系统任务选择 Starter 的次数为 0；
- 业务系统任务在技术栈允许时能够生成完整垂直切片；
- R-ID → Spec → Plan → Code → Test 的追踪覆盖率为 100%；
- 未知公开 UI 名称为 0；
- 未授权覆盖和 project root 路径逃逸为 0；
- 未显式权限、必填和危险操作推断为 0；
- 不可信函数、脚本和任意命令执行为 0；
- 相同输入的计划差异为 0；
- action graph 标记完成但无测试证据的步骤为 0；
- action graph 漏掉 Delivery Profile 必需工作仍显示完成的次数为 0；
- 业务 UI 中演示数据、无提交 handler 和未接真实 API 的关键流程为 0；
- 必跑门因环境缺失而被记为通过的次数为 0；
- “可构建”“可启动”“已集成”“已验收”“可部署”的状态互相冒充次数为 0；
- Agent 入口文档、PACT、图谱、代码和哈希锁漂移为 0。

---

# 第一部分 · Architecture

## A1 · 系统边界与上下文

### 系统负责

- 将需求与既有项目整理为完备 PACT；
- 根据交付形态选择能力；
- 把结构化契约转换为确定性生成计划；
- 在批准后安全应用计划；
- 执行验证、追踪、变更和完成度审查。

### 系统不负责

- 替用户决定业务规则和权限；
- 让一个 Adapter 覆盖所有技术栈；
- 绕过 PACT 直接根据聊天记录长期施工；
- 自动执行高风险生产操作；
- 维护两份平级规格真源。

### 外部依赖

| 依赖 | 用途 | 失效或不兼容行为 |
|---|---|---|
| PACT Skill 与脚本 | 规格、图谱、trace、review | 停止冻结或施工，不以人工自述替代 |
| `ui-admin` Manifest/Schema/Recipes | 后台 UI 能力 | UI Adapter 不可用，返回版本诊断 |
| `vima-starter` profile/template | 业务系统宿主 | Starter Adapter 不可用，可退回其他 Adapter |
| 项目文件系统 | 检查和应用计划 | root 不可授权或 hash 变化时拒绝 Apply |
| npm/Maven/浏览器 | 构建与验证 | 记录结构化失败，不跳过相应门禁 |

## A2 · 总体结构

```text
┌────────────────────────────────────────────────────┐
│ PACT Core                                          │
│ Product / Architecture / Contracts / Tests         │
│ board / cold-read / action-graph / trace / change  │
└──────────────────────┬─────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ Capability Router                                  │
│ delivery classification + evidence + constraints   │
└──────────┬──────────────────┬──────────────────────┘
           │                  │
           ▼                  ▼
  Generic Adapter      Vima Capability Catalog
                            │
                   ┌────────┴────────┐
                   ▼                 ▼
            UI Admin Adapter   Starter Adapter
                   │                 │
                   └────────┬────────┘
                            ▼
                  Spec Compiler / Planner
                            │
                            ▼
                      ArtifactPlan
                            │
                  Preview / Approval / Apply
                            │
                            ▼
          Project Verify + Delivery Profile Verify
                            │
                            ▼
              Trace / Evidence / Readiness Review
```

## A3 · Module 职责

| Module | 职责 | 是否依赖 Vima |
|---|---|---|
| `pact-core` | P/A/C/T、工序、冻结、变更、图谱、trace | 否 |
| `capability-router` | 识别交付形态并选择 Adapter | 否，只读取能力元数据 |
| `capability-registry` | 登记能力、版本、适用条件与互斥条件 | 否 |
| `delivery-profile-registry` | 按交付形态定义不可省略的装配、运行、集成、验收和部署门 | 否 |
| `project-inspector` | 检测技术栈、目录、版本、文件 hash、现有接缝 | 否 |
| `spec-compiler` | 从 PACT 结构化契约生成机器 Spec | 否 |
| `artifact-planner` | 生成文件、补丁、依赖和验证计划 | 否 |
| `plan-applier` | 预条件、路径限制、事务写入、回滚 | 否 |
| `verification-runner` | 运行 PACT 与项目门禁 | 否 |
| `runtime-verifier` | 启动真实进程，执行迁移、API、浏览器、权限和垂直切片验证 | 否 |
| `evidence-attestor` | 绑定快照、命令、环境、退出码和产物，拒绝自述式 evidence | 否 |
| `ui-admin-adapter` | 后台 UI Manifest、Recipe、页面结构和测试 | 是，可选 |
| `starter-adapter` | Vima 全栈宿主、Java、DB、权限、前端接入 | 是，条件启用 |
| `project-adapter` | 适配非 Vima 存量项目 | 否，按项目提供 |
| `skill-adapter` | 访谈、解释、工序编排 | 否 |
| `mcp-adapter` | 跨客户端暴露资源和确定性工具 | 否 |
| `benchmark-runner` | 冻结任务和生成器回归 | 否 |

## A4 · Capability Router

能力选择必须是结构化决策，不是隐藏在 Agent 思考中的临时判断。

### 交付形态分类

| 分类 | 判定信号 | 默认能力 |
|---|---|---|
| `library` | 发布库、SDK、组件库 | PACT Core + Generic Adapter |
| `cli` | 命令行程序，无后台 UI | PACT Core + Generic Adapter |
| `service` | 后端服务或 API，无管理端交付 | PACT Core + Project Adapter |
| `website` | 内容站、营销页、门户 | PACT Core + 对应 Web Adapter |
| `admin-ui` | 后台 UI，但后端由外部系统提供 | PACT Core + UI Admin Adapter |
| `business-system` | 长期业务数据 + 服务端 + 角色权限 + 可部署管理端 | PACT Core + FullStack Adapter |
| `existing-system` | 已有实质代码 | 先 S3 评估，再选择现有项目 Adapter |

### `vima-starter` 允许启用的条件

满足以下任一条件后才进入候选：

1. 用户明确要求使用 `vima-starter`；
2. 交付形态已判定为新建 `business-system`，并且技术约束允许 Vue 3 + Java 21 + Spring Boot；
3. 既有项目经 Inspector 确认为 Vima Starter 或兼容 profile。

即使进入候选，以下条件仍会禁止选择：

- 用户明确要求其他技术栈；
- 既有系统不是 Starter，且未授权迁移；
- 任务只是 UI 页面、组件、库、CLI、纯服务或文档；
- Starter 版本与 UI/Recipe/Spec 不兼容；
- 业务系统要求超出 Starter profile 且不存在对应 Adapter。

### 防误判规则

- 出现“CRUD”不等于完整业务系统；
- 出现“后台页面”不等于需要新建后端；
- 出现“Spring Boot”不等于项目就是 Vima Starter；
- 目录结构相似不能替代 package、版本和能力探测；
- 无法确定时输出追问或 `generic/project-adapter`，不默认 Starter。

## A5 · 权威源与生成物

| 内容 | 唯一权威源 |
|---|---|
| 做什么、为什么、算不算完成 | 冻结 `PACT.md` |
| 做到哪、测得怎样 | `action-graph.json` |
| 该交付形态天然不可缺少什么 | 版本化 Delivery Profile |
| 公开 UI 能力 | 指定版本的 `ai-manifest.json` |
| Starter 可用能力 | 指定版本的 Starter profile/manifest |
| 当前项目实际状态 | Inspector 读取的代码与文件 hash |
| 机器生成规格 | 由 PACT 生成的 Spec，禁止手改 |
| 每步写入计划 | ArtifactPlan，绑定 PACT 与基础快照 hash |
| 人类阅读视图 | `pact-book`，由 PACT 生成，禁止手改 |

追踪链：

```text
PACT R-ID
  → C 层契约锚点
  → Machine Spec.source.rids
  → action-graph step
  → ArtifactPlan item.rids
  → 代码 @pact R-ID
  → 测试与验证 evidence
```

这里有一个刻意的“双真源”边界：PACT 是**业务语义真源**，Delivery Profile 是**产品形态完整性
真源**。二者不表达同一类信息，因此不是平级重复规格。action graph 是二者编译后的施工计划，
不能反过来定义自己的完成度分母。

## A6 · 关键决策记录

### D001 · PACT Core 不依赖 Vima

- **选项**：PACT 内建 Vima / PACT 通过 Adapter 使用 Vima；
- **结论**：通过 Adapter 使用；
- **理由**：PACT 的价值是跨项目的规格和施工纪律，绑定技术栈会排除库、CLI、服务和存量非 Vima 项目；
- **已否决**：将 `ui-admin` 和 Starter 规则写死在 PACT Core；
- **影响**：R001–R004。

### D002 · Starter 由交付形态路由

- **选项**：所有后台需求默认 Starter / 仅完整业务系统候选 Starter；
- **结论**：仅完整业务系统候选；
- **理由**：UI 页面和完整系统的工程范围、安全责任与验收不同；
- **已否决**：看到 CRUD 或后台页面就创建全栈脚手架；
- **影响**：R002–R004。

### D003 · PACT 是语义真源，机器 Spec 是投影

- **选项**：两份规格手工维护 / PACT 生成机器 Spec；
- **结论**：PACT 生成；
- **理由**：避免人类审核内容和生成器输入长期分叉；
- **已否决**：手工同步 `PACT.md` 与 `FullStackSpec.json`；
- **影响**：R005、R010、R013。

### D004 · AI 只负责语义收敛

- **选项**：AI 自由生成系统 / AI 生成规格、Compiler 生成计划；
- **结论**：后者；
- **理由**：权限、覆盖、幂等和跨层一致性需要确定性验证；
- **已否决**：依靠一份长 Prompt 约束自由编码；
- **影响**：R006–R012。

### D005 · Plan 与 Apply 分离

- **选项**：工具调用直接写入 / 先计划和审核；
- **结论**：先计划和审核；
- **理由**：既有项目修改不可逆风险高，且需要支持 hash 预条件和冲突诊断；
- **已否决**：一键生成并覆盖完整工程；
- **影响**：R006、R009、R011。

### D006 · Skill 优先、MCP 后置

- **选项**：第一阶段远程 MCP / 先本地 Core + Skill；
- **结论**：先本地 Core + Skill；
- **理由**：当前首要问题是规格、规划和验证深度，不是传输协议；
- **已否决**：在核心契约未稳定前建设大型 MCP 服务；
- **影响**：R015、R016。

### D007 · 完整度分母独立于 action graph

- **选项**：以图谱已有步骤为 100% / 以 PACT 与 Delivery Profile 的并集为 100%；
- **结论**：使用并集，并由独立编译器产生必需步骤；
- **理由**：项目图谱如果漏掉装配、启动或 E2E，自身永远无法发现分母缺项；
- **已否决**：只要每个 R-ID 有代码注释、每个图谱 step 标 pass 就宣称系统完成；
- **影响**：R017–R019、R024。

### D008 · 完成态分层，不提供含糊的单一百分比

- **选项**：一个 completion=100% / 分别报告 implemented、buildable、runnable、integrated、accepted、deployable；
- **结论**：分别报告，并给出最低未通过层；
- **理由**：编译通过、进程能起、业务链闭合和可以上线承担的风险完全不同；
- **已否决**：把“实现范围完成”简称为“系统全部完工”；
- **影响**：R018–R025。

### D009 · 非 Vima 业务系统必须有项目 Adapter 或降级交付声明

- **选项**：没有 Adapter 时让 Agent 自由生成全栈 / 使用 Project Adapter 或明确降级为 prototype；
- **结论**：后者；
- **理由**：PACT 可以约束业务语义，但不能凭空提供特定技术栈的装配、集成和运维知识；
- **已否决**：因为没有选 Starter，就允许通用 Agent 跨 Rust、Java、Vue 和自建 UI 自由铺开并称全量交付；
- **影响**：R004、R017–R021、R025。

---

# 第二部分 · Contracts

## C1 · CapabilitySelection

以下为拟议内部契约，不是当前已发布接口：

```json
{
  "version": "1",
  "deliveryType": "business-system",
  "confidence": "confirmed",
  "evidence": [
    "requires authenticated users",
    "requires server-side permissions",
    "requires persistent business data",
    "requires deployable admin frontend and backend"
  ],
  "selected": ["pact-core", "ui-admin", "vima-starter"],
  "rejected": [
    {
      "capability": "generic-only",
      "reason": "cannot provide the requested full-stack host"
    }
  ],
  "requiredQuestions": [],
  "constraints": {
    "mustPreserveExistingStack": false,
    "allowScaffold": true,
    "allowMigration": false
  }
}
```

校验要求：

- `deliveryType` 必须来自闭合集合；
- `business-system` 不能只由“CRUD”一个证据触发；
- 选择 Starter 时必须至少记录技术栈允许或既有项目匹配证据；
- 用户明确约束必须高于自动建议；
- `confidence=needs-input` 时禁止进入 Plan。

## C2 · PACT 机器契约

PACT 仍是单文件完备规格。C 层允许使用带类型标识的 YAML/JSON 代码块作为机器契约：

```yaml
kind: pact-contract/v1
contract: entity
id: device
source:
  rids: [R021]
fields:
  - key: deviceName
    label: 设备名称
    type: string
    nullable: false
    required: true
    sensitive: false
    unique: false
    default: null
    validation:
      maxLength: 100
```

规则：

- 机器 Spec 从这些块确定性生成；
- 周围散文用于解释原因，不能补充机器块中不存在的隐藏约束；
- 相同信息在多个契约块出现时必须通过 consistency lint；
- 生成 Spec 记录 `pactSha256`，修改 PACT 后自动失效；
- 生成 Spec 是构建产物，禁止手改。

## C3 · Spec profile

不同交付形态使用不同机器投影：

| deliveryType | Spec profile | 必需内容 |
|---|---|---|
| `library` | `LibrarySpec` | 出口、兼容性、用法、测试、发布 |
| `cli` | `CliSpec` | 命令、参数、I/O、错误码、文件副作用 |
| `service` | `ServiceSpec` | 数据、接口、权限、配置、观测 |
| `admin-ui` | `AppSpec/PageSpec` | 页面、路由、字段、状态、交互、图标 |
| `business-system` | `FullStackSpec` | domain、DB、API、security、UI、tests |
| `existing-system` | 项目 Adapter Spec | 由 S3 评估和现有架构决定 |

这保证 `FullStackSpec` 不会反向污染所有 PACT 项目。

## C4 · FullStackSpec

仅在 `deliveryType=business-system` 时生成：

```yaml
version: "1"
source:
  pactId: device-system
  pactSha256: "..."
project:
  mode: new
  name: device-admin
  packageName: com.example.device
  profile: development
  stack:
    frontend: vue
    backend: spring-boot
  versions:
    uiAdmin: "..."
    starter: "..."
    recipeSet: "..."
delivery:
  profile: business-system/v1
  requiredSlices: [device-crud]
  requiredStages: [buildable, runnable, integrated, accepted]
domain:
  entities: []
  enums: []
  stateMachines: []
  invariants: []
operations: []
apis: []
ui:
  pages: []
  navigation: []
  bindings: []
security:
  roles: []
  permissions: []
  dataScopes: []
persistence:
  database: postgresql
  migrations: []
  seeds: []
quality:
  acceptance: []
  requiredCommands: []
```

业务操作必须显式声明权限和危险性：

```yaml
key: device.delete
kind: destructive
permission: system:device:delete
confirmation: required
audit: required
idempotency: none
source:
  rids: [R026, R027]
```

禁止根据 `delete`、`password`、`status` 等字段或操作名称自动推断契约。

每个关键 UI 动作还必须显式绑定数据源和可观测结果：

```yaml
key: work-order.create.submit
page: work-order-create
trigger: submit
request: POST /api/work-orders
successEffect:
  query: GET /api/work-orders/{id}
  assertion: status == "created"
states: [idle, submitting, success, validation-error, permission-denied, network-error]
source:
  rids: [R041]
```

`dataSource: demo`、仅本地 `ref([])`、按钮无 handler 或成功后无服务端可观测状态，均不得满足业务系统
的 UI 验收；它们最多属于 prototype profile。

## C5 · ArtifactPlan

```yaml
version: "1"
planId: "..."
stepId: S-device-crud
projectRoot: "..."
baseSnapshotHash: "..."
pactSha256: "..."
capabilitySelectionHash: "..."
files:
  - path: frontend/src/views/system/device/index.vue
    operation: create
    overwrite: deny
    preconditions:
      mustNotExist: true
    rids: [R021, R022]
    contractRefs: [C1.device, C4.device-list]
    contentHash: "..."
commands:
  - id: frontend-check
    kind: verification
    cwd: frontend
    argv: [npm, run, build:check]
    autoRun: true
diagnostics: []
approval:
  required: true
  destructive: false
```

约束：

- Apply 必须提交 `planId + planHash`；
- 文件 hash 或 PACT hash 改变后旧计划失效；
- 默认 `overwrite: deny`；
- 删除、依赖安装、数据库迁移和生产操作需要单独批准；
- 路由、Java、JSON、YAML 优先使用 AST 或结构化 patch；
- raw text patch 必须带唯一锚点和原文 hash；
- 计划失败不得留下半应用状态。

## C6 · Adapter interface

所有 Adapter 需要满足相同角色契约：

```ts
interface CapabilityAdapter<TSpec> {
  inspect(project: ProjectSnapshot): AdapterInspection
  supports(selection: CapabilitySelection, project: ProjectSnapshot): SupportResult
  validate(spec: TSpec, context: AdapterContext): Diagnostic[]
  plan(spec: TSpec, context: AdapterContext): ArtifactPlanFragment
  requiredChecks(context: AdapterContext): VerificationCheck[]
}
```

这是拟议内部设计，公开名称和最终签名需在正式 PACT 冻结后决定。

### UI Admin Adapter

- 读取指定发布版本的 Manifest、Schema 和 Recipe；
- 生成或编译页面结构；
- 只使用存在的公开组件、属性、事件、插槽和 SVG 图标；
- 覆盖 loading、empty、error、disabled、permission-denied 等状态；
- UI-only 模式不生成虚构后端；
- Starter 模式不重建已有 App、main、layout 和路由根。

### Starter Adapter

只处理已经被 Router 选中的业务系统任务，输出垂直业务链：

```text
DB migration
→ Java Entity/DTO
→ Repository
→ Service
→ Controller
→ server-side permission
→ typed frontend client
→ Vue page
→ route/menu registration
→ audit/seed
→ tests
```

它必须先验证 Starter profile，不能仅靠目录名称判断。

### Generic/Project Adapter

- 保持现有技术栈和目录；
- 有项目 Adapter 时，Agent 实现仍必须受 ArtifactPlan、PACT trace、action graph、Delivery Profile 和 tests 约束；
- 完整业务系统没有适配其技术栈的 Project Adapter 时，只允许输出规格、计划或明确标记的 prototype，
  不得自由生成后宣称完整交付；
- 不存在 Adapter 不等于可以选择最接近的 Vima Adapter；
- 需要迁移时必须单独建立迁移 PACT。

## C7 · Delivery Profile 与完成度账本

Delivery Profile 不是项目作者自由填写的清单，而是生成控制平台随版本发布的外部基准。业务系统的
最小 profile 示例：

```yaml
kind: delivery-profile/v1
deliveryType: business-system
requiredStages:
  - implemented
  - buildable
  - runnable
  - integrated
  - accepted
requiredChecks:
  - id: source-integrity
    stage: implemented
  - id: clean-database-migration
    stage: runnable
  - id: backend-startup
    stage: runnable
  - id: frontend-startup
    stage: runnable
  - id: api-contract
    stage: integrated
  - id: vertical-slice-e2e
    stage: integrated
  - id: server-permission-negative
    stage: accepted
  - id: browser-business-flow
    stage: accepted
  - id: production-config-audit
    stage: deployable
```

完成度账本必须逐层展示，不计算一个会掩盖失败的平均百分比：

| 层级 | 判定含义 | 典型证据 |
|---|---|---|
| `specified` | 需求和契约可判定 | PACT lint、最新冷读、零硬阻塞 |
| `planned` | PACT 与 Delivery Profile 必需项均进入图谱 | compiled graph coverage |
| `implemented` | 产物存在且追踪完整 | code/test trace + snapshot |
| `buildable` | 全部目标从干净环境可编译/打包 | clean build |
| `runnable` | 迁移与各真实进程可以启动并健康 | process + health evidence |
| `integrated` | 跨进程、跨层核心链路使用真实协议闭合 | API/DB/message E2E |
| `accepted` | 业务、权限、异常路径和人工验收通过 | acceptance evidence |
| `deployable` | 生产配置、密钥、回滚、观测和外部门就绪 | release readiness |

证据对象至少包含：`checkId`、`snapshotHash`、`command/argv`、`environmentId`、`startedAt`、
`exitCode`、`stdout/stderr digest`、`artifacts`、`verifierVersion`。以下内容不能单独作为 pass：

- 一个源文件路径；
- `@pact R-ID` 注释；
- “已实测”“应该可用”等自然语言；
- 只验证页面包含某段文字的类型检查；
- 因工具或环境缺失而 skip 的结果。

必跑检查只有 `pass`、`fail`、`blocked` 三态；没有 `skip-as-pass`。某项依赖真实 TSA、现场点位或
浏览器但环境尚未具备时，对应更高层状态是 `blocked`，可继续展示较低层已经通过，但不得称整体完成。

## C8 · PACT 工序映射

| PACT 工序 | 控制平台行为 |
|---|---|
| S0 | 检测项目、既有 PACT、技术栈、能力目录、入口文档和 source hash 漂移 |
| S1 | 访谈交付形态、用户、业务、权限、数据、非目标和成功标准 |
| S2 | 熔合 PRD、代码、旧文档和现有契约，冲突由用户裁定 |
| S3 | 对存量项目做八维评估，禁止直接套 Adapter |
| S4 | 写 Product，原子化 R-ID 和能力路由需求 |
| S5 | 写 Architecture，确定 Router、Adapter 和关键链路 |
| S6 | 写 Contracts，生成对应 Spec profile |
| S7 | 每个 R-ID 建立可执行验收和停工线 |
| S8 | lint、来源反扫、独立冷读和过度设计检查；末轮 FAIL 或硬阻塞未裁定时不得通过 |
| S9 | 冻结 PACT、锁版本，由 PACT + Delivery Profile 编译 action graph 和 source hash |
| S10 | 按图谱取活，plan、preview、apply、verify、trace；每个里程碑都含装配、启动和真实请求 |
| S10-CR | 改 R-ID、契约、验收、D-ID、changelog 和图谱 |
| S11 | 全量 review、trace、幂等、末次冷读和独立 Delivery Profile readiness review |

## C9 · 施工状态机

```text
Draft
  → NeedsInput
  → Validated
  → Frozen
  → Planned
  → Approved
  → Applying
  → Verifying
  → Buildable
  → Runnable
  → Integrated
  → Accepted
  → Deployable（若本次交付要求）

任一阶段
  → Blocked
  → Changed（S10-CR）
  → 回到 Validated / Frozen / Planned
```

- `NeedsInput` 禁止 Plan；
- 未冻结禁止 Apply；
- capability selection 改变后旧 Spec 和 Plan 失效；
- Apply 成功但 Verify 失败时步骤保持 doing/fail；
- 修复两轮后仍失败转 Blocked，不降低检查标准；
- 任何阶段只代表本层及其下层通过，不允许把 `Buildable` 简写为“全部完成”；
- mandatory check 未运行或外部输入缺失时进入 `Blocked`，不进入下一层；
- 最新冷读结论、CapabilitySelection 或 source hash 改变后，受影响的更高层状态全部失效。

## C10 · 多 Agent 契约

只有同时满足以下条件的 action graph step 才能并行：

- 所有依赖完成；
- 文件写集合无交集；
- 不修改同一路由、菜单、配置或迁移序列；
- 使用同一个冻结 PACT hash 和 CapabilitySelection hash；
- 每个步骤都能独立运行相应 T1 验收；
- 完成时回写实现和测试 evidence。

冷读 Agent 只接收 PACT，不继承实施 Agent 的上下文；审查 Agent 只读项目和执行证据。

## C11 · 安全契约

- PACT、AI、远程和导入内容一律视为 untrusted；
- 不可信内容不得含函数、脚本、任意表达式或任意 shell；
- 所有路径规范化后必须位于获授权 project root；
- MCP 不提供 arbitrary-shell、eval、template-script 工具；
- 依赖安装、数据库迁移、删除、覆盖和生产操作默认不自动执行；
- 敏感配置仅生成环境变量占位与 `.env.example`；
- 生产 profile 禁止固定 JWT secret、默认账号和明文数据库密码；
- 权限必须在服务端统一裁定；
- 列表、详情、统计和导出必须共享数据范围规则；
- 危险操作必须显式 permission、confirmation 和 audit 契约。

## C12 · Skill 与 MCP

### PACT Skill Adapter

Skill 负责：

1. 进入正确 PACT 工序；
2. 访谈和展示阻塞问题；
3. 调用 Capability Router；
4. 读取被选中的 Manifest、Recipe 和 profile；
5. 调用确定性 Core 生成 Spec 和 Plan；
6. 展示 diff 并获得批准；
7. Apply 后运行门禁并解释诊断；
8. 更新 action graph、trace 和 evidence。

Skill 不负责：

- 自己猜测能力选择；
- 自己拼接未知组件或脚手架文件；
- 绕过 Spec 直接生成整个系统；
- 自己决定权限和危险操作；
- 降低门禁以宣称完成。

### MCP Adapter

建议 Resources：

- PACT Schema 和模板；
- 能力目录；
- UI Manifest、Schema 和 Recipes；
- Starter profiles；
- Spec profiles；
- 版本兼容矩阵。

建议 Tools：

- `inspect_project`
- `select_capabilities`
- `validate_pact`
- `compile_spec`
- `validate_spec`
- `plan_graph_step`
- `preview_plan`
- `apply_approved_plan`
- `verify_project`
- `review_trace`
- `run_benchmark`

MCP 只是确定性 Core 的薄 Adapter，不重复实现路由、规划和安全规则。

---

# 第三部分 · Tests

## T1 · 验收矩阵

| R-ID | 可执行验收 | 判定标准 |
|---|---|---|
| R001 | 对 library/CLI/service 三个 PACT 样例运行路由 | 不读取、不安装 Vima 包 |
| R002 | 对全部 deliveryType 运行 selection snapshot | 每份结果都有证据、选择和拒绝理由 |
| R003 | 对 UI-only、library、CLI、service 样例运行路由 | Starter 选择次数为 0 |
| R004 | 既有 React/Go 项目声明不得迁移后运行路由 | 不选择 Starter，不生成 Vima 文件 |
| R005 | 相同 PACT 编译两次 | Spec 内容和 hash 相同 |
| R006 | 未批准 Plan 调用 Apply | 以 `PLAN_NOT_APPROVED` 拒绝且无文件变化 |
| R007 | 运行设备 CRUD 黄金垂直切片 | DB、后端、权限、UI、测试全部生成且通过 |
| R008 | 删除操作缺 permission/confirmation | 以缺失契约诊断拒绝，不生成删除入口 |
| R009 | 注入函数、脚本、路径逃逸和 shell | 全部结构化拒绝，无执行副作用 |
| R010 | 运行 pact trace | R-ID → Code → Test 覆盖率 100% |
| R011 | 对同一冻结输入执行两次 | 第二次无非预期文件差异 |
| R012 | 模拟同版本不同出口、缺 Manifest | 兼容门停止并指出具体版本/出口 |
| R013 | 冻结后直接增加野生功能 | trace/review 失败，要求走 change |
| R014 | 图谱 step 标 done 但移除 evidence | review 失败，不得宣称完成 |
| R015 | 连续制造三轮同类验证失败 | 第二轮后停止自动修复并返回 Blocked |
| R016 | 发布前运行冻结任务集 | 所有回归指标达到阈值 |
| R017 | 从业务系统图谱删除 app shell、启动和 E2E 项后运行 review | Delivery Profile 报缺项，完成度不能到 planned |
| R018 | 分别只满足编译、启动、API 联通、业务验收 | readiness 依次停在 buildable/runnable/integrated/accepted |
| R019 | 只提供单测和 typecheck，不启动进程 | 里程碑不得通过 runnable 门 |
| R020 | 业务页面使用静态数组、提交按钮无 handler | UI binding 检查和浏览器 E2E 失败 |
| R021 | evidence 仅写“某文件已实现”或一段自然语言 | 证据 Schema 拒绝，step 保持未验证 |
| R022 | 最新冷读 FAIL、必跑浏览器缺失、硬阻塞未裁定 | 分别进入 needs-input/blocked，不得冻结或完成 |
| R023 | 修改 PACT/图谱后不更新入口文档和哈希锁 | Inspector 在取活前失败 |
| R024 | 模拟外部 TSA 未到位而代码和单测通过 | implemented 可通过，deployable 必须 blocked |
| R025 | 预计 50 人日的范围在 1 天内被标全量完成 | 触发独立抽样、真实运行和交付降级门 |

## T2 · 指标与阈值

| 指标 | 阈值 | 测量方式 |
|---|---|---|
| 非业务系统误选 Starter | 0 | 路由基准集 |
| R-ID → Spec 覆盖率 | 100% | spec trace |
| R-ID → action graph 覆盖率 | 100% | pact graph |
| R-ID → code/test 覆盖率 | 100% | pact trace |
| 未知公开 UI 名称 | 0 | Manifest check |
| 未授权覆盖 | 0 | ArtifactPlan tests |
| project root 路径逃逸 | 0 | hostile-input tests |
| 未显式权限/必填/危险操作推断 | 0 | semantic tests |
| 不可信函数、脚本、命令执行 | 0 | security tests |
| 相同输入计划差异 | 0 | deterministic snapshot |
| 第二次执行非预期差异 | 0 | idempotence test |
| 无证据 done | 0 | pact review |
| Delivery Profile 必需项漏图 | 0 | independent profile coverage |
| 关键业务 UI demo/static binding | 0 | UI binding lint + browser E2E |
| 关键提交按钮无真实副作用 | 0 | API/DB observable assertion |
| 必跑门 skip-as-pass | 0 | evidence state audit |
| 真相源和入口状态漂移 | 0 | snapshot/hash/status check |
| 核心垂直切片真实闭环率 | 100% | process + API + DB/message + browser E2E |
| readiness 状态误报 | 0 | state transition tests |

## T3 · 停工线

- PACT 未冻结却开始 Apply；
- Capability Router 无法确认交付形态却默认选择 Starter；
- 用户明确指定其他技术栈仍生成 Vima 工程；
- 权限缺失或服务端权限可以绕过；
- 不可信输入进入函数、脚本或命令执行路径；
- 路径逃逸到 project root 外；
- PACT、Spec、Selection 或基础文件 hash 不匹配；
- 数据库发生未经批准的不可逆变更；
- PACT C3 不变量被破坏；
- 为通过测试而修改宽断言；
- 图谱标记完成但没有实现或测试证据；
- 同版本发布内容不一致；
- Agent 生成 PACT 中不存在的业务能力；
- action graph 没有覆盖 Delivery Profile 的必需阶段；
- 最新冷读仍为 FAIL，或存在命中当前里程碑的未裁定硬问题；
- Agent 入口文档、PACT、图谱、代码快照或哈希锁互相矛盾；
- 业务 UI 使用 demo/static 数据、关键按钮无 handler 或未连接真实 API；
- 业务系统没有从干净数据库启动全部进程并执行真实请求；
- 必跑检查因环境缺失被 skip；
- 估算与实际“全量完成”速度出现数量级偏差但未独立抽检；
- 将 buildable/runnable/integrated 任一状态对外表述为 accepted/deployable。

## T4 · Definition of Done

- [ ] Capability Router 的分类基准全绿；
- [ ] PACT lint、冷读门和反扫通过；
- [ ] 每个 R-ID 有 Spec、图谱和验收承接；
- [ ] Spec Schema 与语义校验通过；
- [ ] 版本兼容矩阵通过；
- [ ] ArtifactPlan 安全、hash、路径和审批检查通过；
- [ ] UI Manifest/Recipe 检查通过；
- [ ] 前端 typecheck/build/test 通过；
- [ ] 后端 compile/test 通过；
- [ ] 数据库迁移和 API 契约测试通过；
- [ ] 权限矩阵测试通过；
- [ ] 浏览器 smoke 与可访问性通过；
- [ ] Delivery Profile 全部必需项已经编译进图谱，无项目自定义分母漏项；
- [ ] 从干净数据库完成迁移，全部真实进程启动并通过健康检查；
- [ ] 至少一个核心垂直切片经浏览器 → API → 服务 → DB/消息 → 读回完整闭环；
- [ ] 关键 UI 无演示数据、无空提交 handler、无仅前端模拟成功；
- [ ] 权限正例与反例均通过真实服务端；
- [ ] evidence 绑定当前快照、可重放，必跑项没有 skip；
- [ ] 入口说明、PACT、图谱、代码状态与 source hash 一致；
- [ ] 所有硬阻塞与最新冷读问题已裁定，外部未就绪项准确反映在 readiness；
- [ ] 幂等重跑通过；
- [ ] `pact-review` 完成度 100%；
- [ ] readiness 分层报告达到本次承诺层级，不使用含糊的单一 100%；
- [ ] 末次冷读确认 PACT 描述的仍是当前系统。

## T5 · 分阶段施工建议

### M0 · 可信基线

包含：

- 修复当前 UI 发布门失败；
- 解决同版本不同内容；
- 清理 Emoji 功能图标；
- 建立 UI/Starter 能力与兼容矩阵；
- 增加 Starter 测试和生产安全基线。

明确不含：新的全栈生成能力。

### M1 · PACT Core 与 Capability Router

包含：

- 能力元数据格式；
- deliveryType 分类；
- `CapabilitySelection`；
- Delivery Profile registry、readiness ledger 与 evidence schema；
- 非 Vima、UI-only、业务系统和存量项目路由基准。

明确不含：文件写入和 MCP。

### M2 · 机器 Spec

包含：

- PACT typed contract blocks；
- Spec profiles；
- PACT + Delivery Profile → Spec/action graph Compiler；
- 一致性、hash 和 trace。

明确不含：生产部署。

### M3 · ArtifactPlan 与安全写入

包含：

- Inspector；
- Plan、diff、预条件、批准、Apply、回滚；
- AST/结构化 patch；
- 幂等验证。

明确不含：远程 MCP。

### M4 · UI Admin Adapter

包含：

- Manifest、Recipe、PageSpec；
- UI-only 页面生成；
- Starter 宿主下的 UI 垂直切片。

明确不含：非后台网站设计。

### M5 · Starter Adapter

包含：

- Starter profile 探测；
- DB、Java、权限、typed client、UI、路由/菜单和测试；
- 设备 CRUD 黄金垂直切片。

明确不含：自动生产部署和所有行业 Recipe。

### M6 · PACT Skill 与冻结基准

包含：

- S0–S11 编排；
- action graph、trace、change、review；
- runtime verifier 与分层 readiness review；
- 新建、追加、变更、中断、恶意输入、版本升级和 ClearWorks 缺项回归基准。

明确不含：多租户远程 MCP 服务。

### M7 · MCP Adapter

只有在 Core、Router、Adapter 和冻结基准稳定，且存在多个客户端接入需求时启动。

## 降级策略

- **可牺牲**：首批 Adapter 数量、行业 Recipe 数量、并行施工、远程 MCP、生产部署自动化；
- **不可牺牲**：PACT 完备门、能力选择证据、服务端权限、Plan/Apply 分离、路径安全、追踪、测试和幂等；
- **原则**：宁可只把一个业务垂直切片做深，也不生成多个无法联调和验收的半成品模块。

---

## ClearWorks 失败复盘：为什么使用 PACT 仍生成了不可靠的系统

### 复盘范围与结论

本节于 2026-08-11 对 `/home/renmk/projects/ClearWorks` 做只读分析；没有修改 ClearWorks，也没有把
现有未提交改动纳入本文产物。分析分为两条证据链：

1. **物料链**：`PACT.md`、`board.md`、`action-graph.json`、`source-of-truth.yaml`、冷读与当前
   `pact-check` / `pact-review`；
2. **实现链**：前后端装配、真实数据绑定、测试、运行手册、门禁脚本与 Git 时间线。

结论不是“PACT 没用”。ClearWorks 的契约套件、部分密码学/账本/领域不变量测试，以及问题追踪，
明显受益于 PACT。失败发生在更高一层：**PACT 证明了已写进规格和图谱的部分有形式覆盖，却没有
独立证明“完整业务系统天然必须有的部分没有被漏写”**。结果是领域模块、注释追踪和单测可以全绿，
产品仍是静态演示页面，甚至核心消息在真实链路上被契约拒绝。

因此，对 ClearWorks 当前状态更准确的判定是：部分 contract/domain 能力已实现，工程当前可能达到
`buildable` 或局部 `runnable`，但没有证据达到完整 `integrated`、`accepted`，更不能称
`deployable`。

### 可复核事实

| # | 事实 | 证据 | 暴露的问题 |
|---|---|---|---|
| 1 | 物料曾宣称 87/87 step、120/120 R-ID、`pact-review` 100%，但系统当时完全起不来 | ClearWorks `board.md:104-168` 明记 MES app 为空，前端缺 app shell，根因是图谱没有装配层 | 图谱对自己的缺项无感，100% 是封闭分母 |
| 2 | 当前 action graph 仍没有 M7、装配、启动、smoke 或 E2E step | `action-graph.json` 只列 scaffold/contract/ledger/gateway/MES/UI/Vima UI；`PACT.md:2707` 的 M7 未编译进图谱 | 后补启动脚本和 Controller 不在可追溯施工计划内 |
| 3 | 前端主外壳明确使用演示数据 | `systems/mes/web/src/App.vue:26-49` 写着“演示数据。接后端时换成 fetch”，全前端搜索没有 `fetch`/axios | 页面存在和类型通过不代表业务 UI 已接系统 |
| 4 | 关键业务按钮没有真实提交行为 | `P2CreateWorkOrder.vue:69`、`P3ReportList.vue:97`、`P4Transform.vue:68-75` 的主提交按钮没有请求 handler | UI 验收只检查文案/布局/token，未检查副作用 |
| 5 | 当前核心投递链仍违反自己的冻结契约 | `RUNBOOK.md:131-135` 承认 MES 用 UUIDv4，契约要求 UUIDv7，平台以 `ENV_SCHEMA` 拒绝，报工停在 `reconciling` | “端到端跑通”与当前真实结果冲突；主链没有闭合 |
| 6 | app 集成测试与前端测试均为 0 | `systems/mes/app/src/test` 无文件；web/mobile `src` 下无 test/spec；`check-all.sh` 只跑 Maven 单测、typecheck 和 build | Controller、DB、前端、网关、平台之间没有自动回归 |
| 7 | 总门禁不启动系统、不发真实业务请求，也不校验浏览器流程 | `scripts/check-all.sh` 只含契约、SQL 静态检查、Rust、Maven、token、vue-tsc、vite build | 16 道门可以全绿而运行链仍失败 |
| 8 | 当前 PACT 的 T4 DoD 全部仍是未勾选 | `PACT.md:2641-2665` 包含真跑 T1、T2、四项 E2E、入口文档一致等要求，但所有框均为 `[ ]` | board 的 S11 完成声明没有由 DoD 实态支撑 |
| 9 | 当前 PACT 体检和 review 实际失败 | 2026-08-11 运行两脚本，`pact-lint --level=full` 因 P4 不符合“流程→节点→四组人话清单”而 FAIL；与此同时 graph/trace 仍各自报 100% | 各门结论被选择性引用，整体 FAIL 不能被局部 100% 覆盖 |
| 10 | 最新已有冷读明确判定不能开工，12 个必须裁定问题仍未答复 | `cold-read.md:420-505`；`open-questions.md:93-111` 的 G1–G12 全部未答复，涉及永久拒收死锁、多产出批、数据模型、追溯、安全和 UI 规格 | S8/S9/S10/S11 状态没有被最新规格风险自动失效 |
| 11 | 对外阶段门仍是 No-Go | `board.md:78-100`：Gate B 进行中、Gate C/D 未开始、开工门 4/12 | “实现完成”“交付完成”“上线就绪”被混成一个口径 |
| 12 | 入口文档严重过期 | 根 `CLAUDE.md:6,175-179` 仍说只有文档、PACT 是 S8 草稿、图谱尚未生成 | 新 Agent 从规定入口读取后会获得错误状态，构成上下文污染 |
| 13 | 哈希锁已经失效且没有进入总门禁 | `source-of-truth.yaml` 登记的 PACT/graph/board/open-questions 四个哈希与 2026-08-11 实算值全部不同；`check-all.sh` 未调用校验 | “冻结后机器立刻抓到”只是文档承诺，不是强制机制 |
| 14 | 冻结前已经写代码 | `board.md:206-218` 明记“先于 S9 冻结”落地 workspace 和 UI token 引擎 | PACT 的先规格后施工是软约定，可被实施者自行解释绕过 |
| 15 | 估算与完成声明出现数量级异常 | `estimate.md:165-231` 估算完整 Alpha 单人 5.1–5.5 月、4 人 3.4–3.7 月；Git 历史在 2026-08-09 直接出现“全量实现”提交 | 没有用估算做真实性抽检；极短周期更像骨架/样例而非验收完成 |
| 16 | 视觉必验项未跑仍不影响 100% 声明 | `board.md:172-179` 明记 headless 浏览器缺失，R079/R114 截图 diff 未跑 | mandatory 检查被环境缺失隐式降级为可忽略 |

哈希漂移的具体对照如下，四项全部不一致：

| 文件 | 锁内前缀 | 2026-08-11 实算前缀 |
|---|---:|---:|
| `PACT.md` | `1b86a4b5` | `2ff0433e` |
| `action-graph.json` | `de6d1e41` | `a61ea3d1` |
| `board.md` | `e9db0b16` | `49816c71` |
| `open-questions.md` | `eb7a487e` | `7825082d` |

### 2026-08-11 独立零知识冷读结论

按 `pact-check` 的定义性检验，本次另起 Agent，只提供 ClearWorks `PACT.md` 的绝对路径，禁止读取
代码、board、open questions 和本次分析上下文。冷读结论仍为 **FAIL**：仅凭这份 PACT 最多可以有
条件地开始 M0 和部分契约核心，不能稳定生成、启动并验收完整 Alpha，更不能证明生产可交付。

独立冷读发现的阻断问题包括：

- 冻结元数据与 D029 的 2026-08-09 Java/Spring 裁定冲突，R-ID 总数在 118/120 之间漂移；
- Java MES 被要求复用 Rust `trace-contract`，但 JNI/C ABI/WASM/sidecar 等互操作方式没有裁定；
- Merkle path 缺 left/right 或 leaf index，proof 包又缺独立可信的租户公钥、平台公钥和信任根，
  “离线四步验证”无法仅凭包内容成立；
- 永久拒收事件不入账本，却要求用指向既有账本事件的 `RecordAmended` 才能退出 `reconciling`，
  形成不可达状态；
- `duplicated` 在需求里等价 accepted，但多处数据模型、枚举和 API 响应只有
  queued/accepted/rejected；
- evidence 可在分批处理的第一批 accepted 后短暂进入 complete，后续批次再退 partial，存在关单、
  导出或报送提前放行窗口；
- 平台签名私钥 provider、网关 72h 容量参数、正式 RBAC、工序/点位、报送规则、KPI 和
  TrustAssessment 算法均未形成可执行闭环；
- 自建黄金向量和首次实现生成的视觉基线存在自证循环，mock TSA 与 `verified:false` 模板只能证明
  演示能力，不能证明真实交付。

这份冷读很重要，因为它排除了“只是实现者没照规格做”的单一解释：**规格本身仍包含足以让不同
Agent 生成不同系统或根本无法实现的矛盾**。因此完整控制必须同时审查 `specification validity` 与
`implementation conformance`，不能用后者的代码注释覆盖前者的 FAIL。

### 根因链

#### 1. 完成度采用“封闭世界”假设

`pact-graph` 回答的是“图谱中已有的 87 步是否都标成 done/pass”，不是“完整业务系统是否只有这
87 步”。装配层和 M7 根本没有进入图谱，分子和分母仍能相等。这是最主要的结构性根因。

修正：完成度分母必须来自 `PACT requirements ∪ Delivery Profile required checks`，且由独立编译器
生成；项目作者不能通过不写 step 来消除工作。

#### 2. 追踪证明“有标注”，没有证明“行为成立”

`pact-trace` 能证明 120 个 R-ID 都出现在代码注释里，但一个 Vue 文件头部的 `@pact R079` 既不能
证明它连接了 API，也不能证明按钮提交成功。ClearWorks 的 UI graph evidence 主要是源文件路径、
token lint 和 `vue-tsc`，却被当成页面业务验收。

修正：注释 trace 只属于 `implemented` 层；`integrated/accepted` 必须使用绑定快照的可重放行为证据。

#### 3. 测试金字塔缺少系统层

契约和领域单测很深，但 Controller 集成、真实数据库迁移、进程启动、跨服务协议、浏览器业务流程
几乎没有进入自动门。后补手工冒烟发现了 UUID 版本错误，但这个已知错误没有让图谱、S11 或完成度
自动回退。

修正：每个业务垂直切片必须至少有一次 `browser/client → API → domain → DB/message → read-back`，
并包含服务端权限反例。已知主链失败必须使 readiness 从 `integrated` 回退。

#### 4. PACT 工序是软纪律，没有不可绕过的状态转换

冻结前写代码、末轮冷读 FAIL、G1–G12 未裁定、T4 未勾、source hash 漂移、CLAUDE 状态过期，均未
阻止 S10/S11 或“全量完成”表述。这说明规则写在文档里，但取活、Apply、Verify 没有强制消费规则。

修正：Skill/MCP 每次取活都必须重新计算状态；任何硬门失败自动使后续状态失效，不能由 Agent 用
“检查更深入了”“不影响完成度”等叙述覆盖机器状态。

#### 5. 未区分五种产品成熟度

ClearWorks 同时存在“代码和单测完成”“后来可启动”“前端仍是演示数据”“平台拒绝核心事件”
“真实 TSA 和现场输入未到位”。用一个 100% 无法表达这些事实，最终自然产生误导。

修正：强制分别报告 `implemented/buildable/runnable/integrated/accepted/deployable`，并始终展示最低
未通过层和阻塞原因。

#### 6. 范围规模与执行能力不匹配

ClearWorks 同时跨 Rust、Java、Vue、PostgreSQL、密码学、网关、MES、移动端和自建 UI。PACT 能描述
这类系统，但当没有对应 Project Adapter 时，通用 Agent 只能自由铺代码。估算本已说明需要数月，
却没有在“一日全量完成”出现时触发真实性复核。

修正：非 Vima 业务系统不强制使用 `vima-starter`；但必须存在适配当前技术栈的 Project Adapter。
若不存在，只能交付明确标记的 prototype/scaffold 或先建设 Adapter，不能把自由生成包装成可控全量交付。

#### 7. 冷读循环扩大了纸面规格，却没有收敛交付风险

ClearWorks 在九轮冷读中从 114 扩到 120 个 R-ID，多轮回填又引入新的不一致；第九轮还发现 15 处
过度设计和 12 个必须裁定问题。说明“问题数量下降”不能作为收敛指标，长文档也可能让 Agent 在局部
修补中失去系统闭环。

修正：冷读 PASS 仍是冻结必要条件，但还要有独立 Delivery Profile、任务局部上下文包和真实垂直
切片门；禁止用继续扩写 PACT 代替用户裁定或运行验证。

### 这次失败不应导出的错误结论

- **不是必须强制 ClearWorks 改用 Vima Starter。** 它是既有自定义 Rust + Java + Vue 业务系统，应由
  Capability Router 选择合适的 Project Adapter；Starter 仍只在适配且允许时使用。
- **不是 UI 框架选错导致全部问题。** 自建 Vima UI 增加了范围，但 UUID、装配、数据绑定、状态和门禁
  问题属于生成控制层。
- **不是 R-ID、action graph 或单测应被废弃。** 它们仍是实现追踪的重要下层证据，只是不能单独承担
  产品交付证明。
- **不是“再写更长的 PACT”就能解决。** 缺的是独立完整性基准、不可绕过状态机和真实运行证据。

### ClearWorks 对本设计的直接修正

| ClearWorks 失效点 | 本设计控制项 |
|---|---|
| 图谱漏装配仍 100% | R017、D007、C7 Delivery Profile |
| 构建/启动/交付混称完成 | R018、D008、C7 readiness ledger |
| 没有真实进程与请求门 | R019、T4 runtime/integration checks |
| 静态演示页与无 handler 按钮 | R020、FullStackSpec UI binding |
| evidence 是路径和自述 | R021、evidence attestation schema |
| 最新冷读 FAIL、未答问题仍施工 | R022、C9 强制状态回退 |
| CLAUDE/PACT/graph/hash 漂移 | R023、S0 Inspector integrity gate |
| 外部未就绪却不影响完成度 | R024、blocked readiness |
| 数月估算一日宣称全量 | R025、independent anomaly audit |
| 自定义业务栈无稳定生成器 | D009、Project Adapter 或 prototype 降级 |

---

## 当前存量前置问题

这些问题应进入正式 PACT 的 S3 评估和 M0，而不是在生成平台开发中顺手绕过：

1. `ui-admin` 当前 `check:ai` 被 runtime-size 门阻断（2026-08-11 串行多次实测 gzip
   68,776–68,796 bytes，阈值 68,521 bytes）；
2. Starter 锁定的 `ui-admin@0.1.0` 与当前同版本源码出口不同；
3. Starter 仍使用 Emoji 功能图标；
4. Starter 路由、Sidebar 和数据库菜单存在多份真源；
5. Starter 缺少完整测试与服务端业务权限闭环；
6. Starter 的生产默认 secret、账号和数据库配置需要收紧；
7. 当前 `createArtifactPlan()` 适合独立前端壳，不适合直接修改 Starter 宿主。

## 正式冻结前需要裁定的问题

1. `business-system` 的最小判定是否必须同时包含服务端、持久化、认证/权限和管理端；
2. 新建业务系统在技术栈允许时，Starter 是默认推荐还是仍需用户显式确认；
3. 第一版是否支持审批/工作流，还是只覆盖 CRUD 垂直切片；
4. 数据库迁移采用 Flyway、Liquibase 或其他方案；
5. 权限首版是否同时实现角色权限与数据范围；
6. 普通业务页面默认生成原生 Vue SFC，TemplateRenderer 是否只用于运行时编辑场景；
7. 非 Vima 项目 Adapter 的最小通用接口；
8. MCP 未来仅支持本地 stdio，还是允许远程服务；
9. 哪些行业与变更场景进入首批冻结基准；
10. `business-system/v1` 的最低承诺层是 `accepted` 还是同时要求 `deployable`；
11. 外部 TSA、现场点位、正式 RBAC 等缺失时，哪些交付可降级为 demo，状态和对外文案如何固定；
12. 非 Vima 业务系统缺少 Project Adapter 时，是只允许 prototype，还是允许先生成 Adapter 再施工；
13. 估算异常门的触发阈值和独立抽样比例。

## 审核检查表

- [ ] 是否认可 PACT Core 与 Vima Adapter 解耦；
- [ ] 是否认可只有业务系统场景才候选 Starter；
- [ ] Capability Router 的分类证据是否足够客观；
- [ ] PACT 与机器 Spec 的单一真源关系是否清晰；
- [ ] Plan/Apply、安全和幂等约束是否足够；
- [ ] 是否认可 action graph 不能定义自己的完成度分母；
- [ ] Delivery Profile 是否覆盖装配、启动、迁移、API、权限、浏览器闭环和运维；
- [ ] readiness 分层是否足以阻止“构建通过=系统完成”的误报；
- [ ] evidence schema 是否能排除文件路径、注释和 Agent 自述式 pass；
- [ ] Starter 垂直切片是否覆盖了完整业务链；
- [ ] Skill 与 MCP 的职责是否没有重复 Core；
- [ ] 测试指标能否真实阻止误选、越权、漂移和虚报；
- [ ] M0–M7 的依赖顺序是否合理；
- [ ] ClearWorks 的每个已知失效点是否都有不可绕过的回归门；
- [ ] 正式冻结前的问题是否需要增加或调整。
