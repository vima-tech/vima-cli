<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VSteps

展示多步骤流程的当前进度。

- 分类：`navigation`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `active` | `number` | `0` | 否 | 当前步骤索引 |
| `direction` | `'horizontal' \| 'vertical'` | `horizontal` | 否 | 排列方向 |
| `processStatus` | `'wait' \| 'process' \| 'finish' \| 'error' \| 'success'` | `process` | 否 | 当前步骤状态 |
| `finishStatus` | `'wait' \| 'process' \| 'finish' \| 'error' \| 'success'` | `finish` | 否 | 已完成步骤状态 |
| `alignCenter` | `boolean` | `false` | 否 | 是否居中对齐 |
| `simple` | `boolean` | `false` | 否 | 是否使用简洁模式 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `change` | `number` | 点击的步骤索引 |

## Slots

- `default`

## 用法

```vue
<template>
  <VSteps direction="horizontal" />
</template>

<script setup lang="ts">
import { VSteps } from '@vima-tech/ui-admin';
</script>
```
