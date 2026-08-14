# VmLoading · 加载态

> 类：`vm-loading` `vm-spinner` `vm-loading-text`

## 用途

页内区域的加载指示（双环反向旋转）。全屏阻塞式加载用 `wx.showLoading`，
两者不要同时出现。

## 结构

```html
<view class="vm-loading" wx:if="{{loading}}">
  <view class="vm-spinner"></view>
  <text class="vm-loading-text">加载中</text>
</view>
<view wx:elif="{{list.length === 0}}" class="vm-empty">…</view>
<view wx:else>…列表…</view>
```

三态（加载中 / 空 / 有数据）必须写全，这是最常漏的一处。

## 不要这样用

- **不要在 `wx.showLoading` 之外再叠一个 `vm-loading`**：两个转圈会让人以为卡住了。
- **超过 10 秒的操作不要只转圈**：给进度或阶段文案，否则用户会以为死了然后重试，
  产生重复提交。
