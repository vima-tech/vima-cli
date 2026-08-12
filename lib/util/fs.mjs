// 文件系统工具（internal-contracts §4）
// 全项目写盘统一走 atomicWriteFile；JSON 落盘统一走 stableStringify。
import { mkdir, stat, writeFile, rename, unlink, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

/** 递归创建目录（已存在时静默）。 */
export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
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
