# Recipe：crud-dialog

## 适用与边界

用于列表中快速新增和编辑单个实体。字段很多、存在长流程或需要独立 URL 时改用 `form-create-edit`。

## 数据契约

- 列表契约沿用 `search-table-pagination`。
- 表单字段显式提供 `required`、类型、格式、选项和校验。
- 保存 Adapter 返回已保存实体或结构化错误。

## 结构与交互

列表使用 `buildCrudPage`。新增和编辑动作打开 `VLayer`，表单使用 `buildFormPage`；编辑前复制行数据，取消时丢弃草稿。删除使用 `layer.confirm`，成功后刷新当前页。

## 状态与质量

- 保存中锁定提交按钮，失败时保留用户输入。
- 删除最后一行后若当前页为空，回退到上一页。
- 权限不足时不生成新增、编辑或删除入口。
- 测试新增、编辑、取消、删除确认、保存失败、重复提交和焦点返回。

## 产物示例与交付等级

`examples/crud-dialog.json` 是 CrudPageSpec，使用 `buildCrudPage` 生成列表和操作结构。交付等级为 `scaffold`；新增、编辑、删除确认、权限和保存 Adapter 尚未集成，不得称为可运行 CRUD。

## 响应式与可访问性

窄屏改用全屏 Drawer 或独立表单路由；弹层打开后聚焦标题或首个字段，关闭后将焦点返回触发按钮。
