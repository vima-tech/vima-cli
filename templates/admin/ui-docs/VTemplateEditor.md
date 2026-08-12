<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VTemplateEditor

可视化编辑并预览 Template DSL。

- 分类：`template`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `modelValue` | `Template` | `—` | 是 | 被编辑的模板。编辑器内部持有副本，通过 update:modelValue 回吐 |
| `readonly` | `boolean` | `false` | 否 | 只读模式：仍可浏览与选中，但不能改动 |
| `categories` | `string[]` | `undefined` | 否 | 组件面板只显示这些分类名，不传则全部显示 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `Template` |  |
| `save` | `Template` | 保存当前模板 |
| `select` | `string[]` | 选中节点 ID 集合 |

## 用法

```vue
<template>
  <VTemplateEditor />
</template>

<script setup lang="ts">
import { VTemplateEditor } from '@vima-tech/ui-admin';
</script>
```
