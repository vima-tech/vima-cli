<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VColumnSetting

配置表格列的显示、隐藏与顺序。

- 分类：`data`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `source` | `ColumnLike[]` | `() => []` | 否 | 全量列定义，顺序即默认顺序 |
| `modelValue` | `ColumnLike[]` | `() => []` | 否 | v-model：生效的列，直接喂给 VTable 的 columns |
| `storageKey` | `string` | — | 否 | 记忆用的键，同一张表在不同页面要用不同的键。留空 = 不落盘 |
| `label` | `string` | `列设置` | 否 | 触发按钮文案 |
| `disabled` | `boolean` | `false` | 否 | 是否禁止调整列 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `ColumnLike[]` |  |
| `change` | `ColumnLike[]` |  |

## 用法

```vue
<template>
  <VColumnSetting />
</template>

<script setup lang="ts">
import { VColumnSetting } from '@vima-tech/ui-admin';
</script>
```
