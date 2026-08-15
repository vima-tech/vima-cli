---
description: 检查 Vima 项目完成度、构建信号、任务点、运行时错误和集成收敛；用户输入 /check、检查进度或查看完成度时使用。
argument-hint: [深度检查]
---

# /check 命令

## 触发条件

用户输入 /check。

## 完成度计算（客观信号为主）

1. **任务状态统计**：扫描 docs/tasks/*.md 的 frontmatter status 字段，
   按 done/running/failed/blocked/pending 分类计数。
2. **构建信号**：前端运行 `npm run build:check`；后端运行 `mvn -q compile` 与
   `mvn -q test`（骨架自带上下文冒烟测试，Bean 装配/JPA 建表/种子数据跑不通即红），
   记录各自通过/失败。
3. **验收清单**：统计各任务文件「## 验收清单」中复选框的勾选比例
   （`- [x]` 数 / 复选框总数）。
4. **追溯对账**：运行 `vima trace`，摘录其摘要（标注数、野生标注、
   done 但无标注的虚报嫌疑任务）。
4.5 **多端分组（A16）**：任务带 `app` 字段（多端项目）时，任务清单与完成度
   按端分组各一行小计（如「admin 端 3/5 · mp 端 1/2」），跨端一眼可读。
5. **任务点完成度（B2，契约 §6.9）**：读取 .vima/reports/*-verifier.json，
   聚合全部 `points` 数组——按 通过 / **豁免（waived，带理由）** / 未过 三分计数，
   完成度 =（通过 + 豁免）/ 总点数；豁免点单独列出（点位 + reason），
   防止豁免变成看不见的黑洞。带 page 但报告缺 points 的任务标注「未逐点验收」。
   **A13**：points 现在还含每条业务规则（`RULE-xx …`，前后端任务一律必填）与越界项
   （`NG-xx 越界：…`）。越界项单独列出且**不计入豁免**——出现越界说明实现超出了
   spec 第九章声明的范围，应回去改 spec 或改实现，不能在验收环节放行。
6. **运行时错误信号（A7，契约 §6.10）**：读取 .vima/reports/runtime-errors.jsonl
   （存在时）——报告条数、按 page 分组的分布与最近 3 条摘要；文件不存在或为空
   记「无运行时错误上报」。这是浏览器侧的真实报错，比静态检查更接近「跑得通」。

6.5 **版面冒烟信号（A27，契约 §6.17）**：读取 .vima/reports/layout-smoke[.<appId>].json。
   有报告 → 报 `source`（kimi-webbridge / playwright / unknown）、`bad` 计数与按路由归组的
   findings 摘要（bad>0 时列 probe/selector/value 前 10 条，按 route 反查归属任务派修）；
   **无报告 → 如实报「无版面冒烟通道」**（默认 Kimi WebBridge 与 Playwright 回退均不可用，
   或 dev server 未起；启用方式见 `/go` 5.2.5）。
   空报告与无报告是两回事，不许把「没测」说成「零问题」。

7. **跨任务集成对账（A20，契约 §6.13）**：运行 `vima converge`（确定性、只读），
   摘录其摘要——V-INT error / warn 数、未过点位数、`byTask` 涉及的任务数。
   这是**单任务视角看不见**的一层：漏实现（契约声明了没人写）、重复实现
   （同一接口两处后端文件）、越界实现（越出 A18 `apis` 责任田）、授权端无调用。
   零 error 才代表「各批产出合得起来」；有 error 时列出前 3 条与归属任务。
   报告详见 `.vima/reports/convergence.json`。

## 深度检查（可选，仅当用户明确要求「深度检查」时）

抽样 2-3 个标记 done 的任务，派发 vima-verifier 子代理做语义比对，
验证「状态为 done 的任务是否真的完成」。此步骤昂贵，默认不执行。

## 输出格式

```
📊 项目完成度报告

总体完成度：75% (15/20 任务)

✅ 已完成（15）：用户管理、设备管理、订单管理 ...
🔄 进行中（2）：用户详情页（验收清单 80%）、设备详情页（60%）
❌ 失败（1）：订单详情页（重试 2 次未通过，报告：docs/tasks/order-detail.md）
⛔ 阻塞（2）：全量测试、代码审计（依赖订单详情页）

🔧 构建状态：tsc+vite ✅ │ mvn compile ✅ │ mvn test ✅
🔎 追溯对账：标注 15 │ 野生 0 │ 虚报嫌疑 1（详见 .vima/reports/trace.json）
🎯 任务点：143 通过 │ 2 豁免（导出延后二期 等，见报告 reason）│ 5 未过 / 共 150（2 个任务未逐点验收）
🛑 运行时错误：3 条（/system/order 2 │ /system/device 1，最近：Cannot read properties…）
🔗 集成对账：error 1 │ warn 2 │ 未过点位 5（V-INT-02 GET /api/device/list 在 2 处重复实现
   → device-api-be / device-extra-be；详见 .vima/reports/convergence.json）

建议：处理订单详情页失败项后，输入 /go 继续
```
