// 端到端黄金链路（契约 §13）：create → init → 注入黄金规划产物 → validate →
// render-review/-prototype(+--check) → plan → trace → approve → doctor → sync。
// 每步断言退出码与关键产物；负面路径验证漂移/野生标注被机检抓住。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, readFile, cp, stat, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');

let sandbox;
let proj;

function vima(args, cwd = proj) {
  // process.execPath 而非 PATH 上的 node：nvm 多版本/CI matrix 下保证跑在当前解释器（契约 §13）
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
}

before(async () => {
  sandbox = await mkdtemp(path.join(tmpdir(), 'vima-e2e-'));
  proj = path.join(sandbox, 'demo-sys');
});

after(async () => {
  await rm(sandbox, { recursive: true, force: true });
});

test('①create：admin 骨架落地，前端在项目根（设计 §15）', async () => {
  const r = vima(['create', 'demo-sys', '--template', 'admin', '--no-git', '--no-install'], sandbox);
  assert.equal(r.code, 0, r.out);
  for (const f of [
    'package.json',
    'src/main.ts',
    'src/utils/request.ts',
    'src/views/login/index.vue',
    'vendor/vima-ui-admin/package.json',
    'backend/pom.xml',
    '.vima/manifest.json',
  ]) {
    await stat(path.join(proj, f));
  }
  const pkg = JSON.parse(await readFile(path.join(proj, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'demo-sys', '变量 {{projectName}} 应已替换');
});

test('②init：工作环境就绪（宪法<50 行、hooks 可执行、lifecycle=PLANNING）', async () => {
  const r = vima(['init']);
  assert.equal(r.code, 0, r.out);
  const claudeMd = await readFile(path.join(proj, 'CLAUDE.md'), 'utf8');
  assert.ok(claudeMd.trimEnd().split('\n').length < 50, 'CLAUDE.md 必须 <50 行（§5.4）');
  const lc = JSON.parse(await readFile(path.join(proj, 'docs/lifecycle.json'), 'utf8'));
  assert.equal(lc.currentPhase, 'PLANNING');
  assert.equal(lc.templateId, 'admin');
  for (const h of ['guard-shared.mjs', 'post-write.mjs']) {
    const st = await stat(path.join(proj, '.claude/hooks', h));
    assert.ok(st.mode & 0o100, `${h} 需可执行`);
  }
});

test('③注入黄金规划产物后 validate 全绿', async () => {
  for (const dir of ['docs', 'src', 'backend']) {
    await cp(path.join(GOLDEN, dir), path.join(proj, dir), { recursive: true, force: true });
  }
  const r = vima(['validate']);
  assert.equal(r.code, 0, r.out);
  const report = JSON.parse(await readFile(path.join(proj, '.vima/reports/planning-validation.json'), 'utf8'));
  assert.equal(report.pass, true);
  assert.equal(report.errors.length, 0);
});

test('④render 双产物 + --check 无漂移（确定性渲染）', async () => {
  assert.equal(vima(['render-review']).code, 0);
  assert.equal(vima(['render-prototype']).code, 0);
  const html = await readFile(path.join(proj, 'docs/review/index.html'), 'utf8');
  assert.ok(!/https?:\/\//.test(html), '审计视图不得有外部请求（§13.2）');
  const manifest = JSON.parse(await readFile(path.join(proj, 'docs/review/prototype.manifest.json'), 'utf8'));
  assert.equal(manifest.apps.admin.pages[0].id, 'PAGE-01'); // A16 §6.7 新形态（N=1 亦然）
  assert.equal(vima(['render-review', '--check']).code, 0, '--check 应通过');
  assert.equal(vima(['render-prototype', '--check']).code, 0, '--check 应通过');
});

test('⑤plan：批次序列与模式正确（§9 算法）', async () => {
  const r = vima(['plan']);
  assert.equal(r.code, 0, r.out);
  const plan = JSON.parse(await readFile(path.join(proj, '.vima/reports/batch-plan.json'), 'utf8'));
  assert.deepEqual(plan.batches.map((b) => b.tasks), [
    ['shared-base'], ['device-api-be'], ['device-list-fe'], ['full-test'],
  ]);
  assert.deepEqual(plan.batches.map((b) => b.mode), ['serial', 'parallel', 'parallel', 'serial']);
});

test('⑥trace：黄金态通过；野生标注 → exit 2（A1 吸收项）', async () => {
  assert.equal(vima(['trace']).code, 0, '黄金态（2 标注 + 1 虚报 warn）应通过');
  assert.equal(vima(['trace', '--strict']).code, 2, '--strict 下虚报应失败');
  const target = path.join(proj, 'src/api/device.ts');
  const orig = await readFile(target, 'utf8');
  await appendFile(target, '// @vima not-a-real-task\n');
  const r = vima(['trace']);
  assert.equal(r.code, 2, '野生标注必须 exit 2');
  assert.match(r.out, /not-a-real-task/);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(target, orig);
});

test('⑦approve：前置齐备 → tasksApproved 落痕（§19.10）', async () => {
  const r = vima(['approve']);
  assert.equal(r.code, 0, r.out);
  const lc = JSON.parse(await readFile(path.join(proj, 'docs/lifecycle.json'), 'utf8'));
  assert.equal(lc.checklists.PLANNING.tasksApproved, true);
  assert.ok(lc.checklists.PLANNING.tasksApprovedAt, '须记录确认时间戳');
});

test('⑧doctor：全绿；篡改渲染产物 → exit 2 抓漂移 → 重渲染恢复', async () => {
  assert.equal(vima(['doctor']).code, 0);
  await appendFile(path.join(proj, 'docs/review/prototype.html'), '<!-- tamper -->');
  assert.equal(vima(['doctor']).code, 2, 'doctor ⑨ 必须抓到对齐产物漂移');
  assert.equal(vima(['render-prototype']).code, 0);
  assert.equal(vima(['doctor']).code, 0, '重渲染后恢复全绿');
});

test('⑨sync：重建 taskStats 与 tasks/README.md 生成视图', async () => {
  const r = vima(['sync']);
  assert.equal(r.code, 0, r.out);
  const readme = await readFile(path.join(proj, 'docs/tasks/README.md'), 'utf8');
  assert.match(readme, /generated by vima sync/);
  for (const id of ['shared-base', 'device-api-be', 'device-list-fe', 'full-test']) {
    assert.ok(readme.includes(id), `README 应含任务 ${id}`);
  }
});

test('⑩update：手改受管文件 → 旁路 .vima-new、原文件保留（§4.5 实现裁定，契约 §14）', async () => {
  const target = path.join(proj, '.claude/commands/check.md');
  await appendFile(target, '\n<!-- user tweak -->\n');
  const r = vima(['update']);
  assert.equal(r.code, 0, r.out);
  const nv = await readFile(`${target}.vima-new`, 'utf8').catch(() => null);
  assert.ok(nv !== null, '被手改的受管文件应生成 .vima-new 旁路新版本');
  assert.ok(!nv.includes('user tweak'), '.vima-new 应为纯净模板新版本');
  const tweaked = await readFile(target, 'utf8');
  assert.match(tweaked, /user tweak/, '用户修改过的原文件不得被覆盖');
});

// ── A16 多端黄金链路（golden-multi：一后端 × admin-web + mp-native 双前端）──

test('A16 多端链路：validate→render×3→sync→plan→trace→approve 全绿；doctor 端册项按阶段判级', async (t) => {
  const { mkdtemp, cp, rm, readFile: rf } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-e2e-multi-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(path.join(CLI_ROOT, 'tests', 'fixtures', 'golden-multi'), dir, { recursive: true });
  const run = (args) => {
    const r = spawnSync(process.execPath, [BIN, ...args], { cwd: dir, encoding: 'utf8' });
    return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
  };

  assert.equal(run(['validate']).code, 0, 'validate 全绿');
  assert.equal(run(['render-review']).code, 0);
  assert.equal(run(['render-prototype']).code, 0);
  assert.equal(run(['render-matrix', '--check']).code, 0, '夹具矩阵与生成器无漂移');
  assert.equal(run(['sync']).code, 0);
  assert.equal(run(['plan']).code, 0);
  assert.equal(run(['trace']).code, 0, 'trace 扫描端册目录（apps/patient/src 含标注）');
  assert.equal(run(['approve']).code, 0, 'approve 逐端新鲜度全过');
  const lc = JSON.parse(await rf(path.join(dir, 'docs/lifecycle.json'), 'utf8'));
  assert.equal(lc.checklists.PLANNING.tasksApproved, true);

  // trace 报告确认患者端标注被扫到（V-CODE 扫描面 = 端册目录，非字面量 'src'）
  const traceReport = JSON.parse(await rf(path.join(dir, '.vima/reports/trace.json'), 'utf8'));
  assert.ok(
    traceReport.markers.some((m) => m.file.startsWith('apps/patient/src/')),
    'apps/patient 的 @vima 标注在扫描面内',
  );

  // sync 生成的任务 README 含端列与端标注
  const readme = await rf(path.join(dir, 'docs/tasks/README.md'), 'utf8');
  assert.ok(readme.includes('| 端 |'), '任务总表含端列');
  assert.ok(readme.includes('［patient］'), '批次视图含端标注');

  // doctor：⑪ 端册项在 PLANNING 期对 preview 骨架缺失只 warn（不假阻塞）；
  // 本夹具无 .claude（未 init），⑥ 为 error 属预期——断言 ⑪ 不是 error 即可
  const doctor = run(['doctor', '--json']);
  const report = JSON.parse(doctor.out.slice(doctor.out.indexOf('{')));
  const apps = report.checks.find((c) => c.id === 'apps');
  assert.ok(apps, 'doctor 含端册检查项');
  assert.notEqual(apps.status, 'error', 'PLANNING 期 preview 骨架缺失不得 error（不假阻塞）');
  assert.match(apps.detail, /patient/, '端册项如实报告 patient 端骨架状态');
});
