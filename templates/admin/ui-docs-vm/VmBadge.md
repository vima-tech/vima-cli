# VmBadge · 深色面徽标

> 类：`vm-badge` `vm-badge-dot`

## 用途

**只用在 `vm-hero` 里**的状态徽标（半透明深底 + 青色描边），
带呼吸圆点表示「实时/运行中」。浅色面上的状态用 `VmChip`。

## 结构

```html
<view class="vm-badge"><view class="vm-badge-dot"></view>服务运行中</view>
```

圆点可以省掉（非实时语义时）：

```html
<view class="vm-badge">V3.1</view>
```

## 不要这样用

- **不要放在白底卡片上**：它的底色是为深色主视觉调的，白底上几乎看不见。
- 呼吸圆点是「有东西在动」的承诺，静态信息别用。
