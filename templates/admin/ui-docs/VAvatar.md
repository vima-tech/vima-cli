<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VAvatar

展示用户或实体头像。

- 分类：`basic`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `size` | `string \| number` | `md` | 否 | 预设尺寸或像素值 |
| `shape` | `'circle' \| 'square'` | `circle` | 否 | 圆形或方形 |
| `src` | `string` | — | 否 | 头像图片地址 |
| `icon` | `string` | — | 否 | 无图片时的图标名 |
| `text` | `string` | — | 否 | 无图片时的文字 |
| `color` | `string` | — | 否 | 文字头像背景色 |
| `fit` | `'fill' \| 'contain' \| 'cover' \| 'none' \| 'scale-down'` | `cover` | 否 | 图片 object-fit 方式 |

## Slots

- `default`

## 用法

```vue
<template>
  <VAvatar shape="circle" />
</template>

<script setup lang="ts">
import { VAvatar } from '@vima-tech/ui-admin';
</script>
```
