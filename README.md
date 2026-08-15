# vima-cli — AI 开发脚手架

[![CI](https://github.com/vima-tech/vima-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/vima-tech/vima-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40vima-tech%2Fcli)](https://www.npmjs.com/package/@vima-tech/cli)
[![node](https://img.shields.io/node/v/%40vima-tech%2Fcli)](package.json)
[![license](https://img.shields.io/badge/license-MIT-blue)](package.json)

**用自然语言沟通需求，依托 Claude Code 完成 需求拆解 → 规范生成 → 人机对齐评审 → 批次并行编码 → 机械验收 的全流程。**

vima-cli 不是又一个 Agent——它是给 Claude Code 配的「宪法体系 + 确定性工具箱」：
`vima create` 起项目骨架，`vima init` 一键部署 Agent 工作环境（项目宪法、生命周期状态机、
project skills、兼容斜杠命令、子代理角色、写保护 hooks），其余一切确定性操作（校验/渲染/拓扑/对账）由零依赖的
CLI 命令完成，**不留给 Agent 概率性行为**。

- 需求真源：[docs/design/vima-cli-design-v2.md](docs/design/vima-cli-design-v2.md)（§N 引用格式）
- 设计增补 A1–A38：[docs/design/v2.1-amendments.md](docs/design/v2.1-amendments.md)（A1–A5 吸收自 PACT，A6–A7 吸收自 AI-First 评估，A8 吸收自市场对标，A9–A12 吸收自 mattpocock/skills 对标，A13–A33 出自专题讨论与真实项目实测，A34–A36 视觉真源与过程轨迹，A37–A38 运行状态可观测与稳定触发面）
- 吸收溯源与资产移植映射：[docs/pact-absorption.md](docs/pact-absorption.md)
- 内部实现契约（文件格式/接口/规则唯一权威）：[docs/internal-contracts.md](docs/internal-contracts.md)

## 快速开始

```bash
npm i -g @vima-tech/cli

vima create my-project --template admin   # 1. 起骨架（Vue3+TS+Vite / Java21+SpringBoot）
cd my-project
vima init                                 # 2. 部署 Claude Code 工作环境
vima go                                   # 3. 从项目根启动全新 Claude Code，并自动触发 /go

# Claude 会话内的确定性入口：任意 CLI 命令统一放在 /vima 命名空间
# /vima doctor
# /vima validate
# /vima render-review --check

# --- PLANNING：全程自然语言 ---
# 把原始文档丢进 docs/raw/，对 Agent 说：帮我把 docs/raw 里的文档整理一下，梳理出完整需求
# Agent 按 docs/planning-guide.md 引导对话，产物落盘即跑 vima validate 即时机检
# 人在浏览器审 docs/review/index.html（审计视图）+ prototype.html（线框原型）
vima approve                              # 4. 评审确认机械留痕（/go 前置闸门）

# --- DEVELOPING ---
# 可直接运行 vima go，或在正确项目会话中说 /go / 开始开发 / 继续开发：
# 三道闸门 → vima plan 批次计划 → 子代理批内并行 → Verifier 验收 → 断点续跑
# 对 Agent 说 /check：客观完成度报告（状态统计 + 构建信号 + trace 对账 + converge 集成对账）

# --- MAINTAINING：日常零命令 ---
# “帮我在设备列表加个批量删除” —— Agent 读 lifecycle 自动感知阶段，定位任务文件直接干
```

## 命令一览

| 命令 | 作用 | 退出码语义 |
|---|---|---|
| `vima create <name> [-t <id>]` | 多模板起骨架（环境预检 + 变量替换 + git init） | 4=目录冲突/必需依赖缺失 |
| `vima init` | 部署 Agent 工作环境（宪法/lifecycle/skills/兼容命令/角色/hooks/manifest） | 4=已初始化或 preview 模板 |
| `vima go [--commit]` | 从真实项目根启动全新 Claude `/go` 会话；支持任务级断点继续 | 4=skill/Claude 缺失 |
| `vima update [--dry-run]` | 更新 vima 生成物：三方比较，用户文件永不覆盖 | 改动过的受管文件出 `.vima-new` |
| `vima validate [--artifact <p>]` | PLANNING 产物机械校验（契约 §8 全量规则，零 token） | 2=有 error |
| `vima render-review [--check]` | spec 数据块 → 人类审计视图（单文件 HTML，四视图） | 2=四要素缺失/漂移 |
| `vima render-prototype [--check]` | spec 数据块 → 线框原型 + prototype.manifest.json | 2=四要素缺失/漂移 |
| `vima render-matrix [--check]` | spec/契约/任务 → 需求覆盖矩阵（V-COV-01 的生成端） | 2=漂移 |
| `vima approve` | 用户评审的机械确认，写 tasksApproved 留痕 | 4=前置未满足/有 pendingConfirm |
| `vima plan [--json]` | 任务 frontmatter → 拓扑批次计划（环检测） | 2=依赖环/缺依赖 |
| `vima trace [--strict] [--dir <p>]` | 代码 `@vima <taskId>` 标注 ↔ 任务对账：抓**野生**与**虚报** | 2=野生（--strict 时含虚报） |
| `vima converge [--json] [--strict]` | 跨任务集成对账（V-INT）：**漏实现/重复实现/越界实现**收口 | 2=有 error 或未过点位 |
| `vima retro [--json] [--with-ids]` | 项目复盘采集 → 可反哺 vima-cli 的 issue 正文（默认脱敏） | 4=非 vima 项目 |
| `vima change open\|list\|impact\|apply\|close` | 维护期变更事务：基线快照 → 影响面 → done 任务重开 → 传播闸门 | 2=闸门未过；4=在途冲突/无在途 |
| `vima certify [--json]` | 交付等级认证（四级证据阶梯，显式不宣称 deployable/stable） | 恒 0（评估非闸门）；4=非 vima 项目 |
| `vima app list` / `vima app add <id> --kind <k>` | 端册生命周期：查看 / 后补前端端（新端落 `apps/<id>/`，既有端零迁移） | 4=端 id 已存在（APP_EXISTS） |
| `vima mock` | 契约 → 确定性 demo 数据（8 类型固定规则 × 四档数据量，两跑同字节） | 4=无契约（NO_CONTRACTS） |
| `vima status [--watch\|--json\|--line]` | 运行状态：**证据强度三档进度**（自称/有轨迹/已验收）+ 前后端任务量 + 用时 + ETA；只写 stdout 不落盘 | 恒 0（呈现非闸门） |
| `vima sync [--dry-run]` | frontmatter → taskStats + tasks/README.md 确定性重建 | — |
| `vima doctor [--json]` | 十三项体检（环境/宪法/状态一致性/对齐产物漂移/端册/产物形态/绕过内核痕迹） | 2=任一 ❌ |
| `vima upgrade [--yes]` | 升级 vima CLI 自身到 npm 最新版（默认只检查，`--yes` 才安装） | 4=当前安装方式不支持自升级 |

每个命令支持 `vima <command> --help` 或 `vima help <command>` 在终端查看完整用法与示例。
Claude Code 内统一使用 `/vima <command> [options]` 调用任意 CLI 命令；长工作流另有
`/go`、`/check`、`/design` 专用入口。显式 slash 调用是确定入口，自然语言由四个 project
skill 的精确描述匹配；`vima doctor` 会检查入口是否缺失、禁用模型触发或缺项目根校验。

## 模板（A5 能力诚实分级）

| 模板 | 技术栈 | 状态 |
|---|---|---|
| `admin` | Vue 3 + TS + Vite + vendored 组件库 / Java 21 + Spring Boot | **stable**（规划体系全量落地；系统底座内置：认证/RBAC 到按钮级/用户/角色/菜单/部门/字典/配置/文件/日志/消息/定时任务/在线用户/Excel 导入导出/API 文档——PLANNING 只覆盖业务需求） |
| `cli` / `script` / `lib` | Node CLI / Python / TS 库 | preview（仅骨架占位，init 拒绝运行） |
| `h5` | —— | **已收编**（A25）：移动端 H5 现在是 `admin` 模板的一个 kind，见下表 |

### admin 模板的三种端（kind，A16 一后端 × 多前端）

| kind | 技术栈 | UI 框架 | 状态 |
|---|---|---|---|
| `admin-web` | Vue 3 + TS + Vite | vendored `@vima-tech/ui-admin`（63 组件） | stable |
| `mp-native` | 微信原生小程序 + TS（零转译层） | vendored `@vima-tech/ui-mp` | stable |
| `h5-mobile` | Vue 3 + Vite + TS | vendored `@vima-tech/ui-h5` | stable |

`vima-ui-mp` 与 `vima-ui-h5` **共用同一份类契约与令牌**（112 个 `.vm-*` 类 + 75 个
`--vm-*` 令牌，两端文件字节一致、单测锁死）；差别只在行为——小程序用 `wx.*` 原生能力，
H5 用四个自带组件（`VmNavbar`/`VmTabbar`/`VmToast`/`VmDialog`）。

```bash
vima create nutri -t admin --apps admin:admin-web,patient:mp-native   # 建项目时定端册
vima app add ph5 --kind h5-mobile                                     # 存量项目后补端
```

## 核心机制

- **同源四投影（§13.3）**：spec.md 的 YAML 数据块是唯一机器真源 → md 给 AI 施工、
  审计视图给人审全不全、线框原型给人审是不是想要的、manifest 给 Verifier 对账实现——
  四者同源渲染，`--check` 字节级抓漂移，永不分别维护。
- **稳定触发与批次驱动调度（§10）**：正式入口是四个 project skills：`go`、`check`、
  `design` 与全命令路由 `vima`。任意 CLI 都可用 `/vima <command>` 明确调用；三个长工作流
  保留短入口和自然语言触发。所有入口校验项目根，拒绝用手工读写模拟确定性 CLI。
  终端 `vima go` 会先定位项目根，再启动全新 Claude 会话。随后 `/go` 三道闸门（机械校验 → 语义抽查/可选冷读深检 → approve 留痕）后，
  主 Agent 按 `vima plan` 的确定性批次计划派发子代理：共享层串行 → 业务批内并行（≤8，`--max-parallel` 可配）
  → **收口闸门**（A20：`vima converge` 集成对账 → 归组修复 → 重跑）→ 流水线收尾；
  检查点 git commit 须 `/go --commit` 显式授权（A18），不带则完全不碰 git；
  断点续跑靠 frontmatter + lifecycle，不靠对话记忆。
- **五道防线 + 写保护**：分步执行 → 独立 Verifier → PreToolUse hook 拦共享层写入（令牌机制）→
  完成定义（构建信号）→ 主 Agent 汇总。
- **代码可反查回规格（A1，吸收自 PACT）**：业务代码带 `@vima <taskId>` 标注，
  `vima trace` 机械对账——图谱说做了代码没有=虚报，代码有规格没有=野生。
- **开发完成 ≠ 完成（A20）**：并行批次各自为战，漏实现/重复实现/越界实现是单任务视角
  看不见的；`vima converge` 把全部产出当成一个整体对账，报告的 `byTask` 直接就是修复派工单。
- **经验反哺回路（A21）**：项目跑完那一刻磁盘上躺着最完整的一手证据（重试分布、集成冲突
  命中、共享层变更请求、豁免与越界、规则命中分布），过后即散。`vima retro` 确定性采集并
  渲染成 issue 正文（**默认脱敏**，只出计数与分布），`/go` 收尾时问一次是否反哺给 vima-cli
  ——把此前全靠自觉的「真实项目 → 评估 → 立项」回路做成固定环节。

- **进度要带证据强度（A37）**：「完成了」在仓库里有三个来源，可信度不同——
  `自称`＝任务 frontmatter 的 `status: done`（Agent 写的，可以伪造）、
  `有轨迹`／`已验收`＝`journal.jsonl` 的 report 事件（post-write hook 旁路采集；禁止 Agent
  直改 journal，但事件仍受 Agent 产出的报告输入影响，**不是独立防伪证明**）。
  `vima status` 把三档**同屏并列**：不变式是 `自称 ≥ 有轨迹 ≥ 已验收`，落差就是信号。
  立项实证是一次 2h24m 的重建跑出 `21 / 0 / 0`——只报第一个数就是一条 23.6% 的绿进度条，
  三个数并列才一眼看穿。用时取 lifecycle 真实时间戳，ETA 只用带真时间的验收样本，
  **样本不足就说「不估算」**而不是给个看起来很像数字的数字。
  `--watch` 常驻盯盘（目录晚创建也会动态补监听，低频轮询兜底），`--line` 挂进 Claude Code
  状态栏（会话开错目录时它会当场显红）。
- **稳定触发是四层，不是一层（A38）**：L0 会话锚定 / L1 入口发现 / L2 入口完整 /
  L3 执行忠实。L1 由四个 project skills + `/vima` 路由覆盖，L2 由 `vima doctor` ⑥ 覆盖，
  L3 由 `AGENTS.md` 红线（跨工具）+ `doctor` ⑬ 未来时间戳机检覆盖。
  **L0 是能力边界**：会话开在项目外时，skills / hooks / 状态栏 / 宪法全都不加载，
  vima 在那个会话里没有任何执行点——所以缺省启动路径是 `vima go`（它先定位项目根再开会话，
  且按当前阶段分派，四个阶段通吃）。想让**任意目录**的会话都带一枚探针，
  可自行把下面这段加进用户级 `~/.claude/settings.json`（vima 不代写它）：

  ```json
  { "statusLine": { "type": "command", "command": "vima status --line" } }
  ```

  非 vima 项目里它显示「vima ⚠ 非 vima 项目根」，正是那类故障唯一会露头的地方。

## 与设计文档 v2.0 的已知偏离

| 偏离 | 理由 |
|---|---|
| 骨架用内置目录拷贝，不执行 `npm create vue`/`spring init` 外部命令 | 确定性与离线可测（§3.5 的 fallback 语义升为默认） |
| update 冲突产物为 `<path>.vima-new` 而非 `.diff` | 零依赖下 diff 质量不可靠，完整新版本更可用 |
| §4.5 的 `vima upgrade` 更名为 `vima update`，`upgrade` 改指升级 CLI 自身 | A15：`upgrade` 语义应是「换掉工具自己」，自升级此前无落点 |
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
