# /go 命令

## 触发条件

用户输入 /go，或在 DEVELOPING 阶段说「继续开发」。

## 执行流程

### 1. 状态检查与三道校验闸门（产物质量不靠 Agent 自觉）

- 读取 docs/lifecycle.json（缺失则提示先执行 `vima init`，终止）。
- 若 currentPhase = PLANNING，依次通过三道闸门：

  **第一道：机械校验（确定性，零 token）**
  运行 `vima validate`。它按 docs/planning-validation/validate.checklist.md 检查：
  产物结构完整（spec 八章齐全、契约接口五要素齐全）；引用闭环（spec 页面接口 ⊆ 契约、
  无孤儿契约、契约必有前后端任务成对引用、dependsOn 引用的 taskId 都存在）；
  taskStats 与 frontmatter 对账。exit 非 0 → 输出缺失清单，终止 /go，交用户处置。

  **第二道：语义抽查（Verifier 子代理，只读）**
  派发 vima-verifier 子代理抽样核对产物与 docs/raw/ 原文的一致性（契约字段、spec 章节
  是否遗漏/失真）。覆盖率策略：每个模块至少抽 1 处；超过 10 个页面的项目页面样本
  覆盖率 ≥ 30%；**所有标记 pendingConfirm 的推断项全检**。
  发现问题 → 回到 PLANNING 修补对应产物，对失败模块重新抽查直至通过；
  抽查明细写入 .vima/reports/planning-validation.json。

  **可选深模式：冷读门（A3，用户说「深度校验」/「深检」/「冷读」或 spec 首次进评审时执行）**
  派发一个零知识子代理，提示词明确三要素：只读 docs/spec.md 与 docs/contracts/*.md；
  不读 docs/raw/、不读对话历史、不读代码；输出 ① 一份实现计划 ② 一份「动工前必须
  得到答复、否则只能靠猜」的必问问题清单，逐条注明不问的后果。
  问题数 > 0 = 规格存在漏洞（信息只存在于对话记忆而未落盘）。问题清单由主 Agent
  呈给用户逐条裁定：属规格遗漏 → 回 PLANNING 把答案补进 spec/契约，重跑
  `vima validate` 后再过本闸门；属可推断项 → 在对应 YAML 条目标
  `pendingConfirm: true`（approve 时统一裁定）。

  **第三道：用户评审已落痕**
  检查 lifecycle 的 checklists.PLANNING.tasksApproved 是否为 true（该位只能由
  `vima approve` 机械置位，approve 内部会阻断未确认的 pendingConfirm）。
  未置位 → 提示用户在浏览器核对 docs/review/index.html（审计视图）、
  docs/review/prototype.html（原型）与 docs/coverage-matrix.md 后运行 `vima approve`，终止 /go。

  三道全部通过 → currentPhase 切换为 DEVELOPING 并记录时间（phaseHistory 追加）。

- 若 currentPhase = DEVELOPING：进入断点续跑模式（见步骤 4）。

### 2. 任务分析（CLI 确定性，主 Agent 不自行拓扑计算）

- 运行 `vima plan`：CLI 扫描全部任务 frontmatter，按 layer 与 dependsOn 拓扑排序，
  输出批次计划到 .vima/reports/batch-plan.json，含环检测——发现依赖环即中止报错。
- 计划结构：shared 任务每个单独一个串行批 → business 任务按依赖拓扑分层并行批
  （单批 ≤ 5）→ pipeline 任务串行收尾。
- 主 Agent **只照计划派发，不自行计算批次划分**（确定性操作不留给概率性行为）。

### 3. 批次调度（核心循环）

- **共享层批次先写令牌**（§10.7 策略二）：派发 layer=shared 批次前，写入
  `.vima/shared-write-token`（内容为 ISO 8601 过期时刻，取当前时间 + 30 分钟）；
  本批验收完成后**立即删除**该文件。业务批次不写令牌——guard-shared.sh 会对
  共享目录写入一视同仁地拦截。
- **派发当前批次**：在同一轮回复内为批内每个任务各发起一个 vima-builder 子代理
  Task 调用（同一轮多个 Task 调用 = 并行执行），派发前把任务 status 置 running。
- 等待本批全部 Builder 返回结果摘要，逐任务派发 vima-verifier 校验。
- 逐个处理结果：
  a. Builder 成功且 Verifier 通过 → frontmatter status 置 done；
  b. Verifier 不通过 → 重试，**最多 2 次**。重试采用**增量修复模式**：
     重新派发 vima-builder，指令中明确要求先读 .vima/reports/<taskId>-verifier.json
     的上轮报告，只修复报告指出的问题，不得重写已有代码；每次重试 retryCount +1；
  c. 2 次重试仍失败 → status 置 failed，其依赖链上的后续任务全部置 blocked，
     **其他不受影响的批次继续执行**。
- 每次状态变化同步回写任务文件 frontmatter（status/retryCount/updatedAt）
  与 lifecycle.json 的 taskStats。
- **批次检查点**：本批全部处理完成后执行
  `git commit -m "vima: batch <N> completed (<k> tasks)"`，形成批粒度回滚点。
- **sharedChangeRequest 处理**（§10.7 策略三）：Builder 结果摘要声明
  sharedChangeRequest 时不得代其直接修改共享层；由主 Agent 创建一个共享层
  补偿任务（layer=shared），插入当前批次结束后**串行执行**（补偿批同样走
  写令牌流程）；受影响的已完成任务由主 Agent 评估是否补发 Verifier 复查。
- **会话预算**：单次 /go 最多推进 3 个批次或 8 个任务（先到为准）；
  达标后落盘全部状态，提示用户再次输入 /go 续跑（避免主会话上下文过载）。
- 还有未完成批次且未被阻断 → 派发下一批。

### 4. 断点续跑

- 扫描任务 frontmatter，收集 done/failed/blocked/pending/running 统计。
- **running 孤儿处理**：发现 status=running 的任务一律视为上次会话中断遗留，
  重置为 pending 并在报告中说明（子代理是一次性委派，会话中断即失联，
  不存在「还在跑」的情况）。
- 状态与报告/统计不一致时，先运行 `vima sync` 做确定性对账再继续。
- 向用户报告中断点：已完成 X 个、失败 Y 个、待执行 Z 个。
- 从第一个含 pending 任务的批次继续；failed 任务询问用户：重试 / 跳过 / 人工介入。

### 5. 完成处理

- 所有任务 done 且流水线（layer=pipeline）任务全部通过 →
  更新 lifecycle.json：currentPhase 切换为 MAINTAINING 并记录时间。
- 存在 failed/blocked → 保持 DEVELOPING，输出待处理清单与建议。
