# vima-ui-h5 · 移动端 H5 企业 UI 框架

> 与 `vima-ui-mp`**共用同一份类契约与令牌**：112 个 `.vm-*` 类、75 个 `--vm-*` 令牌。
> 另加浏览器侧必需的 reset 与 4 个行为组件。
> 创建日期：2026-08-14 · 立项依据：`vima-cli` 增补项 A23 / A25

## 与小程序端的关系

| 文件 | 与 `vima-ui-mp` 的关系 |
|---|---|
| `dist/tokens.css` | 与 `tokens.wxss` **同一份内容**（只把 `wxss` 字样换成 `css`） |
| `dist/ui.css` | 与 `ui.wxss` 同上 |
| `dist/themes/clinical-blue.css` | 与 `.wxss` 版同上 |
| `dist/global.css` | **H5 独有**：reset、body、`::placeholder`、`100dvh`、焦点可见、开关外观 |
| `dist/components/*.vue` | **H5 独有**：`VmNavbar` `VmTabbar` `VmToast` `VmDialog` |
| `dist/feedback.ts` | **H5 独有**：`toast()` / `confirmAsync()` 函数式 API |

一致性由 vima-cli 单测锁死——同一套企业 UI 不允许有两套定义。
要改类或令牌，改小程序端那份，两端一起走。

## 用法

```ts
// main.ts
import VimaUiH5 from '@ui'
import '@ui/global.css'          // 它自己会 @import ui.css → tokens.css
app.use(VimaUiH5)                // 四个组件全局注册
```

```ts
// 页面里只用函数式反馈，不直接摆组件
import { toast, confirmAsync } from '@ui'
```

每个类的用途、结构骨架、修饰类、何时**不该**用它，见
`docs/ui-framework/<appId>/<Name>.md`（`vima init` 装进项目，`vima context`
会按页面用到的布局词自动切片进任务上下文包）。

## 换肤与适老化

同小程序端：主题只覆盖令牌（在 `global.css` **之后** import），
适老化在根节点拼 `vm-aging`。详见 `docs/ui-framework/<appId>/CAPABILITY.md`。

**不要改 `dist/` 下的任何文件**（见 PATCHES.md）。
