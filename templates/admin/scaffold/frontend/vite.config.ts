import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'url'
import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

// 运行时错误落盘（A7 运行时证据，契约 §6.10）：dev 期接收浏览器侧上报的
// window error / unhandledrejection / Vue errorHandler 错误，追加写
// .vima/reports/runtime-errors.jsonl（JSON Lines），供 /check 聚合与 Verifier
// 验收取证——Agent 不开浏览器，console 错误对它不存在，这个文件就是它的眼睛。
// 仅 dev server 生效（apply: 'serve'），构建产物不含任何上报代码路径。
function vimaRuntimeErrorSink(): Plugin {
  return {
    name: 'vima-runtime-error-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__vima/runtime-error', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          try {
            const entry = JSON.parse(body)
            const file = path.join(server.config.root, '.vima/reports/runtime-errors.jsonl')
            mkdirSync(path.dirname(file), { recursive: true })
            appendFileSync(file, `${JSON.stringify({ ...entry, receivedAt: new Date().toISOString() })}\n`)
            res.statusCode = 204
          } catch {
            res.statusCode = 400
          }
          res.end()
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vimaRuntimeErrorSink()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
