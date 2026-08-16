// 资产仓读取 —— 「供料」这一半的入口（R6/R7）。
//
// 本模块**不持有任何静态清单**。没有 THEMES 数组、没有 BLOCKS 表、没有词表名
// 白名单。加一个块、换一套皮、加一份词表，都只是往 assets/ 里丢文件，代码一行
// 不改。上一代的教训正相反：块清单硬编码在渲染器里，加块要改三处、漏一处就
// 「块定义了没人消费」——那不是疏忽，是清单和内容分居两地的必然结果。
//
// 约定即接口（目录结构就是唯一的注册表）：
//
//   style/tokens/<theme>.json      一套皮 = 一个文件
//   style/<name>.vocab.json        一份词表 = 一个文件，<name> 即键名
//   blocks/<set>/<name>/           一个块 = 一个目录
//     block.json                   元信息 + 适用端 + 依赖
//     L<n>.<slug>.md               层文件，n ∈ 1..4，每层至多一个
//
// 依赖方向：assets/ 只 import core/，不反向。
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { walk, readJson, frontmatter } from '../core/fsx.mjs';

const STYLE_DIR = 'style';
const TOKENS_DIR = 'tokens';
const BLOCKS_DIR = 'blocks';
const VOCAB_SUFFIX = '.vocab.json';

/** 层文件命名：L1..L4 + slug + .md，且必须在块根。层的语义见 assets/blocks/README.md。 */
const LAYER_FILE = /^L([1-4])\.[A-Za-z0-9._-]+\.md$/;

/** L4（视觉）刻意可缺席：默认不提供，缺席不是残缺。见 assets/blocks/README.md。 */
const REQUIRED_LAYER_KEYS = Object.freeze(['L1', 'L2', 'L3']);

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/** 扫出装了哪些皮。只为把「有哪些可选」写进报错里——不缓存、不当清单用。 */
async function listThemes(assetsRoot) {
  const dir = path.join(assetsRoot, STYLE_DIR, TOKENS_DIR);
  const out = [];
  for await (const rel of walk(dir)) {
    if (rel.endsWith('.json') && !rel.includes('/')) out.push(rel.slice(0, -'.json'.length));
  }
  return out;
}

/**
 * 读一套完整的「形」：令牌（皮）+ 全部词表（骨）。
 *
 *   loadStyle(assetsRoot, theme) → { tokens, layout, interaction, ia, ... }
 *
 * 返回对象里除 `tokens` 外的键，**由 style/ 下有哪些 *.vocab.json 决定**。
 * 冻结签名承诺的 layout / interaction / ia 之所以在，是因为那三个文件在，
 * 不是因为代码里写了这三个名字。加第四份词表 → 多一个键，无需改动本文件。
 */
export async function loadStyle(assetsRoot, theme) {
  if (!theme) throw fail('THEME_REQUIRED', 'loadStyle 需要 theme（皮的名字），它来自 .vima/project.json');
  const styleDir = path.join(assetsRoot, STYLE_DIR);
  const tokensFile = path.join(styleDir, TOKENS_DIR, `${theme}.json`);

  const tokens = await readJson(tokensFile);
  if (tokens === undefined) {
    const have = await listThemes(assetsRoot);
    throw fail('THEME_NOT_FOUND', `没有这套皮：${theme}（现有：${have.join(', ') || '无'}）`);
  }
  if (tokens === null) throw fail('THEME_MALFORMED', `皮的令牌文件不是合法 JSON：${tokensFile}`);

  const style = { tokens };
  for await (const rel of walk(styleDir, { exclude: new Set([TOKENS_DIR]) })) {
    if (!rel.endsWith(VOCAB_SUFFIX) || rel.includes('/')) continue;
    const name = rel.slice(0, -VOCAB_SUFFIX.length);
    if (name === 'tokens') throw fail('VOCAB_NAME_RESERVED', 'tokens 是令牌的保留键，词表不能叫这个名字');
    const vocab = await readJson(path.join(styleDir, rel));
    if (vocab === null) throw fail('VOCAB_MALFORMED', `词表不是合法 JSON：${rel}`);
    style[name] = vocab;
  }
  return style;
}

/**
 * 列出资产仓里的全部业务块。
 *
 *   → [{ set, name, layers, meta }]
 *
 * 判据只有一条：`blocks/<set>/<name>/` 下存在文件即是一个块。
 * 因此 `blocks/common/.gitkeep`（只有两段路径）不是块，占位目录不会被当成内容。
 * 缺 block.json 的块**照样列出来**、meta 为 null——半截块要能被对账看见，
 * 静默跳过等于把缺陷藏起来。
 */
export async function listBlocks(assetsRoot) {
  const root = path.join(assetsRoot, BLOCKS_DIR);
  const found = new Map();

  for await (const rel of walk(root)) {
    const parts = rel.split('/');
    if (parts.length < 3) continue; // set/name/file 才构成块
    const [set, name, ...inner] = parts;
    const key = `${set}/${name}`;
    let block = found.get(key);
    if (!block) {
      block = { set, name, layers: [], meta: null };
      found.set(key, block);
    }
    if (inner.length === 1 && inner[0] === 'block.json') {
      const meta = await readJson(path.join(root, rel));
      if (meta === null) throw fail('BLOCK_META_MALFORMED', `block.json 不是合法 JSON：${rel}`);
      block.meta = meta;
    }
    const m = LAYER_FILE.exec(inner[0]);
    if (m && inner.length === 1 && !block.layers.includes(`L${m[1]}`)) block.layers.push(`L${m[1]}`);
  }

  for (const block of found.values()) block.layers.sort();
  return [...found.values()].sort((a, b) => (`${a.set}/${a.name}` < `${b.set}/${b.name}` ? -1 : 1));
}

/**
 * 读一个块的四层内容。
 *
 *   → { set, name, meta, L1, L2, L3, L4? }
 *
 * L1–L3 恒有键，缺失为 null（缺哪层要看得见）。**L4 只在真的存在时才有这个键**——
 * 默认不提供视觉层是一条决定，不是遗漏，所以用「键不存在」而不是 null 表达：
 * 消费方 `'L4' in block` 就能判断，不必去猜 null 是「没写」还是「不该有」。
 */
export async function readBlock(assetsRoot, set, name) {
  const dir = path.join(assetsRoot, BLOCKS_DIR, set, name);
  const block = { set, name, meta: null };

  const meta = await readJson(path.join(dir, 'block.json'));
  if (meta === null) throw fail('BLOCK_META_MALFORMED', `block.json 不是合法 JSON：${set}/${name}`);
  if (meta !== undefined) block.meta = meta;

  let files = 0;
  for await (const rel of walk(dir)) {
    files += 1;
    if (rel.includes('/')) continue; // 层文件只认块根，避免 L2 子目录里的文件被当成层
    const m = LAYER_FILE.exec(rel);
    if (!m) continue;
    const key = `L${m[1]}`;
    if (block[key]) throw fail('BLOCK_LAYER_DUPLICATE', `${set}/${name} 的 ${key} 有两个文件，层的真源只能有一个`);
    const raw = await readFile(path.join(dir, rel), 'utf8');
    const { data, body } = frontmatter(raw);
    block[key] = { file: rel, meta: data, text: body.trim() };
  }

  if (files === 0) throw fail('BLOCK_NOT_FOUND', `资产仓里没有这个块：${set}/${name}`);
  for (const key of REQUIRED_LAYER_KEYS) if (!(key in block)) block[key] = null;
  return block;
}

/**
 * 资产健康检查：项目登记的 theme 与 blocks，在资产仓里是不是真的存在且读得出。
 *
 * 为什么放这里而不是 ops/audit：ops 不 import assets（兄弟层），而「theme 存不存在」
 * 的判据只能是 loadStyle 自己——在 audit 里另写一个「查文件在不在」就是第二真源，
 * 词表读不出、令牌 JSON 坏掉这些 loadStyle 会拦的情况它都看不见。
 *
 * 只判定、不定级：error/warn 的取舍是 audit 的口径（theme 坏了挡供料是 error，
 * 块缺层还能半供是 warn），留给注入方。这里的返回是纯事实。
 *
 *   checkAssets(assetsRoot, config) → { theme, blocks }
 *     theme   null（config 没登记）| { name, ok, code?, message? }
 *     blocks  [{ id, ok, missing:[层], code?, message? }]
 */
export async function checkAssets(assetsRoot, config = {}) {
  const out = { theme: null, blocks: [] };

  if (config.theme) {
    try {
      await loadStyle(assetsRoot, config.theme);
      out.theme = { name: config.theme, ok: true };
    } catch (err) {
      out.theme = { name: config.theme, ok: false, code: err.code ?? null, message: err.message };
    }
  }

  const projectKinds = [...new Set(
    (config.apps ?? []).map((a) => a?.kind).filter((k) => typeof k === 'string' && k !== ''),
  )].sort();

  for (const id of config.blocks ?? []) {
    const entry = { id: String(id), ok: false, missing: [], sides: null, sideMatch: 'unchecked' };
    const parts = String(id).split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      // 手改 project.json 写坏 id 时，audit 是唯一能发现它的地方——不能静默跳过
      entry.code = 'BLOCK_ID_MALFORMED';
      entry.message = `块 id 必须是 <set>/<name> 形态，读到的是：${id}`;
    } else {
      try {
        const block = await readBlock(assetsRoot, parts[0], parts[1]);
        entry.missing = REQUIRED_LAYER_KEYS.filter((k) => !block[k]);
        entry.ok = entry.missing.length === 0;
        if (!entry.ok) entry.message = `缺层：${entry.missing.join('、')}`;
        Object.assign(entry, sideMatchOf(block.meta, projectKinds));
      } catch (err) {
        entry.code = err.code ?? null;
        entry.message = err.message;
      }
    }
    out.blocks.push(entry);
  }

  out.projectKinds = projectKinds;
  return out;
}

/**
 * 「拿错端的块」判定（R11 判据第三条）。
 *
 * 块在 `block.json` 里声明 `sides`（取值同 ia 词表的 sides 组），项目在 `config.apps[].kind`
 * 里登记自己有哪些端。两边**完全无交集** = 这个块在这个项目里没有任何端消费得了它——
 * 装了也供不出料，而缺的那部分要到取证时才显形。
 *
 * **三态，不是布尔**——「没查」必须和「查了没问题」分得开（同 summary.rules 的口径）：
 *   match     有交集，正常
 *   mismatch  两边都说得出话，但交集为空 → 这才是「拿错端」
 *   unchecked 有一边说不出话：项目还没登记端（新项目的正常状态），
 *             或块没声明 sides（资产仓的事，不是项目的错）
 *
 * 零假阳性靠的就是第三态：任何一边缺信息一律不判，绝不猜。
 *
 * @param {object|null} meta block.json 内容
 * @param {string[]} projectKinds 项目登记的端 kind（已去重排序）
 * @returns {{ sides: string[]|null, sideMatch: 'match'|'mismatch'|'unchecked' }}
 */
export function sideMatchOf(meta, projectKinds) {
  const sides = Array.isArray(meta?.sides)
    ? [...new Set(meta.sides.filter((s) => typeof s === 'string' && s !== ''))].sort()
    : null;
  if (sides === null || sides.length === 0) return { sides, sideMatch: 'unchecked' };
  if (projectKinds.length === 0) return { sides, sideMatch: 'unchecked' };
  return { sides, sideMatch: sides.some((s) => projectKinds.includes(s)) ? 'match' : 'mismatch' };
}
