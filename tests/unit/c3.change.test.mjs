// C3 单测：vima change —— 维护期变更事务（A31，契约 §6.18 / §3.1）
// 黄金夹具驱动：open 基线快照 → 改 spec/契约 → impact 影响面 → apply 重开 → close 闸门。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, rm, readFile, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(HERE, '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');
const CONTROLLER_REL = 'backend/src/main/java/demo/DeviceController.java';

async function cloneGolden(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-change-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(GOLDEN, root, { recursive: true });
  return root;
}

function vima(cwd, ...args) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

async function mutate(root, rel, from, to) {
  const p = path.join(root, rel);
  const text = await readFile(p, 'utf8');
  assert.ok(text.includes(from), `变异目标未找到: ${from}`);
  await writeFile(p, text.replace(from, to));
}

async function readJson(root, rel) {
  return JSON.parse(await readFile(path.join(root, rel), 'utf8'));
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

test('change：除 open 描述外，各子命令拒绝多余位置参数', async (t) => {
  const root = await cloneGolden(t);
  for (const args of [['list', 'extra'], ['impact', 'one', 'extra'], ['apply', 'one', 'extra'], ['close', 'one', 'extra']]) {
    const r = vima(root, 'change', ...args);
    assert.equal(r.code, 3, `${args.join(' ')} stderr: ${r.stderr}`);
    assert.match(r.stderr, /多余的位置参数/);
  }
});

/** 同 c3.converge：给黄金夹具 Controller 补 Spring 注解，使 4 个契约接口全部有实现。 */
async function annotateController(root) {
  const p = path.join(root, CONTROLLER_REL);
  let s = await readFile(p, 'utf8');
  s = s.replace('public class DeviceController {', '@RequestMapping("/api/device")\npublic class DeviceController {');
  s = s.replace('    public Object list(', '    @GetMapping("/list")\n    public Object list(');
  s = s.replace('    public Object create(', '    @PostMapping\n    public Object create(');
  s = s.replace('    public Object batchDelete(', '    @PostMapping("/batch-delete")\n    public Object batchDelete(');
  s = s.replace('    public Object detail(', '    @GetMapping("/detail")\n    public Object detail(');
  await writeFile(p, s);
}

/** 制造一次「页面 + 契约」双改动（validate 保持全绿的良性变更）。 */
async function makeBenignChange(root) {
  await mutate(root, 'docs/spec.md', 'id: PAGE-01\ntitle: 设备列表', 'id: PAGE-01\ntitle: 设备列表页');
  await mutate(
    root, 'docs/contracts/device-api.md',
    '      - { name: name, type: string, required: true }',
    '      - { name: name, type: string, required: true }\n      - { name: remark, type: string, required: false, writeOnly: true }',
  );
}

test('open：基线快照逐字节一致 + change.json 结构；再 open → CHANGE_ACTIVE exit 4', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'change', 'open', '设备列表增加备注');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /变更包已开启：chg-001/);

  const change = await readJson(root, '.vima/changes/chg-001/change.json');
  assert.equal(change.schemaVersion, '1');
  assert.equal(change.status, 'open');
  assert.equal(change.description, '设备列表增加备注');
  assert.equal(typeof change.baseline.spec, 'string');
  assert.ok(Object.keys(change.baseline.contracts).includes('docs/contracts/device-api.md'));

  const baseSpec = await readFile(path.join(root, '.vima/changes/chg-001/baseline/docs/spec.md'), 'utf8');
  const curSpec = await readFile(path.join(root, 'docs/spec.md'), 'utf8');
  assert.equal(baseSpec, curSpec, '基线是 open 时的逐字节快照');

  const again = vima(root, 'change', 'open', '第二个变更');
  assert.equal(again.code, 4);
  assert.match(again.stderr, /CHANGE_ACTIVE/);
});

test('impact：无实际改动 → 影响面全零；无在途变更 → NO_CHANGE exit 4', async (t) => {
  const root = await cloneGolden(t);
  const none = vima(root, 'change', 'impact');
  assert.equal(none.code, 4);
  assert.match(none.stderr, /NO_CHANGE/);

  vima(root, 'change', 'open', '空变更');
  const r = vima(root, 'change', 'impact');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const impact = await readJson(root, '.vima/changes/chg-001/impact.json');
  assert.equal(impact.summary.specChanges, 0);
  assert.equal(impact.summary.apiChanges, 0);
  assert.deepEqual(impact.affectedTasks, []);
  assert.deepEqual(impact.reopen, []);
  assert.deepEqual(impact.recheck, ['vima validate']);
});

test('impact：页面 + 契约双改动 → 结构化影响面命中，两次运行字节一致（无时间戳）', async (t) => {
  const root = await cloneGolden(t);
  vima(root, 'change', 'open', '设备列表增加备注');
  await makeBenignChange(root);

  const r = vima(root, 'change', 'impact');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const impact = await readJson(root, '.vima/changes/chg-001/impact.json');
  assert.deepEqual(impact.spec.pages.modified, ['PAGE-01']);
  assert.deepEqual(impact.apis.modified, ['POST /api/device']);
  const ids = impact.affectedTasks.map((x) => x.taskId);
  assert.ok(ids.includes('device-list-fe'), `受影响任务缺 device-list-fe: ${ids}`);
  assert.ok(ids.includes('device-api-be'), `受影响任务缺 device-api-be: ${ids}`);
  const fe = impact.affectedTasks.find((x) => x.taskId === 'device-list-fe');
  assert.ok(fe.reasons.some((s) => s.includes('PAGE-01')), `reasons 须留痕页面命中: ${fe.reasons}`);
  assert.ok(impact.recheck.includes('vima converge'), '接口变更须重跑 converge');
  assert.ok(impact.recheck.includes('vima render-matrix'), '页面/接口变更须重跑矩阵');

  const first = await readFile(path.join(root, '.vima/changes/chg-001/impact.json'), 'utf8');
  vima(root, 'change', 'impact');
  const second = await readFile(path.join(root, '.vima/changes/chg-001/impact.json'), 'utf8');
  assert.equal(first, second, 'impact.json 确定性：同输入同字节');
});

test('apply：受影响的 done 任务重开为 pending，留痕 reopened；close 闸门拦未完成', async (t) => {
  const root = await cloneGolden(t);
  vima(root, 'change', 'open', '设备列表增加备注');
  await makeBenignChange(root);
  await mutate(root, 'docs/tasks/device-list-fe.md', 'status: pending', 'status: done');

  const r = vima(root, 'change', 'apply');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /已重开 1 个任务.*device-list-fe/);
  const taskText = await readFile(path.join(root, 'docs/tasks/device-list-fe.md'), 'utf8');
  assert.match(taskText, /status: pending/, 'done → pending 已写回 frontmatter');
  const change = await readJson(root, '.vima/changes/chg-001/change.json');
  assert.equal(change.status, 'applied');
  assert.deepEqual(change.reopened, ['device-list-fe']);
  assert.ok(change.appliedAt !== null);

  // device-api-be 仍 pending → 传播闸门必须拦住 close
  const closed = vima(root, 'change', 'close');
  assert.equal(closed.code, 2);
  assert.match(closed.stderr, /传播闸门未过/);
  assert.match(closed.stderr, /CHANGE_UNPROPAGATED/);
});

test('apply：legacy 项目页面变更只将受影响页拉回局部 DESIGNING，并作废旧批准', async (t) => {
  const root = await cloneGolden(t);
  const lifecyclePath = path.join(root, 'docs/lifecycle.json');
  const lifecycle = await readJson(root, 'docs/lifecycle.json');
  lifecycle.designCapability = 'legacy';
  lifecycle.designScope = { pages: [] };
  lifecycle.currentPhase = 'MAINTAINING';
  lifecycle.checklists.PLANNING.tasksApproved = true;
  lifecycle.designApproval = {
    directions: {},
    pages: { 'PAGE-01': { approvedAt: '2026-01-01T00:00:00.000Z', fidelity: 'D0' } },
  };
  lifecycle.phaseHistory.push({ phase: 'MAINTAINING', enteredAt: '2026-01-01T00:00:00.000Z', completedAt: null });
  await writeFile(lifecyclePath, `${JSON.stringify(lifecycle, null, 2)}\n`);

  assert.equal(vima(root, 'change', 'open', '调整设备列表体验').code, 0);
  await mutate(root, 'docs/spec.md', 'id: PAGE-01\ntitle: 设备列表', 'id: PAGE-01\ntitle: 设备列表工作台');
  const applied = vima(root, 'change', 'apply');
  assert.equal(applied.code, 0, applied.stderr);

  const after = await readJson(root, 'docs/lifecycle.json');
  assert.equal(after.currentPhase, 'DESIGNING');
  assert.deepEqual(after.designScope.pages, ['PAGE-01']);
  assert.equal(after.designApproval.pages['PAGE-01'], undefined);
  assert.equal(after.checklists.PLANNING.tasksApproved, false);
  assert.match(after.checklists.PLANNING.tasksApprovedInvalidatedReason, /PAGE-01/);
});

test('close：受影响任务全 done + validate/converge 全绿 → 关闭留痕；closed 后不可再 apply', async (t) => {
  const root = await cloneGolden(t);
  await annotateController(root);
  vima(root, 'change', 'open', '设备列表增加备注');
  await makeBenignChange(root);
  await mutate(root, 'docs/tasks/device-list-fe.md', 'status: pending', 'status: done');
  vima(root, 'change', 'apply');
  // 重开的任务「重新完成」+ 另一受影响任务完成
  await mutate(root, 'docs/tasks/device-list-fe.md', 'status: pending', 'status: done');
  await mutate(root, 'docs/tasks/device-api-be.md', 'status: pending', 'status: done');

  const r = vima(root, 'change', 'close');
  assert.equal(r.code, 0, `stderr: ${r.stderr}\nstdout: ${r.stdout}`);
  assert.match(r.stdout, /已关闭/);
  const change = await readJson(root, '.vima/changes/chg-001/change.json');
  assert.equal(change.status, 'closed');
  assert.ok(change.closedAt !== null);
  assert.equal(typeof change.closedSourceHash.spec, 'string');
  assert.ok(await exists(path.join(root, '.vima/changes/chg-001/baseline/docs/spec.md')), '基线保留作审计证据');
  // close 进程内跑了 converge → 报告落盘且为绿
  const conv = await readJson(root, '.vima/reports/convergence.json');
  assert.equal(conv.summary.errors, 0);

  const applyAgain = vima(root, 'change', 'apply', 'chg-001');
  assert.equal(applyAgain.code, 4);
  assert.match(applyAgain.stderr, /已关闭/);

  // closed 后可再开新变更，序号递增
  const reopen = vima(root, 'change', 'open', '下一个需求');
  assert.equal(reopen.code, 0, reopen.stderr);
  assert.match(reopen.stdout, /chg-002/);
  const list = vima(root, 'change', 'list');
  assert.match(list.stdout, /chg-001\s+\[closed\]/);
  assert.match(list.stdout, /chg-002\s+\[open\]/);
});

test('非 vima 项目：change 拒绝执行（NOT_IN_PROJECT，不写任何文件）', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-c3-change-novima-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const r = vima(dir, 'change', 'open', 'x');
  assert.equal(r.code, 4);
  assert.match(r.stderr, /NOT_IN_PROJECT/);
  assert.equal(await exists(path.join(dir, '.vima')), false);
});
