# vima-cli

[![CI](https://github.com/vima-tech/vima-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/vima-tech/vima-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40vima-tech%2Fcli)](https://www.npmjs.com/package/@vima-tech/cli)
[![node](https://img.shields.io/node/v/%40vima-tech%2Fcli)](package.json)
[![license](https://img.shields.io/badge/license-MIT-blue)](package.json)

**定形 · 供料 · 验形** —— 让 AI 生成的系统长得像同一个产品，并让做过的东西下次用得上。

> **当前是 v4，一次彻底重写，以 alpha 发布在 `next` 标签下。**
> 与 v3 **没有任何共同实现**，也没有升级路径——3.x 项目的
> `docs/lifecycle.json`、任务文件、manifest 在 v4 里一个都读不了。
> 所以它**不占 `latest`**：`npm i -g @vima-tech/cli` 拿到的仍是 3.x，
> 要 v4 得显式写 `@next`。v3 的设计册与实测记录留在 [`docs/v3-archive/`](docs/v3-archive/)。

---

## 它解决什么

两个直接痛点，来自实际用 AI 写业务系统：

1. **风格太多变。** 同一个人、同一个项目、隔一周生成的两个页面不像一个产品。
   没有企业风格规范时，AI 每次都在重新发明版面、间距、交互与信息架构。
2. **做过的东西下次用不上。** 后台的角色/菜单/字典、小程序的微信登录/支付，
   每个项目从头写一遍。经验、判断、教训同样留不下来。

vima 做三件事对应它们：

| | 做什么 | 怎么做 |
|---|---|---|
| **定形** | 规定合法产出长什么样 | 令牌阶梯（皮，可整体换）+ 三张封闭词表（骨，写不出非法的东西）+ 按任务维度下发的规则 |
| **供料** | 提供现成的块与经验 | 分层业务块库 L1–L4，开放注册表，`vima-harvest` 规程负责提名沉淀 |
| **验形** | 记录并呈现，保证前两件真的发生 | 事件日志 + 命题投影 + Web 观测面 |

第三件不是附加功能。**没有它，前两件会在「AI 说做到了」这一步悄悄落空。**

---

## 快速开始

```bash
npm i -g @vima-tech/cli@next   # v4 在 next 标签下；不带 @next 拿到的是 3.x
vima doctor                    # 先体检：hook 起不起得来、MCP 可不可达
```

从源码跑也行（零依赖，无需 `npm install`）：

```bash
git clone https://github.com/vima-tech/vima-cli.git
cd vima-cli && npm test
alias vima="node $PWD/bin/vima.mjs"
```

然后在你的项目里：

```bash
cd ~/my-project
vima init                     # 立起 .vima/ 与 .claude/，写出派生投影

# 把零散物料丢进 docs/raw/，在 Claude Code 里说「整理一下需求」
# vima-intake 规程会把它们整理成 docs/ 下的规格 markdown

vima compile                  # docs/ 的 markdown → 命题（按层序自动排）
vima next                     # 我该干什么：下一条命题 + 适用规则 + 上下文
vima submit <claimId>         # 交活：系统自己取证，不收「我做完了」
vima audit                    # 对账：覆盖 / 达标 / 闭合 / 死规则
vima ui                       # 起 Web 观测面（只绑回环，按需起）
```

`vima init` 之后项目里多出这些：

```
docs/                规格 markdown —— 唯一真源，人写人审可 diff
.vima/
  events.jsonl       事件日志，append-only
  project.json       theme / apps / blocks
  rules/             项目特有规则
.claude/
  agents/            vima-builder（worktree 隔离）· vima-verifier（物理只读）
  hooks/             六个采集 hook
  skills/            intake / adopt / harvest / reskin 四套长规程
  rules/             ← 派生投影，vima sync 生成，勿手改
  CLAUDE.md          只有三条元规则
.mcp.json            ← 派生投影，项目级 MCP，进版本控制
```

---

## 核心模型

三个概念，两条正交的强度轴。

**命题 claim** 是事件流的投影，不存盘。分五层：
`intent`（为什么做）→ `spec`（对外表现）→ `contract`（接口/数据/错误码）→ `impl`（落在哪些符号）→ `behavior`（跑起来实际什么样）。

**证据 evidence** 附着在命题上，不是任务上。取证方式必须可重放，否则与自称无异。

**事件 event** 落在 `.vima/events.jsonl`，append-only，**唯一写入口**，无 update 无 delete。

两条轴分开记，因为一条命题可以「来源可信但没实现」，也可以「实现扎实但来源是份过期文档」：

- **来源可信度 S** `fact` > `superseded` > `stated` > `ruled` —— 这条凭什么进来的
- **验证强度 E** `observed` > `executed` > `derived` > `claimed` —— 这条做到了没有

`claimed` 是自述，永远够不着任何更高门槛。这不是不信任，是让「做完了」和「验过了」在数据里有可查的差别。

完整设计见 [ARCHITECTURE.md](ARCHITECTURE.md)。

---

## 命令一览

| 命令 | 做什么 |
|---|---|
| `vima init` | 在当前目录立起 `.vima/` 与 `.claude/` |
| `vima compile` | 从 `docs/` 编译命题（不带参数就是编整棵 `docs/`） |
| `vima sync` | 重建 Claude Code 派生投影（`.claude/rules/` 与 `.mcp.json`）；`--check` 报漂移 |
| `vima next` | 我该干什么：下一条命题 + 适用规则 + 上下文 |
| `vima claim <id>` | 声明我开始做这条了（只记过程，不改状态） |
| `vima submit <id>` | 交活：系统自己取证，不收自述 |
| `vima rule` | 记一条裁定（规格没说清时先定夺，不阻塞） |
| `vima ask <id>` | 查任意命题的状态与证据 |
| `vima app add\|list\|remove` | 登记端（`config.apps` 的受管写入口，变更即刷新规则投影） |
| `vima theme set\|show` | 换/看主题皮——`set` 先验资产仓里真的有这套皮 |
| `vima block add\|list\|remove\|upgrade` | 装业务块——装上后 `vima next` 按层下发块内容；装/卸校验依赖闭合，装上即写资产锁 |
| `vima status` | 三档进度 + 成本 + 失效清单（恒 exit 0） |
| `vima audit` | 跑对账：覆盖 / 达标 / 闭合 / 死规则（**项目**符不符合规格） |
| `vima doctor` | 装置体检：hook 真触发吗 · MCP 可达吗 · 投影漂了吗（**工具**装对没有） |
| `vima ui` | 起 Web 观测平台 |
| `vima mcp` | 在 stdio 上跑 MCP 服务（给 agent 用，一般由客户端拉起） |
| `vima mcp-install` | 怎么把 vima 装成 MCP，以及为什么要装 user scope |

退出码刻意少，每个对应一类**处置方式不同**的失败：
`0` 成功 · `1` 用法错 · `2` 不在 vima 项目里 · `3` 模块未实现 · `4` 目标不存在 ·
`5` 跑通了但结论是「不达标」 · `70` 内部错误。

---

## 与 Claude Code 的关系

vima 有三个前端：**MCP 给 agent、CLI 给人与 CI、Web 给人看**。
Claude Code 侧的资产分两类，区别是谁写：

- **原生资产**（人写、模板发出去）：`.claude/{agents,hooks,skills}`、`CLAUDE.md`
- **派生投影**（`vima sync` 生成）：`.claude/rules/`、`.mcp.json` —— 手改会被冲掉

约束按「能往下就不往上」下沉：**资产 > 机检 > skill 规程 > CLAUDE.md 元规则**。
写不出非法的东西，比事后指出更强；能机检的，不写进规程；能写进规程的，不写进宪法。
所以项目 `CLAUDE.md` 只有三条——剩下的都下沉掉了。

两条纪律值得单独说：

**agent 不能通过正式接口提交证据结论。** 事件的「发生」由 agent 触发，「内容」由系统生成。
所以 MCP 上的 `submit` 只收 claimId，不收任何自述；证据事件的 `actor` 恒为 `system`。

说清边界：这是接口设计，不是物理防篡改。vima 承诺的是 **T0**（意外损坏可检测、
不静默假绿）与 **T1**（官方接口不采信 agent 自述）；**不承诺 T2**——拥有
Write/Bash 的 agent 物理上改得了任何本地文件，包括事件日志本身。

**唯一的否决点是 SubagentStop 打回。** `PreToolUse` 刻意不用——立场是「绕过不被禁止，
绕过只是没有收益」。打回否的不是「你不能这么做」，是「你还没做完」，而且永远留着出口：
做不动的记一条裁定说明为什么，照样能走。

---

## 明确不做

- **不引任何运行时依赖。** 只用 Node.js ≥20 内建模块，devDependencies 也不加。
- **不做「真跑界面」的采集设施。** `observed` 这一档接口留着，调用时如实返回未实现，
  **绝不降级用 `executed` 冒充**——冒充比缺失贵得多。
- **不做多人多会话协作、业务块版本兼容。**
- **不用 LLM 判定的 hook。** 闸门必须是确定性的。

---

## 开发

```bash
npm test          # node --test tests/unit/*.test.mjs
npm run smoke     # 端到端冒烟，走真实 CLI 进程
```

对齐真源是 [ARCHITECTURE.md](ARCHITECTURE.md)，**改模块接口前先改它**。
仓库根 [CLAUDE.md](CLAUDE.md) 是给在本仓库里干活的 agent 看的工程规范。

## License

MIT
