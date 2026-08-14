# {{projectName}} 项目宪法

# 项目技术栈
- 前端：Vue 3 + TypeScript + Vite + @vima-tech/ui-admin（vendored 组件库，组件已全局注册）
- 后端：Java 21 + Spring Boot + JPA
- 数据库：PostgreSQL（业务数据）
- 缓存：Redis（登录态 token 与权限缓存，必需组件；本地用 backend/docker-compose.yml 拉起）
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
- 禁止写死颜色/圆角/间距（取 src/styles/tokens.css 的 `--v-*` 令牌）；页面根必须是 `.vui-page`

# 工作协议
- 每次对话开始，先读取 docs/lifecycle.json，按当前阶段（PLANNING/DESIGNING/DEVELOPING/MAINTAINING）模式工作
- 收到开发需求时，先定位 docs/tasks/ 下相关任务文件，再执行修改
- 使用组件前，必须先读取 docs/ui-framework/CAPABILITY.md，再读对应组件文档
- 新建/修改业务代码文件时，文件头部必须带 `@vima <taskId>` 注释标注（代码级追溯）
- 维护期涉及页面结构/组件/接口/权限的变更走**变更事务**（A31）：`vima change open "<描述>"` → 改 spec YAML 块（接口先改契约）
  → validate → 重渲染 → 重大变更请用户在原型上确认 → `vima change apply` 重开受影响任务 → 改代码 →
  `vima change close`（受影响任务全 done 且 validate/converge 绿才关得上，不过=未传播完）；四要素 YAML 块无需改动的（纯视觉/文案/内部重构）直接改代码、不开变更包（§13.4）
- 维护期修改共享层：先写入 .vima/shared-write-token（ISO 过期时刻），改完立即删除并对调用方跑自检（§10.7）
- 维护期修 bug：先把症状固化为一条能**跑红**的命令（后端优先写失败测试；前端用
  npm run build:check 或按 .vima/reports/runtime-errors.jsonl 的上报复现），确认跑红后
  再修复；修复完成的判定 = 同一条命令**转绿**（A11，信号源见 A7）。复现不了的
  先向用户要复现路径，不凭代码推测下手
- 检查点提交（`vima: batch <N> completed`）**只在 `/go --commit` 时执行**（A18）——
  该 flag 即构成对本次运行全部检查点提交的**明确授权**，无需逐批征询；被环境规则
  拒绝时跳过并注明，不中断调度。**不带 `--commit` 完全不碰 git**，报告也不提回滚点。
  除 go.md 合法停点白名单（预算耗尽 / 全部终态 / 需用户裁定 / 用户中断）外，
  批次之间不停轮等待（A17）；每次结束回合前把停因写入 `.vima/go-state.json`（A18）
- 业务任务全 done **不等于**完成：先过**收口闸门**（A20，go.md 步骤 5）——`vima converge`
  查漏实现/重复实现/越界实现（并行批次典型产出，单任务视角看不见）→ 按 `byTask` 派回
  负责任务增量修复（V-INT-02/03 串行）→ 重跑，零 error 才跑 pipeline 收尾、才切 MAINTAINING

# 详细规范
- 编码规范：docs/coding-standards.md
- 组件用法：docs/ui-framework/CAPABILITY.md
- 任务文件：docs/tasks/ 目录
- 需求整理指南：docs/planning-guide.md
