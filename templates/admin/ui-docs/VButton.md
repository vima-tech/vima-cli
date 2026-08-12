<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VButton

触发操作或提交的按钮。

- 分类：`basic`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `type` | `string` | `default` | 否 | 按钮语义与视觉类型 |
| `size` | `string` | `md` | 否 | 按钮尺寸 |
| `disabled` | `boolean` | `false` | 否 | 是否禁用 |
| `loading` | `boolean` | `false` | 否 | 是否显示加载态 |
| `nativeType` | `'button' \| 'submit' \| 'reset'` | `button` | 否 | 原生 button 类型 |
| `borderStyle` | `string` | — | 否 | 边框样式，none 为无边框 |

## Slots

- `default`

## 用法

```vue
<template>
  <VButton nativeType="button" />
</template>

<script setup lang="ts">
import { VButton } from '@vima-tech/ui-admin';
</script>
```
