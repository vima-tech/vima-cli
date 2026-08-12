<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VCollapse

管理一组可折叠内容。

- 分类：`data`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `modelValue` | `unknown` | — | 否 | 当前展开项键或键数组 |
| `accordion` | `boolean` | `false` | 否 | 是否手风琴单开 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `string \| number` | 更新后的展开项键 |
| `change` | `string \| number` | 展开项变更 |

## Slots

- `default`

## 用法

```vue
<template>
  <VCollapse />
</template>

<script setup lang="ts">
import { VCollapse } from '@vima-tech/ui-admin';
</script>
```
