// 租约 —— 「谁**正在做**这条命题」的运行态协调（P0-4）。
//
// 为什么它不是事件：
//   事件流回答「发生过什么」（需求、认领、取证），是产品真源，append-only、
//   永不过期。租约回答「此刻这条题在谁手上」，是**会过期的运行态**——
//   它对最终历史没有贡献，Agent 崩溃后它必须能被无声回收。
//   把这种东西塞进 append-only 的真源里，等于让「谁 30 分钟前拿过锁」
//   永久污染需求账本，而且过期这件事在 append-only 语义里根本表达不了
//   （只能再 append 一条「我不要了」，崩溃的 Agent 恰恰写不出那一条）。
//   所以租约落 `.vima/leases/`（形状见下），可删可过期。
//   最终历史仍由 claim / run / evidence 事件重建，删光 leases/ 不损失任何真源。
//
// 本模块的技术核心只有一个词：**原子获取**。create-if-absent（`wx` / `link`）
//   由内核保证「不存在则创建、已存在则 EEXIST」之间没有窗口。写成
//   `if (!exists) write` 就有窗口：两个 Builder 同时 exists 返回 false，
//   然后双双写入、双双认为自己拿到了题——**这正是 P0-4 要消灭的那个缺陷**，
//   而它在顺序调用的测试里 100% 报绿。
//   变异验证（tests/unit/core.lease.test.mjs 有注释指路）：把 link 换成
//   exists+write，并发测试必须变红；不变红说明那条测试没在测并发。
//
// 落盘形状是 `.vima/leases/<claimId>/<序号>.json`，**序号只增不减、文件名从不复用**。
// 为什么不是一条题一个文件：那样「回收过期租约」必须先删后建，而删和建之间有窗口——
//   A 删、A 建、B 把 A 刚建的**新**租约当旧的删掉、B 建 → 两个人都拿到同一条题。
//   （用 rename 抢占也一样：rename 只保证「源存在」，不保证源还是我刚读到的那份。
//    这个坑是实测出来的：8 进程抢一份过期租约，出了 4 个赢家。）
// 序号方案把每一次状态变更都变成**一次 create-if-absent**：
//   当前持有者 = 序号最大的那份。想接手就去建 max+1，内核保证只有一个人建得成；
//   视野旧的人算出的号早已存在，撞 EEXIST 直接出局，不可能出现「两个赢家」。
// 代价是每回收一次多留一个小文件（正常流程一个都不多——续租是就地重写自己那份）。
//
// 时钟纪律：本模块不读系统时钟。`now` 一律由调用方注入——否则「过期回收」
// 这条判据没法被确定性地测（只能 sleep 等真实时间，那种测试迟早被删掉）。
import { writeFile, readFile, readdir, rename, unlink, link, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export const LEASES_REL = '.vima/leases';

/**
 * 默认租期 30 分钟。
 *
 * 定这个数的两头约束：短到「Agent 崩溃后人不用干等」，长到「一条命题正常
 * 实现不会中途被别人抢走」。同一持有者重新 acquire 即续租（见 acquire），
 * 所以长任务靠续租而不是靠把租期调大——把租期调大只会让崩溃恢复变慢。
 */
export const DEFAULT_TTL_MS = 30 * 60 * 1000;

/** 稳定序列化：键排序 + 2 空格 + 尾换行（CLAUDE.md 硬约束，同一输入字节一致）。 */
function stableStringify(value) {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}
function sortKeys(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(sortKeys);
  const out = {};
  for (const k of Object.keys(v).sort()) if (v[k] !== undefined) out[k] = sortKeys(v[k]);
  return out;
}

/**
 * claimId → 目录名。用 encodeURIComponent：命题 id 里出现 `/` 时不会多分出一层目录
 * （`spec/login` 会静默变成 `leases/spec/login/`，list 扫不到、锁形同虚设）。
 * 反解得回 id，所以 list 不依赖文件内容也能说出「这是哪条题的租约」。
 */
function dirOf(root, claimId) {
  return path.join(root, ...LEASES_REL.split('/'), encodeURIComponent(claimId));
}

const SEQ_RE = /^(\d+)\.json$/;
const seqFile = (dir, seq) => path.join(dir, `${String(seq).padStart(6, '0')}.json`);

/**
 * 这条题当前的租约 = 序号最大的那一份。
 * 读不出内容（写坏了 / 还没落完）时返回 lease:null 但 seq 照给——
 * 接手的人要建的是 seq+1，不能因为读不懂就回头去建一个已经存在的号。
 */
async function currentOf(dir) {
  let names;
  try {
    names = await readdir(dir);
  } catch (err) {
    // ENOTDIR：`.vima/leases/` 下的 .gitignore 之类的普通文件，不是某条题的租约目录
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return { seq: 0, lease: null };
    throw err;
  }
  let seq = 0;
  for (const name of names) {
    const m = SEQ_RE.exec(name);
    if (m) seq = Math.max(seq, Number(m[1]));
  }
  if (seq === 0) return { seq: 0, lease: null };
  return { seq, lease: await readJson(seqFile(dir, seq)) };
}

async function readJson(file) {
  try {
    const rec = JSON.parse(await readFile(file, 'utf8'));
    return rec && typeof rec === 'object' ? rec : null;
  } catch {
    return null;
  }
}

/** 租约还在有效期内吗。边界取「过期时刻本身已失效」——到点即可回收，不留半开区间的歧义。 */
export function isActive(lease, now) {
  if (!lease || typeof lease.expiresAt !== 'string') return false;
  const end = Date.parse(lease.expiresAt);
  if (Number.isNaN(end)) return false; // 时间戳读不懂 = 说不出什么时候过期 = 不能当有效
  return end > +now;
}

/**
 * 同一个持有者吗。身份 = actor + worktree 两段合起来。
 *
 * 为什么不只看 actor：CLI 的默认 actor 是 'cli'，两个并行会话的 actor 会撞。
 * 为什么要有 worktree：Builder 各自在自己的 worktree 里干活，那是它们**唯一**
 * 天然互不相同的东西。两段都一样才算「同一个人回来续租」。
 */
function sameHolder(a, b) {
  return a.actor === b.actor && (a.worktree ?? null) === (b.worktree ?? null);
}

/** 读一条题当前的租约。缺失或读不懂都返回 null——读不懂 = 说不出持有人与过期时刻 = 等同于没有。 */
export async function read(root, claimId) {
  return (await currentOf(dirOf(root, claimId))).lease;
}

/**
 * 列出全部租约（含已过期的——过期与否由调用方拿 now 判，本模块不替它决定）。
 * 坏文件不抛，单独报出来：一条写坏的租约不该让 `vima next` 打不开，
 * 但也不能装作没有——它对应的命题此刻**不受保护**，可能被重复派题。
 */
export async function list(root) {
  const base = path.join(root, ...LEASES_REL.split('/'));
  let names;
  try {
    names = await readdir(base);
  } catch (err) {
    if (err.code === 'ENOENT') return { leases: [], corrupt: [] };
    throw err;
  }
  const leases = [];
  const corrupt = [];
  for (const name of names.sort()) {
    const { seq, lease } = await currentOf(path.join(base, name));
    if (seq === 0) continue; // 空目录：抢过又被清过，不是租约
    if (lease && typeof lease.claimId === 'string') leases.push(lease);
    else corrupt.push(decodeURIComponent(name));
  }
  return { leases, corrupt };
}

/**
 * 获取租约。**同时请求 N 次只会有一个成功**——这是本模块存在的全部理由。
 *
 * 返回 { ok:true, lease, renewed, reclaimed } 或 { ok:false, reason, held }：
 *   reason='held'  被别人占着且未过期（held 里有 actor / worktree / expiresAt，
 *                  调用方要把这三样原样说给人听——「拿不到」而不说「被谁拿着」
 *                  只会让人去删文件）
 *   reason='raced' 过期回收时被另一个请求抢先了。语义同 held，单独给个名字是为了
 *                  让调用方能区分「一直有人占着」和「刚刚被抢走」
 *
 * 三条路径：
 *   ① 自己占着     就地重写自己那份（文件是自己的，不存在竞争），序号不变 → renewed
 *   ② 别人占着未过期 到此为止
 *   ③ 空的/过期/读坏 建 max+1 号 → 内核保证只有一个人建得成
 *
 * ③ 里视野旧的人不会误判：他算出的号早被人建过，撞 EEXIST 出局。序号从不复用，
 * 所以「先删后建」那个窗口在这个形状里根本不存在。
 */
export async function acquire(root, claimId, { actor, worktree = null, now, ttlMs = DEFAULT_TTL_MS } = {}) {
  if (typeof claimId !== 'string' || claimId === '') throw new Error('租约必须绑定一条命题 id');
  if (typeof actor !== 'string' || actor === '') throw new Error('租约必须记录 actor——「谁占着」是它唯一要回答的问题');
  if (!(now instanceof Date) || Number.isNaN(+now)) throw new Error('租约的 now 由调用方注入（core 不读系统时钟）');

  const dir = dirOf(root, claimId);
  await mkdir(dir, { recursive: true });
  // 租约是运行态，不进版本控制——否则一次提交就会把「谁 30 分钟前占着」带给所有人，
  // 而它在别人机器上既过期又无意义。落点自己带 .gitignore（同 `.vima/index/` 的处置），
  // 不指望 init 记得为它加一条：init 只跑一次，而这个目录是首次认领时才出现的。
  await ignoreOnce(path.dirname(dir));
  const lease = {
    claimId,
    actor,
    worktree,
    claimedAt: now.toISOString(),
    expiresAt: new Date(+now + ttlMs).toISOString(),
  };
  const text = stableStringify(lease);
  const { seq, lease: held } = await currentOf(dir);

  if (held && isActive(held, now)) {
    // ① 自己占着 → 续租。长任务靠这条活着，而不是靠把 TTL 调大。
    if (sameHolder(held, { actor, worktree })) {
      await writeOver(seqFile(dir, seq), text);
      return { ok: true, lease, renewed: true, reclaimed: false };
    }
    // ② 别人占着
    return { ok: false, reason: 'held', held };
  }

  // ③ 接手：建下一号
  if (await createNew(seqFile(dir, seq + 1), text)) {
    return { ok: true, lease, renewed: false, reclaimed: seq > 0 };
  }
  // 有人比我快。他现在是合法持有者，如实报出来。
  return { ok: false, reason: 'raced', held: (await currentOf(dir)).lease };
}

/**
 * create-if-absent，且**内容落全了名字才出现**。
 *
 * 先写临时文件再 link：link 与 `wx` 一样由内核保证「已存在则 EEXIST」，
 * 但它比 `wx` 多挡一类事故——`wx` 是先出现名字再写内容，另一个进程恰好在这中间
 * 读到的是半截 JSON，会把「有人正占着」误判成「文件坏了，可以抢」。
 * 那种误判很稀有，也正因为稀有，靠测试是抓不住的，只能从形状上消除。
 *
 * true=建成了（我拿到了），false=已存在。其它错误照抛。
 */
async function createNew(file, text) {
  const tmp = path.join(path.dirname(file), `.tmp-${randomUUID()}`);
  await writeFile(tmp, text, 'utf8');
  try {
    await link(tmp, file);
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') return false;
    throw err;
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

/** 已经有就不动（并发下 EEXIST 是正常结果，不是错误）。 */
async function ignoreOnce(base) {
  try {
    await writeFile(path.join(base, '.gitignore'), '*\n', { encoding: 'utf8', flag: 'wx' });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

/** 续租时的重写：临时文件 + rename，同样不留半截文件（CLAUDE.md 原子写）。 */
async function writeOver(file, text) {
  const tmp = path.join(path.dirname(file), `.tmp-${randomUUID()}`);
  await writeFile(tmp, text, 'utf8');
  await rename(tmp, file);
}

// 这里刻意**没有** release()。租约的回收只有一条路：过期。
// 理由是当前没有消费方——命题达标后 next 本来就不会再派它，submit 失败时同一持有者
// 续租继续做。加一个没人调的 release，就是「块定义了没人消费」。
// 真需要显式释放（比如 Builder 主动放弃）时，它会和调用方一起落地。
