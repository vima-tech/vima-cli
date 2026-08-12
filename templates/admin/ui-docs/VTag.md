<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VTag

展示状态、分类或可移除关键词。

- 分类：`data`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `type` | `string` | `default` | 否 | 标签的语义色类型。 |
| `closable` | `boolean` | `false` | 否 | 是否展示移除按钮。 |
| `disabled` | `boolean` | `false` | 否 | 是否禁止移除操作。 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `close` | `void` |  |

## Slots

- `default`

## 用法

```vue
<template>
  <VTag />
</template>

<script setup lang="ts">
import { VTag } from '@vima-tech/ui-admin';
</script>
```
