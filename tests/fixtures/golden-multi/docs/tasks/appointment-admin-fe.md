---
taskId: appointment-admin-fe
title: 预约管理页（admin 端）
status: pending
layer: business
side: frontend
app: admin
dependsOn: [shared-admin-base, appointment-be]
retryCount: 0
contract: docs/contracts/appointment-api.md
page: PAGE-01
updatedAt: 2026-08-13T10:00:00Z
---

# 预约管理页（admin 端）

> 页面结构以 spec PAGE-01 数据块与原型为准（单一真源 A2），本文件不重复描述布局。

## 数据接口

以契约为准；本页接口即 spec PAGE-01 的 apis：GET /api/admin/appointment/list、
POST /api/admin/appointment/audit。

## 验收清单

- [ ] 区块与 PAGE-01 layout 一致（search/toolbar/table/pagination）
- [ ] 表格列与契约 list 响应字段一致
- [ ] 审核通过走 POST /api/admin/appointment/audit（RULE-02 错误码提示）
- [ ] npm run build:check 通过
