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
  布局拆分只用**归属端 kind 的枚举词表**（admin-web：`toolbar/search/table/form/cards/tabs/pagination/steps/collapse/anchor`；
  mp-native：`search/list/cards/form/tabs/banner/detail/actionbar`，分栏 `regions` 仅桌面端可用）、
  组件清单（搜索框/表格/功能按钮/弹窗及其位置，弹窗带 `MODAL-xx` ID）、
  交互设计（限定三种：`nav` 跳转引用 `PAGE-xx`、`modal` 弹窗引用 `MODAL-xx`、`api` 接口标注）、
  **弹窗字段必须与提交端点入参对齐**（A22/F1）：弹窗里 `required: true` 的字段要能提交上去，
  端点必填入参要有地方填。实测四条功能级阻断都出在这——缺 `scaleType` 导致「量表根本创建不了」，
  且**缺的那个字段往往正是某个业务判断的输入**（补 MODAL-64 时连带查出退款审批没有 `decision`
  参数、一律按同意处理）。机检见 V-SPEC-15（warn，候选清单）。
  **跨页跳转带参数时**（A22/F3）：目标页用 `params: [{ name: step, values: [...] }]` 声明取值域，
  跳转侧写 `params: { step: screening }`。三个入口各用各的 key 约定、目标页静默落兜底分支
  是实测过的故障，且每个页面单看都自洽、只有跨页对照才暴露。机检见 V-SPEC-16（error）。
  对应接口。细致到程序员可直接实现的精度。
  **设计五问（A27 PDL——逐页回答，答案直接落页面块的设计键，不写散文）**：
  ① 这一页内容有什么？→ 每个区块给 `name`（实例名）与 `intent`（一句话存在理由；
  同词多例必带 name，V-DSN-03）。② 数据是什么形态？→ `data: { shape, of, keyFields }`
  （shape ∈ list/record/metrics/timeline/chart/freeform；freeform 必带 intent，V-DSN-04；
  shape:list 声明 keyFields 即信息优先级，V-DSN-08）。③ 谁在什么场景读？→
  `design: { pattern, density }`（pattern ∈ list/detail/form/workbench/master-detail/board，
  density ∈ compact/default/loose，V-DSN-01）。④ 最高频交互是什么、放哪？→
  低频动作别独占一条 toolbar 带——**挂宿主块的 `actions`**（贴该块标题行）并标
  `priority: primary/secondary/overflow`（一页一个 primary，V-DSN-05；超过 3 个行内动作
  标 overflow 收进「更多」，V-DSN-06）。实测 17 个页面为一个按钮独占 70px 横带（首屏 7.4%）
  ——**独立 toolbar 只在动作 ≥4 或页面级动作时使用**。⑤ 一屏必须看到什么？→
  `design.fold: [实例名…]`（首屏承诺，V-DSN-07 校验引用存在）。
  抽屉是弹窗的呈现变体：`modals[].presentation: drawer`（不再降级成居中弹窗）。
  **规格零像素**：宽高坐标一概不写——「放不放得下」由框架与运行期探针判定
  （声明 220 渲染 286 的教训）。设计声明可选、声明即承诺：没想清楚的页面宁可先不声明，
  也不要写一半。
- **D. 接口定义**：每个页面的数据接口（路径、方法、参数、响应结构）→ 沉淀为契约文件。
  多端项目每个 api **必须带非空 `consumers`**（⊆ 端册，V-CON-07）——小程序端能不能调
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
| 任务文件 | `docs/tasks/*.md` | 覆盖全部模块；frontmatter 字段齐全；每个任务含验收清单；业务任务 `contract` 指向存在的契约；前端页面任务带 `page: PAGE-xx`；**含收尾流水线 `full-test` 与 `code-audit`（A20，`layer: pipeline`）** |
| 依赖图 | `docs/tasks/README.md` | 从 frontmatter 生成的批次视图，与 `vima plan` 输出一致 |
| 覆盖矩阵 | `docs/coverage-matrix.md` | 原始需求→接口→契约→任务 四列对齐，无空单元格、无 TODO 缺口 |
| 审计视图 | `docs/review/index.html` | `vima render-review` 渲染成功且 `--check` 无漂移 |
| 线框原型 | `docs/review/prototype.html` + `prototype.manifest.json` | `vima render-prototype` 渲染成功且 `--check` 无漂移 |
| 设计语言 | `docs/design-language.md` | §2 八项观察量已填且注明出处（推断项已标 `pendingConfirm`）；§7 七条取向轴与色彩均已定档并注明依据的规则号；§6 自检六条已过；Stage A 走完后 §9 含本项目实际用到的每个 pattern 一条（第 8 节工序）。**非机检项、非 approve 闸门**——Claude Design 未接入时按第 8 节降级，如实标注即可 |

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
4. 任务文件从 `_template-fe.md` / `_template-be.md` 复制后填充，不改动模板自身；
   收尾流水线任务从 `_template-full-test.md` / `_template-code-audit.md` 复制（A20）。

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
   - **同契约多任务会抢同一个 API 封装文件——用 `conflictsWith` 登记，不要自己发明绕法**
     （A24/六）：多个前端任务引用同一份契约时，它们都要写 `src/api/<module>.ts`
     （实测最密处 8 个任务同用一份契约）。后写者用整体覆盖会**静默抹掉其他人的导出，
     且 TypeScript 编译不报错**，要等别的页面运行时才炸。
     在这些任务的 frontmatter 写 `conflictsWith: [其他任务 id]`，`vima plan` 就会把它们
     排进不同批次——**这是 A8 起就有的能力**。实测中因为没用它，绕成「各页把封装塞进自己
     视图目录」，既违反编码规范又留下人工合并债。
   **收尾流水线任务必须一并生成（A20）**：业务任务拆完后，从
   `docs/tasks/_template-full-test.md` 与 `_template-code-audit.md` 复制出
   `full-test`（`layer: pipeline`，`dependsOn` 填**全部 business 任务**）与
   `code-audit`（`layer: pipeline`，`dependsOn: [full-test]`）。它们是「全部批次开发完成
   之后」的收口载体——缺了它们，`/go` 的「流水线全部通过」条件恒真，全量测试与代码审计
   从不执行（`vima validate` 的 V-TASK-13 会告警，收口期 `vima converge` 的 V-INT-05 直接阻断）。
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
   此处是最后一次全量过目）；**视觉评审在 Claude Design 稿上做**（第 8 节工序，
   线框只审结构）；核对 `docs/coverage-matrix.md` 无缺口；
   批量确认全部 pendingConfirm 条目；最后输出任务汇总表请用户拍板；
   **注**：版面人审在第 8 节 Stage A 的模式参考页上一次性完成（全项目一次），
   本步的线框只审结构完整性，不审版面好不好看；
4. 用户确认后运行 `vima approve`——由 CLI 机械置 `tasksApproved = true` 并记录时间戳，
   **不依赖你对「用户已确认」的语义判断**。approve 会机检两份评审载体与当前 spec
   逐字节无漂移（A12）：评审后又改过 spec 的，先重渲再 approve；
5. 等待用户输入 `/go` 或说「开始开发」。

任一道不通过：回到对应产物修补 → 重新校验/渲染 → 重新评审。禁止带伤进入 DEVELOPING。

## 8. Claude Design 视觉稿工序（A29 视觉真源 + A30 两段化）

线框守**结构**（机检、approve 载体），视觉上限由 **Claude Design 高保真稿**负责。
工序**分两段**（A30）——先定全项目的版面语言，再逐页定内容：

> **为什么分段**：整页逐页出稿时，N 个页面就是 N 次独立的版面决策，壳层/密度/卡片
> 节奏靠出稿时的自觉保持一致，而稿不进机检，漂移无从检出。版面缺陷的正确解是
> **一处修全站**，不是每页各修一次。

**开启方式**：在 Claude Code 会话里运行 `/design consent` 授权 Claude Design 连接
（或到 claude.ai/design/settings 打开）；首次调用设计工具时也会给出授权提示。

### Stage A · 先发散实例，再反向提炼语言（DESIGNING）

1. **Design Brief**：读取 `docs/design-language.md` 的八项观察量；spec/raw 有出处的直接记录，
   读不到就问用户。既有推导规则只负责给发散设边界与审查「有没有跑偏」，**不负责生成唯一答案**。
2. **按端三方向发散**：每个 app kind 选一张标志性页面，做 A/B/C 三个在信息架构、交互重心、
   视觉重心上真正不同的方向，同时写核心任务流、关键状态转换与差异矩阵。不能只换配色。
3. **用户选型**：Agent 可以推荐但不得代选。每端固定冻结包为
   `docs/review/design/_shell/<appId>/{brief.md,direction-a.png,direction-b.png,direction-c.png,comparison.md,selection.md,manifest.json}`；
   `manifest.json` 声明前六个文件。完整后运行 `vima design approve direction --app <id>`。
4. **必要时受控回写**：获胜方向改变页面能力、交互模型或信息架构时，回写 spec/契约并运行
   `vima design reconcile`；不要用要求任务 done 的 `vima change close`。
5. **从获胜实例反向提炼**：先有优秀实例，再把 shell、tokens、密度、卡片形态、状态表达、
   动作层级、图表/空态/交互语言固化。各端的 Stage A 样式真源不同：

   | app kind | 样式真源 |
   |---|---|
   | `admin-web` | `<app>/src/styles/layout.css` + `tokens.css` |
   | `mp-native` | `<app>/src/vendor/vima-ui-mp/dist/ui.wxss` + `tokens.wxss` |
   | `h5-mobile` | `<app>/vendor/vima-ui-h5/dist/ui.css` + `tokens.css` |

   跨端共同沉淀 `docs/design-language.md`；项目含 D1/D2 时再沉淀
   `docs/interaction-language.md`。云端项目是草稿纸，仓库文件才是产物。

### Stage B · 页面内容稿（逐页）

6. **出稿**：每张 D1/D2 业务页一张，输入 = Stage A 冻结的模式库条目 + 该页 PDL +
   契约推导的 `data.shape`。只决策**内容区**：选哪个 pattern、块怎么排、取哪些字段、
   空态怎么呈现、动作主次。**不动壳层 / 间距刻度 / 卡片形态**——那些 Stage A 已冻结。
   确需**新版面骨架**：走 `sharedChangeRequest` 回 Stage A 收编进 `layout.css` 后再用。
   **但页面内容区的构图是页面任务的自由层**（A34 D-A34-08）——可以自写 `display: grid`，
   同一构图第二次出现时再提请上收 Stage A。壳层、间距刻度、卡片形态仍冻结。
7. **冻结（A34 D-A34-11）**：每页产物**冻结进仓库** `docs/review/design/<PAGE-xx>/`
   （路径由 pageId 推导，spec 里不写路径字段）。D1 存 `default.png` + `empty.png` +
   `manifest.json`；D2 另存 `prototype.html` + `scenarios.md`，且 **`prototype.html`
   必须自包含**（字体/图片/脚本内联或同目录冻结并登记进 manifest，零外部网络请求）——
   外链数月后失效，校准轮就拿不到基线，等同没冻。
   云端项目是草稿纸，仓库文件才是产物；用户仍可在 claude.ai/design 编辑器里改稿后重新冻结。
8. **任务重建与批准**：design reconcile 与逐页冻结完成后，按最终 spec/契约重建任务、覆盖矩阵、
   审计视图与线框原型，运行完整 validate；`vima design check` 六项全绿后，最终 `vima approve`
   才置 `tasksApproved` 并推进到 DEVELOPING。
9. **按稿开发（DEVELOPING）**：前端任务卡的「设计稿」行带本页链接与**所属 pattern**，
   实现 1:1 对照；`data-page`/`data-block`/`@vima` 标记与全部机检**照旧，一分不减**——
   稿管好看，探针管不坏，两层互不替代。
10. **校准（收口）**：版面冒烟后执行设计稿校准轮（/go 5.2.6）逐页截图对照。
   **回修分流**：版面级不一致（间距刻度、版面骨架、卡片形态）回 Stage A 改真源，
   一处修全站；页面级不一致（本页构图、字段取舍、空态）派回本页任务。改完复跑冒烟归零。

### 降级（A34 改判：按保真级分档，不再一律合法）

**先定级再谈降级。**每页必须显式声明 `design.fidelity`（V-DSN-12，`D0` 也要写出来
——「缺失」不等价于 D0）。定级建议可由 spec 自动推导（`pattern: custom` 或
`shape: freeform` → D2；`shape ∈ metrics/timeline/chart` 或 `regions` ≥2 列 → D1；其余 → D0），
**首次裁定时人可选任意级别**；**批准之后的降级**才需用户显式豁免并记录理由。

| 保真级 | 降级是否合法 | 口径 |
|---|---|---|
| **D0** | **合法** | 标准 CRUD 页，按 Stage A 模式库条目实现即可，不必逐页出稿 |
| **D1** | **不合法** | 需逐页高保真稿（正常态 + 空态）。除非用户显式豁免并记入完成报告 |
| **D2** | **不合法** | 需交互原型 + 场景脚本 + 体验验收。除非用户显式豁免并记入完成报告 |

- **Claude Design 不可用**（无授权/离线）：D0 页不受影响；
  **D1/D2 页停在 DESIGNING，不允许静默回退**——`vima design check` 会因
  `designArtifactsComplete: false` 挡住阶段推进。完成报告如实写「Claude Design 未接入」。
- **全页 D0 的项目**：`vima design check` 确定性判定跳过发散轮，
  设计语言仍由本文第 6 节的推导产出 Stage A——**D0-only 不是「没有设计语言」，只是不走发散**。

任何情况下都**不得拿线框冒充视觉稿**。灰盒线框守的是结构下限，
它按定义「只表达功能与布局，不表达视觉美学」，拿它当视觉评审载体正是 A34 要治的病根。
