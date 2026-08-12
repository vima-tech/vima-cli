<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VDropdown

<!-- 上游注意：api.generated.json 把内部分叉备注抽成了 VDropdown 的描述（源头在组件源码
     文件注释），下方描述为手工替换；上游修复抽取源后按生成结果覆盖本段即可。 -->

在触发元素附近展开下拉操作面板。

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
