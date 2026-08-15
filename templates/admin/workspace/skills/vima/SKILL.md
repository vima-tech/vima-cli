---
name: vima
description: 执行任意 Vima CLI 命令或项目生命周期操作；当用户提到 vima、项目体检、规格校验、渲染、批准、任务计划、同步、追溯、上下文、收敛、认证、复盘、变更、端管理、更新项目或查询 Vima 命令时使用。显式入口为 /vima <command> [options]。
argument-hint: <command> [options]
---

# Vima CLI 稳定路由

本 skill 为所有 Vima CLI 命令提供统一命名空间，避免与 Claude 内置 `/doctor`、`/context`、
`/help` 等名称冲突。`${CLAUDE_SKILL_DIR}` 应位于真实项目的 `.claude/skills/vima/`，项目根是
该目录向上三级。比较该根与 `${CLAUDE_PROJECT_DIR}`；不一致时停止，不得手工模拟任何 Vima
命令，也不得在错误目录执行，并提示用户从真实项目根重新启动 Claude Code。

## 路由规则

1. 先读取 `${CLAUDE_PROJECT_DIR}/docs/lifecycle.json`；再以当前安装版本的 `vima help` 为命令
   与阶段真源，不依赖记忆中的旧命令表。
2. 用户显式输入 `/vima <command> [options]` 时，`$ARGUMENTS` 就是请求的命令与参数。
   校验首个词确实出现在 `vima help` 后，从项目根运行对应的 `vima $ARGUMENTS`；不得改写命令、
   吞掉选项或用手工读写文件模拟 CLI 结果。参数含 shell 控制符时停止并要求用户改为普通参数。
3. Claude 因自然语言自动调用且 `$ARGUMENTS` 为空时，根据用户本轮意图和 lifecycle 选择唯一命令；
   不确定时先展示 `vima help` 中最相关的候选，不执行有写入的命令。
4. “开始/继续开发”转交 `go` skill，“检查完成度”转交 `check` skill，“视觉设计流程”转交
   `design` skill；不要复制这三条长工作流。
5. 执行后报告实际命令、退出码和关键输出。非零退出必须保留稳定错误码，不得改口宣称成功。

`vima validate` 只能证明当前已实现规则通过；它不能证明外部 DDL、契约与规格属实。没有相应
对账规则或报告时必须明确说“未验证”，不能把“命令已运行”扩大解释为“真源无漂移”。
