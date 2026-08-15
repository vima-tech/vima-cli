// lib/model/progress.mjs —— 运行状态聚合器（A37；契约 §5）
//
// 职责：把「任务 frontmatter + journal.jsonl + lifecycle」三份已有数据，聚合成
// `vima status` 需要的四组事实——证据强度三档进度 / 分组任务量 / 阶段用时 / 速率与 ETA。
//
// 纪律（与 lib/model/journal.mjs 逐条一致，不为本项破例）：
//   1. **只读不写**，不碰文件系统之外的任何状态。
//   2. **不读系统时钟**——`now` 一律由命令层显式注入。模型保持纯函数：
//      同样的输入必得同样的输出，单测才不需要打桩时间。status 的产物是 stdout
//      而非仓库文件（A37 硬约束 4），故「含 now」不违反渲染器字节确定性硬约束，
//      但那道口子只开在命令层，不开在这里。
//   3. **只呈现差值，不判定对错**（D-A37-02）：`trustSignals` 输出的是「同一事实的
//      多个来源各说了什么」，成因判定与修复建议属 doctor / converge，本模块不越界。
//   4. 遍历 journal **一律按行序，不按 `ts` 排序**（D-A35-11：并发追加下 ts 不单调）。

/** 任务 frontmatter 的 status 五态（与 lib/model/tasks.mjs 的 STATUS_VALUES 同集）。 */
const STATUS_KEYS = ['pending', 'running', 'done', 'failed', 'blocked'];
/** side 三态（同 tasks.mjs 的 SIDE_VALUES）。 */
const SIDE_KEYS = ['backend', 'frontend', 'fullstack'];
/** layer 三态（同 tasks.mjs 的 LAYER_VALUES）。 */
const LAYER_KEYS = ['shared', 'business', 'pipeline'];
/** 无 app 字段（单端项目）的分组键。 */
export const NO_APP = '—';

/** ETA 最小样本数：低于此值一律拒绝外推（A37 规格 2）。 */
export const MIN_SAMPLE = 3;
/** 「最近窗口」上限：乐观端速率只看最后这么多次验收通过。 */
export const RECENT_WINDOW = 10;

function emptyCounts() {
  const c = { total: 0, verified: 0 };
  for (const k of STATUS_KEYS) c[k] = 0;
  return c;
}

function bump(bucket, status, isVerified) {
  bucket.total += 1;
  if (Object.hasOwn(bucket, status)) bucket[status] += 1;
  if (isVerified) bucket.verified += 1;
}

/**
 * 任务分组：总数 + 按 side / layer / app 各自的五态计数。
 *
 * app 键取 frontmatter 的 `app`（A16 端册）；单端项目该字段缺省，归入 `NO_APP`。
 * 三张表都**预置全部枚举键**（哪怕计数为 0）——呈现层不必判空，且新增一个 side
 * 时表格不会突然少一行。
 *
 * 每个桶除五态计数外还带 `verified`——**分组的「实际进度」必须与总进度同口径**，
 * 否则总表说「已验收 0」而分组表按 `status: done` 显示满格，等于在同一屏里
 * 自相矛盾。verifiedIds 缺省时该列恒 0（journal 未落地的项目如实显示 0，不显示 '—'：
 * 「没有证据」本身就是一个确定的事实，不是缺数据）。
 *
 * @param {Array<{id: string, fm: object}>} tasks loadTasks 的返回
 * @param {Set<string>|null} verifiedIds 已验收任务 id 集（taskEvidence().verified 的键集）
 */
export function groupTasks(tasks, verifiedIds = null) {
  const out = {
    total: tasks.length,
    byStatus: emptyCounts(),
    bySide: {},
    byLayer: {},
    byApp: {},
  };
  for (const k of SIDE_KEYS) out.bySide[k] = emptyCounts();
  for (const k of LAYER_KEYS) out.byLayer[k] = emptyCounts();

  for (const t of tasks) {
    const fm = t.fm ?? {};
    const status = typeof fm.status === 'string' ? fm.status : 'pending';
    const ver = verifiedIds !== null && verifiedIds.has(t.id);
    bump(out.byStatus, status, ver);
    if (Object.hasOwn(out.bySide, fm.side)) bump(out.bySide[fm.side], status, ver);
    if (Object.hasOwn(out.byLayer, fm.layer)) bump(out.byLayer[fm.layer], status, ver);
    const app = typeof fm.app === 'string' && fm.app !== '' ? fm.app : NO_APP;
    (out.byApp[app] ??= emptyCounts());
    bump(out.byApp[app], status, ver);
  }
  return out;
}

/**
 * 从 journal 事件里提取每个任务的 hook 采集证据（A37 规格 1）。
 *
 * `report` 事件由 post-write hook 采集（契约 §6.21），ref 形如
 * `<taskId>/<builder|verifier>/r<N>`——Agent 写的是报告文件，事件是 hook 写的，
 * 故它能证明「hook 确实观察到一次报告写入」，强于单改 frontmatter；报告内容仍由 Agent
 * 产出，所以它不是独立防伪或密码学证明。
 *
 * **按行序遍历**：`firstPass` 只保存每个任务首次 pass，供历史吞吐/ETA 使用；
 * `verified` 保存最新 verifier 事件仍为 pass 的任务，供当前进度使用。两者不得混用：
 * 历史上通过过，不等于重开或后续失败后仍处于已验收状态。
 *
 * **轨迹事件与全部事件必须分开计数**（D-A39-01）：journal 同时收 `cmd`（CLI 命令，
 * 人敲 `vima validate` 就有一条）、`guard`（规范命中）与 `report`（任务轨迹）。
 * 只有 `report` 能证明有任务在推进——把三者混成一个「最近活动」会让一个
 * 「没跑调度器、只手敲过几条命令」的项目显示成有活动，正是 A37 要治的病的变种。
 * sustain-v3 实测：58 条事件全是 `cmd`、`report` 0 条，而同期 79 个源文件在写。
 *
 * @param {Array<object>} events loadJournal 的返回
 * @returns {{ tracked: Set<string>, verified: Map<string, number>, firstPass: Map<string, number>,
 *             order: string[], lastEventTs: number|null, lastReportTs: number|null,
 *             totalEvents: number, reportEvents: number }}
 *   verified 的值是最新 pass 的毫秒时刻；firstPass/order 是首次 pass 的时间与行序，
 *   仅用于速率。ts 不可解析的 pass 不构成验收证据（宁缺勿假）。
 *   `reportEvents` 数的是 `kind === 'report'` 的**全部**条数（含 ref 格式不合法而
 *   未计入 tracked 的），使它与 journal 文件内容可逐条核对。
 */
export function taskEvidence(events) {
  const tracked = new Set();
  const verified = new Map();
  const firstPass = new Map();
  const order = [];
  let lastEventTs = null;
  let lastReportTs = null;
  let reportEvents = 0;

  for (const e of events) {
    const ts = Date.parse(e?.ts ?? '');
    if (Number.isFinite(ts)) lastEventTs = ts;
    if (e?.kind !== 'report') continue;
    reportEvents += 1;
    if (Number.isFinite(ts)) lastReportTs = ts;
    const m = /^(.+)\/(verifier|builder)\/r(\d+)$/.exec(String(e.ref ?? ''));
    if (!m) continue;
    const [, taskId, role] = m;
    tracked.add(taskId);
    if (role !== 'verifier') continue;
    if (e.outcome !== 'pass' || !Number.isFinite(ts)) {
      // 最新 verifier 行为 fail（或 pass 时间不可用）时，撤销当前验收态；历史首次 pass 保留供 ETA。
      verified.delete(taskId);
      continue;
    }
    verified.set(taskId, ts);
    if (!firstPass.has(taskId)) {
      firstPass.set(taskId, ts);
      order.push(taskId);
    }
  }
  return {
    tracked, verified, firstPass, order,
    lastEventTs, lastReportTs, totalEvents: events.length, reportEvents,
  };
}

/**
 * 当前有效验收集合。任务在 pass 之后被写成非 done，或 change reopen 水位晚于 pass 时，
 * 旧 pass 失效；若非 done 的更新时间早于 pass，则保留“验收已发生但 frontmatter 未回写”倒挂信号。
 */
export function currentVerifiedIds(tasks, evidence, reopenedAt = {}) {
  const out = new Set();
  for (const task of tasks) {
    const passAt = evidence.verified.get(task.id);
    if (!Number.isFinite(passAt)) continue;
    if (Number.isFinite(reopenedAt?.[task.id]) && passAt <= reopenedAt[task.id]) continue;
    const status = task.fm?.status;
    const updatedAt = Date.parse(task.fm?.updatedAt ?? '');
    // 同一毫秒无法区分“pass 后回写”与“回写后 pass”，保留证据；只有严格更晚才可证明任务被重开。
    if (status !== 'done' && Number.isFinite(updatedAt) && updatedAt > passAt) continue;
    out.add(task.id);
  }
  return out;
}

/**
 * 证据强度三档进度（A37 规格 1，本项核心）。
 *
 * 三档同屏并列的理由见 A37：sustain-v4 的这三个数是 21/0/0，
 * 单看任何一个都看不出问题。只报 claimed 等于把要治的病包装成绿色进度条。
 *
 * 不变式 **claimed ≥ tracked ≥ verified**。倒挂不是「错误」而是一种差值：
 * 常见成因是任务确实做完了但没人回写 frontmatter——判定成因不归本模块（D-A37-02）。
 *
 * 口径统一：三档的分母都是任务总数；tracked/verified 只统计**存在于任务清单里的**
 * taskId——journal 里可能留有已删除任务的历史事件，计进来会让分子超过分母。
 */
export function evidenceTiers(tasks, evidence, reopenedAt = {}) {
  const ids = new Set(tasks.map((t) => t.id));
  const currentVerified = currentVerifiedIds(tasks, evidence, reopenedAt);
  const total = tasks.length;
  const claimed = tasks.filter((t) => t.fm?.status === 'done').length;
  let tracked = 0;
  let verified = 0;
  for (const id of ids) {
    if (evidence.tracked.has(id)) tracked += 1;
    if (currentVerified.has(id)) verified += 1;
  }
  return {
    total,
    claimed,
    tracked,
    verified,
    gaps: { claimedVsTracked: claimed - tracked, trackedVsVerified: tracked - verified },
    inverted: tracked > claimed || verified > tracked,
  };
}

/** 毫秒差，负值夹到 0（时钟回拨 / 未来时间戳不该产生负用时）。 */
function span(a, b) {
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, b - a) : null;
}

/**
 * 阶段时间线（A37 规格 2）：取 `lifecycle.phaseHistory` **已落盘**的时间戳。
 *
 * 当前阶段（`completedAt` 为 null）用 `now − enteredAt`，并标 `current: true`。
 * `now` 由调用方注入——本模块不读时钟（纪律 2）。
 *
 * @returns {{ phases: Array<{phase, enteredAt, completedAt, ms, current}>,
 *             startedAt: number|null, totalMs: number|null }}
 *   startedAt 取 phaseHistory 中最早一个可解析的时间戳（enteredAt 优先，
 *   BOOTSTRAP 的 enteredAt 恒为 null，故实际落在它的 completedAt = init 完成时刻）。
 */
export function phaseTimeline(lifecycle, now) {
  const hist = Array.isArray(lifecycle?.phaseHistory) ? lifecycle.phaseHistory : [];
  const phases = [];
  let startedAt = null;

  for (const h of hist) {
    const a = Date.parse(h?.enteredAt ?? '');
    const b = Date.parse(h?.completedAt ?? '');
    for (const t of [a, b]) {
      if (Number.isFinite(t) && (startedAt === null || t < startedAt)) startedAt = t;
    }
    const current = !Number.isFinite(b) && Number.isFinite(a);
    phases.push({
      phase: h?.phase ?? null,
      enteredAt: h?.enteredAt ?? null,
      completedAt: h?.completedAt ?? null,
      ms: current ? span(a, now) : span(a, b),
      current,
    });
  }
  return { phases, startedAt, totalMs: span(startedAt, now) };
}

/** 取某阶段的进入时刻（毫秒）；没进过 → null。 */
export function phaseEnteredAt(lifecycle, phase) {
  const hist = Array.isArray(lifecycle?.phaseHistory) ? lifecycle.phaseHistory : [];
  for (const h of hist) {
    if (h?.phase !== phase) continue;
    const t = Date.parse(h?.enteredAt ?? '');
    if (Number.isFinite(t)) return t;
  }
  return null;
}

/**
 * 速率与剩余时间估算（A37 规格 2）。
 *
 * **只用 verified 事件的 hook 落盘 `ts`**——它是全仓唯一「每任务完成」且由采集旁路
 * 写入时间的信号。刻意不用 frontmatter `updatedAt` 计算速率：它是 Agent 写的字符串，
 * sustain-v4 实测 68 条被盖成同一时刻、6 条时间戳超前真实时钟 1–3.5 小时，
 * 用它算速率会得到一条完全虚构的曲线，且项目越出问题它越虚构（D-A37-03）。
 *
 * 两端估计：
 *   - **保守端** = 全程均速：`k / (now − 起算点)`，分母含首次完成前的全部准备时间；
 *   - **乐观端** = 最近窗口均速：窗口内 `(w−1) / (末次 − 首次)`，只看近况。
 * 二者构成区间。样本 < MIN_SAMPLE 一律 `estimable: false` 并说明还缺几个——
 * 不给一个看起来很像数字的数字（与 A32「不宣称采集不到的等级」同源）。
 *
 * @param {object} p
 * @param {number[]} p.completions 首次验收通过的毫秒时刻，**按行序**（不得重排）
 * @param {number} p.remaining 尚未验收的任务数
 * @param {number} p.now 命令层注入的当前时刻
 * @param {number|null} p.since 起算点（DEVELOPING 进入时刻）；null → 退回首次完成时刻
 * @returns {{estimable: boolean, reason: string|null, samples: number,
 *            remaining: number, ratePerHour: {conservative, optimistic}|null,
 *            etaMs: {conservative, optimistic}|null}}
 */
export function estimate({ completions, remaining, now, since }) {
  const k = completions.length;
  const base = {
    samples: k,
    remaining,
    ratePerHour: null,
    etaMs: null,
  };
  if (remaining <= 0) {
    return {
      ...base,
      estimable: false,
      reason: k === 0 ? '尚无可估算任务或验收样本' : '全部任务已验收，无剩余可估',
    };
  }
  if (k < MIN_SAMPLE) {
    return {
      ...base,
      estimable: false,
      reason: `已验收 ${k} 个，需 ≥${MIN_SAMPLE} 个带时间的验收样本才估算（还缺 ${MIN_SAMPLE - k} 个）`,
    };
  }

  if (!Number.isFinite(now)) {
    return { ...base, estimable: false, reason: '当前时间不可解析，拒绝估算' };
  }
  if (Number.isFinite(since) && since > now) {
    return { ...base, estimable: false, reason: '阶段进入时间位于未来，时间异常，拒绝估算' };
  }
  if (completions.some((t) => !Number.isFinite(t) || t > now)) {
    return { ...base, estimable: false, reason: '验收样本含未来或不可解析时间，拒绝估算' };
  }

  // 保守端：全程均速。起算点缺失时退回首次完成时刻（此时分母不含准备期，估计会偏乐观，
  // 但仍是两端里更保守的那一端——不因缺一个字段就放弃估算）。
  const from = Number.isFinite(since) ? since : completions[0];
  const spanAll = now - from;
  if (!(spanAll > 0)) {
    return { ...base, estimable: false, reason: '验收时间跨度不足，拒绝估算' };
  }
  const rateAll = k / spanAll; // 任务 / 毫秒

  // 乐观端：最近窗口。窗口内全部落在同一毫秒（并发验收）时退化为 null，
  // 由下方 `?? rateAll` 兜底——不做除零。
  const w = Math.min(k, RECENT_WINDOW);
  const win = completions.slice(k - w);
  const spanRecent = win[w - 1] - win[0];
  const rateRecent = w > 1 && spanRecent > 0 ? (w - 1) / spanRecent : null;

  const fast = Math.max(rateAll, rateRecent ?? rateAll);
  const slow = Math.min(rateAll, rateRecent ?? rateAll);
  const H = 3600000;
  return {
    ...base,
    estimable: true,
    reason: null,
    ratePerHour: {
      conservative: Math.round((slow * H) * 100) / 100,
      optimistic: Math.round((fast * H) * 100) / 100,
    },
    etaMs: {
      conservative: Math.round(remaining / slow),
      optimistic: Math.round(remaining / fast),
    },
  };
}

/**
 * DEVELOPING 进入后多久仍无任何任务轨迹，才把「零轨迹」呈现为信号。
 *
 * 低于此值只说明「刚进开发期」，报出来是噪声：第一批派发到 Builder 写出第一份报告
 * 本就需要几分钟。取 10 分钟——sustain-v3 实测第 13 分钟时已能看出异常。
 */
export const NO_TRAJECTORY_AFTER_MS = 10 * 60 * 1000;

/**
 * 同一事实的多来源差值（A37 规格 1 / D-A37-02）。
 *
 * **只呈现，不裁定**：每条只回答「谁说了什么」，不回答「谁错了、该怎么改」。
 * 成因判定属 doctor / converge——status 越界去判定就会长成第二个 doctor，
 * 且必然与它们的规则表分叉。
 *
 * 封闭集五条：前四条是「同一个数在仓库里有几个不一样的副本」——
 *   tier-gap / tier-inverted（三档之间）、stats-stale（lifecycle.taskStats）、
 *   plan-stale（batch-plan.json）；
 * 第五条 no-trajectory 补的是**全零盲区**（D-A39-02）：上述四条全部依赖「两个来源
 * 对不上」，而 claimed = tracked = verified = 0 时它们一条都不触发——恰恰是最该被
 * 看见的状态。sustain-v3 实测：三档全零、trustSignals 返回空数组，而同期 79 个源文件
 * 正在被写、零份 builder 报告落盘、调度器从未启动。「没有任何差值」不等于「没有问题」，
 * 也可能是「根本没有人在记账」。
 */
export function trustSignals({ tiers, groups, lifecycle, batchPlan, phase, developingMs, evidence, scheduler }) {
  const out = [];
  const { claimed, tracked, verified } = tiers;

  if (
    phase === 'DEVELOPING'
    && tiers.total > 0
    && tracked === 0
    && Number.isFinite(developingMs)
    && developingMs >= NO_TRAJECTORY_AFTER_MS
  ) {
    const mins = Math.round(developingMs / 60000);
    const others = Number.isFinite(evidence?.totalEvents) ? evidence.totalEvents : 0;
    const parts = [
      `开发期已进行约 ${mins} 分钟，${tiers.total} 个任务中 0 个有轨迹事件（journal 的 report 条数为 ${evidence?.reportEvents ?? 0}）`,
    ];
    if (others > 0) parts.push(`journal 另有 ${others} 条非轨迹事件（命令/规范），它们不代表任务在推进`);
    // 调度器状态只报「文件说了什么」，不推断原因、不给建议（判定归 doctor）。
    if (scheduler && scheduler.exists === false) parts.push('.vima/go-state.json 不存在或不可解析');
    else if (scheduler?.stopReason) parts.push(`.vima/go-state.json 记 stopReason=${scheduler.stopReason}`);
    out.push({ id: 'no-trajectory', message: parts.join('；') });
  }

  if (claimed > tracked) {
    out.push({
      id: 'tier-gap',
      message:
        `${claimed - tracked} 个任务 frontmatter 标 done，但 journal 里没有它们的 builder/verifier 事件` +
        '（仅呈现两个来源的记录差值）',
    });
  }
  if (tracked > verified) {
    out.push({
      id: 'tier-unverified',
      message: `${tracked - verified} 个任务有 builder/verifier 事件但没有当前有效的验收通过事件`,
    });
  }
  if (tiers.inverted) {
    out.push({
      id: 'tier-inverted',
      message: '三档倒挂：有轨迹/已验收数量多于 frontmatter 标 done 的数量',
    });
  }

  const actual = {
    total: tiers.total,
    done: claimed,
    pending: groups?.byStatus?.pending,
    running: groups?.byStatus?.running,
    failed: groups?.byStatus?.failed,
    blocked: groups?.byStatus?.blocked,
  };
  const differences = (stats) => ['total', 'pending', 'running', 'done', 'failed', 'blocked']
    .filter((key) => Number.isFinite(stats?.[key]) && Number.isFinite(actual[key]) && stats[key] !== actual[key])
    .map((key) => `${key}=${stats[key]}/${actual[key]}`);

  const st = lifecycle?.taskStats ?? {};
  const lifecycleDiff = differences(st);
  if (lifecycleDiff.length > 0) {
    out.push({
      id: 'stats-stale',
      message: `lifecycle.taskStats 与任务 frontmatter 实算存在差值（来源值/实算值：${lifecycleDiff.join('，')}；` +
        `记录更新于 ${st.updatedAt ?? '未知'}）`,
    });
  }
  const planDiff = differences(batchPlan?.stats);
  if (planDiff.length > 0) {
    out.push({
      id: 'plan-stale',
      message: `batch-plan.json stats 与任务 frontmatter 实算存在差值（来源值/实算值：${planDiff.join('，')}）`,
    });
  }
  return out;
}
