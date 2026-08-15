# {{projectName}} — Agent Instructions

> 本文件遵循 [AGENTS.md 开放标准](https://agents.md)，供 Cursor / Codex / Jules 等
> 读取 AGENTS.md 的工具使用；由 vima init 安装（managed，勿手改，A8）。
> Claude Code 原生读取 CLAUDE.md，不经过本文件。

本项目的 agent 指令**真源是同目录 `CLAUDE.md`（项目宪法）**：开工前完整阅读它，
并遵循其中指向的 `docs/coding-standards.md`（编码细则）与工作协议。
本文件不复制宪法正文——防止双真源漂移。

最低红线（即使你的工具不跟随文件引用也必须遵守）：

- **确定性操作一律调 `vima <command>` CLI，不得用手工读写文件模拟它的结果。**
  不确定该跑哪条时先跑 `vima help`（它是命令集的运行时真源，别凭记忆猜）。
  最常被手工模拟、且后果最重的三件——**一次都不要手写**：
  任务状态统计与 `docs/tasks/README.md` 走 `vima sync`；批次计划走 `vima plan`；
  规划期校验报告走 `vima validate`。手工写出来的那份一定会和内核算出来的那份对不上。
- **不要手改任务 frontmatter 的 `status` 与 `updatedAt`。** 状态由完成动作驱动、
  经 `vima sync` 重建；手改会让 `lifecycle.taskStats`、`batch-plan.json` 与
  frontmatter 三处各说各话，而**没有任何一处会报错**——跑 `vima status` 可当场看到差值。
  `updatedAt` 尤其不能自己编：内核写的是真实时钟，写出未来时间等于留下伪造证据。
- **先确认工作目录就是项目根**（有 `.vima/` 与 `docs/lifecycle.json` 的那一层）。
  `vima` 命令自己会向上锚定项目根，手工读写不会——在别的仓库里改这个项目的代码，
  本项目的 hooks、子代理与工作流全都不会生效，且**不会有任何提示**。
  拿不准就先跑 `vima status`：它会报出当前阶段与进度；若显示「非 vima 项目根」，
  说明你不在这个项目里，停下来切换目录，不要继续写文件。
- 前后端接口以 `docs/contracts/` 契约为唯一事实来源；共享层目录
  （src/components/、src/utils/、vendor/ 与 backend 的 config/security 包）对业务任务只读。
- 新建/修改的业务代码文件头部必须带 `@vima <taskId>` 注释；页面结构以
  `docs/spec.md` 的 `vima:page` 数据块为唯一真源，不得自行发明组件树。
- 自检命令：前端 `npm run build:check`；后端 `mvn -q compile && mvn -q test`。
