// C2 单测：vima plan 批次算法与命令行为（internal-contracts §9 / §6.5）
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, cp, mkdir, writeFile, rm } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { computeBatches } from '../../lib/commands/plan.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(HERE, '..', '..', 'bin', 'vima.mjs');
const GOLDEN = path.join(HERE, '..', 'fixtures', 'golden');

function runCli(cwd, args) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
}

async function makeTmp(t) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'vima-c2-plan-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));
  // A24：CLI 现在锚定项目根（含 .vima/ 或 docs/lifecycle.json 的最近祖先）。
  // plan 本就要在 init 之后才跑，无标记的目录是合成态——补上标记使夹具贴近真实项目。
  await mkdir(path.join(tmp, 'docs'), { recursive: true });
  await writeFile(path.join(tmp, 'docs', 'lifecycle.json'), '{"schemaVersion":"2.0","currentPhase":"PLANNING"}\n');
  return tmp;
}

/** 写一个最小合法任务文件（frontmatter 满足 §6.1 必填字段）。 */
async function writeTask(root, { id, layer = 'business', status = 'pending', deps = [] }) {
  const dir = path.join(root, 'docs', 'tasks');
  await mkdir(dir, { recursive: true });
  const fm = [
    '---',
    `taskId: ${id}`,
    `title: 任务 ${id}`,
    `status: ${status}`,
    `layer: ${layer}`,
    'side: fullstack',
    `dependsOn: [${deps.join(', ')}]`,
    'retryCount: 0',
    'updatedAt: 2026-08-12T10:00:00Z',
    '---',
    '',
    `# 任务 ${id}`,
    '',
  ].join('\n');
  await writeFile(path.join(dir, `${id}.md`), fm);
}

test('plan --json：黄金夹具批次序列与 serial/parallel 模式', async (t) => {
  const tmp = await makeTmp(t);
  await cp(GOLDEN, tmp, { recursive: true });

  const proc = runCli(tmp, ['plan', '--json']);
  assert.equal(proc.status, 0, `stderr: ${proc.stderr}`);
  const report = JSON.parse(proc.stdout);

  assert.equal(report.schemaVersion, '1');
  assert.equal(report.maxParallel, 8); // A18：默认并行度 5 → 8
  // 批次序列：[shared-base] → [device-api-be] → [device-list-fe] → [full-test]
  assert.deepEqual(
    report.batches.map((b) => b.tasks),
    [['shared-base'], ['device-api-be'], ['device-list-fe'], ['full-test']]
  );
  assert.deepEqual(
    report.batches.map((b) => b.mode),
    ['serial', 'parallel', 'parallel', 'serial']
  );
  assert.deepEqual(
    report.batches.map((b) => b.layer),
    ['shared', 'business', 'business', 'pipeline']
  );
  assert.deepEqual(report.batches.map((b) => b.index), [0, 1, 2, 3]);
  // A18：level 字段——shared/pipeline 各自组内序号，business 为依赖层号
  assert.deepEqual(report.batches.map((b) => b.level), [0, 0, 1, 0]);
  // stats：黄金夹具 shared-base=done，其余 pending
  assert.deepEqual(report.stats, { total: 4, pending: 3, done: 1, failed: 0, blocked: 0, running: 0 });
  // --json 模式只出 stdout，不写报告文件
  assert.equal(existsSync(path.join(tmp, '.vima', 'reports', 'batch-plan.json')), false);
});

test('plan：默认写 .vima/reports/batch-plan.json 并打印批次树', async (t) => {
  const tmp = await makeTmp(t);
  await cp(GOLDEN, tmp, { recursive: true });

  const proc = runCli(tmp, ['plan']);
  assert.equal(proc.status, 0, `stderr: ${proc.stderr}`);
  assert.match(proc.stdout, /📦 批次 0 \[串行\]/);
  assert.match(proc.stdout, /shared-base/);
  assert.match(proc.stdout, /📦 批次 3 \[串行\].*full-test/);

  const reportPath = path.join(tmp, '.vima', 'reports', 'batch-plan.json');
  assert.ok(existsSync(reportPath), '应写入 batch-plan.json');
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  assert.deepEqual(
    report.batches.map((b) => b.tasks),
    [['shared-base'], ['device-api-be'], ['device-list-fe'], ['full-test']]
  );
});

test('plan：依赖成环 → exit 2 且 stderr 含环路径 a → b → a', async (t) => {
  const tmp = await makeTmp(t);
  await writeTask(tmp, { id: 'a', deps: ['b'] });
  await writeTask(tmp, { id: 'b', deps: ['a'] });

  const proc = runCli(tmp, ['plan']);
  assert.equal(proc.status, 2);
  assert.match(proc.stderr, /a → b → a/);
});

test('plan：dependsOn 指向不存在的任务 → exit 2', async (t) => {
  const tmp = await makeTmp(t);
  await writeTask(tmp, { id: 'c', deps: ['ghost'] });

  const proc = runCli(tmp, ['plan']);
  assert.equal(proc.status, 2);
  assert.match(proc.stderr, /ghost/);
});

const mkTask = (id, layer, deps = []) => ({
  id,
  fm: { taskId: id, layer, dependsOn: deps, status: 'pending' },
});

test('computeBatches：business 同层按 id 排序切 ≤maxParallel 子批（A18 默认 8）', () => {
  const tasks = [
    mkTask('base', 'shared'),
    ...['g', 'a', 'f', 'c', 'e', 'b', 'd'].map((id) => mkTask(id, 'business', ['base'])),
    mkTask('z-next', 'business', ['a']),
    mkTask('pipe', 'pipeline', ['z-next']),
  ];
  // 默认并行度 8：7 个同层任务一批装得下
  assert.deepEqual(
    computeBatches(tasks).map((b) => b.tasks),
    [['base'], ['a', 'b', 'c', 'd', 'e', 'f', 'g'], ['z-next'], ['pipe']]
  );
  // 显式 maxParallel=5：退回 5+2 切分（原 A8 行为不变）
  const batches = computeBatches(tasks, 5);
  assert.deepEqual(
    batches.map((b) => b.tasks),
    [
      ['base'], // shared 串行
      ['a', 'b', 'c', 'd', 'e'], // 业务第 0 层，7 个切成 5+2
      ['f', 'g'],
      ['z-next'], // 业务第 1 层（依赖 a）
      ['pipe'], // pipeline 串行收尾
    ]
  );
  assert.deepEqual(
    batches.map((b) => b.mode),
    ['serial', 'parallel', 'parallel', 'parallel', 'serial']
  );
  // A18 流水线化判据：同层切出的两个子批 level 相同，下一层不同
  assert.deepEqual(batches.map((b) => b.level), [0, 0, 0, 1, 0]);
});

test('computeBatches：shared/pipeline 多任务 level 各不相同（不参与流水线化）', () => {
  const tasks = [
    mkTask('s1', 'shared'),
    mkTask('s2', 'shared', ['s1']),
    mkTask('biz', 'business', ['s2']),
    mkTask('p1', 'pipeline', ['biz']),
    mkTask('p2', 'pipeline', ['p1']),
  ];
  const batches = computeBatches(tasks);
  assert.deepEqual(batches.map((b) => b.layer), ['shared', 'shared', 'business', 'pipeline', 'pipeline']);
  assert.deepEqual(batches.map((b) => b.level), [0, 1, 0, 0, 1]);
});

test('plan --max-parallel：合法值生效、越界报 PLAN_PARALLEL exit 2（A18）', async (t) => {
  const tmp = await makeTmp(t);
  await cp(GOLDEN, tmp, { recursive: true });

  const ok = runCli(tmp, ['plan', '--json', '--max-parallel', '3']);
  assert.equal(ok.status, 0, `stderr: ${ok.stderr}`);
  assert.equal(JSON.parse(ok.stdout).maxParallel, 3);

  for (const bad of ['0', '11', '2.5', 'abc']) {
    const proc = runCli(tmp, ['plan', '--max-parallel', bad]);
    assert.equal(proc.status, 2, `--max-parallel ${bad} 应 exit 2`);
    assert.match(proc.stderr, /PLAN_PARALLEL/);
  }
});

test('computeBatches：shared 多任务按拓扑序各占一个 serial 批', () => {
  const mk = (id, layer, deps = []) => ({
    id,
    fm: { taskId: id, layer, dependsOn: deps, status: 'pending' },
  });
  // shared-b 依赖 shared-a；business x 只依赖 shared（视为已满足 → 第 0 层）
  const tasks = [
    mk('shared-b', 'shared', ['shared-a']),
    mk('shared-a', 'shared'),
    mk('x', 'business', ['shared-b']),
  ];
  const batches = computeBatches(tasks);
  assert.deepEqual(
    batches.map((b) => b.tasks),
    [['shared-a'], ['shared-b'], ['x']]
  );
  assert.deepEqual(batches.map((b) => b.mode), ['serial', 'serial', 'parallel']);
});

test('computeBatches：conflictsWith 同层不同批（A8 贪心首适应），批容量与冲突同时满足', () => {
  const mk = (id, layer, deps = [], conflicts) => ({
    id,
    fm: { taskId: id, layer, dependsOn: deps, status: 'pending', ...(conflicts ? { conflictsWith: conflicts } : {}) },
  });
  // a 与 c 冲突（单向声明即可，对称生效）；同层 3 个任务
  const tasks = [
    mk('a', 'business', [], ['c']),
    mk('b', 'business'),
    mk('c', 'business'),
  ];
  const batches = computeBatches(tasks);
  assert.deepEqual(
    batches.map((x) => x.tasks),
    [['a', 'b'], ['c']],
    'a 与 c 不得同批；b 与 a 首适应同批',
  );
  // 无冲突时同一输入仍是一批（防守：冲突逻辑不改变无冲突行为）
  const plain = computeBatches([mk('a', 'business'), mk('b', 'business'), mk('c', 'business')]);
  assert.deepEqual(plain.map((x) => x.tasks), [['a', 'b', 'c']]);
});

test('computeBatches：conflictsWith 指向不存在的任务 → PLAN_CONFLICT exit 2（A8）', () => {
  const mk = (id, conflicts) => ({
    id,
    fm: { taskId: id, layer: 'business', dependsOn: [], status: 'pending', ...(conflicts ? { conflictsWith: conflicts } : {}) },
  });
  assert.throws(
    () => computeBatches([mk('a', ['ghost'])]),
    (err) => err.code === 'PLAN_CONFLICT' && /ghost/.test(err.message),
  );
});
