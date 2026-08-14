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

// ── A22 两条检索线（出自 sustain-v3 实测：Builder 把契约当唯一事实来源 ⇒ 降级实现）──

test('A22 检索线一：无 @vima 标注的 api 封装进「系统底座接口索引」（导出名 + 请求路径）', async (t) => {
  const root = await cloneGolden(t);
  await mkdir(path.join(root, 'src/api'), { recursive: true });
  await writeFile(
    path.join(root, 'src/api/system.ts'),
    '// 系统底座：部门与用户（无 @vima 标注 = 不属任何任务）\n'
      + 'import { request } from "../utils/request"\n\n'
      + 'export function getDeptList(params) {\n  return request.get("/system/dept/list", { params })\n}\n\n'
      + 'export function getUserList(params) {\n  return request.get("/system/user/list", { params })\n}\n',
  );
  const r = vima(root, 'context', 'device-list-fe');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const bundle = await readFile(path.join(root, '.vima/context/device-list-fe.md'), 'utf8');
  assert.ok(bundle.includes('## 系统底座接口索引'), '须有底座索引一节');
  assert.ok(bundle.includes('getDeptList'), '底座导出函数名须出现');
  assert.ok(bundle.includes('GET /system/dept/list'), '底座请求路径须出现');
  assert.ok(bundle.includes('要查三条线'), '须写明「契约里没写 ≠ 系统里没有」的判断口径');
});

test('A22 检索线一：带 @vima 标注的业务代码不进索引（索引只收底座/共享层）', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'context', 'device-list-fe');
  assert.equal(r.code, 0);
  const bundle = await readFile(path.join(root, '.vima/context/device-list-fe.md'), 'utf8');
  // 夹具的 src/api/device.ts 带 @vima device-list-fe → 属业务任务产出，不该被当成底座
  assert.ok(!/索引[\s\S]*device\.ts/.test(bundle.split('## 系统底座接口索引')[1] ?? ''), 'device.ts 不应进底座索引');
  assert.match(r.stdout, /系统底座接口索引 \d+ 字节（无命中）/);
});

test('A22 检索线二：spec 指名的 docs/raw 引用带行号 → 附前后各 20 行片段', async (t) => {
  const root = await cloneGolden(t);
  await mkdir(path.join(root, 'docs/raw'), { recursive: true });
  await writeFile(
    path.join(root, 'docs/raw/FlowSteps.vue'),
    'export const STEPS = [\n  { key: "screening", roles: ["nurse"] },\n  { key: "followup", roles: ["nurse"] },\n]\n',
  );
  const specPath = path.join(root, 'docs/spec.md');
  const spec = await readFile(specPath, 'utf8');
  await writeFile(
    specPath,
    spec.replace('## 5. 业务规则', '## 5. 业务规则\n\n九步角色真源为 `docs/raw/FlowSteps.vue:2`。\n'),
  );
  const r = vima(root, 'context', 'device-list-fe');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const bundle = await readFile(path.join(root, '.vima/context/device-list-fe.md'), 'utf8');
  assert.ok(bundle.includes('## 真源片段'), '须有真源片段一节');
  assert.ok(bundle.includes('docs/raw/FlowSteps.vue:2'), '须标注引用出处与行号');
  assert.ok(bundle.includes('key: "screening"'), '须附上真源内容本身');
});

test('A22 检索线二：引用的文件不存在 → 如实标注跳过，不静默丢弃', async (t) => {
  const root = await cloneGolden(t);
  const specPath = path.join(root, 'docs/spec.md');
  const spec = await readFile(specPath, 'utf8');
  await writeFile(specPath, spec.replace('## 5. 业务规则', '## 5. 业务规则\n\n真源见 `docs/raw/nope.vue`。\n'));
  const r = vima(root, 'context', 'device-list-fe');
  assert.equal(r.code, 0);
  const bundle = await readFile(path.join(root, '.vima/context/device-list-fe.md'), 'utf8');
  assert.ok(bundle.includes('引用了但文件不存在'), '缺失须如实标注');
  assert.ok(bundle.includes('docs/raw/nope.vue'), '须点名缺失文件');
});

test('A22：两条检索线不破坏确定性（同输入两次打包字节一致）', async (t) => {
  const root = await cloneGolden(t);
  await mkdir(path.join(root, 'src/api'), { recursive: true });
  await writeFile(path.join(root, 'src/api/system.ts'), 'export function a() { return request.get("/x") }\n');
  vima(root, 'context', 'device-list-fe');
  const first = await readFile(path.join(root, '.vima/context/device-list-fe.md'), 'utf8');
  vima(root, 'context', 'device-list-fe');
  assert.equal(await readFile(path.join(root, '.vima/context/device-list-fe.md'), 'utf8'), first);
});

// ── A24/F9：项目补充规范（受管基线之外的落点）──

test('A24：docs/coding-standards.local.md 存在时作为独立一节随包分发', async (t) => {
  const root = await cloneGolden(t);
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await writeFile(path.join(root, 'docs/coding-standards.local.md'), '# 本项目补充\n\n- 金额一律用 BigDecimal\n');
  const r = vima(root, 'context', 'device-list-fe');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const bundle = await readFile(path.join(root, '.vima/context/device-list-fe.md'), 'utf8');
  assert.ok(bundle.includes('## 项目补充规范'), '须有项目补充规范一节');
  assert.ok(bundle.includes('BigDecimal'), '须附上项目自己的内容');
  assert.ok(bundle.includes('以本节为准'), '须写明与受管基线冲突时的优先级');
  assert.match(r.stdout, /项目补充规范 \d+ 字节/);
});

test('A24：无 local 文件时不出现该节（可选文件，不制造空壳）', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'context', 'device-list-fe');
  assert.equal(r.code, 0);
  const bundle = await readFile(path.join(root, '.vima/context/device-list-fe.md'), 'utf8');
  assert.ok(!bundle.includes('## 项目补充规范'));
});

test('A34 检索线三：D1/D2 上下文同时携带本页稿、端级方向、交互语言与相邻稿', async (t) => {
  const root = await cloneGolden(t);
  const specPath = path.join(root, 'docs/spec.md');
  await writeFile(specPath, (await readFile(specPath, 'utf8'))
    .replace('  fidelity: D0                # A34 V-DSN-12', '  fidelity: D1                # A34 V-DSN-12')
    .replace('  fold: [设备表格]', '  fold: [设备表格]\n  primaryTask: 快速定位并处置异常设备'));
  for (const [dir, manifest] of [
    ['docs/review/design/PAGE-01', { pageId: 'PAGE-01', files: ['default.png', 'empty.png'] }],
    ['docs/review/design/PAGE-02', { pageId: 'PAGE-02', files: ['default.png'] }],
    ['docs/review/design/_shell/admin', { appId: 'admin', files: ['brief.md', 'selection.md'] }],
  ]) {
    await mkdir(path.join(root, dir), { recursive: true });
    await writeFile(path.join(root, dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    for (const file of manifest.files.filter((f) => f.endsWith('.png'))) {
      await writeFile(path.join(root, dir, file), `stub:${file}\n`);
    }
  }
  await writeFile(path.join(root, 'docs/interaction-language.md'), '# Interaction language\n');
  await mkdir(path.join(root, '.vima/mock'), { recursive: true });
  await writeFile(path.join(root, '.vima/mock/contract-mock.json'), '{"schemaVersion":"1","apis":[]}\n');

  assert.equal(vima(root, 'context', 'device-list-fe').code, 0);
  const bundle = await readFile(path.join(root, '.vima/context/device-list-fe.md'), 'utf8');
  assert.match(bundle, /视觉真源.*docs\/review\/design\/PAGE-01/s);
  assert.match(bundle, /所属端方向基线.*_shell\/admin/s);
  assert.match(bundle, /交互语言.*docs\/interaction-language\.md/s);
  assert.match(bundle, /相邻页面已冻结的稿.*PAGE-02\/default\.png/s);
  assert.match(bundle, /契约同源 mock.*contract-mock\.json.*__mock=default.*__mock=empty/s);
  assert.match(bundle, /快速定位并处置异常设备/);
});
