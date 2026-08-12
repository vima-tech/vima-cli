<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VDivider

分隔相邻内容区块。

- 分类：`layout`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `content` | `string` | — | 否 | 分隔线文字 |
| `theme` | `string` | — | 否 | 分隔线颜色 |
| `direction` | `'horizontal' \| 'vertical'` | `horizontal` | 否 | 水平或垂直方向 |
| `contentPosition` | `'left' \| 'center' \| 'right'` | `center` | 否 | 文字对齐位置 |

## Slots

- `default`

## 用法

```vue
<template>
  <VDivider direction="horizontal" />
</template>

<script setup lang="ts">
import { VDivider } from '@vima-tech/ui-admin';
</script>
```
