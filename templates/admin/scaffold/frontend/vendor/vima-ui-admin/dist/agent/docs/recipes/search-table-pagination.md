# Recipe：search-table-pagination

## 适用与边界

用于可查询、排序、分页的数据集合。一次性小型静态列表不必增加分页。

## 数据契约

- 查询模型：字段值、`page`、`pageSize`。
- 响应：`rows`、`total`、`loading`、`error`。
- 每行必须有稳定 `rowKey`；列使用 `columns[{ key, title }]`。

## 结构与交互

查询条件放第一个 `VCard`，结果表格和 `VPagination` 放最后一个 `VCard`。查询、重置、翻页和排序均通过数据 Adapter 触发；改变筛选条件后页码回到 1。

## 状态与质量

- loading：展示 `VLoading`，禁止重复提交。
- empty：展示 `VEmpty`，保留查询条件。
- error：展示 `VAlert` 和重试动作。
- permission：隐藏未授权的批量操作，不伪装成 disabled。
- 测试筛选、重置、排序、分页、空状态、错误重试、表格内部滚动和窄屏溢出。

## 产物示例与交付等级

`examples/search-table-pagination.json` 是 CrudPageSpec，使用 `buildCrudPage` 生成查询、表格和状态结构。交付等级为 `scaffold`；查询、翻页、排序和重试必须由数据 Adapter 集成后验收。

## 响应式与可访问性

390px 窄屏下页面本身不水平溢出，表格内部保留滚动；查询、重置、分页和批量动作均可键盘触达并有可读名称。
