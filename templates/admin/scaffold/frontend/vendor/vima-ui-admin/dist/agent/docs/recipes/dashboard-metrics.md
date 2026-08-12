# Recipe：dashboard-metrics

## 适用与边界

用于展示关键指标和趋势概览，不代替可筛选的分析报表。

## 数据契约

- `metrics`：按稳定 key 提供数字或短文本值。
- 指标定义包含 label、prefix、suffix；趋势和时间范围必须明确来源。
- 不同单位不得放在同一无标签序列中。

## 结构与交互

调用 `buildDashboardPage` 生成 `VRow/VCol/VStatistic`。筛选器位于指标区之前；图表等扩展块只在 Manifest 存在相应 Module 后加入。

## 状态与质量

- loading：每个指标卡独立骨架。
- partial-error：保留成功指标，并标注失败项。
- empty：说明统计口径内没有数据。
- 测试数字格式、单位、刷新、部分失败、四列到单列响应式和读屏顺序。

## 产物示例与交付等级

`examples/dashboard-metrics.json` 是 DashboardPageSpec，使用 `buildDashboardPage` 生成稳定指标栅格。交付等级为 `scaffold`；动态指标加载、刷新和部分失败仍需集成。

## 响应式与可访问性

桌面最多四列、390px 窄屏单列；指标标题与值的 DOM 顺序不随视觉排列改变，不仅用颜色表达好坏。
