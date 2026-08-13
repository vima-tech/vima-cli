// 线框原型渲染器（admin 模板资产；设计 §13.3，契约 §11 / §6.7）
// 语义占位线框（刻意无样式感）：input=带 label 虚线盒；button=方框标签；
// table=真实列头（取契约 response 字段）+2 行灰占位；modal=卡片默认 hidden、按钮触发显示；
// pagination/tabs/cards/form=灰盒虚线。区块按 layout 顺序渲染；
// 页面声明 regions（A14 分栏）时改为按列渲染——每列一叠区块，列宽取 <n>px / <n>fr。
// 交互三种：nav→href="#page-PAGE-xx"、modal→data-modal 按钮、api→徽标（title 属性 METHOD /path）。
// 铁律：确定性渲染——禁 Date/Math.random；所有数据经 escapeHtml；同一输入字节一致；
//       html 末尾单个换行；单文件零外部请求。同时产出 §6.7 manifest（pages 按 id 排、links 按 kind,to 排）。
import { readFileSync } from 'node:fs';

// 骨架 + 全部内联 CSS/JS（弹窗事件委托 + noscript 平铺）由同目录 prototype.template.html 提供
const TEMPLATE = readFileSync(new URL('./prototype.template.html', import.meta.url), 'utf8');

// 布局区块枚举词表（V-SPEC-04 同源）
const BLOCK_WORDS = new Set(['toolbar', 'search', 'table', 'form', 'cards', 'tabs', 'pagination']);

/** HTML 转义：渲染器内所有数据出口必须经过它。 */
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 接口唯一键：`${METHOD} ${path}`（method 统一大写）。 */
function normApiKey(s) {
  const str = String(s ?? '').trim();
  const i = str.indexOf(' ');
  if (i < 0) return str.toUpperCase();
  return `${str.slice(0, i).toUpperCase()} ${str.slice(i + 1).trim()}`;
}

/** 接口徽标：title 属性显示 METHOD /path。 */
function apiBadge(api) {
  const key = normApiKey(api);
  return `<span class="wf-api" title="${esc(key)}">${esc(key)}</span>`;
}

/** 分栏列宽 → flex 简写：<n>px 为固定列，<n>fr 为按比例弹性列（A14；V-SPEC-12 已保证格式）。 */
function flexOf(width) {
  const w = String(width ?? '1fr');
  if (w.endsWith('fr')) return `${Number.parseFloat(w) || 1} 1 0`;
  return `0 0 ${w}`;
}

/** pendingConfirm 待确认徽标（§13.1 信息源分级的人眼投影，契约 §11）。 */
function pend(o) {
  return o && typeof o === 'object' && o.pendingConfirm === true
    ? '<span class="wf-pend" title="AI 推断项，待用户确认——vima approve 会在其清零前阻断">⚠️ 待确认</span>'
    : '';
}

/**
 * 渲染线框原型。
 * @param {{projectName: string, spec: object, contracts: Array}} model
 * @returns {{html: string, manifest: object}} html 末尾单个换行；manifest 为 §6.7 结构（对象，落盘由命令层 stableStringify）
 */
export function renderPrototype(model) {
  const { projectName, spec, contracts } = model;
  const pages = [...spec.pages.keys()].sort().map((id) => spec.pages.get(id)); // pages 按 id 排序（字节稳定）

  // 契约索引：接口键 → api 定义
  const contractByKey = new Map();
  for (const c of contracts ?? []) {
    for (const a of c.apis ?? []) contractByKey.set(normApiKey(`${a.method} ${a.path}`), a);
  }

  // ── 管理后台外壳数据：菜单树 + 角色归属（契约 §11「原型管理后台外壳」）──
  const roles = Array.isArray(spec.roles) ? spec.roles : [];
  const menus = Array.isArray(spec.menus) ? spec.menus : [];
  const rolesOfMenu = (menuId) =>
    roles.filter((r) => (Array.isArray(r.menus) ? r.menus : []).includes(menuId));
  const pageOwnership = new Map(); // pageId → { menuId, roleIds: 'ROLE-01 ROLE-02' }
  for (const m of menus) {
    if (typeof m.page === 'string' && m.page !== '' && !pageOwnership.has(m.page)) {
      pageOwnership.set(m.page, { menuId: m.id, roleIds: rolesOfMenu(m.id).map((r) => r.id).join(' ') });
    }
  }
  const ctx = { contractByKey, pageOwnership };

  const menuPages = new Set(menus.map((m) => m.page).filter((v) => typeof v === 'string'));
  const orphanPages = pages.filter((p) => !menuPages.has(p.id));
  const menuRow = (m) => {
    const owners = rolesOfMenu(m.id);
    const target = typeof m.page === 'string' && spec.pages.has(m.page) ? `#page-${esc(m.page)}` : '#';
    const badges = owners.map((r) => `<i title="${esc(r.id)}">${esc(r.name ?? r.id)}</i>`).join('');
    const blind = owners.length === 0 ? '<i class="wf-menu-blind" title="无任何角色覆盖（权限盲区）">⚠️ 盲区</i>' : '';
    return `<a class="wf-menu" href="${target}" data-roles="${esc(owners.map((r) => r.id).join(' '))}"><span class="wf-menu-name">${esc(m.name ?? m.id)}${pend(m)}</span><span class="tid">${esc(m.id)}</span><span class="wf-menu-roles">${badges}${blind}</span></a>`;
  };
  const aside = `<aside class="wf-side">
<div class="wf-side-title">${esc(projectName)}<span class="wf-side-sub">管理后台 · 线框原型</span></div>
<div class="wf-roles" data-role-chips>
<span class="wf-roles-label">角色视角</span>
<button type="button" class="wf-chip wf-chip-on" data-role-chip="">全部</button>
${roles.map((r) => `<button type="button" class="wf-chip" data-role-chip="${esc(r.id)}" title="${esc(r.id)}">${esc(r.name ?? r.id)}${pend(r)}</button>`).join('\n')}
</div>
<nav class="wf-menu-tree">
${menus.map(menuRow).join('\n')}
${orphanPages.length ? `<div class="wf-menu-group">未挂菜单页面</div>\n${orphanPages.map((p) => `<a class="wf-menu" href="#page-${esc(p.id)}"><span class="wf-menu-name">${esc(p.title ?? p.id)}</span><span class="tid">${esc(p.id)}</span></a>`).join('\n')}` : ''}
${(spec.flows ?? []).length > 0 ? '<div class="wf-menu-group">对齐产物</div>\n<a class="wf-menu" href="#flows"><span class="wf-menu-name">业务流程演示</span><span class="tid">FLOW</span></a>' : ''}
</nav>
</aside>`;

  // ── 头部说明 ──
  const head = `<header class="wf-head">
<h1>${esc(projectName)} · 线框原型</h1>
<p>语义占位线框：只表达功能与布局，不表达视觉。由 <code>docs/spec.md</code> 页面数据块确定性渲染——修改 spec 后重新执行 <code>vima render-prototype</code>。
左侧为菜单树（真实系统的侧边导航结构）；点「角色视角」可查看每个角色实际可见的菜单与页面（需 JS）；禁用 JS 时全部弹窗平铺可见、角色归属以菜单行徽标呈现。
带「⚠️ 待确认」的条目是 AI 推断项，请重点核对。</p>
</header>`;

  // ── 页面线框（区块按 layout 顺序）──
  const sections = pages.map((p) => renderPage(p, ctx)).join('\n');

  // ── 流程演示区（§13.3：泳道逐步回放为页面跳转；无 flow 时整段省略）──
  const flows = renderFlows(spec);

  const foot = `<footer class="wf-foot">单文件零外部请求 · 无时间戳、同一输入字节一致（<code>vima render-prototype --check</code> 可验漂移）。<br>
机器对账基线见同目录 <code>prototype.manifest.json</code>（Verifier 只读它，不读本页面）。</footer>`;

  const content = [aside, '<main class="wf-main">', head, sections, ...(flows ? [flows] : []), foot, '</main>'].join('\n');
  const title = `${projectName} · 线框原型`;
  const html = TEMPLATE.split('{{TITLE}}').join(esc(title)).split('{{CONTENT}}').join(content).replace(/\n*$/, '\n');

  // ── §6.7 manifest：pages 按 id 排、links 按 (kind,to) 排 ──
  const manifest = {
    schemaVersion: '1',
    pages: pages.map((p) => ({
      id: p.id,
      title: p.title ?? p.id,
      menu: p.menu ?? null,
      layout: p.layout ?? [],
      ...(Array.isArray(p.regions) && p.regions.length > 0 ? { regions: p.regions } : {}),
      components: p.components ?? [],
      modals: p.modals ?? [],
      links: buildLinks(p),
    })),
  };
  return { html, manifest };
}

/**
 * 流程演示区（§13.3 流程演示模式的轻量落地）：每条 vima:flow 一段步骤列表，
 * 步骤中 page/next 渲染为 #page-PAGE-xx 锚点——点击即「回放」到对应页面线框。
 * flows 不进 manifest（契约 §11：manifest schema §6.7 不变）。
 */
function renderFlows(spec) {
  const flows = Array.isArray(spec.flows) ? spec.flows : [];
  if (flows.length === 0) return '';
  const roleName = new Map(
    (Array.isArray(spec.roles) ? spec.roles : [])
      .filter((r) => r && typeof r === 'object' && typeof r.id === 'string')
      .map((r) => [r.id, r.name ?? r.id]),
  );
  const pageRef = (id) =>
    typeof id === 'string' && id !== ''
      ? `<a class="wf-flow-page" href="#page-${esc(id)}">${esc(id)}</a>`
      : '';
  const body = flows
    .map((f) => {
      const steps = (Array.isArray(f.steps) ? f.steps : [])
        .map((s) => {
          const role = typeof s.role === 'string' && s.role !== ''
            ? `<span class="wf-flow-role" title="${esc(s.role)}">${esc(roleName.get(s.role) ?? s.role)}</span>`
            : '';
          const api = typeof s.api === 'string' && s.api !== '' ? apiBadge(s.api) : '';
          const next = typeof s.next === 'string' && s.next !== ''
            ? `<span class="wf-flow-next">→ ${pageRef(s.next)}</span>`
            : '';
          return `<li>${role}${pageRef(s.page)}<span class="wf-flow-action">${esc(s.action ?? '')}</span>${api}${next}</li>`;
        })
        .join('\n');
      return `<div class="wf-flow" id="flow-${esc(f.id)}">
<div class="wf-flow-head"><strong>${esc(f.name ?? f.id)}</strong><span class="tid">${esc(f.id)}</span>${pend(f)}</div>
<ol class="wf-flow-steps">
${steps}
</ol>
</div>`;
    })
    .join('\n');
  return `<section class="wf-flows" id="flows">
<header class="wf-page-head"><h2>业务流程演示</h2><span class="tid">FLOW</span></header>
<p class="wf-flows-hint">每条流程按步骤回放：点击步骤中的页面即跳转到对应线框（角色 → 页面 → 动作 → 接口 → 去向）。</p>
${body}
</section>`;
}

/** 从页面数据块推导跳转/弹窗/接口连线（去重后按 kind,to 稳定排序）。 */
function buildLinks(p) {
  const seen = new Map();
  const add = (kind, to) => {
    if (typeof to !== 'string' || to === '') return;
    const key = `${kind} ${to}`;
    if (!seen.has(key)) seen.set(key, { kind, from: p.id, to });
  };
  const addAction = (it) => {
    if (it.action === 'nav' || it.action === 'modal') add(it.action, it.target);
    else if (it.action === 'api') add('api', it.api);
  };
  for (const comp of p.components ?? []) {
    if (typeof comp.api === 'string') add('api', comp.api);
    for (const it of comp.items ?? []) addAction(it);
    for (const ra of comp.rowActions ?? []) addAction(ra);
  }
  for (const mo of p.modals ?? []) {
    if (typeof mo.submit?.api === 'string') add('api', mo.submit.api);
  }
  return [...seen.values()].sort((a, b) =>
    a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.to < b.to ? -1 : a.to > b.to ? 1 : 0,
  );
}

/** 单页线框：区块按 layout 顺序渲染，弹窗卡挂在页面末尾（默认 hidden）。 */
function renderPage(p, ctx) {
  // 同名区块按声明顺序与 layout 逐个配对（layout 重复同词时不重复渲染同一份组件）
  const queues = new Map();
  for (const comp of p.components ?? []) {
    const k = String(comp.block ?? '');
    if (!queues.has(k)) queues.set(k, []);
    queues.get(k).push(comp);
  }
  const take = (word) => (queues.get(String(word)) ?? []).shift() ?? { block: word };
  const bandsOf = (word) => renderBlock(String(word), take(word), ctx);
  const regions = Array.isArray(p.regions) && p.regions.length > 0 ? p.regions : null;
  let blocks = '';
  if (regions) {
    // A14：纵向若干带，每带为全宽带（blocks）或分栏带（columns）
    blocks = `${regions
      .map((band) => {
        if (Array.isArray(band?.blocks) && band.blocks.length > 0) {
          return band.blocks.map(bandsOf).join('\n');
        }
        const cols = (Array.isArray(band?.columns) ? band.columns : [])
          .map((col) => {
            const width = String(col?.width ?? '1fr');
            const inner = (Array.isArray(col?.blocks) ? col.blocks : []).map(bandsOf).join('\n');
            const cap = `<div class="wf-col-cap"><span>${esc(col?.name ?? '')}</span><span class="wf-col-w">${esc(width)}</span></div>`;
            return `<div class="wf-col" style="flex:${esc(flexOf(width))}">\n${cap}\n${inner}\n</div>`;
          })
          .join('\n');
        return `<div class="wf-cols">\n${cols}\n</div>`;
      })
      .join('\n')}\n`;
  } else {
    for (const word of p.layout ?? []) blocks += `${bandsOf(word)}\n`;
  }
  const modals = (p.modals ?? []).map((mo) => renderModal(mo)).join('\n');
  // 角色视角联动：页面卡带其菜单归属角色（data-roles），JS 按角色淡出不可见页面
  const own = ctx.pageOwnership?.get(p.id);
  const attrs = own ? ` data-menu="${esc(own.menuId)}"${own.roleIds ? ` data-roles="${esc(own.roleIds)}"` : ''}` : '';
  return `<section class="wf-page" id="page-${esc(p.id)}"${attrs}>
<header class="wf-page-head"><h2>${esc(p.title ?? p.id)}</h2><span class="tid">${esc(p.id)}</span>${p.menu ? `<span class="tid">${esc(p.menu)}</span>` : ''}${pend(p)}</header>
${blocks}${modals}
</section>`;
}

/** 布局区块分发：table/form 特化，其余按通用灰盒渲染。 */
function renderBlock(word, comp, ctx) {
  if (word === 'table') return renderTable(comp, ctx);
  if (word === 'form') return renderForm(comp);
  if (word === 'pagination') {
    return `<div class="wf-block wf-pagination"><span class="wf-tag">pagination</span><span class="wf-pg">«</span><span class="wf-pg">1</span><span class="wf-pg">2</span><span class="wf-pg">3</span><span class="wf-pg">…</span><span class="wf-pg">»</span></div>`;
  }
  // toolbar / search / cards / tabs（及词表外兜底）：灰盒虚线 + 项目占位
  const items = (comp.items ?? []).map((it) => renderItem(it)).join('\n');
  const ghost = items === '' ? '<div class="wf-ph-lg"></div>' : '';
  const cls = BLOCK_WORDS.has(word) ? ` wf-${word}` : '';
  return `<div class="wf-block${cls}"><span class="wf-tag">${esc(word)}</span><div class="wf-row">
${items}${ghost}
</div></div>`;
}

/** 组件占位符：input=带 label 虚线盒；select=虚线盒列出选项；button=方框标签；其余=label+灰条。 */
function renderItem(it) {
  const type = String(it.type ?? 'text');
  if (type === 'button') return renderAction(it);
  const label = esc(it.label ?? type);
  const mark = pend(it);
  if (type === 'input') {
    return `<label class="wf-field"><span class="wf-label">${label}${mark}</span><span class="wf-input">${label}…</span></label>`;
  }
  if (type === 'select') {
    const opts = Array.isArray(it.options) && it.options.length ? it.options.map((o) => esc(o)).join(' / ') : '选项';
    return `<label class="wf-field"><span class="wf-label">${label}${mark}</span><span class="wf-input">${opts} ▾</span></label>`;
  }
  return `<label class="wf-field"><span class="wf-label">${label}${mark}</span><span class="wf-ph"></span></label>`;
}

/** 交互三种：nav→锚点跳转；modal→data-modal 按钮；api→按钮+接口徽标。 */
function renderAction(a) {
  const label = `${esc(a.label ?? a.type ?? '按钮')}${pend(a)}`;
  if (a.action === 'nav' && a.target) {
    return `<a class="wf-btn" href="#page-${esc(a.target)}">${label} →</a>`;
  }
  if (a.action === 'modal' && a.target) {
    return `<button type="button" class="wf-btn" data-modal="${esc(a.target)}">${label}</button>`;
  }
  if (a.action === 'api' && a.api) {
    const key = normApiKey(a.api);
    return `<button type="button" class="wf-btn" title="${esc(key)}">${label}<span class="wf-api" title="${esc(key)}">API</span></button>`;
  }
  return `<button type="button" class="wf-btn">${label}</button>`;
}

/** 表格：真实列头（取契约 response 字段 name+desc）+ 2 行灰占位；契约缺失该 api → 列头警示。 */
function renderTable(comp, ctx) {
  const key = comp.api ? normApiKey(comp.api) : null;
  const contract = key ? ctx.contractByKey.get(key) : undefined;
  const fields =
    contract && Array.isArray(contract.response) && contract.response.length > 0 ? contract.response : null;
  const head = fields
    ? fields
        .map((f) => `<th>${esc(f.name)}${f.desc ? `<i class="wf-desc">${esc(f.desc)}</i>` : ''}</th>`)
        .join('')
    : '<th class="wf-missing">⚠️ 契约缺失</th>';
  const rowActions = Array.isArray(comp.rowActions) ? comp.rowActions : [];
  const opsHead = rowActions.length ? '<th>操作</th>' : '';
  const opsCell = rowActions.length
    ? `<td class="wf-ops">${rowActions.map((ra) => renderAction(ra)).join('')}</td>`
    : '';
  const cols = fields ? fields.length : 1;
  const phRow = `<tr>${'<td><span class="wf-ph"></span></td>'.repeat(cols)}${opsCell}</tr>`;
  // 列头多或行操作多时表格自然宽度会超出所在列（分栏页尤其明显），
  // 故套一层横向滚动容器——不能直接给 .wf-block 加 overflow，那会裁掉浮在上边框的 wf-tag。
  return `<div class="wf-block wf-table"><span class="wf-tag">table</span>${key ? apiBadge(key) : ''}
<div class="wf-tw"><table><thead><tr>${head}${opsHead}</tr></thead><tbody>
${phRow}
${phRow}
</tbody></table></div></div>`;
}

/** 表单区块：items 逐项占位 + 数据源接口徽标。 */
function renderForm(comp) {
  const items = (comp.items ?? []).map((it) => renderItem(it)).join('\n');
  return `<div class="wf-block wf-form"><span class="wf-tag">form</span>${comp.api ? apiBadge(comp.api) : ''}<div class="wf-row">
${items}
</div></div>`;
}

/** 弹窗卡：默认 hidden，data-modal 按钮触发显示；noscript 样式使其平铺可见。 */
function renderModal(mo) {
  const fields = (mo.fields ?? [])
    .map(
      (fd) =>
        `<label class="wf-field"><span class="wf-label">${esc(fd.label ?? fd.field)}${fd.required ? '<b class="wf-req">*</b>' : ''}${pend(fd)}</span><span class="wf-input">${esc(fd.type ?? 'input')}</span></label>`,
    )
    .join('\n');
  return `<div class="wf-modal" id="${esc(mo.id)}" hidden>
<div class="wf-modal-head"><strong>${esc(mo.title ?? mo.id)}</strong><span class="tid">${esc(mo.id)}</span>${pend(mo)}<button type="button" class="wf-close" data-modal-close>×</button></div>
<div class="wf-modal-body">
${fields}
</div>
<div class="wf-modal-foot">${mo.submit?.api ? apiBadge(mo.submit.api) : ''}<button type="button" class="wf-btn">提交</button><button type="button" class="wf-btn" data-modal-close>取消</button></div>
</div>`;
}
