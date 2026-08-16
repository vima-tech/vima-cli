// 按维度选规则 —— 规则层的「选」与「删」（约束下沉纪律的第二档）。
//
// 两个决定撑起这个模块：
//
// 1）规则声明**适用维度**，不写 glob 路径。
//    路径匹配是在回答「这个文件长什么样」，可任务问的是「我现在在做什么」。
//    `layer=impl side=wechat block=role-management` 比 `apps/**/pages/*.vue`
//    精确得多，而且它是**算出来的**——不依赖任何人记得去读某份规约。
//    上一代靠「规程里写了要读」，实测 12/45 个页面压根没读。
//
// 2）没被任何维度组合命中的规则 = 死规则，`deadRules` 把它捞出来。
//    「规则层膨胀是信号」从此不是劝诫，是一条能跑的检查。规则只增不减的仓库，
//    最后没人看得完，等于没有规则。
//
// 维度语义：
//   layer  命题分层 intent/spec/contract/impl/behavior —— 现在做的是哪一层
//   side   端形态 server/admin/wechat/h5 —— 词表见 style/ia.vocab.json 的 sides
//   app    具体的端实例 id（一后端 × 多前端里的那个 id）
//   block  业务块 `<set>/<name>`
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { walk, frontmatter } from '../core/fsx.mjs';

/** 维度名封闭集合。加维度要同时改 selectRules / deadRules / 规则写法，不是配置项。 */
export const DIMENSIONS = Object.freeze(['layer', 'side', 'app', 'block']);

const BUILTIN_DIR = 'rules';
const PROJECT_DIR = ['.vima', 'rules'];
const SKIP = new Set(['README.md']);

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function toList(value) {
  if (value === undefined || value === null) return [];
  return (Array.isArray(value) ? value : [value]).map(String).filter(Boolean);
}

/** frontmatter 只允许维度键。写错一个 `sides:` 就该当场炸——
 *  被静默忽略的限定词会让规则从「只在小程序生效」悄悄变成「处处生效」。 */
function parseApplies(data, id) {
  const applies = { layer: null, side: null, app: null, block: null };
  for (const [key, raw] of Object.entries(data)) {
    if (!DIMENSIONS.includes(key)) {
      throw fail('RULE_UNKNOWN_KEY', `规则 ${id} 的 frontmatter 有未知键 ${key}（只允许 ${DIMENSIONS.join('/')}）`);
    }
    const values = toList(raw);
    if (values.length === 0) throw fail('RULE_EMPTY_DIM', `规则 ${id} 的 ${key} 声明为空——不限定就整条删掉，别留空数组`);
    // `*` 表示显式声明「任意」，等价于不写；两种写法都归一成 null。
    applies[key] = values.includes('*') ? null : values;
  }
  return applies;
}

async function readRuleDir(dir, origin) {
  const rules = [];
  for await (const rel of walk(dir)) {
    if (!rel.endsWith('.md') || SKIP.has(rel)) continue;
    const id = rel.slice(0, -'.md'.length);
    const raw = await readFile(path.join(dir, rel), 'utf8');
    const { data, body, unparsed } = frontmatter(raw);
    // 读不懂的行必须炸，理由与 RULE_UNKNOWN_KEY 完全相同：
    // 被静默忽略的限定词会让规则从「只在小程序生效」悄悄变成「处处生效」。
    // 区别只在于一个是键名写错、一个是值的写法解析器不认——后果一模一样。
    if (unparsed.length) {
      throw fail('RULE_UNPARSED', `规则 ${rel} 的 frontmatter 第 ${unparsed.map((u) => u.line).join('/')} 行读不懂：`
        + `${unparsed.map((u) => JSON.stringify(u.text)).join(' ')}——只支持 \`键: 值\`、行内数组、缩进的 \`- 列表项\``);
    }
    const text = body.trim();
    if (!text) throw fail('RULE_EMPTY', `规则 ${id} 没有正文`);
    rules.push({ id, applies: parseApplies(data, id), text, origin });
  }
  return rules;
}

/**
 * 读内置规则 + 项目规则。
 *
 *   → [{ id, applies, text, origin }]，origin ∈ 'builtin' | 'project'
 *
 * id 从文件相对路径推导（去掉 .md），不设 frontmatter id 字段——
 * 同一件事有两个真源就一定会有一天对不上。
 *
 * 同 id 时**项目规则覆盖内置**：否则项目想修正一条内置规则就只能眼睁睁看着
 * 两条互相打架的规则一起被选出来喂给 agent。
 */
export async function loadRules(assetsRoot, projectRoot) {
  const builtin = await readRuleDir(path.join(assetsRoot, BUILTIN_DIR), 'builtin');
  const project = projectRoot ? await readRuleDir(path.join(projectRoot, ...PROJECT_DIR), 'project') : [];
  const byId = new Map();
  for (const rule of [...builtin, ...project]) byId.set(rule.id, rule);
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * 一条规则限定了某维度，而任务**没说**自己在这个维度上是什么 → 不选。
 *
 * 反过来（没说就全选）看着更保险，实则是把「不知道」当成「都算」，
 * 于是 wechat 专属规则会被喂进后端任务，规则集迅速稀释成噪音，
 * agent 学会整体跳过——这正是规则层失效的常见死法。
 */
function matches(declared, given) {
  if (declared === null) return true; // 规则没限定这个维度 → 任意任务都适用
  return given.some((value) => declared.includes(value));
}

/** 按任务维度选规则。dims: { layer, side, app, blocks }（前三个可给数组，blocks 天然是数组）。 */
export function selectRules(rules, dims = {}) {
  const given = {
    layer: toList(dims.layer),
    side: toList(dims.side),
    app: toList(dims.app),
    block: toList(dims.blocks ?? dims.block),
  };
  return rules.filter((rule) => DIMENSIONS.every((d) => matches(rule.applies[d], given[d])));
}

/** 枚举维度全集的笛卡尔积。block 单个取（命中是「交集非空」，单个够用）外加「无块」一格。 */
function combos(allDims) {
  const axis = (values) => (values.length ? values : [undefined]);
  const layers = axis(toList(allDims.layers));
  const sides = axis(toList(allDims.sides));
  const apps = axis(toList(allDims.apps));
  const blockSets = [[], ...toList(allDims.blocks).map((b) => [b])];
  const out = [];
  for (const layer of layers) {
    for (const side of sides) {
      for (const app of apps) {
        for (const blocks of blockSets) out.push({ layer, side, app, blocks });
      }
    }
  }
  return out;
}

/**
 * 死规则 = 在维度全集里跑遍所有组合，一次都没被 selectRules 选中的规则。
 *
 * 判定**用 selectRules 本身跑**，不另写一套「分析式」快速判据——
 * 两套匹配逻辑迟早会漂移，那时死规则检查就成了会说谎的检查。
 * 组合数是维度全集的积（数量级几千），穷举便宜得多。
 *
 * allDims: { layers, sides, apps, blocks }（全集用复数键，与任务维度 dims 区分开）。
 */
export function deadRules(rules, allDims = {}) {
  const alive = new Set();
  for (const dims of combos(allDims)) {
    for (const rule of selectRules(rules, dims)) alive.add(rule.id);
  }
  return rules.filter((rule) => !alive.has(rule.id));
}
