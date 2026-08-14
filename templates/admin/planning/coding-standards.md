# 编码规范（admin 模板）

> 本文件由 vima init 安装（managed，勿手改；定制走项目 CLAUDE.md）。
> CLAUDE.md 只保留红线，本文承载细则（§5.2 详细规范指针的落点）。
>
> **执行者标签**（A6 规范强度阶梯）：每条规范末尾标注「谁保证它」——
> 〔L1·框架〕组件/框架默认行为承担，写不错；〔L3·hook〕guard-shared/post-write 写入时机检；
> 〔L3·validate〕`vima validate` 机检；〔L3·trace〕`vima trace` 对账；
> 〔L5·verifier〕Verifier 子代理逐点判定 + 人审。
> **纪律：没有执行者标签的规范不允许新增**——先按阶梯判层（能否由框架吸收 > 生成 >
> 机检 > 运行时量测），都做不到才落 L5 并进验收清单。

## 通用

- 前后端接口以 docs/contracts/ 契约文件为唯一事实来源，禁止自行定义路径、参数或字段
  〔L3·validate V-CODE-01/02 代码↔契约对账；L3·hook DEVELOPING 期契约写保护〕。
- 新建/修改的每个业务代码文件，头部注释必须含 `@vima <taskId>` 标注（A1 代码级追溯）
  〔L3·trace 野生标注/虚报嫌疑对账〕。
- 共享层目录（真源是 .vima/manifest.json 的端册 `apps[].sharedDirs` 与 `backend.sharedDirs`：
  admin 端 src/components、src/utils、vendor；mp 端 src/components、src/utils、src/vendor；
  后端 config/security 包）对业务任务只读；
  确需修改走 sharedChangeRequest（§10.7）〔L3·hook guard-shared 写令牌拦截〕。
- 页面结构以 spec 的 `vima:page` 数据块与 docs/review/prototype.html 为唯一真源（A2），
  任务文件与代码注释不得另行描述组件树〔L3·validate V-TASK-05；L3·hook 区块标记对账〕。

### 共享文件的并发写策略（A24）

并行批次里多个任务可能写同一个文件（最典型：同契约的多个前端任务都要写
`src/api/<module>.ts`）。官方口径只有两条，**不要各自发明**：

1. **一律追加，不要整体覆盖**。用 Edit 类操作在文件末尾追加导出，禁止用 Write 重写整个文件
   ——后写者整体覆盖会**静默抹掉其他人的导出，且 TypeScript 编译不报错**，
   要等别的页面运行时才炸。
2. **确实需要整体重写的，让任务不同批**。在 frontmatter 写
   `conflictsWith: [其他任务 id]`，`vima plan` 保证它们不进同一批次。

**不要**为了绕开冲突把 API 封装塞进视图目录——那违反「API 封装集中在 `src/api/<module>.ts`」，
并且把冲突从「并行时暴露」推迟成「最终人工合并」，更贵。

> 本文件是 vima 受管文件（`vima update` 会覆盖）。**项目自己的补充规范请写
> `docs/coding-standards.local.md`**——它不受管、不进 manifest，但同样随
> `vima context` 分发到每个任务（A24/F9）。

## 后端（Java 21 + Spring Boot + JPA）

- 分层：controller → service → repository；controller 不写业务逻辑〔L5·verifier〕。
- 响应统一 ApiResponse 包装；分页返回 PageResponse；错误码与契约 errors 一致〔L5·verifier〕。
- 参数校验用 jakarta.validation 注解（含自定义 `@ValidFormat`）+ GlobalExceptionHandler
  统一转 40001 风格错误〔L1·底座已内置，业务代码只写注解〕。
- 权限：接口按钮级权限用 `@PreAuthorize("@perm.has('模块:实体:动作')")`
  （perms 串与菜单 features 对应）〔L5·verifier〕。
- 不引入契约之外的新接口路径；新增接口先改契约再写代码（§9.5 契约纪律）
  〔L3·validate V-CODE-02 带 @vima 标注的 controller 路径 ∈ 契约〕。
- 单元测试的期望值必须来自**独立事实源**——契约的请求/响应示例、spec 第五章业务规则、
  手工推演的已知值；禁止用与实现同构的计算生成期望值（把实现里的公式抄进断言即是）——
  同构断言按构造必过、永不失败，视同无测试（A10）〔L5·verifier〕。

## 后端底座能力索引

| 入口 | 能力 |
|---|---|
| `ApiResponse` / `PageResponse` | 统一响应包装 / 分页结构（records/total/pageNum/pageSize） |
| `@perm`（security/PermChecker） | `@PreAuthorize("@perm.has('xx:yy:zz')")` 按钮级权限判定 |
| `PermRegistry`（security/） | 启动后从全部 Controller 注解扫描权限码，经 `GET /api/system/menu/perm-options` 下发给菜单页做下拉与漂移标红；新模块写了注解选项自动出现，无需改前端 |
| `GlobalExceptionHandler` | jakarta.validation / @ValidFormat 失败 → 400 + 40001；异常统一出口 |
| `ExcelUtil` | `export(response, fileName, …)` / `importSheet(in)`（用户模块有完整示例） |
| `OperLogAspect` | 操作日志切面：自动记录全部 controller 调用（Auth/Health 除外），业务模块无需自己写日志 |
| 新增业务模块产出物 | entity → repository → service → controller（@vima 标注 + 契约路径）+ 前端 `src/api/<module>.ts` + `src/views/<Page>/`；菜单与权限串在「系统管理 · 菜单」页配置（权限标识从下拉选代码中存在的码，先部署注解再配菜单）；接口若有意全员放行须注释「不加权限点」及理由 |

## 后端自检命令

- `mvn -q compile` + `mvn -q test`（骨架含上下文冒烟测试：Bean 装配 + H2 建表 + 种子数据）

## 端规范：admin-web

### 技术栈与页面形态

- 一律 `.vue` 单文件组件 + `<script setup lang="ts">`；业务页面放 src/views/<PageName>/
  〔L5·verifier〕。
- **组件已全局注册（main.ts `app.use(VimaUiAdmin)`），模板直接用，无需 import**；
  只有函数式 API（layer / message / messageBox 等）才从 `@vima-tech/ui-admin` 具名导入。
  禁止从 vendor/vima-ui-admin/dist 深路径导入；**`@vima/ui` 这个包不存在**，见到即为错
  〔L3·hook 幻包名与深路径导入拦截〕。
- 组件使用前先读 docs/ui-framework/CAPABILITY.md，再读对应组件文档；页面开工前按页面
  类型读 vendor/vima-ui-admin/dist/agent/docs/recipes/ 对应 recipe（只取数据契约/状态
  与质量/可访问性要点，builder 调用段不适用本项目）〔L5·verifier〕。
- 图标名只取 docs/ui-framework/ICONS.md 清单（生成自组件库 ai-manifest），不得杜撰
  〔L3·hook VIcon 字面量图标名 ∈ 清单〕。
- API 封装集中在 src/api/<module>.ts；请求经 `@/utils/request`（baseURL 已是 `/api`，
  路径写 `/module/...` 不再带 /api 前缀）；响应统一 ApiResponse 包装；
  分页参数命名 pageNum/pageSize〔L3·validate V-CODE-01〕。
- 禁止原生 confirm()/alert()——用 `@/utils/feedback` 的 confirmAsync/toast〔L3·hook〕；
  禁止在组件内写全局样式〔L5·verifier〕。
- 页面根一律 `<div class="vui-page" data-page="PAGE-xx">`（内边距/高度链/滚动的框架契约）；
  列表页查询表单写 `<VForm layout="inline" class="v-searchbar">`
  〔L3·hook 带 data-page 的页面机检 vui-page；标记对账见通用第 4 条〕。
- 颜色、圆角、间距只取 src/styles/tokens.css 的 `--v-*` 令牌；业务页（带 data-page）
  字面量色值（#hex / rgb / rgba）只允许出现在自定义属性定义行（`--x: …;`），
  属性值一律 var() 引用〔L3·hook〕。外壳样式在 src/styles/shell.css，
  业务页面用 `<style scoped>`。
- **裸尺寸同禁（A27）**：业务页 `gap/padding/margin/font-size` 不写 px 数值——
  「再紧/再松一点」换密度档（`.vui-density-compact/loose`，重定义 `--v-gap-*` 一族），
  确需局部值先 `--x: …` 定义再 var() 引用〔L3·hook〕。
- **整页版面不自写 grid（A27）**：两栏主次/主从/三列工作台/卡片墙用 `src/styles/layout.css`
  的版面原语（`.vui-layout-split/master/workbench/board`，PDL 的 design.pattern 对应表见
  docs/ui-framework/LayoutPrimitives.md）；列宽覆盖走变量不重写 grid-template-columns；
  没有的形态走 sharedChangeRequest 收编进真源〔L1·框架 + L5·verifier〕。
- **页面根类不覆写 height/overflow（A27）**：撑满与滚动由骨架契约统一保证
  （`.vui-page > * { flex-shrink:0 }`、末卡撑满），页面一覆写就回到「撑不满/被裁」的老路
  〔L3·hook〕。
- **行内动作用 ActionGroup（A27）**：按 PDL 的 priority 声明传入，可见容量随密度档自动变
  （compact 2 / default 3 / loose 4），溢出自动收「更多」——不自拼 VButton+VDropdown 重造收纳
  〔L1·框架已吸收；用法见 docs/ui-framework/ActionGroup.md〕。
- **机检只查风格合规与结构对账，不检查、也永远不会检查「是否使用了组件」（A27）**：
  组件是形态的一种实现，不是设计的单位——`shape: list` 可以落成表格、卡片墙或时间轴，
  表达形式的选择权在页面；无论选哪种，取值必须来自令牌、结构标记必须对上原型 manifest
  〔口径声明，hook 头注同文〕。
- 表格操作列**不写 width**：VTable 内建操作列识别（title 为「操作」或 key/customSlot 为
  `operator`），宽度按行内实际按钮文案自动计算〔L1·框架已吸收〕；手写字面量 width 会
  覆盖自动计算使漂移回潮，直接拦截〔L3·hook〕。
- 类型：契约里已有的共享类型从契约摘录，不重复手写第二份〔L5·verifier〕。
- **`VTab` 只是切换器，内容放在 `</VTab>` 之后，不要放进 `VTabItem` 的默认插槽。**
  三种视觉类型共用同一套 DOM（`.vui-tabs > .vui-tab-item > .vui-tab-title`），
  `.vui-tabs` 是 `display:flex; overflow:auto` 的横向标题条，`.vui-tab-content`
  没有任何样式。内容放进插槽会把激活项撑成内容那么宽、把后面的标题顶出可视区，
  **不报错**，只表现为「标题条能横向滚」——实测诊疗流程页九步里五步看不见
  〔L5·verifier；组件文档 docs/ui-framework/VTab.md「用法约束」节〕。
- **页签工作区会 keep-alive 常驻页面，离开后组件不卸载、`route` 仍在变**——所以任何
  「读 `route` + 有副作用」的地方都要先确认当前路由还是本页，否则会去动别的页面：
  - `router.replace({ query })` **不带 `path` 时作用于「当前路由」**，会把本页的查询参数
    写进用户已经切过去的那个页面的 URL；
  - `route.params.id` 里的 `:id` 往往不是本页独占的参数名，watch 它会拿到别的页面的 id
    并按那个 id 发请求（报错还会记在那个页面头上，排查时找错地方）。

  守卫判 `route.name`、不判 `route.path`——带 `:id` 的页面 path 会随 id 变，
  判 path 会把「页内换 id」也一起挡掉。守卫放在**有副作用的 watch** 上，不要放进 computed：
  computed 返回 undefined 会让 watch 走「空态」分支，在用户看不见的页面上清数据、弹弹窗。
  〔L5·verifier；实测三例：step 参数写进 /basedata/meal、模板设计器对患者 id 发
  GET /api/followup/templates/141 得 404、患者档案被别页 id 触发加载〕
- **`watch(..., { immediate: true })` 必须排在它触达的所有 `const` 声明之后。**
  立即执行发生在 setup 同步阶段，声明在下方的 `ref`/`reactive` 还在暂时性死区（TDZ）。
  这类错误被 Vue 的 `callWithErrorHandling` 吞掉——**页面照常渲染、不报红**，
  只是回调从抛错处往后整段不执行（实测：列表首次不加载、弹窗该弹不弹）。
  肉眼与截图都看不出来，只能靠 console 采集或静态扫描
  〔L5·verifier；扫描脚本见 .vima/reports/tdz-scan.mjs〕。

### 共享层能力索引（写业务前先查这里，别重造轮子）

| 入口 | 能力（签名细节以源码 JSDoc 为准） |
|---|---|
| `@/utils/request` | axios 实例：baseURL `/api`、自动携带 token、ApiResponse 解包（code≠200 即 reject）、401 统一清态跳登录、blob 响应透传 |
| `@/utils/feedback` | `confirmAsync(content, title?)` Promise 化二次确认；`toast / toastSuccess / toastError` |
| `@/utils/dict` | `useDict(type)` → `{ options, labelOf }`（模块级缓存，同类型只请求一次）；配套全局组件 `<DictTag :type :value>` |
| `@/utils/form` | `intFlag(form, 'status')`：后端 0/1 开关字段 ↔ VSwitch 布尔（防提交时类型漂移） |
| `@/utils/tree` | `toTree(平铺+parentId 列表)` → 树；`toTreeOptions(树, { rootLabel, excludeId, filter })` → 缩进式上级下拉选项（自动排除自身子树） |
| `@/utils/validate` | `rule.*` 表单规则工厂 + isMobile/isEmail/isIdCard/isAmount/isStrongPassword 等校验族 |
| `@/utils/datetime` | `formatDateTime / formatDate`（接受 string\|number\|Date\|null） |
| `@/utils/storage` | 带项目前缀的 localStorage 封装（get/set/remove，JSON 自动序列化） |
| `@/utils/menuIcons` | `MENU_ICON_PRESETS / DEFAULT_MENU_ICON / resolveMenuIcon`（菜单图标数据源） |
| `v-auth` 指令 | 按钮级权限：`<VButton v-auth="'system:user:add'">`（admin 通配 `*`）。权限码必须与后端 `@perm.has` 注解一字不差——菜单页「权限标识」下拉的选项即来自后端注解扫描（`GET /system/menu/perm-options`），不做自由输入 |

### 自检命令

- `npm run build:check`

## 端规范：mp-native

### 技术栈与页面形态

- 微信原生小程序 + TypeScript，**无框架、无转译层**。一页四文件
  `pages/<name>/index.{ts,json,wxml,wxss}`〔L5·verifier〕。
- 页面根一律 `<view class="vm-page" data-page="PAGE-xx">`，区块容器带 `data-block="<布局词>"`
  〔L3·hook 带 data-page 的 .wxml 区块标记对账〕。
- **所有网络请求走 `utils/request.ts` 门面且路径写字面量**：`request.get('/app/xxx')`。
  直接 `wx.request` 会让代码↔契约对账失明——接口不在契约里查不出来、
  调了别的端的接口（越权）也查不出来〔L3·validate V-CODE-01 含 consumers 越权判定〕。
- 接口封装集中在 `src/api/<module>.ts`；BASE_URL 在 `src/config.ts`，
  契约写 `/api/app/...`、代码写 `/app/...`（机检自动补前缀后对账）〔L3·validate V-CODE-01〕。
- 组件使用前先读 `docs/ui-framework/<appId>/CAPABILITY.md`，再读对应组件文档
  〔L5·verifier〕。
- **行为一律用微信原生能力**，框架不接管行为：`wx.showToast`（轻提示）、
  `wx.showModal`（确定/取消）、`wx.showLoading`（全屏加载）、`wx.showActionSheet`（动作菜单）、
  原生 `<picker>`（下拉/日期/时间）、原生 `<switch>`、`wx.chooseMedia` + `wx.uploadFile`（上传）、
  `app.json` 的原生 `tabBar`（底部导航）〔L5·verifier〕。

### 样式

- 颜色、字号、圆角、间距只取 `vendor/vima-ui-mp/dist/tokens.wxss` 的 `--vm-*` 令牌，
  类只用 `vm-*`；业务页 `.wxss` 里出现字面量色值即为错〔L3·hook〕。
- **不得修改 `vendor/vima-ui-mp/dist/` 下任何文件**（共享层，且 `vima update` 会覆盖）；
  要覆盖就在项目自己的 wxss 里重定义令牌〔L3·hook guard-shared 写令牌拦截〕。
- 三处 JSON/原生属性吃不到 CSS 变量、只能写字面值，换主题时必须同步：
  `app.json` 的 `tabBar.color`/`selectedColor`、`app.wxss` 的 `page { background-color }`、
  `<switch color="...">`〔L5·verifier〕。
- 适老化：页面根按 `app.globalData.aging` 拼 `vm-aging`，不要逐页自己写放大规则
  〔L1·框架已吸收（重定义字阶令牌）〕。

### 小程序特有的坑（写之前先看）

- **`setData` 只传变化的字段**，不要整包回灌；单次数据量有上限，长列表用
  `onReachBottom` 追加而不是一次全量〔L5·verifier〕。
- **原生组件层级最高**：`<textarea>` `<input>` `<canvas>` `<video>` `<map>` 会盖住普通
  `<view>`。同屏出现弹层（`VmPopup`）时，弹层必须用 `wx:if` 而不是 `hidden`，
  且背后的原生组件要卸载或隐藏，否则表现为「弹窗被输入框穿透」〔L5·verifier〕。
- **`<input>` 的 placeholder 不吃 CSS 继承**：必须写
  `placeholder-class="vm-input-placeholder"`〔L5·verifier〕。
- **`wx.chooseImage` 已废弃**，用 `wx.chooseMedia`〔L5·verifier〕。
- 微信开放能力（`getPhoneNumber`/`getUserProfile` 等）只能由 `<button open-type>` 触发，
  套在 `<view>` 上点了没反应〔L5·verifier〕。

### 自检命令

- 编译：微信开发者工具打开本端目录（`miniprogramRoot` 为 `src/`），控制台无报错即通过。
- 运行时证据：`npm run runtime:collect`（A7，需开发者工具 + 已打开「服务端口」）。
  工具不在场时**不写文件**，`/check` 会如实报「该端无运行时证据通道」——
  空文件会被读成「跑过且零错误」，比没有证据更糟。

## 端规范：h5-mobile

### 技术栈与页面形态

- Vue 3 + Vite + TypeScript，`<script setup lang="ts">` 单文件组件；业务页面放
  `src/views/<PageName>.vue`，并在 `src/router/index.ts` 登记〔L5·verifier〕。
- **页面根是 `<div class="vm-body" data-page="PAGE-xx">`（或 `vm-sheet`），不是 `vm-page`**
  ——`vm-page` 在 `App.vue` 根上（令牌作用域与全局反馈组件要在同一层），页面里再套一层
  就成了两个页面容器〔L3·hook 带 data-page 的 .vue 页面根机检〕。
  区块容器带 `data-block="<布局词>"`〔L3·hook 区块标记对账〕。
- **所有网络请求走 `utils/request.ts` 的门面且路径写字面量**：`request.get('/app/xxx')`。
  直接 `axios`/`fetch` 会让代码↔契约对账失明——接口不在契约里查不出来、
  调了别的端的接口（越权）也查不出来〔L3·validate V-CODE-01 含 consumers 越权判定〕。
- 接口封装集中在 `src/api/<module>.ts`；`baseURL` 已是 `/api`（dev 由 vite proxy 转后端），
  路径写 `/module/...` 不带 /api 前缀〔L3·validate V-CODE-01〕。
- 组件使用前先读 `docs/ui-framework/<appId>/CAPABILITY.md`，再读对应组件文档〔L5·verifier〕。
- **框架组件已全局注册**（`main.ts` 的 `app.use(VimaUiH5)`），模板直接写
  `<VmNavbar>` `<VmTabbar>`；函数式反馈从 `'@ui'` 具名导入 `toast` / `confirmAsync`。
  禁止深路径导入 `vendor/vima-ui-h5/dist/components/*`；禁止原生 `confirm()`/`alert()`
  〔L3·hook 深路径导入与原生弹窗拦截〕。
- 路由 `name`、`VmTabbar` 的 `items[].key`、spec 该端 `vima:menus` 三处必须一致，
  否则底部导航高亮不了〔L5·verifier〕。

### 样式

- 颜色、字号、圆角、间距只取 `vendor/vima-ui-h5/dist/tokens.css` 的 `--vm-*` 令牌，
  类只用 `vm-*`；页面 `<style scoped>` 里出现字面量色值即为错〔L3·hook〕。
- **不得修改 `vendor/vima-ui-h5/dist/` 下任何文件**（共享层；且其中 `tokens.css`/`ui.css`
  与小程序端同名 `.wxss` 字节一致，改一行会让 vima-cli 单测直接红）
  〔L3·hook guard-shared 写令牌拦截〕。
- 适老化：`App.vue` 根按 `utils/prefs.ts` 的 `aging` 拼 `vm-aging`，不要逐页自己写放大规则
  〔L1·框架已吸收（重定义字阶令牌）〕。
- H5 端**没有**小程序那三处必须同步的裸色值例外——全部走 CSS 变量〔L5·verifier〕。

### 浏览器端特有的坑（写之前先看）

- **`100vh` 含地址栏**：页面容器高度用框架的 `.vm-page`（`global.css` 已按 `100dvh` 兜底），
  不要自己写 `height: 100vh`〔L1·框架已吸收〕。
- **底部固定元素要避开安全区**：用 `.vm-actionbar` / `VmTabbar`（都已带
  `env(safe-area-inset-bottom)`），不要自己 `position: fixed; bottom: 0`〔L1·框架已吸收〕。
  同页不要同时出现 `.vm-actionbar` 与 `VmTabbar`——两条固定底栏会叠在一起〔L5·verifier〕。
- **列表触底加载**：H5 的滚动容器是窗口，用 `IntersectionObserver` 观察列表末尾哨兵元素，
  不要监听 `scroll` 后做 `getBoundingClientRect` 轮询（低端机掉帧）〔L5·verifier〕。
- **弹层打开时锁背景滚动**：给 `document.body` 加 `overflow: hidden`，关闭时还原
  （小程序侧靠 `catchtouchmove`，浏览器没有对应机制）〔L5·verifier〕。
- 表单里的 `<button>` 必须写 `type="button"`，否则触发表单默认提交刷新页面〔L5·verifier〕。

### 自检命令

- `npm run build:check`（`vue-tsc --noEmit` + `vite build`）。
- 运行时证据：`npm run dev` 期间未捕获错误自动落盘
  `<项目根>/.vima/reports/runtime-errors.<appId>.jsonl`（A7，vite 中间件，构建产物不含）。
