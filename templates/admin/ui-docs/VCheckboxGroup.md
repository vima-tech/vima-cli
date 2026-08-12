<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VCheckboxGroup

管理一组多选项的值。

- 分类：`form`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `modelValue` | `CheckboxValue[]` | `() => []` | 否 | 当前选中的值数组 |
| `disabled` | `boolean` | `false` | 否 | 是否禁用整组 |
| `options` | `CheckboxOption[]` | `() => []` | 否 | 可选项列表 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `CheckboxValue[]` |  |
| `change` | `CheckboxValue[]` |  |

## Slots

- `default`

## 用法

```vue
<template>
  <VCheckboxGroup />
</template>

<script setup lang="ts">
import { VCheckboxGroup } from '@vima-tech/ui-admin';
</script>
```
