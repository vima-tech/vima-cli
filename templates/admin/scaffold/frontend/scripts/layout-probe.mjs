/**
 * A27 版面事实探针的唯一实现。
 *
 * Kimi WebBridge 默认通道通过浏览器内 dynamic import('/scripts/layout-probe.mjs')
 * 调用；layout-smoke.mjs 的 Playwright 回退通道直接导入。函数只在页面上下文执行。
 */
export function probeInPage(scaleAllowed) {
  const findings = []
  const sel = (el) => {
    const id = el.id ? `#${el.id}` : ''
    const cls = typeof el.className === 'string' && el.className
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
      : ''
    return `${el.tagName.toLowerCase()}${id}${cls}`.slice(0, 80)
  }
  const scrollableX = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const overflowX = getComputedStyle(n).overflowX
      if (overflowX === 'auto' || overflowX === 'scroll') return true
    }
    return false
  }
  const root = document.querySelector('[data-page]') ?? document.querySelector('.vui-page') ?? document.body
  const all = [...root.querySelectorAll('*')].filter((el) => el.offsetWidth || el.offsetHeight)

  // ① overflow-x
  for (const el of all) {
    const delta = el.scrollWidth - el.clientWidth
    if (delta > 1 && !scrollableX(el)) {
      findings.push({ probe: 'overflow-x', selector: sel(el), value: delta })
    }
  }

  // ② void（页底空洞）
  const doc = document.documentElement
  if (doc.scrollHeight <= doc.clientHeight + 1) {
    const last = [...root.children].filter((el) => el.offsetHeight).pop()
    if (last) {
      const tail = root.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom
      if (tail > 120) findings.push({ probe: 'void', selector: sel(root), value: Math.round(tail) })
    }
  }

  // ③ clipped
  for (const el of all) {
    const style = getComputedStyle(el)
    const hidden = style.overflow === 'hidden' || style.overflowY === 'hidden'
    if (hidden && el.scrollHeight - el.clientHeight > 8) {
      findings.push({ probe: 'clipped', selector: sel(el), value: el.scrollHeight - el.clientHeight })
    }
  }

  // ④ gap（相邻兄弟纵向大间隙）
  for (const el of all.slice(0, 400)) {
    const children = [...el.children].filter((child) => child.offsetHeight)
    for (let index = 1; index < children.length; index += 1) {
      const gap = children[index].getBoundingClientRect().top
        - children[index - 1].getBoundingClientRect().bottom
      if (gap > 40) {
        findings.push({ probe: 'gap', selector: sel(children[index]), value: Math.round(gap) })
      }
    }
  }

  // ⑤ scale（仅检查页面显式命名元素，跳过 vendor 内部实现）
  const near = (value) => scaleAllowed.some((allowed) => Math.abs(value - allowed) <= 0.5)
  const pageAuthored = (el) => [...el.classList].some((name) => !/^(?:vui-|v-|is-)/.test(name))
  for (const el of all.slice(0, 400)) {
    if (!pageAuthored(el)) continue
    const style = getComputedStyle(el)
    for (const prop of ['rowGap', 'columnGap', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight']) {
      const raw = style[prop]
      if (!raw || !raw.endsWith('px')) continue
      const value = Number.parseFloat(raw)
      if (value > 0 && value <= 48 && !near(value)) {
        findings.push({ probe: 'scale', selector: sel(el), value: `${prop}:${value}` })
        break
      }
    }
  }

  // ⑥ overlap（absolute/fixed/sticky 覆盖属于设计）
  for (const el of all.slice(0, 400)) {
    const children = [...el.children].filter((child) => child.offsetWidth && child.offsetHeight)
    for (let index = 1; index < children.length; index += 1) {
      const previous = children[index - 1]
      const current = children[index]
      const a = previous.getBoundingClientRect()
      const b = current.getBoundingClientRect()
      const width = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (width <= 2 || height <= 2 || width * height <= 4) continue
      const anchored = (style) => ['absolute', 'fixed', 'sticky'].includes(style.position)
      if (!anchored(getComputedStyle(previous)) && !anchored(getComputedStyle(current))) {
        findings.push({ probe: 'overlap', selector: sel(current), value: Math.round(width * height) })
      }
    }
  }

  // ⑦ wrap（动作行意外换行）
  for (const el of document.querySelectorAll('.action-group, .wf-actions, .vui-card-extra, [data-actions]')) {
    const children = [...el.children].filter((child) => child.offsetHeight)
    if (children.length < 2) continue
    const tops = new Set(children.map((child) => Math.round(child.getBoundingClientRect().top)))
    if (tops.size > 1) findings.push({ probe: 'wrap', selector: sel(el), value: children.length })
  }
  return findings
}
