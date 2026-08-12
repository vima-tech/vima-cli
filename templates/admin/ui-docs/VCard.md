<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VCard

承载后台页面信息区块的卡片。

- 分类：`layout`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `title` | `string` | — | 否 | 卡片标题 |
| `shadow` | `'always' \| 'hover' \| 'never'` | `always` | 否 | 阴影显示策略 |

## Slots

- `default`
- `extra`
- `title`

## 用法

```vue
<template>
  <VCard shadow="always" />
</template>

<script setup lang="ts">
import { VCard } from '@vima-tech/ui-admin';
</script>
```
