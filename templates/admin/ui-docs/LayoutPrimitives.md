# 版面原语（A27 · 骨架 `src/styles/layout.css`）

> 与 PDL 的 `design.pattern` 一一对应；业务页**不再自写整页 grid**——
> 需要的形态先看这里，没有再走 sharedChangeRequest 收编进真源。

| pattern（PDL） | 类 | 形态 | 可覆盖变量 |
|---|---|---|---|
| （两栏主次） | `.vui-layout-split` | 主内容 1fr + sticky 侧栏 | `--v-split-aside`（默认 320px） |
| `master-detail` | `.vui-layout-master` | 左列表 + 右详情 | `--v-master-list`（默认 260px） |
| `workbench` | `.vui-layout-workbench` | 左定宽 / 中 1fr / 右定宽 三列 | `--v-wb-left` 264px、`--v-wb-right` 224px |
| `board` | `.vui-layout-board` | auto-fill 卡片墙 | `--v-board-min`（默认 260px） |
| `list` / `detail` / `form` | 无需版面类 | 单列流（`vui-page` 本身） | — |

## 用法

```html
<div class="vui-page" data-page="PAGE-09">
  <div class="vui-layout-workbench">
    <section><!-- 待办 --></section>
    <section><!-- 主工作区 --></section>
    <aside class="vui-aside"><!-- 实时指标 --></aside>
  </div>
</div>
```

- 列宽覆盖走变量，不改 `grid-template-columns`：
  `style="--v-wb-right: 280px"`。
- 窄屏（≤960px）自动塌单列，页面不用各写各的断点。
- sticky 侧栏用 `.vui-aside`（在 `.vui-layout-split` 里自动 sticky）。

## 不要这样用

- **不要在页面里重写整页 grid**——20 个页面各写各的 grid 正是「凌乱」的来源之一。
- **不要嵌套版面原语**（split 里再放 workbench）：两级结构 A14 已论证够用，
  更复杂的形态先回 spec 层想清楚它到底是什么。
