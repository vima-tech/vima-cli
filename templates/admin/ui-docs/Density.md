# 密度档（A27 · `compact / default / loose`）

> 「刻度的语义」：36 种间距的病根不是自由，是找不到语义档。
> 密度类只重定义 `--v-gap-*` 一族，作用域内一切引用它的取值整体变。

| 档 | 类 | 用在哪（推荐对照，PDL 的 `design.density` 落到容器上） |
|---|---|---|
| compact | `.vui-density-compact` | 密集数据表、监控墙、工作台侧栏 |
| default | （不加类） | 录入表单、常规列表 |
| loose | `.vui-density-loose` | 只读详情、宣讲/结果页 |

## 用法

```html
<!-- 页面级：design.density: compact → 页面根加类 -->
<div class="vui-page vui-density-compact" data-page="PAGE-07">…</div>

<!-- 块级：某一列单独紧凑 -->
<aside class="vui-aside vui-density-compact">…</aside>
```

## 纪律

- **页面样式不写裸间距**：`gap/padding/margin` 一律 `var(--v-gap-*)`（post-write 拦裸 px）。
  想「再紧一点」的正确动作是换密度档，不是写 `10px`。
- ActionGroup 的可见容量随密度档变（compact 2 / default 3 / loose 4）——
  同一份声明在不同密度下自动收纳，这正是「密度是语义」的含义。
