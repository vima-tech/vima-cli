---
taskId: example-api-be
title: 示例模块后端接口
status: pending
layer: business
side: backend
dependsOn: [shared-base]
retryCount: 0
contract: docs/contracts/example-api.md
updatedAt: 2026-01-01T00:00:00Z
---

<!--
  后端任务模板（复制为 docs/tasks/<taskId>.md 后填充；本文件 _ 前缀，不参与调度）。
  frontmatter 填写规则（契约 §6.1）：
  - taskId：^[a-z0-9][a-z0-9-]*$，后端模块任务建议 <模块>-api-be；
  - status 初始一律 pending；retryCount 初始 0；
  - layer=business / side=backend；dependsOn 通常为 [shared-base]；
  - contract：必填，指向本模块契约文件；
  - updatedAt：写盘时的真实 ISO 时间。
-->

# 示例模块后端接口

> 开工前先读：frontmatter `contract` 指向的契约文件（唯一事实来源）→ 共享基础设施说明
> （config/security 包、ApiResponse 包装、全局异常处理）。

## 任务目标

<!-- 一段话：本任务实现哪个契约模块的全部接口，完成的判定标准（编译过、单测过、路径与契约一致）。 -->

## 模块结构

<!-- 按分层列出本模块要创建的类，替换 <Module> 为实际模块名： -->

- Entity：`<Module>`（对应 `<module>` 表）
- Repository：`<Module>Repository`（JPA）
- Service：`<Module>Service` / `<Module>ServiceImpl`
- Controller：`<Module>Controller`（路径严格按契约）
- DTO：`<Module>CreateDTO` / `<Module>UpdateDTO` / `<Module>QueryDTO`

## 实现要求

- 所有接口的**路径、参数、响应结构**以契约文件为准，逐条对齐，禁止自行增删改；
- 返回值统一使用 ApiResponse 包装；
- 参数校验使用 jakarta.validation 注解（校验边界取自契约与业务规则）；
- 异常通过全局 ExceptionHandler 转换为**契约定义的错误码**，错误码必须与契约一致；
- 若开发中发现契约缺失或有误：停下，声明变更请求，**不得直接改契约**（并行批次纪律 §9.5）。

## 业务规则

<!-- 从 spec 第五章摘取与本模块相关的规则：枚举校验、数量上限、状态约束及对应错误码。
     只摘取，不新增。 -->

## 验收清单

- [ ] Controller 路径与契约完全一致
- [ ] 参数校验注解完整（边界值与契约一致）
- [ ] 错误码与契约一致
- [ ] Service 层单元测试覆盖核心业务规则
- [ ] mvn -q compile 与 mvn -q test 通过

## 开发步骤

1. Entity + Repository；
2. DTO + 校验注解；
3. Service 层（业务规则实现）；
4. Controller 层（严格按契约）；
5. 单元测试（Service 层核心规则）；
6. **代码级追溯（A1）**：本任务产出的每个业务代码文件头部加注释 `// @vima <taskId>`
   （如 `// @vima example-api-be`），`vima trace` 据此对账；
7. 自检：对照验收清单逐项核对 + mvn -q compile + mvn -q test。

## 约束重申

- 禁止修改公共基础设施模块（**config/security 包只读**，同 template.json sharedDirs）；
- 若确需修改共享层，在结果摘要中声明 `sharedChangeRequest`（原因 + 期望改动 + 影响面），
  由主 Agent 走串行补偿批次处理（§10.7），**不得直接改**；
- 禁止修改契约文件与其他任务的文件。

## 维护须知

<!-- 完工时补齐：Entity/Controller 等关键文件路径索引；
     并写明「新增接口：先改契约 docs/contracts/<module>-api.md，再改任务，最后改代码」。 -->
