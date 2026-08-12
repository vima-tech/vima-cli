# {{projectName}} 项目宪法

# 项目技术栈
- 前端：Vue 3 + TypeScript + Vite + @vima/ui
- 后端：Java 21 + Spring Boot + JPA
- 数据库：PostgreSQL
- 系统底座已内置（认证/RBAC 按钮级权限/用户/角色/菜单/部门/字典/配置/文件/日志/消息/定时任务/在线用户/Excel 导入导出/API 文档）——只做业务需求，底座不重复实现、不进 spec

# 核心编码约定
- 组件使用 .vue 单文件组件，`<script setup>` 语法
- API 返回值统一使用 ApiResponse 包装
- 分页参数使用 pageNum/pageSize 命名
- 前后端接口以 docs/contracts/ 下的契约文件为唯一事实来源

# 禁止事项
- 禁止业务任务修改共享层目录（src/components/、src/utils/、vendor/ 与 backend 的
  config/security 包，同 template.json sharedDirs）——共享层对业务任务只读，确需修改走 sharedChangeRequest
- 禁止使用原生 confirm()/alert()
- 禁止在组件中写全局样式

# 工作协议
- 每次对话开始，先读取 docs/lifecycle.json，按当前阶段（PLANNING/DEVELOPING/MAINTAINING）模式工作
- 收到开发需求时，先定位 docs/tasks/ 下相关任务文件，再执行修改
- 使用组件前，必须先读取 docs/ui-framework/CAPABILITY.md，再读对应组件文档
- 新建/修改业务代码文件时，文件头部必须带 `@vima <taskId>` 注释标注（代码级追溯）
- 维护期涉及页面结构/组件/接口/权限的变更：先改 docs/spec.md 的 YAML 块（涉及接口先改契约）
  → `vima validate` → `vima render-review` / `vima render-prototype` → 重大变更请用户在
  原型上确认 → 再改代码；四要素 YAML 块无需改动的（纯视觉/文案/内部重构）直接改代码（§13.4）
- 维护期修改共享层：先写入 .vima/shared-write-token（ISO 过期时刻），改完立即删除并对调用方跑自检（§10.7）

# 详细规范
- 编码规范：docs/coding-standards.md
- 组件用法：docs/ui-framework/CAPABILITY.md
- 任务文件：docs/tasks/ 目录
- 需求整理指南：docs/planning-guide.md
