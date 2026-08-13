---
taskId: appointment-be
title: 预约模块（后端）
status: pending
layer: business
side: backend
dependsOn: []
retryCount: 0
contract: docs/contracts/appointment-api.md
updatedAt: 2026-08-13T10:00:00Z
---

# 预约模块（后端）

按契约实现预约模块 4 个接口（admin 2 个 + patient 2 个），规则 RULE-01/02/03。

## 验收清单

- [ ] GET /api/admin/appointment/list 按契约实现
- [ ] POST /api/admin/appointment/audit 按契约实现（RULE-02）
- [ ] POST /api/app/appointment 按契约实现（RULE-01/RULE-03）
- [ ] GET /api/app/appointment/mine 按契约实现
- [ ] mvn -q test 通过
