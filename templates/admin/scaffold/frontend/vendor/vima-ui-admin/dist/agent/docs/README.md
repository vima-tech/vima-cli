# Vima UI Admin · Agent 入口

Vima UI Admin 面向 Vue 3 政企后台系统。Agent 的任务是把用户需求转换为版本化 `AppSpec`，再调用确定性 Builder 生成 Template DSL 或 `ArtifactPlan`；不要猜测组件名，也不要在运行时包内实现自然语言解析。

## 最短工作流

1. 读取 `@vima-tech/ui-admin/ai-manifest.json`，确认组件、属性、事件、插槽和 SVG 图标名称。
2. 从 `recipes/index.json` 选择最接近需求的系统 Recipe。
3. 按 `@vima-tech/ui-admin/agent/schema/app-spec.v1.json` 生成 `AppSpec`。
4. 调用 `createArtifactPlan(appSpec)`；单页可调用 `buildFormPage`、`buildCrudPage`、`buildDetailPage` 或 `buildDashboardPage`。
5. 仅当结果 `ok === true` 时写入文件，并遵守每个文件的 `overwrite` 策略；`ok` 只代表计划有效。
6. 逐项关闭 `integrationRequirements`；在此之前 `readiness` 保持 `scaffold`，不得宣称系统已经集成或验收。
7. 执行 `verificationCommands`，再运行 `npm run check:ai`，读取 JSON 诊断，最多修复两轮。

## 不变量

- 只使用 Manifest 中存在的公开名称。
- 功能图标只使用 `VIcon` 和 Manifest 中存在的 SVG 名称，不使用 Emoji 或字符图标。
- `required`、权限和危险操作必须来自显式需求，不能按字段名猜测。
- AI、远程和导入模板保持 `untrusted`；不能包含自定义函数、脚本或任意表达式。
- 不跳过 typecheck、build、测试、浏览器和可访问性检查。
- 缺少业务契约时返回追问或诊断，不生成看似成功的空壳。
- 不把 `scaffold`、`buildable`、`integrated`、`accepted` 混为一谈；当前 ArtifactPlan 只承诺 `scaffold`。

## 安全生成边界

- 字段、数据源和表达式路径禁止 `__proto__`、`constructor`、`prototype`；不可信表达式只能读取点分数据路径。
- 事件 `type` 与 `action` 必须来自 Template 类型声明中的白名单；`setValue`、`showModal`、`closeModal` 的状态字段同样经过安全键校验。
- 不可信 API 数据源只允许相对地址或宿主通过 `allowedApiOrigins` 显式授权的来源，请求方法仅限 `GET`、`POST`、`PUT`、`DELETE`。
- `ArtifactPlan` 会对需求文本、标题、导航和路由做脚本上下文编码；Agent 不应绕过 Builder 拼接 Vue SFC 或路由源码。
- `validateTemplate`、`validatePageSpec` 和 `validateAppSpec` 的 `code + path` 是修复接口；不要依赖诊断文案做程序判断。

Manifest 的组件说明、Props 说明、事件载荷和插槽参数都由组件源码派生，并在 `check:boundary` 中要求 100% 覆盖。新增公开契约时必须同步源码语义标注。

## 入口

| 内容 | 位置 |
|---|---|
| 公开组件与图标 | `@vima-tech/ui-admin/ai-manifest.json` |
| 构建期函数和类型 | `@vima-tech/ui-admin/agent` |
| AppSpec JSON Schema | `@vima-tech/ui-admin/agent/schema/app-spec.v1.json` |
| 系统 Recipes | `recipes/index.json` |
| 模板安全和编辑器 | `../template-system.md` |
| PACT 驱动的可控生成设计（审核草案） | `pact-controlled-generation-design.md` |
