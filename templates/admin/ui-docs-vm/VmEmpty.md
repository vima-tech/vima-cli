# VmEmpty · 空态

> 类：`vm-empty` `vm-empty-icon` `vm-empty-icon-img` `vm-empty-text` `vm-empty-hint`
> `vm-empty-en` `vm-empty-action`

## 用途

列表为空、筛选无结果、功能未开通时的占位。**空态必须说明原因和下一步**，
只写「暂无数据」是在浪费一整屏。

## 结构

```html
<view class="vm-card">
  <view class="vm-empty slim">
    <view class="vm-empty-icon">📋</view>
    <view class="vm-empty-text">还没有随访记录</view>
    <view class="vm-empty-hint">完成首次评估后，这里会显示每周记录</view>
    <view class="vm-empty-action" bindtap="onStart">去评估</view>
  </view>
</view>
```

`vm-empty-hint` / `vm-empty-en` / `vm-empty-action` 都可省；`vm-empty-text` 必须有。

## 修饰类

| 类 | 作用 |
|---|---|
| `slim` | 卡片内空间紧凑时用，上下留白减半 |

## 不要这样用

- **「加载中」不是空态**：数据没回来时用 `VmLoading`，直接渲染空态会让用户
  以为真的没有数据然后离开。
- **失败也不是空态**：请求失败要给「重试」，用 `vm-empty-action` 绑重新请求，
  文案写清是网络问题而不是没数据。
