<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VSkeleton

在内容加载前展示结构占位。

- 分类：`feedback`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `loading` | `boolean` | `false` | 否 | 是否显示骨架而非真实内容 |
| `type` | `SkeletonType` | `text` | 否 | 骨架的内容形态 |
| `rows` | `number \| string` | `3` | 否 | 正文行数 / 表格行数 |
| `columns` | `number \| string` | `4` | 否 | 表格骨架的列数 |
| `animated` | `boolean` | `true` | 否 | 关掉扫光动画（长列表里几十个骨架同时扫光会很吵） |

## Slots

- `default`

## 用法

```vue
<template>
  <VSkeleton />
</template>

<script setup lang="ts">
import { VSkeleton } from '@vima-tech/ui-admin';
</script>
```
