// 派题测试（P0-9 边分型 + P0-4 并行领题）。
//
// 被测的是**调度语义**：哪条题会被派出去、为什么、以及并行时会不会派重。
// 判据只有一份（actions.dispatchState），所以这里既测 next 的挑选，
// 也测 claim 与它给出的是同一套结论——两处答案不一致时，两边都不会报错。
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { append, readAll } from '../../lib/core/events.mjs';
import { project } from '../../lib/core/claims.mjs';
import { acquire } from '../../lib/core/lease.mjs';
import * as A from '../../lib/front/actions.mjs';

const PKG = fileURLToPath(new URL('../../', import.meta.url));
const BIN = path.join(PKG, 'bin', 'vima.mjs');
const T0 = new Date('2026-08-16T00:00:00.000Z');
const at = (ms) => new Date(+T0 + ms);

function cleanEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.VIMA_PROJECT_DIR;
  delete env.CLAUDE_PROJECT_DIR;
  return env;
}

function run(args, { cwd } = {}) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [BIN, ...args], { cwd, env: cleanEnv() });
    p.stdin.end('');
    let out = ''; let err = '';
    p.stdout.on('data', (c) => { out += c; });
    p.stderr.on('data', (c) => { err += c; });
    p.on('close', (code) => resolve({ code, out, err }));
  });
}

async function tmpProject() {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-next-'));
  await mkdir(path.join(dir, '.vima'), { recursive: true });
  return dir;
}

async function seed(root, id, payload = {}) {
  return append(root, {
    kind: 'claim',
    actor: 'test',
    subject: id,
    payload: { layer: 'spec', statement: `命题 ${id}`, need: 'derived', from: [], ...payload },
  }, { now: T0 });
}

async function evidence(root, id, strength = 'derived') {
  return append(root, {
    kind: 'evidence',
    actor: 'test',
    subject: id,
    payload: { strength, by: { mode: strength } },
  }, { now: at(1000) });
}

async function claimsOf(root) {
  return project((await readAll(root)).events);
}

function ctxOf(root, { actor = 'cli', now = at(2000) } = {}) {
  return { root, config: {}, assetsRoot: path.join(PKG, 'assets'), now, actor };
}

// ── 边分型（P0-9）────────────────────────────────────────────────────────

test('边分型：未达标的 intent 不阻塞下游 spec/contract/impl 开工', async () => {
  // 这是 P0-9 的核心验收点。「降低登录失败率」要上线后的 observed 数据才达标；
  // 若它必须先 meets 才准做下游，项目**永远开不了工**——第一行代码都写不出来。
  const root = await tmpProject();
  await seed(root, 'i-1', { layer: 'intent', need: 'observed' });
  await seed(root, 's-1', { layer: 'spec', from: ['i-1'] });
  await seed(root, 'c-1', { layer: 'contract', from: ['s-1'] });
  await seed(root, 'm-1', { layer: 'impl', from: ['c-1'] });

  const r = await A.next(ctxOf(root));
  // 层序仍在（intent 排最前），但下游没有一条被 intent 卡住
  assert.equal(r.task.id, 'i-1');

  const { claims } = await claimsOf(root);
  for (const id of ['s-1', 'c-1']) {
    const st = A.dispatchState(claims.get(id), { claims, now: at(2000) });
    assert.deepEqual(st.blockedBy, [], `${id} 不该被上游 intent/spec 阻塞`);
    assert.equal(st.dispatchable, true);
  }
  // impl 的上游是 contract（未达标）→ 这条**该**被挡：接口还不存在，照着它写等于凭空捏
  const impl = A.dispatchState(claims.get('m-1'), { claims, now: at(2000) });
  assert.deepEqual(impl.dependsOn, ['c-1']);
  assert.deepEqual(impl.blockedBy, ['c-1']);
  assert.equal(impl.dispatchable, false);
});

test('边分型：derivesFrom 与 dependsOn 分别出现在响应里，含义不同', async () => {
  const root = await tmpProject();
  await seed(root, 'i-1', { layer: 'intent' });
  await seed(root, 'c-1', { layer: 'contract', from: ['i-1'] });
  await evidence(root, 'c-1');
  await seed(root, 'm-1', { layer: 'impl', from: ['i-1', 'c-1'] });

  // intent 未达标，但 contract 达标了 → impl 可派
  const r = await A.next(ctxOf(root));
  assert.equal(r.task.id, 'i-1', '层序：intent 仍排在前面（它自己也是一件待办）');

  const { claims } = await claimsOf(root);
  const st = A.dispatchState(claims.get('m-1'), { claims, now: at(2000) });
  assert.deepEqual(claims.get('m-1').from, ['i-1', 'c-1'], 'derivesFrom 原样保留，追溯与变更影响要用它');
  assert.deepEqual(st.dependsOn, ['c-1'], '只有 contract/impl 这类「必须先存在的东西」进执行依赖');
  assert.deepEqual(st.blockedBy, [], '依赖已达标 → 不阻塞');
});

test('边分型：野生上游（图里没有）不阻塞——那是 audit 的活，不该卡住干活', async () => {
  const root = await tmpProject();
  await seed(root, 'm-1', { layer: 'impl', from: ['不存在的上游'] });
  const { claims } = await claimsOf(root);
  const st = A.dispatchState(claims.get('m-1'), { claims, now: at(2000) });
  assert.deepEqual(st.dependsOn, []);
  assert.equal(st.dispatchable, true);
});

// ── 租约与派题（P0-4）───────────────────────────────────────────────────

test('next：被未过期租约占着的题不派，改派下一条，并如实说出被谁占着', async () => {
  const root = await tmpProject();
  await seed(root, 's-1');
  await seed(root, 's-2');
  await acquire(root, 's-1', { actor: 'builder-a', worktree: '/wt/a', now: T0 });

  const r = await A.next(ctxOf(root));
  assert.equal(r.task.id, 's-2', 's-1 在别人手上，应改派 s-2');
  assert.deepEqual(r.leased.map((l) => [l.claimId, l.actor]), [['s-1', 'builder-a']]);
  assert.ok(r.notes.some((n) => n.includes('builder-a')), 'notes 要指名说出是谁占着');

  // --include-leased 才看得见它（默认不显示，那才是「我该干什么」的答案）
  const all = await A.next(ctxOf(root), { includeLeased: true });
  assert.equal(all.task.id, 's-1');
  assert.equal(all.lease.actor, 'builder-a');
});

test('next：租约过期后那条题重新可派（执行者崩溃了也能恢复）', async () => {
  const root = await tmpProject();
  await seed(root, 's-1');
  await acquire(root, 's-1', { actor: 'crashed', worktree: '/wt/gone', now: T0, ttlMs: 1000 });

  assert.equal((await A.next(ctxOf(root, { now: at(500) }))).task, null, '租约还在时它是唯一的题，没得派');
  const after = await A.next(ctxOf(root, { now: at(2000) }));
  assert.equal(after.task.id, 's-1', '过期后必须能重新派出去，否则崩一次这条题就永久卡死');
  assert.deepEqual(after.leased, []);
});

test('next：所有待办都被占着时说「等」，不说「没有下一步了」', async () => {
  // 两种情况处置完全不同：一个是收工，一个是等别人。合成一句会把人引向错误动作。
  const root = await tmpProject();
  await seed(root, 's-1');
  await acquire(root, 's-1', { actor: 'a', worktree: '/wt/a', now: T0 });
  const r = await A.next(ctxOf(root));
  assert.equal(r.task, null);
  assert.ok(r.notes.some((n) => n.includes('租约')), `notes 应说明是被占着：${JSON.stringify(r.notes)}`);
  assert.ok(!r.notes.some((n) => n.includes('没有下一步')));
});

test('next：租约文件坏了不隐瞒——那条题此刻不受保护，可能被重复派', async () => {
  const root = await tmpProject();
  await seed(root, 's-1');
  await mkdir(path.join(root, '.vima', 'leases', 's-1'), { recursive: true });
  await writeFile(path.join(root, '.vima', 'leases', 's-1', '000001.json'), '{ 半截', 'utf8');
  const r = await A.next(ctxOf(root));
  assert.equal(r.task.id, 's-1');
  assert.ok(r.notes.some((n) => n.includes('读不懂')), '坏租约必须进 notes，不能装作没有');
});

test('claim：取到租约、记一条 run 事件；拿不到时不落事件', async () => {
  const root = await tmpProject();
  await seed(root, 's-1');

  const a = await A.claimTask(ctxOf(root, { actor: 'a' }), 's-1', { worktree: '/wt/a' });
  assert.equal(a.lease.actor, 'a');
  assert.equal(a.renewed, false);

  const before = (await readAll(root)).events.length;

  await assert.rejects(
    () => A.claimTask(ctxOf(root, { actor: 'b' }), 's-1', { worktree: '/wt/b' }),
    (err) => {
      assert.equal(err.code, 'LEASED');
      assert.equal(err.exit, A.EXIT.UNMET);
      assert.match(err.message, /被 a 认领/);
      assert.match(err.message, /过期/, '必须说出什么时候过期，否则人只会去删文件');
      return true;
    },
  );
  assert.equal((await readAll(root)).events.length, before, '没开工的事不该进过程账');
});

test('claim：同一持有者重新认领 = 续租，不是被自己挡住', async () => {
  const root = await tmpProject();
  await seed(root, 's-1');
  await A.claimTask(ctxOf(root, { actor: 'a', now: at(0) }), 's-1', { worktree: '/wt/a' });
  const again = await A.claimTask(ctxOf(root, { actor: 'a', now: at(60_000) }), 's-1', { worktree: '/wt/a' });
  assert.equal(again.renewed, true);
});

test('claim：执行依赖没达标不拦，但必须说出来（C4 不阻塞 ≠ 装作没事）', async () => {
  const root = await tmpProject();
  await seed(root, 'c-1', { layer: 'contract' });
  await seed(root, 'm-1', { layer: 'impl', from: ['c-1'] });
  const r = await A.claimTask(ctxOf(root), 'm-1');
  assert.deepEqual(r.blockedBy, ['c-1']);
  assert.ok(r.notes.some((n) => n.includes('c-1')), '在未定的地基上施工是一个决定，得让人看见');
});

test('next 与 claim 共用同一份判据（两处答案不一致时两边都不会报错）', async () => {
  const root = await tmpProject();
  await seed(root, 'c-1', { layer: 'contract' });
  await seed(root, 'm-1', { layer: 'impl', from: ['c-1'] });
  const n = await A.next(ctxOf(root));
  const c = await A.claimTask(ctxOf(root), n.task.id);
  assert.deepEqual(c.dependsOn, n.dependsOn);
  assert.deepEqual(c.blockedBy, n.blockedBy);
});

// ── 真并发（CLI 全链路）──────────────────────────────────────────────────

test('并行领题：6 个 vima claim **进程**同时抢同一条题，只有一个 exit 0', async () => {
  // 同进程调用测不出这个（fs 会把调用排成近似串行，见 core.lease.test 文件头）。
  // 这里跑的是真实命令行：Builder 实际就是这么用的。
  const root = await tmpProject();
  await seed(root, 's-hot');
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, i) => run(['claim', 's-hot', `--actor=builder-${i}`], { cwd: root })),
  );
  const ok = results.filter((r) => r.code === 0);
  assert.equal(ok.length, 1, `只能有一个执行者拿到题，实际 ${ok.length} 个`);
  for (const r of results.filter((x) => x.code !== 0)) {
    assert.equal(r.code, 5, `拿不到租约是 exit 5（跑通了，结论是「不是你的」）：${r.err}`);
    assert.match(r.err, /LEASED/);
  }
  // 只有赢家那一条 run 事件进了账
  const claimRuns = (await readAll(root)).events.filter((e) => e.kind === 'run' && e.payload?.op === 'claim');
  assert.equal(claimRuns.length, 1, `派工账目也只能有一条，实际 ${claimRuns.length}`);
  // 盘上一条题一个目录（外加运行态自己的 .gitignore）
  assert.deepEqual(await readdir(path.join(root, '.vima', 'leases')), ['.gitignore', 's-hot']);
});

test('已知边界：同 actor 同 worktree 的两次 claim 被当成同一个人（续租，不是互斥）', async () => {
  // 这不是「测试迁就实现」，是把边界钉在明面上：文件系统看不出「同名同目录的两个
  // 执行者」和「同一个执行者重来一次」的区别。真并行时执行者必须能自报家门——
  // Builder 天然在各自的 worktree 里（worktree 不同），人和 CI 用 --actor 区分。
  // 不给区分手段还指望互斥，那才是假的保护。
  const root = await tmpProject();
  await seed(root, 's-hot');
  // 先顺序拿一次，再重复认领。不先拿的话三个进程会去抢**建第一份租约**，
  // 那测的是互斥不是续租——同一条测试同时断言两件事，结果只会时红时绿。
  assert.equal((await run(['claim', 's-hot'], { cwd: root })).code, 0);
  for (let i = 0; i < 3; i++) {
    const again = await run(['claim', 's-hot'], { cwd: root });
    assert.equal(again.code, 0, `同一身份重复认领不该被自己挡住——它是续租：${again.err}`);
    assert.match(again.out, /续租/);
  }
});

test('CLI：next 的两种边分开显示，--include-leased 才显示别人手上的题', async () => {
  const root = await tmpProject();
  await seed(root, 'i-1', { layer: 'intent' });
  await seed(root, 'c-1', { layer: 'contract', from: ['i-1'] });
  await acquire(root, 'i-1', { actor: 'someone', worktree: '/wt/x', now: new Date() });

  const human = await run(['next'], { cwd: root });
  assert.equal(human.code, 0, human.err);
  assert.match(human.out, /c-1/, 'i-1 被占着 → 改派 c-1');
  assert.match(human.out, /派生自 i-1.*derivesFrom/, '来源边要标明它不阻塞');
  assert.match(human.out, /别人手上/);
  assert.match(human.out, /someone/);

  const json = JSON.parse((await run(['next', '--include-leased', '--json'], { cwd: root })).out);
  assert.equal(json.task.id, 'i-1');
  assert.equal(json.includeLeased, true);
  assert.equal(json.lease.actor, 'someone');
});
