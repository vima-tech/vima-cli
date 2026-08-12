---
taskId: device-api-be
title: 设备管理后端接口
status: pending
layer: business
side: backend
dependsOn: [shared-base]
retryCount: 0
contract: docs/contracts/device-api.md
updatedAt: 2026-08-12T10:00:00Z
---

# 设备管理后端接口

> 开工前先读：docs/contracts/device-api.md（唯一事实来源）→ 共享基础设施说明
> （config/security 包、ApiResponse 包装、全局异常处理）。

## 任务目标

实现设备契约模块的全部 4 个接口（列表查询/新增/批量删除/详情），
路径、参数、响应、错误码与契约完全一致，Service 层核心规则有单元测试。

## 模块结构

- Entity：Device（对应 device 表）
- Repository：DeviceRepository（JPA）
- Service：DeviceService / DeviceServiceImpl
- Controller：DeviceController（路径严格按契约）
- DTO：DeviceCreateDTO / DeviceQueryDTO

## 实现要求

- 所有接口路径、参数、响应结构以 docs/contracts/device-api.md 为准，逐条对齐；
- 返回值统一使用 ApiResponse 包装；
- 参数校验使用 jakarta.validation 注解（name: @NotBlank @Size(min=2, max=50)）；
- 异常通过全局 ExceptionHandler 转换为契约定义的错误码。

## 业务规则

- type 枚举校验：sensor/actuator/gateway（违反返回 40001）；
- 批量删除最多 100 条，超出返回 40002；
- 删除前校验设备状态，维护中设备禁止删除（40003）；
- 查询不存在的设备返回 40004。

## 验收清单

- [ ] Controller 路径与契约完全一致
- [ ] 参数校验注解完整（边界值与契约一致）
- [ ] 错误码与契约一致（40001/40002/40003/40004）
- [ ] Service 层单元测试覆盖核心业务规则
- [ ] mvn -q compile 与 mvn -q test 通过

## 开发步骤

1. Entity + Repository；
2. DTO + 校验注解；
3. Service 层（业务规则实现）；
4. Controller 层（严格按契约）；
5. 单元测试（Service 层核心规则）；
6. 代码级追溯（A1）：每个业务代码文件头部加注释 `// @vima device-api-be`；
7. 自检：对照验收清单 + mvn -q compile + mvn -q test。

## 约束重申

- 禁止修改公共基础设施模块（config/security 包只读）；
- 若确需修改，在结果摘要中声明 sharedChangeRequest，不得直接改；
- 禁止修改契约文件与其他任务的文件。

## 维护须知

- Controller：backend/src/main/java/demo/DeviceController.java
- 新增接口：先改契约 docs/contracts/device-api.md，再改任务，最后改代码。
