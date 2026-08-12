# {{projectName}}

基于 vima admin 模板生成的管理后台项目：Vue 3 + TypeScript + Vite（前端，项目根）
/ Java 21 + Spring Boot（后端，`backend/`）。开箱即含完整系统底座，你只需要专注业务需求。

## 启动

后端依赖两个基础组件：**PostgreSQL**（业务数据）与 **Redis**（登录态 + 权限缓存），
两者都是必需的，缺一个后端起不来 / 登不上。`backend/docker-compose.yml` 已按
`application.yml` 里的端口账号配好，直接拉起即可。

```bash
# 1. 基础组件（PostgreSQL 5432 + Redis 6379；podman 用户用 podman-compose）
cd backend && docker compose up -d

# 2. 后端（端口 8080；首次启动自动建表并灌种子数据）
#    无需预装 Maven：mvnw 首次运行会把 Maven 下到 ~/.m2/wrapper 再执行
./mvnw spring-boot:run

# 3. 前端（另开终端，项目根；端口 5173，/api 已代理到 8080）
npm install   # vima create 时若未跳过则已装好
npm run dev
```

打开 http://localhost:5173 登录。

> 已有自己的 PG / Redis 实例时，跳过第 1 步，改
> `backend/src/main/resources/application.yml` 里的 `spring.datasource` 与
> `spring.data.redis` 即可。换用 MySQL / 人大金仓等其他数据库见
> `backend/src/main/resources/application-database.yml`。

## 默认账号

| 账号 | 密码 | 角色 |
|---|---|---|
| `admin` | `admin123` | 超级管理员（权限通配 `*`） |
| `test` | `test123` | 普通用户 |

## 开发辅助地址（后端启动后）

- API 文档（swagger-ui）：http://localhost:8080/swagger-ui/index.html

## 登录态是怎么存的

登录成功后签发的是**不透明随机串**（不是自包含 JWT），映射关系存在 Redis：

| Redis key | 内容 | TTL |
|---|---|---|
| `token:<token>` | 用户名 | `auth.token-ttl`（默认 24h，每次请求滑动续期） |
| `user:token:<用户名>` | 该用户当前 token | 同上 |
| `perm:perms\|paths\|icons:<用户名>` | 权限点 / 可见菜单 / 菜单图标缓存 | `app.perm-cache-ttl`（默认 30 分钟） |

这样设计是为了让服务端能**立刻作废**一个已发出的凭证——强制下线、改密重登、
账号禁用都要求说撤就撤，而签名 JWT 在过期前撤不掉。

由此带来几条已内置的行为，改业务时别绕过：

- 同一账号重复登录会顶掉上一个会话（`user:token:*` 反查索引保证只有一个活跃 token）
- 改密码 / 管理员重置密码 / 禁用账号 / 删除账号，都会立刻踢掉该用户的登录态
- 改角色授权、改菜单 perms 后权限缓存会主动失效，不必等 TTL
- HTTP 语义：**401 = 登录态失效**（前端自动清态跳登录页）、**403 = 已登录但没这个权限**
  （只弹提示，不跳转）。业务错误一律走 HTTP 200 + body 里的 `code`

## 系统底座已内置

以下能力随骨架自带，无需重复开发：

认证（登录/登出，登录态见下节）、RBAC 权限（角色-菜单，细到按钮级 perms）、用户管理、角色管理、
菜单管理、部门管理、字典管理、参数配置、文件上传、操作日志与登录日志、站内消息、
定时任务、在线用户（含强制下线）、Excel 导入导出、API 文档（springdoc）。

业务模块若需按钮级权限：前端按钮标注 perms 串（如 `system:user:add`），
后端对应接口加 `@PreAuthorize("@perm.has('system:user:add')")`。

## 目录导览

```
├── src/                  # 前端源码
│   ├── api/              # 接口封装（按模块一文件）
│   ├── assets/           # 静态资源
│   ├── components/       # 布局与通用组件 —— 共享层，业务任务只读
│   ├── router/           # 路由（含动态菜单路由）
│   ├── store/            # Pinia 状态
│   ├── styles/           # 视觉层：tokens(令牌) / base(重置·高度链) / shell(外壳皮肤)
│   ├── utils/            # 请求封装、数据校验(validate.ts)等工具 —— 共享层，业务任务只读
│   └── views/            # 页面（业务页面加在这里）
├── vendor/vima-ui-admin/ # vendored 组件库（离线可用）—— 共享层，业务任务只读
├── backend/              # Spring Boot 后端
│   └── src/main/java/com/{{projectPkg}}/
│       ├── controller/ service/ repository/ entity/ dto/   # 业务代码加在这里
│       └── common/ config/ security/                        # 共享层，业务任务只读
└── docs/                 # vima init 后生成：spec/契约/任务/评审视图
```

## 视觉规范

配色是企业蓝 v3，与组件库 `@vima-tech/ui-admin` 同源。三条纪律：

- **取色只走令牌**：页面里写 `var(--v-primary)` 之类，不写死 `#2f73c5`。全部令牌在
  `src/styles/tokens.css`，换品牌改这一个文件（它同时接管组件库的 `--vui-*`，见 `src/style.css`）。
- **外壳样式集中**：顶栏 / 侧栏 / 工作区标签条的样式在 `src/styles/shell.css`，
  对应的四个布局组件不写 `<style>`；业务页面各自用 `<style scoped>`。
- **页面根用 `.vui-page`**：内边距、高度链、滚动都由它给。不写这个类，页面内的表格拿不到
  确定高度，滚动会落到整页上，搜索栏和分页跟着划走。列表页的查询表单写
  `<VForm layout="inline" class="v-searchbar">`，宽度由 `styles/base.css` 的搜索栏契约统一。

共享层目录对业务任务只读（PreToolUse hook 强制），确需修改走 sharedChangeRequest。
新建/修改业务代码文件头部必须带 `@vima <taskId>` 注释标注（代码级追溯，`vima trace` 对账）。

## vima 工作流（三步）

1. `vima init` —— 部署 Claude Code 工作环境（项目宪法/生命周期/命令/角色/hooks）；
2. 启动 `claude`，进入 **PLANNING**：把原始需求丢进 `docs/raw/`，与 Agent 对话梳理出
   spec/契约/任务/覆盖矩阵，浏览器审 `docs/review/`，最后 `vima approve`；
3. 对 Agent 说 `/go` —— 按批次计划并行编码 + 机械验收，直至业务闭环。
