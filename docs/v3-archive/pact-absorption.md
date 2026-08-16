# PACT 经验吸收溯源（维护者文档）

> 本文回答一个问题：**vima-cli 的哪些设计来自 PACT 项目、来自它的哪个文件、
> 移植了什么、没移植什么。** 供维护者反查渊源，避免两类错误：
> 把移植来的规则当 vima 原创而改丢其防御意图；或反过来把 PACT 的仪式重量
> 误当欠账补进来。
>
> 参考仓库：`/home/renmk/projects/PACT`（只读参考，vima-cli 与它**零代码依赖**）。
> 正式增补规格见 `docs/design/v2.1-amendments.md`（A1–A5，
> 契约见 `docs/internal-contracts.md` §12）。

---

## 一、资产移植映射表

**统一说明：每一行移植的都是手法与规则，不是代码依赖——vima-cli 零依赖自实现，
不 import、不复制 PACT 的任何文件。**

| PACT 资产（真实路径） | vima-cli 落点 | 移植的手法与规则 |
|---|---|---|
| `PACT/pact/scripts/pact-book-html.mjs`（配 `pact-book.sh --check`） | `templates/admin/planning/audit-view.mjs` + `lib/commands/render-review.mjs` / `render-prototype.mjs`（契约 §11） | ① **确定性渲染**：构建期渲染、不嵌生成时间戳、同一输入字节一致（pact-book-html.mjs 头注释「实现取舍③」）；② **单文件零外链**：样式全内联、file:// 双击即开、禁 JS 完整可读、交互全部渐进增强（取舍①②）；③ **`--check` 字节比对手法**：内存渲染与磁盘产物逐字节比较，不一致即 FAIL——「生成物勿手改」由此从口号变成机检（pact-book.sh 头注释）。另承袭其 ID 交叉引用（R-ID 悬停/跳转 → vima 的 PAGE/MENU/ROLE 锚点）与明暗主题手法。**不移植**其 vendored marked 渲染管线——vima 的渲染源是结构化 YAML 块而非 markdown 正文，无需 markdown 渲染器。 |
| `PACT/pact/scripts/pact-graph.mjs` | `lib/commands/plan.mjs`（`vima plan`，契约 §9） | ① **DAG 结构校验 + 环检测**：全图 DFS 三色标记，发现环输出环路径并非零退出（pact-graph.mjs 96–110 行的手法）；② **「取活」思想**：`--next` 列出「依赖已全部满足、自身未完成」的下一批可执行节点 → vima plan 的批次划分（依赖满足的任务进同一 parallel 批）；③ **确定性调度**：拓扑计算由脚本做、不留给 Agent 概率性行为（PACT「/pact-run 按它干活」= vima「主 Agent 照计划派发，不自行计算批次」）。**不移植**其 module→feature→step 三级节点与 impl/test 证据字段——vima 的执行态由任务 frontmatter 承担。 |
| `PACT/pact/scripts/pact-lint.sh` | `lib/commands/validate.mjs`（`vima validate`，契约 §8 规则表） | **锚点式结构机检思想**：把「规格写够了没有」拆成逐条可判定的结构检查——锚点/章节存在性（lint 检查 3 → V-SPEC-01 八章前缀）、必填非空（检查 4 → V-SPEC-02/03）、引用闭环（检查 6 R-ID 验收覆盖 → V-SPEC-07/V-CON-03 交叉引用）、决策记录含已否决（检查 7 → V-DEC-01）、占位符/缺口（检查 5 → V-COV-01 的 TODO 检查）。每条规则有编号、有级别、报告落盘留痕。**不移植**其 `--self-test` 变异自检（好思想，v2.1 体量下由单测承担同一职能）与 30 锚点体系本身。 |
| `PACT/pact/scripts/pact-trace.sh` | `lib/commands/trace.mjs`（`vima trace`，契约 §10） | **虚报 / 野生双向对账**：规格声称 ↔ 代码标注两个集合做差——「状态说完成、代码无标注」= 虚报（PACT 三方比对的检查 1），「代码标了清单里没有的 ID」= 野生（检查 2）；注释内标注语法（`@pact R###` → `@vima <taskId>`）、grep 管线扫描 + 目录排除、报告分级（野生 error / 虚报 warn 可 --strict 升级）。**不移植**其第三方（action-graph 图谱侧）与跨物料 R-ID 并集逻辑——vima 单项目单任务清单，两方对账即闭环。 |

## 二、五项吸收对照（PACT 机制 → vima 落点）

详细规格（动机/行为/验收/落点）见 `docs/design/v2.1-amendments.md`，此处只给溯源映射：

| # | PACT 机制（出处） | vima-cli 落点 |
|---|---|---|
| A1 | `@pact R###` 代码标注 + `pact-trace.sh` 可追溯性机检（`PACT/pact/SKILL.md` 协议 D 第 4 条禁令） | `@vima <taskId>` 标注 + `vima trace`（`lib/commands/trace.mjs`、报告 `.vima/reports/trace.json`、Builder 模板 `templates/admin/workspace/.claude/agents/vima-builder.md` 强制写标注） |
| A2 | 单一真源分工铁律：「不另设覆盖表，两份执行态必然漂移」（`PACT/pact/SKILL.md` 物料结构） | 任务 frontmatter `page: PAGE-xx` 引用 spec 页面块，任务 body 禁手写组件树（V-TASK-05/06，`templates/admin/planning/_template-fe.md`） |
| A3 | 零知识冷读门：全新 agent 只读 PACT.md 输出必问问题清单（`PACT/pact/templates/cold-read.md`） | go.md 第二道闸门可选深模式：零知识子代理只读 spec+契约输出必问清单，遗漏回 PLANNING、推断项标 `pendingConfirm`（`templates/admin/workspace/.claude/commands/go.md`） |
| A4 | 决策必须留「已否决方案」，D-ID 四件套机检（`PACT/README.md` 三机制之三；`pact-lint.sh` 检查 7） | spec 第八章决策表（D-01…，列：决策/理由/已否决方案/否决理由），V-SPEC-01 + V-DEC-01（`templates/admin/planning/spec.admin.md`） |
| A5 | 完成度诚实：「低层状态不得冒充高层交付」、Starter 标 `partial`/`blocked`（`PACT/CLAUDE.md` 最高准则；`PACT/README.md` 平台节） | `template.json` `status: stable|preview`：preview 模板 create 警告、init 拒绝 exit 4（`lib/commands/create.mjs` / `init.mjs`、`lib/model/template.mjs`） |

## 三、PACT 已验证、vima 设计天然内含的项（无需重复吸收）

以下机制 PACT 用实战证明了必要性，但 vima-cli v2.0 设计里已经原生存在——
列在这里是为了防止未来维护者「对照 PACT 查缺」时误判为遗漏而重复建设：

| PACT 机制（出处） | vima 中的天然内含形态 |
|---|---|
| **生成物勿手改 + `--check` 抓漂移**（`PACT/pact/scripts/pact-book.sh` 头注释「知识库是生成物，不是真源」；SKILL.md 禁令 14） | 设计文档 §13.2/§13.3/§13.4 原生规定：`docs/review/` 全部由 `vima render-*` 从 spec 渲染，`--check` 字节比对，`vima doctor` 含对齐产物漂移检查——同一思想在 v2.0 就是渲染体系的地基，不是后补的。 |
| **决策留否决**（同 A4） | A4 是本次吸收落点；但其上游思想「对话不可信、落盘才可信」（SKILL.md 协议 A）在 v2.0 已由 lifecycle checkpoint + frontmatter 状态机内含。 |
| **机检聚合思想**（`pact-check.sh` / `pact-review.sh` 聚合器：自称完成不算数，多道门全过才 exit 0） | /go 三道校验闸门（§13.1：机械校验 → 语义抽查 → 用户评审 + `vima approve` 机械留痕）与 /check 客观信号完成度（§7.6）就是同一思想的 vima 形态：状态判定交给确定性命令，不信 Agent 自述。 |
| **单一写入者防漂移**（PACT：action-graph 是执行态唯一真源，上层状态由子节点推导、「存两份必然漂移」，`pact-graph.mjs` 91 行对非 step 携带状态直接 FAIL） | v2.0 状态系统原生规定：任务 `status` 仅主 Agent 可写（§9.2）、lifecycle taskStats 由 `vima sync` 从 frontmatter 确定性重建、README 依赖图只是生成视图不参与调度（§9.6）——写入者唯一、派生物可重建。 |

维护口径：今后再从 PACT 吸收任何机制，先对照本表确认不是已内含项，
再按 `v2.1-amendments.md` 的四段格式（动机/规格/验收判据/落点）立正式增补，
并回本文第二节登记溯源——**吸收本身也要可追溯**。
