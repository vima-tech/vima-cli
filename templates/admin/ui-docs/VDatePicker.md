<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VDatePicker

输入单个日期、时间或日期范围。

- 分类：`form`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `modelValue` | `unknown` | — | 否 | 当前日期、时间或范围值。 |
| `type` | `string` | `date` | 否 | 日期选择精度。 |
| `placeholder` | `string` | — | 否 | 未选择时显示的提示。 |
| `disabled` | `boolean` | `false` | 否 | 是否禁止选择。 |
| `required` | `boolean` | `false` | 否 | 是否向表单语义声明必填。 |
| `range` | `boolean` | `false` | 否 | 是否选择起止范围。 |
| `allowClear` | `boolean` | `false` | 否 | 是否允许清空当前值。 |
| `min` | `string` | — | 否 | 可选择的最小日期。 |
| `max` | `string` | — | 否 | 可选择的最大日期。 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `string \| string[]` | 更新后的日期值 |
| `change` | `string \| string[]` | 日期变更 |

## 用法

```vue
<template>
  <VDatePicker />
</template>

<script setup lang="ts">
import { VDatePicker } from '@vima-tech/ui-admin';
</script>
```
