// 租约测试（P0-4）。**被测对象是并发**，不是「函数返回了什么」。
//
// ── 变异验证（这条测试自己的验收）─────────────────────────────────────────
// 把 lib/core/lease.mjs 的 createNew 整段换成先探后写：
//     try { await readFile(file, 'utf8'); return false; } catch {}
//     await writeFile(file, text, 'utf8'); return true;
// 下面两条「N 个进程同时抢，只有一个成功」必须**当场变红**。
// 实测：抢空位那条出了 5 个赢家，抢过期租约那条出了 2 个——两条都红，验证有效。
// （赢家个数每次不同，那正是竞态的样子；「只有一个」才是要钉住的不变量。）
//
// 这条验证救过一次场：最早的版本用同进程 `Promise.all([...acquire])` 当并发，
// 变异后**照样全绿**——fs 走线程池 + 微任务队列，8 个调用被排成了近似串行。
// 换成多进程 + 文件闸门对齐起跑线之后，不但变异能测出来，还当场揪出实现里
// 一个真缺陷（rename 抢占会把别人刚建的新租约当旧的抢走，4 个赢家）。
// 「测了并发」和「测出了并发」是两回事，中间隔着这条变异验证。
// ──────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { acquire, read, list, isActive, LEASES_REL, DEFAULT_TTL_MS } from '../../lib/core/lease.mjs';

const LEASE_URL = new URL('../../lib/core/lease.mjs', import.meta.url).href;
const T0 = new Date('2026-08-16T00:00:00.000Z');
const at = (ms) => new Date(+T0 + ms);

async function tmpRoot() {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-lease-'));
  await mkdir(path.join(dir, '.vima'), { recursive: true });
  return dir;
}

/**
 * 真并发：N 个**独立进程**同时抢同一条租约。
 *
 * 为什么不能用同进程的 `Promise.all([...acquire])`：试过，**它是假绿**。
 * 同进程里 fs 操作走 libuv 线程池 + 微任务队列，8 个 acquire 实际被排成了近似串行，
 * 于是把 'wx' 换成 exists+write 之后那条测试**照样通过**——它测的是「函数返回什么」，
 * 不是「两个执行者同时来会怎样」。而 P0-4 的场景恰恰是多进程（多个 Builder）。
 *
 * 起跑线用文件闸门对齐：子进程各写一个 ready 文件后自旋等 go 出现，
 * 父进程见齐 N 个 ready 才放行。不这么做的话进程启动抖动（几十毫秒）足以把
 * 竞态窗口错开，测试又会变成假绿。
 */
async function raceInProcesses(root, claimId, { n, nowIso, ttlMs = null }) {
  const gate = await mkdtemp(path.join(tmpdir(), 'vima-gate-'));
  const child = `
    import { acquire } from ${JSON.stringify(LEASE_URL)};
    import { writeFileSync, existsSync } from 'node:fs';
    // 注意 slice(1)：node -e 时 argv 里没有脚本名那一格
    const [root, claimId, actor, gate, nowIso, ttl] = process.argv.slice(1);
    writeFileSync(gate + '/ready-' + actor, '');
    const sleep = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1);
    while (!existsSync(gate + '/go')) sleep();
    const r = await acquire(root, claimId, {
      actor, worktree: '/wt/' + actor, now: new Date(nowIso),
      ...(ttl === '-' ? {} : { ttlMs: Number(ttl) }),
    });
    process.stdout.write(JSON.stringify(r));
  `;
  const runs = Array.from({ length: n }, (_, i) => new Promise((resolve) => {
    execFile(process.execPath, [
      '--input-type=module', '-e', child, '--',
      root, claimId, `p${i}`, gate, nowIso, ttlMs == null ? '-' : String(ttlMs),
    ], (err, stdout, stderr) => resolve(err
      ? { ok: false, reason: 'crash', stderr: `${stderr}` }
      : JSON.parse(stdout)));
  }));

  // 等所有子进程都到起跑线，再开闸。等不齐就直接炸——静默放行等于测的不是并发。
  let ready = [];
  for (let i = 0; i < 10_000 && ready.length < n; i++) {
    ready = await readdir(gate);
    if (ready.length < n) await new Promise((r) => setTimeout(r, 1));
  }
  assert.ok(ready.length >= n, `只有 ${ready.length}/${n} 个子进程到达起跑线，这次跑的不是并发`);
  await writeFile(path.join(gate, 'go'), '');
  return Promise.all(runs);
}

function assertExactlyOneWinner(results, root, claimId) {
  const won = results.filter((r) => r.ok);
  assert.equal(won.length, 1,
    `同一条题只能派给一个执行者，实际 ${won.length} 个：${won.map((r) => r.lease?.actor).join('、')}`);
  for (const r of results.filter((x) => !x.ok)) {
    assert.ok(['held', 'raced'].includes(r.reason), `未知失败原因 ${r.reason}${r.stderr ?? ''}`);
    // 输的那些必须**说得出被谁占着、什么时候过期**——只说「失败」会让人去删文件
    assert.equal(r.held?.actor, won[0].lease.actor);
    assert.ok(typeof r.held?.expiresAt === 'string' && r.held.expiresAt !== '');
  }
  return won[0];
}

test('acquire：空地直接拿到，落一份可读的租约', async () => {
  const root = await tmpRoot();
  const r = await acquire(root, 'c-1', { actor: 'a', worktree: '/wt/a', now: T0 });
  assert.equal(r.ok, true);
  assert.equal(r.renewed, false);
  assert.equal(r.reclaimed, false);
  assert.deepEqual(r.lease, {
    claimId: 'c-1',
    actor: 'a',
    worktree: '/wt/a',
    claimedAt: T0.toISOString(),
    expiresAt: at(DEFAULT_TTL_MS).toISOString(),
  });
  assert.deepEqual(await read(root, 'c-1'), r.lease, '写下去的和返回的必须是同一份');

  // 落点是 .vima/leases/，不是事件流——事件流一个字节都不该动
  const dirs = await readdir(path.join(root, ...LEASES_REL.split('/')));
  assert.deepEqual(dirs, ['.gitignore', 'c-1']);
  // 运行态不进版本控制：落点自己带 .gitignore（同 .vima/index/ 的处置）
  assert.equal(await readFile(path.join(root, ...LEASES_REL.split('/'), '.gitignore'), 'utf8'), '*\n');
  assert.deepEqual(await readdir(path.join(root, ...LEASES_REL.split('/'), 'c-1')), ['000001.json']);
});

test('acquire：8 个**进程**同时抢同一条题，只有一个成功', async () => {
  const root = await tmpRoot();
  const results = await raceInProcesses(root, 'c-hot', { n: 8, nowIso: T0.toISOString() });
  const won = assertExactlyOneWinner(results, root, 'c-hot');
  assert.equal(won.lease.expiresAt, at(DEFAULT_TTL_MS).toISOString());
  // 盘上也只有一份，且就是赢家那份
  assert.equal((await read(root, 'c-hot')).actor, won.lease.actor);
});

test('acquire：被别人占着且没过期 → 拿不到，如实报持有人', async () => {
  const root = await tmpRoot();
  await acquire(root, 'c-1', { actor: 'a', worktree: '/wt/a', now: T0 });
  const r = await acquire(root, 'c-1', { actor: 'b', worktree: '/wt/b', now: at(60_000) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'held');
  assert.equal(r.held.actor, 'a');
  assert.equal(r.held.worktree, '/wt/a');
  assert.equal((await read(root, 'c-1')).actor, 'a', '抢不到的人不许改动别人的租约');
});

test('acquire：同一持有者重新认领 = 续租（长任务靠它，不靠把 TTL 调大）', async () => {
  const root = await tmpRoot();
  const first = await acquire(root, 'c-1', { actor: 'a', worktree: '/wt/a', now: T0 });
  const again = await acquire(root, 'c-1', { actor: 'a', worktree: '/wt/a', now: at(60_000) });
  assert.equal(again.ok, true);
  assert.equal(again.renewed, true);
  assert.ok(again.lease.expiresAt > first.lease.expiresAt, '续租必须把过期时刻往后推');

  // 身份是 actor + worktree 两段：同名 actor 在**另一个 worktree** 不算同一个人，
  // 否则 CLI 默认 actor 'cli' 会让两个并行会话互相续租对方的租约。
  const other = await acquire(root, 'c-1', { actor: 'a', worktree: '/wt/b', now: at(61_000) });
  assert.equal(other.ok, false);
  assert.equal(other.reason, 'held');
});

test('acquire：过期即可回收——执行者崩溃、worktree 被删都能恢复', async () => {
  const root = await tmpRoot();
  await acquire(root, 'c-1', { actor: 'crashed', worktree: '/wt/gone', now: T0, ttlMs: 1000 });
  // 崩溃：没有任何人来释放，只有时间往前走
  const late = await acquire(root, 'c-1', { actor: 'b', worktree: '/wt/b', now: at(1001) });
  assert.equal(late.ok, true);
  assert.equal(late.reclaimed, true, '这是回收，不是新建——两者要能被区分开');
  assert.equal((await read(root, 'c-1')).actor, 'b');

  // 接手 = 建下一号；临时文件不许留在盘上
  const files = await readdir(path.join(root, ...LEASES_REL.split('/'), 'c-1'));
  assert.deepEqual(files, ['000001.json', '000002.json']);
  const { leases, corrupt } = await list(root);
  assert.deepEqual(leases.map((l) => l.actor), ['b'], 'list 只认序号最大的那份——旧号是历史，不是第二个持有者');
  // 落点自带的 .gitignore 不是租约目录，不能被当成「读不懂的租约」——
  // 否则每次 vima next 都会刷一条假警告，而假警告的唯一结局是没人再看警告。
  assert.deepEqual(corrupt, []);
});

test('acquire：过期回收也是原子的——8 个进程同时抢一份过期租约，仍只有一个成功', async () => {
  // 这条防的是「先 unlink 再 wx」那种写法：A 删、A 建、B 把 A 刚建的删了、B 建
  // → 两个人都拿到同一条题，而且 A 毫不知情。回收必须靠 rename 串行化。
  const root = await tmpRoot();
  await acquire(root, 'c-hot', { actor: 'crashed', worktree: '/wt/gone', now: T0, ttlMs: 1000 });
  const results = await raceInProcesses(root, 'c-hot', { n: 8, nowIso: at(5000).toISOString() });
  const won = assertExactlyOneWinner(results, root, 'c-hot');
  assert.equal(won.reclaimed, true);
  assert.equal((await read(root, 'c-hot')).actor, won.lease.actor);
});

test('acquire：正好到过期时刻算已过期（不留半开区间的歧义）', async () => {
  const root = await tmpRoot();
  const r0 = await acquire(root, 'c-1', { actor: 'a', worktree: null, now: T0, ttlMs: 1000 });
  assert.equal(isActive(r0.lease, at(999)), true);
  assert.equal(isActive(r0.lease, at(1000)), false);
  const r = await acquire(root, 'c-1', { actor: 'b', worktree: null, now: at(1000) });
  assert.equal(r.ok, true);
});

test('租约文件读坏了：可被回收，list 单独报出来而不是整个打不开', async () => {
  const root = await tmpRoot();
  const dir = path.join(root, ...LEASES_REL.split('/'), 'c-broken');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, '000001.json'), '{ 半截', 'utf8');

  const before = await list(root);
  assert.deepEqual(before.leases, []);
  assert.deepEqual(before.corrupt, ['c-broken'], '坏文件要能被指名报出来');

  // 读不懂 = 说不出被谁占着、什么时候过期 = 不能当有效租约挡着人干活
  const r = await acquire(root, 'c-broken', { actor: 'b', worktree: null, now: T0 });
  assert.equal(r.ok, true);
  assert.equal(r.reclaimed, true);
  assert.deepEqual((await list(root)).corrupt, []);
});

test('claimId 带斜杠：落成一个文件，不会跑到子目录里去（否则锁形同虚设）', async () => {
  const root = await tmpRoot();
  const r = await acquire(root, 'spec/login/remember', { actor: 'a', worktree: null, now: T0 });
  assert.equal(r.ok, true);
  const files = await readdir(path.join(root, ...LEASES_REL.split('/')));
  assert.deepEqual(files, ['.gitignore', 'spec%2Flogin%2Fremember']);
  const { leases } = await list(root);
  assert.deepEqual(leases.map((l) => l.claimId), ['spec/login/remember']);
  const second = await acquire(root, 'spec/login/remember', { actor: 'b', worktree: null, now: T0 });
  assert.equal(second.ok, false, '斜杠 id 也必须真的互斥');
});

test('core 不读系统时钟：now 缺席即报错，而不是偷偷用 Date.now()', async () => {
  const root = await tmpRoot();
  await assert.rejects(() => acquire(root, 'c-1', { actor: 'a' }), /now/);
  await assert.rejects(() => acquire(root, 'c-1', { actor: '', now: T0 }), /actor/);
  await assert.rejects(() => acquire(root, '', { actor: 'a', now: T0 }), /命题/);
});

test('租约文件是稳定序列化（键排序 + 2 空格 + 尾换行）', async () => {
  const root = await tmpRoot();
  await acquire(root, 'c-1', { actor: 'a', worktree: '/wt/a', now: T0, ttlMs: 1000 });
  const text = await readFile(path.join(root, ...LEASES_REL.split('/'), 'c-1', '000001.json'), 'utf8');
  assert.equal(text, `${JSON.stringify({
    actor: 'a',
    claimId: 'c-1',
    claimedAt: T0.toISOString(),
    expiresAt: at(1000).toISOString(),
    worktree: '/wt/a',
  }, null, 2)}\n`);
});

test('list：不存在的目录不是错误（还没人认领过任何题）', async () => {
  const root = await tmpRoot();
  assert.deepEqual(await list(root), { leases: [], corrupt: [] });
  assert.equal(await read(root, 'c-1'), null);
});
