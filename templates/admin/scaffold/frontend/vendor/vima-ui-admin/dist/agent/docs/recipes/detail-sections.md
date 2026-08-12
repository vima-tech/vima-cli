# Recipe：detail-sections

## 适用与边界

用于只读实体详情。需要编辑时提供明确编辑入口，不把只读值伪装成 disabled 输入框。

## 数据契约

- `record`：实体对象。
- `fields[]`：稳定 key、label、显示格式和权限。
- 空值统一显示 `—`，日期和枚举在进入视图前格式化。

## 结构与交互

调用 `buildDetailPage`，使用 `VCard → VDescriptions → VDescriptionsItem`。相关字段按业务区块分组；返回、编辑、审计等操作放卡片 extra 区域。

## 状态与质量

- loading：骨架保持最终布局尺寸。
- not-found：使用 `VEmpty` 并提供返回动作。
- error：使用 `VAlert` 和重试动作。
- 测试字段权限、空值、长文本换行、日期格式、窄屏列数和操作键盘可达。

## 产物示例与交付等级

`examples/detail-sections.json` 是 DetailPageSpec，使用 `buildDetailPage` 生成语义化详情结构。交付等级为 `scaffold`；详情加载、not-found、重试和字段权限仍需集成。

## 响应式与可访问性

窄屏用单列且允许长值换行；标签先于值出现在 DOM 中，缺失值使用可读占位而不是空白。
