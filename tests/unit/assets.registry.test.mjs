// registry 的核心承诺只有一条：**加块、换皮、加词表都不需要改代码**。
// 因此这里既测真实资产读得出来，也用临时目录测「丢个新目录进去就能看见」。
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadStyle, listBlocks, readBlock } from '../../lib/assets/registry.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const ASSETS = path.join(REPO, 'assets');

async function fixture(files) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-assets-'));
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(root, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, typeof content === 'string' ? content : JSON.stringify(content), 'utf8');
  }
  return root;
}

test('loadStyle 读出令牌与全部词表', async () => {
  const style = await loadStyle(ASSETS, 'enterprise-blue');
  assert.equal(style.tokens.$id, 'enterprise-blue');
  assert.equal(style.tokens.palette.brand['500'], '#2f73c5');
  for (const name of ['layout', 'interaction', 'ia']) {
    assert.equal(style[name].$id, name, `缺词表 ${name}`);
  }
});

test('loadStyle 的词表键由目录决定，不是代码里写死的名字', async () => {
  const root = await fixture({
    'style/tokens/moss.json': { $id: 'moss' },
    'style/layout.vocab.json': { $id: 'layout' },
    'style/motion-story.vocab.json': { $id: 'motion-story' }, // 新加一份词表，代码一行没改
  });
  try {
    const style = await loadStyle(root, 'moss');
    assert.deepEqual(Object.keys(style).sort(), ['layout', 'motion-story', 'tokens']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('loadStyle 换皮只是换一个文件；未知皮报错并列出现有的', async () => {
  const root = await fixture({
    'style/tokens/enterprise-blue.json': { $id: 'enterprise-blue' },
    'style/tokens/moss.json': { $id: 'moss' },
  });
  try {
    assert.equal((await loadStyle(root, 'moss')).tokens.$id, 'moss');
    await assert.rejects(() => loadStyle(root, 'nope'), (err) => {
      assert.equal(err.code, 'THEME_NOT_FOUND');
      assert.match(err.message, /enterprise-blue/);
      assert.match(err.message, /moss/);
      return true;
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('listBlocks 扫得到真实资产里的块；占位目录不算块', async () => {
  const blocks = await listBlocks(ASSETS);
  const role = blocks.find((b) => b.set === 'admin' && b.name === 'role-management');
  assert.ok(role, '应当扫到 admin/role-management');
  assert.deepEqual(role.layers, ['L1', 'L2', 'L3']);
  assert.equal(role.meta.title, '角色与权限管理');
  assert.deepEqual(role.meta.sides, ['server', 'admin']);
  // .gitkeep 只有两段路径，构不成块——占位不能被当成内容
  assert.equal(blocks.some((b) => b.set === 'common'), false);
  assert.equal(blocks.some((b) => b.set === 'wechat'), false);
});

test('listBlocks 靠约定扫目录：新块丢进去就看得见，缺 block.json 也照样列出来', async () => {
  const root = await fixture({
    'blocks/admin/role-management/block.json': { id: 'admin/role-management' },
    'blocks/admin/role-management/L1.contract.md': '# 契约',
    'blocks/finance/invoice/L1.contract.md': '# 契约', // 全新 set，代码不认识它也能扫到
    'blocks/finance/invoice/L3.frontend.md': '# 行为',
    'blocks/common/.gitkeep': '占位',
    'blocks/README.md': '说明',
  });
  try {
    const blocks = await listBlocks(root);
    assert.deepEqual(blocks.map((b) => `${b.set}/${b.name}`), ['admin/role-management', 'finance/invoice']);
    const invoice = blocks[1];
    assert.deepEqual(invoice.layers, ['L1', 'L3']);
    assert.equal(invoice.meta, null, '缺 block.json 要看得见，不能静默跳过');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('readBlock 读出四层里存在的那几层，L4 用「键不存在」表达默认不提供', async () => {
  const block = await readBlock(ASSETS, 'admin', 'role-management');
  assert.equal(block.meta.id, 'admin/role-management');
  for (const key of ['L1', 'L2', 'L3']) {
    assert.ok(block[key] && block[key].text.length > 0, `${key} 应有正文`);
  }
  assert.equal('L4' in block, false, 'L4 默认不提供：是决定，不是遗漏，所以键不存在而不是 null');
  assert.match(block.L1.text, /system:role:grant/);
  assert.match(block.L3.text, /纯逻辑，无视觉/);
});

test('readBlock 缺层为 null，缺块报错，一层两个文件报错', async () => {
  const root = await fixture({
    'blocks/x/only-contract/L1.contract.md': '# 只有契约',
    'blocks/x/two-l2/L1.contract.md': '# 契约',
    'blocks/x/two-l2/L2.backend.md': '# 后端',
    'blocks/x/two-l2/L2.server.md': '# 又一个后端',
  });
  try {
    const one = await readBlock(root, 'x', 'only-contract');
    assert.equal(one.L2, null);
    assert.equal(one.L3, null);
    assert.equal(one.meta, null);

    await assert.rejects(() => readBlock(root, 'x', 'missing'), (err) => err.code === 'BLOCK_NOT_FOUND');
    await assert.rejects(() => readBlock(root, 'x', 'two-l2'), (err) => err.code === 'BLOCK_LAYER_DUPLICATE');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('层文件的 frontmatter 读得出来，正文不含 frontmatter', async () => {
  const root = await fixture({
    'blocks/x/y/L3.frontend.md': '---\nlayer: [impl]\n---\n# 行为\n正文\n',
  });
  try {
    const block = await readBlock(root, 'x', 'y');
    assert.deepEqual(block.L3.meta, { layer: ['impl'] });
    assert.equal(block.L3.text.startsWith('# 行为'), true);
    assert.equal(block.L3.file, 'L3.frontend.md');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('checkAssets：坏主题 / 缺层块 / 缺席块 / 坏 id 各自说得出问题，健康的不误报', async () => {
  // 真文件真加载器：判定必须复用 loadStyle / readBlock 本身——
  // 「另查一遍文件在不在」就是第二真源，令牌 JSON 坏掉这类它看不见。
  const root = await fixture({
    'style/tokens/moss.json': { $id: 'moss' },
    'blocks/x/whole/L1.contract.md': '# 契约',
    'blocks/x/whole/L2.backend.md': '# 后端',
    'blocks/x/whole/L3.frontend.md': '# 前端',
    'blocks/x/half/L1.contract.md': '# 只有契约',
  });
  try {
    const { checkAssets } = await import('../../lib/assets/registry.mjs');
    const out = await checkAssets(root, {
      theme: 'moss',
      blocks: ['x/whole', 'x/half', 'x/missing', 'not-a-block-id'],
    });
    assert.deepEqual(out.theme, { name: 'moss', ok: true });

    const [whole, half, missing, malformed] = out.blocks;
    assert.equal(whole.ok, true);
    assert.deepEqual(whole.missing, []);

    assert.equal(half.ok, false);
    assert.deepEqual(half.missing, ['L2', 'L3'], '缺哪几层要点得出名');

    assert.equal(missing.ok, false);
    assert.equal(missing.code, 'BLOCK_NOT_FOUND');

    assert.equal(malformed.ok, false);
    assert.equal(malformed.code, 'BLOCK_ID_MALFORMED', '手改 config 写坏的 id 只有这里能发现');

    const badTheme = await checkAssets(root, { theme: 'ghost' });
    assert.equal(badTheme.theme.ok, false);
    assert.equal(badTheme.theme.code, 'THEME_NOT_FOUND');

    const nothing = await checkAssets(root, {});
    assert.equal(nothing.theme, null, '没登记主题 = 没得查，不是查出问题');
    assert.deepEqual(nothing.blocks, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
