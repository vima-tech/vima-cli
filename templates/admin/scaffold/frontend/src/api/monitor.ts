import request from '@/utils/request'

// ===== 在线用户 =====

export interface OnlineToken {
  username: string
  /** 过期时间：毫秒时间戳 */
  expiresAt: number
}

export function getOnlineList() {
  return request.get('/monitor/online')
}

export function kickOnline(username: string) {
  return request.delete(`/monitor/online/${encodeURIComponent(username)}`)
}

// ===== 定时任务 =====

export function getJobList(params?: any) {
  return request.get('/monitor/job', { params })
}

export function createJob(data: any) {
  return request.post('/monitor/job', data)
}

export function updateJob(data: any) {
  return request.put(`/monitor/job/${data.id}`, data)
}

export function deleteJob(id: number) {
  return request.delete(`/monitor/job/${id}`)
}

/** 立即执行一次 */
export function runJob(id: number) {
  return request.post(`/monitor/job/${id}/run`)
}

/** 启用/停用切换 */
export function toggleJob(id: number) {
  return request.put(`/monitor/job/${id}/toggle`)
}

// ===== 用户导入导出 =====
// blob 响应在 request.ts 里原样返回整个 AxiosResponse：
// 调用方从 res.data 取 Blob，从 res.headers['content-disposition'] 取文件名。

export function exportUsers(params?: any) {
  return request.get('/system/user/export', { params, responseType: 'blob' })
}

export function getUserImportTemplate() {
  return request.get('/system/user/import-template', { responseType: 'blob' })
}

export function importUsers(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  // axios 检测到 FormData 会自动带上 multipart/form-data 与 boundary，不要手动设 Content-Type
  return request.post('/system/user/import', formData)
}
