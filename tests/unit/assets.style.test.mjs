// 词表必须是封闭集合，令牌必须成档。这两条一旦松了，「定形」就退化成建议。
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadStyle } from '../../lib/assets/registry.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const ASSETS = path.join(REPO, 'assets');

const style = await loadStyle(ASSETS, 'enterprise-blue');
const VOCABS = ['layout', 'interaction', 'ia'];

/** 逃生口的常见马甲。开一个口子，之后所有说不清的都会流进去。 */
const ESCAPE_ID = /^(other|others|custom|customized|misc|miscellaneous|general|generic|fallback|freeform|free-form|etc|extra|unknown|todo|tbd)$/i;
const ESCAPE_NAME = /其它|其他|杂项|自由发挥|随意|不限|任意/;

function* allTerms(vocab) {
  for (const [groupId, group] of Object.entries(vocab.groups)) {
    for (const term of group.terms) yield [groupId, term];
  }
}

test('三份词表都自称封闭，且结构一致', () => {
  for (const name of VOCABS) {
    const vocab = style[name];
    assert.equal(vocab.$kind, 'vocab', `${name} 缺 $kind`);
    assert.equal(vocab.$closed, true, `${name} 必须显式声明封闭`);
    assert.ok(Array.isArray(vocab.$discipline) && vocab.$discipline.length > 0, `${name} 缺纪律说明`);
    assert.ok(Object.keys(vocab.groups).length > 0);
    for (const [groupId, group] of Object.entries(vocab.groups)) {
      assert.ok(group.$what, `${name}.${groupId} 缺 $what`);
      assert.ok(group.$pick, `${name}.${groupId} 缺「什么时候用哪个」`);
      assert.ok(group.terms.length >= 2, `${name}.${groupId} 至少要有 2 个具名选项`);
    }
  }
});

test('封闭集合：不许有 other / custom / 其它 这类逃生口', () => {
  for (const name of VOCABS) {
    for (const [groupId, term] of allTerms(style[name])) {
      const at = `${name}.${groupId}.${term.id}`;
      assert.equal(ESCAPE_ID.test(term.id), false, `${at} 是逃生口`);
      assert.equal(ESCAPE_NAME.test(term.name), false, `${at} 的名字是逃生口`);
    }
    for (const groupId of Object.keys(style[name].groups)) {
      assert.equal(ESCAPE_ID.test(groupId), false, `${name}.${groupId} 是逃生口分组`);
    }
  }
});

test('每个词都说得清「是什么」和「和相邻那个词的区别」', () => {
  for (const name of VOCABS) {
    for (const [groupId, term] of allTerms(style[name])) {
      const at = `${name}.${groupId}.${term.id}`;
      assert.match(term.id, /^[a-z][a-z0-9-]*$/, `${at} 的 id 不规范`);
      assert.ok(typeof term.name === 'string' && term.name.length >= 2, `${at} 缺 name`);
      for (const key of ['what', 'vs']) {
        assert.ok(typeof term[key] === 'string' && term[key].length >= 8, `${at} 缺 ${key}`);
      }
    }
  }
});

test('组内 id 唯一（跨组同名允许，引用时写全 group:term）', () => {
  for (const name of VOCABS) {
    for (const [groupId, group] of Object.entries(style[name].groups)) {
      const ids = group.terms.map((t) => t.id);
      assert.equal(new Set(ids).size, ids.length, `${name}.${groupId} 有重复 id`);
    }
  }
});

test('interaction 覆盖住上一代付过代价的那几类，且每个选项都写明什么时候用', () => {
  const required = [
    'form-validation', 'error-feedback', 'empty-state', 'loading', 'load-failure',
    'row-action-visibility', 'destructive-confirm', 'contract-gap', 'permission-degradation',
  ];
  for (const groupId of required) {
    assert.ok(style.interaction.groups[groupId], `interaction 缺 ${groupId}`);
  }
  for (const [groupId, term] of allTerms(style.interaction)) {
    assert.ok(term.when && term.when.length >= 4, `interaction.${groupId}.${term.id} 缺 when`);
  }
});

test('被禁止的处置要点名列出来，且不能同时是可选项', () => {
  // 列出来是为了能被机检认出来，不是提供选项。
  const forbidden = {};
  for (const [groupId, group] of Object.entries(style.interaction.groups)) {
    if (!group.$forbidden) continue;
    forbidden[groupId] = group.$forbidden.map((f) => f.id);
    const optionIds = new Set(group.terms.map((t) => t.id));
    for (const item of group.$forbidden) {
      assert.ok(item.why && item.why.length >= 8, `${groupId}.${item.id} 缺 why`);
      assert.equal(optionIds.has(item.id), false, `${groupId}.${item.id} 既是禁令又是选项`);
    }
  }
  assert.ok(forbidden['error-feedback'].includes('console-only'), '「只打控制台」必须被点名');
  assert.ok(forbidden['contract-gap'].includes('silent-fake'), '「静默编数据」必须被点名');
});

test('契约缺口的四个选项都在，默认档明说', () => {
  const gap = style.interaction.groups['contract-gap'];
  assert.deepEqual(
    gap.terms.map((t) => t.id).sort(),
    ['block-and-declare', 'hide-affordance', 'mock-marked', 'narrow-scope'],
  );
  assert.match(gap.$pick, /默认 block-and-declare/);
});

test('layout 宽到能表达上一代表达不了的那些页面', () => {
  const ids = new Set([...allTerms(style.layout)].map(([, t]) => t.id));
  // 上一代 48 页里 19% 因为没有这些词被迫降级
  for (const word of [
    'sidebar-main-aside', 'aside-sticky', 'step-rail', 'collapse-panels', 'anchor-rail',
    'timeline', 'canvas-dnd', 'split-master-detail', 'wizard', 'mobile-stack',
  ]) {
    assert.ok(ids.has(word), `layout 缺词 ${word}`);
  }
  const charts = [...ids].filter((id) => id.startsWith('chart-'));
  assert.ok(charts.length >= 4, '图表要按意图分词，不能只有一个 chart');
});

test('ia 的 sides 是 rules 维度 side 的取值全集', () => {
  const sides = style.ia.groups.sides.terms.map((t) => t.id);
  assert.deepEqual(sides.sort(), ['admin', 'h5', 'server', 'wechat']);
});

/** 递归找出所有带 $rungs 的档位组。 */
function* ladders(node, at = 'tokens') {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node.$rungs)) yield [at, node];
  for (const [key, value] of Object.entries(node)) {
    if (!key.startsWith('$')) yield* ladders(value, `${at}.${key}`);
  }
}

test('令牌阶梯成档：每一档都在 $rungs 上，$rungs 严格递增', () => {
  const found = [...ladders(style.tokens)];
  assert.ok(found.length >= 8, `应有多组档位，实际 ${found.length}`);
  for (const [at, group] of found) {
    const rungs = group.$rungs;
    for (let i = 1; i < rungs.length; i += 1) {
      assert.ok(rungs[i] > rungs[i - 1], `${at}.$rungs 不是严格递增：${rungs}`);
    }
    const used = Object.entries(group).filter(([k]) => !k.startsWith('$'));
    assert.ok(used.length > 0, `${at} 有 $rungs 却没有具名档`);
    for (const [name, value] of used) {
      assert.equal(typeof value, 'number', `${at}.${name} 应是数值`);
      assert.ok(rungs.includes(value), `${at}.${name}=${value} 不在档上（${rungs}）`);
    }
    assert.equal(new Set(used.map(([, v]) => v)).size, used.length, `${at} 有两个名字指向同一档`);
  }
});

test('圆角是干净的阶梯，不是散落的数', () => {
  // 上一代同时出现 7/8/9/10/11/12/13/14px——那不是阶梯，那是没有阶梯。
  const radius = style.tokens.radius;
  assert.deepEqual(radius.$rungs, [0, 2, 4, 8, 12, 9999]);
  const values = Object.entries(radius).filter(([k]) => !k.startsWith('$')).map(([, v]) => v);
  assert.equal(values.length, 6, '圆角只有六档');
  assert.equal(style.tokens.space.$rungs.length, 7, '间距只有七档');
  assert.deepEqual(style.tokens.space.$rungs.slice(0, 5), [4, 8, 12, 16, 24]);
});

test('关键令牌对得上：主色 · 雾蓝 · 控件高 · 正文 · 表头', () => {
  const t = style.tokens;
  assert.equal(t.palette.brand['500'], '#2f73c5');
  assert.equal(t.palette.brand['50'], '#e9f0f7');
  assert.equal(t.role.accent.base, t.palette.brand['500']);
  assert.equal(t.size.control.md, 38);
  assert.equal(t.font.size.body, 15);
  assert.equal(t.size.table.header, 44);
});

test('颜色令牌一律是合法 hex，不许混进 rgb() 或色名', () => {
  const bad = [];
  const scan = (node, at) => {
    if (typeof node === 'string' && (at.startsWith('tokens.palette') || at.startsWith('tokens.role') || at.startsWith('tokens.status'))) {
      if (!/^#[0-9a-f]{6}$/.test(node) && !at.endsWith('$what')) bad.push(`${at}=${node}`);
      return;
    }
    if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) scan(v, `${at}.${k}`);
  };
  scan(style.tokens, 'tokens');
  assert.deepEqual(bad, []);
});
