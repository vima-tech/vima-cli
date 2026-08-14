# vima-ui-mp · 移动端企业 UI 框架

> 面向人和构建期 AI Agent 的**类契约框架**：112 个 `.vm-*` 类、75 个 `--vm-*` 令牌、零 JS、零依赖。
> 创建日期：2026-08-14 · 立项依据：`vima-cli` 增补项 A23

## 这是什么，不是什么

**是**一层类与结构的约定：页面骨架、卡片、列表、表单、按钮、弹层、空态。写页面时套类名，
不引组件、不装依赖、不加构建步骤。

**不是**组件库。没有 `<vm-button>` 这种自定义组件（A23 的 D-A23-02）——小程序自定义组件有
setData 跨层通信开销、wxss 不穿透，而原生控件 + 类契约已经覆盖全部布局词与控件词。
需要行为的地方用原生能力：

| 要做的事 | 用什么 | 不要做什么 |
|---|---|---|
| 轻提示 | `wx.showToast` | 自己写一个吐司组件 |
| 确认框 | `wx.showModal` | 用 `.vm-popup` 做「确定/取消」二选一 |
| 加载中 | `.vm-loading` + `.vm-spinner`（页内）／ `wx.showLoading`（全屏） | 两个一起上 |
| 下拉选择 / 日期 / 时间 | 原生 `<picker>` 包一层 `.vm-picker` | 自己实现滚轮 |
| 底部 tab | `app.json` 的原生 `tabBar` | 自定义 tabbar 组件 |
| 表单弹窗 | `.vm-popup`（底部升起面板） | 居中对话框——移动端不用这个形态 |

## 用法

`app.wxss` 里引一次，全局可用：

```css
@import "/vendor/vima-ui-mp/dist/ui.wxss";
```

页面根节点必须带 `vm-page`——令牌挂在它上面，换肤与适老化才有作用域：

```html
<view class="vm-page" data-page="PAGE-01">
  <view class="vm-body" data-block="list">
    <view class="vm-card">…</view>
  </view>
</view>
```

每个类的用途、结构骨架、修饰类、何时**不该**用它，见 `docs/ui-framework/<appId>/<Name>.md`
（`vima init` 装到项目里，`vima context` 会按页面用到的布局词自动切片进任务上下文包）。

## 换肤

主题文件只覆盖令牌、不含类样式。放在 `ui.wxss` **之后**：

```css
@import "/vendor/vima-ui-mp/dist/ui.wxss";
@import "/vendor/vima-ui-mp/dist/themes/clinical-blue.wxss";
```

- 缺省（不引主题）= **企业蓝 v3**，与 admin 端 `src/styles/tokens.css` 同源——
  同一个项目的两个端本来就该是一套视觉。
- `themes/clinical-blue.wxss` = 临床蓝，取自 Sustain 院外营养患者管理系统的原型设计画布。

要自定义品牌色：在项目自己的 wxss 里重定义 `page, .vm-page { --vm-primary: …; }`，
**不要改 `dist/` 下的任何文件**（见 PATCHES.md）。

## 适老化

根节点加 `vm-aging` 即可，全站字阶与控件高一起放大：

```html
<view class="vm-page {{aging ? 'vm-aging' : ''}}">
```

它只重定义字阶令牌，所以**后加的类自动跟着适老化**——不用逐类补覆盖（这正是提取源
`sustain-mp` 的 `.aging` 的欠账：每加一个类就要补一条规则，加类即漏）。

## 与 vima-ui-h5 的关系

`dist/tokens.wxss` 与 `dist/ui.wxss` 和 `vima-ui-h5` 的 `.css` 同名文件**字节一致**：
令牌挂在 `page, .vm-page` 上，这个选择器在 WXSS 与浏览器里都成立；不用 rpx、不用 hover。
一致性由 `vima-cli` 单测锁死——同一套企业 UI 不允许有两套定义。

差异只在两端各自的入口文件：小程序是 `app.wxss`，H5 是 `global.css`（多一层 reset 与
设备等比缩放）。H5 另有 9 个行为组件（Toast / ConfirmDialog / DatePicker 等），
小程序侧对应的是上表的原生能力。

## 来路

提取自 `juvenile-guard` 微信小程序的 `common/design.wxss`（89 个 `ds-` 类，34 个真实页面
上跑过），前缀改 `vm-` 与 `vima-ui-admin` 的 `vui-` 对仗。在其上补齐了词表要求而提取源
没有的能力（`actionbar` / `popup` / `upload` / `switch` / `textarea` / `metrics` / `body`），
并收编了 `kv-*`——它在提取源里被引用 111 处却从未进设计系统，散在 9 个页面 wxss 里各写一遍。

`dist/` 即源：纯 wxss 无构建步骤，不存在「源与产物两份」的漂移面。
