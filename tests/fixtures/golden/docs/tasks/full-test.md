---
taskId: full-test
title: 全量测试（收尾流水线）
status: pending
layer: pipeline
side: fullstack
dependsOn: [device-list-fe]
retryCount: 0
updatedAt: 2026-08-12T10:00:00Z
---

# 全量测试

## 任务目标

全部业务任务完成后串行执行的收尾流水线：前后端联调冒烟 + 全量构建与测试，
确认系统整体可构建、可启动、核心流程可走通。

## 执行内容

1. 前端全量构建：npm run build:check + npm run lint；
2. 后端全量编译与测试：mvn -q compile + mvn -q test；
3. 冒烟走查 FLOW-01 设备上架流程：新增设备 → 列表可见 → 进入详情核对字段。

## 验收清单

- [ ] npm run build:check 与 npm run lint 通过
- [ ] mvn -q compile 与 mvn -q test 通过
- [ ] FLOW-01 冒烟流程走通（新增 → 列表 → 详情）
- [ ] 契约 4 个接口联调响应结构与契约一致

## 约束重申

- 流水线任务只验证不新增功能；发现缺陷记录并回报主 Agent，不直接改业务任务的代码。
