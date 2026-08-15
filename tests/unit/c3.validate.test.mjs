// C3 单测：vima validate —— 黄金夹具全绿 + 逐项破坏夹具逐条命中规则
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePages } from '../../lib/commands/validate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(HERE, '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');
const REPORT_REL = '.vima/reports/planning-validation.json';

/** 把黄金夹具拷贝进临时目录（破坏性用例在拷贝上动刀，不碰真夹具）。 */
async function cloneGolden(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-validate-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(GOLDEN, root, { recursive: true });
  // A28：黄金夹具已迁 apps/admin/ 布局；本文件的用例折回根布局（src/），
  // 专职覆盖存量项目（无 manifest → v1 兜底端册 dir "."）的寻址分支（契约 §13）。
  await cp(path.join(root, 'apps/admin/src'), path.join(root, 'src'), { recursive: true });
  await rm(path.join(root, 'apps'), { recursive: true, force: true });
  return root;
}

function vima(cwd, ...args) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

async function readReport(root) {
  return JSON.parse(await readFile(path.join(root, REPORT_REL), 'utf8'));
}

/** 对文件做一次字符串替换并断言确实替换到了（防止夹具改动后变异悄悄失效）。 */
async function mutate(root, rel, from, to) {
  const p = path.join(root, rel);
  const text = await readFile(p, 'utf8');
  assert.ok(text.includes(from), `变异目标未找到: ${from}`);
  await writeFile(p, text.replace(from, to));
}

// ── V-CODE 代码 ↔ 契约对账（A6）──

test('V-CODE-01：带 @vima 标注的前端代码调用契约外接口 → exit 2；模板串参数归一后命中契约 → 放行', async (t) => {
  const root = await cloneGolden(t);
  // 契约补一个带路径参数的接口（顺带验证 {id} ↔ ${expr} 归一）
  // 人读小节与机读块须同步补（V-CON-06：两处逐接口一一对应）
  await mutate(
    root,
    'docs/contracts/device-api.md',
    '## 共享类型定义',
    '## PUT /api/device/{id}\n\n- 请求参数：`{ id: number }`\n- 响应：`ApiResponse<Device>`\n- 错误码：40001 参数校验失败\n\n## 共享类型定义',
  );
  await mutate(
    root,
    'docs/contracts/device-api.md',
    'apis:',
    'apis:\n  - method: PUT\n    path: /api/device/{id}\n    request:\n      - { name: id, type: number, required: true }\n    response:\n      - { name: id, type: number }\n    errors:\n      - { code: 40001, msg: 参数校验失败 }',
  );
  const p = path.join(root, 'src/api/device.ts');
  let text = await readFile(p, 'utf8');
  text += '\nexport function updateDevice(id: number, data: unknown) {\n  return request.put(`/api/device/${id}`, data)\n}\n';
  await writeFile(p, text);
  assert.equal(vima(root, 'validate').code, 0, '模板串归一后命中契约应放行');

  await writeFile(p, `${text}\nexport function rogue() {\n  return request.post('/device/rogue')\n}\n`);
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /V-CODE-01/); // ❌ 错误块走 stderr（契约 §3 输出流向）
  assert.match(r.stderr, /POST \/api\/device\/rogue/);
});

test('V-CODE-01 作用域：无 @vima 标注的文件不参与对账（底座/共享层天然豁免）', async (t) => {
  const root = await cloneGolden(t);
  await writeFile(
    path.join(root, 'src/api/base.ts'),
    "import { request } from '../utils/request'\nexport function ping() {\n  return request.get('/base/rogue')\n}\n",
  );
  assert.equal(vima(root, 'validate').code, 0);
});

test('V-CODE-02：带 @vima 标注的后端 Controller 声明契约外路径 → exit 2；契约内拼接路径 → 放行', async (t) => {
  const root = await cloneGolden(t);
  const dir = path.join(root, 'backend/src/main/java/demo');
  const ok = [
    '// @vima device-api-be',
    'package demo;',
    '@RestController',
    '@RequestMapping("/api/device")',
    'public class AnnotatedDeviceController {',
    '    @GetMapping("/list")',
    '    public Object list() { return null; }',
    '    @PostMapping',
    '    public Object create() { return null; }',
    '}',
  ].join('\n');
  await writeFile(path.join(dir, 'AnnotatedDeviceController.java'), ok);
  const r0 = vima(root, 'validate');
  assert.equal(r0.code, 0, `stdout: ${r0.stdout}`);

  await writeFile(
    path.join(dir, 'AnnotatedDeviceController.java'),
    ok.replace('    @PostMapping\n', '    @PostMapping("/rogue")\n    public Object rogue() { return null; }\n    @PostMapping\n'),
  );
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /V-CODE-02/);
  assert.match(r.stderr, /POST \/api\/device\/rogue/);
});

test('V-TASK-04：conflictsWith 指向幽灵任务 → exit 2（A8）；指向存在任务 → 放行', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/tasks/device-list-fe.md', 'page: PAGE-01', 'page: PAGE-01\nconflictsWith: [device-api-be]');
  assert.equal(vima(root, 'validate').code, 0, '引用存在任务应放行');

  await mutate(root, 'docs/tasks/device-list-fe.md', 'conflictsWith: [device-api-be]', 'conflictsWith: [ghost-task]');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /V-TASK-04/);
  assert.match(r.stderr, /ghost-task/);
});

test('黄金夹具：validate exit 0，报告 pass=true，lifecycle 置 artifactsValidated', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'validate');
  assert.equal(r.code, 0, `stderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const report = await readReport(root);
  assert.equal(report.pass, true);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.pendingConfirm, []);
  const lifecycle = JSON.parse(await readFile(path.join(root, 'docs/lifecycle.json'), 'utf8'));
  assert.equal(lifecycle.checklists.PLANNING.artifactsValidated, true);
  assert.match(r.stdout, /校验完成/);
});

test('破坏：删第八章 → V-SPEC-01，exit 2', async (t) => {
  const root = await cloneGolden(t);
  const p = path.join(root, 'docs/spec.md');
  const text = await readFile(p, 'utf8');
  await writeFile(p, text.replace(/## 8\. 关键决策记录[\s\S]*$/, ''));
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  assert.ok(report.errors.some((e) => e.rule === 'V-SPEC-01'), JSON.stringify(report.errors));
  assert.match(r.stderr, /V-SPEC-01: .+ \(docs\/spec\.md\)/);
});

test('破坏：layout 塞非法词 → V-SPEC-04，exit 2', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md',
    'layout: [search, toolbar, table, pagination]',
    'layout: [search, toolbar, table, pagination, sidebar]');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hit = report.errors.filter((e) => e.rule === 'V-SPEC-04');
  assert.equal(hit.length, 1, JSON.stringify(report.errors));
  assert.match(hit[0].message, /sidebar/);
});

test('破坏：nav 指向不存在页 → V-SPEC-05，exit 2', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', 'target: PAGE-02', 'target: PAGE-99');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hit = report.errors.filter((e) => e.rule === 'V-SPEC-05');
  assert.equal(hit.length, 1, JSON.stringify(report.errors));
  assert.match(hit[0].message, /PAGE-99/);
});

test('破坏：页面 api 不在契约 → V-SPEC-07，exit 2', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md',
    'apis: [GET /api/device/list, POST /api/device, POST /api/device/batch-delete]',
    'apis: [GET /api/device/list, POST /api/device, POST /api/device/batch-delete, DELETE /api/device]');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hit = report.errors.filter((e) => e.rule === 'V-SPEC-07');
  assert.equal(hit.length, 1, JSON.stringify(report.errors));
  assert.match(hit[0].message, /DELETE \/api\/device/);
});

test('破坏：带 page 字段的任务塞「## 页面结构」→ V-TASK-05，exit 2', async (t) => {
  const root = await cloneGolden(t);
  const p = path.join(root, 'docs/tasks/device-list-fe.md');
  const text = await readFile(p, 'utf8');
  await writeFile(p, `${text}\n## 页面结构\n\n- 手写的组件树（违反单一真源 A2）\n`);
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hit = report.errors.filter((e) => e.rule === 'V-TASK-05');
  assert.equal(hit.length, 1, JSON.stringify(report.errors));
  assert.equal(hit[0].path, 'docs/tasks/device-list-fe.md');
});

test('破坏：覆盖矩阵挖空单元格 → V-COV-01，exit 2', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/coverage-matrix.md', 'device-api-be, full-test', '');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  assert.ok(report.errors.some((e) => e.rule === 'V-COV-01'), JSON.stringify(report.errors));
});

test('破坏：覆盖矩阵数据行缺少末列 → V-COV-01，exit 2', async (t) => {
  const root = await cloneGolden(t);
  const rel = 'docs/coverage-matrix.md';
  const p = path.join(root, rel);
  const text = await readFile(p, 'utf8');
  const rows = text.split('\n');
  const index = rows.findIndex((line) => line.startsWith('|') && !/---/.test(line) && !/页面/.test(line));
  assert.ok(index >= 0, '应找到覆盖矩阵数据行');
  const cells = rows[index].slice(1, -1).split('|');
  rows[index] = `|${cells.slice(0, -1).join('|')}|`;
  await writeFile(p, rows.join('\n'));

  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  assert.ok(report.errors.some((e) => e.rule === 'V-COV-01' && /列数/.test(e.message)));
});

test('V-COV-01：转义竖线属于单元格内容，不误判为额外列', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/coverage-matrix.md', '设备可按名称', '设备 A \\| B 可按名称');
  const r = vima(root, 'validate');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
});

test('spec 块加 pendingConfirm: true → 仍 exit 0，报告收集待确认项 + V-PEND-01 警告', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', 'id: PAGE-01\ntitle: 设备列表', 'id: PAGE-01\npendingConfirm: true\ntitle: 设备列表');
  const r = vima(root, 'validate');
  assert.equal(r.code, 0, `stderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const report = await readReport(root);
  assert.equal(report.pass, true);
  assert.deepEqual(report.pendingConfirm, [{ where: 'PAGE-01', path: 'docs/spec.md' }]);
  assert.ok(report.warnings.some((w) => w.rule === 'V-PEND-01'), JSON.stringify(report.warnings));
  assert.match(r.stdout, /待确认/);
});

test('--artifact docs/spec.md 只跑 spec 规则组：覆盖矩阵缺口不影响结果', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/coverage-matrix.md', 'device-api-be, full-test', 'TODO');
  const partial = vima(root, 'validate', '--artifact', 'docs/spec.md');
  assert.equal(partial.code, 0, `stderr: ${partial.stderr}\nstdout: ${partial.stdout}`);
  // 局部校验不落 artifactsValidated 章
  const lifecycle = JSON.parse(await readFile(path.join(root, 'docs/lifecycle.json'), 'utf8'));
  assert.equal(lifecycle.checklists.PLANNING.artifactsValidated, false);
  // 全量校验依然抓到缺口
  const full = vima(root, 'validate');
  assert.equal(full.code, 2);
});

test('validatePages 导出：apis 为空 → V-SPEC-03（渲染命令复用的规则函数）', () => {
  const pages = new Map([['PAGE-01', {
    id: 'PAGE-01',
    layout: ['table'],
    components: [{ block: 'table', items: [] }],
    apis: [],
  }]]);
  const errors = validatePages({ pages, roles: [], menus: [], flows: [] });
  assert.ok(errors.some((e) => e.rule === 'V-SPEC-03' && e.message.includes('apis')), JSON.stringify(errors));
});

test('validatePages 导出：page 块缺 id → V-SPEC-03 且带开栏行号（缺 id 的块不入 pages Map，不能静默消失）', () => {
  const text = [
    '# 3. 页面清单',
    '',
    '```yaml vima:page',
    'title: 无 id 的残缺页',
    'layout: [table]',
    'apis: [GET /api/x]',
    '```',
    '',
  ].join('\n');
  const errors = validatePages({ pages: new Map(), roles: [], menus: [], flows: [], text });
  const hit = errors.filter((e) => e.rule === 'V-SPEC-03' && /缺少非空 id/.test(e.message));
  assert.equal(hit.length, 1, JSON.stringify(errors));
  assert.match(hit[0].message, /第 3 行开栏/);
});

// ---------------------------------------------------------------------------
// 规则表补齐（契约 §8 全 20 条逐条有断言；见差距评估 P2-1）
// ---------------------------------------------------------------------------

test('破坏：删 vima:entities 块 → V-SPEC-02，exit 2', async (t) => {
  const root = await cloneGolden(t);
  const p = path.join(root, 'docs/spec.md');
  const text = await readFile(p, 'utf8');
  const next = text.replace(/```yaml vima:entities[\s\S]*?```/, '');
  assert.notEqual(next, text, '变异未生效');
  await writeFile(p, next);
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  assert.ok(report.errors.some((e) => e.rule === 'V-SPEC-02'), JSON.stringify(report.errors));
});

test('破坏：删掉 PAGE-02 的 id → V-SPEC-03，exit 2（整块被 loadSpec 丢弃也必须报出来）', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', 'id: PAGE-02\ntitle: 设备详情\n', 'title: 设备详情\n');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  assert.ok(
    report.errors.some((e) => e.rule === 'V-SPEC-03' && /缺少非空 id/.test(e.message)),
    JSON.stringify(report.errors),
  );
});

test('破坏：角色 menus 置空 → V-SPEC-06，exit 2', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', 'menus: [MENU-01]\n', 'menus: []\n');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hit = report.errors.filter((e) => e.rule === 'V-SPEC-06');
  assert.equal(hit.length, 1, JSON.stringify(report.errors));
  assert.match(hit[0].message, /ROLE-02/);
});

test('破坏：决策表表头改名 → V-DEC-01，exit 2（A4 验收判据）', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', '已否决方案', '被否的方案');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hit = report.errors.filter((e) => e.rule === 'V-DEC-01');
  assert.equal(hit.length, 1, JSON.stringify(report.errors));
});

test('破坏：契约 api 删 errors 要素 → V-CON-01，exit 2', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root,
    'docs/contracts/device-api.md',
    '    errors:\n      - { code: 40004, msg: 设备不存在 }\n',
    '',
  );
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hit = report.errors.filter((e) => e.rule === 'V-CON-01');
  assert.equal(hit.length, 1, JSON.stringify(report.errors));
  assert.match(hit[0].message, /GET \/api\/device\/detail/);
});

test('页面撤销引用 batch-delete → V-CON-02 孤儿接口 warn，exit 0', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root,
    'docs/spec.md',
    'apis: [GET /api/device/list, POST /api/device, POST /api/device/batch-delete]',
    'apis: [GET /api/device/list, POST /api/device]',
  );
  const r = vima(root, 'validate');
  assert.equal(r.code, 0, `stderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const report = await readReport(root);
  assert.equal(report.pass, true);
  const hit = report.warnings.filter((w) => w.rule === 'V-CON-02');
  assert.equal(hit.length, 1, JSON.stringify(report.warnings));
  assert.match(hit[0].message, /POST \/api\/device\/batch-delete/);
});

test('破坏：删掉后端任务对契约的引用 → V-CON-03，exit 2', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root,
    'docs/tasks/device-api-be.md',
    'contract: docs/contracts/device-api.md\n',
    '',
  );
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  // business 任务缺 contract 同时命中 V-TASK-01；这里聚焦 V-CON-03 的前后端成对纪律
  assert.ok(report.errors.some((e) => e.rule === 'V-CON-03' && /backend/.test(e.message)), JSON.stringify(report.errors));
  assert.ok(report.errors.some((e) => e.rule === 'V-TASK-01'), JSON.stringify(report.errors));
});

test('V-TASK-01 专属：business 缺 contract 与枚举非法两分支（后者经 plan 以 TASK_FM 稳定码输出）', async (t) => {
  // 分支 1：business 任务缺 contract → V-TASK-01 指名任务
  const root = await cloneGolden(t);
  await mutate(root, 'docs/tasks/device-list-fe.md', 'contract: docs/contracts/device-api.md\n', '');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  assert.ok(
    report.errors.some((e) => e.rule === 'V-TASK-01' && e.message.includes('device-list-fe')),
    JSON.stringify(report.errors),
  );

  // 分支 2：frontmatter 枚举非法（layer: bogus）→ validate 折叠进 V-TASK-01（模型层 TASK_FM 把关）
  const root2 = await cloneGolden(t);
  await mutate(root2, 'docs/tasks/full-test.md', 'layer: pipeline', 'layer: bogus');
  const r2 = vima(root2, 'validate');
  assert.equal(r2.code, 2);
  const report2 = await readReport(root2);
  assert.ok(
    report2.errors.some((e) => e.rule === 'V-TASK-01' && /layer/.test(e.message)),
    JSON.stringify(report2.errors),
  );
  // 同一坏夹具走 plan：TASK_FM 直达 stderr，锁稳定错误码（契约 §3.1，断言 code 而非文案）
  const r3 = vima(root2, 'plan');
  assert.equal(r3.code, 2);
  assert.match(r3.stderr, /^vima plan: TASK_FM: /);
});

test('破坏：追加同 module 同接口的第二份契约 → V-CON-04 唯一性，exit 2', async (t) => {
  const root = await cloneGolden(t);
  const dup = [
    '# 重复契约（测试注入）',
    '',
    '```yaml vima:contract',
    'module: device',
    'apis:',
    '  - method: GET',
    '    path: /api/device/list',
    '    request: []',
    '    response:',
    '      - { name: id, type: number }',
    '    errors: []',
    '```',
    '',
  ].join('\n');
  await writeFile(path.join(root, 'docs/contracts/device2-api.md'), dup);
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hit = report.errors.filter((e) => e.rule === 'V-CON-04');
  assert.equal(hit.length, 2, JSON.stringify(report.errors)); // module 重复 + 接口键重复
  assert.ok(hit.every((e) => e.path === 'docs/contracts/device2-api.md'));
});

test('破坏：任务删验收清单章节 → V-TASK-02，exit 2', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/tasks/full-test.md', '## 验收清单', '## 验收项');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hit = report.errors.filter((e) => e.rule === 'V-TASK-02');
  assert.equal(hit.length, 1, JSON.stringify(report.errors));
  assert.equal(hit[0].path, 'docs/tasks/full-test.md');
});

test('破坏：contract 指向不存在的文件 → V-TASK-03，exit 2', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root,
    'docs/tasks/device-list-fe.md',
    'contract: docs/contracts/device-api.md',
    'contract: docs/contracts/ghost.md',
  );
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  assert.ok(report.errors.some((e) => e.rule === 'V-TASK-03' && /ghost\.md/.test(e.message)), JSON.stringify(report.errors));
});

test('破坏：dependsOn 引用幽灵任务 → V-TASK-04，exit 2', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root,
    'docs/tasks/device-list-fe.md',
    'dependsOn: [shared-base, device-api-be]',
    'dependsOn: [shared-base, device-api-be, ghost-task]',
  );
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hit = report.errors.filter((e) => e.rule === 'V-TASK-04');
  assert.equal(hit.length, 1, JSON.stringify(report.errors));
  assert.match(hit[0].message, /ghost-task/);
});

test('破坏：page 改为 PAGE-99 → V-TASK-06，exit 2（A2 验收判据）', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/tasks/device-list-fe.md', 'page: PAGE-01', 'page: PAGE-99');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hit = report.errors.filter((e) => e.rule === 'V-TASK-06');
  assert.equal(hit.length, 1, JSON.stringify(report.errors));
  assert.match(hit[0].message, /PAGE-99/);
});

test('破坏：spec 整体缺失而任务带 page → V-TASK-06 不静默（契约 §8），exit 2', async (t) => {
  const root = await cloneGolden(t);
  await rm(path.join(root, 'docs/spec.md'));
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  assert.ok(report.errors.some((e) => e.rule === 'V-SPEC-01'), 'spec 缺失应报 V-SPEC-01');
  assert.ok(
    report.errors.some((e) => e.rule === 'V-TASK-06' && e.path === 'docs/tasks/device-list-fe.md'),
    `带 page 的任务必须显式报 V-TASK-06：${JSON.stringify(report.errors)}`,
  );
});

test('破坏：菜单功能点接口改为契约外 → V-SPEC-08，exit 2（功能点闭环）', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md',
    '- { name: 设备查询, api: GET /api/device/list }',
    '- { name: 设备查询, api: GET /api/device/search }');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hit = report.errors.filter((e) => e.rule === 'V-SPEC-08');
  assert.equal(hit.length, 1, JSON.stringify(report.errors));
  assert.match(hit[0].message, /GET \/api\/device\/search/);
  assert.match(hit[0].message, /MENU-01/);
});

test('覆盖度：删一条验收项 → V-TASK-07 warn（B3），仍 exit 0；黄金态无此警告', async (t) => {
  const root = await cloneGolden(t);
  // 黄金态：6 复选框 = PAGE-01 任务点数 6（4 交互 + 2 弹窗字段）→ 无警告
  const clean = vima(root, 'validate');
  assert.equal(clean.code, 0);
  let report = await readReport(root);
  assert.ok(!report.warnings.some((w) => w.rule === 'V-TASK-07'), JSON.stringify(report.warnings));

  // 删掉一条 → 5 < 6 → warn，但不阻断
  await mutate(root, 'docs/tasks/device-list-fe.md',
    '- [ ] 行内详情跳转 PAGE-02 路由正确\n', '');
  const r = vima(root, 'validate');
  assert.equal(r.code, 0, `stderr: ${r.stderr}\nstdout: ${r.stdout}`);
  report = await readReport(root);
  assert.equal(report.pass, true);
  const hit = report.warnings.filter((w) => w.rule === 'V-TASK-07');
  assert.equal(hit.length, 1, JSON.stringify(report.warnings));
  assert.match(hit[0].message, /仅 5 项，少于页面 PAGE-01 的任务点数 6/);
});

// ── A13 业务规则结构化 + 本期不做（V-SPEC-09/10/11）──

test('V-SPEC-09：vima:rules 块缺失 / entity 不存在 / type 非法 → exit 2 逐条命中', async (t) => {
  // ① 块缺失（改 kind 使其不再被识别为 rules 块）
  let root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', '```yaml vima:rules', '```yaml vima:rules-disabled');
  let r = vima(root, 'validate', '--artifact', 'docs/spec.md');
  assert.equal(r.code, 2, `stdout: ${r.stdout}`);
  let report = await readReport(root);
  assert.ok(
    report.errors.some((e) => e.rule === 'V-SPEC-09' && /缺少 vima:rules 数据块/.test(e.message)),
    JSON.stringify(report.errors),
  );

  // ② entity 指向不存在的实体
  root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md',
    '    entity: Device\n    apis: [GET /api/device/detail]',
    '    entity: NoSuchEntity\n    apis: [GET /api/device/detail]');
  r = vima(root, 'validate', '--artifact', 'docs/spec.md');
  assert.equal(r.code, 2);
  report = await readReport(root);
  assert.ok(
    report.errors.some((e) => e.rule === 'V-SPEC-09' && /RULE-05.*NoSuchEntity.*不存在/.test(e.message)),
    JSON.stringify(report.errors),
  );

  // ③ type 不在词表内
  root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', '    type: transition', '    type: 状态流转');
  r = vima(root, 'validate', '--artifact', 'docs/spec.md');
  assert.equal(r.code, 2);
  report = await readReport(root);
  assert.ok(
    report.errors.some((e) => e.rule === 'V-SPEC-09' && /RULE-04.*type.*不合法/.test(e.message)),
    JSON.stringify(report.errors),
  );
});

test('V-SPEC-10：rule.apis 指向契约外的接口 → exit 2；全局规则（无 apis）不受此规则约束', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md',
    '\n    apis: [GET /api/device/detail]\n    desc: 查询不存在',
    '\n    apis: [GET /api/device/ghost]\n    desc: 查询不存在');
  const r = vima(root, 'validate', '--artifact', 'docs/spec.md');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hit = report.errors.filter((e) => e.rule === 'V-SPEC-10');
  // 只有被改坏的 RULE-05 命中；RULE-06 是无 apis 的全局规则，不参与接口闭环校验
  assert.equal(hit.length, 1, JSON.stringify(report.errors));
  assert.match(hit[0].message, /RULE-05.*GET \/api\/device\/ghost.*不在任何契约中/);
});

test('V-SPEC-11：删掉第九章 → 同时报 V-SPEC-01 与 V-SPEC-11；仅删块也报 V-SPEC-11', async (t) => {
  // ① 整章删除
  let root = await cloneGolden(t);
  const chapter9 = await readFile(path.join(root, 'docs/spec.md'), 'utf8');
  const cut = chapter9.indexOf('\n## 9. 本期不做');
  assert.ok(cut > 0, '夹具第九章缺失');
  await writeFile(path.join(root, 'docs/spec.md'), `${chapter9.slice(0, cut)}\n`);
  let r = vima(root, 'validate', '--artifact', 'docs/spec.md');
  assert.equal(r.code, 2);
  let report = await readReport(root);
  assert.ok(report.errors.some((e) => e.rule === 'V-SPEC-01' && /9\. 本期不做/.test(e.message)),
    JSON.stringify(report.errors));
  assert.ok(report.errors.some((e) => e.rule === 'V-SPEC-11'), JSON.stringify(report.errors));

  // ② 保留章标题、只让块失效 → 仅 V-SPEC-11
  root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', '```yaml vima:non-goals', '```yaml vima:non-goals-disabled');
  r = vima(root, 'validate', '--artifact', 'docs/spec.md');
  assert.equal(r.code, 2);
  report = await readReport(root);
  assert.ok(!report.errors.some((e) => e.rule === 'V-SPEC-01'), '章标题仍在，不应报 V-SPEC-01');
  assert.ok(report.errors.some((e) => e.rule === 'V-SPEC-11'), JSON.stringify(report.errors));
});

test('V-SPEC-11：空清单显式写 non-goals: [] → 放行（「声明为空」与「没声明」可区分）', async (t) => {
  const root = await cloneGolden(t);
  const p = path.join(root, 'docs/spec.md');
  const text = await readFile(p, 'utf8');
  const replaced = text.replace(/```yaml vima:non-goals\n[\s\S]*?```/, '```yaml vima:non-goals\nnon-goals: []\n```');
  assert.notEqual(replaced, text, '变异未生效');
  await writeFile(p, replaced);
  const r = vima(root, 'validate', '--artifact', 'docs/spec.md');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const report = await readReport(root);
  assert.ok(!report.errors.some((e) => e.rule === 'V-SPEC-11'), JSON.stringify(report.errors));
});

test('V-SPEC-05：RULE/NG 的 ID 并入全文档唯一性检查（A13 扩容）', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', '  - id: RULE-02', '  - id: RULE-01');
  const r = vima(root, 'validate', '--artifact', 'docs/spec.md');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  assert.ok(
    report.errors.some((e) => e.rule === 'V-SPEC-05' && /RULE ID "RULE-01" 与 RULE 重复/.test(e.message)),
    JSON.stringify(report.errors),
  );
});

// ── 修补期实测补充的规则（V-YAML-01 / V-CON-05 / V-CON-06 / V-TASK-08 / V-TASK-09 / V-SRC-01）──

test('V-YAML-01：flow 上下文里的裸花括号 → warn（vima 能读但标准 YAML 读不了）', async (t) => {
  const root = await cloneGolden(t);
  // 行内序列里放 {id}：本解析器容忍，PyYAML 之流会崩——正是「能过 vima 却不是合法 YAML」的灰区
  await mutate(root, 'docs/spec.md', 'apis: [GET /api/device/detail]\n', 'apis: [GET /api/device/detail, GET /api/device/{id}]\n');
  const r = vima(root, 'validate', '--artifact', 'docs/spec.md');
  const report = await readReport(root);
  assert.ok(
    report.warnings.some((w) => w.rule === 'V-YAML-01' && /未加引号的花括号/.test(w.message)),
    JSON.stringify(report.warnings),
  );
  assert.equal(r.code, 2, 'V-SPEC-07 会因新接口不在契约而报错，但 V-YAML-01 本身只是 warn');
});

test('V-YAML-01：块级序列里的 {id} 不误报（block 上下文本就是合法 YAML）', async (t) => {
  const root = await cloneGolden(t);
  const report0 = (() => { vima(root, 'validate'); return readReport(root); })();
  const report = await report0;
  assert.ok(!report.warnings.some((w) => w.rule === 'V-YAML-01'), '黄金夹具不应有 V-YAML-01');
});

test('V-CON-05：q1 式占位参数名与写操作空请求体 → warn', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root,
    'docs/contracts/device-api.md',
    '      - { name: ids, type: array, required: true, writeOnly: true }',
    '      - { name: q1, type: string, required: true, writeOnly: true }',
  );
  const r = vima(root, 'validate', '--artifact', 'docs/contracts');
  assert.equal(r.code, 0, `占位符只是 warn；stderr: ${r.stderr}`);
  const report = await readReport(root);
  assert.ok(
    report.warnings.some((w) => w.rule === 'V-CON-05' && /q1/.test(w.message)),
    JSON.stringify(report.warnings),
  );
});

test('V-CON-06：人读小节与机读 apis 数量不一致 → exit 2', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/contracts/device-api.md', '## GET /api/device/detail', '## GET /api/device/detail-renamed');
  const r = vima(root, 'validate', '--artifact', 'docs/contracts');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  assert.ok(
    report.errors.some((e) => e.rule === 'V-CON-06'),
    JSON.stringify(report.errors),
  );
});

test('V-CON-06：头部「接口 N 个」过期 → warn（不阻断）', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/contracts/device-api.md', '# 设备管理 API 契约', '# 设备管理 API 契约\n\n创建日期：2026-08-12　模块：`device`　接口 99 个');
  const r = vima(root, 'validate', '--artifact', 'docs/contracts');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const report = await readReport(root);
  assert.ok(
    report.warnings.some((w) => w.rule === 'V-CON-06' && /接口 99 个/.test(w.message)),
    JSON.stringify(report.warnings),
  );
});

test('V-TASK-08：验收清单引用页面 apis 之外的接口 → warn；否定式提及不误报', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root,
    'docs/tasks/device-list-fe.md',
    '## 验收清单',
    '## 验收清单\n\n- [ ] 表格「导出」调用 GET /api/device/export\n',
  );
  const r = vima(root, 'validate', '--artifact', 'docs/tasks');
  assert.equal(r.code, 0, `V-TASK-08 是 warn；stderr: ${r.stderr}`);
  let report = await readReport(root);
  assert.ok(
    report.warnings.some((w) => w.rule === 'V-TASK-08' && /GET \/api\/device\/export/.test(w.message)),
    JSON.stringify(report.warnings),
  );

  // 同一引用改成否定式说明后不应再报（反面教材不是失效引用）
  await mutate(
    root,
    'docs/tasks/device-list-fe.md',
    '- [ ] 表格「导出」调用 GET /api/device/export',
    '- [ ] 页面不提供「导出」按钮（真源无 GET /api/device/export）',
  );
  vima(root, 'validate', '--artifact', 'docs/tasks');
  report = await readReport(root);
  assert.ok(
    !report.warnings.some((w) => w.rule === 'V-TASK-08'),
    `否定式提及不应触发：${JSON.stringify(report.warnings)}`,
  );
});

test('V-TASK-09：任务内嵌接口数与契约条目数漂移 → warn', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root,
    'docs/tasks/device-api-be.md',
    '## 任务目标',
    '## 任务目标\n\n实现本模块契约声明的 99 个接口，字段与错误码以契约为唯一来源。\n',
  );
  const r = vima(root, 'validate', '--artifact', 'docs/tasks');
  assert.equal(r.code, 0);
  const report = await readReport(root);
  assert.ok(
    report.warnings.some((w) => w.rule === 'V-TASK-09' && /99 个接口/.test(w.message)),
    JSON.stringify(report.warnings),
  );
});

test('V-SRC-01：配置 endpointAnchor 后，契约外端点 → warn；未配置则整条跳过', async (t) => {
  const root = await cloneGolden(t);
  // 未配置：黄金夹具不应出现 V-SRC-01
  vima(root, 'validate', '--artifact', 'docs/contracts');
  let report = await readReport(root);
  assert.ok(!report.warnings.some((w) => w.rule === 'V-SRC-01'), '未配置锚点时应整条跳过');

  // 配置一份只含两条真实路径的锚点 → 其余契约端点应被判「查无实据」
  await writeFile(path.join(root, 'docs', 'endpoints.md'), '# 真源端点\n\n- GET /api/device/list\n- POST /api/device\n');
  const lcPath = path.join(root, 'docs', 'lifecycle.json');
  const lc = JSON.parse(await readFile(lcPath, 'utf8'));
  lc.endpointAnchor = 'docs/endpoints.md';
  await writeFile(lcPath, `${JSON.stringify(lc, null, 2)}\n`);

  const r = vima(root, 'validate', '--artifact', 'docs/contracts');
  assert.equal(r.code, 0, `V-SRC-01 是 warn；stderr: ${r.stderr}`);
  report = await readReport(root);
  const hits = report.warnings.filter((w) => w.rule === 'V-SRC-01');
  assert.ok(hits.length > 0, JSON.stringify(report.warnings));
  assert.ok(
    hits.some((w) => /batch-delete/.test(w.message)),
    `锚点里没有的端点应被点名：${JSON.stringify(hits)}`,
  );
  assert.ok(
    !hits.some((w) => /GET \/api\/device\/list/.test(w.message)),
    '锚点里有的端点不应被点名',
  );
});

// ── A16 多端规则（golden-multi 双端夹具：admin-web + mp-native）──────────────

const GOLDEN_MULTI = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden-multi');

async function cloneMulti(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-multi-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(GOLDEN_MULTI, root, { recursive: true });
  return root;
}

test('golden-multi 双端夹具全绿（A16 基线）', async (t) => {
  const root = await cloneMulti(t);
  const r = vima(root, 'validate');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
});

test('V-SPEC-13：患者页删掉 app 键（多端必填）→ exit 2；app 指向端册外 → exit 2', async (t) => {
  const root = await cloneMulti(t);
  await mutate(root, 'docs/spec.md', 'id: PAGE-11\napp: patient', 'id: PAGE-11');
  const r = vima(root, 'validate', '--artifact', 'docs/spec.md');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /V-SPEC-13/);
  assert.match(r.stderr, /PAGE-11 缺少 app 键/);

  const root2 = await cloneMulti(t);
  await mutate(root2, 'docs/spec.md', 'id: PAGE-11\napp: patient', 'id: PAGE-11\napp: ghost');
  const r2 = vima(root2, 'validate', '--artifact', 'docs/spec.md');
  assert.equal(r2.code, 2);
  assert.match(r2.stderr, /V-SPEC-13/);
  assert.match(r2.stderr, /不在端册/);
});

test('V-SPEC-13：nav 跨端指向 → exit 2（跨端交接只能走 vima:flow）', async (t) => {
  const root = await cloneMulti(t);
  // 患者端 PAGE-12 的「再次预约」改为指向 admin 端 PAGE-01
  await mutate(root, 'docs/spec.md',
    '- { label: 再次预约, action: nav, target: PAGE-11 }',
    '- { label: 再次预约, action: nav, target: PAGE-01 }');
  const r = vima(root, 'validate', '--artifact', 'docs/spec.md');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /V-SPEC-13/);
  assert.match(r.stderr, /跨端指向/);
});

test('V-SPEC-14：端册有端而 spec 无其页面 → exit 2（入册未设计）', async (t) => {
  const root = await cloneMulti(t);
  // 把患者端两个页面都改挂到 admin —— patient 端零页面
  await mutate(root, 'docs/spec.md', 'id: PAGE-11\napp: patient', 'id: PAGE-11\napp: admin');
  await mutate(root, 'docs/spec.md', 'id: PAGE-12\napp: patient', 'id: PAGE-12\napp: admin');
  const r = vima(root, 'validate', '--artifact', 'docs/spec.md');
  assert.equal(r.code, 2, `stderr: ${r.stderr}`);
  assert.match(r.stderr, /V-SPEC-14/);
  assert.match(r.stderr, /patient/);
});

test('V-SPEC-04 端化：mp 端页面用桌面词 table → exit 2 且报该端词表', async (t) => {
  const root = await cloneMulti(t);
  await mutate(root, 'docs/spec.md', 'layout: [search, list]', 'layout: [search, table]');
  await mutate(root, 'docs/spec.md', '  - block: list\n    api: GET /api/app/appointment/mine',
    '  - block: table\n    api: GET /api/app/appointment/mine');
  const r = vima(root, 'validate', '--artifact', 'docs/spec.md');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /V-SPEC-04/);
  assert.match(r.stderr, /banner/); // 报错里带 mp-native 词表
});

test('V-SPEC-12 端化：mp 端页面声明 regions → exit 2（kind 门控）', async (t) => {
  const root = await cloneMulti(t);
  await mutate(root, 'docs/spec.md', 'layout: [banner, form, actionbar]',
    'layout: [banner, form, actionbar]\nregions:\n  - { blocks: [banner, form, actionbar] }');
  const r = vima(root, 'validate', '--artifact', 'docs/spec.md');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /V-SPEC-12/);
  assert.match(r.stderr, /不支持 regions/);
});

test('V-CON-07：api 缺 consumers（多端必填）→ exit 2；页面引用未授权接口 → exit 2 越权', async (t) => {
  const root = await cloneMulti(t);
  await mutate(root, 'docs/contracts/appointment-api.md',
    '    path: /api/app/appointment/mine\n    consumers: [patient]',
    '    path: /api/app/appointment/mine');
  const r = vima(root, 'validate', '--artifact', 'docs/contracts');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /V-CON-07/);
  assert.match(r.stderr, /缺少非空 consumers/);

  // 患者页引用 admin 专属接口 → 越权引用
  const root2 = await cloneMulti(t);
  await mutate(root2, 'docs/spec.md', 'apis: [POST /api/app/appointment]',
    'apis: [POST /api/app/appointment, GET /api/admin/appointment/list]');
  const r2 = vima(root2, 'validate', '--artifact', 'docs/spec.md');
  assert.equal(r2.code, 2);
  assert.match(r2.stderr, /V-CON-07/);
  assert.match(r2.stderr, /越权引用/);
});

test('V-SPEC-08 端化：患者菜单功能点挂 admin 专属接口 → exit 2', async (t) => {
  const root = await cloneMulti(t);
  await mutate(root, 'docs/spec.md',
    '- { name: 预约记录, api: GET /api/app/appointment/mine }',
    '- { name: 预约记录, api: GET /api/admin/appointment/list }');
  const r = vima(root, 'validate', '--artifact', 'docs/spec.md');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /V-SPEC-08/);
  assert.match(r.stderr, /未授权接口/);
});

test('V-TASK-10：fe 任务缺 app / backend 任务带 app / 任务页跨端 → exit 2', async (t) => {
  const root = await cloneMulti(t);
  await mutate(root, 'docs/tasks/appointment-patient-fe.md', 'app: patient\n', '');
  const r = vima(root, 'validate', '--artifact', 'docs/tasks');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /V-TASK-10/);
  assert.match(r.stderr, /缺少 app 字段/);

  const root2 = await cloneMulti(t);
  await mutate(root2, 'docs/tasks/appointment-be.md', 'side: backend\n', 'side: backend\napp: admin\n');
  const r2 = vima(root2, 'validate', '--artifact', 'docs/tasks');
  assert.equal(r2.code, 2);
  assert.match(r2.stderr, /V-TASK-10/);
  assert.match(r2.stderr, /backend 任务/);

  const root3 = await cloneMulti(t);
  await mutate(root3, 'docs/tasks/appointment-patient-fe.md', 'page: PAGE-11', 'page: PAGE-01');
  const r3 = vima(root3, 'validate', '--artifact', 'docs/tasks');
  assert.equal(r3.code, 2);
  assert.match(r3.stderr, /V-TASK-10/);
  assert.match(r3.stderr, /另一端的页面/);
});

test('V-CON-03 端化：消费端 patient 无该端 fe 任务 → exit 2（谁消费谁承接）', async (t) => {
  const root = await cloneMulti(t);
  // 把患者端任务改归 admin 端（page 一并改避免 V-TASK-10 先响）
  await mutate(root, 'docs/tasks/appointment-patient-fe.md', 'app: patient', 'app: admin');
  await mutate(root, 'docs/tasks/appointment-patient-fe.md', 'page: PAGE-11\n', '');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /V-CON-03/);
  assert.match(r.stderr, /消费端 patient/);
});

test('V-CODE-01 端化：患者端代码越权调用 /api/admin/** → exit 2；扫描范围含 apps/<id>/', async (t) => {
  const root = await cloneMulti(t);
  await mutate(root, 'apps/patient/src/api/appointment.ts',
    "request.get('/api/app/appointment/mine'", "request.get('/api/admin/appointment/list'");
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /V-CODE-01/);
  assert.match(r.stderr, /越权调用/);
  assert.match(r.stderr, /apps\/patient/);
});

test('V-COV-01 端化：多端矩阵首列非「端」→ exit 2', async (t) => {
  const root = await cloneMulti(t);
  await mutate(root, 'docs/coverage-matrix.md', '| 端 | 需求 |', '| 需求域 | 需求 |');
  const r = vima(root, 'validate', '--artifact', 'docs/coverage-matrix.md');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /V-COV-01/);
  assert.match(r.stderr, /首列须为「端」/);
});

// ── A18 任务规模上限与负责接口集闭环（V-TASK-11/12）──

test('V-TASK-11 基线：契约与负责集均未超限 → 零警告，声明 apis 后仍放行', async (t) => {
  const root = await cloneGolden(t);
  // 黄金夹具契约 4 个接口，未超限：先确认基线无警告
  assert.equal(vima(root, 'validate').code, 0);
  const base = await readReport(root);
  assert.equal(base.warnings.filter((w) => w.rule === 'V-TASK-11').length, 0);

  // 声明覆盖全集的负责集（4 条）：不超限、闭环成立，应仍 exit 0
  await mutate(
    root,
    'docs/tasks/device-api-be.md',
    'contract: docs/contracts/device-api.md',
    'contract: docs/contracts/device-api.md\napis: [\'GET /api/device/list\', \'POST /api/device\','
      + ' \'POST /api/device/batch-delete\', \'GET /api/device/detail\']',
  );
  assert.equal(vima(root, 'validate').code, 0, '4 条负责集未超限，应放行');
  const after = await readReport(root);
  assert.equal(after.warnings.filter((w) => w.rule === 'V-TASK-11').length, 0);
});

test('V-TASK-11：契约条目数超上限时按契约全集计（未声明 apis）', async (t) => {
  const root = await cloneGolden(t);
  // 契约补到 11 个接口（人读小节 + 机读块同步，避免 V-CON-06 计数不一致）
  const rel = 'docs/contracts/device-api.md';
  const p = path.join(root, rel);
  let text = await readFile(p, 'utf8');
  const extraSections = [];
  const extraApis = [];
  for (let i = 1; i <= 7; i++) {
    extraSections.push(`## GET /api/device/x${i}\n\n- 请求：无\n- 响应：\`{ ok: boolean }\`\n- 错误码：40001\n`);
    extraApis.push(
      `  - method: GET\n    path: /api/device/x${i}\n    request: []\n`
        + '    response: "{ ok }"\n    errors: [40001]\n',
    );
  }
  text = text.replace('```yaml vima:contract', `${extraSections.join('\n')}\n\`\`\`yaml vima:contract`);
  text = text.replace(/\n```\s*$/, `\n${extraApis.join('')}\`\`\`\n`);
  await writeFile(p, text);

  const r = vima(root, 'validate');
  const report = await readReport(root);
  const hits = report.warnings.filter((w) => w.rule === 'V-TASK-11');
  assert.equal(hits.length, 1, `应命中 1 条 V-TASK-11，实际 ${hits.length}；stderr: ${r.stderr}`);
  assert.match(hits[0].message, /device-api-be 负责 11 个接口/);
});

test('V-TASK-12：apis 含契约外接口 → exit 2', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root,
    'docs/tasks/device-api-be.md',
    'contract: docs/contracts/device-api.md',
    'contract: docs/contracts/device-api.md\napis: [\'GET /api/device/ghost\']',
  );
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /V-TASK-12/);
  assert.match(r.stderr, /GET \/api\/device\/ghost/);
});

test('V-TASK-12：同契约两个 backend 任务负责集重叠 → exit 2；不相交且并集齐全 → 放行', async (t) => {
  const root = await cloneGolden(t);
  const beText = await readFile(path.join(root, 'docs/tasks/device-api-be.md'), 'utf8');

  // 拆成两个子任务：前两条 / 后两条（并集 = 契约全集 4 条，不相交）
  await writeFile(
    path.join(root, 'docs/tasks/device-api-be.md'),
    beText.replace(
      'contract: docs/contracts/device-api.md',
      'contract: docs/contracts/device-api.md\napis: [\'GET /api/device/list\', \'POST /api/device\']',
    ),
  );
  await writeFile(
    path.join(root, 'docs/tasks/device-api-be-2.md'),
    beText
      .replace('taskId: device-api-be', 'taskId: device-api-be-2')
      .replace(
        'contract: docs/contracts/device-api.md',
        'contract: docs/contracts/device-api.md\napis: [\'POST /api/device/batch-delete\', \'GET /api/device/detail\']',
      ),
  );
  assert.equal(vima(root, 'validate').code, 0, '不相交且并集齐全应放行');

  // 制造重叠：第二个任务也认领 POST /api/device
  await mutate(
    root,
    'docs/tasks/device-api-be-2.md',
    'apis: [\'POST /api/device/batch-delete\', \'GET /api/device/detail\']',
    'apis: [\'POST /api/device\', \'POST /api/device/batch-delete\', \'GET /api/device/detail\']',
  );
  const dup = vima(root, 'validate');
  assert.equal(dup.code, 2);
  assert.match(dup.stderr, /同时被任务/);
});

// ── A20 收尾流水线存在性（V-TASK-13）──

test('V-TASK-13：黄金夹具含 full-test（pipeline）→ 零警告；删掉后 warn 且仍 exit 0', async (t) => {
  const root = await cloneGolden(t);
  const base = (vima(root, 'validate'), await readReport(root));
  assert.equal(base.warnings.filter((w) => w.rule === 'V-TASK-13').length, 0);

  await rm(path.join(root, 'docs/tasks/full-test.md'));
  const r = vima(root, 'validate');
  const report = await readReport(root);
  const hits = report.warnings.filter((w) => w.rule === 'V-TASK-13');
  assert.equal(hits.length, 1, `应命中 1 条 V-TASK-13；stderr: ${r.stderr}`);
  assert.match(hits[0].message, /pipeline/);
  // warn 不阻断：存量项目不因本规则被挡在 /go 之外（A19 升级可达性）
  assert.equal(r.code, 0, `V-TASK-13 应为 warn 而非 error；stderr: ${r.stderr}`);
});

test('V-TASK-13：无 business 任务的项目不触发（规则自锚定）', async (t) => {
  const root = await cloneGolden(t);
  for (const f of ['device-api-be.md', 'device-list-fe.md', 'full-test.md']) {
    await rm(path.join(root, 'docs/tasks', f));
  }
  vima(root, 'validate');
  const report = await readReport(root);
  assert.equal(report.warnings.filter((w) => w.rule === 'V-TASK-13').length, 0);
});

test('V-TASK-12：全部 backend 任务声明 apis 但并集漏接口 → exit 2', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root,
    'docs/tasks/device-api-be.md',
    'contract: docs/contracts/device-api.md',
    'contract: docs/contracts/device-api.md\napis: [\'GET /api/device/list\', \'POST /api/device\']',
  );
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /无任何 backend 任务负责/);
  assert.match(r.stderr, /GET \/api\/device\/detail/);
});

test('apis 结构非法（空数组）→ frontmatter 校验拦截，exit 2', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/tasks/device-api-be.md', 'retryCount: 0', 'retryCount: 0\napis: []');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  // loadTasks 的 TASK_FM 在 validate 内被归一为 V-TASK-01 条目（既有口径），断言消息本体
  assert.match(r.stderr, /V-TASK-01/);
  assert.match(r.stderr, /apis 必须是非空的接口字符串数组/);
});

// ── A22 字段级机检（sustain-v3 实战反馈 F1–F4）──
// 这四条规则的成败全在误报边界上：反馈文档实测三版脚本给出 54 → 32 → 13，前两个都是错的。
// 因此每条规则的「不该报」用例与「该报」用例同等重要。

test('V-SPEC-15 正向：弹窗必填字段不在提交入参里 → warn（用户填了即丢）', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root, 'docs/spec.md',
    '{ field: name, label: 设备名称, type: input, required: true }',
    '{ field: notInContract, label: 幽灵字段, type: input, required: true }',
  );
  const r = vima(root, 'validate');
  const report = await readReport(root);
  const hits = report.warnings.filter((w) => w.rule === 'V-SPEC-15');
  // 正向（弹窗多字段）+ 反向（契约 name 无处填）各一条
  assert.equal(hits.length, 2, `stderr: ${r.stderr}`);
  assert.ok(hits.some((h) => /notInContract/.test(h.message) && /填了即丢/.test(h.message)));
  assert.ok(hits.some((h) => /必填入参 "name"/.test(h.message)));
  assert.equal(r.code, 0, 'V-SPEC-15 恒为 warn（定位是候选清单，不是判决）');
});

test('V-SPEC-15 反向：契约必填入参在弹窗里无处填 → warn（提交必被参数校验拒绝）', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root, 'docs/contracts/device-api.md',
    '      - { name: name, type: string, required: true }',
    '      - { name: name, type: string, required: true }\n      - { name: scaleType, type: string, required: true }',
  );
  const report = (vima(root, 'validate'), await readReport(root));
  const hits = report.warnings.filter((w) => w.rule === 'V-SPEC-15');
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.match(hits[0].message, /scaleType/);
});

test('V-SPEC-15 误报边界：submit 指向 GET 的弹窗整体跳过（选择/参考类字段本就不提交）', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', 'submit: { api: POST /api/device }', 'submit: { api: GET /api/device/list }');
  await mutate(
    root, 'docs/spec.md',
    '{ field: name, label: 设备名称, type: input, required: true }',
    '{ field: notInContract, label: 幽灵字段, type: input, required: true }',
  );
  const report = (vima(root, 'validate'), await readReport(root));
  assert.equal(report.warnings.filter((w) => w.rule === 'V-SPEC-15').length, 0);
});

test('V-SPEC-15 误报边界：未声明子结构的 json 聚合入参 → 该端点双向整体跳过', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root, 'docs/spec.md',
    '{ field: name, label: 设备名称, type: input, required: true }',
    '{ field: notInContract, label: 幽灵字段, type: input, required: true }',
  );
  await mutate(
    root, 'docs/contracts/device-api.md',
    '      - { name: name, type: string, required: true }',
    '      - { name: name, type: string, required: true }\n      - { name: payload, type: json }',
  );
  const report = (vima(root, 'validate'), await readReport(root));
  assert.equal(
    report.warnings.filter((w) => w.rule === 'V-SPEC-15').length, 0,
    '聚合字段可由多个弹窗字段拼成，无从判断嵌套时必须跳过（实测这是误报主因）',
  );
});

test('V-SPEC-15 与 F4 联动：json 声明了 fields 子结构 → 子字段名并入比对集，不再误报', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root, 'docs/spec.md',
    '{ field: name, label: 设备名称, type: input, required: true }',
    '{ field: nested, label: 嵌套字段, type: input, required: true }',
  );
  await mutate(
    root, 'docs/contracts/device-api.md',
    '      - { name: name, type: string, required: true }',
    '      - { name: payload, type: json, fields: [{ name: nested, type: string }] }',
  );
  const report = (vima(root, 'validate'), await readReport(root));
  assert.equal(report.warnings.filter((w) => w.rule === 'V-SPEC-15').length, 0);
});

test('V-SPEC-16：nav 携带 params 而目标页未声明 → exit 2', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root, 'docs/spec.md',
    '{ label: 详情, action: nav, target: PAGE-02, priority: secondary }',
    '{ label: 详情, action: nav, target: PAGE-02, priority: secondary, params: { step: screening } }',
  );
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hits = report.errors.filter((e) => e.rule === 'V-SPEC-16');
  assert.equal(hits.length, 1);
  assert.match(hits[0].message, /未声明该导航参数/);
});

test('V-SPEC-16：取值不在目标页取值域内 → exit 2；合法取值 → 放行', async (t) => {
  for (const [val, code] of [['bogus', 2], ['screening', 0]]) {
    const root = await cloneGolden(t);
    await mutate(
      root, 'docs/spec.md',
      '{ label: 详情, action: nav, target: PAGE-02, priority: secondary }',
      `{ label: 详情, action: nav, target: PAGE-02, priority: secondary, params: { step: ${val} } }`,
    );
    await mutate(root, 'docs/spec.md', 'id: PAGE-02', 'id: PAGE-02\nparams:\n  - { name: step, values: [screening, followup] }');
    const r = vima(root, 'validate');
    assert.equal(r.code, code, `step=${val} 期望 exit ${code}；stderr: ${r.stderr}`);
  }
});

test('V-SPEC-16：不携带 params 的 nav 完全不触发（规则由声明主动开启，存量项目零影响）', async (t) => {
  const root = await cloneGolden(t);
  const report = (vima(root, 'validate'), await readReport(root));
  assert.equal(report.errors.filter((e) => e.rule === 'V-SPEC-16').length, 0);
});

// ── A33 flow 引用闭环（V-SPEC-17 error / V-SPEC-18 warn）──

test('V-SPEC-17：黄金夹具 flow 全绿——存量合法流程零误伤', async (t) => {
  const root = await cloneGolden(t);
  const report = (vima(root, 'validate'), await readReport(root));
  assert.equal(report.errors.filter((e) => e.rule === 'V-SPEC-17').length, 0);
  assert.equal(report.warnings.filter((w) => w.rule === 'V-SPEC-18').length, 0);
});

test('V-SPEC-17：步骤引用不存在的 page / role / next / api → 逐项 error，exit 2', async (t) => {
  const cases = [
    ['page: PAGE-01, action: 点击新增并提交设备表单', 'page: PAGE-99, action: 点击新增并提交设备表单', /不存在的页面 "PAGE-99"/],
    ['role: ROLE-01, page: PAGE-01, action: 点击新增', 'role: ROLE-99, page: PAGE-01, action: 点击新增', /不存在的角色 "ROLE-99"/],
    ['next: PAGE-02', 'next: PAGE-98', /去向 next 引用不存在的页面 "PAGE-98"/],
    ['api: POST /api/device, next: PAGE-01', 'api: POST /api/ghost, next: PAGE-01', /不在任何契约中/],
  ];
  for (const [from, to, re] of cases) {
    const root = await cloneGolden(t);
    await mutate(root, 'docs/spec.md', from, to);
    const r = vima(root, 'validate');
    assert.equal(r.code, 2, `变异 "${to}" 应 exit 2；stderr: ${r.stderr}`);
    const hits = (await readReport(root)).errors.filter((e) => e.rule === 'V-SPEC-17');
    assert.equal(hits.length, 1, `变异 "${to}"：${JSON.stringify(hits)}`);
    assert.match(hits[0].message, re);
  }
});

test('V-SPEC-17：流程无 steps → error（空流程无法审计闭环）', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root, 'docs/spec.md',
    'steps:\n  - { role: ROLE-01, page: PAGE-01, action: 点击新增并提交设备表单, api: POST /api/device, next: PAGE-01 }\n'
      + '  - { role: ROLE-01, page: PAGE-01, action: 点击行内详情, api: GET /api/device/detail, next: PAGE-02 }',
    'steps: []',
  );
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const hits = (await readReport(root)).errors.filter((e) => e.rule === 'V-SPEC-17');
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.match(hits[0].message, /没有任何 steps/);
});

test('V-SPEC-17：只校验已声明字段——省略 role/api 的步骤不触发（声明即承诺）', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root, 'docs/spec.md',
    '  - { role: ROLE-01, page: PAGE-01, action: 点击行内详情, api: GET /api/device/detail, next: PAGE-02 }',
    '  - { page: PAGE-01, action: 点击行内详情, next: PAGE-02 }',
  );
  const r = vima(root, 'validate');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
});

test('V-SPEC-18：步骤角色未拥有该页菜单 → warn（不改退出码）', async (t) => {
  const root = await cloneGolden(t);
  // ROLE-02 只有 MENU-01；把第二步（PAGE-02 / MENU-02）的角色换成 ROLE-02
  await mutate(
    root, 'docs/spec.md',
    '  - { role: ROLE-01, page: PAGE-01, action: 点击行内详情, api: GET /api/device/detail, next: PAGE-02 }',
    '  - { role: ROLE-02, page: PAGE-02, action: 查看详情, api: GET /api/device/detail }',
  );
  const r = vima(root, 'validate');
  assert.equal(r.code, 0, 'warn 不改退出码');
  const hits = (await readReport(root)).warnings.filter((w) => w.rule === 'V-SPEC-18');
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.match(hits[0].message, /角色 ROLE-02 未拥有页面 PAGE-02 的菜单 MENU-02/);
});

test('V-CON-08：字段只出现在写面 → warn；标 writeOnly 后豁免', async (t) => {
  for (const [extra, expect] of [['', 1], [', writeOnly: true', 0]]) {
    const root = await cloneGolden(t);
    await mutate(
      root, 'docs/contracts/device-api.md',
      '      - { name: name, type: string, required: true }',
      `      - { name: name, type: string, required: true }\n      - { name: secretCode, type: string${extra} }`,
    );
    const report = (vima(root, 'validate'), await readReport(root));
    const hits = report.warnings.filter((w) => w.rule === 'V-CON-08');
    assert.equal(hits.length, expect, `extra="${extra}"：${JSON.stringify(hits)}`);
    if (expect > 0) assert.match(hits[0].message, /只进不出/);
  }
});

test('V-CON-08 误报边界：只读字段（id/createdAt）不报——只查「只进」方向', async (t) => {
  const root = await cloneGolden(t);
  const report = (vima(root, 'validate'), await readReport(root));
  const hits = report.warnings.filter((w) => w.rule === 'V-CON-08');
  assert.deepEqual(hits, [], '黄金夹具的 id/createdAt/status 只在响应里，反方向报出来是纯噪声');
});

test('V-CON-09：type json 无子协议 → warn；enforced: false 显式豁免', async (t) => {
  for (const [extra, expect] of [['', 1], [', enforced: false', 0]]) {
    const root = await cloneGolden(t);
    await mutate(
      root, 'docs/contracts/device-api.md',
      '      - { name: name, type: string, required: true }',
      `      - { name: name, type: string, required: true }\n      - { name: blob, type: json, writeOnly: true${extra} }`,
    );
    const report = (vima(root, 'validate'), await readReport(root));
    const hits = report.warnings.filter((w) => w.rule === 'V-CON-09');
    assert.equal(hits.length, expect, `extra="${extra}"：${JSON.stringify(hits)}`);
    if (expect > 0) assert.match(hits[0].message, /既无 fields 子结构/);
  }
});

test('V-YAML-01（A22 修正）：嵌套 flow 集合是合法标准 YAML，不再误报', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root, 'docs/contracts/device-api.md',
    '      - { name: name, type: string, required: true }',
    '      - { name: payload, type: json, fields: [{ name: nested, type: string }] }',
  );
  const report = (vima(root, 'validate'), await readReport(root));
  assert.equal(
    report.warnings.filter((w) => w.rule === 'V-YAML-01').length, 0,
    'fields: [{ ... }] 与 params: { ... } 都是合法标准 YAML，规则目标是 plain scalar 里的花括号',
  );
});

// ── A24/F10：V-TASK-11 只对可调整的任务生效 ──

test('V-TASK-11：status=done 的任务不再触发拆分建议（清不掉的 warn 会废掉整个 warn 列表）', async (t) => {
  const root = await cloneGolden(t);
  // 复用超限契约的构造方式：补到 11 个接口（人读小节 + 机读块同步，避免 V-CON-06 不一致）
  const rel = 'docs/contracts/device-api.md';
  const p = path.join(root, rel);
  let text = await readFile(p, 'utf8');
  const extraSections = [];
  const extraApis = [];
  for (let i = 1; i <= 7; i++) {
    extraSections.push(`## GET /api/device/y${i}\n\n- 请求：无\n- 响应：\`{ ok: boolean }\`\n- 错误码：40001\n`);
    extraApis.push(
      `  - method: GET\n    path: /api/device/y${i}\n    request: []\n`
        + '    response: "{ ok }"\n    errors: [40001]\n',
    );
  }
  text = text.replace('\`\`\`yaml vima:contract', `${extraSections.join('\n')}\n\`\`\`yaml vima:contract`);
  text = text.replace(/\n\`\`\`\s*$/, `\n${extraApis.join('')}\`\`\`\n`);
  await writeFile(p, text);

  // 任务仍是 pending：规则命中（此时「拆分」是可执行的行动项）
  vima(root, 'validate');
  const pending = await readReport(root);
  assert.equal(
    pending.warnings.filter((w) => w.rule === 'V-TASK-11').length, 1,
    'pending 任务应命中 V-TASK-11',
  );

  // 置 done：规则不再命中（唯一行动项已不可执行）
  await mutate(root, 'docs/tasks/device-api-be.md', 'status: pending', 'status: done');
  vima(root, 'validate');
  const done = await readReport(root);
  assert.equal(
    done.warnings.filter((w) => w.rule === 'V-TASK-11').length, 0,
    '已完成任务的唯一行动项「拆分」不可执行，不应再报——永不消失的 warn 会训练用户忽略整张列表',
  );
});

test('V-TASK-11 豁免只限本条：V-TASK-07/08/09 在任务 done 后仍然生效（它们仍可执行）', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/tasks/device-list-fe.md', 'status: pending', 'status: done');
  await mutate(
    root, 'docs/tasks/device-list-fe.md',
    '## 验收清单',
    '## 验收清单\n\n- [ ] 调用 GET /api/device/notinpage 返回结构与契约一致',
  );
  vima(root, 'validate');
  const report = await readReport(root);
  assert.ok(
    report.warnings.some((w) => w.rule === 'V-TASK-08'),
    'V-TASK-08（引用漂移）在任务完成后仍可执行——补清单/改引用都做得到，不该豁免',
  );
});

// ── V-DSN PDL 设计语言（A27）：声明即承诺，未声明零影响 ──

/**
 * 把 golden spec 剥回 A27 之前的存量形态（design 块整块删除 + A27 附属键）。
 * design 块同时承载 A27 pattern/density/fold 与 A34 fidelity，按 YAML 顶层边界
 * 整块删除，避免新增 design 子键后遗留悬空缩进。
 */
async function stripPdlKeys(root) {
  const p = path.join(root, 'docs/spec.md');
  let text = await readFile(p, 'utf8');
  text = text
    .replace(/^design:[^\n]*\n(?: {2}[^\n]*\n)*/gm, '')
    .replace(/\n    name: 设备表格\n    intent: 管理员定位并操作单台设备的主工作区/, '')
    .replace(/, priority: (?:primary|secondary)/g, '');
  await writeFile(p, text);
}

/** 把项目标成 pre-A34 存量（V-DSN-12 据此整体豁免，D-A34-18）。 */
async function markLegacy(root) {
  const p = path.join(root, 'docs/lifecycle.json');
  const lc = JSON.parse(await readFile(p, 'utf8'));
  lc.designCapability = 'legacy';
  await writeFile(p, `${JSON.stringify(lc, null, 2)}\n`);
}

test('V-DSN 兼容性：pre-A34 存量项目剥掉 design 声明 → 零 V-DSN 发现（A27 未声明零影响的承诺仍成立）', async (t) => {
  const root = await cloneGolden(t);
  await stripPdlKeys(root);
  await markLegacy(root); // 存量形态 spec ⇔ 存量项目：designCapability: legacy
  const r = vima(root, 'validate');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const report = await readReport(root);
  const dsn = [...report.errors, ...report.warnings].filter((e) => e.rule.startsWith('V-DSN'));
  assert.deepEqual(dsn, [], '存量 spec 不得出现任何 V-DSN 发现');
});

// ── V-DSN-12（A34 D-A34-01）：fidelity 必须显式声明，堵住「不写 = 不是 D1/D2 = 跳过全部设计流程」 ──

test('V-DSN-12 否定用例：A34 项目缺 design.fidelity → 逐页 error（规则必须真的会红）', async (t) => {
  const root = await cloneGolden(t);
  await stripPdlKeys(root); // 夹具是 designCapability: a34，不标 legacy
  const r = vima(root, 'validate');
  assert.equal(r.code, 2, 'A34 项目缺定级必须失败');
  const report = await readReport(root);
  const hits = report.errors.filter((e) => e.rule === 'V-DSN-12');
  assert.equal(hits.length, 2, `golden 两页各报一条，实得 ${hits.length}`);
  assert.match(hits[0].message, /未声明 design\.fidelity/);
  assert.match(hits[0].message, /D0 也要写出来/, '须点明「缺失」不等价于 D0');
});

test('V-DSN-12：显式写 D0 即通过——D0 是裁定，不是缺省', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'validate');
  const report = await readReport(root);
  assert.equal(report.errors.filter((e) => e.rule === 'V-DSN-12').length, 0, `stderr: ${r.stderr}`);
});

// ── V-DSN-10（A34 D-A34-06）：pattern: custom 的诚实标注三件套 ──

test('V-DSN-10 否定用例：custom 缺 intent / 非 D2 → error', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', 'pattern: list', 'pattern: custom');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const msgs = report.errors.filter((e) => e.rule === 'V-DSN-10').map((e) => e.message);
  assert.equal(msgs.length, 2, `应同时报缺 intent 与非 D2，实得：${msgs.join(' / ')}`);
  assert.ok(msgs.some((m) => /缺 design\.intent/.test(m)), '独特版面必须声明意图');
  assert.ok(msgs.some((m) => /必须是 D2/.test(m)), 'custom 页必须是 D2');
});

test('V-DSN-10：custom + intent + D2 三件套齐全 → 放行（逃生口是开着的，不是堵死的）', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', 'pattern: list', 'pattern: custom');
  await mutate(root, 'docs/spec.md', '  fidelity: D0                # A34 V-DSN-12', '  fidelity: D2                # A34 V-DSN-12');
  await mutate(
    root,
    'docs/spec.md',
    '  fold: [设备表格]',
    '  fold: [设备表格]\n  intent: 设备台账与实时状态在同一视野内比对\n'
      + '  primaryTask: 定位一台异常设备并完成处置\n'
      + '  mustPreserve:\n'
      + '    - { id: status-live, kind: runtime, statement: 设备状态实时刷新不整页重载, verifier: experience }',
  );
  vima(root, 'validate');
  const report = await readReport(root);
  const hits = report.errors.filter((e) => ['V-DSN-10', 'V-DSN-11'].includes(e.rule));
  assert.deepEqual(hits, [], '三件套齐全不得报错');
});

// ── V-DSN-11（A34 D-A34-04/05）：保真级带来的必填声明；mustPreserve 类型即执行者路由 ──

test('V-DSN-11 否定用例：D1 缺 primaryTask → error', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', '  fidelity: D0                # A34 V-DSN-12', '  fidelity: D1                # A34 V-DSN-12');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hits = report.errors.filter((e) => e.rule === 'V-DSN-11');
  assert.equal(hits.length, 1);
  assert.match(hits[0].message, /缺 design\.primaryTask/);
});

test('V-DSN-11 否定用例：D2 的 mustPreserve 缺 kind / kind↔verifier 不相容 → error', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', '  fidelity: D0                # A34 V-DSN-12', '  fidelity: D2                # A34 V-DSN-12');
  await mutate(
    root,
    'docs/spec.md',
    '  fold: [设备表格]',
    '  fold: [设备表格]\n  primaryTask: 定位一台异常设备并完成处置\n'
      + '  mustPreserve:\n'
      + '    - { id: no-kind, statement: 缺 kind 的条目, verifier: design }\n'
      + '    - { id: mismatch, kind: runtime, statement: 切换设备时壳层不重挂载, verifier: design }',
  );
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const msgs = report.errors.filter((e) => e.rule === 'V-DSN-11').map((e) => e.message);
  assert.ok(msgs.some((m) => /\.kind ""? ?非法|kind "" 非法/.test(m) || /kind/.test(m)), `应报 kind 非法：${msgs.join(' / ')}`);
  assert.ok(
    msgs.some((m) => /不相容/.test(m) && /runtime/.test(m)),
    `runtime 类只能由 experience 执行：${msgs.join(' / ')}`,
  );
});

test('V-DSN-11 否定用例：D2 完全没有 mustPreserve → error（D2 必须登记不可降级的交互事实）', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', '  fidelity: D0                # A34 V-DSN-12', '  fidelity: D2                # A34 V-DSN-12');
  await mutate(root, 'docs/spec.md', '  fold: [设备表格]', '  fold: [设备表格]\n  primaryTask: 定位一台异常设备并完成处置');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hits = report.errors.filter((e) => e.rule === 'V-DSN-11');
  assert.equal(hits.length, 1);
  assert.match(hits[0].message, /缺 design\.mustPreserve/);
});

test('V-DSN-01 放松：只带 A34 键的 design 块合法（不连带把 pattern/density 变成全页强制）', async (t) => {
  const root = await cloneGolden(t);
  vima(root, 'validate');
  const report = await readReport(root);
  // PAGE-02 的 design 块只有 fidelity，既不该报 pattern 缺失也不该报 density 缺失
  const hits = report.errors.filter((e) => e.rule === 'V-DSN-01' && /PAGE-02/.test(e.message));
  assert.deepEqual(hits, [], 'fidelity-only 的 design 块不得触发 A27 完整性');
});

test('V-DSN-01：pattern/density 非法、列 role/density 非法 → error', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', 'pattern: list', 'pattern: fancy');
  await mutate(root, 'docs/spec.md', 'density: default', 'density: cozy');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hits = report.errors.filter((e) => e.rule === 'V-DSN-01');
  assert.equal(hits.length, 2, JSON.stringify(hits));
  assert.match(hits[0].message, /pattern "fancy" 非法/);
  assert.match(hits[1].message, /density "cozy" 非法/);
});

test('V-DSN-03：同词多例缺实例名 → error；补齐唯一 name → 放行', async (t) => {
  const root = await cloneGolden(t);
  // PAGE-02 加第二个 form 块（同词多例）且都不带 name
  await mutate(
    root, 'docs/spec.md',
    'layout: [toolbar, form]',
    'layout: [toolbar, form, form]',
  );
  await mutate(
    root, 'docs/spec.md',
    `  - block: form
    api: GET /api/device/detail`,
    `  - block: form
    api: GET /api/device/detail
    items:
      - { type: text, label: 基本信息 }
  - block: form`,
  );
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const hits = report.errors.filter((e) => e.rule === 'V-DSN-03');
  assert.ok(hits.length >= 2, `同词两例均缺 name 应逐例报：${JSON.stringify(hits)}`);
});

test('V-DSN-04：shape 非法 → error；freeform 无 intent → error；带 intent → 放行', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root, 'docs/spec.md',
    '    intent: 管理员定位并操作单台设备的主工作区\n',
    '    data: { shape: table3d }\n',
  );
  let r = vima(root, 'validate');
  assert.equal(r.code, 2);
  let report = await readReport(root);
  assert.ok(report.errors.some((e) => e.rule === 'V-DSN-04' && /shape "table3d" 非法/.test(e.message)));

  await mutate(root, 'docs/spec.md', 'data: { shape: table3d }', 'data: { shape: freeform }');
  r = vima(root, 'validate');
  assert.equal(r.code, 2);
  report = await readReport(root);
  assert.ok(report.errors.some((e) => e.rule === 'V-DSN-04' && /freeform 但缺 intent/.test(e.message)));

  await mutate(root, 'docs/spec.md', 'data: { shape: freeform }', 'data: { shape: freeform }\n    intent: 自由布局的设备拓扑图');
  r = vima(root, 'validate');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
});

test('V-DSN-05：priority 非法与页面级双 primary → error', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md',
    'action: api, api: POST /api/device/batch-delete, priority: secondary',
    'action: api, api: POST /api/device/batch-delete, priority: urgent');
  let r = vima(root, 'validate');
  assert.equal(r.code, 2);
  let report = await readReport(root);
  assert.ok(report.errors.some((e) => e.rule === 'V-DSN-05' && /priority "urgent" 非法/.test(e.message)));

  await mutate(root, 'docs/spec.md', 'priority: urgent', 'priority: primary');
  r = vima(root, 'validate');
  assert.equal(r.code, 2);
  report = await readReport(root);
  assert.ok(report.errors.some((e) => e.rule === 'V-DSN-05' && /2 个 primary/.test(e.message)),
    '页面级 items+actions 合计两个 primary 应报（两个主按钮 = 没有主按钮）');
});

test('V-DSN-07：fold 引用不存在的实例 → error', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', 'fold: [设备表格]', 'fold: [设备表格, 不存在的块]');
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  assert.ok(report.errors.some((e) => e.rule === 'V-DSN-07' && /不存在的组件实例 "不存在的块"/.test(e.message)));
});

test('V-DSN-06/08（warn）：行内动作超限无 overflow、shape:list 无 keyFields → 只警告不阻断', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root, 'docs/spec.md',
    `    rowActions:
      - { label: 编辑, action: modal, target: MODAL-01, priority: primary }
      - { label: 详情, action: nav, target: PAGE-02, priority: secondary }`,
    `    data: { shape: list }
    rowActions:
      - { label: 编辑, action: modal, target: MODAL-01, priority: primary }
      - { label: 详情, action: nav, target: PAGE-02, priority: secondary }
      - { label: 导出, action: api, api: GET /api/device/list }
      - { label: 归档, action: api, api: GET /api/device/list }`,
  );
  const r = vima(root, 'validate');
  assert.equal(r.code, 0, `warn 不阻断，stderr: ${r.stderr}`);
  const report = await readReport(root);
  assert.ok(report.warnings.some((e) => e.rule === 'V-DSN-06' && /4 条且无一条 overflow/.test(e.message)));
  assert.ok(report.warnings.some((e) => e.rule === 'V-DSN-08' && /未声明 keyFields/.test(e.message)));
});

test('A27 actions 附着点：并入既有交互校验（悬空 nav 报 V-SPEC-05；跨端 nav 报 V-SPEC-13）与任务计点', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root, 'docs/spec.md',
    `  - block: table
    name: 设备表格`,
    `  - block: table
    name: 设备表格
    actions:
      - { type: button, label: 快捷新增, action: nav, target: PAGE-99 }`,
  );
  const r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  assert.ok(
    report.errors.some((e) => e.rule === 'V-SPEC-05' && /actions\[0\] nav 指向不存在的页面 "PAGE-99"/.test(e.message)),
    `actions 条目须走同一套交互校验：${JSON.stringify(report.errors.filter((e) => e.rule === 'V-SPEC-05'))}`,
  );
});

test('modal presentation：drawer 合法、其余非法（A27 C-A27-03）', async (t) => {
  const root = await cloneGolden(t);
  await mutate(root, 'docs/spec.md', '  - id: MODAL-01\n    title: 设备表单', '  - id: MODAL-01\n    presentation: drawer\n    title: 设备表单');
  let r = vima(root, 'validate');
  assert.equal(r.code, 0, `drawer 应合法：${r.stderr}`);
  await mutate(root, 'docs/spec.md', 'presentation: drawer', 'presentation: popover');
  r = vima(root, 'validate');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  assert.ok(report.errors.some((e) => e.rule === 'V-SPEC-03' && /presentation "popover" 非法/.test(e.message)));
});
