# {{projectName}} — Agent Instructions

> 本文件遵循 [AGENTS.md 开放标准](https://agents.md)，供 Cursor / Codex / Jules 等
> 读取 AGENTS.md 的工具使用；由 vima init 安装（managed，勿手改，A8）。
> Claude Code 原生读取 CLAUDE.md，不经过本文件。

本项目的 agent 指令**真源是同目录 `CLAUDE.md`（项目宪法）**：开工前完整阅读它，
并遵循其中指向的 `docs/coding-standards.md`（编码细则）与工作协议。
本文件不复制宪法正文——防止双真源漂移。

最低红线（即使你的工具不跟随文件引用也必须遵守）：

- 前后端接口以 `docs/contracts/` 契约为唯一事实来源；共享层目录
  （src/components/、src/utils/、vendor/ 与 backend 的 config/security 包）对业务任务只读。
- 新建/修改的业务代码文件头部必须带 `@vima <taskId>` 注释；页面结构以
  `docs/spec.md` 的 `vima:page` 数据块为唯一真源，不得自行发明组件树。
- 自检命令：前端 `npm run build:check`；后端 `mvn -q compile && mvn -q test`。
