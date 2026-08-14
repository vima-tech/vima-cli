# VmSeg · 分段选择器（词表 `tabs`）

> 类：`vm-seg` `vm-seg-item`

## 用途

移动端的页签形态：胶囊底 + 选中项白底浮起。**不要用桌面端那种下划线页签**，
手指点不准，也没有 hover 提示。

## 结构

```html
<view class="vm-seg">
  <view class="vm-seg-item {{tab === 'all' ? 'active' : ''}}" bindtap="onTab" data-v="all">全部</view>
  <view class="vm-seg-item {{tab === 'todo' ? 'active' : ''}}" bindtap="onTab" data-v="todo">待办</view>
  <view class="vm-seg-item {{tab === 'done' ? 'active' : ''}}" bindtap="onTab" data-v="done">已完成</view>
</view>
```

## 修饰类

| 类 | 作用 |
|---|---|
| `active` | 选中态（白底 + 蓝字 + 投影） |

## 不要这样用

- **最多 4 段**。等宽平分，5 段以上每段就窄到放不下两个字了；
  再多请改用页面级 tabBar 或列表筛选。
- **切段不要重新进页面**：段之间是同一份数据的不同视图，用 `setData` 切，
  `wx.redirectTo` 会丢掉滚动位置与已填内容。
