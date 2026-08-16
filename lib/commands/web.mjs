// vima web —— 本地只读追溯视图（A41）：进度 / 追溯图 / 审核产物 三合一。
//
// **为什么要有它**：终端能回答「进度是多少」（`vima status`），但回答不了
// 「这个报错的端点是谁实现的、属于哪个任务、那个任务验收到哪一步、当时报告写了什么」——
// 那要人同时翻 trace.json / 契约 / 任务 frontmatter / 两份报告 / journal 五处再做 join。
// sustain-v4 实战里这类问题每次都要十几分钟人肉排查。本命令把 `lib/model/traceability.mjs`
// 算好的三张索引摆成可点的页面，并把已有的审核产物（review/prototype/journal/设计稿）收进同一个入口。
//
// **A37 的「本地网页被否」在此改判**（D-A41-03）：当初否掉是因为需求是「看进度」，
// 终端与状态栏够用且更轻。本项的需求变成「按端点/任务/文件反查并跳到证据」——
// 那是超链接的活，终端做不了。改判只及于**只读本地视图**：
// 仍不做写操作、不做鉴权、不监听非回环地址、不上报、不跨项目聚合。
//
// **硬约束遵循**：零运行时依赖（只用 node:http/fs/path）；不产出任何仓库内文件；
// 只绑 127.0.0.1；全部数据每次请求现算，不缓存陈旧结论。
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { EXIT, usageFromParseArgs, usageError } from '../util/errors.mjs';
import { fileExists, stableStringify } from '../util/fs.mjs';
import { buildTraceability } from '../model/traceability.mjs';
import { collect, buildView } from './status.mjs';

const DEFAULT_PORT = 5178;

/** 审核产物清单：路径 → 展示名。缺席的条目在页面上标灰，不隐藏——「还没生成」本身是信息。 */
const ARTIFACTS = [
  ['docs/review/index.html', '审计视图（角色/菜单/流程/页面）'],
  ['docs/review/prototype.html', '线框原型（单端）'],
  ['docs/review/prototype.admin.html', '线框原型 · admin'],
  ['docs/review/prototype.mp.html', '线框原型 · mp'],
  ['.vima/reports/journal.html', '过程轨迹视图（render-journal）'],
  ['docs/coverage-matrix.md', '需求覆盖矩阵'],
  ['docs/spec.md', '规格说明 spec'],
];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CSS = `
:root{--bg:#0f1420;--panel:#161d2e;--line:#26304a;--txt:#dbe3f2;--dim:#8b9ac0;--brand:#4f8ef7;
--ok:#35c17e;--warn:#ffab3d;--bad:#ff5d55}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.6 "Noto Sans SC",system-ui,sans-serif}
a{color:var(--brand);text-decoration:none}a:hover{text-decoration:underline}
header{position:sticky;top:0;z-index:9;background:#121826;border-bottom:1px solid var(--line);
padding:12px 20px;display:flex;align-items:center;gap:18px}
header b{font-size:16px}
nav a{color:var(--dim);padding:4px 10px;border-radius:8px}
nav a.on{background:#1d2740;color:var(--txt)}
main{padding:20px;max-width:1400px;margin:0 auto}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:18px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.card .k{font-size:12px;color:var(--dim)}
.card .v{font-size:26px;font-weight:700;margin-top:2px}
.bar{height:8px;border-radius:5px;background:#20293f;overflow:hidden;margin-top:8px}
.bar i{display:block;height:100%;background:var(--brand)}
table{width:100%;border-collapse:collapse;font-size:13px;background:var(--panel);
border:1px solid var(--line);border-radius:12px;overflow:hidden}
/* 不用 sticky：表格容器有 overflow:hidden（为圆角），sticky 在其中失效并留下重影 */
th{text-align:left;padding:9px 12px;background:#1b2337;color:var(--dim);font-weight:600}
td{padding:8px 12px;border-top:1px solid var(--line);vertical-align:top}
tr:hover td{background:#1a2236}
code{font:12px ui-monospace,monospace;color:#b6c8ee;background:#1b2337;padding:1px 5px;border-radius:5px}
.tag{display:inline-block;padding:1px 7px;border-radius:6px;font-size:11px;font-weight:600}
.t-ok{background:rgba(53,193,126,.16);color:var(--ok)}
.t-warn{background:rgba(255,171,61,.16);color:var(--warn)}
.t-bad{background:rgba(255,93,85,.16);color:var(--bad)}
.t-dim{background:#20293f;color:var(--dim)}
h2{font-size:15px;margin:22px 0 10px;color:var(--dim);font-weight:600}
input{width:100%;padding:9px 12px;background:var(--panel);border:1px solid var(--line);
border-radius:9px;color:var(--txt);font-size:13px;margin-bottom:12px}
.muted{color:var(--dim)}
.hint{color:var(--dim);font-size:12.5px;margin:6px 0 14px}
`;

const JS = `
function flt(id, sel){const q=document.getElementById(id);if(!q)return;
 q.addEventListener('input',()=>{const v=q.value.toLowerCase();
 document.querySelectorAll(sel).forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(v)?'':'none'})})}
flt('q','tbody tr');
if(location.pathname==='/'){setInterval(async()=>{
 try{const r=await fetch('/api/status');const d=await r.json();
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
 const T=d.tiers,tot=T.total||0;
 set('m-claimed',T.claimed+'/'+tot);set('m-tracked',T.tracked+'/'+tot);set('m-verified',T.verified+'/'+tot);
 const bar=(id,n)=>{const e=document.getElementById(id);if(e)e.style.width=(tot?n/tot*100:0)+'%'};
 bar('b-claimed',T.claimed);bar('b-tracked',T.tracked);bar('b-verified',T.verified);
 }catch(e){}},3000)}
`;

function layout(title, active, body) {
  const nav = [['/', '进度'], ['/trace', '追溯'], ['/endpoints', '端点'], ['/artifacts', '审核产物']]
    .map(([h, t]) => `<a href="${h}" class="${active === h ? 'on' : ''}">${t}</a>`).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>${esc(title)} · vima web</title><style>${CSS}</style></head><body>
<header><b>vima web</b><nav>${nav}</nav><span class="muted" style="margin-left:auto">只读 · 本地 127.0.0.1</span></header>
<main>${body}</main><script>${JS}</script></body></html>`;
}

/** tiers 是扁平计数（claimed/tracked/verified + total），不是 {done,total} 对象——按真实形状取值。 */
function tierCard(id, label, done, total, note) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `<div class="card"><div class="k">${label}</div>
  <div class="v" id="m-${id}">${done}/${total}</div>
  <div class="bar"><i id="b-${id}" style="width:${pct}%"></i></div>
  <div class="k" style="margin-top:6px">${note}</div></div>`;
}

async function pageDashboard(root, name) {
  const raw = await collect(root);
  const v = buildView(raw, Date.now());
  const t = v.tiers;
  // groups 是三个切面的映射（bySide / byLayer / byApp），逐面平铺成表
  const faces = [['按端', v.groups?.byApp], ['按前后端', v.groups?.bySide], ['按层', v.groups?.byLayer]];
  const rows = faces.flatMap(([face, m]) => Object.entries(m ?? {}).map(([k, g]) => `<tr>
    <td class="muted">${esc(face)}</td><td>${esc(k)}</td><td>${g.total}</td>
    <td>${g.done}</td><td>${g.verified}</td><td>${g.pending}</td></tr>`)).join('');
  return layout('进度', '/', `
  <h2>${esc(name)} · ${esc(typeof v.phase === 'string' ? v.phase : (v.phase?.current ?? '—'))}</h2>
  <div class="hint">三档证据强度递增：自称（frontmatter，Agent 可改）≥ 有轨迹 ≥ 已验收（journal 事件）。
  <b>落差本身就是信号</b>——它可能是「hook 没装」「会话开在错目录」「报告 schema 不匹配」，判定见 <code>vima doctor</code>。</div>
  <div class="grid">
    ${tierCard('claimed', '自称 claimed', t.claimed, t.total, 'frontmatter status: done（Agent 可改）')}
    ${tierCard('tracked', '有轨迹 tracked', t.tracked, t.total, `journal 有 builder/verifier 事件 · 比自称少 ${t.gaps?.claimedVsTracked ?? 0}`)}
    ${tierCard('verified', '已验收 verified', t.verified, t.total, `最新 verifier 事件为 pass · 比有轨迹少 ${t.gaps?.trackedVsVerified ?? 0}`)}
  </div>
  <h2>分组</h2>
  <table><thead><tr><th>切面</th><th>分组</th><th>总数</th><th>自称</th><th>验收</th><th>待办</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="6" class="muted">暂无任务</td></tr>'}</tbody></table>
  <div class="hint" style="margin-top:14px">每 3 秒自动刷新三档数字。</div>`);
}

function reportTag(rep) {
  if (!rep) return '<span class="tag t-dim">无</span>';
  if (rep.parseError) return '<span class="tag t-bad">坏 JSON</span>';
  const s = rep.result ?? rep.status;
  if (s === 'pass' || s === 'completed') return `<span class="tag t-ok">${esc(s)}</span>`;
  if (s === null || s === undefined) return '<span class="tag t-warn">字段缺失</span>';
  return `<span class="tag t-bad">${esc(s)}</span>`;
}

async function pageTrace(root, cliRoot) {
  const g = await buildTraceability(root, { cliRoot });
  const s = g.summary;
  const rows = Object.values(g.byTask)
    .sort((a, b) => (a.taskId < b.taskId ? -1 : 1))
    .map((t) => `<tr>
      <td><code>${esc(t.taskId)}</code><div class="muted">${esc(t.title ?? '')}</div></td>
      <td>${t.status === 'done' ? '<span class="tag t-ok">done</span>' : `<span class="tag t-dim">${esc(t.status)}</span>`}</td>
      <td>${esc(t.app ?? '—')}</td>
      <td>${t.markerCount ? `${t.files.length} 文件 / ${t.markerCount} 标注` : '<span class="tag t-warn">无代码</span>'}</td>
      <td>${t.endpoints.length}</td>
      <td>${reportTag(t.reports?.builder)}</td>
      <td>${reportTag(t.reports?.verifier)}</td>
      <td>${t.journal.events || '<span class="muted">0</span>'}</td>
    </tr>`).join('');
  return layout('追溯', '/trace', `
  <h2>追溯图 · 按任务</h2>
  <div class="hint">一行看完一个任务的四类证据：代码（<code>@vima</code> 标注）、端点、两份报告、journal 轨迹。
  <b>「自称 done 但无代码」「有报告但无轨迹」这类矛盾在这里一眼可见</b>。</div>
  <div class="grid">
    <div class="card"><div class="k">有代码 / 任务总数</div><div class="v">${s.tasksWithCode}/${s.tasks}</div></div>
    <div class="card"><div class="k">有构建报告</div><div class="v">${s.tasksWithBuilderReport}</div></div>
    <div class="card"><div class="k">有验收报告</div><div class="v">${s.tasksWithVerifierReport}</div></div>
    <div class="card"><div class="k">有 journal 轨迹</div><div class="v">${s.tasksWithJournal}</div></div>
  </div>
  <input id="q" placeholder="过滤任务 / 标题 / 端…">
  <table><thead><tr><th>任务</th><th>状态</th><th>端</th><th>代码</th><th>端点</th>
  <th>构建报告</th><th>验收报告</th><th>轨迹</th></tr></thead><tbody>${rows}</tbody></table>`);
}

async function pageEndpoints(root, cliRoot) {
  const g = await buildTraceability(root, { cliRoot });
  const s = g.summary;
  const rows = Object.values(g.byEndpoint).map((e) => {
    const impl = e.implementedBy.map((x) => `<div><code>${esc(x.file)}:${x.line}</code> ${x.taskIds.map((t) => `<span class="tag t-dim">${esc(t)}</span>`).join(' ')}</div>`).join('') || '<span class="tag t-bad">无实现</span>';
    const call = e.calledBy.map((x) => `<div><code>${esc(x.file)}:${x.line}</code> ${x.taskIds.map((t) => `<span class="tag t-dim">${esc(t)}</span>`).join(' ')}</div>`).join('') || '<span class="tag t-warn">无人调用</span>';
    return `<tr><td><code>${esc(e.key)}</code><div class="muted">${esc(e.module)} · consumers ${esc((e.consumers ?? []).join(',') || '—')}</div></td>
      <td>${impl}</td><td>${call}</td></tr>`;
  }).join('');
  return layout('端点', '/endpoints', `
  <h2>追溯图 · 按端点反查</h2>
  <div class="hint">线上报了一个接口错，从这里一步查到：谁实现的（文件:行 + 任务）、谁在调（哪个端）、属于哪个契约模块。
  「无人调用」多半是前端还没接，「无实现」是后端漏做。</div>
  <div class="grid">
    <div class="card"><div class="k">契约端点</div><div class="v">${s.endpoints}</div></div>
    <div class="card"><div class="k">已实现</div><div class="v">${s.endpointsImplemented}</div></div>
    <div class="card"><div class="k">孤儿（无实现）</div><div class="v">${s.endpointsOrphan}</div></div>
    <div class="card"><div class="k">无人调用</div><div class="v">${s.endpointsUncalled}</div></div>
  </div>
  <input id="q" placeholder="过滤端点 / 模块 / 文件…">
  <table><thead><tr><th>端点</th><th>实现</th><th>调用</th></tr></thead><tbody>${rows}</tbody></table>`);
}

async function pageArtifacts(root) {
  const items = [];
  for (const [rel, label] of ARTIFACTS) {
    const ok = await fileExists(path.join(root, rel));
    items.push(`<tr><td>${esc(label)}</td><td><code>${esc(rel)}</code></td>
      <td>${ok ? `<a href="/file/${esc(rel)}" target="_blank">打开</a>` : '<span class="tag t-dim">未生成</span>'}</td></tr>`);
  }
  // 设计稿目录（A34）：按页列出冻结产物
  const designRows = [];
  const designDir = path.join(root, 'docs', 'review', 'design');
  if (await fileExists(designDir)) {
    const { readdir } = await import('node:fs/promises');
    for (const name of (await readdir(designDir)).sort()) {
      if (name.startsWith('_')) continue;
      const files = [];
      for (const f of ['default.png', 'empty.png', 'prototype.html', 'scenarios.md']) {
        if (await fileExists(path.join(designDir, name, f))) {
          files.push(`<a href="/file/docs/review/design/${esc(name)}/${f}" target="_blank">${f}</a>`);
        }
      }
      designRows.push(`<tr><td><code>${esc(name)}</code></td><td>${files.join(' · ') || '<span class="muted">空</span>'}</td></tr>`);
    }
  }
  return layout('审核产物', '/artifacts', `
  <h2>审核产物</h2>
  <div class="hint">评审要看的东西集中在这里，不用记路径。未生成的条目保留并标灰——「还没生成」本身也是状态。</div>
  <table><thead><tr><th>产物</th><th>路径</th><th></th></tr></thead><tbody>${items.join('')}</tbody></table>
  <h2>设计稿（A34 冻结产物）</h2>
  <table><thead><tr><th>页面</th><th>文件</th></tr></thead>
  <tbody>${designRows.join('') || '<tr><td colspan="2" class="muted">暂无设计稿目录</td></tr>'}</tbody></table>`);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

/** 只读静态出口：路径必须落在项目根内（拒绝 .. 穿越与绝对路径）。 */
async function serveFile(root, rel, res) {
  const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const abs = path.join(root, safe);
  if (!abs.startsWith(path.resolve(root) + path.sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  if (!(await fileExists(abs))) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(abs)] ?? 'application/octet-stream' });
  res.end(await readFile(abs));
}

/** vima web [--port <n>] [--open] */
export async function run(argv, ctx) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { port: { type: 'string' }, open: { type: 'boolean', default: false } },
      allowPositionals: false,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }
  const port = values.port === undefined ? DEFAULT_PORT : Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw usageError(`--port 需为 1–65535 的整数，收到 "${values.port}"`);
  }

  const root = ctx.cwd;
  const name = path.basename(root);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    try {
      if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(await pageDashboard(root, name)); return; }
      if (url.pathname === '/trace') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(await pageTrace(root, ctx.cliRoot)); return; }
      if (url.pathname === '/endpoints') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(await pageEndpoints(root, ctx.cliRoot)); return; }
      if (url.pathname === '/artifacts') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(await pageArtifacts(root)); return; }
      if (url.pathname === '/api/status') {
        const v = buildView(await collect(root), Date.now());
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(stableStringify(v));
        return;
      }
      if (url.pathname === '/api/trace') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(stableStringify(await buildTraceability(root, { cliRoot: ctx.cliRoot })));
        return;
      }
      if (url.pathname.startsWith('/file/')) { await serveFile(root, decodeURIComponent(url.pathname.slice(6)), res); return; }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
    } catch (err) {
      // 视图不可用不该让服务器倒下——半成品项目、坏 JSON 都要能打开首页
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`视图渲染失败：${err?.message ?? err}`);
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve); // 只绑回环：不做鉴权，就不能对外可达
  });

  const addr = `http://127.0.0.1:${port}`;
  process.stdout.write(
    `🌐 vima web 已启动：${addr}\n`
    + `   项目：${root}\n`
    + '   页面：/ 进度 · /trace 追溯 · /endpoints 端点反查 · /artifacts 审核产物\n'
    + '   只读服务，只绑回环地址；Ctrl+C 退出\n',
  );
  if (values.open) {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    try { spawn(opener, [addr], { stdio: 'ignore', detached: true }).unref(); } catch { /* 打不开浏览器不影响服务 */ }
  }

  await new Promise((resolve) => {
    const stop = () => { server.close(() => resolve()); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
  return EXIT.OK;
}
