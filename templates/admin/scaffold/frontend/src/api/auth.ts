import request from '@/utils/request'

export interface LoginParams {
  username: string
  password: string
}

export interface UserInfo {
  id: number
  username: string
  realName: string
  avatar?: string
  roles: string[]
  /** 权限点集合，admin 为 ["*"]（通配） */
  perms: string[]
  /** 当前用户可见菜单 path 列表 */
  menuPaths: string[]
}

export function login(data: LoginParams) {
  return request.post('/auth/login', data)
}

export function logout() {
  return request.post('/auth/logout')
}

export function getUserInfo() {
  return request.get('/auth/user-info')
}

export function changePassword(data: { oldPassword: string; newPassword: string }) {
  return request.post('/auth/change-password', data)
}
