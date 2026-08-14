# VmPage · 页面骨架

> 类：`vm-page` `vm-body` `vm-sheet`

## 用途

每个页面最外层都是 `vm-page`——令牌挂在它身上，换肤与适老化才有作用域。
内容区二选一：**有主视觉**用 `vm-sheet`（上翻圆角压住 hero 底边），**没有**用 `vm-body`。

## 结构

```html
<!-- 有主视觉（首页、入口页） -->
<view class="vm-page" data-page="PAGE-01">
  <view class="vm-hero">…</view>
  <view class="vm-sheet">…</view>
</view>

<!-- 无主视觉（列表页、表单页、详情页——大多数页面） -->
<view class="vm-page" data-page="PAGE-07">
  <view class="vm-body">…</view>
</view>
```

适老化：根节点拼上 `vm-aging` 即可，全站字阶与控件高一起放大。

```html
<view class="vm-page {{aging ? 'vm-aging' : ''}}">
```

## 不要这样用

- **不要两个内容区并存**（`vm-sheet` + `vm-body`）：`vm-sheet` 自带 `margin-top: -22px`，
  没有 hero 在上面时会把自己顶出页面。
- **不要在 `vm-page` 上写 `padding`**：左右留白归 `vm-body` / `vm-sheet`，
  写在页面根上会让 hero 的整幅背景缩进去，露出两条底色边。
- 页面根一定要带 `data-page="PAGE-xx"`（业务页），`post-write` 靠它做区块对账。

## H5 端差异（重要，与小程序端不同）

**`vm-page` 在 `App.vue` 根上，页面组件从 `vm-body` / `vm-sheet` 写起**——
令牌作用域挂在 `vm-page`，而 `VmToast` / `VmDialog` 这些全局组件在 `<router-view>` 之外，
必须与页面处在同一作用域内；页面里再套一层就成了两个页面容器（背景画两遍、
`min-height` 叠加出多余滚动）。

```html
<!-- App.vue（骨架已写好，不用改） -->
<div class="vm-page" :class="{ 'vm-aging': aging }">
  <router-view />
  <VmTabbar … /><VmToast /><VmDialog />
</div>

<!-- 业务页面：从内容区开始 -->
<template>
  <VmNavbar title="随访详情" show-back />
  <div class="vm-body" data-page="PAGE-07">…</div>
</template>
```

`post-write` 对两端各查各的：小程序查 `.wxml` 根是否有 `vm-page`，H5 查 `.vue` 根是否有
`vm-body` / `vm-sheet`。
