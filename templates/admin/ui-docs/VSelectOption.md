<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VSelectOption

声明 VSelect 的插槽式选项。

- 分类：`form`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `value` | `unknown` | — | 否 | 选项提交值 |
| `label` | `string \| number` | — | 否 | 选项显示文字 |
| `disabled` | `boolean` | `false` | 否 | 是否禁用该选项 |

## Slots

- `default`

## 用法

```vue
<template>
  <VSelectOption />
</template>

<script setup lang="ts">
import { VSelectOption } from '@vima-tech/ui-admin';
</script>
```
