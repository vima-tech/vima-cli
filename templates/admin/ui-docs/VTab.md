<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VTab

在同一区域切换多组内容。

- 分类：`navigation`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `modelValue` | `unknown` | — | 否 | 当前激活的标签页键 |
| `type` | `string` | — | 否 | 标签页视觉类型 |
| `allowClose` | `boolean` | `false` | 否 | 是否允许关闭标签页 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `string \| number` | 更新后的标签页键 |
| `change` | `string \| number` | 标签页变更 |
| `close` | `void` |  |

## Slots

- `default`

## 用法

```vue
<template>
  <VTab />
</template>

<script setup lang="ts">
import { VTab } from '@vima-tech/ui-admin';
</script>
```
