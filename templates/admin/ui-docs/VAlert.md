<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VAlert

展示需要持续可见的状态或警告信息。

- 分类：`feedback`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `type` | `'info' \| 'success' \| 'warning' \| 'error'` | `info` | 否 | 提示语义类型 |
| `title` | `string` | — | 否 | 提示标题 |
| `description` | `string` | — | 否 | 补充说明 |
| `closable` | `boolean` | `true` | 否 | 是否允许关闭 |
| `showIcon` | `boolean` | `false` | 否 | 是否显示语义 SVG 图标 |
| `center` | `boolean` | `false` | 否 | 内容是否居中 |
| `closeText` | `string` | — | 否 | 自定义关闭文案 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `close` | `void` |  |

## Slots

- `description`
- `title`

## 用法

```vue
<template>
  <VAlert type="info" />
</template>

<script setup lang="ts">
import { VAlert } from '@vima-tech/ui-admin';
</script>
```
