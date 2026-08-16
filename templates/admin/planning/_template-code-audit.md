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

## 审计作用域（先定作用域，再开审）

**扫描面 = 带 `@vima <taskId>` 标注的文件**，与 `V-CODE` 规则族、`vima trace` 的归属统计
**同一口径**：`lib/model/traceability.mjs` 里写明「端点归属只在带标注的业务文件上算——
底座/共享层没有标注，天然不参与（同 V-CODE 作用域）」。

判定只看有没有标注，不看目录。典型的**无标注 ⇒ 不在扫描面 ⇒ 一律不报**：

- **`vima create` 生成的骨架**：`apps/<端>/src/{styles,layouts,components,router,store,utils}`、
  登录/404/示例页，以及后端 `config/`、`common/`、`security/` 等底座代码。
  它们不属于任何任务，**审计者无权改**——改了反而算越界动共享层。
  骨架自身的合宪性由 vima-cli 仓库的模板测试守，不由本任务守（A42 D-A42-05）。
- **第三方 vendor / 生成物 / 构建产物**：`vendor/`、`dist/`、`node_modules/`、`target/`。

反过来，共享层任务（`layer=shared`，如 `shared-base`）**认领并标注**过的文件在扫描面内
——骨架的 `styles/layout.css` 就带 `@vima shared-base`。它们照审，问题归到那个共享层任务，
因为它接得了单。

判据：**审计报出的每一条都必须有一个能接单的任务**——标注上的 taskId 就是它的归属。
报一条没人能接的违规，只会训练出「审计结论不用看」的习惯
（同 `validate.mjs` 对「永远无法清除的告警」的处理纪律）。
怀疑骨架/共享层确有问题时，写进回报摘要的「建议项」，由主 Agent 决定是否立任务，
**不写进本任务的违规清单**。

## 执行内容

1. **确定性对账先跑，人读审计后跑**（不重复机器已能查的事）：
   - `vima validate`（产物与代码↔契约单向对账）
   - `vima converge`（跨任务集成对账：漏实现 / 重复实现 / 越界实现 / 授权端无调用）
   - `vima trace --strict`（@vima 标注：野生标注、done 无标注的虚报嫌疑）
   三者全绿后，再进入下面的人读审计；未绿的先修，不要带着红项做审计。
2. **共享层纪律**（作用域：带 `@vima` 标注的文件）：**标注文件里**是否出现本应复用
   共享层的自建实现（自建请求封装 / 自建 axios 实例 / 复制的通用组件 / 重复的工具函数）。
   共享层与骨架**自身**怎么写，不在本项之内——本项查的是「业务代码有没有绕开它」。
3. **编码规范**（作用域：带 `@vima` 标注的文件）：对照 `docs/coding-standards.md` 抽查
   各批次产出，重点看不同任务之间同类代码的写法是否一致（并行开发最容易在这里分叉）。
   抽样只在标注文件里取；骨架的写法是**基线**不是被审对象。
4. **范围边界**（作用域：带 `@vima` 标注的文件）：对照 spec 第九章 `vima:non-goals`，
   检查有无越界实现的功能（越界项在 Verifier 报告里以 `NG-xx 越界` 记，**不适用豁免**）。
   骨架自带的示例页/演示路由不是越界——它们先于任何任务存在。
5. **死代码与残留**（作用域：带 `@vima` 标注的文件）：未被引用的组件/接口/常量、
   调试输出、TODO/FIXME 残留。骨架预置但本期没用上的能力不算死代码。

## 验收清单

- [ ] `vima validate` 零 error
- [ ] `vima converge` 零 error
- [ ] `vima trace --strict` 通过（无野生标注、无虚报嫌疑）
- [ ] **标注文件内**无绕开共享层的自建实现（逐条列出核查过的共享能力；
      骨架与共享层自身的实现不在此项）
- [ ] **标注文件内**抽查的各批次产出编码规范一致（列出抽样任务与结论；
      抽样只在带 `@vima` 标注的文件里取）
- [ ] **标注文件内**无 `vima:non-goals` 越界实现（骨架自带示例页不计）
- [ ] **标注文件内**无调试输出 / 未处理 TODO 残留（骨架预置未用能力不计死代码）

## 开发步骤

1. 先跑三条确定性命令，红项全部修完再往下；
1.5 **先框出扫描面再看代码**：`grep -rl "@vima " apps backend` 得到的文件集合就是
   第 2–5 项的全部审计对象，把它落进报告的 `scope.files`（数量 + 目录分布），
   后续每条违规都必须落在这个集合里；
2. 逐项人读审计，每项给证据（`文件:行号`）；
3. 结论写入 `.vima/reports/code-audit-builder.json`；
4. Verifier 落盘 `.vima/reports/<taskId>-verifier.json` 时，**必须**把第 1 步那三条
   确定性命令逐条填进 `commands: [{cmd, exitCode}]`（契约 §6.9 / A43 D-A43-01）——
   `vima certify` 的 `pipeline-green` 一级要求本字段非空且每条 `exitCode` 为 0；
5. 回报主 Agent 的摘要 **≤ 15 行**（A18）：只写结论与待修项归属任务。

## 约束重申

- **只审计不重构**：发现问题登记后回报主 Agent，由主 Agent 派回负责任务做增量修复。
  审计者顺手重构会绕过「Builder → 独立 Verifier」的校验通道。
- **不发明豁免**：没有用户明确裁定的问题一律记为待修，不写「可接受」。
- **不报无人可接的违规**：落在扫描面之外（骨架 / 共享层 / vendor）的问题，
  归属不了任何 taskId，写进回报的「建议项」而不是违规清单——
  报了也没人有权改，只会稀释真正要修的那几条。
- 本任务通过是 `/go` 切换 MAINTAINING 的最后一道条件。

## 维护须知

- `docs/coding-standards.md` 变更时同步更新审计项；
- 新增审计项时**必须同时写清它的作用域**——默认作用域是「带 `@vima` 标注的文件」，
  要扩到骨架/共享层必须先说明「谁有权修」，说不出就不该加这一项；
- 新增确定性机检（新 V-xx 规则）后，把它加进第 1 步并从人读审计项里删掉——
  同一件事不该既机检又人审。
