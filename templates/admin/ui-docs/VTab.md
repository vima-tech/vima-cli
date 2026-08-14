<!-- 生成自 @vima-tech/ui-admin 0.1.0 api.generated.json，勿手改；随组件库版本更新由脚本重新生成 -->

# VTab

在同一区域切换多组内容。

- 分类：`navigation`

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| `modelValue` | `unknown` | — | 否 | 当前激活的标签页键 |
| `type` | `string` | — | 否 | 标签页视觉类型 |
| `allowClose` | `boolean` | `false` | 否 | 是否允许关闭标签页 |

## Events

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `update:modelValue` | `string \| number` | 更新后的标签页键 |
| `change` | `string \| number` | 标签页变更 |
| `close` | `void` |  |

## Slots

- `default`

## 用法

```vue
<template>
  <VTab />
</template>

<script setup lang="ts">
import { VTab } from '@vima-tech/ui-admin';
</script>
```

## 用法约束（本地补充，非生成内容）

> 本节由 Sustain 逐页体检实测补入（2026-08-14），**不是**上游 api.generated.json 的产物。
> 组件库升级后重新生成本文档时要把这段补回来，否则同一个坑会再踩一遍。

**VTab 只是切换器，内容不要放进 `VTabItem` 的默认插槽。**

三种视觉类型（留空下划线 / `card` / `segment`）共用同一套 DOM：
`.vui-tabs > .vui-tab-item > .vui-tab-title`。其中 `.vui-tabs` 是一条
`display: flex; overflow: auto` 的**横向标题条**，而 `.vui-tab-content`
虽然会被渲染出来，**全套样式表里没有任何一条规则**。

所以内容放进插槽时，激活项会被撑成内容那么宽，把后面的标题一起顶出可视区——
只是"能横向滚动标题条"，不会报错也不会有红字，很容易被当成设计如此。
实测：诊疗流程页九步里五步被顶出视口（激活项 1025px，标题条溢出 445px），
患者档案页八个页签溢出 204px。

正确写法（本项目 `basedata/meal`、`nutrition/visit-records`、
`workflow/steps/dietSurvey` 均如此）：

```vue
<VTab v-model="activeKey">
  <VTabItem v-for="t in TABS" :id="t.key" :key="t.key" :title="t.label">
    <div />
  </VTabItem>
</VTab>

<!-- 面板内容放在 VTab 之后，自行按 activeKey 切换 -->
<div class="xx-tab-panel">
  <template v-if="activeKey === 'a'">…</template>
  <template v-else-if="activeKey === 'b'">…</template>
</div>
```
