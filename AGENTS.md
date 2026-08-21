# vima-cli 工程规范

## 使命

vima-cli 是 AI 开发脚手架：开发者用自然语言沟通需求，依托 Codex 完成
需求拆解 → 规范生成 → 人机对齐评审 → 批次并行编码 → 机械验收的全流程。
需求真源：`docs/design/vima-cli-design-v2.md`（章节号 §N 全仓通用引用格式）
+ `docs/design/v2.1-amendments.md`（增补项 A1–A44，下文只导读到 A35：A1–A5 吸收自 PACT，A6–A8 吸收自
AI-First 评估与市场对标，A9–A12 吸收自 mattpocock/skills 对标，A13 出自产品设计要素
专题讨论，A14 出自 sustain-v3 分栏版面实战，A15 为命令语义对调，A16 为多端应用模型
——一后端 × 多前端，A17 为 /go 批间连续性——预算任务计数/提交授权/停点白名单，
A18 为批次调度效率——任务负责接口集 apis + 同层流水线 + 并行度可配 + /go 续跑器，
出自 sustain-v3 实测评估 `docs/design/batching-efficiency-assessment.md`，
A19 为存量项目升级可达性，A20 为开发完成后的收敛期——`vima converge` 跨任务集成对账
（V-INT 规则族）+ /go 收口闸门 + 收尾流水线任务模板，A21 为经验反哺回路——
`vima retro` 确定性复盘采集 + /go 步骤 6 反哺询问 + issue 草稿，A22 为字段级机检——
弹窗字段↔入参双向对账 / 字段四面对账 / 导航参数取值域 / 聚合 json 子协议 + context
两条检索线，出自 sustain-v3 实战反馈 `docs/design/sustain-v3-field-feedback.md`，
A23 为小程序端企业 UI 框架自研 vima-ui-mp——纯类契约（改判 D-A16-02），A24 为工具
可信度与项目定制（sustain-v3 反馈第二批），A25 为 h5-mobile 收编为 kind + vima-ui-h5
——与 mp 共用一份类契约，A26 为在途草案（custom 前端形态，尚未入册），A27 为
Design-First 前端体系第一批——PDL 页面设计语言 + 三级保真验证链 + `vima mock` +
七探针版面冒烟，A28 为 create 布局对称化——端一律落 `apps/<id>/`（改判 D-A16-03），
A29 为 Codex Design 视觉真源工序——逐页高保真稿 → 1:1 开发 → /go 5.2.6 末轮样式
校准，出自 carelink-admin 试点实证，A30 为设计工序两段化 + 产品风格取向——Stage A
版面语言（模式参考页 → 固化进 layout.css/tokens.css/design-language.md）+ Stage B
逐页内容稿 + 五条取向轴定档，兑现 A27 延后项 P28，A31 为维护期变更事务——
`vima change` 基线快照/影响面/任务重开/传播闸门（兑现 T2-8），A32 为交付等级认证——
`vima certify` 四级证据阶梯 + 显式不宣称 deployable/stable，A33 为业务闭环主视图——
审计视图第⑥视图 + V-SPEC-17/18 flow 引用机检，A31–A33 出自 PACT 代际评估
`docs/design/pact-vs-vima-generational-assessment.md` 的共识收敛，A34 为视觉真源的兑现机制
——保真分级 D0/D1/D2 + Builder 三层授权（锁定/遵循/自由）+ DESIGNING 阶段与 Stage A0 三方向
发散 + 三类验收报告契约 + 批准摘要驱动失效，出自 Sustain 视觉退化取证与 codex 六轮评审收敛
`docs/design/sustain-vima-visual-regression-{analysis,solution}.md`，A35 为过程轨迹——
append-only `journal.jsonl`（内核出口 + post-write hook 双采集口）给 A21 反哺回路补上
时间维，出自「能否增加 agent 那样的轨迹记录」用户提问
`docs/design/process-journal-proposal.md`；**A36 起的条目不在本段逐条展开**，
以 `docs/design/v2.1-amendments.md` 自身的章节标题为准——本段是导读不是索引，
逐条抄一遍必然与那份文件漂移）。
需求真源之上还有一层量尺：`docs/design/vima-requirements-baseline.html`
（需求基线 R1–R11 / 约束 C1–C4 / 明确排除 / 裁定台账 / 已接受风险 AR-1）。
增补项回答「这次改动出自哪条实证」，需求基线回答「它服务于哪条需求」——
**A# 能反查到 R#/C# 才算立住**（A43/A44 即由该基线的冷读比对立项）。
内部实现契约：`docs/internal-contracts.md`（文件格式 / 模块接口 / 校验规则的唯一权威）。

## 硬约束

- **零运行时依赖**：只用 Node.js ≥20 内建模块（node:fs、node:path、node:util.parseArgs、
  node:crypto、node:readline 等）。不引入任何 npm 依赖，devDependencies 也不加。
- **确定性优先**：凡能用文件系统 + 确定性代码解决的（校验、拓扑、渲染、对账），
  不留给 Agent 概率性行为。渲染器禁止嵌入时间戳/随机数——同一输入必须字节一致。
- **原子写**：写文件一律 `atomicWriteFile`（临时文件 + rename）；JSON 输出一律
  `stableStringify`（key 排序 + 2 空格 + 尾换行）。
- **错误输出稳定**：所有错误走 `VimaError(code, message, {path, exitCode})`，
  stderr 格式 `vima <cmd>: <CODE>: <message> (<path>)`。退出码见 internal-contracts §3。
- **分层边界**：Codex 专属资产内容（commands/agents/hooks/settings）只存在于
  `templates/*/workspace/`；`lib/` 确定性内核平台中立、不实现任何 Codex 语义——
  唯一例外是 init/doctor 作为安装器/体检器持有的 `.Codex/` 落点清单与检查项，
  该清单变更必须与模板资产同步（实现现状的如实表述，防「宣称」与「实现」两张皮）。
- **防过度设计**：每处实现必须能反查到设计文档 §N 或增补项 A#；反查不到的不写。
- **立项即做透**：需求一旦立项（§N 或 A#），就按长远正确的形态一次做完整——数据结构
  留足该有的字段、消费端一并接线、契约与校验同步落位；不为省改动量交半截实现
  （块定义了没人消费、字段加了校验不覆盖、文档改了测试没跟、落点选错只因为改动面小）。
  与「防过度设计」的分工：防过度设计管**广度**（没立项的需求不做），本条管**深度**
  （已立项的需求不做夹生）。两条同时套用的判据顺序——先问「这是哪条需求要的」，
  反查不到就不做；反查得到就做透，此时"改动面大"不构成降级理由，
  但**扩出的每一环仍须落进该增补项的规格与落点表**，否则它就是新的未立项需求。

## 验证

```bash
npm test          # node --test tests/（单元 + 端到端黄金链路）
node bin/vima.mjs help
```

## 纪律

- 不执行真实 npm publish / git push。
- 完成编辑即停手，不主动 git commit（用户明确要求时才提交）。
- 修改文件格式/模块接口前先改 `docs/internal-contracts.md`，它是并行开发的对齐真源。
