<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VPopover

在目标附近展示可交互的浮层内容。

- 分类：`overlay`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `title` | `string` | — | 否 | 浮层标题 |
| `content` | `string` | — | 否 | 浮层正文 |
| `placement` | `TooltipPlacement` | `bottom` | 否 | 浮层相对目标的位置 |
| `disabled` | `boolean` | `false` | 否 | 是否禁用 |
| `trigger` | `'hover' \| 'click' \| 'focus'` | `click` | 否 | 触发方式 |
| `width` | `string \| number` | — | 否 | 浮层宽度 |
| `showAfter` | `number` | `0` | 否 | 显示延迟毫秒数 |
| `hideAfter` | `number` | `200` | 否 | 隐藏延迟毫秒数 |
| `enterable` | `boolean` | `true` | 否 | 鼠标是否可进入浮层 |
| `popperClass` | `string` | — | 否 | 浮层附加类名 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `show` | `void` |  |
| `hide` | `void` |  |

## Slots

- `content`
- `default`
- `title`

## 用法

```vue
<template>
  <VPopover trigger="click" />
</template>

<script setup lang="ts">
import { VPopover } from '@vima-tech/ui-admin';
</script>
```
