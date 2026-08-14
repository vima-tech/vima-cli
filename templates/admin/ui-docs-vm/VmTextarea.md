# VmTextarea · 多行文本（控件 `textarea`）

> 类：`vm-textarea`

## 用途

多行输入。最小高度 96px，与 `vm-input` 同底同边同圆角。

## 结构

```html
<view class="vm-field">
  <text class="vm-label">主诉<text class="vm-label-optional">（选填）</text></text>
  <textarea class="vm-textarea" maxlength="500" placeholder="请描述近一周的进食情况"
            placeholder-class="vm-input-placeholder"
            value="{{form.note}}" bindinput="onInput" data-key="note" />
</view>
```

## 不要这样用

- **小程序的 `<textarea>` 是原生组件，层级最高**：它会盖住普通 `<view>`，
  同屏出现弹层（`VmPopup`）时必须把 textarea 所在页面区域隐藏，
  或给 textarea 加 `wx:if` 卸载掉，否则会「弹窗被输入框穿透」。
- **不要用它做富文本**。需要格式就是另一种设计，不是加个 textarea。

## H5 端差异

- 没有小程序那条「原生组件层级最高」的坑，弹层里可以正常放 `<textarea>`。
- 要自动增高就监听 `input` 改 `style.height`；不要用 `rows` 硬扛。
