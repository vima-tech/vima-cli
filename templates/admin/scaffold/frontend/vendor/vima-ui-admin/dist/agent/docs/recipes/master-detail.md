# Recipe：master-detail

## 适用与边界

用于选择一个主实体后查看其明细集合，例如组织与成员。两个实体需要独立导航历史时改成两个路由页面。

## 数据契约

- `masters`：主实体集合和稳定主键。
- `selectedMasterId`：当前选择。
- `details`：仅属于当前主实体的明细集合。
- 主实体变化必须取消或忽略上一请求的迟到响应。

## 结构与交互

宽屏使用左右 `VRow/VCol`，窄屏改为上下结构。主区使用 `VTable` 或 `VTree`，从区复用 `search-table-pagination`；未选择主实体时从区展示 `VEmpty`。

## 状态与质量

- 主区和从区 loading/error 独立。
- 删除当前主实体后清空从区并选择可用项。
- 测试快速切换竞态、空主列表、空从列表、权限差异、键盘选择和窄屏顺序。

## 产物示例与交付等级

`examples/master-detail.json` 是 AppSpec v1，使用 `createArtifactPlan` 生成列表与详情两个稳定路由。交付等级为 `scaffold`；主从选择、请求竞态和权限差异仍需集成。

## 响应式与可访问性

窄屏改为先主后从的路由导航；主项选中状态使用 `aria-current` 或等价语义，详情更新后不意外丢失焦点。
