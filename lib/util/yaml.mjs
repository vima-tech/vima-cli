// YAML 受限子集解析与序列化（internal-contracts §4）
// 子集范围：映射 k: v（2 空格缩进嵌套）；列表 "- item"（标量/内联对象/嵌套映射）；
// 内联数组 [a, b]；内联对象 { k: v }；标量 字符串/数字/true/false/null；
// 单双引号字符串；# 注释。不支持锚点/多行标量/多文档/Tab 缩进。
import { VimaError, EXIT } from './errors.mjs';

function parseError(lineNo, msg, path) {
  return new VimaError('YAML_PARSE', `第 ${lineNo} 行: ${msg}`, {
    path,
    exitCode: EXIT.CHECK_FAILED,
  });
}

function assertSafeKey(key, lineNo, path) {
  if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
    throw parseError(lineNo, `映射键 "${key}" 不允许使用`, path);
  }
}

// ---------------------------------------------------------------------------
// 解析
// ---------------------------------------------------------------------------

/**
 * 解析 YAML 子集文本。
 * @param {string} text
 * @param {{path?: string}} [opts] path 仅用于错误定位
 * @returns {*} 解析结果；空文档返回 null
 * @throws VimaError('YAML_PARSE', 消息含行号, {path})
 */
export function parseYaml(text, { path } = {}) {
  if (typeof text !== 'string') {
    throw new VimaError('YAML_PARSE', 'YAML 输入必须是字符串', { path, exitCode: EXIT.CHECK_FAILED });
  }
  const lines = toLines(text, path);
  if (lines.length === 0) return null;
  const state = { lines, pos: 0, path };
  const value = parseBlock(state, lines[0].indent);
  if (state.pos < state.lines.length) {
    const stray = state.lines[state.pos];
    throw parseError(stray.lineNo, `无法解析的行（缩进或结构错误）: "${stray.content}"`, path);
  }
  return value;
}

/** 词法：拆成 {indent, content, lineNo}，剔除空行/注释，去掉尾注释。 */
function toLines(text, path) {
  const rawLines = text.split('\n');
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    let raw = rawLines[i];
    if (raw.endsWith('\r')) raw = raw.slice(0, -1);
    const lineNo = i + 1;
    let indent = 0;
    while (indent < raw.length && raw[indent] === ' ') indent++;
    if (raw[indent] === '\t') throw parseError(lineNo, '不支持 Tab 缩进，请使用空格', path);
    const content = stripComment(raw.slice(indent), lineNo, path);
    if (content === '') continue;
    lines.push({ indent, content, lineNo });
  }
  return lines;
}

/**
 * 去掉尾部 # 注释并 trimEnd。
 * 引号只在「值可以开始的位置」（行首或 : , - [ { 之后）才视为字符串定界符，
 * 因此普通标量里的撇号（it's）不会误判为未闭合字符串。
 */
function stripComment(s, lineNo, path) {
  let quote = null;
  let prevNonWs = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote === "'") {
      if (ch === "'") {
        if (s[i + 1] === "'") i++; // '' 转义
        else quote = null;
      }
      continue;
    }
    if (quote === '"') {
      if (ch === '\\') i++;
      else if (ch === '"') quote = null;
      continue;
    }
    if ((ch === "'" || ch === '"') && (prevNonWs === '' || ':,-[{'.includes(prevNonWs))) {
      quote = ch;
      prevNonWs = ch;
      continue;
    }
    if (ch === '#' && (i === 0 || s[i - 1] === ' ' || s[i - 1] === '\t')) {
      return s.slice(0, i).trimEnd();
    }
    if (ch !== ' ' && ch !== '\t') prevNonWs = ch;
  }
  if (quote) throw parseError(lineNo, `字符串引号 ${quote} 未闭合`, path);
  return s.trimEnd();
}

function isSeqItem(content) {
  return content === '-' || content.startsWith('- ');
}

/** 解析一个块（由首行决定是列表、映射还是单个内联值）。 */
function parseBlock(state, indent) {
  const line = state.lines[state.pos];
  if (isSeqItem(line.content)) return parseSequence(state, indent);
  if (findMappingColon(line.content) === -1) {
    // 单行内联值文档（如 "{}" / "[a, b]" / 纯标量）
    state.pos++;
    return parseInlineValue(line.content, line.lineNo, state.path);
  }
  return parseMapping(state, indent);
}

function parseMapping(state, indent) {
  const obj = {};
  while (state.pos < state.lines.length) {
    const line = state.lines[state.pos];
    if (line.indent !== indent || isSeqItem(line.content)) break;
    const ci = findMappingColon(line.content);
    if (ci === -1) {
      throw parseError(line.lineNo, `期望 "key: value" 映射行: "${line.content}"`, state.path);
    }
    const key = parseKey(line.content.slice(0, ci), line.lineNo, state.path);
    assertSafeKey(key, line.lineNo, state.path);
    if (Object.hasOwn(obj, key)) {
      throw parseError(line.lineNo, `重复的键 "${key}"`, state.path);
    }
    const rest = line.content.slice(ci + 1).trim();
    state.pos++;
    if (rest !== '') {
      obj[key] = parseInlineValue(rest, line.lineNo, state.path);
    } else {
      const nxt = state.lines[state.pos];
      if (nxt && nxt.indent > indent) obj[key] = parseBlock(state, nxt.indent);
      else if (nxt && nxt.indent === indent && isSeqItem(nxt.content)) obj[key] = parseSequence(state, indent);
      else obj[key] = null;
    }
  }
  const nxt = state.lines[state.pos];
  if (nxt && nxt.indent > indent) {
    throw parseError(nxt.lineNo, `缩进错误: "${nxt.content}"`, state.path);
  }
  return obj;
}

function parseSequence(state, indent) {
  const arr = [];
  while (state.pos < state.lines.length) {
    const line = state.lines[state.pos];
    if (line.indent !== indent || !isSeqItem(line.content)) break;
    state.pos++;
    // "- " 之后允许多个空格；记录内容真实列号供嵌套映射对齐
    let restStart = 1;
    while (line.content[restStart] === ' ') restStart++;
    const rest = line.content.slice(restStart);
    if (rest === '') {
      // 裸 "-"：值在后续更深缩进的块里
      const nxt = state.lines[state.pos];
      if (nxt && nxt.indent > indent) arr.push(parseBlock(state, nxt.indent));
      else arr.push(null);
    } else if (findMappingColon(rest) !== -1 && !'{['.includes(rest[0])) {
      // 行内起头的映射项（- key: v）：回推为虚拟行，按映射解析（含后续同列续行）
      const itemIndent = line.indent + restStart;
      state.lines.splice(state.pos, 0, { indent: itemIndent, content: rest, lineNo: line.lineNo });
      arr.push(parseMapping(state, itemIndent));
    } else {
      arr.push(parseInlineValue(rest, line.lineNo, state.path));
    }
  }
  const nxt = state.lines[state.pos];
  if (nxt && nxt.indent > indent) {
    throw parseError(nxt.lineNo, `缩进错误: "${nxt.content}"`, state.path);
  }
  return arr;
}

/**
 * 找映射分隔冒号：深度 0、引号外、后跟空格或行尾的第一个 ":"。
 * 时间戳（10:00:00Z）、URL（http://x）里的冒号后无空格，不会误判。
 */
function findMappingColon(s) {
  let depth = 0;
  let quote = null;
  let prevNonWs = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote === "'") {
      if (ch === "'") {
        if (s[i + 1] === "'") i++;
        else quote = null;
      }
      continue;
    }
    if (quote === '"') {
      if (ch === '\\') i++;
      else if (ch === '"') quote = null;
      continue;
    }
    if ((ch === "'" || ch === '"') && (prevNonWs === '' || ':,-[{'.includes(prevNonWs))) {
      quote = ch;
      prevNonWs = ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') depth--;
    else if (ch === ':' && depth === 0 && (i + 1 === s.length || s[i + 1] === ' ')) return i;
    if (ch !== ' ' && ch !== '\t') prevNonWs = ch;
  }
  return -1;
}

function parseKey(raw, lineNo, path) {
  const k = raw.trim();
  if (k === '') throw parseError(lineNo, '映射键为空', path);
  if (k[0] === "'" || k[0] === '"') {
    const [str, end] = parseQuoted(k, 0, lineNo, path);
    if (k.slice(end).trim() !== '') throw parseError(lineNo, `键格式错误: "${raw.trim()}"`, path);
    return str;
  }
  return k;
}

/** 解析一段完整的内联值（行内 value / 列表项），值后不允许多余内容。 */
function parseInlineValue(s, lineNo, path) {
  const [value, end] = parseFlow(s, 0, lineNo, path, '');
  if (s.slice(end).trim() !== '') {
    throw parseError(lineNo, `值后存在多余内容: "${s.slice(end).trim()}"`, path);
  }
  return value;
}

/**
 * 流式解析一个值。stops 为纯标量的终止字符集：
 * 顶层为 ''（吃到行尾），数组元素为 ',]'，对象值为 ',}'。
 */
function parseFlow(s, pos, lineNo, path, stops) {
  pos = skipWs(s, pos);
  const ch = s[pos];
  if (ch === undefined) return [null, pos];

  if (ch === '[') {
    const arr = [];
    pos = skipWs(s, pos + 1);
    if (s[pos] === ']') return [arr, pos + 1];
    for (;;) {
      let value;
      [value, pos] = parseFlow(s, pos, lineNo, path, ',]');
      arr.push(value);
      pos = skipWs(s, pos);
      if (s[pos] === ',') {
        pos = skipWs(s, pos + 1);
        continue;
      }
      if (s[pos] === ']') return [arr, pos + 1];
      throw parseError(lineNo, '内联数组期望 "," 或 "]"', path);
    }
  }

  if (ch === '{') {
    const obj = {};
    pos = skipWs(s, pos + 1);
    if (s[pos] === '}') return [obj, pos + 1];
    for (;;) {
      // 键：引号键或读到冒号为止的普通键
      let key;
      if (s[pos] === "'" || s[pos] === '"') {
        [key, pos] = parseQuoted(s, pos, lineNo, path);
        pos = skipWs(s, pos);
      } else {
        let end = pos;
        while (end < s.length && !':,}'.includes(s[end])) end++;
        key = s.slice(pos, end).trim();
        pos = end;
      }
      if (s[pos] !== ':') throw parseError(lineNo, `内联对象的键 "${key}" 后缺少 ":"`, path);
      if (key === '') throw parseError(lineNo, '内联对象存在空键', path);
      assertSafeKey(key, lineNo, path);
      if (Object.hasOwn(obj, key)) throw parseError(lineNo, `重复的键 "${key}"`, path);
      let value;
      [value, pos] = parseFlow(s, pos + 1, lineNo, path, ',}');
      obj[key] = value;
      pos = skipWs(s, pos);
      if (s[pos] === ',') {
        pos = skipWs(s, pos + 1);
        continue;
      }
      if (s[pos] === '}') return [obj, pos + 1];
      throw parseError(lineNo, '内联对象期望 "," 或 "}"', path);
    }
  }

  if (ch === "'" || ch === '"') {
    return parseQuoted(s, pos, lineNo, path);
  }

  // 普通标量：吃到终止符（顶层吃到行尾），首尾空白剔除
  let end = pos;
  while (end < s.length && !stops.includes(s[end])) end++;
  return [parsePlainScalar(s.slice(pos, end).trim()), end];
}

function skipWs(s, pos) {
  while (pos < s.length && (s[pos] === ' ' || s[pos] === '\t')) pos++;
  return pos;
}

/** 解析引号字符串，返回 [值, 引号后的下标]。 */
function parseQuoted(s, pos, lineNo, path) {
  const quote = s[pos];
  let out = '';
  let i = pos + 1;
  while (i < s.length) {
    const ch = s[i];
    if (quote === "'") {
      if (ch === "'") {
        if (s[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        return [out, i + 1];
      }
      out += ch;
      i++;
      continue;
    }
    // 双引号
    if (ch === '\\') {
      const esc = s[i + 1];
      const map = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', 0: '\0' };
      if (esc === undefined) break;
      out += Object.hasOwn(map, esc) ? map[esc] : esc;
      i += 2;
      continue;
    }
    if (ch === '"') return [out, i + 1];
    out += ch;
    i++;
  }
  throw parseError(lineNo, `字符串引号 ${quote} 未闭合`, path);
}

const NUMBER_RE = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;

function parsePlainScalar(token) {
  if (token === '' || token === 'null' || token === '~') return null;
  if (token === 'true') return true;
  if (token === 'false') return false;
  if (NUMBER_RE.test(token)) return Number(token);
  return token;
}

// ---------------------------------------------------------------------------
// 序列化
// ---------------------------------------------------------------------------

/**
 * 序列化为同一 YAML 子集（块风格；空集合内联为 []/{}）。
 * 键保持输入顺序不排序；输出保证可被 parseYaml 回读（round-trip）。
 */
export function stringifyYaml(value) {
  const lines = [];
  writeBlock(value, 0, lines);
  return `${lines.join('\n')}\n`;
}

function stringifyError(msg) {
  return new VimaError('YAML_STRINGIFY', msg, {});
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function writeBlock(v, indent, lines) {
  if (isPlainObject(v) && Object.keys(v).length > 0) writeMapping(v, indent, lines);
  else if (Array.isArray(v) && v.length > 0) writeSequence(v, indent, lines);
  else lines.push(' '.repeat(indent) + inlineValue(v));
}

function writeMapping(obj, indent, lines) {
  const pad = ' '.repeat(indent);
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue; // undefined 键跳过（无法往返）
    const key = keyStr(k);
    if (isPlainObject(v) && Object.keys(v).length > 0) {
      lines.push(`${pad}${key}:`);
      writeMapping(v, indent + 2, lines);
    } else if (Array.isArray(v) && v.length > 0) {
      lines.push(`${pad}${key}:`);
      writeSequence(v, indent + 2, lines);
    } else {
      lines.push(`${pad}${key}: ${inlineValue(v)}`);
    }
  }
}

function writeSequence(arr, indent, lines) {
  const pad = ' '.repeat(indent);
  for (const item of arr) {
    if (isPlainObject(item) && Object.keys(item).length > 0) {
      // "- " 接首键行，续行与首键同列（indent + 2）
      const sub = [];
      writeMapping(item, indent + 2, sub);
      sub[0] = `${pad}- ${sub[0].slice(indent + 2)}`;
      lines.push(...sub);
    } else if (Array.isArray(item) && item.length > 0) {
      // 嵌套列表：裸 "-" + 更深缩进块
      lines.push(`${pad}-`);
      writeSequence(item, indent + 2, lines);
    } else {
      lines.push(`${pad}- ${inlineValue(item)}`);
    }
  }
}

/** 内联形式（用于标量与空集合；对非空集合递归生成流式写法）。 */
function inlineValue(v) {
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    return `[${v.map((x) => inlineValue(x)).join(', ')}]`;
  }
  if (isPlainObject(v)) {
    const entries = Object.entries(v).filter(([, x]) => x !== undefined);
    if (entries.length === 0) return '{}';
    return `{ ${entries.map(([k, x]) => `${keyStr(k)}: ${inlineValue(x)}`).join(', ')} }`;
  }
  return scalarStr(v, true);
}

function scalarStr(v, inFlow) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw stringifyError(`不支持非有限数字: ${v}`);
    return String(v);
  }
  if (typeof v === 'string') {
    return needsQuote(v, inFlow) ? JSON.stringify(v) : v;
  }
  throw stringifyError(`不支持的标量类型: ${typeof v}`);
}

function needsQuote(s, inFlow) {
  if (s === '') return true;
  if (/^\s|\s$/.test(s)) return true; // 首尾空白
  if (/[\n\r\t]/.test(s)) return true; // 控制字符
  if (s === 'true' || s === 'false' || s === 'null' || s === '~') return true;
  if (NUMBER_RE.test(s)) return true; // 形似数字的字符串
  if (/^[-?#&*!|>'"%@`{}[\],]/.test(s)) return true; // 起始特殊字符
  if (s.includes(': ') || s.endsWith(':')) return true; // 会被误判为映射
  if (s.includes(' #')) return true; // 会被截为注释
  if (inFlow && /[,[\]{}:]/.test(s)) return true; // 流式上下文中的结构字符
  return false;
}

function keyStr(k) {
  if (needsQuote(k, false) || k.includes(':') || k.includes('#')) return JSON.stringify(k);
  return k;
}
