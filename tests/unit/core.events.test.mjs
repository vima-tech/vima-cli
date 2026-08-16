// core/events 与 core/claims 的契约测试。
// 这两个模块是全系统的地基——它们错了，上面全错。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { append, readAll, KINDS, strengthRank, trustRank, EVENTS_REL } from '../../lib/core/events.mjs';
import { project, best, meets } from '../../lib/core/claims.mjs';

const NOW = new Date('2026-08-16T00:00:00Z');

async function tempRoot(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima4-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('事件种类是封闭集合——加第五种必须先回答它对应 R2 哪一问', () => {
  assert.deepEqual(KINDS, ['claim', 'evidence', 'ruling', 'run']);
});

test('append 拒绝无 actor 的事件——「谁做的」是 R2 第三问，不可缺', async (t) => {
  const root = await tempRoot(t);
  await assert.rejects(
    () => append(root, { kind: 'claim', subject: 'c1' }, { now: NOW }),
    /actor/,
  );
});

test('append 拒绝未知种类', async (t) => {
  const root = await tempRoot(t);
  await assert.rejects(
    () => append(root, { kind: 'done', actor: 'a' }, { now: NOW }),
    /未知事件种类/,
  );
});

test('同一输入字节一致——投影可重建的前提', async (t) => {
  const a = await tempRoot(t);
  const b = await tempRoot(t);
  const e = { id: 'fixed', kind: 'claim', actor: 'sys', subject: 'c1', payload: { z: 1, a: 2 } };
  await append(a, e, { now: NOW });
  await append(b, e, { now: NOW });
  const [ta, tb] = await Promise.all([
    readFile(path.join(a, ...EVENTS_REL.split('/')), 'utf8'),
    readFile(path.join(b, ...EVENTS_REL.split('/')), 'utf8'),
  ]);
  assert.equal(ta, tb, '键序必须稳定，否则同一状态会产生不同字节');
});

test('坏行跳过不抛——一条写坏的记录不该让整个观测面打不开', async (t) => {
  const root = await tempRoot(t);
  await append(root, { kind: 'claim', actor: 'sys', subject: 'c1' }, { now: NOW });
  const file = path.join(root, ...EVENTS_REL.split('/'));
  await writeFile(file, `${await readFile(file, 'utf8')}{ 坏行\n{"kind":"nope","actor":"x"}\n`);
  const { events, corrupt } = await readAll(root);
  assert.equal(events.length, 1);
  assert.equal(corrupt, 2, '坏 JSON 与未知种类都要计数，不能静默吞掉');
});

test('无事件日志 → 空结果，不抛', async (t) => {
  const root = await tempRoot(t);
  const { events, corrupt } = await readAll(root);
  assert.deepEqual(events, []);
  assert.equal(corrupt, 0);
});

// ── 两个强度轴 ────────────────────────────────────────────────────────────

test('两轴各自单调，且互不干扰', () => {
  assert.ok(strengthRank('observed') > strengthRank('executed'));
  assert.ok(strengthRank('executed') > strengthRank('derived'));
  assert.ok(strengthRank('derived') > strengthRank('claimed'));
  assert.ok(trustRank('fact') > trustRank('stated'));
  assert.ok(trustRank('stated') > trustRank('ruled'), 'AI 裁定是来源轴最弱一档');
  assert.equal(strengthRank('nope'), -1);
});

// ── 命题投影 ──────────────────────────────────────────────────────────────

function claimEvent(subject, payload) {
  return { kind: 'claim', actor: 'sys', subject, payload };
}
function evidenceEvent(subject, strength, by) {
  return { kind: 'evidence', actor: 'sys', subject, payload: { strength, by } };
}

test('达标 = 有证据 且 强度≥门槛 且 未失效', () => {
  const { claims } = project([
    { ...claimEvent('c1', { statement: '按钮存在', need: 'derived' }), id: '1', ts: '1' },
    { ...evidenceEvent('c1', 'derived', 'scan'), id: '2', ts: '2' },
    { ...claimEvent('c2', { statement: '未绑档案进不去', need: 'executed' }), id: '3', ts: '3' },
    { ...evidenceEvent('c2', 'derived', 'scan'), id: '4', ts: '4' },
  ]);
  assert.equal(meets(claims.get('c1')), true, '门槛 derived、证据 derived → 达标');
  assert.equal(meets(claims.get('c2')), false, '门槛 executed、只有 derived → 不达标');
  assert.equal(best(claims.get('c2')).strength, 'derived');
});

test('自称永远不能满足更高门槛——这是 C1 的机制体现', () => {
  const { claims } = project([
    { ...claimEvent('c1', { need: 'derived' }), id: '1', ts: '1' },
    { ...evidenceEvent('c1', 'claimed', 'agent 说做完了'), id: '2', ts: '2' },
  ]);
  assert.equal(meets(claims.get('c1')), false, 'agent 自述不足以达到 derived 门槛');
});

test('无证据的命题如实计入 noEvidence，不算达标', () => {
  const { claims, stats } = project([
    { ...claimEvent('c1', { need: 'derived' }), id: '1', ts: '1' },
  ]);
  assert.equal(best(claims.get('c1')), null);
  assert.equal(meets(claims.get('c1')), false);
  assert.equal(stats.noEvidence, 1);
  assert.equal(stats.met, 0);
});

test('命题内容变更会清掉旧证据——R3 失效传播的起点', () => {
  const { claims } = project([
    { ...claimEvent('c1', { statement: '旧说法', need: 'derived' }), id: '1', ts: '1' },
    { ...evidenceEvent('c1', 'derived', 'scan'), id: '2', ts: '2' },
    { ...claimEvent('c1', { statement: '新说法', need: 'derived' }), id: '3', ts: '3' },
  ]);
  assert.equal(claims.get('c1').evidence.length, 0, '说法变了，旧证据不再算数');
  assert.equal(claims.get('c1').revision, 2);
});

test('上游失效沿编译边传给下游', () => {
  const { claims } = project([
    { ...claimEvent('up', { statement: 'v1', need: 'derived' }), id: '1', ts: '1' },
    { ...claimEvent('down', { statement: '依赖 up', need: 'derived', from: ['up'] }), id: '2', ts: '2' },
    { ...evidenceEvent('down', 'derived', 'scan'), id: '3', ts: '3' },
    { ...claimEvent('up', { statement: 'v2', need: 'derived' }), id: '4', ts: '4' },
  ]);
  assert.equal(claims.get('down').stale, true, '上游改了，下游必须被标失效');
  assert.equal(meets(claims.get('down')), false, '失效的命题不算达标，哪怕它有证据');
});

test('指向不存在命题的证据被丢弃，不崩', () => {
  const { claims } = project([
    { ...evidenceEvent('ghost', 'derived', 'scan'), id: '1', ts: '1' },
  ]);
  assert.equal(claims.size, 0);
});

test('裁定进台账并保留 confidence 与 blastRadius——没有优先级的台账人不会看', () => {
  const { rulings } = project([
    {
      id: '1', ts: '1', kind: 'ruling', actor: 'ai',
      payload: {
        question: '枚举三方冲突', chosen: 'B', confidence: 'low',
        blastRadius: { pages: 3, symbols: 12 }, rationale: '契约与后端一致',
      },
    },
  ]);
  assert.equal(rulings.length, 1);
  assert.equal(rulings[0].confidence, 'low');
  assert.deepEqual(rulings[0].blastRadius, { pages: 3, symbols: 12 });
});

test('成本按 run 事件聚合——R2 第四问', () => {
  const { stats } = project([
    { id: '1', ts: '1', kind: 'run', actor: 'builder-a', payload: { op: 'build' }, cost: { tokens: 1200, ms: 3000 } },
    { id: '2', ts: '2', kind: 'run', actor: 'builder-b', payload: { op: 'build' }, cost: { tokens: 800, ms: 1000 } },
  ]);
  assert.equal(stats.cost.tokens, 2000);
  assert.equal(stats.cost.ms, 4000);
  assert.equal(stats.runs, 2);
});

test('零事件项目不崩，统计全零', () => {
  const { claims, rulings, runs, stats } = project([]);
  assert.equal(claims.size, 0);
  assert.deepEqual(rulings, []);
  assert.deepEqual(runs, []);
  assert.equal(stats.total, 0);
  assert.equal(stats.cost.tokens, 0);
});
