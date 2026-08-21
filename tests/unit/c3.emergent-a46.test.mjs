// C3 单测：A46 涌现决策留痕（契约 §6.9 emergentDecisions / §6.13 收口清单 / §6.14 retro 计数）
// 覆盖：hook 形状校验正反例与 stderr 登记 / converge B 类收口（不阻断、不进 byTask）/
//       retro 计数与 OBS-emergent / 角色模板与契约防漂移。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');
const HOOK = path.join(CLI_ROOT, 'templates', 'admin', 'workspace', 'hooks', 'post-write.mjs');
const JOURNAL_REL = path.join('.vima', 'reports', 'journal.jsonl');

async function cloneGolden(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-a46-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(GOLDEN, root, { recursive: true });
  return root;
}

function vima(cwd, ...args) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** 以 hook 协议喂一次写入事件（同 c3.journal 测试口径）。 */
function hook(cwd, relPath) {
  return spawnSync(process.execPath, [HOOK], {
    cwd,
    encoding: 'utf8',
    input: JSON.stringify({ cwd, tool_input: { file_path: relPath } }),
  });
}

async function journalEvents(root) {
  if (!existsSync(path.join(root, JOURNAL_REL))) return [];
  const text = await readFile(path.join(root, JOURNAL_REL), 'utf8');
  return text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

async function writeBuilderReport(root, taskId, extra = {}) {
  const rel = path.join('.vima', 'reports', `${taskId}-builder.json`);
  await mkdir(path.dirname(path.join(root, rel)), { recursive: true });
  await writeFile(path.join(root, rel), JSON.stringify({
    taskId,
    status: 'completed',
    files: ['src/a.vue'],
    acceptance: { total: 3, passed: 3 },
    sharedChangeRequest: null,
    notes: '',
    ...extra,
  }));
  return `.vima/reports/${taskId}-builder.json`;
}

// ── hook：形状校验与 stderr 登记（D-A46-02）─────────────────────────────

test('hook：合形 emergentDecisions（A+B）→ 记 report 事件，且 stderr 点名 B 类条数', async (t) => {
  const root = await cloneGolden(t);
  const rel = await writeBuilderReport(root, 'order-list-fe', {
    emergentDecisions: [
      { cls: 'A', what: '表格空态用内置 Empty', why: '规格未指定，局部可逆' },
      { cls: 'B', what: '列表排序默认取创建时间倒序', why: '两方案皆合理，取更保守的', where: 'src/a.vue:12' },
    ],
  });
  const r = hook(root, rel);
  assert.equal(r.status, 0, `hook 恒不阻断报告落盘：${r.stderr}`);
  assert.match(r.stderr, /涌现决策已登记/);
  assert.match(r.stderr, /B 类 1 条/);
  const ev = await journalEvents(root);
  const rep = ev.find((e) => e.kind === 'report' && e.ref === 'order-list-fe/builder/r1');
  assert.ok(rep, '合形报告必须进轨迹');
  assert.equal(rep.outcome, 'pass');
  assert.equal(rep.n, 0, '涌现决策不折进 n（五键封顶，n 原义不变）');
});

test('hook：只有 A 类 → 记事件但不播报（A 类留痕即可，不制造告警疲劳）', async (t) => {
  const root = await cloneGolden(t);
  const rel = await writeBuilderReport(root, 'order-list-fe', {
    emergentDecisions: [{ cls: 'A', what: 'x', why: 'y' }],
  });
  const r = hook(root, rel);
  assert.equal(r.status, 0);
  assert.ok(!r.stderr.includes('涌现决策已登记'), `A 类不播报：${r.stderr}`);
  assert.equal((await journalEvents(root)).filter((e) => e.kind === 'report').length, 1);
});

test('hook：形状非法（cls 封闭集外 / why 空 / 非数组）→ 整条不记（宁缺勿假）', async (t) => {
  const root = await cloneGolden(t);
  for (const bad of [
    [{ cls: 'C', what: 'x', why: 'y' }],
    [{ cls: 'B', what: 'x', why: '' }],
    [{ cls: 'B', what: 'x' }],
    'not-an-array',
  ]) {
    await rm(path.join(root, JOURNAL_REL), { force: true });
    const rel = await writeBuilderReport(root, 'order-list-fe', { emergentDecisions: bad });
    assert.equal(hook(root, rel).status, 0);
    const ev = await journalEvents(root);
    assert.equal(ev.filter((e) => e.kind === 'report').length, 0,
      `非法形状必须整条不记：${JSON.stringify(bad)}`);
  }
});

test('hook：缺省 emergentDecisions → 照常记事件（存量报告向后兼容）', async (t) => {
  const root = await cloneGolden(t);
  const rel = await writeBuilderReport(root, 'order-list-fe');
  assert.equal(hook(root, rel).status, 0);
  assert.equal((await journalEvents(root)).filter((e) => e.kind === 'report').length, 1);
});

// ── converge：B 类进收口清单，不阻断、不进 byTask（D-A46-03）───────────

test('converge：B 类进收口清单（确定性拼接、taskId 升序），A 类不进；不计退出码、不进 byTask', async (t) => {
  const root = await cloneGolden(t);
  const base = vima(root, 'converge');
  await writeBuilderReport(root, 'zz-late-fe', {
    emergentDecisions: [{ cls: 'B', what: '乙决策', why: '保守' }],
  });
  await writeBuilderReport(root, 'aa-early-fe', {
    emergentDecisions: [
      { cls: 'A', what: '甲局部决策', why: '可逆' },
      { cls: 'B', what: '甲决策', why: '两案取保守', where: 'src/x.vue:3' },
    ],
  });
  const r = vima(root, 'converge');
  assert.equal(r.code, base.code, '涌现决策不改变退出码（呈报不阻断）');
  const rep = JSON.parse(await readFile(path.join(root, '.vima', 'reports', 'convergence.json'), 'utf8'));
  assert.equal(rep.summary.emergentDecisions, 2, 'A 类不进收口清单');
  assert.deepEqual(rep.emergentDecisions, [
    { taskId: 'aa-early-fe', decision: '甲决策 | 理由：两案取保守 | 位置：src/x.vue:3' },
    { taskId: 'zz-late-fe', decision: '乙决策 | 理由：保守' },
  ]);
  assert.ok(!('aa-early-fe' in rep.byTask) || !rep.byTask['aa-early-fe'].some((l) => l.includes('甲决策')),
    'B 类不进 byTask（不是派修项）');
  assert.match(r.stderr, /涌现决策 B 类 2 条/);
  assert.match(r.stdout, /涌现决策 B 2/);
});

// ── retro：计数与观察项（D-A46-04）─────────────────────────────────────

test('retro：decisions 计数 + OBS-emergent 观察项 + issue 正文信号行；默认脱敏不带明细', async (t) => {
  const root = await cloneGolden(t);
  await writeBuilderReport(root, 'aa-early-fe', {
    emergentDecisions: [
      { cls: 'A', what: '甲局部决策', why: '可逆' },
      { cls: 'A', what: '乙局部决策', why: '可逆' },
      { cls: 'B', what: '丙决策', why: '保守' },
    ],
  });
  const r = vima(root, 'retro');
  assert.equal(r.code, 0, r.stderr);
  const d = JSON.parse(await readFile(path.join(root, '.vima', 'reports', 'retro.json'), 'utf8'));
  assert.deepEqual(d.decisions, { emergentA: 2, emergentB: 1 });
  assert.ok(d.observations.some((o) => o.id === 'OBS-emergent'), 'B>0 必须触发观察项');
  assert.ok(!JSON.stringify(d).includes('丙决策'), '默认脱敏：retro 只有计数，不得携带决策文本');
  const md = await readFile(path.join(root, 'docs', 'retro', 'vima-feedback.md'), 'utf8');
  assert.match(md, /涌现决策（A 类 \/ B 类）/);
});

test('retro：无涌现决策时计数为零且不触发 OBS-emergent（存量项目零噪声）', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'retro');
  assert.equal(r.code, 0, r.stderr);
  const d = JSON.parse(await readFile(path.join(root, '.vima', 'reports', 'retro.json'), 'utf8'));
  assert.deepEqual(d.decisions, { emergentA: 0, emergentB: 0 });
  assert.ok(!d.observations.some((o) => o.id === 'OBS-emergent'));
});

// ── 资产防漂移（D-A46-01/05：schema 与判据两处必须同源）─────────────────

test('防漂移：builder 角色模板与契约 §6.9 都声明 emergentDecisions，判据关键词在位', async () => {
  const builderMd = await readFile(
    path.join(CLI_ROOT, 'templates', 'admin', 'workspace', 'agents', 'vima-builder.md'), 'utf8');
  assert.match(builderMd, /emergentDecisions/);
  assert.match(builderMd, /禁区/);
  assert.match(builderMd, /sharedChangeRequest/);
  const contracts = await readFile(path.join(CLI_ROOT, 'docs', 'internal-contracts.md'), 'utf8');
  assert.match(contracts, /emergentDecisions.*A46 D-A46-01/);
});
