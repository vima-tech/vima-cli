<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VDescriptions

按分组网格展示实体详情。

- 分类：`data`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `title` | `string` | — | 否 | 详情区域标题 |
| `column` | `number \| string` | `3` | 否 | 每行列数 |
| `border` | `boolean` | `false` | 否 | 是否显示边框 |
| `labelWidth` | `number \| string` | — | 否 | 标签列宽度 |

## Slots

- `default`

## 用法

```vue
<template>
  <VDescriptions />
</template>

<script setup lang="ts">
import { VDescriptions } from '@vima-tech/ui-admin';
</script>
```
