# Vima UI Admin · `@vima-tech/ui-admin`

> 面向人和构建期 AI Agent 的 Vue 3 政企后台 UI 框架。63 个公开组件、85 个统一 SVG 图标、33 个设计 Token，浏览器运行时仅 peer `vue`。
> 创建日期: 2026-08-10

从 `juvenile-guard/apps/admin-web/src/ui-v3` 原样提取——那套组件已经在 53 个真实页面上跑过一轮
布局体检与视觉对齐，是**被验证过的资产**，不是新写的。本包做的是「把它从宿主工程里摘出来」，
不是重做。

---

## 现状

| 项 | 状态 |
|---|---|
| 组件 | 63 个，`src/index.ts` 为唯一公开闭包真源 |
| AI 构建资产 | 独立 Manifest、AppSpec v1 Schema、4 类 Builder、8 个系统 Recipe、23 个冻结基准任务 |
| 图标 | 85 个 `currentColor` SVG，统一由 `VIcon` 注册表管理，不使用 Emoji 作为功能图标 |
| 弹层服务 | `layer.msg / notify / confirm / load / close / closeAll` |
| 令牌 | 33 个 `--vui-*`，机检闭包（用到的都有默认值，定义的都有人用） |
| 宿主耦合 | 0（`check:boundary` 强制） |
| 文档站 | `site/` 49 页，68 个可交互示例，API 表与 AI Manifest 复用同一收集器 |
| 视觉 | 与 juvenile-guard v3 企业蓝像素一致（主色 #2f73c5 / 控件高 38 / 圆角 10 / 表头 44） |

## 安装与用法

```bash
npm install @vima-tech/ui-admin
```

```ts
import VimaUiAdmin, { layer } from '@vima-tech/ui-admin';
import '@vima-tech/ui-admin/style.css';   // 令牌 + 组件样式

app.use(VimaUiAdmin);                     // 注册 <v-button> <v-table> …
```

也可以只按名引入，不装插件：`import { VTable, VButton } from '@vima-tech/ui-admin'`。

## AI Agent 最短入口

Agent 先读取 `@vima-tech/ui-admin/agent/docs/README.md`，再按需读取 Manifest 和 Recipe；不要猜测组件名或把自然语言解析放进浏览器运行时。

```ts
import { createArtifactPlan, validateAppSpec } from '@vima-tech/ui-admin/agent';

const validation = validateAppSpec(appSpec);
if (!validation.valid) throw Object.assign(new Error('非法 AppSpec'), { diagnostics: validation.diagnostics });
const result = createArtifactPlan(appSpec);
```

- 公开 API：`@vima-tech/ui-admin/ai-manifest.json`
- 结构化 Schema：`@vima-tech/ui-admin/agent/schema/app-spec.v1.json`
- 系统 Recipe：`@vima-tech/ui-admin/agent/docs/recipes/index.json`
- 统一验证：`npm run check:ai`
- 冻结基准：`npm run benchmark:ai`

换品牌色：在自己的样式里重定义 `--vui-*`（后加载即覆盖），不需要改本包任何文件。

```bash
npm install               # 安装开发与构建依赖
npm run docs              # 起文档站（组件预览 + API + 示例源码）
npm run build:lib         # 构建 npm 产物到 dist/（ESM + 类型声明 + CSS）
npm run build:docs        # 抽 API + 构建静态站到 dist-site/（base 为相对路径，可随处托管）
npm run check:boundary    # 边界体检（包外引用 / 宿主残留 / 令牌闭包 / 全局副作用）
npm run typecheck         # 检查发布包的 TypeScript 类型
npm run check:docs        # 文档符号与代码块语法
npm run check:ai          # Spec、契约、编译、浏览器、截图与可访问性总门
npm run benchmark:ai      # 开发集 + 保留集冻结任务基准
npm run verify:publish    # 发布前执行完整 AI-First 门禁
npm run build:api         # 只重抽 API（改了组件属性后跑）
npm run extract           # 从上游 ui-v3 重新提取（覆盖 components/ 与 styles/ui.css）
```

## 目录

```
src/
  index.ts              导出面 + 插件安装（手写）
  layer.ts              弹层服务（手写移植，去掉了转发给 layui-vue 的那层）
  context.ts utils.ts   表单上下文注入键 / 小工具
  components/
    basic|form|data|overlay|columnWidth.ts   ← extract 生成，勿手改
    feedback.ts         VLoading / VSkeleton（手写）
    columnSetting.ts    VColumnSetting（手写）
  styles/
    tokens.css          主题令牌（手写，唯一取色入口）
    ui.css              提取来的组件样式（extract 生成，2279 行，勿手改）
    components.css      本库新增组件的样式（手写）
    index.css           样式总入口（tokens → ui → components）
scripts/
  extract-from-ui-v3.mjs  上游 → 本包的可重跑变换
  check-boundary.mjs      边界体检
  build-api.mjs           从组件源码抽 API → site/api.generated.json
site/
  pages.ts                文档站内容真源（导航 + 28 个组件页的配置）
  demos/*.vue             68 个示例，既被渲染也被展示源码
  views/ components/      站点页面与部件（ComponentPage 一个模板服务 28 页）
  api.generated.json      构建产物，勿手改
```

**哪些文件能手改**：`components/{basic,form,data,overlay,columnWidth}.ts` 与 `styles/ui.css`
是 `npm run extract` 的产物，改了下次重跑就没了。新组件一律写进 `feedback.ts` / `columnSetting.ts`
这类手写文件，样式写进 `components.css`。

## 文档站

`npm run docs` 起本地站点，形态对标 Element Plus 的文档：左侧分组导航（带搜索过滤）、
每个组件一页、示例卡片可展开源码并复制、页尾是 API 表。

三条让它不会变成「过期文档」的设计：

1. **API 表不是手写的**。`scripts/build-api.mjs` 从组件源码里抽 props（名/类型/默认值/紧邻的
   JSDoc 说明）、emits、具名插槽，产出 `site/api.generated.json`；组件和属性数量随源码自动更新。
   改了属性重跑一次即可，不存在「文档写着有、实现早改名了」。
2. **示例代码就是跑着的那个文件**。`site/demos/*.vue` 被引入两次——一次当组件渲染，
   一次带 `?raw` 当源码展示，所以代码块与页面上的效果不可能对不上。
   站点里 `@vima-tech/ui-admin` 别名指回 `src/`，因此示例里的 import 与使用者真实写法一字不差。
3. **令牌表解析自 `tokens.css` 原文**，连分组标题和说明都取自那个文件的注释。改令牌 = 改文档。

页面本身是数据驱动的：一个组件页 = `site/pages.ts` 里的一条配置 + 几个示例文件，
28 个组件页共用一个 `ComponentPage.vue`。加组件文档不用碰路由、导航或页面模板。

### 为什么没用 VitePress

它是 Element Plus 的选择，也确实成熟。这里不用，是因为三件事对不上：
本包对外只声明 `vue` 一个 peer 依赖、开发依赖也只有三个，拉进 VitePress 会把工具链体积翻好几倍；
VitePress 的 markdown 里做「示例 + 源码」要再加插件；而且它自带主题，
文档站就不再是这套令牌的使用者了——现在站点外壳的每一处颜色都取自 `--vui-*`，
换品牌色时文档站会跟着变，这本身就是一次持续的自检。
代价是没有 markdown 写作体验：长篇说明得写在 `pages.ts` 的字符串里。
将来若文档量涨到需要大段叙述，再换 VitePress 也不亏——示例文件与 API 抽取脚本都能直接复用。

## 本库新增的三个组件

上游 ui-v3 没有这三个，是照本仓的既有约定补的（渲染函数 + `--vui-*` 令牌 + 不出 `.vui-` 子树的选择器）。

### VLoading —— 内容已经在，正在刷新

```vue
<v-loading :loading="pending" text="正在加载">
  <v-table :columns="columns" :data-source="rows" />
</v-loading>

<v-loading :loading="submitting" fullscreen text="正在提交" />
```

| 属性 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `loading` | boolean | false | 是否显示遮罩 |
| `text` | string | `''` | 遮罩上的文案，留空只有转圈 |
| `fullscreen` | boolean | false | 铺满视口。遮罩传送到 body，`z-index: 3400` 盖过弹层(3000)与下拉/日历(3200) |

它会插入一层包裹 `div`（遮罩要有定位锚点，`display:contents` 就没有锚点了）。
全屏那一路必须传送到 body，否则会被祖先的 `overflow`/`transform` 裁掉——「转圈只露半个」多半是这个原因。

### VSkeleton —— 内容还没有，首屏占位

```vue
<v-skeleton :loading="firstLoad" type="table" :rows="5" :columns="6">
  <v-table … />
</v-skeleton>
```

| 属性 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `loading` | boolean | false | true 显示骨架，false 渲染默认插槽 |
| `type` | `'text' \| 'table' \| 'card'` | `'text'` | 骨架形状 |
| `rows` | number | 3 | 正文行数 / 表格数据行数 |
| `columns` | number | 4 | 表格骨架列数 |
| `animated` | boolean | true | 扫光动画（已跟随 `prefers-reduced-motion`） |

**和 VLoading 分工别混**：首屏用 VLoading 会得到「一片空白 + 转圈」，
二次刷新用 VSkeleton 会把用户正在看的表格换成灰块。

### VColumnSetting —— 表格自定义字段

```vue
<v-table :columns="columns" :data-source="rows">
  <template #toolbar>
    <v-column-setting v-model="columns" :source="ALL_COLUMNS" storage-key="user-list" />
  </template>
</v-table>
```

`source` 是全量列定义（顺序即默认顺序，组件不会改写它），`v-model` 是筛过、排过序的生效列，
直接喂给表格。页面不用自己算显隐。

| 属性 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `source` | Column[] | `[]` | 全量列定义 |
| `modelValue` | Column[] | `[]` | v-model：生效列 |
| `storageKey` | string | `''` | 记忆用的键。**留空 = 完全不碰 localStorage** |
| `label` | string | `'列设置'` | 按钮文案 |
| `disabled` | boolean | false | |

行为：勾选显隐 + 拖拽/上下方向键排序 → `确定` 生效并落盘，`重置` 回到 source 默认，
关闭面板（点外面 / Esc）= 放弃草稿。按钮上会显示「隐藏 N」——隐藏了列却没有提示，
用户会把「列没了」当成数据丢了。

几个刻意的决定：
- **不碰列宽与左右固定**。本库的固定列是按角色自动判定的（首列 + 末尾操作列，见 `data.ts`
  的 `isOperationColumn`），开放手工固定会和那套判定打架。
- **最后一个可见列的勾选框禁用**，否则得到一张没有列的表。
- **列身份取 `key`**（退化顺序 `key → customSlot → title → 下标`）。用下标兜底的列一排序就会串位，
  所以要参与配置的列请给 `key`。
- **存档只存 `{key, visible}` 与顺序**，列定义永远以 `source` 为准。改了列定义也不用让用户清缓存：
  存档里没有的列按 source 顺序补在后面并默认显示，source 里已删的列自动丢弃。
- **面板贴边自动翻向**：默认右对齐（按钮通常在工具栏右侧），开面板后量一次，
  越出**最近滚动容器**就翻成左对齐。判据不能只看视口——后台布局里内容区左边还站着侧边栏，
  面板钻到侧边栏底下同样点不着（文档站上就复现了这一幕）。
- 逃出祖先 `overflow:hidden` 用的是本库既有那招（`.vui-card:has(.vui-select.is-open)` 同款），
  不是 teleport——teleport 会引出一套跟随滚动重算位置的代码，而本库其它浮层都不这么做。

实测（Playwright，见提交说明）：隐藏列→表头少一列、硬刷新后仍生效、localStorage 落盘正确、
键盘连续上移两格（移动 DOM 节点会清掉焦点，组件显式把焦点还回去）、HTML5 拖拽换位、
Esc 放弃草稿、重置复原、最后一列勾选框禁用。

---

## 提取时做了什么

上游那套代码带着三处「只在 juvenile-guard 成立」的东西，逐一处理如下。变换全部写在
`scripts/extract-from-ui-v3.mjs` 里，上游再更新时重跑即可，不是一次性手改。

| # | 上游的样子 | 处理 | 为什么 |
|---|---|---|---|
| 1 | 每条 CSS 规则前挂 `:root[data-ui-theme='v3']` | 去掉 | 那是宿主「一键退回旧视觉」的闸门，框架里没有 legacy 可退 |
| 2 | `SCOPE *` 全局 reset、裸 `input[...]` 选择器 | 收进 `[class*='vui-']` 子树 | 闸门一去，这些规则会漏到宿主页面上 |
| 3 | 14 条 `.jg-header-select` / `.jg-tab-engine` / `.tab-pane` 规则 | 丢弃 | 宿主页面的私活，不是组件的 |
| 4 | 组件同时挂 `vui-*` 与 `layui-*` 两套类名（62 处） | 删 `layui-*` | 那是与 layui-vue 混跑期的钩子，本包不带 layui |
| 5 | 宿主令牌 `--jg-*` + 控件令牌 `--jg-ui-*` 两层，且 `--jg-ui-primary: var(--jg-primary)` 这类自指别名 | 拍平成一层 `--vui-*` | 两层里同义的那几个归一，组件只面对一个命名空间 |
| 6 | 组件叫 `LayButton`，标签写 `<lay-button>` | 改 `VButton` / `<v-button>` | Layui 血统的名字对新框架是误导 |

### 三处不是机械改名的地方

- **`.layui-btn-sm` 不是兼容类**，它是小号按钮的尺寸规则（`size` 属性拼出 `layui-btn-${size}`）。
  按「宿主专属」丢掉会让 `size="sm"` 静默失效，已改名 `.vui-button-sm` 保留。
- **`VIcon` 的 `type` 是公开 API**。`home` 与 `layui-icon-home` 都认，存量调用点不用改；
  图标由 SVG 注册表统一管理，可用 `getIconNames()` 查看清单、用 `registerIcon()` 扩展。
- **`VContainer` 的 `fluid` 属性删了**。它只用来加 `layui-fluid`，解除的是 layui 那条 `max-width`；
  本包的 `.vui-container` 本来就是 `width: 100%`，没有可解除的约束，留着是空转。

### 与上游的行为差异（就这四条）

1. `fluid` 属性没有了（见上）
2. `layer` 不再有 `setLayerBackend` —— 那是转发给 layui-vue 的迁移期脚手架
3. 样式生效不再需要 `<html data-ui-theme="v3">`，`import 'style.css'` 即生效
4. 类名/标签/令牌全部换成 `vui-` / `V*` / `--vui-*` 命名空间

### 弹层关闭约定

`VLayer` 支持 Esc 与遮罩关闭；`shadeClose` 默认为 `true`。编辑、填写类弹窗若需防止误关，显式设置
`:shade-close="false"`，并在业务层处理未保存内容提示。

---

## 与 `@vima-tech/ui` 的关系（复用结论）

ClearWorks 里的 `packages/vima-ui`（`@vima-tech/ui`）是**另一条产品线的 UI 包**，不是本包的上游。
两者的定位不重叠，实测复用面如下。

| | `@vima-tech/ui` | `@vima-tech/ui-admin`（本包） |
|---|---|---|
| 面向 | 工业 / MES，信创部署 | 政企后台 |
| 组件 | 14 个 SFC，全是业务型（VScanInput / VNumberPad / VProgressRing…） | 通用后台组件（Table / Form / Select / DatePicker…） |
| 写法 | `.vue` SFC | `defineComponent` + `h()` 渲染函数 |
| 令牌 | Seed → OKLab 算法 → Alias 三层，构建期生成 | 手写冻结一层 |
| 密度 | 控件 32px / 圆角 6-8 | 控件 38px / 圆角 10-14 |
| CSS 约束 | **禁止** `color-mix()` / `:has()`（信创浏览器内核未知，失效是静默的） | 用了 32 处 `color-mix()`、4 处 `:has()` |

**组件层零复用**：两边组件没有重名，能力也不交叉——那 14 个是产线业务件，
本包缺的是它们，它们缺的是本包这一整套通用件。合并只会把两套硬约束（信创 vs 现代 CSS）
和两套密度塞进一个包，谁都不好过。

**真正可复用的是它的令牌流水线**（`src/tokens/color.ts` + `generate.ts` + `scripts/build-tokens.ts`）：
换品牌色只改 seed 一个值，十级色阶、hover/active/禁用、边框、弱背景全部按 OKLab 感知均匀重算，
并自带 WCAG 对比度核对报告。这正是「UI 框架」相对「项目里的 ui 目录」的分界线。

已实测把它套到本包的企业蓝上（seed: brand `#2f73c5`、neutral `#0e1b33`），
算法推导值与手挑的冻结值对照：

```
primary        #2f73c5 → #2f73c5  Δ0.000      text-faint     #9aa8bf → #94a7c8  Δ0.016
primary-strong #235c9b → #1458a4  Δ0.022      border         #d5dfec → #cbd7ed  Δ0.026
text-title     #0e1b33 → #0e1b33  Δ0.000      control-border #c9d8e4 → #cbd7ed  Δ0.014
text-body      #33425f → #304160  Δ0.006      control-hover  #8faac1 → #94a7c8  Δ0.017
text-sub       #51617d → #45597c  Δ0.031      disabled-bg    #f4f7f9 → #f1f6ff  Δ0.010
text-weak      #7d8ba2 → #778cb0  Δ0.022      disabled-text  #607386 → #5c7197  Δ0.030
最大 0.031 · 平均 0.016（判定阈值：<0.02 一致，<0.05 同色感）
```

结论：**算法能重建这套配色，全部落在「同色感」以内**，接得上。生成的中性色比手挑的偏蓝一点点
（手挑那套稍降了饱和度），并排看得出、单看看不出。

**但现在不接**，理由是顺序：本包刚从宿主里摘出来，第一优先级是「与 juvenile-guard 现网像素一致」，
好让人相信提取没提坏。令牌一旦改由算法生成，颜色就会整体位移 Δ0.016，这时候再出任何视觉问题
都分不清是提取的锅还是生成的锅。等本包在一个真实项目里跑过一轮，再把 `tokens.css` 换成生成物——
那时冻结值就是现成的回归基线，偏差报告直接对着上表比。

接的时候要做的事：把 `src/tokens/` 三个文件搬过来 → 写本包的 `seed.ts`（brand/neutral 两个种子
+ 控件高 38 / 圆角 10-14 / 间距基数 4）→ `build:tokens` 产出 `dist/tokens.css` → 与当前
`styles/tokens.css` 出偏差报告 → 人眼过一遍再切换。**别把两个包合并**，只搬这一层。

---

## 待办

- [ ] 剩余 136 处硬编码色值 / 22 处 `rgba()` 收进令牌（现在只有 25 个令牌是可换肤的，
      其余写死在 `ui.css` 里，换品牌色时会成为漏网之鱼）
- [ ] 接入 `@vima-tech/ui` 的令牌流水线（时机与步骤见上）
- [ ] 组件级测试（上游只有 `columnWidth` 有对拍测试，随包带过来了；新组件与文档站目前只有
      浏览器实测脚本，没有落库成可重跑的用例）
- [ ] 文档站：暗色模式（要先给令牌层补一套深色取值）、示例的在线可编辑、站内全文搜索
      （现在只按组件名过滤）
- [ ] 中文文案外提（`layer` 的「请确认 / 确认 / 取消 / 正在处理…」目前写死，换行业得改代码）
- [ ] 若要给 juvenile-guard 反向接入：宿主里 702 处 `jg-ui-*` 类名引用与 `<lay-*>` 标签需要
      一次 codemod，且宿主 `theme.css` 里针对 `.layui-*` 写的规则要改写到 `.vui-*`
