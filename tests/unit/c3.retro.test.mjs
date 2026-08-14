// C3 单测：vima retro —— 项目复盘确定性采集（A21，契约 §6.14）
// 重点：默认脱敏（公开仓库 + 客户项目 = 泄露是真事故）、确定性、阈值观察项、入口守卫。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, rm, mkdir, readFile, writeFile, readdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(HERE, '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');
const JSON_REL = '.vima/reports/retro.json';
const MD_REL = 'docs/retro/vima-feedback.md';

async function cloneGolden(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-retro-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(GOLDEN, root, { recursive: true });
  return root;
}

function vima(cwd, ...args) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

const readJson = async (root) => JSON.parse(await readFile(path.join(root, JSON_REL), 'utf8'));
const readMd = async (root) => readFile(path.join(root, MD_REL), 'utf8');

async function taskIdsOf(root) {
  const names = await readdir(path.join(root, 'docs', 'tasks'));
  return names
    .filter((n) => n.endsWith('.md') && !n.startsWith('_') && n !== 'README.md')
    .map((n) => n.slice(0, -3));
}

test('黄金夹具：采集成功，JSON + issue 正文同时落盘，结构齐全', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'retro');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const d = await readJson(root);
  assert.equal(d.schemaVersion, '1');
  assert.equal(d.anonymized, true);
  assert.equal(d.fingerprint.templateId, 'admin');
  assert.equal(d.tasks.total, 4);
  assert.deepEqual(d.tasks.byLayer, { business: 2, pipeline: 1, shared: 1 });
  assert.equal(d.scale.contractApis, 4);
  assert.equal(d.scale.pages, 2);
  assert.ok(Array.isArray(d.observations));
  const md = await readMd(root);
  assert.match(md, /## 项目指纹/);
  assert.match(md, /## 人工补充/);
  assert.match(md, /想表达但框架表达不了/, 'issue 正文必须含表达力缺口必问项');
});

test('默认脱敏：产物里不得出现任何 taskId（公开仓库 + 客户项目）', async (t) => {
  const root = await cloneGolden(t);
  vima(root, 'retro');
  const ids = await taskIdsOf(root);
  assert.ok(ids.length > 0, '夹具应有任务');
  const text = (await readMd(root)) + JSON.stringify(await readJson(root));
  const leaked = ids.filter((id) => text.includes(id));
  assert.deepEqual(leaked, [], `默认产物泄露了 taskId: ${leaked}`);
});

test('--with-ids：显式关闭脱敏后才携带标识', async (t) => {
  const root = await cloneGolden(t);
  // 制造一个重试过的任务，让 ids 段非空
  const p = path.join(root, 'docs/tasks/device-api-be.md');
  await writeFile(p, (await readFile(p, 'utf8')).replace('retryCount: 0', 'retryCount: 2'));
  vima(root, 'retro', '--with-ids');
  const d = await readJson(root);
  assert.equal(d.anonymized, false);
  assert.deepEqual(d.ids.retried, ['device-api-be']);
  assert.match(await readMd(root), /device-api-be/);
});

test('确定性：两次运行 JSON 与 issue 正文均字节一致（不读系统时钟）', async (t) => {
  const root = await cloneGolden(t);
  vima(root, 'retro');
  const j1 = await readFile(path.join(root, JSON_REL), 'utf8');
  const m1 = await readMd(root);
  vima(root, 'retro');
  assert.equal(await readFile(path.join(root, JSON_REL), 'utf8'), j1);
  assert.equal(await readMd(root), m1);
});

test('观察项按阈值触发：重试率 / failed / 共享层变更 / 豁免 / NG 越界', async (t) => {
  const root = await cloneGolden(t);
  // 2/4 任务重试（>30%）、1 个 failed
  for (const f of ['device-api-be.md', 'device-list-fe.md']) {
    const p = path.join(root, 'docs/tasks', f);
    await writeFile(p, (await readFile(p, 'utf8')).replace('retryCount: 0', 'retryCount: 2'));
  }
  const fe = path.join(root, 'docs/tasks/device-list-fe.md');
  await writeFile(fe, (await readFile(fe, 'utf8')).replace('status: pending', 'status: failed'));
  await mkdir(path.join(root, '.vima/reports'), { recursive: true });
  await writeFile(
    path.join(root, '.vima/reports/device-list-fe-builder.json'),
    JSON.stringify({ taskId: 'device-list-fe', status: 'completed', sharedChangeRequest: { what: 'request 拦截器' } }),
  );
  await writeFile(
    path.join(root, '.vima/reports/device-list-fe-verifier.json'),
    JSON.stringify({
      taskId: 'device-list-fe',
      round: 3,
      result: 'fail',
      points: [
        { point: 'RULE-01 x', passed: false },
        { point: 'RULE-02 y', passed: false, waived: true, reason: '用户裁定' },
        { point: 'NG-01 越界：实现了导出', passed: false },
      ],
    }),
  );
  vima(root, 'retro');
  const d = await readJson(root);
  const ids = d.observations.map((o) => o.id);
  for (const want of ['OBS-retry', 'OBS-failed', 'OBS-shared', 'OBS-waived', 'OBS-ng']) {
    assert.ok(ids.includes(want), `应触发 ${want}，实际：${ids}`);
  }
  assert.equal(d.verification.maxRound, 3);
  assert.equal(d.verification.waived, 1);
  assert.equal(d.verification.ngViolations, 1);
  assert.equal(d.shared.changeRequests, 1);
  // 每条观察项都必须指向框架资产（反哺的是 vima-cli，不是业务代码）
  for (const o of d.observations) assert.ok(o.target && o.target.length > 0, `${o.id} 缺 target`);
});

test('黄金态零异常时观察项可以为空（不硬凑）', async (t) => {
  const root = await cloneGolden(t);
  vima(root, 'retro');
  const d = await readJson(root);
  assert.ok(!d.observations.some((o) => o.id === 'OBS-retry'), '无重试不该触发 OBS-retry');
  assert.ok(!d.observations.some((o) => o.id === 'OBS-failed'), '无失败不该触发 OBS-failed');
});

test('规则命中分布来自 validate 报告（哪条规则最常被违反）', async (t) => {
  const root = await cloneGolden(t);
  await mkdir(path.join(root, '.vima/reports'), { recursive: true });
  await writeFile(
    path.join(root, '.vima/reports/planning-validation.json'),
    JSON.stringify({
      schemaVersion: '1',
      pass: false,
      errors: [{ rule: 'V-TASK-07', message: 'x', path: 'a' }],
      warnings: Array.from({ length: 5 }, () => ({ rule: 'V-TASK-07', message: 'y', path: 'b' })),
      pendingConfirm: [{ where: 'PAGE-01', path: 'docs/spec.md' }],
    }),
  );
  vima(root, 'retro');
  const d = await readJson(root);
  assert.equal(d.planning.ruleHits['V-TASK-07'], 6);
  assert.equal(d.planning.pendingConfirm, 1);
  assert.ok(d.observations.some((o) => o.id === 'OBS-rule'), '≥5 次命中应触发 OBS-rule');
  assert.ok(d.observations.some((o) => o.id === 'OBS-pending'));
  assert.match(await readMd(root), /校验规则命中分布/);
});

test('缺 lifecycle / spec / 报告目录时不崩：指纹记 null，计数记 0', async (t) => {
  const root = await cloneGolden(t);
  // 真实项目即使 lifecycle 损坏也有 .vima/（create 写的 manifest），保留项目标记再删
  await mkdir(path.join(root, '.vima'), { recursive: true });
  await rm(path.join(root, 'docs/lifecycle.json'));
  await rm(path.join(root, 'docs/spec.md'));
  const r = vima(root, 'retro');
  assert.equal(r.code, 0, `复盘不该因缺产物失败；stderr: ${r.stderr}`);
  const d = await readJson(root);
  assert.equal(d.fingerprint.templateId, null);
  assert.equal(d.scale.pages, 0);
});

test('非 vima 项目：NOT_IN_PROJECT exit 4，且不凭空创建任何文件（A24 顶层守卫）', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-retro-empty-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const r = vima(root, 'retro');
  assert.equal(r.code, 4, `stdout: ${r.stdout}`);
  assert.match(r.stderr, /vima retro: NOT_IN_PROJECT/);
  for (const rel of ['.vima', 'docs']) {
    let exists = true;
    try {
      await access(path.join(root, rel));
    } catch {
      exists = false;
    }
    assert.equal(exists, false, `不得凭空创建 ${rel}/`);
  }
});

test('--json：报告输出 stdout 且与落盘一致；未知参数 → USAGE exit 3', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'retro', '--json');
  assert.equal(r.code, 0);
  assert.equal(r.stdout, await readFile(path.join(root, JSON_REL), 'utf8'));
  const bad = vima(root, 'retro', '--nope');
  assert.equal(bad.code, 3);
  assert.match(bad.stderr, /vima retro: USAGE/);
});

// ── A24：正面信号（只采集磁盘上真实可得的那一条，其余走人工必问）──

test('A24：worked.retriedThenDone 统计「重试后仍做成」的任务', async (t) => {
  const root = await cloneGolden(t);
  const p = path.join(root, 'docs/tasks/device-api-be.md');
  const s = await readFile(p, 'utf8');
  await writeFile(p, s.replace('retryCount: 0', 'retryCount: 2').replace('status: pending', 'status: done'));
  vima(root, 'retro');
  const d = await readJson(root);
  assert.equal(d.worked.retriedThenDone, 1);
  assert.match(await readMd(root), /重试后仍做成/);
});

test('A24：issue 正文含「哪个机制救了你一次」必问项（该数据只有人知道）', async (t) => {
  const root = await cloneGolden(t);
  vima(root, 'retro');
  const md = await readMd(root);
  assert.match(md, /救了你一次/);
  assert.match(md, /guard-shared/, '须给出实测例子，否则这一问会被答成空话');
  assert.match(md, /该保留什么/, '须说明为什么要问——只积累「该改什么」会误改已验证的设计');
});
