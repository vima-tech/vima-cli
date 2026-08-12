<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VProgress

展示任务或流程完成进度。

- 分类：`data`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `percent` | `number` | `0` | 否 | 完成百分比，范围 0–100 |
| `status` | `string` | — | 否 | 进度状态样式 |

## 用法

```vue
<template>
  <VProgress />
</template>

<script setup lang="ts">
import { VProgress } from '@vima-tech/ui-admin';
</script>
```
