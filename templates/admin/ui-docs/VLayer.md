<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VLayer

在模态浮层中承载需要用户处理的内容。

- 分类：`overlay`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `modelValue` | `boolean` | `false` | 否 | 浮层是否可见 |
| `title` | `string` | — | 否 | 浮层标题 |
| `area` | `string \| number \| Array<string \| number>` | — | 否 | 面板宽高 |
| `shadeClose` | `boolean` | `false` | 否 | 点击遮罩是否关闭 |
| `closeBtn` | `boolean \| number \| string` | `true` | 否 | 是否显示关闭按钮 |
| `loading` | `boolean` | `false` | 否 | 是否显示处理遮罩 |
| `type` | `string \| number` | `1` | 否 | 兼容层类型 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `boolean` |  |
| `close` | `void` |  |
| `open` | `void` |  |

## Slots

- `default`
- `footer`

## 用法

```vue
<template>
  <VLayer />
</template>

<script setup lang="ts">
import { VLayer } from '@vima-tech/ui-admin';
</script>
```
