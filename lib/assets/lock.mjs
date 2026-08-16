// 资产锁 —— 「实际用了哪一版」的真源（P0-3 · R11 · C3）。
//
// `.vima/project.json` 说的是**想用什么**（`blocks: ["admin/role-management"]`），
// 那只是一个会漂的名字：安装包升级一次、块里的 L1 契约改一行，同一个名字指向的
// 内容就换了，而项目毫无察觉——偏偏那些内容已经被用来取过证了。
// 「装了 role-management」这句话，在两台机器上可以是两份不同的契约。
//
// 所以另存一份可提交的锁定投影 `.vima/assets.lock.json`，记**内容的摘要**：
//
//   {"schema":"4",
//    "blocks":[{"requested":"admin/role-management","resolved":"admin/role-management",
//               "digest":"sha256:…","source":"builtin","layers":["L1","L2","L3"]}],
//    "theme":{"requested":"enterprise-blue","digest":"sha256:…","source":"builtin"}}
//
// 可复现性的定义就一条：**同一份 lock，在任何机器上都解析到字节一致的资产**。
// 摘要对不上 = 漂了，`vima sync --check` 报出来（exit 5），人来决定升不升。
//
// 这份摘要是**漂移检测**用的，不承诺别的：谁都能改资产、也能改 lock，
// 它回答的是「内容还是不是当初那份」，不回答「是谁改的」。
//
// 三条纪律：
//   1. digest 怎么算**只有本文件一个实现**（`digestFiles`）。sync 调它、
//      upgrade 调它、测试也调它。第二份实现 = 两台机器算出两个结论。
//   2. 摘要里不许掺时间戳、随机数、绝对路径——只有文件名（相对资产自身的根）
//      与文件内容字节。掺一个绝对路径，换台机器就必然漂。
//   3. 读不出资产时**明说没查**（status:'unreadable'），不静默算通过。
//      「没查」和「查过没问题」是两回事，混成一个绿是这套系统最贵的错误。
//
// `resolved` 今天恒等于 `requested`：业务块版本兼容是 ARCHITECTURE 需求基线里
// **明确排除**的一条，没有版本号可解析。字段留着是因为 lock 的形状要一次定好，
// 不是为将来的版本机制预埋——真要做版本，改的是解析器不是文件格式。
//
// 依赖方向：assets/ 只 import core/，不反向。
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { walk, readJson, atomicWrite } from '../core/fsx.mjs';

export const LOCK_REL = '.vima/assets.lock.json';
export const LOCK_SCHEMA = '4';

/**
 * 资产的来源。今天只有一种：分发物自带的 assets/。
 * 「项目覆盖走独立 overlay」是 P0-3 提过但**尚未立项**的一条，没有实现就没有
 * 第二个取值——写一个用不上的枚举，是替需求做它没要求的决定。
 */
export const SOURCE_BUILTIN = 'builtin';

const BLOCKS_DIR = 'blocks';
const STYLE_DIR = 'style';
const TOKENS_DIR = 'tokens';
const VOCAB_SUFFIX = '.vocab.json';
const LAYER_FILE = /^L([1-4])\.[A-Za-z0-9._-]+\.md$/;

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/** posix 路径的字节序比较。不用 localeCompare——它随机器 locale 变，摘要就不确定了。 */
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/**
 * **全仓唯一的 digest 实现**。输入是 `[{ name, data:Buffer }]`，name 是相对该资产
 * 自身根目录的 posix 路径。
 *
 * 为什么把文件名和长度也喂进去，而不是只拼内容：只拼内容的话，把 L2 的末尾一段
 * 剪到 L3 的开头，摘要纹丝不动——那正是「内容变了摘要没变」。名字进摘要还顺带
 * 让「改文件名」也算变化（层文件改名会改 next 供料里的 source）。
 */
export function digestFiles(files) {
  const h = createHash('sha256');
  for (const f of [...files].sort(byName)) {
    h.update(f.name, 'utf8');
    h.update('\0');
    h.update(String(f.data.length), 'utf8');
    h.update('\0');
    h.update(f.data);
    h.update('\0');
  }
  return `sha256:${h.digest('hex')}`;
}

async function readAllUnder(dir) {
  const files = [];
  for await (const rel of walk(dir)) {
    files.push({ name: rel, data: await readFile(path.join(dir, rel)) });
  }
  return files;
}

/**
 * 一个块的锁定条目。摘要覆盖 `blocks/<set>/<name>/` **下的每一个文件**——
 * 不只是 L1–L4，block.json 与块自带的任何附件都算。
 * 理由：判据是「解析到的资产是不是字节一致」，而 readBlock 会读 block.json，
 * next 供料会读层文件；漏掉任何一个，就存在「变了但摘要说没变」的缝。
 */
export async function resolveBlock(assetsRoot, id) {
  const parts = String(id).split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw fail('BLOCK_ID_MALFORMED', `块 id 必须是 <set>/<name> 形态，读到的是：${id}`);
  }
  const dir = path.join(assetsRoot, BLOCKS_DIR, parts[0], parts[1]);
  const files = await readAllUnder(dir);
  if (files.length === 0) throw fail('BLOCK_NOT_FOUND', `资产仓里没有这个块：${id}`);

  const layers = [];
  for (const f of files) {
    if (f.name.includes('/')) continue; // 层文件只认块根，与 registry.readBlock 同口径
    const m = LAYER_FILE.exec(f.name);
    if (m && !layers.includes(`L${m[1]}`)) layers.push(`L${m[1]}`);
  }
  layers.sort();

  return {
    requested: `${parts[0]}/${parts[1]}`,
    resolved: `${parts[0]}/${parts[1]}`,
    digest: digestFiles(files),
    source: SOURCE_BUILTIN,
    layers,
  };
}

/**
 * 一套皮的锁定条目。摘要覆盖 `style/tokens/<name>.json` **加上全部 `*.vocab.json`**。
 *
 * 为什么词表也算进皮：可复现性锁的是「解析到的资产」，而皮解析出来的东西是
 * `loadStyle` 的返回值——它就是令牌 + 全部词表这一整包，next 下发的词表切片
 * 也从这里来。只锁令牌的话，词表里删掉一个 `sidebar-main`，摘要一动不动，
 * 而供料内容已经换了。别的皮的令牌文件不算：换皮不该让本项目报漂。
 */
export async function resolveTheme(assetsRoot, name) {
  const theme = String(name ?? '');
  if (!theme) throw fail('THEME_REQUIRED', 'resolveTheme 需要皮的名字，它来自 .vima/project.json');
  const styleDir = path.join(assetsRoot, STYLE_DIR);

  const files = [];
  const tokensRel = `${TOKENS_DIR}/${theme}.json`;
  try {
    files.push({ name: tokensRel, data: await readFile(path.join(styleDir, TOKENS_DIR, `${theme}.json`)) });
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    throw fail('THEME_NOT_FOUND', `没有这套皮：${theme}`);
  }
  for await (const rel of walk(styleDir, { exclude: new Set([TOKENS_DIR]) })) {
    if (!rel.endsWith(VOCAB_SUFFIX) || rel.includes('/')) continue;
    files.push({ name: rel, data: await readFile(path.join(styleDir, rel)) });
  }

  return { requested: theme, digest: digestFiles(files), source: SOURCE_BUILTIN };
}

// ── 依赖 DAG ──────────────────────────────────────────────────────────────

/**
 * 从 block.json 里读依赖的块。
 *
 * `depends.capabilities` 刻意不碰：它是人话（"auth-session: 已登录且能拿到…"），
 * 机器判不了，硬判只会逼人把人话写成假的机器语。它由 L1 契约与人来兜。
 *
 * 形状不对**当场炸**，不软着陆成「没有依赖」：`depends: {blocks: "a/b"}` 写成字符串时
 * 静默返回 [] 的话，这道闸门就等于不存在，而它看起来一直是绿的。
 */
export function dependsOf(id, meta) {
  const d = meta?.depends;
  if (d === undefined || d === null) return [];
  if (typeof d !== 'object' || Array.isArray(d)) {
    throw fail('BLOCK_DEPENDS_MALFORMED', `${id} 的 block.json 里 depends 不是对象——依赖无从校验（拒绝软着陆成「没有依赖」）`);
  }
  const blocks = d.blocks;
  if (blocks === undefined || blocks === null) return [];
  if (!Array.isArray(blocks) || blocks.some((x) => typeof x !== 'string' || !x)) {
    throw fail('BLOCK_DEPENDS_MALFORMED', `${id} 的 block.json 里 depends.blocks 必须是块 id 字符串数组`);
  }
  return blocks;
}

/**
 * 把 registry.listBlocks() 的结果编成依赖图：`Map<id, [依赖的 id…]>`。
 * 缺 block.json 的块照样进图（依赖为空）——半截块要能被看见，跳过等于藏起来。
 */
export function blockGraph(blocks) {
  const graph = new Map();
  for (const b of blocks) {
    const id = `${b.set}/${b.name}`;
    graph.set(id, dependsOf(id, b.meta));
  }
  return graph;
}

/**
 * 求一个块的传递依赖闭包，顺带把图里的毛病捞出来。
 *
 *   resolveDeps(graph, id) → { needs:[依赖序], missing:[{from,to}], cycles:[[路径]] }
 *
 * `needs` 是拓扑序（被依赖的在前），不含 id 自己。
 * missing = 依赖指向资产仓里没有的块；cycles = 依赖成环。
 * **两样都返回，不是碰到第一个就抛**：一次说清所有毛病，比让人修一个跑一次强。
 */
export function resolveDeps(graph, id) {
  const needs = [];
  const missing = [];
  const cycles = [];
  const done = new Set();
  const onPath = [];

  const visit = (node) => {
    const at = onPath.indexOf(node);
    if (at !== -1) {
      // 环：只记从入环点起的那一段，把整条访问路径记进去会让报错难读
      cycles.push([...onPath.slice(at), node]);
      return;
    }
    if (done.has(node)) return;
    const deps = graph.get(node);
    if (deps === undefined) return; // 不存在的块由调用点记进 missing，这里不重复
    onPath.push(node);
    for (const dep of deps) {
      if (!graph.has(dep)) {
        missing.push({ from: node, to: dep });
        continue;
      }
      visit(dep);
    }
    onPath.pop();
    done.add(node);
    if (node !== id) needs.push(node);
  };

  if (!graph.has(id)) {
    missing.push({ from: null, to: id });
    return { needs, missing, cycles };
  }
  visit(id);
  return { needs, missing, cycles };
}

// ── 锁文件读写 ────────────────────────────────────────────────────────────

function lockPath(root) {
  return path.join(root, ...LOCK_REL.split('/'));
}

const EMPTY = () => ({ schema: LOCK_SCHEMA, blocks: [], theme: null });

/**
 * 读锁。不存在返回空锁（新项目的正常状态）；**解析不了则炸**——
 * 把坏掉的 lock 当成「还没锁」，等于漂移检测悄悄下线。
 */
export async function readLock(root) {
  const raw = await readJson(lockPath(root));
  if (raw === undefined) return EMPTY();
  if (raw === null) throw fail('LOCK_MALFORMED', `${LOCK_REL} 不是合法 JSON——漂移检测无从进行（拒绝当成「还没锁」）`);
  if (!Array.isArray(raw.blocks)) throw fail('LOCK_MALFORMED', `${LOCK_REL} 里 blocks 不是数组`);
  return { schema: raw.schema ?? LOCK_SCHEMA, blocks: raw.blocks, theme: raw.theme ?? null };
}

/**
 * 写锁。键序与块序都固定，同样的内容写出同样的字节——它进版本控制，
 * 顺序一飘 diff 就全是噪音（C3：可读、可 diff、可 review）。
 */
export async function writeLock(root, lock) {
  const body = {
    schema: lock.schema ?? LOCK_SCHEMA,
    blocks: [...lock.blocks].sort((a, b) => (a.requested < b.requested ? -1 : a.requested > b.requested ? 1 : 0)),
    theme: lock.theme ?? null,
  };
  await atomicWrite(lockPath(root), `${JSON.stringify(body, null, 2)}\n`);
  return body;
}

/** 记下「这个块用的是这一版」。已有同 id 条目则覆盖（重装即刷新）。 */
export async function recordBlock(root, assetsRoot, id) {
  const entry = await resolveBlock(assetsRoot, id);
  const lock = await readLock(root);
  lock.blocks = [...lock.blocks.filter((b) => b?.requested !== entry.requested), entry];
  await writeLock(root, lock);
  return entry;
}

/** 卸块时同步销账。留着孤儿条目 = lock 说在用、config 说没装，两份都不可信了。 */
export async function forgetBlock(root, id) {
  const lock = await readLock(root);
  const before = lock.blocks.length;
  lock.blocks = lock.blocks.filter((b) => b?.requested !== String(id));
  if (lock.blocks.length === before) return false;
  await writeLock(root, lock);
  return true;
}

/** 记下「这套皮用的是这一版」。 */
export async function recordTheme(root, assetsRoot, name) {
  const entry = await resolveTheme(assetsRoot, name);
  const lock = await readLock(root);
  lock.theme = entry;
  await writeLock(root, lock);
  return entry;
}

// ── 漂移检测 ──────────────────────────────────────────────────────────────

/**
 * 锁定的摘要 vs 资产仓当下算出来的摘要。
 *
 *   checkLock(root, assetsRoot, config) → { entries, unlocked, drifted, locked }
 *
 * entries[].status 四态，**每一态都说得出「查了没有」**：
 *   ok          锁了、算得出、对得上
 *   drift       锁了、算得出、对不上          ← 内容变了，取过的证要重新看
 *   unreadable  锁了、**算不出**（块没了/读不出）← 是「没查」，不是「通过」
 *   orphan      锁了，但 config 里已经没有它  ← 两份配置互相矛盾
 * 三种非 ok 都计入 drifted。
 *
 * `unlocked` 单列且**不算漂移**：config 登记了但 lock 里没有，是存量项目的正常
 * 状态（锁机制之前装的块）。把它算成漂移，会让每个老项目的 `sync --check` 一上来
 * 就红，然后这条检查会在两天内被人关掉——那才是真的失去漂移检测。
 * 但它必须被报出来：没锁的资产就是没有可复现性保证，说清楚，别混进绿里。
 */
export async function checkLock(root, assetsRoot, config = {}) {
  const lock = await readLock(root);
  const entries = [];
  const unlocked = [];

  const wantBlocks = (config.blocks ?? []).map(String);
  const lockedBlocks = new Map();
  for (const b of lock.blocks) {
    if (b && typeof b.requested === 'string') lockedBlocks.set(b.requested, b);
  }

  for (const [id, locked] of lockedBlocks) {
    const entry = { kind: 'block', id, status: 'ok', locked: locked.digest ?? null, actual: null, why: null };
    if (!wantBlocks.includes(id)) {
      entry.status = 'orphan';
      entry.why = 'lock 里记着它，但 .vima/project.json 的 blocks 里已经没有了（多半是手改过 config）';
      entries.push(entry);
      continue;
    }
    try {
      entry.actual = (await resolveBlock(assetsRoot, id)).digest;
    } catch (err) {
      entry.status = 'unreadable';
      entry.why = `摘要算不出来，这一条**没查**：${err.message}`;
      entries.push(entry);
      continue;
    }
    if (entry.actual !== entry.locked) {
      entry.status = 'drift';
      entry.why = '资产仓里的内容与 lock 记的那一版对不上';
    }
    entries.push(entry);
  }
  for (const id of wantBlocks) {
    if (!lockedBlocks.has(id)) unlocked.push({ kind: 'block', id });
  }

  const theme = config.theme ? String(config.theme) : null;
  if (lock.theme && typeof lock.theme.requested === 'string') {
    const id = lock.theme.requested;
    const entry = { kind: 'theme', id, status: 'ok', locked: lock.theme.digest ?? null, actual: null, why: null };
    if (theme !== id) {
      entry.status = 'orphan';
      entry.why = `lock 锁的是皮 ${id}，而 config 现在登记的是 ${theme ?? '(无)'}`;
      // 孤儿 ≠ 现在这套皮查过了。换皮时手改了 config 的话，两件事同时成立：
      // 旧锁没用了、**新皮根本没锁**。只报前者会让人以为处理完了。
      if (theme) unlocked.push({ kind: 'theme', id: theme });
    } else {
      try {
        entry.actual = (await resolveTheme(assetsRoot, id)).digest;
      } catch (err) {
        entry.status = 'unreadable';
        entry.why = `摘要算不出来，这一条**没查**：${err.message}`;
      }
      if (entry.status === 'ok' && entry.actual !== entry.locked) {
        entry.status = 'drift';
        entry.why = '令牌或词表的内容与 lock 记的那一版对不上';
      }
    }
    entries.push(entry);
  } else if (theme) {
    unlocked.push({ kind: 'theme', id: theme });
  }

  entries.sort((a, b) => (a.kind + a.id < b.kind + b.id ? -1 : 1));
  return {
    entries,
    unlocked,
    locked: entries.length,
    drifted: entries.filter((e) => e.status !== 'ok').length,
  };
}
