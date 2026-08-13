---
taskId: full-link-test
title: 跨端联调（患者提交 → 后台审核）
status: pending
layer: pipeline
side: fullstack
app: admin
dependsOn: [appointment-admin-fe, appointment-patient-fe]
retryCount: 0
contract: docs/contracts/appointment-api.md
updatedAt: 2026-08-13T10:00:00Z
---

# 跨端联调

走通 FLOW-01：患者端提交预约 → 后台列表可见 → 审核通过 → 患者端状态更新。

## 验收清单

- [ ] FLOW-01 两步全链路走通
- [ ] 前后端错误码提示与契约一致
