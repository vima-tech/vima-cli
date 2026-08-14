import { createApp } from 'vue'
import VimaUiH5 from '@ui'
import '@ui/global.css'
// 换肤：取消下面这行的注释即切到临床蓝（Sustain 原型口径），顺序必须在 global.css 之后。
// import '@ui/themes/clinical-blue.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

// 演示态（A27）：接管请求层为契约 mock（vite --mode demo；生产构建静态消除）。
if (import.meta.env.VITE_DEMO === '1') {
  const { installDemoMock } = await import('./utils/demo-mock')
  const { default: request } = await import('./utils/request')
  installDemoMock(request)
}

// 运行时错误上报（A7 运行时证据，仅 dev）：window/Vue 层错误发给 vite 中间件，
// 落盘 <项目根>/.vima/reports/runtime-errors[.<appId>].jsonl，给不开浏览器的 Agent
// 当眼睛（契约 §6.10）。同错误去重、每次加载最多 20 条，防错误风暴刷爆文件。
if (import.meta.env.DEV) {
  const seen = new Set<string>()
  const report = (payload: Record<string, unknown>) => {
    const key = JSON.stringify(payload)
    if (seen.has(key) || seen.size >= 20) return
    seen.add(key)
    fetch('/__vima/runtime-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, page: location.pathname + location.search + location.hash }),
    }).catch(() => {})
  }
  window.addEventListener('error', (e) =>
    report({ kind: 'error', message: String(e.message), source: `${e.filename}:${e.lineno}:${e.colno}` }),
  )
  window.addEventListener('unhandledrejection', (e) =>
    report({ kind: 'unhandledrejection', message: String((e.reason as Error)?.message ?? e.reason) }),
  )
  app.config.errorHandler = (err, _instance, info) => {
    report({ kind: 'vue', message: String((err as Error)?.message ?? err), info })
    console.error(err)
  }
}

app.use(router)
app.use(VimaUiH5)
app.mount('#app')
