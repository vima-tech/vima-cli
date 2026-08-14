// @vima device-list-fe
// 设备模块 API 层：路径与字段严格按 docs/contracts/device-api.md，禁止自定义。
import { request } from '../utils/request'

export interface Device {
  id: number
  name: string
  type: string
  status: string
  createdAt: string
}

export interface DeviceQuery {
  name?: string
  status?: string
  pageNum: number
  pageSize: number
}

/** 设备分页查询（GET /api/device/list） */
export function listDevices(params: DeviceQuery) {
  return request.get<Device[]>('/api/device/list', { params })
}

/** 新增设备（POST /api/device） */
export function createDevice(data: { name: string; type: string }) {
  return request.post<Device>('/api/device', data)
}

/** 批量删除设备（POST /api/device/batch-delete，最多 100 条） */
export function batchDeleteDevices(ids: number[]) {
  return request.post<{ deleted: number }>('/api/device/batch-delete', { ids })
}
