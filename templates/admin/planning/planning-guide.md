# admin 模板 PLANNING 执行引导（planning-guide）

> 读者：主 Agent。你正处于 PLANNING 阶段（读 `docs/lifecycle.json` 确认）。
> 本文是 admin 模板在 PLANNING 阶段的**执行指令**：终点清单、产物要求、确认节奏、
> 检查点与校验操作，全部照此执行。设计依据：设计文档 §3.7 / §6 / §13.1。

## 0. 你的职责

- 以产品经理角色与用户深度对话，把 `docs/raw/` 的原始文档与用户口述整理为可施工的规范产物。
- **只做文档整理与规划，不写业务代码。**
- 脑中始终有下方「终点清单」，但到达路径完全自由——不做问卷式提问。

## 系统底座已内置（先读——决定 PLANNING 的范围边界）

admin 模板骨架自带完整系统底座，**PLANNING 终点清单只覆盖业务需求**：
系统管理、认证登录、权限分配这些底座功能**不再进 spec**、不建页面、不拆任务。

底座功能与 REST 前缀（与骨架 `backend/controller/` 一一对应）：

| 底座功能 | REST 前缀 |
|---|---|
| 认证（登录/登出/用户信息） | `/api/auth` |
| 用户管理（含 Excel 导入导出） | `/api/system/user` |
| 角色管理（RBAC，细到按钮级 perms） | `/api/system/role` |
| 菜单管理 | `/api/system/menu` |
| 部门管理 | `/api/system/dept` |
| 字典管理 | `/api/system/dict` |
| 参数配置 | `/api/system/config` |
| 文件上传 | `/api/system/file` |
| 操作日志与登录日志 | `/api/system/log` |
| 站内消息 | `/api/system/message` |
| 定时任务 | `/api/monitor/job` |
| 在线用户（含强制下线） | `/api/monitor/online` |
| API 文档（springdoc） | `/swagger-ui`、`/v3/api-docs` |

业务需求撞上这些前缀 = 底座已提供，直接引用，不重复设计。

**业务模块若需按钮级权限**：在页面块的交互设计里为按钮标注 perms 串
（格式 `模块:实体:动作`，如 `order:refund:approve`），并在对应后端任务的验收清单里
落 `@PreAuthorize("@perm.has('…')")`；权限分配界面本身是底座功能，不进 spec。

## 1. 终点清单（admin，A–H 全部到达才算梳理完成）

- **A. 业务全貌**：系统定位、用户角色、功能模块、核心业务流程（含每条流程串联的页面链路与涉及角色）。
- **B. 数据模型**：核心实体、字段定义、实体关系、字典/枚举值。
- **C. 页面与交互**：页面清单、页面类型；**每个页面必须达到页面级粒度**——
  多端项目（A16 端册 >1 端）每个页面块**必须带 `app` 键**声明归属端（V-SPEC-13），
  且每个端至少一个页面（V-SPEC-14）；`nav` 只能指向同端页面，跨端交接写进 `vima:flow`。
  布局拆分只用**归属端 kind 的枚举词表**（admin-web：`toolbar/search/table/form/cards/tabs/pagination`；
  mp-native：`search/list/cards/form/tabs/banner/detail/actionbar`，分栏 `regions` 仅桌面端可用）、
  组件清单（搜索框/表格/功能按钮/弹窗及其位置，弹窗带 `MODAL-xx` ID）、
  交互设计（限定三种：`nav` 跳转引用 `PAGE-xx`、`modal` 弹窗引用 `MODAL-xx`、`api` 接口标注）、
  对应接口。细致到程序员可直接实现的精度。
- **D. 接口定义**：每个页面的数据接口（路径、方法、参数、响应结构）→ 沉淀为契约文件。
  多端项目每个 api **必须带非空 `consumers`**（⊆ 端册，V-CON-07）——患者端能不能调
  这个接口是设计期就要拍死的授权边界；**不同端需要不同数据形状 ⇒ 拆成不同端点**
  （A16 契约纪律，不做 per-consumer 响应变体）。
- **E. 业务规则**：校验规则、状态流转、计算规则、约束条件——**逐条结构化写入
  `vima:rules` 数据块**（A13），每条带 `id: RULE-xx`、`type`（四类恰好对应本项四种：
  `validation`/`transition`/`calculation`/`constraint`）、`entity`（必填，须是
  `vima:entities` 里的实体名）、`desc`（写清边界值与错误码），以及可选的
  `apis`（该规则约束哪些接口；省略 = 全局规则）。散文陈述可保留作人读说明，
  但**机器真源是数据块**——它同时喂给 `vima context`（Builder 施工时逐条可见）
  与 Verifier（逐条核对是否实现）。
- **F. 权限设计**：角色清单、**每个角色的菜单权限清单**、操作权限、数据权限；
  无任何角色覆盖的菜单必须显式标记 `uncovered: true`。多端项目每条菜单带 `app` 键
  （menu.page 须同端）；**mobile 端的「菜单」即 tabbar（3–5 项）**，同一模型两种外壳投影，
  原型会把它渲染成手机底部导航。
- **G. 技术约束**：前后端技术栈、脚手架命令、UI 框架信息。
- **H. 本期不做**（A13）：明确问出**本期边界之外**的东西，写入第九章 `vima:non-goals`
  数据块，每条带 `id: NG-xx` + `desc`。提问方式：用户描述完一个模块后追问
  「这块有没有什么是**本期明确不做**的？」——用户答不出也要把你在对话中听到过、
  但判断为超范围的想法列出来请他确认。**确实没有也必须显式写 `non-goals: []`**
  （V-SPEC-11 拒绝省略）。理由：范围的本质是边界不是清单，只列要做的等于没有边界，
  而 Builder 天然倾向「顺便也支持一下」——这块清单是唯一能让 Verifier 判定越界的依据。

## 2. 产物清单与就绪判据

| 产物 | 位置 | 就绪判据 |
|------|------|---------|
| 规格文档 | `docs/spec.md` | 九章齐全（按 `spec.admin.md` 骨架），各章已填充；全部 `vima:*` 数据块可解析（含第五章 `vima:rules`、第九章 `vima:non-goals`）；`vima validate` 相关规则通过 |
| 契约文件 | `docs/contracts/<module>-api.md` | 覆盖全部业务模块；每个接口五要素齐全（方法/路径/请求/响应/错误码）；文末 `vima:contract` 数据块可解析 |
| 任务文件 | `docs/tasks/*.md` | 覆盖全部模块；frontmatter 字段齐全；每个任务含验收清单；业务任务 `contract` 指向存在的契约；前端页面任务带 `page: PAGE-xx` |
| 依赖图 | `docs/tasks/README.md` | 从 frontmatter 生成的批次视图，与 `vima plan` 输出一致 |
| 覆盖矩阵 | `docs/coverage-matrix.md` | 原始需求→接口→契约→任务 四列对齐，无空单元格、无 TODO 缺口 |
| 审计视图 | `docs/review/index.html` | `vima render-review` 渲染成功且 `--check` 无漂移 |
| 线框原型 | `docs/review/prototype.html` + `prototype.manifest.json` | `vima render-prototype` 渲染成功且 `--check` 无漂移 |

全部就绪 + 用户确认 + `vima approve` 通过后，等待用户 `/go`。

## 2.1 共享层任务必须承担的单点热文件（并行前提）

前端**路由表**（`src/router/`）与**侧栏菜单**（`src/components/layout/Sidebar.vue`）是全站单点文件：
页面任务若各自注册，并行批次里必然互相覆盖；若逐个申请共享层写令牌，则退化为全串行。

因此拆任务时**必须**把这两处登记划归 `layer: shared` 的共享层任务，一次性写入全部页面
（页面清单在 PLANNING 结束时已完全确定，不存在增量未知）；业务页面任务只创建
`src/views/<PageName>/`，其验收清单不含路由与菜单项。

## 3. 信息源分级（默认禁推断）

填充任何产物时，信息源优先级严格为：

1. **raw 原文**（`docs/raw/`）——最高优先级，可直接引用；
2. **用户对话中的明确确认**——次之，确认后视同事实；
3. **Agent 推断**——**默认禁止**。信息缺失时向用户提问，不脑补。

用户暂时无法拍板时才允许写入推断项，且必须在对应 YAML 条目上标记
`pendingConfirm: true`。评审闸门时向用户**批量列出全部 pendingConfirm 条目逐一确认**；
确认后删除该标记。存在未确认的推断项时不得执行 `vima approve`。

## 4. 骨架先行与即时校验（操作指令）

**骨架先行**：不从空白页创作。执行顺序：

1. 把模板骨架 `spec.admin.md` 复制为 `docs/spec.md`（init 已安装到项目内则直接用）；
2. 逐章填充：删掉该章的填写提示注释，替换占位值为真实内容；**每写完一章立即落盘**，
   并更新检查点（见第 6 节）——跨会话可从任意章断点续写；
3. 契约文件参照 `contract.example.md` 的结构逐模块生成（markdown 正文给人读 +
   文末 `vima:contract` 数据块给渲染层读，同文件维护、永不分离）；
4. 任务文件从 `_template-fe.md` / `_template-be.md` 复制后填充，不改动模板自身。

**即时机械校验**：**每份产物（spec / 契约 / 任务 / 覆盖矩阵）落盘后立即运行**：

```bash
vima validate                     # 全量校验
vima validate --artifact <path>   # 只跑与该产物关联的规则
```

- 不通过（exit 2）→ 按报错当场补齐修复，再跑，直到通过；**不要拖到 /go 才发现**。
- 机检覆盖不到的语义项，对照 `validate.checklist.md` 人工核对。
- 全部通过后 CLI 自动置 `checklists.PLANNING.artifactsValidated = true`。

## 5. 对话确认节奏

按里程碑推进，每个里程碑**先向用户复述你的理解，获确认后再落盘**：

1. **模块清单确认**：扫描 `docs/raw/` → 列出识别到的业务模块 → 用户确认增删；
2. **逐模块梳理（草→渲→看→定，A12 原型先行节拍）**：每个模块按
   数据模型 → 页面与交互 → 接口 → 业务规则 → 权限 顺序展开。页面环节不止于谈：
   该模块页面块草入 spec 并通过 `vima validate --artifact docs/spec.md` 后，
   **立即** `vima render-prototype`，请用户在浏览器看该模块每一页并对图反应
   （顺手裁定页上的待确认徽标），把反应修正回 YAML 块 → 重渲染，循环直至确认——
   人对抽象问题的回答不可靠，对具体物的反应可靠。页面对齐的完成判据是
   **用户在原型上看过并确认**，不是文本复述确认。跨模块 nav 指向尚未草拟的页面时，
   把目标页面一并草入本轮（V-SPEC-05 不放宽）；备选形态用「改 YAML → 重渲染」
   迭代对比，不引入第二真源；
3. **契约确认**：接口定义汇总为契约文件，向用户过一遍路径/参数/响应/错误码；
4. **任务拆解确认**：输出任务汇总表（ID、标题、layer、依赖、批次、引用契约、前后端配对），
   并与用户确认前端任务依赖策略——**默认前端仅依赖 shared-base**（A18：契约先行的必然
   推论，前端的事实来源是已过三道闸门的契约而非后端产物；前端验收清单只有「字段与契约
   一致 + `npm run build:check`」，不含任何后端运行时依赖）。确需依赖后端产物的
   （如需要真实种子数据的联调页）逐个显式说明理由。
   **同时按规模上限切分（A18）**：单个 backend 任务负责的接口数 > 10 就必须拆
   （`vima validate` 的 V-TASK-11 会告警）。拆分口径：
   - **按子域（实体组）切**，使每个子任务独占自己的 Entity/Repository/Service/Controller，
     天然可并行；确有共享文件时用 `conflictsWith` 登记（plan 保证不同批）。
   - 子任务 frontmatter 用 `apis: ['GET /api/x', ...]` 声明各自负责的接口，
     缺省表示负责该契约全部接口。V-TASK-12 机检「⊆ 契约 / 互不重叠 / 全声明时并集齐全」，
     `vima context` 也按它切片契约，Builder 只看自己那份。
   - **目标是均衡不是变小**：批次时长取批内最大值，一个 14 分钟的任务配四个 3 分钟的
     任务等于浪费掉一半并行槽（sustain-v3 实测空转率 52–54%）。同批任务应落在同一量级。
5. **最终评审**（第 7 节）。

一次只推进一个主题；用户答不上来的记 `pendingConfirm`，不阻塞当前对话。

**提问三规则（A9，怎么问决定对齐成本）**：

1. **先查后问**：能从 `docs/raw/`、骨架代码、底座与共享层能力索引查到的**事实**
   自己查，不抛给用户；提给用户的只有需要拍板的**决策**（取舍、边界、优先级）。
2. **一轮问全＋每问必附推荐答案**：同一主题内，把前置已定、现在就能问的问题
   一轮编号问全（`❓ Q1 …` + `➡️ 推荐：…（理由）`），不挤牙膏式一问一答。
   推荐答案是给用户裁定的候选——确认后即升级为「用户明确确认」信息源（第 3 节），
   未经确认不落盘。
3. **前置未定不问**：答案依赖另一个未定问题的，留到前提落定后的下一轮再问；
   前提被标 `pendingConfirm` 的，其下游问题一并悬置，不追问。

## 6. 检查点表（写入 lifecycle.json 的 checklists.PLANNING，共九项）

| 检查点 | 判定条件 | 恢复行为 |
|--------|---------|---------|
| `rawDocsCollected` | docs/raw/ 非空且已列出清单 | 新会话直接跳过收集 |
| `modulesConfirmed` | 模块清单已获用户确认（记入 spec.md） | 新会话从模块详情梳理继续 |
| `specGenerated` | spec.md 存在且骨架各章节均已填充（机械校验通过） | 跳过 spec 生成 |
| `contractsGenerated` | contracts/ 覆盖所有业务模块 | 跳过契约生成 |
| `tasksDecomposed` | tasks/ 覆盖所有模块且 README 依赖图完整 | 进入任务评审 |
| `artifactsValidated` | 全部产物通过机械校验（vima validate） | 重跑校验 |
| `reviewRendered` | docs/review/index.html 已渲染且与 spec 一致 | 重新渲染 |
| `prototypeRendered` | docs/review/prototype.html 与 manifest 已渲染且与 spec 一致 | 重新渲染 |
| `tasksApproved` | `vima approve` 已执行并记录时间戳（/go 的前置闸门） | 等待 /go |

**新会话恢复流程**：读 lifecycle.json → 发现 PLANNING 未完成 → 读 `docs/tasks/README.md`
与各检查点 → 向用户报告「上次进行到哪里，接下来做什么」→ 继续。
每完成一个里程碑即更新对应检查点，不依赖对话记忆。

## 7. 评审与收尾（/go 前的三道闸门）

1. **机械校验**：`vima validate` 全绿（零 token，确定性）；
2. **渲染对齐视图**：依次运行 `vima render-review`、`vima render-prototype`
   （校验通过是渲染前提；成功后 CLI 置 `reviewRendered` / `prototypeRendered`）；
3. **用户评审**：请用户**在浏览器打开** `docs/review/index.html` 核对完整性
   （角色权限矩阵/菜单功能点/业务流程泳道/页面 UI 详情），再**点击**
   `docs/review/prototype.html` 体验布局与交互（逐模块节拍下每页此前已看过，
   此处是最后一次全量过目）；核对 `docs/coverage-matrix.md` 无缺口；
   批量确认全部 pendingConfirm 条目；最后输出任务汇总表请用户拍板；
4. 用户确认后运行 `vima approve`——由 CLI 机械置 `tasksApproved = true` 并记录时间戳，
   **不依赖你对「用户已确认」的语义判断**。approve 会机检两份评审载体与当前 spec
   逐字节无漂移（A12）：评审后又改过 spec 的，先重渲再 approve；
5. 等待用户输入 `/go` 或说「开始开发」。

任一道不通过：回到对应产物修补 → 重新校验/渲染 → 重新评审。禁止带伤进入 DEVELOPING。
