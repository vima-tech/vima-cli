# VmNavbar · 顶部导航栏（H5 专属组件）

> 组件：`<VmNavbar :title :show-back @back>`，插槽 `extra`
> 小程序端**不用它**：原生导航栏由 `app.json` 的 `navigationBarTitleText` 提供

## 用途

H5 没有系统导航栏，多级页面必须自带一条，否则用户不知道自己在哪、怎么回去。

## 结构

```html
<template>
  <div class="vm-page">
    <VmNavbar title="随访详情" show-back />
    <div class="vm-body">…</div>
  </div>
</template>
```

右侧动作用 `extra` 插槽：

```html
<VmNavbar title="随访记录" show-back>
  <template #extra><span class="vm-link" @click="onFilter">筛选</span></template>
</VmNavbar>
```

## 属性

| 名 | 类型 | 说明 |
|---|---|---|
| `title` | string | 标题，过长自动省略号 |
| `showBack` | boolean | 显示返回键；点击先 emit `back`，再 `history.back()` |

## 不要这样用

- **tab 主页面不要放返回键**：它们是导航栈的根，点了会退出应用。
- **不要在导航栏里塞两个以上动作**：右侧只留一个最重要的，其余收进页内。
