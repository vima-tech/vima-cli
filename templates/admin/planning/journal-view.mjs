// 过程轨迹视图渲染器（admin 模板资产；A36，契约 §11.1）
// 六区：① 阶段时间线 ② 任务台账 ③ 验收点位 ④ 集成对账 ⑤ 规则命中 ⑥ 运行时与代码溯源。
//
// 与 audit-view.mjs（规格审计）的分工：那一份审「要建什么」，本份审「实际发生了什么」。
// 铁律（与规格类产物同）：确定性渲染——**禁 Date/Math.random**；所有数据经 escapeHtml；
//   同一输入字节一致；输出串末尾单个换行；单文件零外部请求（href 仅 # 锚点）；禁 JS。
// 刻意不同（契约 §11.1 决策表 D-A36-01）：产物落 .vima/reports/ 且含时间戳——
//   时间戳全部来自输入文件已落盘的字段，渲染器自身不读系统时钟，故字节确定性不破。
import { readFileSync } from 'node:fs';

// 骨架复用同目录 review.template.html（仅 {{TITLE}}/{{CONTENT}} 占位，与规格无关）
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

/** 统计卡片。 */
function stat(n, label) {
  return `<div class="stat"><div class="n">${esc(n)}</div><div class="l">${esc(label)}</div></div>`;
}

/** 表格（thead + tbody）；rows 为已转义的单元格数组的数组。空 rows → 缺席标注。 */
function table(headers, rows, emptyNote) {
  if (rows.length === 0) return `<p class="dim">${esc(emptyNote)}</p>`;
  const th = headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const tb = rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n');
  return `<div class="tw"><table>\n<thead><tr>${th}</tr></thead>\n<tbody>\n${tb}\n</tbody>\n</table></div>`;
}

/** 区块外壳。 */
function view(id, num, title, desc, body) {
  return `<section class="view" id="${esc(id)}">\n`
    + `<h2><span class="num">${esc(num)}</span>${esc(title)}</h2>\n`
    + `<p class="vd">${esc(desc)}</p>\n${body}\n</section>`;
}

/** 任务状态徽标：状态用文字而非颜色单独承载（禁 JS + 明暗主题下都要可读）。 */
function statusCell(s) {
  const cls = s === 'failed' || s === 'blocked' ? ' class="warn"' : (s === 'done' ? '' : ' class="dim"');
  return `<span${cls}>${esc(s ?? '—')}</span>`;
}

/**
 * 未过点位明细（③ 的可行动部分）——计数回答「有几个」，明细回答「改哪个」。
 * 不做截断：条数由项目任务点规模决定，本产物是本地文件，静默截断比长表危险。
 */
function pointDetail(openPoints) {
  if (!Array.isArray(openPoints) || openPoints.length === 0) return '';
  const KIND = { failed: '未过', waived: '豁免', ng: 'NG 越界' };
  // 按严重度排（NG 越界 > 未过 > 豁免），同级再按任务、点位——审核动线是「先看最该管的」。
  const SEV = { ng: 0, failed: 1, waived: 2 };
  const rows = openPoints
    .slice()
    .sort((a, b) => (SEV[a.kind] ?? 9) - (SEV[b.kind] ?? 9)
      || (a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0)
      || (a.point < b.point ? -1 : a.point > b.point ? 1 : 0))
    .map((p) => [
      `<code class="tid">${esc(p.taskId)}</code>`,
      p.kind === 'waived' ? esc(KIND[p.kind]) : `<span class="warn">${esc(KIND[p.kind] ?? p.kind)}</span>`,
      esc(p.point || '（点位文本缺失）'),
    ]);
  return `<div class="card"><h3>逐点明细</h3>${table(['任务', '类别', '点位'], rows, '')}</div>`;
}

/** 集成对账 findings 明细（④ 的可行动部分）。 */
function findingDetail(findings) {
  if (!Array.isArray(findings) || findings.length === 0) return '';
  const rows = findings
    .slice()
    .sort((a, b) => (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : (String(a.key) < String(b.key) ? -1 : 1)))
    .map((f) => [
      `<code>${esc(f.rule)}</code>`,
      f.level === 'error' ? `<span class="warn">${esc(f.level)}</span>` : esc(f.level ?? '—'),
      f.key ? `<code>${esc(f.key)}</code>` : '<span class="dim">—</span>',
      esc(f.message || '—') + (f.owners.length > 0 ? ` <span class="dim">（负责：${esc(f.owners.join('、'))}）</span>` : ''),
    ]);
  return `<div class="card"><h3>逐条明细</h3>${table(['规则', '级别', '对象', '说明'], rows, '')}</div>`;
}

/** trace 明细（⑥ 的可行动部分）：野生标注定位到文件行，虚报嫌疑列出 taskId。 */
function traceDetail(trace) {
  if (!trace || typeof trace !== 'object') return '';
  const out = [];
  const wild = Array.isArray(trace.wild) ? trace.wild : [];
  if (wild.length > 0) {
    const rows = wild
      .map((w) => [`<code class="tid">${esc(w.taskId)}</code>`, `<code>${esc(w.file)}:${esc(w.line)}</code>`]);
    out.push(`<div class="card"><h3>野生标注明细</h3>${table(['标注的 taskId', '位置'], rows, '')}</div>`);
  }
  const unmarked = Array.isArray(trace.unmarked) ? trace.unmarked : [];
  if (unmarked.length > 0) {
    out.push('<div class="card"><h3>虚报嫌疑明细</h3>'
      + `<p class="meta">status=done 但代码里没有任何 <code>@vima</code> 标注：${
        unmarked.map((id) => `<code class="tid">${esc(id)}</code>`).join(' ')}</p>`
      + '<p class="meta dim">用 <code>vima trace --strict</code> 让它变成非零退出。</p></div>');
  }
  return out.join('\n');
}

/**
 * renderJournal(model) → htmlString
 * model = { projectName, phases, tasks, agg, trace, vIntRules }
 *   phases : phaseDurations(lifecycle) 结果 [{phase, days|null}]
 *   tasks  : [{id,title,layer,side,status,retryCount,updatedAt}]（docs/tasks 缺失 → null）
 *   agg    : collectReports(root) 结果
 *   trace  : .vima/reports/trace.json | null
 */
export function renderJournal(model) {
  const { projectName, phases, tasks, agg, trace, vIntRules, journal, journalMetrics } = model;
  const P = [];

  // ── hero ──────────────────────────────────────────────
  const total = tasks ? tasks.length : 0;
  const done = tasks ? tasks.filter((t) => t.status === 'done').length : 0;
  const retried = tasks ? tasks.filter((t) => (t.retryCount ?? 0) > 0).length : 0;
  const stuck = tasks ? tasks.filter((t) => t.status === 'failed' || t.status === 'blocked').length : 0;

  P.push('<header class="hero">');
  P.push('<p class="kicker">过程轨迹 · 人类审核窗口</p>');
  P.push(`<h1>${esc(projectName)}</h1>`);
  P.push('<p class="sub">本视图审的是「实际发生了什么」——阶段推进、任务与重试、验收点位、'
    + '集成对账、规则命中、运行时证据。规格审计（要建什么）在 <code>docs/review/index.html</code>。</p>');
  P.push('<div class="stats">');
  P.push(stat(tasks ? `${done}/${total}` : '—', '任务 done'));
  P.push(stat(retried, '重试过'));
  P.push(stat(stuck, 'failed+blocked'));
  P.push(stat(agg.verification.failedPoints, '未过点位'));
  P.push(stat(agg.convergence.openPoints, '收口未决'));
  P.push(stat(agg.runtime.errors, '运行时错误'));
  P.push('</div>');
  P.push('</header>');

  // ── 目录 ──────────────────────────────────────────────
  P.push('<nav class="toc">'
    + '<a href="#v1">① 阶段时间线</a>'
    + '<a href="#v2">② 任务台账</a>'
    + '<a href="#v3">③ 验收点位</a>'
    + '<a href="#v4">④ 集成对账</a>'
    + '<a href="#v5">⑤ 规则命中</a>'
    + '<a href="#v6">⑥ 运行时与代码溯源</a>'
    + '<a href="#v7">⑦ 过程轨迹</a>'
    + '<span class="toc-sep">数据源：.vima/reports/ · docs/tasks/ · docs/lifecycle.json</span>'
    + '</nav>');

  // ── ① 阶段时间线 ──────────────────────────────────────
  const laneItems = phases.map((p) => {
    const d = p.days === null ? '<span class="dim">进行中或未记录时长</span>' : `${esc(p.days)} 天`;
    return `<li><strong>${esc(p.phase ?? '—')}</strong> — ${d}</li>`;
  });
  P.push(view('v1', '①', '阶段时间线',
    '取 docs/lifecycle.json 的 phaseHistory 已落盘时间戳作差；未收尾的阶段没有时长，不臆测。',
    laneItems.length > 0
      ? `<ol class="lane">\n${laneItems.join('\n')}\n</ol>`
      : '<p class="dim">尚无阶段记录（docs/lifecycle.json 缺失或 phaseHistory 为空）。</p>'));

  // ── ② 任务台账 ────────────────────────────────────────
  const taskRows = (tasks ?? [])
    .filter((t) => (t.retryCount ?? 0) > 0 || t.status === 'failed' || t.status === 'blocked' || t.status === 'running')
    .map((t) => [
      `<code class="tid">${esc(t.id)}</code>`,
      esc(t.title ?? '—'),
      esc(t.layer ?? '—'),
      esc(t.side ?? '—'),
      statusCell(t.status),
      esc(t.retryCount ?? 0),
      `<span class="dim">${esc(t.updatedAt ?? '—')}</span>`,
    ]);
  const taskBody = tasks === null
    ? '<p class="dim">docs/tasks/ 缺失或不可解析——任务台账不可用（如实标注，不臆测）。</p>'
    : table(['任务', '标题', 'layer', 'side', '状态', '重试', '更新于'], taskRows,
      total === 0 ? '尚无任务（PLANNING 未产出）。' : '全部任务一次通过、无 running 残留——本区只列需要注意的任务。');
  P.push(view('v2', '②', '任务台账',
    '只列「需要注意」的任务：重试过 / failed / blocked / running 残留。全绿时本区为空是正常的。',
    taskBody));

  // ── ③ 验收点位 ────────────────────────────────────────
  const v = agg.verification;
  P.push(view('v3', '③', '验收点位',
    'Verifier 报告按任务点（按钮·字段·连线）逐点判定的汇总。注意：一个任务一个报告文件，'
    + '多轮验收会互相覆盖——这里的轮次只是最大值，逐轮过程需 A35 journal 落地后才可得。',
    table(['指标', '值'], [
      ['Verifier 报告数', `${esc(v.reports)}`],
      ['最大轮次', `${esc(v.maxRound)}`],
      ['任务点总数', `${esc(v.points)}`],
      ['未过点位', v.failedPoints > 0 ? `<span class="warn">${esc(v.failedPoints)}</span>` : '0'],
      ['豁免点位', v.waived > 0 ? `<span class="warn">${esc(v.waived)}</span>` : '0'],
      ['NG 越界（本期不做）', v.ngViolations > 0 ? `<span class="warn">${esc(v.ngViolations)}</span>` : '0'],
      ['共享层变更请求', `${esc(agg.shared.changeRequests)}`],
    ].map((r) => [esc(r[0]), r[1]]), '尚无验收报告。')
    + pointDetail(agg.details.openPoints)));

  // ── ④ 集成对账 ────────────────────────────────────────
  const c = agg.convergence;
  const convRows = vIntRules.map((r) => [
    `<code>${esc(r)}</code>`,
    c[r] > 0 ? `<span class="warn">${esc(c[r])}</span>` : '0',
  ]);
  convRows.push([esc('收口未决点位'), c.openPoints > 0 ? `<span class="warn">${esc(c.openPoints)}</span>` : '0']);
  convRows.push([esc('done 无 @vima 标注'), c.unmarkedDone > 0 ? `<span class="warn">${esc(c.unmarkedDone)}</span>` : '0']);
  P.push(view('v4', '④', '集成对账',
    'vima converge 的 V-INT 规则族：漏实现 / 重复实现 / 越界实现 / 授权端无调用 / 缺收尾任务。',
    table(['规则', '命中'], convRows, '尚未运行 vima converge。')
    + findingDetail(agg.details.findings)));

  // ── ⑤ 规则命中 ────────────────────────────────────────
  const hits = Object.entries(agg.planning.ruleHits)
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1))
    .slice(0, 15)
    .map(([r, n]) => [`<code>${esc(r)}</code>`, `${esc(n)}`]);
  P.push(view('v5', '⑤', '规则命中分布',
    '同一条 validate 规则被反复违反，通常不是规则的问题，而是规划引导或模板没把这条要求讲清楚。'
    + '注意：本数据取自 planning-validation.json 的「最后一次」校验结果，是「结束时还剩几条」，'
    + '不是「一共被违反了多少次」——后者需 A35 journal 落地。',
    table(['规则', '残留'], hits, '最后一次校验无残留命中。')
    + (agg.planning.pendingConfirm > 0
      ? `<p class="warn">仍有 ${esc(agg.planning.pendingConfirm)} 条 pendingConfirm 未裁定。</p>`
      : '')));

  // ── ⑥ 运行时与代码溯源 ────────────────────────────────
  const traceRows = [];
  if (trace && typeof trace === 'object' && trace.summary && typeof trace.summary === 'object') {
    // 字段名以 .vima/reports/trace.json 的 summary 为准（markers / wildTaskIds / doneWithoutMarker）
    // ——写错会让本区静默空白，故 c4.journal 用真 trace.json 夹具守住。
    const s = trace.summary;
    for (const [k, label, isBad] of [
      ['markers', '有效 @vima 标注', false],
      ['wildTaskIds', '野生标注（taskId 不在任务清单）', true],
      ['doneWithoutMarker', 'done 任务无标注（虚报嫌疑）', true],
    ]) {
      if (s[k] === undefined) continue;
      traceRows.push([esc(label), isBad && s[k] > 0 ? `<span class="warn">${esc(s[k])}</span>` : `${esc(s[k])}`]);
    }
  }
  traceRows.push([esc('运行时错误（浏览器/小程序）'),
    agg.runtime.errors > 0 ? `<span class="warn">${esc(agg.runtime.errors)}</span>` : '0']);
  P.push(view('v6', '⑥', '运行时与代码溯源',
    'vima trace 的代码标注对账 + runtime-errors[.<appId>].jsonl 的真实报错计数。',
    table(['项', '值'], traceRows, '尚无数据。')
    + traceDetail(trace)
    + (trace === null ? '<p class="dim">尚未运行 vima trace（.vima/reports/trace.json 缺失）。</p>' : '')));

  // ── ⑦ 过程轨迹（A35 journal）────────────────────────────
  const jm = journalMetrics ?? { events: 0, guardCurve: [], verification: {}, cmdFail: {} };
  const jBody = jm.events === 0
    ? '<p class="dim">尚无过程轨迹（A35 journal 未落地、被 <code>VIMA_JOURNAL=0</code> 关闭，'
      + '或本副本是换机器 clone——journal 不入库，随数据源留在跑项目的那个工作副本里）。</p>'
    : table(['指标', '值'], [
      ['事件总数', `${esc(jm.events)}`],
      ['验收 r1 直过 / 挂了又修好 / 至今未过',
        `${esc(jm.verification.r1Pass ?? 0)} / ${esc(jm.verification.recovered ?? 0)} / `
        + `${(jm.verification.neverPass ?? 0) > 0 ? `<span class="warn">${esc(jm.verification.neverPass)}</span>` : '0'}`],
      ['命令非零退出分布',
        Object.entries(jm.cmdFail).map(([c, n]) => `<code>${esc(c)}</code>:${esc(n)}`).join(' ') || '—'],
    ].map((r) => [esc(r[0]), r[1]]), '')
      + (jm.guardCurve.length > 0
        ? `<div class="card"><h3>规范命中 → 修复曲线</h3>${
          table(['规范', '命中', '最后一次'], jm.guardCurve.map((g) => [
            `<code>${esc(g.ref)}</code>`,
            `${esc(g.hits)}`,
            g.lastHalf === 'late'
              ? '<span class="warn">后半程仍在踩</span>'
              : '<span class="dim">仅前半程</span>',
          ]), '')}</div>`
        : '');
  P.push(view('v7', '⑦', '过程轨迹',
    '这一区回答快照体系答不出的问题：某条规范是一次性踩坑，还是到最后还在踩；'
    + '某个任务是 r1 直过，还是挂了又修好。顺序按文件行序判定，不按时间戳'
    + '（并发 Builder 可能落在同一毫秒）。',
    jBody));

  // ── 审核动线（常量文案，不依赖输入）────────────────────
  P.push('<section class="view" id="next">');
  P.push('<h2><span class="num">▸</span>审核完之后</h2>');
  P.push('<p class="vd">本视图只读——不在这里批准。看完按需敲下面的命令：</p>');
  P.push('<div class="card">');
  P.push('<p class="meta"><code>vima converge</code> — 有未决收口项时先跑它，byTask 是修复调度的确定性输入</p>');
  P.push('<p class="meta"><code>vima trace --strict</code> — 核实虚报嫌疑</p>');
  P.push('<p class="meta"><code>vima retro</code> — 把本轮经验整理成可反哺 vima-cli 的 issue 正文</p>');
  P.push('<p class="meta"><code>vima render-journal</code> — 过程推进后重新渲染本视图（本视图不做漂移机检，需手动重渲）</p>');
  P.push('</div>');
  P.push('</section>');

  const content = P.join('\n');
  const title = `${projectName} · 过程轨迹`;
  const html = TEMPLATE.split('{{TITLE}}').join(esc(title)).split('{{CONTENT}}').join(content);
  return html.endsWith('\n') ? html : `${html}\n`;
}
