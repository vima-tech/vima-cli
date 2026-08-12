# {{projectName}} 系统规格说明（spec）

<!--
  本文件是 admin 模板的 spec 骨架：PLANNING 开始时复制为 docs/spec.md，逐章填充。
  填充纪律（见 planning-guide.md）：
  - 八个章标题一字不改（vima validate V-SPEC-01 按标题前缀机检）；
  - 只填充、不创作：删除各章 <!-- 填写提示 -\-> 注释，替换示例占位值；
  - 每写完一章立即落盘并跑 vima validate；
  - 信息源分级：raw 原文 > 用户确认 > 推断；推断项必须标 pendingConfirm: true。
-->

## 1. 系统概述

<!-- 填写提示：系统定位（一句话说清给谁解决什么问题）、用户角色概览、
     功能模块清单（已获用户确认的模块列表）、核心业务流程概述。
     信息来源：docs/raw/ 原文 + 用户确认。 -->

## 2. 数据模型

<!-- 填写提示：每个核心实体一段文字说明（业务含义、关系），
     全部实体与枚举写入下方 vima:entities 数据块（唯一机器真源）。
     要求：每个 entity 有非空 fields（V-SPEC-02）；每个枚举列出全部取值。 -->

```yaml vima:entities
entities:
  - name: Example
    fields:
      - { name: id, type: number, required: true, desc: 主键 }
      - { name: name, type: string, required: true, desc: 名称 2-50 字符 }
enums:
  - name: ExampleType
    values: [typeA, typeB]
```

## 3. 页面清单

<!-- 填写提示：每个页面一个小节（### PAGE-xx 页面名）+ 一块 vima:page。
     页面级粒度四要素缺一不可（V-SPEC-03）：layout / components / 交互 / apis。
     - layout 与 components[].block 只用词表：toolbar|search|table|form|cards|tabs|pagination（V-SPEC-04）
     - 交互仅三种：action: nav（target=PAGE-xx）、action: modal（target=本页 modals 中的 MODAL-xx）、
       action: api（api="METHOD /path"）（V-SPEC-05）
     - apis 必须 ⊆ 契约 apis（V-SPEC-07）
     - ID 正则：PAGE-\d{2}、MODAL-\d{2}，全文档唯一。 -->

### PAGE-01 示例列表页

```yaml vima:page
id: PAGE-01
title: 示例列表
menu: MENU-01
layout: [search, toolbar, table, pagination]
components:
  - block: search
    items:
      - { type: input, label: 名称 }
      - type: select
        label: 状态
        options: [启用, 停用]
  - block: toolbar
    items:
      - { type: button, label: 新增, action: modal, target: MODAL-01 }
      - { type: button, label: 批量删除, action: api, api: POST /api/example/batch-delete }
  - block: table
    api: GET /api/example/list
    rowActions:
      - { label: 编辑, action: modal, target: MODAL-01 }
  - block: pagination
    items: []
modals:
  - id: MODAL-01
    title: 示例表单
    fields:
      - { field: name, label: 名称, type: input, required: true }
    submit: { api: POST /api/example }
apis: [GET /api/example/list, POST /api/example, POST /api/example/batch-delete]
```

## 4. 接口清单

<!-- 填写提示：人读汇总表——列出全部接口及其所属契约文件与承接页面；
     接口的机器真源在 docs/contracts/*.md 的 vima:contract 块，此处不重复字段定义。
     表格式样：| 方法 | 路径 | 契约文件 | 引用页面 | -->

| 方法 | 路径 | 契约文件 | 引用页面 |
|------|------|---------|---------|
| GET | /api/example/list | docs/contracts/example-api.md | PAGE-01 |

## 5. 业务规则

<!-- 填写提示：校验规则、状态流转、计算规则、约束条件——逐模块分小节陈述，
     规则要可验收（写清边界值与错误码）。
     业务流程写在本章「业务流程」小节：每条流程一块 vima:flow，
     串联 角色→页面→动作→接口→下一页（ID 正则 FLOW-\d{2}）。 -->

### 业务流程

```yaml vima:flow
id: FLOW-01
name: 示例新增流程
steps:
  - { role: ROLE-01, page: PAGE-01, action: 点击新增, api: POST /api/example, next: PAGE-01 }
```

## 6. 权限设计

<!-- 填写提示：角色清单与每个角色的菜单权限写入 vima:roles / vima:menus。
     - 每个 role.menus 非空且指向存在的 MENU（V-SPEC-06）
     - 无任何角色覆盖的菜单必须显式标 uncovered: true，否则校验失败
     - 菜单 features 列出该菜单页面承载的功能点及其接口
     - ID 正则：ROLE-\d{2}、MENU-\d{2}，全文档唯一。 -->

```yaml vima:roles
roles:
  - id: ROLE-01
    name: 管理员
    menus: [MENU-01]
```

```yaml vima:menus
menus:
  - id: MENU-01
    name: 示例管理
    page: PAGE-01
    features:
      - { name: 示例查询, api: GET /api/example/list }
```

## 7. 技术栈

<!-- 填写提示：前端技术栈（框架/UI 库/构建命令）、后端技术栈（语言/框架/数据库）、
     脚手架命令、UI 框架信息（CAPABILITY.md 位置）。与 template.json techStack 一致。 -->

## 8. 关键决策记录

<!-- 填写提示：PLANNING 中每个有分叉的决策记一行（编号 D-01 起），
     必须写「已否决方案」与否决理由（V-DEC-01 机检表头含「已否决方案」列）——
     防止后续会话把否决过的路线重新提出。 -->

| 决策 ID | 决策 | 理由 | 已否决方案 | 否决理由 |
|---------|------|------|-----------|---------|
