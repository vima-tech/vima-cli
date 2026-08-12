<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VDropdown

与上游 ui-v3 已分歧：面板从「贴着触发器的 absolute」改成 teleport 到 body 的 fixed。 重跑 scripts/extract-from-ui-v3.mjs 会把这段覆盖回去，理由见 src/floating.ts 的文件注释。

- 分类：`overlay`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `visible` | `boolean` | `undefined` | 否 | 受控的面板可见状态 |
| `placement` | `string` | `bottom-start` | 否 | 面板相对触发器的位置 |

## Slots

- `content`
- `default`

## 用法

```vue
<template>
  <VDropdown />
</template>

<script setup lang="ts">
import { VDropdown } from '@vima-tech/ui-admin';
</script>
```
