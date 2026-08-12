<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VIcon

从统一 SVG 注册表渲染图标。

- 分类：`icon`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `type` | `string` | — | 否 | 兼容旧调用的图标名或别名 |
| `name` | `string` | — | 否 | 注册表中的规范图标名 |
| `color` | `string` | — | 否 | 图标颜色，默认继承 currentColor |
| `size` | `number \| string` | `1em` | 否 | 图标尺寸 |
| `title` | `string` | — | 否 | 无障碍标题，提供后图标不再隐藏 |

## 用法

```vue
<template>
  <VIcon />
</template>

<script setup lang="ts">
import { VIcon } from '@vima-tech/ui-admin';
</script>
```
