# {{projectName}} 系统规格说明（spec）

<!--
  本文件是 admin 模板的 spec 骨架：PLANNING 开始时复制为 docs/spec.md，逐章填充。
  填充纪律（见 planning-guide.md）：
  - 九个章标题一字不改（vima validate V-SPEC-01 按标题前缀机检）；
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
     - 多端项目（A16）：每块必带 app: <端 id>（∈ 端册，V-SPEC-13）；每端 ≥1 页（V-SPEC-14）；
       nav 只指向同端页面（跨端交接写 vima:flow）
     - layout 与 components[].block 只用归属端 kind 的词表（V-SPEC-04，planning.kinds 同源）：
       admin-web = toolbar|search|table|form|cards|tabs|pagination
       mp-native = search|list|cards|form|tabs|banner|detail|actionbar（regions 不可用）
     - 交互仅三种：action: nav（target=PAGE-xx）、action: modal（target=本页 modals 中的 MODAL-xx）、
       action: api（api="METHOD /path"）（V-SPEC-05）
     - apis 必须 ⊆ 契约 apis（V-SPEC-07）
     - ID 正则：PAGE-\d{2}、MODAL-\d{2}，全文档唯一。
     - 多列版面（三列工作台、主从两栏、带 sticky 侧栏的表单页等）另加可选 regions（A14）：
       regions: 纵向若干「带」，每带二选一——
         全宽带 `- { blocks: [区块词…] }`
         分栏带 `- columns: [{ name: 列名, width: 264px|1fr, blocks: [区块词…] }, …]`
       带的先后即上下顺序，列内顺序即渲染顺序。layout 保持扁平不变（校验与任务点口径不动），
       regions 铺开后的区块集合必须与 layout 一致，否则 V-SPEC-12 阻断。
       不写 regions 的页面按 layout 纵向堆叠——单列页面无需声明。
     - 设计声明（A27 PDL，可选、声明即承诺——设计五问的落笔处，见 planning-guide 终点清单 C）：
       design: { pattern: list|detail|form|workbench|master-detail|board,
                 density: compact|default|loose, fold: [组件实例名…] }（V-DSN-01/07）
       每块可带 name（同词多例必带，V-DSN-03）/ intent / data: { shape, of, keyFields }（V-DSN-04/08）
       动作可带 priority: primary|secondary|overflow（V-DSN-05/06）；
       低频动作挂宿主块 actions（贴标题行）而不是独占一条 toolbar 带；
       弹窗可带 presentation: drawer（抽屉呈现）。规格零像素——宽高坐标一概不写。
       admin-web 词表 +3（A27）：steps（步骤条）/ collapse（折叠面板）/ anchor（锚点条）。 -->

### PAGE-01 示例列表页

```yaml vima:page
id: PAGE-01
title: 示例列表
menu: MENU-01
design:                              # A27 设计声明（可选；设计五问的答案落在这里）
  pattern: list
  density: default
  fold: [数据表]
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
      - { type: button, label: 新增, action: modal, target: MODAL-01, priority: primary }
      - { type: button, label: 批量删除, action: api, api: POST /api/example/batch-delete, priority: secondary }
  - block: table
    name: 数据表
    intent: 定位并操作单条记录的主工作区
    api: GET /api/example/list
    rowActions:
      - { label: 编辑, action: modal, target: MODAL-01, priority: primary }
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

<!-- 填写提示：校验规则、状态流转、计算规则、约束条件——散文可保留作人读说明，
     但**机器真源是下方 vima:rules 数据块**（A13），规则要可验收（写清边界值与错误码）。
     - 每条 id 正则 RULE-\d{2}，全文档唯一
     - type 四选一：validation|transition|calculation|constraint（V-SPEC-09）
     - entity 必填，须是 vima:entities 里的实体名（V-SPEC-09）
     - apis 可选：该规则约束哪些接口，须存在于契约（V-SPEC-10）；**省略 = 全局规则**，
       会注入全部任务的上下文包
     - 本块同时喂给 vima context（Builder 施工时逐条可见）与 Verifier（逐条核对是否实现）
     业务流程写在本章「业务流程」小节：每条流程一块 vima:flow，
     串联 角色→页面→动作→接口→下一页（ID 正则 FLOW-\d{2}）。 -->

```yaml vima:rules
rules:
  - id: RULE-01
    type: validation
    entity: Example
    apis: [POST /api/example]
    desc: 名称必填且长度 2-50 字符，违者返回 40001
  - id: RULE-02
    type: constraint
    entity: Example
    desc: 任何删除均为软删除，列表查询默认过滤已删除记录（全局规则，故省略 apis）
```

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
| D-01 | （示例）详情用独立页面承载 | 字段完整、便于按菜单授权 | 在列表页用弹窗展示 | 弹窗承载不下后续扩展 |

## 9. 本期不做

<!-- 填写提示（A13）：本期明确**不做**的事，逐条写入下方 vima:non-goals 数据块。
     - 每条 id 正则 NG-\d{2}，全文档唯一；desc 写清「不做什么 + 用户当前怎么应对」
     - 素材来源：对话中用户说过「这个先不做 / 二期再说」的、以及你判断超出本期范围
       但用户没明说的（后者须请用户确认后再写）
     - **确实没有也必须显式写 `non-goals: []`**——V-SPEC-11 拒绝省略块，
       「声明为空」与「没声明」必须可区分
     用途：本块随每个任务的上下文包发给 Builder（范围红线），并由 Verifier
     逐条核对是否越界——实现了这里的任何一条即判 fail。 -->

```yaml vima:non-goals
non-goals:
  - { id: NG-01, desc: 不做数据导出，用户临时用数据库直连应对 }
```
