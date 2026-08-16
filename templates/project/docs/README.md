# docs/ —— 规格真源

这个目录里的 markdown 是**唯一真源**：人写、人审、可 diff。

命题是它的投影，`vima compile` 从这里编译出来；`.vima/index/` 是派生缓存，
可以随时删掉重建。**不要反过来把投影当真源**——投影里改的东西下次编译就没了。

建议的分法（不是硬性结构，按项目自己来）：

```
docs/
  intent.md        为什么做，成功长什么样
  spec/            系统对外应当表现成什么样
  contracts/       接口、数据形状、错误码
  raw/             原始物料（聊天记录、旧文档、纪要），带来源说明
```

一份 markdown = 一层，靠文件头的 `layer:` 声明；**没有 `layer:` 的会被跳过**
（`vima compile` 把跳过的列出来，不静默）。`raw/` 下的物料不参与编译。
命题的写法见 `intent.md` 的「格式说明」一节——文件名不影响顺序，
层序由 `vima compile` 按 intent → spec → contract → impl → behavior 定。

从零散物料起步时用 `vima-intake` 规程；接管已有代码库用 `vima-adopt`。
