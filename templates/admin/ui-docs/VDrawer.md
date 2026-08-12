<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VDrawer

从视口边缘展开辅助任务面板。

- 分类：`overlay`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `modelValue` | `boolean` | `false` | 否 | 抽屉是否可见 |
| `title` | `string` | — | 否 | 抽屉标题 |
| `direction` | `'rtl' \| 'ltr' \| 'ttb' \| 'btt'` | `rtl` | 否 | 抽屉展开方向 |
| `size` | `string \| number` | `30%` | 否 | 抽屉宽度或高度 |
| `modal` | `boolean` | `true` | 否 | 是否显示遮罩 |
| `showClose` | `boolean` | `true` | 否 | 是否显示关闭按钮 |
| `closeOnClickModal` | `boolean` | `false` | 否 | 点击遮罩是否关闭 |
| `closeOnPressEscape` | `boolean` | `true` | 否 | 按 Escape 是否关闭 |
| `beforeClose` | `(done: () => void) => void` | `undefined` | 否 | 关闭前钩子 |
| `destroyOnClose` | `boolean` | `false` | 否 | 关闭后是否销毁内容 |
| `withHeader` | `boolean` | `true` | 否 | 是否渲染头部 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `boolean` |  |
| `open` | `void` |  |
| `close` | `void` |  |
| `opened` | `void` |  |
| `closed` | `void` |  |

## Slots

- `default`
- `footer`
- `title`

## 用法

```vue
<template>
  <VDrawer direction="rtl" />
</template>

<script setup lang="ts">
import { VDrawer } from '@vima-tech/ui-admin';
</script>
```
