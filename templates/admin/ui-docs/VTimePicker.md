<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VTimePicker

输入或选择一天中的时间。

- 分类：`form`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `modelValue` | `string` | — | 否 | HH:mm 格式的当前时间 |
| `min` | `string` | — | 否 | 允许选择的最早时间 |
| `max` | `string` | — | 否 | 允许选择的最晚时间 |
| `step` | `number \| string` | `60` | 否 | 分钟步长 |
| `disabled` | `boolean` | `false` | 否 | 是否禁用 |
| `readonly` | `boolean` | `false` | 否 | 是否只读 |
| `clearable` | `boolean` | `true` | 否 | 是否允许清空 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `string` |  |
| `change` | `string` |  |
| `focus` | `FocusEvent` |  |
| `blur` | `FocusEvent` |  |
| `clear` | `void` |  |

## 用法

```vue
<template>
  <VTimePicker />
</template>

<script setup lang="ts">
import { VTimePicker } from '@vima-tech/ui-admin';
</script>
```
