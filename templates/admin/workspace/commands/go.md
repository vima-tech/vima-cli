# /go 命令

## 触发条件

用户输入 `/go`，或在 DEVELOPING 阶段说「继续开发」。

**参数**：`--commit`（A18）——带此参数才允许执行批次检查点 git 提交；不带时
**完全不碰 git**（见步骤 3「批次检查点」）。

## 执行流程

### 1. 状态检查与三道校验闸门（产物质量不靠 Agent 自觉）

- 读取 docs/lifecycle.json（缺失则提示先执行 `vima init`，终止）。
- 若 currentPhase = PLANNING，依次通过三道闸门：

  **第一道：机械校验（确定性，零 token）**
  运行 `vima validate`。它按 docs/planning-validation/validate.checklist.md 检查：
  产物结构完整（spec 九章齐全、契约接口五要素齐全）；引用闭环（spec 页面接口 ⊆ 契约、
  无孤儿契约、契约必有前后端任务成对引用、dependsOn 引用的 taskId 都存在）；
  taskStats 与 frontmatter 对账。exit 非 0 → 输出缺失清单，终止 /go，交用户处置。

  **第二道：语义抽查（Verifier 子代理，只读）**
  派发 vima-verifier 子代理抽样核对产物与 docs/raw/ 原文的一致性（契约字段、spec 章节
  是否遗漏/失真）。覆盖率策略：每个模块至少抽 1 处；超过 10 个页面的项目页面样本
  覆盖率 ≥ 30%；**所有标记 pendingConfirm 的推断项全检**。
  发现问题 → 回到 PLANNING 修补对应产物，对失败模块重新抽查直至通过；
  抽查明细写入 .vima/reports/planning-validation.json。

  **可选深模式：冷读门（A3，用户说「深度校验」/「深检」/「冷读」或 spec 首次进评审时执行）**
  派发一个零知识子代理，提示词明确三要素：只读 docs/spec.md 与 docs/contracts/*.md；
  不读 docs/raw/、不读对话历史、不读代码；输出 ① 一份实现计划 ② 一份「动工前必须
  得到答复、否则只能靠猜」的必问问题清单，逐条注明不问的后果。
  问题数 > 0 = 规格存在漏洞（信息只存在于对话记忆而未落盘）。问题清单由主 Agent
  呈给用户逐条裁定：属规格遗漏 → 回 PLANNING 把答案补进 spec/契约，重跑
  `vima validate` 后再过本闸门；属可推断项 → 在对应 YAML 条目标
  `pendingConfirm: true`（approve 时统一裁定）。

  **第三道：用户评审已落痕**
  检查 lifecycle 的 checklists.PLANNING.tasksApproved 是否为 true（该位只能由
  `vima approve` 机械置位，approve 内部会阻断未确认的 pendingConfirm）。
  未置位 → 提示用户在浏览器核对 docs/review/index.html（审计视图）、
  线框原型（单端 docs/review/prototype.html；多端项目为逐端 docs/review/prototype.<端id>.html，A16）
  与 docs/coverage-matrix.md 后运行 `vima approve`，终止 /go。

  三道全部通过 → currentPhase 切换为 DEVELOPING 并记录时间（phaseHistory 追加）。

- 若 currentPhase = DEVELOPING：进入断点续跑模式（见步骤 4）。

### 2. 任务分析（CLI 确定性，主 Agent 不自行拓扑计算）

- 运行 `vima plan`：CLI 扫描全部任务 frontmatter，按 layer 与 dependsOn 拓扑排序，
  输出批次计划到 .vima/reports/batch-plan.json，含环检测——发现依赖环即中止报错。
- 计划结构：shared 任务每个单独一个串行批 → business 任务按依赖拓扑分层并行批
  （单批 ≤ `maxParallel`，默认 **8**，可用 `vima plan --max-parallel <1..10>` 调整）
  → pipeline 任务串行收尾。
- **每个批次带 `level` 字段（A18）**：同 layer 同 level 的多个批次之间**没有任何依赖**
  （它们是同一拓扑层因并行度上限被切开的子批），这是步骤 3 流水线化派发的确定性判据。
- 主 Agent **只照计划派发，不自行计算批次划分**（确定性操作不留给概率性行为）。

### 3. 批次调度（核心循环）

- **共享层批次先写令牌**（§10.7 策略二）：派发 layer=shared 批次前，写入
  `.vima/shared-write-token`（内容为 ISO 8601 过期时刻，取当前时间 + 30 分钟）；
  本批验收完成后**立即删除**该文件。业务批次不写令牌——guard-shared.mjs 会对
  共享目录写入一视同仁地拦截。
- **派发当前批次**：先对批内每个任务运行 `vima context <taskId>`（A8 确定性上下文
  打包——任务/契约/页面块/组件文档切片/编码规范汇编成单文件），再在同一轮回复内为
  批内每个任务各发起一个 vima-builder 子代理 Task 调用（同一轮多个 Task 调用 =
  并行执行），派发指令中把 `.vima/context/<taskId>.md` 列为**第一必读**；
  派发前把任务 status 置 running。
- 等待本批全部 Builder 返回结果摘要，逐任务派发 vima-verifier 校验。
- **同层子批流水线化（A18）**：批次计划里 `layer` 与 `level` 都相同的多个批次之间
  **没有任何依赖**。对这类相邻子批，允许在**同一轮回复内**同时发起
  「上一子批各任务的 vima-verifier」与「下一子批各任务的 vima-builder」——
  把 2N 轮压到 N+1 轮。跨 level、跨 layer 的批次边界仍是硬屏障，不得越过。
  校验强度不变：每个任务照样走完整的 Builder → 独立 Verifier，只是轮次重叠。
- 逐个处理结果：
  a. Builder 成功且 Verifier 通过 → frontmatter status 置 done；
  b. Verifier 不通过 → 重试，**最多 2 次**。重试采用**增量修复模式**：
     重新派发 vima-builder，指令中明确要求先读 .vima/reports/<taskId>-verifier.json
     的上轮报告，只修复报告指出的问题，不得重写已有代码；每次重试 retryCount +1；
  c. 2 次重试仍失败 → status 置 failed，其依赖链上的后续任务全部置 blocked，
     **其他不受影响的批次继续执行**。
- 每次状态变化同步回写任务文件 frontmatter（status/retryCount/updatedAt）
  与 lifecycle.json 的 taskStats。
- **批次检查点（A18 授权口径，取代 A17）**：
  - **不带 `--commit`**：**完全不碰 git**——不执行 commit、不尝试、报告里也不输出
    「未形成回滚点」。用户的环境级提交禁令与本命令因此不再冲突。
  - **带 `--commit`**：`/go --commit` 即构成对本次运行全部批次检查点提交的明确授权，
    本批处理完成后执行 `git commit -m "vima: batch <N> completed (<k> tasks)"`，
    不逐批征询；若环境规则/权限仍拒绝提交，跳过本次 commit、在批次报告中注明
    并**继续调度下一批**——提交受阻不是停点（回滚点是增强件，不是推进的前置条件）。
- **sharedChangeRequest 处理**（§10.7 策略三）：Builder 结果摘要声明
  sharedChangeRequest 时不得代其直接修改共享层；由主 Agent 创建一个共享层
  补偿任务（layer=shared），插入当前批次结束后**串行执行**（补偿批同样走
  写令牌流程）；受影响的已完成任务由主 Agent 评估是否补发 Verifier 复查。
- **会话预算（A18，按任务计数）**：单次 /go 最多推进 24 个任务，批次数不设上限
  ——预算防的是编排者上下文过载，成本与任务数成正比（每任务一份 Builder 摘要 +
  一份 Verifier 报告），与批次数无关。阈值从 8 放大到 24 的前提是**回传摘要已有界**
  （角色模板规定 ≤ 15 行结构化结论，明细一律落 `.vima/reports/`）。重试不另计。
  **预算与并行度的整除关系（A24/F7）**：预算按任务计数，而派发按批次成组——两者不整除时
  最后一批装不下，实际生效值是 `floor(24 / maxParallel) * maxParallel`。默认 maxParallel=8
  恰好整除（24÷8=3 批）；若调成 `--max-parallel 5`，实际只推进 20 个任务而非 24。
  调整并行度时留意这一点，不要把「少推进了 4 个」误判为调度出错。
  达标后落盘全部状态，提示用户 **先 `/clear` 再 `/go` 续跑**——批间状态已全部落盘
  （frontmatter + lifecycle.json + reports/），新会话从断点恢复零损耗；
  在同一会话里重输 /go 不会重置上下文，预算就形同虚设。
- **合法停点白名单（A17 反停顿纪律，A18 增加机读落盘）**：批次之间不得结束回合
  等待用户。本命令唯一允许的停点：① 会话预算耗尽；② 全部任务达终态
  （无 pending/running）；③ 确定性前置失败或闸门阻断需用户处置（lifecycle 缺失、
  vima plan 依赖环、三道闸门未过、断点续跑中 failed 任务裁定、**收口闸门 3 轮未收敛**、
  **依赖未满足且当前无其他可派批次**——如 pipeline 任务依赖尚未收敛的批次，跨 layer 屏障
  未开、确实无事可派，此时写 `stopReason=gate` 停轮等用户裁定即可，**不要反复声明「继续派发」**）；
  ④ 用户主动中断。
  批次完成、检查点提交受阻、sharedChangeRequest 补偿批插入、**收口闸门的
  converge → 修复 → 重跑轮次（A20，步骤 5）**均不是停点——同一回复内继续推进。
- **停因落盘（A18，必做）**：**每次结束回合前**把停因写入 `.vima/go-state.json`：

  ```json
  { "schemaVersion": "1", "phase": "DEVELOPING", "stopReason": "in-progress",
    "consecutiveResumes": 0, "updatedAt": "<真实 ISO 时间>" }
  ```

  `stopReason` 取值：`in-progress`（调度未完成——不该停，写这个值）／
  `budget`（预算耗尽）／`terminal`（全部终态）／`gate`（闸门阻断需用户裁定）／
  `user`（用户主动中断）。`.claude/hooks/go-continue.mjs`（Stop hook）读它判定：
  `in-progress` → 阻止停轮并注入续跑指令；其余四值 → 放行。
  **每成功推进 ≥1 个任务后把 `consecutiveResumes` 归零**；被 hook 续跑一次则加一，
  达 5 次 hook 自动放行（防死循环兜底）。文件缺失/解析失败/非 DEVELOPING/陈旧
  一律放行——hook 是「防误不防恶意」的兜底，不是调度依赖。
- 还有未完成批次且未被阻断 → 派发下一批。**例外（A20）**：下一批的 `layer=pipeline` 时
  不得直接派发——先走步骤 5 的收口闸门（`vima converge` 零 error 是 pipeline 批次的前置
  条件），否则全量测试会建立在带集成冲突的代码上。

### 4. 断点续跑

- 扫描任务 frontmatter，收集 done/failed/blocked/pending/running 统计。
- **running 孤儿处理**：发现 status=running 的任务一律视为上次会话中断遗留，
  重置为 pending 并在报告中说明（子代理是一次性委派，会话中断即失联，
  不存在「还在跑」的情况）。
- 状态与报告/统计不一致时，先运行 `vima sync` 做确定性对账再继续。
- 向用户报告中断点：已完成 X 个、失败 Y 个、待执行 Z 个。
- 从第一个含 pending 任务的批次继续；failed 任务询问用户：重试 / 跳过 / 人工介入。

### 5. 收口闸门（A20：全部批次开发完成后的收敛期）

全部 shared/business 任务达 done 后**不直接进 MAINTAINING**——并行批次各自为战的产出
此前从未被当作一个整体校验过。按下列顺序收口，**整段在同一会话内推进，不是停点**：

**5.1 跨任务集成对账**

运行 `vima converge`（确定性，零 token）。它查的是单任务视角看不见的三类冲突：
- **漏实现**（V-INT-01）：契约声明的接口没有任何后端实现——负责任务已标 done 才判；
- **重复实现**（V-INT-02）：同一 `METHOD path` 落在 ≥2 个后端文件，运行期路由冲突；
- **越界实现**（V-INT-03）：实现越出 A18 `apis` 责任田，负责任务再实现一遍就成重复；
- 另有 V-INT-04（warn，授权端无调用）与 V-INT-05（error，缺 pipeline 收尾任务）。

报告落 `.vima/reports/convergence.json`，其中 **`byTask` 是修复调度的确定性输入**——
谁的问题派回谁改，主 Agent 不自行判断归属。同一份报告还收口了既有红信号：
Verifier 未过点位（豁免不计、A13 越界项不可豁免）、运行时错误条数、done 却无 `@vima` 标注。

**5.2 修复轮次（有 error 或未过点位时）**

- 按 `byTask` 归组：同一任务名下的全部 finding 合成**一个**增量修复委派
  （vima-builder，第一必读 = 该任务在 convergence.json 里的切片 + 原任务上下文包）；
- **V-INT-02 / V-INT-03 类必须串行修复**：它们本质是多个任务争用同一处实现，
  并行修就是边修边冲突。其余任务的修复可同轮并行；
- 每个修复委派照走 **Builder → 独立 Verifier**，校验强度不降级；
- **修复轮不得新造 taskId**：收口闸门的修复轮没有自己的任务文件，产出物一律沿用被修文件
  既有的 `@vima <taskId>`。派发指令里必须写明这一条——否则 Builder 会自造
  `xxx-fix` 之类的标注，被 `vima trace` 判为野生，追溯链上多一个查不到出处的洞；
- 修完重跑 `vima converge`，**最多 3 轮**。仍有 error → 落盘报告并停轮交用户裁定
  （合法停点，`stopReason=gate`），报告里列出剩余 finding 与已尝试的修复轮次。

**5.2.5 版面冒烟（A27，默认 Kimi WebBridge；Playwright 仅回退）**

converge 零 error 后、进收尾流水线前，跑一轮版面事实量测：

1. `vima mock`（契约生成 demo 数据），终端启动 `npm run dev:demo`；
2. 加载并使用 `$kimi-webbridge` skill，以 `vima-layout-smoke` 为稳定 session，首次导航设置
   group title；导航 `http://localhost:5173/__gallery` 读取 `globalThis.__vimaRoutes`；
3. 复用同一 tab，对每个业务 route 依次用 CDP `Emulation.setDeviceMetricsOverride`
   设置 375 / 1280 / 1920 × 900，导航并等待页面稳定后执行
   `import('/scripts/layout-probe.mjs').then(m => m.probeInPage([0,2,4,6,8,10,12,16,22,24,32]))`；
4. 按 route、viewport 稳定排序汇总，写 `.vima/reports/layout-smoke.json`，字段遵循契约
   §6.17 且 `source: "kimi-webbridge"`；结束时清除 viewport override，**不要关闭 session/tab**。

七探针为溢出/空洞/裁切/间隙/刻度/重叠/动作换行。报告 finding 按 route 反查归属任务，
**并入 5.2 的修复轮次派回原任务**（版面缺陷与集成缺陷同一个回修通道，不另起流程）。
Kimi WebBridge 按 skill 的启动/重试步骤后仍不可用，才执行 `npm run smoke` 走 Playwright
回退；回退也不可用或 dev server 起不来 → 在完成报告如实写「无版面冒烟通道」。
**不许把「没测」说成「零问题」**；本步不是停点。

**5.2.6 设计稿校准轮（A29——冒烟归零后、收尾流水线前）**

`docs/review/design-links.md` 有登记稿的页面，逐页做**样式一致性校准**：
沿用 5.2.5 的 dev:demo 与 Kimi WebBridge session 逐页截图，与该页 Claude Design 稿对照，校准不一致处
（间距取值、面板主轴方向、控件形态、空态呈现——试点实测最常漂移的四类）。

**回修分流（A30 两段式）**——先判不一致属哪一级，派错了会把全站问题修成一页补丁：

- **版面级**（间距刻度、版面骨架 `.vui-layout-*`、卡片形态、密度档）→ 回 Stage A
  改真源 `src/styles/{layout,tokens}.css` 与 `docs/design-language.md`，**一处修全站**；
  多页同时偏同一个方向的，一律按版面级处理。
- **页面级**（本页构图、字段取舍、空态呈现、动作主次）→ 并入 5.2 回修通道**派回本页任务**。

两级改完都**复跑 5.2.5 冒烟归零**（校准不得引入新的结构缺陷）。没有登记稿的页面跳过
并在完成报告如实写「无视觉稿通道」；本步不是停点。
稿是视觉真源，探针是结构真源——两边都过才算收口。

**5.3 收尾流水线**

`vima converge` 零 error 后，派发 layer=pipeline 批次（`full-test` → `code-audit`，串行）。
上一步失败则下一步不执行；每步产出落 `.vima/reports/<taskId>-builder.json` 供下一步读取。
pipeline 任务发现的缺陷同样**派回负责的业务任务**做增量修复，流水线任务自己不改业务代码。

**5.4 切换阶段**

- `vima converge` 零 error **且** pipeline 任务全部 done → 更新 lifecycle.json：
  currentPhase 切换为 MAINTAINING 并记录时间，输出完成报告（含 converge 摘要），并跑
  `vima certify` 把交付等级与逐级证据附进报告（A32）——**报告措辞用 certify 的等级词**
  （最高 pipeline-green），不得把它说成「可部署 / 稳定运行」：那两级需要部署环境证据，
  vima 不采集也不认证。
- 存在 failed/blocked 任务，或收口闸门 3 轮未收敛 → 保持 DEVELOPING，
  输出待处理清单与建议，写 `.vima/go-state.json`（`stopReason=gate`）。

> 维护期随时可手动跑 `vima converge` 复查（只读，不改任何产物与状态）。

### 6. 经验反哺询问（A21，只在切 MAINTAINING 那一刻问一次）

切换 MAINTAINING 成功后立即执行；这是**唯一自然的时机**——早了没数据，晚了人已离场。

- **先看是否已问过**：读 `.vima/retro-state.json`，`asked=true` → 跳过本步（拒绝过一次
  就不该被反复骚扰；用户主动说「反哺一下」时不受此限）。
- **采集**：运行 `vima retro`（离线、只读、**默认脱敏**——只出计数与分布，不含任务/接口/
  页面标识）。产物：`docs/retro/vima-feedback.md`（issue 正文）+ `.vima/reports/retro.json`。
- **呈给用户并询问**（把 retro 的观察项与关键计数复述 5–10 行，不要贴整份文件）：

  > 本项目已开发完成。要不要把这次的过程经验反哺给 vima-cli？
  > 采集到的观察项：<OBS-xx 列表>。默认脱敏，只提交计数与分布，不含任何业务标识。
  > 另外有两个 CLI 采不到、只有你知道的问题：
  > ① 本次有没有**想表达但框架表达不了**的东西（页面形态、交互、规格结构上被迫降级
  >   或绕过的地方）？历次增补项（A14 分栏版面、A16 多端应用模型）都出自这一问。
  > ② 哪一步最费时间／最反复？

- **用户同意** → 把用户的回答**逐字**补进 `docs/retro/vima-feedback.md` 的「人工补充」段
  （不要替用户润色成套话），然后执行：

  ```bash
  gh issue create --repo vima-tech/vima-cli --title "<一句话标题>" --body-file docs/retro/vima-feedback.md
  ```

  `gh` 不存在或无权限 → **不静默失败**：打印正文路径与上面这条命令，请用户自行提交。
- **用户拒绝** → 产物留在 `docs/retro/` 备查，不再追问。
- 两种结果都写 `.vima/retro-state.json`：`{ "schemaVersion": "1", "asked": true,
  "answer": "yes|no", "askedAt": "<真实 ISO 时间>" }`。
- **提 PR 不由本命令代劳**：跨仓 fork/push 不该由项目侧的 Agent 持有写权限
  （仓库纪律：不执行真实 git push）。issue 正文里的「建议落点」可直接作为 PR 描述，
  改动请在 vima-cli 仓库里开工。

本步的询问停顿落在合法停点白名单第 ② 项（全部任务达终态），`stopReason` 写 `terminal`。
