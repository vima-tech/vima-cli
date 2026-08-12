# Recipe：form-create-edit

## 适用与边界

用于独立创建或编辑页面。简单的列表内短表单优先使用 `crud-dialog`。

## 数据契约

每个 `FieldSpec` 必须提供稳定 `key`、`label` 和 `dataType`。业务必填使用 `required: true` 明示；枚举字段必须提供 `options`；日期范围使用 `dataType: date`、`cardinality: tuple`、`format: date-range`。`validation` 支持可序列化的 `required/min/max/pattern`，非 required 规则必须提供合法 `value`，不得塞入函数字符串。

## 结构与交互

调用 `buildFormPage`。数据加载完成后再写入模型；提交前调用表单校验；成功后提示并导航，失败时把字段错误映射回对应 `VFormItem`。

## 状态与质量

- loading：使用 `VSkeleton` 或 `VLoading`。
- disabled：仅用于无权修改但允许查看的字段。
- error：保留草稿并聚焦第一个错误字段。
- 测试初值、必填、枚举、日期、文件、提交失败、离开确认和键盘提交。

## 产物示例与交付等级

`examples/form-create-edit.json` 是 FormPageSpec，使用 `buildFormPage` 生成可校验 Template。交付等级为 `scaffold`；提交、服务端字段错误和导航结果仍需集成。

## 响应式与可访问性

390px 窄屏下 label 与控件改为单列；每个输入必须由 `VFormItem` 提供可读 label，校验失败时焦点转到第一个错误字段。
