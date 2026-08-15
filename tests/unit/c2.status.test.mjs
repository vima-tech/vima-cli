// C2 单测：vima status 运行状态可观测（A37）
//
// 用例逐条对应 A37 的「验收判据」，编号写在用例名里——判据改了必须有用例跟着改，
// 免得规格与实现各自漂移（这正是 status 自己要治的病）。
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdtemp, cp, mkdir, writeFile, readFile, rm, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(HERE, '..', '..', 'bin', 'vima.mjs');
const GOLDEN = path.join(HERE, '..', 'fixtures', 'golden');

function runCli(cwd, args) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
}

async function makeCopy(t, prefix = 'vima-c2-status-') {
  const tmp = await mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(async () => rm(tmp, { recursive: true, force: true }));
  await cp(GOLDEN, tmp, { recursive: true });
  return tmp;
}

/** 把全部任务标成 done——复现 sustain-v4 的「自称完成」现场。 */
async function claimAllDone(tmp) {
  const dir = path.join(tmp, 'docs', 'tasks');
  for (const name of ['device-api-be.md', 'device-list-fe.md', 'full-test.md', 'shared-base.md']) {
    const p = path.join(dir, name);
    const text = await readFile(p, 'utf8');
    await writeFile(p, text.replace(/^status: .*$/m, 'status: done'));
  }
}

/** 追加 journal 事件（§6.21 五键封顶）。 */
async function appendJournal(tmp, rows) {
  const dir = path.join(tmp, '.vima', 'reports');
  await mkdir(dir, { recursive: true });
  await appendFile(
    path.join(dir, 'journal.jsonl'),
    `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`,
  );
}

/** 一条 verifier pass 事件。 */
const pass = (taskId, ts, round = 1) => ({
  ts, kind: 'report', ref: `${taskId}/verifier/r${round}`, outcome: 'pass', n: 0,
});

const fail = (taskId, ts, round = 1) => ({
  ts, kind: 'report', ref: `${taskId}/verifier/r${round}`, outcome: 'fail', n: 1,
});

/** 一条 CLI 命令事件——人敲一次 `vima validate` 就有一条，**不是**任务轨迹。 */
const cmd = (ref, ts) => ({ ts, kind: 'cmd', ref, outcome: 'ok', n: 0 });

/** 把全部任务退回 pending——复现「刚批准完任务、一个都没开工」的三档全零现场。 */
async function claimNoneDone(tmp) {
  const dir = path.join(tmp, 'docs', 'tasks');
  for (const name of ['device-api-be.md', 'device-list-fe.md', 'full-test.md', 'shared-base.md']) {
    const p = path.join(dir, name);
    const text = await readFile(p, 'utf8');
    await writeFile(p, text.replace(/^status: .*$/m, 'status: pending'));
  }
}

/** 写 .vima/go-state.json（golden 不含 .vima，需先建目录）。 */
async function writeGoState(tmp, state) {
  const dir = path.join(tmp, '.vima');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'go-state.json'), JSON.stringify(state));
}

/** 相对现在的 ISO 时刻。 */
const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

/**
 * 把 golden（PLANNING 期）推进到 DEVELOPING，进入时刻为 m 分钟前。
 * no-trajectory 的阈值判据依赖「当前正处于 DEVELOPING + 已进行多久」，两者都要真实可控。
 */
async function enterDeveloping(tmp, m) {
  const p = path.join(tmp, 'docs', 'lifecycle.json');
  const lc = JSON.parse(await readFile(p, 'utf8'));
  const at = minutesAgo(m);
  lc.currentPhase = 'DEVELOPING';
  lc.phaseHistory = [
    ...lc.phaseHistory.map((h) => (h.completedAt === null ? { ...h, completedAt: at } : h)),
    { phase: 'DEVELOPING', enteredAt: at, completedAt: null, note: '进入实现期' },
  ];
  await writeFile(p, JSON.stringify(lc, null, 2));
}

async function waitUntil(predicate, timeoutMs = 3000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error(`等待条件超时（${timeoutMs}ms）`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/** 目录指纹（相对路径 + 大小），用于「只读」证明。 */
async function fingerprint(dir) {
  const { walkFiles } = await import('../../lib/util/fs.mjs');
  const files = await walkFiles(dir, { exclude: ['node_modules', '.git'] });
  return files.map((f) => f.rel ?? f).sort().join('\n');
}

// ── 判据 2：证据强度三档（本项核心）─────────────────────────────────────────

test('A37 判据 2：frontmatter 全 done 而 journal 为空 → claimed>0 / verified=0 / trust 非空', async (t) => {
  const tmp = await makeCopy(t);
  await claimAllDone(tmp);

  const proc = runCli(tmp, ['status', '--json']);
  assert.equal(proc.status, 0, `stderr: ${proc.stderr}`);
  const v = JSON.parse(proc.stdout);

  assert.equal(v.tiers.total, 4);
  assert.equal(v.tiers.claimed, 4, '四个任务都自称完成');
  assert.equal(v.tiers.tracked, 0, 'journal 无 report 事件 → 零轨迹');
  assert.equal(v.tiers.verified, 0, '零验收');
  assert.equal(v.tiers.gaps.claimedVsTracked, 4);
  assert.ok(v.trust.length > 0, '必须给出差值信号');
  assert.ok(v.trust.some((s) => s.id === 'tier-gap'), `实际信号: ${JSON.stringify(v.trust)}`);
});

test('A37 规格 1：三档不变式成立时不报差值；倒挂能被识别', async (t) => {
  const tmp = await makeCopy(t);
  // 只有 shared-base 是 done（golden 原状），却给另外三个任务补了验收事件 → 倒挂
  await appendJournal(tmp, [
    pass('device-api-be', '2026-08-12T10:00:00Z'),
    pass('device-list-fe', '2026-08-12T10:30:00Z'),
  ]);
  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.tiers.claimed, 1);
  assert.equal(v.tiers.verified, 2);
  assert.equal(v.tiers.inverted, true, 'verified > claimed 即倒挂');
  assert.ok(v.trust.some((s) => s.id === 'tier-inverted'));
});

test('A37 规格 1：journal 里已删除任务的历史事件不得让分子超过分母', async (t) => {
  const tmp = await makeCopy(t);
  await appendJournal(tmp, [
    pass('device-api-be', '2026-08-12T10:00:00Z'),
    pass('已被删除的老任务', '2026-08-12T10:05:00Z'),
  ]);
  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.tiers.verified, 1, '只统计仍存在于任务清单里的 taskId');
  assert.ok(v.tiers.verified <= v.tiers.total);
});

test('A37 规格 1：后续 verifier fail 必须撤销历史 pass 的当前验收态', async (t) => {
  const tmp = await makeCopy(t);
  await appendJournal(tmp, [
    pass('shared-base', '2026-08-12T10:00:00Z', 1),
    fail('shared-base', '2026-08-12T10:30:00Z', 2),
  ]);

  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.tiers.verified, 0, '最新 verifier 轮次为 fail，不能继续显示已验收');
  assert.equal(v.eta.overall.samples, 1, '历史首次 pass 仍可作为实际吞吐样本，不能与当前状态混用');
});

test('A37 规格 1：pass 后任务被重开为 pending，当前验收态必须失效', async (t) => {
  const tmp = await makeCopy(t);
  await appendJournal(tmp, [pass('shared-base', '2026-08-12T10:00:00Z')]);
  const p = path.join(tmp, 'docs', 'tasks', 'shared-base.md');
  const text = await readFile(p, 'utf8');
  await writeFile(
    p,
    text
      .replace(/^status: .*$/m, 'status: pending')
      .replace(/^updatedAt: .*$/m, 'updatedAt: 2026-08-12T11:00:00Z'),
  );

  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.tiers.verified, 0, '重开时间晚于最后一次 pass，必须等待重新验收');
});

test('A37 规格 1：change reopen 水位阻止任务重新标 done 后复活旧 pass', async (t) => {
  const tmp = await makeCopy(t);
  await appendJournal(tmp, [pass('shared-base', '2026-08-12T10:00:00Z', 1)]);
  const changeDir = path.join(tmp, '.vima', 'changes', 'chg-001');
  await mkdir(changeDir, { recursive: true });
  await writeFile(path.join(changeDir, 'change.json'), JSON.stringify({
    id: 'chg-001', status: 'applied', appliedAt: '2026-08-12T11:00:00Z', reopened: ['shared-base'],
  }));

  let v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.tiers.verified, 0, '任务重新标 done 也不能让 reopen 前的旧 pass 复活');
  await appendJournal(tmp, [pass('shared-base', '2026-08-12T12:00:00Z', 2)]);
  v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.tiers.verified, 1, 'reopen 后的新 pass 恢复当前验收态');
});

// ── 判据 3：样本不足拒绝外推 ────────────────────────────────────────────────

test('A37 判据 3：验收样本 < 3 → estimable=false 且说明还缺几个', async (t) => {
  const tmp = await makeCopy(t);
  await appendJournal(tmp, [pass('device-api-be', '2026-08-12T10:00:00Z')]);

  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.eta.overall.estimable, false);
  assert.equal(v.eta.overall.samples, 1);
  assert.match(v.eta.overall.reason, /还缺 2 个/);
  assert.equal(v.eta.overall.etaMs, null, '不可估时不得给出任何数字');
  assert.equal(v.eta.overall.ratePerHour, null);
});

test('A37 规格 2：样本 ≥3 → 给出区间，且乐观端不慢于保守端', async (t) => {
  const tmp = await makeCopy(t);
  // 4 个任务全部验收通过，但 remaining 会变 0 → 换成只验收 3 个，留 1 个剩余
  await appendJournal(tmp, [
    pass('shared-base', '2026-08-12T10:00:00Z'),
    pass('device-api-be', '2026-08-12T10:20:00Z'),
    pass('device-list-fe', '2026-08-12T10:40:00Z'),
  ]);
  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.eta.overall.estimable, true);
  assert.equal(v.eta.overall.samples, 3);
  assert.equal(v.eta.overall.remaining, 1, '还剩 full-test 未验收');
  assert.ok(
    v.eta.overall.etaMs.optimistic <= v.eta.overall.etaMs.conservative,
    '乐观端的剩余时间必须 ≤ 保守端',
  );
  assert.ok(
    v.eta.overall.ratePerHour.optimistic >= v.eta.overall.ratePerHour.conservative,
    '乐观端速率必须 ≥ 保守端',
  );
});

test('A37 规格 2：ts 不可解析的 pass 事件不计入验收样本（宁缺勿假）', async (t) => {
  const tmp = await makeCopy(t);
  await appendJournal(tmp, [
    { ts: '不是时间', kind: 'report', ref: 'device-api-be/verifier/r1', outcome: 'pass', n: 0 },
  ]);
  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.tiers.verified, 0, 'ts 不可解析 → 不计入 verified');
  assert.equal(v.tiers.tracked, 1, '但仍算「有轨迹」——事件确实存在');
});

test('A37 规格 2：未来阶段时间或未来验收时间 → 拒绝估算，不得夹成 1ms', async (t) => {
  const tmp = await makeCopy(t);
  const lp = path.join(tmp, 'docs', 'lifecycle.json');
  const lc = JSON.parse(await readFile(lp, 'utf8'));
  lc.phaseHistory.push({ phase: 'DEVELOPING', enteredAt: '2099-01-01T00:00:00Z', completedAt: null });
  await writeFile(lp, JSON.stringify(lc, null, 2));
  await appendJournal(tmp, [
    pass('shared-base', '2026-08-12T10:00:00Z'),
    pass('device-api-be', '2026-08-12T10:20:00Z'),
    pass('device-list-fe', '2026-08-12T10:40:00Z'),
  ]);

  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.eta.overall.estimable, false);
  assert.match(v.eta.overall.reason, /未来|时间异常/);
  assert.equal(v.eta.overall.etaMs, null);
});

// ── 判据 4：只读 ───────────────────────────────────────────────────────────

test('A37 判据 4：status 不产出任何文件，连失败也不写 journal', async (t) => {
  const tmp = await makeCopy(t);
  const before = await fingerprint(tmp);

  assert.equal(runCli(tmp, ['status']).status, 0);
  assert.equal(runCli(tmp, ['status', '--json']).status, 0);
  runCli(tmp, ['status', '--out', 'x']); // 用法错误路径也不得落盘

  assert.equal(await fingerprint(tmp), before, 'status 跑过之后目录内容必须逐项一致');
  assert.equal(
    existsSync(path.join(tmp, '.vima', 'reports', 'journal.jsonl')),
    false,
    'status 被 JOURNAL_EXEMPT 豁免——失败也不得往 journal 写一行',
  );
});

// ── 判据 5：未知选项不得静默忽略 ───────────────────────────────────────────

test('A37 判据 5：--out / --serve / --output 一律 usage exit 3', async (t) => {
  const tmp = await makeCopy(t);
  for (const flag of ['--out', '--serve', '--output']) {
    const proc = runCli(tmp, ['status', flag, 'x']);
    assert.equal(proc.status, 3, `${flag} 应为 usage exit 3，实际 ${proc.status}`);
  }
});

test('A37：--watch / --json / --line 两两互斥 → usage exit 3（不得静默取其一）', async (t) => {
  const tmp = await makeCopy(t);
  for (const args of [
    ['--watch', '--json'],
    ['--line', '--json'],
    ['--line', '--watch'],
  ]) {
    assert.equal(runCli(tmp, ['status', ...args]).status, 3, `${args.join(' ')} 应拒绝`);
  }
});

// ── 判据 6：--line 恒 exit 0 ───────────────────────────────────────────────

test('A37 判据 6：非 vima 项目根 --line → exit 0 且 stdout 为单行告警', async (t) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'vima-c2-status-bare-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));

  const proc = runCli(tmp, ['status', '--line']);
  assert.equal(proc.status, 0, 'statusLine 宿主拿到非零退出码只会显示空白，探针当场失效');
  assert.equal(proc.stdout.trimEnd().split('\n').length, 1, '必须是单行');
  assert.match(proc.stdout, /非 vima 项目根/);
});

test('A37：非项目根 table/json 显式标注，不得伪装成全部任务已验收', async (t) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'vima-c2-status-bare-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));

  const table = runCli(tmp, ['status']);
  assert.equal(table.status, 0);
  assert.match(table.stdout, /非 vima 项目根/);
  assert.doesNotMatch(table.stdout, /全部任务已验收/);

  const json = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(json.project.detected, false);
  assert.match(json.eta.overall.reason, /尚无.*数据|无可估算/);
});

test('A37 判据 6：项目内 --line 输出单行且含阶段与三档要点', async (t) => {
  const tmp = await makeCopy(t);
  const proc = runCli(tmp, ['status', '--line']);
  assert.equal(proc.status, 0);
  const line = proc.stdout.trimEnd();
  assert.equal(line.split('\n').length, 1);
  assert.match(line, /^vima PLANNING/);
  assert.match(line, /1\/4·验收0/);
  assert.match(line, /ETA—/, '不可估时状态栏也必须如实显示 ETA—，不得留空');
});

test('A37 判据 6：lifecycle 损坏时 --line 仍 exit 0 单行', async (t) => {
  const tmp = await makeCopy(t);
  await writeFile(path.join(tmp, 'docs', 'lifecycle.json'), '{ 坏 JSON');
  const proc = runCli(tmp, ['status', '--line']);
  assert.equal(proc.status, 0);
  assert.equal(proc.stdout.trimEnd().split('\n').length, 1);
});

// ── 判据 7：空项目不崩 ─────────────────────────────────────────────────────

test('A37 判据 7：无 .vima/reports、无任务的项目 → exit 0 并如实标注', async (t) => {
  const tmp = await makeCopy(t);
  await rm(path.join(tmp, 'docs', 'tasks'), { recursive: true, force: true });
  await rm(path.join(tmp, '.vima', 'reports'), { recursive: true, force: true });

  const proc = runCli(tmp, ['status']);
  assert.equal(proc.status, 0, `stderr: ${proc.stderr}`);
  assert.match(proc.stdout, /journal 无事件/);
  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.tiers.total, 0);
  assert.equal(v.eta.overall.estimable, false);
});

test('A37 判据 7：某个任务 frontmatter 损坏不该让整块进度看不见', async (t) => {
  const tmp = await makeCopy(t);
  await writeFile(path.join(tmp, 'docs', 'tasks', 'full-test.md'), '没有 frontmatter 的文件');
  const proc = runCli(tmp, ['status']);
  assert.equal(proc.status, 0, 'status 只呈现不判定——校验任务文件是 validate 的职责');
  assert.match(proc.stdout, /3 个可读任务/);
  assert.match(proc.stdout, /1 个任务文件不可读/);
  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.tiers.total, 3, '坏一个任务只能排除该文件，不能把其余三个一起清零');
  assert.equal(v.dataIssues.tasks.length, 1);
  assert.match(runCli(tmp, ['status', '--line']).stdout, /数据⚠1/, '状态栏也必须暴露部分数据不可读');
});

test('A37 D-A37-01：watch 启动后新建 reports/journal 也必须实时重载', async (t) => {
  const tmp = await makeCopy(t, 'vima-c2-status-watch-');
  await rm(path.join(tmp, '.vima', 'reports'), { recursive: true, force: true });
  const child = spawn(process.execPath, [BIN, 'status', '--watch'], {
    cwd: tmp,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });
  t.after(() => { if (!child.killed) child.kill('SIGTERM'); });

  await waitUntil(() => stdout.includes('journal 无事件'));
  await appendJournal(tmp, [pass('shared-base', new Date().toISOString())]);
  await waitUntil(() => stdout.includes('轨迹 1 条'));
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
  assert.equal(stderr, '');
});

// ── 判据 8：除时间派生键外稳定 ─────────────────────────────────────────────

test('A37 判据 8：--json 连续两次，除 now/elapsed/eta 外逐字段一致', async (t) => {
  const tmp = await makeCopy(t);
  const strip = (s) => {
    const v = JSON.parse(s);
    delete v.now;
    delete v.eta;
    delete v.activity;
    v.timeline.phases = v.timeline.phases.map(({ ms, ...rest }) => rest);
    delete v.timeline.totalMs;
    return JSON.stringify(v);
  };
  const a = strip(runCli(tmp, ['status', '--json']).stdout);
  const b = strip(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(a, b);
});

// ── 分组（用户原始诉求：前端后端任务量）───────────────────────────────────

test('A37 规格 1：分组按 side / layer / app 给出任务量，且验收列与总表同口径', async (t) => {
  const tmp = await makeCopy(t);
  await appendJournal(tmp, [pass('device-api-be', '2026-08-12T10:00:00Z')]);

  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.groups.total, 4);
  assert.equal(v.groups.bySide.backend.total, 1);
  assert.equal(v.groups.bySide.frontend.total, 1);
  assert.equal(v.groups.bySide.fullstack.total, 2);
  assert.equal(v.groups.byLayer.shared.total, 1);
  assert.equal(v.groups.byLayer.business.total, 2);
  assert.equal(v.groups.byLayer.pipeline.total, 1);

  assert.equal(v.groups.bySide.backend.verified, 1, '分组验收数必须来自 journal，不是 status 字段');
  assert.equal(v.groups.bySide.frontend.verified, 0);
  const sum = ['backend', 'frontend', 'fullstack']
    .reduce((a, k) => a + v.groups.bySide[k].verified, 0);
  assert.equal(sum, v.tiers.verified, '分组验收之和必须等于总表已验收——同口径');
});

test('A37 规格 1：多端项目按 app 分组（A16 端册）', async (t) => {
  const tmp = await makeCopy(t);
  const p = path.join(tmp, 'docs', 'tasks', 'device-list-fe.md');
  const text = await readFile(p, 'utf8');
  await writeFile(p, text.replace(/^page: PAGE-01$/m, 'app: admin\npage: PAGE-01'));

  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.groups.byApp.admin.total, 1);
  assert.equal(v.groups.byApp['—'].total, 3, '无 app 字段的任务归入单端桶');
});

// ── 状态源差值 ────────────────────────────────────────────────────────────

test('A37 规格 1：lifecycle.taskStats 与 batch-plan 过期都会被呈现为差值', async (t) => {
  const tmp = await makeCopy(t);
  const lp = path.join(tmp, 'docs', 'lifecycle.json');
  const lc = JSON.parse(await readFile(lp, 'utf8'));
  lc.taskStats = { total: 4, done: 0, failed: 0, blocked: 0, updatedAt: '2026-08-12T09:00:00Z' };
  await writeFile(lp, JSON.stringify(lc, null, 2));

  await mkdir(path.join(tmp, '.vima', 'reports'), { recursive: true });
  await writeFile(
    path.join(tmp, '.vima', 'reports', 'batch-plan.json'),
    JSON.stringify({ schemaVersion: '1', batches: [], maxParallel: 8, stats: { done: 3 } }),
  );

  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  const ids = v.trust.map((s) => s.id);
  assert.ok(ids.includes('stats-stale'), `taskStats.done=0 vs 实算 1 应报差值：${JSON.stringify(v.trust)}`);
  assert.ok(ids.includes('plan-stale'), 'batch-plan.done=3 vs 实算 1 应报差值');
});

test('A37 规格 1：即使 done 相同，total/pending 等状态计数漂移也必须呈现', async (t) => {
  const tmp = await makeCopy(t);
  const lp = path.join(tmp, 'docs', 'lifecycle.json');
  const lc = JSON.parse(await readFile(lp, 'utf8'));
  lc.taskStats = { total: 99, done: 1, failed: 0, blocked: 0, updatedAt: '2026-08-12T09:00:00Z' };
  await writeFile(lp, JSON.stringify(lc, null, 2));
  await mkdir(path.join(tmp, '.vima', 'reports'), { recursive: true });
  await writeFile(
    path.join(tmp, '.vima', 'reports', 'batch-plan.json'),
    JSON.stringify({ stats: { total: 88, pending: 87, done: 1, failed: 0, blocked: 0, running: 0 } }),
  );

  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.ok(v.trust.some((s) => s.id === 'stats-stale'));
  assert.ok(v.trust.some((s) => s.id === 'plan-stale'));
  assert.ok(v.trust.every((s) => !/未重建|已过期/.test(s.message)), 'status 只报差值，不裁定成因');
});

test('A37 D-A37-02：status 恒 exit 0——有差值也不进退出码', async (t) => {
  const tmp = await makeCopy(t);
  await claimAllDone(tmp);
  const proc = runCli(tmp, ['status']);
  assert.ok(proc.stdout.includes('信任度'), '差值必须被呈现');
  assert.equal(proc.status, 0, '但判定归 doctor/converge，status 不进退出码');
});

// ── 全零盲区：代码在写但没有人在记账（D-A39-01 / D-A39-02）─────────────────
//
// 出自 sustain-v3 实证：DEVELOPING 期 journal 有 58 条事件、最近一条距今 6m51s，
// 而这 58 条**全是** cmd，report 0 条；同期 79 个源文件正在被写、零份 builder 报告、
// 调度器从未启动。旧版把三类事件混算成「最近一条轨迹事件」，且三档全零时
// trustSignals 返回空数组——两处叠加，最该报警的现场显示得像一切正常。

test('D-A39-01：命令事件不得冒充任务轨迹（journal 全是 cmd 时不显示轨迹时间）', async (t) => {
  const tmp = await makeCopy(t);
  await enterDeveloping(tmp, 30);
  await appendJournal(tmp, [cmd('plan', minutesAgo(20)), cmd('validate', minutesAgo(6))]);

  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.activity.events, 2, '全部事件仍如实计数');
  assert.equal(v.activity.reportEvents, 0, 'cmd 不是轨迹事件');
  assert.equal(v.activity.lastReportAt, null, '没有轨迹就没有轨迹时刻');
  assert.equal(v.tiers.tracked, 0);

  const table = runCli(tmp, ['status']).stdout;
  assert.match(table, /0 条任务轨迹事件/);
  assert.doesNotMatch(table, /最近一条任务轨迹距今/, '零轨迹时不得显示任何轨迹时间');
});

test('D-A39-02：开发期已推进而零轨迹 → 必须出 no-trajectory 信号（三档全零不等于没问题）', async (t) => {
  const tmp = await makeCopy(t);
  await claimNoneDone(tmp);
  await enterDeveloping(tmp, 30);
  await appendJournal(tmp, [cmd('validate', minutesAgo(6))]);

  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.tiers.claimed, 0);
  assert.equal(v.tiers.tracked, 0);
  assert.equal(v.tiers.verified, 0, '前提：三档全零，旧的四条差值信号一条都不会触发');
  const sig = v.trust.find((s) => s.id === 'no-trajectory');
  assert.ok(sig, `三档全零 + 开发期已推进时必须有信号，实得 ${JSON.stringify(v.trust.map((s) => s.id))}`);
  assert.match(sig.message, /0 个有轨迹事件/);
  assert.match(sig.message, /go-state\.json 不存在或不可解析/, '调度器状态是这条信号的关键事实');
  assert.equal(runCli(tmp, ['status']).status, 0, '仍然只呈现不裁定，不进退出码');
});

test('D-A39-02：刚进开发期（不足阈值）零轨迹不报，保证零假阳性', async (t) => {
  const tmp = await makeCopy(t);
  await enterDeveloping(tmp, 2);
  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.ok(
    !v.trust.some((s) => s.id === 'no-trajectory'),
    '刚进开发期还没有轨迹是正常的，报出来就是噪声',
  );
});

test('D-A39-02：非 DEVELOPING 阶段不报 no-trajectory（PLANNING 期本就不该有任务轨迹）', async (t) => {
  const tmp = await makeCopy(t);
  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.phase, 'PLANNING');
  assert.ok(!v.trust.some((s) => s.id === 'no-trajectory'));
});

test('D-A39-02：go-state.json 存在时如实呈现其 stopReason', async (t) => {
  const tmp = await makeCopy(t);
  await enterDeveloping(tmp, 30);
  await writeGoState(tmp, { phase: 'DEVELOPING', stopReason: 'gate', consecutiveResumes: 0 });
  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.scheduler.exists, true);
  assert.equal(v.scheduler.stopReason, 'gate');
  const sig = v.trust.find((s) => s.id === 'no-trajectory');
  assert.match(sig.message, /stopReason=gate/);
});

test('D-A39-01：有轨迹时按轨迹口径显示，并与全部事件数分列', async (t) => {
  const tmp = await makeCopy(t);
  await enterDeveloping(tmp, 30);
  await appendJournal(tmp, [cmd('validate', minutesAgo(20)), pass('shared-base', minutesAgo(3))]);

  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  assert.equal(v.activity.reportEvents, 1);
  assert.equal(v.activity.events, 2);
  assert.ok(v.activity.reportIdleMs >= 0);
  assert.ok(!v.trust.some((s) => s.id === 'no-trajectory'), '有轨迹就不该再报零轨迹');

  const table = runCli(tmp, ['status']).stdout;
  assert.match(table, /最近一条任务轨迹距今/);
  assert.match(table, /轨迹 1 条 \/ 事件合计 2 条/);
});

test('A37 规格 1：分组每个切面各自合计等于总数，且带小节标题不可跨切面相加', async (t) => {
  const tmp = await makeCopy(t);
  const v = JSON.parse(runCli(tmp, ['status', '--json']).stdout);
  const sum = (o) => Object.values(o).reduce((a, c) => a + c.total, 0);
  assert.equal(sum(v.groups.bySide), v.groups.total, 'side 切面必须覆盖全部任务');
  assert.equal(sum(v.groups.byLayer), v.groups.total, 'layer 切面必须覆盖全部任务（business 不可省）');
  assert.equal(sum(v.groups.byApp), v.groups.total, 'app 切面必须覆盖全部任务');

  const table = runCli(tmp, ['status']).stdout;
  assert.match(table, /— 按前后端 —/);
  assert.match(table, /— 按层 —/);
  // 「按端」小节只在多端项目出现；标签须与「按前后端」一眼可分，不能只差一个字。
  if (Object.keys(v.groups.byApp).some((a) => a !== '—')) assert.match(table, /— 按端 —/);
});

// ── 帮助面 ────────────────────────────────────────────────────────────────

test('A37：status 进帮助面 DEVELOPING 分组，且 --help 列出三个选项', async () => {
  const help = spawnSync(process.execPath, [BIN, 'help'], { encoding: 'utf8' }).stdout;
  assert.match(help, /^\s+status\s+运行状态/m);

  const sub = spawnSync(process.execPath, [BIN, 'status', '--help'], { encoding: 'utf8' });
  assert.equal(sub.status, 0);
  for (const flag of ['--watch', '--json', '--line']) {
    assert.ok(sub.stdout.includes(flag), `帮助面缺 ${flag}`);
  }
});
