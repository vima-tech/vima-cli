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
  assert.deepEqual(report.summary, { markers: 2, wildTaskIds: 0, doneWithoutMarker: 1 });
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
