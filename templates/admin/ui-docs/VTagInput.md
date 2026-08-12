<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VTagInput

输入和维护一组标签值。

- 分类：`form`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `modelValue` | `unknown[]` | `() => []` | 否 | 当前标签值集合。 |
| `allowClear` | `boolean` | `false` | 否 | 是否允许清空全部标签。 |
| `disabledInput` | `boolean` | `false` | 否 | 是否禁止新增标签但允许查看现有值。 |
| `disabled` | `boolean` | `false` | 否 | 是否禁止全部交互。 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `unknown[]` |  |
| `change` | `unknown[]` |  |

## 用法

```vue
<template>
  <VTagInput />
</template>

<script setup lang="ts">
import { VTagInput } from '@vima-tech/ui-admin';
</script>
```
