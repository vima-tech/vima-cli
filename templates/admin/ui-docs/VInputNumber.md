<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VInputNumber

输入带范围约束的数值。

- 分类：`form`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `modelValue` | `number` | `undefined` | 否 | 当前数值。 |
| `min` | `number` | `undefined` | 否 | 允许输入的最小值。 |
| `max` | `number` | `undefined` | 否 | 允许输入的最大值。 |
| `disabled` | `boolean` | `false` | 否 | 是否禁止输入和步进操作。 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `number` |  |
| `change` | `number` |  |

## 用法

```vue
<template>
  <VInputNumber />
</template>

<script setup lang="ts">
import { VInputNumber } from '@vima-tech/ui-admin';
</script>
```
