# 预约 API 契约

本契约是预约模块前后端任务的唯一事实来源：后端按此实现，两个前端各按 consumers
授权的接口对接（A16）。变更接口先改本文件，再同步任务文件，最后才能改代码。

## GET /api/admin/appointment/list

- 消费端：admin
- 请求参数：`{ patientName?: string, status?: string, pageNum: number, pageSize: number }`
- 响应：`ApiResponse<PageResult<Appointment>>`
- 错误码：40001 参数校验失败

## POST /api/admin/appointment/audit

- 消费端：admin
- 请求体：`{ id: number }`
- 响应：`ApiResponse<Appointment>`
- 错误码：40002 非待审核状态不可审核

## POST /api/app/appointment

- 消费端：patient
- 请求体：`{ patientName: string, date: string }`
- 响应：`ApiResponse<Appointment>`
- 错误码：40001 参数校验失败；40003 同日重复预约

## GET /api/app/appointment/mine

- 消费端：patient
- 请求参数：`{ status?: string }`
- 响应：`ApiResponse<Appointment[]>`
- 错误码：40001 参数校验失败

## 共享类型定义

`Appointment { id, patientName, date, status }`

## 机读数据块（渲染层/校验层唯一字段来源）

```yaml vima:contract
module: appointment
apis:
  - method: GET
    path: /api/admin/appointment/list
    consumers: [admin]
    request:
      - { name: patientName, type: string, required: false }
      - { name: status, type: string, required: false }
      - { name: pageNum, type: number, required: true }
      - { name: pageSize, type: number, required: true }
    response:
      - { name: id, type: number }
      - { name: patientName, type: string }
      - { name: date, type: string }
      - { name: status, type: string }
    errors:
      - { code: 40001, msg: 参数校验失败 }
  - method: POST
    path: /api/admin/appointment/audit
    consumers: [admin]
    request:
      - { name: id, type: number, required: true }
    response:
      - { name: id, type: number }
      - { name: status, type: string }
    errors:
      - { code: 40002, msg: 非待审核状态不可审核 }
  - method: POST
    path: /api/app/appointment
    consumers: [patient]
    request:
      - { name: patientName, type: string, required: true }
      - { name: date, type: string, required: true }
    response:
      - { name: id, type: number }
      - { name: patientName, type: string }
      - { name: date, type: string }
      - { name: status, type: string }
    errors:
      - { code: 40001, msg: 参数校验失败 }
      - { code: 40003, msg: 同日重复预约 }
  - method: GET
    path: /api/app/appointment/mine
    consumers: [patient]
    request:
      - { name: status, type: string, required: false }
    response:
      - { name: id, type: number }
      - { name: patientName, type: string }
      - { name: date, type: string }
      - { name: status, type: string }
    errors:
      - { code: 40001, msg: 参数校验失败 }
```
