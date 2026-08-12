<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VBadge

在内容旁展示数量或状态徽标。

- 分类：`data`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `value` | `string \| number` | — | 否 | 徽标数值或文字 |
| `max` | `string \| number` | `99` | 否 | 数值上限，超出后显示加号 |
| `dot` | `boolean` | `false` | 否 | 是否仅显示圆点 |
| `type` | `'primary' \| 'success' \| 'warning' \| 'danger' \| 'info'` | `danger` | 否 | 徽标语义类型 |
| `showZero` | `boolean` | `false` | 否 | 值为零时是否显示 |
| `hidden` | `boolean` | `false` | 否 | 是否隐藏徽标 |

## Slots

- `default`

## 用法

```vue
<template>
  <VBadge type="danger" />
</template>

<script setup lang="ts">
import { VBadge } from '@vima-tech/ui-admin';
</script>
```
