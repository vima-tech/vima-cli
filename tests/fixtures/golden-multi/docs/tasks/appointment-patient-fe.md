---
taskId: appointment-patient-fe
title: 预约挂号页（patient 端）
status: pending
layer: business
side: frontend
app: patient
dependsOn: [appointment-be]
retryCount: 0
contract: docs/contracts/appointment-api.md
page: PAGE-11
updatedAt: 2026-08-13T10:00:00Z
---

# 预约挂号页（patient 端）

> 页面结构以 spec PAGE-11 数据块与原型为准（单一真源 A2），本文件不重复描述布局。

## 数据接口

以契约为准；本端仅可调用 consumers 含 patient 的接口（A16 授权闭环）：
POST /api/app/appointment、GET /api/app/appointment/mine。

## 验收清单

- [ ] 区块与 PAGE-11 layout 一致（banner/form/actionbar）
- [ ] 提交预约走 POST /api/app/appointment（RULE-01 前端校验 + 40003 提示）
- [ ] 我的预约列表页（PAGE-12）交付，接口以契约 consumers=patient 授权集为准
- [ ] 小程序端零调用 /api/admin/**（越权由 V-CODE-01 机检）
