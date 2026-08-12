<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VRadioGroup

管理一组互斥单选项的值。

- 分类：`form`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `modelValue` | `unknown` | — | 否 | 当前选中值。 |
| `disabled` | `boolean` | `false` | 否 | 是否禁止组内所有选项。 |
| `options` | `Array<{ label: string; value: unknown; disabled?: boolean }>` | `() => []` | 否 | 无需插槽时使用的结构化选项。 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `string \| number \| boolean` | 更新后的单选值 |
| `change` | `string \| number \| boolean` | 单选变更 |

## Slots

- `default`

## 用法

```vue
<template>
  <VRadioGroup />
</template>

<script setup lang="ts">
import { VRadioGroup } from '@vima-tech/ui-admin';
</script>
```
