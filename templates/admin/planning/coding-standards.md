# 编码规范（admin 模板）

> 本文件由 vima init 安装（managed，勿手改；定制走项目 CLAUDE.md）。
> CLAUDE.md 只保留红线，本文承载细则（§5.2 详细规范指针的落点）。

## 通用

- 前后端接口以 docs/contracts/ 契约文件为唯一事实来源，禁止自行定义路径、参数或字段。
- 新建/修改的每个业务代码文件，头部注释必须含 `@vima <taskId>` 标注（A1 代码级追溯）。
- 共享层目录（见 template.json sharedDirs：src/components、src/utils、vendor
  与 backend 的 config/security 包）对业务任务只读；
  确需修改走 sharedChangeRequest（§10.7）。
- 页面结构以 spec 的 `vima:page` 数据块与 docs/review/prototype.html 为唯一真源（A2），
  任务文件与代码注释不得另行描述组件树。

## 前端（Vue 3 + TypeScript + Vite + @vima/ui）

- 一律 `.vue` 单文件组件 + `<script setup lang="ts">`；业务页面放 src/views/<PageName>/。
- 组件使用前先读 docs/ui-framework/CAPABILITY.md，再读对应组件文档；
  只从包入口导入 @vima/ui，禁止从 vendor/vima-ui-admin/dist 深路径导入。
- API 封装集中在 src/api/<module>.ts；响应统一 ApiResponse 包装；
  分页参数命名 pageNum/pageSize。
- 禁止原生 confirm()/alert()（用组件库反馈 API）；禁止在组件内写全局样式。
- 类型：契约里已有的共享类型从契约生成/摘录，不重复手写第二份。

## 后端（Java 21 + Spring Boot + JPA）

- 分层：controller → service → repository；controller 不写业务逻辑。
- 响应统一 ApiResponse 包装；分页返回 PageResponse；错误码与契约 errors 一致。
- 参数校验用 jakarta.validation 注解 + GlobalExceptionHandler 统一转 40001 风格错误。
- 权限：接口按钮级权限用 @PreAuthorize（perms 串与菜单 features 对应）。
- 不引入契约之外的新接口路径；新增接口先改契约再写代码（§9.5 契约纪律）。

## 自检命令

- 前端：`npm run build:check` + `npm run lint`
- 后端：`mvn -q compile` + `mvn -q test`
