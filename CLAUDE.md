# vima-cli 工程规范

## 使命

vima-cli 是 AI 开发脚手架：开发者用自然语言沟通需求，依托 Claude Code 完成
需求拆解 → 规范生成 → 人机对齐评审 → 批次并行编码 → 机械验收的全流程。
需求真源：`docs/design/vima-cli-design-v2.md`（章节号 §N 全仓通用引用格式）
+ `docs/design/v2.1-amendments.md`（增补项 A1–A18：A1–A5 吸收自 PACT，A6–A8 吸收自
AI-First 评估与市场对标，A9–A12 吸收自 mattpocock/skills 对标，A13 出自产品设计要素
专题讨论，A14 出自 sustain-v3 分栏版面实战，A15 为命令语义对调，A16 为多端应用模型
——一后端 × 多前端，A17 为 /go 批间连续性——预算任务计数/提交授权/停点白名单，
A18 为批次调度效率——任务负责接口集 apis + 同层流水线 + 并行度可配 + /go 续跑器，
出自 sustain-v3 实测评估 `docs/design/batching-efficiency-assessment.md`）。
内部实现契约：`docs/internal-contracts.md`（文件格式 / 模块接口 / 校验规则的唯一权威）。

## 硬约束

- **零运行时依赖**：只用 Node.js ≥20 内建模块（node:fs、node:path、node:util.parseArgs、
  node:crypto、node:readline 等）。不引入任何 npm 依赖，devDependencies 也不加。
- **确定性优先**：凡能用文件系统 + 确定性代码解决的（校验、拓扑、渲染、对账），
  不留给 Agent 概率性行为。渲染器禁止嵌入时间戳/随机数——同一输入必须字节一致。
- **原子写**：写文件一律 `atomicWriteFile`（临时文件 + rename）；JSON 输出一律
  `stableStringify`（key 排序 + 2 空格 + 尾换行）。
- **错误输出稳定**：所有错误走 `VimaError(code, message, {path, exitCode})`，
  stderr 格式 `vima <cmd>: <CODE>: <message> (<path>)`。退出码见 internal-contracts §3。
- **分层边界**：Claude Code 专属资产内容（commands/agents/hooks/settings）只存在于
  `templates/*/workspace/`；`lib/` 确定性内核平台中立、不实现任何 Claude Code 语义——
  唯一例外是 init/doctor 作为安装器/体检器持有的 `.claude/` 落点清单与检查项，
  该清单变更必须与模板资产同步（实现现状的如实表述，防「宣称」与「实现」两张皮）。
- **防过度设计**：每处实现必须能反查到设计文档 §N 或增补项 A#；反查不到的不写。
- **立项即做透**：需求一旦立项（§N 或 A#），就按长远正确的形态一次做完整——数据结构
  留足该有的字段、消费端一并接线、契约与校验同步落位；不为省改动量交半截实现
  （块定义了没人消费、字段加了校验不覆盖、文档改了测试没跟、落点选错只因为改动面小）。
  与「防过度设计」的分工：防过度设计管**广度**（没立项的需求不做），本条管**深度**
  （已立项的需求不做夹生）。两条同时套用的判据顺序——先问「这是哪条需求要的」，
  反查不到就不做；反查得到就做透，此时"改动面大"不构成降级理由，
  但**扩出的每一环仍须落进该增补项的规格与落点表**，否则它就是新的未立项需求。

## 验证

```bash
npm test          # node --test tests/（单元 + 端到端黄金链路）
node bin/vima.mjs help
```

## 纪律

- 不执行真实 npm publish / git push。
- 完成编辑即停手，不主动 git commit（用户明确要求时才提交）。
- 修改文件格式/模块接口前先改 `docs/internal-contracts.md`，它是并行开发的对齐真源。
