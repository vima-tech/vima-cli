// 清单模型：.vima/manifest.json 读写（internal-contracts §5 / §6.4）
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { VimaError } from '../util/errors.mjs';
import { atomicWriteFile, stableStringify } from '../util/fs.mjs';

const MANIFEST_REL = '.vima/manifest.json';

/**
 * 读取 .vima/manifest.json。
 * @returns {Promise<object|null>} 文件缺失返回 null（未 init 过的项目属正常态）
 */
export async function loadManifest(root) {
  const p = path.join(root, MANIFEST_REL);
  let text;
  try {
    text = await readFile(p, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new VimaError('MANIFEST_PARSE', `manifest.json 解析失败: ${err.message}`, { path: MANIFEST_REL });
  }
}

/** 写回 .vima/manifest.json（stableStringify + 原子写）。 */
export async function saveManifest(root, m) {
  await atomicWriteFile(path.join(root, MANIFEST_REL), stableStringify(m));
}
