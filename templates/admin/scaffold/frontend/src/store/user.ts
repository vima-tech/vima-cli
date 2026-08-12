import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, logout as logoutApi, getUserInfo } from '@/api/auth'
import { storage } from '@/utils/storage'
import router from '@/router'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(storage.get('token') || '')
  const userInfo = ref<any>(storage.get('userInfo') || null)

  const isLoggedIn = computed(() => !!token.value)
  const username = computed(() => userInfo.value?.username || '')
  const realName = computed(() => userInfo.value?.realName || '')
  const roles = computed(() => userInfo.value?.roles || [])
  /** 后端 user-info 返回的权限点集合；admin 为 ["*"]（通配） */
  const perms = computed<string[]>(() => userInfo.value?.perms || [])
  /** 后端 user-info 返回的可见菜单 path 列表，用于侧边栏过滤 */
  const menuPaths = computed<string[]>(() => userInfo.value?.menuPaths || [])
  /** 后端 user-info 返回的 path → icon，让「菜单管理」里配的图标落到侧边栏 */
  const menuIcons = computed<Record<string, string>>(() => userInfo.value?.menuIcons || {})

  async function login(username: string, password: string) {
    const res: any = await loginApi({ username, password })
    token.value = res.data.token
    storage.set('token', res.data.token)
    await fetchUserInfo()
  }

  async function fetchUserInfo() {
    const res: any = await getUserInfo()
    userInfo.value = res.data
    storage.set('userInfo', res.data)
  }

  async function logout() {
    try {
      await logoutApi()
    } finally {
      resetState()
      router.push('/login')
    }
  }

  function resetState() {
    token.value = ''
    userInfo.value = null
    storage.remove('token')
    storage.remove('userInfo')
  }

  function hasRole(role: string) {
    return roles.value.includes(role) || roles.value.includes('admin')
  }

  /** perms 权限判断："*" 通配（admin），否则精确匹配权限点 */
  function hasPerm(perm: string) {
    return perms.value.includes('*') || perms.value.includes(perm)
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    username,
    realName,
    roles,
    perms,
    menuPaths,
    menuIcons,
    login,
    fetchUserInfo,
    logout,
    resetState,
    hasRole,
    hasPerm,
  }
})
