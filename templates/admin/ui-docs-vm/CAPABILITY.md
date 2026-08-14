# vima-ui 移动端能力清单（先读这份）

移动端企业 UI 框架，**微信小程序（`vima-ui-mp`）与 H5（`vima-ui-h5`）共用同一份定义**：
**112 个 `.vm-*` 类 + 75 个 `--vm-*` 令牌**。类与令牌两端字节一致（单测锁死）；
差别只在「行为」——小程序用微信原生能力，H5 用 4 个自带组件。

写页面前先看这里判断「这件事框架给不给」；给，就照对应组件文档抄结构；
不给，看下面的「没有的能力」——那里写了该用什么替代。

## 一句话规则

> 布局与外观 → 用 `vm-*` 类（两端相同）；行为与反馈 → 用各端的原生/自带能力。

## 有什么

| 组 | 组件文档 | 覆盖的词表 |
|---|---|---|
| 页面骨架 | `VmPage` `VmHero` | `banner` |
| 容器分组 | `VmCard` `VmSection` | `cards` |
| 数据展示 | `VmList` `VmKv` `VmTile` `VmMetric` `VmText` `VmChip` `VmBadge` `VmHud` `VmFootnote` | `list` `detail` |
| 导航 | `VmSeg` `VmGrid` | `tabs` |
| 表单 | `VmField` `VmInput` `VmTextarea` `VmPicker` `VmChoice` `VmSwitch` `VmUpload` `VmDashed` | `form` `search` |
| 动作 | `VmButton` `VmActionbar` | `actionbar` |
| 弹层与状态 | `VmPopup` `VmEmpty` `VmLoading` | spec 的 `modals` |
| **H5 专属组件** | `VmNavbar` `VmTabbar` `VmToast` `VmDialog` | —（小程序端由原生能力承担，见下表） |

## 行为：两端各用各的（类与外观完全相同）

| 要做的事 | 小程序（mp-native） | H5（h5-mobile） |
|---|---|---|
| 轻提示 | `wx.showToast` | `toast(text)` → `VmToast` |
| 确认框 | `wx.showModal` | `await confirmAsync(text)` → `VmDialog` |
| 全屏阻塞加载 | `wx.showLoading` | `VmLoading`（页内）或自行遮罩 |
| 页内区域加载 | `VmLoading` | `VmLoading` |
| 动作菜单 | `wx.showActionSheet` | `VmPopup` 列表 |
| 顶部导航栏 | `app.json` 的 `navigationBarTitleText` | `VmNavbar` |
| 底部主导航 | `app.json` 的原生 `tabBar` | `VmTabbar` |
| 下拉选择 | 原生 `<picker>` + `VmPicker` | `<select class="vm-picker">` |
| 日期 / 时间 | `<picker mode="date">` | `<input type="date">` |
| 开关 | 原生 `<switch>` | `<input type="checkbox" role="switch">` |
| 选图 / 上传 | `wx.chooseMedia` + `wx.uploadFile` | `<input type="file" accept="image/*">` |
| 拨打电话 | `wx.makePhoneCall` | `<a href="tel:…">` |

**两端都一样的**：全部 `.vm-*` 类、全部令牌、适老化 `vm-aging`、换肤方式、
以及「所有请求走 `request` 门面且路径写字面量」这条硬纪律。

## 没有的能力（别找了，也别自己造）

| 缺的 | 为什么 | 用什么替代 |
|---|---|---|
| 类contract 之外的自定义组件 | 小程序自定义组件有 setData 跨层开销、wxss 不穿透；H5 侧只为「小程序有而浏览器没有」的四件事破例 | 类 + 原生标签 |
| 图标集 | 小程序没有 SVG symbol 机制，塞进框架就是塞一堆二进制 | 项目自己的图片或 emoji（H5 可用内联 SVG） |
| 表格 | 手机上放不下横向表格 | `VmKv`（一行一字段）或 `VmList` |
| 树形控件 | 手机上没人能在滚轮里逛一棵树 | `<picker mode="multiSelector">`；超过 3 层请改设计 |
| 分页器 | 移动端是上拉加载不是翻页 | `onReachBottom` + 追加数据 |
| 暗色主题 | 需求没提 | —— |
| 富文本编辑 | 需要格式就是另一种设计 | —— |

## 三条通用纪律

1. **不写裸值。** 颜色、字号、圆角、间距一律 `var(--vm-*)`；
   页面 `.wxss` 里出现 `#` 开头的色值基本就是错的。
   小程序端有三处例外（JSON/原生组件属性吃不到 CSS 变量，改主题时必须一起改）：
   `app.json` 的 `tabBar.color`/`selectedColor`、`app.wxss` 的 `page { background-color }`、
   `<switch color="...">`。**H5 端没有这三处例外**——全部走 CSS 变量。
2. **一屏一个主按钮。** `vm-btn-primary` 出现两次 = 用户不知道该点哪个。
3. **三态写全。** 加载中 / 空 / 有数据——漏掉「加载中」会让用户把空态当成结论。

## 适老化

页面根节点拼 `vm-aging` 即可（小程序读 `app.globalData.aging`，H5 读 store/localStorage），
字阶与控件高整体放大。
它靠重定义令牌实现，**后加的类自动跟着适老化**，不用逐类补覆盖。

```html
<view class="vm-page {{aging ? 'vm-aging' : ''}}">
```

## 换肤

缺省是企业蓝（与 admin 端同源）。切临床蓝——在框架样式**之后**多引一行主题：

- 小程序：`app.wxss` 里 `@import "/vendor/vima-ui-mp/dist/themes/clinical-blue.wxss";`
- H5：`main.ts` 里 `import 'vendor/vima-ui-h5/dist/themes/clinical-blue.css'`

自定义品牌色在项目自己的样式里重定义 `page, .vm-page { --vm-primary: …; }`——
**不要改 `vendor/` 下的任何文件**，下次 `vima update` 会盖掉。
