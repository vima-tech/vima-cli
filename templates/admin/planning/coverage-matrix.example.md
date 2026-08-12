# 需求覆盖矩阵（示例）

<!--
  本文件是 docs/coverage-matrix.md 的编写示例（设计文档 §13.1）。
  作用：证明「没有需求被静默丢弃」——每条原始需求都能追到承接接口、契约与任务。
  评审时用户核对本矩阵；存在缺口行时禁止 vima approve。
-->

## 对齐表（原始需求 → 接口 → 契约 → 任务）

| 原始需求（来源 docs/raw/） | 承接接口 | 承接契约 | 承接任务 |
|---------------------------|---------|---------|---------|
| 设备可按名称/状态搜索并分页查看（需求纪要.md 第 1 条） | GET /api/device/list | docs/contracts/device-api.md | device-api-be, device-list-fe |
| 支持新增设备，名称 2-50 字符（需求纪要.md 第 2 条） | POST /api/device | docs/contracts/device-api.md | device-api-be, device-list-fe |
| 支持批量删除，一次最多 100 条（会议记录.md 第 3 节） | POST /api/device/batch-delete | docs/contracts/device-api.md | device-api-be, device-list-fe |

## 缺口标记规则

- **空单元格 = 缺口**：该需求在对应环节无承接（如只有接口没有任务）。
- **`TODO` = 缺口**：占位待补，尚未落实。
- 机检规则 **V-COV-01**（error）：表格 ≥3 列，任何数据行不得有空单元格或 `TODO`；
  机检入口 `vima validate`。
- 发现缺口的处置：回到 PLANNING 补齐对应契约/任务 → 更新本矩阵 → 重跑 `vima validate`。
  不允许删行了事——删除需求行必须先获用户确认并在 spec 第八章记录决策。

### 缺口行示例（真实矩阵中出现即校验失败，仅供识别形态）

| 原始需求（来源 docs/raw/） | 承接接口 | 承接契约 | 承接任务 |
|---------------------------|---------|---------|---------|
| 设备导出 Excel（需求纪要.md 第 4 条） | TODO | TODO | TODO |
