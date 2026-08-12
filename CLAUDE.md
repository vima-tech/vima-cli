# vima-cli 工程规范

## 使命

vima-cli 是 AI 开发脚手架：开发者用自然语言沟通需求，依托 Claude Code 完成
需求拆解 → 规范生成 → 人机对齐评审 → 批次并行编码 → 机械验收的全流程。
需求真源：`docs/design/vima-cli-design-v2.md`（章节号 §N 全仓通用引用格式）
+ `docs/design/v2.1-amendments.md`（吸收自 PACT 的增补项 A1–A5）。
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
- **分层边界**：`lib/` 确定性内核平台中立，不出现任何 Claude Code 概念；
  Claude Code 专属资产（commands/agents/hooks/settings）只存在于 `templates/*/workspace/`。
- **防过度设计**：每处实现必须能反查到设计文档 §N 或增补项 A#；反查不到的不写。

## 验证

```bash
npm test          # node --test tests/（单元 + 端到端黄金链路）
node bin/vima.mjs help
```

## 纪律

- 不执行真实 npm publish / git push。
- 完成编辑即停手，不主动 git commit（用户明确要求时才提交）。
- 修改文件格式/模块接口前先改 `docs/internal-contracts.md`，它是并行开发的对齐真源。
