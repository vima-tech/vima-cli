// D2 单测：A42 接缝对账的 hook 侧（templates/admin/workspace/hooks/post-write.mjs）
//
// 覆盖两条规格：
//   D-A42-01 区块对账按页聚合——合并页（壳页 + panes/ 子目录）编辑不再必 exit 2，
//            但**整页合起来仍缺**时照常 exit 2（检查不得被改成永真）。
//   D-A42-04 verifier 报告的 contractGaps 通道——可选字段、不计 fail、
//            存量报告不带该字段照常通过校验。
//
// 实证来源：docs/design/v2.1-amendments.md §A42（sustain-v4 全流程实跑取证）——
//   · PatientWorkspace/index.vue 是 PAGE-03 壳页，只声明 4 个 data-block，
//     其余 6 个 block 与 25 个 data-modal 分散在九个 pane 文件里；
//   · page-68-fe 的 verifier 判 pass、checklist 全过、missing 为空，journal 却记 fail。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOOK = path.join(CLI_ROOT, 'templates/admin/workspace/hooks/post-write.mjs');

function runHook(root, relFile) {
  const input = JSON.stringify({ cwd: root, tool_input: { file_path: relFile } });
  return spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8' });
}

/** 带项目标记（A40 判据）的临时项目；manifest 为 null 时不落原型清单。 */
async function project(t, manifest) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-a42-hook-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.vima'), { recursive: true });
  if (manifest) {
    await mkdir(path.join(root, 'docs/review'), { recursive: true });
    await writeFile(path.join(root, 'docs/review/prototype.manifest.json'), JSON.stringify(manifest));
  }
  return root;
}

// PAGE-03 的形态照搬 sustain-v4：壳页只担 4 个 block，其余分散在 pane 里。
const SHELL_BLOCKS = ['cards', 'anchor', 'table', 'steps'];
const PANE_A_BLOCKS = ['toolbar', 'search', 'tabs'];
const PANE_B_BLOCKS = ['form', 'collapse', 'pagination'];
const MERGED_MANIFEST = {
  pages: [{
    id: 'PAGE-03',
    layout: [...SHELL_BLOCKS, ...PANE_A_BLOCKS, ...PANE_B_BLOCKS],
    modals: [{ id: 'MODAL-01' }, { id: 'MODAL-02' }, { id: 'MODAL-03' }],
  }],
};

const div = (blocks) => blocks.map((b) => `<div data-block="${b}"></div>`).join('');
const shellVue = (blocks = SHELL_BLOCKS) =>
  `<template><div class="vui-page" data-page="PAGE-03">${div(blocks)}</div></template>`;
const paneVue = (blocks, modals = []) =>
  `<template><section>${div(blocks)}${modals.map((m) => `<M data-modal="${m}"/>`).join('')}</section></template>`;

/** 铺一份完整的合并页：壳页 + panes/{a,b} 两个片段（片段不自带 data-page）。 */
async function mergedPage(root, { shell = SHELL_BLOCKS, paneA = PANE_A_BLOCKS, paneB = PANE_B_BLOCKS,
  modalsA = ['MODAL-01', 'MODAL-02'], modalsB = ['MODAL-03'] } = {}) {
  const base = path.join(root, 'src/views/PatientWorkspace');
  await mkdir(path.join(base, 'panes/overview'), { recursive: true });
  await mkdir(path.join(base, 'panes/records'), { recursive: true });
  await writeFile(path.join(base, 'index.vue'), shellVue(shell));
  await writeFile(path.join(base, 'panes/overview/index.vue'), paneVue(paneA, modalsA));
  await writeFile(path.join(base, 'panes/records/index.vue'), paneVue(paneB, modalsB));
  return 'src/views/PatientWorkspace/index.vue';
}

// ── D-A42-01：区块对账按页聚合 ──────────────────────────────────────────────

test('D-A42-01：合并页壳页编辑不再 exit 2——block/modal 分散在 panes/ 子目录里也算数', async (t) => {
  const root = await project(t, MERGED_MANIFEST);
  const shell = await mergedPage(root);
  const r = runHook(root, shell);
  assert.equal(r.status, 0, `合并页壳页应放行（这是 A42 立项的实证缺陷），stderr: ${r.stderr}`);
});

test('D-A42-01：整页合起来仍缺 → 照常 exit 2（聚合不得把检查改成永真）', async (t) => {
  const root = await project(t, MERGED_MANIFEST);
  // pane B 少了 pagination，且没有任何文件声明 MODAL-03
  const shell = await mergedPage(root, { paneB: ['form', 'collapse'], modalsB: [] });
  const r = runHook(root, shell);
  assert.equal(r.status, 2, '整页聚合后仍缺的区块必须照报');
  assert.match(r.stderr, /缺区块标记 data-block：pagination/);
  assert.match(r.stderr, /缺弹窗标记 data-modal：MODAL-03/);
  assert.doesNotMatch(r.stderr, /toolbar|search|tabs|form|collapse/, '已由 pane 兑现的区块不得再报缺');
  assert.match(r.stderr, /同页文件集合聚合/, 'stderr 须说明聚合作用域，便于人核对（hook 既有纪律）');
});

test('D-A42-01：同目录另一个页面单元不得掩盖本页缺失（自带 data-page = 独立页面单元）', async (t) => {
  const root = await project(t, {
    pages: [
      { id: 'PAGE-01', layout: ['search', 'table'], modals: [{ id: 'MODAL-01' }] },
      { id: 'PAGE-02', layout: ['search', 'table'], modals: [{ id: 'MODAL-01' }] },
    ],
  });
  await mkdir(path.join(root, 'src/views'), { recursive: true });
  // 同目录里 PAGE-02 是完整实现——它带 data-page，属于自己的页对账，不得并进 PAGE-01
  await writeFile(path.join(root, 'src/views/Full.vue'),
    '<template><div class="vui-page" data-page="PAGE-02"><div data-block="search"></div>'
    + '<div data-block="table"></div><M data-modal="MODAL-01"/></div></template>');
  await writeFile(path.join(root, 'src/views/Half.vue'),
    '<template><div class="vui-page" data-page="PAGE-01"><div data-block="search"></div></div></template>');
  const r = runHook(root, 'src/views/Half.vue');
  assert.equal(r.status, 2, '邻居页面的完整实现不得让本页的缺失蒸发');
  assert.match(r.stderr, /缺区块标记 data-block：table/);
  assert.match(r.stderr, /缺弹窗标记 data-modal：MODAL-01/);
});

test('D-A42-01：「多出设计外区块」仍按被写文件判——越界标记的责任田是写它的那个文件', async (t) => {
  const root = await project(t, MERGED_MANIFEST);
  const shell = await mergedPage(root, { shell: [...SHELL_BLOCKS, 'timeline'] });
  const r = runHook(root, shell);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /多出设计外区块标记 data-block：timeline/);
});

test('D-A42-01：聚合面止于本页目录树——vendor/node_modules 与自带页号的片段都不并入', async (t) => {
  const root = await project(t, MERGED_MANIFEST);
  const base = path.join(root, 'src/views/PatientWorkspace');
  await mergedPage(root, { paneB: [] });
  // ① 深处的 node_modules 里即便有同名标记也不算数（扫描面必须有界）
  await mkdir(path.join(base, 'node_modules/x'), { recursive: true });
  await writeFile(path.join(base, 'node_modules/x/index.vue'), paneVue(['form', 'collapse', 'pagination']));
  // ② 自带 data-page 的子文件是独立页面单元
  await mkdir(path.join(base, 'panes/other'), { recursive: true });
  await writeFile(path.join(base, 'panes/other/index.vue'),
    `<template><div class="vui-page" data-page="PAGE-77">${div(['form', 'collapse', 'pagination'])}</div></template>`);
  const r = runHook(root, 'src/views/PatientWorkspace/index.vue');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /form/);
  assert.match(r.stderr, /pagination/);
});

test('D-A42-01：mp-native 的 .wxml 同样按页聚合（A23 机制对位复制）', async (t) => {
  const root = await project(t, {
    schemaVersion: '1',
    apps: { patient: { pages: [{ id: 'PAGE-11', layout: ['banner', 'form'], modals: [] }] } },
  });
  await writeFile(path.join(root, '.vima/manifest.json'), JSON.stringify({
    schemaVersion: '2',
    templateId: 'admin',
    apps: [{ id: 'patient', kind: 'mp-native', dir: 'apps/patient', codeDir: 'src', sharedDirs: [] }],
  }));
  const dir = path.join(root, 'apps/patient/src/pages/home');
  await mkdir(path.join(dir, 'parts'), { recursive: true });
  await writeFile(path.join(dir, 'index.wxml'),
    '<view class="vm-page" data-page="PAGE-11"><view data-block="banner"></view></view>');
  // 片段还没写 → 仍报缺
  const before = runHook(root, 'apps/patient/src/pages/home/index.wxml');
  assert.equal(before.status, 2, `stderr: ${before.stderr}`);
  assert.match(before.stderr, /缺区块标记 data-block：form/);
  // 片段落在子目录里 → 放行
  await writeFile(path.join(dir, 'parts/form.wxml'), '<view data-block="form"></view>');
  const after = runHook(root, 'apps/patient/src/pages/home/index.wxml');
  assert.equal(after.status, 0, `mp 端合并页应同样放行，stderr: ${after.stderr}`);
});

// ── D-A42-04：verifier 报告的 contractGaps 通道 ────────────────────────────

const REPORT_REL = '.vima/reports/page-68-fe-verifier.json';

async function writeReport(root, rep) {
  await mkdir(path.join(root, '.vima/reports'), { recursive: true });
  await writeFile(path.join(root, REPORT_REL), JSON.stringify(rep));
}
async function journalRows(root) {
  const text = await readFile(path.join(root, '.vima/reports/journal.jsonl'), 'utf8');
  return text.trim().split('\n').map((l) => JSON.parse(l));
}

const PASSING = {
  taskId: 'page-68-fe',
  round: 1,
  result: 'pass',
  checklist: [{ point: 'C1', passed: true }],
  points: [{ point: 'P1', passed: true }],
  missing: [],
  contractViolations: [],
};

test('D-A42-04：带 contractGaps 的报告不计 fail（page-68-fe 实证：处置恰当却被记 fail）', async (t) => {
  const root = await project(t, null);
  await writeReport(root, {
    ...PASSING,
    contractGaps: [
      { ref: 'attachmentId?', note: '契约声明入参，33 个端点无任何上传端点；控件置灰 + 说明文案' },
      { ref: 'exportUrl?', note: '同上' },
    ],
  });
  const r = runHook(root, REPORT_REL);
  assert.equal(r.status, 0);
  const row = (await journalRows(root)).at(-1);
  assert.equal(row.outcome, 'pass', 'contractGaps 是「规格有缺口 + 实现侧合规处置」，不计 fail');
  assert.equal(row.n, 0, 'n 严格保持契约 §6.21 原义「未过 point 数」，缺口不并进来');
  assert.match(r.stderr, /契约缺口已登记（不计 fail）/, '不计 fail 不等于静默——条数须当场可见');
  assert.match(r.stderr, /contractGaps 2 条/);
  assert.match(r.stderr, /收口清单/, '须指明下一步归 converge 收口');
});

test('D-A42-04：contractViolations 保持原义——真越界照常计 fail', async (t) => {
  const root = await project(t, null);
  await writeReport(root, { ...PASSING, contractViolations: [{ ref: '越界改了共享层' }] });
  const r = runHook(root, REPORT_REL);
  assert.equal(r.status, 0);
  const row = (await journalRows(root)).at(-1);
  assert.equal(row.outcome, 'fail');
  assert.equal(row.n, 1);
  assert.doesNotMatch(r.stderr, /契约缺口/, '没有缺口就不该提缺口');
});

test('D-A42-04：存量报告不带 contractGaps → 照常通过校验并落 report 事件（向后兼容）', async (t) => {
  const root = await project(t, null);
  await writeReport(root, PASSING);
  assert.equal(Object.hasOwn(PASSING, 'contractGaps'), false, '夹具须确实不带该字段');
  const r = runHook(root, REPORT_REL);
  assert.equal(r.status, 0);
  const rows = await journalRows(root);
  assert.equal(rows.length, 1, '缺省该字段不得让整条事件掉盘');
  assert.deepEqual(
    { kind: rows[0].kind, ref: rows[0].ref, outcome: rows[0].outcome, n: rows[0].n },
    { kind: 'report', ref: 'page-68-fe/verifier/r1', outcome: 'pass', n: 0 },
  );
  assert.doesNotMatch(r.stderr, /契约缺口/);
});

test('D-A42-04：contractGaps 类型不对 → 整条不记（宁缺勿假，与既有空壳/冒名同口径）', async (t) => {
  const root = await project(t, null);
  await writeReport(root, { ...PASSING, contractGaps: 3 });
  const r = runHook(root, REPORT_REL);
  assert.equal(r.status, 0, '采集是旁路，不得改变退出码');
  await assert.rejects(
    readFile(path.join(root, '.vima/reports/journal.jsonl'), 'utf8'),
    { code: 'ENOENT' },
    '协议没对齐的报告不得生成证据',
  );
});

test('D-A42-04：journal 事件仍是五键封顶、ref 仍可被内核逐条解析（不得为缺口开第六个键）', async (t) => {
  const root = await project(t, null);
  await writeReport(root, { ...PASSING, contractGaps: [{ ref: 'x' }] });
  runHook(root, REPORT_REL);
  const row = (await journalRows(root))[0];
  const KEYS = new Set(['ts', 'kind', 'ref', 'outcome', 'n']);
  for (const k of Object.keys(row)) assert.ok(KEYS.has(k), `键越出五键封顶（契约 §6.21）：${k}`);
  assert.match(row.ref, /^(.+)\/(verifier|builder)\/r(\d+)$/, 'ref 形状是 progress/journal 两处解析的前提');
});

// ── D-A43-01：verifier 报告的 commands 通道（可选字段 + 形状校验）────────────

test('D-A43-01：带 commands 的报告照常记事件，n 仍是「未过 point 数」', async (t) => {
  const root = await project(t, null);
  await writeReport(root, {
    ...PASSING,
    commands: [{ cmd: './mvnw -o -q test', exitCode: 0 }, { cmd: 'npm run lint', exitCode: 0 }],
  });
  const r = runHook(root, REPORT_REL);
  assert.equal(r.status, 0);
  const row = (await journalRows(root)).at(-1);
  assert.equal(row.outcome, 'pass');
  assert.equal(row.n, 0, 'commands 不折进 n——事件五键封顶与 n 的原义都不变');
  assert.equal(row.cmd, undefined, 'commands 不得渗进 journal 事件的键');
});

test('D-A43-01：不带 commands 的存量报告照常通过校验（可选字段）', async (t) => {
  const root = await project(t, null);
  await writeReport(root, PASSING);
  assert.equal(runHook(root, REPORT_REL).status, 0);
  assert.equal((await journalRows(root)).at(-1).outcome, 'pass');
});

test('D-A43-01：commands 形状不合 → 整条不记（宁缺勿假，同空壳/冒名口径）', async (t) => {
  for (const bad of [
    'not-an-array',
    [{ cmd: 'npm test' }],                      // 缺 exitCode
    [{ cmd: 'npm test', exitCode: '0' }],       // exitCode 非整数
    [{ cmd: '   ', exitCode: 0 }],              // cmd 空白
    [{ exitCode: 0 }],                          // 缺 cmd
    [null],
  ]) {
    const root = await project(t, null);
    await writeReport(root, { ...PASSING, commands: bad });
    assert.equal(runHook(root, REPORT_REL).status, 0, '形状不合不阻断写入，只是不记事件');
    let rows = [];
    try { rows = await journalRows(root); } catch { rows = []; }
    assert.equal(
      rows.filter((x) => x.kind === 'report').length, 0,
      `commands=${JSON.stringify(bad)} 应整条不记`,
    );
  }
});
