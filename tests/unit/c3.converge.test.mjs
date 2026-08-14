// C3 单测：vima converge —— 跨任务集成对账（A20，契约 §8.1 V-INT 规则族 / §6.13 报告）
// 黄金夹具的 Controller 没有 Spring 注解，故各用例按需注入注解构造实现表。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, rm, mkdir, readFile, writeFile, unlink, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(HERE, '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');
const REPORT_REL = '.vima/reports/convergence.json';
const CONTROLLER_REL = 'backend/src/main/java/demo/DeviceController.java';

async function cloneGolden(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-converge-'));
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

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** 给黄金夹具的 Controller 补上 Spring 注解，使 4 个契约接口全部有实现。 */
async function annotateController(root, { skipDetail = false } = {}) {
  const p = path.join(root, CONTROLLER_REL);
  let s = await readFile(p, 'utf8');
  s = s.replace('public class DeviceController {', '@RequestMapping("/api/device")\npublic class DeviceController {');
  s = s.replace('    public Object list(', '    @GetMapping("/list")\n    public Object list(');
  s = s.replace('    public Object create(', '    @PostMapping\n    public Object create(');
  s = s.replace('    public Object batchDelete(', '    @PostMapping("/batch-delete")\n    public Object batchDelete(');
  if (!skipDetail) {
    s = s.replace('    public Object detail(', '    @GetMapping("/detail")\n    public Object detail(');
  }
  await writeFile(p, s);
}

/** 把某个任务的 frontmatter 字段改值（简单行替换，够单测用）。 */
async function setFm(root, taskFile, from, to) {
  const p = path.join(root, 'docs', 'tasks', taskFile);
  const s = await readFile(p, 'utf8');
  assert.ok(s.includes(from), `任务 ${taskFile} 中未找到 "${from}"`);
  await writeFile(p, s.replace(from, to));
}

test('黄金夹具：零 error，报告结构齐全，exit 0', async (t) => {
  const root = await cloneGolden(t);
  await annotateController(root);
  const r = vima(root, 'converge');
  assert.equal(r.code, 0, `stderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const report = await readReport(root);
  assert.equal(report.schemaVersion, '1');
  assert.equal(report.summary.errors, 0);
  assert.equal(report.scope.skipped, null);
  assert.equal(report.scope.contractApis, 4);
  assert.equal(report.scope.markedBackendFiles, 1);
  assert.ok(Array.isArray(report.findings));
  assert.equal(typeof report.byTask, 'object');
  assert.match(r.stdout, /集成对账通过/);
});

test('确定性：同一输入两次运行字节一致（无时间戳/随机数）', async (t) => {
  const root = await cloneGolden(t);
  await annotateController(root);
  vima(root, 'converge');
  const first = await readFile(path.join(root, REPORT_REL), 'utf8');
  vima(root, 'converge');
  const second = await readFile(path.join(root, REPORT_REL), 'utf8');
  assert.equal(first, second);
});

test('V-INT-01 漏实现：负责任务 done 但接口无实现 → error，exit 2', async (t) => {
  const root = await cloneGolden(t);
  await annotateController(root, { skipDetail: true });
  await setFm(root, 'device-api-be.md', 'status: pending', 'status: done');
  const r = vima(root, 'converge');
  assert.equal(r.code, 2, `stdout: ${r.stdout}`);
  const report = await readReport(root);
  const f = report.findings.find((x) => x.rule === 'V-INT-01');
  assert.ok(f, `findings: ${JSON.stringify(report.findings)}`);
  assert.equal(f.key, 'GET /api/device/detail');
  assert.deepEqual(f.owners, ['device-api-be']);
  assert.deepEqual(report.byTask['device-api-be'], ['V-INT-01 GET /api/device/detail']);
  assert.match(r.stderr, /V-INT-01/);
});

test('V-INT-01 不假红：负责任务未 done 时漏实现不报', async (t) => {
  const root = await cloneGolden(t);
  await annotateController(root, { skipDetail: true }); // device-api-be 仍为 pending
  const r = vima(root, 'converge');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const report = await readReport(root);
  assert.equal(report.findings.filter((x) => x.rule === 'V-INT-01').length, 0);
});

test('V-INT-02 重复实现：同一接口落在两个后端文件 → error', async (t) => {
  const root = await cloneGolden(t);
  await annotateController(root);
  const src = await readFile(path.join(root, CONTROLLER_REL), 'utf8');
  await writeFile(
    path.join(root, 'backend/src/main/java/demo/DeviceCopyController.java'),
    src.replace(/DeviceController/g, 'DeviceCopyController'),
  );
  const r = vima(root, 'converge');
  assert.equal(r.code, 2, `stdout: ${r.stdout}`);
  const report = await readReport(root);
  const dup = report.findings.filter((x) => x.rule === 'V-INT-02');
  assert.equal(dup.length, 4, JSON.stringify(dup.map((d) => d.key)));
  assert.equal(dup[0].paths.length, 2);
  assert.deepEqual(dup[0].owners, ['device-api-be']);
});

test('V-INT-03 越界实现：实现文件的 @vima 不在 apis 责任田内 → error', async (t) => {
  const root = await cloneGolden(t);
  await annotateController(root);
  // device-api-be 声明只负责 list；另建 device-extra-be 负责其余三个
  await setFm(
    root, 'device-api-be.md',
    'contract: docs/contracts/device-api.md',
    'contract: docs/contracts/device-api.md\napis: ["GET /api/device/list"]',
  );
  const be = await readFile(path.join(root, 'docs/tasks/device-api-be.md'), 'utf8');
  await writeFile(
    path.join(root, 'docs/tasks/device-extra-be.md'),
    be.replace(/device-api-be/g, 'device-extra-be')
      .replace('apis: ["GET /api/device/list"]',
        'apis: ["POST /api/device", "POST /api/device/batch-delete", "GET /api/device/detail"]'),
  );
  // Controller 全部由 device-api-be 标注 → 它实现了三个不属于自己的接口
  const r = vima(root, 'converge');
  assert.equal(r.code, 2, `stdout: ${r.stdout}`);
  const report = await readReport(root);
  const over = report.findings.filter((x) => x.rule === 'V-INT-03');
  assert.equal(over.length, 3, JSON.stringify(over.map((o) => o.key)));
  assert.ok(over.every((o) => o.owners.includes('device-extra-be')));
  assert.ok(report.byTask['device-extra-be'].some((l) => l.startsWith('V-INT-03')));
});

test('V-INT-03 未声明 apis 时不启用（责任田 = 契约全集）', async (t) => {
  const root = await cloneGolden(t);
  await annotateController(root);
  const r = vima(root, 'converge');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const report = await readReport(root);
  assert.equal(report.findings.filter((x) => x.rule === 'V-INT-03').length, 0);
});

test('V-INT-04 授权端无调用 → warn（不影响退出码），--strict 时阻断', async (t) => {
  const root = await cloneGolden(t);
  await annotateController(root);
  const report0 = (vima(root, 'converge'), await readReport(root));
  const warn = report0.findings.filter((x) => x.rule === 'V-INT-04');
  assert.ok(warn.length > 0, '黄金夹具前端未调用 detail，应有 V-INT-04 warn');
  assert.ok(warn.every((w) => w.level === 'warn'));
  assert.equal(vima(root, 'converge').code, 0);
  assert.equal(vima(root, 'converge', '--strict').code, 2);
});

test('V-INT-05 缺收尾流水线：删掉 full-test → error', async (t) => {
  const root = await cloneGolden(t);
  await annotateController(root);
  await unlink(path.join(root, 'docs/tasks/full-test.md'));
  // full-test 是 device-list-fe 的下游，删除后无悬空引用；直接跑
  const r = vima(root, 'converge');
  assert.equal(r.code, 2, `stdout: ${r.stdout}`);
  const report = await readReport(root);
  assert.ok(report.findings.some((x) => x.rule === 'V-INT-05'));
});

test('作用域守卫：无带 @vima 标注的后端文件 → 后端族整族跳过，不假红', async (t) => {
  const root = await cloneGolden(t);
  await rm(path.join(root, 'backend'), { recursive: true, force: true });
  const r = vima(root, 'converge');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const report = await readReport(root);
  assert.equal(report.scope.skipped, 'no-marked-backend');
  assert.equal(report.scope.markedBackendFiles, 0);
  assert.equal(report.findings.filter((x) => ['V-INT-01', 'V-INT-02', 'V-INT-03'].includes(x.rule)).length, 0);
  assert.match(r.stdout, /后端族规则跳过/);
});

test('未过点位聚合：verifier 报告的 failed 计入退出码，waived 不计，NG 越界不可豁免', async (t) => {
  const root = await cloneGolden(t);
  await annotateController(root);
  await mkdir(path.join(root, '.vima/reports'), { recursive: true });
  await writeFile(
    path.join(root, '.vima/reports/device-list-fe-verifier.json'),
    JSON.stringify({
      taskId: 'device-list-fe',
      round: 1,
      result: 'fail',
      points: [
        { point: 'toolbar/新增 → modal MODAL-01', passed: true },
        { point: 'RULE-01 设备名唯一', passed: false },
        { point: 'RULE-02 导出延后二期', passed: false, waived: true, reason: '用户裁定二期' },
        { point: 'NG-01 越界：实现了导出', passed: false, waived: true, reason: '想蒙混' },
      ],
    }),
  );
  const r = vima(root, 'converge');
  assert.equal(r.code, 2, `stdout: ${r.stdout}`);
  const report = await readReport(root);
  assert.equal(report.summary.openPoints, 2, JSON.stringify(report.openPoints));
  assert.deepEqual(report.openPoints.map((p) => p.kind).sort(), ['failed', 'ng']);
  assert.ok(report.byTask['device-list-fe'].some((l) => l.startsWith('未过点位')));
});

test('运行时错误只报告不计退出码', async (t) => {
  const root = await cloneGolden(t);
  await annotateController(root);
  await mkdir(path.join(root, '.vima/reports'), { recursive: true });
  await writeFile(
    path.join(root, '.vima/reports/runtime-errors.jsonl'),
    '{"kind":"error","message":"boom","page":"/x"}\n{"kind":"vue","message":"bam","page":"/y"}\n',
  );
  const r = vima(root, 'converge');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const report = await readReport(root);
  assert.equal(report.summary.runtimeErrors, 2);
});

test('done 无标注收口：黄金夹具的 shared-base 计入 unmarkedDone（warn 语义，不阻断）', async (t) => {
  const root = await cloneGolden(t);
  await annotateController(root);
  const r = vima(root, 'converge');
  assert.equal(r.code, 0);
  const report = await readReport(root);
  assert.deepEqual(report.unmarkedDone, ['shared-base']);
  assert.equal(report.summary.unmarkedDone, 1);
  assert.match(r.stderr, /done 却无任何 @vima 标注/);
});

test('--json：报告同时输出 stdout 且与落盘内容一致', async (t) => {
  const root = await cloneGolden(t);
  await annotateController(root);
  const r = vima(root, 'converge', '--json');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const onDisk = await readFile(path.join(root, REPORT_REL), 'utf8');
  assert.equal(r.stdout, onDisk);
});

test('责任田含 fullstack：fullstack 任务 done 但接口没实现 → V-INT-01（只认 backend 会整体漏检）', async (t) => {
  const root = await cloneGolden(t);
  // 只给 list 补注解，其余三个接口无实现；把负责任务改成 side=fullstack 且 done
  const p = path.join(root, CONTROLLER_REL);
  let s = await readFile(p, 'utf8');
  s = s.replace('public class DeviceController {', '@RequestMapping("/api/device")\npublic class DeviceController {');
  s = s.replace('    public Object list(', '    @GetMapping("/list")\n    public Object list(');
  await writeFile(p, s);
  await setFm(root, 'device-api-be.md', 'side: backend', 'side: fullstack');
  await setFm(root, 'device-api-be.md', 'status: pending', 'status: done');
  const r = vima(root, 'converge');
  assert.equal(r.code, 2, `fullstack 任务的责任田须被识别；stdout: ${r.stdout}`);
  const report = await readReport(root);
  assert.equal(report.findings.filter((x) => x.rule === 'V-INT-01').length, 3);
});

test('V-INT-02 归属：两个文件由不同任务标注时，owners 含双方（派工单不漏人）', async (t) => {
  const root = await cloneGolden(t);
  await annotateController(root);
  const src = await readFile(path.join(root, CONTROLLER_REL), 'utf8');
  const beText = await readFile(path.join(root, 'docs/tasks/device-api-be.md'), 'utf8');
  await writeFile(
    path.join(root, 'docs/tasks/device-api-be-2.md'),
    beText.replace(/device-api-be/g, 'device-api-be-2'),
  );
  await writeFile(
    path.join(root, 'backend/src/main/java/demo/DeviceCopyController.java'),
    src.replace(/DeviceController/g, 'DeviceCopyController').replace('@vima device-api-be', '@vima device-api-be-2'),
  );
  const r = vima(root, 'converge');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  const dup = report.findings.filter((x) => x.rule === 'V-INT-02');
  assert.ok(dup.length > 0);
  assert.deepEqual(dup[0].owners, ['device-api-be', 'device-api-be-2']);
  for (const id of ['device-api-be', 'device-api-be-2']) {
    assert.ok(report.byTask[id]?.some((l) => l.startsWith('V-INT-02')), `${id} 应进派工单`);
  }
});

test('多端：V-INT-04 按端归属（golden-multi，A16 端册）', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-converge-multi-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(path.join(CLI_ROOT, 'tests', 'fixtures', 'golden-multi'), root, { recursive: true });
  assert.equal(vima(root, 'converge').code, 0, '多端黄金夹具应零 error');

  // 抹掉 patient 端对某接口的调用 → 只该端报 V-INT-04，归属该端前端任务
  const api = path.join(root, 'apps/patient/src/api/appointment.ts');
  const text = await readFile(api, 'utf8');
  const m = /return request\.get\('([^']+)'[^;]*;/.exec(text);
  assert.ok(m, 'patient 端夹具应含一处 request.get 调用');
  await writeFile(api, text.replace(m[0], 'return null as any;'));
  vima(root, 'converge');
  const report = await readReport(root);
  const warn = report.findings.filter((x) => x.rule === 'V-INT-04');
  assert.equal(warn.length, 1, JSON.stringify(warn));
  assert.match(warn[0].message, /patient/);
  assert.ok(warn[0].owners.every((id) => id.includes('patient')), `owners 应为 patient 端任务：${warn[0].owners}`);
});

test('非 vima 项目：NOT_IN_PROJECT exit 4，且不凭空创建 .vima/reports/（A24 顶层守卫）', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-converge-empty-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const r = vima(root, 'converge');
  assert.equal(r.code, 4, `stdout: ${r.stdout}`);
  assert.match(r.stderr, /vima converge: NOT_IN_PROJECT/);
  assert.equal(await fileExists(path.join(root, '.vima')), false, '不得凭空创建 .vima/');
});

test('项目内但无任务：仍报 NO_TASKS（两道守卫各司其职，不互相掩盖）', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-converge-notasks-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await writeFile(path.join(root, 'docs/lifecycle.json'), '{"schemaVersion":"2.0"}\n');
  const r = vima(root, 'converge');
  assert.equal(r.code, 4);
  assert.match(r.stderr, /vima converge: NO_TASKS/);
});

test('未知参数 → USAGE exit 3', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'converge', '--nope');
  assert.equal(r.code, 3, `stdout: ${r.stdout}`);
  assert.match(r.stderr, /vima converge: USAGE/);
});
