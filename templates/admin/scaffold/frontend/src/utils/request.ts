import axios from 'axios'
import { useUserStore } from '@/store/user'
import router from '@/router'

const request = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

request.interceptors.request.use(
  (config) => {
    const userStore = useUserStore()
    if (userStore.token) {
      config.headers.Authorization = `Bearer ${userStore.token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

/**
 * 登录态失效的统一处置：清本地状态 + 跳登录页（带 redirect 以便重登后回原页）。
 *
 * 这里刻意不调 userStore.logout()——它会发一次 /auth/logout 请求，而那次请求同样会 401，
 * 于是再次进到本处置、再发一次请求，形成递归。登录态已经无效了，服务端也没什么可注销的。
 */
function handleUnauthorized() {
  const userStore = useUserStore()
  userStore.resetState()
  const current = router.currentRoute.value
  if (current.path !== '/login') {
    router.push({ path: '/login', query: { redirect: current.fullPath } })
  }
}

request.interceptors.response.use(
  (response) => {
    // blob 响应（文件下载）没有 code/message 包装：原样返回整个响应，
    // 调用方从 response.data 取 Blob、从 response.headers 取 content-disposition 文件名。
    if (response.config.responseType === 'blob') {
      return response
    }
    const res = response.data
    if (res.code && res.code !== 200) {
      if (res.code === 401) {
        handleUnauthorized()
      }
      return Promise.reject(new Error(res.message || 'Error'))
    }
    return res
  },
  (error) => {
    const status = error.response?.status
    // 后端在 401/403 时返回的是 { code, message, data } 同形状 JSON，优先用它的 message
    const message = error.response?.data?.message

    if (status === 401) {
      // token 缺失/失效/被踢下线
      handleUnauthorized()
    }
    return Promise.reject(
      message ? new Error(message) : error
    )
  }
)

export default request
