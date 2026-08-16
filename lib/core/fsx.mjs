// 文件系统小工具。只用 node: 内建。
import { readdir, writeFile, rename, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/** 递归遍历，产出相对 dir 的 posix 风格路径。目录不存在则产出空。 */
export async function* walk(dir, { exclude = new Set() } = {}) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return;
    throw err;
  }
  for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (exclude.has(e.name)) continue;
    if (e.isDirectory()) {
      for await (const sub of walk(path.join(dir, e.name), { exclude })) {
        yield `${e.name}/${sub}`;
      }
    } else if (e.isFile()) {
      yield e.name;
    }
  }
}

/** 原子写。半截文件比没有文件更难查。 */
export async function atomicWrite(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, content, 'utf8');
  await rename(tmp, file);
}

/** 读 JSON，缺失返回 fallback，坏 JSON 返回 null（调用方决定怎么报）。 */
export async function readJson(file, fallback = undefined) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    return null;
  }
}

const unquote = (s) => s.trim().replace(/^['"]|['"]$/g, '');

/**
 * 极简 frontmatter 解析：`---` 包裹的 key: value。不引 YAML 依赖。
 *
 * 支持：`key: 标量` · `key: [行内, 数组]` · `key:` 后跟缩进 `- 块列表` · `#` 注释 · 空行。
 *
 * **读不懂的行进 `unparsed`，不再默默丢掉。** 这一条是被自己咬出来的：
 * 早先版本对不认识的行直接 `continue`，于是
 *   ```
 *   paths:
 *     - "apps/x/**\/*"
 *   ```
 *   解析成 `{ paths: '' }` —— 键在、值没了、不报错。而 `.claude/rules/` 的投影
 *   正是这么写的（官方文档就是块列表形态），也就是说**我们自己写出的文件，
 *   自己的解析器读回来是空的**，而且一路绿灯。
 *
 * 所以两件事一起做：块列表读得懂；仍然读不懂的，如实报出来让调用方决定炸不炸。
 * 调用方该不该容忍 unparsed，是调用方的判断——但「不知道有这回事」不该是选项。
 */
export function frontmatter(text) {
  // BOM 与 CRLF 先归一。不归一的话 `^---\n` 匹配不上 `﻿---` 或 `---\r\n`，
  // 整块 frontmatter 被当正文——data 为空、unparsed 也为空，下游的
  // RULE_UNKNOWN_KEY / RULE_UNPARSED 两道闸门**都不会触发**（它们防的是
  // 「读不懂的行」，不是「整块没被识别」）。后果正是 rules.mjs 反复警告的那个：
  // 一条 `side: wechat` 的规则静默变成处处生效。
  // .gitattributes 只管过 git 的文件；本地新建、Windows 编辑器、agent 写出的都不受它保护。
  text = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { data: {}, body: text, unparsed: [] };
  const data = {};
  const unparsed = [];
  const lines = m[1].split('\n');
  let listKey = null;   // 上一行是 `key:`（空值）时，后续缩进的 `- x` 归它

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const item = /^\s+-\s+(.*)$/.exec(raw);
    if (item) {
      if (listKey === null) { unparsed.push({ line: i + 1, text: raw }); continue; }
      data[listKey].push(unquote(item[1]));
      continue;
    }

    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(trimmed);
    if (!kv) { unparsed.push({ line: i + 1, text: raw }); listKey = null; continue; }

    const [, k, rawv] = kv;
    const v = rawv.trim();
    if (v === '') {
      // 可能是块列表的头，也可能就是个空值。先当列表开着，没有列表项就是空数组。
      data[k] = [];
      listKey = k;
      continue;
    }
    listKey = null;
    data[k] = (v.startsWith('[') && v.endsWith(']'))
      ? v.slice(1, -1).split(',').map(unquote).filter(Boolean)
      : unquote(v);
  }
  return { data, body: text.slice(m[0].length), unparsed };
}
