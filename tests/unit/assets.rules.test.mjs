// rules 的三个承诺：按维度选得准、没说的维度不乱选、死规则能自己浮出来。
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRules, selectRules, deadRules, DIMENSIONS } from '../../lib/assets/rules.mjs';
import { loadStyle, listBlocks } from '../../lib/assets/registry.mjs';
import { LAYERS } from '../../lib/core/claims.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const ASSETS = path.join(REPO, 'assets');

async function fixture(files) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-rules-'));
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(root, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content, 'utf8');
  }
  return root;
}

const rule = (fm, body = '正文') => (fm ? `---\n${fm}\n---\n${body}\n` : `${body}\n`);

test('loadRules 读真实规则：id 从文件名推导，README 不算规则', async () => {
  const rules = await loadRules(ASSETS);
  assert.ok(rules.length >= 5 && rules.length <= 8, `规则条数 ${rules.length} 应在 5–8 之间——规则层膨胀是信号`);
  assert.equal(rules.some((r) => r.id === 'README'), false);
  assert.ok(rules.every((r) => r.origin === 'builtin'));
  assert.ok(rules.every((r) => r.text.length > 0));
  assert.ok(rules.every((r) => DIMENSIONS.every((d) => d in r.applies)));

  const gap = rules.find((r) => r.id === 'contract-gap-honesty');
  assert.deepEqual(gap.applies.layer, ['contract', 'impl', 'behavior']);
  assert.equal(gap.applies.side, null, '未声明的维度 = 任意');
  assert.equal(rules.find((r) => r.id === 'wechat-host-boundary').applies.side[0], 'wechat');
});

test('项目规则与内置规则合并，同 id 由项目覆盖', async () => {
  const assets = await fixture({ 'rules/a.md': rule('layer: [impl]', '内置 A'), 'rules/b.md': rule(null, '内置 B') });
  const project = await fixture({
    '.vima/rules/a.md': rule('layer: [spec]', '项目改写的 A'),
    '.vima/rules/local.md': rule(null, '项目特有'),
  });
  try {
    const rules = await loadRules(assets, project);
    assert.deepEqual(rules.map((r) => r.id), ['a', 'b', 'local']);
    const a = rules.find((r) => r.id === 'a');
    assert.equal(a.origin, 'project');
    assert.deepEqual(a.applies.layer, ['spec'], '项目版本整条替换内置版本，不是合并');
    assert.equal(rules.find((r) => r.id === 'b').origin, 'builtin');
  } finally {
    await rm(assets, { recursive: true, force: true });
    await rm(project, { recursive: true, force: true });
  }
});

test('frontmatter 写错维度键当场报错，不静默放行', async () => {
  // `sides:` 被静默忽略，规则就从「只在小程序生效」悄悄变成「处处生效」——必须炸。
  const assets = await fixture({ 'rules/typo.md': rule('sides: [wechat]') });
  try {
    await assert.rejects(() => loadRules(assets), (err) => {
      assert.equal(err.code, 'RULE_UNKNOWN_KEY');
      return true;
    });
  } finally {
    await rm(assets, { recursive: true, force: true });
  }
});

test('selectRules 按维度选：声明什么就在什么时候出现', async () => {
  const assets = await fixture({
    'rules/all.md': rule(null),
    'rules/impl-only.md': rule('layer: [impl]'),
    'rules/wechat-only.md': rule('side: [wechat]'),
    'rules/impl-wechat.md': rule('layer: [impl]\nside: [wechat]'),
    'rules/role-block.md': rule('block: [admin/role-management]'),
    'rules/starred.md': rule('layer: [*]'),
  });
  try {
    const rules = await loadRules(assets);
    const ids = (dims) => selectRules(rules, dims).map((r) => r.id).sort();

    assert.deepEqual(ids({ layer: 'impl', side: 'wechat' }), ['all', 'impl-only', 'impl-wechat', 'starred', 'wechat-only']);
    assert.deepEqual(ids({ layer: 'impl', side: 'admin' }), ['all', 'impl-only', 'starred']);
    assert.deepEqual(ids({ layer: 'spec', side: 'wechat' }), ['all', 'starred', 'wechat-only']);
    assert.deepEqual(
      ids({ layer: 'impl', side: 'admin', blocks: ['admin/role-management'] }),
      ['all', 'impl-only', 'role-block', 'starred'],
    );
    // `*` 等价于不限定
    assert.deepEqual(ids({ layer: 'spec' }), ['all', 'starred']);
  } finally {
    await rm(assets, { recursive: true, force: true });
  }
});

test('任务没说的维度，不会把限定了该维度的规则选进来', async () => {
  // 反过来（没说就全选）等于把「不知道」当成「都算」：wechat 专属规则会被喂进后端任务，
  // 规则集稀释成噪音，agent 学会整体跳过。
  const assets = await fixture({ 'rules/all.md': rule(null), 'rules/wechat-only.md': rule('side: [wechat]') });
  try {
    const rules = await loadRules(assets);
    assert.deepEqual(selectRules(rules, { layer: 'impl' }).map((r) => r.id), ['all']);
    assert.deepEqual(selectRules(rules, {}).map((r) => r.id), ['all']);
  } finally {
    await rm(assets, { recursive: true, force: true });
  }
});

test('deadRules 捞出从未被任何维度组合命中的规则', async () => {
  const assets = await fixture({
    'rules/alive-any.md': rule(null),
    'rules/alive-impl.md': rule('layer: [impl]'),
    'rules/dead-side.md': rule('side: [pos-terminal]'),      // 这个端根本不存在
    'rules/dead-layer.md': rule('layer: [deployment]'),      // 这一层根本不存在
    'rules/dead-block.md': rule('block: [admin/nope]'),      // 这个块没装
    'rules/dead-combo.md': rule('layer: [intent]\nside: [wechat]'), // 两个维度都存在，但……
  });
  try {
    const rules = await loadRules(assets);
    const dead = deadRules(rules, {
      layers: ['spec', 'contract', 'impl'],
      sides: ['server', 'admin', 'wechat'],
      blocks: ['admin/role-management'],
    }).map((r) => r.id).sort();
    // dead-combo 死在 intent 不在全集里——单看 side 是活的，组合起来才死。
    assert.deepEqual(dead, ['dead-block', 'dead-combo', 'dead-layer', 'dead-side']);

    // 把 intent 加进全集，dead-combo 立刻复活：死判据跟着全集走，不是写死的。
    const dead2 = deadRules(rules, {
      layers: ['intent', 'spec', 'contract', 'impl'],
      sides: ['server', 'admin', 'wechat'],
      blocks: ['admin/role-management'],
    }).map((r) => r.id);
    assert.equal(dead2.includes('dead-combo'), false);
  } finally {
    await rm(assets, { recursive: true, force: true });
  }
});

test('内置规则在真实维度全集里一条都不能是死的', async () => {
  // 维度全集全部**算出来**：层来自 claims.LAYERS，端来自 ia 词表的 sides，块来自资产仓。
  // 没有任何一处写死清单——加一个端就是往词表加一个词。
  const rules = await loadRules(ASSETS);
  const style = await loadStyle(ASSETS, 'enterprise-blue');
  const sides = style.ia.groups.sides.terms.map((t) => t.id);
  const blocks = (await listBlocks(ASSETS)).map((b) => `${b.set}/${b.name}`);

  const dead = deadRules(rules, { layers: [...LAYERS], sides, blocks });
  assert.deepEqual(dead.map((r) => r.id), [], '死规则要么删掉，要么修正它的维度声明');
});
