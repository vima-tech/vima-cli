# A26 草案：完全自定义前端（`custom-web`）——四种前端模式的最后一块

> 创建日期：2026-08-14 · **修订：同日第 2 版**（深评轮 G1–G6 修正入文，
> 评估报告见 `a26-coverage-evaluation.md`）· **状态：草案，待评审后并入
> `v2.1-amendments.md` 作为 A26**
> 来源：`docs/design/custom-frontend-assessment.md`（耦合面实证）+ 本轮需求
> ——前端最终支持四种模式：**完全自定义 / admin / h5 / 小程序**。
> **承继 A25**：「模式 = kind」这根轴已由 A25 D-A25-01 裁定并落地
> （`templates/h5/` 已改述为指针，`h5-mobile` 已进 `template.json`），本项不再重复立项。
> 现状已具备三个 kind：`admin-web` / `mp-native` / `h5-mobile`；**本项补第四个 `custom-web`**。
> 体例遵循 A22/A24/A25：决策表（A4）→ 规格 → 验收判据（可跑命令）→ 落点 → 边界 → 不做。

---

## 一、起点与目标

### 现状（工作树实测，非推断）

```
template.json  planning.kinds = { admin-web, mp-native, h5-mobile }
               apps           = [ admin:admin-web, patient:mp-native, h5:h5-mobile ]
组件文档         ui-docs/(66 份, admin) + ui-docs-vm/(33 份, mp 与 h5 共用, A25 D-A25-04)
存量项目增端     vima app add <id> --kind <kind>（lib/commands/app.mjs 已在位）
A7 运行时证据    admin/h5 = vite 中间件（含项目根定位）；mp = automator 采集器
```

三个 kind 的共同前提：**框架提供 UI 框架 + 组件文档 + 封闭词表**。
`custom-web` 要打破的正是这个前提——**框架不提供 UI，也不规定 UI**。

### 目标状态：四模式能力矩阵

| 维度 | `admin-web`（已具备） | `mp-native`（A23） | `h5-mobile`（A25） | **`custom-web`（本项）** |
|---|---|---|---|---|
| 区块词表 | 框架封闭 7 词 | 框架封闭 8 词 | 同 mp 8 词 | **项目自声明 `vima:blocks`** |
| 控件类型词表 | 框架封闭 12 类（四模式共用，D-A26-02 不下放） | 同左 | 同左 | 同左 |
| 组件文档 | `ui-docs/`（66） | `ui-docs-vm/`（33） | 同 mp（共用） | **项目 `docs/ui-framework/<appId>/`** |
| 组件映射 | 内置表 | kind `componentMap` | 同 mp | **项目 `component-map.json`（不受管）** |
| 原型外壳 | `desktop-admin` | `phone-tabbar` | 同 mp（共用） | **`plain`（顶部导航）** |
| `regions`（A14 分栏） | true | false | false | **true** |
| 写后检查面 | admin 全套 | vm 面 | vm 面（h5 变体） | **仅 `blockMarks` + `nativeDialog`** |
| 请求门面 | `request` | `request` | `request`（axios 版） | **可配（缺省 `request`）+ 未识别守卫** |
| A7 运行时证据 | vite 中间件 | automator 采集器 | vite 中间件 | **reporter util + 接入指引（规格 9）** |
| 骨架 | Vue3+Vite+vendored UI | 小程序原生 | Vue3+Vite+`vima-ui-h5` | **只放对账最小约定，零 UI** |
| 存量项目增端 | `vima app add` | 同左 | 同左 | **同左（对等）** |
| 后端 | 四模式共用同一后端与同一套契约（A16 一后端 × 多前端） | | | |

**兼容性总纲（A19 升级可达性）**：本项新增的 kind 键与 manifest 字段**全部可选**，
缺省行为与现状**逐字节一致**——三端骨架、三端原型 `--check`、全量单测必须全绿，
作为硬验收（见 §四）。**「逐字节一致」明确包含存量项目**：A16 之后创建的 v2 manifest
没有本项新字段，其 mp/h5 端的写后检查面必须保持 vm 面不变（规格 5 的回退裁定，深评 G1）。

---

## 二、决策表（A4 体例）

| 编号 | 决策 | 理由 | 已否决方案 | 否决理由 |
|---|---|---|---|---|
| D-A26-01 | **`custom-web` 作为第四个 kind 进 admin 模板**，不新建模板 | 承继 A25 D-A25-01：kind 才能进端册、进批次、进原型渲染、进 context 切片、进 `vima app add`。自定义前端与其他三端共用同一后端与同一套契约 | 新建 `templates/web/` 独立模板 | 独立模板没有后端与契约，代码↔契约对账与 `consumers` 越权判定全都无从谈起（A25 D-A25-01 已论证过同一条） |
| D-A26-02 | **只下放「区块词表」，控件类型词表保持框架封闭** | `input/select/date/upload…` 是**交互语义**不是视觉，四模式通用；A22 的 V-SPEC-15（弹窗字段 ↔ 提交入参对账）依赖它作公共基准 | 区块词与控件词一并下放 | 控件词一旦下放，字段级对账立即失去语义基准，收益为负 |
| D-A26-03 | **写后检查面由「kind 布尔分支」改为「端册配置驱动」；回退面按 kind 取内置缺省，未知 kind 取最小安全集** | 现状 hook 已有 `isMp`/`isH5`/`isVmKind` 三个标志、8 处分支点，且 `!isVmKind` 是**负空间判定**——任何新 kind 默认落进 admin 规范面。hook 自己的注释已写明「套错比不查更糟」。回退裁定见规格 5（深评 G1：存量 manifest 无快照，回退面写错会回归 mp/h5） | ① 加第四个标志 `isCustom` 继续分支；② 无快照一律回退 admin 全套 | ① 负空间缺陷不消除，且 hook 是 managed 文件、每加模式都要改；② 存量 v2 manifest 的 mp/h5 端无快照，回退 admin 面 = 给 `.wxml` 报「缺少 vui-page 类」，回归 A23/A25 |
| D-A26-04 | **视觉真源不进本项**（评估 §5 的 P1 视觉轨独立立项） | 本项目标是「自定义前端能进框架跑通全流程」；视觉对齐与模式轴正交，任何 kind 都可能需要 | 本项顺带做 `design:` 引用与哈希登记 | 防过度设计红线①：需求说 A 别写成 A、B、C |
| D-A26-05 | **纯前端项目（无后端）由 `templates/web/` 承载，本项不做** | `custom-web` 作为 admin 模板的一个端已覆盖「自定义前端 + 现有后端」，不阻塞本项；「有无后端」是模板轴的问题，与 kind 轴正交 | 本项一并做纯前端模板 | 立项范围外 |
| D-A26-06 | **`custom-web` 骨架只放「对账链需要的最小约定」，零 UI** | `custom` 的定义就是框架不规定 UI；给了页面模板/样式/令牌就是又在规定 | 给一套 Vite+Vue 起步骨架 | 与本 kind 的立项理由自相矛盾；且必然被换掉（用户带自己的技术栈） |
| D-A26-07 | **显式空接口页合法化：`apis: []` 全 kind 统一放行（省略仍 error）** | 纯展示页（关于页/引导页/静态结果页）四端都合法存在，现状只能编造接口过闸门（V-SPEC-03 硬墙，深评 G4）；custom 端撞墙频率成倍放大。沿 V-SPEC-11「空清单须显式」先例：显式空 = 人确认过，缺失 = 漏填 | ① 仅对 custom-web 放行；② 维持非空强制 | ① 展示页不是 custom 特有，按 kind 划豁免面违反「约束别扩面」的反向——同一事实两种判法；② 强制的结果是假接口进契约，比空更毒 |

---

## 三、规格（九条，`custom-web` 的确切行为）

### 规格 1：kind 配置面扩展（契约 §6.3）

kind 定义新增 4 个**可选**键。`custom-web` 的完整声明：

```json
"custom-web": {
  "layoutVocab": "open",
  "regions": true,
  "shell": "plain",
  "status": "stable",
  "uiDocs": null,
  "apiFacade": "request",
  "checks": { "blockMarks": true, "nativeDialog": true }
}
```

| 键 | 取值 | 缺省（不写时） | 消费方 |
|---|---|---|---|
| `layoutVocab` | 字符串数组（现状）\| **`"open"`**（新） | 内置 admin-web 7 词 | V-SPEC-04/12、渲染器 |
| `uiDocs` | 相对目录（现状）\| **`null`**（新） | `"ui-docs"` | `init`、`app add` |
| `apiFacade` | 标识符名 | `"request"` | V-CODE-01、V-INT-04 |
| `checks` | 检查项映射（规格 5） | 按 kind 内置缺省面（规格 5） | post-write hook |

三个既有 kind 不写新键 → 行为逐字节不变。

**`apiFacade` 的生效链**（深评修正——分清谁读什么）：kind 声明**缺省值**；
`.vima/manifest.json` 端条目可声明**项目级覆盖**（如项目把门面命名为 `http`）；
生效值 = `manifest.apps[].apiFacade ?? kind.apiFacade ?? 'request'`。
消费方 V-CODE-01 / V-INT-04 都在 lib 内、可经 `resolveApps` 读到模板 kind，
故 **manifest 覆盖仅在「项目改名」时才需要写**，`create`/`app add` 不主动落这一键
（少一键 = 少一处漂移面）。hook 不消费 `apiFacade`。

### 规格 2：项目词表块 `vima:blocks`（spec 第三章）

```yaml
vima:blocks
blocks:
  - id: hero
    desc: 首屏主视觉区
  - id: story
    desc: 品牌叙事段（图文交替）
  - id: gallery
    desc: 作品/案例陈列
```

- `id` 匹配 `^[a-z][a-z0-9-]*$`，全 spec 唯一；`desc` 非空。
- **不分端**：词表全项目共用。封闭词表的端不受影响——admin 端页面写 `hero` 仍报 V-SPEC-04，
  因为它的有效词表是自己的 7 词。故「不分端」安全，且免去一个词在两端各声明一次。
- **`desc` 只是给人与 Builder 读的一句话，不是渲染指令**——这是防止词表滑向视觉 DSL 的
  边界钉子（评估 §4 路径 A）。词表描述「有哪些区块」，永不描述「长什么样」。

### 规格 3：V-SPEC-04 开放分支 + 新增 V-SPEC-17 + V-SPEC-03 显式空接口页

- **V-SPEC-04（改判据）**：词必须 ∈ 该页归属端的**有效词表**。
  有效词表 = `kind.layoutVocab` 为数组时取该数组（现状）；为 `"open"` 时取 `vima:blocks` 的 id 集合。
  **V-SPEC-12（regions 内的词）同源同改**。
- **V-SPEC-17（新增，error）**：端册中存在开放词表端时，`vima:blocks` 块必须存在且非空；
  每条 `id` 合法、`desc` 非空、id 全 spec 唯一。无开放端时该块可省略（写了则仍校验结构）。
- **V-SPEC-03（改判据，全 kind 统一，D-A26-07）**：页面 `apis` 允许**显式空数组**
  `apis: []`（= 人已确认本页无接口的纯展示页）；**字段缺失仍 error**。
  下游自然空转已核：V-SPEC-07（⊆ 契约）对空集恒真；V-TASK-07 任务点数不含 apis 本身；
  原型接口徽标零个；V-INT-04 无该页接口可判。
- **不新增**「声明未使用」孤儿词规则——审计视图与原型会自然暴露未使用词，
  再加一条 warn 是镀金（同 A24 对 V-SRC-02 的判词）。

### 规格 4：组件文档与映射下放

- `uiDocs: null` → `init` / `app add` **跳过**该端 `docs/ui-framework/<appId>/` 的安装。
  **要害**：现状缺省会回落到 admin 的 `ui-docs/`（`init.mjs:113-130` 的
  `entry?.uiDocs ?? 'ui-docs'`），等于给自定义前端装进 66 份不存在的组件文档——
  那是主动误导 Builder，必须断掉。
- `context` 对该端的组件切片改读**项目侧**映射
  `docs/ui-framework/<appId>/component-map.json`：
  ```json
  { "hero": ["Hero"], "gallery": ["Gallery", "Lightbox"], "input": ["TextField"], "modal": ["Dialog"] }
  ```
  key = 区块词、控件 `type` 或 `modal`，value = 同目录文档文件名（不含 `.md`）。
- 该文件**不入 manifest、不受管、doctor 不校验**（沿用 A24 `coding-standards.local.md` 先例）。
- 缺失或映射不到 → 该节为空 **+ 一行明示**：
  `「本端未配置组件映射（docs/ui-framework/<appId>/component-map.json），组件切片为空」`。
  **禁止回落内置 V\* 表，且明确包含弹窗回落**（深评 G3）：`context.mjs` 现行
  `blockMap.modal ?? ['VLayer']` 对开放词表端**不得生效**——项目映射无 `modal` 键时
  弹窗组件切片为空并入上述明示，任何情况下 VLayer 不进 custom 端切片。
  （A23 修过它的反面——mp 端写死 VLayer 致切片恒空；本条堵它的正面——幻组件名泄入。）

### 规格 5：写后检查面配置驱动（消除负空间判定，回退面按 kind）

**现状问题**（实测 `post-write.mjs`）：

```js
const isMp     = appKind === 'mp-native';
const isH5     = appKind === 'h5-mobile';
const isVmKind = isMp || isH5;          // A25 加的第三个标志
// 8 处分支点：166 / 182 / 208 / 212 / 218 / 229 / 253 / 289
if (!isVmKind) { …admin 面：@vima/ui 幻包名 / vui-page / VIcon manifest / 操作列 width… }
```

`!isVmKind` 是**负空间判定**：`custom-web` 端的 `.vue`/`.tsx` 会被**默认当作 admin-web** 审查——
报「缺少 `vui-page` 类」「图标名不在 `vendor/vima-ui-admin` manifest 中」。
hook 自己的注释（第 149-150 行）已经写明这类错配的危害：
**「套错比不查更糟——把对的说成错的」**。

**改法**：检查项由端册配置驱动。检查项 id 全集（**从现有能力提炼，不新增任何检查**）：

| 检查项 id | 含义 | 配置值形态 | admin-web | mp-native | h5-mobile | custom-web |
|---|---|---|---|---|---|---|
| `blockMarks` | `data-page`/`data-block`/`data-modal` ↔ prototype.manifest 对账 | `true` | ✓ | ✓ | ✓ | **✓** |
| `nativeDialog` | 原生 `confirm()`/`alert()` | `true` | ✓ | ✓ | ✓ | **✓** |
| `pageRootClass` | 页面根须挂指定类名 | 类名或类名数组 | `"vui-page"` | `"vm-page"` | `["vm-body","vm-sheet"]` | — |
| `literalColor` | 裸色值只许出现在令牌定义行 | 令牌文件提示路径 | ✓ | ✓ | ✓ | — |
| `deepImport` | 深路径导入 vendor | 模式串数组 | ✓ | — | ✓ | — |
| `phantomPkg` | 幻包名（`@vima/ui`） | 包名数组 | ✓ | — | — | — |
| `iconManifest` | 静态图标名 ∈ vendor ai-manifest | manifest 相对路径 | ✓ | — | — | — |
| `tableOpWidth` | 操作列手写字面量 width | `true` | ✓ | — | — | — |

- **manifest `apps[]` 条目新增 `checks` 快照**（契约 §6.4），由 `create` / `app add` 从 kind 落盘。
  理由：**hook 读不到 CLI 模板，只能读 `.vima/manifest.json`**（`post-write.mjs:127-142`）。
- **回退裁定（深评 G1，本规格的要害）**：端条目**无 `checks` 快照**时——
  存量 v2 manifest（A16 后、A26 前创建）与 `vima update` 不回填 manifest 都会走到这里——
  hook 按 `kind` 取**内置缺省面**：`admin-web` = 全套（现状 else 分支）、
  `mp-native` / `h5-mobile` = 各自 vm 面（现状 A23/A25 分支）——即**今天的三分支行为
  作为回退表逐字节保留**；`kind` 未知或缺失 → **最小安全集**（`blockMarks` + `nativeDialog`），
  **绝不回退 admin 面**。负空间至此才真正消除：第五种模式出现时缺省是「少查」而不是「按 admin 查」。
- **扩展名门放宽（深评 G2）**：hook 入口门现为 `/\.(vue|ts|tsx|wxml|wxss)$/`
  （post-write.mjs:148），custom 端 React(.jsx)/Svelte/Astro/原生 html 会**整体绕过**——
  blockMarks（custom 仅存两项检查之一）静默永不运行。放宽为固定宽集：
  并入 `.jsx` `.svelte` `.astro` `.html`。**不做可配置扩展名**（YAGNI；
  检查正则对任意文本语言成立，放宽零风险）。
- 收益：从此新增前端模式**不改 hook 代码**，只在 kind 里声明检查项。

### 规格 6：请求门面可配 + 未识别守卫（两件事，缺一不可）

- **可配（恢复对账）**：V-CODE-01 的门面正则由生效 `apiFacade` 参数化
  （现状写死 `request.<verb>(...)`，`validate.mjs:1521`）；V-INT-04 复用同一扫描
  （`converge.mjs:271-291`），一并参数化。生效链见规格 1。
  A25 已让三端骨架统一到 `request` 门面（「一条正则通吃三端」），
  故本键的实际消费者只有 `custom-web`——但它是**唯一能让自定义前端保住代码↔契约对账**的手段。
  若只做守卫不做可配，`custom-web` 将是四模式中**唯一没有代码↔契约对账**的模式，属能力降级。
- **扫描扩展名同步放宽（深评 G2 的另一半）**：`scanMarkedFiles` 的前端扩展名集
  `['.ts','.tsx','.vue','.js','.mjs']`（validate.mjs:1524 与 converge.mjs:27 `FE_EXTS` 两处，
  应收敛为一处共享常量）并入 `.jsx` `.svelte` `.astro` `.html`。
  不放宽的后果：纯 .jsx 项目 markedFiles=0 → 被当「尚未开工」静默跳过，
  **连下条守卫的「诚实未启用」都不会触发**。
- **守卫（防假红）**：某端带 `@vima` 标注的文件 ≥1 但门面调用 0 处 →
  V-CODE-01 与 V-INT-04 对该端**整族跳过**，报告 `scope.skipped` 记 `"no-api-facade:<appId>"`
  （照抄 V-INT 后端作用域守卫的既有手法）。
  理由：不加守卫时 V-CODE-01 静默漏报、V-INT-04 每个接口假红（评估 §3）。
  按 A24 对 F10 的判词——**永远无法清除的 warn 会训练出「整个列表不用看」的习惯**，
  把假红换成诚实的「未启用」比继续报警重要得多。
- `apiFacade` **单值不支持数组**：多套 HTTP 封装应由 coding-standards 收敛
  （现有规范已要求「API 封装集中在 `src/api/<module>.ts`」），支持数组等于替项目做技术债辩护。

### 规格 7：`plain` 外壳 + 开放词渲染

- `shell: "plain"`（渲染器第三分支，现有两支：`desktop-admin` / `phone-tabbar`）：
  无侧栏、无手机框；**顶部横向导航条 = 本端 `vima:menus`**；角色视角 chips 保留
  （无角色时整段省略；validate 对零菜单零角色本就容缺，纯内容型项目合法）。
  选导航条而非「平铺 + 锚点」的理由：`vima:menus` 是既有的导航结构化真源，
  自定义前端一样有导航，复用比新造一套省。
- **开放词渲染**：`BLOCK_WORDS`（现 11 词）未收录的词渲染为通用灰盒
  `wf-block wf-generic`，标题 = `<词> · <desc>`（desc 取自 `vima:blocks`）。
  **内置 11 词的特化渲染一字不改**——admin/mp/h5 三端原型输出字节不变；
  开放端页面用到 `table`/`form` 等收录词时**照常享受特化线框**（含契约列头），
  这是词表下放的顺带红利，不是耦合。
- `prototype.manifest.json` 结构（契约 §6.7）**不变**，对账链原样生效。

> **代价须知情**：开放词表下渲染器无法为未知词做特化样式，原型呈现为「带标题的灰盒序列」。
> 这是 D-A26-02 边界的必然结果——框架不猜 `hero` 该长什么样。视觉对齐属 P1 视觉轨（D-A26-04）。

### 规格 8：`custom-web` 的最小骨架与端条目

`templates/admin/scaffold/custom-web/`：

```
src/api/request.ts      ← HTTP 门面（fetch 版、零依赖；对账链需要它——框架的最小约定，不是 UI 决策）
src/utils/report.ts     ← A7 运行时错误上报（规格 9；与门面同理：证据链约定，不是 UI 决策）
src/pages/.gitkeep
src/components/.gitkeep
src/utils/.gitkeep
README.md               ← UI 技术栈自选；框架约定四条（门面 / @vima 标注 / 区块标记 / 证据上报）；
                          组件文档与 component-map.json 怎么放；dev server 怎么接证据中间件
```

- **不放任何 UI 库、样式表、设计令牌、页面模板、构建配置**（D-A26-06——
  连 `vite.config` 都不放：构建工具属用户技术栈）。
- `template.json` 的 `apps[]` 新增条目：
  ```json
  { "id": "site", "name": "自定义前端", "kind": "custom-web",
    "scaffold": "scaffold/custom-web", "uiDocs": null, "codeDir": "src",
    "sharedDirs": ["src/components", "src/utils"] }
  ```
  注意 `sharedDirs` **不含 `vendor`**——本端没有 vendored 框架。
- **选取方式无需新交互**：`create` 已支持 `--apps id:kind` 与交互多选
  （`parseAppsArg` / `chooseApps`，`create.mjs:151/188`）；
  存量项目用 `vima app add site --kind custom-web`（A25 已在位的 `lib/commands/app.mjs`，
  实测通用：骨架拷贝 + A19 基线 + 按端 ui-docs 安装全都走同一条路）。

### 规格 9：A7 运行时证据——custom 端不许是盲区（深评 G5）

**事实**：runtime-errors 有三个消费方——`/check` 第 6 步（check.md:27）、
converge 的 `summary.runtimeErrors`（converge.mjs:128）、retro 采集（retro.mjs:24）；
供给方 admin/h5 = vite 中间件、mp = automator 采集器。**custom 是四端中唯一没有供给通道的**，
草案第 1 版漏了它——三个消费方对该端各缺一路客观信号。

**约定**（custom 端用户自带 dev server，框架给「零成本接入件」而非「指定 dev server」）：

- 骨架附 `src/utils/report.ts`：框架无关的 fetch 上报（POST `/__vima/runtime-error`，
  载荷与契约 §6.10 一致），并给 `window.onerror` / `unhandledrejection` 挂接示例；
- README 给出**接入指引**：vite / webpack-dev-server / express 皆为 connect 风格中间件，
  照抄 `scaffold/frontend/vite.config.ts:29-59`（含项目根向上定位）不足 40 行；
- **诚实降级纪律照搬 mp 采集器**（collect-runtime-errors.mjs 头注原话）：接不上就不写文件——
  「空的 runtime-errors 会被 /check 读成『跑过且零错误』，而真相是『根本没跑』。
  『没测到』和『测了没问题』不是一回事」；
- 用户 dev server 无法注入时，该端 `/check` 的运行时信号列**缺项如实显示**
  （A5 能力诚实分级），不伪造绿灯。

---

## 四、验收判据（可跑命令）

```bash
# ── 兼容性（最高优先级：三端现状逐字节不变，含存量项目）──
npm test                                              # 全绿
vima render-review --check && vima render-prototype --check    # 黄金项目 0 漂移
vima create t3 --template admin --apps admin:admin-web,patient:mp-native,h5:h5-mobile --no-git --no-install
# → 三端骨架与 A26 之前逐字节一致
# G1 回归卫：存量 v2 manifest（端条目无 checks 快照）的 mp 端写入 .wxml
#            → hook 仍按 vm 面判定（不报 vui-page，不报 @vima/ui）——d2 单测断言

# ── 规格 1/8 第四种模式可选可增 ──
vima create demo --template admin --apps site:custom-web --no-git --no-install
test -f demo/src/api/request.ts && test -f demo/src/utils/report.ts && test ! -d demo/vendor
vima app add site --kind custom-web && vima app list | grep -c custom-web   # 1（存量项目对等）

# ── 规格 2/3 开放词表 + 显式空接口页 ──
vima validate --json | grep -c 'V-SPEC-04'            # vima:blocks 声明后 0
# 删掉 vima:blocks 块 → V-SPEC-17
vima validate --json | grep -c 'V-SPEC-17'            # 1
# admin 端页面写 hero（不在其封闭 7 词内）→ 仍报 V-SPEC-04（开放不外溢）
# 页面显式 apis: [] → 0 错误；删掉 apis 字段 → V-SPEC-03 error（缺失 ≠ 显式空）

# ── 规格 4 组件文档不装、切片不回落（含弹窗）──
ls docs/ui-framework/site/ 2>/dev/null | grep -c '^V.*\.md$'   # 0
vima context <taskId> --stdout | grep -c 'VTable'              # 0
vima context <taskId> --stdout | grep -c 'VLayer'              # 0（G3：带 modals 的页面也不回落）
vima context <taskId> --stdout | grep -c '未配置组件映射'        # 1

# ── 规格 5 检查面配置驱动 + 负空间消除 + 扩展名门 ──
node -e "console.log(JSON.stringify(require('./.vima/manifest.json').apps.find(a=>a.id==='site').checks))"
# → {"blockMarks":true,"nativeDialog":true}
grep -cE "isMp|isH5|isVmKind" templates/admin/workspace/hooks/post-write.mjs   # 0（标志与负空间判定已移除）
# site 端 .vue 写 #ff0000 + 无 vui-page → hook exit 0；admin 端同样写法 → 仍 exit 2
# site 端 .jsx 文件 data-block 与 manifest 不符 → hook exit 2（G2：扩展名门已放宽）

# ── 规格 6 门面：可配 + 守卫 + 扫描面 ──
# site 端把门面改名 http 并在 manifest 端条目写 apiFacade: "http" → V-CODE-01 正常对账
vima validate --json | grep -c 'V-CODE-01'            # 幻接口时 1，正常时 0
# site 端改用裸 fetch（门面识别不到）且有 @vima 标注的 .jsx 文件：
vima converge --json | grep -c 'V-INT-04'             # 0
vima converge --json | grep -c 'no-api-facade:site'   # 1（诚实的未启用，不是假红——.jsx 已入扫描面才可能触发）

# ── 规格 7 plain 外壳 ──
grep -c 'wf-side' docs/review/prototype.html          # 0
grep -c 'wf-generic' docs/review/prototype.html       # ≥1
vima render-prototype --check                          # 0（确定性不变）

# ── 规格 9 证据链 ──
grep -c '__vima/runtime-error' templates/admin/scaffold/custom-web/src/utils/report.ts   # ≥1
grep -c '诚实降级\|不写文件' templates/admin/scaffold/custom-web/README.md               # ≥1
```

---

## 五、落点

| 类型 | 路径 |
|---|---|
| 端模型 | `lib/model/apps.mjs`（kind 新键归一：`layoutVocab: "open"` / `uiDocs: null` / `apiFacade` / `checks`）、契约 §5 |
| 校验 | `lib/commands/validate.mjs`（V-SPEC-04/12 有效词表分支、**新增 V-SPEC-17**、V-SPEC-03 显式空、V-CODE-01 门面参数化 + 守卫 + 扫描扩展名宽集）、契约 §8、`validate.checklist.md` |
| 收敛 | `lib/commands/converge.mjs`（V-INT-04 共用门面 + `scope.skipped` 新取值 + `FE_EXTS` 收敛为与 validate 共享常量）、契约 §12 |
| 上下文 | `lib/commands/context.mjs`（项目侧 `component-map.json` + 空切片明示 + 禁回落**含 modal/VLayer**）、契约 §6.11 |
| 安装 | `lib/commands/init.mjs`（`uiDocs: null` 跳过安装） |
| 创建 / 增端 | `lib/commands/create.mjs`、`lib/commands/app.mjs`（manifest 落 `checks` 快照；`apiFacade` 不落，见规格 1）、契约 §6.4 |
| spec 模型 | `lib/model/spec.mjs`（解析 `vima:blocks`）、契约 §6.2 |
| 模板资产 | `prototype.mjs` / `prototype.template.html`（`plain` 外壳 + `wf-generic`）、`post-write.mjs`（检查面配置驱动 + kind 回退表 + 扩展名宽集，移除三标志与负空间判定）、`spec.admin.md`（第三章加 `vima:blocks` 骨架）、`planning-guide.md`（自定义端词表怎么起 + **B5：shared-base 批先立设计系统骨架、业务批只消费**）、`_template-fe.md`（**G6：CAPABILITY.md 指针与「组件已全局注册」两处改为按端中性表述**）、新增 `scaffold/custom-web/`（含 `report.ts`，规格 9） |
| 模板声明 | `templates/admin/template.json`（`kinds.custom-web` + `apps[]` 新条目） |
| 设计真源 | `v2.1-amendments.md` 新增 A26、`vima-cli-design-v2.md` §3.7（四模式矩阵）/§13.3（plain 外壳与开放词） |
| 契约登记 | `docs/internal-contracts.md` §6.2/§6.3/§6.4/§8/§12 |
| 单测 | `c3.validate`（开放词表矩阵 + V-SPEC-17 + `apis: []` 显式/缺失分野）、`c3.context`（映射下放 + 空切片 + **VLayer 不泄入**）、`c3.converge`（门面守卫 + .jsx 扫描）、`c1.create` / `app`（checks 快照）、`c4.*`（plain 外壳 + 三端字节稳定）、`d2.workspace`（hook 配置驱动 + **G1 回归卫：无快照 mp 端保持 vm 面** + .jsx 门）、**e2e 黄金链新增 custom 夹具**（create→init→validate→render→context→plan 全链） |
| 文档 | `README.md`（四模式说明）、`CHANGELOG.md`、本草案与评估报告回填落地状态 |

**并行协同提示**：`template.json` / `post-write.mjs` / `c4.ui-mp.test.mjs` 与 A25 是同一批文件，
A25 目前**尚未提交**（工作树未提交改动含 h5 全套）。本项动手前需与 A25 的落地节奏对齐，
规格 5 尤其要在 A25 的三标志形态**稳定后**再重构，避免同文件双改。

---

## 六、边界声明（不是缺陷，是范围——评估报告 §3 的 B1–B4）

| # | 边界 | 含义 | 处置 |
|---|---|---|---|
| B1 | 后端骨架无条件落盘（create 无 `--no-backend`） | 「custom 前端 + 别处已有后端」会多出一个未使用的 Java 骨架；V-INT 族因无 `@vima` 后端文件按既有 `no-marked-backend` 口径优雅跳过 | 纯前端形态归 P2 `templates/web/`（D-A26-05） |
| B2 | 契约模型 REST-only（method/path 五要素） | GraphQL/tRPC 前端的契约与对账全链不适用 | 四端共同边界，声明不放宽 |
| B3 | V-CODE-02 只认 Java Spring 注解 | 非 Java 后端时后端侧对账优雅缺位（同 B1 跳过口径） | 声明不放宽 |
| B4 | V-SPEC-02 要求 entities 非空 | 零数据模型的纯静态站不在框架问题域——本框架是「一后端 × 多前端」的系统开发框架，不是静态站生成器 | 声明不放宽；有数据的展示型站点由 D-A26-07 的 `apis: []` 覆盖 |

---

## 七、不做

- **不扩框架级通用视觉词表**（hero/gallery/pricing/timeline…）。词表所有权下放给项目才是正解；
  框架内置一份"通用视觉词表"等于替所有项目做视觉决策，永远不够用且必然漂移。
- **不把样式/尺寸/色彩/动效写进 spec YAML**。`vima:blocks` 只有 `id` + `desc` 两个字段，硬边界。
- **不在本项做视觉真源**（D-A26-04）。
- **不在 `lib/` 内建像素级/运行时视觉校验**（截图 diff、computed-style、token-lint）——
  需要浏览器运行时，违反零运行时依赖；同 A24 对「冷启动可用性检查」的裁定，归 pipeline 任务。
- **不把 kinds 定义权开放为任意项目 JSON 覆盖内核**。只开「词表来源 / 文档来源 / 检查面 / 请求门面」
  四个受限口子；开成通用插件点是 YAGNI。
- **不新增任何 hook 检查项**。规格 5 只是把**现有 8 项**从硬编码改为配置驱动。
- **不做可配置扩展名集**（规格 5/6 用固定宽集；长尾栈真出现再议）。
- **不支持 `apiFacade` 数组**（规格 6）。
- **不新增「词表声明未使用」规则**（规格 3）。
- **不给 `custom-web` 配 UI 框架、组件文档或构建配置**——那正是本 kind 存在理由的反面。

---

## 八、待你裁定

1. **`custom-web` 首版 `status` 取 `stable` 还是 `preview`？**
   建议 `stable`：规划体系四条（词表/文档/检查/渲染）+ 证据链都定义完整，骨架在位，
   与 A5 能力诚实分级不冲突。
2. **规格 7 的代价是否接受**：开放词表下原型退化为「带标题的灰盒序列」，
   视觉对齐要等 P1 视觉轨。若不可接受，需把视觉轨提前到本项之前排。
3. **规格 5 的重构时机**：是等 A25 提交后再动 `post-write.mjs`，还是本项与 A25 合并一次改完？
   建议前者（同文件双改风险高）。
4. **D-A26-07（`apis: []` 全 kind 放行）是否采纳**：它是本草案唯一改动既有三端行为语义的点
   （放宽方向，不会让现有项目变红），但属「同一规则四端统一」与「admin 维持强制」之间的取舍。
