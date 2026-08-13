// 契约模型：docs/contracts/*.md 的 vima:contract 块加载（internal-contracts §5 / §7）
import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { VimaError } from '../util/errors.mjs';
import { extractBlocks } from '../util/md.mjs';

/**
 * 加载全部契约文件（跳过 _ 前缀），每份文件取文末的 vima:contract 块。
 * @param {string} root
 * @param {{tolerant?: boolean}} [opts] tolerant=true 时单份文件解析失败不抛出，
 *   而是把消息记在该条目的 parseError 上继续加载其余文件——供 validate 一次报全部
 *   解析错误（默认 false：render 等消费方仍应在首个坏契约上拒绝出活）。
 * @returns {Promise<Array<{file: string, module: string|null,
 *   apis: Array<{method, path, request, response, errors}>, parseError?: string}>>}
 *   file 为相对 root 的 '/' 分隔路径，按文件名稳定排序；
 *   无 vima:contract 块的文件也返回条目（module=null, apis=[]），供校验规则报告。
 */
export async function loadContracts(root, { tolerant = false } = {}) {
  const dir = path.join(root, 'docs', 'contracts');
  let names;
  try {
    names = await readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  names = names.filter((n) => n.endsWith('.md') && !n.startsWith('_')).sort();
  const out = [];
  for (const name of names) {
    const rel = `docs/contracts/${name}`;
    const text = await readFile(path.join(dir, name), 'utf8');
    let blocks;
    try {
      blocks = extractBlocks(text, 'contract', { path: rel });
    } catch (err) {
      if (err instanceof VimaError && !err.path) err.path = rel;
      if (!tolerant) throw err;
      out.push({ file: rel, module: null, apis: [], parseError: err.message });
      continue;
    }
    if (blocks.length === 0) {
      out.push({ file: rel, module: null, apis: [] });
      continue;
    }
    const data = blocks[blocks.length - 1].data ?? {}; // 契约纪律：文末一块为准
    out.push({
      file: rel,
      module: typeof data.module === 'string' ? data.module : null,
      apis: Array.isArray(data.apis) ? data.apis : [],
    });
  }
  return out;
}

/** 接口唯一键：`${METHOD} ${path}`（method 统一大写）。 */
export function apiKey(api) {
  return `${String(api.method ?? '').toUpperCase()} ${api.path ?? ''}`;
}
