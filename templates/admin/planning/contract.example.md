# 设备管理 API 契约（示例）

<!--
  本文件是契约文件的完整示例（设计文档 §9.5）。生成真实契约时：
  - 每个业务模块一份 docs/contracts/<module>-api.md；
  - markdown 正文给人读；文末必须附一块 vima:contract YAML 数据块给渲染层/校验层读——
    两者同文件维护、永不分离；
  - 每个接口五要素齐全：方法/路径/请求参数/响应体/错误码（V-CON-01，request 可为空数组但字段必须显式存在）；
  - 契约是前后端任务的唯一事实来源：任务文件不得复制接口定义；变更接口先改契约再改任务最后改代码；
  - 原型表格列头唯一取自本文件 YAML 块中对应 api 的 response 字段（§13.3）。
-->

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

## 字段可选键（A22，出自 sustain-v3 实测）

| 键 | 何时用 |
|---|---|
| `writeOnly: true` | 只写字段（密码、批量操作入参 `ids`）。不标的话 V-CON-08 会提示「只进不出」 |
| `readOnly: true` | 只读字段（计算列）。**豁免必须显式**——「只加了 POST 忘了 GET/PUT」长得一模一样，机器分不清 |
| `fields: [...]` | `type: json` 聚合字段的子协议（一层）。声明后 V-SPEC-15 会把子字段名并入弹窗对账 |
| `enforced: false` | 该聚合字段**确实没有权威结构**（如整体透传不解析）。「无强制结构」应当能被如实表达，而不是留白 |

```yaml
- { name: password, type: string, required: true, writeOnly: true }
- { name: structure, type: json, required: true,
    fields: [{ name: sections, type: array, required: true }] }
- { name: fieldConfig, type: json, enforced: false }   # 打印模板整体透传，无权威结构
```

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
    errors:
      - { code: 40001, msg: 参数校验失败 }
  - method: POST
    path: /api/device/batch-delete
    request:
      - { name: ids, type: array, required: true }
    response:
      - { name: deleted, type: number }
    errors:
      - { code: 40002, msg: 批量删除超过 100 条 }
      - { code: 40003, msg: 维护中设备禁止删除 }
```
