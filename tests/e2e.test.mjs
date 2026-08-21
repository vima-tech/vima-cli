// 端到端黄金链路（契约 §13）：create → init → 注入黄金规划产物 → validate →
// render-review/-prototype(+--check) → plan → trace → converge → approve → doctor → sync。
// 每步断言退出码与关键产物；负面路径验证漂移/野生标注被机检抓住。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile, mkdir, cp, stat, appendFile } from 'node:fs/promises';
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

test('①create：admin 骨架落地，端在 apps/admin/（A28）+ 根卫生资产', async () => {
  const r = vima(['create', 'demo-sys', '--template', 'admin', '--no-git', '--no-install'], sandbox);
  assert.equal(r.code, 0, r.out);
  for (const f of [
    'apps/admin/package.json',
    'apps/admin/src/main.ts',
    'apps/admin/src/utils/request.ts',
    'apps/admin/src/views/login/index.vue',
    'apps/admin/vendor/vima-ui-admin/package.json',
    'backend/pom.xml',
    '.vima/manifest.json',
    'README.md',
    '.gitignore',
  ]) {
    await stat(path.join(proj, f));
  }
  const pkg = JSON.parse(await readFile(path.join(proj, 'apps/admin/package.json'), 'utf8'));
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
  for (const dir of ['docs', 'apps', 'backend']) {
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
  const target = path.join(proj, 'apps/admin/src/api/device.ts');
  const orig = await readFile(target, 'utf8');
  await appendFile(target, '// @vima not-a-real-task\n');
  const r = vima(['trace']);
  assert.equal(r.code, 2, '野生标注必须 exit 2');
  assert.match(r.out, /not-a-real-task/);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(target, orig);
});

test('⑥bis converge：黄金态零 error；复制一份 Controller 造重复实现 → exit 2（A20）', async () => {
  const r = vima(['converge']);
  assert.equal(r.code, 0, `黄金态应零 error：${r.out}`);
  const report = JSON.parse(await readFile(path.join(proj, '.vima/reports/convergence.json'), 'utf8'));
  assert.equal(report.schemaVersion, '1');
  assert.equal(report.summary.errors, 0);

  const { writeFile, rm } = await import('node:fs/promises');
  const ctrl = path.join(proj, 'backend/src/main/java/demo/DeviceController.java');
  const copy = path.join(proj, 'backend/src/main/java/demo/DeviceCopyController.java');
  const src = await readFile(ctrl, 'utf8');
  // 夹具 Controller 无 Spring 注解 → 先补一处 Mapping，再复制成第二份制造冲突
  const annotated = src
    .replace('public class DeviceController {', '@RequestMapping("/api/device")\npublic class DeviceController {')
    .replace('    public Object list(', '    @GetMapping("/list")\n    public Object list(');
  await writeFile(ctrl, annotated);
  await writeFile(copy, annotated.replace(/DeviceController/g, 'DeviceCopyController'));
  const dup = vima(['converge']);
  assert.equal(dup.code, 2, '同一接口两处实现必须 exit 2');
  assert.match(dup.out, /V-INT-02/);
  await rm(copy);
  await writeFile(ctrl, src);
  assert.equal(vima(['converge']).code, 0, '恢复后应回到零 error');
});

test('⑦approve：前置齐备 → tasksApproved 落痕（§19.10）', async () => {
  assert.equal(vima(['approve', '--planning']).code, 0, 'A34 项目先进入 DESIGNING');
  const r = vima(['approve']);
  assert.equal(r.code, 0, r.out);
  const lc = JSON.parse(await readFile(path.join(proj, 'docs/lifecycle.json'), 'utf8'));
  assert.equal(lc.checklists.PLANNING.tasksApproved, true);
  assert.ok(lc.checklists.PLANNING.tasksApprovedAt, '须记录确认时间戳');
});

test('⑦bis certify：approve 后达 spec-approved，双轴分离且不宣称更高等级（A32）', async () => {
  const r = vima(['certify']);
  assert.equal(r.code, 0, r.out);
  const report = JSON.parse(await readFile(path.join(proj, '.vima/reports/certify.json'), 'utf8'));
  assert.equal(report.deliveryLevel, 'spec-approved', '任务未开工时最高只能到第一级');
  assert.equal(report.templateMaturity, 'stable');
  assert.match(report.notCertified, /deployable\/stable/);
  assert.match(r.out, /模板 stable ≠ 项目 stable/);
});

test('⑦ter change：开变更 → 改 spec → 影响面命中 → 闸门拦未传播（A31）', async () => {
  const { writeFile } = await import('node:fs/promises');
  assert.equal(vima(['change', 'open', '设备列表标题调整']).code, 0);

  const specPath = path.join(proj, 'docs/spec.md');
  const spec = await readFile(specPath, 'utf8');
  await writeFile(specPath, spec.replace('id: PAGE-01\ntitle: 设备列表', 'id: PAGE-01\ntitle: 设备列表页'));

  assert.equal(vima(['change', 'impact']).code, 0);
  const impact = JSON.parse(await readFile(path.join(proj, '.vima/changes/chg-001/impact.json'), 'utf8'));
  assert.deepEqual(impact.spec.pages.modified, ['PAGE-01']);
  assert.ok(impact.affectedTasks.some((t) => t.taskId === 'device-list-fe'));

  const closed = vima(['change', 'close']);
  assert.equal(closed.code, 2, '受影响任务未 done → 闸门必须拦住');
  assert.match(closed.out, /CHANGE_UNPROPAGATED/);

  // 复位：还原 spec、重渲染、重跑 approve。最后一步不可省——doctor ⑩「批准时效」按
  // mtime 判定，spec 被动过就使批准失效（改回内容不改回 mtime）。真实动线本就是
  // 「改过规格 → 重新评审」，这里照做而不是绕过该检查。
  await writeFile(specPath, spec);
  assert.equal(vima(['render-review']).code, 0);
  assert.equal(vima(['render-prototype']).code, 0);
  assert.equal(vima(['render-matrix']).code, 0);
  assert.equal(vima(['approve']).code, 0, '规格变动后须重新评审，否则批准时效失效');
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

// ⑪ A34 视觉轨道的**实质**链路。
// 黄金夹具全页 D0，走的是 d0Only 空真路径——DESIGNING 会被确定性跳过，
// 于是「方向包 → approve direction → 逐页稿 → approve pages → design check 真检 →
// DEVELOPING 收口 verify」这条 A34 的核心链路在端到端层零覆盖，只有单元测试。
// 本例用独立工程把它走一遍，并在两处闸门各验一次「真的会咬人」。
test('⑪A34 D1 实质链路：DESIGNING 双闸门 + DEVELOPING 收口硬门（含否定用例）', async () => {
  const dproj = path.join(sandbox, 'design-sys');
  assert.equal(vima(['create', 'design-sys', '--template', 'admin', '--no-git', '--no-install'], sandbox).code, 0);
  assert.equal(vima(['init'], dproj).code, 0);
  for (const dir of ['docs', 'apps', 'backend']) {
    await cp(path.join(GOLDEN, dir), path.join(dproj, dir), { recursive: true, force: true });
  }
  const d = (args) => vima(args, dproj);
  const readReport = async (rel) => JSON.parse(await readFile(path.join(dproj, rel), 'utf8'));

  // 把 PAGE-01 提到 D1（D1/D2 必填 primaryTask，V-DSN-11）
  const specPath = path.join(dproj, 'docs/spec.md');
  const spec = await readFile(specPath, 'utf8');
  await writeFile(specPath, spec
    .replace('  fidelity: D0                # A34 V-DSN-12', '  fidelity: D1                # A34 V-DSN-12')
    .replace('  fold: [设备表格]', '  fold: [设备表格]\n  primaryTask: 定位一台异常设备并完成处置'));
  for (const c of ['render-review', 'render-prototype', 'render-matrix']) assert.equal(d([c]).code, 0);
  assert.equal(d(['validate']).code, 0);
  assert.equal(d(['approve', '--planning']).code, 0, 'PLANNING → DESIGNING');

  // 闸门一（DESIGNING 出口）：缺方向包与逐页稿 → 必须红
  const blocked = d(['design', 'check']);
  assert.equal(blocked.code, 2, '缺稿却放行 = A34 白做');
  assert.match(blocked.out, /V-DSN-09/);
  const r1 = await readReport('.vima/reports/design-check.json');
  assert.equal(r1.gateApplies, true, 'DESIGNING 期才是闸门判定（C-A34-02）');
  assert.equal(r1.derived.designArtifactsComplete, false);
  assert.equal(r1.derived.directionApproved, false);

  // 冻结方向包（A0 三方向，固定六件交付物）与逐页稿（D1 = 正常态 + 空态）
  const shellDir = path.join(dproj, 'docs/review/design/_shell/admin');
  const pageDir = path.join(dproj, 'docs/review/design/PAGE-01');
  await mkdir(shellDir, { recursive: true });
  await mkdir(pageDir, { recursive: true });
  const shellFiles = ['brief.md', 'direction-a.png', 'direction-b.png', 'direction-c.png', 'comparison.md', 'selection.md'];
  for (const f of shellFiles) await writeFile(path.join(shellDir, f), `stub:${f}\n`);
  await writeFile(path.join(shellDir, 'manifest.json'),
    `${JSON.stringify({ schemaVersion: '1', appId: 'admin', files: shellFiles }, null, 2)}\n`);
  for (const f of ['default.png', 'empty.png']) await writeFile(path.join(pageDir, f), `stub:${f}\n`);
  await writeFile(path.join(pageDir, 'manifest.json'),
    `${JSON.stringify({ schemaVersion: '1', pageId: 'PAGE-01', fidelity: 'D1', files: ['default.png', 'empty.png'] }, null, 2)}\n`);

  assert.equal(d(['design', 'approve', 'direction', '--app', 'admin', '--agent-selected', '--reason', '测试夹具无 TTY（A45 D-A45-01）']).code, 0);
  assert.equal(d(['design', 'approve', 'pages']).code, 0);
  const passed = d(['design', 'check']);
  assert.equal(passed.code, 0, passed.out);
  const r2 = await readReport('.vima/reports/design-check.json');
  assert.ok(Object.values(r2.derived).every(Boolean), '六项派生必须全绿才能离开 DESIGNING');
  assert.equal(r2.d0Only, false, '存在 D1 页 ⇒ 不得走 d0Only 空真路径');

  assert.equal(d(['approve']).code, 0, 'DESIGNING → DEVELOPING');
  const lc = JSON.parse(await readFile(path.join(dproj, 'docs/lifecycle.json'), 'utf8'));
  assert.equal(lc.currentPhase, 'DEVELOPING');

  // 闸门二（DEVELOPING 收口）：--prepare 先给出报告作者要抄写的三个 digest
  assert.equal(d(['design', 'verify', '--prepare']).code, 0);
  const inputs = await readReport('.vima/reports/design-verify-inputs.json');
  const p1 = inputs.pages.find((p) => p.id === 'PAGE-01');
  assert.deepEqual(p1.required, ['design'], 'D1 = Semantic + Design');
  assert.ok(p1.implementationDigest, '本页任务有 @vima 标注 ⇒ 实现摘要必须算得出');

  // 否定用例①：报告缺失 → 收口硬门必须红（不能靠「没跑」蒙混）
  const noReport = d(['design', 'verify']);
  assert.equal(noReport.code, 2);
  assert.match(noReport.out, /未覆盖 PAGE-01\[D1\] design：报告缺失/);

  // 补齐报告 → 转绿
  await mkdir(path.join(dproj, '.vima/reports/design'), { recursive: true });
  const reportPath = path.join(dproj, '.vima/reports/design/PAGE-01.json');
  await writeFile(reportPath, `${JSON.stringify({
    pageId: 'PAGE-01',
    specDigest: p1.specDigest,
    designDigest: p1.designDigest,
    implementationDigest: p1.implementationDigest,
    mustPreserveResults: [],
    evidence: [{
      kind: 'screenshot', path: 'docs/review/design/PAGE-01/default.png',
      viewport: '1600x900', scenarioId: null, mustPreserveId: null,
    }],
    verdict: 'pass',
  }, null, 2)}\n`);
  assert.equal(d(['design', 'verify']).code, 0, '证据齐备后收口硬门放行');

  // 否定用例②：改了设计稿 → 旧报告判 stale（批准与验收都不是一次性的）
  await appendFile(path.join(pageDir, 'default.png'), 'changed\n');
  const stale = d(['design', 'verify']);
  assert.equal(stale.code, 2);
  assert.match(stale.out, /过期 PAGE-01 design：designDigest 已变/);
});
