# 需求覆盖矩阵

原始需求→接口→契约→任务 四列对齐；空单元格或 TODO 即缺口（V-COV-01），本矩阵无缺口。

| 原始需求（来源 docs/raw/） | 承接接口 | 承接契约 | 承接任务 |
|---------------------------|---------|---------|---------|
| 设备可按名称/状态搜索并分页查看（需求纪要.md 第 1 条） | GET /api/device/list | docs/contracts/device-api.md | device-api-be, device-list-fe |
| 支持新增设备，名称 2-50 字符、类型枚举校验（需求纪要.md 第 2 条） | POST /api/device | docs/contracts/device-api.md | device-api-be, device-list-fe |
| 支持批量删除，一次最多 100 条，维护中设备禁删（会议记录.md 第 3 节） | POST /api/device/batch-delete | docs/contracts/device-api.md | device-api-be, device-list-fe |
| 可查看单台设备完整信息（需求纪要.md 第 4 条） | GET /api/device/detail | docs/contracts/device-api.md | device-api-be, full-test |
