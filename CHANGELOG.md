# 更新日志

版本遵循语义化版本（SemVer）；未发布改动记录在 Unreleased 段，发版时移入对应版本。

## [Unreleased]

### 新增

- **维护期变更事务（增补项 A31，`vima change`）**：维护期变更纪律此前是纯散文协议
  （CLAUDE.project.md 工作协议 + 设计 §13.4），「影响了谁 / 重开哪些 done / 重跑什么 /
  传播完没有 / 差异与批准记录在哪」五问无一可机器回答。新命令五个子命令：
  `open`（spec/契约逐字节基线快照，单变更在途，再开 → CHANGE_ACTIVE exit 4）→
  `impact`（结构化 diff → 受影响页面/接口/规则/任务，reasons 逐条留痕；impact.json
  无时间戳字节稳定）→ `apply`（受影响的 done 任务重开为 pending，调用即授权）→
  `close`（传播闸门：受影响任务全 done + 进程内 validateProject 零 error + 有任务/接口
  影响时进程内 converge 通过，否则 CHANGE_UNPROPAGATED exit 2）。影响面推导全部复用
  既有确定性 join（页面归属 / A18 `ownedApisOf` 负责集 / A13 规则接口交集）。
  同时兑现 `ai-scaffold-benchmarks.md` T2-8（OpenSpec delta 语义，自此以 A31 为唯一规格）；
  与 A20「不做缺陷台账状态机」的边界论证见 v2.1-amendments A31（对象是需求变更事务
  而非机检缺陷，状态迁移由机器闸门判定，无手工宣称位）。
- **交付等级认证（增补项 A32，`vima certify`）**：「进入 MAINTAINING」常被读作「完成」，
  而它只证明 converge 零 error + pipeline done。新命令做只读证据聚合：四级阶梯
  `spec-approved → implemented → converged → pipeline-green`（每级证据取自磁盘既有真源，
  convergence.json 附 sha256），deliveryLevel = 自底向上连续满足的最高级，缺口输出为
  「下一级缺什么」的可执行清单；**显式不宣称** deployable/stable（vima 不采集部署与
  运行期证据——PACT 八级模型「声明八级、落地零采集」的教训对症吸收，不搬八级）；
  模板成熟度（A5 `status`）与项目交付等级双轴分离展示，词面混淆用产物澄清。
  exit 恒 0（评估不是闸门）；不写 lifecycle（等级由证据推导，不落第二状态真源）。
- **业务闭环主视图 + flow 引用机检（增补项 A33）**：flows 是 spec 数据块中唯一
  零引用校验的块——写 `page: PAGE-99` 的流程此前能通过全部规则。新增 **V-SPEC-17**
  （error：步骤声明的 role/page/next/api 引用闭环 + 流程须有非空 steps）与
  **V-SPEC-18**（warn：步骤角色未拥有该步页面的菜单 → 不可达提示）；审计视图新增
  **第⑥视图「业务闭环」**：逐流程回答「用户够得着吗（入口可达性徽标）/ 状态真的变吗
  （接口命中的 transition/calculation 规则）/ 结果查得到吗（终点页 GET 查询出口）/
  谁承接实现（页面 + 接口负责集 join 任务）」，缺口如实标注。渲染 model 增 `tasks`
  切片（契约 §11；刻意不含 status——运行态入渲染产物会把 A12 新鲜度机检搅成常红，
  D-A33-01）。不新建产物文件、不把 flows 塞进 prototype.manifest.json（无消费方即镀金）。
- **设计工序两段化 + 产品风格取向（增补项 A30）**：A29 的逐页整页稿缺一致性机制
  ——N 个页面就是 N 次独立的版面决策，而稿是云端非确定性产物、不进机检，壳层与
  密度的漂移无从检出。改为两段（兑现 A27 延后项 P28 / 提案 §12.1 的 R2 角色）：
  - **Stage A 版面语言**（全项目一次）：每个 `design.pattern` 出一张模式参考页
    （**本项目真实字段名 + `vima mock` 数据 + 空态**，不得用通用示例）→ 人审定版面
    → **固化进仓库**：版面类落 `src/styles/layout.css`、刻度取值落 `src/styles/tokens.css`、
    模式库条目落 `docs/design-language.md`。云端稿到此作废——草稿纸不是产物。
  - **Stage B 逐页内容稿**：只决策内容区（选 pattern、块怎么排、字段取舍、空态、
    动作主次），**不动壳层 / 间距刻度 / 卡片形态**；确需新版面走 `sharedChangeRequest`
    回 Stage A 收编，不在页面里自写 `display: grid`。
  - **风格推导方法论**（D-A30-06/07）：新增模板键 `planning.designLanguage` → init
    安装 `docs/design-language.md`（**userOwned**，update 永不覆盖）。它不是一套配好的
    主题，是一套**推导方法**——预置 N 套行业主题既穷举不完，又会诱导「挑一个最像的」
    而非按项目事实推导，而即兴正是本项要治的病。风格被拆成两层：
    - **不变层**（8 条，不参与推导）：不用渐变顶栏与网格底纹 / 描边优先于投影 /
      语义色同明度带 / 标题字重 ≤700 / 数字 `tabular-nums` / 单一品牌色 /
      深色只作锚不作全局 / 不下载 webfont。一句话骨相「克制的专业工具感」。
    - **可变层**：§2 八项**观察量**（值守模式 / 决策时效 / 使用环境 / 受众 /
      主导数据形态 / 交互设备 / 行业默认色相 / 色彩禁忌）**从 spec 与契约读，
      读不到就问，只能推断的标 `pendingConfirm`**——直接复用 planning-guide 第 3 节
      「信息源分级，默认禁推断」纪律，不另起一套；§3 八条**推导规则**映射到七条
      取向轴（五条原轴 + 深色锚 + 底色温度）；§4 三条**色彩判据**（行业语义取色相、
      与该行业老系统默认色相相距 ≥30°、语义色反推同明度带）。
    - 另含 §5 可 grep 的旧信号清单、§6 六条自检判据（对比度 / 明度带 / 色相距离 /
      深锚占比 / 旧信号 / 触达尺寸，**刻意不做成 CLI 规则**）、§7 定档产物与规则冲突
      裁定位、§8 三份已推导范例（冷光临床 / 深空控制台 / 磐石政务，**标注各自观察量
      输入与推导过程，且显式禁止直接套用**）。
    - **换肤可行度订正**：A27 曾以「库侧 186 处裸值，换令牌只能换 2/3」延后主题。
      逐文件复核后订正——`shell.css` 1386 行仅 1 处裸色值、39 处令牌引用且全走
      `color-mix()` 派生，**外壳与业务页可 100% 换肤**；真正卡住的只有组件圆角
      （库零 radius 令牌）与 16 个类的 Ant 遗留状态色。全深色主题确实不可行
      （`ui.css` 141 处浅色裸值）——故「深色只作锚」写成准则而非偏好。
  - **go.md 5.2.6 回修分流**：版面级不一致（间距刻度 / 版面骨架 / 卡片形态）回
    Stage A 改真源一处修全站，页面级不一致派回本页任务；`_template-fe.md` 增
    「所属 pattern」行。
  - **零 schema / 零机检 / 零渲染器改动**（D-A30-05：主观取向机检不出来，假机检比
    没有更坏）；`lib/` 仅 init 安装清单加一条落点。降级两级：Claude Design 不可用时
    Stage A 回落为直接按取向轴调令牌 + 线框评审；只做 Stage A 不做 Stage B 亦合法。
- **Claude Design 视觉真源工序（增补项 A29）**：carelink-admin 试点实证定案——
  A27 结构机检守「不坏」，视觉上限改由 **Claude Design 逐页高保真稿**负责：
  PLANNING 末逐页出稿（真实字段 + 样例数据 + 空态）并登记 `docs/review/design-links.md`，
  DEVELOPING 按稿 1:1 实现（`_template-fe.md` 新增设计稿登记行），/go 收口新增
  **5.2.6 设计稿校准轮**（版面冒烟归零后逐页截图对照稿校准样式不一致，修复走回修
  通道再复跑冒烟）。开启说明（`/design consent` / claude.ai/design/settings）与
  未接入时的如实降级口径写进 planning-guide 第 8 节；线框/PDL/七探针原样保留守
  结构下限，机检面一分不减。纯工序资产，零内核改动；d2 防漂移断言随全量。
- **create 布局对称化（增补项 A28，改判 D-A16-03）**：端册布局一律 `apps/<id>/`——
  含单端（此前 N=1 落项目根、后补端才进 `apps/`，得到「永远搬不动的混合布局」）。
  唯一决策点在 `buildRoster`，全部消费方按端册 `dir` 数据寻址、零改动；
  存量根布局（`dir "."`）与混合布局**永久合法**，init（A19 存量升级）继续如实写
  `"."`，不提供迁移命令。单端黄金夹具迁至 `apps/admin/`，存量寻址分支由
  c3 系列手写根布局夹具专职覆盖。
  - **项目根卫生资产（D-A28-04）**：新增模板键 `root.scaffold`（`scaffold/root/`）——
    端全落 `apps/` 后项目根不再有端骨架顺带提供的文件；项目级 `.gitignore`
    （`backend/target/`、`.vima/reports/` 等跨端规则只有在根才生效）与项目 README
    （前后端启动/账号/结构导览，自 admin 前端骨架迁入并按 apps/ 布局改写）由此补位，
    与 create/A19 骨架基线同源拷贝；admin 前端 `_gitignore` 相应减负为端内规则。

- **Design-First 第一批落地（增补项 A27）**：把「设计」升格为与契约同级的真源——
  七轮专题讨论（评估 `frontend-layout-quality-assessment.md` + 方案
  `frontend-design-first-proposal.md`）的第一批实现，全部条目反查五个实测症状。
  - **PDL 页面设计语言**（契约 §7，全部可选、声明即承诺——缺省行为与现状逐字节一致）：
    页面级 `design: { pattern, density, fold }`；区块 `name` / `intent` /
    `data: { shape, of, keyFields }`（shape 六枚举含 freeform 显式逃生舱）；
    **操作附着点 `actions`**（贴宿主块标题行，不再为一个按钮独占一条 70px 横带——
    实测 17/50 页面如此浪费首屏 7.4%）；动作 `priority: primary|secondary|overflow`；
    分栏列 `role: primary` 与局部 `density`；弹窗 `presentation: drawer`（4 处「抽屉
    被迫降级成弹窗」的最小修复）。**规格零像素**：放不放得下由框架与探针判定。
  - **V-DSN 校验族**（§8）：01 声明完整性 / 03 同词多例实例名 / 04 形态枚举与 freeform
    意图 / 05 优先级与「一页一个 primary」/ 06 收纳提示 / 07 首屏承诺引用闭环 /
    08 列表信息优先级。`actions` 条目并入既有全部交互校验与任务计点。
  - **L0 线框渲染器 shape 驱动升级**：保真度改由 PDL 数据驱动——`list` 画 keyFields、
    `record` 画字段组、`metrics` 画指标环、`timeline`/`chart`/`freeform` 各有画法，
    「三列渲染成三个一样灰盒」终结；块标题行渲染 name+intent+附着动作（primary 实心、
    overflow 收 ⋯）；页头渲染 pattern/density/首屏承诺徽标；admin 词表 +3
    （`steps`/`collapse`/`anchor`，sustain-v3 实测 19% 降级页里真正缺的三个结构词，
    四处词表同源同步）；抽屉弹窗右滑呈现。字节确定性与 --check 逐项保持。
  - **`vima mock`**（§6.16）：契约 → `.vima/mock/contract-mock.json`，8 类型 8 条固定
    规则、四档数据量（default/empty/many/long——空与超长恰是暴露版面缺陷最有效的两档）、
    分页判定只看契约声明；两跑同字节；无契约 → NO_CONTRACTS exit 4 不写空文件。
    **mock 必须由契约生成不得手写**：假数据字段名与真实接口一字不差。
  - **demo 态 + 页面画廊**（admin 骨架）：`npm run dev:demo` 免登录注入 `perms:['*']`
    演示用户（否则 v-auth 让按钮批量消失）、request 适配器接管为契约 mock
    （`?__mock=` 切档）、`/__gallery` 全部业务页 × 三视口 × 四数据档一屏看全
    （业务页判据 = 路由名 ∉ 骨架内置集，零新增配置）；生产构建静态消除，产物零泄漏。
    h5 骨架同享 mock 分支；mp 通道显式延后（wx.request 无 dev 中间件路径）。
  - **版面冒烟七探针**（§6.17，默认 Kimi WebBridge，`npm run smoke` 为 Playwright 回退）：横向溢出/页底空洞/裁切/大间隙/
    刻度合规/控件重叠/动作行意外换行，三视口 × 全部业务页，报告按 route 归组进
    A20 修复轮；两通道共用 `layout-probe.mjs`，报告记录 `source`；均不可用时**不写报告**
    （空报告会被读成「跑过且零问题」）。
    /check 增「版面冒烟」栏、/go 步骤 5.2.5 默认执行 Kimi WebBridge 通道。
  - **admin 骨架版面层**：`src/styles/layout.css` 版面原语
    （split/master/workbench/board，窄屏自动塌单列）+ 密度档
    （`.vui-density-compact/loose` 重定义 `--v-gap-*`，「刻度的语义」）+
    `ActionGroup.vue`（按密度档自动收纳溢出动作，compact 2 / default 3 / loose 4）+
    登录页 26 处装饰裸值收编为具名局部令牌；ui-docs 新增
    LayoutPrimitives/Density/ActionGroup 三份。
  - **post-write 版面纪律**：业务页禁裸尺寸（gap/padding/margin/font-size 的 px；
    「再紧一点」的正确动作是换密度档）、禁覆写页面根类 height/overflow；
    admin/h5 按 data-page 判定，mp 按 sibling wxml 判定；并显式写明
    **「本 hook 不检查、也永远不会检查『是否使用了组件』」**（组件是形态的一种实现，
    不是设计的单位）。
  - 规划资产：planning-guide 终点清单 C 增**设计五问**（内容/数据形态/读者场景/
    高频交互/首屏承诺，答案直接落 PDL 键）；spec 模板示例带 PDL；checklist 镜像
    V-DSN 七条；coding-standards admin 端补六条版面纪律。
  - 显式延后（A27「不做与延后」）：库侧令牌化收敛与行为层抽取（源仓库不在本机）、
    主题 P18–P20（被库侧卡）、mp demo 通道、词表 schema 文件化（价值已由 shape 吸收）。

- **小程序端企业 UI 框架自研 `vima-ui-mp`（增补项 A23，改判 A16 的 D-A16-02）**：
  用户在「vendored Vant Weapp / 自研 / 纯 Vant」三条路里裁定自研。
  裁定前做了三处可提取源的量化比对——`juvenile-guard` 小程序（微信原生、34 页、
  `design.wxss` 1215 行 / 89 个 `ds-` 类、跨页高复用）、Sustain 历史提交里的
  `sustain-mp`（Taro4+Vue3、22 页，但 `app.scss` 只有 59 行 / 5 个类，样式全散在
  8311 行页面私有样式里）、Sustain 的移动端原型设计画布（全内联样式、零类名）。
  结论：**可提取的框架资产只有第一处**，后两者贡献的是适老化、患者端信息架构与
  卡片/指标卡形态。
  - 框架落 `templates/admin/scaffold/mp-native/src/vendor/vima-ui-mp/`：
    **112 个 `.vm-*` 类 + 75 个 `--vm-*` 令牌，零 JS、零依赖、零自定义组件**（64 KB；
    作为对照，`@vant/weapp@1.11.7` 是 1.9 MB / 468 文件）。行为一律用微信原生能力
    （`wx.showToast`/`showModal`/`<picker>`/`<switch>`/原生 `tabBar`）。
  - 在提取源之上补齐了词表要求而它没有的能力（`actionbar`/`popup`/`upload`/`switch`/
    `textarea`/`metrics`/`body`），并**收编 `kv-*`**——它在提取源里被引用 111 处却从未
    进设计系统，散在 9 个页面 wxss 里各写一遍。
  - 适老化 `.vm-aging`：只重定义字阶令牌，**后加的类自动跟着适老**（提取源
    `sustain-mp` 的 `.aging` 是逐类覆写，加类即漏）。
  - 备选主题 `themes/clinical-blue.wxss`：取值来自 Sustain 原型画布的实测色频统计。
  - 类名闭包机检（`tests/unit/c4.ui-mp.test.mjs`，**不设白名单**）：令牌双向闭包、
    类集合 ↔ ai-manifest ↔ 组件文档 ↔ `componentMap` 四向锁死、骨架不许现编类名、
    三处必要的裸色值豁免（`page` 底色 / `<switch color>` / `tabBar` 配色）取值必须等于
    对应令牌。
- **mp-native kind 转 stable（A16 Wave 2 交付）**：微信原生 + TypeScript 骨架
  （`utils/request.ts` 门面是 V-CODE-01 的前提）、28 份组件文档 + `CAPABILITY.md`、
  `componentMap` 词表映射、`coding-standards.md` 按端分节、`post-write` 的 `.wxml`
  区块对账与裸色值机检、miniprogram-automator 版 A7 采集器
  （工具不在场时**不写空文件**——空证据会被读成「跑过且零错误」）。
- **`vima app add` / `vima app list`（A16 Wave 3）**：端册可变。
  存量单端项目后补端形成**混合布局**（既有端留在项目根 `dir "."`，新端落 `apps/<id>/`），
  同步落账 A19 骨架基线与 init 的 managed 清单；重复 id → `APP_EXISTS` exit 4。
  这条路以前只能手改 `.vima/manifest.json`。
- **h5-mobile 端（增补项 A25）**：H5 由空壳独立模板收编为 admin 模板的第三个 kind，
  并回答了 A16 挂起的「h5 是否收编」。框架 `vima-ui-h5` **与小程序端共用同一份类契约与
  令牌**——`ui.css`/`tokens.css` 由 `.wxss` 版按「`wxss` → `css` 全局替换」一一对应，
  单测锁死（令牌挂在 `page, .vm-page` 上，`page` 在浏览器里是合法但匹配不到的选择器）。
  只为「小程序有而浏览器没有」的四件事加组件：`VmNavbar` / `VmTabbar` / `VmToast` /
  `VmDialog`（其余全用原生标签）；`global.css` 装浏览器侧独有的 reset、`::placeholder`、
  `100dvh`、`:focus-visible`、开关外观。骨架为 Vue 3 + Vite + TS，请求门面形状与另两端
  一致——**V-CODE-01 一条正则通吃三端**。参考源为 CareLink（26 页 / 11 组件 / 65 令牌）。

- **开发完成后的收敛期（增补项 A20）**：出自用户反馈「全部批次开发完成后还会有很多
  小问题，比如冲突或者错误」。核实确认两处缺口——① 现有全部校验的作用域都是
  「单任务对自己」，并行批次产出的**漏实现 / 重复实现 / 越界实现**三类冲突全部漏网；
  ② `layer=pipeline` 收尾流水线在规划期根本不会被生成（`templates/admin/planning/`
  下 `grep -rn pipeline` 命中数为 0），致 `/go` 步骤 5「流水线全部通过」的进阶条件恒真，
  **全量测试与代码审计从未被执行过**。
  - 新增 **`vima converge`** 跨任务集成对账（确定性、零 token、只读）：
    **V-INT-01** 接口零实现（error，仅当负责任务全部 done 时判，开发中途跑不假红）、
    **V-INT-02** 同一接口在 ≥2 个后端文件重复实现（error，运行期路由冲突）、
    **V-INT-03** 实现越出 A18 `apis` 责任田（error）、**V-INT-04** 契约授权端无调用
    （warn）、**V-INT-05** 缺 pipeline 收尾任务（error）；同时收口既有红信号
    （Verifier 未过点位、运行时错误、done 无 `@vima` 标注）。
    报告 `.vima/reports/convergence.json`（契约 §6.13），其中 **`byTask` 是修复调度的
    确定性输入**——谁的问题派回谁改，主 Agent 不自行判断归属。
  - `/go` 步骤 5 由「直接进 MAINTAINING」改为**收口闸门**：converge → 按 `byTask` 归组
    增量修复（V-INT-02/03 类串行修，多任务争用同一处实现并行修就是边修边冲突）→
    重跑，最多 3 轮 → pipeline 批次 → MAINTAINING。收敛循环**不是停点**（延续 A17/A18
    反停顿纪律），3 轮未收敛才停轮交用户裁定（`stopReason=gate`）。
  - 补上收尾流水线任务模板 `_template-full-test.md` 与 `_template-code-audit.md`
    （进 `planning.taskTemplates`，由 init 安装 / update 交付），planning-guide 第 5 步
    新增「收尾流水线任务必须一并生成」，`/check` 增集成对账栏。
  - 新增 **V-TASK-13**（warn）：存在 business 任务却无 pipeline 任务——设计期早提示
    （不阻断存量项目开工，守 A19 升级可达性），收口期由 V-INT-05 升级为 error。
  - **不做**：git 合并冲突处理（单工作树 + 批粒度串行提交的调度模型结构上不产生
    merge 冲突，用户所指「冲突」的真实形态是跨任务实现冲突）、缺陷台账状态机
    （报告是每次扫描的确定性快照，不引入 open/fixed 手工状态与豁免后门）、
    框架结构规则下沉 `lib/`（守 A18 分层边界）、自动修复（改代码仍走
    Builder → 独立 Verifier 通道）。
- **工具可信度与项目定制（增补项 A24）**：`docs/design/sustain-v3-field-feedback.md` 剩余建议
  的**核实版**落地——13 条里核出 1 条能力早已存在、1 条已被 A18 默认值消解、2 条落点判断需修正。
  - **【P0】项目根感知**：CLI 不再按当前目录静默工作。新增 `findProjectRoot`（向上找含
    `.vima/` 或 `docs/lifecycle.json` 的最近祖先），项目内命令锚定项目根；找不到 →
    `NOT_IN_PROJECT`（exit 4）**且不写任何文件**。
    **本条从原文的 P2「人机工程」升为 P0**：实测在 `backend/` 下跑 `vima validate` 得到
    「2 错误」（项目根实为 0 错误），**并把 `pass: false` 落盘到 `backend/.vima/reports/`**
    ——其余缺陷都是漏检，这条是**误报成事实并持久化**，磁盘上的错误报告之后会被人或 Agent
    当权威读取。`create`/`upgrade` 不参与；`init`（首次初始化）与 `doctor`
    （「非 vima 项目只跑两项」是其声明过的降级能力）保留各自的「无项目」语义。
  - **【P1】V-TASK-11 只对可调整的任务生效**：`status=done` 的任务不再触发拆分建议。
    **本条从 P2 升为 P1**——它不是体验问题而是**规则可信度问题**：A22 新增的
    V-SPEC-15/V-CON-08/V-CON-09 全是 warn 且需人逐条看，warn 列表里躺着一批**永远无法清除**
    的条目（实测 9 个已完成任务）会训练出「整个 warn 列表不用看」的习惯，把 A22 一起废掉。
    只豁免本条：V-TASK-07/08/09 在任务完成后仍可执行，不适用。
  - **【P1】`docs/coding-standards.local.md` 项目追加区**：`vima context` 打包时一并分发，
    **不入 manifest、不受管、doctor 不校验**。受管的 `coding-standards.md` 是唯一随 context
    分发到每个任务的规范文件（实测中成了止血最有效的落点），代价是 doctor ⑧ 长期报
    「受管文件被手改」——本节让项目定制不再污染受管基线。
  - **并发写策略与 `conflictsWith` 引导**：核实发现`conflictsWith` **A8 起就已实现**
    （`plan.mjs` 切批时保证互斥任务不同批），实测中的绕法（把 API 封装塞进视图目录、
    违反编码规范、事后人工合并）本可一行避免——**这是「已有能力对使用者不可达」**，
    故成本从「新增功能」降为 planning-guide + 编码规范各一段官方口径（追加不覆盖 /
    要整体重写就用 conflictsWith 排开）。
  - **冷启动断言口径**：**从原文 P1 降级为 pipeline 验收项**——判据需要跑起真实数据库与种子，
    超出确定性内核（离线、无运行时）的边界。价值由一句固化口径保留：
    「**不要只测『种了几行』，要断言『A 跑完后 B 能解析出全部 N 条』**」，进 `_template-full-test.md`。
  - **go.md 两处文字**：合法停点举例补「依赖未满足且无其他可派批次」（**不新增
    `stopReason` 取值**——A17 白名单③已覆盖该语义，`gate` 够用）；预算段补
    「`--max-parallel` 与预算 24 不整除时实际生效值是 `floor(24/N)*N`」（默认 8 恰好整除，
    调成 5 则只推进 20——这也是原 F7 在默认配置下已不存在的原因）。
  - **`vima retro` 补正面信号**：A21 只采集异常（重试/冲突/豁免/越界），没有一项记录
    「哪个机制救了你」——长期只积累「该改什么」、从不积累「该保留什么」会导致对已验证设计的误改。
    新增确定性的 `worked.retriedThenDone`（重试后仍做成的任务数），其余走 issue 正文
    新增的人工必问第 3 问；**不硬造其它确定性正面指标**（「某规则曾命中后来被修好」在只有
    最新快照的报告体系里不可得，强行推断会产出假数据）。
  - **修 stdout 被管道缓冲区截断**（落地本项时用自己的验收判据撞出来的既有缺陷）：
    `bin/vima.mjs` 用 `process.exit()` 立即退出，而管道上的 stdout 写入是异步的——
    `vima context --stdout | grep` 在**恰好 8192 字节**处被腰斩且**不报任何错**，
    `converge/retro/plan --json` 在真实项目上同样会被截断。改为 `process.exitCode`
    让 Node 自然退出（事件循环排空时 stdout 已 flush，退出码语义不变）。
    与项目根感知是同一类失效——工具静默给出错误答案，只是发生在输出侧。
  - **不做**：值级溯源 V-SRC-02（障碍不是判据复杂，而是**需要此前不存在的枚举/种子锚点**；
    参照 V-SRC-01 至今需配置才启用、多数项目没配，做了大概率不启用）、F5 的
    `vima fix-round` 登记（A20 回测已封掉造假 taskId 的危害，追溯已闭环）、
    新增 `stopReason: blocked-by-barrier`、把冷启动检查做成 CLI 规则、
    给 `coding-standards.local.md` 做模板（一给模板就又变成需要同步的受管资产，回到原点）。

- **字段级机检 + 上下文两条检索线（增补项 A22）**：出自
  `docs/design/sustain-v3-field-feedback.md`（73 任务 / 19 契约 268 端点 / 50 页面 /
  707 处 `@vima` 标注的完整开发期实测）。**立项前提**：这些缺口全部是在 `doctor` 全绿、
  `validate` 0 错误的前提下由人或 Builder 实地撞出来的——此前全部规则都停在**引用级**
  （页面 apis ⊆ 契约、菜单功能点 ∈ 契约、代码路径 ∈ 契约），**没有一条查到字段级**。
  - **V-SPEC-15**（warn）弹窗字段 ↔ 提交入参**双向**对账：正向弹窗必填字段须能提交上去，
    反向端点必填入参须有地方填。实测 4 条功能级阻断——缺 `scaleType` 导致「量表根本创建不了」；
    连带查出退款审批 `refund()` 原先没有 `decision` 参数、一律按同意处理。
    **缺的那个字段往往正是某个业务判断的输入，字段缺失意味着那个判断根本没发生。**
    三条实测排除项一条不少：submit 指向 GET 的弹窗跳过、路径参数跳过、
    存在未声明子结构的 json 聚合入参时该端点整体跳过（原始脚本三版给出 54 → 32 → 13，
    前两个都是误报）。**恒为 warn**——定位是候选清单，不是判决。
  - **V-CON-08**（warn）字段三桶对账查「只进不出」：`create`(POST 入参)/`update`(PUT 入参)/
    `read`(GET 响应) 中只出现在写面的字段 → 「新建能填、之后查不到改不了，且不报错」。
    实测同一个错犯了三次。**只查「只进」方向**——反方向的 id/createdAt 是纯噪声
    （实测在 4 接口夹具上就产生 3 条误报），豁免走新增的 `writeOnly`/`readOnly` 显式标记。
  - **V-SPEC-16**（error）跨页导航参数取值域闭环：页面用 `params: [{name, values}]` 声明
    唯一取值域，`action: nav` 用 `params: {…}` 携带。实测三个跳转入口全是坏的、
    目标页对未知 key 静默落兜底分支且不报错，而**每个页面单看都自洽、只有跨页对照才暴露**。
    不携带 params 的 nav 完全不触发——规则由声明主动开启，存量项目零影响。
  - **V-CON-09**（warn）聚合 json 子协议：`type: json` 须带 `fields` 子结构或显式
    `enforced: false`（内部零约束时写入方/读取方/后端计算方各写各的，运行时「存进去了但算不对」）。
    同名聚合字段在不同 module 子结构不同时只提示同名不同义、**不判错**。
  - **`vima context` 新增两节**：**系统底座接口索引**（无 `@vima` 标注代码 = 底座/共享层，
    列其导出名与请求路径）与 **spec 指名的 `docs/raw/` 真源片段**（带行号取前后各 20 行）。
    实测最大的系统性返工源——Builder 把契约当唯一事实来源，「契约里没写」=「系统里没有」
    ⇒ 把底座已有的科室/用户列表判为不存在、下拉框空着、指派退化成自分配；
    更严重的一次是 spec 正文写着「真源为 `docs/raw/…:行号`」，Builder 仍然没去看，
    因为上下文包里没有它。
  - **顺带修 V-YAML-01 误报**：`params: { … }` 与 `fields: [{ … }]` 是合法标准 YAML 的
    嵌套 flow 集合，原判据把 depth>0 的任何 `{` 都判为「未加引号的花括号」——
    本项两个新语法会系统性触发。改为看 `{` 前的首个非空字符：位于值位（`:` `,` `[` `{` `-`）
    是集合起始，放行；嵌在标量里（`/api/x/{id}`）才是规则本来的目标。
  - **不做**：F3 的代码侧对账（页面模型里没有路由路径，做不了 `router.push` 目标页反查，
    另行立项）、F1 升 error、F2 的「只出不进」方向、聚合字段强制统一子结构、
    把底座索引做成全量代码索引、把 `docs/raw/` 全量塞进上下文包。

- **经验反哺回路（增补项 A21）**：出自用户提议「开发完成后弹交互问是否把项目经验反哺到
  vima-cli，同意则提 issue/PR」。立项理由是 A18 与 A20 都走了**同一条路径**——真实项目
  跑完 → 人工写评估文档 → 立项，而这条回路全靠自觉、证据要事后手工重建
  （A18 的并行槽空转率是翻 `@vima` 标注逐任务统计出来的，A20 的缺口是事后 grep 才发现的）。
  项目跑完那一刻磁盘上恰好躺着最完整的一手证据，过后即散。
  - 新增 **`vima retro`**（离线、只读、**默认脱敏**）：确定性采集任务重试分布 /
    failed·blocked / `apis` 声明率 / 批次形态 / V-INT 各规则命中 / Verifier 轮次与任务点
    （未过·豁免·NG 越界）/ 共享层变更请求 / **validate 规则命中分布**（哪条规则最常被违反
    = 框架引导最缺的地方）/ 运行时错误 / 规格规模计数；按**静态阈值表**输出观察项
    （OBS-xx），每条附**指向框架资产的建议落点**。产物 `docs/retro/vima-feedback.md`
    （issue 正文）+ `.vima/reports/retro.json`，同源渲染、同一输入字节一致
    （阶段时长取 `phaseHistory` 落盘时间戳，不读系统时钟）。
  - **默认脱敏**：只含计数与分布，不含任务/接口/页面标识——vima-cli 是公开仓库而使用它的
    常是客户项目，泄露必须是显式动作（`--with-ids`）。
  - `/go` **新增步骤 6**：切 MAINTAINING 那一刻问一次（早了没数据，晚了人已离场），
    并追问两个 CLI 采不到的问题——① **有没有想表达但框架表达不了的东西**（历次增补项
    A14 分栏版面、A16 多端应用模型都出自这一问）② 哪一步最费时间／最反复；同意则
    `gh issue create --repo vima-tech/vima-cli`，`gh` 不在场时降级为打印命令而**不静默失败**；
    拒绝后写 `.vima/retro-state.json`，不再重复骚扰。
  - **不做**：CLI 联网或代为提交（守「`vima upgrade` 是全仓唯一联网命令」）、自动提 PR
    （守「不执行真实 git push」，跨仓写权限不该由项目侧 Agent 持有）、跨项目聚合上报服务、
    让 Agent 自由写「项目总结」（不可验证、不可跨项目比较，攒不成阈值决策需要的分布）。

- **A20 回测修正（同批）**：落地当日独立复核查出 13 处问题并全部修复——3 处真缺陷
  （converge 在非 vima 项目**凭空产报告并 exit 0**；责任田只认 `side=backend` 导致
  `fullstack` 任务整体逃过 V-INT-01/03；go.md 步骤 3 会**绕过收口闸门直接派 pipeline 批**）、
  2 处 A18/A19 遗留漂移（README 仍写并行 ≤5 与「批后自动 commit」、doctor「九项」）、
  8 处镜像与覆盖缺口。详见 `docs/design/v2.1-amendments.md` A20「回测修正」表。

- **表单校验错误态进框架**：新增 `.vm-error` 与 `error` 修饰（作用于 `vm-input` /
  `vm-textarea` / `vm-picker`）。此前文档只能教人内联写红色，等于把颜色决定权散回每个页面
  ——`form` 是冻结词表里的词，「填错了怎么显示」是它的必然组成。
- **h5 骨架补 `utils/auth.ts`**：与小程序端对称的票据存取（此前散在 `request.ts` 里直接读
  localStorage，且没有「票据怎么来是业务」的引导）。

### 修复

- **create 骨架遍历排除 `target/`（A28 顺带）**：模板源被本地构建污染时（如在模板目录
  跑过 `mvn test`），构建产物会连着进生成项目与 A19 骨架基线（carelink-admin 实测中招
  3 条，已一并清理）。与既有 `node_modules` 排除同口径。
- **`vima context` 两处半截实现（A23 顺带）**：`componentsOfPage` 对 `page.modals` 硬编码
  注入 `VLayer`、对弹窗字段类型写死内置表，两处都绕过了 `componentMap` 这个映射真源
  ——mp 端的弹层是 `VmPopup`，写死等于该端弹窗切片恒空。改由 `componentMap.modal` 决定；
  admin-web 不声明 componentMap，回落 `VLayer`，行为逐字节不变。
- **A7 运行时证据在多端布局下静默丢失（A25 顺带，A16 W1 遗留）**：admin 骨架的 vite
  中间件直接用 `server.config.root` 落盘，而 N≥2 时该端在 `apps/admin/`，证据被写进
  `apps/admin/.vima/reports/`，`/check` 与 `vima converge` 只看项目根那一份。
  改为**先向上定位含 `.vima/` 的最近祖先**并按端命名 `runtime-errors[.<appId>].jsonl`。
  A16 §6 早写明「不得假设 dev cwd 即项目根」，当时只在 mp 侧兑现。
- **post-write 对 h5-mobile 端套用了 admin-web 的规范面**（A25 自查）：h5 业务页正确写成
  `<div class="vm-body" data-page="...">` 却被报「页面根缺少 vui-page 类」——**把对的说成错的**，
  每个 h5 页面写完都会被错误拦截。改为按 kind 分派规范面：admin-web 查 `vui-page` 与 VIcon、
  mp-native 查 `.wxml` 的 `vm-page`、h5-mobile 查 `.vue` 的 `vm-body`/`vm-sheet`，
  并给 h5 补上它自己的两条（禁深路径导入 `vendor/vima-ui-h5/dist/*`、禁原生
  `confirm()`/`alert()` 改用 `'@ui'` 的 `confirmAsync`）与 `.vue` 内裸色值机检。
- **`coding-standards.md` 缺 `## 端规范：h5-mobile` 节**（A25 自查）：`vima context` 按
  kind 切片时该端匹配不到任何节，h5 任务只拿到通用段——**零前端规范且不报错**，静默降级。
  已补 2338 B 端节（页面根契约 / 请求门面 / 样式令牌 / 浏览器端五个坑 / 自检命令），
  并加单测断言「每个 kind 都必须有端节且通用段不夹带端专属内容」。
- **`lib/commands/validate.mjs` 混入一个字面 NUL 字节**（`'\0'.repeat()` 被写成真 NUL），
  致整个文件被 `file`/`grep` 判为 binary、默认静默不匹配，排查时极易误判「代码里没有这段」。

## [3.0.2] - 2026-08-13

### 新增

- **批次调度效率（增补项 A18）**：sustain-v3 实测评估
  （`docs/design/batching-efficiency-assessment.md`）落地，触发 A17 自留的重开条件。
  实测证伪两个直觉归因——构建不是瓶颈（前端 `build:check` 2.82s / 后端
  `mvn compile` 1.34s），工作量也不是（总生成量 120 分钟是硬成本）；真因是
  **不均衡造成的空转**：子代理内部严格串行、批次时长取批内最大值，单任务最大
  4527 行 = 同批最小任务的 7 倍，三个业务批实测并行槽空转率 52–54%。
  - 任务 frontmatter 新增可选 `apis` 负责接口集（缺省 = 契约全集，向后兼容）；
    新增 **V-TASK-11**（warn，负责接口数 > 10 提示按子域拆分）与 **V-TASK-12**
    （error，⊆ 契约 / 同契约 backend 任务不重叠 / 全声明时并集齐全）；
  - `vima context` 按 `apis` 切片契约（人读小节 + 机读块同步过滤），Builder 只看自己那份；
  - `vima plan` 新增 `--max-parallel <1..10>`（默认 5 → **8**，越界 `PLAN_PARALLEL` exit 2），
    batch-plan.json 每批新增 `level` 字段——同 layer 同 level 的批次之间无依赖，
    主 Agent 可流水线化派发（上批 Verifier 与下批 Builder 同轮，2N 轮 → N+1 轮）；
  - 新增 Stop hook `.claude/hooks/go-continue.mjs` + 状态文件 `.vima/go-state.json`：
    主 Agent 每次结束回合前落盘停因，hook 只在 `stopReason=in-progress` 时阻止停轮并
    注入续跑指令，合法停点（budget/terminal/gate/user）放行，连续续跑 5 次兜底放行。
    **推翻 A17「不用 Stop hook」**——其否决理由「hook 无法区分合法停点」在停因机读化后不再成立。

### 新增

- **存量项目升级可达性（增补项 A19）**：回答「已有项目能否通过 `vima update` 升到最新功能
  而不影响原有程序」。核实结论——**主体已实现**（update 的受管清单里代码文件命中数为 0，
  实测一个改过 210 个代码文件的项目跑 update 后代码树指纹完全一致），补齐剩余三处缺口：
  - **manifest v1→v2 端册迁移**：兑现契约 §6.4 早已写下却从未实现的宣称（sustain-v3 跑了
    两次 update 仍是 v1）。**保护面不得因迁移变弱**：guard-shared 对 v1 走内置字面量兜底、
    写入 apps 后改走 v2 分支且不再回退，故后端共享层按模板声明渲染并**逐个校验目录在位**，
    缺一个就整体放弃迁移（保持 v1 兜底），不静默降级。
  - **`vima doctor` 第 ⑫ 项「产物形态与当前规则的差距」**：四条判据（A4 决策表 /
    A13 `vima:rules` / A13 `vima:non-goals` / A2 前端任务 `page`），级别与对应 validate
    规则对齐。与 validate 的分工——validate 说「缺什么」并阻断 `/go`，⑫ 说「这是哪个增补项
    引入的、补在哪一章、块长什么样」。`docs/spec.md` 未生成时跳过，不误伤新项目。
  - **骨架基线 + `vima update --scaffold-diff`**：`create` 在 manifest 记录
    `files.scaffold`（落盘内容哈希，219 个文件约 18KB）；`--scaffold-diff` 按三方比较输出
    「可安全更新 / 需人工」两类，**只报告、零写盘**（实测跑前跑后全项目指纹一致）。
    无基线的存量项目如实说明能力边界，不猜。渲染逻辑与 create 落盘同源
    （`resolveScaffoldEntries`），不留两份会漂移的实现。

### 修复

- **模板新增受管文件到不了存量项目**（A18 第 8 条）：`vima update` 原先只提示不装，
  而 `settings.json` 已被更新成引用新 hook —— 产出「配置指向不存在文件」的破损状态。
  现按与既有文件同一套三方比较处理：磁盘无 → 安装并登记（hooks 带可执行位），
  磁盘有且等于模板源 → 采信登记，磁盘有且不同 → 写 `.vima-new` 人工合并。
  项目形态由 manifest 新增的 `install: {minimal, skipScan}` 判定（init 写入；旧 manifest
  按已记录文件确定性反推：无 `docs/` 条目 = minimal，有 `docs/` 无 `docs/ui-framework/`
  = skip-scan），`--minimal` 项目不会被灌入 docs/ 资产。
- **`vima init --force` 会清空项目状态**：原实现无条件重写 `docs/lifecycle.json`，把
  DEVELOPING 打回 PLANNING 并丢掉 taskStats/phaseHistory/tasksApproved（在 sustain-v3
  上实测发现——它正是 update 提示的补救命令）。现改为**状态不是生成物**：已存在则保留
  并提示「保留既有状态（未重置）」，managed 生成物照常重建。
- **`vima init` 清空 create 写入的端册**（A16 多端在正常路径上就是坏的）：init 整体覆盖
  manifest，把 `apps`/`backend` 与 schemaVersion 2 一起抹掉，resolveApps 退化为合成的
  单端册，doctor ⑪ 因此误报「代码目录不在位」。现改为**合并写**，既有键原样保留。

### 变更

- **/go 会话预算 8 → 24 个任务**（A18）：前提是 `vima-builder` / `vima-verifier` 角色模板
  新规定回传摘要 ≤ 15 行、明细一律落 `.vima/reports/`，使每任务的编排上下文成本有界。
  预算耗尽的续跑提示改为「**先 `/clear` 再 `/go`**」——同一会话里重输 /go 不重置上下文，
  原提示下预算形同虚设。
- **批次检查点提交改 `/go --commit` 显式授权**（A18 取代 A17「/go 即授权」）：不带该 flag
  时**完全不碰 git**，报告也不再输出「未形成回滚点」噪声。实测 sustain-v3 至今 0 个提交
  ——A17 口径长期被用户环境级提交禁令压制而从未生效，授权点必须显式可见才不冲突。
- **前端任务默认依赖改为仅 `shared-base`**（A18）：契约先行的必然推论（前端验收清单只有
  「字段与契约一致 + build:check」，不含任何后端运行时依赖）。旧默认把全部前端任务锁到
  后端之后，实测使 18 个批次里多出一半。planning-guide 与 `_template-fe.md` 同步。


## [3.0.1] - 2026-08-13

### 变更

- **/go 批间连续性（增补项 A17）**：修复真实项目反馈的「每个批次执行完即阻塞、
  需再次输入 /go 才续跑」。三处停顿源对症落地：
  - 会话预算从「3 个批次或 8 个任务先到为准」改为**单一任务计数**（8 任务/次，
    批次数不设上限）——shared/pipeline 串行批每批仅 1 任务，按批计数会在 3 个
    任务后过早截断，而预算防的编排者上下文成本只与任务数成正比；
  - 批次检查点提交补**授权口径**：用户输入 /go 即构成对全部检查点提交的明确授权，
    不逐批征询（消除与「未经明确要求不得提交」类环境规则的每批一撞）；提交仍被
    拒绝时跳过并注明「未形成回滚点」，不中断调度；
  - 新增**合法停点白名单**：预算耗尽 / 全部任务终态 / 闸门或 failed 需用户裁定 /
    用户中断之外，批次之间不得停轮等待。
  仅工作区文字资产（go.md、CLAUDE.project.md）与设计文案（§7.5/§10.2）变更，
  零文件格式/模块接口变更；d2 新增防漂移断言。

### 新增

- **多端应用模型 Wave 1（增补项 A16）**：一后端 × 多前端成为一等公民——
  「营养诊疗 = 院内后台 + 患者端小程序」这类系统可在同一项目内完成规划与机检闭环。
  - **端册**：`.vima/manifest.json` 升 schemaVersion 2，新增 `apps[]`/`backend`
    （唯一真源，新增 `lib/model/apps.mjs` resolveApps 统一解析，v1 自动合成兼容）；
    admin 模板 template.json 改 `apps[] + backend + planning.kinds` 新形态
    （kind 词表/分栏能力/原型外壳/成熟度配置化，含 mp-native 定义，status=preview）。
  - **创建**：`vima create --apps <id:kind,...>`（N=1 落项目根不变、N≥2 落
    `apps/<id>/`；preview kind 入册跳骨架可先行 PLANNING；逐端 npm install；
    新模板变量 `{{appId}}`）；`--force` 重跑不再清空 manifest（新码 TEMPLATE_MISMATCH）。
  - **机检**：新增 V-SPEC-13（端归属/nav 同端）、V-SPEC-14（端覆盖）、
    V-CON-07（consumers 授权闭环，spec/代码两级拦越权）、V-TASK-10（任务端归属）；
    端化 V-SPEC-04（per-kind 词表）/V-SPEC-08/V-SPEC-12（regions 门控）/
    V-CON-03（谁消费谁承接）/V-CODE-01（端册扫描 + 越权调用）/V-COV-01（矩阵端列）。
  - **人审**：原型逐端渲染（`prototype.<appId>.html`，mp-native 375px 手机壳 +
    tabbar 外壳 + list/banner/detail/actionbar 词渲染；`--app` 单端重渲）；
    manifest 统一为顶层 `apps` 映射（§6.7）；审计视图单文件按端分组 + 端徽标；
    render-matrix 多端首列「端」。
  - **接线**：guard-shared/post-write 双 hook 保护面与机检面读端册（v1 字面量回退）；
    trace/context（按端组件文档 + componentMap + 规范 kind 切片）/doctor（新增
    ⑪ 端册完整性，PLANNING 期骨架缺失仅告警不假阻塞）/approve（逐端新鲜度 +
    修复 cliRoot 缺参导致的词表误报）/sync（任务表端列）全部端册化。
  - 新增双端黄金夹具 `tests/fixtures/golden-multi/` 与多端 e2e 链路；
    单端项目全链路行为与产物保持不变（黄金夹具回归全绿）。
  骨架资产（微信原生 mp-native scaffold、vendored Vant Weapp、automator 版 A7）
  与 `vima app add/list`、update v1→v2 迁移分别属 Wave 2/3，见 v2.1-amendments A16。

## [3.0.0] - 2026-08-13

> 2.1.0 曾在仓库内准备但从未发布到 npm（npm 上的上一版是 2.0.3），其内容并入本版本。

### 破坏性变更

- **`vima upgrade` 更名为 `vima update`**（增补项 A15）。该命令的行为（manifest 三方比较、
  更新项目里的 vima 生成物、用户改过的文件旁路写 `.vima-new`）一行未改，只换了名字——
  `upgrade` 让位给「升级 CLI 自身」。
  **迁移**：把脚本里的 `vima upgrade` 改成 `vima update`。旧用法不会报错：
  `vima upgrade` 与 `vima upgrade --dry-run` 在新语义下都只是打印版本报告，
  且在 vima 项目目录内会追加一行指向 `vima update` 的提示。唯一有实际动作差异的是
  `vima upgrade --yes`——旧语义下无行为，新语义下会执行 CLI 自升级。

### 新增

- **`vima upgrade`：升级 CLI 自身**（增补项 A15）。此前全仓没有任何联网查版本或执行安装器的
  代码，用户想升级 vima 本体只能自己记 `npm i -g @vima-tech/cli@latest`。
  - 查 `https://registry.npmjs.org/@vima-tech/cli/latest`（Node 20 内建 fetch，5s 超时，
    零运行时依赖不破）；查不到版本报 `REGISTRY_UNREACHABLE`（exit 2），不静默降级为「已是最新」；
  - 按 `cliRoot` 的路径与文件存在性识别安装方式（npm / pnpm / bun 全局 · npx 临时运行 ·
    源码或 npm link 开发态），不执行外部命令探测；
  - **默认只报告不安装**——它是全仓唯一联网、唯一会改 cwd 之外文件的命令，`--yes` 才跑安装器；
  - 源码态与 npx 态不可自升级：不带 `--yes` 只报告（exit 0），带 `--yes` →
    `UPGRADE_UNSUPPORTED`（exit 4）；安装器非零退出 → `INSTALL_FAILED`（exit 2）。

以下校验与生成端改动吸收自 sustain-v3 修补期实战：一次「契约从 spec 反向生成」导致的规格事故——209 个契约端点里
大量虚构路径、占位参数、空请求体，却**全数通过了当时的 19 条校验**。根因是整套规则都是
spec ↔ 契约 ↔ 任务之间的内部一致性，同源产物必然自洽，闭环从头到尾没碰过真源。

- **V-SRC-01**（warn，需配置）：端点溯源锚点——全表**唯一的外部锚点**。在
  `docs/lifecycle.json` 写 `endpointAnchor: "<相对路径>"` 指向真源端点清单后启用，
  契约每个 path 归一后须在锚点中出现；未配置整条跳过，不影响既有项目。
- **V-CON-05**（warn）：占位符特征检测——参数名匹配 `^q\d+$`、POST/PUT 空 `request: []`。
  零配置、纯形态判断。实测某项目 20 份契约里 14 份中招。
- **V-CON-06**（error/warn）：契约三方计数一致——人读小节 ↔ 机读 `apis` 逐接口对应（error），
  头部「接口 N 个」↔ 机读条目数（warn）。三处会各自漂移且此前无人发现。
- **V-TASK-08**（warn）：任务正文引用的接口须落在作用域内（带 page 取该页 apis，
  否则取 contract 契约 apis）。V-TASK-07 只数复选框个数不看内容，产物重建后验收清单
  会长期停在已删除的端点上。含否定式措辞（真源无/已废弃/不请求…）的行不计入。
- **V-TASK-09**（warn）：任务内嵌「契约声明的 N 个接口」与契约条目数一致。
- **V-YAML-01**（warn）：flow 上下文里的裸花括号。路径参数须写 `{id}`（V-CODE 归一只认
  花括号），但 YAML 规范禁止 flow 内 plain scalar 含 `{`——本解析器容忍 flow 序列、
  却在 flow 映射上报「键 X 后缺少 :」，形成「vima 能读、标准 YAML 读不了」的灰区，
  且报错与真实病因相去甚远。块级序列（`- GET /api/x/{id}`）本就合法，不在此列。
- **`vima render-matrix`**：覆盖矩阵的生成端。此前 V-COV-01 强制它存在且无空单元格，
  却没有任何命令生成它——矩阵靠手写，产物一变就烂，校验只能发现「烂了」不能修。
  现从 spec 页面块 / 契约 apis / 任务 frontmatter 确定性推导，支持 `--check` 验漂移。
- **doctor ⑩ 评审批准时效**：`tasksApproved` 只能由 `vima approve` 置位却没有失效路径——
  产物在批准后被大改，标志位仍是 true，下一次 `/go` 会拿着没人看过的规格直接进 DEVELOPING。
  现按 mtime 判定：批准早于 spec/契约最后改动即报 error。

### 改进
- YAML 解析错误现在**带文件名与文件绝对行号**。此前 `extractBlocks` 调 `parseYaml` 未传 path，
  错误只有块内相对行号，19 份契约里得靠 grep 才能定位；且 `collectPendingConfirm` 的调用
  既无 try/catch 也无 path 归属，解析错误会绕过 `loadContracts` 的补偿直接逃逸。
- `validate` 现在**一次报出全部契约解析错误**（`loadContracts` 新增 tolerant 模式）。
  此前首个坏契约即中止，修一个才发现下一个。

### 修复
- `render-matrix` 的任务列只收「不带 page 字段」的模块级任务，避免共用同一契约的兄弟页面
  任务互相串到彼此行里。

## [2.0.3] - 2026-08-13

### 新增
- 增补项 A14 分栏版面（吸收自 sustain-v3 实战：48 页中 9 页真实版面为多列结构，
  而 layout 是一维词序列，人审产物画不出二维布局）：
  - `vima:page` 新增**可选**键 `regions`（纵向若干带，每带全宽或横切成列，列宽 `<n>px` / `<n>fr`）；
    `layout` 保持扁平不变，校验 / manifest / 任务点计数 / data-block 对账口径全部不动
  - 新增 **V-SPEC-12**（error，仅声明 regions 时触发）：带二选一、列宽格式、blocks 词表、
    以及 regions 铺开后的区块多重集必须等于 layout（防两处漂移）；挂在 validatePages，
    故渲染前同样拦截
  - 线框原型按列渲染（固定列 px / 弹性列 fr，窄屏落回堆叠）；审计视图「布局区块序列」
    升级为**版面草图**（分栏页按列画、单列页纵向堆叠，区块显示中文名 + 原词）
  - 向后兼容：未声明 regions 的页面不产生分栏结构、manifest 不写该键；
    渲染产物 HTML 会因样式表新增而变动一次字节，升级后重跑 render-* 即可
- 增补项 A9–A11（吸收自 mattpocock/skills 对标，评估见
  docs/design/mattpocock-skills-assessment.md；均为文字资产级吸收，不新增命令/文件/报告格式）：
  - **A9 提问三规则**：planning-guide §5 与 vima-planner 新增 PLANNING 提问纪律
    （先查后问 / 一轮问全＋每问必附推荐答案 / 前置未定不问）
  - **A10 同构断言禁令**：coding-standards 后端节〔L5·verifier〕——单测期望值必须来自
    独立事实源，同构断言视同无测试；`_template-be` 步骤 5 同步措辞
  - **A11 红绿修复纪律**：CLAUDE.project.md 工作协议——维护期修 bug 先固化能跑红的命令
    （A7 信号源），修复判定 = 同一命令转绿
- d2 防漂移断言覆盖 A9–A11 的全部 grep 验收判据
- 增补项 A12 原型先行节拍（吸收自作者「先出原型再出 spec」时序观念，
  分析见评估文档 §6）：planning-guide §5 里程碑 2 改为逐模块「草→渲→看→定」
  （页面对齐完成判据 = 用户在原型上看过并确认）；render-review / render-prototype
  导出 `checkReviewFresh` / `checkPrototypeFresh` 新鲜度助手（契约 §11，与 --check
  共用 util/fs `driftOf` 逐字节比对）

- 增补项 A13 规格边界机检（出自「快速理解业务系统的核心要素 / 产品经理关注点」
  专题讨论，经用户裁定立项）：
  - **业务规则结构化**：spec 第五章新增 `vima:rules` 块（`id`/`type`/`entity` 必填 +
    `apis` 可选，省略 apis = 全局规则），新增 V-SPEC-09（结构与 entity 引用）与
    V-SPEC-10（apis 落在契约上）；RULE-xx 并入 V-SPEC-05 全文档 ID 唯一性
  - **本期不做**：spec 新增第九章承载 `vima:non-goals`，新增 V-SPEC-11 强制显式声明
    （空清单也须写 `non-goals: []`——「声明为空」与「没声明」必须可区分）
  - **消费端全链路**：`vima context` 新增「业务规则切片」（按 apis 交集 + 全局规则
    确定性过滤）与「本期不做」两节；审计视图新增第⑤业务规则视图与本期不做红线区
    （审核指引四步→五步）；vima-verifier 逐条核对 RULE-xx，越界记 `NG-xx 越界` fail
    （复用契约 §6.9 points，不改报告 schema）

### 变更
- **spec 由八章扩为九章**（新增 `## 9. 本期不做`，A13）：V-SPEC-01 章节表、
  spec 骨架、validate.checklist、planning-guide 终点清单（A–G → A–H）、黄金夹具同步
- CLAUDE.md 新增硬约束「立项即做透」：需求一旦立项就按长远正确形态一次做完整
  （数据结构留足字段、消费端一并接线、契约与校验同步落位），与「防过度设计」分工——
  后者管广度（没立项的不做），前者管深度（已立项的不做夹生）
- `vima render-review` 输出摘要补规则数与本期不做条目数
- 订正：设计文档 §13.1 两处遗留的「spec 七章」表述（A4 改八章时未回写）统一为九章；
  契约 §7 `vima:flow` 的「第七章」标注订正为「第五章业务流程小节」
- `vima approve` 前置 2 从「评审载体存在」升级为「与当前 spec 渲染结果逐字节一致」
  （A12 新鲜度机检）：渲染后改过 spec 未重渲 → exit 4 并指名漂移文件与重渲命令；
  approve 单测随之改为真实渲染 + 新增漂移 e2e

### 修复
- 线框原型的表格加横向滚动容器 `.wf-tw`：列头多或行操作多时表格自然宽度会超出所在列，
  分栏页（A14）里会直接压到相邻列上；不能给 `.wf-block` 直接加 overflow——那会裁掉
  浮在上边框的区块标签，故套内层容器。打印时该容器展开为 visible
- 设计文档「当前修订」与页脚版本自 v2.0.4 修正为 v2.0.6（v2.0.5 落地时未同步）；
  契约 §12 标题补 A8 来源

## [2.0.2] - 2026-08-12

### 修复
- admin 骨架样式：工作区标签悬停态与表格末行边框处理

### 说明
- 2.0.1 未能发布到 npm（发布令牌对 `@vima-tech` scope 无创建新包的权限），
  该版本的全部内容包含在 2.0.2 中

## [2.0.1] - 2026-08-12

### 新增
- 全部 11 个子命令支持 `--help` 与 `vima help <command>`（文案对齐设计 §19，选项以实现为唯一真源）
- 契约 §3.1 错误码登记表（VimaError code 全集）；USAGE 错误追加「运行 vima <cmd> --help 查看用法」提示行
- `vima plan` 在缺 docs/tasks/ 的目录报 `NO_TASKS`（exit 4），不再静默产出空计划并凭空写报告
- 测试：CLI 路由矩阵（tests/cli.test.mjs）、V-TASK-01 专属用例、script/lib/h5 模板 create 冒烟、
  defaultLifecycle 版本同步锁、公共 helper（tests/helpers.mjs）
- 工程门面：LICENSE（MIT）、GitHub Actions CI（Node 20/22/24）、tag 驱动的 release.yml、
  RELEASING.md、.editorconfig、.gitattributes、CHANGELOG
- package.json 补 repository/homepage/bugs/keywords/author/publishConfig.access/prepublishOnly
- `vima context` 命令（含 tests/unit/c3.context.test.mjs）
- admin 骨架权限体系：PermRegistry 从 `@PreAuthorize` 派生权限码 + `/system/menu/perm-options`，
  34 处控制器注解补齐，菜单权限标识改为代码派生下拉，三边对账测试
- admin 骨架日志与运维：logback-spring.xml、LogArchiveJob / DbLogRetentionJob 保留策略、
  docker-compose.yml、校验工具（ValidateUtil / ValidFormat）

### 变更
- 输出流向按契约 §3 收口：失败诊断与警告（validate/trace 的 ❌/⚠️ 清单、approve 前置失败、
  create/init 的独立 ⚠️ 提示）统一走 stderr——`vima validate > report.txt` 不再吞错误
- node:util parseArgs 英文报错统一翻译为中文（未知选项/缺少取值/不接受取值/多余的位置参数）
- 未知命令只输出一行错误 + 提示，不再倾倒全量帮助；非 VimaError 异常的堆栈改为仅 DEBUG 下输出
- render-review / render-prototype 静态复用 validate.mjs 的 validatePages，
  移除并行开发期的动态探测与内联兜底（约 146 行不可达代码）
- 顶层 help 标注模板成熟度（admin=stable，其余 preview，A5 诚实分级）
- admin 骨架鉴权改为 TokenAuthFilter（移除 JwtFilter / JwtUtil / InMemoryTokenStore）
- workspace hooks 由 .sh 改写为零依赖 .mjs（guard-shared、post-write）

### 修复
- README 过期数字（增补项 A1–A7、validate 规则数、测试规模）与 npm 页面死链（补 repository 字段）
- 设计文档漂移：§19 补 vima trace 条目、§7.5 补 A3 冷读深模式、§7.6 补 A7 运行时错误信号、
  §9.4 残留 src/pages、§15 结构树对齐骨架实际目录、契约 §2 所有权表过期项

## [2.0.0] - 2026-08-12

- 初始版本：create / init / upgrade / doctor / validate / render-review / render-prototype /
  sync / plan / approve / trace 全命令落地，含 admin 模板（前后端骨架 + planning/workspace 资产）
  与黄金链路端到端测试。
