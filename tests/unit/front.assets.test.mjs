// 供料最小闭环的门面测试（P0-3 / P1-4）：config 的受管写入口 + next 的资产下发。
//
// 全部走真 CLI / 真 registry / 真资产仓——不造夹具模拟 registry。
// 这套系统栽过的跟头都在接缝上：夹具测的是自己的假设，不是拼起来的行为。
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { append } from '../../lib/core/events.mjs';

const PKG = fileURLToPath(new URL('../../', import.meta.url));
const BIN = path.join(PKG, 'bin', 'vima.mjs');

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
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-assets-cli-'));
  await mkdir(path.join(dir, '.vima'), { recursive: true });
  return dir;
}

const NOW = new Date('2026-08-16T00:00:00.000Z');

async function seedClaim(root, id, payload = {}) {
  return append(root, {
    kind: 'claim',
    actor: 'test',
    subject: id,
    payload: { layer: 'spec', statement: `命题 ${id}`, need: 'derived', from: [], ...payload },
  }, { now: NOW });
}

async function events(root) {
  const text = await readFile(path.join(root, '.vima', 'events.jsonl'), 'utf8');
  return text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

async function config(root) {
  // 校验失败的命令**不该**写过 config——文件不存在正是「没留下半截写入」的证据
  try {
    return JSON.parse(await readFile(path.join(root, '.vima', 'project.json'), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

// ── app：config.apps 的受管写入口 ─────────────────────────────────────────

test('app add：写进 config、落 config 事件、自动刷新规则投影', async () => {
  const root = await tmpProject();
  const r = await run(['app', 'add', '--id=console', '--kind=admin', '--json'], { cwd: root });
  assert.equal(r.code, 0, r.err);
  const d = JSON.parse(r.out);
  assert.equal(d.synced, true, 'app add 之后要自动跑 sync——端变了，paths 投影要跟着变');

  assert.deepEqual((await config(root)).apps, [{ id: 'console', kind: 'admin' }]);

  // R2：「谁什么时候登记了端」要能从事件流回放出来
  const evs = await events(root);
  const cfg = evs.filter((e) => e.kind === 'run' && e.payload.op === 'config');
  assert.equal(cfg.length, 1);
  assert.equal(cfg[0].payload.what, 'app.add');
  assert.equal(cfg[0].payload.before, null);
  assert.deepEqual(cfg[0].payload.after, { id: 'console', kind: 'admin' });
  assert.equal(cfg[0].actor, 'cli');
});

test('app add 失败面：缺参数 / kind 不在词表 / 重复 id，都是用法错误 exit 1', async () => {
  const root = await tmpProject();

  const noArgs = await run(['app', 'add'], { cwd: root });
  assert.equal(noArgs.code, 1);
  assert.match(noArgs.err, /--id=<id>/);

  // 变异验证（已手工执行）：把 actions.appAdd 里的 sides.includes(kind) 校验删掉，
  // 下面这条当场红——kind 的合法性只有这一道闸，不许静默放行词表外的端形态。
  const badKind = await run(['app', 'add', '--id=x', '--kind=frontend'], { cwd: root });
  assert.equal(badKind.code, 1);
  assert.match(badKind.err, /sides/);
  assert.match(badKind.err, /admin/, '报错要列出词表里的合法取值，人才改得动命令行');
  assert.deepEqual((await config(root)).apps ?? [], [], '校验失败不许留下半截写入');

  assert.equal((await run(['app', 'add', '--id=console', '--kind=admin'], { cwd: root })).code, 0);
  const dup = await run(['app', 'add', '--id=console', '--kind=wechat'], { cwd: root });
  assert.equal(dup.code, 1, '重复登记同 id 是用法错误');
  assert.match(dup.err, /已经登记过/);
  assert.deepEqual((await config(root)).apps, [{ id: 'console', kind: 'admin' }], '重复 add 不许覆盖原有登记');
});

test('app list / app remove：列表如实、移除落事件、移除不存在的 exit 4', async () => {
  const root = await tmpProject();
  await run(['app', 'add', '--id=console', '--kind=admin'], { cwd: root });
  await run(['app', 'add', '--id=mini', '--kind=wechat'], { cwd: root });

  const list = await run(['app', 'list', '--json'], { cwd: root });
  assert.equal(list.code, 0);
  assert.deepEqual(JSON.parse(list.out).apps.map((a) => a.id), ['console', 'mini']);

  const rm = await run(['app', 'remove', '--id=mini'], { cwd: root });
  assert.equal(rm.code, 0, rm.err);
  assert.deepEqual((await config(root)).apps, [{ id: 'console', kind: 'admin' }]);
  const removeEv = (await events(root)).find((e) => e.payload?.what === 'app.remove');
  assert.deepEqual(removeEv.payload.before, { id: 'mini', kind: 'wechat' });
  assert.equal(removeEv.payload.after, null);

  const miss = await run(['app', 'remove', '--id=mini'], { cwd: root });
  assert.equal(miss.code, 4, '移除没登记过的端是 NOT_FOUND，不是用法错误');
  assert.match(miss.err, /NOT_FOUND/);

  const badSub = await run(['app', 'nope'], { cwd: root });
  assert.equal(badSub.code, 1, '未知子命令要报用法，不许静默当成 list');
});

// ── theme：换皮必须真的存在 ───────────────────────────────────────────────

test('theme set：不存在的皮 exit 4 且 config 不动；存在的皮写入并落事件', async () => {
  const root = await tmpProject();

  // 变异验证（已手工执行）：把 actions.themeSet 里的 registry.loadStyle 校验删掉，
  // 下面这条当场红（exit 0 且 nope 被写进 config）——「--theme=不存在的皮 静默成功」
  // 正是这组命令要堵死的洞。
  const bad = await run(['theme', 'set', 'nope'], { cwd: root });
  assert.equal(bad.code, 4);
  assert.match(bad.err, /没有这套皮/);
  assert.match(bad.err, /enterprise-blue/, '报错要列出现有的皮');

  const good = await run(['theme', 'set', 'enterprise-blue'], { cwd: root });
  assert.equal(good.code, 0, good.err);
  assert.equal((await config(root)).theme, 'enterprise-blue');
  const ev = (await events(root)).find((e) => e.payload?.what === 'theme.set');
  assert.equal(ev.payload.after, 'enterprise-blue');

  const noName = await run(['theme', 'set'], { cwd: root });
  assert.equal(noName.code, 1);
});

test('theme show：读得出就说存在，读不出也要说得出为什么（恒 exit 0，它是体检不是闸门）', async () => {
  const root = await tmpProject();
  const ok = await run(['theme', 'show', '--json'], { cwd: root });
  assert.equal(ok.code, 0);
  const d = JSON.parse(ok.out);
  assert.equal(d.theme, 'enterprise-blue'); // DEFAULTS 的默认皮
  assert.equal(d.ok, true);

  // 手改 config 写进坏皮（绕过受管入口的后果，show 要能看见）
  await writeFile(path.join(root, '.vima', 'project.json'), JSON.stringify({ schema: '4', theme: 'ghost' }));
  const broken = await run(['theme', 'show', '--json'], { cwd: root });
  assert.equal(broken.code, 0);
  const b = JSON.parse(broken.out);
  assert.equal(b.ok, false);
  assert.match(b.error, /没有这套皮/);
});

// ── block：装块必须读得出内容 ─────────────────────────────────────────────

test('block add / list / remove：装真块、列表如实、移除落事件', async () => {
  const root = await tmpProject();
  const r = await run(['block', 'add', 'admin/role-management', '--json'], { cwd: root });
  assert.equal(r.code, 0, r.err);
  const d = JSON.parse(r.out);
  assert.deepEqual(d.layers, ['L1', 'L2', 'L3'], '装上的块要报得出读到了哪些层');
  assert.deepEqual((await config(root)).blocks, ['admin/role-management']);
  const ev = (await events(root)).find((e) => e.payload?.what === 'block.add');
  assert.equal(ev.payload.after, 'admin/role-management');

  const list = await run(['block', 'list', '--json'], { cwd: root });
  const l = JSON.parse(list.out);
  assert.deepEqual(l.installed, ['admin/role-management']);
  const entry = l.available.find((b) => b.id === 'admin/role-management');
  assert.equal(entry.installed, true);

  const rm = await run(['block', 'remove', 'admin/role-management'], { cwd: root });
  assert.equal(rm.code, 0, rm.err);
  assert.deepEqual((await config(root)).blocks, []);
  const rmEv = (await events(root)).find((e) => e.payload?.what === 'block.remove');
  assert.equal(rmEv.payload.before, 'admin/role-management');
});

test('block add 失败面：不存在 exit 4 并列出现有的；坏 id / 重复 add 是用法错误', async () => {
  const root = await tmpProject();

  // 变异验证（已手工执行）：把 actions.blockAdd 里的 registry.readBlock 校验删掉，
  // 下面这条当场红——登记读不出内容的块 id，next 供料只会静默少一块。
  const miss = await run(['block', 'add', 'admin/nope'], { cwd: root });
  assert.equal(miss.code, 4);
  assert.match(miss.err, /没有这个块/);
  assert.match(miss.err, /admin\/role-management/, '报错要列出资产仓里现有的块');
  assert.deepEqual((await config(root)).blocks ?? [], []);

  const badId = await run(['block', 'add', 'not-a-block-id'], { cwd: root });
  assert.equal(badId.code, 1);
  assert.match(badId.err, /<set>\/<name>/);

  assert.equal((await run(['block', 'add', 'admin/role-management'], { cwd: root })).code, 0);
  const dup = await run(['block', 'add', 'admin/role-management'], { cwd: root });
  assert.equal(dup.code, 1);
  assert.match(dup.err, /已经装过/);

  const rmMiss = await run(['block', 'remove', 'admin/nope'], { cwd: root });
  assert.equal(rmMiss.code, 4);
});

// ── next：供料按层裁剪（P0-3 的核心）──────────────────────────────────────

test('next 供料：impl 层给 layout+interaction 切片与块的 L2/L3 正文，每段带 source', async () => {
  const root = await tmpProject();
  await run(['block', 'add', 'admin/role-management'], { cwd: root });
  await seedClaim(root, 'c-impl', { layer: 'impl' });

  const r = await run(['next', '--json'], { cwd: root });
  assert.equal(r.code, 0, r.err);
  const d = JSON.parse(r.out);

  // 词表切片是紧凑形态：组名 + 词条 id，不是词条全文
  const shells = d.assets.vocab.find((s) => s.vocab === 'layout' && s.group === 'shells');
  assert.ok(shells, 'impl 层要有 layout 词表的组切片');
  assert.ok(shells.terms.includes('sidebar-main'));
  assert.equal(typeof shells.terms[0], 'string', '切片只给 id，不给词条对象全文');
  assert.match(shells.source, /layout\.vocab\.json$/);
  const loading = d.assets.vocab.find((s) => s.vocab === 'interaction' && s.group === 'loading');
  assert.ok(loading, 'impl 层要有 interaction 词表的组切片');
  assert.ok(loading.terms.includes('skeleton'));

  // 块内容按层：impl 给 L2/L3 正文，不给 L1
  assert.deepEqual(d.assets.blocks.map((b) => b.layer).sort(), ['L2', 'L3']);
  for (const b of d.assets.blocks) {
    assert.equal(b.block, 'admin/role-management');
    assert.ok(b.text.length > 0, `${b.layer} 要给正文`);
    assert.match(b.source, /L[23]\..+\.md$/, '每段资产要带 source（从哪个文件来的）');
  }
  assert.equal(d.assets.degraded, false);
  assert.ok(d.assets.bytes > 0);

  // 人读输出同样要有供料，不是只给 --json
  const human = await run(['next'], { cwd: root });
  assert.match(human.out, /词表切片/);
  assert.match(human.out, /块供料 admin\/role-management L2/);
});

test('next 供料：contract 层只给 L1、不给词表；spec 层两样都不给', async () => {
  const contractRoot = await tmpProject();
  await run(['block', 'add', 'admin/role-management'], { cwd: contractRoot });
  await seedClaim(contractRoot, 'c-contract', { layer: 'contract' });
  const c = JSON.parse((await run(['next', '--json'], { cwd: contractRoot })).out);
  assert.deepEqual(c.assets.vocab, [], 'contract 层不给词表——接口形状用不上版面词');
  assert.deepEqual(c.assets.blocks.map((b) => b.layer), ['L1']);
  assert.match(c.assets.blocks[0].source, /L1\..+\.md$/);

  const specRoot = await tmpProject();
  await run(['block', 'add', 'admin/role-management'], { cwd: specRoot });
  await seedClaim(specRoot, 'c-spec', { layer: 'spec' });
  const s = JSON.parse((await run(['next', '--json'], { cwd: specRoot })).out);
  assert.deepEqual(s.assets.vocab, []);
  assert.deepEqual(s.assets.blocks, []);
});

test('next 供料：主题读不出时不崩、notes 说明缺料（audit 另有一条 error 兜着）', async () => {
  const root = await tmpProject();
  await writeFile(path.join(root, '.vima', 'project.json'),
    JSON.stringify({ schema: '4', theme: 'ghost', blocks: ['admin/role-management'] }));
  await seedClaim(root, 'c-impl', { layer: 'impl' });

  const r = await run(['next', '--json'], { cwd: root });
  assert.equal(r.code, 0, '缺料不该让「下一步该干什么」这个问题答不了');
  const d = JSON.parse(r.out);
  assert.deepEqual(d.assets.vocab, []);
  assert.ok(d.notes.some((n) => /ghost/.test(n)), 'notes 要说明词表切片为什么没附上');
  // 块供料不依赖主题，照常给
  assert.deepEqual(d.assets.blocks.map((b) => b.layer).sort(), ['L2', 'L3']);
});

test('16KB 体积闸门：超限降级为引用（正文没了、source 还在），不超不动', async () => {
  const { packAssets, ASSET_BYTE_LIMIT } = await import('../../lib/front/actions.mjs');
  const { readBlock } = await import('../../lib/assets/registry.mjs');
  // 用真块正文堆体积，不编造内容——降级判据要对着真实资产的形状验
  const block = await readBlock(path.join(PKG, 'assets'), 'admin', 'role-management');
  const entry = () => ({
    block: 'admin/role-management', layer: 'L3',
    source: '/assets/blocks/admin/role-management/L3.frontend.md',
    text: block.L3.text,
  });

  const small = packAssets({ vocab: [], blocks: [entry()], bytes: 0, degraded: false });
  assert.equal(small.degraded, false);
  assert.ok(small.blocks[0].text, '没超限不许动正文');

  const n = Math.ceil(ASSET_BYTE_LIMIT / Buffer.byteLength(block.L3.text)) + 1;
  const big = packAssets({ vocab: [], blocks: Array.from({ length: n }, entry), bytes: 0, degraded: false });
  assert.equal(big.degraded, true);
  assert.ok(big.bytes > ASSET_BYTE_LIMIT);
  for (const b of big.blocks) {
    assert.equal('text' in b, false, '降级后不许再带正文——引用形态就是引用形态');
    assert.ok(b.bytes > 0, '要说得出被降级的正文有多大');
    assert.ok(b.source, '降级的含义是「自己去读这个文件」，source 必须还在');
  }
});

// ── audit：资产健康（任务 3）──────────────────────────────────────────────

test('audit：登记的 theme 不存在是 error（exit 5），块读不出是 warn', async () => {
  const root = await tmpProject();
  await writeFile(path.join(root, '.vima', 'project.json'),
    JSON.stringify({ schema: '4', theme: 'ghost', blocks: ['admin/nope', 'admin/role-management'] }));

  const r = await run(['audit', '--json'], { cwd: root });
  assert.equal(r.code, 5, '主题不存在曾经一路静默——现在必须挡在 audit 这里');
  const d = JSON.parse(r.out);

  const themeFinding = d.findings.find((f) => f.kind === 'theme-missing');
  assert.equal(themeFinding.severity, 'error');
  assert.equal(themeFinding.subject, 'ghost');

  const blockFindings = d.findings.filter((f) => f.kind === 'block-broken');
  assert.deepEqual(blockFindings.map((f) => f.subject), ['admin/nope'], '完整的块不许被误报');
  assert.equal(blockFindings[0].severity, 'warn');

  assert.equal(d.summary.assets.theme.ok, false);
  assert.equal(d.summary.assets.blocks.length, 2);
  assert.equal(d.summary.counts.error >= 1, true, '合并后的计数要含资产发现，不许 ok:true 与 errors>0 并存');

  const human = await run(['audit'], { cwd: root });
  assert.match(human.out, /theme-missing/);
  assert.match(human.out, /资产 主题 ghost（读不出）/);
});

test('audit：theme 与块都健康时资产层零发现（体检不制造噪音）', async () => {
  const root = await tmpProject();
  await run(['block', 'add', 'admin/role-management'], { cwd: root });
  const d = JSON.parse((await run(['audit', '--json'], { cwd: root })).out);
  assert.deepEqual(d.findings.filter((f) => f.kind === 'theme-missing' || f.kind === 'block-broken'), []);
  assert.equal(d.summary.assets.theme.ok, true);
});

// ── 资产锁：可复现性（P0-3）─────────────────────────────────────────────────
//
// 摘要本身的性质（确定性、改一个字节必变、与目录无关）在 assets.lock.test.mjs 里
// 对着真文件验。这里验的是**门面有没有真的把它接上**：受管入口写不写锁、
// sync --check 认不认资产漂、upgrade 列不列受影响的命题。

const LOCK = ['.vima', 'assets.lock.json'];

async function lockOf(root) {
  try {
    return JSON.parse(await readFile(path.join(root, ...LOCK), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

test('block add / theme set 写锁，block remove 销账——project.json 记想用什么，lock 记用的哪一版', async () => {
  const root = await tmpProject();
  await run(['block', 'add', 'admin/role-management'], { cwd: root });

  const lock = await lockOf(root);
  assert.ok(lock, 'block add 必须写 .vima/assets.lock.json——只写 config 的话那个名字会漂');
  assert.equal(lock.schema, '4');
  assert.equal(lock.blocks.length, 1);
  const entry = lock.blocks[0];
  assert.equal(entry.requested, 'admin/role-management');
  // 业务块版本兼容是需求基线里**明确排除**的一条，所以 resolved 恒等于 requested
  assert.equal(entry.resolved, 'admin/role-management');
  assert.match(entry.digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(entry.source, 'builtin');
  assert.deepEqual(entry.layers, ['L1', 'L2', 'L3']);

  // 摘要必须与真资产仓当下算出来的一致——门面写进去的和内核算出来的是同一个数
  const { resolveBlock } = await import('../../lib/assets/lock.mjs');
  assert.equal(entry.digest, (await resolveBlock(path.join(PKG, 'assets'), 'admin/role-management')).digest);

  await run(['theme', 'set', 'enterprise-blue'], { cwd: root });
  assert.equal((await lockOf(root)).theme.requested, 'enterprise-blue');

  await run(['block', 'remove', 'admin/role-management'], { cwd: root });
  assert.deepEqual((await lockOf(root)).blocks, [],
    '卸块要销账：留着孤儿条目就是 lock 说在用、config 说没装，两份都不可信了');
});

test('sync --check 认资产漂：lock 记的那一版与资产仓对不上 → exit 5，且指的是 block upgrade 不是 sync', async () => {
  const root = await tmpProject();
  await run(['block', 'add', 'admin/role-management'], { cwd: root });
  await run(['theme', 'set', 'enterprise-blue'], { cwd: root });
  await run(['sync'], { cwd: root }); // 先把派生投影刷干净，剩下的漂只可能来自资产锁

  const clean = await run(['sync', '--check'], { cwd: root });
  assert.equal(clean.code, 0, clean.out + clean.err);
  assert.match(clean.out, /资产锁也对得上/);

  // 把 lock 里的摘要改掉 = 与「资产仓内容变了」等价（比较的是同一对数）。
  // 真去改包里的 assets/ 会污染同批跑的其它用例，而判据完全一样。
  const lock = await lockOf(root);
  lock.blocks[0].digest = `sha256:${'0'.repeat(64)}`;
  await writeFile(path.join(root, ...LOCK), JSON.stringify(lock, null, 2));

  // 变异验证（2026-08-16 已执行）：把 actions.sync 里
  // `drifted: projected.drifted + assets.drifted` 改回 `projected.drifted`，
  // **本文件只有这一条红**（exit 0），其余 20 条全绿——CI 会对着一个已经换了内容的
  // 资产仓一路报绿，而那些内容已经被用来取过证了。
  const drifted = await run(['sync', '--check'], { cwd: root });
  assert.equal(drifted.code, 5, '资产锁漂了，sync --check 必须 exit 5');
  assert.match(drifted.out, /资产锁对不上/);
  assert.match(drifted.out, /admin\/role-management/);
  assert.match(drifted.out, /block upgrade/, '资产漂的修法不是重跑 sync——提示指错了地方等于没提示');

  const json = JSON.parse((await run(['sync', '--check', '--json'], { cwd: root })).out);
  assert.equal(json.assets.drifted, 1);
  assert.equal(json.assets.entries.find((e) => e.id === 'admin/role-management').status, 'drift');
});

test('sync --check：没锁的资产不算漂（存量项目不该一上来就红），但必须报出来「没查」', async () => {
  const root = await tmpProject();
  // 手改 config 登记块 = 绕过受管入口，锁自然没有——这正是存量项目的形态
  await writeFile(path.join(root, '.vima', 'project.json'),
    JSON.stringify({ schema: '4', theme: 'enterprise-blue', blocks: ['admin/role-management'] }));
  await run(['sync'], { cwd: root });

  const r = await run(['sync', '--check'], { cwd: root });
  assert.equal(r.code, 0, '未锁不是漂——把它算成漂，这条检查会在两天内被人关掉');
  assert.match(r.out, /还没锁/, '但「没锁 = 没查」必须说出来，不许混进绿里');
  assert.match(r.out, /admin\/role-management/);
});

test('block upgrade --check：列出漂了的资产与会读到它的命题，但不动锁、不碰证据', async () => {
  const root = await tmpProject();
  await run(['block', 'add', 'admin/role-management'], { cwd: root });
  await seedClaim(root, 'c-contract', { layer: 'contract' });  // 读 L1
  await seedClaim(root, 'c-impl', { layer: 'impl' });          // 读 L2/L3
  await seedClaim(root, 'c-spec', { layer: 'spec' });          // 一层都不读

  const before = await lockOf(root);
  before.blocks[0].digest = `sha256:${'0'.repeat(64)}`;
  await writeFile(path.join(root, ...LOCK), JSON.stringify(before, null, 2));

  const r = await run(['block', 'upgrade', '--check', '--json'], { cwd: root });
  assert.equal(r.code, 5, '--check 发现漂了要 exit 5，CI 靠它');
  const d = JSON.parse(r.out);
  assert.equal(d.changed, 1);
  assert.equal(d.impacted.length, 1);
  assert.equal(d.impacted[0].id, 'admin/role-management');
  // 判据来自 next 供料那张表：contract 读 L1、impl 读 L2/L3、spec 一层都不读。
  // 另写一份「谁会读到块」的判据，就会和真正下发的内容对不上。
  assert.deepEqual(d.impacted[0].claims.map((c) => c.id).sort(), ['c-contract', 'c-impl']);
  assert.equal(d.applied.length, 0, '--check 只报不改');
  assert.equal((await lockOf(root)).blocks[0].digest, `sha256:${'0'.repeat(64)}`, '--check 不许写锁');

  const human = await run(['block', 'upgrade', '--check'], { cwd: root });
  assert.match(human.out, /000000000000 → /);
  assert.match(human.out, /c-contract/);
  assert.match(human.err + human.out, /证据不会/, '必须说清证据不会自动失效，那是人确认后 submit 的事');
});

test('block upgrade（不带 --check）：把锁更新到当下这一版、落事件，且不动任何证据', async () => {
  const root = await tmpProject();
  await run(['block', 'add', 'admin/role-management'], { cwd: root });
  await seedClaim(root, 'c-impl', { layer: 'impl' });

  const stale = await lockOf(root);
  const real = stale.blocks[0].digest;
  stale.blocks[0].digest = `sha256:${'0'.repeat(64)}`;
  await writeFile(path.join(root, ...LOCK), JSON.stringify(stale, null, 2));

  const evsBefore = (await events(root)).length;
  const r = await run(['block', 'upgrade', '--json'], { cwd: root });
  assert.equal(r.code, 0, 'apply 成功就是 0——要不要重新取证是人接下来的事');
  const d = JSON.parse(r.out);
  assert.deepEqual(d.applied, ['block:admin/role-management']);
  assert.equal((await lockOf(root)).blocks[0].digest, real, '升级后锁必须是当下这一版');

  // 升级要能在事件流里回放（R2 的时间维），但**只记升级本身**，不写任何证据事件
  const evs = await events(root);
  assert.equal(evs.length, evsBefore + 1, '升级只该落一条事件——多出来的必然是替人作废了证据');
  const ev = evs[evs.length - 1];
  assert.equal(ev.payload.op, 'config');
  assert.equal(ev.payload.what, 'assets.upgrade');
  assert.equal(ev.payload.before[0].digest, `sha256:${'0'.repeat(64)}`);
  assert.equal(ev.payload.after[0].digest, real);

  await run(['sync'], { cwd: root }); // 先刷派生投影，剩下的漂只可能来自资产锁
  assert.equal((await run(['sync', '--check'], { cwd: root })).code, 0, '升完就不该再报漂');
  assert.equal((await run(['block', 'upgrade', '--check'], { cwd: root })).code, 0);
});

test('block upgrade：一切都对得上时如实说「一致」，没锁时说「还没锁」——不制造假绿', async () => {
  const root = await tmpProject();
  const empty = await run(['block', 'upgrade'], { cwd: root });
  assert.equal(empty.code, 0);
  assert.match(empty.out, /还没有任何资产被锁/, '零锁不是「一致」，两者的含义完全不同');

  await run(['block', 'add', 'admin/role-management'], { cwd: root });
  const ok = await run(['block', 'upgrade', '--check'], { cwd: root });
  assert.equal(ok.code, 0);
  assert.match(ok.out, /与资产仓一致/);

  // lock 坏掉不许被当成「还没锁」一路报绿
  await writeFile(path.join(root, ...LOCK), '{ 坏掉的 JSON');
  const broken = await run(['block', 'upgrade', '--check'], { cwd: root });
  assert.notEqual(broken.code, 0, 'lock 读不出来是「没查」，不能静默算通过');
  assert.match(broken.err, /不是合法 JSON/);
});

// ── 依赖 DAG（P0-3）───────────────────────────────────────────────────────
//
// 真资产仓今天只有一个块、且没有块依赖，所以失败面用**真块的真内容**在临时资产仓里
// 拼出依赖关系（复制 role-management 的目录，只改 block.json 的 depends.blocks）。
// 不编造层文件内容——被复制的仍然是能被 readBlock 真读出来的块。
// 这几条直接调 actions（不走 CLI）：ASSETS_ROOT 是分发物里的固定落点，
// 换资产仓的口子只有 ctx.assetsRoot，为一条测试给 CLI 加个 --assets-root 旗标，
// 才是没人要求的复杂度。

async function assetsWithDeps(deps) {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-deps-'));
  const root = path.join(dir, 'assets');
  await cp(path.join(PKG, 'assets'), root, { recursive: true });
  for (const [name, on] of Object.entries(deps)) {
    const target = path.join(root, 'blocks', 'admin', name);
    await cp(path.join(root, 'blocks', 'admin', 'role-management'), target, { recursive: true });
    const meta = JSON.parse(await readFile(path.join(target, 'block.json'), 'utf8'));
    meta.id = `admin/${name}`;
    meta.depends = { blocks: on };
    await writeFile(path.join(target, 'block.json'), `${JSON.stringify(meta, null, 2)}\n`);
  }
  return root;
}

async function ctxFor(root, assetsRoot) {
  const A = await import('../../lib/front/actions.mjs');
  const { readConfig } = await import('../../lib/core/project.mjs');
  return { A, ctx: { root, config: await readConfig(root), assetsRoot, now: NOW, actor: 'test' } };
}

test('block add 的依赖闸门：依赖没装 → 拒；装齐了 → 放行', async () => {
  const root = await tmpProject();
  const assetsRoot = await assetsWithDeps({ 'audit-log': [], portal: ['admin/audit-log'] });
  const { A, ctx } = await ctxFor(root, assetsRoot);

  // 变异验证（2026-08-16 已执行）：把 blockAdd 里 notInstalled 那一段删掉，
  // **只有本条红**，其余 20 条全绿——半截块会被装进去，而缺的那部分要到
  // next 供料时才显形，那时人看到的是「契约里提到的东西没有」，追不回这里。
  await assert.rejects(() => A.blockAdd(ctx, 'admin/portal'), (err) => {
    assert.equal(err.exit, 1, '依赖没装是用法错误：先装依赖再来，改命令行即可');
    assert.match(err.message, /admin\/audit-log/);
    assert.match(err.hint, /vima block add admin\/audit-log/, '要说清下一步敲什么');
    return true;
  });
  assert.deepEqual((await lockOf(root))?.blocks ?? [], [], '被拒的安装不许留下锁');

  await A.blockAdd(ctx, 'admin/audit-log');
  const done = await A.blockAdd({ ...ctx, config: await (await import('../../lib/core/project.mjs')).readConfig(root) }, 'admin/portal');
  assert.deepEqual(done.deps, ['admin/audit-log'], '装成功要报得出它带着哪些依赖');
  assert.deepEqual((await lockOf(root)).blocks.map((b) => b.requested).sort(),
    ['admin/audit-log', 'admin/portal']);
  await rm(path.dirname(assetsRoot), { recursive: true, force: true });
});

test('block add 的依赖闸门：依赖的块资产仓里没有 → exit 4；依赖成环 → exit 5', async () => {
  const root = await tmpProject();
  const assetsRoot = await assetsWithDeps({
    ghosted: ['admin/does-not-exist'],
    'ring-a': ['admin/ring-b'],
    'ring-b': ['admin/ring-a'],
  });
  const { A, ctx } = await ctxFor(root, assetsRoot);

  await assert.rejects(() => A.blockAdd(ctx, 'admin/ghosted'), (err) => {
    assert.equal(err.exit, 4);
    assert.match(err.message, /admin\/does-not-exist/);
    return true;
  });

  // 变异验证（2026-08-16 已执行）：把 blockAdd 里 cycles 那一段删掉，
  // **只有本条红**（成环的块被装进去了）——resolveDeps 会照常返回一个
  // 「看起来完整」的 needs，环不会自己暴露。
  await assert.rejects(() => A.blockAdd(ctx, 'admin/ring-a'), (err) => {
    assert.equal(err.exit, 5);
    assert.match(err.message, /成环/);
    assert.match(err.message, /admin\/ring-a → admin\/ring-b → admin\/ring-a/);
    return true;
  });

  assert.equal(await lockOf(root), null, '两种拒绝都不许留下半截状态');
  await rm(path.dirname(assetsRoot), { recursive: true, force: true });
});

// ── init 立起来时就锁皮；block remove 有反向依赖闸门 ──────────────────────

test('init 就把皮锁上——不锁的话新项目从第一天起报不了资产漂移', async (t) => {
  // 受管写入口曾漏了**最早的那个入口**：init 只把字符串写进 config，
  // 于是 sync --check 对新项目的皮一无所知，而项目已经照着它取过证。
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-initlock-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const r = await run(['init'], { cwd: dir });
  assert.equal(r.code, 0, r.err);

  const lock = JSON.parse(await readFile(path.join(dir, '.vima', 'assets.lock.json'), 'utf8'));
  assert.equal(lock.theme.requested, 'enterprise-blue');
  assert.match(lock.theme.digest, /^sha256:[0-9a-f]+$/, '锁里必须有摘要，否则漂移无从比对');

  const check = await run(['sync', '--check'], { cwd: dir });
  assert.equal(check.code, 0, `刚 init 的项目不该有漂移：\n${check.out}${check.err}`);
});

test('block remove 有反向依赖闸门——add 保证的闭合，remove 不能拆掉', async (t) => {
  // 装的时候拦、拆的时候不拦，那道闸门只挡了一半：留下一个依赖它的块指着空气。
  // 刻意**不做级联删除**——「顺带把依赖它的也卸了」是人的决定，不是命令的默认。
  //
  // 资产根固定在安装包内（不可用环境变量覆盖，那是刻意的：资产仓是分发物的一部分），
  // 所以这里往真资产仓里临时加一对有依赖关系的块，跑完删干净。
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-revdep-'));
  const made = [];
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
    for (const d of made) await rm(d, { recursive: true, force: true });
  });
  await run(['init'], { cwd: dir });

  const mk = async (id, depends) => {
    const [set, name] = id.split('/');
    const d = path.join(PKG, 'assets', 'blocks', set, name);
    made.push(path.join(PKG, 'assets', 'blocks', set));
    await mkdir(d, { recursive: true });
    await writeFile(path.join(d, 'block.json'), JSON.stringify({ name, depends }, null, 2));
    await writeFile(path.join(d, 'L1.contract.md'), '# 契约\n\n正文。\n');
  };
  await mk('zztest/base', {});
  await mk('zztest/leaf', { blocks: ['zztest/base'] });

  assert.equal((await run(['block', 'add', 'zztest/base'], { cwd: dir })).code, 0);
  assert.equal((await run(['block', 'add', 'zztest/leaf'], { cwd: dir })).code, 0);

  const bad = await run(['block', 'remove', 'zztest/base'], { cwd: dir });
  assert.equal(bad.code, 1, `被依赖着不该能拆：\n${bad.out}${bad.err}`);
  assert.match(bad.err, /zztest\/leaf/, '要指名是谁依赖它');
  assert.match(bad.err, /不做级联删除/, '要说清为什么不替人做主');

  // 先拆叶子再拆底座就通
  assert.equal((await run(['block', 'remove', 'zztest/leaf'], { cwd: dir })).code, 0);
  assert.equal((await run(['block', 'remove', 'zztest/base'], { cwd: dir })).code, 0);
});

test('audit 报资产锁漂移——「装的资产不是取证时那一版」是一笔对不上的账', async (t) => {
  // 此前锁漂移只在 sync --check 里可见，而那条命令的语义是「派生投影对不对」，
  // 人不会为了查证据可信度去跑它。audit 是对账那个动词，这笔账该在这里出现。
  //
  // 写这条时抓到一个真坑：checkLock 的 `drifted` 是**计数**不是数组，
  // 按数组遍历会静默什么都不做——「检查存在但从不报」的经典形状。
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-auditlock-'));
  const L1 = path.join(PKG, 'assets', 'blocks', 'admin', 'role-management', 'L1.contract.md');
  const original = await readFile(L1, 'utf8');
  t.after(async () => {
    await writeFile(L1, original, 'utf8');
    await rm(dir, { recursive: true, force: true });
  });

  await run(['init'], { cwd: dir });
  await run(['block', 'add', 'admin/role-management'], { cwd: dir });

  const clean = await run(['audit', '--json'], { cwd: dir });
  const before = JSON.parse(clean.out);
  assert.equal(before.findings.filter((f) => f.kind === 'asset-drift').length, 0,
    '刚装上就报漂移，说明摘要算得不稳（同一份内容两次算出不同值）');
  assert.equal(before.summary.assetLock.drifted, 0);

  await writeFile(L1, `${original}\n<!-- 一个字节的改动 -->\n`, 'utf8');
  const dirty = await run(['audit', '--json'], { cwd: dir });
  const after = JSON.parse(dirty.out);
  const drift = after.findings.filter((f) => f.kind === 'asset-drift');
  assert.equal(drift.length, 1, `改了资产就该报：\n${dirty.out.slice(0, 400)}`);
  assert.equal(drift[0].subject, 'admin/role-management');
  assert.match(drift[0].message, /悬空/, '要说清后果：照着旧版取的证据不再作数');
  assert.match(drift[0].message, /upgrade --check/, '要给出下一步命令');
});

// ── 「拿错端的块是机检项」的接缝（R11 判据第三条）────────────────────────────
//
// registry.sideMatchOf 产出判定 → actions.audit 吃它。真 CLI、真资产仓、真块，
// 不造夹具：夹具测的是自己的假设，不是拼起来的行为。

test('audit 报 block-side-mismatch：块只供 wechat 而项目只有 admin 端', async () => {
  const root = await tmpProject();
  // 真块 admin/role-management 的 sides 是 ["server","admin"]，先登记一个对不上的端
  await run(['app', 'add', '--id=mini', '--kind=wechat'], { cwd: root });
  await run(['block', 'add', 'admin/role-management'], { cwd: root });

  const d = JSON.parse((await run(['audit', '--json'], { cwd: root })).out);
  const f = d.findings.find((x) => x.kind === 'block-side-mismatch');
  assert.ok(f, '装了一个本项目没有任何端消费得了的块，audit 必须说出来');
  assert.equal(f.severity, 'warn', '端对不上不挡交付——端可以后补');
  assert.equal(f.subject, 'admin/role-management');
  assert.deepEqual(f.detail.sides, ['admin', 'server']);
  assert.deepEqual(f.detail.projectKinds, ['wechat']);
  assert.ok(!d.findings.some((x) => x.kind === 'block-broken'),
    '端不对不等于块坏了——两件事分开报，处置也不同');

  // 补上对得上的端 → 发现立刻消失（检查是活的，不是一次性判词）
  await run(['app', 'add', '--id=console', '--kind=admin'], { cwd: root });
  const after = JSON.parse((await run(['audit', '--json'], { cwd: root })).out);
  assert.ok(!after.findings.some((x) => x.kind === 'block-side-mismatch'));
});

test('block add 当场提示拿错端，但不拦——端可以后补（C4 不阻塞）', async () => {
  const root = await tmpProject();
  await run(['app', 'add', '--id=mini', '--kind=wechat'], { cwd: root });
  const r = await run(['block', 'add', 'admin/role-management', '--json'], { cwd: root });
  assert.equal(r.code, 0, '拿错端只提示不拦：装块与登记端谁先谁后是人的顺序');
  const d = JSON.parse(r.out);
  assert.ok(d.notes.some((n) => n.includes('适用端') && n.includes('wechat')),
    `当场没提示就等于要人自己去跑 audit 才知道：${JSON.stringify(d.notes)}`);
  assert.deepEqual(d.blocks, ['admin/role-management'], '提示归提示，块照样装上');
});

test('未登记端的新项目不报「没查」——每个新项目必亮的告警会训练人忽略整张表', async () => {
  const root = await tmpProject();
  await run(['block', 'add', 'admin/role-management'], { cwd: root });
  const d = JSON.parse((await run(['audit', '--json'], { cwd: root })).out);
  assert.ok(!d.findings.some((f) => f.subject === '(block-sides)'),
    '项目还没登记端是正常中间态，不是缺陷');
  // 但数据必须在——不报告警不等于把事实藏起来
  assert.deepEqual(d.summary.assets.projectKinds, []);
  assert.equal(d.summary.assets.blocks[0].sideMatch, 'unchecked', '如实标「没查」，不标 match');
});

// ── 实际并发可观测（R5 判据前半句）──────────────────────────────────────────
//
// 并发只能从租约算：事件流回答「发生过什么」，此刻谁在干活是租约的职责。
// 这里走真 acquire、真 status，不合成租约对象——合成的那份测的是自己的假设。

test('status 报实际并发：活租约计入、过期的不计，且边界与数字同屏', async () => {
  const { acquire } = await import('../../lib/core/lease.mjs');
  const root = await tmpProject();
  const T0 = new Date('2026-08-16T00:00:00.000Z');

  await acquire(root, 'claim-a', { actor: 'builder-1', worktree: 'wt-a', now: T0, ttlMs: 60_000 });
  await acquire(root, 'claim-b', { actor: 'builder-2', worktree: 'wt-b', now: T0, ttlMs: 60_000 });
  // 这一份故意短 TTL：到观测时刻它已经过期，不该算进并发
  await acquire(root, 'claim-c', { actor: 'builder-3', worktree: 'wt-c', now: T0, ttlMs: 1_000 });

  const { status } = await import('../../lib/front/actions.mjs');
  const s = await status({ cwd: root, env: {}, now: new Date(+T0 + 30_000) });

  assert.equal(s.concurrency.active, 2, '并发 = 此刻持有未过期租约的执行者数');
  assert.equal(s.concurrency.expired, 1, '过期的要单列——「曾经有人领过」不是「现在有人在干」');
  assert.deepEqual(s.concurrency.holders.map((h) => h.claimId), ['claim-a', 'claim-b']);
  assert.deepEqual(s.concurrency.holders.map((h) => h.actor), ['builder-1', 'builder-2']);
  assert.ok(/worktree/.test(s.concurrency.scope),
    '适用条件必须随数字一起给：跨 worktree 的租约互不可见，'
    + '一个不说明边界的并发数会被读成「并行已经做完了」');

  // 人读面也要有——只进 --json 等于人看不到
  const text = await run(['status', `--cwd=${root}`], { cwd: root });
  assert.match(text.out, /并发\s+\d+ 个执行者在干活/);
  assert.match(text.out, /互不可见/);
});

test('status 并发：一份租约都没有时报 0，不报「查不了」', async () => {
  const root = await tmpProject();
  const { status } = await import('../../lib/front/actions.mjs');
  const s = await status({ cwd: root, env: {}, now: new Date() });
  assert.equal(s.concurrency.active, 0);
  assert.deepEqual(s.concurrency.holders, []);
  assert.deepEqual(s.concurrency.corrupt, []);
});
