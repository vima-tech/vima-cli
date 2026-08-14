# VmButton · 按钮

> 类：`vm-btn` `vm-btn-primary` `vm-btn-ghost`

## 用途

`vm-btn` 是基类（尺寸/圆角/居中/去掉小程序 button 自带边框），
配 `vm-btn-primary`（主操作，渐变实心）或 `vm-btn-ghost`（次操作，白底描边）。

## 结构

```html
<button class="vm-btn vm-btn-primary" bindtap="onSubmit" disabled="{{submitting}}">
  提交
</button>
<view class="vm-btn vm-btn-ghost" bindtap="onCancel">取消</view>
```

不需要微信开放能力时用 `<view>` 即可（少一层原生组件，层级问题也少）；
需要 `open-type` 时必须用 `<button>`。

## 修饰类

| 类 | 作用 |
|---|---|
| `vm-btn-primary` | 主操作。一屏只有一个 |
| `vm-btn-ghost` | 次操作、取消、返回 |
| `[disabled]` | 主按钮的禁用态（灰底、去投影）；须同时禁掉点击逻辑 |

## 不要这样用

- **一屏只能有一个 `vm-btn-primary`**。两个主按钮 = 没有主按钮。
- **提交类按钮必须有 pending 态**：`disabled="{{submitting}}"` + 文案改「提交中」，
  否则用户会连点，产生重复单据。
- **危险操作（删除/作废）不要做成 primary**：用 ghost + `wx.showModal` 二次确认。

## H5 端差异

- 没有 `open-type` 那套微信开放能力，一律普通 `<button type="button">`；
  表单里记得写 `type="button"`，否则会触发表单默认提交刷新页面。
- 没有 `::after` 边框要清，但仍保留该规则以维持两端同一份样式文件。
