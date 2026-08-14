# VmField · 表单字段容器（词表 `form`）

> 类：`vm-field` `vm-label` `vm-label-optional`

## 用途

一个字段 = 一个 `vm-field`：标签在上、控件在下，字段之间的间距由它负责
（**不要在控件上写 margin**）。

## 结构

```html
<view class="vm-card" style="padding:16px">
  <view class="vm-field">
    <text class="vm-label">姓名</text>
    <input class="vm-input" placeholder="请输入" placeholder-class="vm-input-placeholder"
           value="{{form.name}}" bindinput="onInput" data-key="name" />
  </view>

  <view class="vm-field">
    <text class="vm-label">备注<text class="vm-label-optional">（选填）</text></text>
    <textarea class="vm-textarea" placeholder-class="vm-input-placeholder" />
  </view>
</view>
```

## 校验错误态

出错时给控件加 `error` 修饰类，并在其后放一行 `.vm-error` 文案——
**不要在页面里内联写红色**，颜色决定权属于框架：

```html
<view class="vm-field">
  <text class="vm-label">手机号</text>
  <input class="vm-input {{errors.phone ? 'error' : ''}}" … />
  <view class="vm-error" wx:if="{{errors.phone}}">{{errors.phone}}</view>
</view>
```

`error` 修饰对 `vm-input` / `vm-textarea` / `vm-picker` 都生效（红描边 + 浅红底）。
错误文案要说清**怎么改**（「手机号应为 11 位数字」），不要只写「格式错误」。

## 不要这样用

- **必填不要只靠红星**：把「选填」显式标出来（`vm-label-optional`），
  没标的即必填——正向标注比反向标注少出错。
- **一个 `vm-field` 里只放一个控件**。两个并排（如「身高 体重」）时用两个 field
  外加 flex 容器，不要把两个 input 塞进同一个 field，否则标签对不上控件。
