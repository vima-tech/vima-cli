# 设备管理系统 规格说明（spec）

## 1. 系统概述

设备管理系统：面向企业运维场景的管理后台，管理员与运维人员在线维护设备台账——
搜索、查看、新增、批量删除设备，并可进入单台设备的详情页查看完整信息。

- 用户角色：管理员（全部菜单）、运维人员（仅设备列表）。
- 功能模块：设备管理（列表 + 详情）。
- 核心业务流程：设备上架（新增设备后在列表可见，可进入详情核对）。

## 2. 数据模型

核心实体只有设备（Device）：设备名称唯一标识一台物理设备，类型与状态均为受控枚举。

```yaml vima:entities
entities:
  - name: Device
    fields:
      - { name: id, type: number, required: true, desc: 主键 }
      - { name: name, type: string, required: true, desc: 设备名称 2-50 字符 }
      - { name: type, type: string, required: true, desc: 设备类型（DeviceType 枚举） }
      - { name: status, type: string, required: true, desc: 设备状态（DeviceStatus 枚举） }
      - { name: createdAt, type: string, required: true, desc: 创建时间 ISO 格式 }
enums:
  - name: DeviceType
    values: [sensor, actuator, gateway]
  - name: DeviceStatus
    values: [在线, 离线, 维护中]
```

## 3. 页面清单

### PAGE-01 设备列表

搜索 + 工具栏 + 表格 + 分页的标准列表页；新增/编辑走弹窗（MODAL-01），行内可跳设备详情。

```yaml vima:page
id: PAGE-01
title: 设备列表
menu: MENU-01
design:                       # A27 PDL：声明即承诺（pattern/density 必填，fold 引用实例名）
  pattern: list
  density: default
  fold: [设备表格]
  fidelity: D0                # A34 V-DSN-12：每页必须显式定级；D0 是裁定，不能用「缺失」替代
layout: [search, toolbar, table, pagination]
components:
  - block: search
    items:
      - { type: input, label: 设备名称 }
      - type: select
        label: 状态
        options: [在线, 离线, 维护中]
  - block: toolbar
    items:
      - { type: button, label: 新增, action: modal, target: MODAL-01, priority: primary }
      - { type: button, label: 批量删除, action: api, api: POST /api/device/batch-delete, priority: secondary }
  - block: table
    name: 设备表格
    intent: 管理员定位并操作单台设备的主工作区
    api: GET /api/device/list
    rowActions:
      - { label: 编辑, action: modal, target: MODAL-01, priority: primary }
      - { label: 详情, action: nav, target: PAGE-02, priority: secondary }
  - block: pagination
    items: []
modals:
  - id: MODAL-01
    title: 设备表单
    fields:
      - { field: name, label: 设备名称, type: input, required: true }
      - { field: type, label: 设备类型, type: select, required: true }
    submit: { api: POST /api/device }
apis: [GET /api/device/list, POST /api/device, POST /api/device/batch-delete]
```

### PAGE-02 设备详情

单台设备的只读详情页，从列表行内「详情」进入，可返回列表。

```yaml vima:page
id: PAGE-02
title: 设备详情
menu: MENU-02
design:                       # A34：只带 fidelity 的 design 块合法——A27 的 pattern/density
  fidelity: D0                # 必填只在页面用了 A27 键（pattern/density/fold）时才触发
layout: [toolbar, form]
components:
  - block: toolbar
    items:
      - { type: button, label: 返回列表, action: nav, target: PAGE-01 }
  - block: form
    api: GET /api/device/detail
    items:
      - { type: text, label: 设备名称 }
      - { type: text, label: 设备类型 }
      - { type: text, label: 状态 }
      - { type: text, label: 创建时间 }
apis: [GET /api/device/detail]
```

## 4. 接口清单

| 方法 | 路径 | 契约文件 | 引用页面 |
|------|------|---------|---------|
| GET | /api/device/list | docs/contracts/device-api.md | PAGE-01 |
| POST | /api/device | docs/contracts/device-api.md | PAGE-01 |
| POST | /api/device/batch-delete | docs/contracts/device-api.md | PAGE-01 |
| GET | /api/device/detail | docs/contracts/device-api.md | PAGE-02 |

## 5. 业务规则

- 设备名称必填，长度 2-50 字符（违反返回 40001）。
- 设备类型必须为 DeviceType 枚举之一（违反返回 40001）。
- 批量删除一次最多 100 条，超出返回 40002。
- 维护中设备禁止删除，返回 40003。
- 查询不存在的设备返回 40004。
- 任何删除均为软删除，列表默认过滤已删除记录（全局规则，不限接口）。

```yaml vima:rules
rules:
  - id: RULE-01
    type: validation
    entity: Device
    apis: [POST /api/device]
    desc: 设备名称必填且长度 2-50 字符，违者返回 40001
  - id: RULE-02
    type: validation
    entity: Device
    apis: [POST /api/device]
    desc: 设备类型必须为 DeviceType 枚举之一，违者返回 40001
  - id: RULE-03
    type: constraint
    entity: Device
    apis: [POST /api/device/batch-delete]
    desc: 批量删除一次最多 100 条，超出返回 40002
  - id: RULE-04
    type: transition
    entity: Device
    apis: [POST /api/device/batch-delete]
    desc: status=维护中 的设备禁止删除，返回 40003
  - id: RULE-05
    type: validation
    entity: Device
    apis: [GET /api/device/detail]
    desc: 查询不存在的设备返回 40004
  - id: RULE-06
    type: constraint
    entity: Device
    desc: 任何删除均为软删除，列表查询默认过滤已删除记录
```

### 业务流程

```yaml vima:flow
id: FLOW-01
name: 设备上架流程
steps:
  - { role: ROLE-01, page: PAGE-01, action: 点击新增并提交设备表单, api: POST /api/device, next: PAGE-01 }
  - { role: ROLE-01, page: PAGE-01, action: 点击行内详情, api: GET /api/device/detail, next: PAGE-02 }
```

## 6. 权限设计

管理员可用全部菜单；运维人员只看设备列表。全部菜单均有角色覆盖，无权限盲区。

```yaml vima:roles
roles:
  - id: ROLE-01
    name: 管理员
    menus: [MENU-01, MENU-02]
  - id: ROLE-02
    name: 运维人员
    menus: [MENU-01]
```

```yaml vima:menus
menus:
  - id: MENU-01
    name: 设备管理
    page: PAGE-01
    features:
      - { name: 设备查询, api: GET /api/device/list }
      - { name: 设备新增, api: POST /api/device }
      - { name: 批量删除, api: POST /api/device/batch-delete }
  - id: MENU-02
    name: 设备详情
    page: PAGE-02
    features:
      - { name: 详情查看, api: GET /api/device/detail }
```

## 7. 技术栈

- 前端：Vue 3 + @vima/ui，构建命令 `npm run build:check`，规范检查 `npm run lint`。
- 后端：Java 21 + Spring Boot 3 + JPA，构建命令 `mvn -q compile`，测试 `mvn -q test`。
- 数据库：MySQL 8。

## 8. 关键决策记录

| 决策 ID | 决策 | 理由 | 已否决方案 | 否决理由 |
|---------|------|------|-----------|---------|
| D-01 | 设备详情用独立页面 PAGE-02 承载 | 详情字段完整、后续可扩展监控信息，独立页面便于加菜单权限 | 在列表页用详情弹窗展示 | 弹窗承载不下后续监控扩展，且无法按菜单单独授权 |

## 9. 本期不做

本期范围边界——以下内容明确不实现，实现即越界（A13）。

```yaml vima:non-goals
non-goals:
  - { id: NG-01, desc: 不做设备数据导出（Excel/CSV），运维用数据库直连临时应对 }
  - { id: NG-02, desc: 不做移动端适配，本期仅保证桌面浏览器 }
  - { id: NG-03, desc: 不做设备监控指标采集与告警，后续版本另立需求 }
```
