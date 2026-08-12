<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VEmpty

在集合或页面无数据时展示空状态。

- 分类：`feedback`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `description` | `string` | `暂无数据` | 否 | 空状态说明 |
| `image` | `string` | — | 否 | 自定义图片地址 |
| `imageSize` | `number \| string` | `0` | 否 | 图片尺寸 |

## Slots

- `default`
- `footer`
- `image`

## 用法

```vue
<template>
  <VEmpty />
</template>

<script setup lang="ts">
import { VEmpty } from '@vima-tech/ui-admin';
</script>
```
