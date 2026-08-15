# vima-cli 代码审计问题记录

> 审计日期：2026-08-14　基线：v3.0.3（commit `ba507bb`）
> **复核与处置：2026-08-14**（基线已推进到 `5fc6f8e`）——逐条重读代码复核了本台账自身的结论，
> 两项改判、三处残留经核实已闭环、三项已修复。处置结论见各条目的「状态」行与 §五。
> 性质：问题台账——逐条验证外部审计报告 + 汇总契约同步残留。
> 判据真源：`docs/internal-contracts.md`（契约）、`docs/design/vima-cli-design-v2.md`（§N）、
> `docs/design/v2.1-amendments.md`（A1–A35）。

## 摘要

审计对象为一份 22 项外部审计报告（#1–#22），外加本项目开发过程中发现的 3 处契约同步残留。
验证方法：逐条读取实际代码（非采信报告行号）并对照契约文档。

| 分类 | 数量 | 说明 |
|---|---|---|
| 真实缺陷·已修复 | 3 | #21（page 缺 id）、#1（契约 §3 口径）、#6（certify 证据新鲜度） |
| 真实缺陷·复核后改判为不修 | 2 | #2（manifest 降级）、#5（currentPhase 校验）——理由见各条 |
| 误报 | 8 | 报告结论不成立，勿动代码（#3 / #4 / #8 / #9 / #13 / #15 / #16 / #20） |
| 低严重度 / 设计权衡 | 9 | 技术事实真实，但严重度低或属有意设计 |
| 契约同步残留 | 3 | **已由 `5fc6f8e` 全部闭环**（本台账写就时尚未纳入） |

外部报告准确率约 68%（15/22 属实或部分属实），但 8 项误报拉低可信度，且 HIGH 定级普遍虚高。
**复核补充**：该报告亦有漏检——`5fc6f8e` 顺带修掉的 `DESIGN_INDEX_DRIFT` 绕过 `VimaError`
直写 stderr（与契约 §3「所有错误走 VimaError」冲突）属同量级缺陷，22 项中无一命中。

---

## 一、真实缺陷（5 项 → 3 修 2 改判）

### 1.1 manifest 损坏短路降级（#2，MEDIUM）——**改判：不修**

- **位置**：`lib/model/template.mjs:83-93`、`lib/model/manifest.mjs:22-26`
- **问题**：`readProjectTemplateId` 的降级意图是「manifest.templateId ?? lifecycle.templateId ?? null」，
  但 `loadManifest(root)` 调用在 try 块**之外**（第 84 行）。manifest.json 损坏时
  `loadManifest` 抛 `MANIFEST_PARSE`（manifest.mjs:25），异常未被捕获、不降级读 lifecycle，
  导致「manifest 损坏 = 项目不可操作」。
- **证据**：`loadManifest` 仅在文件缺失（ENOENT）时返回 null（manifest.mjs:19），
  解析失败必抛错；`readProjectTemplateId` 的 catch 只捕获 `NO_LIFECYCLE`（template.mjs:90），
  不覆盖 manifest 异常。
- **状态（2026-08-14 复核）**：**不修**。代码描述准确，但「manifest 损坏 = 项目不可操作」不成立，
  且原修复方向有害。四个怕挂的消费方都已降级：`doctor.mjs:59`（转 warn 跳过）、
  `doctor.mjs:178`（第⑧项明确报 error「manifest.json 不可读」，用户拿得到清晰信号）、
  `trace.mjs:39`、`certify` 的 `templateMaturityOf`。剩下未捕获的是 `init` 与两个 render——
  那里抛 `MANIFEST_PARSE` 恰是**正确行为**：静默降级去读 lifecycle 等于让 init 在 manifest
  已损坏的项目上继续重写受管文件，把损坏掩盖过去（与 §3「错误输出稳定」「如实」相悖）。
  另：`readProjectTemplateId` 的注释只承诺「两个文件都**缺失**时返回 null」，实现与注释一致，
  不存在两张皮。

### 1.2 certify 信任过期 converge 报告（#6，MEDIUM）——**已修复**

- **位置**：`lib/commands/certify.mjs:127-155`
- **问题**：`checkConverged` 只读磁盘上的 `convergence.json`，判断 `summary.errors===0 && openPoints===0`
  即认定 converged，**既不重跑 converge、也不做 stale 检测**。spec/任务在报告生成后改动时，
  certify 仍按旧报告误认证为 converged 级。
- **证据**：同文件 `checkImplemented` 对视觉证据（certify.mjs:82-88）明确「重算 + 要求缓存与重算一致」，
  但 converged 级没有对等的 stale 检查。报告中的 `sha256(text)`（certify.mjs:146）是报告**自身**的哈希，
  只证明「证据来自这份报告」，不用于 stale 判定。
- **状态（2026-08-14）**：**已修复**（立项为 A32 D-A32-05）。`converge.mjs` 拆出只读评估器
  `evaluateConvergence(root, {cliRoot})`，`run` 退为「调评估器 + 写盘 + 打印」（行为不变，
  converge 20 个单测原样通过）；certify 复用它重算并要求磁盘报告与重算 `stableStringify` 一致，
  不一致即判过期报缺。评估器抛 `VimaError` 时不使 certify 崩溃（exit 恒 0）。
  落点：契约 §6.13（新登记跨模块接口）+ §6.19（converged 判据）、A32 规格第 5 条与落点表、
  `tests/unit/c3.certify.test.mjs` 增两例（伪造绿报告被识破 / 报告落盘后任务再变 → 掉级、重跑恢复）。
- **副作用（预期内）**：此前靠手写 `convergence.json` 就能评上 converged 的用法失效——
  这正是本条要治的假成功。既有两个单测因依赖该旧语义而失败，已改为真跑 converge。

### 1.3 loadLifecycle 不校验 currentPhase（#5，MEDIUM-LOW）——**改判：不修**

- **位置**：`lib/model/lifecycle.mjs:116-132`（`PHASES` 定义于同文件第 14 行）
- **问题**：`loadLifecycle` 只做 `JSON.parse`，不校验 `currentPhase ∈ PHASES`。后续
  approve/change/design 等命令直接做 `===` 字符串比较，拼写错误的阶段名（如 `PLANING`）
  会导致所有阶段判断静默失败；目前仅 doctor 做了该校验。
- **证据**：`PHASES = ['BOOTSTRAP','PLANNING','DESIGNING','DEVELOPING','MAINTAINING']` 就定义在
  同文件，却未在读入时使用。
- **状态（2026-08-14 复核）**：**不修**。技术事实成立，但「所有阶段判断静默失败」是误导——
  全部消费方都是 `!==` 守卫、遇到非法阶段名一律 **fail-closed** 并给出提示（`approve.mjs:40`、
  `design.mjs:708/808/914`），不会带病干活；`doctor.mjs:105` 还专门用 `PHASES.includes` 明报。
  且无任何 §N / A# 要求 model 层做此校验，下沉后会把「doctor 能诊断的数据问题」变成
  「所有命令一起硬崩」，对存量项目是净损失。按 CLAUDE.md「防过度设计」判据（反查不到需求
  = 未授权的复杂度）不做。

### 1.4 无 id 的 page 块静默丢弃（#21，LOW）——**已修复**

- **位置**：`lib/model/spec.mjs:64-65`、`lib/commands/validate.mjs:488-496`
- **问题**：`loadSpec` 丢弃缺 `id` 的 page 块（不入 Map）；validate 的 `dup()` 只检查 ID **重复**、
  不检查**缺失**（`block.data?.id` 为 undefined 时静默 `seen.set(undefined)`）。结果：残缺 page 块静默消失。
  且 spec.mjs:64 注释「结构合法性由 validate 规则负责报告」与实现不符——注释与实现两张皮。
- **状态（2026-08-14）**：**已修复**。在 `validatePages` 里唯一还看得见原文块的位置
  （ID 唯一性循环）按块校验并附**开栏行号**，归入 V-SPEC-03（页面块完整性），不新造规则编号——
  `validatePages` 的复用方 render-review / render-prototype 一并受益。落点：`validate.mjs`、
  契约 §8 V-SPEC-03 行、`templates/admin/planning/validate.checklist.md` 镜像行、
  `c3.validate.test.mjs` 增 2 例（单元级带行号断言 + 破坏黄金夹具的端到端）。
  spec.mjs:64 的注释「结构合法性由 validate 规则负责报告」**因此变为如实**，注释无需改动。

### 1.5 契约 §3 正文与 §4 矛盾（#1，文档问题，非代码 bug）——**已修复**

- **位置**：`docs/internal-contracts.md:82`（§3 正文）vs §4:177-178 与代码 `lib/util/fs.mjs:24`
- **问题**：契约 §3 正文写项目根定位为「含 `docs/lifecycle.json` 或 `.vima/manifest.json`（文件）」，
  但 §4 的 `findProjectRoot` 定义与 §3.1 的 NOT_IN_PROJECT 错误码均写「`.vima/`（目录）」，
  代码（fs.mjs:24 检查 `.vima` 目录）与 §4/§3.1 一致。真正的缺陷是契约内部自相矛盾，
  §3 正文残留 v2.0 旧定义未随 A24 更新。
- **复核补充**：该行 stale 之处**有两处**，本条原描述只提了一处——除 `.vima/manifest.json`（文件）
  vs `.vima/`（目录）外，后半句「**不向上递归查找**，v2.0 简化」同样被 A24 的
  `findProjectRoot`（§4：逐级向上查找最近祖先）直接推翻。
- **状态（2026-08-14）**：**已修复**。§3 正文改为「由 `findProjectRoot`（§4）逐级向上查找含
  `.vima/` 或 `docs/lifecycle.json` 的最近祖先，未命中 → `NOT_IN_PROJECT` 且不写任何文件」，
  并标注该口径自 A24 起取代 v2.0 简化。代码无 bug，未动。

---

## 二、误报（8 项，不成立）

| # | 报告指控 | 不成立的原因（代码证据） |
|---|---|---|
| #3 | renderVars `$` 注入 | `create.mjs:44` 是**函数式 replace** `(_, k) => String(vars[k] ?? '')`；函数返回值不会被 `$&`/`$1` 特殊解释，`$` 注入只在字符串替换参数里发生 |
| #4 | sync computeBatches 部分落盘 | `sync.mjs:90` 的 `computeBatches` 在**步骤①（taskStats 写盘，96-108 行）之前**执行；抛错时尚未写任何文件 |
| #8 | non-goals 非数组静默忽略 | `validate.mjs:1028` 的 V-SPEC-11 会因 `hasNonGoalsBlock=false` 报错，非静默（仅报错文案「缺键」略误导） |
| #9 | topoOrder 缺循环保护 | `topoOrder` 是 `computeBatches` 的**闭包局部函数**（plan.mjs:90），外部不可调用；且前置全图 DFS 环检测（62-81 行）可靠 |
| #13 | countTaskStats/countStats 不一致 | 两函数服务不同契约 schema：前者 → lifecycle.taskStats（§6.2 `{total,done,failed,blocked}`），后者 → batch-plan.json stats（§6.5 含 `pending/running`），字段差异有意为之 |
| #15 | walkFiles 符号链接环 | `walkFiles` 用 `readdir(withFileTypes)`，symlink 的 `isDirectory()` 返回 **false**，不会递归进入符号链接，无无限递归 |
| #16 | mock date i>31 无效日期 | `i` 上限 20（`mock.mjs:79` many 档 `page(20)`），`2026-01-20` 合法，永不触发 i>31 |
| #20 | 全局正则 lastIndex 脆弱 | `converge.mjs:58` 与 :83 已**正确重置** `lastIndex=0`，无实际 bug，仅「可用 matchAll 替代」的风格建议 |

---

## 三、低严重度 / 设计权衡（9 项）

| # | 问题 | 定性 |
|---|---|---|
| #7 | 未闭合 vima 围栏吞后续块（`md.mjs:44/70`） | 真实但会抛 `YAML_PARSE` 而非「静默丢失」；「宽容处理」是有意设计 |
| #10 | reconcile 全量失效页面批准（`design.mjs:959-960`） | 真实但属「下游一律回炉」保守策略，且 digest 含全局 Stage A 冻结物 |
| #11 | change apply 不校验任务存在（`change.mjs:372-373`） | 真实但需毫秒级并发删除任务才触发，LOW |
| #12 | 多处裸 catch（`trace.mjs:39`、`validate.mjs:671`） | 属实但均有降级注释与意图，非「掩盖 bug」 |
| #14 | VimaError 不支持 cause 链（`errors.mjs:11-19`） | 真实，属「确定性错误输出优先」的设计选择；DEBUG 已输出完整堆栈 |
| #17 | doctor 用 mtimeMs 判新鲜度（`doctor.mjs:211-234`） | 真实但仅是提示性体检；硬闸门（approve 前置）用字节哈希 |
| #18 | 多端页面缺 app 静默跳过（`design.mjs:397-399`） | 真实，但 validate 已有 V-SPEC-13（validate.mjs:192）拦截，影响窄 |
| #19 | 页面批准缺 designDigest null 防御（`design.mjs:439-444`） | 真实，与 direction 检查（:425 查 `rec.digest===null`）不一致，触发窄 |
| #22 | saveManifest 无 schema 校验（`manifest.mjs:30-32`） | 真实但属「校验在读入/validate 层」的分层设计 |

---

## 四、契约同步残留（3 处，独立于 22 项之外）——**已全部闭环**

> **状态（2026-08-14 复核）**：三条在基线 `ba507bb` 时均属实，但已由其后的
> `5fc6f8e fix: 收口 A34 契约同步` 全部修掉——本台账写就时该提交尚未纳入。核实结果：
> `NO_APP` / `NO_PAGE` / `DESIGN_RECONCILE_INVALID` 现已在 §3.1 表内；§2 的 C3 清单已含
> `design.mjs`，`change.mjs` 的跨模块复用接口也在 §6.18 附近单独交代了归属；
> `planning.interactionLanguage` 已在 §6.3 的示例与正文两处登记。
> **另有一处原描述有误**：`UNKNOWN_SUB` 不是「已抛出但未登记」——它在 `ba507bb` 的
> `design.mjs:1038` 确实存在，`5fc6f8e` 把它换成了 `usageError`（正确解法是删码而非补表），
> 现全仓零命中。

A34（视觉真源兑现机制）落地后，消费端已接线但契约清单未跟上：

1. **契约 §3.1 错误码表漏 4 个 code**：`DESIGN_RECONCILE_INVALID` / `NO_APP` / `NO_PAGE` /
   `UNKNOWN_SUB` 已在 `lib/commands/design.mjs` 抛出，但登记表零命中。
   违反 §3.1「stderr 首行的 `<CODE>` 是稳定输出接口，新增/改名必须先改本表」。
2. **契约 §2 文件所有权 C3 清单漏 `design.mjs`**：`design` 命令未列入「并行开发期谁写哪个文件」
   的对齐清单；`change.mjs` 为 design 复用的导出（`computeImpact`/\`snapshotBaseline`/\`CHANGES_REL`）也因此无处交代归属。
3. **契约 §6.3 漏 `planning.interactionLanguage` 键**：A34 新增的 `template.json` 键未登记，
   姊妹键 `planning.designLanguage`（A30）已登记。

---

## 五、处置结论（2026-08-14）

| 条目 | 处置 | 落点 |
|---|---|---|
| #6 certify 采信过期 converge 报告 | **已修复**（立项 A32 D-A32-05） | `converge.mjs` 拆 `evaluateConvergence`、`certify.mjs` 重算比对、契约 §6.13/§6.19、A32 规格与落点表、单测 +2 |
| #21 page 块缺 id 静默丢弃 | **已修复**（并入 V-SPEC-03） | `validate.mjs`、契约 §8、`validate.checklist.md`、单测 +2 |
| #1 契约 §3 项目根口径 stale | **已修复**（两处，非一处） | `docs/internal-contracts.md` §3 |
| 契约同步残留 3 处 | **已闭环** | 由 `5fc6f8e` 修完，本次仅核实 |
| #2 manifest 损坏降级 | **改判：不修** | 消费方已降级；未捕获处抛错才是正确行为，降级会掩盖损坏 |
| #5 loadLifecycle 校验 phase | **改判：不修** | 消费方 fail-closed + doctor 明报；无需求授权，属防过度设计红线 |
| 二、误报 8 项 | 维持 | 抽检 #3/#4/#8/#16 复核，免罪结论均正确 |
| 三、低严重度 9 项 | 维持缓办 | 如需动，#19（designDigest null 防御，与 direction 的 `rec.digest===null` 检查不对称）成本最低 |

验证：`npm test` 473/473 通过（较修复前 470 增 3 例新测试），零回归。
