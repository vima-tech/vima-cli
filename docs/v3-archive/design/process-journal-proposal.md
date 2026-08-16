# 过程轨迹（Process Journal）：给 A21 反哺回路补上时间维

> 创建日期：2026-08-14 · 更新日期：2026-08-14（三项裁定回填）
> 状态：**已立项**。正式规格见 `v2.1-amendments.md` 的 **A35**；本文保留完整论证、
> 被否方案与实现前的实地核查记录，**不充当实现规格**（同 A34 与其 solution 文档的分工）。
> 来源：用户提出「考虑当前项目能否增加像 agent 一样的 trace 监控之类的轨迹记录，
> 方便后续优化」。
> 立项理由：本项**不是新需求**，是 A21 经验反哺回路的一个已知洞——
> `lib/commands/retro.mjs:353-357` 的注释里已经白纸黑字承认了它。

---

## 0. 一句话

全仓 20 个产物 schema（契约 §6.1–6.20）里只有 **1 个是事件流**（`runtime-errors.jsonl`，
且只覆盖浏览器报错），其余全是「最新快照」。A21 因此只能回答
「**结束时还剩几个问题**」，回答不了「**过程中踩了什么坑、又是怎么爬出来的**」——
而后者才是调框架阈值真正要的分布。本项加一条 append-only 事件流补齐这一维：
**不新增命令、不新增交互、不联网、不进退出码。**

先澄清命名：现有 `vima trace` 是**代码级溯源**（`@vima <taskId>` 标注 ↔ 任务清单对账，
契约 §10/§6.6），与本项的执行轨迹完全不同义。本项一律称 **journal（过程轨迹）**，
不复用 trace 一词，避免语义撞车。

---

## 1. 问题（三条，均有代码证据，不是推测）

### P1 —— 验收多轮的过程 100% 丢失，且丢的正是最贵的那部分

契约 §6.9 规定子代理报告落 `.vima/reports/<taskId>-verifier.json`，`round` 是**文件内字段**
而不是文件名的一部分（`templates/admin/workspace/agents/vima-verifier.md:39` 同口径）。
一个 taskId 一个文件 ⇒ **第 2 轮覆盖第 1 轮**。

于是 `retro` 只能取到 `maxRound`（`retro.mjs:85`）。而真正有价值的是被覆盖掉的那部分：
**第 1 轮挂在哪条 point、缺了什么、第 2 轮怎么修好的**。这条信息落盘即丢，
事后无法从任何产物重建。

### P2 —— retro 自己承认了快照的不可得

`lib/commands/retro.mjs:353-357` 原文：

> A21 只采集异常信号（重试/冲突/豁免/越界），没有一项记录「哪个机制救了你」
> ……「某规则曾命中后来被修好」**在只有最新快照的报告体系里不可得**，
> 强行推断会产出假数据。

当时的处理是把「正面证据」降级为人工补充第 3 问（`retro.mjs:264-267`）。
那是在**没有事件流**这个前提下的正确让步——本项要动的正是这个前提。

### P3 —— hook 的规范命中，每次都在真实发生，但零记录

`templates/admin/workspace/hooks/post-write.mjs` 有三处 `process.exit(2)`（行 399 / 429 / 452），
分别对应导入与反馈规范、区块标记对账、A27 版面纪律的拦截。每一次拦截都是一次
「**框架引导没把这条要求讲清楚**」的一手信号，当场打印给 Agent 让它改，然后**蒸发**。

这恰恰是 A21 观察项 `OBS-rule`（`retro.mjs:185-190`，「同一条规则被反复违反 = 框架引导最缺的地方」）
想要的分布——但它现在只能从 `planning-validation.json` 的**最后一次**校验结果里取，
取到的是「结束时还剩几条」，不是「一共被违反了多少次」。

---

## 2. 决策：四条规格

### 规格 1 —— 事件流 `.vima/reports/journal.jsonl`

JSON Lines，append-only，**五键封顶**：

```json
{"ts":"2026-08-14T09:12:03.114Z","kind":"cmd","ref":"validate","outcome":"fail:2","n":7}
{"ts":"2026-08-14T09:31:40.802Z","kind":"guard","ref":"A27/裸尺寸","outcome":"block","n":1}
{"ts":"2026-08-14T10:02:11.559Z","kind":"report","ref":"device-list-fe/verifier/r1","outcome":"fail","n":3}
{"ts":"2026-08-14T10:44:07.310Z","kind":"report","ref":"device-list-fe/verifier/r2","outcome":"pass","n":0}
{"ts":"2026-08-14T11:05:22.008Z","kind":"cmd","ref":"validate","outcome":"ok","n":0}
```

| 键 | 类型 | 语义 |
|---|---|---|
| `ts` | ISO 8601 字符串 | 事件发生时刻（唯一读时钟处，见 §4 确定性论证） |
| `kind` | **封闭集** `cmd` \| `report` \| `guard` | 三个采集口各一，不留扩展位（要第四类先立需求） |
| `ref` | 字符串 | 事件对象：命令名 / `<taskId>/<角色>/r<轮次>` / 规范条目名 |
| `outcome` | 字符串 | `ok` \| `fail:<exitCode>` \| `pass` \| `fail` \| `block` |
| `n` | 整数 | 一个计数：error 条数 / 未过 point 数 / 恒 1（guard） |

硬性约束：

- **单行 ≤ 1024 字节**（并发原子性，见 D-A35-04）。超长的 `ref` 截断，不换行、不折行。
- **单文件，不按端拆**——与 `runtime-errors.<appId>.jsonl` 的 A16 拆分口径**不同**：
  运行时错误是端的产物，过程事件是项目的过程。
- **不做轮转/采样**。量级估算：cmd 事件 ≤ 数百、report 事件 = 任务数 × 轮次 ≈ 数百、
  guard 事件 ≈ 数百到数千，合计 < 5000 行 / < 1 MB。真爆了再说（YAGNI）。

### 规格 2 —— 采集点①（内核层）：`lib/cli.mjs` 统一出口

`lib/cli.mjs:408-423` 是全仓唯一的命令出口漏斗（`mod.run()` + 两个 catch 分支）。
**只在这一处采集**，不散落进 21 个命令模块。

记录口径（**防噪声是本条的全部难点**）：

| 条件 | 记否 |
|---|---|
| 找不到项目根（`create` / `upgrade` / 项目外的 `doctor`） | **不记**（journal 是项目产物） |
| `exitCode ≠ 0` | **记**（任何命令，含 USAGE——这就是「踩坑」） |
| `exitCode = 0` 且 `cmd ∈ JOURNAL_ON_SUCCESS` 且 argv 不含 `--check` / `--dry-run` | **记**（这就是「推进 / 爬出来了」） |
| 其余（只读探测成功、help、version） | 不记 |

`JOURNAL_ON_SUCCESS = {init, update, sync, plan, validate, approve, converge, certify, change, design, trace, retro}`
——与既有 `PROJECT_SCOPED` / `PROJECT_REQUIRED` 同形态的静态 Set，一行、显式、可审计。
排除 `doctor` / `context` / `mock` / `render-*`：只读或高频，成功无过程含义（失败仍按上表记）。

**写失败一律吞掉**，绝不影响命令退出码与 stdout/stderr——同 hook 的「防误不防恶意」口径。

### 规格 3 —— 采集点②（工作区层）：`post-write.mjs`

hook 每次 Write/Edit 都在跑，且已能拿到 `input.cwd` 与 `input.tool_input.file_path`
（`post-write.mjs:121-153`）。插入点必须在**行 188-189 的早退门之前**——那道门只放行
`.vue/.ts/.tsx/.wxml/.wxss`，而我们要采的 `.json` 报告会被它挡掉。

两件事：

1. **子代理报告落盘事件**（解决 P1）：写入路径匹配 `.vima/reports/<taskId>-{verifier,builder}.json`
   时，读回该文件，记一条
   `{kind:"report", ref:"<taskId>/verifier/r<round>", outcome:"pass|fail", n:<未过 point 数>}`。
   **文件仍按原样被覆盖，schema 一字不改**——被覆盖掉的是内容，留痕的是「第 N 轮是什么结果」。
2. **规范命中事件**（解决 P3）：三处 `exit(2)` 之前各记一条
   `{kind:"guard", ref:"<规范条目名>", outcome:"block", n:1}`。

**关键点：全程零 Agent 配合。** 采集由 hook 确定性完成，不依赖子代理"记得写日志"——
子代理是概率性的，而契约硬约束要求「凡能用确定性代码解决的不留给 Agent」。

### 规格 4 —— 消费：`vima retro` 加一节，**不新增命令**

`retro.mjs` 的 `collectReports()` 已在 readdir `.vima/reports/`（行 61-69），
加一个分支读 `journal.jsonl` 即可。新增聚合：

- **命中→修复曲线**：每条规范/规则被 `block` 的总次数，与它最后一次命中的相对位置
  （前半程 / 后半程）——区分「一次性踩坑」与「反复踩到最后还在踩」，后者才是框架的锅。
- **验收轮次形态**：r1 直过率、r1 fail → r2 pass 的比例、r1 未过 point 数的分布。
  这是 P1 丢掉的那部分，也是 A21 `OBS-retry` 阈值（30%）目前唯一的实证来源。
- **失败命令分布**：哪条命令最常非零退出（`validate` 反复 exit 2 = 规格质量问题；
  `converge` 反复 exit 2 = 拆解责任田问题）。

**只出计数、分布与序数，不出原始 `ts`**——守 A21 既定脱敏口径（公开仓库 + 客户项目）。
retro 的 `--with-ids` 语义不变，journal 派生项同样受它管辖。

---

## 3. 决策表

| ID | 决策 | 理由 | 被否方案 |
|---|---|---|---|
| D-A35-01 | 记录口径＝**失败全记 + 成功仅白名单且排除 `--check`/`--dry-run`** | 单一可审计判据，一个静态 Set 说清 | ①全记：`doctor`/`render --check` 高频成功刷屏，信噪比塌；②只记失败：画不出「修好了」那一端，曲线只剩半条 |
| D-A35-02 | 子代理报告**由 hook 采**，不由 Agent 写 | 硬约束「凡能用确定性代码解决的不留给 Agent」；hook 已在每次 Write 上跑，边际成本≈0 | 让 verifier 自己追加一行——概率性执行，漏一条就断一段曲线 |
| D-A35-03 | **不改** §6.9 的文件名与 schema | 改成 `<taskId>-verifier.r<N>.json` 要同步动 `converge`/`retro`/`/check` 三个读取方（都得改成"取最新轮"），破坏面远大于收益 | 文件名带轮次 |
| D-A35-04 | 单行 ≤ 1024 B + `O_APPEND` 追加 | A18 允许 `maxParallel` 到 10，即最多 10 个 Builder 的 hook 并发追加同一文件。POSIX 下小于 `PIPE_BUF`(4096) 的 `O_APPEND` 写是原子的；超过就会交错撕行，把日志变成垃圾 | 不限长；或加锁文件（引入清理与死锁问题，零依赖下不划算） |
| D-A35-05 | journal **不进退出码、不进任何校验规则** | 同 `runtime-errors` 的既定口径「只报告不计退出码」（契约 §6.13 `summary.runtimeErrors`）。一旦进闸门，第一件发生的事就是有人删文件 | 让 converge 对 guard 命中数设阈值 |
| D-A35-06 | 沿用 `.vima/reports/`（骨架 `.gitignore` 已忽略，见 `templates/admin/scaffold/root/_gitignore:4`） | 不入库：避免时间戳与高频 churn 进 git 历史 | 提交进仓：每次 Write 都改动一个被跟踪文件，git status 永远脏 |
| D-A35-07 | **默认开启**，`VIMA_JOURNAL=0` 关闭 | A21 的教训原文就是「反哺全靠自觉」——默认关 = 数据永远不存在 = 机制失效。开关的存在是为可复现测试与用户知情权 | 默认关、需显式开启 |

---

## 4. 与三条硬约束的关系（逐条对账）

**零运行时依赖** ✅ 只用 `node:fs`（`appendFileSync`）。新增一个 `appendJsonLine()` 到
`lib/util/fs.mjs`（当前只有 `atomicWriteFile`，没有 append 助手）。

**确定性优先** —— 这是本项最大的表面冲突，化解论证如下：

1. 硬约束原文禁的是「**渲染器**禁止嵌入时间戳/随机数——同一输入必须字节一致」。
   **采集器不是渲染器。**
2. 已有两条同性质先例：`runtime-errors.jsonl` 的 `receivedAt` 在契约 §6.10 明确
   「真实时间戳，**允许 new Date**」；`lifecycle.phaseHistory` 的 `enteredAt/completedAt`
   同样「由调用方填真实时间」。
3. **journal 一旦落盘，就与 phaseHistory 完全同性质**：它是「已落盘的时间戳」。
   `retro` 读它是确定性的——因为输入是磁盘，不是时钟。retro 现行纪律
   「不读系统时钟，只作差已落盘的时间戳」（`retro.mjs:47`）**原样成立，一字不改**。

判定口径写死为一句话：**采集端允许读时钟；消费端（渲染 / 校验 / 退出码）一律不得读时钟。**

**分层边界** ✅ 内核只记它自己知道的（命令名 / 退出码 / 错误码）——平台中立，不含任何
Claude Code 语义。子代理报告与 hook 命中全部在 `templates/*/workspace/` 层采集。
两层写同一个文件，但格式契约在 `docs/internal-contracts.md`，符合既有分工。

**防过度设计** —— 每条规格反查：规格 1/2/3 ← P1/P2/P3 ← A21 已立项目标；
规格 4 ← A21 `OBS-retry`/`OBS-rule` 现有阈值缺实证。反查不到的一律进 §7 不做清单。

---

## 5. 局限（如实记录，不粉饰）

1. **不入库 ⇒ 换 clone 即失。** `.vima/reports/` 被 gitignore，journal 只存在于跑项目的
   那个工作副本里。A21 的使用场景是「项目跑完那一刻在同一个工作副本里做复盘」，
   该场景成立；换机器接手则 journal 为空，retro 退化回当前行为（**不报错、不阻断**）。
2. **采不到 Agent 侧的真实成本。** token 消耗、思考时长、工具调用次数在 Claude Code 会话内，
   hook 拿不到。本项**不假装**能采（诚实分级，同 A32 对 deployable 的处理）。
3. **guard 事件只覆盖 `post-write.mjs`。** `guard-shared.mjs`（PreToolUse）与
   `go-continue.mjs`（Stop）暂不采集——前者的拦截语义已被 A18 `sharedChangeRequest` 覆盖，
   后者的 `consecutiveResumes` 已在 `go-state.json` 里。要采需另立需求。

---

## 6. 验收判据（可跑命令）

```bash
# 1. schema 与封闭集登记
grep -c 'journal.jsonl' docs/internal-contracts.md                       # ≥1（新增 §6.21）
grep -c 'VIMA_JOURNAL'  docs/internal-contracts.md                       # ≥1

# 2. 采集口径：失败记、只读成功不记
cd <某 vima 项目> && rm -f .vima/reports/journal.jsonl
vima doctor >/dev/null 2>&1;             test ! -f .vima/reports/journal.jsonl && echo "只读成功不记 ✓"
vima render-review --check >/dev/null 2>&1                                # 成功时仍不得产生文件
vima validate >/dev/null 2>&1;           grep -c '"kind":"cmd"' .vima/reports/journal.jsonl

# 3. 项目外不记（无项目根）
(cd /tmp && mkdir -p nojournal && cd nojournal && vima validate >/dev/null 2>&1; \
 test ! -f .vima/reports/journal.jsonl && echo "项目外不落盘 ✓")

# 4. 单行长度硬上限（D-A35-04 并发原子性前提）
awk 'length($0) > 1024 {n++} END {print n+0}' .vima/reports/journal.jsonl  # 0

# 5. 每行都是合法 JSON 且 kind 在封闭集内
node -e "const fs=require('fs');const L=fs.readFileSync('.vima/reports/journal.jsonl','utf8').split('\n').filter(Boolean);\
const K=new Set(['cmd','report','guard']);console.log(L.every(l=>{const o=JSON.parse(l);return K.has(o.kind)&&typeof o.ts==='string'}))"  # true

# 6. 开关生效
VIMA_JOURNAL=0 vima validate >/dev/null 2>&1 && \
  node -e "const n=require('fs').readFileSync('.vima/reports/journal.jsonl','utf8').split('\n').filter(Boolean).length;console.log(n)"   # 与上一次相同

# 7. journal 不影响退出码（写失败也不影响）
chmod 444 .vima/reports/journal.jsonl && vima validate >/dev/null 2>&1; echo $?   # 与可写时一致
chmod 644 .vima/reports/journal.jsonl

# 8. retro 消费后仍字节确定
vima retro && cp .vima/reports/retro.json /tmp/a && vima retro && cmp /tmp/a .vima/reports/retro.json && echo "确定性 ✓"
#    脱敏：journal 派生项不得把原始 ts 带进产物
grep -c '"ts"' .vima/reports/retro.json docs/retro/vima-feedback.md       # 0 0

# 9. hook 采集点在早退门之前（防漂移断言）
node -e "const s=require('fs').readFileSync('templates/admin/workspace/hooks/post-write.mjs','utf8');\
console.log(s.indexOf('journal') < s.indexOf(\"!/\\\\.(vue|ts|tsx|wxml|wxss)\$/\"))"   # true
```

---

## 7. 落点

| 类型 | 路径 |
|---|---|
| 文件格式 | `docs/internal-contracts.md` **新增 §6.21**（`.vima/reports/journal.jsonl` schema + 采集口径表 + `VIMA_JOURNAL`）；§6.14 retro 产物补 journal 派生字段 |
| 模块接口 | `lib/util/fs.mjs` **新增 `appendJsonLine(p, obj)`**（≤1024B 截断 + `O_APPEND` + 吞异常），登记进契约 §5 |
| 内核采集 | `lib/cli.mjs`（出口漏斗一处 + `JOURNAL_ON_SUCCESS` 静态 Set） |
| 工作区采集 | `templates/admin/workspace/hooks/post-write.mjs`（早退门之前插入报告事件；三处 exit 2 前插入 guard 事件） |
| 消费 | `lib/commands/retro.mjs`（`collectReports` 加分支 + `renderMarkdown` 加「过程曲线」节 + 观察项表新增阈值条目） |
| 设计真源 | `docs/design/v2.1-amendments.md` 新增 **A35** 节；文首 A 系列导语补一句；`docs/design/vima-cli-design-v2.md` §21 版本历史 |
| 消歧修订 | `docs/design/v2.1-amendments.md:3056` 的「估算能力（A35 提案）」改为「（代际评估 A35 提案）」——见 §9 待裁定第 1 项 |
| 单测 | **新增 `tests/unit/c3.journal.test.mjs`**（采集口径表逐行、单行上限、封闭集、开关、写失败不影响退出码）；`c3.retro.test.mjs` 补 journal 消费用例；`d2.workspace.test.mjs` 补 hook 采集点防漂移断言 |
| 文档 | `CHANGELOG.md`、`README.md` 核心机制 |

---

## 8. 不做

- **不做仪表盘 / TUI / `vima journal` 命令。** 消费方只有 retro 一个，为它单开命令是镀金。
- **不做上报 / 联网 / 跨项目聚合。** 守「`vima upgrade` 是全仓唯一联网命令」，
  且 A21「不做」清单已明确否过跨项目聚合服务——本项不得从侧门把它带回来。
- **不采 token / 耗时 / Agent 思考轨迹。** 拿不到（见 §5.2），不假装能采。
- **不做轮转 / 采样 / 压缩。** 量级不构成问题（§规格 1）。
- **不进退出码、不进 validate/converge 任何规则**（D-A35-05）。
- **不改 §6.9 子代理报告的文件名与 schema**（D-A35-03）。
- **不让 Agent 往 journal 里写自由文本。** `kind` 是封闭集、`ref`/`outcome` 是受控取值——
  沿用 A21「不让 Agent 自由写项目总结」的同一条理由：不可验证、不可跨项目比较。
- **不采 `guard-shared.mjs` / `go-continue.mjs` 的事件**（§5.3，要采另立需求）。

---

## 9. 三项裁定（2026-08-14 用户拍板，已回填）

**1）编号撞车 —— 裁定「自动解决」，采用根治方案（D-A35-08）。**
病因：`pact-vs-vima-generational-assessment.md` 自行占用了 A34–A37 作为**该文档内部**的
提案编号，而登记册的 A34 是「视觉真源兑现机制」——**撞车已经发生**，仓内此前靠
「代际评估 A34 提案」这样的限定语勉强消歧。本项取 A35 会撞第二次。

处置：把该文档的提案编号改编为 **G1–G4**（G1 持续问题台账 = 原 A34、G2 实证估算 = 原 A35、
G3 多 change 并存 = 原 A36、G4 Agent Adapter = 原 A37），并在登记册头部立**命名空间规则**：
**A# 编号由 `v2.1-amendments.md` 独占，提案在入册那一刻才由登记册分配 A 号**。
未选 `P1–P4`：`P#` 在那份文档里已被占用为**优先级档**（P0/P1/P2 三节），会二次撞车。
未选「每处加限定语」：撞车类不消失，下次还撞。未选「跳号到 A38」：留无意义空号，
且不解决**已经存在**的 A34 撞车。

**2）范围 —— 裁定全做。** 三个采集口（cmd / report / guard）与 retro 消费一并落。

**3）落法 —— 裁定先入册。** 本轮只动**设计真源**，不写一行实现：
`v2.1-amendments.md` 新增 A35 节、编号消歧五处、`internal-contracts.md` 的**索引三处**
（§0 导语 / §12 目录行 / §12 来源分档）、`CLAUDE.md` 使命段。
**契约 §6.21（journal schema）与 §5（`appendJsonLine`）刻意留给实现批次**——
它们是「文件格式 / 模块接口」的权威声明，与实现同批落才不会出现
「契约声称有、代码里没有」的两张皮（CLAUDE.md 硬约束「立项即做透」的反面同样要防）。

---

## 10. 入册后冷读自审：6 处实质修订（2026-08-14）

入册后对 A35 做了一轮冷读自审。**本文 §2 的 schema 与白名单是提案原稿，以下 6 处已在
登记册 A35 修正，两处不一致时一律以 A35 为准。**记录在此是因为其中几条的**发现方式**
比结论更有复用价值。

| # | 原稿的错 | 修正 | 怎么发现的 |
|---|---|---|---|
| 1 | `JOURNAL_ON_SUCCESS` 含 **`retro`** | 移出（D-A35-12） | **自指陷阱**：retro 读 journal 生成报告，若它自己也写一行，A21 既有的「连续两次 retro 字节一致」判据当场失败。顺着**已有判据**反推新机制，比正向检查有效 |
| 2 | cmd 事件 `n` ＝「error 条数」 | 改取 `exitCode`（D-A35-09） | 查契约 §4 发现命令模块接口是 `run(argv, ctx) → number`——出口**只拿得到退出码**。写规格时想当然，核对接口契约才发现不可得 |
| 3 | `guard` 的 `ref` 只写「规范条目名」 | 收紧为**封闭枚举**，禁拼命中现场（D-A35-10） | 顺着 A21 脱敏硬约束反查：journal 会流向 retro，retro 产物要贴**公开** issue；`ref` 若写成 `A27/裸尺寸@src/views/Foo.vue:42` 就把客户项目文件树带出去了 |
| 4 | 规格 4 只说「不出原始 `ts`」 | 补「`report` 事件先剥 taskId 再聚合」 | 同上。`ref` 形如 `<taskId>/verifier/r1`，**taskId 才是 A21 判据真正在守的东西**，ts 反而是次要的 |
| 5 | `outcome` 混用枚举与拼接（`fail:<exitCode>`） | 收敛为封闭集 `{ok,fail,pass,block}`，退出码移入 `n` | 与第 2 条一并解决：`n` 有了确定语义，`outcome` 也不必再拼字符串 |
| 6 | 判据「hook 采集点在早退门之前」用 `indexOf('journal')` 比位置 | 换成**行为断言**（喂 hook 一份 `demo-verifier.json`，验证 journal 真的追加） | **假判据**：`journal` 一词必然出现在文件头注释里，位置断言恒真。位置断言几乎总是假判据，能跑行为就跑行为 |

另有一条判据在**实跑时被证伪**：原第 10 条「编号消歧不回潮」写作
`grep -rn 'A3[4-7]' … | grep -vc '编号口径'`，期望 0，**实跑得 2**——订正说明块自己
合法地包含这些编号。改写时又发现代际评估里还有 `#### A31/A32/A33`，而这三个
**已入册且语义一致，属正确引用**。最终判据改为「登记册外文档的 A# 标题，该号必须已在
登记册立项」（抓「未入册却占号」），已实跑通过。

> 教训与 A3 的历史问题同源：**验收判据必须实跑**。写得出的判据不等于跑得通的判据，
> 而跑不通的判据比没有判据更坏——它让人以为已经守住了。

---

<sub>本文创建时为零改动提案；2026-08-14 入册后回填三项裁定与 §10 自审修订。所有引用的行号取自 2026-08-14 工作树。</sub>
