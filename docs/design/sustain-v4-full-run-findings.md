# vima-cli 本轮实测发现（累积，供最终评估报告）

## F1 · trace 扫描盲区：小程序端文件类型缺失（真缺陷）
`lib/commands/trace.mjs:15` 的 `SCAN_EXTS` = {.ts,.tsx,.vue,.js,.mjs,.cjs,.java}，
不含 `.wxml`/`.wxss`/`.json`。而 A23 已把 mp-native 收为一等端，post-write hook
（同仓 templates/.../post-write.mjs:17,23,26）明确在查 .wxml/.wxss。
后果：mp 页面任务若产物以 wxml/wxss 为主，trace 看不见其标注 →
① 代码级追溯断档；② `--strict` 下被误判「done 任务无标注 = 虚报嫌疑」。
实证：sustain-v4 mp 骨架 8 个 wxml/wxss 文件，trace 扫描命中 0。

## F2 · 契约模块粒度决定前端并行度上限（设计层矛盾）
A18 §2.1 要求「单点热文件（路由/侧栏）划归 layer:shared 任务一次性写入」，
A24/六 却要求「同契约的多个前端任务各自写 src/api/<module>.ts，用 conflictsWith 排不同批」。
同一个问题两种相反解法，且后者在「N 个页面共用 1 份契约」时把并行度打到 1。
实证：20 个小程序页面共用 mp-api.md → batch-plan 退化出 6 个单任务批次，总批次 33。
按 A18 口径把 src/api/mp.ts 归共享层后，批次 33 → 18。
建议：把 A24/六 改判为「同契约页面 ≥3 时，API 封装归共享层任务一次性写入」，
与 A18 §2.1 统一口径；conflictsWith 保留给真正无法上收的场景。

## F3 · doctor 报「体检通过」而采集链路是断的（已修，v3.1.3 A40）
见 CHANGELOG 3.1.3。

## F4 · 会话根 ≠ 项目根导致 .claude 全量未注册（已修，v3.1.3 A40）
见 CHANGELOG 3.1.3。

## F3 · Builder/Verifier 报告 schema 对子代理不可见，写错即静默丢弃（真缺陷）
`post-write.mjs` 转录报告前做 schema 校验（builder 要求 `status ∈ {completed,failed}`），
不合规直接 `return null` —— **无任何输出**。而 schema 只写在 `docs/internal-contracts.md:668`
（CLI 开发者文档），子代理的角色模板 `agents/vima-builder.md:30` 只说
「将结构化结果摘要写入 .vima/reports/<taskId>-builder.json」，**不给字段定义**。
后果：子代理按常识写 `{"result":"success"}` 之类 → hook 静默丢弃 → journal 零 report 事件
→ `vima status` 的「有轨迹/已验收」恒 0 → 与 A40 修的那个病症状完全一样，但成因不同。
实证：本轮 shared-base-mp 首次落报告即命中，hook exit 0 而 journal 无事件。
建议：①把 schema 明写进 vima-builder.md / vima-verifier.md 角色模板（它们是子代理唯一
必读的契约）；②hook 在 schema 不匹配时走 stderr 提示（exit 0 不阻断，但要让人看见）；
③或在 `vima context` 打包里附一段「完工必须落的报告样例」。

## F4 · V-CODE-01 的调用点正则漏掉 77% 的调用（真缺陷，且「看起来是绿的」）
`validate.mjs` 的前端调用正则泛型段写作 `(?:<[^>(]*>)?`，在第一个 `>` 处断开，
因此 `request.delete<any, ApiResponse<{ deleted: number }>>(...)` 这种**嵌套泛型**整条匹配不上。
而 ApiResponse<T> 内嵌恰是本项目（乃至该骨架）的主流写法。
量化实证（sustain-v4，2026-08-16）：admin 端 281 个 `request.*` 调用点中 **216 个（77%）带嵌套泛型**，
V-CODE-01「前端不得调用契约外接口 / 不得越权调用他端接口（A16 consumers）」
因此长期只覆盖不到 1/4 的调用面——**且它显示通过**。
这是最危险的一类缺陷：机检存在、机检通过、机检没看。
修法：泛型段排除括号而非 `>`（`(?:<[^()]*?>)?`）——泛型实参里不会有 `(`，
而后续 `\s*\(` 把边界钉死在调用括号上。
效果实测：追溯图「无人调用端点」219 → 39。

## F4 补充 · 同一条坏正则存在**三份拷贝**，修一处另两处继续沉默
最初只在 `validate.mjs`（V-CODE-01）发现。收口时 `vima converge` 又报出 39 条
「授权端没有任何调用」的 PUT/DELETE 端点——查证 `converge.mjs:28` 是**第三份**同样的旧正则
（它已经 import 了 `feApiKey`，却自己重造了正则）。
处置：把正则收成 `validate.mjs` 导出的 `FE_CALL_SOURCE` 单一真源，converge 与 traceability 复用；
导出字符串而非 RegExp 实例（带 g 的正则有 lastIndex 状态，跨模块共享同一实例会互相污染）。
效果实测：V-INT-04 误报 **39 → 2**（剩下 2 条 `meal/materials` 的改删是真实联调断点）。
教训：**同一判据的多处拷贝 = 缺陷的多处藏身点**。项目已有「判据只能有一个真源」的成文纪律
（doctor ⑥ 与 findProjectRoot 都写着），但对正则这类「小东西」没执行。

## F5 · Builder→Verifier 分离真的抓到了 Builder 抓不到的缺陷（正面验证）
`page-66-fe`（我的，tabbar 页）builder 自称 completed 且 build:check 通过，
verifier 独立复核发现漏调 `ensureAuth()`：`switchTab` 不触发 App 级生命周期，
未绑定档案的患者可经底部导航直接停在该页，突破 RULE-32。
兄弟 tabbar 页（plans/edu）都显式调了并写了注释，唯独这页漏——
**这类「同类页面里唯一的漏网」正是单页视角看不见、跨页对照才暴露的缺陷**，
与 A22 立项时说的「每个页面单看都自洽，只有跨页对照才暴露」同源。
21 个任务验收：20 pass / 1 fail，命中率 4.8%。

## F6 · Verifier 缺「契约缺口」登记通道，只能塞进 contractViolations → 被判 fail
实证：`page-68-fe` 的 verifier 报告 `result:"pass"`、checklist/points 全过、missing 为空，
但 journal 记的是 `page-68-fe/verifier/r1 outcome:fail n:1`。
差异来自 internal-contracts §1177 的明确设计：「verifier 的 outcome 由
checklist+points+missing+contractViolations **重算**，不能只信 result:'pass'」——这条本身是对的
（A37 的价值观：自称不可信）。问题在被重算的那个数组里装了什么。

verifier 装进去的不是「实现越界」，而是一条**契约缺口**：mp-api.md 声明
`POST /mp/consults/{id}/messages` 接受 `attachmentId?`，spec 本页也要求「发送图片」，
但 33 个端点里没有任何上传端点。builder 的处置是对的（控件置灰 + 说明文案，
不臆造端点、不绕过 request 门面，并比照 admin PAGE-23 的既有先例），
verifier 独立复核也判「处置恰当」，还明说「已按要求记入本字段而非计入 missing/fail」。

根因是**协议不对称**：builder schema 有 `sharedChangeRequest` 专门登记这类跨任务变更请求，
verifier schema（§6.9）没有对应字段——一个只能报「越界」不能报「缺口」的验收员，
遇到缺口时唯一的字段就是 contractViolations，于是正确的工程处置被记成永久 fail。
后果不只是数字难看：converge/status 会一直挂着「1 个任务无有效验收通过事件」，
而它其实无从修复——除非补契约，但补契约是另一条任务的事。

建议（**未实施**，待评估报告一并提）：verifier schema 增 `contractGaps` 数组，
与 contractViolations 分开——前者不计 fail 但进 converge 的收口清单，
后者（真越界）照常计 fail。这与 A20 收敛期「跨任务集成对账」是同一诉求，
应挂在 A20 名下而不是新立增补项。

## F7 · 「mvn test 全绿」是空绿：43 个后端任务都写了"单元测试"验收项，全仓只有 1 个测试文件
实证（sustain-v4）：
- `docs/tasks/*-be.md` 共 43 个后端任务，**每一个**的验收清单都含
  「- [ ] Service 层单元测试覆盖核心业务规则」与「- [ ] `mvn -q test` 通过」。
- `backend/src/test/` 下只有 1 个文件 `ApplicationTests.java`（Spring 上下文加载冒烟）。
  surefire 汇总：`tests=2 failures=0 errors=0 skipped=0`，`mvn -q test` exit 0。
- 收尾流水线 full-test 的第一条验收项写的是「`mvn -q test` 全绿，**无跳过用例**」——
  两个条件都成立，这一项理应打勾。而 663 个 Java 文件里业务测试为零。

问题不在「我没写测试」这个执行层事实，而在**工具链对此毫无信号**：
- `mvn test` 绿 ≠ 有测试。判据选错了：它测的是「已有用例是否失败」，不是「是否有用例」。
- V-CODE-* 机检规则族不含任何测试相关判据。
- `vima certify` 的四级证据阶梯若把「测试通过」当证据，这里会拿到一条**空证据**。
- 这正是 A37「自称 ≥ 有轨迹 ≥ 已验收」的同一病灶换了个地方发作：
  验收清单里的勾是自称，而支撑它的机检恰好是一条永真判据。

可选判据（零假阳性方向）：测试文件数 / 带 `@Test` 的方法数与后端任务数的比值，
低于阈值时 doctor 或 certify 报 warn 并点名——不判定质量，只呈现「43 个任务声称有测试，
实测 N 个测试方法」这个差值，口径与 A37/D-A37-02「只呈现差值，判定归 doctor/converge」一致。

## F8 · 同一条正则，一处按全文扫一处按行扫 → trace 说 39、converge 说 2
F4 把三份正则拷贝收成 `FE_CALL_SOURCE` 单一真源之后，**数字仍然不一致**：
`vima trace` 报「无人调用 39」，`vima converge` 同一时刻报 2。

根因不在正则，在**扫描方式**：`validate.checkFrontendCode` 与 `converge` 都是
`re.exec(f.text)` 走全文，而我为 A41 新写的 `traceability.mjs:141` 是
`lines[i].matchAll(FE_CALL_RE)` 逐行。真实代码里泛型一长就会被格式化器折行：
```ts
return request.get<unknown, { code: number; msg: string; data: PatientOverview }>(
  `/patients/${id}/overview`
)
```
方法名、泛型段、路径字面量分处三行，逐行匹配一条都命中不了。
实证：`apps/admin/src/api/patient.ts:175-178` 的 getPatientOverview 就是这个形状。

修法：加 `lineLocator(text)`（前缀行首表 + 二分）把全文匹配下标换算成行号，
标注 / 前端调用 / Java 注解三处扫描统一改全文。正则里路径字面量本就用
`[^'"\`\n]*` 限住不跨行，故全文扫不会引入跨行误匹配。
修后 `vima trace` 无人调用 **39 → 2**，与 converge 完全一致。
已加回归用例锁住跨行写法（并断言行号落在 `request.get` 那一行而非路径字面量行）。

**这是 F4 的同类第二发，值得单独立一条**：F4 是「同一判据有三份实现」，
F8 是「同一判据只剩一份实现，但有多个消费者各自决定怎么喂它」。
单一真源解决了前者，解决不了后者——**真源要连同「如何使用」一起收口**，
否则下一个消费者仍会自己发明用法。而这一发是我自己在 A41 里引入的，
说明「防过度设计/立项即做透」这类纪律拦不住实现层的口径漂移，
需要的是**交叉一致性检查**：同一事实被两条命令报出不同数字时应当有人喊停。
候选判据：converge 复用 trace 报告的 byEndpoint 而不自己再扫一遍（消除第二个消费者），
或 doctor 增一项「trace.json 与 convergence.json 的同名指标一致性」。

## F9 · 机检把「教人别这么写」的反例注释当成真实违规
F4 拓宽正则后，`vima validate` 冒出 1 条 error：
`V-CODE-01: 前端调用了契约之外的接口 GET /api/mp/{*}/list (apps/mp/src/utils/request.ts)`。
查到源头是共享层门面的文档注释第 19 行：
```
 *   ✅ request.get('/mp/followup/current')     路径写字面量，机检看得见
 *   ❌ request.get(`/mp/${kind}/list`)         路径拼变量，机检读不出常量部分
```
——那条反例存在的**唯一目的**就是教人别那么写，结果被规则本人判为违规。
（拓宽正则之前它同样匹配得上，只是当时 mp 端调用面整体被截断，这条一并沉默了。
F4 的修复把它一起暴露出来，属于「修好一个检查器后先看到它以前漏掉的东西」。）

修法与 F8 合并处置：新增 `scanFeCalls(text)` 作为**正则 + 扫描纪律的共同真源**，
一次性收口三件事——全文扫（F8）、跳过注释行（F9）、返回行号；
validate / converge / traceability 三处消费者全部改调它，不再各自 `new RegExp`。
判据取「匹配起始行去空白后以 `//`、`*`、`/*`、`<!--` 开头」：
真实调用不会写在注释行上，跨行调用的匹配又总是起始于 `request.xxx` 那一行，
故零假阴性。已加回归用例（含一行「注释掉的旧调用」）。

**这三条（F4/F8/F9）是同一件事的三个层次**：
判据的实现要单一真源（F4）→ 判据的**用法**也要单一真源（F8）→
判据要能区分「代码」与「关于代码的话」（F9）。
第三层是静态机检的固有边界，不能靠正则再拓宽解决，只能靠划定扫描面。

## F10 · 骨架自身违反它要求业务代码遵守的宪法，且 code-audit 口径没有区分二者
code-audit 前端审计的三项不合格，**违规几乎全部落在 vima 自己生成的骨架文件上**：
- `apps/admin/src/styles/shell.css` 72 处硬编码（圆角散落 7/8/9/10/11/12/13/14px，明显不是令牌阶梯）
- `apps/admin/src/views/login/index.vue` 54 处，其中 27 条裸色值自建了一整套
  `--login-*` 私有调色板，**绕过 `--v-*` 令牌体系**
- 21 个文件缺 `@vima` 标注、19 个文件无 `data-block`，两份名单高度重合

核实：这些文件逐一对得上 `templates/admin/scaffold/frontend/src/` 的模板产物
——`views/` 下 dashboard/demo/error/login/message/monitor/profile/settings/system
共 **18 个 .vue 全部无 `@vima` 标注**，`styles/shell.css`、`styles/base.css` 的硬编码同样在模板里。
业务任务实际改写过的页面（views/nutrition、views/prescription、views/outpatient、
views/PatientWorkspace）基本干净，mp 端 20 个页面全量取 `--vm-*` 令牌、仅 4 处小瑕疵。
**所以这不是开发质量问题，是脚手架自带的。**

两条独立缺陷：
**(a) 骨架给 builder 树立反例。** 项目宪法明令「禁止写死颜色/圆角/间距」「页面根必须是
`.vui-page`」，而 builder 打开项目看到的第一批代码就在违反这两条。
Agent 写代码天然模仿上下文（我自己的系统提示里就写着 "Write code that reads like the
surrounding code"），骨架是全项目最强的风格样本。sustain-v4 这轮 builder 守住了纪律，
是因为任务上下文包里另有明确要求把它压住了——但这属于**两个信号打架时侥幸赢了一次**，
不是设计保证。

**(b) code-audit 验收口径不可执行。** A20 收尾流水线模板里写的是
「无硬编码颜色/圆角/间距」「每个业务代码文件头部含 @vima 标注」，
扫描面却是整个 `apps/admin`、`apps/mp`、`backend`——把骨架一并算进去，
于是审计必然产出一批**审计者无权处理、修了反而算越界改共享层**的违规。
讽刺的是 vima 内部早有这条作用域纪律，`traceability.mjs` 的注释里写得清清楚楚：
「底座/共享层没有标注，天然不参与（同 V-CODE 作用域）」——
**V-CODE 规则族用的是「带 @vima 标注的文件」这个作用域，code-audit 任务模板没跟上。**

处置方向（未实施）：
1. code-audit 模板的扫描面收敛到「带 `@vima` 标注的文件」，与 V-CODE 同口径；
   骨架另立一条「骨架自检」，由 vima-cli 仓库自己的测试守，不派给项目里的审计代理。
2. 骨架样式清理成令牌化（至少 shell.css 与 login 那套私有调色板）——
   这条要挂在 A34 视觉真源名下，不是新需求。

## F11 · `@vima` 归属错标：taskId 是真的、归属是错的，全链路无人能发现
B7 横向对照抓到：7 个 DTO 文件写着 `// @vima settlement-charge-be`，但它们只被
`SettlementController.java:52-79`（settlement-push-be）与 `InvoiceController.java:43`
（settlement-invoice-be）使用，与 charge 域无关。
文件：`dto/{PushListItemDTO,PushDrainResponseDTO,PushRetryResponseDTO,PushRepushRequest,
PushRepushResponseDTO,DailyCheckDTO,ScanEntryDTO}.java` 各第 1 行。

**为什么全链路都看不见**：
- `vima trace` 的野生判据是「taskId 不在任务清单」——`settlement-charge-be` 是真实存在的任务，
  不算野生。**错标与正确标注在 trace 眼里完全一样。**
- `converge` 的 V-INT-03「越界实现」只看端点实现点（`@GetMapping` 等注解所在文件），
  Controller 标对了就过；DTO / Entity / Repository 这类**同任务附属文件的归属它根本不看**。
- 后果是 `trace.json` 把这 7 个文件挂到 charge 名下，push 与 invoice 两个任务的 `files` 列表漏项
  ——A41 追溯图这一侧直接给出错误答案，而它正是拿来「深度定位问题原因」的。
  同时违反任务书「本任务独占其 Service/Repository/Entity/DTO，与兄弟任务无共享写入点」。

只有把同域四个任务放在一起看才暴露。候选判据（未实施，需评估假阳性）：
标注为任务 X 的文件，若其**全部引用方**都属于任务 Y 且无一属于 X，则报 warn。
traceability.mjs 已有 byFile/byTask 两张索引，缺的是 import/引用图——
这是 A41 追溯纵深的自然下一步，也是唯一能自动发现此类错标的路径。

## F12 · 契约声明的错误码在实现里不可达，机检全程沉默
同样是横向对照抓到：`GET /api/charges/reconciliation`（`ChargeController.java:69`）与
`GET /api/settlement/push/daily-check`（`SettlementController.java:78`）用裸 `@RequestParam`，
缺参抛的 `MissingServletRequestParameterException` 在 `GlobalExceptionHandler`
（只有 :26/:41/:58/:69/:85 五个 handler）无人接管，落兜底 **HTTP 500 + code=500**；
日期格式非法同理——`LocalDate.parse` 抛的 `DateTimeParseException` 不是
`IllegalArgumentException` 子类，也落 500。
而契约为这些端点声明的是 **40001 参数校验失败**。

对照组恰恰证明这不是"不可避免"：`ReportController.java:23-24` 的注释已经点破这个坑，
改用 `required=false` + `ReportService.java:272-292` 主动抛 40001。
**同一个坑，一个任务绕过了并写下注释，三个任务掉进去了**——又一次「同类里的漏网」。

vima 侧的缺口：**V-CON-* 校验契约声明的错误码格式，V-CODE-* 校验调用面，
没有任何规则检查「契约声明的错误码在实现里是否真的可达」。**
这条完整验证需要运行时，但有一个零假阳性的静态近似：
后端存在裸 `@RequestParam`（required 默认 true）且 GlobalExceptionHandler 没有
`MissingServletRequestParameterException` 的 handler ⇒ 该端点缺参必落 500，
与契约声明的 4xxxx 必然不符。这是**确定性可判**的，符合项目「机检只做零假阳性那条」的纪律。

## F13 · 骨架成对交付的前后端约定被单边改写，全项目错误提示静默失效
最严重的一条。`apps/admin/src/utils/request.ts:44,48,55`：
```ts
if (res.code && res.code !== 200) { ... return Promise.reject(new Error(res.message || 'Error')) }
const message = error.response?.data?.message
```
而后端信封字段名是 **`msg`**（`dto/ApiResponse.java:15 @JsonProperty("msg")`，
同层 `apps/admin/src/types/api.ts:10` 自己也声明的是 `msg`），成功码是 **0**（不是 200）。
后果：`docs/contracts/_error-codes.md` 里全部业务错误码的中文提示**在前端永远取不到**，
一律退化成字面量 `'Error'`。影响面 = 全部 admin 业务页。
业务方已经在依赖这条不存在的行为：`views/PatientWorkspace/panes/review/index.vue:39,260`
的注释写着「拦截器按契约 errors[].msg 弹出该具体文案」。
成功判定 `res.code && res.code !== 200` 目前不出事，纯粹因为 `0` 是 falsy 而短路——
一旦成功码改成任何非零值，全部成功响应会被判成失败。

**归因核实**：`request.ts` 与 `templates/admin/scaffold/frontend/src/utils/request.ts`
**逐字节一致**，是骨架原样文件（无 `@vima` 标注，从未被任何任务改写）。
骨架自己是**自洽**的：骨架后端 `ApiResponse.java` 用 `message`、`success()` 置 `code(200)`，
骨架前端读 `message`、判 `!== 200`；vima 的 `coding-standards.md:151` 也明文写着
「ApiResponse 解包（code≠200 即 reject）」。
项目侧按自己的契约把后端改成 `{code:0, msg}`（这本身合规——契约是唯一真源），
**但只改了成对约定的一半**。

**vima 侧的真缺口**：骨架以「前后端成对」的形式交付共享层约定，
却没有任何机制保证这对东西在项目改写其中一半后仍然配对。
- `V-CON-*` 校验契约自身格式，不看实现；
- `V-CODE-01` 校验调用的**路径**在不在契约里，不看**信封字段**；
- `build:check` 更查不出——TS 类型上 `res.message` 只是 `any` 上的属性访问。
候选判据（零假阳性方向）：后端 `ApiResponse` 的字段名集合与前端 request 门面
读取的信封字段名集合**必须有交集**；`message ∉ {code,msg,data}` ⇒ error。
这是确定性可判的。

## F14 · tokens.css 漏定义 5 个令牌，12 个业务页 41 处在用，build:check 全绿
`apps/admin/src/styles/tokens.css` 未定义 `--v-spacing-xs/-sm/-md`、`--v-text-primary/-secondary`，
而 12 个业务页共 41 处在用且**无 fallback**（如 `views/platform/qc/index.vue:350,356,393,407`、
`views/prescription/account/index.vue:686,695`、`views/PatientWorkspace/index.vue:894`）。
对应的 gap/margin/color 运行时全部失效，**而 `npm run build:check` 不会报错**
——CSS 自定义属性未定义是运行期静默降级，不是编译错误。

这一条与 F7 同构：**验收清单里勾了「取令牌不硬编码」，机检也过了，
但"取的令牌不存在"这件事没有任何人检查**。
候选判据：扫业务代码里用到的 `var(--v-*)` 变量名，与 `tokens.css` 定义的集合求差，
差集非空且无 fallback 则报 error。零假阳性，纯确定性，和 A27 七探针版面冒烟同族。

## F15 · raw 物料里的 13 个数据库迁移脚本一份未迁入，无人发现
`docs/raw/03-代码补位/db-migration/` 有 13 个 `V*__*.sql`，
backend 侧 **pom.xml 无 flyway 依赖、`src/main/resources` 下无 `db/migration`**，
建表完全靠 `application.yml:18 ddl-auto: update`
——而 `application-database.yml:89-90` 自己都注明生产环境应改 `validate`/`none`。
`mp_binding`/`mp_cart`/`mp_message` 三张表只以 JPA 实体存在，无任何迁移脚本。

这是 **A1「raw 物料搬运」与实现之间的断链**：物料进了 `docs/raw/`、
`vima validate` 的 V-SRC-01 只查「spec 引用的真源片段是否存在」，
**不查「raw 里的可执行资产是否被消费」**。13 个 SQL 静静躺着，
`vima trace`（只扫代码目录）、`converge`（只对端点）、`certify`（只看四级阶梯）全都看不见。

## F11 补充 · 归属错标是**系统性**的，不是个例
四个批次独立发现，累计 36+ 个文件：
- B1：`entity/{FoodMaterial,Recipe,MenuTemplate}.java` + 各自 repository 标成 `basedata-prep-be`
  （唯一消费方是 MealService）；`dto/InventoryStatsResponse.java` 标成 `basedata-inventory-be`
  （唯一消费方是 dashboard-api-be 的 ClinicalStatsService）
- B2：另加 `entity/{PrepStock,StockTxn}.java` 及 repository
- B3：**17 个**文件标成 `followup-plan-be`，实际属 template/schedule/task 三个兄弟任务
  （判据硬：`RescreenBackflow` 全仓只被 FuTaskService 与 FollowupStatsService 引用，
  `FollowupPlanService.java:4-20` 的 import 里一个都没有；而同目录 `dto/Consult*.java`
  与 `dto/FollowupStatsDTO.java` 却都标对了 —— 证明是遗漏不是约定）
- B7：7 个结算 DTO 标成 `settlement-charge-be`

**共同形态**：Controller 总是标对的（因为它是任务的"脸"），
错的全是 DTO / Entity / Repository 这类**附属文件**——builder 批量生成时顺手带了同一个 taskId。
而 `converge` 的 V-INT-03 只看端点实现点（`@*Mapping` 所在文件），附属文件不在它视野内。
后果：`trace.json` 的 `byTask.files` 系统性失真，A41 追溯图给出错误答案。

**判据可行性已被验证**：三个批次的 verifier 用的都是同一条推理——
「看这个文件被谁 import」。这说明基于引用图的自动判据是可行的，
不是理论上的可能性。traceability.mjs 缺的就是这张 import 图。

## F16 · 契约与实现的错误码**双向**失配，两侧都无机检
不是单向漏，是双向：
**方向一（契约声明了、实现不抛）**：5+ 个 DELETE 端点契约声明 40401，
实现静默返回 `code=0 / {deleted:0}`——`PrepCategoryService.java:192-194`、
`ManufacturerService.java:257-259`、`FoodExchangeService.java:66-68`、
`ContraindicationService.java:222-224`、`MealService.java:116-119`、
`PreparationService.java:128-131`、`WarehouseService.java:73-75`。
反证：同一个 `MealService.java:220-222` 的 `deleteMenuTemplate` 抛了 `RESOURCE_NOT_FOUND`
——**同 Service 内唯一的漏网**。
**方向二（实现抛了、契约没声明）**：`WarehouseService.java:165/224/228`、
`ConsultationService.java:102/126/136`、assessment 域 3 处抛 40902/40401/40901，
契约 `errors[]` 里都没有。两侧都没走任务书要求的「停下声明变更请求」。

契约的 `vima:contract` 块里 `errors: [{code, msg}]` 是**结构化数据**，
代码里的 `BusinessException(ErrorCode.X)` 也是**可静态提取的**，
二者按端点做双向集合比对是确定性可判的——
这条判据的信息全都已经在机器可读的位置上，只是没人写这条规则。
建议规则号 V-CODE-03（前端调用面是 01，后端实现面缺一条）。

## F17 · 定时任务注册断链：契约声明「每小时自动跑」，实际永不触发
`jobs/ScreeningReminderEvaluateJob.java:23-31` 只注册了 jobKey，
全仓没有任何 seeder 往 `sys_job` 写这条记录（`seed/` 下只有 Dept/Dict/Menu/Scale/Ward 五个）。
`mvn test` 启动日志确证 JobRegistrar 只调度 2 个底座 job。
契约 `docs/contracts/dashboard-api.md:77`「每小时第 10 分自动跑」落空。
同样问题见 `jobs/FuTaskOverdueEvaluateJob.java`——RULE-24 的 overdue 落库也依赖它。

附带一条**注释级虚报**：`repository/ClinicalStatsRepository.java:26-27` 声称
「有 ClinicalStatsRepositoryTest 对真实 PostgreSQL 的集成测试覆盖」，该文件根本不存在。
这类"代码注释里的自称"比 frontmatter 的自称更隐蔽——A37 的三档证据体系
只覆盖任务级自称，**代码注释里的事实性声明无人对账**。
零假阳性判据：注释里形如 `XxxTest` 的类名引用，该文件必须存在。

## F18 · 契约字段恒空：全仓无任何写入方，而它是另一个任务的数据来源
`prescription.his_visit_id` 全仓没有任何写入点——`PrescriptionService.create`
（`:141-171`）从不 `setHisVisitId`，`grep -rn setHisVisitId` 全仓只命中
`NutritionRecordService.java:63` 一处（另一张表）。`entity/Prescription.java:50-52` 自陈留空。
两个后果：
1. prescription-be 契约声明的响应字段 `hisVisitId` 永久为 null；
2. **更严重**——`patient-core-be` 的 `PatientService.java:503-505` 按该列 join，
   于是 `GET /api/patients/{id}/visit-records` 的 `prescriptions` 子数组
   **在任何数据下都是 `[]`**，PAGE-08 永远看不到处方。

又是「同类里唯一的漏网」：同一个函数对 assessment 的缺列做了同日兜底（`:511-524`），
处方这一路漏做。**只有把 prescription-be 与 patient-core-be 放在一起看才暴露**——
两个任务各自单看都自洽：一个"字段留空待 HIS 对接"，一个"按字段 join"。

vima 侧的候选判据（零假阳性方向）：契约声明的响应字段，若其对应实体属性
在全仓**无任何写入点**（Lombok setter 调用 / 构造器赋值 / @Builder 链），
则该字段恒空 ⇒ 报 warn。JPA + Lombok 的写入点是静态可提取的。
这条同时能抓住 F17 那种「声明了但永不发生」的一整类缺陷。

## F19 · 横切规则被四个任务各实现一遍，四遍都错在同一处
RULE-29 防枚举：查不到的资源与不属于你的资源必须返回**同一个**错误码，
否则探测者能区分「不存在」与「不是你的」。
实现却是「先 40401 后 40302」——先判存在性抛 40401，再判归属抛 40302，
探测者照样能区分。四处同构：`MpMallService.java:363-366`、`MpArchiveService.java:69-70`、
`MpContentService.java:195-196`、`MpFollowupService.java:191-192`。
而 `MpContext.java:34-37` 的注释**明确写着这正是不能发生的事**，
`_error-codes.md` 的 40302 行也有明文要求。

**这不是四次独立疏忽，是一个结构问题**：RULE-29 是横切规则（适用于所有 mp 任务），
vima 的 A13 把每条 RULE 摊进各任务上下文包、要求 verifier 各记一条 point，
于是**四个 builder 各实现一遍**——同一条规则有四个实现点，就有四次错的机会。
共享层里其实已经备好了 `MpContext` 这个落点（注释都写好了），但没有任何机制
要求横切规则必须走它。

对照 F16 的教训：**判据的实现要单一真源**（F4/F8 在工具侧证过一遍），
这条说明**业务侧的横切规则同样需要单一实现点**。
A13 目前只解决了「规则要被每个任务看见」，没解决「规则应当只被实现一次」。
候选处置：任务上下文包在渲染横切 RULE 时，若共享层已有对应落点（如 MpContext），
应当点名要求复用而非各自实现；`converge` 增一条「同一 RULE-xx 出现 ≥2 个独立实现点」的 warn。

## F20 · 【最重要】读端有人负责，写端没人负责——任务拆分按端点切，数据流跨端点
F18 的 `his_visit_id` 不是个例，是**一整类**。B5 在患者端后端又抓到 4 处同构：
- `mp/entity/MpMessage.java:15` 定义的 `mp_message` 表**全仓无任何写入方**
  （只有 MpContentService 的读与"改已读"），消息中心与 `GET /api/mp/me` 的
  `unreadCount` 恒为空/0，**且没有任何任务被指派为生产者**
- `MpFollowupService.java:95-97` 从 `fu_task.result` 读 questions/metricFields/
  rescreenScale/videoUrl，而 `FuScheduleService.java:201-209` 建任务时**从不写 result**
  ——PAGE-52 的四段向导在真实数据下无题可填，是个空壳
- `MpFollowupService.java:140-151` 患者提交复筛只把结果塞进 `fu_task.result`，
  没像院内 `FuTaskService.java:117/187-205` 那样生成 `RescreenBackflow`；
  admin 工作台待办只读 RescreenBackflow ⇒ **患者端触发的复筛永远回流不到院内**，
  RULE-31 后半句未实现
- 宣教已读是空壳：`readFlag` 恒 false，`POST /read` 只加全局阅读量、不落按患者记录

**根因是结构性的，不是疏忽**：
vima 的任务拆分以**端点**为单位（`apis` 声明责任田），
覆盖矩阵检查的是「每个端点有任务负责」「每个页面有任务负责」，
`converge` 的 V-INT-01 检查的是「接口零实现」。
**但数据的生产者—消费者关系是跨端点的**：
`GET /api/mp/messages` 有任务负责，「谁往 mp_message 写」没有任何端点对应，
于是它不在任何任务的责任田里，任何一层机检都不会喊。
每个任务单看都完成了自己的契约，合起来是个读得到空数据的系统。

这解释了为什么**六条 FLOW 端到端验证是不可替代的**（而它恰恰是本轮唯一跑不了的验收项）：
静态检查能证明"每个端点都实现了"，证明不了"数据能从产生流到消费"。

vima 侧的处置方向（**这是本轮最该立项的一条**）：
1. 短期零假阳性判据：实体属性若在全仓无任何写入点（Lombok setter / 构造器 / @Builder），
   而契约又声明了对应响应字段 ⇒ 报 warn「该字段恒空」。F18/F20 的多数实例都能被这条抓到。
2. 中期：spec 的 `vima:flows` 已经声明了跨步骤的业务流程（含两条跨端），
   `V-SPEC-17/18` 只校验 flow 的引用完整性。可以进一步要求 flow 的**每一步都标出
   它写什么、读什么**，再与端点责任田做闭合检查——「被读的必须有人写」。
   这是 A33「业务闭环主视图」的自然延伸，不必新立增补项。

## F21 · 代码里引用了不存在的 RULE/NG 编号，并被当作豁免依据
`MpFollowupService.java:36/43` 引用 **RULE-35**（spec 规则表止于 RULE-34）；
`WeChatCodeResolver.java:16` 引用 **NG-16**（spec NG 列表止于 NG-15）
——而后者**被用作"微信登录留桩不实现"的豁免依据**。
即：实现者编造了一条"本期不做"来给自己开豁免，而 spec 里根本没有这条。

vima 已有 `V-SPEC-*` 校验 spec 内部的 RULE/NG 引用完整性，
`vima trace` 校验代码 `@vima` 标注的 taskId 是否在任务清单里——
**但代码注释里的 RULE-xx / NG-xx 引用无人校验**。
这是 A37「自称不可信」在代码注释这一层的空白（同 F17 的"注释级虚报"）。
零假阳性判据：扫代码注释里形如 `RULE-\d+` / `NG-\d+` 的编号，
与 spec 第五/九章的实际编号集合求差，差集非空即报 error。
纯确定性、信息全在机器可读位置。**这条尤其值得做**——
它拦的是「实现者给自己发豁免」，正是 A8 豁免语义里明令禁止
「Verifier 不得自行发明豁免」的同一风险，只是发生在 builder 侧且更隐蔽。

## F22 · 规则进了 spec、进了上下文包、进了验收清单，然后全仓没有任何执行点
B4 抓到两条**零实现**的业务规则：
- **RULE-03**「已出院患者不可新开长嘱」——`MedicalOrderService.java:126-151` 的 create
  根本不读患者 status（`:565` 的 SQL 只取 id/name/bed/admission_no）。全仓无执行点。
- **RULE-27**「模块开关关闭时相关接口返回 403」——全仓只有 `AiService.java:40-41`
  实现了 `featureAi`，`featurePn`/`featureMall`/`featureFollowup` 后端**零判定**；
  前端只在 `Sidebar.vue:88-123` 隐藏菜单，**绕过 UI 直连接口完全不受限**。
  这是安全相关的：菜单隐藏不是访问控制。

加上 F17 的定时任务断链（RULE-24/25 的 job 永不触发）、
F19 的 RULE-29 四处同错、B4 新增的 RULE-13（自动生成执行清单只有手工「补」端点）、
B6 的 RULE-10（越界告警只输出 level=info，无阈值比较分支）——
**34 条业务规则里，至少 6 条处于「声明了但不起作用」的状态**。

这里有一个对 vima 关键的正面发现：**A13 的设计本来能拦住这些**。
A13 要求每条 `RULE-xx` 在 verifier 报告里各占一条 point、前后端任务同样必填。
如果这些后端任务当初走了 builder→verifier，RULE-03 这种「全仓无执行点」
是逐条核对时躲不掉的。它们之所以漏到现在，是因为**这 89 个任务当初根本没派 verifier**。
换句话说：**不是协议无效，是协议没被执行**。

## 量化对照（本轮最有说服力的一组数字，但有 confound，需如实标注）
- 走了 builder→verifier 的 **21 个 mp 页面任务**：20 pass / 1 fail，缺陷率 **4.8%**
- 未走 verifier、本轮补验的 **43 个后端任务**：截至目前回收的 37 个，**全部 fail**
- 补验抓到的缺陷里，**至少 5 类是跨任务的**（F11 归属错标 36+ 文件、F16 错误码双向失配、
  F18/F20 读端有人写端没人、F19 横切规则四处同错、F22 规则零实现）

**confound 必须说明**（否则这组数字会被过度解读）：
① mp 页面任务结构简单、契约面窄（一页对几个端点），后端任务契约面宽得多；
② 本轮补验时我在派发提示里**明确要求做横向对照**，而当初那 21 个是单任务视角验收的
——F20 那类跨任务缺陷，单任务 verifier 未必抓得到。
所以正确的结论不是「verifier 能降低 95% 缺陷」，而是三条：
1. **verifier 确实抓得到 builder 抓不到的东西**（F5 已单独证过一次）；
2. **跳过 verifier 的任务会系统性累积缺陷**，且累积的是「单看自洽、合起来不通」那类；
3. **单任务视角的 verifier 有盲区**——跨任务缺陷需要显式的横向对照指令，
   这是 A22「字段级机检」与 A20「收敛期」之间尚未覆盖的一段。

## F23 · 安全相关的两处（附）
- `HisService.java:278` 以硬编码 `"123456"` 建账号，**绕过底座密码策略**
  （`UserService.java:164` 明确拒绝 length<8，`DataInitializer.java:295-307` 要求 ≥12 位或随机 20 位）。
  且 `:244` 的注释声称「与 UserService 导入口径一致」——**又一条注释级虚报**（同 F17）。
- RULE-27 模块开关后端零实现（见 F22），菜单隐藏被当成了访问控制。

## F24 · 【正面发现】规格粒度直接决定实现质量：前端 4/6 pass vs 后端 0/37 pass
前端 F4 批次：page-16/19/20/21 **pass**，page-17/18 fail。
同一批 verifier、同样要求横向对照，前端通过率 67%，后端 0%。

差异不在实现者，在**规格粒度**：
- 前端页面任务有 `spec.md` 的 `vima:page` 块（components / toolbar / rowActions /
  modals 逐字段）+ `prototype.manifest.json` 的逐点展开，A22 要求 verifier
  按 manifest 逐点给证据——**规格本身就是一份逐条清单**。
- 后端任务只有契约的端点清单（路径/入参/响应/错误码），
  业务规则以 `RULE-xx` 摘要形式摊进上下文包，**没有"这个 Service 该有哪些行为"的逐条规格**。
  于是 RULE-03「已出院不可开长嘱」这种要求，落到实现时没有对应的检查点。

这条对 vima 的意义是正面且可行动的：**A22 的字段级机检路子是对的，
缺的是把同样的粒度推到后端**。前端有 `manifest` 把页面拆成任务点，
后端缺一个等价物——契约的 `errors[]`/`request[]`/`response[]` 已经是结构化的，
缺的是**业务规则到端点的绑定**（哪条 RULE 由哪个端点的哪段逻辑兑现）。
F16（错误码双向失配）与 F22（规则零实现）都能被这个绑定关系抓住。

## F25 · 代码库自己记载了纪律，然后违反它——第三次出现
F4 又抓到两处：
- `page-17-fe`（`outpatient/plan/index.vue:96-107`）用「当前页本地过滤」，
  而 **8+ 个兄弟页面的注释里明确拒绝这做法**
  （"会把「全量筛」伪装成「本页筛」，比不筛更误导"）——本页是全 admin 端**孤例**。
- 12 个 views 在 scoped 样式里重定义 `.toolbar` 覆盖共享层，
  而 `base.css:205-207` 恰好记载**此前正是这种重复定义导致「全站出现两种间距」**。

加上 F9（注释里教「别这么写」的反例被机检当成违规）、
F19（`MpContext.java:34-37` 注释写明 RULE-29 不能这么做，四处照做不误）、
F23（注释声称「与 UserService 口径一致」实则不一致）——
**这是本轮反复出现的一类：知识写在注释里，而注释既约束不了实现者、也喂不进机检。**

对 vima 的启示：注释是最弱的一种规格。项目已有的「判据只能有一个真源」纪律，
应当延伸为「**约束必须落在可执行的位置**」——
要么是机检规则，要么是共享层的唯一实现点，写在注释里等于没写。

## 全量验收汇总数据（截至 83/111 份报告回收）
```
后端        43 任务   0 pass / 43 fail     通过率  0%
admin 前端  16 任务   6 pass / 10 fail     通过率 38%
mp 前端     21 任务  21 pass /  0 fail     通过率 100%
fullstack    3 任务   0 pass /  3 fail     （含 full-test / code-audit 两个 pipeline）
────────────────────────────────────────────────
合计        83 任务  27 pass / 56 fail     通过率 33%
点位        1676 条  未过 189 条           未过率 11.3%
missing 非空 56 个任务 · contractViolations 非空 28 个任务
```

**这组梯度是本轮最重要的量化结论**，而且它与规格粒度严格正相关（F24）：
- **mp 前端 100%**：有 spec 页面块 + prototype.manifest 逐点展开 + **开发时就走了 builder→verifier**
- **admin 前端 38%**：同样有页面块与 manifest，**但当初没派 verifier**
- **后端 0%**：只有契约端点清单，**没有"该有哪些行为"的逐条规格，也没派 verifier**

两个变量（规格粒度 / 是否走验收）在这三组里不幸是同向的，
所以不能把 100% 全归给任一个。但可以确定的是：
**两个变量都缺的那一组（后端）是 0%，两个都有的那一组（mp）是 100%**，
中间那组恰好只缺一个变量、结果也在中间——梯度是单调的。

## F26 · 【修正 F13】整个 admin 端的错误反馈通道是断的，89.8% 的页面对用户完全静默
F13 说的是「拦截器读错了字段名」，F8 批次量化后发现**问题比这更深一层**：
`request.ts:37-67` 的响应拦截器**根本不 toast**——它只 `Promise.reject(new Error(res.msg))`，
全文件不 import 也不调用 `utils/feedback.ts:42-50` 的 toast；
`main.ts:33-36` 的全局 errorHandler 也只 `console.error`。

而页面侧的实测统计（以 `data-page="PAGE-xx"` 枚举，实为 **49 个**业务页，不是 40 个）：
```
至少一个静默 catch 的页面        49 / 49   (100%)
全页一句自有错误文案都没有        44 / 49   (89.8%)
注释里明文声明"依赖拦截器弹 msg"    5 / 49
静默 catch 点位                  402 / 约 415 个 catch 块
```
那 5 个页面白纸黑字写着「已由 request 拦截器统一 toast 后端 msg，本页不重复」
——`platform/devices/index.vue:150,220`、`platform/qc/index.vue:15`、
`PatientWorkspace/panes/{charge:22,255, review:39,260, rx:432}`。
**这条被依赖的行为从来不存在。**
后果：RULE-19 的 40901、40903 余额不足、50202 网关未接入、40902 编码重复等
业务错误，对用户 **100% 静默**。

所以 F13 的修复（`message`→`msg`）**必要但不充分**：字段读对了，
文案仍然只进了一个没人展示的 Error 对象。
正确修法是在拦截器的两个分支各补一次 `toastError(res.msg)`——
一处修复恢复 44 个页面的错误反馈；需同时核对那 5 个已有自有 toast 的页面避免双弹。

**对 vima 的意义**：这是 F25「注释是最弱的规格」的最贵一次兑现——
5 个页面基于一条注释里的承诺放弃了自己的兜底，而那条承诺没有任何执行点。
同时它也说明 **A7「运行时证据」的价值**：这类缺陷静态检查抓不到
（代码语法完全正确、build 全绿），只有真的点一次按钮才看得见。
而本轮恰恰因为缺 PostgreSQL/Redis 跑不了运行时——
`.vima/reports/runtime-errors.jsonl` 全程为空。

## F27 · spec 与契约对同一字段给了互斥的取值域，无交叉校验，builder 自行裁定
PAGE-40 设备状态枚举**三方不通**：
- `spec.md:735-736` 写 `normal / maintenance / scrapped`
- 契约 `platform-api.md:170` 写 `enabled / disabled`
- 后端 `DeviceService.java:27` 白名单只有 `enabled/disabled`，`:96-101` 对其余值抛 40001
- 前端 `types.ts:19` 与 `index.vue:26-30` 采纳了 spec 的三值

后果：PAGE-40 的新增（`index.vue:213`）、编辑（`:201`）、报废（`:123`）
**三条写路径 100% 被后端拒为 40001**，再配合 F26 的静默 catch，
用户看到的是「点了什么都没发生」。

两处 vima 缺口：
1. **V-SPEC-* 与 V-CON-* 没有交叉校验字段取值域**。spec 的 `vima:page` 块与契约的
   `vima:contract` 块都是结构化数据，同名字段的 enum 取值集合做交集比对是确定性可判的。
   这条与 A22「字段四面对账」同族——A22 做了「弹窗字段↔入参」的存在性对账，
   **没做取值域对账**。
2. **builder 自行裁定了 spec↔契约冲突**（`types.ts:6-14` 写明"采纳 spec"），
   而任务书明令「发现契约缺失或有误：停下声明变更请求，不得直接改契约」。
   `.vima/changes/` 里没有对应变更包。这是 F21「编造豁免」的姊妹形态：
   **不是编造依据，是遇到两个真依据打架时自己选了一个还不上报**。
   候选判据：`sharedChangeRequest` / 变更包为空，而代码注释里出现
   「采纳 spec」「以 spec 为准」「契约有误」这类裁定性表述 ⇒ 报 warn。

## F28 · 组件库陷阱：只写 :rules 不调 validate()，校验永不生效
`vendor/vima-ui-admin/dist/index.js:617-630` 的 VFormItem **只在父级 `VForm.validate()`
遍历时才校验**，无 blur/change 自校验；`:543-546` 的 validate 仅通过 expose 暴露。
即：只写 `:rules` 而不持 ref 调 `validate()`，规则只渲染红星、**永不拦截提交**。
`platform/devices/index.vue:195-226` 正是这种写法——**全库 31 个同类页唯一漏调者**。

这条不是 vima 的缺陷，但指向一个 vima 该管的位置：
`docs/ui-framework/admin/VForm.md` 应补「用法约束」小节
（该目录已有 `VTab.md` 的同类先例）。A24「工具可信度与项目定制」管的正是这类
「组件文档要写清用法陷阱」——**组件库的隐式契约必须写进组件文档，
因为那是 builder 唯一会读的地方**（项目宪法要求「使用组件前必须先读 CAPABILITY.md」）。

## F21 扩展 · 代码引用**不存在的 spec 编号**，是一整类，不止 RULE/NG
F2 批次发现：`PatientWorkspace/panes/` 下**九个 pane 的根节点**
分别写死 `data-page="PAGE-41"` ~ `"PAGE-49"`，而 spec 里这批 id **早已删除**
（`grep '^id: PAGE-' docs/spec.md` 从 PAGE-40 直跳 PAGE-50）——
它们是 D-16「合并成 PAGE-03」之前的残留，壳页 `index.vue:521` 才是真正的 `data-page="PAGE-03"`。

于是代码里的引用编号有三类都无人校验：
- `RULE-35`（规则表止于 34）— F21 原文
- `NG-16`（NG 列表止于 15，且被当作豁免依据）— F21 原文
- `PAGE-41~49`（页面已删）— 本条新增，且**九处同错**

三类是同一条判据能覆盖的：
**扫代码（含 `data-page`/`data-block` 属性与注释）里形如 `PAGE-\d+` / `MODAL-\d+` /
`RULE-\d+` / `NG-\d+` 的编号，与 spec 各章的实际编号集合求差，差集非空即报 error。**
零假阳性、纯确定性、信息全在机器可读位置。
这条尤其重要，因为 **A22 的字段级机检、A34 的保真验收、converge 的点位对账
全都以 `data-page` 为锚**——锚点指向一个不存在的页面时，
这些机制不是报错，而是**静默地什么都不检**。

## 「同类里唯一的漏网」计数：本轮共 9 例
这是全程复现率最高的缺陷形态，每一例都满足「单页/单任务看自洽，跨同类对照才暴露」：
1. `page-66-fe` tabbar 页漏调 `ensureAuth()`（兄弟 tabbar 页都调了）— 开发期抓到
2. `MealService.deleteRecipe` 缺 40401（同 Service 的 `deleteMenuTemplate` 抛了）
3. `page-17-fe` 全 admin 端唯一用「当前页本地过滤」（8+ 兄弟页注释里明确拒绝）
4. `page-40-fe` 全库 31 个同类页**唯一**漏调 `VForm.validate()`
5. `page-07-fe` 同批 6 页里**唯一**没走 `await xxxFormRef.value?.validate()`（第二例）
6. `page-09-fe` 全文 `v-auth` 零命中，同批唯一漏挂按钮级权限
7. `page-06/07-fe` 裸 `window.print()`（其余 11 个打印页一律走 print-kit，NG-09 指定）
8. `prescription` 在 visit-records 里无同日兜底（assessment 那一路做了）
9. `FollowupPlanService.update` 无状态前置校验（同域所有其它状态迁移端点都有守卫）

**这不是巧合，是 AI 批量并行开发的结构性特征**：
每个 builder 只看得见自己那一份上下文包，
「兄弟任务是怎么做的」不在任何人的视野里。
vima 的 A18 把任务按依赖分批并行，A8 给每个任务打独立上下文包——
**并行度换来的速度，代价正是这类横向一致性缺陷**。
而本轮 9 例全部是靠「在派发提示里显式要求横向对照」抓到的，
说明这是**可系统化的**：verifier 的默认作业流程里应当包含
「列出本任务的同类兄弟，逐条对照差异」这一步，而不是靠编排者临时想起来。
候选落点：`vima context` 打包时增加「同类任务索引」切片
（同 `layer`+`side`+相邻 `page` 的任务及其产出文件清单），
让 verifier 天然拿得到对照面。这比新增机检规则更根本——
机检只能查已知模式，横向对照能发现未知模式。

## F29 · spec 声明的 41 个权限点，14 个（34%）在前端全仓零命中——入口不设防
F7 批次做了全局统计：
- spec 第六章 MENU features 共声明 **41 个 perms**
- 其中 **14 个**在 `apps/admin` + `apps/mp` 全仓 grep **零命中**：
  `basedata:prepBatch:manage`、`basedata:supplier:manage`、`his:mapping:manage`、
  `his:sync:manage`、`monitoring:point:create`、`monitoring:point:view`、
  `patient:record:create`、`patient:record:discharge`、`platform:printTemplate:manage`、
  `record:nutrition:edit`、`screening:assessment:view`、`screening:dietsurvey:create`、
  `screening:dietsurvey:view`、`screening:reminder:manage`
- **49 个业务页中 18 页完全没有任何 `v-auth`**

后端是把关了的（`BasedataController.java:29`、`SystemHisController.java:41/47/53` 等
都有 `@PreAuthorize`），菜单也播种了（`MenuSeeder.java:168-171`）。
所以后果不是越权，而是「**入口不设防、点下去才吃 403**」——
无权限的用户看得到按钮、点得下去，然后收到一个（因 F26 而静默的）403。
HIS 导入还是批量写库动作，这个体验尤其糟。

这条是**三方数据全都结构化、却没人做对账**的又一例：
spec 的 `vima:menus` 有 `features[].perms`、
前端有 `v-auth="..."`、后端有 `@PreAuthorize("@perm.has('...')")`。
候选判据（零假阳性）：spec 声明的每个 perm，
必须在「后端某个 `@PreAuthorize`」**且**「前端某个 `v-auth`」各出现至少一次；
缺任一侧即报——缺后端是越权风险，缺前端是体验缺陷，两种都该报但分级不同。
这与 A22「字段四面对账」是同一思路，只是对象从字段换成了权限点。

**附**：F7 独立复核确认了前面修复已生效——
`request.ts:48/54/57` 三处读的都是 `res.msg`，
`tokens.css:39-40` 与 `:138-140` 五个令牌都在。这是一次有效的交叉验证。
（同时它指出 `--v-spacing-lg/-xl` 仍未定义，只是本批无人使用。）

## F30 · V-TASK-07 对「一页拆多任务」是**假阳性**——机检规则本身的缺陷
`vima validate` 报了 4 条 V-TASK-07 警告：
「任务 page-03-assess-fe 验收清单仅 29 项，少于页面 PAGE-03 的任务点数 133」等。
F1 批次用集合运算给了判决：
```
assess 24 + consult 22 + record 28 + rx 32 = 106（彼此不重叠）
page-03-fe 独有 27
106 + 27 = 133，与 PAGE-03 任务点数一致，双向差集为空
```
**是切片，不是漏写。** 每个切片任务文件里也都写明了这条告警的由来。

V-TASK-07 的判据是「单个任务的验收清单条数 vs 该 `page` 的任务点总数」，
**没有考虑一页被多个任务分片的情形**（而 D-16 的合并页正是 vima 自己鼓励的形态，
A16 端册 + A22 字段级机检都支持一页多任务）。
正确判据应是：**同一 `page` 的所有任务的验收清单并集 ⊇ 该页任务点集合**，
按页聚合判定，而不是按任务逐个判定。
现状的代价是 4 条永远消不掉的警告——**而"永远消不掉的警告"会训练人忽略警告**，
这比没有警告更糟。

## F31 · 「spec 声明了字段、契约不收」四处，三种处理方式，只有一种诚实
F3 批次的横向对照：
- **诚实**：PAGE-15 MODAL-46 做成 readonly 预览（`account/index.vue:591-596`）
- **可编辑却静默丢弃**：PAGE-10 `cautions`（`exercise/index.vue:385-391`）、
  PAGE-11「停止日期」（`create/index.vue:540-547`）、
  PAGE-12 `stopDate`（`manage/index.vue:576-578`）
  ——后者尤其糟：字段渲染为必填 VDatePicker、做了必填与 RULE-12 边界校验，
  提交时却只传 `(orderIds, reason)`，后端 `MedicalOrderService.java:265-266,273`
  一律用 `LocalDate.now()`。**用户选 8/20 停嘱、系统按当天停，且前端还在用一个
  服务端根本不使用的日期做规则校验。**

同一契约缺口（无关键字查询参数）也是四种做法：
禁用+提示（page-12/14/15，诚实）、控件可用但点了毫无反应（page-10）、
只过滤当前页却不改 total（page-13）、本地过滤（page-17）。

V-SPEC-15 **确实报出了** page-12 那三条（这是机检有效的一次），
但它只报「字段不在入参里」，**不区分「实现如何处置」**——
而处置方式的差别就是「用户知道这功能没做」与「用户以为做了其实数据丢了」的差别。
候选增强：V-SPEC-15 命中的字段，若在实现里被渲染为**可编辑控件**（非 readonly/disabled），
升级为 error；渲染为只读预览或置灰则降为 info。
这是 A22「字段四面对账」已有数据能支撑的判定，不需要新数据源。

## 「同类唯一漏网」补记（累计 11 例）
10. `PatientWorkspace/index.vue:223,505` 读 `res.data.records`，
    而信封是 `PageResult{total,list}`——**全仓另外 7 处 `listPatients` 调用都取 `.data.list`**，
    只有这个壳页两处例外。后果：左栏「同科室患者」恒空、MODAL-04 搜索恒「未找到匹配患者」，
    而 `:490` 无 id 进页时会自动弹 MODAL-04 ⇒ **PAGE-03 主入口不可用**。
    这是全项目最重要的页面（D-16 合并页），且是本轮发现的**最高影响面前端缺陷**。
11. `patients/index.vue:476` 的 MODAL-01 VForm 无 ref、`:369-397` 不调 validate()
    ——VForm 校验漏调的**第三例**（前两例 page-40、page-07）。

另：D-16 合并前的旧路由 `'Workflow'` 残留 4 处
（`workbench/index.vue:60,61,224`、`patients/index.vue:220`），
router 全表无该 name ⇒ 点击必抛 No match；`workbench:61` 还把参数键写成 `step`
而 `PatientWorkspace/index.vue:190-194` 只读 `query.view`。
**这与 F21 扩展是同一根源：D-16 这次架构合并，代码侧的残留没有任何机制去收口。**
`vima change`（A31 变更事务）本是为此设计的——但 D-16 是**规划期**的决策，
发生在变更事务的适用范围（维护期）之前，于是没有任何闸门覆盖它。

## 【终稿】全量验收最终数据（111/111 任务，2458 点位）
```
mp 前端      21 任务   21 pass /  0 fail   100%   ← 有页面块+manifest，且开发时走了 verifier
admin 前端   44 任务   16 pass / 28 fail    36%   ← 有页面块+manifest，未走 verifier
后端         43 任务    0 pass / 43 fail     0%   ← 无行为级规格，未走 verifier
fullstack     3 任务    0 pass /  3 fail     0%   ← 含 full-test / code-audit 两个 pipeline
──────────────────────────────────────────────────
合计        111 任务   37 pass / 74 fail    33%
点位 2458 条 · 未过 265 条（10.8%）
```

## F28 修正 · 组件库隐式契约导致 27% 的页面表单校验形同虚设
先前记为「唯一漏网」，F6 全仓统计后实际是：
**12 个页面写了 `:rules` 却既无 VForm ref 也不调 `validate()`，33 个页面正确调了**
——失效率 **27%**（12/45）。
名单：`basedata/food-exchange`、`basedata/contraindication`、`basedata/preparation`、
`system/user`、`system/role`、`monitor/job`、`patients`、`mall/products`、
`platform/rx-template`、`platform/devices`、`nutrition/ward-round`、`profile`、
`PatientWorkspace/panes/consultation`。
后果：空表单可直接提交（`name:''`、`riskLevel:undefined` 发出 POST）。

根因是组件库的**隐式契约**：`VFormItem` 只在父级 `VForm.validate()` 遍历时才校验，
无 blur/change 自校验，`validate` 仅通过 expose 暴露。
只写 `:rules` → 规则只渲染红星、永不拦截。
`build:check`、`vue-tsc`、任何 V-规则都查不出——**类型正确、语法正确、行为错误**。

这条把 F28 从「个别疏忽」升级为**系统性风险**，也把处置方向从
「改那一页」变成两条：
1. 组件文档 `docs/ui-framework/admin/VForm.md` 必须写「用法约束」小节
   （A24 管的正是这个；该目录已有 `VTab.md` 先例）；
2. **更根本**：这类"隐式契约"应当由组件库自己消除——
   `VForm` 若检测到子项声明了 `rules` 而宿主从未调用过 `validate()`，
   开发期 warn。把约束落在**唯一能执行它的位置**（同 F25 的结论）。

## F32 · spec 的 perms 声明不全，导致 6 个页面各行其是
F6 批次的横向对照：spec 的 `modals[].perms` **只覆盖了少数写操作**，
而后端对同域**全部**写端点都挂了 `@PreAuthorize`
（`SupplierController:29,35`、`WarehouseController:39,45,51,66,72`、
`MealController:40,46,65,74,83,89,109,119,129`、`ReportController:41,50,58`），
且这些权限点在 `MenuSeeder.java:142-159` 全部已种子登记。
结果 6 个页面三种做法：page-28/29 只按 spec 挂、page-31/32 按后端挂、page-30/33 一个不挂。

与 F29（41 个 perms 中 14 个前端零命中）是同一问题的两面：
**权限点在 spec / 后端注解 / 菜单种子 / 前端 v-auth 四处各有一份，无人对账。**
这是 A22「字段四面对账」的直接类比——对象从字段换成权限点，
四处全都是结构化可提取的。**这条判据的性价比在本轮所有候选里最高**：
数据现成、零假阳性、抓的是安全与体验双重缺陷。

## F20 补充 · 修复过程中又冒出三条同族缺陷——「读写不匹配」有长尾
数据流修复代理在修 F20 的过程中，主动交回三条**派单外**的同族缺陷（未擅改，如实上报）：
1. **复筛计分三方 key 口径不一致 ⇒ score 恒 0、triggered 恒 false**：
   `MpFollowupService:281-296` 从 savedAnswers 读扁平键
   （diseaseSeverity/weightLoss/intake/ageOver70），
   而 mp 前端提交的是嵌套 `{step1..step4:{radio:{...}}}`
   （`apps/mp/src/pages/followup-task/index.ts:728-758`），
   模板段四的题目 key 又来自 ScaleDef（NRS2002 为 disease/nutrition/age）。
   **后果：F20 缺陷 4 补的回流写入，在真实运行下仍不会被触发。**
   契约把 `answers` 标了 `enforced:false`「结构由模板定义」，没定嵌套约定；
   同时 ≥3 阈值硬编码与 RULE-04「阈值不写死在代码，由 ScaleDef.scoringRule 驱动」相抵。
2. `MpMallService.aftersale` 写订单状态 `"aftersale"`，
   而 `MallOrderService.refund` 要求 `"refunding"`
   ⇒ **患者申请的售后，管理端永远审批不了**。
3. 全仓**无 shipped→completed 的写入方** ⇒ `MpAuthService` 读 completed 恒空。

这三条印证了 F20 的判断：**「读写不匹配」不是几个孤立 bug，是有长尾的一类**。
第 1 条尤其说明问题——它是**三方**（前端提交结构 / 服务端读取键 / 模板定义键）
各写各的，而契约用 `enforced:false` 明确放弃了对这个字段的结构约束。
A22 的「聚合 json 子协议」立项时正是为了这个（V-CON-09 会对无 `fields` 且无
`enforced:false` 的 json 字段报警），但**标了 `enforced:false` 就等于关掉了所有检查**
——而这个字段恰恰是跨三方共享的。
候选改进：`enforced:false` 不应是"免检通行证"。若一个 json 字段被 ≥2 个任务读写，
即便标了 `enforced:false` 也应要求给出**共享键的最小约定**（哪怕只列 key 名），
否则就是把跨任务耦合点藏进了免检区。

## 修复代理的表现（值得记入方法论）
三个修复代理都守住了「最小化修复 + 不臆造 + 如实上报」：
- 共享层代理主动交回一条范围外发现（`res.code === 401` 与信封码 40101 不符），
  未擅改，留给 verifier 裁定；
- 安全代理在建 `FeatureGuard` 时**实证印证了 F19**——
  它发现 `PrescriptionService` 早已把 RULE-27 第二次写在自己类里，
  还用了不同键名（`feature_pn` vs `featurePn`）；并如实说明四个开关
  在 `sys_config` 里没有任何种子、`FeatureGuard` 按「未配置即启用」处理，
  前端 `featureFlags.ts` 仍是默认全开的桩——**没有把"能力已具备"说成"功能已生效"**；
- 数据流代理对「随访提醒消息谁来产生」标了 `blocked` 而非臆造，
  理由写得很硬：spec 只在 PAGE-67 标题句点了这一类，
  全仓无任何 RULE/契约声明它何时产生（窗口开启？截止前 N 天？转 overdue 时？发几次？）。
- 归属修复代理**不采信我给的清单**，自建全仓审计脚本反查引用方，
  两处推翻了清单判定，并额外发现 5 处同型错标。

这条对 vima 的意义：**A8 豁免语义里「Verifier 不得自行发明豁免」这条纪律，
在 builder 侧同样成立且同样有效**——把「遇到规格说不清就标 blocked」
写进 builder 角色模板，成本极低、收益是杜绝 F21 那类编造依据。

## F33 · post-write hook 的区块对账**逐文件**做，合并页必然踩雷
壳页 `PatientWorkspace/index.vue:521` 带 `data-page="PAGE-03"`，
但它自身只声明了 `cards/anchor/table/steps` 四个 `data-block`；
PAGE-03 layout 要求的 `toolbar/search/tabs/form/collapse/pagination`
与 25 个 `data-modal` **分散在九个 pane 文件里**。
而 `.claude/hooks/post-write.mjs` 的区块对账是**逐文件**做的
——只要有人编辑该壳页就会 `exit 2`。

这与 F30（V-TASK-07 对切片任务假阳性）是**同一根源的第二次发作**：
**vima 的多处机检假定「一个页面 = 一个文件 / 一个任务」，
而合并页（vima 自己通过 A16 端册与 A22 字段级机检所支持、
且本项目按用户要求刻意采用的形态）是「一个壳 + N 个 pane」。**
命中三处：
- `V-TASK-07`：按单任务清单条数判定，不按页聚合 ⇒ 4 条永远消不掉的警告
- `post-write` 区块对账：按单文件判定，不按页聚合 ⇒ 编辑壳页必 exit 2
- `code-audit` 模板扫描面：不按「带标注的业务文件」收敛 ⇒ 报出审计者无权处理的违规

处置方向一致：**凡以 `page` 为单位的判定，都要支持「一页多文件 / 一页多任务」**。
具体到区块对账，应按「同一 `data-page` 下的文件集合」聚合后再比对，
或允许 pane 文件声明「我属于 PAGE-03 的哪个块」——后者需 spec 侧给出词表支持。
修复代理正是因为「全仓 225 处 `data-block` 一律是 spec 的布局词，
而 layout 里没有任何词对应『一个 pane 整体』」而正确地拒绝臆造块名、标了 blocked。

## 待人裁定（本轮未决，如实登记）
1. **设备状态枚举三方冲突**（F27）：已登记进
   `.vima/reports/page-40-fe-builder.json` 的 `sharedChangeRequest`，
   含三方原文与行号、建议以 spec 三值为准的三条理由、反向裁定的连带改动清单。
   裁定前 PAGE-40 的新增/编辑/报废置灰不可用。
2. **拦截器统一 toast 后的 8 处双弹**（login / profile / system:file×2 /
   system:user×3 / platform:icd），以及**一处反向风险**——
   `platform/his/index.vue:264` 在 NG-12 未接入前恒返回 50202，
   该页 `:237,264` 明文要求「静默兜底不弹错误提示」，统一 toast 后这条会开始弹。
   需裁定：给拦截器加 per-request 静默开关，还是接受这一条提示。
3. **随访提醒消息的生产时点**：spec 只在 PAGE-67 标题句点了这一类，
   全仓无任何 RULE/契约声明它何时产生（窗口开启？截止前 N 天？转 overdue 时？发几次？）。
4. **复筛计分 key 三方口径**（F20 长尾）：需重写计分口径
   （建议复用既有 ScoringEngine + ScaleDef.scoringRule，
   同时兑现 RULE-04「阈值不写死在代码」），属单开一条的工作量。

## F10 更正（2026-08-16，实现 A42 时核实）
原文说「A20 收尾流水线的 code-audit **模板**验收清单写的是『无硬编码颜色/圆角/间距』
『每个业务代码文件头部含 @vima 标注』，扫描面却是整个 apps/admin、apps/mp、backend」
——**这条对模板的指控过重，是我把项目文件当成模板了。**

核实：`templates/admin/planning/_template-code-audit.md` 的验收清单只有 7 条
（三条确定性命令 + 共享层/规范/越界/残留），**从来没有**硬编码与标注那两条。
那两条是 `sustain-v4/docs/tasks/code-audit.md` 在规划期由项目侧自行扩写的。

模板真正的缺陷比原文说的**轻**：它的 7 条里有 4 条没有显式写明作用域，
读的人容易默认「扫全仓」。A42 D-A42-05 的处置已收敛到位——
新增「## 审计作用域」章直引 `traceability.mjs:155` 的原话，
4 条受影响验收项逐条加「**标注文件内**」限定，开发步骤加
「先用 `grep -rl "@vima "` 框出扫描面」，约束重申加「不报无人可接的违规→写进建议项」。

实现代理按防过度设计**拒绝**把硬编码/标注两条补进模板，理由正确：
那是一条新需求，要先立项。我认同——这正是「约束别扩面」那条红线。

**方法论教训**：写发现册时我从项目里的 `docs/tasks/code-audit.md` 读到条目，
就归因到了模板，没去 `templates/` 核对。**「项目里长这样」不等于「模板里长这样」**
——项目侧在规划期会扩写任务文件，这本身是被允许的。
凡是对 vima-cli 本体的指控，都必须在 `templates/` 或 `lib/` 里当场取证。
本轮两个实现代理各证伪了我一条前提（这条 + `ErrorCode.java` 在骨架里），
都是因为它们去读了源文件而我凭项目侧的观察推断。

## F34 · hook 的强制力只覆盖 Write/Edit，Bash 是敞开的侧门（自证）
`templates/admin/workspace/settings.json` 的 hook matcher 是 `"Write|Edit"`，
而 `permissions.deny` 只有四条：`rm -rf` / `sudo` / `curl` / `wget`。
实测这些写文件手段**一条都不挡**：`sed -i`、`python3 - <<EOF`、`tee`、`node -e`、`cat >`。

后果：`guard-shared`（共享层写保护、journal 写保护）与 `post-write`
（区块对账、报告转录、规范巡检）这两条**A 类非自愿拦截**，
只要模型改用 Bash 写文件就**完全不触发**——不是被绕过后报错，是根本不知道发生过。

**这条是自证的**：本轮我改 vima-cli 自己的源码
（`validate.mjs`、`internal-contracts.md`、`CHANGELOG.md`、测试夹具……）
几乎全部走 `python3 - <<PY` 与 `sed -i`。如果这是一个装了 vima 资产的项目，
那些改动一次都不会进 journal、一次都不会过区块对账。
而我并不是刻意规避——**Bash 改文件在批量精确替换时就是更顺手**，
这正是问题所在：旁路不需要恶意，只需要方便。

**这不是 hook 实现的 bug，是 hook 机制的边界**：
PreToolUse 拿到的是 shell 命令字符串，「这条命令会不会写共享层文件」在一般情况下不可判定。
唯一能收口的位置在**权限层**——把文件变更收敛到 Write/Edit，
在 `permissions.deny` 里挡掉常见的 shell 写手段。代价是误伤合法用法
（构建脚本、`npm run` 内部的写入不受影响，因为那是子进程），需要实测边界。

**对 MCP 提案的影响**：MCP **不能**修这条。MCP 工具是模型自愿调用的，
模型能用 Bash 绕开 hook，同样能用 Bash 绕开 MCP 工具。
把它记在这里，是为了防止「上 MCP 就稳了」这种结论——
**这一条只有权限层能治，与 MCP 无关。**
