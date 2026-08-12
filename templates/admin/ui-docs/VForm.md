<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VForm

管理表单模型、规则和字段校验。

- 分类：`form`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | `Record<string, unknown>` | `() => ({})` | 否 | 表单响应式数据模型 |
| `rules` | `Record<string, Array<Record<string, unknown>>>` | `() => ({})` | 否 | 按字段名组织的校验规则 |
| `required` | `boolean` | `false` | 否 | 是否将全部绑定字段标记为必填 |
| `pane` | `boolean` | `false` | 否 | 是否使用带分隔边框的面板样式 |
| `labelWidth` | `string \| number` | `100` | 否 | 水平布局标签宽度 |
| `layout` | `'horizontal' \| 'vertical' \| 'inline'` | `horizontal` | 否 | 表单字段排列方式 |

## Slots

- `default`

## 用法

```vue
<template>
  <VForm layout="horizontal" />
</template>

<script setup lang="ts">
import { VForm } from '@vima-tech/ui-admin';
</script>
```
