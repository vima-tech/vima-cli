# vima v4 架构契约

创建日期：2026-08-16

本文件是并行开发的对齐真源。**改模块接口前先改本文件。**

设计依据：需求基线 R1–R11 与约束 C1–C4，**逐条列在下一节**。
**每处实现必须能反查到某条需求，反查不到的不写。**

---

## 需求基线

这一节是「反查」的落点。没有它，`// 反查 R5` 这类注释谁都能写、谁都核不了，
而那条硬约束就成了一句无法证伪的口号——v4 重写时一度就是这个状态：
通篇引用 R#/C#，却没有任何地方列出它们。

编号有空档是**故意的**：R4 / R8 / R10 已被 R2 吸收，编号不回收，
否则旧讨论里的引用会指向另一条需求。

| 编号 | 需求 | 要点 |
|---|---|---|
| **R1** | 从零散物料产出能跑的系统 | 起点大概率什么都没有；物料形式不限（纪要/聊天/截图/旧文档）；顶层命题的出处是**物料**不是命题 |
| **R2** | 观测平台（**最高优先**） | 吸收原 R4/R8/R10。五类问题共用一个数据底座：做到哪了 · 哪些是 AI 替人定的 · 过程怎么走的 · 花了多少 · 哪里断的 |
| **R3** | 改需求，影响面**算出来** | 上游改动自动让下游证据失效；「改完了」的判据是失效清单清空，不是人觉得改完了 |
| **R5** | 并行加速 | 靠隔离（worktree），不靠「大家别碰同一个文件」的约定 |
| **R6** | 定位根因 | 出问题时能沿事件流回放到是哪一步、哪个 actor |
| **R7** | 企业风格化四层 | 令牌 / 版面 / 交互范式 / 信息架构。**骨相统一、皮相可变**；词表宁宽勿窄，可持续扩展 |
| **R9** | 存量项目接管 | 两种都要：陌生代码库、旧 vima 项目 |
| **R11** | 可复用业务块库 | 分层 L1–L4，开放注册表可持续扩展；**L4 视觉层默认不提供**（会与 UI 设计代理冲突） |

| 编号 | 约束 | 含义 |
|---|---|---|
| **C1** | 执行者会偷懒、会自称完成 | 一切「做完了」都要有系统生成的证据；自称永远是最弱档 |
| **C2** | 防过度设计 | 约束别扩面 · 抽象别提前 · 字段别镀金。反查不到需求的复杂度 = 未经授权 |
| **C3** | 文档可读、可 diff、可 review | 真源是 markdown，不是数据库；渲染确定性，同一输入字节一致 |
| **C4** | 设计与开发阶段**不阻塞** | 规格没说清时 AI 自行定夺、记 ruling、继续；人事后二次裁决 |

**明确排除**（提出过并否掉的，写下来防止重开）：多人多会话协作 · 业务块版本兼容。

**已接受的风险 AR-1**：运行期行为正确性缺一档证据。`observed` 需要真跑界面采集，
本轮不建这套设施——接口留着，调用时如实返回未实现，**绝不降级用 `executed` 冒充**。

---

## 一句话

vima 做三件事：**定形**（规定合法产出长什么样）· **供料**（提供现成的块与经验）· **验形**（记录并呈现，保证前两件真的发生）。

前两件直接解两个痛点——AI 生成的东西风格多变、做过的东西下次用不上。第三件保证前两件不落空。

---

## 分层

```
front/   MCP（给 agent）· CLI（给人与 CI）· Web（给人看）
ops/     编译 compile · 取证 attest · 对账 audit —— 只有这三个动词
         （spec 是 compile 的读入侧：docs/ markdown → 批次，不是第四个动词）
core/    events 事件日志 · claims 命题投影 · project 定位 · extract 代码事实
assets/  registry 资产仓读取 · rules 按维度选规则
```

依赖方向单向向下。`core/` 不 import `ops/` 或 `front/`。

---

## 三个概念

| 概念 | 存在形式 | 纪律 |
|---|---|---|
| **命题** claim | 事件流投影，**不存盘** | 分层 intent → spec → contract → impl → behavior |
| **证据** evidence | 附着在**命题**上，不是任务上 | 取证方式必须可重放，否则与自称无异 |
| **事件** event | `.vima/events.jsonl`，append-only | **唯一写入口**；无 update 无 delete |

### 两个正交强度轴

- **来源可信度（S）** `fact` > `superseded` > `stated` > `ruled` —— 这条凭什么进来的
- **验证强度（E）** `observed` > `executed` > `derived` > `claimed` —— 这条做到了没有

一条命题可以「来源可信但没实现」，也可以「实现扎实但来源是份过期文档」。**必须分开记**，否则追溯链在最上游断掉。

---

## 决定性纪律

### 0. 威胁模型：承诺 T0 + T1，明确不承诺 T2

（出自 codex 评估 P0-8。下面第 1 条纪律的措辞曾经超出实际能力，先把边界钉死。）

| 等级 | 对手 | v4 的承诺 |
|---|---|---|
| **T0 意外** | 工具崩溃、半写、坏行、时钟偏差 | 检测、容错、恢复，不静默假绿（坏行计数、原子写、幂等投影） |
| **T1 合作但会偷懒** | 绕步骤、挑省事路径、错误自述 | **官方接口不采信自述**：MCP submit 只收 claimId，证据内容由系统生成 |
| **T2 主动篡改** | 故意改账本、伪造身份或证据 | **不承诺。** 拥有 Write/Bash 的 agent 物理上可以改 events.jsonl、自报 --actor、挑恒绿命令 |

由此得出的措辞纪律：说「agent 不能**通过正式接口**提交证据结论」，
不说「agent 无法篡改账本」；`--actor` 是 reported metadata，不是身份认证；
任何界面不得出现 tamper-proof / 不可伪造。若将来要 T2，必须把事件服务移出
工作区、独立进程持写权限——**在同一可写目录里加一个 hash 不算防篡改**（agent 会重算）。

这条措辞纪律有机检：z.seams 的「超承诺措辞」扫 `lib/` · README · ARCHITECTURE ·
CHANGELOG · `templates/`，**默认判违规**，只有同一句里带否认词才放行——本表这几行
正因如此合法。判据与豁免清单都在那条测试里，不在这儿抄第二份。
之所以要机检：靠人眼「全仓统一措辞」已经漏过一次，MCP 真发给 agent 的
instructions 停在旧口径整整一轮，而文件头注释早就改好了。

### 1. agent 不能通过正式接口提交证据结论

```
agent 说「任务 X 做完了」    → 系统不信，什么都不写
agent 调 submit(X)          → 系统自己去取证 → 系统写事件
```

事件的「发生」由 agent 触发，事件的「内容」由系统生成。这条塌了，整套观测退化成自称。

**推论**：绕过工具直接改文件不被禁止，但那样没有事件、没有证据、进度不涨。**不需要禁止绕过，绕过没有收益。**

**边界**（见纪律 0）：这是**接口设计**，不是物理安全。它挡的是 T1（自述通道），
不挡 T2（拥有 Write 的 agent 直接改 events.jsonl）。两句话不能混着说。

### 2. 不阻塞（C4）

需要人裁定的一律先由 AI 定夺 → 记录成 `ruling` 事件 → 观测平台展示 → 人可二次裁决。

二次裁决走 R3 的同一条失效传播链路，**不为裁定单独设计回滚**。

裁定必须带 `confidence` 与 `blastRadius`——没有优先级的裁定台账会走向和「永远消不掉的告警」同一个结局。

### 3. 约束下沉：能往下就不往上

```
资产（令牌·词表·块）   ← 最优：写不出非法的东西
  机检规则              ← 次优：写出来了会被指出来
    skill 规程           ← 再次：需要时被读到
      CLAUDE.md 元规则   ← 最后：常驻但只是劝导，只放两三条
```

### 4. 代码事实只有一个提取点

`core/extract.mjs` 是全系统唯一从代码提取事实的地方。正则、扫描方式、注释处理、行号换算四件事在同一个函数里。**调用方只能拿结果，不能自己造扫描器。**

它也是日后换 AST 的唯一改动点。`CAPABILITY` 常量自陈能力边界（当前 file 级归属、看不见 import 图），审计报告要如实呈现。

---

## 目录

### 本仓（分发物）

```
bin/vima.mjs
lib/core/{events,claims,project,extract,fsx}.mjs
lib/ops/{spec,compile,attest,audit}.mjs
lib/assets/{registry,rules}.mjs
lib/front/{cli,mcp,web,actions,claude}.mjs
assets/                      资产仓 —— 内容，不是能力
  style/tokens/*.json        令牌阶梯（皮，可整体替换）
  style/*.vocab.json         版面 / 交互范式 / 信息架构词表（骨）
  rules/*.md                 通用规则，frontmatter 声明适用维度
  blocks/<set>/<name>/       业务块，四层 L1–L4
  lore/                      经验（留位置，本轮不预建）
templates/project/           init 落进项目的东西
```

### 项目内（init 之后）

```
docs/                规格 markdown —— 唯一真源，人写人审可 diff
.vima/
  events.jsonl       事件日志
  index/             投影缓存的**预留落点**——缓存本身尚未实现，目录先占位并 gitignore。
                     实现时 fingerprint 判新鲜度的逻辑与消费方必须一起落地，别先写一半
  project.json       theme / apps / blocks
  rules/             项目特有规则
.claude/
  agents/            子代理定义（建造者 / 取证者）
  hooks/             采集 hook（唯一的否决点是 SubagentStop 打回）
  skills/            长规程
  rules/             ← 派生投影，由 vima sync 生成，勿手改
  CLAUDE.md          只有元规则，两三条
.mcp.json            ← 派生投影，由 vima sync 生成（项目级 MCP，进版本控制）
```

---

## Claude Code 资产面（签名冻结）

Claude Code 是三个前端之一（给 agent 的那个）。它的资产分**两类**，区别是谁写：

| 类 | 谁写 | 落点 | 漂了怎么办 |
|---|---|---|---|
| 原生资产 | 人（模板发出去） | `.claude/{agents,hooks,skills}`、`CLAUDE.md` | 人改，改完就是新的真源 |
| **派生投影** | `vima sync` | `.claude/rules/`、`.mcp.json` | `vima sync --check` 报漂移（exit 5）；重跑 `vima sync` |

派生投影的纪律与 `.vima/index/` 一样：**真源在别处，投影可随时重建，任何人手改投影都是错的。**
两类必须泾渭分明——混在一起就会出现「改了投影但下次 sync 被冲掉」这种查不出来的丢失。

**但投影要进版本控制**（与 `.vima/index/` 在这一点上相反）。理由：规则在**会话启动时**加载，
clone 下来直接开会话的人不会先跑 `vima sync`——不提交就等于「新人的前几个会话没有规则」，
而这正是投影要解决的问题本身。代价是派生文件的 diff 噪音，用 `vima sync --check` 在 CI 挡漂移。

`.claude/rules/` 下**不要放 README**：那个目录里的每个 .md 都会被 Claude Code 当规则加载，
一份「本目录是派生的」说明会被塞进每次会话的上下文。说明写在每份投影的头部注释里。

### 规则的两个触发面

规则有两条到达路径，**互补而非替代**，不要合并：

| | 触发条件 | 补的空档 |
|---|---|---|
| `vima next()` 下发 | 主动，按**任务维度**（layer/side/app/block） | 文件还不存在时就要遵守的约束 |
| `.claude/rules/` + `paths:` | 被动，按**文件** glob | agent 没走 `vima next` 时规则仍在场（C1：不能指望它自觉去查） |

`paths:` 的推导（唯一真源在 `lib/front/claude.mjs`）：

```
rule.applies.app  = [x]     → apps/x/**/*
rule.applies.side = [k]     → 每个 config.apps 里 kind === k 的端 → apps/<id>/**/*
两者都有                     → 取交集
两者都无（只有 layer/block） → 不写 paths → 无条件加载
```

`app.kind` 就是规则的 `side` 取值（与 `actions.next()` 的 `side: only?.kind` 同一口径），
端一律落 `apps/<id>/`（与 `ops/attest.codeDirs` 同一口径）。这三处必须同口径，
否则规则会「看起来限定了端、实际处处生效」——被静默忽略的维度比写错更难查。

### front/claude.mjs

```js
rulePaths(applies, apps) → string[] | null | []
  // null = 不限端，无条件加载；[] = 限了端但一个都不匹配 → **必须跳过**，
  // 投影成无条件会把「只在小程序生效」变成「处处生效」，且不报错
syncRules(root, { assetsRoot, config, check }) → { written, removed, unconditional, skipped, total }
  // .vima/rules/ + assets/rules/ → .claude/rules/vima-<id>.md
  // 只删自己写的（vima- 前缀），不碰人手写进 .claude/rules/ 的文件
  // skipped[].reason: 'no-apps'（新项目的正常状态，收成一句）| 'no-match'（多半写错了，逐条报）
mcpConfig({ binPath })                    → object      // .mcp.json 的唯一真源，mcp-install 也从这来
syncMcp(root, { binPath, check })         → { path, changed:boolean }
sync(root, { assetsRoot, config, binPath, check }) → { rules, mcp, drifted:n }
```

`.mcp.json`（project scope）与 `vima mcp-install`（user scope）**两个都要，不冲突**：
scope 优先级 local > project > user，同名去重，两份内容一样。
project scope 让全队 clone 下来零配置；user scope 与 cwd 无关——
会话开错目录时项目级资产全不在，而那正是最需要 vima 说话的一刻。

### 用到的 Claude Code 生命周期事件

| 事件 | vima 拿它干什么 | 反查 |
|---|---|---|
| `SessionStart` | 注入项目状态（只读） | R2 |
| `UserPromptSubmit` | 注入当前前沿（只读） | R2 |
| `PostToolUse` | 写文件后记 run 事件 | R2 |
| `PostToolUseFailure` | **失败也记**——只记成功等于只记好看的那一半 | R2 |
| `SubagentStart` | 记派工，与 Stop 配对算真实墙钟 | R2 · R5 |
| `SubagentStop` | 记耗用 + **打回**（两条判据，见下） | C1 · C2 |

`PreToolUse` **刻意不用**：立场是「绕过不被禁止——绕过只是没有收益」。
唯一的否决点是 SubagentStop 打回，它否的不是「你不能这么做」，是「你还没做完」。

`type: "prompt"` 形态的 hook（交给 LLM 判定，含 `impossible` 字段）同样**不用**：
硬约束写着「凡能用确定性代码解决的，不留给 Agent 概率性行为」，闸门尤其如此。

### SubagentStop 的两条打回判据

```
① 认领了却没达标   claimed 非空 ∧ 存在 meets()==false  → 打回，列出 need/got 与 vima submit
② 改了代码却没认领   claimed 为空 ∧ 改过项目代码        → 打回，列出文件与 vima claim / vima rule
```

②不是①的扩面，是同一条约束的另一面：**没有②，不调 `claim` 就是一条免检通道。**
一处改动说不出属于哪条命题，就是「未经授权的复杂度」（C2 原话）。

②豁免 `docs/`（规格真源本身，命题是它的投影）、`.vima/`、`.claude/`，
以及落在项目外的写入。于是 `vima-verifier`（没有 Write/Edit）与 intake（只写 docs/）
天然不受影响。

两条判据共用三条边界，缺一条这个 hook 就会被人整段删掉：
既没认领也没改代码 → 放行 · 读不到转录 → 放行但记 `claimScan:'unavailable'`
（「没法核」≠「核过了」）· `stop_hook_active` 为真 → 放行并记 `blockSuppressed`（防死循环）。

**两条都留出口**：做不动的记一条裁定说明为什么，照样能走。没有出口的闸门活不下来。

打回的 JSON 形状是**顶层** `{"decision":"block","reason":"..."}`。
Stop 族的 `hookSpecificOutput` 只接受 `additionalContext`，塞 `decision` 进去
等于什么都没做且不报错——形状写错会静默退化成「记一笔然后放行」。

---

## 模块接口（签名冻结）

### core/events.mjs
```js
append(root, { kind, actor, subject, payload, cost }, { now }) → Promise<event>
readAll(root) → Promise<{ events, corrupt }>
KINDS = ['claim','evidence','ruling','run']   // 封闭集合
TRUST / STRENGTH / strengthRank / trustRank
```

### core/claims.mjs
```js
project(events) → { claims: Map, rulings: [], runs: [], stats }
  // claim 事件 payload.retired:true = 退休：退出进度/待办/达标，壳保留（下游
  //   要能看见「我的上游没了」），重新声明即复活、证据从零。stats.retired 单独计数
  // 变化分三类，处置正交（S/E 两轴正交，变化处置也必须正交）：
  //   定义（layer/statement/from/impl）→ 清证据 + 传播失效
  //   来源（trust/source）→ 证据保留，S 轴实时读
  //   门槛（need）→ 证据保留，meets 实时算
  // ruling 事件 payload.overrides:<旧id> = 二次裁决：投影把旧裁定回填
  //   overriddenBy（append-only 不改旧行，只能由新行宣告）
best(claim) → evidence | null   // 最强的那份（含 adHoc）——观测面要如实显示它
isFormal(evidence) → boolean    // by.adHoc !== true
meets(claim) → boolean
  // 未退休 且 未失效 且 **有一份正式证据**强度≥门槛。
  // 注意不是 best()：best 回答「现在最强的证据是什么」，meets 回答「够不够交付」。
  // 两个问题共用一个答案，就是 `node -e "process.exit(0)"` 能换绿的由来。
blockedByAdHoc(claim) → boolean // 够门槛但只有临时证据——渲染层要指名说出来
LAYERS = ['intent','spec','contract','impl','behavior']
```

### core/lease.mjs
```js
acquire(root, claimId, { actor, worktree, now, ttlMs })
  → { ok:true, lease, renewed, reclaimed } | { ok:false, reason:'held'|'raced', held }
read(root, claimId) → lease | null     // 当前持有者（序号最大的那份）
list(root) → { leases, corrupt }       // 含已过期的；过期与否由调用方拿 now 判
isActive(lease, now) → boolean         // 到点即失效，不留半开区间
LEASES_REL = '.vima/leases'  ·  DEFAULT_TTL_MS = 30min
```

**它不是事件**：事件流回答「发生过什么」（append-only、永不过期、是产品真源），
租约回答「此刻这条题在谁手上」（会过期、崩溃后要能无声回收）。最终历史仍由
claim/run/evidence 事件重建，**删光 `.vima/leases/` 不损失任何真源**——所以它 gitignore、
不进版本控制、不参与 audit。

落盘 `.vima/leases/<claimId>/<6 位序号>.json`，**序号只增不减、文件名从不复用**。
当前持有者 = 序号最大的那份；接手 = 建 max+1，用 create-if-absent（tmp + `link`）
让内核保证只有一个人建得成。为什么不是一条题一个文件：那样回收过期租约必须先删后建，
删与建之间有窗口（A 删、A 建、B 把 A 刚建的新租约当旧的删掉、B 建 → 两个赢家）；
用 rename 抢占同样不行，rename 只保证「源存在」，不保证源还是刚读到的那份——
这个坑是实测出来的，8 进程抢一份过期租约出了 4 个赢家。

持有者身份 = `actor + worktree`。同身份重新 acquire 即**续租**（长任务靠它，不靠调大 TTL）。
**已知边界**：同 actor 同 worktree 的两个执行者，文件系统分辨不出来，会被当成同一个人。
真并行时执行者必须能自报家门——Builder 天然在各自的 worktree 里，人与 CI 用 `--actor`。

时钟纪律同 core 其余部分：`now` 由调用方注入，本模块不读系统时钟。
没有 `release()`：回收只有过期一条路，加一个没人调的释放接口就是「块定义了没人消费」。

### core/project.mjs
```js
findRoot(from) → Promise<string|null>        // 唯一判据：存在 .vima/
resolveRoot({ filePath, env, cwd })          // 四源回退，被写文件路径优先
readConfig(root) / writeConfig(root, cfg)
context(opts) → { root, config }             // CLI 与 MCP 共用
```

### core/extract.mjs
```js
scanTree(root, dirs) → { marks, calls, routes, files }
scanCalls(text) / scanRoutes(text) / scanMarks(text)
endpointKey(method, path) / normalizePath(p)
CAPABILITY                                    // 自陈能力边界
```

### assets/registry.mjs
```js
loadStyle(assetsRoot, theme) → { tokens, layout, interaction, ia }
listBlocks(assetsRoot) → [{ set, name, layers, meta }]
readBlock(assetsRoot, set, name) → { L1, L2, L3, L4? }
checkAssets(assetsRoot, config) → { theme, blocks }
  // 已登记的皮/块**真的读得出来吗**。判据就是 loadStyle/readBlock 自己，
  // 不另写一份「文件在不在」——那会是第二个真源。
  // 返回纯事实，error/warn 分级由注入方（front/actions.audit）定：
  //   皮不存在 → error（配置指向一个不存在的东西）
  //   块缺层/读不出 → warn（装了但不完整，不挡交付）
```

### assets/lock.mjs

资产的**可复现性**（R11 · C3）。`project.json` 记「想用什么」，
`.vima/assets.lock.json` 记「实际用的那一版长什么样」——一个会漂的名字，
和一份内容摘要，是两回事：安装包升级一次、块的 L1 契约改一行，
同一个名字指向的内容就换了，**而那些内容已经被用来取过证了**。

判据只有一处：`digestFiles` 是全仓唯一的摘要实现，`sync --check`、
`block upgrade`、测试都调它。第二份实现 = 两台机器算出两个结论。

```js
digestFiles([{ name, data }]) → 'sha256:…'
  // 唯一实现。按 name 排序后逐个喂「名字 + 长度 + 内容」。
  // 名字与长度也进摘要：只拼内容的话，把 L2 末尾剪到 L3 开头，摘要纹丝不动。
  // 摘要里不许有绝对路径/时间戳/随机数——有一个，换台机器就必然漂。
resolveBlock(assetsRoot, id)   → { requested, resolved, digest, source, layers }
  // 覆盖 blocks/<set>/<name>/ 下的每一个文件（含 block.json，不只是层文件）
resolveTheme(assetsRoot, name) → { requested, digest, source }
  // 覆盖 style/tokens/<name>.json + 全部 *.vocab.json——loadStyle 解析出来的
  // 就是这一整包，只锁令牌的话词表改了摘要不动，而供料内容已经换了

dependsOf(id, meta) → [块 id…]         // depends.capabilities 是人话，不参与机检
blockGraph(listBlocks 的结果) → Map<id, [依赖…]>
resolveDeps(graph, id) → { needs, missing, cycles }   // 一次报全，不是碰到第一个就抛

readLock(root) / writeLock(root, lock) / recordBlock / recordTheme / forgetBlock
checkLock(root, assetsRoot, config) → { entries, unlocked, locked, drifted }
  // entries[].status 四态，每一态都说得出「查了没有」：
  //   ok / drift / unreadable（算不出，是「没查」不是「通过」）/ orphan（config 与 lock 打架）
  // 三种非 ok 都计进 drifted；unlocked 单列且**不算漂移**——存量项目一上来全是
  // 未锁，算成漂移这条检查会在两天内被关掉。但必须报出来，不许混进绿里。
```

`resolved` 恒等于 `requested`：业务块版本兼容是需求基线里**明确排除**的一条。
字段留着是因为 lock 的形状要一次定好，不是为将来的版本机制预埋。

**刻意不做**：`block upgrade` 不自动作废证据。失效传播是 core/claims 的职责，
从这里另开一条「资产变了就清证据」的路就是第二个失效真源；而且判据也不该由它定
——L2 改个错别字和 L1 换个端点，对证据的意义完全不同，只有人分得清。
它只回答「谁会被波及」。

### assets/rules.mjs
```js
loadRules(assetsRoot, projectRoot) → [{ id, applies, text, origin }]
selectRules(rules, dims) → [rule]   // dims: { layer, side, app, blocks }
deadRules(rules, allDims) → [rule]  // 从未被任何任务命中 → 死规则
```

### front/actions.mjs

CLI 与 MCP 的唯一共享真源，两个门面只做「解析入参 → 调这里 → 渲染」。
这一节此前缺席——而 `next()` 是全系统给 agent 的主出口，它的响应形状漂了
没有任何地方能反查。

```js
next(ctx, { includeLeased }) → { task, dependsOn, derivesFrom, blockedBy, lease, leased,
                                 includeLeased, rules, context, assets, progress, notes }
  // 两种边分开（P0-9）：derivesFrom（=claim.from，追溯用，**不阻塞**）
  //   vs dependsOn（必须先存在的 contract/impl，**阻塞**）；blockedBy 是后者里未达标的。
  //   混成一条的后果是死锁：intent「降低登录失败率」要上线后 observed 才达标，
  //   要求它先 meets 才准做下游 = 第一行代码都写不出来。
  // 未过期租约占着的默认不进候选（并行不派重）；includeLeased 放宽这一步，
  //   leased 始终如实列出被挡在外面的候选。
  // 判据只有一处：dispatchState(claim, { claims, leases, now })，next 与 claim 共用。
  //   dependsOn(claim, claims) 的推导规则、以及它会在什么情况下推错，写在
  //   BLOCKING_LAYERS 上方的注释里（那是唯一的说明处，别再复制一份）。
  // assets: 按命题维度**裁剪后的真实内容**，不是 ID 列表（R7 · R11）
  //   { vocab:[{ vocab, group, terms:[id…], source }], blocks:[{ id, layer, body, source }],
  //     bytes, degraded }
  //   层裁剪：impl/behavior 给 layout+interaction 词表 + 块 L2/L3；
  //           contract 不给词表、给块 L1；intent 不给
  //   超 ASSET_BYTE_LIMIT(16KB) → 块正文降级为 { bytes, source } 引用并出 note
  //   读不出资产 → 进 notes，绝不让 next 失败（供料缺席不该挡住干活）

claimTask(ctx, claimId, { cost, worktree, ttlMs })
  → { claimId, event, at, claim, lease, renewed, reclaimed, dependsOn, blockedBy, notes }
  // 取租约（core/lease）后才落 run 事件。取不到 → FrontError('LEASED', exit 5)，
  //   带上被谁占着、什么时候过期，且**不落 run 事件**（没开工的事不进过程账）。
  // 执行依赖未达标不拦（C4 不阻塞），但进 blockedBy + notes——
  //   在未定的地基上施工是一个决定，得让人看见自己做了这个决定。

compileDocs(ctx, dir, { plan }) → { written, planned, claims, rejected, events,
                                    files, skipped, retired, noop, committed }
  // **整棵 docs 编译是一次事务**：算计划（内存里编，ctx.claims 传递批间可见性）
  //   → 全部校验 → 一次提交。有任何拒绝 → 零写入，不留一半新状态。
  // 与现状**完全一致**的命题不产生事件（noop）——原样重跑 written=0、日志不增长。
  //   比的是 payload 的每一个字段，不是「定义指纹」那一组：
  //   定义指纹管「要不要清证据」，这里管「要不要写事件」。少比一个字段，
  //   那个字段的改动会永远写不进去（人改了 docs 却毫无反应，比多写一条难查）。
  // plan:true 只算不写。

// 配置的受管写入口（P1-4）。全部原子写 + 记一条 op:'config' 的 run 事件。
appAdd/appList/appRemove · themeSet/themeShow · blockAdd/blockList/blockRemove
  // kind 校验实时读 ia 词表的 sides 组，**不抄一份合法值清单**
  // app 增删后自动 sync：端变了，.claude/rules/ 的 paths 投影要跟着变
  //   sync 失败不让配置写入失败（投影是派生物），但进 notes
```

### front/doctor.mjs

工具体检（P1-3）。**与 audit 分工明确，判据不许互抄**：

| | 回答的问题 | 看的东西 |
|---|---|---|
| `audit` | 项目符不符合规格、证据够不够 | 命题与代码 |
| `doctor` | **工具**装对没有 | hook 会不会真触发 · MCP 可不可达 · 投影漂没漂 · 版本兼不兼容 |

每一项问的都是「它**生效**了吗」，不是「它**在**吗」——v3 的 4 个 hook / 6 个子代理 /
4 个 skill 一个都没注册而体检报「通过」，证明这两者不是一回事。

```js
runDoctor({ root, config, assetsRoot, pkgRoot, checkProjection, registry })
  → { ok, counts:{ok,warn,error}, checks:[{ id, title, status, checked, message, fix, detail }] }
  // status 三档 ok / warn / error；有 error → CLI exit 5（同 audit 口径）
  // checked  **每项必填**：这次到底查了什么。一个 ✓ 不说清覆盖范围就等于一排绿勾
  // warn     多数是「查不了 / 没查」。**不许显示成通过**——静默为空不算通过
  // fix      每条 error/warn 给一条能照着跑的命令，不是「请检查配置」
  //
  // 九项 id（--json 消费者按 id 取，是对外契约）：
  //   node             Node 版本 vs package.json engines
  //   install          安装完整性：bin/ · assets/ · templates/project/ + 真列一次资产仓
  //   hooks-wired      settings.json 接的文件 ↔ hooks/ 里的 .mjs，**双向**比对
  //   hooks-anchored   命令锚在 $CLAUDE_PROJECT_DIR 或绝对路径（相对路径按 cwd 解析 = v3 原病）
  //   hooks-runnable   **真起一次进程**（最小 stdin，跑在一次性沙箱项目里，不写真项目事件流）
  //   mcp              .mcp.json 的 vima 服务 bin 存在且 `node <bin> --version` 跑得通
  //   agents           frontmatter 解析干净（unparsed 必须为空）· name 对得上 · skills: 引用真存在
  //   skills           SKILL.md 在 · frontmatter 解析干净 · name 等于目录名 · 有 description
  //   projection       调 `sync --check` 的**同一份判据**，不在这里重写

// 依赖由 front/actions.doctor 注入，不在 doctor.mjs 里自取：
//   checkProjection = () => sync({ root, config, check:true })   判据只有一处真源
//   registry        = await optional('registry')                 缺席时该项报「没查」

// 附带导出的纯判据（可单测，也防第二份口径）：
LAYOUT · parseHookCommand(cmd) · isAnchored(script) · expandProjectDir(script, root) · flattenHooks(settings)
```

`LAYOUT`（`.claude/` 落点清单）是分层边界的**明文例外**：`lib/` 平台中立、不实现
Claude Code 语义，唯一例外就是 init/doctor 作为安装器/体检器持有的这份清单。
它变更时必须与 `templates/project/.claude/` 同步——否则体检会去查一个早已搬家的落点，
然后报「通过」。

一个故障只许报一处红：`hooks-wired` 与 `hooks-runnable` 里的相对路径都按**项目根**解析，
「依不依赖 cwd」的判决权独归 `hooks-anchored`。两项同时红会让人以为有两个毛病，然后修错地方。

### ops/*.mjs

三个动词都**不写盘**：产出的是事件草稿（`{ kind, actor, subject, payload }`），
由调用方决定要不要喂给 `events.append`（append 仍是唯一写入口，ts 仍由它按注入的 now 打）。
因此 ops 层整体不碰时钟。ctx 形如 `{ root, config, actor, dirs? }`。

```js
readSpecs(dir) → { batches:[{ rel, batch }], skipped:[rel] }   // ops/spec.mjs
parseSpec(text, file) → batch | null
  // docs/ 的 markdown → 编译批次。markdown 是唯一真源，命题是它的投影。
  // 文件头 layer/upstream/trust/need/source；命题 = 列表项 `- \`id\` 陈述`；
  // 例外才缩进两格补属性（trust/need/from/source/impl/ruling.*）。未知键当场抛。
  // batches 按层排序：compile 校验上游必须已在事件流里，顺序错了下游整批被拒。
  // 代码围栏内一律不算命题（格式说明本身要拿围栏举例）。

compile(ctx, { upstream, layer, items }) → { events, claims, rejected }
  // 出处必须说得出，但形式按层分：
  //   顶层 intent —— 上面没有命题了，出处是**物料**，写 source（必填）
  //   其余层      —— 出处是上游命题，写 from（可继承本批 upstream）
  // trust 缺一即拒；逐条拒不牵连同批
  // items[].ruling 存在时：先产 ruling 事件、命题 trust 强制 'ruled'
  //   ruling 必须带 question / chosen / confidence(high|medium|low) / blastRadius(非空)
  // 命题 id 必须匹配 /^[a-z0-9][a-z0-9-]*$/ —— 否则 @vima 标注永远命中不了它

loadPolicy(root, id) → policy    // `.vima/policies/<id>.json`
  // 证据策略：把「怎么验」从交活时现挑，前移到项目里预先登记。
  // **expects 必须非空**——只看退出码的策略等于没有策略：退出 0 的命令太容易造
  // （空过滤器、零用例、恒真脚本）。至少一条 stdoutMatch / minLines / artifact。

attest(ctx, claimId, how) → { events, ok, strength, reason, detail, unimplemented }
  // executed 有两条来路，**证据里必须分得开**：
  //   策略  命令来自 .vima/policies/，还要过 expects → by.adHoc:false，正式
  //   现挑  命令由调用方在 submit 那刻给         → by.adHoc:true
  // 命题声明了 policy 且调用方没自带 cmd → 走策略；自带 cmd **不覆盖策略**
  //   （「声明了策略却拿别的命令交差」不该悄悄算成正式证据）
  // derived 附带落点校验：命题声明了**路径式** impl 时，@vima 标注必须落在
  //   声明范围内，否则拒绝（否则任意文件加一行注释就能换证据）；
  //   证据记 scopeChecked——false ≠ 核过了，只是没声明路径式落点
  // executed 证据恒标 by.adHoc:true：命令是调用方现挑的，不是预登记策略。
  //   策略机制（ADR-V4-005）落地前就打标，否则届时存量证据分不出来
  // how 说的是「用什么方式验」，结果由本模块自己算
  //   'claimed'  { note }                        恒为最弱档，by.actor 记下是谁说的
  //   'derived'  {}                              走 extract.scanTree 找 @vima 标注
  //   'executed' { cmd:[argv], cwd?, timeoutMs? } 退出码 0 才出证据，cmd+exitCode 记进 by
  //   'observed' {}                              AR-1 未实现，如实返回，不降级冒充
  // evidence 事件 actor 恒为 'system'；run 事件 actor 是触发者，成败都记

audit(ctx) → { findings, summary }
  // ctx 可注入 { deadRules, ruleCount }：判定在 assets/rules.deadRules（判据只有那一处），
  //   ops 不 import assets（兄弟层）。没注入时 summary.rules 为 null =「这次没查」，
  //   与「查了，0 条」不是一回事——同 closure-unchecked 的口径。
  // findings[].kind: stale | uncovered | weak | orphan-evidence | orphan-mark
  //   | dead-rule              ← 规则一次都不会被选中；消息里带出限定维度，
  //                              否则人得自己翻规则文件才知道为什么死
  //   | endpoint-unimplemented | endpoint-uncontracted | call-unserved | route-uncalled
  //   | closure-unchecked      ← 扫不到东西时明说「这一侧没判」，不静默计为 0 个问题
  // severity 只有 error（挡交付）/ warn（要人看）
  // summary.stale 是 R3 的失效清单；summary.extract 原样透传 extract.CAPABILITY
```

---

## 硬约束

- **零运行时依赖**：只用 `node:` 内建。当前提取用正则是权衡结果，换 AST 是独立立项。
- **原子写**：一律 `atomicWrite`（临时文件 + rename）。
- **不读系统时钟**：`now` 由调用方注入，同一输入必须字节一致。
- **不做长驻服务**：威胁模型是「执行者会偷懒」不是「会作恶」，文件足够。Web UI 按需起。
- **markdown 是真源**：投影是派生物，可随时重建，不得反过来当真源。

---

## 已知未接线（不是「不做」，是「还没做完」——别让它静默）

2026-08-16 病灶审计查实，记在这里防止被当成已完成。**这一节自己也会过期**——
条目做完了就地删掉并在 CHANGELOG 留痕，留着一条已经做完的「未接线」，
和一条已经做完的 TODO 一样，会训练读者整节跳过。

同日删掉两条已落地的：「供料支柱没有出口」由 `vima theme set|show` /
`vima block add|list|remove` 接上生产侧，`next()` 返回按层裁剪的**真实资产内容**
（词表切片 + 块正文 + source，超 16KB 降级为引用）；「`config.apps` 只有消费方」
由 `vima app add|list|remove` 接上，增删后自动刷新规则投影。
验收面在 `tests/unit/front.assets.test.mjs`——这一节说「接上了」是要能被指着看的。

1. **`vima init --theme=<不存在的皮>` 会当场报出来，但坏值仍然落进 `project.json`。**
   （2026-08-16 收窄了一半：init 现在真去 `loadStyle` 验、验不过出 note 并跳过锁，
   不再是静默成功。剩下的一半是**它没拒**——config 里躺着一个指向不存在资产的值。）
   为什么没直接拒：init 的职责是把骨架立起来，为一个可事后修的配置项让整条 init 失败，
   代价大于收益（人会以为项目没立成，重跑一遍还是同样的错）。
   现在的处置是「报 + 不锁 + 给修法」，`audit` 另有 `theme-missing`（error）兜底。
   要彻底关掉，得让 init 在皮不合法时**回落到默认皮并说明**——那是个产品决定，没定之前不改。
2. **`.vima/index/` 只有落点，投影缓存本身没实现。** 目前每条命令都全量重放事件流。
   接线时 fingerprint 判新鲜度的逻辑与消费方必须一起落地——只落缓存不落失效判据，
   会造出一个「读起来更快但可能是旧的」的第二真源，那比慢更糟。
3. **「ops 不碰时钟」没有机检。** 当前没违反；漂了不会有任何提示。
   （同类机检已有两条，都在 z.seams：分层边界的 import 方向检查，
   以及威胁模型措辞的超承诺词扫描，均 2026-08-16 补。）
4. **并行只做完了「不重复领题」这一半（P0-4）。** `core/lease.mjs` + `next` 的租约排除
   保证同一时刻同一条命题只会派给一个执行者（真并发验收在 `tests/unit/core.lease.test.mjs`
   与 `front.next.test.mjs`：N 个**进程**同抢，只有一个成功）。**没有**做的是另一半：
   - **worktree 里的事件流会分叉。** Builder 的 `isolation: worktree` 只隔离代码；
     每个 worktree 有自己的 `.vima/events.jsonl`，各写各的，没有合并规则。
     租约也一样——它落在 `vima` 解析到的那个根，各自的 worktree 里就是各自的租约，
     **互相看不见，也就互相不排除**。当前唯一让租约真起作用的用法是让所有执行者
     指向同一个根（`VIMA_PROJECT_DIR` 或 `--cwd`）；P0-4 要的
     stateRoot / codeRoot / coordRoot 三分尚未存在。
   - **证据不等代码合并。** 现在 submit 一取证就直接进主投影；P0-4 要的是
     Builder 写 outbox、父协调器验过 state/context digest 且**代码合并成功之后**
     才导入事件，合并失败时证据保持 pending 不制造假绿。这些都还没有。
   这两件都需要「协调器」这个概念（单协调器 + 多 Builder + outbox），是 one-way-door，
   本轮刻意没做。**别把「不重复领题」读成「并行已经做完了」**——
   两个 Builder 现在仍可能各自提交出一份互不相容的历史。

   同属这一条的已知边界：租约持有者身份 = `actor + worktree`，
   同名 actor 在同一目录下的两个执行者分辨不出来（会被当成同一个人续租）。
   Builder 天然在各自 worktree 里，人与 CI 用 `--actor` 区分；不给区分手段
   还指望互斥，那才是假的保护。
（同日删掉第 4 条：P0-8 措辞校准的最后两处已收口——`lib/core/events.mjs` 与
`lib/front/actions.mjs` 的文件头注释改为纪律 0 的口径，z.seams 的豁免表随之清空。
那条豁免是**只出不进的临时账**：加它时就配了过期检查，所以改好的当天它自己报红要求删除。
白名单的问题从来不是它存在，是它只进不出。）

## 明确不做

多人多会话协作 · 否决式闸门（不用 `PreToolUse`）· 业务块版本兼容 · 预建 memory 内容 · CLI 全量映射成 MCP 工具 · 宣称防恶意
