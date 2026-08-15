# 领域组件层（A34 D-A34-09）

本目录按业务域放**领域交互组件**：`<domain>/components/`。

它与上一层 `src/components/` 的分工：

| 目录 | 归谁 | 谁能写 |
|---|---|---|
| `src/components/` | 框架层 + 项目级设计系统 | **业务任务只读**（在 `sharedDirs` 内，写保护 hook 拦） |
| `src/features/<domain>/components/` | 领域 | **领域级 shared task 写**，页面任务只读消费 |

为什么要有这一层：旧版 Sustain 里 `PatientContextBar` 被 8 个页面共用、
患者工作站外壳让两条路由共用左右栏做到切换零闪断——这类**跨页领域结构**，
在「每个页面任务只能写自己目录」的边界下**结构上不可能产生**。
没有这一层，项目永远只能消费模板组件，长不出产品辨识度。

## 纪律

- 页面任务**不自己建**领域组件。发现某个结构该被多页共用时，
  在结果摘要里提 `componentExtractionRequest`（要抽什么、哪几页会用、为什么该共用），
  由领域级 shared task 或补偿批统一创建——否则并行批次里同一个组件会被建出好几份。
- 本目录**不进** `template.json` 的 `apps[].sharedDirs`：进了它，领域 shared task 自己也写不了。
- 组件命名按域归拢（`features/order/components/OrderContextBar.vue`），
  跨域复用的先上收到 `src/components/`。
