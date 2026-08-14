// C3 单测：vima mock —— 契约驱动确定性 mock（A27，契约 §6.16 / §14）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, cp, rm, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sampleField, datasetsOf } from '../../lib/commands/mock.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(HERE, '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');
const OUT = '.vima/mock/contract-mock.json';

async function cloneGolden(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-mock-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(GOLDEN, root, { recursive: true });
  return root;
}
const vima = (cwd, ...args) => spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
const sha = (s) => createHash('sha256').update(s).digest('hex');

test('mock 确定性：连跑两次同字节；apis 按 (method,path) 排序', async (t) => {
  const root = await cloneGolden(t);
  assert.equal(vima(root, 'mock').status, 0);
  const first = await readFile(path.join(root, OUT), 'utf8');
  assert.equal(vima(root, 'mock').status, 0);
  const second = await readFile(path.join(root, OUT), 'utf8');
  assert.equal(sha(first), sha(second), '同输入必须同字节（零随机零时间戳）');
  const m = JSON.parse(first);
  const keys = m.apis.map((a) => `${a.method} ${a.path}`);
  assert.deepEqual(keys, [...keys].sort(), 'apis 数组必须自身有序（stableStringify 管不到数组序）');
});

test('mock 四档：分页 GET 出 3/0/20/1(超长)；写操作与详情恒单对象', async (t) => {
  const root = await cloneGolden(t);
  assert.equal(vima(root, 'mock').status, 0);
  const m = JSON.parse(await readFile(path.join(root, OUT), 'utf8'));
  const list = m.apis.find((a) => a.path === '/api/device/list');
  assert.equal(list.datasets.default.records.length, 3);
  assert.equal(list.datasets.empty.records.length, 0);
  assert.equal(list.datasets.many.records.length, 20);
  assert.equal(list.datasets.long.records.length, 1);
  assert.ok(list.datasets.long.records[0].name.length > 120, '「空列表」与「极端长文本」是暴露版面缺陷最有效的两档');
  const detail = m.apis.find((a) => a.path === '/api/device/detail');
  assert.ok(!Array.isArray(detail.datasets.default), '非分页 GET 是单对象');
  assert.equal(detail.datasets.default.id, 1);
  const post = m.apis.find((a) => a.method === 'POST' && a.path === '/api/device');
  assert.equal(typeof post.datasets.default, 'object');
  assert.ok(!post.datasets.default.records, '写操作不出列表');
});

test('mock 类型规则：8 种类型逐条确定（含 A22 json fields 递归）', () => {
  assert.equal(sampleField({ name: 'n', type: 'string' }, 2), 'n_2');
  assert.equal(sampleField({ name: 'n', type: 'number' }, 7), 7);
  assert.equal(sampleField({ name: 'n', type: 'boolean' }, 2), true);
  assert.equal(sampleField({ name: 'n', type: 'boolean' }, 3), false);
  assert.equal(sampleField({ name: 'n', type: 'date' }, 5), '2026-01-05');
  assert.equal(sampleField({ name: 'n', type: 'datetime' }, 12), '2026-01-12T08:00:00Z');
  assert.deepEqual(sampleField({ name: 'n', type: 'array' }, 1), []);
  assert.deepEqual(sampleField({ name: 'n', type: 'json' }, 1), {});
  assert.deepEqual(
    sampleField({ name: 'n', type: 'json', fields: [{ name: 'a', type: 'number' }, { name: 'b', type: 'string' }] }, 3),
    { a: 3, b: 'b_3' },
    'json 声明 fields 子结构（A22）时按子字段递归',
  );
});

test('mock 分页判定只看契约声明：request 无 pageNum/pageSize 的 GET 不出列表', () => {
  const api = { method: 'GET', path: '/api/x', request: [{ name: 'id', type: 'number', required: true }],
    response: [{ name: 'id', type: 'number' }] };
  const d = datasetsOf(api);
  assert.ok(!Array.isArray(d.default) && !d.default.records, '不做路径启发，只按声明');
});

test('mock 无契约 → NO_CONTRACTS exit 4 且不写文件', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-mock-empty-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.vima'), { recursive: true });
  const r = vima(root, 'mock');
  assert.equal(r.status, 4);
  assert.match(r.stderr, /NO_CONTRACTS/);
  assert.ok(!existsSync(path.join(root, OUT)), '无可 mock 时不得写空文件');
});
