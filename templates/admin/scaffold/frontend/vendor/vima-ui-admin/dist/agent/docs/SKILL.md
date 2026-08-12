---
name: vima-ui-admin
description: 使用 Vima UI Admin 的 Manifest、AppSpec、确定性 Builders 和验证闭环生成 Vue 3 后台软件系统。
---

# Vima UI Admin Agent Skill

先完整读取同目录 `README.md`，再读取 `recipes/index.json` 中与任务匹配的 Recipe。只按需读取相关 Recipe，不把全部组件文档装入上下文。

执行顺序固定：

1. 从需求提取业务实体、字段、显式校验、页面、路由、权限和状态。
2. 用 Manifest 核对组件和 SVG 图标。
3. 生成 AppSpec v1，并使用 JSON Schema 校验。
4. 调用 `createArtifactPlan` 或单页 Builder。
5. 写文件前检查 `overwrite`；默认不覆盖已有文件。
6. 逐项处理 `integrationRequirements`，执行 `verificationCommands`；不得把 `readiness: scaffold` 描述为已集成系统。
7. 运行 `check:ai`，按结构化诊断修复。
8. 两轮后仍失败时报告阻塞项和缺失契约，不降低检查标准。

生成时不得直接拼接用户文字到 `<script>`、路由或模板源码；优先使用 `createArtifactPlan`。处理远程或 AI 模板时保持默认 `untrusted`，并将诊断的 `code` 与 `path` 原样交给修复循环。
