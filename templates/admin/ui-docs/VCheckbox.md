<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VCheckbox

在有限选项中切换单个多选状态。

- 分类：`form`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `modelValue` | `unknown` | `false` | 否 | 独立使用时的当前值 |
| `value` | `CheckboxValue` | — | 否 | 在复选框组中的选项值 |
| `label` | `string` | — | 否 | 选项显示文字 |
| `disabled` | `boolean` | `false` | 否 | 是否禁用 |
| `indeterminate` | `boolean` | `false` | 否 | 是否显示半选态 |
| `trueValue` | `unknown` | `true` | 否 | 选中时写入的值 |
| `falseValue` | `unknown` | `false` | 否 | 未选中时写入的值 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `PropValue` | 更新后的独立复选值 |
| `change` | `PropValue` | 值变更 |

## Slots

- `default`

## 用法

```vue
<template>
  <VCheckbox />
</template>

<script setup lang="ts">
import { VCheckbox } from '@vima-tech/ui-admin';
</script>
```
