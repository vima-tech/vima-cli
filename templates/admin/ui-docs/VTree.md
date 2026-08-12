<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VTree

展示和选择层级数据。

- 分类：`data`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `data` | `RowData[]` | `() => []` | 否 | 树节点数据 |
| `checkedKeys` | `unknown[]` | `() => []` | 否 | 当前勾选的节点键 |
| `selectedKey` | `unknown` | — | 否 | 当前选中的节点键 |
| `showCheckbox` | `boolean` | `false` | 否 | 是否显示复选框 |
| `showIcon` | `boolean` | `false` | 否 | 是否显示节点图标 |
| `draggable` | `boolean` | `false` | 否 | 是否允许拖拽节点 |
| `defaultExpandAll` | `boolean` | `false` | 否 | 是否默认展开全部节点 |
| `expandedKeys` | `unknown[]` | `undefined` | 否 | 受控的已展开节点键 |
| `replaceFields` | `Record<string, string>` | `() => ({})` | 否 | 自定义字段映射 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:checkedKeys` | `unknown[]` | 更新后的勾选键 |
| `update:selectedKey` | `PropertyKey \| null` | 更新后的选中键 |
| `update:expandedKeys` | `unknown[]` | 更新后的展开键 |
| `check` | `[unknown[], Record<string, unknown>]` | 勾选状态变更 |
| `select` | `RowData` | 节点选择 |
| `nodeClick` | `[RowData, Record<string, unknown>, MouseEvent]` | 节点单击 |
| `nodeDblclick` | `[RowData, Record<string, unknown>, MouseEvent]` | 节点双击 |
| `nodeContextmenu` | `[RowData, Record<string, unknown>, MouseEvent]` | 节点上下文菜单 |
| `expand` | `[boolean, RowData]` | 展开状态变更 |
| `dragstart` | `[RowData, DragEvent]` | 开始拖拽 |
| `dragover` | `[RowData, DragEvent]` | 拖拽经过节点 |
| `drop` | `[RowData, RowData, string, DragEvent]` | 放置节点 |
| `dragend` | `[RowData, DragEvent]` | 结束拖拽 |

## Slots

- `icon`
- `leafIcon`
- `operations`
- `title`

## 用法

```vue
<template>
  <VTree />
</template>

<script setup lang="ts">
import { VTree } from '@vima-tech/ui-admin';
</script>
```
