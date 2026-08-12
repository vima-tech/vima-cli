---
taskId: device-list-fe
title: 设备管理列表页（前端）
status: pending
layer: business
side: frontend
dependsOn: [shared-base, device-api-be]
retryCount: 0
contract: docs/contracts/device-api.md
page: PAGE-01
updatedAt: 2026-08-12T10:00:00Z
---

# 设备管理列表页

> **页面结构以 spec 中 `page: PAGE-01` 引用的数据块与线框原型（docs/review/prototype.html）为准**，
> 本文件不重复描述布局、组件与交互（单一真源 A2）。
> 开工前先读：spec PAGE-01 的 `vima:page` 数据块 → docs/contracts/device-api.md → CAPABILITY.md。

## 任务目标

交付设备列表页：按名称/状态搜索并分页浏览设备，弹窗新增/编辑设备（MODAL-01），
批量删除，行内跳转设备详情页。覆盖 MENU-01 全部功能点。

## 数据接口

以 docs/contracts/device-api.md 为准，禁止自行定义接口路径、参数或响应字段。
本页接口即 spec PAGE-01 的 apis 列表：GET /api/device/list、POST /api/device、
POST /api/device/batch-delete。字段以契约 YAML 块为唯一来源。

## 业务规则

- 设备名称必填，长度 2-50 字符（表单前端校验 + 后端 40001 提示）；
- 删除前需二次确认（使用 confirmAsync）；
- 批量删除最多 100 条，超出前端拦截提示。

## 验收清单

- [ ] 页面区块与 spec PAGE-01 layout 顺序一致（search/toolbar/table/pagination）
- [ ] 表格列与契约 GET /api/device/list 响应字段一致，分页功能正常
- [ ] 新增/编辑弹窗（MODAL-01）表单完整，提交走 POST /api/device
- [ ] 删除需二次确认，批量删除超过 100 条被拦截
- [ ] 行内详情跳转 PAGE-02 路由正确
- [ ] npm run build:check 与 npm run lint 通过

## 开发步骤

1. 生成页面骨架（src/views/DeviceList/）；
2. 实现 API 层（src/api/device.ts，严格按契约）；
3. 实现类型定义（src/views/DeviceList/types.ts，共享类型引自契约）；
4. 实现组件层（对照 PAGE-01 数据块与原型；使用 @vima/ui，先读 CAPABILITY.md）；
5. 实现业务逻辑（搜索、表单验证、错误处理）；
6. 代码级追溯（A1）：每个业务代码文件头部加注释 `// @vima device-list-fe`；
7. 自检：对照验收清单 + npm run build:check + npm run lint。

## 约束重申

- 禁止修改 src/components/、src/utils/、vendor/（共享层只读）；
- 若确需修改共享层，在结果摘要中声明 sharedChangeRequest，不得直接改；
- 禁止修改契约文件与其他任务的文件。

## 维护须知

- API 封装：src/api/device.ts
- 表格列定义：src/views/DeviceList/columns.ts
- 新增列：先改契约响应字段，重渲染原型，再在 columns.ts 追加列定义。
