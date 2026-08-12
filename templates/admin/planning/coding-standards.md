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
- 共享层目录（见 template.json sharedDirs：src/components、src/utils、vendor
  与 backend 的 config/security 包）对业务任务只读；
  确需修改走 sharedChangeRequest（§10.7）〔L3·hook guard-shared 写令牌拦截〕。
- 页面结构以 spec 的 `vima:page` 数据块与 docs/review/prototype.html 为唯一真源（A2），
  任务文件与代码注释不得另行描述组件树〔L3·validate V-TASK-05；L3·hook 区块标记对账〕。

## 前端（Vue 3 + TypeScript + Vite + @vima-tech/ui-admin）

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
- 表格操作列**不写 width**：VTable 内建操作列识别（title 为「操作」或 key/customSlot 为
  `operator`），宽度按行内实际按钮文案自动计算〔L1·框架已吸收〕；手写字面量 width 会
  覆盖自动计算使漂移回潮，直接拦截〔L3·hook〕。
- 类型：契约里已有的共享类型从契约摘录，不重复手写第二份〔L5·verifier〕。

## 前端共享层能力索引（写业务前先查这里，别重造轮子）

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

## 后端（Java 21 + Spring Boot + JPA）

- 分层：controller → service → repository；controller 不写业务逻辑〔L5·verifier〕。
- 响应统一 ApiResponse 包装；分页返回 PageResponse；错误码与契约 errors 一致〔L5·verifier〕。
- 参数校验用 jakarta.validation 注解（含自定义 `@ValidFormat`）+ GlobalExceptionHandler
  统一转 40001 风格错误〔L1·底座已内置，业务代码只写注解〕。
- 权限：接口按钮级权限用 `@PreAuthorize("@perm.has('模块:实体:动作')")`
  （perms 串与菜单 features 对应）〔L5·verifier〕。
- 不引入契约之外的新接口路径；新增接口先改契约再写代码（§9.5 契约纪律）
  〔L3·validate V-CODE-02 带 @vima 标注的 controller 路径 ∈ 契约〕。

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

## 自检命令

- 前端：`npm run build:check`
- 后端：`mvn -q compile` + `mvn -q test`（骨架含上下文冒烟测试：Bean 装配 + H2 建表 + 种子数据）
