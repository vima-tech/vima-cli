---
taskId: shared-admin-base
title: admin 端共享层基座
status: pending
layer: shared
side: frontend
app: admin
dependsOn: []
retryCount: 0
updatedAt: 2026-08-13T10:00:00Z
---

# admin 端共享层基座

搭好 admin 端共享层（src/components / src/utils），业务任务只读消费。

## 验收清单

- [ ] src/utils/request.ts 请求门面就绪（request.get/post/put/delete/patch）
- [ ] 公共组件与工具通过 npm run build:check
