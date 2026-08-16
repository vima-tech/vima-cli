// A44 单测：业务规则承接对账 —— render-matrix 第二张表 + V-COV-01 逐表 + V-COV-02 未承接点名。
//
// 承接判定不是本文件的新逻辑：它复用 `vima context` 注入任务上下文时用的同一个
// `rulesForTask`。故这里测的是**投影**（规则 → 表格行）与**闸门**（未承接是否被点名），
// 不重测交集语义本身（那在 c3.context 里）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ruleRowsOf } from '../../lib/commands/render-matrix.mjs';

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');
const MATRIX_REL = path.join('docs', 'coverage-matrix.md');

function vima(cwd, ...args) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
}

async function cloneGolden(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-a44-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(GOLDEN, dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// ruleRowsOf：纯函数投影
// ---------------------------------------------------------------------------

/** 造一份最小 spec/契约/任务三元组。 */
function fixture({ rules, tasks }) {
  return {
    spec: { rules, pages: new Map([['PAGE-01', { id: 'PAGE-01', apis: ['GET /api/a'] }]]) },
    contracts: [{
      file: 'docs/contracts/x.md',
      apis: [
        { method: 'GET', path: '/api/a' },
        { method: 'POST', path: '/api/b' },
        { method: 'DELETE', path: '/api/c' },
      ],
    }],
    tasks,
  };
}

test('ruleRowsOf：声明 apis 的规则按交集找到承接任务', () => {
  const rows = ruleRowsOf(fixture({
    rules: [{ id: 'RULE-01', type: 'validation', entity: 'X', apis: ['POST /api/b'], desc: 'b 要校验' }],
    tasks: [{ id: 'x-be', fm: { contract: 'docs/contracts/x.md' } }],
  }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0][0], 'b 要校验（RULE-01）');
  assert.equal(rows[0][1], 'validation');
  assert.equal(rows[0][2], 'X');
  assert.equal(rows[0][3], '1 个接口');
  assert.equal(rows[0][4], 'x-be');
});

test('ruleRowsOf：无 apis 的全局规则不是缺口——按定义注入全部任务', () => {
  const rows = ruleRowsOf(fixture({
    rules: [{ id: 'RULE-02', type: 'constraint', entity: 'X', desc: '一律软删除' }],
    tasks: [{ id: 'x-be', fm: { contract: 'docs/contracts/x.md' } }],
  }));
  assert.equal(rows[0][3], '全局（不限接口）');
  assert.equal(rows[0][4], '全局（注入全部任务上下文）');
  assert.ok(!rows[0][4].startsWith('—'), '全局规则不得被 V-COV-02 当成未承接');
});

test('ruleRowsOf：任务声明 apis 负责集时按切片判定——集外的规则成为未承接缺口', () => {
  const rows = ruleRowsOf(fixture({
    rules: [
      { id: 'RULE-01', type: 'validation', entity: 'X', apis: ['POST /api/b'], desc: 'b 要校验' },
      { id: 'RULE-02', type: 'constraint', entity: 'X', apis: ['DELETE /api/c'], desc: 'c 有上限' },
    ],
    // 该任务只负责 POST /api/b，DELETE /api/c 无人认领
    tasks: [{ id: 'x-be', fm: { contract: 'docs/contracts/x.md', apis: ['POST /api/b'] } }],
  }));
  assert.equal(rows[0][4], 'x-be');
  assert.equal(rows[1][4], '—（尚无任务承接）', '负责集之外的规则必须现形');
});

test('ruleRowsOf：前端任务经 page.apis 承接规则（与 context 同源的第二条 join）', () => {
  const rows = ruleRowsOf(fixture({
    rules: [{ id: 'RULE-01', type: 'validation', entity: 'X', apis: ['GET /api/a'], desc: 'a 要校验' }],
    tasks: [{ id: 'x-fe', fm: { page: 'PAGE-01' } }], // 无 contract，只有 page
  }));
  assert.equal(rows[0][4], 'x-fe');
});

test('ruleRowsOf：按 id 升序，与输入顺序无关（渲染确定性）', () => {
  const mk = (order) => ruleRowsOf(fixture({
    rules: order.map((id) => ({ id, type: 'validation', entity: 'X', desc: id })),
    tasks: [],
  })).map((r) => r[0]);
  assert.deepEqual(mk(['RULE-03', 'RULE-01', 'RULE-02']), mk(['RULE-01', 'RULE-02', 'RULE-03']));
});

// ---------------------------------------------------------------------------
// 产物与闸门
// ---------------------------------------------------------------------------

test('render-matrix：产出两张表，业务规则表逐条列出 spec 的 RULE-xx', async (t) => {
  const root = await cloneGolden(t);
  assert.equal(vima(root, 'render-matrix').status, 0);
  const text = await readFile(path.join(root, MATRIX_REL), 'utf8');

  assert.match(text, /## 页面承接/);
  assert.match(text, /## 业务规则承接/);
  assert.match(text, /\| 规则 \| 类型 \| 实体 \| 接口 \| 承接任务 \|/);
  for (const id of ['RULE-01', 'RULE-02', 'RULE-03', 'RULE-04', 'RULE-05', 'RULE-06']) {
    assert.ok(text.includes(`（${id}）`), `业务规则表缺 ${id}`);
  }
  assert.match(text, /合计：6 条规则，其中全局规则 1 条。/);

  // 字节确定性仍成立（两张表不引入任何时间戳/随机序）
  const first = text;
  assert.equal(vima(root, 'render-matrix').status, 0);
  assert.equal(await readFile(path.join(root, MATRIX_REL), 'utf8'), first);
});

test('V-COV-01：两张表列数不同也不误报——逐表校验（A44 D-A44-02）', async (t) => {
  const root = await cloneGolden(t);
  assert.equal(vima(root, 'render-matrix').status, 0);
  const r = vima(root, 'validate', '--artifact', 'docs/coverage-matrix.md');
  assert.equal(r.status, 0, `两表矩阵不得报错\nstderr: ${r.stderr}`);
  assert.ok(!/列数为/.test(r.stderr), `不得出现列数不一致误报：${r.stderr}`);
});

test('V-COV-02：未承接行逐条点名，恒 warn 不阻断（C4 不阻塞）', async (t) => {
  const root = await cloneGolden(t);
  await writeFile(path.join(root, MATRIX_REL), [
    '# 需求覆盖矩阵', '',
    '| 需求 | 接口 | 契约 | 任务 |',
    '|---|---|---|---|',
    '| 设备列表（PAGE-01） | 3 个接口 | docs/contracts/device-api.md | device-api-be |',
    '| 设备详情（PAGE-02） | 1 个接口 | docs/contracts/device-api.md | —（尚无任务承接） |',
    '',
    '| 规则 | 类型 | 实体 | 接口 | 承接任务 |',
    '|---|---|---|---|---|',
    '| 软删除（RULE-06） | constraint | Device | 全局（不限接口） | 全局（注入全部任务上下文） |',
    '| 批量上限（RULE-03） | constraint | Device | 1 个接口 | —（尚无任务承接） |',
    '',
  ].join('\n'));

  const r = vima(root, 'validate', '--artifact', 'docs/coverage-matrix.md');
  assert.equal(r.status, 0, 'warn 不得改变退出码');
  assert.match(r.stderr, /V-COV-02/);
  assert.match(r.stderr, /设备详情（PAGE-02）/, '页面表的未承接行须点名');
  assert.match(r.stderr, /批量上限（RULE-03）/, '规则表的未承接行须点名');
  assert.ok(!/软删除（RULE-06）/.test(r.stderr), '全局规则不得被当成未承接');

  const report = JSON.parse(await readFile(path.join(root, '.vima/reports/planning-validation.json'), 'utf8'));
  assert.equal(report.warnings.filter((w) => w.rule === 'V-COV-02').length, 2);
});
