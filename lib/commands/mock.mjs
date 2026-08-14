// vima mock —— 契约驱动的确定性 mock 生成（A27，契约 §6.16 / §14）
//
// 从 docs/contracts/*.md 机读块生成 .vima/mock/contract-mock.json，供三个消费方：
// admin 骨架的 vite `/__vima/mock` 中间件与 request 层 demo 分支、h5 骨架 demo 分支、
// scripts/layout-smoke.mjs 的页面数据来源。
//
// 立场（契约 §14）：**mock 必须由契约生成不得手写**——手写 mock = 第二份契约 = 必然漂移。
// 相对一切外部原型工具的决定性优势正在于此：假数据的字段名与真实接口一字不差。
//
// 确定性铁律：8 种字段类型 8 条固定规则，零随机零时间戳；stableStringify + atomicWriteFile
// ——同输入同字节（验收判据：连跑两次同哈希）。
//
// 数据量四档（§6.16）：default 3 行 / empty 0 行 / many 20 行 / long 1 行超长文本。
// 「空列表」与「极端长文本」恰是暴露版面缺陷最有效的两档——列表 3 条与 3000 条的
// 版面表现完全不同，正常数据反而最不容易暴露问题。
import path from 'node:path';
import { parseArgs } from 'node:util';
import { EXIT, precondition, usageFromParseArgs } from '../util/errors.mjs';
import { atomicWriteFile, stableStringify } from '../util/fs.mjs';
import { loadContracts } from '../model/contracts.mjs';

const OUT_REL = '.vima/mock/contract-mock.json';

/** 超长文本基元：定长确定性串（>120 字），long 档的 string 字段取它。 */
const LONG_TEXT =
  '这是一段用于版面冒烟的超长文本样例，用来暴露截断缺失、容器溢出与换行异常等版面缺陷——'.repeat(3) +
  '长文本档位的价值恰在于此。';

/**
 * 单字段取样（契约 §6.16 的 8 条规则；i 为行号，1 起）。
 * json/object 有 fields 子结构（A22）时按子字段递归，否则空对象。
 */
export function sampleField(field, i, { long = false } = {}) {
  const type = String(field?.type ?? 'string');
  const name = String(field?.name ?? 'field');
  if (type === 'number') return i;
  if (type === 'boolean') return i % 2 === 0;
  if (type === 'date') return `2026-01-${String(i).padStart(2, '0')}`;
  if (type === 'datetime') return `2026-01-${String(i).padStart(2, '0')}T08:00:00Z`;
  if (type === 'array') return [];
  if (type === 'object' || type === 'json') {
    const sub = Array.isArray(field?.fields) ? field.fields : [];
    if (sub.length === 0) return {};
    const out = {};
    for (const f of sub) out[String(f?.name ?? 'field')] = sampleField(f, i, { long });
    return out;
  }
  // string（及未知类型按 string 兜底——契约词表之外的类型不猜语义）
  return long ? LONG_TEXT : `${name}_${i}`;
}

/** 由 response 字段列表取一行样本对象。 */
export function sampleRow(response, i, opts = {}) {
  const out = {};
  for (const f of Array.isArray(response) ? response : []) {
    out[String(f?.name ?? 'field')] = sampleField(f, i, opts);
  }
  return out;
}

/** 分页判定：**只看契约声明**（request 里有 pageNum 或 pageSize 字段），不做路径启发。 */
function isPaginated(api) {
  const names = new Set((Array.isArray(api.request) ? api.request : []).map((f) => String(f?.name ?? '')));
  return names.has('pageNum') || names.has('pageSize');
}

/** 一个 api 的四档数据集（契约 §6.16）。 */
export function datasetsOf(api) {
  const method = String(api?.method ?? '').toUpperCase();
  const response = Array.isArray(api?.response) ? api.response : [];
  const paged = method === 'GET' && isPaginated(api);
  if (paged) {
    const page = (n, opts = {}) => ({
      records: Array.from({ length: n }, (_, k) => sampleRow(response, k + 1, opts)),
      total: n,
      pageNum: 1,
      pageSize: n === 0 ? 10 : n,
    });
    return { default: page(3), empty: page(0), many: page(20), long: page(1, { long: true }) };
  }
  // 非分页（GET 详情与全部写操作）：单对象；long 档换超长文本，其余同一份样本
  const one = sampleRow(response, 1);
  return { default: one, empty: one, many: one, long: sampleRow(response, 1, { long: true }) };
}

export async function run(argv, ctx) {
  try {
    parseArgs({ args: argv, options: {}, allowPositionals: false });
  } catch (err) {
    throw usageFromParseArgs(err);
  }
  const root = ctx.cwd;
  const contracts = await loadContracts(root);
  const apis = [];
  for (const c of contracts) {
    for (const a of c.apis ?? []) {
      apis.push({
        method: String(a.method ?? '').toUpperCase(),
        path: String(a.path ?? ''),
        datasets: datasetsOf(a),
      });
    }
  }
  if (apis.length === 0) {
    throw precondition(
      'NO_CONTRACTS',
      '缺 docs/contracts/ 目录或机读块里没有任何接口——mock 由契约生成，无契约即无可 mock',
      path.join(root, 'docs', 'contracts'),
    );
  }
  // apis 按 (method, path) 排序：数组顺序是 stableStringify 管不到的，自己保证字节稳定
  apis.sort((a, b) => (a.method < b.method ? -1 : a.method > b.method ? 1 : a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const outAbs = path.join(root, OUT_REL);
  await atomicWriteFile(outAbs, stableStringify({ schemaVersion: '1', apis }));
  process.stdout.write(
    `✅ 契约 mock 已生成: ${OUT_REL}（接口 ${apis.length} × 四档数据量 default/empty/many/long）\n` +
      '消费方：demo 态 request 分支（?__mock= 切档）、/__vima/mock 中间件、layout-smoke 探针。\n' +
      '真源是 docs/contracts/ —— 契约变更后重跑 vima mock，不要手改本文件。\n',
  );
  return EXIT.OK;
}
