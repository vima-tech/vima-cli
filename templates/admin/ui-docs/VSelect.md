<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VSelect

从有限选项中选择单值或多值。

- 分类：`form`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `modelValue` | `unknown` | — | 否 | 当前选中值；多选模式使用数组。 |
| `placeholder` | `string` | `请选择` | 否 | 未选择时显示的提示。 |
| `disabled` | `boolean` | `false` | 否 | 是否禁止选择。 |
| `multiple` | `boolean` | `false` | 否 | 是否允许选择多个值。 |
| `clearable` | `boolean` | `false` | 否 | 是否提供清空入口。 |
| `required` | `boolean` | `false` | 否 | 是否向表单语义声明必填。 |
| `showSearch` | `boolean` | `false` | 否 | 是否强制显示选项检索框。 |
| `searchPlaceholder` | `string` | — | 否 | 选项检索框的提示。 |
| `dropdownMinWidth` | `number` | `0` | 否 | 下拉面板最小宽度。 |
| `dropdownMaxWidth` | `number` | `400` | 否 | 下拉面板最大宽度。 |
| `dropdownAlignToParent` | `boolean` | `false` | 否 | 是否将下拉面板右边缘与父元素对齐。 |
| `autoWidth` | `boolean` | `true` | 否 | 下拉宽度是否自动适应内容 |
| `items` | `Array<Record<string, unknown>>` | `() => []` | 否 | 兼容旧接口的选项集合。 |
| `options` | `Array<Record<string, unknown>>` | `() => []` | 否 | 结构化选项集合。 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `string \| number \| Array<string \| number> \| null` | 更新后的选择值 |
| `change` | `string \| number \| Array<string \| number> \| null` | 选择变更 |

## Slots

- `default`

## 用法

```vue
<template>
  <VSelect />
</template>

<script setup lang="ts">
import { VSelect } from '@vima-tech/ui-admin';
</script>
```
