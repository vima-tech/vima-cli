---
name: design
description: 执行 Vima DESIGNING 阶段的视觉设计、方向发散、页面冻结和出口闸门；当用户输入 /design、开始设计、继续设计、生成视觉稿或检查设计进度时使用。
---

# Vima Design 稳定入口

`${CLAUDE_SKILL_DIR}` 应位于真实项目的 `.claude/skills/design/`，项目根是该目录向上三级。
先比较该根与 `${CLAUDE_PROJECT_DIR}`；不一致时停止，不得在错误目录手工模拟设计流程，并提示
用户从真实项目根重新启动 Claude Code。

确认项目根存在 `.vima/manifest.json`、`docs/lifecycle.json`、
`.claude/commands/design.md` 与 `.claude/agents/vima-designer.md`。缺失时提示运行
`vima update`，不要用线框或文字描述冒充正式设计产物。

完整读取 `${CLAUDE_PROJECT_DIR}/.claude/commands/design.md`，它是设计工作流的唯一正文。
严格执行其中的阶段判断、用户方向裁定、受控回写、逐页冻结和出口闸门；当前阶段不适用时说明
正确入口，不跨阶段硬跑。
