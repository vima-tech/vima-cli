// vima status —— 运行状态可观测（A37）：证据强度三档进度 / 分组任务量 / 用时 / ETA。
//
// 四个呈现口共用同一份聚合：默认多行表格、`--watch` 常驻重绘、`--json` 机器消费、
// `--line` 单行（供 Claude Code statusLine）。
//
// 两条硬约束（A37）：
//   1. **一律不落盘**——只写 stdout，不产出任何仓库内文件。落盘会让它受「渲染器禁止
//      嵌入时间戳」硬约束（而它的全部价值就在 now），且会引入第 4 个状态源，
//      正是本命令要治的病。故不接 `--out`/`--serve`/`--output`（parseArgs 未知选项 → exit 3）。
//   2. **不判定对错、不进退出码**——恒 exit 0（除用法错误）。差值只呈现不裁定（D-A37-02）。
//
// 时钟纪律：`now` 在本层读取一次并注入 lib/model/progress.mjs 的全部纯函数。
// `--watch` 据此把 I/O 与呈现分开——文件变化重新读盘，每秒重绘只用缓存数据 + 新 now；
// 另设低频轮询兜底 fs.watch 丢事件或目录晚创建的场景。
import path from 'node:path';
import { parseArgs } from 'node:util';
import { watch } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { loadTasksTolerant } from '../model/tasks.mjs';
import { loadLifecycle } from '../model/lifecycle.mjs';
import { loadJournal, readJsonSafe } from '../model/journal.mjs';
import {
  groupTasks, taskEvidence, evidenceTiers, phaseTimeline, phaseEnteredAt,
  estimate, trustSignals, currentVerifiedIds, NO_APP,
} from '../model/progress.mjs';
import { stableStringify, directoryExists, findProjectRoot } from '../util/fs.mjs';
import { EXIT, usageError, usageFromParseArgs } from '../util/errors.mjs';

const PLAN_REL = '.vima/reports/batch-plan.json';
const CHANGES_REL = '.vima/changes';
/**
 * /go 的调度状态文件（A18）。status 只读它的存在性与 stopReason 供呈现，
 * 不解释成因、不给建议——它是 no-trajectory 信号唯一的权威来源：缺了它，
 * 那条信号只能说「没有轨迹」，说不出「也没有人在调度」。
 */
const GO_STATE_REL = '.vima/go-state.json';
/** --watch 的重绘节拍：只重算派生值，不读盘。 */
const TICK_MS = 1000;
/** fs.watch 是提示而非账本；低频全量读盘保证漏事件后最终一致。 */
const POLL_MS = 5000;
/** --watch 的读盘防抖：Builder 并发写会产生变更风暴，攒一拍再读。 */
const DEBOUNCE_MS = 250;

// ── 格式化 ────────────────────────────────────────────────────────────────

/** 毫秒 → 人读时长（3h37m / 42m / 18s）；null → '—'。 */
export function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m${String(s % 60).padStart(2, '0')}s`;
  return `${s}s`;
}

/** 进度条：done/total → 20 格。total=0 → 全空（不写成 100%，没有任务不等于全做完）。 */
export function fmtBar(done, total, width = 20) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const filled = Math.round(ratio * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/** 百分比字符串；total=0 → '—'。 */
function fmtPct(done, total) {
  return total > 0 ? `${((done / total) * 100).toFixed(1)}%` : '—';
}

/** 本地时钟 HH:MM:SS（仅用于表头，纯展示）。 */
function fmtClock(now) {
  const d = new Date(now);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * 终端显示宽度：CJK 表意文字与全角标点占两格，其余占一格。
 *
 * 表格的表头是中文而数据是数字，两者若用不同的宽度口径就会错位——本项自测时
 * 第一版正是「表头按字符数、数据按数字位数」，中文表头整体右偏两格。
 * 故 `pad`/`padEnd` 一律走这一个函数，不留第二套算法。
 */
export function dispWidth(s) {
  let w = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    w += (c >= 0x1100 && (
      c <= 0x115f                          // 韩文字母
      || (c >= 0x2e80 && c <= 0xa4cf)      // CJK 部首 / 假名 / 汉字
      || (c >= 0xac00 && c <= 0xd7a3)      // 韩文音节
      || (c >= 0xf900 && c <= 0xfaff)      // CJK 兼容
      || (c >= 0xfe30 && c <= 0xfe6f)      // CJK 兼容标点
      || (c >= 0xff00 && c <= 0xff60)      // 全角
      || (c >= 0xffe0 && c <= 0xffe6)
    )) ? 2 : 1;
  }
  return w;
}

/** 右对齐到显示宽度 n。 */
function pad(s, n) {
  const str = String(s);
  const w = dispWidth(str);
  return w >= n ? str : ' '.repeat(n - w) + str;
}

/** 左对齐到显示宽度 n。 */
function padEnd(s, n) {
  const str = String(s);
  const w = dispWidth(str);
  return w >= n ? str : str + ' '.repeat(n - w);
}

// ── 采集与派生 ────────────────────────────────────────────────────────────

/** change apply 的 reopen 水位：旧 pass 在任务重新标 done 后也不能复活。 */
async function loadReopenWatermarks(root) {
  let names;
  try {
    names = (await readdir(path.join(root, CHANGES_REL), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return {};
  }
  const out = {};
  for (const name of names) {
    const change = await readJsonSafe(path.join(root, CHANGES_REL, name, 'change.json'));
    const at = Date.parse(change?.appliedAt ?? '');
    if (!Number.isFinite(at) || !Array.isArray(change?.reopened)) continue;
    for (const taskId of change.reopened) {
      if (typeof taskId !== 'string') continue;
      out[taskId] = Math.max(out[taskId] ?? -Infinity, at);
    }
  }
  return out;
}

/**
 * 读盘：把 status 依赖的任务/lifecycle/journal/计划/change 水位一次取齐。
 * 任一份缺失都降级为空值而不抛——
 * status 在 PLANNING 期、空项目、换 clone 之后都必须能跑（A37 验收 7）。
 */
export async function collect(root, { projectDetected = true } = {}) {
  if (!projectDetected) {
    return {
      lifecycle: null,
      tasks: [],
      events: [],
      batchPlan: null,
      scheduler: { exists: false, stopReason: null },
      reopenedAt: {},
      projectDetected: false,
      dataIssues: { lifecycle: null, tasks: [] },
    };
  }
  let lifecycle = null;
  let lifecycleIssue = null;
  try {
    lifecycle = await loadLifecycle(root);
  } catch (err) {
    lifecycle = null; // 未 init / 文件损坏 → 阶段与用时段落显示「尚无数据」
    if (projectDetected) lifecycleIssue = err?.message ?? String(err);
  }
  const { tasks, issues: taskIssues } = await loadTasksTolerant(root);
  const events = await loadJournal(root);
  const batchPlan = await readJsonSafe(path.join(root, PLAN_REL));
  const goState = await readJsonSafe(path.join(root, GO_STATE_REL));
  const reopenedAt = await loadReopenWatermarks(root);
  return {
    lifecycle,
    tasks,
    events,
    batchPlan,
    scheduler: goState
      ? { exists: true, stopReason: typeof goState.stopReason === 'string' ? goState.stopReason : null }
      : { exists: false, stopReason: null },
    reopenedAt,
    projectDetected,
    dataIssues: { lifecycle: lifecycleIssue, tasks: taskIssues },
  };
}

/**
 * 纯派生：raw + now → 视图数据。`--watch` 每拍调用一次（不读盘）。
 * 全部时间相关计算都在这里，模型层不读时钟。
 */
export function buildView(raw, now) {
  const { lifecycle, tasks, events, batchPlan, dataIssues, reopenedAt, scheduler } = raw;
  const evidence = taskEvidence(events);
  const currentVerified = currentVerifiedIds(tasks, evidence, reopenedAt);
  // 分组表与总进度必须同口径——verified 集合一并传入，否则分组按 status 显示满格
  // 而总表说「已验收 0」，同一屏自相矛盾。
  const groups = groupTasks(tasks, currentVerified);
  const tiers = evidenceTiers(tasks, evidence, reopenedAt);
  const timeline = phaseTimeline(lifecycle, now);

  // ETA 起算点：DEVELOPING 进入时刻。未进 DEVELOPING 则为 null，estimate 退回首次完成时刻。
  const since = phaseEnteredAt(lifecycle, 'DEVELOPING');
  const phase = lifecycle?.currentPhase ?? null;
  // 仅在「当前正处于 DEVELOPING」时才有「开发期已进行多久」——历史上进过不算。
  const developingMs = phase === 'DEVELOPING' && Number.isFinite(since) && Number.isFinite(now)
    ? Math.max(0, now - since)
    : null;
  const trust = trustSignals({
    tiers, groups, lifecycle, batchPlan, phase, developingMs, evidence, scheduler,
  });
  const byId = new Map(tasks.map((t) => [t.id, t]));

  // 完成时刻序列**按行序**（taskEvidence.order 已保证），不得按 ts 重排（D-A35-11）。
  const completionsOf = (filter) => evidence.order
    .filter((id) => byId.has(id) && (filter === null || filter(byId.get(id))))
    .map((id) => evidence.firstPass.get(id));

  const remainingOf = (filter) => tasks
    .filter((t) => (filter === null || filter(t)) && !currentVerified.has(t.id))
    .length;

  const overall = estimate({
    completions: completionsOf(null),
    remaining: remainingOf(null),
    now,
    since,
  });

  // 按 side 分别外推；样本不足的 side 退回全局速率并标注 basis。
  const bySide = {};
  for (const side of ['backend', 'frontend', 'fullstack']) {
    const f = (t) => t.fm?.side === side;
    const remaining = remainingOf(f);
    if (groups.bySide[side].total === 0) continue;
    const own = estimate({ completions: completionsOf(f), remaining, now, since });
    if (own.estimable || !overall.estimable || remaining <= 0) {
      bySide[side] = { ...own, basis: own.estimable ? 'side' : 'none' };
      continue;
    }
    // 本 side 样本不足但全局够 → 用全局速率外推，并如实标注依据（A37 规格 2）
    bySide[side] = {
      ...overall,
      remaining,
      samples: own.samples,
      estimable: true,
      reason: null,
      basis: 'global',
      etaMs: {
        conservative: Math.round(remaining / (overall.ratePerHour.conservative / 3600000)),
        optimistic: Math.round(remaining / (overall.ratePerHour.optimistic / 3600000)),
      },
    };
  }

  const batches = batchPlan && Array.isArray(batchPlan.batches)
    ? { count: batchPlan.batches.length, maxParallel: batchPlan.maxParallel ?? null }
    : null;

  return {
    now,
    project: { detected: raw.projectDetected !== false },
    phase,
    dataIssues: dataIssues ?? { lifecycle: null, tasks: [] },
    timeline,
    groups,
    tiers,
    trust,
    batches,
    eta: { overall, bySide },
    scheduler: scheduler ?? { exists: false, stopReason: null },
    activity: {
      // 轨迹口径（report 事件）：任务在推进的唯一证据，单列在前。
      lastReportAt: evidence.lastReportTs,
      reportIdleMs: Number.isFinite(evidence.lastReportTs)
        ? Math.max(0, now - evidence.lastReportTs)
        : null,
      reportEvents: evidence.reportEvents,
      // 全部事件（含 cmd / guard）：保留供机器消费与对账，**不得**用来说明「有活动」。
      lastEventAt: evidence.lastEventTs,
      idleMs: Number.isFinite(evidence.lastEventTs) ? Math.max(0, now - evidence.lastEventTs) : null,
      events: events.length,
    },
  };
}

// ── 呈现 ──────────────────────────────────────────────────────────────────

/**
 * ETA 一行文案：不可估时说清缺什么，可估时给区间并标注依据与假设。
 *
 * `basis === 'global'` 时**不显示本组样本数**——那个数恒为不足值（正因不足才退回全局），
 * 印出来会被读成「用 0 个样本估出了 13 小时」。依据换成一句「按全局速率外推」。
 */
function etaText(e) {
  if (!e.estimable) return e.reason;
  const lo = fmtDuration(e.etaMs.optimistic);
  const hi = fmtDuration(e.etaMs.conservative);
  const range = lo === hi ? lo : `${lo} ~ ${hi}`;
  const basis = e.basis === 'global' ? '按全局速率外推' : `样本 ${e.samples}`;
  return `${range}（剩 ${e.remaining} 个，${basis}，假设并行度不变）`;
}

/** 多行表格（默认口 / --watch 的一屏）。 */
export function renderTable(v, projectName) {
  const L = [];
  const state = v.project?.detected === false ? '非 vima 项目' : (v.phase ?? '未初始化');
  const head = `vima status · ${projectName} · ${state}`;
  L.push(`${padEnd(head, 52)}  ${fmtClock(v.now)}`);
  L.push('');

  if (v.project?.detected === false) {
    L.push('项目   ⚠ 非 vima 项目根；未读取项目进度');
    L.push('预估   尚无项目数据，不估算');
    return `${L.join('\n')}\n`;
  }

  // 阶段时间线
  if (v.timeline.phases.length > 0) {
    const seg = v.timeline.phases
      .map((p) => `${p.phase}${p.current ? ' ⏱ ' : ' ✓ '}${fmtDuration(p.ms)}`)
      .join('  ');
    L.push(`阶段   ${seg}`);
    L.push(`总用时 ${fmtDuration(v.timeline.totalMs)}`);
  } else {
    L.push('阶段   尚无数据（docs/lifecycle.json 缺失或无 phaseHistory）');
  }
  if (v.dataIssues?.lifecycle) L.push(`数据   ⚠ lifecycle 不可读：${v.dataIssues.lifecycle}`);
  if (v.dataIssues?.tasks?.length > 0) {
    L.push(
      `数据   ⚠ ${v.dataIssues.tasks.length} 个任务文件不可读；以下进度只统计 ${v.tiers.total} 个可读任务`,
    );
    for (const issue of v.dataIssues.tasks) L.push(`       · ${issue.file}: ${issue.message}`);
  }
  L.push('');

  // 证据强度三档
  const t = v.tiers;
  const row = (label, n, note) =>
    `       ${padEnd(label, 8)}${pad(n, 3)}/${pad(t.total, 3)} ${fmtBar(n, t.total)} ${pad(fmtPct(n, t.total), 6)}${note}`;
  L.push('进度   自称 = frontmatter 标 done；有轨迹/已验收 = journal 的 hook 采集事件（非独立防伪）');
  L.push(row('自称', t.claimed, ''));
  L.push(row('有轨迹', t.tracked, t.gaps.claimedVsTracked > 0 ? `  ⚠ 比自称少 ${t.gaps.claimedVsTracked}` : ''));
  L.push(row('已验收', t.verified, t.gaps.trackedVsVerified > 0 ? `  ⚠ 比有轨迹少 ${t.gaps.trackedVsVerified}` : ''));
  L.push('');

  // 分组任务量（列口径与上方三档一致：自称 = status done，验收 = journal 事件）
  const gline = (label, c) =>
    `       ${padEnd(label, 14)}${pad(c.total, 6)}${pad(c.done, 6)}${pad(c.verified, 6)}${pad(c.pending, 6)}`;
  // 三个切面（side / layer / 端）是**同一批任务的三种切法**，不是三段可以纵向相加的清单。
  // 初版把 side 三行与 layer 两行连排且都不带小节标题，读者顺着往下加会得到
  // 54+78+2+4+2=140 > 总数 134，看起来像数据错了。每个切面各自带标题、各自合计等于总数。
  L.push(`分组   ${padEnd('', 14)}${pad('总数', 6)}${pad('自称', 6)}${pad('验收', 6)}${pad('待办', 6)}`);
  // 标签必须一眼可分：side 是「前后端」，app 才是「端」（admin/mp）。
  // 初版把 side 叫「按端型」，与下方 app 的「按端」只差一字，等于没分。
  L.push('       — 按前后端 —（三个切面各自合计 = 总数，勿跨切面相加）');
  for (const side of ['backend', 'frontend', 'fullstack']) {
    const c = v.groups.bySide[side];
    if (c.total === 0) continue;
    L.push(gline({ backend: '后端', frontend: '前端', fullstack: '全栈' }[side], c));
  }
  // business 行不可省：省了「按层」这一切面就不再合计等于总数，读者无从校验。
  const layers = ['business', 'shared', 'pipeline'].filter((l) => v.groups.byLayer[l].total > 0);
  if (layers.length > 0) {
    L.push('       — 按层 —');
    for (const layer of layers) {
      L.push(gline({ business: '业务', shared: '共享层', pipeline: '流水线' }[layer], v.groups.byLayer[layer]));
    }
  }
  // 端是**另一个维度**，不是 side 的子项——初版用 `└` 缩进挂在最后一行 side 下面，
  // 读起来像「全栈的两个端」。多端项目才出现这一段，用空行分隔而非缩进。
  const apps = Object.keys(v.groups.byApp).filter((a) => a !== NO_APP).sort();
  if (apps.length > 0) {
    L.push('       — 按端 —');
    for (const a of apps) L.push(gline(a, v.groups.byApp[a]));
  }
  L.push('');

  // 批次 / 活动
  if (v.batches) L.push(`批次   ${v.batches.count} 批 · 并行度 ${v.batches.maxParallel ?? '—'}`);
  // 「活动」只认轨迹（report）事件。cmd/guard 是人敲命令与规范命中，一条也不代表任务在推进——
  // 早期版本把三者混算，一个从未跑过调度器的项目会显示成「6 分钟前还有活动」（D-A39-01）。
  if (v.activity.reportEvents > 0) {
    L.push(
      `活动   最近一条任务轨迹距今 ${fmtDuration(v.activity.reportIdleMs)}`
      + `（轨迹 ${v.activity.reportEvents} 条 / 事件合计 ${v.activity.events} 条）`,
    );
  } else if (v.activity.events > 0) {
    L.push(
      `活动   0 条任务轨迹事件——journal 里的 ${v.activity.events} 条全是命令/规范事件，不代表任务在推进`,
    );
  } else {
    L.push('活动   journal 无事件——尚未产生任何过程轨迹');
  }
  L.push('');

  // ETA
  L.push(`预估   ${etaText(v.eta.overall)}`);
  for (const [side, e] of Object.entries(v.eta.bySide)) {
    if (!e.estimable) continue;
    const zh = { backend: '后端', frontend: '前端', fullstack: '全栈' }[side];
    L.push(`       ${padEnd(zh, 8)}${etaText(e)}`);
  }

  // 差值（只呈现不裁定）
  if (v.trust.length > 0) {
    L.push('');
    L.push(`信任度 ⚠ ${v.trust.length} 项状态源差异（只呈现不裁定；判定见 vima doctor / vima converge）`);
    for (const s of v.trust) L.push(`       · ${s.message}`);
  }
  return `${L.join('\n')}\n`;
}

/**
 * 单行（--line，供 statusLine）。无换行、无颜色、恒定短。
 * 形如：`vima DEVELOPING 21/89·验收0 ⚠3 2h24m ETA—`
 */
export function renderLine(v) {
  const t = v.tiers;
  const bits = [`vima ${v.phase ?? '未初始化'}`];
  bits.push(`${t.claimed}/${t.total}·验收${t.verified}`);
  const dataIssueCount = (v.dataIssues?.tasks?.length ?? 0) + (v.dataIssues?.lifecycle ? 1 : 0);
  if (dataIssueCount > 0) bits.push(`数据⚠${dataIssueCount}`);
  if (v.trust.length > 0) bits.push(`⚠${v.trust.length}`);
  const cur = v.timeline.phases.find((p) => p.current);
  if (cur) bits.push(fmtDuration(cur.ms));
  bits.push(v.eta.overall.estimable ? `ETA${fmtDuration(v.eta.overall.etaMs.optimistic)}+` : 'ETA—');
  return bits.join('  ');
}

// ── 入口 ──────────────────────────────────────────────────────────────────

async function once(root, mode, projectName, projectDetected = true) {
  const raw = await collect(root, { projectDetected });
  const v = buildView(raw, Date.now());
  if (mode === 'json') return `${stableStringify(v)}`;
  if (mode === 'line') return `${renderLine(v)}\n`;
  return renderTable(v, projectName);
}

/**
 * --watch：fs.watch 驱动防抖读盘；1 秒定时器只重绘，5 秒定时器低频读盘兜底。
 * 二者分开是因为 elapsed/ETA 每秒都在变而文件多数时候没变——每秒读 90 个任务文件
 * 是纯浪费；完全依赖 fs.watch 又会漏掉晚建目录或平台丢事件。
 */
async function runWatch(root, projectName) {
  const targets = () => [
    root,
    path.join(root, 'docs'),
    path.join(root, 'docs', 'tasks'),
    path.join(root, '.vima'),
    path.join(root, '.vima', 'reports'),
  ];
  let raw = await collect(root);
  let timer = null;
  let pollTimer = null;
  let debounce = null;
  let stopped = false;
  const watchers = new Map();

  const draw = () => {
    const out = renderTable(buildView(raw, Date.now()), projectName);
    // 清屏 + 归位（不用 console.clear：它在非 TTY 下行为不一致）
    process.stdout.write(`\x1b[2J\x1b[H${out}\n按 Ctrl+C 退出`);
  };
  const syncWatchers = async () => {
    for (const dir of targets()) {
      if (watchers.has(dir) || !(await directoryExists(dir))) continue;
      try {
        const watcher = watch(dir, { persistent: true }, reload);
        watcher.on('error', () => {
          watcher.close();
          watchers.delete(dir);
        });
        watchers.set(dir, watcher);
      } catch {
        /* 低频轮询会兜底，不让平台监听差异破坏可用性 */
      }
    }
  };
  const reload = () => {
    if (stopped) return;
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      try {
        raw = await collect(root);
        await syncWatchers();
        if (stopped) return;
        draw();
      } catch {
        /* 保留上一份可用快照；下一次文件事件或轮询继续尝试 */
      }
    }, DEBOUNCE_MS);
  };

  await syncWatchers();

  draw();
  timer = setInterval(draw, TICK_MS);
  pollTimer = setInterval(reload, POLL_MS);

  await new Promise((resolve) => {
    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      clearInterval(pollTimer);
      clearTimeout(debounce);
      for (const w of watchers.values()) w.close();
      watchers.clear();
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
      process.stdout.write('\n');
      resolve();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
  return EXIT.OK;
}

export async function run(argv, ctx) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      // 未知选项（--out/--serve/--output）由 parseArgs 抛错 → usage exit 3，
      // 不得静默忽略（A37 硬约束 4 / 验收 5）。
      options: {
        watch: { type: 'boolean', default: false },
        json: { type: 'boolean', default: false },
        line: { type: 'boolean', default: false },
      },
      allowPositionals: false,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }

  const root = ctx.cwd;
  const projectName = path.basename(root);
  const modeCount = [values.line, values.watch, values.json].filter(Boolean).length;
  if (modeCount > 1) throw usageError('--line、--watch、--json 不能同时使用');
  const projectDetected = (await findProjectRoot(root)) !== null;

  // `--line` 恒 exit 0 且恒输出单行（D-A39-01）：statusLine 的宿主拿到非零退出码
  // 只会显示一片空白，探针当场失效——而它正是「会话开在错目录」的可视化。
  if (values.line) {
    try {
      // 「是不是项目」的判据**必须复用 findProjectRoot**（.vima/ 或 docs/lifecycle.json）。
      // 初版在此自造了「查 .vima/ 目录」的第二套判据，对尚未 init 出 .vima/ 的
      // PLANNING 期项目当场误报「非 vima 项目根」——单测抓到。判据只能有一个真源。
      if (!projectDetected) {
        process.stdout.write('vima ⚠ 非 vima 项目根\n');
        return EXIT.OK;
      }
      process.stdout.write(await once(root, 'line', projectName, true));
    } catch {
      process.stdout.write('vima ⚠ 状态不可读\n');
    }
    return EXIT.OK;
  }

  if (values.watch && projectDetected) return runWatch(root, projectName);

  process.stdout.write(await once(root, values.json ? 'json' : 'table', projectName, projectDetected));
  return EXIT.OK;
}
