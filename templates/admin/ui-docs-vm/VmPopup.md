# VmPopup · 弹层（spec 的 `modals`）

> 类：`vm-popup` `vm-popup-mask` `vm-popup-panel` `vm-popup-hd` `vm-popup-title`
> `vm-popup-body` `vm-popup-ft`

## 用途

从底部升起的面板，承载 spec 里声明的弹窗（表单、选择、详情）。
**移动端不做居中对话框**——底部面板离拇指近，且不会被输入法顶掉。

简单的「确定/取消」不要用它，用 `wx.showModal`。

## 结构

```html
<view class="vm-popup" wx:if="{{showEdit}}" catchtouchmove="noop">
  <view class="vm-popup-mask" bindtap="onClose"></view>
  <view class="vm-popup-panel">
    <view class="vm-popup-hd">
      <text class="vm-popup-title">编辑随访记录</text>
      <view class="vm-chev muted" style="transform:rotate(135deg)" bindtap="onClose"></view>
    </view>
    <view class="vm-popup-body">
      <view class="vm-field">…</view>
    </view>
    <view class="vm-popup-ft">
      <view class="vm-btn vm-btn-ghost" bindtap="onClose">取消</view>
      <button class="vm-btn vm-btn-primary" bindtap="onConfirm">保存</button>
    </view>
  </view>
</view>
```

面板最高 78vh，`vm-popup-body` 自己滚动。

## 不要这样用

- **必须 `wx:if` 而不是 `hidden`**：弹层里常有 `<textarea>`/`<input>` 这类原生组件，
  `hidden` 只是视觉隐藏，它们仍浮在最上层挡住页面。
- **遮罩必须能关**（`vm-popup-mask` 上绑关闭），并给 `catchtouchmove` 防止背景跟着滚。
- **弹窗里的必填字段必须与提交接口的入参对齐**：`vima validate` 的 V-SPEC-15 会双向对账，
  少一个字段往往意味着某个业务判断根本没发生。

## H5 端差异

- 用 `v-if` 而不是 `v-show`（同小程序侧 `wx:if` 的理由：留在 DOM 里的输入框会抢焦点）。
- 打开时给 `document.body` 加 `overflow: hidden`，否则背景会跟着滚（小程序侧靠
  `catchtouchmove`）。关闭时记得还原。
- 简单的确定/取消用 `confirmAsync`（见 `VmDialog.md`），不要用面板凑。
