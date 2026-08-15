// 文件系统工具（internal-contracts §4）
// 全项目写盘统一走 atomicWriteFile；JSON 落盘统一走 stableStringify。
import { mkdir, stat, writeFile, rename, unlink, readFile, readdir } from 'node:fs/promises';
import { appendFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

/** 递归创建目录（已存在时静默）。 */
export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

/**
 * 项目根定位（A24，契约 §4）：从 startDir 逐级向上找**含 `.vima/` 或 `docs/lifecycle.json`
 * 的最近祖先**，返回绝对路径；到文件系统根仍未命中返回 null。纯遍历，不读内容、不写盘。
 *
 * 动机（实测）：CLI 原先按当前目录静默工作——在 `backend/` 下跑 `vima validate` 得到
 * 「2 错误」（项目根实为 0 错误），**并把 `pass: false` 落盘到 `backend/.vima/reports/`**。
 * 其余缺陷都是漏检，这一条是「误报成事实并持久化」：磁盘上的错误报告之后会被人或
 * Agent 当权威读取。同一个错在实战中栽了两次。
 */
export async function findProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    if (await directoryExists(path.join(dir, '.vima'))) return dir;
    if (await fileExists(path.join(dir, 'docs', 'lifecycle.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null; // 已到文件系统根
    dir = parent;
  }
}

/** 路径是否存在且为目录。 */
export async function directoryExists(p) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/** 路径是否存在（文件或目录均算存在）。 */
export async function fileExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

// 临时文件序号：pid + 进程内自增，保证并发写不同目标互不干扰（不用随机数/时间戳）
let tmpSeq = 0;

/** 原子写文件：自动 ensureDir(dirname)，先写临时文件再 rename。 */
export async function atomicWriteFile(p, content) {
  await ensureDir(path.dirname(p));
  const tmp = `${p}.${process.pid}.${++tmpSeq}.tmp`;
  try {
    await writeFile(tmp, content);
    await rename(tmp, p);
  } catch (err) {
    // 失败时尽力清理临时文件，不掩盖原始错误
    try {
      await unlink(tmp);
    } catch {
      /* 忽略清理失败 */
    }
    throw err;
  }
}

/** journal 单行硬上限：POSIX 下小于 PIPE_BUF(4096) 的 O_APPEND 写是原子的（A35 D-A35-04）。 */
export const JOURNAL_MAX_LINE = 1024;

/**
 * 追加一行 JSON 到 JSONL 文件（A35 过程轨迹采集口；契约 §4/§6.21）。
 *
 * 三条纪律，缺一不可：
 *   1. **同步 O_APPEND**——A18 允许 maxParallel 到 10，多个采集方并发追加同一文件；
 *      单行 ≤ JOURNAL_MAX_LINE 字节时该写入是原子的，不会交错撕行（D-A35-04）。
 *   2. **超长截断 `ref`**，不换行不折行——折行会把一条事件变成两条不合法的行。
 *   3. **任何异常一律吞掉**——采集是旁路，绝不能改变命令的退出码与 stdout/stderr
 *      （同 hook 的「防误不防恶意」口径，D-A35-02）。
 *
 * 采集端允许读时钟；消费端（渲染 / 校验 / 退出码）一律不得读时钟——见 A35「与硬约束的关系」。
 */
export function appendJsonLine(p, obj) {
  try {
    let line = `${JSON.stringify(obj)}\n`;
    if (Buffer.byteLength(line) > JOURNAL_MAX_LINE && typeof obj?.ref === 'string') {
      // 逐步截 ref 直到整行进上限；ref 是唯一变长字段（其余四键均为封闭集或短整数）
      const over = Buffer.byteLength(line) - JOURNAL_MAX_LINE;
      const kept = Math.max(0, obj.ref.length - over - 1);
      line = `${JSON.stringify({ ...obj, ref: obj.ref.slice(0, kept) })}\n`;
    }
    if (Buffer.byteLength(line) > JOURNAL_MAX_LINE) return; // 截了仍超长（异常输入）→ 丢弃该行
    mkdirSync(path.dirname(p), { recursive: true });
    appendFileSync(p, line);
  } catch {
    /* 采集失败不影响命令本体 */
  }
}

/** 深度 key 排序的 JSON 序列化：2 空格缩进、结尾换行（数组顺序由调用方保证）。 */
export function stableStringify(value) {
  return `${JSON.stringify(sortDeep(value), null, 2)}\n`;
}

function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v !== null && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortDeep(v[k]);
    return out;
  }
  return v;
}

/**
 * 逐字节比对 [绝对路径, 相对路径, 期望内容] 三元组，返回漂移清单（每条为可读单行）。
 * 渲染产物 --check 与 approve 前置 2 新鲜度机检（A12）共用，漂移判定单一真源。
 */
export async function driftOf(pairs) {
  const drift = [];
  for (const [p, rel, content] of pairs) {
    if (!(await fileExists(p))) {
      drift.push(`${rel} 不存在`);
      continue;
    }
    const disk = await readFile(p);
    if (!disk.equals(Buffer.from(content, 'utf8'))) drift.push(`${rel} 与 spec 渲染结果不一致`);
  }
  return drift;
}

/** 文本/Buffer 的 sha256 十六进制摘要。 */
export function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

/** 文件内容的 sha256 十六进制摘要。 */
export async function sha256File(p) {
  return sha256(await readFile(p));
}

/**
 * 递归枚举 root 下所有文件。
 * @returns 相对路径数组（'/' 分隔，稳定排序）；exclude 为要跳过的目录名数组（如 node_modules）。
 */
export async function walkFiles(root, { exclude = [] } = {}) {
  const excluded = new Set(exclude);
  const out = [];
  async function walk(dir, rel) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!excluded.has(entry.name)) await walk(path.join(dir, entry.name), childRel);
      } else if (entry.isFile()) {
        out.push(childRel);
      }
    }
  }
  await walk(root, '');
  out.sort();
  return out;
}
