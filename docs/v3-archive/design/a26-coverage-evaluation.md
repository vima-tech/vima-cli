# 四种前端模式覆盖度深评（A26 草案 · 评审轮）

> 创建日期：2026-08-14
> 评估对象：**A26 草案第 1 版**（`a26-custom-frontend-draft.md`）+ 已落地的
> admin-web / mp-native（A23）/ h5-mobile（A25，工作树未提交）。
> 问题：这套设计能否「完美支持」四类主要前端的开发需求？
> 方法：按全生命周期 14 环逐环 × 逐 kind 过一遍，每个疑点回查代码钉死（证据给 `文件:行`）。
> **结论先行**：三个已落地端在框架承诺范围内成立；**A26 草案第 1 版有 6 处缺陷（G1–G6），
> 其中 G1 照原文实施会回归 mp/h5 既有行为**——已全部修入草案第 2 版；
> 修正后四端机检覆盖对等，但「完美」只成立于 4 条框架级边界（B1–B4）之内。

---

## 1. 全生命周期覆盖矩阵

✅ 通 · ⚠️ 有缺陷/降级（编号见 §2）· ◻ 不适用 · Ⓑ 边界（见 §3）

| # | 生命周期环 | admin-web | mp-native | h5-mobile | custom-web（草案 v1） | 修正后 |
|---|---|---|---|---|---|---|
| 1 | `create --apps` / 交互多选 | ✅ | ✅ | ✅ | ✅（规格 8，机制现成） | ✅ |
| 2 | 存量增端 `vima app add` | ✅ | ✅ | ✅ | ✅（app.mjs:100-145 通用，含骨架+A19 基线+按端 ui-docs） | ✅ |
| 3 | `init` 组件文档安装 | ✅ 66 份 | ✅ ui-docs-vm 33 份 | ✅ 同 mp 共用 | ✅（uiDocs: null 跳过） | ✅ |
| 4 | PLANNING 词表 | ✅ 封闭 7 词 | ✅ 封闭 8 词 | ✅ 同 mp | ✅（`vima:blocks` 自声明） | ✅ |
| 5 | validate V-SPEC 族 | ✅ | ✅ | ✅ | ⚠️ **G4**：纯展示页撞 V-SPEC-03「apis 非空」硬墙 | ✅ |
| 6 | render-review 审计视图 | ✅ | ✅ | ✅ | ✅（layoutSketch 按词画通用条，词中立） | ✅ |
| 7 | render-prototype 原型 | ✅ desktop-admin | ✅ phone-tabbar | ✅ 同 mp | ✅ plain 外壳 + wf-generic（代价已知情） | ✅ |
| 8 | context 组件切片 | ✅ 内置表 | ✅ componentMap | ✅ 同 mp | ⚠️ **G3**：modal 键回落 VLayer 幻组件泄入切片 | ✅ |
| 9 | context 契约/规则/规范切片 | ✅ | ✅ | ✅ | ✅（kind 中立） | ✅ |
| 10 | post-write 写后机检 | ✅ 全套 8 项 | ✅ vm 面 | ✅ vm 面（h5 变体） | ⚠️ **G1**（回退面错配回归 mp/h5）+ **G2**（扩展名门静默漏检）+ **G6**（任务模板悬空指针） | ✅ |
| 11 | V-CODE-01 代码↔契约 | ✅ | ✅ | ✅ | ⚠️ **G2**：.jsx/.svelte 不入扫描 → 连「诚实未启用」都不触发 | ✅ |
| 12 | converge V-INT 族 | ✅ | ✅ | ✅ | ✅（规格 6 门面守卫；受 G2 连坐，随 G2 修） | ✅ |
| 13 | A7 运行时证据 | ✅ vite 中间件（含 A25 补的项目根定位，frontend/vite.config.ts:14-34） | ✅ automator 采集器（诚实降级纪律） | ✅ vite 中间件 | ❌ **G5**：四端唯一无采集通道，/check・converge・retro 三消费方各缺一路信号 | ✅ |
| 14 | update（A19 骨架基线）/ retro | ✅ | ✅ | ✅ | ✅（app add 已记基线） | ✅ |

**批次调度（plan/A17/A18）、任务体系、契约体系、覆盖矩阵、approve/trace**：全部 kind 中立，
四端天然共享，未单列（评估过，无 kind 相关分支）。

---

## 2. 缺陷清单（G1–G6，均已修入草案第 2 版）

### G1 · 回归级：checks 回退面写错，mp/h5 会被套 admin 面

草案 v1 规格 5 原文：「v1 manifest / 无 `checks` 快照 → **全开（= 现状 admin 面）**」。

**推演**：存量项目的 v2 manifest（A16 之后、A26 之前创建）里 mp/h5 端条目**没有** `checks`
快照，而 `vima update` 的 manifest 迁移只做 v1→v2 端册合成，对既有 apps 条目
**「原样保留」**（update.mjs:79-83）、不加新键。hook 改为读快照后，
这些端命中回退 → 按 admin 面审查 → 给 `.wxml` 报「缺少 vui-page 类」——
**恰好是 hook 注释自己警告的『套错比不查更糟』**（post-write.mjs:149-150），
且直接回归 A23/A25 行为。

**修正**（草案 v2 规格 5）：回退面**按 kind 取内置缺省**（admin-web=全套 /
mp-native=vm 面 / h5-mobile=vm 面，即今天的三分支行为逐字节保留）；
**未知 kind → 最小安全集**（blockMarks+nativeDialog），负空间这才真正消除——
第五种模式出现时缺省是「少查」而不是「按 admin 查」。

### G2 · 阻断级：扩展名门让 custom 的机检静默失效

两处白名单都没有 .jsx/.svelte/.astro/.html：

- hook 入口门 `/\.(vue|ts|tsx|wxml|wxss)$/`（post-write.mjs:148）——React(.jsx)/Svelte/Astro/
  原生 html 的 custom 端，**blockMarks（custom 仅存两项检查之一）永不运行**，无任何提示；
- V-CODE-01 扫描集 `['.ts','.tsx','.vue','.js','.mjs']`（validate.mjs:1524）与 converge 的
  `FE_EXTS`（converge.mjs:27）同款——纯 .jsx 项目 markedFiles=0，被当「尚未开工」
  静默跳过，**连规格 6 守卫的『诚实未启用』都不会触发**（守卫前提是 markedFiles ≥1）。

**修正**（草案 v2 规格 5/6）：两处集合放宽为固定宽集（并入 `.jsx` `.svelte` `.astro` `.html`）。
**不做可配置扩展名**——宽集覆盖主流栈，为长尾栈开配置面是 YAGNI；
真出现再加（`.wxml/.wxss` 保留，正则对任意文本语言均成立，放宽零风险）。

### G3 · 误导级：弹窗组件回落 VLayer 泄入 custom 切片

`context.mjs:63-72`：`modals 非空 → addAll(blockMap.modal ?? ['VLayer'])`。
custom 端项目映射若未写 `modal` 键 → **幻组件名 VLayer 进切片**，
违反草案自己的「禁止回落内置 V\* 表」。A23 刚为 mp 修过同一形状的坑
（「写死 VLayer 等于该端弹窗切片恒空」），这次是反向：不该给的给了。

**修正**（草案 v2 规格 4）：开放词表端 modal 无映射 → 空 + 并入「未配置组件映射」明示，
**任何情况下不回落 VLayer**。

### G4 · 硬墙级：V-SPEC-03 强制每页 apis 非空，纯展示页无路可走

`validate.mjs:130-132`：`apis` 空数组即 error，无豁免。纯展示页（关于页/引导页/静态结果页）
在四端都合法存在——admin 项目今天就得给这类页面**编造接口**才能过闸门；
custom 端（营销页/内容页占比高）撞墙频率成倍放大。
菜单/角色反而不是墙：validate 对 `spec.menus/roles` 全部 `Array.isArray(...) ? : []` 容缺
（validate.mjs:271-322），零菜单零角色可过。

**修正**（草案 v2 规格 3）：允许**显式** `apis: []`（省略字段仍 error）——
沿 V-SPEC-11「空清单须显式 `non-goals: []`」的既有先例：显式空 = 人确认过「本页无接口」，
缺失 = 漏填。全 kind 统一放宽（展示页不是 custom 特有）；
下游 V-SPEC-07/V-TASK-07/原型接口徽标对空集皆自然空转，验证过无连坐。

### G5 · 信号缺失级：custom 是四端唯一没有 A7 运行时证据的

消费方实证：`/check` 第 6 步读 runtime-errors（check.md:27）、converge 的
`summary.runtimeErrors`（converge.mjs:23,128）、retro 采集（retro.mjs:24）。
供给方：admin/h5 = vite 中间件（含项目根定位）、mp = automator 独立采集器。
custom 端用户自带 dev server，草案 v1 完全没提——三个消费方各缺一路客观信号。

**修正**（草案 v2 新增规格 9）：骨架附 `src/utils/report.ts`（框架无关的 fetch 上报，
与 §6.10 端点契约对齐）+ README 给出「接进你的 dev server」两种形态
（vite/webpack 皆为 connect 风格中间件，照抄 frontend/vite.config.ts:29-59 不到 40 行）；
**照搬 mp 采集器的诚实降级纪律**：接不上就不写文件——
「空的 runtime-errors 会被 /check 读成『跑过且零错误』，而真相是『根本没跑』」
（collect-runtime-errors.mjs 头注原话）。无法自动注入的部分按 A5 诚实分级在 README 声明。

### G6 · 文案级：前端任务模板的 admin 专属指针对 custom 悬空

`_template-fe.md:35`「开工前先读：… → 共享层 CAPABILITY.md」、
`:71-72`「组件已全局注册无需 import，先读 CAPABILITY.md」——
custom 端无 CAPABILITY.md、组件也未必全局注册。任务模板是每个前端任务的开工引导，
错误指针会进每个 custom 任务。

**修正**（草案 v2 落点）：两处改为按端中性表述
（「本端组件能力文档：admin/vm 端为 docs/ui-framework/<appId>/CAPABILITY.md；
custom 端为项目自备文档与 component-map.json」）。

---

## 3. 边界声明（B1–B5：不是缺陷，是范围——但必须说出来）

| # | 边界 | 事实依据 | 对四端的含义 | 处置 |
|---|---|---|---|---|
| B1 | **后端骨架无条件落盘**：create 只有 `--no-git/--no-install`，无 `--no-backend`（create.mjs:21-22；copyRosterScaffold 对 backend 无条件拷贝） | 「custom 前端 + 别处已有后端」会背一个死重 Java 骨架；V-INT 族因无 @vima 标注后端文件优雅跳过（`no-marked-backend` 口径已有） | 纯前端形态归 P2 `templates/web/`（D-A26-05），不塞进本项 | 已在草案边界节声明 |
| B2 | **契约模型 REST-only**（method/path/request/response 五要素） | GraphQL/tRPC 前端的契约、V-CODE、V-INT 全链不适用 | 四端共同边界，非 custom 特有 | 声明，不放宽 |
| B3 | **V-CODE-02 只认 Java Spring 注解**（validate.mjs:1555 只扫 `.java`） | 非 Java 后端时后端侧对账优雅缺位（同 B1 跳过口径） | 同上 | 声明 |
| B4 | **V-SPEC-02 要求 entities 非空** | 零数据模型的纯静态站不在框架问题域——框架是「一后端 × 多前端」的系统开发框架，不是静态站生成器 | 静态站请勿入；有数据的展示型站点靠 G4 修正即可 | 声明，不放宽 |
| B5 | **guard-shared 与自定义设计系统的节奏摩擦** | custom 端组件库在项目内生长（不像 admin 有 vendor 现货），共享层写保护会更常触发 sharedChangeRequest | 机制已有非缺口；planning-guide 需提示：shared-base 批先立设计系统骨架，业务批只消费 | 草案 v2 落点已加 planning-guide 一句 |

---

## 4. 结论

**「能否完美支持四类前端」的诚实回答分三层**：

1. **admin / mp / h5**：14 环矩阵全通。机制层面（词表、文档、切片、原型、机检、证据、增端、
   升级基线）已对等落地；mp/h5 标注「开发完善中」的余量在资产厚度（组件数、文档细度、实战验证），
   不在框架机制。
2. **custom-web**：草案第 1 版**不能**——G1 会回归既有两端、G2 让仅存的机检静默失效、
   G4 是设计期硬墙。修正后（草案第 2 版）与其他三端达到**同一档机检覆盖**：
   词表/切片/原型/写后/对账/证据六条线全通，且每条降级都有「诚实未启用」出口而非假绿假红。
3. **边界之外无「完美」**：REST-only、Java 后端对账、entities 必填、后端骨架必落
   是框架级承诺范围，四端一体适用。把边界说清楚（B1–B5 + 草案「不做」节）
   恰恰是这套框架「宣称 = 实现」纪律的一部分——
   完美支持的正确定义是**边界内全链机检、边界上诚实声明、边界外明确拒绝**，按此定义，
   修正后的设计成立。

**本轮评估的方法论收获**（值得记）：草案的 6 处缺陷里 4 处（G1/G2/G3/G5）都是同一类错——
**规格写了「做什么」，没推演「存量数据/异构输入撞上回退路径时发生什么」**。
回退路径（`?? 'ui-docs'`、`?? ['VLayer']`、「无快照→全开」、扩展名白名单）
是这套框架每次出问题的高发地带，评审任何新增补项时应把「全部回退分支 × 存量项目」
作为固定检查项。
