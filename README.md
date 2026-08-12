# vima-cli — AI 开发脚手架

[![CI](https://github.com/vima-tech/vima-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/vima-tech/vima-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40vima-tech%2Fcli)](https://www.npmjs.com/package/@vima-tech/cli)
[![node](https://img.shields.io/node/v/%40vima-tech%2Fcli)](package.json)
[![license](https://img.shields.io/badge/license-MIT-blue)](package.json)

**用自然语言沟通需求，依托 Claude Code 完成 需求拆解 → 规范生成 → 人机对齐评审 → 批次并行编码 → 机械验收 的全流程。**

vima-cli 不是又一个 Agent——它是给 Claude Code 配的「宪法体系 + 确定性工具箱」：
`vima create` 起项目骨架，`vima init` 一键部署 Agent 工作环境（项目宪法、生命周期状态机、
斜杠命令、子代理角色、写保护 hooks），其余一切确定性操作（校验/渲染/拓扑/对账）由零依赖的
CLI 命令完成，**不留给 Agent 概率性行为**。

- 需求真源：[docs/design/vima-cli-design-v2.md](docs/design/vima-cli-design-v2.md)（§N 引用格式）
- 设计增补 A1–A8：[docs/design/v2.1-amendments.md](docs/design/v2.1-amendments.md)（A1–A5 吸收自 PACT，A6–A7 吸收自 AI-First 评估，A8 吸收自市场对标）
- 吸收溯源与资产移植映射：[docs/pact-absorption.md](docs/pact-absorption.md)
- 内部实现契约（文件格式/接口/规则唯一权威）：[docs/internal-contracts.md](docs/internal-contracts.md)

## 快速开始

```bash
npm i -g @vima-tech/cli

vima create my-project --template admin   # 1. 起骨架（Vue3+TS+Vite / Java21+SpringBoot）
cd my-project
vima init                                 # 2. 部署 Claude Code 工作环境
claude                                    # 3. 启动 Claude Code

# --- PLANNING：全程自然语言 ---
# 把原始文档丢进 docs/raw/，对 Agent 说：帮我把 docs/raw 里的文档整理一下，梳理出完整需求
# Agent 按 docs/planning-guide.md 引导对话，产物落盘即跑 vima validate 即时机检
# 人在浏览器审 docs/review/index.html（审计视图）+ prototype.html（线框原型）
vima approve                              # 4. 评审确认机械留痕（/go 前置闸门）

# --- DEVELOPING ---
# 对 Agent 说 /go：三道闸门 → vima plan 批次计划 → 子代理批内并行 → Verifier 验收 → 断点续跑
# 对 Agent 说 /check：客观完成度报告（状态统计 + 构建信号 + trace 对账）

# --- MAINTAINING：日常零命令 ---
# “帮我在设备列表加个批量删除” —— Agent 读 lifecycle 自动感知阶段，定位任务文件直接干
```

## 命令一览

| 命令 | 作用 | 退出码语义 |
|---|---|---|
| `vima create <name> [-t <id>]` | 多模板起骨架（环境预检 + 变量替换 + git init） | 4=目录冲突/必需依赖缺失 |
| `vima init` | 部署 Agent 工作环境（宪法/lifecycle/命令/角色/hooks/manifest） | 4=已初始化或 preview 模板 |
| `vima upgrade [--dry-run]` | 升级 vima 生成物：三方比较，用户文件永不覆盖 | 改动过的受管文件出 `.vima-new` |
| `vima validate [--artifact <p>]` | PLANNING 产物机械校验（契约 §8 全量规则，零 token） | 2=有 error |
| `vima render-review [--check]` | spec 数据块 → 人类审计视图（单文件 HTML，四视图） | 2=四要素缺失/漂移 |
| `vima render-prototype [--check]` | spec 数据块 → 线框原型 + prototype.manifest.json | 2=四要素缺失/漂移 |
| `vima approve` | 用户评审的机械确认，写 tasksApproved 留痕 | 4=前置未满足/有 pendingConfirm |
| `vima plan [--json]` | 任务 frontmatter → 拓扑批次计划（环检测） | 2=依赖环/缺依赖 |
| `vima trace [--strict] [--dir <p>]` | 代码 `@vima <taskId>` 标注 ↔ 任务对账：抓**野生**与**虚报** | 2=野生（--strict 时含虚报） |
| `vima sync [--dry-run]` | frontmatter → taskStats + tasks/README.md 确定性重建 | — |
| `vima doctor [--json]` | 九项体检（环境/宪法/状态一致性/对齐产物漂移） | 2=任一 ❌ |

每个命令支持 `vima <command> --help` 或 `vima help <command>` 在终端查看完整用法与示例。

## 模板（A5 能力诚实分级）

| 模板 | 技术栈 | 状态 |
|---|---|---|
| `admin` | Vue 3 + TS + Vite + vendored 组件库 / Java 21 + Spring Boot | **stable**（规划体系全量落地；系统底座内置：认证/RBAC 到按钮级/用户/角色/菜单/部门/字典/配置/文件/日志/消息/定时任务/在线用户/Excel 导入导出/API 文档——PLANNING 只覆盖业务需求） |
| `cli` / `script` / `lib` / `h5` | Node CLI / Python / TS 库 / Vue3+Vant | preview（仅骨架占位，init 拒绝运行） |

## 核心机制

- **同源四投影（§13.3）**：spec.md 的 YAML 数据块是唯一机器真源 → md 给 AI 施工、
  审计视图给人审全不全、线框原型给人审是不是想要的、manifest 给 Verifier 对账实现——
  四者同源渲染，`--check` 字节级抓漂移，永不分别维护。
- **批次驱动调度（§10）**：`/go` 三道闸门（机械校验 → 语义抽查/可选冷读深检 → approve 留痕）后，
  主 Agent 按 `vima plan` 的确定性批次计划派发子代理：共享层串行 → 业务批内并行（≤5）→ 流水线收尾；
  批后 git commit 形成回滚点；断点续跑靠 frontmatter + lifecycle，不靠对话记忆。
- **五道防线 + 写保护**：分步执行 → 独立 Verifier → PreToolUse hook 拦共享层写入（令牌机制）→
  完成定义（构建信号）→ 主 Agent 汇总。
- **代码可反查回规格（A1，吸收自 PACT）**：业务代码带 `@vima <taskId>` 标注，
  `vima trace` 机械对账——图谱说做了代码没有=虚报，代码有规格没有=野生。

## 与设计文档 v2.0 的已知偏离

| 偏离 | 理由 |
|---|---|
| 骨架用内置目录拷贝，不执行 `npm create vue`/`spring init` 外部命令 | 确定性与离线可测（§3.5 的 fallback 语义升为默认） |
| upgrade 冲突产物为 `<path>.vima-new` 而非 `.diff` | 零依赖下 diff 质量不可靠，完整新版本更可用 |
| 模板选择为数字选单而非方向键 | 零依赖（node:readline），行为等价 |
| 组件库 `@vima-tech/ui-admin` 以 vendored 方式随骨架落地（`vendor/` 含预构建 dist，`file:` 依赖） | 该包不走 npm registry；vendored 保证离线可用与版本锁定（原「未随骨架安装」偏离已解决） |
| spec 为八章（+第八章 关键决策记录） | A4 吸收项：决策必须留已否决方案 |

## 开发

```bash
npm test          # node --test：单测 + CLI 路由矩阵 + 端到端黄金链路（零依赖）
node bin/vima.mjs help
```

仓库纪律见 [CLAUDE.md](CLAUDE.md)；改文件格式/接口先改 [docs/internal-contracts.md](docs/internal-contracts.md)。

## License

[MIT](LICENSE)。随包分发的 `templates/admin/scaffold/frontend/vendor/vima-ui-admin/` 为
vima-tech 自有组件库（其 package.json 标注 UNLICENSED，不经 npm registry 单独发布），
仅随模板落入生成项目使用；其对外授权口径以 vima-tech 官方声明为准。
