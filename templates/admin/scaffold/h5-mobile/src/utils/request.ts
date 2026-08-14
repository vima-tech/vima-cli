import axios from 'axios'
import { toast } from '@ui'
import { clearToken, getToken } from './auth'

/**
 * 统一请求门面 —— **本端唯一允许发起网络请求的地方**。
 *
 * 为什么必须是这个形状（不是风格问题，是机检契约）：
 * `vima validate` 的 V-CODE-01 用一条正则扫全部前端代码，把
 * `request.<method>('<字面量路径>')` 的调用逐条对到 `docs/contracts/` 的接口清单上，
 * 并检查该接口的 `consumers` 是否包含本端——**越权调用在规划期就被拦住**。
 * 直接 `axios.get(url)` 或 `fetch(url)` 会让这条对账失明。
 *
 *   ✅ request.get('/app/appointment/mine')     路径写字面量，机检看得见
 *   ❌ fetch(base + p)                          绕过门面
 *   ❌ request.get(`/app/${kind}/list`)         路径拼变量，机检读不出常量部分
 *
 * baseURL 已是 `/api`（dev 由 vite proxy 转到后端），所以路径写 `/app/...`
 * 不再带 /api 前缀——与契约里 `/api/app/...` 归一后一致。
 */
const request = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

request.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** 登录态失效的统一处置：清票据 + 提示。跳登录由业务页决定（本骨架不预设登录页）。 */
function handleUnauthorized() {
  clearToken()
  toast('登录已失效，请重新登录')
}

request.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res && typeof res.code === 'number' && res.code !== 200) {
      if (res.code === 401) handleUnauthorized()
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    // 后端统一 ApiResponse 包装：直接把 data 交给调用方，业务代码不用层层解包
    return res && typeof res.code === 'number' ? res.data : res
  },
  (error) => {
    if (error.response?.status === 401) handleUnauthorized()
    const message = error.response?.data?.message
    return Promise.reject(message ? new Error(message) : error)
  },
)

export { request }
export default request
