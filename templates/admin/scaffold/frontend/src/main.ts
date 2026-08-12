import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VimaUiAdmin from '@vima-tech/ui-admin'
import '@vima-tech/ui-admin/style.css'
import './style.css'
import App from './App.vue'
import router from './router'
import { setupAuthDirective } from './directives/auth'

const app = createApp(App)

// 运行时错误上报（A7 运行时证据，仅 dev）：window/Vue 层错误发给 vite 中间件，
// 落盘 .vima/reports/runtime-errors.jsonl 给不开浏览器的 Agent 当眼睛（契约 §6.10）。
// 同错误去重、每次加载最多 20 条，防错误风暴刷爆文件。
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

app.use(createPinia())
app.use(router)
app.use(VimaUiAdmin)
setupAuthDirective(app)
app.mount('#app')
