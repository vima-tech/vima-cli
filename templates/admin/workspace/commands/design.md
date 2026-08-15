---
description: 执行 Vima DESIGNING 阶段的视觉设计、方向选择、页面冻结和出口闸门；用户输入 /design、开始设计或继续设计时使用。
---

# /design 命令

## 触发条件

用户输入 /design。本命令**只在 DESIGNING 阶段有意义**——
`docs/lifecycle.json` 的 `currentPhase` 不是 DESIGNING 时，先说明当前阶段与该走的路，不硬跑。

## 它解决的问题

管线里原本没有任何环节回答「这一页设计够不够一个正常页面」。
结构声明 + 机检守得住「不坏」（下限），守不住「好看」（上限）——
唯一的人审位看的是灰盒线框，人从来没有机会在版面上说「不行」。
`/design` 就是补上的那一段：**让 Claude Design 产生方案，让 vima 把方案冻结、传递、保护住。**

## 执行流程

### 1. 阶段与前提

- 读 `docs/lifecycle.json`：`currentPhase` 须为 `DESIGNING`（由 `vima approve --planning` 推进）
- 跑 `vima design status`，看清有多少 D1/D2 页要出稿
- **全页 D0** → 告知用户「本项目确定性跳过发散轮，设计语言由 A30 推导产出 Stage A」，结束
- 确认 Claude Design 已授权；**未接入则如实停下**，不要拿线框冒充视觉稿

### 2. 派 `vima-designer` 出 Design Brief

事实从 spec 与契约**读**，读不到就问用户，禁止推断。
产出 3–5 条关键体验目标，与用户确认后置 `checklists.DESIGNING.briefReady`。

### 3. Stage A0 三方向发散（按端各一张标志性页面）

派 `vima-designer` 产出三个方向 + **三方向差异矩阵** + 核心任务流 + 关键状态转换。

**把三个方向摆给用户选。** 你可以解释、可以推荐，但不得代选——
这是口味裁定，不是可推导的结论。用户也可以要第四轮，或要求融合。

选定后 `vima design approve direction --app <id>`（多端逐端），
并置 `checklists.DESIGNING.directionsExplored`。

每端方向冻结包固定落在 `docs/review/design/_shell/<appId>/`，且必须包含：
`brief.md`、`direction-a.png`、`direction-b.png`、`direction-c.png`、`comparison.md`、
`selection.md` 与声明上述文件的 `manifest.json`。缺任一项时 approve 必须失败，不能写空摘要。

### 4. 受控回写（仅当获胜方向改变了产品）

若获胜方向改了页面能力 / 交互模型 / 信息架构：改 `docs/spec.md` 与契约，
然后 `vima design reconcile`。

它会：要求方向批准有效 → 复用 A31 影响面算法 → 让旧页面批准与 `tasksApproved` 失效。
**方向批准本身不会因这次回写失效**——它的摘要不含 spec，否则会被自己触发的回写作废。

**不要用 `vima change close`**：它要求受影响任务全部 done，而此刻任务尚未拆解，必然死锁。

### 5. 反向提炼 Stage A

从**获胜实例**提炼设计系统（先有优秀实例、再抽象规则，顺序不能反），固化进
该端 Stage A 样式资产、`docs/design-language.md` 与 `docs/interaction-language.md`：

| app kind | Stage A 样式资产 |
|---|---|
| `admin-web` | `<app>/src/styles/layout.css`、`<app>/src/styles/tokens.css` |
| `mp-native` | `<app>/src/vendor/vima-ui-mp/dist/ui.wxss`、`tokens.wxss` |
| `h5-mobile` | `<app>/vendor/vima-ui-h5/dist/ui.css`、`tokens.css` |

### 6. Stage B 逐页稿 + 冻结

对每个 D1/D2 页出稿并冻结进 `docs/review/design/<PAGE-xx>/`。
D2 的 `prototype.html` **必须自包含**（零外部网络请求）。

完成后 `vima design approve pages`。

### 7. 重建任务与评审载体

设计回写和逐页稿冻结后，按最终 spec / 契约重新生成任务、覆盖矩阵、审计视图与线框原型。
此时才允许产生最终任务拆解；若 reconcile 使旧 `tasksApproved` 失效，禁止复用旧批准。

### 8. 出口闸门

```bash
vima design status       # 重生成只读派生索引 INDEX.json
vima design check        # 六项派生状态；全绿才可离开 DESIGNING
```

六项分别是：`fidelityClassified`（每页已定级）、`designArtifactsComplete`（D1/D2 产物齐全）、
`directionApproved`、`signaturePagesApproved`、`designApprovalFresh`（摘要未漂移）、
`designSystemFrozen`（Stage A 与交互语言已冻结）。

**注意 `design check` 只看设计面**——此刻页面还没实现，它不会、也不该要求任何实现期报告。
实现期的汇总归 `vima design verify`，那是 DEVELOPING 收口的事。

全绿后跑 `vima approve` 进 DEVELOPING（它会复查这六项）。

## 边界

- 设计稿**不得发明**业务事实（新接口 / 新字段 / 新权限 / 新规则）——确需新增回第 4 步
- `serve_url` 不许进任何用户可见文本、日志或落盘文件；给用户的链接只能是 `open_url`
- 「好不好看」由用户裁定，Agent 不得代选、不得在报告里替用户下结论
