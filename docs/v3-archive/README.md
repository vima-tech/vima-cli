# v3 归档

创建日期：2026-08-16

**这里面的文档描述的是 vima v3，那套实现已经整体删除，与 v4 没有任何共同代码。**
它们不是当前设计，照着做会做出一个不存在的产品。

v4 的设计真源是仓库根的 [`ARCHITECTURE.md`](../../ARCHITECTURE.md)。

## 为什么留着而不删掉

留的是**判断**，不是方案。这些文档里有大量「当时为什么这么定」和实测数据，
v4 的很多决定是站在它们的结论上做的——删掉之后，下次有人重新提出同一个方案，
没人说得清它上次为什么被否。

几份特别值得回看的：

| 文档 | 里面有什么 |
|---|---|
| `design/vima-cli-design-v2.md` | v3 的需求真源，§N 引用格式 |
| `design/v2.1-amendments.md` | 增补项 A1–A42，每一条都带立项理由 |
| `design/sustain-v4-truthsource-drift.md` | 真源漂移的实测取证 |
| `design/sustain-vima-visual-regression-{analysis,solution}.md` | 视觉退化的取证与收敛，v4 的「定形」直接源于此 |
| `design/pact-vs-vima-generational-assessment.md` | 与 PACT 的代际对比 |
| `design/batching-efficiency-assessment.md` | 批次调度效率实测，v4 用 worktree 隔离并行的由来 |
| `internal-contracts.md` | v3 的文件格式与模块接口 |
| `pact-absorption.md` | 从 PACT 吸收了什么、没吸收什么 |

## v4 从中继承了什么

不是继承代码，是继承结论：

- **证据要分档，自称不能顶替验证**（出自 v3 的 A37 与 sustain-v4 实测：
  43 个任务都写了「Service 层单元测试」验收项，实际覆盖 0/58，而所有报告都是绿的）
- **判据的实现与用法必须一起收口**（v3 同一条正则有三份拷贝，实测 281 个调用点
  静默跳过 216 个，而两条规则都显示通过）
- **视觉真源需要机制兑现，光写规范不够**（视觉退化取证）
- **并行编码要靠隔离，不能靠「大家别碰同一个文件」的约定**（批次调度实测）

这些在 v4 里分别变成了：两条正交强度轴、`core/extract.mjs` 单一提取点、
令牌与封闭词表、`vima-builder` 的 `isolation: worktree`。
