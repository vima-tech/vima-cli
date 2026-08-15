---
name: go
description: 执行或断点继续 Vima 项目开发；当用户输入 /go、开始开发、继续开发、继续实现或要求从断点恢复时使用。
argument-hint: [--commit]
---

# Vima Go 稳定入口

本 skill 是 `/go` 的正式发现入口。`${CLAUDE_SKILL_DIR}` 必须位于真实 Vima 项目的
`.claude/skills/go/`，因此项目根是该目录向上三级；不要把会话启动目录当作项目根猜测。

1. 比较上述项目根与 `${CLAUDE_PROJECT_DIR}`。
   - 相同：继续执行。
   - 不同：不要在错误会话里开发，也不要模拟调度。明确输出真实项目根，并让用户执行
     `cd <项目根> && vima go`；随后停止本轮。
2. 确认项目根下同时存在 `.vima/manifest.json`、`docs/lifecycle.json`、
   `.claude/commands/go.md` 和 `.claude/agents/vima-builder.md`。缺失时停止并提示先运行
   `vima update`（尚未 init 的项目运行 `vima init`）。
3. 完整读取 `${CLAUDE_PROJECT_DIR}/.claude/commands/go.md`，它是调度协议的唯一正文；
   严格执行其中的阶段分派、Builder → Verifier、断点续跑、会话预算和合法停点规则。
4. 将本次参数 `$ARGUMENTS` 原样作为 go 协议参数；当前只接受空参数或 `--commit`。

只说“我会继续”不算触发成功；必须完成协议正文的状态检查，并在可推进时实际派发任务。
