# 营养预约系统 规格说明（spec）

## 1. 系统概述

营养预约系统：一个后端同时服务两个前端——院内管理后台（营养师审核与管理预约）
与患者端小程序（患者自助预约、查看自己的预约）。

- 端册：admin（院内管理后台，桌面 Web）、patient（患者端小程序）。
- 用户角色：营养师（后台全部菜单）、患者（小程序）。
- 核心业务流程：患者在小程序提交预约 → 营养师在后台审核（跨端交接）。

## 2. 数据模型

核心实体只有预约（Appointment）：患者提交、营养师审核，状态受控流转。

```yaml vima:entities
entities:
  - name: Appointment
    fields:
      - { name: id, type: number, required: true, desc: 主键 }
      - { name: patientName, type: string, required: true, desc: 患者姓名 2-20 字符 }
      - { name: date, type: string, required: true, desc: 预约日期 ISO 格式 }
      - { name: status, type: string, required: true, desc: 预约状态（AppointmentStatus 枚举） }
enums:
  - name: AppointmentStatus
    values: [待审核, 已确认, 已取消]
```

## 3. 页面清单

### PAGE-01 预约管理（admin）

后台预约列表：搜索 + 工具栏（审核通过）+ 表格 + 分页。

```yaml vima:page
id: PAGE-01
app: admin
title: 预约管理
menu: MENU-01
layout: [search, toolbar, table, pagination]
components:
  - block: search
    items:
      - { type: input, label: 患者姓名 }
      - type: select
        label: 状态
        options: [待审核, 已确认, 已取消]
  - block: toolbar
    items:
      - { type: button, label: 审核通过, action: api, api: POST /api/admin/appointment/audit }
  - block: table
    api: GET /api/admin/appointment/list
    rowActions: []
  - block: pagination
    items: []
apis: [GET /api/admin/appointment/list, POST /api/admin/appointment/audit]
```

### PAGE-11 预约挂号（patient）

患者端预约页：顶部 banner + 预约表单 + 底部提交操作条。

```yaml vima:page
id: PAGE-11
app: patient
title: 预约挂号
menu: MENU-11
layout: [banner, form, actionbar]
components:
  - block: banner
    items:
      - { type: text, label: 营养门诊在线预约 }
  - block: form
    items:
      - { type: input, label: 患者姓名 }
      - { type: date, label: 预约日期 }
  - block: actionbar
    items:
      - { type: button, label: 提交预约, action: api, api: POST /api/app/appointment }
apis: [POST /api/app/appointment]
```

### PAGE-12 我的预约（patient）

患者端预约记录列表，可回到预约挂号页。

```yaml vima:page
id: PAGE-12
app: patient
title: 我的预约
menu: MENU-12
layout: [search, list]
components:
  - block: search
    items:
      - type: select
        label: 状态
        options: [待审核, 已确认, 已取消]
  - block: list
    api: GET /api/app/appointment/mine
    rowActions:
      - { label: 再次预约, action: nav, target: PAGE-11 }
apis: [GET /api/app/appointment/mine]
```

## 4. 接口清单

| 方法 | 路径 | 消费端 | 契约文件 | 引用页面 |
|------|------|--------|---------|---------|
| GET | /api/admin/appointment/list | admin | docs/contracts/appointment-api.md | PAGE-01 |
| POST | /api/admin/appointment/audit | admin | docs/contracts/appointment-api.md | PAGE-01 |
| POST | /api/app/appointment | patient | docs/contracts/appointment-api.md | PAGE-11 |
| GET | /api/app/appointment/mine | patient | docs/contracts/appointment-api.md | PAGE-12 |

## 5. 业务规则

- 患者姓名必填，长度 2-20 字符（违反返回 40001）。
- 只有待审核状态的预约可以审核通过（违反返回 40002）。
- 同一患者同一天最多提交一条预约（违反返回 40003，全局约束）。

```yaml vima:rules
rules:
  - id: RULE-01
    type: validation
    entity: Appointment
    apis: [POST /api/app/appointment]
    desc: 患者姓名必填且长度 2-20 字符，违者返回 40001
  - id: RULE-02
    type: transition
    entity: Appointment
    apis: [POST /api/admin/appointment/audit]
    desc: 仅 status=待审核 的预约可审核通过，违者返回 40002
  - id: RULE-03
    type: constraint
    entity: Appointment
    desc: 同一患者同一天最多一条预约，违者返回 40003
```

### 业务流程

```yaml vima:flow
id: FLOW-01
name: 预约与审核（跨端）
steps:
  - { role: ROLE-02, page: PAGE-11, action: 填写并提交预约, api: POST /api/app/appointment, next: PAGE-12 }
  - { role: ROLE-01, page: PAGE-01, action: 审核通过预约, api: POST /api/admin/appointment/audit, next: PAGE-01 }
```

## 6. 权限设计

营养师用后台菜单；患者端 tabbar 即患者菜单（同一模型两种外壳投影，A16）。

```yaml vima:roles
roles:
  - id: ROLE-01
    name: 营养师
    menus: [MENU-01]
  - id: ROLE-02
    name: 患者
    menus: [MENU-11, MENU-12]
```

```yaml vima:menus
menus:
  - id: MENU-01
    app: admin
    name: 预约管理
    page: PAGE-01
    features:
      - { name: 预约查询, api: GET /api/admin/appointment/list }
      - { name: 审核通过, api: POST /api/admin/appointment/audit }
  - id: MENU-11
    app: patient
    name: 预约挂号
    page: PAGE-11
    features:
      - { name: 提交预约, api: POST /api/app/appointment }
  - id: MENU-12
    app: patient
    name: 我的预约
    page: PAGE-12
    features:
      - { name: 预约记录, api: GET /api/app/appointment/mine }
```

## 7. 技术栈

- admin 端：Vue 3 + vendored @vima-tech/ui-admin，构建 `npm run build:check`。
- patient 端：微信原生小程序 + TS（kind mp-native），组件库 vendored Vant Weapp。
- 后端：Java 21 + Spring Boot 3 + JPA，构建 `mvn -q compile`，测试 `mvn -q test`。
- 数据库：PostgreSQL。

## 8. 关键决策记录

| 决策 ID | 决策 | 理由 | 已否决方案 | 否决理由 |
|---------|------|------|-----------|---------|
| D-01 | 管理端与患者端各用独立端点（/api/admin/** 与 /api/app/**） | 不同端不同数据形状 ⇒ 不同端点（A16 契约纪律），审计与授权边界清晰 | 两端共用一组接口按角色过滤字段 | 字段级过滤易误泄，consumers 授权闭环无法机检 |

## 9. 本期不做

本期范围边界——以下内容明确不实现，实现即越界（A13）。

```yaml vima:non-goals
non-goals:
  - { id: NG-01, desc: 不做医师端小程序，本期仅患者端与院内后台 }
  - { id: NG-02, desc: 不做支付与费用结算，预约免费 }
```

