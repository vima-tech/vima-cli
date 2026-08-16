// 从代码里提取事实 —— 全系统**唯一**的一处。
//
// ─────────────────────────────────────────────────────────────────────────
// 为什么这个模块单独存在、且所有代码事实必须经它
//
// 上一代在这件事上连续漂移了三次，每次都是同一个病换个位置：
//   ① 同一条正则有三份拷贝（validate / converge / traceability），都停在会被
//      嵌套泛型截断的旧写法。实测 281 个调用点里 216 个（77%）被静默跳过，
//      而两条规则都显示通过——最危险的那种绿。
//   ② 收成一份常量后数字仍然打架：一处逐行扫、两处按全文扫，而真实代码里
//      泛型一长就被格式化器折行。同一事实两个数字。
//   ③ 文档注释里教「别这么写」的反例被当成真实调用，报 error。
//
// 结论不是「把正则写对」，是**判据的实现与用法必须一起收口**：
// 正则、扫描方式、注释处理、行号换算，四件事在同一个函数里，
// 调用方只能拿结果，不能自己造扫描器。
//
// 另一条：本模块是**日后换 AST 的唯一改动点**。现在用正则是权衡后的选择
// （零依赖、够用），但它的能力边界是实在的——文件级归属、判不到具体符号。
// 换 tree-sitter 时只改这里，上游全部无感。**不要把提取逻辑泄漏到别处。**
// ─────────────────────────────────────────────────────────────────────────
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { walk } from './fsx.mjs';

/** 参与扫描的文件类型。加一个端的 kind 就要加它的产物形态——上一代漏了小程序三件套，
 *  导致该端标注一条都扫不到，整端代码级追溯静默失效。 */
export const SCAN_EXTS = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.vue', '.java', '.wxml', '.wxss', '.wxs',
]);

const EXCLUDE = new Set(['node_modules', 'dist', 'build', 'target', 'vendor', '.git', '.vima']);

/** 注释行判据：去空白后以这些开头。真实调用不会写在注释行上；
 *  跨行调用的匹配又总起始于方法名那一行，故零假阴性。 */
const COMMENT_LINE = /^\s*(?:\/\/|\/?\*|<!--|#)/;

/** 命题标注：`@vima <claimId>`，把代码与命题连起来（实现边）。 */
const MARK = /@vima\s+([a-z0-9][a-z0-9-]*)/g;

/** 前端请求门面调用。泛型段排除括号而非 `>`——嵌套泛型里有内层 `>`。 */
const FE_CALL = String.raw`\brequest\s*\.\s*(get|post|put|delete|patch)\s*(?:<[^()]*?>)?\s*\(\s*(['"\`])([^'"\`\n]*)\2`;

/** 后端路由注解（Spring 家族）。 */
const BE_BASE = /@RequestMapping\s*\(([^)]*)\)/;
const BE_METHOD = /@(Get|Post|Put|Delete|Patch)Mapping\s*(?:\(([^)]*)\))?/g;

/** 行号定位：全文匹配下标 → 1 起的行号。前缀行首表 + 二分。 */
function lineLocator(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return {
    at(index) {
      let lo = 0; let hi = starts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= index) lo = mid; else hi = mid - 1;
      }
      return { line: lo + 1, start: starts[lo], end: starts[lo + 1] ?? text.length };
    },
  };
}

/** 路径参数归一：契约 `{id}` 与模板串 `${expr}` 都归一成 `{*}` 再比对。 */
export function normalizePath(p) {
  return String(p ?? '').replace(/\$\{[^}]*\}/g, '{*}').replace(/\{[^}]*\}/g, '{*}');
}

/** 端点键：method 大写 + 归一路径。非 /api 开头补前缀（request baseURL 是 /api）。 */
export function endpointKey(method, rawPath) {
  const p = String(rawPath ?? '');
  const full = p === '/api' || p.startsWith('/api/') ? p : `/api${p.startsWith('/') ? '' : '/'}${p}`;
  return `${String(method).toUpperCase()} ${normalizePath(full)}`;
}

/**
 * 扫一段源码里的全部前端请求调用。
 * 正则 + 全文扫 + 跳注释行 + 行号，四件事在这里一起做完。
 */
export function scanCalls(text) {
  const re = new RegExp(FE_CALL, 'g');
  const loc = lineLocator(text);
  const out = [];
  for (const m of text.matchAll(re)) {
    const { line, start, end } = loc.at(m.index);
    if (COMMENT_LINE.test(text.slice(start, end))) continue;
    out.push({ key: endpointKey(m[1], m[3]), line });
  }
  return out;
}

/**
 * 扫后端路由实现。类级基路径 + 方法级子路径拼接。
 *
 * **与 scanCalls 共用 endpointKey 归一**——这一点不能省。Spring 常见写法是
 * context-path 配 `/api`、控制器只写 `@RequestMapping("/users")`，而前端调用
 * 写的是 `/users`（request baseURL 已是 /api）。两侧若各自归一，同一个端点会
 * 算出两个键，闭合对账当场假阳性。
 *
 * 这条本来是被 ops/audit 在下游「比对前统一过一遍」兜住的——能用，但那样
 * 「端点键怎么算」就有了第二处实现。判据只能有一处，所以收回源头。
 */
export function scanRoutes(text) {
  const baseM = BE_BASE.exec(text);
  const base = baseM ? mappingPath(baseM[1]) : '';
  const loc = lineLocator(text);
  const out = [];
  for (const m of text.matchAll(BE_METHOD)) {
    const { line, start, end } = loc.at(m.index);
    if (COMMENT_LINE.test(text.slice(start, end))) continue;
    const sub = mappingPath(m[2]);
    const full = sub ? `${base}${sub}` : base;
    if (!full) continue;
    out.push({ key: endpointKey(m[1], full), line });
  }
  return out;
}

function mappingPath(inner) {
  if (!inner) return '';
  let m = /(?:value|path)\s*=\s*"([^"]*)"/.exec(inner);
  if (m) return m[1];
  m = /^\s*"([^"]*)"/.exec(inner);
  return m ? m[1] : '';
}

/** 扫命题标注。注释行**不跳过**——标注本来就写在注释里。 */
export function scanMarks(text) {
  const loc = lineLocator(text);
  const out = [];
  for (const m of text.matchAll(MARK)) out.push({ claimId: m[1], line: loc.at(m.index).line });
  return out;
}

/**
 * 扫整个代码目录，一次遍历产出三类事实。
 * 分三次扫会让大仓库明显变慢——上一代实测 886 个文件每条命令重扫一遍。
 */
export async function scanTree(root, dirs) {
  const marks = [];   // { claimId, file, line }
  const calls = [];   // { key, file, line }
  const routes = [];  // { key, file, line }
  const files = [];

  for (const dir of dirs) {
    const abs = path.join(root, ...dir.split('/'));
    for await (const rel of walk(abs, { exclude: EXCLUDE })) {
      if (!SCAN_EXTS.has(path.extname(rel))) continue;
      const fileRel = `${dir}/${rel}`;
      const text = await readFile(path.join(abs, ...rel.split('/')), 'utf8');
      files.push(fileRel);
      for (const m of scanMarks(text)) marks.push({ ...m, file: fileRel });
      // 闭合事实（调用/路由）扫**全部**文件，不按标注门控。
      //
      // 这里曾经写着 `if (!MARK.test(text)) continue`，理由是「无标注即底座/
      // 共享层，天然不参与」——那个理由只对**归属**成立（标注连的是命题），
      // 对**闭合**不成立：一个真实的 `request.get('/beta')` 不因为文件没写
      // @vima 就不存在。门控的实测后果两个方向都错：
      //   假红  路由实现在未标注文件里 → endpoint-unimplemented（error，挡交付）
      //   假绿  未标注文件里的调用永远不进对账，call-unserved 永不为它发声
      // 而报告还写着「扫描 N 个文件」——读的人以为 N 个都判过了。
      // 与「281 个调用点静默跳过 216 个而规则全绿」是同一个病，换了个门。
      for (const c of scanCalls(text)) calls.push({ ...c, file: fileRel });
      if (fileRel.endsWith('.java')) for (const r of scanRoutes(text)) routes.push({ ...r, file: fileRel });
    }
  }
  return { marks, calls, routes, files };
}

/** 提取能力的自陈边界——审计报告要如实呈现，不能让人以为它无所不知。 */
export const CAPABILITY = Object.freeze({
  engine: 'regex',
  granularity: 'file',    // 归属只到文件级，判不到具体符号
  knows: ['@vima 标注', '前端请求调用', '后端路由注解'],
  blind: ['import 图', '符号级归属', '控制流', '类型信息'],
  upgradePath: 'lib/core/extract.mjs 是唯一改动点；换 AST 后 granularity 升到 symbol',
});
