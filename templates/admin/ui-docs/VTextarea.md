<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VTextarea

输入多行文本。

- 分类：`form`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `modelValue` | `string` | — | 否 | 当前多行文本值。 |
| `placeholder` | `string` | — | 否 | 无值时显示的输入提示。 |
| `disabled` | `boolean` | `false` | 否 | 是否禁止输入。 |
| `readonly` | `boolean` | `false` | 否 | 是否仅允许读取。 |
| `rows` | `number \| string` | `3` | 否 | 默认可见行数。 |
| `autosize` | `boolean \| object` | `false` | 否 | 是否根据内容自动调整高度。 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `string` |  |
| `change` | `string` |  |

## 用法

```vue
<template>
  <VTextarea />
</template>

<script setup lang="ts">
import { VTextarea } from '@vima-tech/ui-admin';
</script>
```
