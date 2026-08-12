<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VRow

24 栅格中的行容器。

- 分类：`layout`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `gutter` | `number \| string` | `12` | 否 | 列间距（像素） |
| `justify` | `'start' \| 'center' \| 'end' \| 'space-between' \| 'space-around'` | `start` | 否 | 主轴对齐方式 |
| `align` | `'top' \| 'middle' \| 'bottom'` | `top` | 否 | 交叉轴对齐方式 |

## Slots

- `default`

## 用法

```vue
<template>
  <VRow justify="start" />
</template>

<script setup lang="ts">
import { VRow } from '@vima-tech/ui-admin';
</script>
```
