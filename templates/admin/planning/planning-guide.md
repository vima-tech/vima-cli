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

## 1. 终点清单（admin，A–G 全部到达才算梳理完成）

- **A. 业务全貌**：系统定位、用户角色、功能模块、核心业务流程（含每条流程串联的页面链路与涉及角色）。
- **B. 数据模型**：核心实体、字段定义、实体关系、字典/枚举值。
- **C. 页面与交互**：页面清单、页面类型；**每个页面必须达到页面级粒度**——
  布局拆分（只用枚举区块词表：`toolbar/search/table/form/cards/tabs/pagination`）、
  组件清单（搜索框/表格/功能按钮/弹窗及其位置，弹窗带 `MODAL-xx` ID）、
  交互设计（限定三种：`nav` 跳转引用 `PAGE-xx`、`modal` 弹窗引用 `MODAL-xx`、`api` 接口标注）、
  对应接口。细致到程序员可直接实现的精度。
- **D. 接口定义**：每个页面的数据接口（路径、方法、参数、响应结构）→ 沉淀为契约文件。
- **E. 业务规则**：校验规则、状态流转、计算规则、约束条件。
- **F. 权限设计**：角色清单、**每个角色的菜单权限清单**、操作权限、数据权限；
  无任何角色覆盖的菜单必须显式标记 `uncovered: true`。
- **G. 技术约束**：前后端技术栈、脚手架命令、UI 框架信息。

## 2. 产物清单与就绪判据

| 产物 | 位置 | 就绪判据 |
|------|------|---------|
| 规格文档 | `docs/spec.md` | 八章齐全（按 `spec.admin.md` 骨架），各章已填充；全部 `vima:*` 数据块可解析；`vima validate` 相关规则通过 |
| 契约文件 | `docs/contracts/<module>-api.md` | 覆盖全部业务模块；每个接口五要素齐全（方法/路径/请求/响应/错误码）；文末 `vima:contract` 数据块可解析 |
| 任务文件 | `docs/tasks/*.md` | 覆盖全部模块；frontmatter 字段齐全；每个任务含验收清单；业务任务 `contract` 指向存在的契约；前端页面任务带 `page: PAGE-xx` |
| 依赖图 | `docs/tasks/README.md` | 从 frontmatter 生成的批次视图，与 `vima plan` 输出一致 |
| 覆盖矩阵 | `docs/coverage-matrix.md` | 原始需求→接口→契约→任务 四列对齐，无空单元格、无 TODO 缺口 |
| 审计视图 | `docs/review/index.html` | `vima render-review` 渲染成功且 `--check` 无漂移 |
| 线框原型 | `docs/review/prototype.html` + `prototype.manifest.json` | `vima render-prototype` 渲染成功且 `--check` 无漂移 |

全部就绪 + 用户确认 + `vima approve` 通过后，等待用户 `/go`。

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
2. **逐模块梳理**：每个模块按 数据模型 → 页面与交互 → 接口 → 业务规则 → 权限 顺序展开，
   页面必须谈到页面级粒度（布局区块、组件、交互、接口）才算谈完；
3. **契约确认**：接口定义汇总为契约文件，向用户过一遍路径/参数/响应/错误码；
4. **任务拆解确认**：输出任务汇总表（ID、标题、layer、依赖、批次、引用契约、前后端配对），
   并与用户确认前端任务依赖策略（默认前端依赖对应后端；也可仅依赖 shared 并行开发）；
5. **最终评审**（第 7 节）。

一次只推进一个主题；用户答不上来的记 `pendingConfirm`，不阻塞当前对话。

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
   `docs/review/prototype.html` 体验布局与交互；核对 `docs/coverage-matrix.md` 无缺口；
   批量确认全部 pendingConfirm 条目；最后输出任务汇总表请用户拍板；
4. 用户确认后运行 `vima approve`——由 CLI 机械置 `tasksApproved = true` 并记录时间戳，
   **不依赖你对「用户已确认」的语义判断**；
5. 等待用户输入 `/go` 或说「开始开发」。

任一道不通过：回到对应产物修补 → 重新校验/渲染 → 重新评审。禁止带伤进入 DEVELOPING。
