# VmSection · 分区标题

> 类：`vm-sec` `vm-sec-dot` `vm-sec-title` `vm-sec-en` `vm-sec-more`

## 用途

一屏里划分内容组。竖条 + 中文标题 + 英文缀标 +（可选）右侧「更多」。
它是**卡片之间**的分隔手段——不要用嵌套卡片来表达层级。

## 结构

```html
<view class="vm-sec">
  <view class="vm-sec-dot"></view>
  <text class="vm-sec-title">常用服务</text>
  <text class="vm-sec-en">SERVICES</text>
  <view class="vm-sec-more" bindtap="onMore">更多<view class="vm-chev sm"></view></view>
</view>
<view class="vm-card">…</view>
```

## 修饰类

| 类 | 作用 |
|---|---|
| `vm-sec-dot green` / `amber` / `indigo` / `red` | 换竖条颜色，用于区分并列的几个分区 |

`vm-sec` 的首个兄弟位置会自动去掉上外边距（`:first-child`），不用手动改。

## 不要这样用

- **英文缀标不是必需**，写不出恰当英文就别硬凑——`vm-sec-en` 可以整条省掉。
- **不要用它做页面主标题**：页面标题在 `app.json` 的 `navigationBarTitleText`
  或 `vm-hero-title` 里。
