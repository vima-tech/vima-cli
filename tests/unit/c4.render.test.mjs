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
