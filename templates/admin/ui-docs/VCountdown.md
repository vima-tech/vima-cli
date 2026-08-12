<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VCountdown

展示到目标时间的倒计时。

- 分类：`data`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `value` | `number \| Date` | `0` | 否 | 目标时间戳或 Date |
| `format` | `string` | `HH:mm:ss` | 否 | 倒计时格式模板 |
| `title` | `string` | — | 否 | 指标标题 |
| `prefix` | `string` | — | 否 | 倒计时前缀 |
| `suffix` | `string` | — | 否 | 倒计时后缀 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `finish` | `void` | 倒计时结束 |
| `change` | `number` | 剩余毫秒数变更 |

## Slots

- `default`
- `prefix`
- `suffix`
- `title`

## 用法

```vue
<template>
  <VCountdown />
</template>

<script setup lang="ts">
import { VCountdown } from '@vima-tech/ui-admin';
</script>
```
