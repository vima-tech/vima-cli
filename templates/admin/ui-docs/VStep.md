<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VStep

步骤条中的单个步骤。

- 分类：`navigation`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `title` | `string` | — | 否 | 步骤标题 |
| `description` | `string` | — | 否 | 步骤说明 |
| `icon` | `string` | — | 否 | 步骤 SVG 图标名 |
| `status` | `'wait' \| 'process' \| 'finish' \| 'error' \| 'success'` | — | 否 | 覆盖自动计算的状态 |

## Slots

- `default`

## 用法

```vue
<template>
  <VStep status="wait" />
</template>

<script setup lang="ts">
import { VStep } from '@vima-tech/ui-admin';
</script>
```
