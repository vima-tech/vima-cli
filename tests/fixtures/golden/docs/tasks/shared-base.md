---
taskId: shared-base
title: 共享基础层（请求封装、全局类型、基础布局）
status: done
layer: shared
side: fullstack
dependsOn: []
retryCount: 0
updatedAt: 2026-08-12T10:00:00Z
---

# 共享基础层

## 任务目标

搭建前后端共享基础设施：前端请求封装（统一错误处理）、全局类型定义、基础布局组件；
后端 common 模块（ApiResponse 包装、全局 ExceptionHandler、分页工具）。
本任务是全部业务任务的前置（批次 0，串行）。

## 业务规则

- 前端所有请求统一经 request 封装，错误码在封装层统一转提示；
- 后端所有接口返回 ApiResponse 包装，错误码经全局 ExceptionHandler 输出。

## 验收清单

- [x] 前端 request 封装可用，统一错误处理生效
- [x] 全局类型与基础布局组件就绪
- [x] 后端 ApiResponse / ExceptionHandler / 分页工具就绪
- [x] npm run build:check 与 mvn -q compile 通过

## 约束重申

- 本任务产出即共享层：业务任务对其只读；后续变更走 sharedChangeRequest 串行补偿。

## 维护须知

- 前端请求封装：src/utils/request.ts；全局类型：src/types/
- 后端公共模块：backend/src/main/java/demo/common/
