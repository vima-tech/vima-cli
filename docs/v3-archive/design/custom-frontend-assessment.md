# 自定义前端场景适配评估

> 创建日期：2026-08-14
> 问题：当前框架是否适用于**灵活自定义前端的原型设计**——不严格使用 `vima-ui-*` 组件库，
> 也不使用 admin 脚手架前端。
> 方法：逐层核对实现（非推断），证据均给 `文件:行`。本文只评估，不改任何代码。
>
> **状态回填（2026-08-14 同日）**：本文 §5 的 P0/P1 已收敛为立项草案
> `docs/design/a26-custom-frontend-draft.md`（A26 `custom-web`）。
> §5 R9「h5 的处置」与 P2「新增 `templates/web/`」两条**已被 A25 取代**——
> A25 已裁定 H5 收编为 kind `h5-mobile` 并落地（`ui-docs-vm/` / `scaffold/h5-mobile/` /
> `vima app add` 均在位），故本文涉及 h5 的判断以 A25 为准，不再代表现行结论。

---

## 0. 结论摘要

**一句话**：主干适用，UI 侧不适用；但真正的障碍**不是配置项不够**，
而是**「原型」二字在两边指的不是同一个东西**——本框架的原型是**结构对齐载体**
（刻意无视觉，`prototype.mjs:1-8`「语义占位线框（刻意无样式感）」），
自定义前端要的原型设计是**视觉探索载体**。用扩词表的办法去弥合，
必然把 spec YAML 长成一门蹩脚 UI DSL、把确定性渲染器长成半个浏览器——
那是典型的过度设计，且撞死在「零运行时依赖」硬约束上。

**量化耦合面**（实测）：

| 维度 | 总量 | 与前端形态耦合 | 占比 |
|---|---|---|---|
| 校验规则（`internal-contracts` 规则表） | 50 条 | **1 条硬墙**（V-SPEC-04）+ 2 条静默劣化（V-CODE-01 / V-INT-04）+ 3 条随词表连坐（V-SPEC-03/12/15） | 12% |
| 模板资产 | — | 组件文档 66（admin）+ 29（mp）份、post-write 5 类检查、渲染器 2 个 shell 硬分支 | 重 |
| 内核 `lib/` | 7532 行 | 词表取值 + 组件映射表 + 请求门面正则，三处 | 轻 |

**耦合是「重在模板、轻在内核」**——这是好消息：主干（契约体系、任务拆解、
批次调度、覆盖矩阵、收敛对账、复盘）与前端长什么样完全无关，
一条也不用动。要动的集中在**词表所有权、组件文档来源、写后检查项、请求门面**四个口子。

**建议**：不扩视觉词表、不写视觉 DSL；把**结构真源与视觉真源正式分离**，
各自唯一、各自机检，机检只做「存在 + 不漂移」，不做「像不像」。
分级落地见 §5，明确不做见 §6。

---

## 1. 先界定场景（三类，结论不同）

「灵活自定义前端」至少指三种，混谈会答非所问：

| 代号 | 场景 | 形态特征 | 与本框架的距离 |
|---|---|---|---|
| **S1** | 自定义组件体系的后台/中台 | 仍是表格/表单/弹窗，只是不用 `vima-ui-admin`（自研设计系统、Tailwind、antd 等） | **最近**。只需打开 §5 的 P0 四个口子 |
| **S2** | 设计驱动的 C 端产品 / 营销站 | 版式自由、视觉本身就是交付物，区块是 hero/story/gallery 而非 table/toolbar | **最远**。P0 之外还须裁定视觉真源（P1） |
| **S3** | 原型探索期（先做高保真原型再定需求） | 需求尚未收敛，靠原型试错反推需求 | **次序相反**。本框架是 spec-first，全部机检以 spec 为前提 |

下文逐条判定时会标注适用场景。

---

## 2. 耦合面实证清单

| # | 层 | 耦合点 | 证据 | 自定义前端下的实际表现 | 严重度 |
|---|---|---|---|---|---|
| 1 | 校验 | **V-SPEC-04 词表封闭**：`layout` 与 `components[].block` 必须 ⊆ 归属端 kind 的 `layoutVocab`（admin-web 7 词 / mp-native 8 词） | `validate.mjs:88-91,147-161` | 写 `hero`/`gallery`/`timeline` → **立刻 error，validate 不过 → /go 前置闸门不放行** | **硬墙** |
| 2 | 模型 | **kinds 定义权只在 CLI 内置模板**：`kinds = BUILTIN_KINDS + template.planning.kinds`，项目侧无任何注入点 | `lib/model/apps.mjs:11-19,71-73` | 项目不能自定义端形态，只能改 CLI 包或复用 admin-web | **硬墙** |
| 3 | 上下文 | **组件映射表内置**：`BLOCK_COMPONENTS`(7) / `TYPE_COMPONENTS`(12) 硬编码 V* 组件名 | `context.mjs:19-40,47-72` | 无 `componentMap` 的端回落到 V* 名；自定义前端拿到的组件清单**指向不存在的组件** | 高 |
| 4 | 安装 | **`init` 按端拷 ui-docs，缺省回落 admin 的 `ui-docs/`** | `init.mjs:113-130` | 自定义前端项目被装进 66 份 `V*.md` 组件文档（managed），**主动误导 Builder** | 高 |
| 5 | 渲染 | **原型渲染器词表特化 + shell 硬分支**：`BLOCK_WORDS` 11 词决定样式类与分发；`shell` 只有 `desktop-admin` / `phone-tabbar` 两支 | `prototype.mjs:16-19,73,144-164` | 新形态要么套后台外壳，要么改模板资产渲染器 | 中 |
| 6 | 定位 | **原型刻意无视觉**：「只表达功能与布局，不表达视觉」 | `prototype.mjs:1-8`、设计 §13.3、`prototype.template.html` | 对 S2「视觉即交付物」**价值错位**——原型无法承担设计对齐 | **根本冲突** |
| 7 | 对账 | **manifest ↔ `data-block`/`data-modal` 机械对账**粒度绑在词表上 | `post-write.mjs` 第 5 项、`prototype.mjs:169-181` | 词表若不能表达真实区块，标注就是给设计强行贴后台标签 | 中 |
| 8 | Hook | **post-write 5 类 admin 专属检查**：`.vui-page` 类、裸色值禁令、操作列手写 width、VIcon 名 ∈ vendor manifest、幻包名/深路径导入 | `post-write.mjs:8-25,161-250` | 自定义前端**持续误伤**——尤其「裸色值只许出现在 `--x:` 定义行」，设计驱动页面必然大量触发 exit 2 | 高 |
| 9 | 校验 | **V-CODE-01 请求门面写死 `request.<verb>(...)`** | `validate.mjs:1521`（注释自陈「请求门面是各 kind 骨架契约」） | 用 axios 实例/fetch/TanStack 的自定义前端 → **静默漏报**：幻接口、越权调用一条查不出 | 高（隐蔽） |
| 10 | 收敛 | **V-INT-04 复用同一扫描结果**判「消费端调用缺失」 | `converge.mjs:271-291` | 同上前提下 → **每个接口都假红**，收口闸门被噪声淹没 | 高 |
| 11 | 模板 | **非 admin 模板全是占位**：h5/cli/lib/script 的 `planning` 资产为零，h5 只有一份 README | `templates/h5/scaffold/README.md`、各 `template.json`、`create.mjs:415-418` 的 preview 警告 | 现实中「非 admin 前端」在框架里**没有可用模板**，只能借 admin | 中 |
| 12 | 共享层 | `sharedDirs` 含 `vendor` 的写保护 | `apps.mjs:27`、guard-shared | 无 vendor 时该条自然空转，**无害** | 无 |

**读法**：#1/#2 是「今天就跑不通」；#9/#10 是「跑得通但机检失真」——后者更危险，
因为报告仍然出，只是内容不可信（与 A24 对 F8 的判词同类：**误报成事实并持久化**）。

---

## 3. 三处硬墙 + 两处静默劣化

**硬墙（立即阻断）**

1. **词表**（#1）：自定义区块名 → V-SPEC-04 error → validate 不过 → 第一道闸门不放行。
2. **端形态定义权**（#2）：项目无法声明自己的 kind，只能挑 CLI 里已有的两种。
3. **可用模板**（#11）：admin 之外没有带 planning 资产的模板，`create` 会明说「规划体系尚未就绪」。

**静默劣化（跑得通，但价值归零或变噪声）**

4. **V-CODE-01 漏报**（#9）：代码↔契约对账在自定义 HTTP 封装下**恒不命中**。
   这条是 A6「规范执行者阶梯」的 L3 主力之一，失效后相关规范全部退回 L5 人审。
5. **V-INT-04 假红**（#10）：收口期每个接口一条 warn。按 A24 对 F10 的判词，
   **永远无法清除的 warn 会训练出「整个列表不用看」的习惯**，等于连坐废掉 A20/A22 的收敛价值。

外加一条**持续摩擦**：post-write 的裸色值/`.vui-page` 检查（#8）会在自定义前端上
每次写文件都 exit 2，实践中必然导致使用者手改 hook —— 而 hook 是 managed 文件，
手改后 `doctor` ⑧ 长期报「受管文件被手改」（A24 已在 coding-standards 上踩过同一个坑）。

---

## 4. 根本冲突：不是缺配置，是「原型」定义不同

这是本评估最重要的一节，也是唯一不能靠加参数解决的一条。

**框架的确定性从哪来**：spec 的页面块是**有限词表上的结构化数据**，
所以能同源投影出四份产物（md / 审计视图 / 线框原型 / manifest）并机械对账（设计 §13.3）。
**有限词表是全部确定性的地基**。

**自定义前端原型设计要表达什么**：版式、层级、留白、节奏、色彩、动效——
**开放式表达**。它的本质是「这批像素长这样」，而不是「这页有哪几个区块」。

两者相撞，有且只有三条路，其中两条是错的：

| 路径 | 做法 | 判定 |
|---|---|---|
| A | 扩词表 + 把样式塞进 YAML（`hero: {bg, height, align...}`） | ❌ 词表爆炸且永远不够用；渲染器要长成浏览器；框架替所有项目做视觉决策，必然长期漂移。**违反防过度设计红线（字段镀金 + 抽象提前）** |
| B | 视觉真源放框架之外，不登记 | ❌ 破坏 A2 单一真源：manifest 对账基线与真实实现长期分叉，Verifier 拿着过期基线判定 |
| **C** | **结构真源与视觉真源分离，各自唯一，互不覆盖；视觉侧只登记引用与哈希，机检只做「存在 + 不漂移」** | ✅ 保住确定性地基，不引入 UI DSL，不越零依赖边界 |

**顺带一条硬裁定**：视觉级机械验收（截图 diff、computed-style 断言、token-lint）
**不可能进 `lib/`**——它需要浏览器运行时，直接违反「零运行时依赖 + 单测不依赖网络与运行时」。
这与 A24 对「冷启动可用性检查」的裁定同款：**降级为 pipeline 收尾任务的验收项**，
由项目侧自带脚本执行，框架只负责固化断言口径。

---

## 5. 应对方案（分级，按增量排序）

### P0 — 让「自定义前端」成为一等公民（S1 只需这一档）

> 设计原则：**只开四个受限口子，不开插件框架**。口子的共同形态是
> 「把决定权从框架下放给项目，但结构约束不变」——对账链（manifest / `data-block` / hook）
> 零改动继续生效，因为对账不关心词**是什么**，只关心词**稳不稳定**。

**R1 词表所有权下放**
kind 增加 `layoutVocab: "open"` 取值（或等价的 `vocabSource: "project"`）。
该端的 V-SPEC-04 退化为：词必须 ∈ **项目自声明的词表块**（spec 第三章新增 `vima:blocks`，
每词须有 `id` + `desc`）。**仍然是有限词表，只是所有权在项目**。
未声明词表块却用了开放 kind → error（不许无词表裸奔）。

**R2 组件文档来源下放**
kind 声明 `uiDocs: null` 时：`init` 不安装任何 `V*.md`；`context` 的组件切片改从
项目侧 `docs/ui-framework/<appId>/` 取，映射表读**项目侧不受管文件**
`docs/ui-framework/<appId>/component-map.json`（沿用 A24 `coding-standards.local.md` 的先例：
不入 manifest、doctor 不校验）。文件缺失 → 切片为空 **+ 一行明示提示**，
不回落 V* 名（现状回落即是「主动误导」，见 #3/#4）。

**R3 写后检查项按 kind 开关**
kind 声明 `codeChecks: [...]`。自定义端默认只保留**形态无关**的两项：
`block-marks`（区块标记对账）与 `no-native-dialog`（原生 confirm/alert）。
`.vui-page` / 裸色值 / 操作列 width / VIcon 名 / vendor 深路径 归入 `admin-web` 的检查集。
**要害**：不再需要使用者手改 managed hook 来止血。

**R4 请求门面可配置**
`.vima/manifest.json` 端条目增 `apiFacade`（标识符名，缺省 `request`）。
V-CODE-01 与 V-INT-04 共用该配置。
**并补一条作用域守卫**（照抄 V-INT 后端守卫的既有手法）：某端**扫不到任何门面调用**时，
V-CODE-01 与 V-INT-04 对该端**整族跳过并在报告里写明「未启用：门面未识别」**——
把「假红」换成「诚实的未启用」，这比继续报警重要得多。

**R5 原型第三种外壳**
`shell: "plain"`：无侧栏、无手机框，页面按 `menus` 顺序平铺 + 锚点。
改动局限在模板资产 `prototype.mjs` / `prototype.template.html`。

### P1 — 视觉轨（S2 才需要，须单独立项）

**R6 视觉引用登记（不解析内容）**
页面块新增可选字段 `design: <相对路径>`（指向 `docs/design-refs/PAGE-01.png|.html`）。
- `render-prototype` / `render-review`：在该页挂一个链接（原型仍保持无样式）；
- manifest 记录 `{path, sha256}`；
- 新增规则：**文件存在** + **哈希与 manifest 一致**（不一致 = 设计改了没重渲染，提示重新对齐）。
- **框架不读设计文件内容、不做任何视觉判定**。

**R7 视觉验收流水线模板**
新增 `_template-visual-check.md`（A20 收尾流水线家族），把「逐页对照设计稿走查 +
项目自带截图/样式断言脚本」固化为收尾任务的验收口径。脚本归项目，框架只固化口径。

### P2 — 模板落地

**R8 新增 `templates/web/`**：planning 资产复用 admin 绝大部分（spec 骨架保留九章，
权限章允许为空）。**必须同时解决渲染器落点**：`prototype.mjs` / `audit-view.mjs`
现为每模板一份，再复制一份就是三份并行漂移。
建议 `templates/_shared/planning/` 或允许 `renderers` 跨模板引用。
**这一条是「立项即做透」的要害**——先复制后治理必然留债。

**R9 h5 的处置**：并入 web 模板，或按 A5 能力诚实分级明确标注不做。不要留占位 README。

### 场景 → 档位对照

| 场景 | 需要 | 说明 |
|---|---|---|
| S1 自定义组件体系后台 | P0（R1–R4，R5 可选） | 原型继续做结构对齐，够用 |
| S2 设计驱动 C 端 | P0 + P1 | 视觉必须有独立真源，否则对齐体系在最关键的一环缺位 |
| S3 原型探索期 | **建议先在框架外做原型** | spec-first 是全部机检的前提；原型定稿后再进 spec，次序不可倒 |

### 验收判据（可跑命令，供立项后使用）

```bash
# R1 开放词表：项目自声明词表内的词通过，词表外的词报错
vima validate --json | grep -c 'V-SPEC-04'            # 词 ∈ vima:blocks → 0
# 未声明词表块却用开放 kind → error（不许裸奔）
# R2 不装 V* 文档 + 切片不回落
ls docs/ui-framework/<appId>/ | grep -c '^V.*\.md$'   # 0
vima context <taskId> --stdout | grep -c 'VTable'     # 0（无映射时空切片 + 提示）
# R3 hook 按 kind：自定义端页面写入含字面量色值不再 exit 2
# R4 门面守卫：未识别门面时 V-INT-04 不假红
vima converge --json | grep -c 'V-INT-04'             # 0，且报告含「未启用：门面未识别」
# R5 plain 外壳
grep -c 'wf-side' docs/review/prototype.html          # 0
vima render-prototype --check                          # 0（确定性不变）
```

### 落点表（雏形）

| 类型 | 路径 |
|---|---|
| 端模型 | `lib/model/apps.mjs`（kind 新字段 `layoutVocab: "open"` / `uiDocs: null` / `codeChecks` / `apiFacade`）、契约 §5/§6.3 |
| 校验 | `lib/commands/validate.mjs`（V-SPEC-04 开放分支 + `vima:blocks` 新规则 + V-CODE-01 门面配置）、契约 §8 |
| 收敛 | `lib/commands/converge.mjs`（V-INT-04 门面守卫）、契约 §12 |
| 上下文 | `lib/commands/context.mjs`（组件映射来源下放 + 空切片提示）、契约 §6.11 |
| 安装 | `lib/commands/init.mjs`（`uiDocs: null` 跳过安装） |
| 模板资产 | `prototype.mjs` / `prototype.template.html`（plain 外壳）、`post-write.mjs`（检查项按 kind）、新模板 `templates/web/`、渲染器共享落点 |
| 设计真源 | `v2.1-amendments.md` 新增 A25、`vima-cli-design-v2.md` §3.7/§13.3 |
| 单测 | `c3.validate` / `c3.context` / `c3.converge` / `c4.*`（开放词表与门面守卫矩阵） |

---

## 6. 明确不做（防过度设计红线）

- **不扩框架级通用视觉词表**（hero/gallery/pricing/timeline…）。那是框架替所有项目做视觉决策，
  永远不够用且必然漂移。词表所有权下放给项目才是正解（R1）。
- **不把样式/尺寸/色彩/动效写进 spec YAML**。见 §4 路径 A 的判定。
- **不在 `lib/` 内建像素级或运行时视觉校验**（截图 diff / computed-style / token-lint）。
  违反零运行时依赖，且单测将依赖浏览器。归 pipeline 任务（R7）。
- **不为自定义前端另造一套任务/契约/批次/覆盖矩阵体系**。这部分本就与前端形态无关，
  50 条规则里 46 条原样适用。
- **不把 kinds 开放成任意项目 JSON 覆盖内核**。只开「词表来源 / 文档来源 / 检查项 / 请求门面」
  四个受限口子；开成通用插件点是 YAGNI——只有一种自定义前端形态时不需要第二层抽象。
- **不改「原型无视觉」的定位**。线框原型继续只做结构对齐；视觉走 R6 的独立真源，
  两轨各自唯一，不互相覆盖。

---

## 7. 不改框架的过渡用法（今天可行）+ 代价

若现在就要用 vima-cli 管一个自定义前端项目：

1. 用 admin 模板建**单端**项目；
2. 区块名硬套现有 7 词（`cards`/`form`/`tabs`/`table`/`toolbar`/`search`/`pagination`）近似表达；
3. 手改项目内 `.claude/hooks/post-write.mjs` 注释掉 `.vui-page` / 裸色值 / VIcon 三项；
4. 删掉 `docs/ui-framework/` 下的 V* 文档，改放自己的设计系统文档；
5. 前端 HTTP 封装取名 `request` 并保持 `request.get('/api/...')` 形态，以保住 V-CODE-01。

**代价（须知情）**：
- 原型与真实设计脱节，`prototype.manifest.json` 的区块清单对实现是**近似而非真值**；
- 组件清单切片失去意义（`context` 仍会按 7 词映射出 V* 名，需人工忽略）；
- 第 3 步导致 `doctor` ⑧ 长期报「受管文件被手改」，`vima update` 会反复冲突；
- 第 5 步是把项目的代码风格绑给校验器，属倒因为果，长期不可持续。

**诚实结论**：S1 可以这么过渡；**S2 不建议硬上**——付出的噪声与误导成本会超过框架带来的收益。

---

## 8. 待裁定的开放问题

1. **目标场景是 S1 / S2 / S3 哪一类**？决定要不要做 P1 视觉轨（也决定工作量是「四个口子」还是「四个口子 + 一条新产物线」）。
2. **自定义前端是否仍走「一后端 × 多前端」端册（A16）**？决定 web 是**新 kind**（挂在 admin 模板下，与 mp-native 并列）还是**新模板**（`templates/web/`，独立技术栈）。
3. **接受「词表由项目定义 ⇒ 原型样式退化为通用灰盒」吗**？开放词表后，渲染器无法为未知词做特化样式，
   只能统一渲染成带标题的灰盒（`table`/`form` 那样的特化只对内置词有效）。这是 R1 的必然代价。

---

## 附：本评估的证据索引

| 断言 | 证据 |
|---|---|
| 词表封闭且按端取 | `lib/commands/validate.mjs:88-91,147-161,178-183` |
| kinds 只能来自 CLI 模板 | `lib/model/apps.mjs:11-19,71-73` |
| 组件映射内置 V* | `lib/commands/context.mjs:19-40,47-72` |
| init 回落 admin ui-docs | `lib/commands/init.mjs:113-130` |
| 原型无样式定位 / 外壳两分支 | `templates/admin/planning/prototype.mjs:1-8,16-19,73,144-164` |
| post-write admin 专属检查 | `templates/admin/workspace/hooks/post-write.mjs:8-25,161-250` |
| V-CODE-01 门面正则 | `lib/commands/validate.mjs:1521` |
| V-INT-04 复用同一扫描 | `lib/commands/converge.mjs:271-291` |
| 非 admin 模板为占位 | `templates/h5/scaffold/README.md`、`lib/commands/create.mjs:415-418` |
| 组件文档份数 66 / 29 | `find templates/admin/ui-docs -type f \| wc -l`、`ui-docs-mp` 同 |
| 规则总数 50 | `awk '/^\| V-/' docs/internal-contracts.md \| wc -l` |
