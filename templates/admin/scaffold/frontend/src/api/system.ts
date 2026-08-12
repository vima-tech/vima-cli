import request from '@/utils/request'

// 用户管理
export function getUserList(params?: any) {
  return request.get('/system/user/list', { params })
}

export function getUserById(id: number) {
  return request.get(`/system/user/${id}`)
}

export function createUser(data: any) {
  return request.post('/system/user', data)
}

export function updateUser(data: any) {
  return request.put('/system/user', data)
}

export function deleteUser(id: number) {
  return request.delete(`/system/user/${id}`)
}

export function resetPassword(data: { userId: number; newPassword: string }) {
  return request.post('/system/user/reset-password', data)
}

// 角色管理
export function getRoleList(params?: any) {
  return request.get('/system/role/list', { params })
}

export function getAllRoles() {
  return request.get('/system/role/all')
}

export function createRole(data: any) {
  return request.post('/system/role', data)
}

export function updateRole(data: any) {
  return request.put('/system/role', data)
}

export function deleteRole(id: number) {
  return request.delete(`/system/role/${id}`)
}

export function getRoleMenuIds(roleId: number) {
  return request.get(`/system/role/${roleId}/menus`)
}

export function assignRoleMenus(data: { roleId: number; menuIds: number[] }) {
  return request.post('/system/role/assign-menus', data)
}

// 菜单管理
export function getMenuList(params?: any) {
  return request.get('/system/menu/list', { params })
}

export function getMenuTree() {
  return request.get('/system/menu/tree')
}

/** 代码中真实存在的权限码清单（后端从 @PreAuthorize 注解扫描），权限标识下拉的唯一数据源 */
export function getPermOptions() {
  return request.get('/system/menu/perm-options')
}

export function createMenu(data: any) {
  return request.post('/system/menu', data)
}

export function updateMenu(data: any) {
  return request.put('/system/menu', data)
}

export function deleteMenu(id: number) {
  return request.delete(`/system/menu/${id}`)
}

// 部门管理
export function getDeptList(params?: any) {
  return request.get('/system/dept/list', { params })
}

export function getDeptTree() {
  return request.get('/system/dept/tree')
}

export function createDept(data: any) {
  return request.post('/system/dept', data)
}

export function updateDept(data: any) {
  return request.put('/system/dept', data)
}

export function deleteDept(id: number) {
  return request.delete(`/system/dept/${id}`)
}

// 字典
export function getDictDataByCode(dictCode: string) {
  return request.get(`/system/dict/data/code/${dictCode}`)
}

// 消息管理
export function getMessageList(params?: any) {
  return request.get('/system/message/list', { params })
}

export function getUnreadCount() {
  return request.get('/system/message/unread-count')
}

export function markAsRead(id: number) {
  return request.put(`/system/message/${id}/read`)
}

export function markAllAsRead() {
  return request.put('/system/message/read-all')
}

export function sendMessage(data: any) {
  return request.post('/system/message', data)
}
