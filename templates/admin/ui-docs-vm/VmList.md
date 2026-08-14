# VmList · 列表项（词表 `list`）

> 类：`vm-list-item` `vm-chev`

## 用途

可点的一行记录：左图标 + 中间文字 + 右箭头。列表的每一项都是它，装在 `vm-card` 里，
最后一项的分隔线会自动去掉。

## 结构

```html
<view class="vm-card">
  <view class="vm-list-item" wx:for="{{items}}" wx:key="id" bindtap="onOpen" data-id="{{item.id}}">
    <view class="vm-tile blue"></view>
    <view class="vm-card-hd-main">
      <view class="vm-card-hd-line">
        <text class="vm-t2">{{item.title}}</text>
        <text class="vm-chip">{{item.status}}</text>
      </view>
      <view class="vm-meta">{{item.time}}</view>
    </view>
    <view class="vm-chev"></view>
  </view>
</view>
```

## 修饰类

| 类 | 作用 |
|---|---|
| `vm-list-item top` | 两行以上时图标与文字顶对齐（默认垂直居中） |
| `vm-chev sm` | 更小的箭头，用于「更多」这类次级入口 |
| `vm-chev muted` | 弱化箭头颜色 |

## 不要这样用

- **不可点的行不要给箭头**。`vm-chev` 是「点了会走」的承诺，纯展示行用 `VmKv`。
- **列表为空不要渲染空的 `vm-card`**：用 `VmEmpty`，并说明「空」的原因与下一步。
- 长列表交给 `<scroll-view>`，不要一次 setData 上千条——小程序的 setData 有体积上限。

## H5 端差异

- 长列表用 `v-for` 正常渲染即可，没有小程序的 `setData` 体积上限。
- **触底加载**：H5 的滚动容器是窗口，用 `IntersectionObserver` 观察列表末尾的哨兵元素；
  不要监听 `scroll` 再 `getBoundingClientRect` 轮询（低端机掉帧）。

```html
<div v-for="it in list" :key="it.id" class="vm-list-item">…</div>
<div ref="sentinel" style="height: 1px"></div>
```
