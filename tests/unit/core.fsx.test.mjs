// 极简 frontmatter 解析器。
//
// 它此前零测试覆盖，而 assets/rules、ops/spec、front/claude 三处都靠它。
// 补测试的直接起因：它对读不懂的行直接丢弃，于是我们自己投影出的块列表
// `paths:` 被自己解析成空值，一路绿灯。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frontmatter } from '../../lib/core/fsx.mjs';

const fm = (...lines) => `---\n${lines.join('\n')}\n---\n\n正文\n`;

test('标量 / 行内数组 / 引号', () => {
  const { data, unparsed } = frontmatter(fm('layer: impl', "side: 'admin'", 'block: [a, "b"]'));
  assert.deepEqual(data, { layer: 'impl', side: 'admin', block: ['a', 'b'] });
  assert.deepEqual(unparsed, []);
});

test('块列表读得懂——这正是官方文档给 .claude/rules/ 的写法', () => {
  const { data, unparsed } = frontmatter(fm('paths:', '  - "apps/console/**/*"', '  - "apps/ops/**/*"'));
  assert.deepEqual(data.paths, ['apps/console/**/*', 'apps/ops/**/*']);
  assert.deepEqual(unparsed, [], '读得懂就不该报进 unparsed');
});

test('块列表之后还能接别的键', () => {
  const { data } = frontmatter(fm('paths:', '  - "a/**"', 'layer: impl'));
  assert.deepEqual(data, { paths: ['a/**'], layer: 'impl' });
});

test('空值键后面没有列表项 → 空数组，不是把下一行吞进来', () => {
  const { data } = frontmatter(fm('paths:', 'layer: impl'));
  assert.deepEqual(data, { paths: [], layer: 'impl' });
});

test('注释与空行不算内容，也不算读不懂', () => {
  const { data, unparsed } = frontmatter(fm('# 说明', '', 'layer: impl', '  # 缩进的注释'));
  assert.deepEqual(data, { layer: 'impl' });
  assert.deepEqual(unparsed, []);
});

test('读不懂的行如实报出来，带行号——不再默默丢掉', () => {
  const { data, unparsed } = frontmatter(fm('layer: impl', 'this is not yaml at all', 'side: admin'));
  assert.deepEqual(data, { layer: 'impl', side: 'admin' });
  assert.equal(unparsed.length, 1);
  assert.equal(unparsed[0].line, 2, '行号要指向 frontmatter 内的真实行');
  assert.match(unparsed[0].text, /not yaml/);
});

test('没有归属的列表项也算读不懂，不静默挂到上一个键上', () => {
  const { unparsed } = frontmatter(fm('layer: impl', '  - 孤儿列表项'));
  assert.equal(unparsed.length, 1, 'layer 有值，后面的 - 不该被吸进去');
});

test('没有 frontmatter 时返回空壳，unparsed 也在（调用方不必判 undefined）', () => {
  const r = frontmatter('# 就是一篇 markdown\n');
  assert.deepEqual(r.data, {});
  assert.deepEqual(r.unparsed, []);
  assert.equal(r.body, '# 就是一篇 markdown\n');
});

test('正文原样保留，前置头一个字符不留', () => {
  const { body } = frontmatter(fm('layer: impl'));
  assert.equal(body, '\n正文\n');
});

test('CRLF 与 BOM 不会让 frontmatter 整段失明', () => {
  // 这两种文件 .gitattributes 管不住（它只管过 git 的文件）：本地新建、
  // Windows 编辑器、agent 写出的都可能带。曾经 `^---\n` 匹配不上 `---\r\n`，
  // 整块 frontmatter 被当正文，data 空、unparsed 也空——两道闸门都不触发，
  // `side: wechat` 的端限定规则静默变成处处生效。
  const crlf = '---\r\nside: wechat\r\n---\r\n\r\n正文\r\n';
  const c = frontmatter(crlf);
  assert.deepEqual(c.data, { side: 'wechat' }, 'CRLF 文件的限定维度必须读得出来');

  const bom = '\uFEFF---\nside: wechat\n---\n\n正文\n';
  const b = frontmatter(bom);
  assert.deepEqual(b.data, { side: 'wechat' }, 'BOM 开头的文件同理');
});
