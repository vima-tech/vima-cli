// 人类审计视图渲染器（admin 模板资产；设计 §13.2，契约 §11）
// 四视图：① 角色权限矩阵 ② 菜单功能点 ③ 业务流程泳道 ④ 页面 UI 详情。
// 铁律：确定性渲染——禁 Date/Math.random；所有数据经 escapeHtml；同一输入字节一致；
//       输出串末尾单个换行；单文件零外部请求（href 仅 # 锚点）；禁 JS 完整可读（本渲染器不产出 JS）。
import { readFileSync } from 'node:fs';

// 骨架 + 全部内联 CSS 由同目录 review.template.html 提供（{{TITLE}}/{{CONTENT}} 占位替换）
const TEMPLATE = readFileSync(new URL('./review.template.html', import.meta.url), 'utf8');

/** HTML 转义：渲染器内所有数据出口必须经过它。 */
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 接口唯一键：`${METHOD} ${path}`（method 统一大写，与 lib/model/contracts.apiKey 同构）。 */
function normApiKey(s) {
  const str = String(s ?? '').trim();
  const i = str.indexOf(' ');
  if (i < 0) return str.toUpperCase();
  return `${str.slice(0, i).toUpperCase()} ${str.slice(i + 1).trim()}`;
}

/** 接口徽标（title 属性带 METHOD /path）；契约中不存在的接口染警示色。 */
function apiBadge(api, contractByKey) {
  const key = normApiKey(api);
  const known = contractByKey.has(key);
  return `<code class="api${known ? '' : ' api-missing'}" title="${esc(key)}">${esc(key)}${known ? '' : ' ⚠️'}</code>`;
}

/** pendingConfirm 徽标（§13.1 信息源分级的人眼投影，契约 §11）。 */
function pend(o) {
  return o && typeof o === 'object' && o.pendingConfirm === true
    ? '<span class="pend" title="AI 推断项，待用户确认——vima approve 会在其清零前阻断">⚠️ 待确认</span>'
    : '';
}

/**
 * 收集 spec 全部 pendingConfirm: true 条目（供「待确认清单」区渲染）。
 * 深度遍历 entities/enums/pages/roles/menus/flows；条目自带稳定 ID 时用 ID 作定位（可锚点跳转）。
 */
function collectPending(spec) {
  const out = [];
  const walk = (value, label, anchor) => {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) walk(value[i], `${label}[${i}]`, anchor);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    const hasId = typeof value.id === 'string' && value.id !== '';
    const here = hasId ? value.id : label;
    const hereAnchor = hasId ? value.id : anchor;
    if (value.pendingConfirm === true) {
      const hint = typeof value.title === 'string' ? value.title : typeof value.name === 'string' ? value.name : typeof value.label === 'string' ? value.label : '';
      out.push({ where: here, anchor: hereAnchor, hint });
    }
    for (const [k, v] of Object.entries(value)) {
      if (k === 'pendingConfirm') continue;
      walk(v, `${here}.${k}`, hereAnchor);
    }
  };
  walk(spec.entities ?? [], 'entities', null);
  walk(spec.enums ?? [], 'enums', null);
  for (const page of spec.pages instanceof Map ? spec.pages.values() : []) walk(page, 'page', null);
  walk(spec.roles ?? [], 'roles', null);
  walk(spec.menus ?? [], 'menus', null);
  walk(spec.flows ?? [], 'flows', null);
  return out;
}

/**
 * 渲染人类审计视图。
 * @param {{projectName: string, spec: object, contracts: Array}} model
 * @returns {string} 单文件 HTML（末尾单个换行）
 */
export function renderReview(model) {
  const { projectName, spec, contracts } = model;
  const pages = [...spec.pages.keys()].sort().map((id) => spec.pages.get(id));
  const roles = spec.roles ?? [];
  const menus = spec.menus ?? [];
  const flows = spec.flows ?? [];

  // 契约索引：接口键 → { ...api, module, file }
  const contractByKey = new Map();
  for (const c of contracts ?? []) {
    for (const a of c.apis ?? []) {
      contractByKey.set(normApiKey(`${a.method} ${a.path}`), { ...a, module: c.module, file: c.file });
    }
  }

  // ── 交叉引用小件：全部 ID 带锚点互链 ──
  const menuById = new Map(menus.map((m) => [m.id, m]));
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const pageTitle = (id) => spec.pages.get(id)?.title ?? id;
  const pageLink = (id) =>
    spec.pages.has(id)
      ? `<a class="xref" href="#${esc(id)}">${esc(pageTitle(id))}<span class="tid">${esc(id)}</span></a>`
      : `<span class="tid">${esc(id)}</span>`;
  const menuLink = (id) =>
    menuById.has(id)
      ? `<a class="xref" href="#${esc(id)}">${esc(menuById.get(id).name)}<span class="tid">${esc(id)}</span></a>`
      : `<span class="tid">${esc(id)}</span>`;
  const roleLink = (id) =>
    roleById.has(id)
      ? `<a class="xref" href="#${esc(id)}">${esc(roleById.get(id).name)}<span class="tid">${esc(id)}</span></a>`
      : `<span class="tid">${esc(id)}</span>`;

  // ── 待确认条目（§13.1 pendingConfirm 的人眼投影）──
  const pending = collectPending(spec);

  // ── 封面 ──
  const stats = [
    [roles.length, '角色'],
    [menus.length, '菜单'],
    [pages.length, '页面'],
    [flows.length, '流程'],
    [pending.length, '待确认'],
  ];
  const hero = `<header class="hero">
<p class="kicker">VIMA 审计视图 · 人机对齐产物</p>
<h1>${esc(projectName)}</h1>
<p class="sub">本页面由 <code>docs/spec.md</code> 的结构化数据块确定性渲染，供人类审核规格完整性
（权限 / 功能点 / 流程 / 页面粒度）。请勿手工修改本文件——修改 spec 后重新执行 <code>vima render-review</code>。</p>
<div class="stats">${stats.map(([n, l]) => `<div class="stat${l === '待确认' && n > 0 ? ' stat-warn' : ''}"><div class="n">${esc(n)}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
</header>`;

  // ── 审核指引（读者=拍板人，§13.2；固定文案，契约 §11）──
  const guide = `<section class="guide" id="guide">
<h2>如何审核本规格</h2>
<ol>
<li><strong>① 角色权限矩阵</strong>——逐行核对：每个角色该有的菜单有没有多、有没有漏？高亮行是权限盲区。</li>
<li><strong>② 菜单功能点</strong>——对着你的原始需求过一遍：每个菜单要做的事都列上了吗？没提过的功能是不是被 AI 加戏了？</li>
<li><strong>③ 业务流程泳道</strong>——把每条流程从头走一遍：角色、入口页面、动作、接口、去向，与实际业务一致吗？</li>
<li><strong>④ 页面 UI 详情</strong>——配合线框原型（docs/review/prototype.html，可按角色视角切换）逐页体验布局、字段与交互。</li>
</ol>
<p class="guide-act">发现任何不符：<strong>不要在文档外口头拍板</strong>——告诉 Agent 修改 docs/spec.md 对应数据块，
重跑 <code>vima validate</code> 与 <code>vima render-review</code> / <code>vima render-prototype</code> 后再看本页。
全部确认无误后运行 <code>vima approve</code> 进入开发。</p>
</section>`;

  // ── 待确认清单（有条目才渲染整段）──
  const pendingList = pending.length === 0 ? '' : `<section class="view pending" id="view-pending">
<h2><span class="num">⚠️</span>待确认清单（AI 推断项，共 ${esc(pending.length)} 处）</h2>
<p class="vd">以下条目由 Agent 依据经验推断、尚未获你确认（信息源分级 §13.1）。请逐条核对——确认无误让 Agent 移除标记，有误让 Agent 改 spec；<strong>清零前 vima approve 会阻断进入开发</strong>。</p>
<ul>
${pending.map((p) => `<li>${p.anchor ? `<a class="xref" href="#${esc(p.anchor)}">${esc(p.where)}</a>` : `<code>${esc(p.where)}</code>`}${p.hint ? `<span class="dim">（${esc(p.hint)}）</span>` : ''}</li>`).join('\n')}
</ul>
</section>`;

  // ── 顶部目录 ──
  const toc = `<nav class="toc" aria-label="目录">
${pending.length > 0 ? '<a class="toc-warn" href="#view-pending">⚠️ 待确认</a>\n' : ''}<a href="#view-roles">① 角色权限矩阵</a>
<a href="#view-menus">② 菜单功能点</a>
<a href="#view-flows">③ 业务流程泳道</a>
<a href="#view-pages">④ 页面 UI 详情</a>
<span class="toc-sep">页面：</span>${pages.map((p) => `<a href="#${esc(p.id)}">${esc(p.title ?? p.id)}</a>`).join('\n')}
</nav>`;

  // ── ① 角色权限矩阵：角色 × 菜单；无角色覆盖的菜单整行高亮 ──
  const roleHead = roles
    .map((r) => `<th id="${esc(r.id)}">${esc(r.name)}<span class="tid">${esc(r.id)}</span></th>`)
    .join('');
  const matrixRows = menus
    .map((m) => {
      const blind = !roles.some((r) => (r.menus ?? []).includes(m.id));
      const cells = roles
        .map((r) => `<td class="c">${(r.menus ?? []).includes(m.id) ? '✅' : '<span class="dim">—</span>'}</td>`)
        .join('');
      const tag = blind ? '<span class="blind-tag">⚠️ 权限盲区（已声明 uncovered）</span>' : '';
      return `<tr${blind ? ' class="blind"' : ''}><td>${menuLink(m.id)}${tag}</td>${cells}</tr>`;
    })
    .join('\n');
  const viewRoles = `<section class="view" id="view-roles">
<h2><span class="num">①</span>角色权限矩阵</h2>
<p class="vd">共 ${esc(roles.length)} 种角色 × ${esc(menus.length)} 个菜单。✅ = 该角色拥有该菜单权限；无任何角色覆盖的菜单整行高亮为权限盲区。</p>
<div class="tw"><table>
<thead><tr><th>菜单</th>${roleHead}</tr></thead>
<tbody>
${matrixRows}
</tbody></table></div>
</section>`;

  // ── ② 菜单功能点：菜单 → 功能点 → 接口徽标 ──
  const menuCards = menus
    .map((m) => {
      const feats = (m.features ?? [])
        .map((f) => `<tr><td>${esc(f.name)}${pend(f)}</td><td>${apiBadge(f.api, contractByKey)}</td></tr>`)
        .join('\n');
      return `<article class="card" id="${esc(m.id)}">
<h3>${esc(m.name)}<span class="tid">${esc(m.id)}</span>${pend(m)}</h3>
<p class="meta">承载页面：${pageLink(m.page)}${m.uncovered ? '<span class="blind-tag">⚠️ 权限盲区（已声明 uncovered）</span>' : ''}</p>
${feats ? `<div class="tw"><table><thead><tr><th>功能点</th><th>接口</th></tr></thead><tbody>\n${feats}\n</tbody></table></div>` : '<p class="dim">（未声明功能点）</p>'}
</article>`;
    })
    .join('\n');
  const viewMenus = `<section class="view" id="view-menus">
<h2><span class="num">②</span>菜单功能点</h2>
<p class="vd">每个菜单实现哪些功能点、各挂在哪个接口上——逐条核对是否与原始需求一致。</p>
${menuCards}
</section>`;

  // ── ③ 业务流程泳道：每条 flow 一节，步骤 角色→页面→动作→接口→next ──
  const flowCards = flows
    .map((f) => {
      const steps = (f.steps ?? [])
        .map(
          (s) => `<li><span class="lane-role">${roleLink(s.role)}</span><span class="lane-arrow">→</span>${pageLink(s.page)}<span class="lane-action">${esc(s.action)}</span>${s.api ? apiBadge(s.api, contractByKey) : ''}${s.next ? `<span class="lane-arrow">→</span>${pageLink(s.next)}` : ''}</li>`,
        )
        .join('\n');
      return `<article class="card" id="${esc(f.id)}">
<h3>${esc(f.name)}<span class="tid">${esc(f.id)}</span>${pend(f)}</h3>
<ol class="lane">
${steps}
</ol>
</article>`;
    })
    .join('\n');
  const viewFlows = `<section class="view" id="view-flows">
<h2><span class="num">③</span>业务流程泳道</h2>
<p class="vd">每条核心流程一条泳道：哪个角色从哪个页面进入 → 做什么动作 → 触发哪个接口 → 跳转到哪。页面名可点击跳转到页面详情。</p>
${flowCards}
</section>`;

  // ── ④ 页面 UI 详情：每页一卡 ──
  const pageCards = pages.map((p) => renderPageCard(p, { contractByKey, menuLink, pageLink })).join('\n');
  const viewPages = `<section class="view" id="view-pages">
<h2><span class="num">④</span>页面 UI 详情</h2>
<p class="vd">每页一张卡：布局区块序列 / 组件清单 / 交互列表 / 接口映射 / 弹窗定义——细致到程序员可直接实现的精度。布局与交互手感请配合线框原型（docs/review/prototype.html）体验。</p>
${pageCards}
</section>`;

  const foot = `<footer class="foot">本审计视图为单文件自包含产物：零外部请求、不含 JS、无时间戳，同一份 spec 渲染字节一致（<code>vima render-review --check</code> 可验漂移）。<br>
真源：<code>docs/spec.md</code> · 角色 ${esc(roles.length)} · 菜单 ${esc(menus.length)} · 页面 ${esc(pages.length)} · 流程 ${esc(flows.length)}</footer>`;

  const content = [hero, guide, toc, ...(pendingList ? [pendingList] : []), viewRoles, viewMenus, viewFlows, viewPages, foot].join('\n');
  const title = `${projectName} · 审计视图`;
  const html = TEMPLATE.split('{{TITLE}}').join(esc(title)).split('{{CONTENT}}').join(content);
  return html.replace(/\n*$/, '\n');
}

/** ④ 中的单页卡片：布局区块序列 + 组件清单表 + 交互列表 + 接口映射 + 弹窗卡。 */
function renderPageCard(p, { contractByKey, menuLink, pageLink }) {
  const modalTitleById = new Map((p.modals ?? []).map((mo) => [mo.id, mo.title]));
  const modalLink = (id) =>
    `<a class="xref" href="#${esc(id)}">${esc(modalTitleById.get(id) ?? id)}<span class="tid">${esc(id)}</span></a>`;

  // 交互描述：三种交互（nav/modal/api）
  const describe = (it) => {
    if (it.action === 'nav') return `跳转 ${pageLink(it.target)}`;
    if (it.action === 'modal') return `打开弹窗 ${modalLink(it.target)}`;
    if (it.action === 'api') return `调用 ${apiBadge(it.api, contractByKey)}`;
    return '<span class="dim">—</span>';
  };

  // 布局区块序列
  const chips = (p.layout ?? [])
    .map((b) => `<span class="chip">${esc(b)}</span>`)
    .join('<span class="chip-arrow">→</span>');

  // 组件清单表：区块 / 组件 / 标签 / 交互
  const compRows = [];
  for (const comp of p.components ?? []) {
    if (comp.api) {
      compRows.push(
        `<tr><td><code>${esc(comp.block)}</code></td><td>数据源</td><td><span class="dim">—</span></td><td>${apiBadge(comp.api, contractByKey)}</td></tr>`,
      );
    }
    for (const it of comp.items ?? []) {
      compRows.push(
        `<tr><td><code>${esc(comp.block)}</code></td><td>${esc(it.type ?? '—')}</td><td>${esc(it.label ?? '—')}${pend(it)}</td><td>${it.action ? describe(it) : '<span class="dim">—</span>'}</td></tr>`,
      );
    }
    for (const ra of comp.rowActions ?? []) {
      compRows.push(
        `<tr><td><code>${esc(comp.block)}</code> · 行内</td><td>rowAction</td><td>${esc(ra.label ?? '—')}</td><td>${describe(ra)}</td></tr>`,
      );
    }
  }

  // 交互列表（把散在各区块里的交互拉平，人一眼看全）
  const interactions = [];
  for (const comp of p.components ?? []) {
    for (const it of comp.items ?? []) {
      if (it.action) interactions.push(`<li>「${esc(it.label ?? it.type)}」 → ${describe(it)}</li>`);
    }
    for (const ra of comp.rowActions ?? []) {
      interactions.push(`<li>「${esc(ra.label ?? '行内操作')}」（表格行内） → ${describe(ra)}</li>`);
    }
  }
  for (const mo of p.modals ?? []) {
    if (mo.submit?.api) {
      interactions.push(`<li>弹窗 ${modalLink(mo.id)} 提交 → 调用 ${apiBadge(mo.submit.api, contractByKey)}</li>`);
    }
  }

  // 接口映射
  const apiItems = (p.apis ?? [])
    .map((a) => {
      const c = contractByKey.get(normApiKey(a));
      return `<li>${apiBadge(a, contractByKey)} ${c ? `<span class="dim">契约：${esc(c.module ?? '')}（${esc(c.file)}）</span>` : '<span class="warn">⚠️ 契约缺失：未在任何契约数据块中定义</span>'}</li>`;
    })
    .join('\n');

  // 弹窗卡
  const modalCards = (p.modals ?? [])
    .map((mo) => {
      const fieldRows = (mo.fields ?? [])
        .map(
          (fd) => `<tr><td><code>${esc(fd.field)}</code></td><td>${esc(fd.label ?? '—')}${pend(fd)}</td><td>${esc(fd.type ?? '—')}</td><td>${fd.required ? '是' : '否'}</td></tr>`,
        )
        .join('\n');
      return `<div class="modal-card" id="${esc(mo.id)}">
<h4>弹窗 · ${esc(mo.title ?? mo.id)}<span class="tid">${esc(mo.id)}</span>${pend(mo)}</h4>
<div class="tw"><table><thead><tr><th>字段</th><th>标签</th><th>类型</th><th>必填</th></tr></thead><tbody>
${fieldRows}
</tbody></table></div>
${mo.submit?.api ? `<p class="meta">提交接口：${apiBadge(mo.submit.api, contractByKey)}</p>` : ''}
</div>`;
    })
    .join('\n');

  return `<article class="page-card" id="${esc(p.id)}">
<h3>${esc(p.title ?? p.id)}<span class="tid">${esc(p.id)}</span>${pend(p)}</h3>
<p class="meta">所属菜单：${p.menu ? menuLink(p.menu) : '<span class="dim">—</span>'}</p>
<h4>布局区块序列</h4>
<div class="chips">${chips}</div>
<h4>组件清单</h4>
<div class="tw"><table><thead><tr><th>区块</th><th>组件</th><th>标签</th><th>数据 / 交互</th></tr></thead><tbody>
${compRows.join('\n')}
</tbody></table></div>
<h4>交互列表</h4>
${interactions.length ? `<ul>\n${interactions.join('\n')}\n</ul>` : '<p class="dim">（本页无交互声明）</p>'}
<h4>接口映射</h4>
<ul>
${apiItems}
</ul>
${modalCards ? `<h4>弹窗</h4>\n${modalCards}` : ''}
</article>`;
}
