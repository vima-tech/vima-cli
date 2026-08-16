import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { compile, CONFIDENCE } from '../../lib/ops/compile.mjs';
import { append, readAll } from '../../lib/core/events.mjs';
import { project } from '../../lib/core/claims.mjs';

const NOW = new Date('2026-08-16T00:00:00.000Z');

/** 上游命题图。compile 只读 layer，但按真实形状建，避免测试与实现各写一套。 */
function known(entries) {
  return new Map(entries.map((e) => [e.id, {
    id: e.id, layer: e.layer, statement: e.statement ?? '', trust: e.trust ?? 'stated',
    need: 'derived', from: [], impl: [], evidence: [], revision: 1, stale: false,
  }]));
}

const ctx = {
  actor: 'agent:planner',
  claims: known([
    { id: 'r-login', layer: 'intent', statement: '用户要能登录' },
    { id: 's-login', layer: 'spec', statement: '登录用手机号 + 验证码' },
  ]),
};

test('正例：一批下游命题编出 claim 事件，from / trust 原样落进 payload', async () => {
  const { events, claims, rejected } = await compile(ctx, {
    upstream: 's-login',
    layer: 'contract',
    items: [
      { id: 'c-login-post', statement: 'POST /api/login', trust: 'stated', impl: ['POST /api/login'] },
      { id: 'c-login-code', statement: 'POST /api/login/code', trust: 'stated', from: ['s-login', 'r-login'] },
    ],
  });

  assert.deepEqual(rejected, []);
  assert.equal(events.length, 2);
  assert.equal(claims.length, 2);

  assert.equal(events[0].kind, 'claim');
  assert.equal(events[0].actor, 'agent:planner');
  assert.equal(events[0].subject, 'c-login-post');
  assert.deepEqual(events[0].payload.from, ['s-login'], 'from 缺省继承本批 upstream');
  assert.equal(events[0].payload.trust, 'stated');
  assert.equal(events[0].payload.layer, 'contract');
  assert.equal(events[0].payload.need, 'derived', 'need 缺省从严兜底');
  assert.deepEqual(events[0].payload.impl, ['POST /api/login']);

  assert.deepEqual(events[1].payload.from, ['s-login', 'r-login'], '显式 from 覆盖缺省');
});

test('正例：产出的事件草稿能被 events.append 直接吃下，投影回来还是那条命题', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-compile-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.vima'), { recursive: true });

  // 先落上游，再从盘上现算 known（不注入 ctx.claims，走另一条分支）
  await append(root, {
    kind: 'claim', actor: 'human', subject: 's-login',
    payload: { layer: 'spec', statement: '登录用手机号 + 验证码', trust: 'stated' },
  }, { now: NOW });

  const { events } = await compile({ root, actor: 'agent:planner' }, {
    upstream: 's-login',
    layer: 'contract',
    items: [{ id: 'c-login-post', statement: 'POST /api/login', trust: 'stated', need: 'executed' }],
  });
  for (const e of events) await append(root, e, { now: NOW });

  const { events: all } = await readAll(root);
  const { claims } = project(all);
  const c = claims.get('c-login-post');
  assert.equal(c.layer, 'contract');
  assert.equal(c.trust, 'stated');
  assert.equal(c.need, 'executed');
  assert.deepEqual(c.from, ['s-login']);
});

test('反例：说不出出处的命题不予编译（无 from、上游不存在、上游在下游层）', async () => {
  const { events, rejected } = await compile(ctx, {
    layer: 'contract',   // 本批不给 upstream，缺省无从继承
    items: [
      { id: 'c-nowhere', statement: '凭空冒出来的契约', trust: 'stated' },
      { id: 'c-ghost', statement: '引用不存在的上游', trust: 'stated', from: ['s-does-not-exist'] },
    ],
  });

  assert.equal(events.length, 0, '一条都不该产出事件');
  assert.equal(rejected.length, 2);
  assert.match(rejected[0].reasons.join(' '), /缺 from/);
  assert.match(rejected[1].reasons.join(' '), /不在事件流里/);
});

test('反例：编译边只能自上而下——拿 spec 当上游去编 intent 层要拒', async () => {
  const { events, rejected } = await compile(ctx, {
    upstream: 's-login',
    layer: 'intent',
    items: [{ id: 'i-upside-down', statement: '反着编', trust: 'stated', source: 'raw/x.md' }],
  });
  assert.equal(events.length, 0);
  // 顶层的说法与其它层不同：不是「上游不在你之上」，是「你上面根本没有命题」。
  // 直说，别让人去猜层序——顶层写 from 十有八九是把 source 写错了字段。
  assert.match(rejected[0].reasons.join(' '), /最顶层/);
});

test('顶层命题：出处是物料（source），不是上游命题——空项目的第一条靠它进来', async () => {
  const { events, claims, rejected } = await compile(ctx, {
    layer: 'intent',
    items: [{ id: 'i-first', statement: '用户能登录', trust: 'stated', source: 'docs/raw/kickoff.md' }],
  });
  assert.deepEqual(rejected, []);
  assert.equal(claims[0].source, 'docs/raw/kickoff.md');
  assert.deepEqual(claims[0].from, []);
  assert.equal(events[0].payload.source, 'docs/raw/kickoff.md');
});

test('顶层命题缺 source 要拒——说不出物料出处的意图 = AI 自己想出来的需求', async () => {
  const { events, rejected } = await compile(ctx, {
    layer: 'intent',
    items: [{ id: 'i-invented', statement: '凭空的需求', trust: 'stated' }],
  });
  assert.equal(events.length, 0);
  assert.match(rejected[0].reasons.join(' '), /缺 source/);
});

test('反例：trust 不可默认——缺了或写错都拒', async () => {
  const { events, rejected } = await compile(ctx, {
    upstream: 's-login', layer: 'contract',
    items: [
      { id: 'c-no-trust', statement: '没说来源' },
      { id: 'c-bad-trust', statement: '来源写错', trust: 'probably' },
    ],
  });
  assert.equal(events.length, 0);
  assert.equal(rejected.length, 2);
  for (const r of rejected) assert.match(r.reasons.join(' '), /trust/);
});

test('反例：id 形状不合 @vima 标注正则、同批 id 重复、缺 statement', async () => {
  const { events, rejected } = await compile(ctx, {
    upstream: 's-login', layer: 'contract',
    items: [
      { id: 'C_Login', statement: '大写下划线', trust: 'stated' },
      { id: 'c-dup', statement: '第一条', trust: 'stated' },
      { id: 'c-dup', statement: '第二条', trust: 'stated' },
      { id: 'c-empty', statement: '   ', trust: 'stated' },
    ],
  });
  assert.equal(events.length, 1, '只有第一条 c-dup 通过');
  assert.equal(events[0].subject, 'c-dup');
  assert.equal(rejected.length, 3);
  assert.match(rejected[0].reasons.join(' '), /@vima/);
  assert.match(rejected[1].reasons.join(' '), /重复/);
  assert.match(rejected[2].reasons.join(' '), /statement/);
});

test('反例：逐条拒，不牵连同批的好命题', async () => {
  const { events, claims, rejected } = await compile(ctx, {
    upstream: 's-login', layer: 'contract',
    items: [
      { id: 'c-good', statement: '好的', trust: 'stated' },
      { id: 'c-bad', statement: '没来源' },
    ],
  });
  assert.deepEqual(claims.map((c) => c.id), ['c-good']);
  assert.equal(events.length, 1);
  assert.deepEqual(rejected.map((r) => r.id), ['c-bad']);
});

test('正例：ruling 产出裁定事件 + 一条 trust:ruled 的命题，裁定排在命题之前', async () => {
  const { events, claims, rejected } = await compile(ctx, {
    upstream: 's-login', layer: 'contract',
    items: [{
      id: 'c-code-ttl',
      statement: '验证码有效期 5 分钟',
      ruling: {
        question: '规格没写验证码有效期',
        chosen: '5 分钟',
        options: ['1 分钟', '5 分钟', '10 分钟'],
        rationale: '同类系统惯例，且短于会话超时',
        confidence: 'medium',
        blastRadius: ['c-code-ttl', 'c-login-code'],
      },
    }],
  });

  assert.deepEqual(rejected, []);
  assert.equal(events.length, 2);
  assert.equal(events[0].kind, 'ruling', '先裁定后命题：回放顺序即因果');
  assert.equal(events[0].subject, 'c-code-ttl');
  assert.equal(events[0].payload.confidence, 'medium');
  assert.deepEqual(events[0].payload.blastRadius, ['c-code-ttl', 'c-login-code']);
  assert.equal(events[1].kind, 'claim');
  assert.equal(events[1].payload.trust, 'ruled', '裁定出来的命题只能是 ruled');
  assert.equal(claims[0].trust, 'ruled');
});

test('反例：裁定缺 confidence / blastRadius / chosen 一律拒', async () => {
  const base = { question: '缺什么', chosen: 'A', confidence: 'high', blastRadius: ['c-x'] };
  const { events, rejected } = await compile(ctx, {
    upstream: 's-login', layer: 'contract',
    items: [
      { id: 'c-x', statement: 'x', ruling: { ...base, confidence: undefined } },
      { id: 'c-y', statement: 'y', ruling: { ...base, blastRadius: [] } },
      { id: 'c-z', statement: 'z', ruling: { ...base, chosen: '' } },
    ],
  });
  assert.equal(events.length, 0);
  assert.equal(rejected.length, 3);
  assert.match(rejected[0].reasons.join(' '), new RegExp(CONFIDENCE.join('|')));
  assert.match(rejected[1].reasons.join(' '), /blastRadius/);
  assert.match(rejected[2].reasons.join(' '), /chosen/);
});

test('反例：带 ruling 却自称 fact —— AI 定的不许伪装成事实', async () => {
  const { events, rejected } = await compile(ctx, {
    upstream: 's-login', layer: 'contract',
    items: [{
      id: 'c-fake', statement: '伪装', trust: 'fact',
      ruling: { question: 'q', chosen: 'A', confidence: 'low', blastRadius: ['c-fake'] },
    }],
  });
  assert.equal(events.length, 0);
  assert.match(rejected[0].reasons.join(' '), /只能是 'ruled'/);
});

test('反例：层写错、actor 缺失是编程错误，直接抛', async () => {
  await assert.rejects(() => compile(ctx, { layer: 'nonsense', items: [] }), /未知命题层/);
  await assert.rejects(
    () => compile({ claims: ctx.claims }, { layer: 'spec', items: [] }),
    /actor/,
  );
});
