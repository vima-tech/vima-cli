# VmInput · 输入框（词表 `search`；控件 `input` / `number`）

> 类：`vm-input` `vm-input-icon` `vm-input-suffix` `vm-input-placeholder`

## 用途

单行输入。搜索框是它的 `with-icon` 形态。

## 结构

```html
<!-- 普通输入 -->
<view class="vm-field">
  <text class="vm-label">手机号</text>
  <input class="vm-input" type="number" maxlength="11"
         placeholder="请输入手机号" placeholder-class="vm-input-placeholder"
         value="{{form.phone}}" bindinput="onInput" data-key="phone" />
</view>

<!-- 搜索（词表 search） -->
<view class="vm-field">
  <image class="vm-input-icon" src="/assets/search.png" />
  <input class="vm-input with-icon" placeholder="搜索处方"
         placeholder-class="vm-input-placeholder" bindconfirm="onSearch" />
</view>
```

## 修饰类

| 类 | 作用 |
|---|---|
| `with-icon` | 左侧留 40px 图标位，配 `vm-input-icon` |
| `with-suffix` | 右侧留 44px 位，配 `vm-input-suffix`（单位、清除、语音） |

数字输入用 `type="number"`（或 `digit` 带小数），不要用普通键盘让用户自己找数字。

## 不要这样用

- **placeholder 必须用 `placeholder-class="vm-input-placeholder"`**：
  小程序的 placeholder 不吃 CSS 继承，不写这一句它就是系统默认灰。
- **placeholder 不能替代 label**：一开始打字它就消失了，用户会忘记这栏填什么。
- 图标层是绝对定位的，父级必须是 `vm-field`（它有 `position: relative`）。

## H5 端差异

- placeholder 不用 `placeholder-class`，`global.css` 已给 `.vm-input::placeholder` 上色。
- 数字输入用 `<input type="tel" inputmode="numeric">` 而不是 `type="number"`——
  后者在移动浏览器上会出现上下箭头、且能输入 `e`/`+`/`-`。
