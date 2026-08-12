---
taskId: example-list-fe
title: 示例列表页（前端）
status: pending
layer: business
side: frontend
dependsOn: [shared-base]
retryCount: 0
contract: docs/contracts/example-api.md
page: PAGE-01
updatedAt: 2026-01-01T00:00:00Z
---

<!--
  前端任务模板（复制为 docs/tasks/<taskId>.md 后填充；本文件 _ 前缀，不参与调度）。
  frontmatter 填写规则（契约 §6.1）：
  - taskId：^[a-z0-9][a-z0-9-]*$，前端页面任务建议 <模块>-<页面>-fe；
  - status 初始一律 pending；retryCount 初始 0；
  - layer=business / side=frontend；dependsOn 按评审确认的依赖策略填
    （默认 [shared-base, <对应后端任务>]；契约先行并行开发时只填 [shared-base]）；
  - contract：必填，指向本模块契约文件；
  - page：必填，指向本页在 spec 中的 PAGE-xx 数据块；
  - conflictsWith：可选（A8），与本任务共享代码路径（同文件/同目录改动）的其他任务 ID，
    vima plan 会保证它们不排进同一并行批；
  - updatedAt：写盘时的真实 ISO 时间。
-->

# 示例列表页

> **页面结构以 spec 中 `page:` 引用的数据块与线框原型（docs/review/prototype.html）为准**，
> 本文件不重复描述布局、组件与交互（单一真源 A2，机检 V-TASK-05）。
> 开工前先读：本页 `vima:page` 数据块 → 契约文件 → 共享层 CAPABILITY.md。

## 任务目标

<!-- 一段话：本任务交付什么页面、覆盖哪些功能点（对应 spec 菜单 features）、完成的判定标准。 -->

## 数据接口

以 frontmatter `contract` 指向的契约文件为准，**禁止自行定义接口路径、参数或响应字段**。
本页用到的接口即 spec 中本页 `apis` 列表；请求/响应字段以契约 YAML 块为唯一来源。
若开发中发现契约缺失或有误：停下，声明变更请求，**不得直接改契约**（并行批次纪律 §9.5）。

## 业务规则

<!-- 从 spec 第五章摘取与本页相关的规则：校验规则（含边界值）、状态流转、交互约束。
     只摘取，不新增；规则冲突回 spec 澄清。 -->

## 验收清单

<!-- 每条可机械核对；至少覆盖：区块齐全、接口对接、校验规则、异常反馈。
     覆盖度纪律（V-TASK-07）：复选框数不得少于本页任务点数
     （spec 页面块的每个交互 [items 带 action + rowActions] 与每个弹窗字段）。 -->

- [ ] 页面区块与 spec 本页 layout 顺序一致
- [ ] 区块标记齐全：根组件含 data-page，各区块容器含 data-block，弹窗含 data-modal
      （与 prototype.manifest.json 一致，post-write hook 机检）
- [ ] 列表/表单与契约响应字段一致，分页可用
- [ ] 业务规则校验生效（含边界值与错误提示）
- [ ] npm run build:check 通过

## 开发步骤

1. 生成页面骨架（src/views/<PageName>/）——根组件模板写入 `data-page="<本任务 page 值>"`，
   并为每个 layout 区块预置带 `data-block="<词>"` 的容器元素（§13.3 机械对账标记）；
2. 实现 API 层（src/api/<module>.ts，严格按契约）；
3. 实现类型定义（共享类型引自契约，不重复手写）；
4. 实现组件层（对照本页 `vima:page` 数据块与原型；组件已全局注册无需 import，
   先读 CAPABILITY.md 再读组件文档；弹窗挂载点带 `data-modal="MODAL-xx"`）；
5. 实现业务逻辑（搜索、表单验证、错误处理）；
6. **代码级追溯（A1）**：本任务产出的每个业务代码文件头部加注释 `// @vima <taskId>`
   （如 `// @vima example-list-fe`），`vima trace` 据此对账；
7. 自检：对照验收清单逐项核对 + npm run build:check。

## 约束重申

- 禁止修改 src/components/、src/utils/、vendor/（**共享层只读**）；
- 若确需修改共享层，在结果摘要中声明 `sharedChangeRequest`（原因 + 期望改动 + 影响面），
  由主 Agent 走串行补偿批次处理（§10.7），**不得直接改**；
- 禁止修改契约文件与其他任务的文件。

## 维护须知

<!-- 完工时补齐：本页关键文件索引（API 封装/列定义/表单/路由注册位置），
     以及常见维护动作入口（如「新增列：在 columns.ts 追加列定义」）。 -->
