import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'url'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * 项目根定位：从 vite root 逐级向上找含 `.vima/` 的最近祖先。
 *
 * 不能假设「vite root == 项目根」——多端布局下本端在 `apps/<id>/` 里，
 * 直接用 root 会把运行时证据写进 `apps/<id>/.vima/reports/`，
 * 而 `/check` 与 `vima converge` 只看项目根那一份，等于证据静默丢失。
 */
function findProjectRoot(from: string): string | null {
  let dir = path.resolve(from)
  for (;;) {
    if (existsSync(path.join(dir, '.vima'))) return dir
    const up = path.dirname(dir)
    if (up === dir) return null
    dir = up
  }
}

/**
 * 运行时错误落盘（A7 运行时证据，契约 §6.10）：dev 期接收浏览器侧上报的
 * window error / unhandledrejection / Vue errorHandler 错误，追加写
 * `<项目根>/.vima/reports/runtime-errors[.<appId>].jsonl`（JSON Lines），
 * 供 /check 聚合与 Verifier 验收取证——Agent 不开浏览器，console 错误对它不存在。
 * 仅 dev server 生效（apply: 'serve'），构建产物不含任何上报代码路径。
 */
function vimaRuntimeErrorSink(): Plugin {
  return {
    name: 'vima-runtime-error-sink',
    apply: 'serve',
    configureServer(server) {
      const projectRoot = findProjectRoot(server.config.root)
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
          if (!projectRoot) {
            // 不在 vima 项目里：不写文件，也不假装成功——空证据比没有证据更糟
            res.statusCode = 204
            res.end()
            return
          }
          try {
            const entry = JSON.parse(body)
            // 端 id 取自本端目录（多端布局 apps/<id>/）；单端根布局沿用旧文件名
            const rel = path.relative(projectRoot, server.config.root)
            const parts = rel.split(path.sep).filter(Boolean)
            const appId = parts[0] === 'apps' && parts[1] ? parts[1] : null
            const name = appId ? `runtime-errors.${appId}.jsonl` : 'runtime-errors.jsonl'
            const file = path.join(projectRoot, '.vima', 'reports', name)
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

/** 契约 mock 供给（A27，契约 §6.16）：demo 态 request 适配器从这里取 `vima mock` 的产物。 */
function vimaMockServe(): Plugin {
  return {
    name: 'vima-mock-serve',
    apply: 'serve',
    configureServer(server) {
      const projectRoot = findProjectRoot(server.config.root)
      server.middlewares.use('/__vima/mock', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end()
          return
        }
        const file = projectRoot ? path.join(projectRoot, '.vima', 'mock', 'contract-mock.json') : null
        if (!file || !existsSync(file)) {
          res.statusCode = 404
          res.end('缺 .vima/mock/contract-mock.json —— 先在项目根运行 `vima mock`（由契约生成，不要手写）')
          return
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(readFileSync(file))
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), vimaRuntimeErrorSink(), vimaMockServe()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // vendored UI 框架：用别名而不是深相对路径，页面里写 `from '@ui'`
      '@ui': fileURLToPath(new URL('./vendor/vima-ui-h5/dist', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
