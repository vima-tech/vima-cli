// C4 渲染层单测：render-review / render-prototype（黄金夹具驱动，契约 §13）
// 覆盖：exit 0 / 字节确定性 / --check 通过与漂移侦测 / manifest 结构 / 零外部请求 / lifecycle 写回。
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');

/** 在指定项目目录里执行 vima 子命令。 */
function vima(cwd, ...args) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
}

let root; // 黄金夹具的临时副本（测试按文件内声明顺序串行执行，共享同一副本）
const reviewRel = path.join('docs', 'review', 'index.html');
const protoRel = path.join('docs', 'review', 'prototype.html');
const manifestRel = path.join('docs', 'review', 'prototype.manifest.json');

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'vima-c4-'));
  await cp(GOLDEN, root, { recursive: true });
});

test('render-review：黄金夹具渲染 exit 0，产物落盘', async () => {
  const r = vima(root, 'render-review');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  const html = await readFile(path.join(root, reviewRel), 'utf8');
  assert.ok(html.includes('角色权限矩阵'), '含视图①');
  assert.ok(html.includes('id="PAGE-01"'), '页面锚点存在');
  assert.ok(html.includes('id="FLOW-01"'), '流程锚点存在');
  assert.ok(html.endsWith('\n') && !html.endsWith('\n\n'), '末尾单个换行');
  // 锚点 id 全文档唯一（也防住占位替换把内容注入两遍的回归）
  assert.equal(html.split('id="PAGE-01"').length - 1, 1, 'PAGE-01 锚点唯一');
  assert.equal(html.split('id="view-roles"').length - 1, 1, '视图①锚点唯一');
});

test('render-prototype：黄金夹具渲染 exit 0，html + manifest 双产物落盘', async () => {
  const r = vima(root, 'render-prototype');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  const html = await readFile(path.join(root, protoRel), 'utf8');
  assert.ok(html.includes('id="page-PAGE-01"'), '页面锚点存在');
  assert.ok(html.includes('data-modal="MODAL-01"'), '弹窗触发按钮存在');
  assert.ok(html.includes('<noscript>'), '禁 JS 平铺降级存在');
  assert.ok(html.endsWith('\n') && !html.endsWith('\n\n'), '末尾单个换行');
  // 表格列头取自契约 response 字段
  assert.ok(html.includes('<th>createdAt</th>') || html.includes('<th>createdAt'), '列头来自契约 response');
  // 锚点 id 全文档唯一（也防住占位替换把内容注入两遍的回归）
  assert.equal(html.split('id="page-PAGE-01"').length - 1, 1, 'page-PAGE-01 锚点唯一');
  assert.equal(html.split('id="MODAL-01"').length - 1, 1, 'MODAL-01 锚点唯一');
});

test('字节确定性：同一输入渲染两遍逐字节一致', async () => {
  const first = {
    review: await readFile(path.join(root, reviewRel)),
    proto: await readFile(path.join(root, protoRel)),
    manifest: await readFile(path.join(root, manifestRel)),
  };
  assert.equal(vima(root, 'render-review').status, 0);
  assert.equal(vima(root, 'render-prototype').status, 0);
  assert.ok(first.review.equals(await readFile(path.join(root, reviewRel))), '审计视图字节一致');
  assert.ok(first.proto.equals(await readFile(path.join(root, protoRel))), '原型字节一致');
  assert.ok(first.manifest.equals(await readFile(path.join(root, manifestRel))), 'manifest 字节一致');
});

test('--check：产物与 spec 无漂移时 exit 0', () => {
  const r1 = vima(root, 'render-review', '--check');
  assert.equal(r1.status, 0, `stderr: ${r1.stderr}`);
  const r2 = vima(root, 'render-prototype', '--check');
  assert.equal(r2.status, 0, `stderr: ${r2.stderr}`);
});

test('manifest：§6.7 结构（pages 按 id 排、links 含 nav/modal/api 三种）', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, manifestRel), 'utf8'));
  assert.equal(manifest.schemaVersion, '1');
  assert.equal(manifest.pages[0].id, 'PAGE-01');
  const ids = manifest.pages.map((p) => p.id);
  assert.deepEqual(ids, [...ids].sort(), 'pages 按 id 排序');
  const kinds = new Set(manifest.pages.flatMap((p) => p.links.map((l) => l.kind)));
  assert.ok(kinds.has('nav'), '含 nav 连线');
  assert.ok(kinds.has('modal'), '含 modal 连线');
  assert.ok(kinds.has('api'), '含 api 连线');
  // links 按 (kind, to) 稳定排序
  for (const p of manifest.pages) {
    const sorted = [...p.links].sort((a, b) =>
      a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.to < b.to ? -1 : a.to > b.to ? 1 : 0,
    );
    assert.deepEqual(p.links, sorted, `links 按 (kind,to) 排序: ${p.id}`);
  }
});

test('零外部请求：两份 html 均不含 http:// 与 https://', async () => {
  for (const rel of [reviewRel, protoRel]) {
    const html = await readFile(path.join(root, rel), 'utf8');
    assert.ok(!html.includes('http://'), `${rel} 不含 http://`);
    assert.ok(!html.includes('https://'), `${rel} 不含 https://`);
  }
});

test('lifecycle：reviewRendered / prototypeRendered 已置 true', async () => {
  const lifecycle = JSON.parse(await readFile(path.join(root, 'docs', 'lifecycle.json'), 'utf8'));
  assert.equal(lifecycle.checklists.PLANNING.reviewRendered, true);
  assert.equal(lifecycle.checklists.PLANNING.prototypeRendered, true);
});

test('--check 漂移侦测：篡改 html 一字节 → exit 2 且不写盘', async () => {
  // 篡改审计视图
  const reviewPath = path.join(root, reviewRel);
  const buf = Buffer.from(await readFile(reviewPath));
  buf[buf.length - 10] ^= 0x01; // 翻转一个字节
  await writeFile(reviewPath, buf);
  const r1 = vima(root, 'render-review', '--check');
  assert.equal(r1.status, 2);
  assert.ok(buf.equals(await readFile(reviewPath)), '--check 不写盘（篡改保持原样）');

  // 篡改原型 manifest（prototype --check 同时比对 manifest）
  const manifestPath = path.join(root, manifestRel);
  const mbuf = Buffer.from(await readFile(manifestPath));
  mbuf[mbuf.length - 5] ^= 0x01;
  await writeFile(manifestPath, mbuf);
  const r2 = vima(root, 'render-prototype', '--check');
  assert.equal(r2.status, 2);
  assert.ok(mbuf.equals(await readFile(manifestPath)), '--check 不写盘（篡改保持原样）');

  // 重渲染恢复后 --check 复绿
  assert.equal(vima(root, 'render-review').status, 0);
  assert.equal(vima(root, 'render-prototype').status, 0);
  assert.equal(vima(root, 'render-review', '--check').status, 0);
  assert.equal(vima(root, 'render-prototype', '--check').status, 0);
});

test('管理后台外壳与人审增强：菜单树 / 角色视角 / 审核指引 / 待确认徽标（契约 §11）', async () => {
  const proto = await readFile(path.join(root, protoRel), 'utf8');
  // 外壳：侧边菜单树含全部菜单锚点与角色徽标；页面卡带 data-roles 供角色视角联动
  assert.ok(proto.includes('class="wf-side"'), '含侧边栏外壳');
  assert.ok(proto.includes('MENU-01') && proto.includes('MENU-02'), '菜单树含全部菜单');
  assert.ok(proto.includes('data-role-chip="ROLE-01"'), '角色视角 chips 存在');
  assert.match(proto, /<section class="wf-page" id="page-PAGE-01"[^>]*data-roles="[^"]*ROLE-01/, '页面卡带角色归属');
  const review = await readFile(path.join(root, reviewRel), 'utf8');
  assert.ok(review.includes('如何审核本规格'), '审计视图含审核指引');
  assert.ok(!review.includes('id="view-pending"'), '黄金夹具无待确认项时不渲染清单区');

  // 标 pendingConfirm 后：清单区与徽标出现（渲染后本测试为本文件最后一个，不需恢复）
  const specPath = path.join(root, 'docs/spec.md');
  const spec = await readFile(specPath, 'utf8');
  await writeFile(specPath, spec.replace('id: PAGE-01\ntitle: 设备列表', 'id: PAGE-01\npendingConfirm: true\ntitle: 设备列表'));
  assert.equal(vima(root, 'render-review').status, 0);
  assert.equal(vima(root, 'render-prototype').status, 0);
  const review2 = await readFile(path.join(root, reviewRel), 'utf8');
  const proto2 = await readFile(path.join(root, protoRel), 'utf8');
  assert.ok(review2.includes('id="view-pending"'), '待确认清单区出现');
  assert.match(review2, /待确认清单（AI 推断项，共 1 处）/);
  assert.ok(proto2.includes('class="wf-pend"'), '原型出现待确认徽标');
});

test('render-review：A13 渲染五视图⑤ 与本期不做红线区，且空清单不省略整段', async () => {
  const html = await readFile(path.join(root, reviewRel), 'utf8');
  // ⑤ 业务规则视图：按 entity 分组 + type 徽标 + 适用接口
  assert.match(html, /id="view-rules"/, '缺⑤业务规则视图');
  assert.match(html, /<span class="num">⑤<\/span>业务规则/);
  assert.match(html, /class="rule-type">validation</, '缺 type 徽标');
  assert.match(html, /id="RULE-04"/, '规则条目须带锚点 ID');
  assert.match(html, /全局规则（不限接口）/, '无 apis 的规则须标为全局规则');
  // 本期不做红线区
  assert.match(html, /id="view-redline"/, '缺本期不做红线区');
  assert.match(html, /不做设备数据导出/);
  assert.match(html, /实现了其中任何一条即判越界 fail/);
  // 目录与统计
  assert.match(html, /href="#view-rules">⑤ 业务规则/);
  assert.match(html, /href="#view-redline">🚧 本期不做/);
  // 审核指引升为五步
  assert.match(html, /⑤ 业务规则<\/strong>——逐条看边界值与错误码/);

  // 空清单：整段仍渲染，文案区分「声明为空」与「没声明」
  const spec = path.join(root, 'docs', 'spec.md');
  const before = await readFile(spec, 'utf8');
  await writeFile(spec, before.replace(/```yaml vima:non-goals\n[\s\S]*?```/, '```yaml vima:non-goals\nnon-goals: []\n```'));
  const r = vima(root, 'render-review');
  assert.equal(r.status, 0, r.stderr);
  const empty = await readFile(path.join(root, reviewRel), 'utf8');
  assert.match(empty, /id="view-redline"/, '空清单时红线区不得整段省略');
  assert.match(empty, /本期未声明 non-goals/);
  // 还原，避免影响后续用例共享的副本
  await writeFile(spec, before);
  assert.equal(vima(root, 'render-review').status, 0);
});

// ── A14 分栏版面（regions）──────────────────────────────────────────────────
// 用独立副本，避免污染上方共享夹具的字节基线。

test('A14 向后兼容：黄金夹具无 regions → 不产生分栏结构、manifest 不写该键', async () => {
  const html = await readFile(path.join(root, protoRel), 'utf8');
  // 注意：类名在内联样式表里必然出现，故只能断言标记本身
  assert.ok(!html.includes('class="wf-cols"'), '未声明 regions 的页面不出现分栏容器');
  assert.ok(!html.includes('class="wf-col"'), '未声明 regions 的页面不出现列');
  const manifest = JSON.parse(await readFile(path.join(root, manifestRel), 'utf8'));
  for (const p of manifest.pages) {
    assert.ok(!('regions' in p), `${p.id} 不应写入 regions 键`);
  }
});

test('A14 分栏渲染：声明 regions → 原型按列、审计视图出版面草图', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-c4-rg-'));
  await cp(GOLDEN, dir, { recursive: true });
  const specPath = path.join(dir, 'docs', 'spec.md');
  const spec = await readFile(specPath, 'utf8');
  // 给 PAGE-01 加 regions：把它的 layout 拆成左右两列
  const page = spec.match(/```yaml vima:page\n([\s\S]*?)\n```/)[1];
  const layout = page.match(/^layout: \[(.+)\]$/m)[1].split(',').map((w) => w.trim());
  const left = layout.slice(0, 1);
  const right = layout.slice(1);
  const regions =
    `regions:\n` +
    `  - columns:\n` +
    `      - { name: 筛选栏, width: 260px, blocks: [${left.join(', ')}] }\n` +
    `      - { name: 主区, width: 1fr, blocks: [${right.join(', ')}] }`;
  await writeFile(specPath, spec.replace(/^layout: \[.+\]$/m, (m) => `${m}\n${regions}`));

  assert.equal(vima(dir, 'render-prototype').status, 0);
  assert.equal(vima(dir, 'render-review').status, 0);

  const proto = await readFile(path.join(dir, protoRel), 'utf8');
  assert.ok(proto.includes('class="wf-cols"'), '原型出现分栏容器');
  assert.ok(proto.includes('flex:0 0 260px'), '固定列按 px 落 flex');
  assert.ok(proto.includes('flex:1 1 0'), '弹性列按 fr 落 flex');
  assert.ok(proto.includes('筛选栏'), '列名渲染');

  const review = await readFile(path.join(dir, reviewRel), 'utf8');
  assert.ok(review.includes('版面草图'), '审计视图出现版面草图标题');
  assert.ok(review.includes('class="sk-cols"'), '草图含分栏带');

  const manifest = JSON.parse(await readFile(path.join(dir, manifestRel), 'utf8'));
  const p1 = manifest.pages.find((p) => p.id === 'PAGE-01');
  assert.equal(p1.regions[0].columns.length, 2, 'manifest 透传 regions 的列');
});

test('A14 V-SPEC-12：regions 与 layout 不一致 / 列宽非法 → 阻断渲染', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-c4-rgbad-'));
  await cp(GOLDEN, dir, { recursive: true });
  const specPath = path.join(dir, 'docs', 'spec.md');
  const spec = await readFile(specPath, 'utf8');

  // ① 区块集合与 layout 不一致（漏掉其余区块）
  await writeFile(
    specPath,
    spec.replace(/^layout: \[(.+)\]$/m, (m, inner) => {
      const first = inner.split(',')[0].trim();
      return `${m}\nregions:\n  - columns:\n      - { name: 只有一列, width: 1fr, blocks: [${first}] }`;
    }),
  );
  const bad1 = vima(dir, 'render-prototype');
  assert.notEqual(bad1.status, 0, '不一致时拒绝渲染');
  assert.match(bad1.stderr, /V-SPEC-12/, '报 V-SPEC-12');

  // ② 列宽非法
  await writeFile(
    specPath,
    spec.replace(/^layout: \[(.+)\]$/m, (m, inner) => {
      const all = inner.split(',').map((w) => w.trim()).join(', ');
      return `${m}\nregions:\n  - columns:\n      - { name: 宽度非法, width: 50%, blocks: [${all}] }`;
    }),
  );
  const bad2 = vima(dir, 'validate', '--artifact', 'docs/spec.md');
  assert.match(bad2.stdout + bad2.stderr, /V-SPEC-12/, '列宽非法报 V-SPEC-12');
});

test('表格横向滚动容器：宽表不撑破所在列（分栏页尤其关键）', async () => {
  const html = await readFile(path.join(root, protoRel), 'utf8');
  // 每个 table 区块都必须套 .wf-tw 滚动容器，且容器在 table 之外、wf-tag 之内不受裁剪
  const tables = (html.match(/<table>/g) ?? []).length;
  const wraps = (html.match(/<div class="wf-tw">/g) ?? []).length;
  assert.ok(tables > 0, '夹具含表格区块');
  assert.equal(wraps, tables, '每个表格都有横向滚动容器');
  const adjacent = (html.match(/<div class="wf-tw"><table>/g) ?? []).length;
  assert.equal(adjacent, tables, '滚动容器紧邻表格，无表格直接挂在 wf-block 下');
});
