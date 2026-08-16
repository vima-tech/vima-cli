// 真实事件流的端到端往返：append 写盘 → readAll 读回 → project 投影。
//
// 单独立这个文件的理由：core.events.test.mjs 里的投影测试喂的是**手造对象**，
// 它验的是投影逻辑，验不到「写盘 → 读回」这一段。而 R3 的失效传播恰好依赖
// 事件的 ts 排序与 lastTouched 时序——手造对象里 ts 是我自己填的，真实流里
// 由 append 按注入的 now 打。两者不一致时，合成测试会全绿而真流失灵。
//
// 这不是假想：本轮 propagateStale 的死代码（lastTouched 从未被赋值）就是被
// 合成投影掩盖过一次的——Web 侧按契约备好、用合成投影测过，仍然没碰到它。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { append, readAll } from '../../lib/core/events.mjs';
import { project, meets, best, blockedByAdHoc } from '../../lib/core/claims.mjs';

async function tempRoot(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima4-rt-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
const at = (s) => new Date(`2026-08-16T00:00:0${s}Z`);

test('真实事件流：失效传播确实被触发（不是合成投影的假绿）', async (t) => {
  const root = await tempRoot(t);
  await append(root, {
    kind: 'claim', actor: 'human', subject: 'spec-login',
    payload: { layer: 'spec', statement: '登录页有记住我', need: 'derived', trust: 'stated' },
  }, { now: at(1) });
  await append(root, {
    kind: 'claim', actor: 'ai', subject: 'impl-login',
    payload: { layer: 'impl', statement: 'LoginPage 实现记住我', need: 'derived', from: ['spec-login'] },
  }, { now: at(2) });
  await append(root, {
    kind: 'evidence', actor: 'system', subject: 'impl-login',
    payload: { strength: 'derived', by: { how: 'scan', mark: '@vima impl-login' } },
  }, { now: at(3) });

  let { events } = await readAll(root);
  let p = project(events);
  assert.equal(meets(p.claims.get('impl-login')), true, '改动前应达标');
  assert.equal(p.stats.stale, 0);

  // 上游改需求
  await append(root, {
    kind: 'claim', actor: 'human', subject: 'spec-login',
    payload: { layer: 'spec', statement: '登录页去掉记住我', need: 'derived', trust: 'stated' },
  }, { now: at(4) });

  ({ events } = await readAll(root));
  p = project(events);
  assert.equal(p.claims.get('impl-login').stale, true, '上游改了，下游必须失效');
  assert.equal(meets(p.claims.get('impl-login')), false, '失效的命题不算达标');
  assert.equal(p.stats.stale, 1, 'R3 的失效清单——「改完了」的判据是它清空');
});

test('真实事件流：重新取证后失效清单清空', async (t) => {
  const root = await tempRoot(t);
  await append(root, { kind: 'claim', actor: 'h', subject: 'up', payload: { layer: 'spec', need: 'derived', statement: 'v1' } }, { now: at(1) });
  await append(root, { kind: 'claim', actor: 'a', subject: 'down', payload: { layer: 'impl', need: 'derived', from: ['up'] } }, { now: at(2) });
  await append(root, { kind: 'evidence', actor: 'system', subject: 'down', payload: { strength: 'derived', by: { how: 'scan' } } }, { now: at(3) });
  await append(root, { kind: 'claim', actor: 'h', subject: 'up', payload: { layer: 'spec', need: 'derived', statement: 'v2' } }, { now: at(4) });
  await append(root, { kind: 'evidence', actor: 'system', subject: 'down', payload: { strength: 'derived', by: { how: 'scan' } } }, { now: at(5) });

  const { events } = await readAll(root);
  const p = project(events);
  assert.equal(p.stats.stale, 0, '在上游修订之后重新取的证，应当解除失效');
  assert.equal(meets(p.claims.get('down')), true);
});

test('真实事件流：裁定带 subject，可回连命题（二次裁决的起点）', async (t) => {
  const root = await tempRoot(t);
  await append(root, {
    kind: 'ruling', actor: 'ai', subject: 'spec-device-status',
    payload: {
      question: '设备状态枚举：spec 三值 / 契约两值',
      chosen: 'contract', confidence: 'low',
      blastRadius: { pages: 3, symbols: 12 },
      rationale: '契约与后端一致，spec 未随决策更新',
    },
  }, { now: at(1) });
  await append(root, {
    kind: 'claim', actor: 'ai', subject: 'spec-device-status',
    payload: { layer: 'spec', statement: '设备状态 enabled|disabled', need: 'derived', trust: 'ruled' },
  }, { now: at(2) });

  const { events } = await readAll(root);
  const p = project(events);
  assert.equal(p.rulings[0].subject, 'spec-device-status', '裁定必须能回连到它产生的命题');
  assert.equal(p.claims.get('spec-device-status').trust, 'ruled', 'AI 裁定出的命题来源标最弱档');
  assert.equal(p.rulings[0].confidence, 'low');
});

test('真实事件流：成本按 actor 可分摊（R2 第四问）', async (t) => {
  const root = await tempRoot(t);
  await append(root, { kind: 'run', actor: 'builder-a', payload: { op: 'build' }, cost: { tokens: 1200, ms: 3000 } }, { now: at(1) });
  await append(root, { kind: 'run', actor: 'builder-b', payload: { op: 'build' }, cost: { tokens: 800, ms: 1000 } }, { now: at(2) });
  await append(root, { kind: 'run', actor: 'builder-a', payload: { op: 'verify' }, cost: { tokens: 500, ms: 900 } }, { now: at(3) });

  const { events } = await readAll(root);
  const { runs, stats } = project(events);
  assert.equal(stats.cost.tokens, 2500);
  const byActor = {};
  for (const r of runs) byActor[r.actor] = (byActor[r.actor] ?? 0) + (r.cost?.tokens ?? 0);
  assert.deepEqual(byActor, { 'builder-a': 1700, 'builder-b': 800 });
});

test('真实事件流：自称不能顶替派生——写盘读回后仍然如此', async (t) => {
  const root = await tempRoot(t);
  await append(root, { kind: 'claim', actor: 'h', subject: 'c', payload: { need: 'derived', statement: 'x' } }, { now: at(1) });
  await append(root, { kind: 'evidence', actor: 'system', subject: 'c', payload: { strength: 'claimed', by: { how: 'agent-note' } } }, { now: at(2) });

  const { events } = await readAll(root);
  const p = project(events);
  assert.equal(best(p.claims.get('c')).strength, 'claimed');
  assert.equal(meets(p.claims.get('c')), false, 'C1：执行者会自称完成，自称永远不足以达到更高门槛');
});

// ── 幂等：重写同样的内容不算「上游变了」──────────────────────────────────
//
// 这里原本是空白：三条失效测试**都先改了 statement 再断言失效**，
// 没有一条断言反面。于是「同一判定有强弱两版」（清自己证据比内容、
// 向下传播比 revision）活了很久——表现是 docs 一字未改重跑 vima compile，
// 下游全部被标失效、audit 出 error 挡交付。
//
// 变异验证的反面就是这类测试：只证明「该红时会红」，不证明「不该红时不红」。

test('真实事件流：上游被重写但内容一样 → 下游不失效（compile 可重跑）', async (t) => {
  const root = await tempRoot(t);
  const up = { layer: 'intent', need: 'claimed', statement: '用户能登录', trust: 'stated', source: 'raw/x.md' };
  await append(root, { kind: 'claim', actor: 'h', subject: 'up', payload: up }, { now: at(1) });
  await append(root, { kind: 'claim', actor: 'a', subject: 'down', payload: { layer: 'spec', need: 'derived', from: ['up'] } }, { now: at(2) });
  await append(root, { kind: 'evidence', actor: 'system', subject: 'down', payload: { strength: 'derived', by: { how: 'scan' } } }, { now: at(3) });

  // 原封不动再编译一遍（compile 是幂等主路，同样的 docs 会写出同样的 payload）
  await append(root, { kind: 'claim', actor: 'h', subject: 'up', payload: { ...up } }, { now: at(4) });
  await append(root, { kind: 'claim', actor: 'a', subject: 'down', payload: { layer: 'spec', need: 'derived', from: ['up'] } }, { now: at(5) });

  const { events } = await readAll(root);
  const p = project(events);
  assert.equal(p.claims.get('down').stale, false, '内容没变就不该失效——否则重跑 compile 会把全绿项目打红');
  assert.equal(meets(p.claims.get('down')), true);
  assert.equal(p.stats.stale, 0);
  assert.equal(p.claims.get('up').revision, 2, 'revision 照常自增（它记的是被写次数）');
  assert.equal(p.claims.get('up').contentRevision, 1, 'contentRevision 只在内容真变时才动——传播判据用它');
});

test('真实事件流：重写后再真改一次，失效照常传播（别把闸门修没了）', async (t) => {
  const root = await tempRoot(t);
  const up = { layer: 'intent', need: 'claimed', statement: 'v1', trust: 'stated', source: 'raw/x.md' };
  await append(root, { kind: 'claim', actor: 'h', subject: 'up', payload: up }, { now: at(1) });
  await append(root, { kind: 'claim', actor: 'a', subject: 'down', payload: { layer: 'spec', need: 'derived', from: ['up'] } }, { now: at(2) });
  await append(root, { kind: 'evidence', actor: 'system', subject: 'down', payload: { strength: 'derived', by: { how: 'scan' } } }, { now: at(3) });
  await append(root, { kind: 'claim', actor: 'h', subject: 'up', payload: { ...up } }, { now: at(4) });          // 空跑
  await append(root, { kind: 'claim', actor: 'h', subject: 'up', payload: { ...up, statement: 'v2' } }, { now: at(5) }); // 真改

  const { events } = await readAll(root);
  const p = project(events);
  assert.equal(p.claims.get('down').stale, true, '内容真变了就必须传播——幂等修复不能把 R3 修没了');
  assert.equal(p.claims.get('up').contentRevision, 2);
});

// ── 三类变化，处置各不相同（S/E 正交，变化处置也必须正交）─────────────────

test('定义变化（impl 换落点）→ 清证据并传播——曾经 impl 根本不算「变」', async (t) => {
  const root = await tempRoot(t);
  await append(root, { kind: 'claim', actor: 'h', subject: 'c', payload: { layer: 'contract', need: 'derived', statement: 'x', impl: ['GET /api/a'] } }, { now: at(1) });
  await append(root, { kind: 'evidence', actor: 'system', subject: 'c', payload: { strength: 'derived', by: { how: 'scan' } } }, { now: at(2) });
  await append(root, { kind: 'claim', actor: 'h', subject: 'c', payload: { layer: 'contract', need: 'derived', statement: 'x', impl: ['GET /api/b'] } }, { now: at(3) });

  const p = project((await readAll(root)).events);
  assert.equal(p.claims.get('c').evidence.length, 0,
    '实现边整个换掉了，旧证据验的是旧落点——不清就是假绿');
});

test('门槛变化（need 提高）→ 证据保留、不再达标——曾经会把跑绿的测试凭空抹掉', async (t) => {
  const root = await tempRoot(t);
  await append(root, { kind: 'claim', actor: 'h', subject: 'c', payload: { layer: 'impl', need: 'derived', statement: 'x' } }, { now: at(1) });
  await append(root, { kind: 'evidence', actor: 'system', subject: 'c', payload: { strength: 'derived', by: { how: 'scan' } } }, { now: at(2) });
  await append(root, { kind: 'claim', actor: 'h', subject: 'c', payload: { layer: 'impl', need: 'executed', statement: 'x' } }, { now: at(3) });

  const c = project((await readAll(root)).events).claims.get('c');
  assert.equal(c.evidence.length, 1, '门槛是门槛，证据是证据——提门槛不该销毁既有事实');
  assert.equal(meets(c), false, '但 derived 证据够不着 executed 门槛了');
});

test('来源变化（trust/source）→ 证据保留、达标不变——来源升档不该重跑测试', async (t) => {
  const root = await tempRoot(t);
  await append(root, { kind: 'claim', actor: 'h', subject: 'c', payload: { layer: 'impl', need: 'derived', statement: 'x', trust: 'stated', source: 'raw/a.md' } }, { now: at(1) });
  await append(root, { kind: 'evidence', actor: 'system', subject: 'c', payload: { strength: 'derived', by: { how: 'scan' } } }, { now: at(2) });
  await append(root, { kind: 'claim', actor: 'h', subject: 'c', payload: { layer: 'impl', need: 'derived', statement: 'x', trust: 'fact', source: 'raw/b.md' } }, { now: at(3) });

  const c = project((await readAll(root)).events).claims.get('c');
  assert.equal(c.evidence.length, 1);
  assert.equal(meets(c), true);
  assert.equal(c.trust, 'fact', 'S 轴实时读当前值');
});

// ── 退休（reconcile 的投影侧）────────────────────────────────────────────

test('退休：退出进度与待办，但下游必须失效——上游没了 ≠ 上游满足了', async (t) => {
  const root = await tempRoot(t);
  await append(root, { kind: 'claim', actor: 'h', subject: 'up', payload: { layer: 'spec', need: 'claimed', statement: 'v1' } }, { now: at(1) });
  await append(root, { kind: 'claim', actor: 'a', subject: 'down', payload: { layer: 'impl', need: 'derived', from: ['up'] } }, { now: at(2) });
  await append(root, { kind: 'evidence', actor: 'system', subject: 'down', payload: { strength: 'derived', by: { how: 'scan' } } }, { now: at(3) });
  await append(root, { kind: 'claim', actor: 'h', subject: 'up', payload: { retired: true, reason: 'docs 删了' } }, { now: at(4) });

  const p = project((await readAll(root)).events);
  assert.equal(p.claims.get('up').retired, true);
  assert.equal(meets(p.claims.get('up')), false, '退休命题谈不上达标');
  assert.equal(p.claims.get('down').stale, true, '依赖已退休上游的命题必须失效');
  assert.equal(p.stats.retired, 1);
  assert.equal(p.stats.total, 1, '进度分母只剩活动的那条——退休的不摊分母');
});

test('复活：退休后重新声明 → 回到活动集，证据从零开始', async (t) => {
  const root = await tempRoot(t);
  await append(root, { kind: 'claim', actor: 'h', subject: 'c', payload: { layer: 'impl', need: 'derived', statement: 'v1' } }, { now: at(1) });
  await append(root, { kind: 'evidence', actor: 'system', subject: 'c', payload: { strength: 'derived', by: { how: 'scan' } } }, { now: at(2) });
  await append(root, { kind: 'claim', actor: 'h', subject: 'c', payload: { retired: true } }, { now: at(3) });
  await append(root, { kind: 'claim', actor: 'h', subject: 'c', payload: { layer: 'impl', need: 'derived', statement: 'v2' } }, { now: at(4) });

  const c = project((await readAll(root)).events).claims.get('c');
  assert.equal(c.retired ?? false, false, '重新声明 = 复活');
  assert.equal(c.evidence.length, 0, '退休期间的旧证据不得自动继承——它验的是退休前的定义');
});

test('复活时字面一模一样也不继承旧证据——「碰巧同文」不构成「仍然验过」', async (t) => {
  const root = await tempRoot(t);
  await append(root, { kind: 'claim', actor: 'h', subject: 'c', payload: { layer: 'impl', need: 'derived', statement: 'same' } }, { now: at(1) });
  await append(root, { kind: 'evidence', actor: 'system', subject: 'c', payload: { strength: 'derived', by: { how: 'scan' } } }, { now: at(2) });
  await append(root, { kind: 'claim', actor: 'h', subject: 'c', payload: { retired: true } }, { now: at(3) });
  await append(root, { kind: 'claim', actor: 'h', subject: 'c', payload: { layer: 'impl', need: 'derived', statement: 'same' } }, { now: at(4) });

  const c = project((await readAll(root)).events).claims.get('c');
  assert.equal(c.evidence.length, 0, '退休期间没人维护证据，复活必须从零取证');
});

// ── 二次裁决闭环（C4 的另一半：AI 先定夺，人事后要能推翻）────────────────

test('override：旧裁定转为已复核，新旧双向可追溯', async (t) => {
  const root = await tempRoot(t);
  const e1 = await append(root, {
    kind: 'ruling', actor: 'ai', subject: null,
    payload: { question: 'q', chosen: 'A', confidence: 'low', blastRadius: ['x'] },
  }, { now: at(1) });
  await append(root, {
    kind: 'ruling', actor: 'human', subject: null,
    payload: { question: 'q', chosen: 'B', confidence: 'high', blastRadius: ['x'], overrides: e1.id },
  }, { now: at(2) });

  const p = project((await readAll(root)).events);
  const old = p.rulings.find((r) => r.id === e1.id);
  const neu = p.rulings.find((r) => r.overrides === e1.id);
  assert.ok(neu, '新裁定要带 overrides');
  assert.equal(old.overriddenBy, neu.id, '旧裁定要被回填 overriddenBy——不回填它就永远显示未复核');
});

test('override 关联命题时，命题修订走同一条失效传播（不造回滚机制）', async (t) => {
  const root = await tempRoot(t);
  await append(root, { kind: 'claim', actor: 'ai', subject: 'spec-x', payload: { layer: 'spec', need: 'claimed', statement: '两值', trust: 'ruled' } }, { now: at(1) });
  await append(root, { kind: 'claim', actor: 'a', subject: 'impl-x', payload: { layer: 'impl', need: 'derived', from: ['spec-x'] } }, { now: at(2) });
  await append(root, { kind: 'evidence', actor: 'system', subject: 'impl-x', payload: { strength: 'derived', by: { how: 'scan' } } }, { now: at(3) });
  // 人改判：spec-x 的陈述被修订（模拟 actions.rule 的 override 分支产出的修订事件）
  await append(root, { kind: 'claim', actor: 'human', subject: 'spec-x', payload: { layer: 'spec', need: 'claimed', statement: '三值（改判）', trust: 'ruled' } }, { now: at(4) });

  const p = project((await readAll(root)).events);
  assert.equal(p.claims.get('impl-x').stale, true,
    '改判引起的命题修订必须让下游失效——推翻走的就是 R3 那条既有链路');
});

// ── 正式证据 vs 现挑命令（codex 评估「最优先的剩余风险」）──────────────────

test('现挑命令的 executed 证据进得了日志，但换不来达标', async (t) => {
  // 这是「正式假绿」的原形：adHoc 标了、meets 不看，于是
  // node -e "process.exit(0)" 照样让 need:executed 的命题变绿。
  const root = await tempRoot(t);
  await append(root, { kind: 'claim', actor: 'h', subject: 'c', payload: { layer: 'impl', need: 'executed', statement: 'x' } }, { now: at(1) });
  await append(root, {
    kind: 'evidence', actor: 'system', subject: 'c',
    payload: { strength: 'executed', by: { mode: 'executed', cmd: ['node', '-e', 'process.exit(0)'], exitCode: 0, adHoc: true } },
  }, { now: at(2) });

  const c = project((await readAll(root)).events).claims.get('c');
  assert.equal(best(c).strength, 'executed', '证据本身确实是 executed——命令真的跑了，如实记');
  assert.equal(meets(c), false, '但现挑的命令换不来达标：挑什么命令就验出什么结论');
  assert.equal(blockedByAdHoc(c), true, '观测面要能指名说出「够门槛但只有临时证据」');
});

test('走策略的 executed 证据算正式，能达标', async (t) => {
  const root = await tempRoot(t);
  await append(root, { kind: 'claim', actor: 'h', subject: 'c', payload: { layer: 'impl', need: 'executed', statement: 'x', policy: 'login-test' } }, { now: at(1) });
  await append(root, {
    kind: 'evidence', actor: 'system', subject: 'c',
    payload: { strength: 'executed', by: { mode: 'executed', cmd: ['npm', 'test'], exitCode: 0, adHoc: false, policy: 'login-test' } },
  }, { now: at(2) });

  const c = project((await readAll(root)).events).claims.get('c');
  assert.equal(meets(c), true, '预登记策略是人写的、可 review 的，agent 改不了');
  assert.equal(blockedByAdHoc(c), false);
});

test('claimed 与 derived 天然正式——内容由系统生成，agent 挑不了「验什么」', async (t) => {
  const root = await tempRoot(t);
  await append(root, { kind: 'claim', actor: 'h', subject: 'c1', payload: { layer: 'impl', need: 'derived', statement: 'x' } }, { now: at(1) });
  await append(root, { kind: 'evidence', actor: 'system', subject: 'c1', payload: { strength: 'derived', by: { mode: 'derived', marks: [] } } }, { now: at(2) });
  await append(root, { kind: 'claim', actor: 'h', subject: 'c2', payload: { layer: 'intent', need: 'claimed', statement: 'y' } }, { now: at(3) });
  await append(root, { kind: 'evidence', actor: 'system', subject: 'c2', payload: { strength: 'claimed', by: { mode: 'claimed', actor: 'agent' } } }, { now: at(4) });

  const p = project((await readAll(root)).events);
  assert.equal(meets(p.claims.get('c1')), true, 'derived 是机械扫出来的');
  assert.equal(meets(p.claims.get('c2')), true, 'need:claimed 的门槛本来就是自述');
});

test('同一命题上 adHoc 与正式证据并存 → 按正式那份算', async (t) => {
  const root = await tempRoot(t);
  await append(root, { kind: 'claim', actor: 'h', subject: 'c', payload: { layer: 'impl', need: 'executed', statement: 'x' } }, { now: at(1) });
  await append(root, { kind: 'evidence', actor: 'system', subject: 'c', payload: { strength: 'executed', by: { mode: 'executed', cmd: ['true'], exitCode: 0, adHoc: true } } }, { now: at(2) });
  await append(root, { kind: 'evidence', actor: 'system', subject: 'c', payload: { strength: 'executed', by: { mode: 'executed', cmd: ['npm', 'test'], exitCode: 0, adHoc: false, policy: 'p' } } }, { now: at(3) });

  const c = project((await readAll(root)).events).claims.get('c');
  assert.equal(meets(c), true, '有一份正式的够门槛就算达标——不因为旁边还有临时证据而否掉');
});

test('改 id = 退休旧的 + 新增新的，**证据不迁移**', async (t) => {
  // codex 问「有没有 ID rename 处理」。有——但答案是刻意的「不特殊处理」：
  // 重命名走 retire + add 这条既有路径，旧证据**不跟着走**。
  //
  // 为什么不做证据迁移：证据验的是「那条陈述在那个落点上成立」。
  // 换了 id 意味着人重新组织了命题，凭什么断定旧证据仍然验证新命题？
  // 真要迁移，得由人显式声明 renames 并承担后果——那是一条独立需求，
  // 不该由 compile 猜。猜错的形态是最糟的一种：一条从没验过的新命题显示绿。
  const root = await tempRoot(t);
  await append(root, { kind: 'claim', actor: 'h', subject: 'old-id', payload: { layer: 'impl', need: 'derived', statement: '同一件事' } }, { now: at(1) });
  await append(root, { kind: 'evidence', actor: 'system', subject: 'old-id', payload: { strength: 'derived', by: { how: 'scan' } } }, { now: at(2) });
  // compile 对账的产物：旧的退休、新的新增
  await append(root, { kind: 'claim', actor: 'h', subject: 'new-id', payload: { layer: 'impl', need: 'derived', statement: '同一件事' } }, { now: at(3) });
  await append(root, { kind: 'claim', actor: 'h', subject: 'old-id', payload: { retired: true } }, { now: at(4) });

  const p = project((await readAll(root)).events);
  assert.equal(p.claims.get('old-id').retired, true);
  assert.equal(p.claims.get('new-id').evidence.length, 0, '新 id 必须从零取证——旧证据没验过它');
  assert.equal(meets(p.claims.get('new-id')), false);
  assert.equal(p.stats.total, 1, '进度里只剩活动的那条，不会两条都算');
});
