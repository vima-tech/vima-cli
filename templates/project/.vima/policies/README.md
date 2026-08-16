# 证据策略

这个目录里的每个 `<id>.json` 是一条**预登记的取证方式**。命题在 `docs/` 里声明
`policy: <id>`，`vima submit <claimId>` 就只能触发它——改不了命令。

## 为什么要有这一层

`executed` 的命令如果由交活的人当场给，那么**挑什么命令就验出什么结论**：

```bash
vima submit c-login --how='{"mode":"executed","cmd":["node","-e","process.exit(0)"]}'
```

这条命令真的跑了、真的退出 0，证据也会如实记成 `executed`——但它什么都没验。
所以 `meets()` **只认正式证据**：现挑的命令标 `adHoc:true`，进得了日志、帮得上
排查，换不来达标。

策略是人写的文件：可 review、可 diff、进版本控制。谁放宽了验收标准，
在 git 历史里看得见。

## 形状

```json
{
  "mode": "executed",
  "cmd": ["npm", "test", "--", "tests/login.test.ts"],
  "cwd": ".",
  "timeoutMs": 120000,
  "expects": { "stdoutMatch": "\\d+ passing" }
}
```

`cmd` 必须是 argv 数组——字符串要过 shell，引号规则一变就不可重放。

**`expects` 必须非空**，这是整层的牙齿：只看退出码的策略等于没有策略。
退出 0 的命令太容易造了——空过滤器、零用例、被跳过的整个套件，退出码全是 0。
至少声明一条：

| 键 | 意思 |
|---|---|
| `stdoutMatch` | 输出要匹配的正则。最常用：`"\\d+ passing"` / `"Tests:\\s+\\d+ passed"` |
| `minLines` | 输出至少几行非空。用于「跑了但没输出 = 没真跑」 |
| `artifact` | 跑完必须存在的文件。用于构建类：`"dist/index.js"` |

退出 0 **之后**才轮到 expects。「跑成功了」和「验到了东西」是两件事。

## 还没做的

- **反向验证（negative control）**：一条策略只证明「命令会绿」，不证明「目标能力
  坏了它会红」。理想做法是每条策略配一次变异：故意破坏被测能力，确认策略失败。
  vima 目前不强制、也不检查这件事——写策略的人要自己做一次，否则你只是有了
  一条更贵的绿灯。
- 策略版本与 digest 已记进证据（`by.policyDigest`），但**改了策略不会自动失效
  旧证据**。改策略后要自己重跑 submit。
