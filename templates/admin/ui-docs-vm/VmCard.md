# VmCard · 卡片（词表 `cards`）

> 类：`vm-card` `vm-accent` `vm-accent-blue|cyan|green|indigo|amber|red|violet`
> `vm-card-hd` `vm-card-hd-main` `vm-card-hd-line` `vm-card-hd-sub`

## 用途

内容分组的基本容器。白底、淡边、弱投影。列表、键值区、宫格、空态都装在它里面。

## 结构

```html
<view class="vm-card">
  <view class="vm-card-hd">
    <view class="vm-tile-solid"></view>
    <view class="vm-card-hd-main">
      <view class="vm-card-hd-line">
        <text class="vm-t1">本周随访</text>
        <text class="vm-chip green">已完成</text>
      </view>
      <view class="vm-card-hd-sub">最近一次提交：3 月 12 日</view>
    </view>
    <view class="vm-chev"></view>
  </view>
  <view class="vm-kv">…</view>
</view>
```

顶部要一条渐变强调线时，加 `vm-accent`（默认蓝）或 `vm-accent-<色>`：

```html
<view class="vm-card vm-accent vm-accent-amber">…</view>
```

## 修饰类

| 类 | 作用 |
|---|---|
| `vm-accent` | 卡片顶部 3px 渐变条（默认蓝） |
| `vm-accent-cyan` / `-green` / `-indigo` / `-amber` / `-red` / `-violet` | 换强调色 |

## 不要这样用

- **不要给卡片再套一层卡片**。要分区用 `VmSection` 的分区标题，不要用嵌套卡制造层级。
- **不要在 `vm-card` 上加 `padding`**：内部各区块（`vm-card-hd`/`vm-kv`/`vm-list-item`）
  自带内边距，再加一层会让分隔线缩进、对不齐。
- `vm-accent-blue` 与只写 `vm-accent` 等效，它存在只是为了 `vm-accent-{{tone}}` 这种
  动态类名能取到值。
