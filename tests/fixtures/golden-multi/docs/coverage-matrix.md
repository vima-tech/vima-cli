# 需求覆盖矩阵

> 本文件由 `vima render-matrix` 从 spec 页面块 / 契约 apis / 任务 frontmatter 确定性生成，
> **不要手改**——改了会在下次生成时被覆盖，也会让 `vima doctor` 的漂移检查报警。
> 口径：端 → 页面（需求） → 接口 → 契约 → 承接任务。V-COV-01 要求任何数据行都不得有空单元格。

| 端 | 需求 | 接口 | 契约 | 任务 |
|---|---|---|---|---|
| admin | 预约管理（PAGE-01） | 2 个接口 | docs/contracts/appointment-api.md | appointment-admin-fe / appointment-be / full-link-test |
| patient | 预约挂号（PAGE-11） | 1 个接口 | docs/contracts/appointment-api.md | appointment-be / appointment-patient-fe / full-link-test |
| patient | 我的预约（PAGE-12） | 1 个接口 | docs/contracts/appointment-api.md | appointment-be / full-link-test |

合计：3 个页面 / 4 条页面接口引用 / 1 份契约 / 5 个任务。
