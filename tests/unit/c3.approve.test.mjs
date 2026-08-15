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
  const p = path.join(root, 'docs/lifecycle.json');
  const lc = JSON.parse(await readFile(p, 'utf8'));
  lc.designCapability = 'legacy';
  await writeFile(p, `${JSON.stringify(lc, null, 2)}\n`);
  return root;
}

async function markA34(root) {
  const p = path.join(root, 'docs/lifecycle.json');
  const lc = JSON.parse(await readFile(p, 'utf8'));
  lc.designCapability = 'a34';
  await writeFile(p, `${JSON.stringify(lc, null, 2)}\n`);
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
  assert.equal(lifecycle.currentPhase, 'DEVELOPING', 'legacy 项目的最终 approve 也须由内核确定性推进阶段');
  // tasksApprovedAt 为真实 ISO 时间戳（approve 属允许时间戳的例外命令）
  assert.match(lifecycle.checklists.PLANNING.tasksApprovedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

// ── A34：阶段推进事件表（D-A34-28）与 PLANNING 独立校验 profile（D-A34-29）──

test('approve --planning：用独立 profile（不要求 V-TASK/V-COV）→ 进 DESIGNING 并建基线快照', async (t) => {
  const root = await cloneGolden(t);
  // 故意制造 V-COV-01 缺口：任务未拆解时覆盖矩阵必然不完整，完整 validate 会红
  await writeFile(path.join(root, 'docs/coverage-matrix.md'), '| 端 | 页面 | 接口 |\n|---|---|---|\n| admin | PAGE-01 | TODO |\n');
  const r = vima(root, 'approve', '--planning');
  assert.equal(r.code, 0, `PLANNING profile 不该被 V-COV-01 挡住\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const lc = JSON.parse(await readFile(path.join(root, 'docs/lifecycle.json'), 'utf8'));
  assert.equal(lc.currentPhase, 'DESIGNING', 'PLANNING 的下一站是 DESIGNING，不是 DEVELOPING');
  assert.ok(lc.phaseHistory.some((h) => h.phase === 'DESIGNING'), '阶段历史须留痕');
  assert.match(r.stdout, /基线快照/, '受控回写环需要 PLANNING 出口的基线');
});

test('approve --planning 否定用例：spec 层错误仍然拦（放宽的只有任务与覆盖矩阵）', async (t) => {
  const root = await cloneGolden(t);
  await markA34(root);
  const p = path.join(root, 'docs/spec.md');
  const text = await readFile(p, 'utf8');
  // 制造 V-DSN-12 缺口：删掉两页的 fidelity 声明
  await writeFile(p, text.replace(/^ {2}fidelity: D0.*$/gm, ''));
  const r = vima(root, 'approve', '--planning');
  assert.equal(r.code, 4, r.stdout);
  assert.match(r.stderr, /V-DSN-12/, '设计声明缺失属 PLANNING profile 范围内，必须拦');
});

test('approve --planning：planning-brief profile 不执行 V-CODE-*', async (t) => {
  const root = await cloneGolden(t);
  await markA34(root);
  await cp(path.join(root, 'apps/admin/src'), path.join(root, 'src'), { recursive: true });
  await rm(path.join(root, 'apps'), { recursive: true, force: true });
  const p = path.join(root, 'src/api/device.ts');
  await writeFile(p, `${await readFile(p, 'utf8')}\nexport const rogue = () => request.post('/device/rogue')\n`);
  assert.equal(vima(root, 'validate').code, 2, '完整 validate 应命中 V-CODE-01');
  const r = vima(root, 'approve', '--planning');
  assert.equal(r.code, 0, `planning-brief 不该执行 V-CODE-*：${r.stderr}`);
});

test('approve --planning：planning-brief 不加载尚未形成或已损坏的任务', async (t) => {
  const root = await cloneGolden(t);
  await markA34(root);
  const p = path.join(root, 'docs/tasks/device-api-be.md');
  const text = await readFile(p, 'utf8');
  await writeFile(p, text.replace('layer: business', 'layer: nonsense'));
  assert.equal(vima(root, 'validate').code, 2, '完整 validate 应拒绝非法任务 frontmatter');
  const r = vima(root, 'approve', '--planning');
  assert.equal(r.code, 0, `planning-brief 不应读取任务：${r.stderr}`);
});

test('A34 阶段状态机：最终 approve 必须 DESIGNING → DEVELOPING，且非法重复迁移被拒绝', async (t) => {
  const root = await cloneGolden(t);
  await markA34(root);
  assert.equal(vima(root, 'approve', '--planning').code, 0);
  const repeated = vima(root, 'approve', '--planning');
  assert.equal(repeated.code, 4, 'DESIGNING 期不得再次覆盖 PLANNING 基线');
  assert.match(repeated.stderr, /PHASE_TRANSITION/);
  renderReal(root);
  const r = vima(root, 'approve');
  assert.equal(r.code, 0, r.stderr);
  const lc = JSON.parse(await readFile(path.join(root, 'docs/lifecycle.json'), 'utf8'));
  assert.equal(lc.currentPhase, 'DEVELOPING');
  assert.equal(lc.phaseHistory.find((h) => h.phase === 'DESIGNING')?.completedAt === null, false);
  assert.ok(lc.phaseHistory.some((h) => h.phase === 'DEVELOPING' && h.completedAt === null));
});

test('approve 前置 4（A34）：D1 页缺设计产物 → 设计闸门拦住，不得进 DEVELOPING', async (t) => {
  const root = await cloneGolden(t);
  await markA34(root);
  assert.equal(vima(root, 'approve', '--planning').code, 0);
  const p = path.join(root, 'docs/spec.md');
  const text = await readFile(p, 'utf8');
  await writeFile(p, text
    .replace('  fidelity: D0                # A34 V-DSN-12', '  fidelity: D1                # A34 V-DSN-12')
    .replace('  fold: [设备表格]', '  fold: [设备表格]\n  primaryTask: 定位一台异常设备并完成处置'));
  renderReal(root);
  const r = vima(root, 'approve');
  assert.equal(r.code, 4, `stdout: ${r.stdout}`);
  assert.match(r.stderr, /设计闸门未全绿/);
  assert.match(r.stderr, /designArtifactsComplete = false/);
});

test('approve 前置 4：legacy 存量项目整体豁免设计闸门（A19 存量可达性）', async (t) => {
  const root = await cloneGolden(t);
  const lp = path.join(root, 'docs/lifecycle.json');
  const lc = JSON.parse(await readFile(lp, 'utf8'));
  lc.designCapability = 'legacy';
  await writeFile(lp, `${JSON.stringify(lc, null, 2)}\n`);
  renderReal(root);
  const r = vima(root, 'approve');
  assert.equal(r.code, 0, `存量项目不该被新增闸门挡住\nstderr: ${r.stderr}`);
});

test('approve 前置 4：分级建议分歧在批准这一刻如实呈报，但不阻断（契约 §6.20）', async (t) => {
  const root = await cloneGolden(t);
  await markA34(root);
  // 判据指向 D1、声明仍是 D0 —— 这正是「全项目声明 D0 绕过 DESIGNING」的形态
  const specPath = path.join(root, 'docs/spec.md');
  await writeFile(specPath, (await readFile(specPath, 'utf8')).replace(
    '  - block: table\n    name: 设备表格',
    '  - block: table\n    name: 设备表格\n    data: { shape: chart, of: Device }',
  ));
  assert.equal(vima(root, 'approve', '--planning').code, 0);
  renderReal(root);
  assert.equal(vima(root, 'render-matrix').code, 0);

  const r = vima(root, 'approve');
  assert.equal(r.code, 0, `恒不阻断（D-A34-03）: ${r.stderr}`);
  // 结果性输出走 stdout（契约 §3）
  assert.match(r.stdout, /声明保真级低于\/不同于 spec 判据建议/);
  assert.match(r.stdout, /PAGE-01 声明 D0，按判据建议 D1/);
  const lifecycle = JSON.parse(await readFile(path.join(root, 'docs/lifecycle.json'), 'utf8'));
  assert.equal(lifecycle.checklists.PLANNING.tasksApproved, true, '呈报不是阻断');
});

test('approve 前置 4 否定用例：声明与判据一致时不打分级提示（不制造永久噪声）', async (t) => {
  const root = await cloneGolden(t);
  await markA34(root);
  assert.equal(vima(root, 'approve', '--planning').code, 0);
  renderReal(root);
  const r = vima(root, 'approve');
  assert.equal(r.code, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /按判据建议/);
});
