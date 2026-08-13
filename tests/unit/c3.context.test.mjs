// C3 单测：vima context —— 确定性上下文打包（A8，契约 §6.11/§14）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../../lib/util/fs.mjs';
import { componentsOfPage, rulesForTask, sliceContract, sliceContractBlock } from '../../lib/commands/context.mjs';
import { extractBlocks } from '../../lib/util/md.mjs';
import { readFileSync } from 'node:fs';

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

// ── A13：业务规则切片 + 本期不做（契约 §6.11）──

test('rulesForTask（A13）：apis 交集命中 + 全局规则始终入选 + 按 id 升序（归一大小写）', () => {
  // 期望值手工推演（独立事实源，A10）：任务 apis = {GET /api/a}
  //   RULE-03 apis=[POST /api/b] → 无交集，落选
  //   RULE-01 apis=[get /api/a]  → 归一为 GET /api/a，命中
  //   RULE-02 无 apis            → 全局规则，入选
  //   RULE-04 apis=[DELETE /api/z] → 落选
  const rules = [
    { id: 'RULE-03', apis: ['POST /api/b'] },
    { id: 'RULE-01', apis: ['get /api/a'] },
    { id: 'RULE-02' },
    { id: 'RULE-04', apis: ['DELETE /api/z'] },
  ];
  assert.deepEqual(
    rulesForTask(rules, new Set(['GET /api/a'])).map((r) => r.id),
    ['RULE-01', 'RULE-02'],
  );
  // 任务 apis 为空：只剩全局规则
  assert.deepEqual(rulesForTask(rules, new Set()).map((r) => r.id), ['RULE-02']);
  assert.deepEqual(rulesForTask([], new Set(['GET /api/a'])), []);
  assert.deepEqual(rulesForTask(undefined, new Set()), []);
});

test('context：包内含业务规则切片与本期不做两节（前端与后端任务都拿得到）', async (t) => {
  const root = await cloneGolden(t);
  for (const taskId of ['device-list-fe', 'device-api-be']) {
    const r = vima(root, 'context', taskId, '--stdout');
    assert.equal(r.code, 0, `${taskId} stderr: ${r.stderr}`);
    assert.match(r.stdout, /## 业务规则切片/, `${taskId} 缺业务规则切片`);
    assert.match(r.stdout, /\*\*RULE-01\*\*〔validation〕Device/, `${taskId} 缺 RULE-01`);
    // RULE-06 无 apis → 全局规则，任何任务都应拿到
    assert.match(r.stdout, /\*\*RULE-06\*\*.*\n\s+适用范围：全局规则（不限接口）/, `${taskId} 缺全局规则`);
    assert.match(r.stdout, /## 本期不做（范围红线）/, `${taskId} 缺本期不做`);
    assert.match(r.stdout, /\*\*NG-01\*\*：不做设备数据导出/, `${taskId} 缺 NG-01`);
    assert.match(r.stdout, /Verifier 会记 fail/, `${taskId} 缺越界后果说明`);
  }
});

test('context：空 non-goals 声明渲染为「已显式声明」而非缺声明（两者必须可区分）', async (t) => {
  const root = await cloneGolden(t);
  const p = path.join(root, 'docs/spec.md');
  const text = await readFile(p, 'utf8');
  await writeFile(p, text.replace(/```yaml vima:non-goals\n[\s\S]*?```/, '```yaml vima:non-goals\nnon-goals: []\n```'));
  const r = vima(root, 'context', 'device-list-fe', '--stdout');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /本期无 non-goals 声明：spec 第九章已显式写/);
  assert.doesNotMatch(r.stdout, /第九章未声明 vima:non-goals/);
});

// ── A18 契约切片（任务声明 apis 负责集时只打包本任务那份）──

test('sliceContract/sliceContractBlock：只保留负责集小节，机读块同步过滤且条目完整', () => {
  const text = readFileSync(path.join(GOLDEN, 'docs/contracts/device-api.md'), 'utf8');
  const owned = new Set(['GET /api/device/list', 'POST /api/device']);
  const sliced = sliceContract(text, owned);
  assert.equal(sliced.kept, 2);
  assert.equal(sliced.dropped, 2);
  assert.ok(sliced.text.includes('## GET /api/device/list'));
  assert.ok(!sliced.text.includes('## POST /api/device/batch-delete'));
  // 非接口小节原样保留
  assert.ok(sliced.text.includes('## 共享类型定义'));

  const full = sliceContractBlock(sliced.text, owned);
  const blocks = extractBlocks(full, 'contract', { path: 'docs/contracts/device-api.md' });
  assert.deepEqual(
    blocks[0].data.apis.map((a) => `${a.method} ${a.path}`),
    ['GET /api/device/list', 'POST /api/device'],
  );
  // 条目内的嵌套 request/response/errors 不得被当成新条目切碎
  assert.equal(blocks[0].data.apis[0].request.length, 4);
  assert.equal(blocks[0].data.apis[0].errors.length, 1);
  assert.equal(blocks[0].data.module, 'device'); // 块内非 apis 键不动
});

test('sliceContract：未声明负责集时零改变；多接口标题任一命中即整段保留', () => {
  const text = '# C\n\n## GET /api/a / POST /api/b\n\nbody\n\n## GET /api/c\n\nx\n';
  const hit = sliceContract(text, new Set(['POST /api/b']));
  assert.equal(hit.kept, 1);
  assert.equal(hit.dropped, 1);
  assert.ok(hit.text.includes('## GET /api/a / POST /api/b'));
  assert.ok(!hit.text.includes('## GET /api/c'));
});

test('context：任务声明 apis → 包内契约被切片且分节 note 标注保留/删除数', async (t) => {
  const root = await cloneGolden(t);
  const rel = 'docs/tasks/device-api-be.md';
  const p = path.join(root, rel);
  const original = await readFile(p, 'utf8');
  await writeFile(
    p,
    original.replace(
      'contract: docs/contracts/device-api.md',
      "contract: docs/contracts/device-api.md\napis: ['GET /api/device/list', 'POST /api/device']",
    ),
  );

  const r = vima(root, 'context', 'device-api-be');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /按 apis 切片：保留 2 \/ 删除 2 个接口小节/);

  const bundle = await readFile(path.join(root, '.vima', 'context', 'device-api-be.md'), 'utf8');
  assert.ok(bundle.includes('## GET /api/device/list'), '负责集内的小节应保留');
  assert.ok(!bundle.includes('## POST /api/device/batch-delete'), '负责集外的小节应删除');
});
