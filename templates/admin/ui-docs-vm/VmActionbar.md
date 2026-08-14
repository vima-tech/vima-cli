# VmActionbar · 底部操作条（词表 `actionbar`）

> 类：`vm-actionbar` `vm-actionbar-safe`

## 用途

固定在页面底部的操作条，自带 iPhone 安全区适配。
**必须成对使用**：`vm-actionbar` 固定定位浮在上面，`vm-actionbar-safe` 放在滚动区末尾
占出等高空白——不放它，最后一屏内容会被永久压在操作条底下。

## 结构

```html
<view class="vm-page" data-page="PAGE-12">
  <view class="vm-body">
    …内容…
    <view class="vm-actionbar-safe"></view>
  </view>

  <view class="vm-actionbar">
    <view class="vm-btn vm-btn-ghost" bindtap="onSaveDraft">存草稿</view>
    <button class="vm-btn vm-btn-primary" bindtap="onSubmit">提交</button>
  </view>
</view>
```

条内的 `vm-btn` 会自动等分宽度（`flex: 1`）。

## 不要这样用

- **不要放超过 2 个按钮**：三个等分按钮每个都不够宽，且主次关系消失。
  第三个动作放页内或收进 `wx.showActionSheet`。
- **有 tabBar 的页面不要用它**：会和系统 tabBar 叠在一起。
  tabBar 页面的操作放在内容区里。
