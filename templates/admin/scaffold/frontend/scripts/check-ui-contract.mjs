// 前端 UI 契约静态检查。收录的都是「不报错、页面照常渲染、只能靠量或靠读代码发现」的缺陷类——
// 逐页跑浏览器抓不全它们：TDZ 要分支走到才炸，VTab 误用只表现为标题条能横向滚。
//
//   ① TDZ：immediate:true 的 watch 触到「声明在它下方」的 setup 顶层 const
//   ② VTab 误用：内容放进 VTabItem 默认插槽（框架的 .vui-tabs 是横向标题条，
//      .vui-tab-content 无任何样式，内容会把激活项撑宽、把后面的标题顶出可视区）
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// 从脚本自身位置推前端源码根（本文件位于 <前端根>/scripts/），不写死任何项目路径
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src')
let files = []
try {
  files = execSync(`grep -rl "immediate: true" ${root} --include=*.vue`, { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean)
} catch {
  // grep 无命中时 exit=1，属正常情况
}

const findings = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  const L = src.split('\n')

  // 只收 <script setup> **顶层**（列 0）的 const/let 声明。
  // TDZ 只对 setup 作用域的声明成立；函数体里的局部 const 与 watch 无关，
  // 收进来会让 `const list = res.data.list` 这类局部名去撞 watch 里同名的东西——
  // 首版正是因此多报了 3 条（list / step / id 全是别的函数里的局部变量）。
  // function 声明会提升，不受 TDZ 约束，所以不收。
  const decls = new Map()
  L.forEach((line, i) => {
    const m = line.match(/^(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/)
    if (m && !decls.has(m[1])) decls.set(m[1], i + 1)
  })
  // 本地函数声明（会提升，调用点可早于定义 —— 但函数体里的 const 引用仍受 TDZ 约束）
  const fns = new Map()
  L.forEach((line, i) => {
    const m = line.match(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/)
    if (m) fns.set(m[1], i + 1)
  })
  const fnBody = (start) => {
    let depth = 0, out = [], began = false
    for (let i = start - 1; i < L.length; i++) {
      out.push(L[i])
      for (const ch of L[i]) {
        if (ch === '{') { depth++; began = true }
        else if (ch === '}') depth--
      }
      if (began && depth <= 0) break
    }
    return out.join('\n')
  }
  // 被调函数的**形参**和函数体内的局部声明都不是外部引用，必须排除——
  // 不排除的话 `function f(id){...}` 里的 id 会去撞外层某个 `const id = ...`，
  // 首版因此 10 条命中里 6 条是误报（step / id / list 全是形参或局部变量）。
  const localNames = (body) => {
    const s = new Set()
    const sig = body.match(/^[^(]*\(([^)]*)\)/)
    if (sig) for (const a of sig[1].split(',')) {
      const n = a.trim().replace(/[:=].*$/, '').replace(/[{}\[\].\s]/g, '')
      if (n) s.add(n)
    }
    for (const m of body.matchAll(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) s.add(m[1])
    // 解构声明：const { a, b } = ... / const [a, b] = ...
    for (const m of body.matchAll(/^\s*(?:const|let|var)\s*[{\[]([^}\]]*)[}\]]/gm)) {
      for (const a of m[1].split(',')) {
        const n = a.trim().split(':').pop().trim()
        if (n) s.add(n)
      }
    }
    return s
  }

  // 每个 immediate:true 往上找它所属 watch( 的起始行
  L.forEach((line, i) => {
    if (!/immediate:\s*true/.test(line)) return
    const endLine = i + 1
    let start = -1
    for (let j = i; j >= 0 && j > i - 60; j--) {
      if (/^\s*watch(Effect)?\s*\(/.test(L[j])) { start = j; break }
    }
    if (start < 0) return
    const body = L.slice(start, i + 1).join('\n')

    // 收集 watch 体直接引用的标识符 + 它调用的本地函数体里的标识符（一层）
    const used = new Set(body.match(/\b[A-Za-z_$][\w$]*\b/g) || [])
    for (const [name, ln] of fns) {
      if (!new RegExp(`\\b${name}\\s*\\(`).test(body)) continue
      const fb = fnBody(ln)
      const locals = localNames(fb)
      for (const id of fb.match(/\b[A-Za-z_$][\w$]*\b/g) || []) {
        if (!locals.has(id)) used.add(id)
      }
    }
    for (const name of used) {
      const dl = decls.get(name)
      if (dl && dl > endLine) {
        findings.push({ file: f.replace(root + '/', ''), watch: `${start + 1}-${endLine}`, name, declaredAt: dl })
      }
    }
  })
}

for (const x of findings) {
  console.log(`✗ [TDZ] ${x.file}  watch(${x.watch}) 用到 ${x.name}，但它声明在第 ${x.declaredAt} 行`)
}
console.log(`① TDZ：扫描 ${files.length} 个文件，命中 ${findings.length} 处`)

// ② VTab 误用 ------------------------------------------------------------
let vueFiles = []
try {
  vueFiles = execSync(`grep -rl "VTabItem" ${root} --include=*.vue`, { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean)
} catch {
  // 无命中时 grep exit=1
}

const tabFindings = []
for (const f of vueFiles) {
  const src = readFileSync(f, 'utf8')
  // 逐个 <VTabItem …> … </VTabItem>，取其默认插槽内容
  for (const m of src.matchAll(/<VTabItem\b[^>]*?>([\s\S]*?)<\/VTabItem>/g)) {
    const body = m[1]
      .replace(/<!--[\s\S]*?-->/g, '')          // 注释不算内容
      .replace(/<div\s*\/>|<div>\s*<\/div>/g, '') // 约定的空占位不算内容
      .trim()
    if (!body) continue
    const line = src.slice(0, m.index).split('\n').length
    tabFindings.push({ file: f.replace(root + '/', ''), line, head: body.slice(0, 46).replace(/\s+/g, ' ') })
  }
}
for (const x of tabFindings) {
  console.log(`✗ [VTab] ${x.file}:${x.line}  内容放进了 VTabItem 插槽 —— ${x.head}…`)
}
console.log(`② VTab：扫描 ${vueFiles.length} 个文件，命中 ${tabFindings.length} 处`)

const total = findings.length + tabFindings.length
console.log(total ? `\n共 ${total} 处待修` : '\n无问题')
process.exit(total ? 1 : 0)
