import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

/**
 * 演示态契约 mock（A27，契约 §6.16 / §14）。
 *
 * 数据来源：`vima mock` 生成的 `.vima/mock/contract-mock.json`，经 vite dev 中间件
 * `/__vima/mock` 提供——**字段名与真实接口一字不差**，因为它们出自同一份契约。
 * 这正是本机制相对一切外部原型工具的决定性优势：demo 里能跑通的字段，落地就能跑通。
 *
 * 数据档切换：页面 URL 带 `?__mock=empty|many|long` 即整页切档
 * （空列表与超长文本恰是暴露版面缺陷最有效的两档）。
 *
 * 本模块只在 demo 态被动态 import（main.ts），生产构建静态消除、产物零包含。
 */

interface MockApi {
  method: string
  path: string
  datasets: Record<string, unknown>
}

let mockIndex: MockApi[] | null = null

async function loadMock(): Promise<MockApi[]> {
  if (mockIndex) return mockIndex
  const res = await fetch('/__vima/mock')
  if (!res.ok) {
    throw new Error(
      'demo 态缺 mock 数据：先在项目根运行 `vima mock`（由 docs/contracts 生成，不要手写）',
    )
  }
  const data = await res.json()
  const apis: MockApi[] = Array.isArray(data.apis) ? data.apis : []
  mockIndex = apis
  return apis
}

/** 路径匹配：契约的 `{id}` 占位段匹配任意非空段（与 V-CODE 的归一口径同族）。 */
function pathMatches(pattern: string, actual: string): boolean {
  const a = pattern.split('/').filter(Boolean)
  const b = actual.split('/').filter(Boolean)
  if (a.length !== b.length) return false
  return a.every((seg, i) => (/^\{[^}]+\}$/.test(seg) ? b[i] !== '' : seg === b[i]))
}

function datasetKey(): string {
  const v = new URLSearchParams(window.location.search).get('__mock')
  return v === 'empty' || v === 'many' || v === 'long' ? v : 'default'
}

/**
 * 安装 demo 适配器：接管 axios 实例的传输层，按 (method, path) 命中契约 mock。
 * 未覆盖的调用**显式报错**（进 A7 运行时证据），不静默返回空——
 * 「demo 里悄悄空转」会把缺契约伪装成缺数据。
 */
export function installDemoMock(request: AxiosInstance): void {
  request.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const apis = await loadMock()
    const method = String(config.method ?? 'get').toUpperCase()
    // request 门面的 baseURL 是 /api，契约路径带 /api 前缀——拼回完整路径再匹配
    const full = `${config.baseURL ?? ''}${config.url ?? ''}`.split('?')[0]
    const hit = apis.find((a) => a.method === method && pathMatches(a.path, full))
    if (!hit) {
      throw new Error(`demo mock 未覆盖: ${method} ${full}（契约里没有这个接口？先补契约再 vima mock）`)
    }
    const data = hit.datasets[datasetKey()] ?? hit.datasets.default
    return {
      data: { code: 200, message: 'ok', data },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
}

/** 演示用户（A27）：h5 骨架无守卫无 v-auth，此函数保留同构接口备任务接线。 */
export function demoUser() {
  return {
    id: 0,
    username: 'demo',
    realName: '演示用户',
    avatar: '',
    roles: ['admin'],
    perms: ['*'],
    menuPaths: [],
    menuIcons: {},
  }
}
