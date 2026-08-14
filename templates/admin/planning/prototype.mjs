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

// 已实现特化/样式渲染的区块词全集（合法性校验在 validate 按 kinds 配置执行，A16；
// 此表只决定 wf-<word> 样式类与渲染分发，含 admin-web 7 词 + mp-native 新词）
const BLOCK_WORDS = new Set([
  'toolbar', 'search', 'table', 'form', 'cards', 'tabs', 'pagination',
  'list', 'banner', 'detail', 'actionbar',
  'steps', 'collapse', 'anchor', // A27：sustain-v3 实测缺的三个结构词
]);

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
 * A27 设计注记：实例名 + intent + 密度徽标（PDL 的人眼投影——评审评的就是这行）。
 * 未声明任何设计键时返回空串，产物与 A27 前逐字节一致。
 */
function designAnnot(comp) {
  if (!comp || typeof comp !== 'object') return '';
  const parts = [];
  if (typeof comp.name === 'string' && comp.name !== '') parts.push(`<b>${esc(comp.name)}</b>`);
  if (typeof comp.intent === 'string' && comp.intent !== '') parts.push(`<i>${esc(comp.intent)}</i>`);
  if (typeof comp.density === 'string' && comp.density !== '') parts.push(`<span class="wf-density">${esc(comp.density)}</span>`);
  return parts.length ? `<div class="wf-annot">${parts.join('')}</div>` : '';
}

/**
 * A27 动作集渲染（items 按钮 / actions / rowActions 三处共用）：
 * priority=primary 实心强调；overflow 收进「⋯」（title 列出被收纳动作，人审看得见收了什么）。
 */
function renderActionSet(list) {
  const entries = (Array.isArray(list) ? list : []).filter((a) => a && typeof a === 'object');
  const visible = entries.filter((a) => a.priority !== 'overflow');
  const folded = entries.filter((a) => a.priority === 'overflow');
  const more = folded.length
    ? `<span class="wf-more" title="收纳动作：${esc(folded.map((a) => a.label ?? '').join('、'))}">⋯ ${folded.length}</span>`
    : '';
  return `${visible.map((a) => renderAction(a)).join('')}${more}`;
}

/** A27 操作附着点：actions[] 贴在块标题行，不新起横带（S5 的解法在渲染层的样子）。 */
function attachedActions(comp) {
  const actions = Array.isArray(comp?.actions) ? comp.actions : [];
  return actions.length ? `<div class="wf-actions">${renderActionSet(actions)}</div>` : '';
}

/**
 * A27 内容形态渲染（data.shape 驱动）：保真度来自 PDL 数据而非渲染器内置——
 * 这是「三列三个一样灰盒」的解法。未声明 shape 返回 null（走原灰盒路径）。
 */
function shapeBody(comp) {
  const data = comp && typeof comp === 'object' && comp.data && typeof comp.data === 'object' ? comp.data : null;
  const shape = data ? data.shape : undefined;
  if (typeof shape !== 'string') return null;
  const kf = Array.isArray(data.keyFields) ? data.keyFields : [];
  const of = Array.isArray(data.of) ? data.of : typeof data.of === 'string' && data.of !== '' ? [data.of] : [];
  if (shape === 'list') {
    const cells = kf.length
      ? kf.map((f) => `<span class="wf-kf">${esc(f)}</span>`).join('')
      : '<span class="wf-ph"></span><span class="wf-ph wf-ph-short"></span>';
    const row = `<div class="wf-cell"><span class="wf-cell-thumb"></span><span class="wf-cell-lines">${cells}</span></div>`;
    return `${row}\n${row}\n${row}`;
  }
  if (shape === 'record') {
    const fields = kf.length ? kf : of.length ? of : ['字段'];
    return fields.map((f) => `<div class="wf-kv"><span class="wf-label">${esc(f)}</span><span class="wf-ph"></span></div>`).join('\n');
  }
  if (shape === 'metrics') {
    const names = of.length ? of : kf.length ? kf : ['指标一', '指标二', '指标三'];
    return `<div class="wf-metrics">${names
      .map((n) => `<div class="wf-metric"><span class="wf-ring"></span><span class="wf-label">${esc(n)}</span></div>`)
      .join('')}</div>`;
  }
  if (shape === 'timeline') {
    const names = of.length ? of : kf.length ? kf : ['节点', '节点', '节点'];
    return `<ol class="wf-timeline">${names.map((n) => `<li>${esc(n)}</li>`).join('')}</ol>`;
  }
  if (shape === 'chart') {
    const label = of.length ? of.join(' / ') : '图表';
    return `<div class="wf-chart" title="${esc(label)}"><svg viewBox="0 0 120 40" aria-hidden="true"><polyline points="0,32 20,24 40,28 60,12 80,18 100,6 120,14" fill="none" stroke="currentColor" stroke-width="2"/></svg><span class="wf-label">${esc(label)}</span></div>`;
  }
  if (shape === 'freeform') {
    return `<div class="wf-freeform"><span class="wf-freeform-mark">自由发挥区</span>${esc(comp.intent ?? '')}</div>`;
  }
  return null;
}

/**
 * 渲染线框原型。
 * @param {{projectName: string, spec: object, contracts: Array}} model
 * @returns {{html: string, manifest: object}} html 末尾单个换行；manifest 为 §6.7 结构（对象，落盘由命令层 stableStringify）
 */
export function renderPrototype(model) {
  const { projectName, spec, contracts, apps = null, app = null } = model;
  // A16 端归属（模板资产自足实现，与 lib/model/apps.mjs appOf 同口径：声明优先，单端 = 唯一端）
  const appIdOf = (entry) => {
    if (entry && typeof entry.app === 'string' && entry.app !== '') return entry.app;
    return apps && apps.apps?.length === 1 ? apps.apps[0].id : null;
  };
  const multi = Boolean(apps?.multi);
  const appEntry = app !== null && apps ? apps.apps.find((x) => x.id === app) ?? null : null;
  const shell = (appEntry && apps.kinds?.[appEntry.kind]?.shell) || 'desktop-admin';
  const appLabel = multi && appEntry ? `${appEntry.name ?? appEntry.id}` : null;

  const allPages = [...spec.pages.keys()].sort().map((id) => spec.pages.get(id)); // pages 按 id 排序（字节稳定）
  const pages = app === null ? allPages : allPages.filter((p) => appIdOf(p) === app); // A16：只渲染本端页面

  // 契约索引：接口键 → api 定义
  const contractByKey = new Map();
  for (const c of contracts ?? []) {
    for (const a of c.apis ?? []) contractByKey.set(normApiKey(`${a.method} ${a.path}`), a);
  }

  // ── 外壳数据：菜单树 + 角色归属（契约 §11；A16 多端时菜单/角色按端过滤）──
  const menusAll = Array.isArray(spec.menus) ? spec.menus : [];
  const menus = app === null ? menusAll : menusAll.filter((m) => appIdOf(m) === app);
  const menuIdSet = new Set(menus.map((m) => m.id));
  const rolesAll = Array.isArray(spec.roles) ? spec.roles : [];
  const roles =
    app === null ? rolesAll : rolesAll.filter((r) => (Array.isArray(r.menus) ? r.menus : []).some((mid) => menuIdSet.has(mid)));
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

  // A16 外壳按 kind：desktop-admin = 桌面侧栏（现状）；phone-tabbar = 375px 手机框 + 底部 tabbar
  let content;
  if (shell === 'phone-tabbar') {
    const tabbar = `<nav class="wf-tabbar">
${menus.map((m) => {
    const target = typeof m.page === 'string' && spec.pages.has(m.page) ? `#page-${esc(m.page)}` : '#';
    return `<a class="wf-tab" href="${target}"><span class="wf-tab-name">${esc(m.name ?? m.id)}${pend(m)}</span><span class="tid">${esc(m.id)}</span></a>`;
  }).join('\n')}
</nav>`;
    const headMp = `<header class="wf-head">
<h1>${esc(projectName)}${appLabel ? ` · ${esc(appLabel)}` : ''} · 线框原型</h1>
<p>移动端语义占位线框（kind mp-native）：手机框仅表达形态，底部 tabbar 即本端 <code>vima:menus</code>。
由 <code>docs/spec.md</code> 页面数据块确定性渲染——修改 spec 后重新执行 <code>vima render-prototype</code>。
带「⚠️ 待确认」的条目是 AI 推断项，请重点核对。</p>
</header>`;
    content = [
      '<main class="wf-main wf-main-mp">', headMp,
      '<div class="wf-phone">', '<div class="wf-phone-screen">', sections, '</div>', tabbar, '</div>',
      ...(flows ? [flows] : []), foot, '</main>',
    ].join('\n');
  } else {
    content = [aside, '<main class="wf-main">', head, sections, ...(flows ? [flows] : []), foot, '</main>'].join('\n');
  }
  const title = `${projectName}${appLabel ? ` · ${appLabel}` : ''} · 线框原型`;
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
    const key = `${kind}\u0000${to}`;
    if (!seen.has(key)) seen.set(key, { kind, from: p.id, to });
  };
  const addAction = (it) => {
    if (it.action === 'nav' || it.action === 'modal') add(it.action, it.target);
    else if (it.action === 'api') add('api', it.api);
  };
  for (const comp of p.components ?? []) {
    if (typeof comp.api === 'string') add('api', comp.api);
    for (const it of comp.items ?? []) addAction(it);
    for (const ac of comp.actions ?? []) addAction(ac); // A27 附着点动作同样进连线
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
            const primary = col?.role === 'primary'; // A27：视觉主次
            const colDensity = typeof col?.density === 'string' && col.density !== '' ? `<span class="wf-density">${esc(col.density)}</span>` : '';
            const cap = `<div class="wf-col-cap"><span>${primary ? '<b class="wf-col-primary" title="主工作区">★</b>' : ''}${esc(col?.name ?? '')}</span>${colDensity}<span class="wf-col-w">${esc(width)}</span></div>`;
            return `<div class="wf-col${primary ? ' wf-col-p' : ''}" style="flex:${esc(flexOf(width))}">\n${cap}\n${inner}\n</div>`;
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
  // A27：design 声明的人眼投影（pattern/density 徽标 + 首屏承诺清单）
  const d = p.design && typeof p.design === 'object' ? p.design : null;
  const designBadges = d
    ? `<span class="wf-design">${esc(d.pattern ?? '')}</span><span class="wf-design">${esc(d.density ?? '')}</span>${Array.isArray(d.fold) && d.fold.length ? `<span class="wf-fold" title="首屏承诺：一屏必须看到">首屏 ${d.fold.map((f) => esc(f)).join('、')}</span>` : ''}`
    : '';
  return `<section class="wf-page" id="page-${esc(p.id)}"${attrs}>
<header class="wf-page-head"><h2>${esc(p.title ?? p.id)}</h2><span class="tid">${esc(p.id)}</span>${p.menu ? `<span class="tid">${esc(p.menu)}</span>` : ''}${designBadges}${pend(p)}</header>
${blocks}${modals}
</section>`;
}

/** 布局区块分发：table/form/list/detail/steps/collapse/anchor 特化，其余通用（A16/A27）。 */
function renderBlock(word, comp, ctx) {
  if (word === 'table') return renderTable(comp, ctx);
  if (word === 'form') return renderForm(comp);
  if (word === 'list') return renderList(comp);
  if (word === 'detail') return renderDetail(comp, ctx);
  const deco = `${designAnnot(comp)}${attachedActions(comp)}`; // A27：注记 + 附着动作
  if (word === 'pagination') {
    return `<div class="wf-block wf-pagination"><span class="wf-tag">pagination</span>${deco}<span class="wf-pg">«</span><span class="wf-pg">1</span><span class="wf-pg">2</span><span class="wf-pg">3</span><span class="wf-pg">…</span><span class="wf-pg">»</span></div>`;
  }
  // A27 新词三个（sustain-v3 实测缺口）：步骤条 / 折叠面板 / 锚点条——items 给标签则用之
  if (word === 'steps') {
    const names = (comp.items ?? []).map((it) => esc(it?.label ?? '')).filter(Boolean);
    const li = (names.length ? names : ['步骤一', '步骤二', '步骤三']).map((n, i) => `<li${i === 0 ? ' class="wf-step-on"' : ''}>${n}</li>`).join('');
    return `<div class="wf-block wf-steps-block"><span class="wf-tag">steps</span>${deco}<ol class="wf-steps">${li}</ol></div>`;
  }
  if (word === 'collapse') {
    const names = (comp.items ?? []).map((it) => esc(it?.label ?? '')).filter(Boolean);
    const panels = (names.length ? names : ['面板一', '面板二']).map((n, i) => `<details class="wf-collapse-item"${i === 0 ? ' open' : ''}><summary>${n}</summary><div class="wf-ph-lg"></div></details>`).join('\n');
    return `<div class="wf-block wf-collapse-block"><span class="wf-tag">collapse</span>${deco}
${panels}
</div>`;
  }
  if (word === 'anchor') {
    const names = (comp.items ?? []).map((it) => esc(it?.label ?? '')).filter(Boolean);
    const chips = (names.length ? names : ['分区一', '分区二', '分区三']).map((n) => `<span class="wf-chip">${n}</span>`).join('');
    return `<div class="wf-block wf-anchor-block"><span class="wf-tag">anchor</span>${deco}<nav class="wf-anchor">${chips}</nav></div>`;
  }
  // toolbar / search / cards / tabs / banner / actionbar（及词表外兜底）：
  // A27 优先按 data.shape 渲染内容形态；无 shape 时 items 占位 / 灰盒（与 A27 前一致）
  const items = (comp.items ?? []).map((it) => renderItem(it)).join('\n');
  const shaped = shapeBody(comp);
  const body = shaped !== null
    ? `${items === '' ? '' : `<div class="wf-row">\n${items}\n</div>\n`}${shaped}`
    : `<div class="wf-row">\n${items}${items === '' ? '<div class="wf-ph-lg"></div>' : ''}\n</div>`;
  const cls = BLOCK_WORDS.has(word) ? ` wf-${word}` : '';
  return `<div class="wf-block${cls}"><span class="wf-tag">${esc(word)}</span>${deco}${comp.api && shaped !== null ? apiBadge(comp.api) : ''}
${body}
</div>`;
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

/** 交互三种：nav→锚点跳转；modal→data-modal 按钮；api→按钮+接口徽标。A27：primary 实心强调。 */
function renderAction(a) {
  const label = `${esc(a.label ?? a.type ?? '按钮')}${pend(a)}`;
  const cls = a && a.priority === 'primary' ? 'wf-btn wf-btn-primary' : 'wf-btn';
  if (a.action === 'nav' && a.target) {
    return `<a class="${cls}" href="#page-${esc(a.target)}">${label} →</a>`;
  }
  if (a.action === 'modal' && a.target) {
    return `<button type="button" class="${cls}" data-modal="${esc(a.target)}">${label}</button>`;
  }
  if (a.action === 'api' && a.api) {
    const key = normApiKey(a.api);
    return `<button type="button" class="${cls}" title="${esc(key)}">${label}<span class="wf-api" title="${esc(key)}">API</span></button>`;
  }
  return `<button type="button" class="${cls}">${label}</button>`;
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
    ? `<td class="wf-ops">${renderActionSet(rowActions)}</td>`
    : '';
  const cols = fields ? fields.length : 1;
  const phRow = `<tr>${'<td><span class="wf-ph"></span></td>'.repeat(cols)}${opsCell}</tr>`;
  // 列头多或行操作多时表格自然宽度会超出所在列（分栏页尤其明显），
  // 故套一层横向滚动容器——不能直接给 .wf-block 加 overflow，那会裁掉浮在上边框的 wf-tag。
  const deco = `${designAnnot(comp)}${attachedActions(comp)}`; // A27
  return `<div class="wf-block wf-table"><span class="wf-tag">table</span>${deco}${key ? apiBadge(key) : ''}
<div class="wf-tw"><table><thead><tr>${head}${opsHead}</tr></thead><tbody>
${phRow}
${phRow}
</tbody></table></div></div>`;
}

/** 移动端列表（A16 mp 词）：2 行行卡占位（缩略块 + 两行灰条）+ rowActions + 数据源徽标。 */
function renderList(comp) {
  const rowActions = Array.isArray(comp.rowActions) ? comp.rowActions : [];
  const ops = rowActions.length ? `<div class="wf-cell-ops">${renderActionSet(rowActions)}</div>` : '';
  const cell = `<div class="wf-cell"><span class="wf-cell-thumb"></span><span class="wf-cell-lines"><span class="wf-ph"></span><span class="wf-ph wf-ph-short"></span></span>${ops}</div>`;
  return `<div class="wf-block wf-list"><span class="wf-tag">list</span>${designAnnot(comp)}${attachedActions(comp)}${comp.api ? apiBadge(comp.api) : ''}
${cell}
${cell}
</div>`;
}

/** 移动端详情（A16 mp 词）：字段-值只读列表，字段名取契约 response（与 table 列头同源思路）。 */
function renderDetail(comp, ctx) {
  const key = comp.api ? normApiKey(comp.api) : null;
  const contract = key ? ctx.contractByKey.get(key) : undefined;
  const fields =
    contract && Array.isArray(contract.response) && contract.response.length > 0 ? contract.response : null;
  const rows = fields
    ? fields.map((f) => `<div class="wf-kv"><span class="wf-label">${esc(f.name)}${f.desc ? `<i class="wf-desc">${esc(f.desc)}</i>` : ''}</span><span class="wf-ph"></span></div>`).join('\n')
    : (comp.items ?? []).map((it) => renderItem(it)).join('\n') || '<div class="wf-kv"><span class="wf-label wf-missing">⚠️ 契约缺失</span><span class="wf-ph"></span></div>';
  return `<div class="wf-block wf-detail"><span class="wf-tag">detail</span>${designAnnot(comp)}${attachedActions(comp)}${key ? apiBadge(key) : ''}
${rows}
</div>`;
}

/** 表单区块：items 逐项占位 + 数据源接口徽标。 */
function renderForm(comp) {
  const items = (comp.items ?? []).map((it) => renderItem(it)).join('\n');
  return `<div class="wf-block wf-form"><span class="wf-tag">form</span>${designAnnot(comp)}${attachedActions(comp)}${comp.api ? apiBadge(comp.api) : ''}<div class="wf-row">
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
  const drawer = mo.presentation === 'drawer'; // A27：抽屉是弹窗的呈现变体
  return `<div class="wf-modal${drawer ? ' wf-drawer' : ''}" id="${esc(mo.id)}" hidden>
<div class="wf-modal-head"><strong>${esc(mo.title ?? mo.id)}</strong><span class="tid">${esc(mo.id)}</span>${drawer ? '<span class="wf-density">drawer</span>' : ''}${pend(mo)}<button type="button" class="wf-close" data-modal-close>×</button></div>
<div class="wf-modal-body">
${fields}
</div>
<div class="wf-modal-foot">${mo.submit?.api ? apiBadge(mo.submit.api) : ''}<button type="button" class="wf-btn">提交</button><button type="button" class="wf-btn" data-modal-close>取消</button></div>
</div>`;
}
