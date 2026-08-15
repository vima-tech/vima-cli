# 更新日志

版本遵循语义化版本（SemVer）；未发布改动记录在 Unreleased 段，发版时移入对应版本。

## [3.1.1] - 2026-08-15

### 新增

- **DEVELOPING 期自动开工 `SessionStart` hook（A39 / D-A39-03）**。此前「起」这一步
  没有任何自动化：`go-continue.mjs`（A18）是**续跑器不是启动器**，只在
  `.vima/go-state.json` 已存在且 `stopReason=in-progress` 时阻止停轮，而 `settings.json`
  从未注册 `SessionStart`——于是人不敲 `/go` 就永远不开工，会话却不会闲着，
  它会照着任务文件手写代码。sustain-v3 实测：并行度 8 的批次计划退化成单线程串行
  （约 34 秒/文件），79 个源文件落盘、零份 builder 报告、134 个任务 frontmatter 全 `pending`。
  - 新增 `.claude/hooks/go-autostart.mjs`：会话开在 DEVELOPING 期的 Vima 项目、
    有未完成任务、且没有其他会话在跑调度时，注入并发调度指令。
  - **注入而非执行**——调度正文仍以 `.claude/commands/go.md` 为唯一真源，不在 hook 里复制。
  - 放行优先：判据不成立/文件缺失/解析失败一律静默 exit 0；`VIMA_AUTOSTART=0` 可关闭；
    `resume`/`compact` 会话不注入；`go-state.json` 在 10 分钟内更新过则让位，避免两会话竞写热文件。
  - **仍属协作式控制模型**：它解决「没有人触发」，**不解决**「Agent 不遵守」——
    后者需 `H-ADR-01` 裁定为监督式才有运行时保证，不得宣称成「运行时调度」。

### 修复

- **`vima status` 的活动行不再让命令事件冒充任务轨迹（D-A39-01）**。`taskEvidence` 的
  `lastEventTs` 原本收下**任何** `kind` 的事件，呈现层却称之为「最近一条**轨迹**事件」。
  sustain-v3 实测因此显示「最近一条轨迹事件距今 6m51s（共 58 条）」，而这 58 条全是
  `cmd`（人敲的 `vima validate`）、`report` 0 条。现分离 `reportEvents`/`lastReportTs`，
  活动行只认 `report`；零轨迹时如实写明「journal 里的 N 条全是命令/规范事件」。
- **补 `no-trajectory` 信号，覆盖 `trustSignals` 的全零盲区（D-A39-02）**。原封闭集四条
  全部依赖「两个来源对不上」，`claimed = tracked = verified = 0` 时一条都不触发——
  恰恰是最该被看见的状态（代码在写，但没有人在记账）。新信号在
  「DEVELOPING + 零轨迹 + 开发期已进行 ≥10 分钟」时并列呈现事实：开发期时长、
  轨迹条数、非轨迹事件条数、`.vima/go-state.json` 的有无与 `stopReason`。
  沿用 D-A37-02**只呈现不裁定**，status 仍恒 exit 0。10 分钟阈值保证零假阳性。
- **分组表不再让人误加出一个超过总数的和**。三个切面（前后端 / 层 / 端）此前连排且
  只有 `— 按端 —` 一个小节标题，`business` 行还被省略，纵向读下来会得到
  54+78+2+4+2=140 而分母是 134。现三个切面各自带标题、各自合计等于总数；
  side 的标题由「按端型」改为「按前后端」，与 app 的「按端」一眼可分。

## [3.1.0] - 2026-08-15

### 新增

- **`vima status` 运行状态可观测（A37）**。此前「跑到哪了、还要多久」在仓库里没有
  任何一个位置能看到，只能人工翻四个文件交叉比对——立项实证是一次重建在 DEVELOPING
  期跑了 2h24m，21 个任务 `status: done` 而 **0 个有轨迹证据**，四份状态源
  （`lifecycle.taskStats` 说 0 / `batch-plan.json` 说 1 / frontmatter 说 21 /
  `journal.jsonl` 说 0）各说各话且没有任何一处会主动报警。
  - **证据强度三档进度**：`自称`（frontmatter `status: done`，Agent 写，可伪造）
    ≥ `有轨迹` ≥ `已验收`（后两者取 `journal.jsonl` 的 report 事件，post-write hook
    旁路采集；Agent 不能直改 journal，但报告输入仍由 Agent 产出，故不宣称独立防伪）。
    当前验收态取最新 verifier 结果；首次 pass 另存为 ETA 历史样本，任务重开或后续 fail
    不再残留为“已验收”。三档同屏并列，落差即信号。
  - **分组任务量**：按 side（前端/后端/全栈）、layer、A16 端册分别给出总数/自称/验收/待办，
    验收列与总表同口径取自 journal 而非 `status` 字段。
  - **用时取真时间**：`lifecycle.phaseHistory` 已落盘的时间戳；当前阶段用 `now − enteredAt`。
  - **ETA 拒绝无样本外推**：速率只用带真实 `ts` 的验收事件；样本 < 3 一律输出「不估算」
    并说明还缺几个，**不给一个看起来很像数字的数字**。可估时给
    〔最近窗口均速，全程均速〕区间并标注「假设并行度不变」；按 side 分别外推，
    某 side 样本不足则退回全局速率并如实标注依据。
    **刻意不用 frontmatter `updatedAt`**（D-A37-03）——它是 Agent 手写的，
    实测 68 条被盖成同一时刻、6 条超前真实时钟 1–3.5 小时，项目越出问题它越虚构。
  - **四个呈现口**：默认表格 / `--watch` 常驻（文件变化即重算、晚建目录动态补监听，
    每秒重绘并以低频全量读盘兜底）/
    `--json` / `--line` 单行。`settings.json` 注册 `statusLine: vima status --line`，
    跑 /go 的会话底部常驻一行进度；它同时是一枚 **cwd 探针**——会话开在非项目根时
    状态栏直接显示告警，正是上述实证里 2.5 小时无人察觉的那个故障。
  - **硬约束**：只写 stdout、不产出任何仓库内文件（落盘会引入第 4 个状态源，正是要治的病）、
    不接 `--out`/`--serve`（usage exit 3，不静默忽略）、**恒 exit 0**——差值只呈现不裁定，
    判定归 `doctor`/`converge`（D-A37-02）。`--line` 在数据/运行异常下也必须 exit 0 输出单行
    （参数用法错误仍为 exit 3），
    否则状态栏只会一片空白、探针失效。
  - 改判 A35/A36 的「不做实时刷新」（D-A37-01）：原禁令前提是「消费方只关心回看历史」，
    本项消费方是运行中的人。改判**只及于实时刷新**——交互式 TUI、服务进程、
    上报/联网/跨项目聚合仍然全部不做。
  - 落点：`lib/model/progress.mjs`（新建）、`lib/commands/status.mjs`（新建）、
    `lib/cli.mjs`（注册 + `JOURNAL_EXEMPT`）、`templates/admin/workspace/settings.json`、
    契约 §2/§5/§6.21/§12、`tests/unit/c2.status.test.mjs`（含当前验收、未来时间、容错任务、
    晚建目录 watch 等回归用例）。

- **四个 Claude Code project skills + `vima go` 启动器（A38 追认登记）**——解决「`/go` 找不到 / 不稳定触发」。
  - `.claude/skills/` 下安装 `go`、`check`、`design` 与全命令路由 `vima` 四个 skill，
    均带自然语言触发描述。`/vima <command> [options]` 为任意 CLI 命令提供统一命名空间，
    规避与 Claude 内置 `/doctor`、`/context`、`/help` 的名称冲突；路由以运行时 `vima help`
    与 `docs/lifecycle.json` 为真源，不复制一份会漂移的命令清单。
    `go`/`check`/`design` 三个 skill 读取 `.claude/commands/{go,check,design}.md` 的完整协议正文，
    防长工作流双真源漂移；三份 command 自身保留 frontmatter description 作降级发现面。
  - 每个 skill 校验 `${CLAUDE_SKILL_DIR}` 推出的项目根与 `${CLAUDE_PROJECT_DIR}` 一致，
    不一致即停止——不在错误 cwd 执行，也不得以手工读写模拟确定性 CLI。
  - 新增 **`vima go`**：从探测到的项目根启动全新 Claude Code 交互会话并自动发送 `/go`
    （`--commit` 授权批次检查点提交，`--dry-run` 只打印不启动）。它按 `currentPhase`
    分派、四个阶段通吃，是错误 cwd / 旧会话上下文膨胀 / 项目配置未加载的确定性逃生口。
    新增错误码 `GO_SKILL_MISSING`、`CLAUDE_NOT_FOUND`（均 exit 4）。
  - `vima doctor` ⑥ 升级为 **4 skills + 3 工作流正文 + 6 角色 + 3 hooks** 共 17 个文件，
    且不只查存在——解析四份 skill 的 frontmatter：description 非空、未被
    `disable-model-invocation` 关掉、项目根校验变量在位。存量项目 `vima update` 可补装。

- **稳定触发面收口（A38）**：把「稳定触发」拆成四层并逐层认领——**L0 会话锚定** /
  **L1 入口发现** / **L2 入口完整** / **L3 执行忠实**。同期落地的四个 project skills
  （`go`/`check`/`design`/`vima` 路由）、`vima go` 启动器、`doctor` ⑥ 的 skill 有效性体检
  覆盖 L1/L2，本项**追认登记**它们（此前反查不到任何 A#，违反「每处实现必须能反查到
  §N 或 A#」硬约束），并补上 L3 与 L0 的缺口：
  - **`AGENTS.md` 补三条跨工具红线**。此前 L3 的约束只写在项目宪法与四份 skill 正文里，
    而这两处**都是 Claude Code 专属**；读 `AGENTS.md` 的工具（Cursor / Codex / Jules）
    拿到的红线里没有一条说「确定性操作必须走 CLI」。新增：确定性操作一律调
    `vima <command>`（不确定先 `vima help`，点名 `sync`/`plan`/`validate` 三件最常被
    手工模拟的）；不手改任务 frontmatter 的 `status`/`updatedAt`；先确认工作目录是
    项目根并给出可自查动作（跑 `vima status`，显示「非 vima 项目根」就停下切目录）。
  - **`doctor` ⑬ 未来时间戳机检**（D-A38-03）：任务 `updatedAt` 晚于当前时钟（容差 5 分钟）
    → error 并**指名文件**。内核写 `updatedAt` 一律用真实时钟，未来值只可能是手写的
    ——这是「有人绕过 CLI 改了 frontmatter」唯一零假阳性的铁证，sustain-v4 实证里命中 6 次。
    不进 `validate`、不拦 `/go`（成因可能只是机器时钟不准）。被否判据：
    `taskStats.updatedAt` 对不上 journal 的 `sync` 事件——`.vima/reports/` 不进版本控制，
    换 clone 后必然假阳性（单测守着这一条）。
  - **L0 如实记为能力边界**（D-A38-01），不假装能修：会话 cwd 不在项目里时，
    skills / hooks / statusLine / 宪法全部来自项目 `.claude/`，一个都不加载，
    vima 在该会话内没有任何代码执行点。缓解只在入口侧（`vima go` 作为缺省启动路径，
    按 `currentPhase` 分派、四阶段通吃）与会话外（另开终端 `vima status --watch`，
    或用户自行把 `vima status --line` 挂进用户级 `~/.claude/settings.json`
    ——**vima 不代写用户级配置**）。README 记载了做法。
  - 顺带纠正 `docs/design/sustain-v4-truthsource-drift.md` 的一处表述：该文把
    「未走 `/go` 编排」记为既定前提，而会话轨迹取证显示那**不是选择、是故障本身**
    （transcript 全文 `/go` 出现 0 次、`Task` 调用 0 次，项目 `.claude/` 从未加载）。
    这条区分决定修复方向——若是「选择手工」该补劝导，既然是「入口不存在」补劝导无效。
    该文其余 8 条规划期缺陷的结论不受影响。

## [3.0.6] - 2026-08-15

### 变更

- **端命名去领域词：小程序端 `patient` → `mp`**（用户裁定）。`patient` 是医疗场景的
  领域词，泄漏进了通用工具的**默认端册**与全部示例；而同一份 `template.json` 里
  `h5` 是按**形态**命名的——同一处配置两套口径。现三端一律按形态：`admin` / `mp` / `h5`。
  落点：默认端册、CLI 全部示例、`create` 错误提示、workspace 资产、契约 §6 与
  增补项 A16/A23/A25 的规格示例。顺带去掉同类泄漏的示例项目名 `nutri` 与端 id `ph5`。
  **刻意保留**：`vima-experience-verifier.md` 的 Sustain 具名实证（改了就是篡改证据
  来源）、UI 库补丁记录里的 `/inpatient-order` 真实路由、`patientId` 作路径参数名举例。

### 新增

- **stable 模板真实构建守卫**：`scripts/check-stable-scaffold.mjs` 生成三端项目并跑
  真实构建（三端 `npm install` + `build:check`/`typecheck`/`audit` + 后端 Maven），
  接进 CI 与 `prepublishOnly`。后端初始口令改为环境变量注入
  （`VIMA_INITIAL_ADMIN_PASSWORD`），新增 `LoginAttemptService` 登录失败限流与
  `d3.scaffold-quality` 守卫用例。

### 改进

- **顶层 `help` 按生命周期分 6 组**（此前 24 条平铺，看不出「现在该用哪个」）。
  分组只影响呈现——命令集合真源仍是 `TOPICS`，漏进分组表的落「其他」兜底不静默消失。
- **拼错命令给近似候选**：`vima valdate` → 「你是不是要 vima validate」。复用 A8 T1-2
  的图标最近邻同款手法——此前**图标名**拼错有 3 个候选，**命令名**却只说「未知命令」，
  同一个仓库两套待遇；毫不相干时退回通用提示，不硬给。
- **12 条一览描述收进 80 显示列**，细节留在 `vima help <cmd>`。度量必须是**显示列宽**
  （中文占 2 列）——用码元或 `awk` 数字符会把 110 列的行判成合规，本轮初测就踩过。

## [3.0.5] - 2026-08-15

### 修复

- **`vima update` 让 `vimaVersion` 两处分叉，导致升级过的项目向公开 issue 谎报版本**
  （发布后验证 A19 升级可达性时抓出）。契约 §6.4 明文「lifecycle 与 manifest 的
  `vimaVersion` **同源于 CLI package.json**」，`init` 两处都写，而 `update` 只写
  `manifest.vimaVersion` 并打印「vimaVersion 已更新为 X」——`docs/lifecycle.json`
  原地不动。后果不止显示不一致：**A21 复盘指纹读的是 lifecycle 那处**
  （`retro.mjs`），于是每个升级过的项目产出的反哺 issue 都带着旧版本号，
  直接污染 A21 回路的版本维度；而 `doctor` 不对账这两处，分叉不会被体检发现。
  现 `update` 无条件同步 lifecycle（顺带**自愈已分叉的存量项目**），
  成功文案如实标注「两处同步」。lifecycle 缺失时静默跳过（创建它是 `init` 的职责）。

### 验证

- **A19 存量项目升级可达性实测通过**：用 npm 上的 3.0.3 建项目 → 本地 3.0.4 `update`
  → `post-write.mjs` 判为「未修改，随模板更新」被干净覆盖，journal 采集点 0 → 3，
  零 `.vima-new` 残留。**存量项目能自动拿到 A35 采集能力**，无需人工合并。
  （例外：早于 hook 纳管的 v2.0.0 时代项目因 manifest 无基线，走保守的人工合并路径——
  这是 `update.mjs` 的既定设计，非缺陷。）

## [3.0.4] - 2026-08-15

### 修复

- **journal 采集会污染任意目录（发版体检抓出，本轮引入即修）**：`lib/cli.mjs` 顶层的
  `root` 对非 `PROJECT_SCOPED` 命令（`create`/`upgrade`/`version`/`help`）恒等于 cwd，
  而采集判据写成了「root 非 null」——于是在**任意目录**里跑一次失败的 `vima create`，
  就会往那个目录扔 `.vima/reports/journal.jsonl`。实测已污染 vima-cli 仓库自身。
  判据改为「root 下确实存在 `.vima/`」——journal 是**项目产物**，判据必须落在
  「这里是不是一个项目」上。`init` 成功后 `.vima` 已建成，其事件正常落进新项目，行为不变。
  回归用例覆盖 `create`/`validate`/`doctor`/`version` 四条在非项目目录的路径。

### 新增

- **A35 过程轨迹 `journal.jsonl` 落地**（契约 §6.21）：全仓 20 个产物 schema 里此前只有
  1 个是事件流（`runtime-errors.jsonl`，且只覆盖浏览器报错），其余全是「最新快照」。
  本项给 A21 反哺回路补上时间维——立项理由不是新想法，是 `retro.mjs:353-357` 代码注释里
  早就写下的自认：「某规则曾命中后来被修好」在只有最新快照的报告体系里不可得。

  - **两个采集口，全程零 Agent 配合**：`lib/cli.mjs` 出口漏斗（**三个返回点全覆盖**）记
    `cmd` 事件；`post-write.mjs` 记 `report`（子代理报告落盘，位置在早退门之前）与
    `guard`（三处 `exit(2)` 之前）事件。
  - **采集口径**（D-A35-01）：失败全记 + 成功仅白名单，且排除明确声明「不写盘」的 flag。
    `retro` **刻意不在白名单**（D-A35-12 自我豁免）——否则 A21 的「连续两次 retro 字节一致」
    判据当场失败。
  - **五键封顶**（`ts`/`kind`/`ref`/`outcome`/`n`），`kind` 与 `outcome` 为封闭集，
    单行 ≤ 1024 字节（POSIX 下 10 个 Builder 并发追加仍原子，D-A35-04）；
    `guard` 的 `ref` 是 `post-write.mjs` 内的**封闭枚举**，禁止拼接命中现场——
    journal 流向 retro，而 retro 产物要贴进公开 issue（D-A35-10）。
  - **默认开启**，`VIMA_JOURNAL=0` 关闭（D-A35-07）；**不进退出码、不进任何校验规则**
    （D-A35-05）；写失败一律吞掉，绝不改变命令退出码。
  - **消费**：`vima retro` 新增「过程曲线」节（命中→修复曲线 / 验收轮次形态 / 失败命令分布）
    与观察项 `OBS-guard-late`；`vima render-journal` 新增 ⑦ 过程轨迹区。
    两个消费方共用 `lib/model/journal.mjs` 的 `loadJournal` / `journalMetrics`。
  - **修正 A35 规格的一处遗漏**：A35 边界说明只排除了 `--check` / `--dry-run`，漏了
    `update --scaffold-diff`——它同样明确声明不写盘，且由全项目指纹用例守着零写盘承诺。
    现改为按「声明不写盘的 flag 一律排除」，并加**行为守卫用例**扫帮助面逐个实跑，
    防止将来新增只读 flag 时再次静默踩雷。

- **A36 过程轨迹视图（`vima render-journal`）**：给已有的溯源数据补上人类审核窗口。
  出自用户要求「不仅要有可溯源功能，同时要有人类审核窗口 UI」（2026-08-15），
  范围由用户当场裁定收窄为**只读**（不做批准按钮/本地服务）+ **只做 DEVELOPING 过程视图**
  （不动既有六视图 / `--check` / approve 闸门）。

  - **新产物 `.vima/reports/journal.html`**（契约 §11.1）：六区单文件 HTML——
    阶段时间线 / 任务台账（只列重试·failed·blocked·running 残留）/ 验收点位 /
    集成对账 V-INT / 规则命中分布 / 运行时与代码溯源，底部给出该敲的命令。
    骨架复用 `planning/review.template.html`，不新增骨架文件。
  - **抽出 `lib/model/journal.mjs` 归集器**（契约 §5）：`collectReports` / `phaseDurations` /
    `readJsonSafe` / `tally` / `V_INT_RULES` 从 `retro.mjs` 移出，由 `retro` 与
    `render-journal` 共用（D-A36-02：抽取由「出现第二个真实消费方」触发，非提前抽象；
    A35 W3 的 journal 聚合也落这里）。**`retro` 行为零变化**——`c3.retro.test.mjs`
    12 个既有用例零修改通过。
  - **与规格类产物三点刻意不同**（契约 §11.1 决策表 D-A36-01，均为必然而非疏漏）：
    ① 产物落 `.vima/reports/` 随数据源一并被 gitignore，不落进版本控制的 `docs/review/`；
    ② 含时间戳，但全部取自输入文件已落盘的字段，渲染器不读系统时钟，字节确定性不破；
    ③ **不提供 `--check`、不进 doctor 的 render-drift 体检**——过程数据每推进一个任务就变，
    漂移机检会恒红。与 **D-A33-01** 同源同向。
  - **改判 A35 一条**（D-A36-03）：A35「不做仪表盘 / TUI / `vima journal` 命令」的理由是
    「消费方只有 retro 一个」，A36 引入第二个消费方后前提不成立。改判**只及于
    「单开一条只读渲染命令」**；仪表盘、TUI、实时刷新、服务进程仍全部不做。
    契约 §12 的 A35 条目「消费方只有 retro」同步改。


### 修复

- **A34 落地后收口三条（C-A34-01/02/03）**：对视觉轨道做对抗性复核，发现三处「机制建成了，
  但 A34 自己声明的意图没有执行者或没有可见性」。三条均反查得到 A34 既有决策，
  **不新增字段、命令与阶段**。

  - **C-A34-01 「全项目声明 D0」曾是闸门看不见的降级通道**。`suggestFidelity` 的判据本就
    确定性可算，但结果只打在 `vima design status` 的 stdout 上：`design-check.json` 无此字段，
    `vima approve` 完全不消费（`grep -c suggest lib/commands/approve.mjs` = 0）。
    实测——给黄金夹具 PAGE-01 的表格块加 `data.shape: chart`（判据 ⇒ D1）而声明保持 D0，
    `design check` 六项派生全绿 exit 0 并打印「全页 D0：跳过 DESIGNING 发散轮」。
    于是 A34 要治的 G2 只是从「不写 fidelity」换成了「全写 D0」，**成本从零变成几行字，
    闸门端可见性仍然是零**。现 `deriveStates` 产出 `fidelitySuggestions`，进
    `design-check.json`（含 `counts.fidelitySuggestions`）与 `vima approve` 的
    DESIGNING→DEVELOPING 闸门输出。**恒不阻断**——D-A34-03 明确「首次裁定时人可选任意级别，
    机器建议仅供参考」，升为 error 会直接违反该决策；这里要的是 A5 诚实分级的可见性。
    **未批准页的降级由本条一并覆盖**（尚未 `design approve` 时改低 fidelity 无
    `downgradeWaiver` 可留痕，但必然表现为「声明级 ≠ 判据建议级」），故不另设降级日志。
  - **C-A34-02 `design check` 在任意阶段都返回「六项全绿」**，与 approve/verify/reconcile 的
    `PHASE_TRANSITION` 守卫不一致；在 PLANNING 期拿到全绿极易被读成「设计已完成」。
    报告增 `gateApplies`（= `phase === 'DESIGNING'`），非闸门阶段 stdout 显式标注
    「预览，不是闸门判定」。**不加硬前置**——预览缺什么是正当用法，堵死它是另一种伤害。
  - **C-A34-03 「Agent 不得自行选定胜者」无执行者也未登记**。它是 A34 抗同质化的主杠杆，
    但 CLI 只能机检方向交付物齐全，分辨不出选择出自人还是 Agent。按 A6「落不到 L1/L3 的
    才上 L5」**显式登记〔L5·人审〕**（契约 §6.2 阶段推进事件表 + `vima-designer.md`），
    并要求 `selection.md` 写清用户口径而非 Agent 推荐结论。不登记就是又一条
    「有措辞、无执行者」——正是 A34 立项要治的病型。

- **A34 的 D1/D2 实质链路补端到端覆盖**：黄金夹具全页 D0，走的是 `d0Only` 空真路径，
  DESIGNING 被确定性跳过——「方向包 → `design approve direction` → 逐页稿 →
  `design approve pages` → `design check` 真检 → DEVELOPING 收口 `design verify`」
  这条 A34 的核心链路此前**只有单元测试，端到端零覆盖**。新增 e2e ⑪ 用独立工程走全程，
  并在两处闸门各验一次「真的会咬人」：缺稿时 `design check` exit 2 报 V-DSN-09；
  缺验收报告时 `design verify` exit 2 报未覆盖；补齐后转绿；改设计稿后旧报告判 stale。

- **certify 的 converged 级不再采信过期报告（A32 D-A32-05）**：`checkConverged` 原先只读磁盘上的
  `.vima/reports/convergence.json` 判 `errors=0 && openPoints=0`，既不重跑也无 stale 检测——
  报告生成之后 spec/契约/任务/代码再变，仍按旧报告认证为已收敛。同一文件里 `implemented` 级
  对视觉证据早已是「重算 + 要求缓存与重算一致」（A34 D-A34-31），converged 级漏了同一标准。
  现 `converge.mjs` 拆出只读评估器 `evaluateConvergence(root, {cliRoot})`（`run` 退为
  「调评估器 + 写盘 + 打印」，行为不变），certify 复用它重算并与磁盘报告逐字节比对；
  不一致即判过期、如实报缺。评估器抛 `VimaError` 时不使 certify 崩溃（exit 恒 0）。
- **spec 里缺 `id` 的 `vima:page` 块不再静默消失（V-SPEC-03）**：`loadSpec` 会丢弃无 id 的 page 块，
  而 validate 的 ID 唯一性检查对 `undefined` 直接早退，缺 id 校验又只覆盖弹窗/区块（V-DSN-11）——
  结果是「写了页面、机检全绿、渲染无此页」。现按原文块逐块校验并附开栏行号，
  `validatePages` 的复用方（render-review / render-prototype）一并受益。
- **契约 §3 项目根定位口径对齐 §4**：正文仍是 v2.0 的「含 `docs/lifecycle.json` 或
  `.vima/manifest.json` 的**当前目录**（不向上递归查找）」，而 A24 的 `findProjectRoot`
  与 `NOT_IN_PROJECT` 早已改为**逐级向上**查找 `.vima/` 或 `docs/lifecycle.json`，
  代码与 §4 一致、只有 §3 正文残留旧定义。已改正（文档修正，代码无改动）。

## [3.0.3] - 2026-08-14

### 新增

- **视觉真源的兑现机制（增补项 A34）**：Sustain 用 vima 重建后「页面变死板」的取证结论是——
  管线里的视觉轨道**有承诺、无兑现、降级零成本、且即便看见稿也无权实现**。三条实测病根：
  ① `design-links.md` 被 3 份程序资产引用而 `lib/` 命中数为 0（无模板、无 init 落点、无机检消费方）；
  ② planning-guide 明写「只做 Stage A、不做 Stage B：**合法**」，`_template-fe.md` 允许写「无稿」；
  ③ `_template-fe.md` 禁止页面自写 `display: grid` + builder「实现即判越界 fail」，
  使「页面级独特构图」无验收加分、有越界风险，Agent 选保守实现是**理性最优解**。
  本项按 vima 自己的 A6（每条规范有唯一执行者）/ A5（诚实分级）/ A2（单一真源）补齐三件套：

  - **保真分级**：PDL 增 `design.fidelity` ∈ {D0,D1,D2}，**V-DSN-12 强制显式声明**
    （`designCapability: legacy` 存量项目整体豁免）——D0 是一次明确裁定，「缺失」不等价于 D0。
    另增 `primaryTask`（D1/D2 必填）与**带类型的** `mustPreserve`
    （`{id,kind,statement,verifier}`，kind↔verifier 强制相容，V-DSN-11）——
    「配置与预览同步」「切换患者不重挂载」无法靠截图裁定，**类型即执行者路由**。
    `pattern` 增 `custom`（V-DSN-10：必带 intent + D2），承认某些页面就是独特的，
    好过继续扩枚举（10 词词表仍装不下三栏设计器）。
  - **Builder 三层授权**：锁定层（字段/API/权限/规则/能力/范围，擅改即 fail）+
    遵循层（D1/D2 照稿含 mustPreserve）+ **自由层**（页面级 grid、图表化、微交互、
    page-local CSS）。关键措辞：**不得把稿里的图表/消息流/画布/时间线/实时预览降级为
    表格或 textarea**。新增领域组件层 `src/features/<domain>/components/`（页面任务只读消费，
    只能提 `componentExtractionRequest`；**不进 `sharedDirs`**）。
  - **DESIGNING 阶段**：PLANNING →（`vima approve --planning`，**独立校验 profile**，
    不要求 V-TASK/V-COV——任务拆解发生在设计冻结之后）→ DESIGNING → (`vima approve`) → DEVELOPING。
    checklist **只有 2 个持久键**，其余 6 项一律派生不落盘（落盘即与 `designApproval` 双真源）。
    全页 D0 的项目确定性跳过发散轮。**存量项目不倒退阶段**（A19 可达性）。
  - **新命令 `vima design`**：status（只读派生索引 INDEX.json，`--check` 验漂移）/
    check（DESIGNING 出口，V-DSN-09 + 六项派生，**不看任何实现期报告**）/
    verify --prepare（先生成报告作者所需 digest，解开报告与摘要的循环依赖）/
    verify（DEVELOPING 收口，报告矩阵 + 三个 digest 的 stale 判定）/
    approve / invalidate / **reconcile**（受控回写环：复用 A31 已导出的 `computeImpact`，
    但用 DESIGNING 口径闸门——直接复用 `change close` 会因「要求任务全 done」而死锁）。
    **零网络零浏览器**：Claude Design MCP、无头浏览器、截图冻结全部落 workspace 资产
    （`vima-designer` 子代理 + `/design` 命令），`lib/` 保持平台中立与零运行时依赖。
  - **三类验收**：Semantic（既有）+ Design Reviewer（专抓**表达降级**）+
    Experience Verifier（D2 真跑 `primaryTask`，**做不完即判失败**，兑现 A7 从「长得对」到「跑得通」）。
    报告契约落 `.vima/reports/{design,experience}/<PAGE>.json`，**三个 digest 的计算范围入契约**
    （不定范围则实现者必在「hash 整库 ⇒ 全部 stale」与「只 hash 页面目录 ⇒ 共享组件变化不失效」
    之间二选一）。`/go` 5.2.6 升级为收口硬门，**只消费 `vima design verify` 的汇总结果**。
  - **批准摘要驱动失效**：`lifecycle.designApproval` 按端存 directions、按页存 pages，
    连同 spec 与设计目录摘要——改稿或改 spec 即自动失效，复用 A12 既有新鲜度机制的同一模式。
  - **`vima certify` 扩面**：`implemented` 级增采报告矩阵（不新增等级）——
    否则 certify 会把「视觉一次没跑」的项目评为 pipeline-green，正是 A34 要治的假成功换了个地方。
  - **Stage A0 三方向发散**：治「确定性推导产不出惊喜」——A30 的风格推导是确定性函数，
    同一输入恒得同一输出，用在产品气质上必然得中位解。三方向**按端各一张**标志性页面，
    交付物含差异矩阵（只交三张静态图，「方向」很可能只是三套配色），**Agent 不得自选胜者**。
    设计系统从**获胜实例反向提炼**（先有优秀实例、再抽象规则，顺序不能反）。
  - **新增 userOwned 资产** `docs/interaction-language.md`：Stage A 的第二个产出，
    条目**不得凭空写**（只许来自获胜实例反推或 `vima retro` 反哺），每条带执行者。

  **宣称边界（A5）**：本项建立的是创新**发生与存活**的机制，不保证每次设计都优秀。
  Sustain 四页黄金样本通过前，只宣称「具备承载与保护创新设计的机制」，
  不得宣称「vima 已具备稳定产生优秀设计的能力」。
  取证与六轮评审收敛全过程见 `docs/design/sustain-vima-visual-regression-{analysis,solution}.md`。

- **维护期变更事务（增补项 A31，`vima change`）**：维护期变更纪律此前是纯散文协议
  （CLAUDE.project.md 工作协议 + 设计 §13.4），「影响了谁 / 重开哪些 done / 重跑什么 /
  传播完没有 / 差异与批准记录在哪」五问无一可机器回答。新命令五个子命令：
  `open`（spec/契约逐字节基线快照，单变更在途，再开 → CHANGE_ACTIVE exit 4）→
  `impact`（结构化 diff → 受影响页面/接口/规则/任务，reasons 逐条留痕；impact.json
  无时间戳字节稳定）→ `apply`（受影响的 done 任务重开为 pending，调用即授权）→
  `close`（传播闸门：受影响任务全 done + 进程内 validateProject 零 error + 有任务/接口
  影响时进程内 converge 通过，否则 CHANGE_UNPROPAGATED exit 2）。影响面推导全部复用
  既有确定性 join（页面归属 / A18 `ownedApisOf` 负责集 / A13 规则接口交集）。
  同时兑现 `ai-scaffold-benchmarks.md` T2-8（OpenSpec delta 语义，自此以 A31 为唯一规格）；
  与 A20「不做缺陷台账状态机」的边界论证见 v2.1-amendments A31（对象是需求变更事务
  而非机检缺陷，状态迁移由机器闸门判定，无手工宣称位）。
- **交付等级认证（增补项 A32，`vima certify`）**：「进入 MAINTAINING」常被读作「完成」，
  而它只证明 converge 零 error + pipeline done。新命令做只读证据聚合：四级阶梯
  `spec-approved → implemented → converged → pipeline-green`（每级证据取自磁盘既有真源，
  convergence.json 附 sha256），deliveryLevel = 自底向上连续满足的最高级，缺口输出为
  「下一级缺什么」的可执行清单；**显式不宣称** deployable/stable（vima 不采集部署与
  运行期证据——PACT 八级模型「声明八级、落地零采集」的教训对症吸收，不搬八级）；
  模板成熟度（A5 `status`）与项目交付等级双轴分离展示，词面混淆用产物澄清。
  exit 恒 0（评估不是闸门）；不写 lifecycle（等级由证据推导，不落第二状态真源）。
- **业务闭环主视图 + flow 引用机检（增补项 A33）**：flows 是 spec 数据块中唯一
  零引用校验的块——写 `page: PAGE-99` 的流程此前能通过全部规则。新增 **V-SPEC-17**
  （error：步骤声明的 role/page/next/api 引用闭环 + 流程须有非空 steps）与
  **V-SPEC-18**（warn：步骤角色未拥有该步页面的菜单 → 不可达提示）；审计视图新增
  **第⑥视图「业务闭环」**：逐流程回答「用户够得着吗（入口可达性徽标）/ 状态真的变吗
  （接口命中的 transition/calculation 规则）/ 结果查得到吗（终点页 GET 查询出口）/
  谁承接实现（页面 + 接口负责集 join 任务）」，缺口如实标注。渲染 model 增 `tasks`
  切片（契约 §11；刻意不含 status——运行态入渲染产物会把 A12 新鲜度机检搅成常红，
  D-A33-01）。不新建产物文件、不把 flows 塞进 prototype.manifest.json（无消费方即镀金）。
- **设计工序两段化 + 产品风格取向（增补项 A30）**：A29 的逐页整页稿缺一致性机制
  ——N 个页面就是 N 次独立的版面决策，而稿是云端非确定性产物、不进机检，壳层与
  密度的漂移无从检出。改为两段（兑现 A27 延后项 P28 / 提案 §12.1 的 R2 角色）：
  - **Stage A 版面语言**（全项目一次）：每个 `design.pattern` 出一张模式参考页
    （**本项目真实字段名 + `vima mock` 数据 + 空态**，不得用通用示例）→ 人审定版面
    → **固化进仓库**：版面类落 `src/styles/layout.css`、刻度取值落 `src/styles/tokens.css`、
    模式库条目落 `docs/design-language.md`。云端稿到此作废——草稿纸不是产物。
  - **Stage B 逐页内容稿**：只决策内容区（选 pattern、块怎么排、字段取舍、空态、
    动作主次），**不动壳层 / 间距刻度 / 卡片形态**；确需新版面走 `sharedChangeRequest`
    回 Stage A 收编，不在页面里自写 `display: grid`。
  - **风格推导方法论**（D-A30-06/07）：新增模板键 `planning.designLanguage` → init
    安装 `docs/design-language.md`（**userOwned**，update 永不覆盖）。它不是一套配好的
    主题，是一套**推导方法**——预置 N 套行业主题既穷举不完，又会诱导「挑一个最像的」
    而非按项目事实推导，而即兴正是本项要治的病。风格被拆成两层：
    - **不变层**（8 条，不参与推导）：不用渐变顶栏与网格底纹 / 描边优先于投影 /
      语义色同明度带 / 标题字重 ≤700 / 数字 `tabular-nums` / 单一品牌色 /
      深色只作锚不作全局 / 不下载 webfont。一句话骨相「克制的专业工具感」。
    - **可变层**：§2 八项**观察量**（值守模式 / 决策时效 / 使用环境 / 受众 /
      主导数据形态 / 交互设备 / 行业默认色相 / 色彩禁忌）**从 spec 与契约读，
      读不到就问，只能推断的标 `pendingConfirm`**——直接复用 planning-guide 第 3 节
      「信息源分级，默认禁推断」纪律，不另起一套；§3 八条**推导规则**映射到七条
      取向轴（五条原轴 + 深色锚 + 底色温度）；§4 三条**色彩判据**（行业语义取色相、
      与该行业老系统默认色相相距 ≥30°、语义色反推同明度带）。
    - 另含 §5 可 grep 的旧信号清单、§6 六条自检判据（对比度 / 明度带 / 色相距离 /
      深锚占比 / 旧信号 / 触达尺寸，**刻意不做成 CLI 规则**）、§7 定档产物与规则冲突
      裁定位、§8 三份已推导范例（冷光临床 / 深空控制台 / 磐石政务，**标注各自观察量
      输入与推导过程，且显式禁止直接套用**）。
    - **换肤可行度订正**：A27 曾以「库侧 186 处裸值，换令牌只能换 2/3」延后主题。
      逐文件复核后订正——`shell.css` 1386 行仅 1 处裸色值、39 处令牌引用且全走
      `color-mix()` 派生，**外壳与业务页可 100% 换肤**；真正卡住的只有组件圆角
      （库零 radius 令牌）与 16 个类的 Ant 遗留状态色。全深色主题确实不可行
      （`ui.css` 141 处浅色裸值）——故「深色只作锚」写成准则而非偏好。
  - **go.md 5.2.6 回修分流**：版面级不一致（间距刻度 / 版面骨架 / 卡片形态）回
    Stage A 改真源一处修全站，页面级不一致派回本页任务；`_template-fe.md` 增
    「所属 pattern」行。
  - **零 schema / 零机检 / 零渲染器改动**（D-A30-05：主观取向机检不出来，假机检比
    没有更坏）；`lib/` 仅 init 安装清单加一条落点。降级两级：Claude Design 不可用时
    Stage A 回落为直接按取向轴调令牌 + 线框评审；只做 Stage A 不做 Stage B 亦合法。
- **Claude Design 视觉真源工序（增补项 A29）**：carelink-admin 试点实证定案——
  A27 结构机检守「不坏」，视觉上限改由 **Claude Design 逐页高保真稿**负责：
  PLANNING 末逐页出稿（真实字段 + 样例数据 + 空态）并登记 `docs/review/design-links.md`，
  DEVELOPING 按稿 1:1 实现（`_template-fe.md` 新增设计稿登记行），/go 收口新增
  **5.2.6 设计稿校准轮**（版面冒烟归零后逐页截图对照稿校准样式不一致，修复走回修
  通道再复跑冒烟）。开启说明（`/design consent` / claude.ai/design/settings）与
  未接入时的如实降级口径写进 planning-guide 第 8 节；线框/PDL/七探针原样保留守
  结构下限，机检面一分不减。纯工序资产，零内核改动；d2 防漂移断言随全量。
- **create 布局对称化（增补项 A28，改判 D-A16-03）**：端册布局一律 `apps/<id>/`——
  含单端（此前 N=1 落项目根、后补端才进 `apps/`，得到「永远搬不动的混合布局」）。
  唯一决策点在 `buildRoster`，全部消费方按端册 `dir` 数据寻址、零改动；
  存量根布局（`dir "."`）与混合布局**永久合法**，init（A19 存量升级）继续如实写
  `"."`，不提供迁移命令。单端黄金夹具迁至 `apps/admin/`，存量寻址分支由
  c3 系列手写根布局夹具专职覆盖。
  - **项目根卫生资产（D-A28-04）**：新增模板键 `root.scaffold`（`scaffold/root/`）——
    端全落 `apps/` 后项目根不再有端骨架顺带提供的文件；项目级 `.gitignore`
    （`backend/target/`、`.vima/reports/` 等跨端规则只有在根才生效）与项目 README
    （前后端启动/账号/结构导览，自 admin 前端骨架迁入并按 apps/ 布局改写）由此补位，
    与 create/A19 骨架基线同源拷贝；admin 前端 `_gitignore` 相应减负为端内规则。

- **Design-First 第一批落地（增补项 A27）**：把「设计」升格为与契约同级的真源——
  七轮专题讨论（评估 `frontend-layout-quality-assessment.md` + 方案
  `frontend-design-first-proposal.md`）的第一批实现，全部条目反查五个实测症状。
  - **PDL 页面设计语言**（契约 §7，全部可选、声明即承诺——缺省行为与现状逐字节一致）：
    页面级 `design: { pattern, density, fold }`；区块 `name` / `intent` /
    `data: { shape, of, keyFields }`（shape 六枚举含 freeform 显式逃生舱）；
    **操作附着点 `actions`**（贴宿主块标题行，不再为一个按钮独占一条 70px 横带——
    实测 17/50 页面如此浪费首屏 7.4%）；动作 `priority: primary|secondary|overflow`；
    分栏列 `role: primary` 与局部 `density`；弹窗 `presentation: drawer`（4 处「抽屉
    被迫降级成弹窗」的最小修复）。**规格零像素**：放不放得下由框架与探针判定。
  - **V-DSN 校验族**（§8）：01 声明完整性 / 03 同词多例实例名 / 04 形态枚举与 freeform
    意图 / 05 优先级与「一页一个 primary」/ 06 收纳提示 / 07 首屏承诺引用闭环 /
    08 列表信息优先级。`actions` 条目并入既有全部交互校验与任务计点。
  - **L0 线框渲染器 shape 驱动升级**：保真度改由 PDL 数据驱动——`list` 画 keyFields、
    `record` 画字段组、`metrics` 画指标环、`timeline`/`chart`/`freeform` 各有画法，
    「三列渲染成三个一样灰盒」终结；块标题行渲染 name+intent+附着动作（primary 实心、
    overflow 收 ⋯）；页头渲染 pattern/density/首屏承诺徽标；admin 词表 +3
    （`steps`/`collapse`/`anchor`，sustain-v3 实测 19% 降级页里真正缺的三个结构词，
    四处词表同源同步）；抽屉弹窗右滑呈现。字节确定性与 --check 逐项保持。
  - **`vima mock`**（§6.16）：契约 → `.vima/mock/contract-mock.json`，8 类型 8 条固定
    规则、四档数据量（default/empty/many/long——空与超长恰是暴露版面缺陷最有效的两档）、
    分页判定只看契约声明；两跑同字节；无契约 → NO_CONTRACTS exit 4 不写空文件。
    **mock 必须由契约生成不得手写**：假数据字段名与真实接口一字不差。
  - **demo 态 + 页面画廊**（admin 骨架）：`npm run dev:demo` 免登录注入 `perms:['*']`
    演示用户（否则 v-auth 让按钮批量消失）、request 适配器接管为契约 mock
    （`?__mock=` 切档）、`/__gallery` 全部业务页 × 三视口 × 四数据档一屏看全
    （业务页判据 = 路由名 ∉ 骨架内置集，零新增配置）；生产构建静态消除，产物零泄漏。
    h5 骨架同享 mock 分支；mp 通道显式延后（wx.request 无 dev 中间件路径）。
  - **版面冒烟七探针**（§6.17，默认 Kimi WebBridge，`npm run smoke` 为 Playwright 回退）：横向溢出/页底空洞/裁切/大间隙/
    刻度合规/控件重叠/动作行意外换行，三视口 × 全部业务页，报告按 route 归组进
    A20 修复轮；两通道共用 `layout-probe.mjs`，报告记录 `source`；均不可用时**不写报告**
    （空报告会被读成「跑过且零问题」）。
    /check 增「版面冒烟」栏、/go 步骤 5.2.5 默认执行 Kimi WebBridge 通道。
  - **admin 骨架版面层**：`src/styles/layout.css` 版面原语
    （split/master/workbench/board，窄屏自动塌单列）+ 密度档
    （`.vui-density-compact/loose` 重定义 `--v-gap-*`，「刻度的语义」）+
    `ActionGroup.vue`（按密度档自动收纳溢出动作，compact 2 / default 3 / loose 4）+
    登录页 26 处装饰裸值收编为具名局部令牌；ui-docs 新增
    LayoutPrimitives/Density/ActionGroup 三份。
  - **post-write 版面纪律**：业务页禁裸尺寸（gap/padding/margin/font-size 的 px；
    「再紧一点」的正确动作是换密度档）、禁覆写页面根类 height/overflow；
    admin/h5 按 data-page 判定，mp 按 sibling wxml 判定；并显式写明
    **「本 hook 不检查、也永远不会检查『是否使用了组件』」**（组件是形态的一种实现，
    不是设计的单位）。
  - 规划资产：planning-guide 终点清单 C 增**设计五问**（内容/数据形态/读者场景/
    高频交互/首屏承诺，答案直接落 PDL 键）；spec 模板示例带 PDL；checklist 镜像
    V-DSN 七条；coding-standards admin 端补六条版面纪律。
  - 显式延后（A27「不做与延后」）：库侧令牌化收敛与行为层抽取（源仓库不在本机）、
    主题 P18–P20（被库侧卡）、mp demo 通道、词表 schema 文件化（价值已由 shape 吸收）。

- **小程序端企业 UI 框架自研 `vima-ui-mp`（增补项 A23，改判 A16 的 D-A16-02）**：
  用户在「vendored Vant Weapp / 自研 / 纯 Vant」三条路里裁定自研。
  裁定前做了三处可提取源的量化比对——`juvenile-guard` 小程序（微信原生、34 页、
  `design.wxss` 1215 行 / 89 个 `ds-` 类、跨页高复用）、Sustain 历史提交里的
  `sustain-mp`（Taro4+Vue3、22 页，但 `app.scss` 只有 59 行 / 5 个类，样式全散在
  8311 行页面私有样式里）、Sustain 的移动端原型设计画布（全内联样式、零类名）。
  结论：**可提取的框架资产只有第一处**，后两者贡献的是适老化、患者端信息架构与
  卡片/指标卡形态。
  - 框架落 `templates/admin/scaffold/mp-native/src/vendor/vima-ui-mp/`：
    **112 个 `.vm-*` 类 + 75 个 `--vm-*` 令牌，零 JS、零依赖、零自定义组件**（64 KB；
    作为对照，`@vant/weapp@1.11.7` 是 1.9 MB / 468 文件）。行为一律用微信原生能力
    （`wx.showToast`/`showModal`/`<picker>`/`<switch>`/原生 `tabBar`）。
  - 在提取源之上补齐了词表要求而它没有的能力（`actionbar`/`popup`/`upload`/`switch`/
    `textarea`/`metrics`/`body`），并**收编 `kv-*`**——它在提取源里被引用 111 处却从未
    进设计系统，散在 9 个页面 wxss 里各写一遍。
  - 适老化 `.vm-aging`：只重定义字阶令牌，**后加的类自动跟着适老**（提取源
    `sustain-mp` 的 `.aging` 是逐类覆写，加类即漏）。
  - 备选主题 `themes/clinical-blue.wxss`：取值来自 Sustain 原型画布的实测色频统计。
  - 类名闭包机检（`tests/unit/c4.ui-mp.test.mjs`，**不设白名单**）：令牌双向闭包、
    类集合 ↔ ai-manifest ↔ 组件文档 ↔ `componentMap` 四向锁死、骨架不许现编类名、
    三处必要的裸色值豁免（`page` 底色 / `<switch color>` / `tabBar` 配色）取值必须等于
    对应令牌。
- **mp-native kind 转 stable（A16 Wave 2 交付）**：微信原生 + TypeScript 骨架
  （`utils/request.ts` 门面是 V-CODE-01 的前提）、28 份组件文档 + `CAPABILITY.md`、
  `componentMap` 词表映射、`coding-standards.md` 按端分节、`post-write` 的 `.wxml`
  区块对账与裸色值机检、miniprogram-automator 版 A7 采集器
  （工具不在场时**不写空文件**——空证据会被读成「跑过且零错误」）。
- **`vima app add` / `vima app list`（A16 Wave 3）**：端册可变。
  存量单端项目后补端形成**混合布局**（既有端留在项目根 `dir "."`，新端落 `apps/<id>/`），
  同步落账 A19 骨架基线与 init 的 managed 清单；重复 id → `APP_EXISTS` exit 4。
  这条路以前只能手改 `.vima/manifest.json`。
- **h5-mobile 端（增补项 A25）**：H5 由空壳独立模板收编为 admin 模板的第三个 kind，
  并回答了 A16 挂起的「h5 是否收编」。框架 `vima-ui-h5` **与小程序端共用同一份类契约与
  令牌**——`ui.css`/`tokens.css` 由 `.wxss` 版按「`wxss` → `css` 全局替换」一一对应，
  单测锁死（令牌挂在 `page, .vm-page` 上，`page` 在浏览器里是合法但匹配不到的选择器）。
  只为「小程序有而浏览器没有」的四件事加组件：`VmNavbar` / `VmTabbar` / `VmToast` /
  `VmDialog`（其余全用原生标签）；`global.css` 装浏览器侧独有的 reset、`::placeholder`、
  `100dvh`、`:focus-visible`、开关外观。骨架为 Vue 3 + Vite + TS，请求门面形状与另两端
  一致——**V-CODE-01 一条正则通吃三端**。参考源为 CareLink（26 页 / 11 组件 / 65 令牌）。

- **开发完成后的收敛期（增补项 A20）**：出自用户反馈「全部批次开发完成后还会有很多
  小问题，比如冲突或者错误」。核实确认两处缺口——① 现有全部校验的作用域都是
  「单任务对自己」，并行批次产出的**漏实现 / 重复实现 / 越界实现**三类冲突全部漏网；
  ② `layer=pipeline` 收尾流水线在规划期根本不会被生成（`templates/admin/planning/`
  下 `grep -rn pipeline` 命中数为 0），致 `/go` 步骤 5「流水线全部通过」的进阶条件恒真，
  **全量测试与代码审计从未被执行过**。
  - 新增 **`vima converge`** 跨任务集成对账（确定性、零 token、只读）：
    **V-INT-01** 接口零实现（error，仅当负责任务全部 done 时判，开发中途跑不假红）、
    **V-INT-02** 同一接口在 ≥2 个后端文件重复实现（error，运行期路由冲突）、
    **V-INT-03** 实现越出 A18 `apis` 责任田（error）、**V-INT-04** 契约授权端无调用
    （warn）、**V-INT-05** 缺 pipeline 收尾任务（error）；同时收口既有红信号
    （Verifier 未过点位、运行时错误、done 无 `@vima` 标注）。
    报告 `.vima/reports/convergence.json`（契约 §6.13），其中 **`byTask` 是修复调度的
    确定性输入**——谁的问题派回谁改，主 Agent 不自行判断归属。
  - `/go` 步骤 5 由「直接进 MAINTAINING」改为**收口闸门**：converge → 按 `byTask` 归组
    增量修复（V-INT-02/03 类串行修，多任务争用同一处实现并行修就是边修边冲突）→
    重跑，最多 3 轮 → pipeline 批次 → MAINTAINING。收敛循环**不是停点**（延续 A17/A18
    反停顿纪律），3 轮未收敛才停轮交用户裁定（`stopReason=gate`）。
  - 补上收尾流水线任务模板 `_template-full-test.md` 与 `_template-code-audit.md`
    （进 `planning.taskTemplates`，由 init 安装 / update 交付），planning-guide 第 5 步
    新增「收尾流水线任务必须一并生成」，`/check` 增集成对账栏。
  - 新增 **V-TASK-13**（warn）：存在 business 任务却无 pipeline 任务——设计期早提示
    （不阻断存量项目开工，守 A19 升级可达性），收口期由 V-INT-05 升级为 error。
  - **不做**：git 合并冲突处理（单工作树 + 批粒度串行提交的调度模型结构上不产生
    merge 冲突，用户所指「冲突」的真实形态是跨任务实现冲突）、缺陷台账状态机
    （报告是每次扫描的确定性快照，不引入 open/fixed 手工状态与豁免后门）、
    框架结构规则下沉 `lib/`（守 A18 分层边界）、自动修复（改代码仍走
    Builder → 独立 Verifier 通道）。
- **工具可信度与项目定制（增补项 A24）**：`docs/design/sustain-v3-field-feedback.md` 剩余建议
  的**核实版**落地——13 条里核出 1 条能力早已存在、1 条已被 A18 默认值消解、2 条落点判断需修正。
  - **【P0】项目根感知**：CLI 不再按当前目录静默工作。新增 `findProjectRoot`（向上找含
    `.vima/` 或 `docs/lifecycle.json` 的最近祖先），项目内命令锚定项目根；找不到 →
    `NOT_IN_PROJECT`（exit 4）**且不写任何文件**。
    **本条从原文的 P2「人机工程」升为 P0**：实测在 `backend/` 下跑 `vima validate` 得到
    「2 错误」（项目根实为 0 错误），**并把 `pass: false` 落盘到 `backend/.vima/reports/`**
    ——其余缺陷都是漏检，这条是**误报成事实并持久化**，磁盘上的错误报告之后会被人或 Agent
    当权威读取。`create`/`upgrade` 不参与；`init`（首次初始化）与 `doctor`
    （「非 vima 项目只跑两项」是其声明过的降级能力）保留各自的「无项目」语义。
  - **【P1】V-TASK-11 只对可调整的任务生效**：`status=done` 的任务不再触发拆分建议。
    **本条从 P2 升为 P1**——它不是体验问题而是**规则可信度问题**：A22 新增的
    V-SPEC-15/V-CON-08/V-CON-09 全是 warn 且需人逐条看，warn 列表里躺着一批**永远无法清除**
    的条目（实测 9 个已完成任务）会训练出「整个 warn 列表不用看」的习惯，把 A22 一起废掉。
    只豁免本条：V-TASK-07/08/09 在任务完成后仍可执行，不适用。
  - **【P1】`docs/coding-standards.local.md` 项目追加区**：`vima context` 打包时一并分发，
    **不入 manifest、不受管、doctor 不校验**。受管的 `coding-standards.md` 是唯一随 context
    分发到每个任务的规范文件（实测中成了止血最有效的落点），代价是 doctor ⑧ 长期报
    「受管文件被手改」——本节让项目定制不再污染受管基线。
  - **并发写策略与 `conflictsWith` 引导**：核实发现`conflictsWith` **A8 起就已实现**
    （`plan.mjs` 切批时保证互斥任务不同批），实测中的绕法（把 API 封装塞进视图目录、
    违反编码规范、事后人工合并）本可一行避免——**这是「已有能力对使用者不可达」**，
    故成本从「新增功能」降为 planning-guide + 编码规范各一段官方口径（追加不覆盖 /
    要整体重写就用 conflictsWith 排开）。
  - **冷启动断言口径**：**从原文 P1 降级为 pipeline 验收项**——判据需要跑起真实数据库与种子，
    超出确定性内核（离线、无运行时）的边界。价值由一句固化口径保留：
    「**不要只测『种了几行』，要断言『A 跑完后 B 能解析出全部 N 条』**」，进 `_template-full-test.md`。
  - **go.md 两处文字**：合法停点举例补「依赖未满足且无其他可派批次」（**不新增
    `stopReason` 取值**——A17 白名单③已覆盖该语义，`gate` 够用）；预算段补
    「`--max-parallel` 与预算 24 不整除时实际生效值是 `floor(24/N)*N`」（默认 8 恰好整除，
    调成 5 则只推进 20——这也是原 F7 在默认配置下已不存在的原因）。
  - **`vima retro` 补正面信号**：A21 只采集异常（重试/冲突/豁免/越界），没有一项记录
    「哪个机制救了你」——长期只积累「该改什么」、从不积累「该保留什么」会导致对已验证设计的误改。
    新增确定性的 `worked.retriedThenDone`（重试后仍做成的任务数），其余走 issue 正文
    新增的人工必问第 3 问；**不硬造其它确定性正面指标**（「某规则曾命中后来被修好」在只有
    最新快照的报告体系里不可得，强行推断会产出假数据）。
  - **修 stdout 被管道缓冲区截断**（落地本项时用自己的验收判据撞出来的既有缺陷）：
    `bin/vima.mjs` 用 `process.exit()` 立即退出，而管道上的 stdout 写入是异步的——
    `vima context --stdout | grep` 在**恰好 8192 字节**处被腰斩且**不报任何错**，
    `converge/retro/plan --json` 在真实项目上同样会被截断。改为 `process.exitCode`
    让 Node 自然退出（事件循环排空时 stdout 已 flush，退出码语义不变）。
    与项目根感知是同一类失效——工具静默给出错误答案，只是发生在输出侧。
  - **不做**：值级溯源 V-SRC-02（障碍不是判据复杂，而是**需要此前不存在的枚举/种子锚点**；
    参照 V-SRC-01 至今需配置才启用、多数项目没配，做了大概率不启用）、F5 的
    `vima fix-round` 登记（A20 回测已封掉造假 taskId 的危害，追溯已闭环）、
    新增 `stopReason: blocked-by-barrier`、把冷启动检查做成 CLI 规则、
    给 `coding-standards.local.md` 做模板（一给模板就又变成需要同步的受管资产，回到原点）。

- **字段级机检 + 上下文两条检索线（增补项 A22）**：出自
  `docs/design/sustain-v3-field-feedback.md`（73 任务 / 19 契约 268 端点 / 50 页面 /
  707 处 `@vima` 标注的完整开发期实测）。**立项前提**：这些缺口全部是在 `doctor` 全绿、
  `validate` 0 错误的前提下由人或 Builder 实地撞出来的——此前全部规则都停在**引用级**
  （页面 apis ⊆ 契约、菜单功能点 ∈ 契约、代码路径 ∈ 契约），**没有一条查到字段级**。
  - **V-SPEC-15**（warn）弹窗字段 ↔ 提交入参**双向**对账：正向弹窗必填字段须能提交上去，
    反向端点必填入参须有地方填。实测 4 条功能级阻断——缺 `scaleType` 导致「量表根本创建不了」；
    连带查出退款审批 `refund()` 原先没有 `decision` 参数、一律按同意处理。
    **缺的那个字段往往正是某个业务判断的输入，字段缺失意味着那个判断根本没发生。**
    三条实测排除项一条不少：submit 指向 GET 的弹窗跳过、路径参数跳过、
    存在未声明子结构的 json 聚合入参时该端点整体跳过（原始脚本三版给出 54 → 32 → 13，
    前两个都是误报）。**恒为 warn**——定位是候选清单，不是判决。
  - **V-CON-08**（warn）字段三桶对账查「只进不出」：`create`(POST 入参)/`update`(PUT 入参)/
    `read`(GET 响应) 中只出现在写面的字段 → 「新建能填、之后查不到改不了，且不报错」。
    实测同一个错犯了三次。**只查「只进」方向**——反方向的 id/createdAt 是纯噪声
    （实测在 4 接口夹具上就产生 3 条误报），豁免走新增的 `writeOnly`/`readOnly` 显式标记。
  - **V-SPEC-16**（error）跨页导航参数取值域闭环：页面用 `params: [{name, values}]` 声明
    唯一取值域，`action: nav` 用 `params: {…}` 携带。实测三个跳转入口全是坏的、
    目标页对未知 key 静默落兜底分支且不报错，而**每个页面单看都自洽、只有跨页对照才暴露**。
    不携带 params 的 nav 完全不触发——规则由声明主动开启，存量项目零影响。
  - **V-CON-09**（warn）聚合 json 子协议：`type: json` 须带 `fields` 子结构或显式
    `enforced: false`（内部零约束时写入方/读取方/后端计算方各写各的，运行时「存进去了但算不对」）。
    同名聚合字段在不同 module 子结构不同时只提示同名不同义、**不判错**。
  - **`vima context` 新增两节**：**系统底座接口索引**（无 `@vima` 标注代码 = 底座/共享层，
    列其导出名与请求路径）与 **spec 指名的 `docs/raw/` 真源片段**（带行号取前后各 20 行）。
    实测最大的系统性返工源——Builder 把契约当唯一事实来源，「契约里没写」=「系统里没有」
    ⇒ 把底座已有的科室/用户列表判为不存在、下拉框空着、指派退化成自分配；
    更严重的一次是 spec 正文写着「真源为 `docs/raw/…:行号`」，Builder 仍然没去看，
    因为上下文包里没有它。
  - **顺带修 V-YAML-01 误报**：`params: { … }` 与 `fields: [{ … }]` 是合法标准 YAML 的
    嵌套 flow 集合，原判据把 depth>0 的任何 `{` 都判为「未加引号的花括号」——
    本项两个新语法会系统性触发。改为看 `{` 前的首个非空字符：位于值位（`:` `,` `[` `{` `-`）
    是集合起始，放行；嵌在标量里（`/api/x/{id}`）才是规则本来的目标。
  - **不做**：F3 的代码侧对账（页面模型里没有路由路径，做不了 `router.push` 目标页反查，
    另行立项）、F1 升 error、F2 的「只出不进」方向、聚合字段强制统一子结构、
    把底座索引做成全量代码索引、把 `docs/raw/` 全量塞进上下文包。

- **经验反哺回路（增补项 A21）**：出自用户提议「开发完成后弹交互问是否把项目经验反哺到
  vima-cli，同意则提 issue/PR」。立项理由是 A18 与 A20 都走了**同一条路径**——真实项目
  跑完 → 人工写评估文档 → 立项，而这条回路全靠自觉、证据要事后手工重建
  （A18 的并行槽空转率是翻 `@vima` 标注逐任务统计出来的，A20 的缺口是事后 grep 才发现的）。
  项目跑完那一刻磁盘上恰好躺着最完整的一手证据，过后即散。
  - 新增 **`vima retro`**（离线、只读、**默认脱敏**）：确定性采集任务重试分布 /
    failed·blocked / `apis` 声明率 / 批次形态 / V-INT 各规则命中 / Verifier 轮次与任务点
    （未过·豁免·NG 越界）/ 共享层变更请求 / **validate 规则命中分布**（哪条规则最常被违反
    = 框架引导最缺的地方）/ 运行时错误 / 规格规模计数；按**静态阈值表**输出观察项
    （OBS-xx），每条附**指向框架资产的建议落点**。产物 `docs/retro/vima-feedback.md`
    （issue 正文）+ `.vima/reports/retro.json`，同源渲染、同一输入字节一致
    （阶段时长取 `phaseHistory` 落盘时间戳，不读系统时钟）。
  - **默认脱敏**：只含计数与分布，不含任务/接口/页面标识——vima-cli 是公开仓库而使用它的
    常是客户项目，泄露必须是显式动作（`--with-ids`）。
  - `/go` **新增步骤 6**：切 MAINTAINING 那一刻问一次（早了没数据，晚了人已离场），
    并追问两个 CLI 采不到的问题——① **有没有想表达但框架表达不了的东西**（历次增补项
    A14 分栏版面、A16 多端应用模型都出自这一问）② 哪一步最费时间／最反复；同意则
    `gh issue create --repo vima-tech/vima-cli`，`gh` 不在场时降级为打印命令而**不静默失败**；
    拒绝后写 `.vima/retro-state.json`，不再重复骚扰。
  - **不做**：CLI 联网或代为提交（守「`vima upgrade` 是全仓唯一联网命令」）、自动提 PR
    （守「不执行真实 git push」，跨仓写权限不该由项目侧 Agent 持有）、跨项目聚合上报服务、
    让 Agent 自由写「项目总结」（不可验证、不可跨项目比较，攒不成阈值决策需要的分布）。

- **A20 回测修正（同批）**：落地当日独立复核查出 13 处问题并全部修复——3 处真缺陷
  （converge 在非 vima 项目**凭空产报告并 exit 0**；责任田只认 `side=backend` 导致
  `fullstack` 任务整体逃过 V-INT-01/03；go.md 步骤 3 会**绕过收口闸门直接派 pipeline 批**）、
  2 处 A18/A19 遗留漂移（README 仍写并行 ≤5 与「批后自动 commit」、doctor「九项」）、
  8 处镜像与覆盖缺口。详见 `docs/design/v2.1-amendments.md` A20「回测修正」表。

- **表单校验错误态进框架**：新增 `.vm-error` 与 `error` 修饰（作用于 `vm-input` /
  `vm-textarea` / `vm-picker`）。此前文档只能教人内联写红色，等于把颜色决定权散回每个页面
  ——`form` 是冻结词表里的词，「填错了怎么显示」是它的必然组成。
- **h5 骨架补 `utils/auth.ts`**：与小程序端对称的票据存取（此前散在 `request.ts` 里直接读
  localStorage，且没有「票据怎么来是业务」的引导）。

### 修复

- **create 骨架遍历排除 `target/`（A28 顺带）**：模板源被本地构建污染时（如在模板目录
  跑过 `mvn test`），构建产物会连着进生成项目与 A19 骨架基线（carelink-admin 实测中招
  3 条，已一并清理）。与既有 `node_modules` 排除同口径。
- **`vima context` 两处半截实现（A23 顺带）**：`componentsOfPage` 对 `page.modals` 硬编码
  注入 `VLayer`、对弹窗字段类型写死内置表，两处都绕过了 `componentMap` 这个映射真源
  ——mp 端的弹层是 `VmPopup`，写死等于该端弹窗切片恒空。改由 `componentMap.modal` 决定；
  admin-web 不声明 componentMap，回落 `VLayer`，行为逐字节不变。
- **A7 运行时证据在多端布局下静默丢失（A25 顺带，A16 W1 遗留）**：admin 骨架的 vite
  中间件直接用 `server.config.root` 落盘，而 N≥2 时该端在 `apps/admin/`，证据被写进
  `apps/admin/.vima/reports/`，`/check` 与 `vima converge` 只看项目根那一份。
  改为**先向上定位含 `.vima/` 的最近祖先**并按端命名 `runtime-errors[.<appId>].jsonl`。
  A16 §6 早写明「不得假设 dev cwd 即项目根」，当时只在 mp 侧兑现。
- **post-write 对 h5-mobile 端套用了 admin-web 的规范面**（A25 自查）：h5 业务页正确写成
  `<div class="vm-body" data-page="...">` 却被报「页面根缺少 vui-page 类」——**把对的说成错的**，
  每个 h5 页面写完都会被错误拦截。改为按 kind 分派规范面：admin-web 查 `vui-page` 与 VIcon、
  mp-native 查 `.wxml` 的 `vm-page`、h5-mobile 查 `.vue` 的 `vm-body`/`vm-sheet`，
  并给 h5 补上它自己的两条（禁深路径导入 `vendor/vima-ui-h5/dist/*`、禁原生
  `confirm()`/`alert()` 改用 `'@ui'` 的 `confirmAsync`）与 `.vue` 内裸色值机检。
- **`coding-standards.md` 缺 `## 端规范：h5-mobile` 节**（A25 自查）：`vima context` 按
  kind 切片时该端匹配不到任何节，h5 任务只拿到通用段——**零前端规范且不报错**，静默降级。
  已补 2338 B 端节（页面根契约 / 请求门面 / 样式令牌 / 浏览器端五个坑 / 自检命令），
  并加单测断言「每个 kind 都必须有端节且通用段不夹带端专属内容」。
- **`lib/commands/validate.mjs` 混入一个字面 NUL 字节**（`'\0'.repeat()` 被写成真 NUL），
  致整个文件被 `file`/`grep` 判为 binary、默认静默不匹配，排查时极易误判「代码里没有这段」。

## [3.0.2] - 2026-08-13

### 新增

- **批次调度效率（增补项 A18）**：sustain-v3 实测评估
  （`docs/design/batching-efficiency-assessment.md`）落地，触发 A17 自留的重开条件。
  实测证伪两个直觉归因——构建不是瓶颈（前端 `build:check` 2.82s / 后端
  `mvn compile` 1.34s），工作量也不是（总生成量 120 分钟是硬成本）；真因是
  **不均衡造成的空转**：子代理内部严格串行、批次时长取批内最大值，单任务最大
  4527 行 = 同批最小任务的 7 倍，三个业务批实测并行槽空转率 52–54%。
  - 任务 frontmatter 新增可选 `apis` 负责接口集（缺省 = 契约全集，向后兼容）；
    新增 **V-TASK-11**（warn，负责接口数 > 10 提示按子域拆分）与 **V-TASK-12**
    （error，⊆ 契约 / 同契约 backend 任务不重叠 / 全声明时并集齐全）；
  - `vima context` 按 `apis` 切片契约（人读小节 + 机读块同步过滤），Builder 只看自己那份；
  - `vima plan` 新增 `--max-parallel <1..10>`（默认 5 → **8**，越界 `PLAN_PARALLEL` exit 2），
    batch-plan.json 每批新增 `level` 字段——同 layer 同 level 的批次之间无依赖，
    主 Agent 可流水线化派发（上批 Verifier 与下批 Builder 同轮，2N 轮 → N+1 轮）；
  - 新增 Stop hook `.claude/hooks/go-continue.mjs` + 状态文件 `.vima/go-state.json`：
    主 Agent 每次结束回合前落盘停因，hook 只在 `stopReason=in-progress` 时阻止停轮并
    注入续跑指令，合法停点（budget/terminal/gate/user）放行，连续续跑 5 次兜底放行。
    **推翻 A17「不用 Stop hook」**——其否决理由「hook 无法区分合法停点」在停因机读化后不再成立。

### 新增

- **存量项目升级可达性（增补项 A19）**：回答「已有项目能否通过 `vima update` 升到最新功能
  而不影响原有程序」。核实结论——**主体已实现**（update 的受管清单里代码文件命中数为 0，
  实测一个改过 210 个代码文件的项目跑 update 后代码树指纹完全一致），补齐剩余三处缺口：
  - **manifest v1→v2 端册迁移**：兑现契约 §6.4 早已写下却从未实现的宣称（sustain-v3 跑了
    两次 update 仍是 v1）。**保护面不得因迁移变弱**：guard-shared 对 v1 走内置字面量兜底、
    写入 apps 后改走 v2 分支且不再回退，故后端共享层按模板声明渲染并**逐个校验目录在位**，
    缺一个就整体放弃迁移（保持 v1 兜底），不静默降级。
  - **`vima doctor` 第 ⑫ 项「产物形态与当前规则的差距」**：四条判据（A4 决策表 /
    A13 `vima:rules` / A13 `vima:non-goals` / A2 前端任务 `page`），级别与对应 validate
    规则对齐。与 validate 的分工——validate 说「缺什么」并阻断 `/go`，⑫ 说「这是哪个增补项
    引入的、补在哪一章、块长什么样」。`docs/spec.md` 未生成时跳过，不误伤新项目。
  - **骨架基线 + `vima update --scaffold-diff`**：`create` 在 manifest 记录
    `files.scaffold`（落盘内容哈希，219 个文件约 18KB）；`--scaffold-diff` 按三方比较输出
    「可安全更新 / 需人工」两类，**只报告、零写盘**（实测跑前跑后全项目指纹一致）。
    无基线的存量项目如实说明能力边界，不猜。渲染逻辑与 create 落盘同源
    （`resolveScaffoldEntries`），不留两份会漂移的实现。

### 修复

- **模板新增受管文件到不了存量项目**（A18 第 8 条）：`vima update` 原先只提示不装，
  而 `settings.json` 已被更新成引用新 hook —— 产出「配置指向不存在文件」的破损状态。
  现按与既有文件同一套三方比较处理：磁盘无 → 安装并登记（hooks 带可执行位），
  磁盘有且等于模板源 → 采信登记，磁盘有且不同 → 写 `.vima-new` 人工合并。
  项目形态由 manifest 新增的 `install: {minimal, skipScan}` 判定（init 写入；旧 manifest
  按已记录文件确定性反推：无 `docs/` 条目 = minimal，有 `docs/` 无 `docs/ui-framework/`
  = skip-scan），`--minimal` 项目不会被灌入 docs/ 资产。
- **`vima init --force` 会清空项目状态**：原实现无条件重写 `docs/lifecycle.json`，把
  DEVELOPING 打回 PLANNING 并丢掉 taskStats/phaseHistory/tasksApproved（在 sustain-v3
  上实测发现——它正是 update 提示的补救命令）。现改为**状态不是生成物**：已存在则保留
  并提示「保留既有状态（未重置）」，managed 生成物照常重建。
- **`vima init` 清空 create 写入的端册**（A16 多端在正常路径上就是坏的）：init 整体覆盖
  manifest，把 `apps`/`backend` 与 schemaVersion 2 一起抹掉，resolveApps 退化为合成的
  单端册，doctor ⑪ 因此误报「代码目录不在位」。现改为**合并写**，既有键原样保留。

### 变更

- **/go 会话预算 8 → 24 个任务**（A18）：前提是 `vima-builder` / `vima-verifier` 角色模板
  新规定回传摘要 ≤ 15 行、明细一律落 `.vima/reports/`，使每任务的编排上下文成本有界。
  预算耗尽的续跑提示改为「**先 `/clear` 再 `/go`**」——同一会话里重输 /go 不重置上下文，
  原提示下预算形同虚设。
- **批次检查点提交改 `/go --commit` 显式授权**（A18 取代 A17「/go 即授权」）：不带该 flag
  时**完全不碰 git**，报告也不再输出「未形成回滚点」噪声。实测 sustain-v3 至今 0 个提交
  ——A17 口径长期被用户环境级提交禁令压制而从未生效，授权点必须显式可见才不冲突。
- **前端任务默认依赖改为仅 `shared-base`**（A18）：契约先行的必然推论（前端验收清单只有
  「字段与契约一致 + build:check」，不含任何后端运行时依赖）。旧默认把全部前端任务锁到
  后端之后，实测使 18 个批次里多出一半。planning-guide 与 `_template-fe.md` 同步。


## [3.0.1] - 2026-08-13

### 变更

- **/go 批间连续性（增补项 A17）**：修复真实项目反馈的「每个批次执行完即阻塞、
  需再次输入 /go 才续跑」。三处停顿源对症落地：
  - 会话预算从「3 个批次或 8 个任务先到为准」改为**单一任务计数**（8 任务/次，
    批次数不设上限）——shared/pipeline 串行批每批仅 1 任务，按批计数会在 3 个
    任务后过早截断，而预算防的编排者上下文成本只与任务数成正比；
  - 批次检查点提交补**授权口径**：用户输入 /go 即构成对全部检查点提交的明确授权，
    不逐批征询（消除与「未经明确要求不得提交」类环境规则的每批一撞）；提交仍被
    拒绝时跳过并注明「未形成回滚点」，不中断调度；
  - 新增**合法停点白名单**：预算耗尽 / 全部任务终态 / 闸门或 failed 需用户裁定 /
    用户中断之外，批次之间不得停轮等待。
  仅工作区文字资产（go.md、CLAUDE.project.md）与设计文案（§7.5/§10.2）变更，
  零文件格式/模块接口变更；d2 新增防漂移断言。

### 新增

- **多端应用模型 Wave 1（增补项 A16）**：一后端 × 多前端成为一等公民——
  「营养诊疗 = 院内后台 + 患者端小程序」这类系统可在同一项目内完成规划与机检闭环。
  - **端册**：`.vima/manifest.json` 升 schemaVersion 2，新增 `apps[]`/`backend`
    （唯一真源，新增 `lib/model/apps.mjs` resolveApps 统一解析，v1 自动合成兼容）；
    admin 模板 template.json 改 `apps[] + backend + planning.kinds` 新形态
    （kind 词表/分栏能力/原型外壳/成熟度配置化，含 mp-native 定义，status=preview）。
  - **创建**：`vima create --apps <id:kind,...>`（N=1 落项目根不变、N≥2 落
    `apps/<id>/`；preview kind 入册跳骨架可先行 PLANNING；逐端 npm install；
    新模板变量 `{{appId}}`）；`--force` 重跑不再清空 manifest（新码 TEMPLATE_MISMATCH）。
  - **机检**：新增 V-SPEC-13（端归属/nav 同端）、V-SPEC-14（端覆盖）、
    V-CON-07（consumers 授权闭环，spec/代码两级拦越权）、V-TASK-10（任务端归属）；
    端化 V-SPEC-04（per-kind 词表）/V-SPEC-08/V-SPEC-12（regions 门控）/
    V-CON-03（谁消费谁承接）/V-CODE-01（端册扫描 + 越权调用）/V-COV-01（矩阵端列）。
  - **人审**：原型逐端渲染（`prototype.<appId>.html`，mp-native 375px 手机壳 +
    tabbar 外壳 + list/banner/detail/actionbar 词渲染；`--app` 单端重渲）；
    manifest 统一为顶层 `apps` 映射（§6.7）；审计视图单文件按端分组 + 端徽标；
    render-matrix 多端首列「端」。
  - **接线**：guard-shared/post-write 双 hook 保护面与机检面读端册（v1 字面量回退）；
    trace/context（按端组件文档 + componentMap + 规范 kind 切片）/doctor（新增
    ⑪ 端册完整性，PLANNING 期骨架缺失仅告警不假阻塞）/approve（逐端新鲜度 +
    修复 cliRoot 缺参导致的词表误报）/sync（任务表端列）全部端册化。
  - 新增双端黄金夹具 `tests/fixtures/golden-multi/` 与多端 e2e 链路；
    单端项目全链路行为与产物保持不变（黄金夹具回归全绿）。
  骨架资产（微信原生 mp-native scaffold、vendored Vant Weapp、automator 版 A7）
  与 `vima app add/list`、update v1→v2 迁移分别属 Wave 2/3，见 v2.1-amendments A16。

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
