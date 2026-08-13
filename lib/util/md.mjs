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
