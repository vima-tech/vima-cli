#!/usr/bin/env node
/**
 * 版面冒烟七探针（A27，契约 §6.17）——量事实，不看审美。
 *
 * 用法：
 *   1. 终端 A：npm run dev:demo   （demo 态：免登录 + 契约 mock；先 `vima mock`）
 *   2. 终端 B：npm run smoke      （Kimi WebBridge 不可用时的 Playwright 回退）
 *
 * 探针（判据阈值来自 51 路由两轮实测，比截图快且不漏）：
 *   overflow-x  横向溢出：scrollWidth-clientWidth>1 且自身与祖先皆无横向滚动容器
 *   void        页底空洞：页面无纵向滚动且末元素底边距容器底 >120px
 *   clipped     被裁切：scrollHeight>clientHeight 且 overflow(-y) hidden
 *   gap         间隙异常：相邻兄弟纵向间距 >40px
 *   scale       刻度合规：[data-page] 内计算 gap/padding ∉ 令牌取值集（±密度档）
 *   overlap     控件重叠：兄弟盒相交 >4px²
 *   wrap        动作行意外换行：同一动作容器内子元素 offsetTop 不一致
 *
 * 路由来源：/__gallery 暴露的 window.__vimaRoutes（业务页判据与画廊同一份——
 * 路由名不在骨架内置集，天然排除脚手架自带页面）。
 *
 * **诚实降级**：playwright 未安装 / dev server 未起 → 打印原因 exit 0 **不写报告**。
 * 空报告会被 /check 读成「跑过且零问题」，比没有更糟（A7 同款纪律）。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { probeInPage } from './layout-probe.mjs'

const BASE = process.env.VIMA_SMOKE_URL || 'http://localhost:5173'
const VIEWPORTS = [375, 1280, 1920]
/** 允许的间距刻度：tokens.css 的 --v-gap-* 全档（default/compact/loose 的并集）+ 0 */
const SCALE = [0, 2, 4, 6, 8, 10, 12, 16, 22, 24, 32]

const here = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(here, '..')

function findProjectRoot(from) {
  let dir = from
  for (;;) {
    if (existsSync(path.join(dir, '.vima'))) return dir
    const up = path.dirname(dir)
    if (up === dir) return null
    dir = up
  }
}

function bail(reason) {
  console.log(`[layout-smoke] 未执行：${reason}`)
  console.log('[layout-smoke] 不写报告文件——/check 会如实报「无版面冒烟通道」。')
  process.exit(0)
}

const projectRoot = findProjectRoot(appRoot)
if (!projectRoot) bail('向上没找到 .vima/，本骨架似乎不在 vima 项目里')

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  bail('playwright 未安装（启用探针：npm i -D playwright && npx playwright install chromium）')
}

let browser
try {
  browser = await chromium.launch()
} catch (err) {
  bail(`浏览器启动失败：${err?.message ?? err}（npx playwright install chromium）`)
}

const page = await browser.newPage()
let routes
try {
  await page.goto(`${BASE}/__gallery`, { waitUntil: 'networkidle', timeout: 15000 })
  routes = await page.evaluate(() => globalThis.__vimaRoutes ?? null)
} catch (err) {
  await browser.close()
  bail(`连不上 ${BASE}（先 npm run dev:demo）：${err?.message ?? err}`)
}
if (!Array.isArray(routes)) {
  await browser.close()
  bail('/__gallery 未暴露 __vimaRoutes——不是 demo 态？（npm run dev:demo）')
}
if (routes.length === 0) {
  await browser.close()
  bail('还没有业务页面（路由名均属骨架内置集）——无可冒烟，属正常前期状态')
}

const pagesOut = []
let bad = 0
for (const route of routes) {
  for (const vw of VIEWPORTS) {
    await page.setViewportSize({ width: vw, height: 900 })
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 15000 })
      const findings = await page.evaluate(probeInPage, SCALE)
      if (findings.length) {
        bad += findings.length
        pagesOut.push({ route, viewport: vw, findings })
      }
    } catch (err) {
      bad += 1
      pagesOut.push({ route, viewport: vw, findings: [{ probe: 'error', selector: '-', value: String(err?.message ?? err).slice(0, 120) }] })
    }
  }
}
await browser.close()

const outDir = path.join(projectRoot, '.vima', 'reports')
mkdirSync(outDir, { recursive: true })
const report = { schemaVersion: '1', source: 'playwright', viewports: VIEWPORTS, routes: routes.length, pages: pagesOut, bad }
const outFile = path.join(outDir, 'layout-smoke.json')
writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`)
console.log(`[layout-smoke] ${routes.length} 路由 × ${VIEWPORTS.length} 视口，发现 ${bad} 处 → ${path.relative(projectRoot, outFile)}`)
process.exit(0)
