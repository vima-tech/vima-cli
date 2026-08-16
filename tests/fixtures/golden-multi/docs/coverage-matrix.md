# 需求覆盖矩阵

> 本文件由 `vima render-matrix` 从 spec 页面块 / 业务规则块 / 契约 apis / 任务 frontmatter
> 确定性生成，**不要手改**——改了会在下次生成时被覆盖，也会让 `vima doctor` 的漂移检查报警。
> V-COV-01（error）逐表校验列数与空单元格；V-COV-02（warn）点名末列为「—」的未承接行。

## 页面承接

> 口径：端 → 页面（需求） → 接口 → 契约 → 承接任务。

| 端 | 需求 | 接口 | 契约 | 任务 |
|---|---|---|---|---|
| admin | 预约管理（PAGE-01） | 2 个接口 | docs/contracts/appointment-api.md | appointment-admin-fe / appointment-be / full-link-test |
| patient | 预约挂号（PAGE-11） | 1 个接口 | docs/contracts/appointment-api.md | appointment-be / appointment-patient-fe / full-link-test |
| patient | 我的预约（PAGE-12） | 1 个接口 | docs/contracts/appointment-api.md | appointment-be / full-link-test |

合计：3 个页面 / 4 条页面接口引用 / 1 份契约 / 5 个任务。

## 业务规则承接

> 口径：规则（spec 第五章 `vima:rules`） → 接口 → 承接任务。承接关系与 `vima context`
> 注入任务上下文时用的是同一个判定（`rulesForTask`）：无 `apis` 的规则为全局规则，
> 注入全部任务、按定义不构成缺口；声明了 `apis` 的规则须与某个任务的接口集有交集。

| 规则 | 类型 | 实体 | 接口 | 承接任务 |
|---|---|---|---|---|
| 患者姓名必填且长度 2-20 字符，违者返回 40001（RULE-01） | validation | Appointment | 1 个接口 | appointment-admin-fe / appointment-be / appointment-patient-fe / full-link-test |
| 仅 status=待审核 的预约可审核通过，违者返回 40002（RULE-02） | transition | Appointment | 1 个接口 | appointment-admin-fe / appointment-be / appointment-patient-fe / full-link-test |
| 同一患者同一天最多一条预约，违者返回 40003（RULE-03） | constraint | Appointment | 全局（不限接口） | 全局（注入全部任务上下文） |

合计：3 条规则，其中全局规则 1 条。
