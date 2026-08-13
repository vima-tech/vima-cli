// C3 单测：vima approve —— 前置链依次拦截（validate → 渲染新鲜度[A12] → pendingConfirm），通过后写 lifecycle 留痕
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(HERE, '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');

async function cloneGolden(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-approve-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(GOLDEN, root, { recursive: true });
  return root;
}

function vima(cwd, ...args) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** 真实渲染两份评审载体（A12：approve 前置 2 是新鲜度机检，占位 HTML 过不了逐字节比对）。 */
function renderReal(root) {
  for (const cmd of ['render-review', 'render-prototype']) {
    const r = vima(root, cmd);
    assert.equal(r.code, 0, `${cmd} 应渲染成功: ${r.stderr}`);
  }
}

test('前置 2 拦截：审计视图/原型未渲染 → exit 4 并提示先渲染', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'approve');
  assert.equal(r.code, 4, `stderr: ${r.stderr}\nstdout: ${r.stdout}`);
  // ❌ 前置未满足块走 stderr（契约 §3 输出流向）；缺失以「不存在」漂移条目呈现（A12）
  assert.match(r.stderr, /docs\/review\/index\.html 不存在/);
  assert.match(r.stderr, /docs\/review\/prototype\.html 不存在/);
  assert.match(r.stderr, /render-review/);
  assert.match(r.stderr, /render-prototype/);
  // 未通过时不得写 tasksApproved
  const lifecycle = JSON.parse(await readFile(path.join(root, 'docs/lifecycle.json'), 'utf8'));
  assert.equal(lifecycle.checklists.PLANNING.tasksApproved, false);
});

test('前置 2 新鲜度拦截（A12）：渲染后改 spec → exit 4 报漂移；重渲后 approve 通过', async (t) => {
  const root = await cloneGolden(t);
  renderReal(root);
  // 渲染后修改 spec 页面块（validate 仍绿：title 为自由文本），产物即成过期
  const p = path.join(root, 'docs/spec.md');
  const text = await readFile(p, 'utf8');
  assert.ok(text.includes('title: 设备列表'));
  await writeFile(p, text.replace('title: 设备列表', 'title: 设备台账列表'));
  const r1 = vima(root, 'approve');
  assert.equal(r1.code, 4, `stderr: ${r1.stderr}\nstdout: ${r1.stdout}`);
  assert.match(r1.stderr, /漂移/);
  assert.match(r1.stderr, /与 spec 渲染结果不一致/);
  assert.match(r1.stderr, /重新渲染/);
  // 重渲后同一命令通过（草→渲→看→定闭环的机检半）
  renderReal(root);
  const r2 = vima(root, 'approve');
  assert.equal(r2.code, 0, `stderr: ${r2.stderr}\nstdout: ${r2.stdout}`);
});

test('前置 1 拦截：validate 未通过 → exit 4 并列错误清单', async (t) => {
  const root = await cloneGolden(t);
  // 前置 1 在渲染新鲜度之前，渲染状态无关
  const p = path.join(root, 'docs/coverage-matrix.md');
  const text = await readFile(p, 'utf8');
  assert.ok(text.includes('device-api-be, full-test'));
  await writeFile(p, text.replace('device-api-be, full-test', 'TODO'));
  const r = vima(root, 'approve');
  assert.equal(r.code, 4);
  assert.match(r.stderr, /validate 未通过/);
  assert.match(r.stderr, /V-COV-01/);
});

test('前置 3 拦截：存在 pendingConfirm 推断项 → exit 4 并列待确认清单', async (t) => {
  const root = await cloneGolden(t);
  const p = path.join(root, 'docs/spec.md');
  const text = await readFile(p, 'utf8');
  assert.ok(text.includes('id: PAGE-01\ntitle: 设备列表'));
  await writeFile(p, text.replace('id: PAGE-01\ntitle: 设备列表', 'id: PAGE-01\npendingConfirm: true\ntitle: 设备列表'));
  renderReal(root); // 改完 spec 再渲染：前置 2 新鲜（A12），让链路走到前置 3
  const r = vima(root, 'approve');
  assert.equal(r.code, 4);
  assert.match(r.stderr, /pendingConfirm/);
  assert.match(r.stderr, /PAGE-01 \(docs\/spec\.md\)/);
});

test('前置全过：打印任务汇总表 → 写 tasksApproved/tasksApprovedAt → 提示可以 /go', async (t) => {
  const root = await cloneGolden(t);
  renderReal(root);
  const r = vima(root, 'approve');
  assert.equal(r.code, 0, `stderr: ${r.stderr}\nstdout: ${r.stdout}`);
  // 任务汇总表：表头六列 + 每个任务一行
  assert.match(r.stdout, /taskId \| title \| layer \| side \| dependsOn \| contract/);
  for (const id of ['shared-base', 'device-api-be', 'device-list-fe', 'full-test']) {
    assert.ok(r.stdout.includes(id), `汇总表缺少任务 ${id}`);
  }
  assert.match(r.stdout, /评审确认已留痕/);
  assert.match(r.stdout, /\/go/);
  const lifecycle = JSON.parse(await readFile(path.join(root, 'docs/lifecycle.json'), 'utf8'));
  assert.equal(lifecycle.checklists.PLANNING.tasksApproved, true);
  // tasksApprovedAt 为真实 ISO 时间戳（approve 属允许时间戳的例外命令）
  assert.match(lifecycle.checklists.PLANNING.tasksApprovedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});
