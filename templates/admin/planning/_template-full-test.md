---
taskId: full-test
title: 全量测试（收尾流水线）
status: pending
layer: pipeline
side: fullstack
dependsOn: []
retryCount: 0
updatedAt: 2026-01-01T00:00:00Z
---

<!--
  收尾流水线任务模板之一（A20；复制为 docs/tasks/full-test.md 后填充）。
  本文件 _ 前缀，不参与调度。

  为什么必须有：/go 的收口闸门在全部 business 任务 done 之后才跑，它的最后一步是
  派发 layer=pipeline 批次（全量测试 → 代码审计）。没有 pipeline 任务时，
  「流水线全部通过」的进阶条件恒真——全量测试与代码审计从未被执行过
  （V-TASK-13 warn / V-INT-05 error 就是查这件事）。

  frontmatter 填写规则（契约 §6.1）：
  - taskId 固定 full-test；layer=pipeline / side=fullstack；contract 可省（不对单一契约负责）；
  - dependsOn：**填全部 business 任务的 id**（拆解完成后回填），保证它排在最后一批；
  - status 初始 pending；retryCount 初始 0；updatedAt 为写盘时的真实 ISO 时间。

  执行纪律（设计 §10.3 场景二）：
  - 流水线任务只验证、不新增功能；发现缺陷记录并回报主 Agent，不直接改业务任务的代码；
  - 步骤间靠文件系统传递产出：测试结论落 .vima/reports/full-test-builder.json，
    下一步（code-audit）读它，不依赖会话上下文；
  - 上一步失败则 code-audit 不执行（失败阻断）。
-->

# 全量测试

## 任务目标

全部业务任务完成后串行执行的收尾流水线第一步：**把各批次分头产出的代码当成一个整体
跑一遍**——全量构建、全量测试、跨模块主流程冒烟，确认系统整体可构建、可启动、
核心流程可走通。单任务的 Builder/Verifier 只保证「自己那块对」，整体是否跑得通只有这里能答。

## 执行内容

<!-- 按项目实际命令填写；下列为 admin 模板骨架的默认命令 -->

1. **前端全量构建**：`npm run build:check`（tsc + vite build）与 `npm run lint`；
   多端项目逐端执行，任一端红即失败。
2. **后端全量编译与测试**：`./mvnw -o -q compile` 与 `./mvnw -o -q test`
   （骨架自带上下文冒烟测试：Bean 装配 / JPA 建表 / 种子数据跑不通即红）。
3. **接口联调核对**：按 `docs/contracts/*.md` 逐模块核对实际响应结构与契约一致
   （字段名、层级、分页包装、错误码）。
4. **主流程冒烟**：走通 spec 第五章声明的每条 `FLOW-xx`（逐条列出并给结论）。
5. **冷启动可用性（A24/三）**：**空库全新启动**跑一遍——不要只测「种了几行」，
   要断言「**A 跑完后 B 能解析出全部 N 条**」，即链条的端到端证明而非各环自证。
   实测教训：补契约 ✓、建实体与端点 ✓（324 测试全绿）、种 6 条病区 ✓（336 全绿），
   **三环各自验收全过，全新启动时 6 条病区却全部跳过**——因为跨环的前置依赖
   （科室数据从哪来）没有任何一环负责。逐条核对 spec 里标为必选的字段，
   其数据源在空库启动后是否真的有数据。
6. **运行时错误取证**：查看 `.vima/reports/runtime-errors*.jsonl`
   （A7 浏览器侧真实报错），有条目则逐条定位归属任务。

## 验收清单

<!-- 逐项独立给证据（命令输出摘要 / 文件:行号），不得只写「已完成」 -->

- [ ] 前端 `npm run build:check` 通过（零 error）
- [ ] 前端 `npm run lint` 通过
- [ ] 后端 `./mvnw -o -q compile` 通过
- [ ] 后端 `./mvnw -o -q test` 通过
- [ ] `vima converge` 零 error（跨任务集成对账：无漏实现 / 重复实现 / 越界实现）
- [ ] 各契约接口的实际响应结构与契约一致
- [ ] spec 第五章每条 FLOW-xx 冒烟走通
- [ ] **空库冷启动**后，spec 中标为必选的字段其数据源确有数据
      （断言「A 跑完后 B 能解析出全部 N 条」，不是「种了几行」）
- [ ] `.vima/reports/runtime-errors*.jsonl` 无未处理条目

## 开发步骤

1. 逐条执行「执行内容」，每步记录命令与结论；
2. 全部结论写入 `.vima/reports/full-test-builder.json`（供 code-audit 读取与事后审计）；
3. Verifier 落盘 `.vima/reports/<taskId>-verifier.json` 时，**必须**把实际跑过的命令
   逐条填进 `commands: [{cmd, exitCode}]`（契约 §6.9 / A43 D-A43-01）——
   `vima certify` 的 `pipeline-green` 一级要求本字段非空且每条 `exitCode` 为 0，
   缺了它这一级判不过。命令行原样记录，别人要能照着重跑复核；
4. 回报主 Agent 的摘要 **≤ 15 行**（A18）：只写结论与失败项归属任务，明细留在报告里。

## 约束重申

- **只验证不新增功能**：发现缺陷登记后回报主 Agent，由主 Agent 派回**负责的业务任务**
  做增量修复，本任务不直接改业务代码。
- **不改契约**：实现与契约不符时，默认是实现错——契约是唯一事实来源（§9.5）。
  确需改契约的，作为 `sharedChangeRequest` 上报，不自行修改。
- 本步失败即阻断 code-audit，不得跳过。

## 维护须知

- 命令随骨架 `package.json` / `pom.xml` 变化时同步更新「执行内容」；
- 新增 FLOW 时同步补进冒烟清单——冒烟清单漏项等于该流程从未被整体验证过。
