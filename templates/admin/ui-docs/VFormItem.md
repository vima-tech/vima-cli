<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VFormItem

组合字段标签、控件和校验反馈。

- 分类：`form`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `label` | `string` | — | 否 | 展示在控件旁的字段名称 |
| `labelWidth` | `string \| number` | `undefined` | 否 | 覆盖当前字段的标签宽度 |
| `prop` | `string` | — | 否 | 字段在表单模型中的键 |
| `required` | `boolean` | `false` | 否 | 是否显式要求当前字段必填 |
| `mode` | `string` | — | 否 | 字段展示模式 |

## Slots

- `default`

## 用法

```vue
<template>
  <VFormItem />
</template>

<script setup lang="ts">
import { VFormItem } from '@vima-tech/ui-admin';
</script>
```
