<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VPagination

在分页数据集合之间导航。

- 分类：`navigation`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `current` | `number` | `1` | 否 | 当前页码 |
| `total` | `number` | `0` | 否 | 数据总条数 |
| `pageSize` | `number` | `10` | 否 | 每页条数 |
| `pageSizes` | `number[]` | `() => [10, 20, 30, 50, 100]` | 否 | 可选每页条数 |
| `layout` | `string` | `prev, pager, next, jumper, total` | 否 | 分页子控件布局 |
| `pagerCount` | `number` | `7` | 否 | 最多显示的页码按钮数 |
| `disabled` | `boolean` | `false` | 否 | 是否禁用 |
| `hideOnSinglePage` | `boolean` | `false` | 否 | 单页时是否隐藏 |
| `background` | `boolean` | `false` | 否 | 页码按钮是否有背景 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:current` | `number` | 更新后的页码 |
| `update:pageSize` | `number` | 更新后的每页条数 |
| `change` | `[number, number]` | 页码和每页条数变更 |
| `sizeChange` | `number` | 每页条数变更 |

## 用法

```vue
<template>
  <VPagination />
</template>

<script setup lang="ts">
import { VPagination } from '@vima-tech/ui-admin';
</script>
```
