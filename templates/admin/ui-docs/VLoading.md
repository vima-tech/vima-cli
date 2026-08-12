<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VLoading

展示局部或全屏加载状态。

- 分类：`feedback`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `loading` | `boolean` | `false` | 否 | 是否显示加载遮罩 |
| `text` | `string` | — | 否 | 遮罩上的文案，留空则只有转圈 |
| `fullscreen` | `boolean` | `false` | 否 | 铺满视口而不是包裹的内容区。此时组件本身不需要有默认插槽 |

## Slots

- `default`

## 用法

```vue
<template>
  <VLoading />
</template>

<script setup lang="ts">
import { VLoading } from '@vima-tech/ui-admin';
</script>
```
