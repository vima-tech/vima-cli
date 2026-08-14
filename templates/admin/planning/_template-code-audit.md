---
taskId: code-audit
title: 代码审计（收尾流水线）
status: pending
layer: pipeline
side: fullstack
dependsOn: [full-test]
retryCount: 0
updatedAt: 2026-01-01T00:00:00Z
---

<!--
  收尾流水线任务模板之二（A20；复制为 docs/tasks/code-audit.md 后填充）。
  本文件 _ 前缀，不参与调度。

  frontmatter 填写规则（契约 §6.1）：
  - taskId 固定 code-audit；layer=pipeline / side=fullstack；contract 可省；
  - dependsOn 固定 [full-test]（失败阻断：全量测试不过就不做审计）；
  - status 初始 pending；retryCount 初始 0；updatedAt 为写盘时的真实 ISO 时间。

  本任务的输入是磁盘产物，不是会话记忆（设计 §10.3 场景二「步骤间文件通信」）：
  .vima/reports/full-test-builder.json、convergence.json、trace.json、
  planning-validation.json、各 <taskId>-verifier.json。
-->

# 代码审计

## 任务目标

收尾流水线第二步：在「跑得通」之上再确认「写得对」——**并行批次各自为战留下的一致性
问题**（重复造轮子、绕开共享层、规范走样、边界越界）在单任务视角里看不见，只有把全库
放在一起审才暴露。

## 执行内容

1. **确定性对账先跑，人读审计后跑**（不重复机器已能查的事）：
   - `vima validate`（产物与代码↔契约单向对账）
   - `vima converge`（跨任务集成对账：漏实现 / 重复实现 / 越界实现 / 授权端无调用）
   - `vima trace --strict`（@vima 标注：野生标注、done 无标注的虚报嫌疑）
   三者全绿后，再进入下面的人读审计；未绿的先修，不要带着红项做审计。
2. **共享层纪律**：业务目录里是否出现本应复用共享层的自建实现
   （自建请求封装 / 自建 axios 实例 / 复制的通用组件 / 重复的工具函数）。
3. **编码规范**：对照 `docs/coding-standards.md` 抽查各批次产出，重点看不同任务之间
   同类代码的写法是否一致（并行开发最容易在这里分叉）。
4. **范围边界**：对照 spec 第九章 `vima:non-goals`，检查有无越界实现的功能
   （越界项在 Verifier 报告里以 `NG-xx 越界` 记，**不适用豁免**）。
5. **死代码与残留**：未被引用的组件/接口/常量、调试输出、TODO/FIXME 残留。

## 验收清单

- [ ] `vima validate` 零 error
- [ ] `vima converge` 零 error
- [ ] `vima trace --strict` 通过（无野生标注、无虚报嫌疑）
- [ ] 无绕开共享层的自建实现（逐条列出核查过的共享能力）
- [ ] 抽查的各批次产出编码规范一致（列出抽样任务与结论）
- [ ] 无 `vima:non-goals` 越界实现
- [ ] 无调试输出 / 未处理 TODO 残留

## 开发步骤

1. 先跑三条确定性命令，红项全部修完再往下；
2. 逐项人读审计，每项给证据（`文件:行号`）；
3. 结论写入 `.vima/reports/code-audit-builder.json`；
4. 回报主 Agent 的摘要 **≤ 15 行**（A18）：只写结论与待修项归属任务。

## 约束重申

- **只审计不重构**：发现问题登记后回报主 Agent，由主 Agent 派回负责任务做增量修复。
  审计者顺手重构会绕过「Builder → 独立 Verifier」的校验通道。
- **不发明豁免**：没有用户明确裁定的问题一律记为待修，不写「可接受」。
- 本任务通过是 `/go` 切换 MAINTAINING 的最后一道条件。

## 维护须知

- `docs/coding-standards.md` 变更时同步更新审计项；
- 新增确定性机检（新 V-xx 规则）后，把它加进第 1 步并从人读审计项里删掉——
  同一件事不该既机检又人审。
