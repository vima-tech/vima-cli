// docs/ 的 markdown → 编译批次。
//
// ─────────────────────────────────────────────────────────────────────────
// 为什么必须有这个模块
//
// 设计里写死了一句话：**docs/ 的 markdown 是唯一真源，命题是它的投影**
// （docs/README.md、vima-intake 规程、init 后的下一步提示，三处都这么说）。
// 而重写第一版里没人实现从 markdown 到批次这一段，compile 只吃 JSON。
// 后果不是「少个便利功能」：
//
//   · 三处指引在教一条走不通的路——产品对使用者撒谎，这是 C1 要治的病本身；
//   · 要么改成让 agent 手写批次 JSON，那 markdown 就退化成装饰，
//     同一批命题有了两个真源——正是这套系统存在的理由要消灭的东西。
//
// 所以 markdown 必须是能编译的那一份。
//
// 格式的第一原则：**常见情形是纯散文。** 一条命题绝大多数时候只需要
// 「id + 一句话」，层/可信度/门槛/上游都从文件头继承。属性只在例外时出现。
// 一旦常规写法就要挂五个键，人会绕开它去手写 JSON，然后真源又变回两份。
//
// 刻意不做：不引 YAML/markdown 库（core/fsx.mjs 的极简 frontmatter 够用），
// 不支持嵌套结构，不做 include。格式复杂一分，agent 写错的概率就高一分，
// 而写错的代价是命题静默缺失——比报错难发现得多。
// ─────────────────────────────────────────────────────────────────────────
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { LAYERS } from '../core/claims.mjs';
import { walk, frontmatter } from '../core/fsx.mjs';
import { CLAIM_ID } from './compile.mjs';

/**
 * 命题条目：列表项，反引号包住 id，其后是陈述。缩进 0–1 空格算顶层条目。
 *
 * id 的捕获**故意放宽**成「反引号里的任何非反引号内容」，合法性单独判——
 * 这里曾把 CLAIM_ID 的字符类内联进正则：`login_remember`（下划线）这类
 * 不合法 id **整行匹配失败**，被当成散文静默跳过。同一条准入判据，
 * JSON 路（compile）逐条拒且写明理由，markdown 路一声不吭——
 * 而 markdown 是唯一真源，它的静默率决定整个系统的入账完整性。
 * v3 的同款：「检查正则只认带引号的，于是误以为这些模块没有权限点」。
 */
const ITEM = /^[ ]{0,1}[-*][ ]+`([^`]+)`[ ]+(.+?)[ ]*$/;

/** 属性行：命题条目下缩进两格以上的列表项，`键: 值`。中英文冒号都收。 */
const ATTR = /^[ ]{2,}[-*][ ]+([a-zA-Z][a-zA-Z.]*)[ ]*[:：][ ]*(.+?)[ ]*$/;

/** 只有这些键可写。写错当场报，不静默忽略——被忽略的 `needs:` 会让门槛悄悄降到默认值。 */
const ATTR_KEYS = new Set([
  'trust', 'need', 'from', 'source', 'impl', 'policy',
  'ruling.question', 'ruling.chosen', 'ruling.options',
  'ruling.rationale', 'ruling.confidence', 'ruling.blastRadius',
]);

/** 文件头允许的键。同理，不容忍未知键。 */
const HEAD_KEYS = new Set(['layer', 'upstream', 'trust', 'need', 'source']);

/** 逗号分隔的列表值。中英文逗号与顿号都收——物料多半是人顺手写的。 */
function list(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v ?? '').split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
}

/**
 * 解析一份规格 markdown → 一个编译批次。
 *
 * → { layer, upstream, items, source } | null（没有 layer 头的文件不是规格，跳过）
 * 解析不了的地方抛 SpecError，带文件名与行号——规格写错要当场看见，
 * 不能变成「这条命题怎么没编出来」的哑谜。
 */
export function parseSpec(text, file = '(inline)') {
  const { data, body, unparsed } = frontmatter(text);
  if (!data || !data.layer) return null;
  // 文件头有读不懂的行 → 炸。规格文件头里被吞掉的一行可能是 `upstream:`，
  // 那会让整批命题变成「说不出出处」而被拒，人却只看见一堆莫名其妙的拒绝理由。
  if (unparsed.length) {
    throw specError(file, unparsed[0].line,
      `文件头这行读不懂：${JSON.stringify(unparsed[0].text.trim())}——只支持 \`键: 值\`、行内数组、缩进的 \`- 列表项\``);
  }
  // 报错要指到源文件的真实行号，所以得把文件头吃掉的行数补回来。
  // fsx.frontmatter 不返回它，也不该为这一个调用方去改共享签名。
  const offset = countLines(text) - countLines(body);

  for (const k of Object.keys(data)) {
    if (!HEAD_KEYS.has(k)) throw specError(file, 0, `文件头有未知键 ${k}（只允许 ${[...HEAD_KEYS].join('/')}）`);
  }
  const layer = String(data.layer).trim();
  if (!LAYERS.includes(layer)) {
    throw specError(file, 0, `layer '${layer}' 不合法（合法：${LAYERS.join(' → ')}）`);
  }

  const items = [];
  let current = null;
  let fence = null;
  const lines = body.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNo = offset + i + 1;

    // 代码围栏里的内容一律不算命题。**这不是可选的**：格式说明本身要拿围栏举例，
    // 不跳过的话「示例」会被真的编成命题——写这份模板时当场撞上了。
    const f = /^\s*(```+|~~~+)/.exec(raw);
    if (f) {
      if (fence == null) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      continue;
    }
    if (fence != null) continue;

    const m = ITEM.exec(raw);
    if (m) {
      // 判据在 compile.CLAIM_ID，不在这里复制第六份（此前全仓已有五份同款字符类）
      if (!CLAIM_ID.test(m[1])) {
        throw specError(file, lineNo,
          `命题 id \`${m[1]}\` 不合法（必须匹配 ${CLAIM_ID}，小写字母数字连字符）`
          + '——不合法的 id 永远不可能被代码里的 @vima 标注命中');
      }
      current = { id: m[1], statement: m[2].trim() };
      // 文件头的缺省值在这里落到每条上。落在这里而不是留给 compile，
      // 是因为 compile 的入参是「已经说清楚的批次」——继承是 markdown 这一层的事。
      if (data.trust != null) current.trust = String(data.trust).trim();
      if (data.need != null) current.need = String(data.need).trim();
      if (data.source != null) current.source = String(data.source).trim();
      items.push(current);
      continue;
    }

    const a = ATTR.exec(raw);
    if (a) {
      if (!current) throw specError(file, lineNo, `属性 ${a[1]} 上面没有命题条目`);
      if (!ATTR_KEYS.has(a[1])) {
        throw specError(file, lineNo, `未知属性 ${a[1]}（只允许 ${[...ATTR_KEYS].join(' / ')}）`);
      }
      applyAttr(current, a[1], a[2]);
      continue;
    }

    // 非列表行 = 章节正文（背景说明）。背景不是命题，正常跳过；
    // 但它同时结束当前条目的属性块，否则下一段里的 `键: 值` 会被误吸进来。
    if (raw.trim() !== '') current = null;
  }

  const batch = { layer, items };
  if (data.upstream != null) batch.upstream = list(data.upstream);
  return batch;
}

function applyAttr(item, key, value) {
  if (key === 'from' || key === 'impl') { item[key] = list(value); return; }
  if (key === 'ruling.options' || key === 'ruling.blastRadius') {
    item.ruling ??= {};
    item.ruling[key.slice(7)] = list(value);
    return;
  }
  if (key.startsWith('ruling.')) {
    item.ruling ??= {};
    item.ruling[key.slice(7)] = value;
    return;
  }
  item[key] = value;
}

/**
 * 读一棵 docs/ 树，产出**按层排好序**的批次。
 *
 * 排序不是为了好看：compile 校验上游必须已在事件流里，spec 批次若先于 intent
 * 写入就会整批被拒。顺序错了表现为「命题莫名其妙编不进去」，而根因在调用顺序上，
 * 极难反查——所以顺序由这里定死，不交给调用方或文件名。
 *
 * 同层多文件按路径排序，保证同样的 docs/ 每次编出同样的结果（可 diff，C3）。
 */
export async function readSpecs(dir) {
  const found = [];
  const skipped = [];
  for await (const rel of walk(dir)) {
    if (!rel.endsWith('.md')) continue;
    // raw/ 是原始物料，不是规格。没有 layer 头本来也会被跳过，
    // 但显式排除更清楚，也省得有人在纪要里顺手写个 layer 就被当规格编了。
    if (rel.startsWith('raw/')) continue;
    const file = path.join(dir, ...rel.split('/'));
    const batch = parseSpec(await readFile(file, 'utf8'), rel);
    if (batch) found.push({ rel, batch });
    else skipped.push(rel);
  }
  found.sort((a, b) => {
    const d = LAYERS.indexOf(a.batch.layer) - LAYERS.indexOf(b.batch.layer);
    return d !== 0 ? d : a.rel.localeCompare(b.rel);
  });
  return { batches: found, skipped };
}

export class SpecError extends Error {
  constructor(message, file, line) {
    super(message);
    this.name = 'SpecError';
    this.code = 'SPEC_PARSE';
    this.file = file;
    this.line = line;
  }
}

function countLines(s) {
  let n = 1;
  for (let i = 0; i < s.length; i++) if (s[i] === '\n') n++;
  return n;
}

function specError(file, line, msg) {
  return new SpecError(`${file}${line ? `:${line}` : ''} ${msg}`, file, line);
}
