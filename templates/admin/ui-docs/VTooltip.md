<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VTooltip

为目标内容展示简短文字提示。

- 分类：`overlay`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `content` | `string` | — | 否 | 提示文字 |
| `placement` | `TooltipPlacement` | `top` | 否 | 提示相对目标的位置 |
| `disabled` | `boolean` | `false` | 否 | 是否禁用提示 |
| `trigger` | `'hover' \| 'click' \| 'focus'` | `hover` | 否 | 触发方式 |
| `showAfter` | `number` | `0` | 否 | 显示延迟毫秒数 |
| `hideAfter` | `number` | `200` | 否 | 隐藏延迟毫秒数 |
| `effect` | `'dark' \| 'light'` | `dark` | 否 | 深色或浅色主题 |
| `enterable` | `boolean` | `true` | 否 | 鼠标是否可进入提示层 |

## Slots

- `content`
- `default`

## 用法

```vue
<template>
  <VTooltip trigger="hover" />
</template>

<script setup lang="ts">
import { VTooltip } from '@vima-tech/ui-admin';
</script>
```
