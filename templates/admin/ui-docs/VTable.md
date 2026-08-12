<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VTable

展示、选择、排序和分页处理结构化数据。

- 分类：`data`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `columns` | `TableColumn[]` | `() => []` | 否 | 表格列定义。 |
| `dataSource` | `RowData[]` | `() => []` | 否 | 当前展示的数据行。 |
| `page` | `Record<string, any> \| false` | `false` | 否 | 分页配置；false 表示不展示内部分页。 |
| `loading` | `boolean` | `false` | 否 | 是否展示加载状态。 |
| `selectedKeys` | `unknown[]` | `() => []` | 否 | 当前选中行的唯一键集合。 |
| `showCheckbox` | `boolean` | `false` | 否 | 是否展示行选择框。 |
| `defaultToolbar` | `boolean` | `false` | 否 | 是否展示默认工具栏。 |
| `height` | `string \| number` | — | 否 | 表格内容区高度。 |
| `id` | `string` | `_id` | 否 | 行数据中的唯一键字段名。 |
| `size` | `string` | `md` | 否 | 表格密度。 |
| `rowClassName` | `string \| ((row: RowData, index: number) => string)` | — | 否 | 行类名或行类名计算函数。 |
| `treeProps` | `Record<string, string>` | `() => ({})` | 否 | 树形数据的字段映射。 |
| `defaultExpandAll` | `boolean` | `false` | 否 | 是否默认展开全部树节点。 |
| `resize` | `boolean` | `false` | 否 | 是否允许拖动列边缘调整宽度。 |
| `draggable` | `boolean` | `false` | 否 | 启用表头列拖拽排序 |
| `exportAllData` | `RowData[]` | `undefined` | 否 | 全量数据，用于导出全部数据。如果提供此属性，导出时会使用此数据而非 dataSource |
| `fetchAllData` | `() => Promise<RowData[]>` | `undefined` | 否 | 异步获取全量数据的函数，用于导出全部数据 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:selectedKeys` | `unknown[]` | 更新后的选中行键 |
| `change` | `Record<string, unknown>` | 表格分页或查询状态变更 |
| `sortChange` | `[string, 'asc' \| 'desc' \| '']` | 排序字段和方向 |
| `columnOrderChange` | `[TableColumn[], { fromIndex: number; toIndex: number }]` | 列顺序变更 |

## Slots

- `rowDoubleClick`
- `toolbar`

## 用法

```vue
<template>
  <VTable />
</template>

<script setup lang="ts">
import { VTable } from '@vima-tech/ui-admin';
</script>
```
