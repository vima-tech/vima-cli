# {{projectName}}

基于 vima admin 模板生成的管理后台项目：Vue 3 + TypeScript + Vite（前端，项目根）
/ Java 21 + Spring Boot（后端，`backend/`）。开箱即含完整系统底座，你只需要专注业务需求。

## 启动

```bash
# 后端（默认 H2 内存库，无需装数据库；端口 8080）
cd backend && ./mvnw spring-boot:run

# 前端（另开终端，项目根；端口 5173，/api 已代理到 8080）
npm install   # vima create 时若未跳过则已装好
npm run dev
```

打开 http://localhost:5173 登录。

## 默认账号

| 账号 | 密码 | 角色 |
|---|---|---|
| `admin` | `admin123` | 超级管理员（权限通配 `*`） |
| `test` | `test123` | 普通用户 |

## 开发辅助地址（后端启动后）

- H2 数据库控制台：http://localhost:8080/h2-console
- API 文档（swagger-ui）：http://localhost:8080/swagger-ui/index.html

## 系统底座已内置

以下能力随骨架自带，无需重复开发：

认证（JWT 登录/登出）、RBAC 权限（角色-菜单，细到按钮级 perms）、用户管理、角色管理、
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
│   ├── utils/            # 请求封装等工具 —— 共享层，业务任务只读
│   └── views/            # 页面（业务页面加在这里）
├── vendor/vima-ui-admin/ # vendored 组件库（离线可用）—— 共享层，业务任务只读
├── backend/              # Spring Boot 后端
│   └── src/main/java/com/{{projectPkg}}/
│       ├── controller/ service/ repository/ entity/ dto/   # 业务代码加在这里
│       └── common/ config/ security/                        # 共享层，业务任务只读
└── docs/                 # vima init 后生成：spec/契约/任务/评审视图
```

共享层目录对业务任务只读（PreToolUse hook 强制），确需修改走 sharedChangeRequest。
新建/修改业务代码文件头部必须带 `@vima <taskId>` 注释标注（代码级追溯，`vima trace` 对账）。

## vima 工作流（三步）

1. `vima init` —— 部署 Claude Code 工作环境（项目宪法/生命周期/命令/角色/hooks）；
2. 启动 `claude`，进入 **PLANNING**：把原始需求丢进 `docs/raw/`，与 Agent 对话梳理出
   spec/契约/任务/覆盖矩阵，浏览器审 `docs/review/`，最后 `vima approve`；
3. 对 Agent 说 `/go` —— 按批次计划并行编码 + 机械验收，直至业务闭环。
