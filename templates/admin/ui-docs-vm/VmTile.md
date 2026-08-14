# VmTile · 图标底板

> 类：`vm-tile` `vm-tile-solid` `vm-tile-img`

## 用途

列表项左侧、卡片头左侧的圆角图标底板。两种：`vm-tile` 浅底（列表行用），
`vm-tile-solid` 深色实心（卡片标题用，视觉重量更大）。

## 结构

```html
<!-- 浅底 + 图片图标 -->
<view class="vm-tile cyan"><image class="vm-tile-img" src="/assets/plan.png" /></view>

<!-- 深色实心 + emoji -->
<view class="vm-tile-solid green">📋</view>
```

## 修饰类

| 类 | 作用 |
|---|---|
| `lg` | 放大到 40px（`vm-tile` / `vm-tile-img` 都支持） |
| `cyan` `green` `indigo` `amber` `red` `violet` | 换色；不写 = 蓝 |

## 不要这样用

- **颜色不要按好看选，要按语义选**：同一类业务在全端用同一个色，
  否则用户学不会「绿色 = 已完成」这类规律。
- 框架**不提供图标集**（小程序没有 SVG symbol 机制，塞进框架就是塞一堆二进制）。
  图标用项目自己的 PNG 或 emoji，放 `src/assets/`。
