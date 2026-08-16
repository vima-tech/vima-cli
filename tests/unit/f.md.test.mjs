// F 单测：lib/util/md.mjs —— frontmatter 拆分 / vima 数据块提取 / 章节清单 / 复选框
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitFrontmatter, extractBlocks, listChapters, hasCheckbox, splitMarkdownTables } from '../../lib/util/md.mjs';
import { VimaError } from '../../lib/util/errors.mjs';

// ---------------------------------------------------------------------------
// splitFrontmatter
// ---------------------------------------------------------------------------

test('splitFrontmatter：正常拆分并保留 body 原文', () => {
  const text = '---\ntaskId: a\nstatus: pending\n---\n\n# 标题\n\n正文';
  const { fm, body } = splitFrontmatter(text);
  assert.equal(fm, 'taskId: a\nstatus: pending\n');
  assert.equal(body, '\n# 标题\n\n正文');
  // 可无损重组
  assert.equal(`---\n${fm}---\n${body}`, text);
});

test('splitFrontmatter：无 frontmatter 时 fm 为 null', () => {
  const text = '# 直接是正文\n---\n不是文件头围栏\n---\n';
  assert.deepEqual(splitFrontmatter(text), { fm: null, body: text });
});

test('splitFrontmatter：围栏未闭合视为无 frontmatter', () => {
  const text = '---\ntaskId: a\n正文没有闭合围栏';
  assert.deepEqual(splitFrontmatter(text), { fm: null, body: text });
});

test('splitFrontmatter：空 frontmatter', () => {
  const { fm, body } = splitFrontmatter('---\n---\nbody');
  assert.equal(fm, '');
  assert.equal(body, 'body');
});

// ---------------------------------------------------------------------------
// extractBlocks
// ---------------------------------------------------------------------------

const SAMPLE = [
  '# 规格',
  '',
  '```yaml vima:entities',
  'entities:',
  '  - name: Device',
  '    fields:',
  '      - { name: id, type: number, required: true }',
  '```',
  '',
  '普通代码块（应被忽略且不干扰扫描）：',
  '',
  '```js',
  'const x = 1; // vima:page 假块',
  '# 不是标题',
  '```',
  '',
  '``` yaml   vima:page ',
  'id: PAGE-01',
  'title: 设备列表',
  'apis: [GET /api/device/list]',
  '```',
  '',
  '```yaml vima:page',
  'id: PAGE-02',
  'title: 设备详情',
  '```',
].join('\n');

test('extractBlocks：按 kind 过滤并解析 data', () => {
  const pages = extractBlocks(SAMPLE, 'page');
  assert.equal(pages.length, 2);
  assert.equal(pages[0].kind, 'page');
  assert.equal(pages[0].data.id, 'PAGE-01');
  assert.deepEqual(pages[0].data.apis, ['GET /api/device/list']);
  assert.equal(pages[1].data.id, 'PAGE-02');
});

test('extractBlocks：省略 kind 返回全部 vima:* 块（含正确行号）', () => {
  const all = extractBlocks(SAMPLE);
  assert.deepEqual(all.map((b) => b.kind), ['entities', 'page', 'page']);
  assert.equal(all[0].line, 3); // 开栏行号（1 起）
  assert.equal(all[1].line, 17);
  assert.equal(all[2].line, 23);
  assert.equal(all[0].data.entities[0].name, 'Device');
});

test('extractBlocks：raw 为围栏内原文', () => {
  const [entities] = extractBlocks(SAMPLE, 'entities');
  assert.equal(
    entities.raw,
    'entities:\n  - name: Device\n    fields:\n      - { name: id, type: number, required: true }\n',
  );
});

test('extractBlocks：容忍围栏信息串中多余空格', () => {
  const variants = [
    '```yaml vima:flow',
    '``` yaml vima:flow',
    '```  yaml   vima:flow  ',
    '```yaml vima: flow',
  ];
  for (const open of variants) {
    const blocks = extractBlocks(`${open}\nid: FLOW-01\n\`\`\`\n`, 'flow');
    assert.equal(blocks.length, 1, `未识别开栏: "${open}"`);
    assert.deepEqual(blocks[0].data, { id: 'FLOW-01' });
  }
});

test('extractBlocks：非 vima 围栏与不匹配 kind 均忽略', () => {
  assert.deepEqual(extractBlocks(SAMPLE, 'contract'), []);
  assert.deepEqual(extractBlocks('```yaml\nk: v\n```\n'), []);
  assert.deepEqual(extractBlocks('```json vima:page\n{}\n```\n'), []);
});

test('extractBlocks：块内 YAML 语法错误抛 VimaError 并标注开栏行', () => {
  const text = '# 头\n\n```yaml vima:page\nid: [未闭合\n```\n';
  let err = null;
  try {
    extractBlocks(text, 'page');
  } catch (e) {
    err = e;
  }
  assert.ok(err instanceof VimaError);
  assert.equal(err.code, 'YAML_PARSE');
  assert.match(err.message, /第 3 行开栏/);
  assert.match(err.message, /第 1 行/); // 块内相对行号
});

// ---------------------------------------------------------------------------
// listChapters
// ---------------------------------------------------------------------------

test('listChapters：只认 # 开头标题行，忽略围栏内的', () => {
  const text = [
    '# 一级标题',
    '正文 # 不是标题',
    '## 2. 数据模型',
    '```bash',
    '# 围栏里的注释不是标题',
    'echo hi',
    '```',
    '### 深层标题',
    '#无空格不算标题',
    '  ## 缩进的不算（非行首）',
  ].join('\n');
  assert.deepEqual(listChapters(text), [
    { level: 1, title: '一级标题', line: 1 },
    { level: 2, title: '2. 数据模型', line: 3 },
    { level: 3, title: '深层标题', line: 8 },
  ]);
});

// ---------------------------------------------------------------------------
// hasCheckbox
// ---------------------------------------------------------------------------

test('hasCheckbox：识别未勾选与已勾选', () => {
  assert.equal(hasCheckbox('## 验收清单\n\n- [ ] 列表页可分页'), true);
  assert.equal(hasCheckbox('- [x] 已完成项'), true);
  assert.equal(hasCheckbox('- 普通列表项\n[链接](x)'), false);
  assert.equal(hasCheckbox(''), false);
});

// ---------------------------------------------------------------------------
// splitMarkdownTables（A44 D-A44-02）
// ---------------------------------------------------------------------------

test('splitMarkdownTables：两张表各自独立，列数不同也不互相污染', () => {
  const text = [
    '## 甲', '',
    '| A | B | C |', '|---|---|---|', '| 1 | 2 | 3 |', '| 4 | 5 | 6 |', '',
    '合计：2 行。', '',
    '## 乙', '',
    '| X | Y |', '|---|---|', '| 7 | 8 |', '',
  ].join('\n');
  const tables = splitMarkdownTables(text);
  assert.equal(tables.length, 2);
  assert.deepEqual(tables[0].header, ['A', 'B', 'C']);
  assert.deepEqual(tables[0].rows, [['1', '2', '3'], ['4', '5', '6']], '第二张表的表头不得混进第一张的数据行');
  assert.deepEqual(tables[1].header, ['X', 'Y']);
  assert.deepEqual(tables[1].rows, [['7', '8']]);
});

test('splitMarkdownTables：两表之间没有空行也能正确切分（边界靠分隔行识别）', () => {
  const text = '| A | B |\n|---|---|\n| 1 | 2 |\n| X | Y |\n|---|---|\n| 7 | 8 |';
  const tables = splitMarkdownTables(text);
  assert.equal(tables.length, 2);
  assert.deepEqual(tables[0].rows, [['1', '2']]);
  assert.deepEqual(tables[1].header, ['X', 'Y']);
  assert.deepEqual(tables[1].rows, [['7', '8']]);
});

test('splitMarkdownTables：转义竖线属于单元格内容，不当分隔符', () => {
  const tables = splitMarkdownTables('| A | B |\n|---|---|\n| a \\| b | c |');
  assert.deepEqual(tables[0].rows, [['a | b', 'c']]);
});

test('splitMarkdownTables：无分隔行的孤立管道行不构成表（宁可不判，不造假错误）', () => {
  assert.deepEqual(splitMarkdownTables('| 只有一行 | 没有分隔行 |'), []);
  assert.deepEqual(splitMarkdownTables('普通正文，没有表格'), []);
  assert.deepEqual(splitMarkdownTables(''), []);
});

test('splitMarkdownTables：对齐语法的分隔行同样识别', () => {
  const tables = splitMarkdownTables('| A | B |\n|:---|---:|\n| 1 | 2 |');
  assert.equal(tables.length, 1);
  assert.deepEqual(tables[0].rows, [['1', '2']]);
});
