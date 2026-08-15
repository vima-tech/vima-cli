---
name: check
description: 检查 Vima 项目完成度、构建状态、任务点、运行时错误和集成收敛情况；当用户输入 /check、检查进度、查看完成度、项目做完了吗或要求深度检查时使用。
argument-hint: [深度检查]
---

# Vima Check 稳定入口

`${CLAUDE_SKILL_DIR}` 应位于真实项目的 `.claude/skills/check/`，项目根是该目录向上三级。
先比较该根与 `${CLAUDE_PROJECT_DIR}`；不一致时停止，不得在错误目录手工模拟检查，并提示用户
从真实项目根重新启动 Claude Code。

确认项目根存在 `.vima/manifest.json`、`docs/lifecycle.json` 与
`.claude/commands/check.md`。缺失时提示运行 `vima update`，不要自行拼凑替代报告。

完整读取 `${CLAUDE_PROJECT_DIR}/.claude/commands/check.md`，它是完成度检查的唯一正文。
按正文运行确定性 CLI、构建和报告聚合步骤。`$ARGUMENTS` 为空时执行标准检查；明确包含
“深度检查”时才执行正文中的可选语义抽查。必须给出实际信号与失败项，不能只凭任务状态宣称完成。
