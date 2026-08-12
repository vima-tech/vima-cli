<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VUpload

选择文件并交由业务逻辑上传。

- 分类：`form`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `url` | `string` | — | 否 | 业务上传端点；组件本身只负责文件选择。 |
| `accept` | `string` | — | 否 | 原生文件类型过滤表达式。 |
| `accpet` | `string` | — | 否 | accept 的历史拼写兼容属性。 |
| `multiple` | `boolean` | `false` | 否 | 是否允许一次选择多个文件。 |
| `beforeUpload` | `(files: FileList \| File[]) => unknown` | `undefined` | 否 | 文件选择后的业务处理函数。 |

## Slots

- `default`

## 用法

```vue
<template>
  <VUpload />
</template>

<script setup lang="ts">
import { VUpload } from '@vima-tech/ui-admin';
</script>
```
