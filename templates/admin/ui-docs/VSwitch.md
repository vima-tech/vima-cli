<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VSwitch

在两个互斥状态之间切换。

- 分类：`form`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `modelValue` | `boolean \| string \| number` | `false` | 否 | 当前开关值。 |
| `disabled` | `boolean` | `false` | 否 | 是否禁止切换。 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `boolean \| string \| number` |  |
| `change` | `boolean \| string \| number` |  |

## 用法

```vue
<template>
  <VSwitch />
</template>

<script setup lang="ts">
import { VSwitch } from '@vima-tech/ui-admin';
</script>
```
