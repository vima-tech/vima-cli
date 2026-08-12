<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VLink

页面导航或低强调文字操作。

- 分类：`navigation`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `href` | `string` | — | 否 | 目标地址 |
| `target` | `'_self' \| '_blank' \| '_parent' \| '_top'` | `_self` | 否 | 链接打开方式 |
| `type` | `string` | `default` | 否 | 链接语义类型 |
| `underline` | `boolean` | `false` | 否 | 悬停时是否显示下划线 |
| `disabled` | `boolean` | `false` | 否 | 是否禁用 |
| `download` | `boolean \| string` | `false` | 否 | 是否作为下载链接 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `click` | `MouseEvent` |  |

## Slots

- `default`

## 用法

```vue
<template>
  <VLink target="_self" />
</template>

<script setup lang="ts">
import { VLink } from '@vima-tech/ui-admin';
</script>
```
