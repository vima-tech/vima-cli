import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { attest, SYSTEM, codeDirs } from '../../lib/ops/attest.mjs';
import { append, readAll } from '../../lib/core/events.mjs';
import { project, meets } from '../../lib/core/claims.mjs';

const NOW = new Date('2026-08-16T00:00:00.000Z');

/** 一个最小的真项目：.vima/ + 一条命题 + 一份带 @vima 标注的源码。 */
async function fixture(t, { need = 'derived', src = null } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-attest-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.vima'), { recursive: true });
  await append(root, {
    kind: 'claim', actor: 'agent:planner', subject: 'c-login-post',
    payload: { layer: 'contract', statement: 'POST /api/login', trust: 'stated', need },
  }, { now: NOW });
  if (src) {
    const file = path.join(root, 'apps', 'web', 'src', 'login.js');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, src, 'utf8');
  }
  const ctx = { root, actor: 'agent:coder', config: { apps: [{ id: 'web', kind: 'admin' }] } };
  return { root, ctx };
}

const evidenceOf = (r) => r.events.find((e) => e.kind === 'evidence');
const runOf = (r) => r.events.find((e) => e.kind === 'run');

test('正例：claimed 记进日志，但恒为最弱档，且 actor 分成「谁说的 / 谁看的」', async (t) => {
  const { root, ctx } = await fixture(t);
  const r = await attest(ctx, 'c-login-post', { mode: 'claimed', note: '登录接口写完了' });

  assert.equal(r.ok, true);
  assert.equal(r.strength, 'claimed');
  const ev = evidenceOf(r);
  assert.equal(ev.payload.strength, 'claimed');
  assert.equal(ev.payload.by.mode, 'claimed', '自述必须能被一眼认出是自述');
  assert.equal(ev.payload.by.actor, 'agent:coder', '记下是谁说的');
  assert.equal(ev.actor, SYSTEM, '证据事件的 actor 恒为系统');
  assert.equal(runOf(r).actor, 'agent:coder', 'run 事件的 actor 是触发者');
  assert.equal(r.events.indexOf(runOf(r)), 0, 'run 在 evidence 之前：先有人发起，系统才去看');

  // 关键：自述进得来，但够不着 need:derived 的门槛
  for (const e of r.events) await append(root, e, { now: NOW });
  const { claims } = project((await readAll(root)).events);
  assert.equal(meets(claims.get('c-login-post')), false, 'claimed 不能让 need:derived 的命题达标');
});

test('反例：claimed 不带 note —— 一句「做完了」连自述都算不上', async (t) => {
  const { ctx } = await fixture(t);
  const r = await attest(ctx, 'c-login-post', 'claimed');
  assert.equal(r.ok, false);
  assert.equal(evidenceOf(r), undefined, '没取到证据就不产出 evidence 事件');
  assert.equal(runOf(r).payload.ok, false, '但失败的尝试要留痕');
  assert.match(r.reason, /note/);
});

test('正例：derived 从 @vima 标注机械推出，证据自陈用的是多粗的工具', async (t) => {
  const { ctx } = await fixture(t, {
    src: '// @vima c-login-post\nexport function login() { return request.post("/login", {}); }\n',
  });
  const r = await attest(ctx, 'c-login-post', 'derived');

  assert.equal(r.ok, true);
  const by = evidenceOf(r).payload.by;
  assert.equal(by.mode, 'derived');
  assert.equal(by.engine, 'regex');
  assert.equal(by.granularity, 'file');
  assert.deepEqual(by.marks, [{ file: 'apps/web/src/login.js', line: 1 }]);
});

test('反例：代码里没有标注就推不出证据——不许「大概实现了」', async (t) => {
  const { ctx } = await fixture(t, { src: '// @vima c-something-else\nexport const x = 1;\n' });
  const r = await attest(ctx, 'c-login-post', 'derived');
  assert.equal(r.ok, false);
  assert.equal(evidenceOf(r), undefined);
  assert.match(r.reason, /找不到 @vima c-login-post/);
});

test('反例：没有代码目录时 derived 直说推不出来，不静默通过', async (t) => {
  const { ctx } = await fixture(t);
  const r = await attest({ ...ctx, config: { apps: [] } }, 'c-login-post', 'derived');
  assert.equal(r.ok, false);
  assert.match(r.reason, /没有可扫描的代码目录/);
});

test('正例：executed 绿了才算，命令与退出码记进 by（可重放）', async (t) => {
  const { ctx } = await fixture(t, { need: 'executed' });
  const r = await attest(ctx, 'c-login-post', {
    mode: 'executed', cmd: [process.execPath, '-e', 'process.exit(0)'],
  });
  assert.equal(r.ok, true);
  const by = evidenceOf(r).payload.by;
  assert.equal(by.mode, 'executed');
  assert.equal(by.exitCode, 0);
  assert.deepEqual(by.cmd, [process.execPath, '-e', 'process.exit(0)']);
  assert.equal(by.cwd, '.');
});

test('反例：命令红了不出证据，但退出码与输出尾巴记进 run（红的输出不留就丢了）', async (t) => {
  const { ctx } = await fixture(t, { need: 'executed' });
  const r = await attest(ctx, 'c-login-post', {
    mode: 'executed',
    cmd: [process.execPath, '-e', 'console.error("3 tests failed"); process.exit(3)'],
  });
  assert.equal(r.ok, false);
  assert.equal(evidenceOf(r), undefined);
  const run = runOf(r);
  assert.equal(run.payload.ok, false);
  assert.equal(run.payload.detail.exitCode, 3);
  assert.match(run.payload.detail.stderrTail, /3 tests failed/);
});

test('反例：executed 的 cmd 给字符串不接——过 shell 的东西不叫可重放', async (t) => {
  const { ctx } = await fixture(t);
  const r = await attest(ctx, 'c-login-post', { mode: 'executed', cmd: 'npm test' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /argv/);
});

test('反例：命令起不来（可执行文件不存在）也不出证据', async (t) => {
  const { ctx } = await fixture(t);
  const r = await attest(ctx, 'c-login-post', {
    mode: 'executed', cmd: ['vima-no-such-binary-xyz'],
  });
  assert.equal(r.ok, false);
  assert.equal(evidenceOf(r), undefined);
  assert.match(r.reason, /起不来/);
});

test('反例：observed 如实说未实现（AR-1），绝不降级用 derived 冒充', async (t) => {
  // 故意给一份有标注的代码：derived 明明能过，observed 也不许借它的光
  const { ctx } = await fixture(t, { src: '// @vima c-login-post\nexport const x = 1;\n' });
  const r = await attest(ctx, 'c-login-post', 'observed');
  assert.equal(r.ok, false);
  assert.equal(r.unimplemented, true);
  assert.equal(r.strength, null);
  assert.equal(evidenceOf(r), undefined, '未实现就是零证据，不是弱证据');
  assert.match(r.reason, /AR-1/);
});

test('反例：给不存在的命题取证 —— 拒绝制造野生证据', async (t) => {
  const { ctx } = await fixture(t);
  const r = await attest(ctx, 'c-nope', { mode: 'claimed', note: '写完了' });
  assert.equal(r.ok, false);
  assert.equal(evidenceOf(r), undefined);
  assert.equal(r.events.length, 1, '只留一条 run，记下有人试过');
  assert.match(r.reason, /不在事件流里/);
});

test('反例：how 不是四种方式之一 —— 抛，不猜', async (t) => {
  const { ctx } = await fixture(t);
  await assert.rejects(() => attest(ctx, 'c-login-post', 'vibes'), /未知取证方式/);
  await assert.rejects(() => attest({ root: ctx.root }, 'c-login-post', 'claimed'), /actor/);
});

test('codeDirs：ctx.dirs 优先，否则按 config.apps 推 apps/<id>', () => {
  assert.deepEqual(codeDirs({ config: { apps: [{ id: 'web' }, { id: 'mp' }] } }), ['apps/web', 'apps/mp']);
  assert.deepEqual(codeDirs({ dirs: ['src'], config: { apps: [{ id: 'web' }] } }), ['src']);
  assert.deepEqual(codeDirs({}), []);
});

// ── P0-2 最小硬化：落点校验与 ad-hoc 标记 ────────────────────────────────

/** 本地小夹具：现有 fixture 只造固定的 c-login-post，这里要控制 impl 与文件落点。 */
async function scopedFixture(t, { impl = [], files = {} } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-attest-scope-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.vima'), { recursive: true });
  await append(root, {
    kind: 'claim', actor: 'agent:planner', subject: 'c-scoped',
    payload: { layer: 'impl', statement: '登录页', trust: 'stated', need: 'derived', impl },
  }, { now: NOW });
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(root, ...rel.split('/'));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text, 'utf8');
  }
  return { root, ctx: { root, actor: 'agent:coder', config: { apps: [{ id: 'web', kind: 'admin' }] } } };
}

test('derived 落点校验：标注写在声明落点之外 → 拒绝，并同时给出两边位置', async (t) => {
  // 没有这一步，「在任意文件里加一行 @vima 注释」就能给任何命题换一份证据。
  const { ctx } = await scopedFixture(t, {
    impl: ['apps/web/src/features/login'],
    files: { 'apps/web/src/other/misc.ts': '// @vima c-scoped\nexport const x = 1;\n' },
  });
  const out = await attest(ctx, 'c-scoped', 'derived');
  assert.equal(out.ok, false);
  assert.match(out.reason, /other\/misc\.ts/, '要指名标注实际在哪');
  assert.match(out.reason, /features\/login/, '要指名声明的落点在哪');
});

test('derived 落点校验：标注落在声明范围内 → 通过，证据记 scopeChecked:true', async (t) => {
  const { ctx } = await scopedFixture(t, {
    impl: ['apps/web/src/features/login'],
    files: { 'apps/web/src/features/login/index.ts': '// @vima c-scoped\nexport const x = 1;\n' },
  });
  const out = await attest(ctx, 'c-scoped', 'derived');
  assert.equal(out.ok, true, out.reason);
  assert.equal(evidenceOf(out).payload.by.scopeChecked, true);
});

test('derived：命题没声明路径式落点 → 不硬卡，但证据如实记 scopeChecked:false', async (t) => {
  // 端点式 impl 的落点校验做不了（regex/file 引擎自陈盲区），不假装校验过。
  const { ctx } = await scopedFixture(t, {
    impl: ['GET /api/login'],
    files: { 'apps/web/anywhere.ts': '// @vima c-scoped\n' },
  });
  const out = await attest(ctx, 'c-scoped', 'derived');
  assert.equal(out.ok, true, out.reason);
  assert.equal(evidenceOf(out).payload.by.scopeChecked, false,
    'scopeChecked:false ≠ 核过了——这份证据只证明标注存在');
});

test('executed 证据恒标 adHoc:true——命令是调用方现挑的，不是预登记策略', async (t) => {
  const { ctx } = await fixture(t, { need: 'executed' });
  const out = await attest(ctx, 'c-login-post',
    { mode: 'executed', cmd: [process.execPath, '-e', 'process.exit(0)'] });
  assert.equal(out.ok, true);
  assert.equal(evidenceOf(out).payload.by.adHoc, true,
    '不打这个标，将来策略机制上线时存量证据分不出哪些是临时命令');
});
