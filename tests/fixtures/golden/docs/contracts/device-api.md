# 设备管理 API 契约

本契约是设备模块前后端任务的唯一事实来源：后端按此实现，前端按此对接。
变更接口先改本文件，再同步任务文件，最后才能改代码。

## GET /api/device/list

- 请求参数：`{ name?: string, status?: string, pageNum: number, pageSize: number }`
- 响应：`ApiResponse<PageResult<Device>>`
- 错误码：40001 参数校验失败

## POST /api/device

- 请求体：DeviceCreateDTO（name 必填 2-50 字符，type 枚举 sensor/actuator/gateway）
- 响应：`ApiResponse<Device>`
- 错误码：40001 参数校验失败

## POST /api/device/batch-delete

- 请求体：`{ ids: number[] }`（最多 100 条）
- 响应：`ApiResponse<{ deleted: number }>`
- 错误码：40002 批量删除超过 100 条；40003 维护中设备禁止删除

## GET /api/device/detail

- 请求参数：`{ id: number }`
- 响应：`ApiResponse<Device>`
- 错误码：40004 设备不存在

## 共享类型定义

`Device { id, name, type, status, createdAt }`

## 机读数据块（渲染层/校验层唯一字段来源）

```yaml vima:contract
module: device
apis:
  - method: GET
    path: /api/device/list
    request:
      - { name: name, type: string, required: false }
      - { name: status, type: string, required: false }
      - { name: pageNum, type: number, required: true }
      - { name: pageSize, type: number, required: true }
    response:
      - { name: id, type: number }
      - { name: name, type: string }
      - { name: type, type: string }
      - { name: status, type: string }
      - { name: createdAt, type: string }
    errors:
      - { code: 40001, msg: 参数校验失败 }
  - method: POST
    path: /api/device
    request:
      - { name: name, type: string, required: true }
      - { name: type, type: string, required: true }
    response:
      - { name: id, type: number }
      - { name: name, type: string }
      - { name: type, type: string }
      - { name: status, type: string }
      - { name: createdAt, type: string }
    errors:
      - { code: 40001, msg: 参数校验失败 }
  - method: POST
    path: /api/device/batch-delete
    request:
      - { name: ids, type: array, required: true, writeOnly: true }
    response:
      - { name: deleted, type: number }
    errors:
      - { code: 40002, msg: 批量删除超过 100 条 }
      - { code: 40003, msg: 维护中设备禁止删除 }
  - method: GET
    path: /api/device/detail
    request:
      - { name: id, type: number, required: true }
    response:
      - { name: id, type: number }
      - { name: name, type: string }
      - { name: type, type: string }
      - { name: status, type: string }
      - { name: createdAt, type: string }
    errors:
      - { code: 40004, msg: 设备不存在 }
```
