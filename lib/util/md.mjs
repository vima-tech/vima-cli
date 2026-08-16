// Markdown 工具：frontmatter 拆分 / vima 数据块提取 / 章节清单（internal-contracts §4）
import { VimaError, EXIT } from './errors.mjs';
import { parseYaml } from './yaml.mjs';

/**
 * 拆分文件头 frontmatter（--- 围栏，仅认文件第一行开始的围栏）。
 * @returns {{fm: string|null, body: string}} fm 为围栏内原始 YAML 文本（非空时以 \n 结尾）；
 *   无 frontmatter（或围栏未闭合）时 fm 为 null、body 为原文。
 */
export function splitFrontmatter(text) {
  const lines = text.split('\n');
  if ((lines[0] ?? '').replace(/\r$/, '') !== '---') return { fm: null, body: text };
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].replace(/\r$/, '') === '---') {
      const inner = lines.slice(1, i).join('\n');
      return { fm: inner === '' ? '' : `${inner}\n`, body: lines.slice(i + 1).join('\n') };
    }
  }
  return { fm: null, body: text };
}

// 围栏信息串：容忍 ``` 与 yaml、yaml 与 vima:、vima: 与 kind 之间的多余空格
const VIMA_INFO_RE = /^\s*yaml\s+vima:\s*([A-Za-z][\w-]*)\s*$/;

/**
 * 扫描 ```yaml vima:<kind> 围栏块。
 * @param {string} text
 * @param {string} [kind] 省略时返回全部 vima:* 块
 * @param {{path?: string}} [opts] path 用于解析失败时的文件定位（stderr 尾段）
 * @returns {Array<{kind: string, raw: string, data: *, line: number}>} line 为开栏行号（1 起）
 */
export function extractBlocks(text, kind, { path } = {}) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].replace(/\r$/, '').trimStart();
    if (!trimmed.startsWith('```')) continue;
    const openLine = i + 1;
    const info = trimmed.slice(3);
    const m = info.match(VIMA_INFO_RE);
    // 收集围栏内容直到闭合围栏（顺带跳过非 vima 围栏，避免内部 # 行干扰）
    let j = i + 1;
    const content = [];
    while (j < lines.length && lines[j].replace(/\r$/, '').trim() !== '```') {
      content.push(lines[j].replace(/\r$/, ''));
      j++;
    }
    if (m) {
      const blockKind = m[1];
      if (!kind || blockKind === kind) {
        const raw = content.length > 0 ? `${content.join('\n')}\n` : '';
        let data;
        try {
          data = parseYaml(raw, { path });
        } catch (err) {
          // 块内相对行号 → 文件绝对行号（块内容始于开栏行的下一行）：绝对 = 开栏行 + 相对行
          const detail = String(err.message).replace(
            /^第 (\d+) 行: /,
            (_, n) => `第 ${openLine + Number(n)} 行（块内第 ${n} 行）: `,
          );
          throw new VimaError(
            'YAML_PARSE',
            `vima:${blockKind} 块（第 ${openLine} 行开栏）: ${detail}`,
            { path: path ?? err.path, exitCode: EXIT.CHECK_FAILED },
          );
        }
        out.push({ kind: blockKind, raw, data, line: openLine });
      }
    }
    i = j; // 跳到闭合围栏行（未闭合时跳到文末，宽容处理）
  }
  return out;
}

/**
 * 列出标题行（只认行首 # 开头，忽略代码围栏内的假标题）。
 * @returns {Array<{level: number, title: string, line: number}>}
 */
export function listChapters(text) {
  const lines = text.split('\n');
  const out = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '');
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) out.push({ level: m[1].length, title: m[2], line: i + 1 });
  }
  return out;
}

/** 是否含有复选框（"- [ ]" 或 "- [x]"）。 */
export function hasCheckbox(text) {
  return /- \[[ xX]\]/.test(text);
}

/** 单行管道表格 → 单元格数组；`\|` 为转义竖线，不当分隔符。 */
function tableCells(row) {
  const cells = [];
  let current = '';
  const inner = row.slice(1, -1);
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\' && inner[i + 1] === '|') {
      current += '|';
      i++;
    } else if (inner[i] === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += inner[i];
    }
  }
  cells.push(current.trim());
  return cells;
}

const TABLE_SEPARATOR_CELL = /^:?-{3,}:?$/;

/**
 * 把 markdown 文本切成**逐张**管道表格（A44 D-A44-02）。
 *
 * 表边界由**分隔行**识别：紧邻分隔行之前的那一行即该表表头。此前 `validate` 的实现
 * 把全文件所有 `|…|` 行当成一张表（首个非分隔行当表头，其余一律是数据行），
 * 于是一份含两张表的文件会整片报「列数与表头不一致」——覆盖矩阵要加第二张表
 * （业务规则承接），必须先修掉这个假设。
 *
 * 不参与 `|…|` 收集的行（空行、标题、正文）天然被丢弃，故两表之间是否留空行不影响切分。
 * 无分隔行的孤立管道行不构成表，整体忽略（宁可不判，不制造假错误）。
 *
 * @param {string} text
 * @returns {Array<{header: string[], rows: string[][]}>} 按出现顺序
 */
export function splitMarkdownTables(text) {
  const pipeRows = text.split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.endsWith('|'));

  const tables = [];
  let prev = null;   // 上一行的单元格（尚不知道它是数据行还是下一张表的表头）
  let current = null;
  for (const row of pipeRows) {
    const cells = tableCells(row);
    if (cells.every((c) => TABLE_SEPARATOR_CELL.test(c))) {
      // 分隔行：它上面那行才是新表表头。该行此前已被乐观地记进上一张表的数据行，
      // 此刻取回来——表头只有见到分隔行才能确认，无法在读到它时就判定。
      const header = current !== null && current.rows.length > 0 ? current.rows.pop() : prev;
      current = header === null ? null : { header, rows: [] };
      if (current !== null) tables.push(current);
      prev = null;
      continue;
    }
    if (current !== null) current.rows.push(cells);
    prev = cells;
  }
  return tables;
}
