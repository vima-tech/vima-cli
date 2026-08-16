// 项目定位与配置。
//
// 「项目根在哪」只能有一个判据。上一代吃过亏：--line 里自造了「查 .vima/ 目录」
// 的判据，而内核 findProjectRoot 用的是「.vima/ 或 docs/lifecycle.json」，
// 对未 init 出 .vima/ 的项目当场误报——判据只能有一个真源。
import { readFile, writeFile, rename, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export const MARKER = '.vima';

/** 唯一判据：存在 .vima/ 目录即项目根。向上回溯，到家目录或文件系统根为止。 */
export async function findRoot(from = process.cwd()) {
  let dir = path.resolve(from);
  const stop = path.parse(dir).root;
  const home = os.homedir();
  for (;;) {
    try {
      await access(path.join(dir, MARKER));
      return dir;
    } catch { /* 继续向上 */ }
    if (dir === stop || dir === home) return null;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/**
 * 四源回退定位项目根，被写文件路径优先。
 *
 * 顺序不能改：上一代评审轮抓到过一次倒置——env 排在文件路径之前时，
 * 会话根本身也是项目、被写文件属于其中嵌套的另一个项目，根就被判到外层，
 * 保护对内层静默放行（实测复现 exit 0）。文件在哪个项目里，就按哪个项目判。
 */
export async function resolveRoot({ filePath, env = process.env, cwd } = {}) {
  if (filePath) {
    const r = await findRoot(path.dirname(path.resolve(filePath)));
    if (r) return r;
  }
  if (env.VIMA_PROJECT_DIR) {
    const r = await findRoot(env.VIMA_PROJECT_DIR);
    if (r) return r;
  }
  if (env.CLAUDE_PROJECT_DIR) {
    const r = await findRoot(env.CLAUDE_PROJECT_DIR);
    if (r) return r;
  }
  if (cwd) {
    const r = await findRoot(cwd);
    if (r) return r;
  }
  return findRoot(process.cwd());
}

const CONFIG_REL = '.vima/project.json';

const DEFAULTS = Object.freeze({
  schema: '4',
  name: '',
  theme: 'enterprise-blue',   // 皮：整体可替换（R7 皮相可变）
  apps: [],                   // [{ id, kind }] 一后端 × 多前端
  blocks: [],                 // 装了哪些业务块
});

export async function readConfig(root) {
  try {
    const raw = await readFile(path.join(root, ...CONFIG_REL.split('/')), 'utf8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (err) {
    if (err.code === 'ENOENT') return { ...DEFAULTS };
    throw err;
  }
}

/** 原子写：临时文件 + rename，避免半截文件把项目搞坏。 */
export async function writeConfig(root, config) {
  const file = path.join(root, ...CONFIG_REL.split('/'));
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify({ ...DEFAULTS, ...config }, null, 2)}\n`, 'utf8');
  await rename(tmp, file);
}

/** CLI 与 MCP 共用的上下文构造——两个门面一套逻辑，不存在第二个真源。 */
export async function context(opts = {}) {
  const root = await resolveRoot(opts);
  if (!root) return { root: null, config: null };
  return { root, config: await readConfig(root) };
}
