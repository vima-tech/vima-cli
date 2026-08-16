// 资产锁（P0-3 可复现性）。
//
// 全部对着**真资产仓的真文件**验：要么直接算 assets/ 的摘要，要么把 assets/ 整棵
// 复制到临时目录再改一个字节。不造夹具块——摘要要防的正是「内容变了没人发现」，
// 用编出来的内容验，验的是自己的假设。
//
// ── 变异验证（2026-08-16 手工跑过一轮，逐条结论写在断言旁边）──────────────
// 做法：故意把实现改坏，看对应断言红不红。只会报绿的检查比没有检查更贵。
//
// 一个反例先写在这里，因为它比通过的那些更说明问题：
// 最先试的变异是「只删掉 `h.update(f.data)`，长度与文件名照喂」——**15 条全绿**。
// 原因是改一个字节几乎总会改长度，长度替内容顶了包。所以下面每条注释记的都是
// **真能让它红**的那个变异，不是「看起来应该能」的那个。
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rename, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  digestFiles, resolveBlock, resolveTheme, dependsOf, blockGraph, resolveDeps,
  readLock, writeLock, recordBlock, recordTheme, forgetBlock, checkLock, LOCK_REL,
} from '../../lib/assets/lock.mjs';

const PKG = fileURLToPath(new URL('../../', import.meta.url));
const ASSETS = path.join(PKG, 'assets');
const BLOCK = 'admin/role-management';
const BLOCK_DIR = path.join('blocks', 'admin', 'role-management');

/** 把真资产仓整棵复制一份，供「改一个字节」这类破坏性验证使用。 */
async function copyAssets(name = 'vima-lock-assets-') {
  const dir = await mkdtemp(path.join(tmpdir(), name));
  const root = path.join(dir, 'assets');
  await cp(ASSETS, root, { recursive: true });
  return root;
}

async function tmpProject() {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-lock-proj-'));
  await mkdir(path.join(dir, '.vima'), { recursive: true });
  return dir;
}

// ── 可复现性：这是整个机制的定义 ──────────────────────────────────────────

test('digest 确定性：同一份资产算两次，摘要必须一模一样', async () => {
  // 「同一输入必须字节一致」（C3）。
  // 变异验证（已执行）：往 digestFiles 里加一行 `h.update(String(Date.now()))`，
  // 本条与另外 4 条一起红——渲染器那条「不许掺时间戳」的纪律在这里有机检，不只是口号。
  const a = await resolveBlock(ASSETS, BLOCK);
  const b = await resolveBlock(ASSETS, BLOCK);
  assert.equal(a.digest, b.digest);
  assert.match(a.digest, /^sha256:[0-9a-f]{64}$/);

  const t1 = await resolveTheme(ASSETS, 'enterprise-blue');
  const t2 = await resolveTheme(ASSETS, 'enterprise-blue');
  assert.equal(t1.digest, t2.digest);
});

test('digest 与资产放在哪个目录无关——同一份内容复制两份，摘要相同', async () => {
  // 可复现性的定义就是这条：同一份 lock 在不同机器上解析到字节一致的资产。
  // 机器之间路径必然不同，所以摘要里**一个绝对路径都不能有**。
  //
  // 变异验证（已执行）：把 readAllUnder 里的 `name: rel` 换成 `name: path.join(dir, rel)`，
  // **只有这一条红**（两个临时目录算出两个摘要），其余 14 条全绿——
  // 也就是说少了这条，路径污染会一路潜伏到换台机器才爆。
  const one = await copyAssets('vima-lock-a-');
  const two = await copyAssets('vima-lock-b-');
  assert.notEqual(one, two);
  assert.equal((await resolveBlock(one, BLOCK)).digest, (await resolveBlock(two, BLOCK)).digest);
  assert.equal((await resolveBlock(one, BLOCK)).digest, (await resolveBlock(ASSETS, BLOCK)).digest,
    '临时副本与真资产仓必须算出同一个摘要');
  await rm(path.dirname(one), { recursive: true, force: true });
  await rm(path.dirname(two), { recursive: true, force: true });
});

test('改一个字节，摘要必须变（层文件 / block.json 都算）', async () => {
  const root = await copyAssets();
  const base = (await resolveBlock(root, BLOCK)).digest;

  // 变异验证（已执行）：把 digestFiles 削成只喂文件名（长度与内容都不喂），
  // 本条 + 「改文件名/挪内容」+「皮的摘要」+「checkLock 五态」四条同时红。
  // 注意只删 `h.update(f.data)`、留着长度是**不够**的（见文件头的反例）。
  const l1 = path.join(root, BLOCK_DIR, 'L1.contract.md');
  const original = await readFile(l1, 'utf8');
  await writeFile(l1, `${original} `); // 只多一个空格
  const afterLayer = (await resolveBlock(root, BLOCK)).digest;
  assert.notEqual(afterLayer, base, 'L1 多一个空格都必须让摘要变');
  await writeFile(l1, original);
  assert.equal((await resolveBlock(root, BLOCK)).digest, base, '改回去要还原成同一个摘要');

  // block.json 也在覆盖范围里：它不是「层文件」，但 readBlock 会读它，
  // 漏掉就留下一条「变了但摘要说没变」的缝。
  const meta = path.join(root, BLOCK_DIR, 'block.json');
  const metaText = await readFile(meta, 'utf8');
  await writeFile(meta, metaText.replace('"tags"', '"tags "'));
  assert.notEqual((await resolveBlock(root, BLOCK)).digest, base, 'block.json 改了摘要也要变');
  await rm(path.dirname(root), { recursive: true, force: true });
});

test('改文件名、或把内容从一个文件挪到另一个，摘要同样要变', async () => {
  // 这两条专治「只把内容拼起来算哈希」的写法：那种写法下，
  // 把 L2 末尾一段剪到 L3 开头，字节总量一模一样，摘要纹丝不动。
  //
  // 变异验证（已执行）：把 digestFiles 削成只喂内容（name 与长度那四行 update 删掉），
  // 本条与「排序不看 locale」两条红，**上一条「改一个字节」仍然绿**——
  // 单靠那条测不出这个缺陷，这就是为什么它要单独存在。
  const root = await copyAssets();
  const base = (await resolveBlock(root, BLOCK)).digest;

  const l2 = path.join(root, BLOCK_DIR, 'L2.backend.md');
  await rename(l2, path.join(root, BLOCK_DIR, 'L2.server.md'));
  assert.notEqual((await resolveBlock(root, BLOCK)).digest, base,
    '层文件改名会改 next 供料里的 source，摘要必须跟着变');
  await rename(path.join(root, BLOCK_DIR, 'L2.server.md'), l2);

  const l3 = path.join(root, BLOCK_DIR, 'L3.frontend.md');
  const t2 = await readFile(l2, 'utf8');
  const t3 = await readFile(l3, 'utf8');
  await writeFile(l2, t2.slice(0, -20));
  await writeFile(l3, t2.slice(-20) + t3);
  assert.notEqual((await resolveBlock(root, BLOCK)).digest, base,
    '总字节数没变、只是挪了个位置，摘要也必须变');
  await rm(path.dirname(root), { recursive: true, force: true });
});

test('皮的摘要覆盖令牌 + 全部词表；换一套皮的令牌不影响本皮', async () => {
  const root = await copyAssets();
  const base = (await resolveTheme(root, 'enterprise-blue')).digest;

  // 词表算进皮，是因为 loadStyle 解析出来的就是「令牌 + 全部词表」这一整包，
  // next 下发的词表切片也从这里来。只锁令牌的话，删掉一个 sidebar-main
  // 摘要不动，而供料内容已经换了。
  const vocab = path.join(root, 'style', 'layout.vocab.json');
  const text = await readFile(vocab, 'utf8');
  await writeFile(vocab, `${text}\n`);
  assert.notEqual((await resolveTheme(root, 'enterprise-blue')).digest, base, '词表变了皮的摘要要变');
  await writeFile(vocab, text);

  // 别的皮的令牌不算：往资产仓里加一套皮，不该让本项目报漂。
  await cp(path.join(root, 'style', 'tokens', 'enterprise-blue.json'),
    path.join(root, 'style', 'tokens', 'another.json'));
  assert.equal((await resolveTheme(root, 'enterprise-blue')).digest, base, '加了别的皮不该让本皮报漂');
  await rm(path.dirname(root), { recursive: true, force: true });
});

test('digestFiles 的排序不看 locale：给它乱序，结果与顺序无关', async () => {
  const files = [
    { name: 'b.md', data: Buffer.from('B') },
    { name: 'A.md', data: Buffer.from('A') },
    { name: 'a.md', data: Buffer.from('a') },
  ];
  const one = digestFiles(files);
  const two = digestFiles([...files].reverse());
  assert.equal(one, two, '同一组文件不同顺序必须算出同一个摘要');
  assert.notEqual(one, digestFiles([...files, { name: 'c.md', data: Buffer.from('') }]),
    '多一个空文件也算变化');
});

test('读不出的资产要炸，不许算出一个「空摘要」当通过', async () => {
  await assert.rejects(() => resolveBlock(ASSETS, 'admin/nope'), /没有这个块/);
  await assert.rejects(() => resolveBlock(ASSETS, 'not-an-id'), /<set>\/<name>/);
  await assert.rejects(() => resolveTheme(ASSETS, 'ghost'), /没有这套皮/);
});

// ── 依赖 DAG ──────────────────────────────────────────────────────────────

test('dependsOf：真块读得出（今天是空依赖）；形状写错当场炸，不软着陆成「没依赖」', async () => {
  const meta = JSON.parse(await readFile(path.join(ASSETS, BLOCK_DIR, 'block.json'), 'utf8'));
  assert.deepEqual(dependsOf(BLOCK, meta), [], '真块今天没有块依赖，capabilities 是人话不参与机检');

  assert.deepEqual(dependsOf('x/y', null), [], '缺 block.json 的块 = 没有依赖，这是允许的');
  assert.deepEqual(dependsOf('x/y', { depends: {} }), []);
  // 变异验证（已执行）：在 dependsOf 开头加一行 `return []`，
  // 本条与 front.assets 里两条依赖闸门用例同时红，其余全绿。
  assert.throws(() => dependsOf('x/y', { depends: [] }), /depends 不是对象/);
  assert.throws(() => dependsOf('x/y', { depends: { blocks: 'a/b' } }), /必须是块 id 字符串数组/);
  assert.throws(() => dependsOf('x/y', { depends: { blocks: ['a/b', 3] } }), /必须是块 id 字符串数组/);
});

test('resolveDeps：拓扑序、缺依赖、成环，一次全报出来', () => {
  const graph = new Map([
    ['a/one', ['a/two', 'a/three']],
    ['a/two', ['a/three']],
    ['a/three', []],
  ]);
  const ok = resolveDeps(graph, 'a/one');
  assert.deepEqual(ok.missing, []);
  assert.deepEqual(ok.cycles, []);
  assert.deepEqual(ok.needs, ['a/three', 'a/two'], '被依赖的排在前面（拓扑序）');

  const missing = resolveDeps(new Map([['a/one', ['a/ghost']]]), 'a/one');
  assert.deepEqual(missing.missing, [{ from: 'a/one', to: 'a/ghost' }]);

  assert.deepEqual(resolveDeps(new Map(), 'a/nope').missing, [{ from: null, to: 'a/nope' }],
    '连自己都不在图里，也要说出来，不能返回一个空结果当成「没问题」');

  const cyc = resolveDeps(new Map([['a/one', ['a/two']], ['a/two', ['a/one']]]), 'a/one');
  assert.equal(cyc.cycles.length, 1);
  assert.deepEqual(cyc.cycles[0], ['a/one', 'a/two', 'a/one']);

  // 自环也是环。它比互指更容易手滑写出来（复制 block.json 时忘了改 id）。
  assert.equal(resolveDeps(new Map([['a/one', ['a/one']]]), 'a/one').cycles.length, 1);

  // 菱形依赖不该被误判成环——共享的那个节点会被访问两次，但它不在路径上
  const diamond = new Map([
    ['a/top', ['a/left', 'a/right']],
    ['a/left', ['a/base']], ['a/right', ['a/base']], ['a/base', []],
  ]);
  const d = resolveDeps(diamond, 'a/top');
  assert.deepEqual(d.cycles, [], '菱形不是环');
  assert.deepEqual(d.needs.filter((x) => x === 'a/base'), ['a/base'], '共享依赖只出现一次');
});

test('blockGraph 用真 listBlocks 编得出图，且缺 block.json 的块照样进图', async () => {
  const { listBlocks } = await import('../../lib/assets/registry.mjs');
  const graph = blockGraph(await listBlocks(ASSETS));
  assert.ok(graph.has(BLOCK), '真资产仓里的块要在图里');
  assert.deepEqual(graph.get(BLOCK), []);
  assert.deepEqual(resolveDeps(graph, BLOCK).needs, []);
});

// ── 锁文件读写 ────────────────────────────────────────────────────────────

test('lock 往返：写出去读回来一致，且同样内容写出同样字节（进版本控制，diff 不许有噪音）', async () => {
  const root = await tmpProject();
  const entry = await resolveBlock(ASSETS, BLOCK);
  await writeLock(root, { blocks: [entry], theme: await resolveTheme(ASSETS, 'enterprise-blue') });
  const raw1 = await readFile(path.join(root, ...LOCK_REL.split('/')), 'utf8');

  const back = await readLock(root);
  assert.deepEqual(back.blocks[0], entry);
  assert.equal(back.schema, '4');
  assert.equal(raw1.endsWith('\n'), true, 'JSON 落盘要有尾换行');

  await writeLock(root, back);
  assert.equal(await readFile(path.join(root, ...LOCK_REL.split('/')), 'utf8'), raw1, '重写一次必须字节一致');

  // 块序固定：乱序写进去，读回来仍是按 requested 排的
  await writeLock(root, { blocks: [{ requested: 'z/z' }, { requested: 'a/a' }], theme: null });
  assert.deepEqual((await readLock(root)).blocks.map((b) => b.requested), ['a/a', 'z/z']);
});

test('lock 缺席 = 空锁（新项目的正常状态）；lock 坏掉必须炸，不许当成「还没锁」', async () => {
  const root = await tmpProject();
  assert.deepEqual((await readLock(root)).blocks, []);

  // 变异验证（已执行）：把 readLock 里 `raw === null` 那一支改成 `return EMPTY()`，
  // 本条与 front.assets 的「不制造假绿」一条红，漂移检测的绿灯用例全部照样绿。
  // 坏掉的 lock 被当成「还没锁」，等于漂移检测悄悄下线，且没有任何提示。
  await writeFile(path.join(root, ...LOCK_REL.split('/')), '{ 不是 JSON');
  await assert.rejects(() => readLock(root), /不是合法 JSON/);

  await writeFile(path.join(root, ...LOCK_REL.split('/')), '{"schema":"4","blocks":{}}');
  await assert.rejects(() => readLock(root), /blocks 不是数组/);
});

// ── 漂移检测 ──────────────────────────────────────────────────────────────

test('checkLock 五态：对得上 / 漂了 / 算不出 / 孤儿 / 没锁——每一态都说得出「查了没有」', async () => {
  const root = await tmpProject();
  const assetsRoot = await copyAssets();
  const config = { theme: 'enterprise-blue', blocks: [BLOCK] };

  // ① 锁上之后对得上
  await recordBlock(root, assetsRoot, BLOCK);
  await recordTheme(root, assetsRoot, 'enterprise-blue');
  let r = await checkLock(root, assetsRoot, config);
  assert.equal(r.drifted, 0);
  assert.equal(r.locked, 2);
  assert.deepEqual(r.entries.map((e) => e.status), ['ok', 'ok']);
  assert.deepEqual(r.unlocked, []);

  // ② 资产内容变了 → drift
  //
  // 变异验证（已执行）：把 checkLock 里 `entry.actual !== entry.locked` 那一支删掉，
  // 本条 + front.assets 的「sync --check 认资产漂」「upgrade --check」「upgrade apply」
  // 四条同时红，其余 32 条全绿。也就是说：整个可复现性机制的价值就压在这一行
  // 比较上，它没了，lock 还在写、还在读、还一直报绿。
  const l1 = path.join(assetsRoot, BLOCK_DIR, 'L1.contract.md');
  const original = await readFile(l1, 'utf8');
  await writeFile(l1, `${original}\n新增一行契约\n`);
  r = await checkLock(root, assetsRoot, config);
  assert.equal(r.drifted, 1);
  const drift = r.entries.find((e) => e.id === BLOCK);
  assert.equal(drift.status, 'drift');
  assert.notEqual(drift.actual, drift.locked);
  assert.match(drift.why, /对不上/);
  await writeFile(l1, original);

  // ③ 资产没了 → unreadable。**这是「没查」，不是「通过」**
  await rm(path.join(assetsRoot, BLOCK_DIR), { recursive: true, force: true });
  r = await checkLock(root, assetsRoot, config);
  const gone = r.entries.find((e) => e.id === BLOCK);
  assert.equal(gone.status, 'unreadable');
  assert.equal(gone.actual, null);
  assert.match(gone.why, /没查/);
  assert.equal(r.drifted, 1, 'unreadable 必须计进漂移——算不出摘要时静默算通过是最贵的那种绿');

  // ④ config 里被手改掉了 → orphan（lock 说在用、config 说没装）
  r = await checkLock(root, assetsRoot, { theme: 'enterprise-blue', blocks: [] });
  assert.equal(r.entries.find((e) => e.id === BLOCK).status, 'orphan');

  // ⑤ config 登记了但 lock 里没有 → unlocked，单列且**不算漂移**
  await forgetBlock(root, BLOCK);
  r = await checkLock(root, assetsRoot, config);
  assert.deepEqual(r.unlocked, [{ kind: 'block', id: BLOCK }]);
  assert.equal(r.drifted, 0, '存量项目一上来全是未锁——把它算成漂移，这条检查会在两天内被关掉');
  await rm(path.dirname(assetsRoot), { recursive: true, force: true });
});

test('checkLock：换了皮但没重新锁 → 旧皮的锁是孤儿，新皮未锁，两样都要说出来', async () => {
  const root = await tmpProject();
  await recordTheme(root, ASSETS, 'enterprise-blue');
  const r = await checkLock(root, ASSETS, { theme: 'something-else', blocks: [] });
  assert.equal(r.entries.find((e) => e.kind === 'theme').status, 'orphan');
  assert.deepEqual(r.unlocked, [{ kind: 'theme', id: 'something-else' }]);
});

test('recordBlock 重复记不会记两份（重装即刷新那一条，不是追加一条）', async () => {
  const root = await tmpProject();
  await recordBlock(root, ASSETS, BLOCK);
  await recordBlock(root, ASSETS, BLOCK);
  assert.equal((await readLock(root)).blocks.length, 1);
  assert.equal(await forgetBlock(root, BLOCK), true);
  assert.equal(await forgetBlock(root, BLOCK), false, '销一条不存在的账要如实返回 false');
  assert.deepEqual((await readLock(root)).blocks, []);
});
