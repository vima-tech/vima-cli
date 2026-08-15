// lib/model/journal.mjs —— 过程轨迹归集器（A36；契约 §5）
//
// 出处与边界：本模块原为 lib/commands/retro.mjs 的私有实现。A36 引入第二个消费方
// （render-journal 人类审核视图）后抽出，供 retro / render-journal 共用；A35 的
// journal.jsonl 聚合将来也落这里（D-A36-02：先抽再加分支，比先加进 retro 再搬出来
// 少一次改动）。抽取成本记在 A36 名下，retro 行为零变化。
//
// 纪律：只读不写；**不读系统时钟**（时间一律取输入文件已落盘的字段）——
// retro 的「两次运行字节一致」与 render-journal 的字节确定性都依赖这一条。
import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';

const REPORTS_DIR = '.vima/reports';
const JOURNAL_REL = '.vima/reports/journal.jsonl';
const KINDS = new Set(['cmd', 'report', 'guard']);
const RUNTIME_RE = /^runtime-errors(?:\.[^.]+)?\.jsonl$/;
/** V-INT 规则族（A20）：retro 与 render-journal 同序呈现，避免两处各写一份。 */
export const V_INT_RULES = ['V-INT-01', 'V-INT-02', 'V-INT-03', 'V-INT-04', 'V-INT-05'];

/** 计数器：把数组按 key 聚成 {key: n}（key 升序由 stableStringify 保证）。 */
export function tally(items, keyOf) {
  const out = {};
  for (const it of items) {
    const k = keyOf(it);
    if (k === null || k === undefined || k === '') continue;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** 读 JSON，坏文件/缺文件一律返回 null（过程视图不该因单个坏报告失败）。 */
export async function readJsonSafe(p) {
  try {
    return JSON.parse(await readFile(p, 'utf8'));
  } catch {
    return null;
  }
}

/** 阶段时长：取 phaseHistory 已落盘的时间戳作差，缺则 null——不读系统时钟（确定性）。 */
export function phaseDurations(lifecycle) {
  const hist = Array.isArray(lifecycle?.phaseHistory) ? lifecycle.phaseHistory : [];
  return hist.map((h) => {
    const a = Date.parse(h?.enteredAt ?? '');
    const b = Date.parse(h?.completedAt ?? '');
    const days = Number.isFinite(a) && Number.isFinite(b)
      ? Math.round(((b - a) / 86400000) * 10) / 10
      : null;
    return { phase: h?.phase ?? null, days };
  });
}

/**
 * 读 journal.jsonl（A35，契约 §6.21）→ 事件数组。
 *
 * **顺序由文件行序保证，不由 `ts` 保证**（D-A35-11）：A18 允许 10 个 Builder 并发，
 * 多条事件可能落在同一毫秒；`O_APPEND` 保证写入顺序，不保证 `ts` 单调。
 * 消费端计算序数指标一律按行序，**不得按 `ts` 排序**——否则同毫秒时顺序不定，
 * retro 的字节一致判据会随机失败。
 *
 * 坏行逐行跳过（不整份丢弃）：并发追加理论上仍可能撕行，一条坏行不该毁掉整条曲线。
 */
export async function loadJournal(root) {
  let text;
  try {
    text = await readFile(path.join(root, JOURNAL_REL), 'utf8');
  } catch {
    return []; // 未落地 / 未开启 / 换 clone → 空，消费方退化回无时间维行为，不报错
  }
  const out = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    try {
      const o = JSON.parse(line);
      if (o && typeof o === 'object' && KINDS.has(o.kind)) out.push(o);
    } catch {
      /* 撕行/坏行跳过 */
    }
  }
  return out;
}

/**
 * journal 派生指标（A35 规格 4 的三项聚合）。**全部按行序，不读 ts。**
 *
 * 脱敏（A21 硬约束的延伸）：`report` 事件的 `ref` 含 taskId，本函数**一律先剥掉**
 * 再聚合——只留轮次与结果。`guard` 的 `ref` 本就是封闭枚举，可原样出。
 * 原始 `ts` 不出（无复盘价值，且暴露客户项目工期）。
 */
export function journalMetrics(events) {
  const guardTotal = {};   // 规范 → 命中次数
  const guardLastAt = {};  // 规范 → 最后一次命中的行序（0-based）
  const rounds = {};       // taskId → 该任务出现过的轮次结果（仅用于算形态，不出 id）
  const cmdFail = {};      // 命令 → 非零退出次数

  events.forEach((e, i) => {
    if (e.kind === 'guard') {
      guardTotal[e.ref] = (guardTotal[e.ref] ?? 0) + 1;
      guardLastAt[e.ref] = i;
      return;
    }
    if (e.kind === 'cmd') {
      if (e.outcome === 'fail') cmdFail[e.ref] = (cmdFail[e.ref] ?? 0) + 1;
      return;
    }
    // report：ref = <taskId>/<verifier|builder>/r<N>——剥 taskId，只留轮次与结果
    const m = /^(.+)\/(verifier|builder)\/r(\d+)$/.exec(String(e.ref ?? ''));
    if (!m || m[2] !== 'verifier') return;
    const bucket = (rounds[m[1]] ??= {});
    bucket[Number(m[3])] = e.outcome === 'pass';
  });

  // 命中→修复曲线：最后一次命中落在前半程还是后半程（区分「一次性踩坑」与「到最后还在踩」）
  const total = events.length;
  const guardCurve = Object.keys(guardTotal).sort().map((ref) => ({
    ref,
    hits: guardTotal[ref],
    lastHalf: total > 1 ? (guardLastAt[ref] >= Math.floor(total / 2) ? 'late' : 'early') : 'early',
  }));

  // 验收轮次形态：r1 直过 / r1 挂到 r2 才过 / 至今未过
  let r1Pass = 0;
  let recovered = 0;
  let neverPass = 0;
  for (const byRound of Object.values(rounds)) {
    const ns = Object.keys(byRound).map(Number).sort((a, b) => a - b);
    if (ns.length === 0) continue;
    if (byRound[ns[0]] === true) r1Pass += 1;
    else if (ns.some((n) => byRound[n] === true)) recovered += 1;
    else neverPass += 1;
  }

  return {
    events: total,
    guardCurve,
    verification: { tasks: Object.keys(rounds).length, r1Pass, recovered, neverPass },
    cmdFail: Object.fromEntries(Object.entries(cmdFail).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
}

/** 聚合 .vima/reports/ 下的子代理报告与既有机检报告（目录缺失 → 全零对象，不抛）。 */
export async function collectReports(root) {
  const dir = path.join(root, REPORTS_DIR);
  let names;
  try {
    names = (await readdir(dir)).sort();
  } catch (err) {
    if (err.code === 'ENOENT') names = [];
    else throw err;
  }

  const verification = { reports: 0, maxRound: 0, points: 0, failedPoints: 0, waived: 0, ngViolations: 0 };
  const shared = { changeRequests: 0 };
  let runtimeErrors = 0;
  // 明细：**含 taskId**，只供带标识的消费方（render-journal）使用；
  // 脱敏消费方（retro，A21 默认脱敏）逐字段显式取值，不得取用本键。
  const openPoints = [];

  for (const name of names) {
    if (RUNTIME_RE.test(name)) {
      const text = await readFile(path.join(dir, name), 'utf8');
      runtimeErrors += text.split('\n').filter((l) => l.trim() !== '').length;
      continue;
    }
    if (name.endsWith('-verifier.json')) {
      const data = await readJsonSafe(path.join(dir, name));
      if (!data) continue;
      verification.reports += 1;
      if (Number.isFinite(data.round)) verification.maxRound = Math.max(verification.maxRound, data.round);
      for (const p of Array.isArray(data.points) ? data.points : []) {
        if (!p || typeof p !== 'object') continue;
        verification.points += 1;
        const label = typeof p.point === 'string' ? p.point : '';
        const isNg = /^NG-\d{2}\s*越界/.test(label);
        if (isNg) verification.ngViolations += 1;
        if (p.passed === true) continue;
        const taskId = typeof data.taskId === 'string' && data.taskId !== '' ? data.taskId : name.replace(/-verifier\.json$/, '');
        if (p.waived === true && !isNg) {
          verification.waived += 1;
          openPoints.push({ taskId, point: label, kind: 'waived' });
        } else {
          verification.failedPoints += 1;
          openPoints.push({ taskId, point: label, kind: isNg ? 'ng' : 'failed' });
        }
      }
      continue;
    }
    if (name.endsWith('-builder.json')) {
      const data = await readJsonSafe(path.join(dir, name));
      if (data && data.sharedChangeRequest !== null && data.sharedChangeRequest !== undefined) {
        shared.changeRequests += 1;
      }
    }
  }

  const convergence = await readJsonSafe(path.join(dir, 'convergence.json'));
  const conv = { openPoints: 0, unmarkedDone: 0 };
  for (const r of V_INT_RULES) conv[r] = 0;
  const findings = [];
  if (convergence) {
    for (const f of Array.isArray(convergence.findings) ? convergence.findings : []) {
      if (!f || typeof f !== 'object') continue;
      if (Object.hasOwn(conv, f.rule)) conv[f.rule] += 1;
      findings.push({
        rule: typeof f.rule === 'string' ? f.rule : '（缺）',
        level: typeof f.level === 'string' ? f.level : null,
        key: typeof f.key === 'string' ? f.key : null,
        message: typeof f.message === 'string' ? f.message : '',
        owners: Array.isArray(f.owners) ? f.owners : [],
      });
    }
    conv.openPoints = convergence.summary?.openPoints ?? 0;
    conv.unmarkedDone = convergence.summary?.unmarkedDone ?? 0;
  }

  const plan = await readJsonSafe(path.join(dir, 'batch-plan.json'));
  const batches = plan && Array.isArray(plan.batches)
    ? {
        count: plan.batches.length,
        maxParallel: plan.maxParallel ?? null,
        sizes: plan.batches.map((b) => (Array.isArray(b.tasks) ? b.tasks.length : 0)),
        levels: new Set(plan.batches.map((b) => `${b.layer}:${b.level}`)).size,
      }
    : { count: 0, maxParallel: null, sizes: [], levels: 0 };

  const val = await readJsonSafe(path.join(dir, 'planning-validation.json'));
  const planning = {
    pendingConfirm: Array.isArray(val?.pendingConfirm) ? val.pendingConfirm.length : 0,
    ruleHits: tally([...(val?.errors ?? []), ...(val?.warnings ?? [])], (e) => e?.rule),
  };

  return {
    verification,
    shared,
    runtime: { errors: runtimeErrors },
    convergence: conv,
    batches,
    planning,
    details: { openPoints, findings }, // 含 taskId——见上方脱敏说明
  };
}
