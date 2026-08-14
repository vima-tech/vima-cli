// vima retro —— 项目复盘的确定性采集（A21；契约 §6.14 / 设计 §19.15）
// 离线、只读、默认脱敏。项目跑完那一刻磁盘上躺着最完整的一手证据（retryCount 分布、
// V-INT 命中、sharedChangeRequest、豁免与越界、批次形态、validate 规则命中分布），
// 过后即散——A18/A20 都是靠事后人工重建证据才立的项。本命令把采集做成确定性动作。
//
// 边界（守既有纪律）：不联网（`vima upgrade` 是全仓唯一联网命令）、不提交、不改任何产物。
// 交互询问与 gh issue create 都在工作区层（go.md 步骤 6）。
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';
import { EXIT, usageFromParseArgs, precondition } from '../util/errors.mjs';
import { atomicWriteFile, stableStringify, fileExists } from '../util/fs.mjs';
import { loadTasks } from '../model/tasks.mjs';
import { loadContracts } from '../model/contracts.mjs';
import { loadSpec } from '../model/spec.mjs';
import { loadLifecycle } from '../model/lifecycle.mjs';
import { resolveApps } from '../model/apps.mjs';

const JSON_REL = '.vima/reports/retro.json';
const MD_REL = 'docs/retro/vima-feedback.md';
const REPORTS_DIR = '.vima/reports';
const COVERAGE_REL = 'docs/coverage-matrix.md';
const REPO = 'vima-tech/vima-cli';
const RUNTIME_RE = /^runtime-errors(?:\.[^.]+)?\.jsonl$/;
const V_INT_RULES = ['V-INT-01', 'V-INT-02', 'V-INT-03', 'V-INT-04', 'V-INT-05'];

/** 计数器：把数组按 key 聚成 {key: n}（key 升序由 stableStringify 保证）。 */
function tally(items, keyOf) {
  const out = {};
  for (const it of items) {
    const k = keyOf(it);
    if (k === null || k === undefined || k === '') continue;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** 读 JSON，坏文件/缺文件一律返回 null（复盘不该因单个坏报告失败）。 */
async function readJsonSafe(p) {
  try {
    return JSON.parse(await readFile(p, 'utf8'));
  } catch {
    return null;
  }
}

/** 阶段时长：取 phaseHistory 已落盘的时间戳作差，缺则 null——不读系统时钟（确定性）。 */
function phaseDurations(lifecycle) {
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

/** 聚合 .vima/reports/ 下的子代理报告与既有机检报告。 */
async function collectReports(root) {
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
        const isNg = /^NG-\d{2}\s*越界/.test(typeof p.point === 'string' ? p.point : '');
        if (isNg) verification.ngViolations += 1;
        if (p.passed === true) continue;
        if (p.waived === true && !isNg) verification.waived += 1;
        else verification.failedPoints += 1;
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
  if (convergence) {
    for (const f of Array.isArray(convergence.findings) ? convergence.findings : []) {
      if (Object.hasOwn(conv, f.rule)) conv[f.rule] += 1;
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

  return { verification, shared, runtime: { errors: runtimeErrors }, convergence: conv, batches, planning };
}

/**
 * 观察项：阈值驱动的**静态表**（条件 → 观察句 + 建议落点），命中才输出。
 * 每条 target 必须指向 vima-cli 的框架资产，不指向业务代码——反哺的是框架，不是项目。
 * 这里不做「AI 自由发挥的总结」：那既不可验证也不可跨项目比较。
 */
function observationsOf(d) {
  const out = [];
  const add = (id, signal, note, target) => out.push({ id, signal, note, target });
  const total = d.tasks.total;

  if (total > 0 && d.tasks.retried / total > 0.3) {
    add('OBS-retry', `retried/total = ${Math.round((d.tasks.retried / total) * 100)}%`,
      '超过三成任务需要重试才通过——Builder 一次做不对，通常是验收清单太粗或上下文包缺料，不是模型不行',
      'templates/*/planning/_template-*.md 验收清单粒度 · lib/commands/context.mjs 打包面');
  }
  if (d.tasks.failed > 0 || d.tasks.blocked > 0) {
    add('OBS-failed', `failed=${d.tasks.failed} blocked=${d.tasks.blocked}`,
      '存在重试 2 次仍未通过的任务——记录其形态（哪类任务、卡在哪条验收）比记录数量更有价值',
      '设计 §10.6 失败重试与降级 · vima-builder.md 分步执行');
  }
  if (d.convergence['V-INT-02'] > 0 || d.convergence['V-INT-03'] > 0) {
    add('OBS-conflict', `V-INT-02=${d.convergence['V-INT-02']} V-INT-03=${d.convergence['V-INT-03']}`,
      '出现跨任务重复/越界实现——说明任务拆解时接口责任田划分不清，或 Builder 上下文里看不到边界',
      'planning-guide 任务拆解节拍（apis 声明率）· lib/commands/context.mjs 契约切片');
  }
  if (d.convergence['V-INT-04'] > 0) {
    add('OBS-orphan', `V-INT-04=${d.convergence['V-INT-04']}`,
      '契约授权端无调用——要么联调断点，要么契约里有从未被用到的接口（规格冗余）',
      'V-CON-02 孤儿接口规则的判据是否该收紧');
  }
  if (d.shared.changeRequests > 0) {
    add('OBS-shared', `sharedChangeRequest=${d.shared.changeRequests}`,
      '业务批次期间提出共享层变更——共享层前置（批次 0）没覆盖到的热点，属可预见项则应写进规划引导',
      'planning-guide 2.1 单点热文件清单 · 设计 §10.7 策略一');
  }
  if (d.verification.ngViolations > 0) {
    add('OBS-ng', `NG 越界=${d.verification.ngViolations}`,
      '实现越出「本期不做」边界——边界画在了 spec 里但没有传达到施工面',
      'A13 vima:non-goals 在 vima context 里的呈现方式');
  }
  if (d.verification.waived > 0) {
    add('OBS-waived', `waived=${d.verification.waived}`,
      '存在豁免点位——豁免用得越多，验收信号越弱；应核对每条豁免是否都有用户裁定来源',
      'vima-verifier.md 豁免纪律 · §6.9 豁免语义');
  }
  if (d.batches.count > 0 && d.batches.sizes.some((n) => n === 1) && d.batches.count > 6) {
    add('OBS-batch', `批次 ${d.batches.count} 个，含 ${d.batches.sizes.filter((n) => n === 1).length} 个单任务批`,
      '单任务批偏多意味着依赖链过长、并行度吃不满——多为「前端依赖后端」这类可去除的假依赖',
      'A18 规格 2 前端默认依赖 · lib/commands/plan.mjs 分层算法');
  }
  const topRule = Object.entries(d.planning.ruleHits).sort((a, b) => b[1] - a[1])[0];
  if (topRule && topRule[1] >= 5) {
    add('OBS-rule', `${topRule[0]} 命中 ${topRule[1]} 次`,
      '同一条校验规则被反复违反——规则本身没问题时，通常是规划引导或模板没把这条要求讲清楚',
      `该规则对应的 planning 资产与 validate.checklist 条目（${topRule[0]}）`);
  }
  if (d.planning.pendingConfirm > 0) {
    add('OBS-pending', `pendingConfirm=${d.planning.pendingConfirm}`,
      '仍有未裁定的推断项——approve 本应阻断，出现残留说明流程有绕过口',
      'lib/commands/approve.mjs 阻断口径');
  }
  if (d.runtime.errors > 0) {
    add('OBS-runtime', `runtime errors=${d.runtime.errors}`,
      '浏览器侧真实报错未清零——比静态检查更接近「跑得通」，应纳入收口判据讨论',
      'A7 运行时证据 · A20 converge 是否该把运行时错误纳入退出码');
  }
  return out;
}

/** issue 正文（与 JSON 同源渲染，不分别维护）。 */
function renderMarkdown(d, opts) {
  const L = [];
  const kv = (rows) => {
    L.push('| 项 | 值 |', '|---|---|');
    for (const [k, v] of rows) L.push(`| ${k} | ${v} |`);
    L.push('');
  };
  L.push('# 项目复盘反哺：<一句话说明这是什么项目（人工填写，勿写客户名）>', '');
  L.push('> 由 `vima retro` 从项目产物确定性生成（A21）。'
    + `${d.anonymized ? '**已脱敏**：只含计数与分布，不含任务/接口/页面标识。' : '**含项目标识**（--with-ids）。'}`, '');
  L.push('## 项目指纹', '');
  kv([
    ['模板', d.fingerprint.templateId ?? '(未知)'],
    ['vima 版本', d.fingerprint.vimaVersion ?? '(未知)'],
    ['端数（A16）', d.fingerprint.apps],
    ['阶段时长', d.fingerprint.phases.map((p) => `${p.phase}: ${p.days === null ? '—' : `${p.days}d`}`).join(' · ') || '—'],
  ]);
  L.push('## 规模', '');
  kv([
    ['任务', `${d.tasks.total}（shared ${d.tasks.byLayer.shared ?? 0} / business ${d.tasks.byLayer.business ?? 0} / pipeline ${d.tasks.byLayer.pipeline ?? 0}）`],
    ['页面 / 实体 / 规则 / 本期不做', `${d.scale.pages} / ${d.scale.entities} / ${d.scale.rules} / ${d.scale.nonGoals}`],
    ['契约接口 / 覆盖矩阵行', `${d.scale.contractApis} / ${d.scale.matrixRows}`],
    ['批次', `${d.batches.count} 个（maxParallel=${d.batches.maxParallel ?? '—'}，层数 ${d.batches.levels}，各批任务数 ${d.batches.sizes.join('/') || '—'}）`],
  ]);
  L.push('## 过程信号', '');
  kv([
    ['重试任务 / 最大重试次数', `${d.tasks.retried} / ${d.tasks.maxRetry}`],
    ['failed / blocked', `${d.tasks.failed} / ${d.tasks.blocked}`],
    ['声明 apis 的任务 / 用了 conflictsWith', `${d.tasks.declaredApis} / ${d.tasks.conflictsWith}`],
    ['Verifier 报告 / 最大轮次', `${d.verification.reports} / ${d.verification.maxRound}`],
    ['任务点 总数 / 未过 / 豁免 / NG 越界', `${d.verification.points} / ${d.verification.failedPoints} / ${d.verification.waived} / ${d.verification.ngViolations}`],
    ['集成对账（V-INT-01..05）', V_INT_RULES.map((r) => `${r.slice(-2)}:${d.convergence[r]}`).join(' ')],
    ['共享层变更请求', d.shared.changeRequests],
    ['pendingConfirm 残留 / 运行时错误', `${d.planning.pendingConfirm} / ${d.runtime.errors}`],
    ['**重试后仍做成**（重试机制救回来的任务）', d.worked.retriedThenDone],
  ]);
  const hits = Object.entries(d.planning.ruleHits).sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1));
  if (hits.length > 0) {
    L.push('### 校验规则命中分布（哪条规则最常被违反 = 框架引导最缺的地方）', '');
    L.push('| 规则 | 命中 |', '|---|---|');
    for (const [r, n] of hits.slice(0, 10)) L.push(`| ${r} | ${n} |`);
    L.push('');
  }
  L.push('## 观察项（阈值触发，附建议落点）', '');
  if (d.observations.length === 0) {
    L.push('本次没有触发任何阈值观察项——过程信号均在正常区间。', '');
  } else {
    for (const o of d.observations) {
      L.push(`- **${o.id}**（${o.signal}）：${o.note}`, `  - 建议落点：${o.target}`);
    }
    L.push('');
  }
  L.push('## 人工补充（CLI 采不到，请务必填写）', '');
  L.push('### 1. 有没有「想表达但框架表达不了」的东西？', '');
  L.push('<!-- 页面形态/交互/规格结构上被迫降级或绕过的地方。历次增补项（A14 分栏版面、',
    'A16 多端应用模型）都出自这一栏——这是最有价值的一段。 -->', '');
  L.push('### 2. 哪一步最费时间／最反复？', '');
  L.push('<!-- 主观感受即可，与上面的客观信号相互印证 -->', '');
  L.push('### 3. 有没有哪个机制明确「救了你一次」？', '');
  L.push('<!-- 例：guard-shared 拦下了误写共享层 / trace 抓出了假 taskId /',
    'converge 抓出了重复实现 / 某条 warn 让你在上线前发现了问题。',
    '缺口人人会记，「什么设计经受住了真实变更」没人记——没有这一栏，反哺回路会系统性地',
    '只积累「该改什么」，从不积累「该保留什么」，久而久之就会误改已验证的设计。 -->', '');
  L.push('### 4. 其他建议', '');
  L.push('', '---', '',
    `<sub>生成命令：\`vima retro${opts.withIds ? ' --with-ids' : ''}\` · 提交到 ${REPO}</sub>`);
  return `${L.join('\n')}\n`;
}

/** vima retro [--json] [--with-ids] */
export async function run(argv, ctx) {
  let opts;
  try {
    ({ values: opts } = parseArgs({
      args: argv,
      options: { json: { type: 'boolean' }, 'with-ids': { type: 'boolean' } },
      allowPositionals: false,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }
  const withIds = opts['with-ids'] === true;

  const root = ctx.cwd;
  // 同 plan/converge 的入口守卫（契约 §9 第 0 步）：非 vima 项目不凭空产出复盘。
  if (!(await fileExists(path.join(root, 'docs', 'tasks')))) {
    throw precondition(
      'NO_TASKS',
      '未找到 docs/tasks/ 目录（非 vima 项目或 PLANNING 未产出任务），无从复盘',
      'docs/tasks',
    );
  }

  const tasks = await loadTasks(root);
  const contracts = (await loadContracts(root, { tolerant: true })).filter((c) => c.module !== null);
  const roster = await resolveApps(root, { cliRoot: ctx.cliRoot });
  let lifecycle = null;
  try {
    lifecycle = await loadLifecycle(root);
  } catch {
    lifecycle = null; // 复盘不该因缺 lifecycle 失败：指纹记 null，如实呈现
  }
  let spec = null;
  try {
    spec = await loadSpec(root);
  } catch {
    spec = null;
  }

  let matrixRows = 0;
  try {
    const text = await readFile(path.join(root, COVERAGE_REL), 'utf8');
    matrixRows = text.split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('|') && l.endsWith('|'))
      .filter((l) => !/^\|[\s:|-]+\|$/.test(l)).length - 1; // 去表头
    if (matrixRows < 0) matrixRows = 0;
  } catch {
    matrixRows = 0;
  }

  const agg = await collectReports(root);
  const retried = tasks.filter((t) => (t.fm.retryCount ?? 0) > 0).length;

  const data = {
    schemaVersion: '1',
    anonymized: !withIds,
    fingerprint: {
      templateId: lifecycle?.templateId ?? null,
      vimaVersion: lifecycle?.vimaVersion ?? null,
      apps: roster.apps.length,
      phases: phaseDurations(lifecycle),
    },
    tasks: {
      total: tasks.length,
      byLayer: tally(tasks, (t) => t.fm.layer),
      bySide: tally(tasks, (t) => t.fm.side),
      retried,
      maxRetry: tasks.reduce((m, t) => Math.max(m, t.fm.retryCount ?? 0), 0),
      failed: tasks.filter((t) => t.fm.status === 'failed').length,
      blocked: tasks.filter((t) => t.fm.status === 'blocked').length,
      declaredApis: tasks.filter((t) => Array.isArray(t.fm.apis) && t.fm.apis.length > 0).length,
      conflictsWith: tasks.filter((t) => Array.isArray(t.fm.conflictsWith) && t.fm.conflictsWith.length > 0).length,
    },
    batches: agg.batches,
    convergence: agg.convergence,
    verification: agg.verification,
    shared: agg.shared,
    // A24：正面信号。A21 只采集异常（重试/冲突/豁免/越界），没有一项记录「哪个机制救了你」
    // ——长期只积累「该改什么」、从不积累「该保留什么」，会导致对已验证设计的误改。
    // 只放**磁盘上真实可得**的那一条：重试后仍然做成的任务 = 重试机制救回来的。
    // 不硬造其它确定性正面指标——「某规则曾命中后来被修好」在只有最新快照的报告体系里
    // 不可得，强行推断会产出假数据；其余正面证据走人工补充第 3 问。
    worked: {
      retriedThenDone: tasks.filter((t) => (t.fm.retryCount ?? 0) > 0 && t.fm.status === 'done').length,
    },
    planning: agg.planning,
    runtime: agg.runtime,
    scale: {
      pages: spec ? spec.pages.size : 0,
      entities: spec ? spec.entities.length : 0,
      rules: spec ? spec.rules.length : 0,
      nonGoals: spec ? spec.nonGoals.length : 0,
      contractApis: contracts.reduce((n, c) => n + c.apis.length, 0),
      matrixRows,
    },
  };
  data.observations = observationsOf(data);
  // --with-ids：附带项目标识（自用仓库时用；默认脱敏，泄露必须是显式动作）
  if (withIds) {
    data.ids = {
      retried: tasks.filter((t) => (t.fm.retryCount ?? 0) > 0).map((t) => t.id).sort(),
      failed: tasks.filter((t) => t.fm.status === 'failed').map((t) => t.id).sort(),
      blocked: tasks.filter((t) => t.fm.status === 'blocked').map((t) => t.id).sort(),
    };
  }

  const json = stableStringify(data);
  await atomicWriteFile(path.join(root, JSON_REL), json);
  let md = renderMarkdown(data, { withIds });
  if (withIds && (data.ids.retried.length > 0 || data.ids.failed.length > 0)) {
    md = md.replace('## 人工补充', `## 任务标识（--with-ids）\n\n- 重试过：${data.ids.retried.join('、') || '—'}\n- failed：${data.ids.failed.join('、') || '—'}\n- blocked：${data.ids.blocked.join('、') || '—'}\n\n## 人工补充`);
  }
  await atomicWriteFile(path.join(root, MD_REL), md);

  if (opts.json) {
    process.stdout.write(json);
  } else {
    const lines = [
      `📝 项目复盘已采集${withIds ? '（含标识）' : '（已脱敏：只含计数与分布）'}`,
      `   任务 ${data.tasks.total}（重试 ${data.tasks.retried} · failed ${data.tasks.failed}）│ 批次 ${data.batches.count} │ 接口 ${data.scale.contractApis} │ 页面 ${data.scale.pages}`,
      `   观察项 ${data.observations.length} 条${data.observations.length > 0 ? `：${data.observations.map((o) => o.id).join('、')}` : ''}`,
      `   issue 正文：${MD_REL}（人工补充段务必填写后再提）`,
      `   机读报告：${JSON_REL}`,
      `   反哺方式：确认内容后执行 gh issue create --repo ${REPO} --title "<标题>" --body-file ${MD_REL}`,
    ];
    process.stdout.write(`${lines.join('\n')}\n`);
  }
  return EXIT.OK;
}
