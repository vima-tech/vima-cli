# VmMetric · 指标卡

> 类：`vm-metrics` `vm-metric` `vm-metric-ring` `vm-metric-value` `vm-metric-name`

## 用途

三栏并排的关键指标（热量/蛋白/入量这类）。`vm-metric-ring` 只规定 58×58 的容器尺寸，
**环本身由页面画**——小程序用 `<canvas>`，H5 用内联 `<svg>`。

## 结构

```html
<view class="vm-metrics">
  <view class="vm-metric" wx:for="{{metrics}}" wx:key="key">
    <view class="vm-metric-ring">
      <canvas type="2d" id="ring-{{item.key}}"></canvas>
    </view>
    <text class="vm-metric-value">{{item.value}}</text>
    <text class="vm-metric-name">{{item.name}}</text>
  </view>
</view>
```

不需要环时可以整块省掉 `vm-metric-ring`，只留数值与名称。

## 不要这样用

- **固定三栏**。两个指标就并排两个（留一个空位）或改用 `VmKv`，不要改栅格。
- **数值要带单位**，写在 `vm-metric-name` 里（「1800 kcal」比「1800」有用）。
