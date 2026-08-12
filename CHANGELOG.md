# 更新日志

版本遵循语义化版本（SemVer）；未发布改动记录在 Unreleased 段，发版时移入对应版本。

## [Unreleased]

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
