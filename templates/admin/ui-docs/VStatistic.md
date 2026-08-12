<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VStatistic

突出展示关键统计数值。

- 分类：`data`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `value` | `number \| string` | `0` | 否 | 统计值 |
| `title` | `string` | — | 否 | 指标标题 |
| `precision` | `number` | `undefined` | 否 | 小数位数 |
| `prefix` | `string` | — | 否 | 数值前缀 |
| `suffix` | `string` | — | 否 | 数值后缀 |
| `valueStyle` | `object` | `() => ({})` | 否 | 数值区域样式 |
| `groupSeparator` | `boolean` | `false` | 否 | 千位分隔符 |

## Slots

- `default`
- `prefix`
- `suffix`
- `title`

## 用法

```vue
<template>
  <VStatistic />
</template>

<script setup lang="ts">
import { VStatistic } from '@vima-tech/ui-admin';
</script>
```
