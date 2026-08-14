// C4 渲染层单测：render-review / render-prototype（黄金夹具驱动，契约 §13）
// 覆盖：exit 0 / 字节确定性 / --check 通过与漂移侦测 / manifest 结构 / 零外部请求 / lifecycle 写回。
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

test('manifest：§6.7 结构（A16 顶层 apps map；pages 按 id 排、links 含 nav/modal/api 三种）', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, manifestRel), 'utf8'));
  assert.equal(manifest.schemaVersion, '1');
  // A16 新形态：顶层 apps 映射（N=1 同样使用新形态，key = 唯一端 id）
  assert.ok(manifest.apps && !manifest.pages, '顶层为 apps 映射而非 pages');
  const pages = manifest.apps.admin.pages;
  assert.equal(pages[0].id, 'PAGE-01');
  const ids = pages.map((p) => p.id);
  assert.deepEqual(ids, [...ids].sort(), 'pages 按 id 排序');
  const kinds = new Set(pages.flatMap((p) => p.links.map((l) => l.kind)));
  assert.ok(kinds.has('nav'), '含 nav 连线');
  assert.ok(kinds.has('modal'), '含 modal 连线');
  assert.ok(kinds.has('api'), '含 api 连线');
  // links 按 (kind, to) 稳定排序
  for (const p of pages) {
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

// ── A33 业务闭环视图（第⑥视图 + model.tasks 切片）──────────────────────────

test('A33：第⑥视图渲染四问——入口可达性 / 状态效应 / 查询出口 / 承接任务', async () => {
  assert.equal(vima(root, 'render-review').status, 0);
  const html = await readFile(path.join(root, reviewRel), 'utf8');
  assert.match(html, /id="view-loop"/, '缺⑥业务闭环视图');
  assert.match(html, /<span class="num">⑥<\/span>业务闭环/);
  assert.match(html, /href="#view-loop">⑥ 业务闭环/, '目录含⑥');
  assert.match(html, /⑥ 业务闭环<\/strong>——每条流程从头验四问/, '审核指引升为六步');
  assert.match(html, /id="loop-FLOW-01"/, '逐流程一卡且锚点独立于泳道视图');
  // 入口可达性：ROLE-01 拥有 MENU-01 → 可达
  assert.match(html, /入口：[\s\S]{0,400}?✅ 角色拥有该菜单，可达/);
  // 状态效应：POST /api/device 命中黄金夹具的 transition/calculation 规则或如实标无
  assert.ok(
    /状态效应/.test(html) && (/RULE-0\d<\/span><\/a> (transition|calculation)/.test(html) || /无已声明的状态规则/.test(html)),
    '状态效应列须给出规则或如实标注无',
  );
  // 查询出口：终点页 PAGE-02 有 GET 接口
  assert.match(html, /结果查询出口：/);
  assert.match(html, /GET \/api\/device\/detail/);
  // 承接任务：join 到黄金夹具任务
  assert.match(html, /承接任务：[\s\S]{0,400}?device-list-fe/);
  assert.match(html, /承接任务：[\s\S]{0,600}?device-api-be/);
});

test('A33：任务切片不含运行态——任务状态翻转不产生渲染漂移（D-A33-01）', async () => {
  assert.equal(vima(root, 'render-review').status, 0);
  const before = await readFile(path.join(root, reviewRel), 'utf8');
  const taskPath = path.join(root, 'docs', 'tasks', 'device-list-fe.md');
  const task = await readFile(taskPath, 'utf8');
  await writeFile(taskPath, task.replace(/^status: .+$/m, 'status: done'));
  assert.equal(vima(root, 'render-review', '--check').status, 0, '任务状态变化不得触发新鲜度漂移');
  assert.equal(vima(root, 'render-review').status, 0);
  assert.equal(await readFile(path.join(root, reviewRel), 'utf8'), before, '产物字节不变');
  await writeFile(taskPath, task); // 复位，避免影响后续共享副本
  assert.equal(vima(root, 'render-review').status, 0);
});

test('A33：docs/tasks 缺失时承接行如实标注，不阻塞渲染', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-c4-loop-notasks-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(GOLDEN, dir, { recursive: true });
  await rm(path.join(dir, 'docs', 'tasks'), { recursive: true, force: true });
  const r = vima(dir, 'render-review');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  const html = await readFile(path.join(dir, reviewRel), 'utf8');
  assert.match(html, /任务清单不可用/, '缺任务时如实标注承接对账缺席');
});

// ── A14 分栏版面（regions）──────────────────────────────────────────────────
// 用独立副本，避免污染上方共享夹具的字节基线。

test('A14 向后兼容：黄金夹具无 regions → 不产生分栏结构、manifest 不写该键', async () => {
  const html = await readFile(path.join(root, protoRel), 'utf8');
  // 注意：类名在内联样式表里必然出现，故只能断言标记本身
  assert.ok(!html.includes('class="wf-cols"'), '未声明 regions 的页面不出现分栏容器');
  assert.ok(!html.includes('class="wf-col"'), '未声明 regions 的页面不出现列');
  const manifest = JSON.parse(await readFile(path.join(root, manifestRel), 'utf8'));
  for (const p of manifest.apps.admin.pages) {
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
  const p1 = manifest.apps.admin.pages.find((p) => p.id === 'PAGE-01');
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

// ── render-matrix：V-COV-01 的生成端（此前只有校验没有生成器）──

test('render-matrix：生成覆盖矩阵，字节确定，--check 通过；改产物后侦测漂移', async () => {
  const rel = path.join('docs', 'coverage-matrix.md');
  const p = path.join(root, rel);

  const r1 = vima(root, 'render-matrix');
  assert.equal(r1.status, 0, `stderr: ${r1.stderr}`);
  assert.match(r1.stdout, /覆盖矩阵已生成/);
  const first = await readFile(p, 'utf8');

  // 字节确定性：同样输入两次渲染完全一致
  assert.equal(vima(root, 'render-matrix').status, 0);
  assert.equal(await readFile(p, 'utf8'), first, '两次渲染应字节一致');

  // 结构：四列表头 + 每个 spec 页面一行 + 无空单元格（V-COV-01 口径）
  assert.match(first, /\| 需求 \| 接口 \| 契约 \| 任务 \|/);
  for (const line of first.split('\n').filter((l) => l.startsWith('| PAGE') || /^\| .+（PAGE-/.test(l))) {
    assert.ok(!/\|\s*\|/.test(line), `存在空单元格: ${line}`);
  }

  // --check 通过；手改后应侦测到漂移
  assert.equal(vima(root, 'render-matrix', '--check').status, 0);
  await writeFile(p, `${first}\n<!-- 手改 -->\n`);
  const drift = vima(root, 'render-matrix', '--check');
  assert.equal(drift.status, 2);
  assert.match(drift.stderr, /--check 失败/);
  await writeFile(p, first); // 复位，避免影响同文件后续用例
});

test('render-matrix：生成的矩阵能通过 V-COV-01', async () => {
  assert.equal(vima(root, 'render-matrix').status, 0);
  const r = vima(root, 'validate', '--artifact', 'docs/coverage-matrix.md');
  assert.equal(r.status, 0, `stderr: ${r.stderr}\nstdout: ${r.stdout}`);
});

// ── A16 多端渲染（golden-multi：admin-web + mp-native 双端）──────────────────

const GOLDEN_MULTI = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden-multi');

test('A16 多端原型：双端各一份产物、mp 端手机壳 + tabbar、manifest 顶层双端', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-c4-multi-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(GOLDEN_MULTI, dir, { recursive: true });
  const r = vima(dir, 'render-prototype');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);

  const adminHtml = await readFile(path.join(dir, 'docs/review/prototype.admin.html'), 'utf8');
  const patientHtml = await readFile(path.join(dir, 'docs/review/prototype.patient.html'), 'utf8');
  // admin 端：桌面侧栏外壳，只含本端页面
  assert.ok(adminHtml.includes('wf-side'), 'admin 端保留桌面侧栏外壳');
  assert.ok(adminHtml.includes('id="page-PAGE-01"'), 'admin 端含 PAGE-01');
  assert.ok(!adminHtml.includes('id="page-PAGE-11"'), 'admin 端不得混入患者页');
  // patient 端：手机壳 + tabbar（本端 menus），mp 词渲染
  assert.ok(patientHtml.includes('class="wf-phone"'), 'patient 端出手机壳');
  assert.ok(patientHtml.includes('wf-tabbar'), 'patient 端出 tabbar');
  assert.ok(patientHtml.includes('id="page-PAGE-11"') && patientHtml.includes('id="page-PAGE-12"'));
  assert.ok(!patientHtml.includes('id="page-PAGE-01"'), 'patient 端不得混入后台页');
  assert.ok(patientHtml.includes('wf-list'), 'mp 词 list 有特化渲染');
  assert.ok(patientHtml.includes('wf-actionbar'), 'mp 词 actionbar 渲染');
  // manifest：单文件顶层双端
  const manifest = JSON.parse(await readFile(path.join(dir, 'docs/review/prototype.manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest.apps).sort(), ['admin', 'patient']);
  assert.equal(manifest.apps.patient.pages.length, 2);

  // 字节确定性：重渲逐字节一致 + --check 通过
  const first = { a: adminHtml, p: patientHtml };
  assert.equal(vima(dir, 'render-prototype').status, 0);
  assert.equal(await readFile(path.join(dir, 'docs/review/prototype.admin.html'), 'utf8'), first.a);
  assert.equal(await readFile(path.join(dir, 'docs/review/prototype.patient.html'), 'utf8'), first.p);
  assert.equal(vima(dir, 'render-prototype', '--check').status, 0);

  // 多端全量 + --output → usage exit 3；--app 单端渲染合法
  assert.equal(vima(dir, 'render-prototype', '--output', 'x.html').status, 3);
  const single = vima(dir, 'render-prototype', '--app', 'patient');
  assert.equal(single.status, 0, `stderr: ${single.stderr}`);
  assert.equal(vima(dir, 'render-prototype', '--app', 'ghost').status, 3);
});

test('A16 多端审计视图：单文件、端徽标 + 页面按端分章；矩阵首列端', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-c4-multi-rev-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(GOLDEN_MULTI, dir, { recursive: true });
  assert.equal(vima(dir, 'render-review').status, 0);
  const review = await readFile(path.join(dir, 'docs/review/index.html'), 'utf8');
  assert.ok(review.includes('class="app-tag"'), '端徽标存在');
  assert.ok(review.includes('端：patient'), '页面详情按端分章');
  assert.ok(review.includes('端：admin'), '页面详情按端分章（admin）');

  assert.equal(vima(dir, 'render-matrix', '--check').status, 0, '夹具矩阵与生成器无漂移');
});

test('A16 单端回归：黄金夹具原型不出现手机壳/端徽标/端分组（零扰动）', async () => {
  const proto = await readFile(path.join(root, protoRel), 'utf8');
  assert.ok(!proto.includes('class="wf-phone"'), '单端不出手机壳节点');
  const review = await readFile(path.join(root, reviewRel), 'utf8');
  assert.ok(!review.includes('class="app-tag"'), '单端不出端徽标');
  assert.ok(!review.includes('class="app-group"'), '单端不出端分组标题');
});

// ── A27 PDL 投影：shape 驱动 / 附着动作 / 新词 / 抽屉 / 设计徽标 ──

test('A27：PDL 三列页各自可分辨——实例名/意图/形态/主列/密度/首屏承诺全部入画', async (t) => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'vima-c4-pdl-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  await cp(GOLDEN, tmp, { recursive: true });
  const specPath = path.join(tmp, 'docs', 'spec.md');
  let spec = await readFile(specPath, 'utf8');
  const tri = `
### PAGE-09 医师工作台

\`\`\`yaml vima:page
id: PAGE-09
title: 医师工作台
menu: MENU-01
design:
  pattern: workbench
  density: default
  fold: [待办清单]
layout: [steps, cards, cards, cards]
regions:
  - { blocks: [steps] }
  - columns:
      - { name: 待办, width: 264px, blocks: [cards] }
      - { name: 主工作区, width: 1fr, blocks: [cards], role: primary }
      - { name: 实时指标, width: 224px, blocks: [cards], density: compact }
components:
  - block: steps
    items:
      - { type: text, label: 筛查 }
      - { type: text, label: 评估 }
  - block: cards
    name: 待办清单
    intent: 第一眼要处理的事
    data: { shape: list, keyFields: [患者, 逾期天数] }
  - block: cards
    name: 患者卡片
    intent: 核心指标与快捷入口
    data: { shape: record, keyFields: [姓名, 诊断] }
    actions:
      - { type: button, label: 开处方, action: modal, target: MODAL-09, priority: primary }
      - { type: button, label: 打印, action: api, api: GET /api/device/list, priority: overflow }
  - block: cards
    name: 实时指标
    data: { shape: metrics, of: [热量达成, 蛋白达成] }
modals:
  - id: MODAL-09
    presentation: drawer
    title: 开处方
    fields:
      - { field: name, label: 处方名, type: input, required: true }
    submit: { api: POST /api/device }
apis: [GET /api/device/list, POST /api/device]
\`\`\`
`;
  spec = spec.replace('## 4. 接口清单', `${tri}\n## 4. 接口清单`);
  await writeFile(specPath, spec);
  assert.equal(vima(tmp, 'render-prototype').status, 0);
  const html = await readFile(path.join(tmp, 'docs', 'review', 'prototype.html'), 'utf8');
  const seg = html.slice(html.indexOf('id="page-PAGE-09"'));
  // 三列内容各自可分辨（S4 的验收：不再是三个一样的灰盒）
  for (const marker of [
    '<b>待办清单</b>', '<b>患者卡片</b>', '<b>实时指标</b>',                      // 实例名
    'wf-kf">患者', 'wf-kv"><span class="wf-label">姓名', 'wf-ring',              // 三种形态三种画法
    'wf-design">workbench', '首屏 待办清单',                                      // 设计徽标与首屏承诺
    'wf-col-primary', 'wf-density">compact',                                     // 主列与列密度
    'wf-btn-primary', 'wf-more" title="收纳动作：打印">⋯ 1',                     // 优先级与收纳
    'wf-steps', 'wf-step-on">筛查',                                              // 新词 steps
    'wf-drawer',                                                                 // 抽屉呈现
  ]) {
    assert.ok(seg.includes(marker), `渲染缺少 PDL 投影: ${marker}`);
  }
  // 附着动作进 manifest 连线（buildLinks 走 actions[]）
  const manifest = JSON.parse(await readFile(path.join(tmp, 'docs', 'review', 'prototype.manifest.json'), 'utf8'));
  // §6.7 A16 形态：顶层 apps map（N=1 亦然）
  const p9 = Object.values(manifest.apps)[0].pages.find((p) => p.id === 'PAGE-09');
  assert.ok(p9.links.some((l) => l.kind === 'modal' && l.to === 'MODAL-09'), 'actions 的 modal 连线应入 manifest');
  // 确定性
  assert.equal(vima(tmp, 'render-prototype', '--check').status, 0, '连渲两次须字节一致');
});

test('A27：collapse/anchor 两个新词有专属画法且过词表校验', async (t) => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'vima-c4-words-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  await cp(GOLDEN, tmp, { recursive: true });
  const specPath = path.join(tmp, 'docs', 'spec.md');
  let spec = await readFile(specPath, 'utf8');
  spec = spec.replace('layout: [toolbar, form]', 'layout: [anchor, toolbar, form, collapse]');
  spec = spec.replace(
    `  - block: toolbar
    items:
      - { type: button, label: 返回列表, action: nav, target: PAGE-01 }`,
    `  - block: anchor
    items:
      - { type: text, label: 基本信息 }
      - { type: text, label: 运行记录 }
  - block: toolbar
    items:
      - { type: button, label: 返回列表, action: nav, target: PAGE-01 }
  - block: collapse
    items:
      - { type: text, label: 高级参数 }`,
  );
  await writeFile(specPath, spec);
  assert.equal(vima(tmp, 'validate').status, 0, '新词应过 V-SPEC-04（四处词表已同步）');
  assert.equal(vima(tmp, 'render-prototype').status, 0);
  const html = await readFile(path.join(tmp, 'docs', 'review', 'prototype.html'), 'utf8');
  assert.ok(html.includes('wf-anchor">') && html.includes('wf-chip">基本信息'));
  assert.ok(html.includes('wf-collapse-item') && html.includes('<summary>高级参数</summary>'));
});
