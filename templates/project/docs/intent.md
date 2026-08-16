---
layer: intent
trust: stated
need: claimed
source: docs/raw/
---

# 意图：为什么做这个系统

这一段是**背景**，不是命题：写清楚上下文、约束、不做什么。
背景帮人理解，但不参与编译——只有下面那种条目才会变成命题。

## 命题

<!-- 下面这条是示例。改成你自己的，或者删掉——空的 intent.md 会让 compile 报「没有可编译的规格」。 -->

- `intent-example` 更换示例：写清这个系统成功长什么样，一句能判定真假的话

## 格式说明（可以整段删掉）

一条命题 = **一个列表项**，反引号包住 id，其后是陈述：

```
- `spec-login-remember` 登录页提供「记住我」勾选框
```

常见情形到此为止——层、可信度、门槛、上游都从文件头继承。
只有例外才需要在下面缩进两格补属性：

```
- `spec-login-captcha` 连续失败 3 次后出验证码
  - need: executed
  - from: intent-login, intent-security
```

可写的属性只有这些，写错当场报错（不静默忽略——被忽略的 `needs:`
会让门槛悄悄掉回默认值，而覆盖表照样是绿的）：

| 属性 | 说明 |
|---|---|
| `trust` | 来源可信度 S：`fact` > `superseded` > `stated` > `ruled` |
| `need` | 需要多强的证据 E：`observed` > `executed` > `derived` > `claimed` |
| `from` | 上游命题 id，逗号分隔。**intent 层不能写**（它上面没有命题了） |
| `source` | 物料出处。**intent 层必填**——说不出物料出处的意图 = AI 自己想出来的需求 |
| `impl` | 落在哪些文件/符号上 |
| `policy` | 证据策略 id，对应 `.vima/policies/<id>.json`。**`need: executed` 想真的达标必须有它** |
| `ruling.*` | 定夺记录，见下 |

`policy` 值得单说：`executed` 的命令如果在交活那一刻现给，就是**挑什么命令验出什么结论**
（`node -e "process.exit(0)"` 也能退出 0）。所以现挑的命令只记为 `adHoc`，换不来达标；
要达标就在 `.vima/policies/` 写一条策略——人写、可 review、进版本控制。见那个目录的 README。

**文件头**只允许 `layer` / `upstream` / `trust` / `need` / `source`。
`upstream` 是这一批的默认上游，条目里写 `from` 就覆盖它。

多来源矛盾时自行定夺、记 ruling、**不要停下来问人**（约束 C4）：

```
- `spec-device-status` 设备状态只有 enabled 与 disabled 两值
  - ruling.question: spec 写了三值（含 pending），契约只有两值
  - ruling.chosen: contract
  - ruling.options: spec 三值, contract 两值
  - ruling.rationale: 契约与后端实现一致，spec 未随上次决策更新
  - ruling.confidence: low
  - ruling.blastRadius: 设备列表页, 设备详情页, 状态筛选器
```

带 ruling 的命题 trust 强制为 `ruled`，人复核时要一眼认出哪些是 AI 替他定的。
`confidence` 与 `blastRadius` 必填：没有优先级的裁定台账，结局和「永远消不掉的
告警」一样——人不看了。

一份 markdown = 一个层。`raw/` 下的原始物料不参与编译。
没有 `layer:` 文件头的 markdown 会被跳过（`vima compile` 会把跳过的列出来）。
