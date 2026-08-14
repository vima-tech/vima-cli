// C3 单测：vima certify —— 交付等级认证（A32，契约 §6.19）
// 覆盖：四级阶梯逐级判定 / 连续性（跳级不算）/ 双轴分离 / 显式非宣称 / 确定性 / 守卫。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, rm, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(HERE, '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');
const REPORT_REL = '.vima/reports/certify.json';

async function cloneGolden(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-certify-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(GOLDEN, root, { recursive: true });
  return root;
}

function vima(cwd, ...args) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

async function readReport(root) {
  return JSON.parse(await readFile(path.join(root, REPORT_REL), 'utf8'));
}

function levelOf(report, name) {
  return report.levels.find((l) => l.level === name);
}

/** 置 lifecycle 的 tasksApproved（等级 1 的唯一判据）。 */
async function approve(root) {
  const p = path.join(root, 'docs', 'lifecycle.json');
  const lc = JSON.parse(await readFile(p, 'utf8'));
  lc.checklists.PLANNING.tasksApproved = true;
  lc.checklists.PLANNING.tasksApprovedAt = '2026-08-14T00:00:00Z';
  await writeFile(p, JSON.stringify(lc, null, 2));
}

/** 把全部任务置 done（layer 过滤由调用方通过 only 指定）。 */
async function markDone(root, ids) {
  for (const id of ids) {
    const p = path.join(root, 'docs', 'tasks', `${id}.md`);
    const s = await readFile(p, 'utf8');
    await writeFile(p, s.replace(/^status: .+$/m, 'status: done'));
  }
}

/** 写一份 Verifier 通过报告。 */
async function verifierPass(root, taskId) {
  await mkdir(path.join(root, '.vima', 'reports'), { recursive: true });
  await writeFile(
    path.join(root, '.vima', 'reports', `${taskId}-verifier.json`),
    JSON.stringify({ taskId, round: 1, result: 'pass', checklist: [], points: [] }),
  );
}

/** 写一份集成对账报告（绿或红）。 */
async function convergence(root, { errors = 0, openPoints = 0 } = {}) {
  await mkdir(path.join(root, '.vima', 'reports'), { recursive: true });
  await writeFile(
    path.join(root, '.vima', 'reports', 'convergence.json'),
    JSON.stringify({ schemaVersion: '1', summary: { errors, openPoints }, findings: [] }),
  );
}

test('黄金夹具：未 approve → deliveryLevel=none，exit 0，缺口可执行', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'certify');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const report = await readReport(root);
  assert.equal(report.schemaVersion, '1');
  assert.equal(report.deliveryLevel, 'none');
  assert.equal(report.levels.length, 4);
  assert.equal(levelOf(report, 'spec-approved').satisfied, false);
  assert.match(levelOf(report, 'spec-approved').missing[0], /approve/);
});

test('等级 1 spec-approved：approve 后达成，证据含 tasksApprovedAt', async (t) => {
  const root = await cloneGolden(t);
  await approve(root);
  const r = vima(root, 'certify');
  assert.equal(r.code, 0);
  const report = await readReport(root);
  assert.equal(report.deliveryLevel, 'spec-approved');
  assert.match(levelOf(report, 'spec-approved').evidence[0], /tasksApproved=true/);
  assert.match(levelOf(report, 'spec-approved').evidence[0], /2026-08-14T00:00:00Z/);
  // 未完成的任务 → implemented 缺口如实列出
  assert.equal(levelOf(report, 'implemented').satisfied, false);
  assert.match(levelOf(report, 'implemented').missing.join(' '), /任务未 done/);
});

test('等级 2 implemented：任务全 done 但缺 Verifier 通过报告 → 不达成；补报告后达成', async (t) => {
  const root = await cloneGolden(t);
  await approve(root);
  await markDone(root, ['shared-base', 'device-api-be', 'device-list-fe']);

  vima(root, 'certify');
  let report = await readReport(root);
  assert.equal(report.deliveryLevel, 'spec-approved', '缺 Verifier 报告不得算 implemented');
  assert.match(levelOf(report, 'implemented').missing.join(' '), /Verifier 通过报告/);

  await verifierPass(root, 'device-api-be');
  await verifierPass(root, 'device-list-fe');
  vima(root, 'certify');
  report = await readReport(root);
  assert.equal(report.deliveryLevel, 'implemented');
});

test('等级 3/4：converged 需报告零 error；pipeline-green 需流水线任务全 done', async (t) => {
  const root = await cloneGolden(t);
  await approve(root);
  await markDone(root, ['shared-base', 'device-api-be', 'device-list-fe']);
  await verifierPass(root, 'device-api-be');
  await verifierPass(root, 'device-list-fe');

  // 红报告 → 不达成
  await convergence(root, { errors: 2 });
  vima(root, 'certify');
  let report = await readReport(root);
  assert.equal(report.deliveryLevel, 'implemented');
  assert.match(levelOf(report, 'converged').missing.join(' '), /errors=2/);

  // 绿报告 → converged；pipeline 未 done 时到此为止
  await convergence(root);
  vima(root, 'certify');
  report = await readReport(root);
  assert.equal(report.deliveryLevel, 'converged');
  assert.match(levelOf(report, 'converged').evidence[0], /sha256/);
  assert.match(levelOf(report, 'pipeline-green').missing.join(' '), /full-test/);

  // pipeline done → 最高级
  await markDone(root, ['full-test']);
  vima(root, 'certify');
  report = await readReport(root);
  assert.equal(report.deliveryLevel, 'pipeline-green');
});

test('连续性：跳级不算——低级不满足时高级即便证据齐全也不提升 deliveryLevel', async (t) => {
  const root = await cloneGolden(t);
  // 不 approve（等级 1 不满足），但把 converge 与 pipeline 证据都造齐
  await convergence(root);
  await markDone(root, ['full-test']);
  vima(root, 'certify');
  const report = await readReport(root);
  assert.equal(report.deliveryLevel, 'none', '等级 1 未过 → 不得跳级');
  assert.equal(levelOf(report, 'converged').satisfied, true, '单级判定仍如实为 true');
  assert.equal(levelOf(report, 'pipeline-green').satisfied, true);
});

test('双轴分离 + 显式非宣称 + 确定性（无时间戳）', async (t) => {
  const root = await cloneGolden(t);
  await approve(root);
  const r = vima(root, 'certify');
  assert.match(r.stdout, /模板 stable ≠ 项目 stable/, 'stdout 须澄清双轴语义');
  assert.match(r.stdout, /不采集、也不认证/, 'stdout 须有显式非宣称行');

  const report = await readReport(root);
  assert.equal(report.templateMaturity, 'stable', '模板成熟度取自 A5 template.json status');
  assert.match(report.notCertified, /deployable\/stable/);
  assert.ok(!report.levels.some((l) => l.level === 'deployable' || l.level === 'stable'), '不得引入未采集的等级');

  const first = await readFile(path.join(root, REPORT_REL), 'utf8');
  vima(root, 'certify');
  assert.equal(await readFile(path.join(root, REPORT_REL), 'utf8'), first, '同输入同字节');

  // --json 输出即报告本体
  const j = vima(root, 'certify', '--json');
  assert.equal(j.code, 0);
  assert.equal(j.stdout, first);
});

test('守卫：非 vima 项目 → NOT_IN_PROJECT，不写任何文件', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-c3-certify-novima-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const r = vima(dir, 'certify');
  assert.equal(r.code, 4);
  assert.match(r.stderr, /NOT_IN_PROJECT/);
  let created = true;
  try {
    await access(path.join(dir, '.vima'));
  } catch {
    created = false;
  }
  assert.equal(created, false);
});
