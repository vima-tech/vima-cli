// C3 单测：vima context —— 确定性上下文打包（A8，契约 §6.11/§14）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../../lib/util/fs.mjs';
import { componentsOfPage } from '../../lib/commands/context.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(HERE, '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');

async function cloneGolden(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-context-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(GOLDEN, root, { recursive: true });
  return root;
}

function vima(cwd, ...args) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('context：黄金夹具打包——含任务原文/契约/页面块/字节计量，字节确定', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'context', 'device-list-fe');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /上下文包：\.vima\/context\/device-list-fe\.md（共 \d+ 字节）/);
  assert.match(r.stdout, /任务文件 \d+ 字节/);

  const bundle = await readFile(path.join(root, '.vima/context/device-list-fe.md'), 'utf8');
  assert.match(bundle, /# 任务上下文包：device-list-fe/);
  assert.match(bundle, /## 任务文件（docs\/tasks\/device-list-fe\.md）/);
  assert.match(bundle, /GET \/api\/device\/list/, '契约原文应在包内');
  assert.match(bundle, /```yaml vima:page/, '页面块须以 yaml 围栏原文打包');
  assert.match(bundle, /id: PAGE-01/);
  assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(bundle.split('\n')[0]), '包头不得含时间戳');

  // 字节确定：重跑同输入同字节
  const h1 = sha256(bundle);
  assert.equal(vima(root, 'context', 'device-list-fe').code, 0);
  const h2 = sha256(await readFile(path.join(root, '.vima/context/device-list-fe.md'), 'utf8'));
  assert.equal(h1, h2);
});

test('context：组件文档切片——按受限词表映射，已安装的打包、缺失的标注跳过', async (t) => {
  const root = await cloneGolden(t);
  // 夹具无 docs/ui-framework：全部缺失 → 标注跳过
  assert.equal(vima(root, 'context', 'device-list-fe').code, 0);
  let bundle = await readFile(path.join(root, '.vima/context/device-list-fe.md'), 'utf8');
  assert.match(bundle, /文档缺失跳过/);

  // 安装一份 VTable.md 后重打包 → 切片进入包内
  await mkdir(path.join(root, 'docs/ui-framework'), { recursive: true });
  await writeFile(path.join(root, 'docs/ui-framework/VTable.md'), '# VTable\n\n表格组件文档正文。\n');
  assert.equal(vima(root, 'context', 'device-list-fe').code, 0);
  bundle = await readFile(path.join(root, '.vima/context/device-list-fe.md'), 'utf8');
  assert.match(bundle, /### VTable/);
  assert.match(bundle, /表格组件文档正文/);
});

test('context：--budget 超限 → CONTEXT_BUDGET exit 2 且包仍写盘；足额预算 → exit 0', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'context', 'device-list-fe', '--budget', '100');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /CONTEXT_BUDGET/);
  assert.match(r.stderr, /超出预算 100/);
  assert.ok(
    (await readFile(path.join(root, '.vima/context/device-list-fe.md'), 'utf8')).length > 0,
    '超限时包仍写盘便于排查',
  );
  assert.equal(vima(root, 'context', 'device-list-fe', '--budget', '1000000').code, 0);
});

test('context：--stdout 输出包内容不写盘；未知任务 → USAGE exit 3；预算参数非法 → exit 3', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'context', 'device-api-be', '--stdout');
  assert.equal(r.code, 0);
  assert.match(r.stdout, /# 任务上下文包：device-api-be/);
  assert.match(r.stdout, /## 契约（docs\/contracts\/device-api\.md）/);
  assert.ok(!r.stdout.includes('vima:page'), '无 page 字段的任务不含页面块章节');

  const bad = vima(root, 'context', 'no-such-task');
  assert.equal(bad.code, 3);
  assert.match(bad.stderr, /未知任务 "no-such-task"/);

  assert.equal(vima(root, 'context', 'device-list-fe', '--budget', 'abc').code, 3);
});

test('componentsOfPage：受限词表映射（契约 §6.11）——去重排序、modals 触发 VLayer、未知词跳过', () => {
  const page = {
    layout: ['search', 'toolbar', 'table', 'pagination'],
    components: [
      { block: 'search', items: [{ type: 'input' }, { type: 'select' }] },
      { block: 'toolbar', items: [{ type: 'button' }] },
      { block: 'table', rowActions: [{ label: '编辑' }] },
      { block: 'pagination', items: [] },
    ],
    modals: [{ id: 'MODAL-01', fields: [{ type: 'input' }, { type: 'unknown-widget' }] }],
  };
  assert.deepEqual(componentsOfPage(page), [
    'VButton', 'VForm', 'VFormItem', 'VInput', 'VLayer', 'VPagination', 'VSelect', 'VTable',
  ]);
  assert.deepEqual(componentsOfPage({ layout: [], components: [], modals: [] }), []);
});
