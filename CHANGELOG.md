# 更新日志

版本遵循语义化版本（SemVer）；未发布改动记录在 Unreleased 段，发版时移入对应版本。

## [Unreleased]

## [3.0.0] - 2026-08-13

> 2.1.0 曾在仓库内准备但从未发布到 npm（npm 上的上一版是 2.0.3），其内容并入本版本。

### 破坏性变更

- **`vima upgrade` 更名为 `vima update`**（增补项 A15）。该命令的行为（manifest 三方比较、
  更新项目里的 vima 生成物、用户改过的文件旁路写 `.vima-new`）一行未改，只换了名字——
  `upgrade` 让位给「升级 CLI 自身」。
  **迁移**：把脚本里的 `vima upgrade` 改成 `vima update`。旧用法不会报错：
  `vima upgrade` 与 `vima upgrade --dry-run` 在新语义下都只是打印版本报告，
  且在 vima 项目目录内会追加一行指向 `vima update` 的提示。唯一有实际动作差异的是
  `vima upgrade --yes`——旧语义下无行为，新语义下会执行 CLI 自升级。

### 新增

- **`vima upgrade`：升级 CLI 自身**（增补项 A15）。此前全仓没有任何联网查版本或执行安装器的
  代码，用户想升级 vima 本体只能自己记 `npm i -g @vima-tech/cli@latest`。
  - 查 `https://registry.npmjs.org/@vima-tech/cli/latest`（Node 20 内建 fetch，5s 超时，
    零运行时依赖不破）；查不到版本报 `REGISTRY_UNREACHABLE`（exit 2），不静默降级为「已是最新」；
  - 按 `cliRoot` 的路径与文件存在性识别安装方式（npm / pnpm / bun 全局 · npx 临时运行 ·
    源码或 npm link 开发态），不执行外部命令探测；
  - **默认只报告不安装**——它是全仓唯一联网、唯一会改 cwd 之外文件的命令，`--yes` 才跑安装器；
  - 源码态与 npx 态不可自升级：不带 `--yes` 只报告（exit 0），带 `--yes` →
    `UPGRADE_UNSUPPORTED`（exit 4）；安装器非零退出 → `INSTALL_FAILED`（exit 2）。

以下校验与生成端改动吸收自 sustain-v3 修补期实战：一次「契约从 spec 反向生成」导致的规格事故——209 个契约端点里
大量虚构路径、占位参数、空请求体，却**全数通过了当时的 19 条校验**。根因是整套规则都是
spec ↔ 契约 ↔ 任务之间的内部一致性，同源产物必然自洽，闭环从头到尾没碰过真源。

- **V-SRC-01**（warn，需配置）：端点溯源锚点——全表**唯一的外部锚点**。在
  `docs/lifecycle.json` 写 `endpointAnchor: "<相对路径>"` 指向真源端点清单后启用，
  契约每个 path 归一后须在锚点中出现；未配置整条跳过，不影响既有项目。
- **V-CON-05**（warn）：占位符特征检测——参数名匹配 `^q\d+$`、POST/PUT 空 `request: []`。
  零配置、纯形态判断。实测某项目 20 份契约里 14 份中招。
- **V-CON-06**（error/warn）：契约三方计数一致——人读小节 ↔ 机读 `apis` 逐接口对应（error），
  头部「接口 N 个」↔ 机读条目数（warn）。三处会各自漂移且此前无人发现。
- **V-TASK-08**（warn）：任务正文引用的接口须落在作用域内（带 page 取该页 apis，
  否则取 contract 契约 apis）。V-TASK-07 只数复选框个数不看内容，产物重建后验收清单
  会长期停在已删除的端点上。含否定式措辞（真源无/已废弃/不请求…）的行不计入。
- **V-TASK-09**（warn）：任务内嵌「契约声明的 N 个接口」与契约条目数一致。
- **V-YAML-01**（warn）：flow 上下文里的裸花括号。路径参数须写 `{id}`（V-CODE 归一只认
  花括号），但 YAML 规范禁止 flow 内 plain scalar 含 `{`——本解析器容忍 flow 序列、
  却在 flow 映射上报「键 X 后缺少 :」，形成「vima 能读、标准 YAML 读不了」的灰区，
  且报错与真实病因相去甚远。块级序列（`- GET /api/x/{id}`）本就合法，不在此列。
- **`vima render-matrix`**：覆盖矩阵的生成端。此前 V-COV-01 强制它存在且无空单元格，
  却没有任何命令生成它——矩阵靠手写，产物一变就烂，校验只能发现「烂了」不能修。
  现从 spec 页面块 / 契约 apis / 任务 frontmatter 确定性推导，支持 `--check` 验漂移。
- **doctor ⑩ 评审批准时效**：`tasksApproved` 只能由 `vima approve` 置位却没有失效路径——
  产物在批准后被大改，标志位仍是 true，下一次 `/go` 会拿着没人看过的规格直接进 DEVELOPING。
  现按 mtime 判定：批准早于 spec/契约最后改动即报 error。

### 改进
- YAML 解析错误现在**带文件名与文件绝对行号**。此前 `extractBlocks` 调 `parseYaml` 未传 path，
  错误只有块内相对行号，19 份契约里得靠 grep 才能定位；且 `collectPendingConfirm` 的调用
  既无 try/catch 也无 path 归属，解析错误会绕过 `loadContracts` 的补偿直接逃逸。
- `validate` 现在**一次报出全部契约解析错误**（`loadContracts` 新增 tolerant 模式）。
  此前首个坏契约即中止，修一个才发现下一个。

### 修复
- `render-matrix` 的任务列只收「不带 page 字段」的模块级任务，避免共用同一契约的兄弟页面
  任务互相串到彼此行里。

## [2.0.3] - 2026-08-13

### 新增
- 增补项 A14 分栏版面（吸收自 sustain-v3 实战：48 页中 9 页真实版面为多列结构，
  而 layout 是一维词序列，人审产物画不出二维布局）：
  - `vima:page` 新增**可选**键 `regions`（纵向若干带，每带全宽或横切成列，列宽 `<n>px` / `<n>fr`）；
    `layout` 保持扁平不变，校验 / manifest / 任务点计数 / data-block 对账口径全部不动
  - 新增 **V-SPEC-12**（error，仅声明 regions 时触发）：带二选一、列宽格式、blocks 词表、
    以及 regions 铺开后的区块多重集必须等于 layout（防两处漂移）；挂在 validatePages，
    故渲染前同样拦截
  - 线框原型按列渲染（固定列 px / 弹性列 fr，窄屏落回堆叠）；审计视图「布局区块序列」
    升级为**版面草图**（分栏页按列画、单列页纵向堆叠，区块显示中文名 + 原词）
  - 向后兼容：未声明 regions 的页面不产生分栏结构、manifest 不写该键；
    渲染产物 HTML 会因样式表新增而变动一次字节，升级后重跑 render-* 即可
- 增补项 A9–A11（吸收自 mattpocock/skills 对标，评估见
  docs/design/mattpocock-skills-assessment.md；均为文字资产级吸收，不新增命令/文件/报告格式）：
  - **A9 提问三规则**：planning-guide §5 与 vima-planner 新增 PLANNING 提问纪律
    （先查后问 / 一轮问全＋每问必附推荐答案 / 前置未定不问）
  - **A10 同构断言禁令**：coding-standards 后端节〔L5·verifier〕——单测期望值必须来自
    独立事实源，同构断言视同无测试；`_template-be` 步骤 5 同步措辞
  - **A11 红绿修复纪律**：CLAUDE.project.md 工作协议——维护期修 bug 先固化能跑红的命令
    （A7 信号源），修复判定 = 同一命令转绿
- d2 防漂移断言覆盖 A9–A11 的全部 grep 验收判据
- 增补项 A12 原型先行节拍（吸收自作者「先出原型再出 spec」时序观念，
  分析见评估文档 §6）：planning-guide §5 里程碑 2 改为逐模块「草→渲→看→定」
  （页面对齐完成判据 = 用户在原型上看过并确认）；render-review / render-prototype
  导出 `checkReviewFresh` / `checkPrototypeFresh` 新鲜度助手（契约 §11，与 --check
  共用 util/fs `driftOf` 逐字节比对）

- 增补项 A13 规格边界机检（出自「快速理解业务系统的核心要素 / 产品经理关注点」
  专题讨论，经用户裁定立项）：
  - **业务规则结构化**：spec 第五章新增 `vima:rules` 块（`id`/`type`/`entity` 必填 +
    `apis` 可选，省略 apis = 全局规则），新增 V-SPEC-09（结构与 entity 引用）与
    V-SPEC-10（apis 落在契约上）；RULE-xx 并入 V-SPEC-05 全文档 ID 唯一性
  - **本期不做**：spec 新增第九章承载 `vima:non-goals`，新增 V-SPEC-11 强制显式声明
    （空清单也须写 `non-goals: []`——「声明为空」与「没声明」必须可区分）
  - **消费端全链路**：`vima context` 新增「业务规则切片」（按 apis 交集 + 全局规则
    确定性过滤）与「本期不做」两节；审计视图新增第⑤业务规则视图与本期不做红线区
    （审核指引四步→五步）；vima-verifier 逐条核对 RULE-xx，越界记 `NG-xx 越界` fail
    （复用契约 §6.9 points，不改报告 schema）

### 变更
- **spec 由八章扩为九章**（新增 `## 9. 本期不做`，A13）：V-SPEC-01 章节表、
  spec 骨架、validate.checklist、planning-guide 终点清单（A–G → A–H）、黄金夹具同步
- CLAUDE.md 新增硬约束「立项即做透」：需求一旦立项就按长远正确形态一次做完整
  （数据结构留足字段、消费端一并接线、契约与校验同步落位），与「防过度设计」分工——
  后者管广度（没立项的不做），前者管深度（已立项的不做夹生）
- `vima render-review` 输出摘要补规则数与本期不做条目数
- 订正：设计文档 §13.1 两处遗留的「spec 七章」表述（A4 改八章时未回写）统一为九章；
  契约 §7 `vima:flow` 的「第七章」标注订正为「第五章业务流程小节」
- `vima approve` 前置 2 从「评审载体存在」升级为「与当前 spec 渲染结果逐字节一致」
  （A12 新鲜度机检）：渲染后改过 spec 未重渲 → exit 4 并指名漂移文件与重渲命令；
  approve 单测随之改为真实渲染 + 新增漂移 e2e

### 修复
- 线框原型的表格加横向滚动容器 `.wf-tw`：列头多或行操作多时表格自然宽度会超出所在列，
  分栏页（A14）里会直接压到相邻列上；不能给 `.wf-block` 直接加 overflow——那会裁掉
  浮在上边框的区块标签，故套内层容器。打印时该容器展开为 visible
- 设计文档「当前修订」与页脚版本自 v2.0.4 修正为 v2.0.6（v2.0.5 落地时未同步）；
  契约 §12 标题补 A8 来源

## [2.0.2] - 2026-08-12

### 修复
- admin 骨架样式：工作区标签悬停态与表格末行边框处理

### 说明
- 2.0.1 未能发布到 npm（发布令牌对 `@vima-tech` scope 无创建新包的权限），
  该版本的全部内容包含在 2.0.2 中

## [2.0.1] - 2026-08-12

### 新增
- 全部 11 个子命令支持 `--help` 与 `vima help <command>`（文案对齐设计 §19，选项以实现为唯一真源）
- 契约 §3.1 错误码登记表（VimaError code 全集）；USAGE 错误追加「运行 vima <cmd> --help 查看用法」提示行
- `vima plan` 在缺 docs/tasks/ 的目录报 `NO_TASKS`（exit 4），不再静默产出空计划并凭空写报告
- 测试：CLI 路由矩阵（tests/cli.test.mjs）、V-TASK-01 专属用例、script/lib/h5 模板 create 冒烟、
  defaultLifecycle 版本同步锁、公共 helper（tests/helpers.mjs）
- 工程门面：LICENSE（MIT）、GitHub Actions CI（Node 20/22/24）、tag 驱动的 release.yml、
  RELEASING.md、.editorconfig、.gitattributes、CHANGELOG
- package.json 补 repository/homepage/bugs/keywords/author/publishConfig.access/prepublishOnly
- `vima context` 命令（含 tests/unit/c3.context.test.mjs）
- admin 骨架权限体系：PermRegistry 从 `@PreAuthorize` 派生权限码 + `/system/menu/perm-options`，
  34 处控制器注解补齐，菜单权限标识改为代码派生下拉，三边对账测试
- admin 骨架日志与运维：logback-spring.xml、LogArchiveJob / DbLogRetentionJob 保留策略、
  docker-compose.yml、校验工具（ValidateUtil / ValidFormat）

### 变更
- 输出流向按契约 §3 收口：失败诊断与警告（validate/trace 的 ❌/⚠️ 清单、approve 前置失败、
  create/init 的独立 ⚠️ 提示）统一走 stderr——`vima validate > report.txt` 不再吞错误
- node:util parseArgs 英文报错统一翻译为中文（未知选项/缺少取值/不接受取值/多余的位置参数）
- 未知命令只输出一行错误 + 提示，不再倾倒全量帮助；非 VimaError 异常的堆栈改为仅 DEBUG 下输出
- render-review / render-prototype 静态复用 validate.mjs 的 validatePages，
  移除并行开发期的动态探测与内联兜底（约 146 行不可达代码）
- 顶层 help 标注模板成熟度（admin=stable，其余 preview，A5 诚实分级）
- admin 骨架鉴权改为 TokenAuthFilter（移除 JwtFilter / JwtUtil / InMemoryTokenStore）
- workspace hooks 由 .sh 改写为零依赖 .mjs（guard-shared、post-write）

### 修复
- README 过期数字（增补项 A1–A7、validate 规则数、测试规模）与 npm 页面死链（补 repository 字段）
- 设计文档漂移：§19 补 vima trace 条目、§7.5 补 A3 冷读深模式、§7.6 补 A7 运行时错误信号、
  §9.4 残留 src/pages、§15 结构树对齐骨架实际目录、契约 §2 所有权表过期项

## [2.0.0] - 2026-08-12

- 初始版本：create / init / upgrade / doctor / validate / render-review / render-prototype /
  sync / plan / approve / trace 全命令落地，含 admin 模板（前后端骨架 + planning/workspace 资产）
  与黄金链路端到端测试。
