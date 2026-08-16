# AI-First 深度评估：admin 脚手架 + vima-ui-admin

> 创建：2026-08-12。性质：**评估文档**（非需求真源；采纳的条目应回设计文档立 §/A# 后再实现）。
> **落地状态（2026-08-12）**：§8 路线第 1–5 步已落地为增补项 **A6/A7**（v2.1-amendments.md）
> 并实现（设计文档 v2.0.3 版本历史有全清单）；§3 操作列案例的 L1 终态由组件库侧并行实现
> （VTable 按行内按钮文案自动算宽）。未落地：B1 `vima context` 上下文打包、C1 spec→骨架
> 生成（§8 第 6 步，需先立契约格式）、E3 DOM 量测探针、库侧 F 清单其余项。
> 方法：全部结论来自对 `templates/admin/**`、vendor dist 产物与 `lib/` 的直接读取和 grep/node 实证，
> 每条带 `文件:行号` 或可复跑命令；本评估未改动任何源码。
> 目标定义（用户口径）：让 AI 更容易上手、更容易保证质量地完成开发任务。

## 0. 结论摘要

调度与追溯已是强项（三道闸门、任务点台账、批次检查点、断点续跑），不需要动。
短板集中在三处，按杠杆排序：

1. **规范执行力**：多数编码规范没有机器执行者，靠 AI 自觉。已机检的只有
   「禁 confirm/alert」「禁深路径导入」「区块标记对账」三条；「禁写死 token」
   「.vui-page」「操作列宽度」等全部裸奔——内置页自己都不一致（见 §3 案例）。
2. **上下文经济**：CRUD 前端任务的当前必读集实测 **32.5KB**（CLAUDE.project +
   coding-standards + CAPABILITY + 9 份组件文档 + 契约示例 + 任务模板），其中组件文档
   的「用法」段全是空示例（`<VTable />`）；对照库自带的 crud-dialog recipe + SKILL.md
   合计 **2.5KB** 且信息密度更高，却一次都没被引用。
3. **证据链止步于静态**：verifier 只认「文件:行号」，hook 只查标记与导入，
   完成定义写的 lint/test 门实际不存在（无 lint script、后端零测试）。
   「长得对」≠「跑得通」，而脚手架具备零依赖跑通的全部条件（H2 默认 + /api/health）。

贯穿性方法论见 §2「规范强度阶梯」——它同时回答「这种规范要求如何保证」。

## 1. 判定框架：AI-First 的两个可度量目标

- **上手成本** = 完成一个任务需装载的最小正确上下文字节数，且这套上下文能被
  **机械组装**（确定性地按任务给出，而不是靠 Agent 自觉找齐、读全、读对版本）。
- **质量保证** = 每条规范有唯一明确的**执行者**（组件 / 生成器 / hook / 探针 / verifier），
  且证据链至少有一段落在**运行时**。没有执行者的规范等于建议。

## 2. 规范强度阶梯（核心方法论）

任何一条「AI 开发规范」按下表从上往下找它能停留的最高层；
**每上移一层，AI 出错的可能性和纠错的成本各降一个量级**：

| 层 | 机制 | 保证方式 | 适用判据 |
|---|------|---------|---------|
| L1 框架吸收 | 组件/框架默认行为承担规范 | **规范消失**，AI 无法写错 | 规范可表达为组件行为/默认值 |
| L2 确定性生成 | 这段代码不由 AI 写，由渲染器/builder 生成 | AI 只填业务空 | 规范可表达为骨架/模板产物 |
| L3 机械检查 | hook exit 2 / validate 规则，当场结构化反馈 | 写错立刻被打回 | 一条正则/AST 查得出来 |
| L4 运行时量测 | 探针在真实 DOM/接口上量 | 观感/行为类兜底 | 静态查不出、运行时可量化 |
| L5 文档+逐点判定 | coding-standards + verifier points + 人审 | 最弱，概率性 | 以上都做不到时的兜底 |

配套纪律两条：

- **执行者标签**：coding-standards.md 每条规范末尾标注执行者
  （`[L1:VTable]` / `[L3:post-write]` / `[L5:人审]`……）。无标签条目 = 债，
  一眼可盘点。这与 validate.checklist 逐条镜像 CLI 规则的既有做法同构。
- **入册即判层**：新增规范时先问「能不能上移一层」。发现自己在往
  coding-standards 里写一条无执行者的规范时，等同于发现债。

## 3. 案例研究：「操作列宽度按按钮数自动计算」如何保证

### 现状实证（规范只存在于注释里，内置页五种写法）

```
menu:85    width: 160    dict:53  width: 230（注释:「按三颗 sm 按钮的实际占位给」）
dept:67    width: 160    dict:61  width: 160
config:39  width: 150    job:40   width: 220
role:51    width: 230    user:65  不写 width（内容列定宽，剩余给操作列）
file:21    注释口径又是「剩余宽度交给末列操作列」
```

同一条心智规范，7 个页面 5 种落法、两种相反口径（定宽 vs 撑满）。
这就是 L5（写在注释/文档里）的真实下场——**AI 学到的是不一致本身**。

### 逐层评估

- **L5 写进 coding-standards**：AI 记不住也验不了；「按钮数」在代码里是
  customSlot 模板内容，连人肉 review 都要跳着看。最差选择。
- **L3 hook 机检**：正则抓 `title: '操作'` 行查「是否写了字面量 width」容易且零误报；
  但「width 是否 = f(按钮数)」要 AST 数 slot 里的按钮，噪声大。→ 半可行，只能查「禁手写」。
- **L2 生成**：spec 的 `vima:page` 数据块里 **rowActions 已经声明了每行按钮清单**
  （spec.admin.md 骨架自带），页面骨架生成器有全部输入可以算出 width——完全可行。
- **L1 库吸收（推荐终态）**：VTable 目前没有「操作列」概念（17 个 props 里没有，
  见 ui-docs/VTable.md）。给它加一等公民支持（如 `column.type: 'actions'` 或
  `rowActions` prop），宽度由组件按 按钮数 × size 占位自动计算。
  规范从此**不存在**：7 个内置页同步受益，AI 生成的业务页永远不会写错，
  上下文成本为零。
- **L4 兜底**：DOM 探针断言操作列按钮无换行/裁切（scrollWidth − clientWidth 类
  量化探针，比截图快且准）。

### 落法建议（分三步，可各自独立验收）

1. **今天就能做（脚手架侧）**：公式收进共享层
   `src/utils/table.ts → actionColumn(buttons: n, size?)`，7 个内置页统一改用；
   coding-standards 加一条「操作列一律 actionColumn()，禁写字面量 width」并标
   `[L3:post-write]`；post-write hook 加正则：`title: '操作'` 同行出现 `width:` 数字
   字面量即 exit 2。执行者齐了，规范才算「立住」。
2. **中期（库侧）**：VTable 吸收操作列概念，helper 退役，规范从 coding-standards 删除。
3. **长期（验收侧）**：运行时探针把「操作列不换行不裁切」纳入逐点证据。

**这个案例的通解就是 §2 的阶梯判定**：用户以后每想「把 X 记录为 AI 规范」，
都走一遍同样的判层流程，而不是默认落进 coding-standards。

## 4. 现状资产盘点（做对了的，别动）

- **受限 DSL 质量高**：`vima:page` 封闭词表（7 个 block 词）+ 交互三分类
  （nav/modal/api）+ rowActions/fields 结构化——受限生成的理想真源，比库侧
  AppSpec 更贴本仓流程。
- **契约 YAML 类型化**（request/response 逐字段带 type/required）——类型生成的现成输入。
- **调度纪律完整**：三道闸门、任务点台账（B1-B3）、增量修复模式、批次 git 检查点、
  running 孤儿处理、会话预算。
- **hook 的「出路话术」**：guard-shared 拦截时告诉 AI「不要做什么、改做什么、找谁」
  ——AI-First 错误消息的范本，所有新机检都应沿用这个话术结构。
- **标记对账链**：data-page/block/modal ↔ prototype.manifest.json，
  hook 写时拦 + verifier 复核，是目前唯一打通「规划→代码」的全机械通道。
- **vendored 库已有的 AI 资产**（一行未用，见 §6C）：ai-manifest.json
  （63 组件 283 props 全带描述 + 85 图标名 + 8 服务）、`/agent` 子入口
  6 个确定性 builders + 2 个校验器、8 份 recipe + AppSpec v1 Schema、
  UIError 结构化诊断类型。
- 其他：H2 默认零依赖可跑、tokens 体系、全局注册 + components.d.ts（免 import）。

## 5. 规范执行力矩阵（现有规范 → 执行者盘点）

| 规范 | 当前执行者 | 层级 | 应升级到 |
|------|-----------|------|---------|
| 区块标记与 manifest 一致 | post-write + verifier | L3 ✅ | 保持（标杆） |
| 禁 confirm/alert | post-write | L3 ✅ | 保持 |
| 禁深路径导入 dist | post-write | L3 部分 | 拦不住幻包名 `@vima/ui`（见 §6A） |
| 契约唯一真源（规划期） | validate V-CON-* + guard-shared | L3 ✅ | 补「代码↔契约」对账（§6D） |
| `@vima <taskId>` 追溯 | vima trace | L3 ✅ | 保持 |
| 禁写死颜色/圆角/间距 | 无 | L5 | L3 token-lint（先定豁免口径：内置页现存 27 处） |
| 页面根 .vui-page | 无 | L5 | L3（14/16 页达标，404/login 属合理豁免须写明） |
| 操作列宽度 = f(按钮数) | 无（注释） | L5 | L1，路径见 §3 |
| 图标名必须存在 | 无（VIcon.md 不给清单） | L5 | L3：`name=` 值 ∈ manifest 85 名 |
| perms 串 ↔ spec features ↔ @PreAuthorize | 无 | L5 | L3 对账（三处都是结构化文本） |
| 接口路径/字段与契约一致 | verifier 人判 | L5 | L3 双向对账 + 类型生成（§6D） |

## 6. 优化空间清单

标注：〔脚〕脚手架侧（本仓）／〔库〕组件库侧（ui-admin 仓，经 vendor 同步）。

### A. 真源卫生（P0，先做——文档说谎比没文档更毒）

1. 〔脚〕**幻包名 `@vima/ui`**：CLAUDE.project.md:4、coding-standards.md:16,20、
   vima-builder.md:16、_template-fe.md:66 共 5 处教 AI 用一个不存在的包
   （真名 `@vima-tech/ui-admin`；且全局注册后组件根本无需 import，规范口径应改为
   「模板直接用组件；仅 layer/message/messageBox 等函数式 API 具名导入」）。
2. 〔脚〕**`npm run lint` 不存在**却被 4 处当验收门（coding-standards.md:39、
   _template-fe.md:58,71、check.md:38 的「eslint ✅」）。Builder 每次自检都拿到
   Missing script 非零退出——**在训练 AI 忽略自检失败**。补 lint 或删引用，二选一。
3. 〔脚〕**`mvn test` 恒绿**：backend 无 test 目录零用例，「第四道完成定义」空转。
4. 〔脚〕**SKILL.md 要求跑 `npm run check:ai`**（vendor agent/docs/SKILL.md:18、
   README.md:13），脚手架无此 script——库文档随 dist 发货进消费项目时口径未换。
5. 〔脚〕**components.d.ts 手工维护已漂移**：44 条 vs 库 63 组件。应由
   ai-manifest 生成（同源两渲染）。
6. 〔双〕**版本戳对账**：库自查文档承认「Starter 锁定的 ui-admin@0.1.0 与当前同
   版本源码出口不同」（vendor 分叉记忆同证：dist 被逐文件手补，比库源码新）。
   建议 `vima doctor` 增查：vendor package.json 版本 / ai-manifest.version /
   ui-docs 生成戳三者一致，防「文档描述旧行为」静默漂移。
7. 〔脚〕CAPABILITY.md 的 VDropdown 描述栏泄漏内部分叉备注（生成脚本取数问题）。

### B. 上下文经济（让「上手」从翻文档变成领弹药）

1. 〔脚〕**`vima context <taskId>`（确定性上下文打包）**：CLI 按任务机械组装
   最小必读集——该页 `vima:page` 块 + 契约切片（只含本页 apis）+ 本页组件的
   manifest 切片 + 对应 recipe + 共享层索引，输出单文件。
   把「Agent 自觉读齐读对」变成确定性操作，与「确定性优先」硬约束同构。
   这是 33KB→约 8-10KB 且零遗漏的路径。*需回设计文档立条目再做。*
2. 〔脚〕**ui-docs 再生成**：真实示例替换空示例（8 份 recipe 的 examples 是现成
   语料）、口径改为免 import、与 ai-manifest 同源。
3. 〔脚〕**ICONS.md**：manifest 85 个图标名导出成一页清单——现在 AI 写 `name=` 全靠编。
4. 〔库〕**useWhen/avoidWhen 填充**：manifest 里 63 组件只填了 1 个。这是组件选型
   （VLayer vs VDrawer vs messageBox）唯一的机器可读依据。
5. 〔脚〕**脚手架自身 API 索引**：utils/form|tree|dict|feedback、DictTag、request、
   auth 指令在 AI 必读文档中提及次数为 **0**（实测 grep）。共享层只读却不可见，
   AI 只能重复造轮子或瞎猜。一页索引即可（谁、干什么、一行签名）。
   后端同理：底座入口（ApiResponse/PageResponse/ExcelUtil/@perm.has/OperLog 注解）
   一页说清「加一个模块要写哪五个文件」。

### C. 受限生成（把自由发挥变成填空）

1. 〔脚〕**spec → 页面骨架生成**：`vima:page` 已含 layout/components/rowActions/
   modals/apis 全部结构信息，渲染器（同 prototype.mjs 的确定性风格）可直接产出带
   data-* 标记、带 actionColumn、带 API 层签名的页面骨架，AI 只填业务逻辑。
   这是把 §2 的 L2 做实的主路径。*文件格式/映射规则先进 internal-contracts.md。*
2. 〔库〕**builders 产物补 data-* 标记**：实测 agent/index.js 产物含 vui-page 但
   data-page/block/modal 为 0 处——现状接进来会被自家 post-write hook 拦下。
   库侧补标记后，buildCrudPage 等单页 builders 可作为 1 的实现底座。
3. **边界（防过度设计）**：`createArtifactPlan`（整应用编排）不进宿主项目——
   库自己的受控生成设计文档存量问题第 7 条已判「适合独立前端壳，不适合修改
   Starter 宿主」。AppSpec 也不做第二真源，只做 spec 的映射目标。

### D. 机检密度（每条红线一个执行者）

1. 〔脚〕token-lint（正则查字面量色值/圆角/间距；**先清内置页 27 处存量、
   定豁免口径**——豁免规则不先立，白名单会反过来掩盖真缺陷）。
2. 〔脚〕.vui-page 检查（豁免 404/login 写进规则）。
3. 〔脚〕图标名 ∈ manifest（一行 JSON 查找，零误报）。
4. 〔脚〕**契约↔代码双向对账**（补 verifier 静态判断的最大盲区）：
   前端 `src/api/*.ts` 的路径字面量（baseURL '/api' + `request.get('/system/user/list')`
   可拼出完整路径）↔ 契约 apis；后端 `@RequestMapping("/api/system/user")` +
   `@GetMapping("/list")` 拼接 ↔ 契约 apis。两侧都是确定性正则活，进 validate
   的 V-CODE-* 家族，DEVELOPING 期跑。
5. 〔脚〕perms 三方对账：spec menu.features ↔ `@perm.has('...')` ↔ 前端 v-auth 串。
6. 〔脚〕规范执行者标签落进 coding-standards.md（§2 纪律）。

### E. 运行时证据（从「长得对」到「跑得通」）

1. 〔脚〕**后端冒烟门**：起 H2 后端 → node fetch 打 /api/health + 登录 + 每模块
   一个契约接口 → 前端 vite build。全部现成条件，零新依赖。
   注意：workspace settings.json deny 了 `Bash(curl *)`，冒烟脚本用 node 内建 fetch。
2. 〔脚+库〕**运行时错误落盘给 AI 看**：AI 不开浏览器，console 错误对它不存在。
   dev 态把 window error/unhandledrejection + 库的 UIError 结构化诊断 POST 到
   vite dev middleware，追加写 `.vima/runtime-errors.json`，/check 与 verifier 聚合。
   库侧 UIError 的 code/suggestion/documentation 字段本来就是为此设计的，缺的只是
   落盘通道。
3. 〔脚〕DOM 量测探针（操作列裁切、区块真实渲染、溢出/空洞类量化断言）——
   需浏览器驱动，属重项，放最后且默认可选。

### F. 库侧汇总（走 ui-admin 仓，vendor 同步回来）

操作列一等公民（§3）；builders 补 data-* 标记（§C2）；文档生成带真实示例 +
useWhen/avoidWhen 语料（§B2/B4）；dev 态 validateProp 诊断接落盘协议（§E2）；
check:ai 的消费项目版口径（§A4）。

## 7. 明确不建议做的（防过度设计）

| 不做 | 理由 |
|------|------|
| AppSpec 当第二真源 | spec `vima:page` 已是全流程真源（validate/原型/manifest/verifier 都挂在它上），双真源必漂移 |
| createArtifactPlan 进宿主 | 库自己的设计文档存量问题 7 已判不适合；单页 builders 才是对的粒度 |
| 后端 DTO/实体代码生成 | JPA 注解/关系/校验的生成矩阵远比前端类型复杂，先做对账（D4）收益的 80% |
| 现在上全量 e2e 框架 | 冒烟门 + 错误落盘先把「跑得通」立住；探针分级在后 |
| 运行时 schema 注册 | 焊死 tree-shaking，62 份 schema 约 +40-60KB 死重；manifest 子路径导出已是正解 |

## 8. 建议路线（每步独立可验收）

| 步 | 内容 | 验收判据 |
|----|------|---------|
| 1 | §6A 真源卫生 1-5、7 | grep `@vima/ui` 模板零命中；`npm run lint` 存在或零引用；SKILL 口径修正 |
| 2 | 执行者标签 + 低成本机检（D1-D3、D6，§3 第 1 步 helper） | coding-standards 每条带标签；hook 对样例违规 exit 2；内置页 token 存量清零 |
| 3 | 上下文经济 B2-B5（recipe 指针、ICONS、API 索引） | Builder 指令中的必读清单换新；字节数对比留档 |
| 4 | 契约↔代码对账 D4-D5 | `vima validate` 对故意错路径的样例报 V-CODE-* |
| 5 | 后端冒烟门 E1 + 错误落盘 E2 | 一条命令全绿/全红可复现 |
| 6 | `vima context`（B1）+ spec→骨架生成（C1） | 先进 internal-contracts.md 立格式，再实现 |
| 7 | 库侧 F 清单 | 随 ui-admin 版本 + vendor 同步 + doctor 版本戳对账（A6）上线 |

—— 以上每条均可反查到本次评估的实证；采纳前按仓库纪律回设计文档立 §/A# 条目。
