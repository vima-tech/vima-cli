// C3 单测：vima certify —— 交付等级认证（A32，契约 §6.19）
// 覆盖：四级阶梯逐级判定 / 连续性（跳级不算）/ 双轴分离 / 显式非宣称 / 确定性 / 守卫。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, rm, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(HERE, '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');
const REPORT_REL = '.vima/reports/certify.json';

async function cloneGolden(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-certify-'));
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

function levelOf(report, name) {
  return report.levels.find((l) => l.level === name);
}

/** 置 lifecycle 的 tasksApproved（等级 1 的唯一判据）。 */
async function approve(root) {
  const p = path.join(root, 'docs', 'lifecycle.json');
  const lc = JSON.parse(await readFile(p, 'utf8'));
  lc.checklists.PLANNING.tasksApproved = true;
  lc.checklists.PLANNING.tasksApprovedAt = '2026-08-14T00:00:00Z';
  await writeFile(p, JSON.stringify(lc, null, 2));
}

/** 把全部任务置 done（layer 过滤由调用方通过 only 指定）。 */
async function markDone(root, ids) {
  for (const id of ids) {
    const p = path.join(root, 'docs', 'tasks', `${id}.md`);
    const s = await readFile(p, 'utf8');
    await writeFile(p, s.replace(/^status: .+$/m, 'status: done'));
  }
}

/** 写一份 Verifier 通过报告。 */
/**
 * 落一份 verifier 通过报告。
 * @param {string[]|Array<{cmd: string, exitCode: number}>} [commands] A43：命令留痕。
 *   传 undefined 时整体不写该字段（存量形态）；pipeline 任务须传。
 */
async function verifierPass(root, taskId, commands) {
  await mkdir(path.join(root, '.vima', 'reports'), { recursive: true });
  const rep = { taskId, round: 1, result: 'pass', checklist: [], points: [] };
  if (commands !== undefined) rep.commands = commands;
  await writeFile(
    path.join(root, '.vima', 'reports', `${taskId}-verifier.json`),
    JSON.stringify(rep),
  );
}

/** A43：pipeline 任务的标准绿报告（命令留痕齐全）。 */
const GREEN_COMMANDS = [
  { cmd: './mvnw -o -q test', exitCode: 0 },
  { cmd: 'npm run build:check', exitCode: 0 },
];

/**
 * 给黄金夹具的 Controller 补上 Spring 注解，使 4 个契约接口全部有实现
 * （与 c3.converge.test.mjs 同一手法）——否则任务标 done 时 converge 必报 V-INT-01。
 */
async function annotateController(root) {
  const p = path.join(root, 'backend/src/main/java/demo/DeviceController.java');
  let s = await readFile(p, 'utf8');
  s = s.replace('public class DeviceController {', '@RequestMapping("/api/device")\npublic class DeviceController {');
  s = s.replace('    public Object list(', '    @GetMapping("/list")\n    public Object list(');
  s = s.replace('    public Object create(', '    @PostMapping\n    public Object create(');
  s = s.replace('    public Object batchDelete(', '    @PostMapping("/batch-delete")\n    public Object batchDelete(');
  s = s.replace('    public Object detail(', '    @GetMapping("/detail")\n    public Object detail(');
  await writeFile(p, s);
}

/** 写一份**手工伪造**的集成对账报告（绿或红）——certify 重算后应识破。 */
async function convergence(root, { errors = 0, openPoints = 0 } = {}) {
  await mkdir(path.join(root, '.vima', 'reports'), { recursive: true });
  await writeFile(
    path.join(root, '.vima', 'reports', 'convergence.json'),
    JSON.stringify({ schemaVersion: '1', summary: { errors, openPoints }, findings: [] }),
  );
}

test('黄金夹具：未 approve → deliveryLevel=none，exit 0，缺口可执行', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'certify');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const report = await readReport(root);
  assert.equal(report.schemaVersion, '1');
  assert.equal(report.deliveryLevel, 'none');
  assert.equal(report.levels.length, 4);
  assert.equal(levelOf(report, 'spec-approved').satisfied, false);
  assert.match(levelOf(report, 'spec-approved').missing[0], /approve/);
});

test('等级 1 spec-approved：approve 后达成，证据含 tasksApprovedAt', async (t) => {
  const root = await cloneGolden(t);
  await approve(root);
  const r = vima(root, 'certify');
  assert.equal(r.code, 0);
  const report = await readReport(root);
  assert.equal(report.deliveryLevel, 'spec-approved');
  assert.match(levelOf(report, 'spec-approved').evidence[0], /tasksApproved=true/);
  assert.match(levelOf(report, 'spec-approved').evidence[0], /2026-08-14T00:00:00Z/);
  // 未完成的任务 → implemented 缺口如实列出
  assert.equal(levelOf(report, 'implemented').satisfied, false);
  assert.match(levelOf(report, 'implemented').missing.join(' '), /任务未 done/);
});

test('等级 2 implemented：任务全 done 但缺 Verifier 通过报告 → 不达成；补报告后达成', async (t) => {
  const root = await cloneGolden(t);
  await approve(root);
  await markDone(root, ['shared-base', 'device-api-be', 'device-list-fe']);

  vima(root, 'certify');
  let report = await readReport(root);
  assert.equal(report.deliveryLevel, 'spec-approved', '缺 Verifier 报告不得算 implemented');
  assert.match(levelOf(report, 'implemented').missing.join(' '), /Verifier 通过报告/);

  await verifierPass(root, 'device-api-be');
  await verifierPass(root, 'device-list-fe');
  vima(root, 'certify');
  report = await readReport(root);
  assert.equal(report.deliveryLevel, 'implemented');
});

test('等级 3/4：converged 需重算零 error 且缓存与重算一致；pipeline-green 需 done + 报告 + 命令留痕（A43）', async (t) => {
  const root = await cloneGolden(t);
  await approve(root);
  await annotateController(root);
  await markDone(root, ['shared-base', 'device-api-be', 'device-list-fe']);
  await verifierPass(root, 'device-api-be');
  await verifierPass(root, 'device-list-fe');

  // 手工伪造的绿报告蒙混不过去：certify 重算后与缓存不一致 → 不达成
  await convergence(root);
  vima(root, 'certify');
  let report = await readReport(root);
  assert.equal(report.deliveryLevel, 'implemented');
  assert.match(levelOf(report, 'converged').missing.join(' '), /已过期/);

  // 真跑 converge → converged；pipeline 未 done 时到此为止
  assert.equal(vima(root, 'converge').code, 0);
  vima(root, 'certify');
  report = await readReport(root);
  assert.equal(report.deliveryLevel, 'converged');
  assert.match(levelOf(report, 'converged').evidence[0], /sha256/);
  assert.match(levelOf(report, 'converged').evidence[0], /重算逐字节一致/);
  assert.match(levelOf(report, 'pipeline-green').missing.join(' '), /full-test/);

  // A43 D-A43-02：pipeline done 但没有 Verifier 报告 → 不达成（此前只看 frontmatter status）
  await markDone(root, ['full-test']);
  vima(root, 'certify');
  report = await readReport(root);
  assert.equal(report.deliveryLevel, 'converged', 'done 但无报告不得算 pipeline-green');
  assert.match(levelOf(report, 'pipeline-green').missing.join(' '), /缺 Verifier 通过报告.*full-test/);

  // 有报告但无命令留痕 → 仍不达成：pipeline 任务的职责就是跑命令
  await verifierPass(root, 'full-test');
  vima(root, 'certify');
  report = await readReport(root);
  assert.equal(report.deliveryLevel, 'converged', '无 commands 不得算 pipeline-green');
  assert.match(levelOf(report, 'pipeline-green').missing.join(' '), /缺命令留痕.*full-test/);

  // 命令留痕齐全但退出码非 0 → 不达成，且消息点名是哪条命令红的
  await verifierPass(root, 'full-test', [{ cmd: './mvnw -o -q test', exitCode: 1 }]);
  vima(root, 'certify');
  report = await readReport(root);
  assert.equal(report.deliveryLevel, 'converged', '退出码非 0 不得算 pipeline-green');
  assert.match(levelOf(report, 'pipeline-green').missing.join(' '), /退出码非 0.*mvnw.*exit 1/);

  // 三条齐全 → 最高级（pipeline 任务状态不进 convergence 报告，故不使其过期）
  await verifierPass(root, 'full-test', GREEN_COMMANDS);
  vima(root, 'certify');
  report = await readReport(root);
  assert.equal(report.deliveryLevel, 'pipeline-green');
  assert.match(levelOf(report, 'pipeline-green').evidence.join(' '), /留痕命令 2 条，退出码全部为 0/);
});

test('A43：commands 形状不合即整体不采信——不做部分采信', async (t) => {
  const root = await cloneGolden(t);
  await approve(root);
  await annotateController(root);
  await markDone(root, ['shared-base', 'device-api-be', 'device-list-fe', 'full-test']);
  await verifierPass(root, 'device-api-be');
  await verifierPass(root, 'device-list-fe');
  assert.equal(vima(root, 'converge').code, 0);

  // exitCode 是字符串而非整数 → 整条 commands 不合形，等同没留痕（宁缺勿假）
  await verifierPass(root, 'full-test', [{ cmd: './mvnw -o -q test', exitCode: '0' }]);
  vima(root, 'certify');
  let report = await readReport(root);
  assert.equal(levelOf(report, 'pipeline-green').satisfied, false);
  assert.match(levelOf(report, 'pipeline-green').missing.join(' '), /缺命令留痕/);

  // 空 cmd 同理：一条不合形则整条不采信，不能只采信合形的那几条
  await verifierPass(root, 'full-test', [{ cmd: 'npm test', exitCode: 0 }, { cmd: '   ', exitCode: 0 }]);
  vima(root, 'certify');
  report = await readReport(root);
  assert.equal(levelOf(report, 'pipeline-green').satisfied, false);

  await verifierPass(root, 'full-test', GREEN_COMMANDS);
  vima(root, 'certify');
  report = await readReport(root);
  assert.equal(levelOf(report, 'pipeline-green').satisfied, true);
});

test('converged 不采信过期报告：报告生成后任务状态又变 → 掉级并提示重跑 converge', async (t) => {
  const root = await cloneGolden(t);
  await approve(root);
  await annotateController(root);
  await markDone(root, ['device-api-be']);
  await verifierPass(root, 'device-api-be');
  assert.equal(vima(root, 'converge').code, 0);

  // 报告落盘后任务状态又变（device-list-fe 标 done → 报告的 unmarkedDone 会变），
  // 但没人重跑 converge：报告仍是绿的，却已不描述现状
  await markDone(root, ['device-list-fe']);
  vima(root, 'certify');
  const before = await readReport(root);
  assert.equal(levelOf(before, 'converged').satisfied, false, '过期报告不得算 converged');
  assert.match(levelOf(before, 'converged').missing.join(' '), /已过期.*重跑 vima converge/s);

  // 重跑 converge → 重新达成
  assert.equal(vima(root, 'converge').code, 0);
  vima(root, 'certify');
  const after = await readReport(root);
  assert.equal(levelOf(after, 'converged').satisfied, true);
});

test('连续性：跳级不算——低级不满足时高级即便证据齐全也不提升 deliveryLevel', async (t) => {
  const root = await cloneGolden(t);
  // 不 approve（等级 1 不满足），但把 converge 与 pipeline 证据都造齐
  await annotateController(root);
  assert.equal(vima(root, 'converge').code, 0);
  await markDone(root, ['full-test']);
  await verifierPass(root, 'full-test', GREEN_COMMANDS); // A43：pipeline-green 现需报告 + 命令留痕
  vima(root, 'certify');
  const report = await readReport(root);
  assert.equal(report.deliveryLevel, 'none', '等级 1 未过 → 不得跳级');
  assert.equal(levelOf(report, 'converged').satisfied, true, '单级判定仍如实为 true');
  assert.equal(levelOf(report, 'pipeline-green').satisfied, true);
});

test('双轴分离 + 显式非宣称 + 确定性（无时间戳）', async (t) => {
  const root = await cloneGolden(t);
  await approve(root);
  const r = vima(root, 'certify');
  assert.match(r.stdout, /模板 stable ≠ 项目 stable/, 'stdout 须澄清双轴语义');
  assert.match(r.stdout, /不采集、也不认证/, 'stdout 须有显式非宣称行');

  const report = await readReport(root);
  assert.equal(report.templateMaturity, 'stable', '模板成熟度取自 A5 template.json status');
  assert.match(report.notCertified, /deployable\/stable/);
  assert.ok(!report.levels.some((l) => l.level === 'deployable' || l.level === 'stable'), '不得引入未采集的等级');

  const first = await readFile(path.join(root, REPORT_REL), 'utf8');
  vima(root, 'certify');
  assert.equal(await readFile(path.join(root, REPORT_REL), 'utf8'), first, '同输入同字节');

  // --json 输出即报告本体
  const j = vima(root, 'certify', '--json');
  assert.equal(j.code, 0);
  assert.equal(j.stdout, first);
});

test('守卫：非 vima 项目 → NOT_IN_PROJECT，不写任何文件', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-c3-certify-novima-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const r = vima(dir, 'certify');
  assert.equal(r.code, 4);
  assert.match(r.stderr, /NOT_IN_PROJECT/);
  let created = true;
  try {
    await access(path.join(dir, '.vima'));
  } catch {
    created = false;
  }
  assert.equal(created, false);
});

// ── A34 D-A34-31：implemented 级消费视觉与体验证据 ──
// 不接线的话，certify 会把「视觉一次没跑」的项目评为 pipeline-green——
// 正是 A34 要治的「全绿但不能用」假成功，只是换到了认证报告里。

test('A34：D1/D2 页缺视觉报告 → implemented 级不通过并列出缺口', async (t) => {
  const root = await cloneGolden(t);
  await approve(root);
  await markDone(root, ['device-api-be', 'device-list-fe', 'shared-base', 'full-test']);
  for (const id of ['device-api-be', 'device-list-fe']) await verifierPass(root, id);
  // 把 PAGE-01 提到 D1（需要 design 报告），但不产出任何视觉报告
  const p = path.join(root, 'docs/spec.md');
  const text = await readFile(p, 'utf8');
  await writeFile(p, text
    .replace('  fidelity: D0                # A34 V-DSN-12', '  fidelity: D1                # A34 V-DSN-12')
    .replace('  fold: [设备表格]', '  fold: [设备表格]\n  primaryTask: 定位一台异常设备并完成处置'));

  const r = vima(root, 'certify');
  assert.equal(r.code, 0, '评估不是闸门，exit 恒 0');
  const report = await readReport(root);
  const impl = levelOf(report, 'implemented');
  assert.equal(impl.satisfied, false, '视觉证据缺失时 implemented 不得通过');
  assert.ok(
    impl.missing.some((m) => /视觉与体验验收未齐全/.test(m)),
    `应列出视觉缺口：${JSON.stringify(impl.missing)}`,
  );
});

test('A34：全页 D0 的项目 → 视觉验收不适用，如实标注而非冒充已验收', async (t) => {
  const root = await cloneGolden(t);
  await approve(root);
  await markDone(root, ['device-api-be', 'device-list-fe', 'shared-base', 'full-test']);
  for (const id of ['device-api-be', 'device-list-fe']) await verifierPass(root, id);
  const r = vima(root, 'certify');
  assert.equal(r.code, 0);
  const impl = levelOf(await readReport(root), 'implemented');
  assert.equal(impl.satisfied, true, '纯 D0 项目不为视觉验收付成本');
  assert.ok(
    impl.evidence.some((e) => /不适用/.test(e)),
    `须如实标注不适用而不是宣称已验收：${JSON.stringify(impl.evidence)}`,
  );
});

test('A34：certify 不得信任陈旧或伪造的 design-verify.json', async (t) => {
  const root = await cloneGolden(t);
  await approve(root);
  await markDone(root, ['device-api-be', 'device-list-fe', 'shared-base', 'full-test']);
  for (const id of ['device-api-be', 'device-list-fe']) await verifierPass(root, id);
  const p = path.join(root, 'docs/spec.md');
  await writeFile(p, (await readFile(p, 'utf8'))
    .replace('  fidelity: D0                # A34 V-DSN-12', '  fidelity: D1                # A34 V-DSN-12')
    .replace('  fold: [设备表格]', '  fold: [设备表格]\n  primaryTask: 定位一台异常设备并完成处置'));
  await mkdir(path.join(root, '.vima/reports'), { recursive: true });
  await writeFile(path.join(root, '.vima/reports/design-verify.json'), `${JSON.stringify({
    schemaVersion: '1', pages: [{ id: 'PAGE-01', required: ['design'] }], uncovered: [], stale: [], pass: true,
  }, null, 2)}\n`);
  const r = vima(root, 'certify');
  assert.equal(r.code, 0);
  assert.equal(levelOf(await readReport(root), 'implemented').satisfied, false);
});
