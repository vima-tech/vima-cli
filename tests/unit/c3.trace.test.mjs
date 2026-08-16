// C3 单测：vima trace —— @vima 标注对账：黄金夹具 2 标注 0 野生 1 虚报；野生 exit 2；--strict 升级虚报
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(HERE, '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');
const REPORT_REL = '.vima/reports/trace.json';

async function cloneGolden(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-trace-'));
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

test('黄金夹具：2 有效标注 / 0 野生 / 1 虚报（shared-base）→ warn，exit 0', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'trace');
  assert.equal(r.code, 0, `stderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const report = await readReport(root);
  // A41 起 summary 并入追溯图维度——原有三项仍逐字锁死，新维度只断言存在。
  // 不用 deepEqual 锁整个对象：那样每加一维就得改一次无关断言，
  // 久了会训练出「改断言让它变绿」的习惯，而这条用例守的是前三项的口径。
  assert.equal(report.summary.markers, 2);
  assert.equal(report.summary.wildTaskIds, 0);
  assert.equal(report.summary.doneWithoutMarker, 1);
  assert.equal(typeof report.summary.tasksWithCode, 'number', 'A41 追溯图维度应并入 summary');
  assert.equal(typeof report.summary.endpoints, 'number');
  assert.deepEqual(report.markers, [
    { taskId: 'device-api-be', file: 'backend/src/main/java/demo/DeviceController.java', line: 1 },
    { taskId: 'device-list-fe', file: 'src/api/device.ts', line: 1 },
  ]);
  assert.deepEqual(report.wild, []);
  assert.deepEqual(report.unmarked, ['shared-base']);
  assert.match(r.stdout, /✅ 有效 @vima 标注 2 处/);
  // ⚠️ 虚报清单走 stderr（契约 §3 输出流向）
  assert.match(r.stderr, /⚠️ 虚报嫌疑 1 个/);
  assert.match(r.stderr, /shared-base/);
});

test('--strict：虚报嫌疑升级为阻断 → exit 2', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'trace', '--strict');
  assert.equal(r.code, 2, `stdout: ${r.stdout}`);
});

test('野生标注：代码塞 @vima not-a-task → exit 2，报告含 file:line', async (t) => {
  const root = await cloneGolden(t);
  await writeFile(path.join(root, 'src/wild.ts'), '// @vima not-a-task\nexport const x = 1\n');
  const r = vima(root, 'trace');
  assert.equal(r.code, 2, `stdout: ${r.stdout}`);
  const report = await readReport(root);
  assert.deepEqual(report.wild, [{ taskId: 'not-a-task', file: 'src/wild.ts', line: 1 }]);
  assert.equal(report.summary.wildTaskIds, 1);
  assert.equal(report.summary.markers, 2); // 有效标注不受野生影响
  assert.match(r.stderr, /❌ 野生标注 1 处/);
  assert.match(r.stderr, /not-a-task → src\/wild\.ts:1/);
});

test('--dir 追加扫描目录：默认目录之外的标注也被收进对账', async (t) => {
  const root = await cloneGolden(t);
  await mkdir(path.join(root, 'extra'), { recursive: true });
  await writeFile(path.join(root, 'extra/util.mjs'), '// @vima shared-base\nexport const y = 2\n');
  const r = vima(root, 'trace', '--dir', 'extra');
  assert.equal(r.code, 0, `stderr: ${r.stderr}\nstdout: ${r.stdout}`);
  const report = await readReport(root);
  assert.equal(report.summary.markers, 3);
  assert.ok(report.markers.some((m) => m.file === 'extra/util.mjs' && m.taskId === 'shared-base'));
  // shared-base 有了标注 → 虚报清零
  assert.deepEqual(report.unmarked, []);
});

test('排除目录：node_modules/dist/target/.vima 内的标注不参与对账', async (t) => {
  const root = await cloneGolden(t);
  await mkdir(path.join(root, 'src/node_modules'), { recursive: true });
  await writeFile(path.join(root, 'src/node_modules/dep.js'), '// @vima not-a-task\n');
  const r = vima(root, 'trace');
  assert.equal(r.code, 0, `stdout: ${r.stdout}`);
  const report = await readReport(root);
  assert.deepEqual(report.wild, []);
});

test('A41 端形态覆盖：小程序三件套（.wxml/.wxss/.wxs）的标注同样参与对账（回归：曾整端扫不到）', async (t) => {
  const root = await cloneGolden(t);
  // A23 起 mp-native 是一等端，其页面产物是三件套而非 .vue/.ts
  await mkdir(path.join(root, 'src/pages/followup'), { recursive: true });
  await writeFile(path.join(root, 'src/pages/followup/index.wxml'),
    '<!-- @vima shared-base -->\n<view class="vm-page" data-page="PAGE-51"></view>\n');
  await writeFile(path.join(root, 'src/pages/followup/index.wxss'),
    '/* @vima shared-base */\n.vm-page { padding: var(--vm-gap-md); }\n');
  await writeFile(path.join(root, 'src/pages/followup/util.wxs'),
    '// @vima shared-base\nmodule.exports = {};\n');

  const r = vima(root, 'trace');
  assert.equal(r.code, 0, r.stderr);
  const rep = await readReport(root);
  const files = rep.markers.map((m) => m.file);
  assert.ok(files.some((f) => f.endsWith('index.wxml')), `wxml 标注应被收录：${files.join(', ')}`);
  assert.ok(files.some((f) => f.endsWith('index.wxss')), 'wxss 标注应被收录');
  assert.ok(files.some((f) => f.endsWith('util.wxs')), 'wxs 标注应被收录');
});

test('A41 端形态覆盖：产物全是 wxml/wxss 的 done 任务不再被误判「虚报嫌疑」', async (t) => {
  const root = await cloneGolden(t);
  // 黄金夹具里 shared-base 是 done 且无标注 → 基线为 1 条虚报嫌疑
  const before = vima(root, 'trace');
  const repBefore = await readReport(root);
  assert.equal(before.code, 0);
  const baseline = repBefore.summary.doneWithoutMarker;
  assert.ok(baseline >= 1, '基线应有虚报嫌疑，否则本用例失去意义');

  // 给它补一份「只有 wxml」的产物——扫得到就不该再算虚报
  await mkdir(path.join(root, 'src/pages/mine'), { recursive: true });
  await writeFile(path.join(root, 'src/pages/mine/index.wxml'),
    '<!-- @vima shared-base -->\n<view class="vm-page"></view>\n');
  const after = vima(root, 'trace');
  assert.equal(after.code, 0, after.stderr);
  const repAfter = await readReport(root);
  assert.equal(repAfter.summary.doneWithoutMarker, baseline - 1,
    'wxml 标注应把该任务从虚报嫌疑里摘掉');
});
