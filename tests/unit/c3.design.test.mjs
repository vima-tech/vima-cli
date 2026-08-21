// C3 单测：vima design —— A34 视觉真源的确定性侧
// 覆盖：status 只读派生索引与漂移、check 的 DESIGNING 出口闸门（V-DSN-09）、
// verify 的报告矩阵与 stale 判定、approve/invalidate 的摘要驱动失效、reconcile 的 DESIGNING 口径。
// 每条规则都带**否定用例**——只验「绿」的规则等于没有规则。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(HERE, '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');

async function cloneGolden(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-design-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(GOLDEN, root, { recursive: true });
  return root;
}

function vima(cwd, ...args) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

const readJson = async (root, rel) => JSON.parse(await readFile(path.join(root, rel), 'utf8'));

async function setPhase(root, phase) {
  const rel = 'docs/lifecycle.json';
  const lifecycle = await readJson(root, rel);
  lifecycle.currentPhase = phase;
  await writeFile(path.join(root, rel), `${JSON.stringify(lifecycle, null, 2)}\n`);
}

/** 把 PAGE-01 提到指定保真级，并补齐该级必需的 spec 声明。 */
async function gradePage01(root, fidelity) {
  const p = path.join(root, 'docs/spec.md');
  let text = await readFile(p, 'utf8');
  text = text.replace('  fidelity: D0                # A34 V-DSN-12', `  fidelity: ${fidelity}                # A34 V-DSN-12`);
  if (fidelity === 'D1' || fidelity === 'D2') {
    let extra = '\n  primaryTask: 定位一台异常设备并完成处置';
    if (fidelity === 'D2') {
      extra += '\n  mustPreserve:'
        + '\n    - { id: status-live, kind: runtime, statement: 切换设备时壳层不重挂载, verifier: experience }'
        + '\n    - { id: trend-chart, kind: visual, statement: 趋势以图表呈现而非表格, verifier: design }';
    }
    text = text.replace('  fold: [设备表格]', `  fold: [设备表格]${extra}`);
  }
  await writeFile(p, text);
}

/** 冻结一页的设计产物（manifest + 声明的文件）。 */
async function freezeDesign(root, pageId, files) {
  const dir = path.join(root, 'docs/review/design', pageId);
  await mkdir(dir, { recursive: true });
  for (const f of files) await writeFile(path.join(dir, f), `stub:${pageId}:${f}\n`);
  await writeFile(
    path.join(dir, 'manifest.json'),
    `${JSON.stringify({ schemaVersion: '1', pageId, files }, null, 2)}\n`,
  );
}

async function freezeDirection(root, appId = 'admin') {
  const dir = path.join(root, 'docs/review/design/_shell', appId);
  await mkdir(dir, { recursive: true });
  const files = [
    'brief.md', 'direction-a.png', 'direction-b.png', 'direction-c.png', 'comparison.md', 'selection.md',
  ];
  for (const f of files) await writeFile(path.join(dir, f), `stub:${appId}:${f}\n`);
  await writeFile(
    path.join(dir, 'manifest.json'),
    `${JSON.stringify({ schemaVersion: '1', appId, files }, null, 2)}\n`,
  );
}

async function installAdminStageA(root) {
  await mkdir(path.join(root, 'src/styles'), { recursive: true });
  await writeFile(path.join(root, 'src/styles/layout.css'), '.layout{}\n');
  await writeFile(path.join(root, 'src/styles/tokens.css'), ':root{--space:8px}\n');
  await writeFile(path.join(root, 'docs/design-language.md'), '# Design language\n');
  await writeFile(path.join(root, 'docs/interaction-language.md'), '# Interaction language\n');
  await cp(path.join(root, 'apps/admin/src/api'), path.join(root, 'src/api'), { recursive: true });
}

// ── status：只读派生索引 ──────────────────────────────────────────────────

test('design status：生成 INDEX.json，且**不含批准状态**（批准唯一住在 lifecycle）', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'design', 'status');
  assert.equal(r.code, 0, r.stderr);
  const idx = await readJson(root, 'docs/review/design/INDEX.json');
  assert.equal(idx.summary.D0, 2);
  assert.equal(idx.pages.length, 2);
  const dumped = JSON.stringify(idx);
  assert.ok(!dumped.includes('"approved"'), 'INDEX 不得表达批准状态——否则与 lifecycle 双真源');
  assert.equal(idx.pages[0].dir, 'docs/review/design/PAGE-01', '路径由 pageId 推导');
});

test('design status --check 否定用例：手改 INDEX → 判漂移 exit 4（只读派生物不许手工维护）', async (t) => {
  const root = await cloneGolden(t);
  assert.equal(vima(root, 'design', 'status').code, 0);
  const rel = 'docs/review/design/INDEX.json';
  const idx = await readJson(root, rel);
  idx.summary.D0 = 99; // 手改 = 试图把派生物变成第二真源
  await writeFile(path.join(root, rel), `${JSON.stringify(idx, null, 2)}\n`);
  const r = vima(root, 'design', 'status', '--check');
  assert.equal(r.code, 4, r.stdout);
  assert.match(r.stderr, /DESIGN_INDEX_DRIFT/);
});

// ── check：DESIGNING 出口闸门 ─────────────────────────────────────────────

test('design approve/verify 阶段守卫：不得在 PLANNING 提前写批准或验收汇总', async (t) => {
  const root = await cloneGolden(t);
  const approve = vima(root, 'design', 'approve', 'direction', '--app', 'admin', '--agent-selected', '--reason', '测试夹具无 TTY（A45 D-A45-01）');
  assert.equal(approve.code, 4);
  assert.match(approve.stderr, /PHASE_TRANSITION/);
  const verify = vima(root, 'design', 'verify');
  assert.equal(verify.code, 4);
  assert.match(verify.stderr, /PHASE_TRANSITION/);
});

test('design check：全页 D0 → 确定性跳过发散轮（directionApproved 空真，不卡纯 CRUD 项目）', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'design', 'check');
  assert.equal(r.code, 0, `${r.stdout}\n${r.stderr}`);
  const rep = await readJson(root, '.vima/reports/design-check.json');
  assert.equal(rep.d0Only, true);
  assert.equal(rep.derived.directionApproved, true, 'D0-only 无标志性页面可发散，方向批准应空真');
  assert.match(rep.note, /跳过 DESIGNING 发散轮/);
});

test('design check：legacy 单端局部 scope 的无 app 页面归属唯一默认端，不形成方向死门', async (t) => {
  const root = await cloneGolden(t);
  const lifecyclePath = path.join(root, 'docs/lifecycle.json');
  const lifecycle = await readJson(root, 'docs/lifecycle.json');
  lifecycle.currentPhase = 'DESIGNING';
  lifecycle.designCapability = 'legacy';
  lifecycle.designScope = { pages: ['PAGE-01'] };
  await writeFile(lifecyclePath, `${JSON.stringify(lifecycle, null, 2)}\n`);
  await installAdminStageA(root);
  await gradePage01(root, 'D1');
  await freezeDirection(root, 'admin');
  await freezeDesign(root, 'PAGE-01', ['default.png', 'empty.png']);
  assert.equal(vima(root, 'design', 'approve', 'direction', '--app', 'admin', '--agent-selected', '--reason', '测试夹具无 TTY（A45 D-A45-01）').code, 0);
  assert.equal(vima(root, 'design', 'approve', 'pages', '--page', 'PAGE-01').code, 0);
  const result = vima(root, 'design', 'check');
  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
  const report = await readJson(root, '.vima/reports/design-check.json');
  assert.equal(report.derived.directionApproved, true);
});

test('design check：mp-native / h5-mobile 使用各自 vendored Stage A 路径，不误要 admin src/styles', async (t) => {
  for (const [id, kind, scaffold] of [
    ['patient', 'mp-native', 'mp-native'],
    ['ph5', 'h5-mobile', 'h5-mobile'],
  ]) {
    const root = await cloneGolden(t);
    await mkdir(path.join(root, '.vima'), { recursive: true });
    await cp(path.join(CLI_ROOT, 'templates/admin/scaffold', scaffold), path.join(root, 'apps', id), { recursive: true });
    await writeFile(path.join(root, '.vima/manifest.json'), `${JSON.stringify({
      schemaVersion: '2', templateId: 'admin', apps: [{ id, name: id, kind, dir: `apps/${id}`, codeDir: 'src', sharedDirs: [] }],
      backend: null,
    }, null, 2)}\n`);
    await writeFile(path.join(root, 'docs/design-language.md'), '# Design language\n');
    const result = vima(root, 'design', 'check');
    assert.equal(result.code, 0, `${kind}: ${result.stdout}\n${result.stderr}`);
    assert.doesNotMatch(result.stdout, /src\/styles\/(?:layout|tokens)\.css/);
  }
});

test('design check 否定用例：D1 页缺设计目录 → V-DSN-09 报缺且 exit 2', async (t) => {
  const root = await cloneGolden(t);
  await gradePage01(root, 'D1');
  const r = vima(root, 'design', 'check');
  assert.equal(r.code, 2, r.stdout);
  const rep = await readJson(root, '.vima/reports/design-check.json');
  assert.equal(rep.derived.designArtifactsComplete, false);
  const hit = rep.findings.find((f) => f.rule === 'V-DSN-09' && f.page === 'PAGE-01');
  assert.ok(hit, `应报 V-DSN-09：${JSON.stringify(rep.findings)}`);
  assert.match(hit.message, /缺设计清单 manifest\.json/);
});

test('design check 否定用例：manifest 声明了文件但文件不存在 → 承诺过的载体必须真的在', async (t) => {
  const root = await cloneGolden(t);
  await gradePage01(root, 'D1');
  const dir = path.join(root, 'docs/review/design/PAGE-01');
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'manifest.json'),
    `${JSON.stringify({ schemaVersion: '1', pageId: 'PAGE-01', files: ['default.png', 'empty.png'] }, null, 2)}\n`,
  );
  // 故意不建 png
  const r = vima(root, 'design', 'check');
  assert.equal(r.code, 2);
  const rep = await readJson(root, '.vima/reports/design-check.json');
  const msgs = rep.findings.map((f) => f.message).join(' | ');
  assert.match(msgs, /但文件不存在/);
});

test('design check：D1 产物齐备 + 页面已批准 → 该两项转绿', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DESIGNING');
  await gradePage01(root, 'D1');
  await freezeDesign(root, 'PAGE-01', ['default.png', 'empty.png']);
  assert.equal(vima(root, 'design', 'approve', 'pages').code, 0);
  vima(root, 'design', 'check');
  const rep = await readJson(root, '.vima/reports/design-check.json');
  assert.equal(rep.derived.designArtifactsComplete, true);
  assert.equal(rep.derived.signaturePagesApproved, true);
  assert.equal(rep.derived.designApprovalFresh, true);
});

test('方向批准否定用例：方向目录或固定交付物缺失时不得写 digest:null 假批准', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DESIGNING');
  await gradePage01(root, 'D1');
  const r = vima(root, 'design', 'approve', 'direction', '--app', 'admin', '--agent-selected', '--reason', '测试夹具无 TTY（A45 D-A45-01）');
  assert.equal(r.code, 4);
  assert.match(r.stderr, /DIRECTION_ARTIFACTS/);
  const lc = await readJson(root, 'docs/lifecycle.json');
  assert.equal(lc.designApproval.directions.admin, undefined);
});

test('方向摘要：批准后修改方向产物 → designApprovalFresh 自动失效', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DESIGNING');
  await gradePage01(root, 'D1');
  await freezeDirection(root);
  await freezeDesign(root, 'PAGE-01', ['default.png', 'empty.png']);
  assert.equal(vima(root, 'design', 'approve', 'direction', '--app', 'admin', '--agent-selected', '--reason', '测试夹具无 TTY（A45 D-A45-01）').code, 0);
  assert.equal(vima(root, 'design', 'approve', 'pages').code, 0);
  await writeFile(path.join(root, 'docs/review/design/_shell/admin/direction-a.png'), 'changed\n');
  vima(root, 'design', 'check');
  const rep = await readJson(root, '.vima/reports/design-check.json');
  assert.equal(rep.derived.designApprovalFresh, false);
  assert.ok(rep.stale.some((x) => x.app === 'admin'));
});

test('页面摘要：Stage A 或 interaction-language 改动 → 页面批准自动失效', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DESIGNING');
  await installAdminStageA(root);
  await gradePage01(root, 'D1');
  await freezeDirection(root);
  await freezeDesign(root, 'PAGE-01', ['default.png', 'empty.png']);
  assert.equal(vima(root, 'design', 'approve', 'direction', '--app', 'admin', '--agent-selected', '--reason', '测试夹具无 TTY（A45 D-A45-01）').code, 0);
  assert.equal(vima(root, 'design', 'approve', 'pages').code, 0);
  await writeFile(path.join(root, 'docs/interaction-language.md'), '# changed\n');
  vima(root, 'design', 'check');
  const rep = await readJson(root, '.vima/reports/design-check.json');
  assert.equal(rep.derived.designApprovalFresh, false);
});

test('批准后的 D2 不得静默降为 D0；显式豁免且带理由后才放行', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DESIGNING');
  await gradePage01(root, 'D2');
  await freezeDesign(root, 'PAGE-01', ['default.png', 'empty.png', 'prototype.html', 'scenarios.md']);
  assert.equal(vima(root, 'design', 'approve', 'pages', '--page', 'PAGE-01').code, 0);
  const p = path.join(root, 'docs/spec.md');
  let text = await readFile(p, 'utf8');
  text = text.replace('  fidelity: D2', '  fidelity: D0')
    .replace(/\n  primaryTask: 定位一台异常设备并完成处置\n  mustPreserve:[\s\S]*?(?=\n\S|\n  [a-zA-Z]|$)/, '');
  await writeFile(p, text);
  assert.equal(vima(root, 'design', 'check').code, 2, '未留理由的批准后降级必须阻断');
  const noReason = vima(root, 'design', 'approve', 'pages', '--page', 'PAGE-01', '--allow-downgrade');
  assert.equal(noReason.code, 3, '豁免必须带理由');
  const waived = vima(root, 'design', 'approve', 'pages', '--page', 'PAGE-01', '--allow-downgrade', '--reason', '用户确认改为标准 CRUD');
  assert.equal(waived.code, 0, waived.stderr);
  assert.equal(vima(root, 'design', 'check').code, 0);
});

// ── 批准的摘要驱动失效（D-A34-12：陈旧布尔是病根） ────────────────────────

test('批准摘要：改了设计稿 → 批准自动失效（不是靠人记得去撤销）', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DESIGNING');
  await gradePage01(root, 'D1');
  await freezeDesign(root, 'PAGE-01', ['default.png', 'empty.png']);
  vima(root, 'design', 'approve', 'pages');
  await writeFile(path.join(root, 'docs/review/design/PAGE-01/default.png'), 'CHANGED\n');
  vima(root, 'design', 'check');
  const rep = await readJson(root, '.vima/reports/design-check.json');
  assert.equal(rep.derived.designApprovalFresh, false, '设计目录内容变了，旧批准必须失效');
  assert.match(rep.stale[0].reason, /设计目录内容已变/);
});

test('批准摘要：改了 spec 本页数据块 → 批准同样失效', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DESIGNING');
  await gradePage01(root, 'D1');
  await freezeDesign(root, 'PAGE-01', ['default.png', 'empty.png']);
  vima(root, 'design', 'approve', 'pages');
  const p = path.join(root, 'docs/spec.md');
  const text = await readFile(p, 'utf8');
  await writeFile(p, text.replace('primaryTask: 定位一台异常设备并完成处置', 'primaryTask: 改过的主任务'));
  vima(root, 'design', 'check');
  const rep = await readJson(root, '.vima/reports/design-check.json');
  assert.equal(rep.derived.designApprovalFresh, false);
  assert.match(rep.stale[0].reason, /spec 数据块/);
});

test('design invalidate：显式作废并留理由（不许悄悄清空）', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DESIGNING');
  await gradePage01(root, 'D1');
  await freezeDesign(root, 'PAGE-01', ['default.png', 'empty.png']);
  vima(root, 'design', 'approve', 'pages');
  const r = vima(root, 'design', 'invalidate', '--reason', '版面语言重定档');
  assert.equal(r.code, 0, r.stderr);
  const lc = await readJson(root, 'docs/lifecycle.json');
  assert.deepEqual(lc.designApproval.pages, {});
  assert.equal(lc.designApprovalInvalidatedReason, '版面语言重定档');
  assert.ok(lc.designApprovalInvalidatedAt, '作废须留时间戳');
});

// ── verify：报告矩阵与 stale ──────────────────────────────────────────────

test('design verify：D0 页无需任何视觉报告（不为纯 CRUD 页付成本）', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DEVELOPING');
  const r = vima(root, 'design', 'verify');
  assert.equal(r.code, 0, r.stderr);
  const rep = await readJson(root, '.vima/reports/design-verify.json');
  assert.equal(rep.pass, true);
  assert.deepEqual(rep.pages.find((p) => p.id === 'PAGE-01').required, []);
});

test('design verify --prepare：报告尚缺仍生成三个 digest 输入，且不伪造最终汇总', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DEVELOPING');
  await installAdminStageA(root);
  await gradePage01(root, 'D1');
  await freezeDesign(root, 'PAGE-01', ['default.png', 'empty.png']);
  const r = vima(root, 'design', 'verify', '--prepare');
  assert.equal(r.code, 0, `${r.stdout}\n${r.stderr}`);
  const inputs = await readJson(root, '.vima/reports/design-verify-inputs.json');
  const page = inputs.pages.find((p) => p.id === 'PAGE-01');
  assert.match(page.specDigest, /^[a-f0-9]{64}$/);
  assert.match(page.designDigest, /^[a-f0-9]{64}$/);
  assert.match(page.implementationDigest, /^[a-f0-9]{64}$/);
  await assert.rejects(readFile(path.join(root, '.vima/reports/design-verify.json')), /ENOENT/,
    'prepare 不得写一个缺报告却可能被误消费的最终汇总');
});

test('design verify 否定用例：D2 页缺 design/experience 报告 → uncovered 两项', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DEVELOPING');
  await gradePage01(root, 'D2');
  await freezeDesign(root, 'PAGE-01', ['default.png', 'empty.png', 'prototype.html', 'scenarios.md']);
  const r = vima(root, 'design', 'verify');
  assert.equal(r.code, 2, r.stdout);
  const rep = await readJson(root, '.vima/reports/design-verify.json');
  const kinds = rep.uncovered.filter((u) => u.page === 'PAGE-01').map((u) => u.kind).sort();
  assert.deepEqual([...new Set(kinds)], ['design', 'experience', 'implementation'], 'D2 必须同时有设计、体验与真实实现入口');
});

test('design verify 否定用例：报告 verdict=pass 但 digest 漂移 → 判 stale（改了就得重跑）', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DEVELOPING');
  await gradePage01(root, 'D1');
  await freezeDesign(root, 'PAGE-01', ['default.png', 'empty.png']);
  await mkdir(path.join(root, '.vima/reports/design'), { recursive: true });
  await writeFile(
    path.join(root, '.vima/reports/design/PAGE-01.json'),
    `${JSON.stringify({
      pageId: 'PAGE-01',
      specDigest: 'stale-digest',
      designDigest: 'stale-digest',
      implementationDigest: null,
      mustPreserveResults: [],
      evidence: [],
      verdict: 'pass',
    }, null, 2)}\n`,
  );
  const r = vima(root, 'design', 'verify');
  assert.equal(r.code, 2);
  const rep = await readJson(root, '.vima/reports/design-verify.json');
  const s = rep.stale.find((x) => x.page === 'PAGE-01');
  assert.ok(s, '摘要对不上必须判 stale');
  assert.ok(s.drift.includes('specDigest') && s.drift.includes('designDigest'));
});

test('design verify：落 implementation-deps；动态 import 保守纳入本端全部 features 与 Stage A', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DEVELOPING');
  await installAdminStageA(root);
  await gradePage01(root, 'D1');
  await freezeDesign(root, 'PAGE-01', ['default.png', 'empty.png']);
  await mkdir(path.join(root, 'src/features/device/components'), { recursive: true });
  await writeFile(path.join(root, 'src/features/device/components/Panel.js'), 'export const panel = true;\n');
  const entry = path.join(root, 'src/api/device.ts');
  await writeFile(entry, `${await readFile(entry, 'utf8')}\nconst part = 'Panel';\nimport(\`../features/device/components/\${part}.js\`);\n`);

  vima(root, 'design', 'verify');
  const deps = await readJson(root, '.vima/reports/implementation-deps/PAGE-01.json');
  assert.equal(deps.fallback, true);
  const files = deps.entries.map((e) => e.file);
  assert.ok(files.includes('src/features/device/components/Panel.js'));
  assert.ok(files.includes('src/styles/layout.css'));
  assert.ok(files.includes('src/styles/tokens.css'));
});

test('design verify 否定用例：mustPreserve 漏对账一条 → uncovered（按 id 逐条，不按顺序）', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DEVELOPING');
  await gradePage01(root, 'D2');
  await freezeDesign(root, 'PAGE-01', ['default.png', 'empty.png', 'prototype.html', 'scenarios.md']);
  // 先拿到当前真实摘要，避免被 stale 掩盖了 uncovered 的断言
  vima(root, 'design', 'verify');
  const first = await readJson(root, '.vima/reports/design-verify.json');
  const me = first.pages.find((p) => p.id === 'PAGE-01');
  const base = {
    pageId: 'PAGE-01',
    specDigest: me.specDigest,
    designDigest: me.designDigest,
    implementationDigest: me.implementationDigest,
    evidence: [],
    verdict: 'pass',
  };
  await mkdir(path.join(root, '.vima/reports/design'), { recursive: true });
  await mkdir(path.join(root, '.vima/reports/experience'), { recursive: true });
  // design 侧对账了 trend-chart（kind: visual）
  await writeFile(
    path.join(root, '.vima/reports/design/PAGE-01.json'),
    `${JSON.stringify({ ...base, mustPreserveResults: [{ id: 'trend-chart', verdict: 'pass' }] }, null, 2)}\n`,
  );
  // experience 侧**故意漏掉** status-live（kind: runtime）
  await writeFile(
    path.join(root, '.vima/reports/experience/PAGE-01.json'),
    `${JSON.stringify({ ...base, mustPreserveResults: [], primaryTaskResult: { completed: true } }, null, 2)}\n`,
  );
  const r = vima(root, 'design', 'verify');
  assert.equal(r.code, 2, r.stdout);
  const rep = await readJson(root, '.vima/reports/design-verify.json');
  const miss = rep.uncovered.find((u) => /status-live/.test(u.reason));
  assert.ok(miss, `应报漏对账：${JSON.stringify(rep.uncovered)}`);
  assert.equal(miss.kind, 'experience', 'runtime 类归 experience 执行');
});

test('design verify 否定用例：顶层伪造 pass 不能掩盖 primaryTask 与 mustPreserve 的失败', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DEVELOPING');
  await installAdminStageA(root);
  await gradePage01(root, 'D2');
  await freezeDesign(root, 'PAGE-01', ['default.png', 'empty.png', 'prototype.html', 'scenarios.md']);
  vima(root, 'design', 'verify');
  const first = await readJson(root, '.vima/reports/design-verify.json');
  const me = first.pages.find((p) => p.id === 'PAGE-01');
  const base = {
    pageId: 'PAGE-01', specDigest: me.specDigest, designDigest: me.designDigest,
    implementationDigest: me.implementationDigest,
    evidence: [{ kind: 'screenshot', path: '.vima/shots/PAGE-01.png', viewport: '1600x900' }],
    verdict: 'pass',
  };
  await mkdir(path.join(root, '.vima/reports/design'), { recursive: true });
  await mkdir(path.join(root, '.vima/reports/experience'), { recursive: true });
  await writeFile(path.join(root, '.vima/reports/design/PAGE-01.json'), `${JSON.stringify({
    ...base, mustPreserveResults: [{ id: 'trend-chart', verdict: 'fail', evidence: '降级成表格' }],
  }, null, 2)}\n`);
  await writeFile(path.join(root, '.vima/reports/experience/PAGE-01.json'), `${JSON.stringify({
    ...base, primaryTaskResult: { statement: 'x', completed: false, steps: 2, interruptions: ['刷新'] },
    mustPreserveResults: [{ id: 'status-live', verdict: 'fail', evidence: '整页重载' }],
  }, null, 2)}\n`);
  const r = vima(root, 'design', 'verify');
  assert.equal(r.code, 2);
  const rep = await readJson(root, '.vima/reports/design-verify.json');
  assert.ok(rep.uncovered.some((x) => /primaryTask/.test(x.reason)));
  assert.ok(rep.uncovered.some((x) => /verdict=fail/.test(x.reason)));
});

// ── reconcile：DESIGNING 口径的回写闸门 ──────────────────────────────────

test('design reconcile 否定用例：方向未批准 → 拒绝回写 exit 4', async (t) => {
  const root = await cloneGolden(t);
  assert.equal(vima(root, 'approve', '--planning').code, 0);
  const r = vima(root, 'design', 'reconcile');
  assert.equal(r.code, 4, r.stdout);
  assert.match(r.stderr, /尚未批准设计方向/);
});

test('design reconcile 否定用例：spec 引用不闭环时不得声称收口', async (t) => {
  const root = await cloneGolden(t);
  assert.equal(vima(root, 'approve', '--planning').code, 0);
  await freezeDirection(root);
  assert.equal(vima(root, 'design', 'approve', 'direction', '--app', 'admin', '--agent-selected', '--reason', '测试夹具无 TTY（A45 D-A45-01）').code, 0);
  const p = path.join(root, 'docs/spec.md');
  await writeFile(p, (await readFile(p, 'utf8')).replace('target: PAGE-02', 'target: PAGE-99'));
  const r = vima(root, 'design', 'reconcile');
  assert.equal(r.code, 4);
  assert.match(r.stderr, /V-SPEC-05/);
});

// ── 分级建议（D-A34-03）：机器给可复核起点，裁定权始终在人 ──

test('design status：分级建议与声明不一致时列出来，但**不改任何东西**', async (t) => {
  const root = await cloneGolden(t);
  // PAGE-01 有 shape: metrics 之类会推到 D1 吗？夹具是 list ⇒ 建议 D0，与声明一致
  vima(root, 'design', 'status');
  const idx = await readJson(root, 'docs/review/design/INDEX.json');
  assert.deepEqual(idx.suggestions, [], '一致时不该有噪声');
  // 把 PAGE-01 提成 custom（判据 ⇒ 建议 D2），但声明仍是 D0 —— 应报分歧
  await gradePage01(root, 'D0');
  const p = path.join(root, 'docs/spec.md');
  const text = await readFile(p, 'utf8');
  await writeFile(p, text.replace('pattern: list', 'pattern: custom'));
  vima(root, 'design', 'status');
  const idx2 = await readJson(root, 'docs/review/design/INDEX.json');
  const sg = idx2.suggestions.find((x) => x.id === 'PAGE-01');
  assert.ok(sg, '声明 D0 而判据指向 D2，须列出分歧');
  assert.equal(sg.suggested, 'D2');
  assert.equal(sg.declared, 'D0', '机器只建议，绝不改写声明');
});

// ── 分级建议必须进闸门（契约 §6.20）：只打在 status 的 stdout 上等于闸门看不见 ──

/** 让 PAGE-01 的判据指向 D1（表格块给 shape: chart），声明级不动。 */
async function makeSuggestD1(root) {
  const p = path.join(root, 'docs/spec.md');
  const text = await readFile(p, 'utf8');
  await writeFile(p, text.replace(
    '  - block: table\n    name: 设备表格',
    '  - block: table\n    name: 设备表格\n    data: { shape: chart, of: Device }',
  ));
}

test('design check：声明 D0 而判据建议 D1 → 闸门报告如实列出，且**恒不阻断**', async (t) => {
  const root = await cloneGolden(t);
  await makeSuggestD1(root);
  const r = vima(root, 'design', 'check');
  assert.equal(r.code, 0, 'D-A34-03：首次裁定人可选任意级别，升为 error 会违反该决策');
  const rep = await readJson(root, '.vima/reports/design-check.json');
  assert.deepEqual(
    rep.fidelitySuggestions,
    [{ id: 'PAGE-01', declared: 'D0', suggested: 'D1' }],
    '「全项目声明 D0 → 跳过 DESIGNING」必须在闸门端可见，否则是 G2 换了个壳',
  );
  assert.equal(rep.counts.fidelitySuggestions, 1);
  assert.equal(rep.pass, true, '不阻断');
  assert.match(r.stdout, /声明 D0，按判据建议 D1/);
});

test('design check 否定用例：声明与判据一致时 fidelitySuggestions 为空（不制造永久噪声）', async (t) => {
  const root = await cloneGolden(t);
  const r = vima(root, 'design', 'check');
  assert.equal(r.code, 0, r.stderr);
  const rep = await readJson(root, '.vima/reports/design-check.json');
  assert.deepEqual(rep.fidelitySuggestions, [], '恒响的警告会训练用户忽略整张清单');
  assert.equal(rep.counts.fidelitySuggestions, 0);
  assert.doesNotMatch(r.stdout, /按判据建议/);
});

test('design check：非 DESIGNING 阶段跑 → gateApplies=false 并显式标注为预览', async (t) => {
  const root = await cloneGolden(t);
  const preview = vima(root, 'design', 'check');
  assert.equal(preview.code, 0, preview.stderr);
  const rep = await readJson(root, '.vima/reports/design-check.json');
  assert.equal(rep.phase, 'PLANNING');
  assert.equal(rep.gateApplies, false, 'PLANNING 期拿到六项全绿极易被读成「设计已完成」');
  assert.match(preview.stdout, /预览.*不是闸门判定/);

  await setPhase(root, 'DESIGNING');
  const gate = vima(root, 'design', 'check');
  assert.equal(gate.code, 0, gate.stderr);
  const rep2 = await readJson(root, '.vima/reports/design-check.json');
  assert.equal(rep2.gateApplies, true, 'DESIGNING 出口才是真正的闸门判定');
  assert.doesNotMatch(gate.stdout, /预览/);
});

// ── A45：方向裁定的执行者（D-A45-01/03/04）─────────────────────────────────
// 立项实证：sustain-v4 的 _shell/admin/selection.md 自述「由 Agent 推荐并先行冻结，
// 以免设计闸门阻塞后续实现」而闸门放行。以下四条把「代选无痕」钉死。

test('A45 否定用例：非交互环境批准方向且无豁免 → DIRECTION_SELECTOR exit 4（代选不得无痕）', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DESIGNING');
  await gradePage01(root, 'D1');
  await freezeDirection(root);
  const r = vima(root, 'design', 'approve', 'direction', '--app', 'admin');
  assert.equal(r.code, 4, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stderr, /DIRECTION_SELECTOR/);
  // 关键：整条批准不得落盘——确认失败还写进 lifecycle 等于前置形同虚设
  const lifecycle = await readJson(root, 'docs/lifecycle.json');
  assert.equal(lifecycle.designApproval?.directions?.admin, undefined);
});

test('A45 否定用例：--agent-selected 缺 --reason → USAGE（代选必须写下理由给用户看）', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DESIGNING');
  await gradePage01(root, 'D1');
  await freezeDirection(root);
  const r = vima(root, 'design', 'approve', 'direction', '--app', 'admin', '--agent-selected');
  assert.equal(r.code, 3, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stderr, /USAGE/);
  const blank = vima(root, 'design', 'approve', 'direction', '--app', 'admin', '--agent-selected', '--reason', '   ');
  assert.equal(blank.code, 3, '空白理由等同没写');
});

test('A45：显式记账后落 selectedBy/selectionWaiver，且 check 与 approve 逐次呈报但恒不阻断', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DESIGNING');
  await gradePage01(root, 'D1');
  await freezeDirection(root);
  const r = vima(root, 'design', 'approve', 'direction', '--app', 'admin', '--agent-selected', '--reason', '用户暂不可达');
  assert.equal(r.code, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /Agent 代选/);

  const rec = (await readJson(root, 'docs/lifecycle.json')).designApproval.directions.admin;
  assert.equal(rec.selectedBy, 'agent');
  assert.equal(rec.selectionWaiver.reason, '用户暂不可达');
  assert.ok(typeof rec.selectionWaiver.approvedAt === 'string');

  const check = vima(root, 'design', 'check');
  assert.match(check.stdout, /方向裁定人不是用户/, '已发生的代选必须在闸门被念出来');
  const report = await readJson(root, '.vima/reports/design-check.json');
  assert.deepEqual(report.directionSelectors, [{ app: 'admin', selectedBy: 'agent', reason: '用户暂不可达' }]);
  assert.equal(report.counts.directionSelectors, 1);
  // 恒不阻断（D-A45-03）：升为 error 会让 --agent-selected 豁免口失去意义
  assert.ok(!Object.values(report.derived).includes(false) || report.pass === false,
    'directionSelectors 不得进 derived 把闸门判红');
  assert.ok(!Object.keys(report.derived).includes('directionSelectors'));
});

test('A45 对偶用例（防永久噪声）：selectedBy=user 时 directionSelectors 必须为空', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DESIGNING');
  await gradePage01(root, 'D1');
  await freezeDirection(root);
  assert.equal(
    vima(root, 'design', 'approve', 'direction', '--app', 'admin', '--agent-selected', '--reason', 'x').code, 0,
  );
  // 模拟用户在交互终端确认过（TTY 路径在单测里不可达，直接改记录验呈报口径）
  const rel = 'docs/lifecycle.json';
  const lifecycle = await readJson(root, rel);
  lifecycle.designApproval.directions.admin = {
    approvedAt: lifecycle.designApproval.directions.admin.approvedAt,
    digest: lifecycle.designApproval.directions.admin.digest,
    selectedBy: 'user',
  };
  await writeFile(path.join(root, rel), `${JSON.stringify(lifecycle, null, 2)}\n`);
  const check = vima(root, 'design', 'check');
  assert.doesNotMatch(check.stdout, /方向裁定人不是用户/);
  const report = await readJson(root, '.vima/reports/design-check.json');
  assert.deepEqual(report.directionSelectors, []);
});

test('A45 存量兼容：A45 之前的批准（无 selectedBy）记为 unrecorded 并同样呈报', async (t) => {
  const root = await cloneGolden(t);
  await setPhase(root, 'DESIGNING');
  await gradePage01(root, 'D1');
  await freezeDirection(root);
  assert.equal(
    vima(root, 'design', 'approve', 'direction', '--app', 'admin', '--agent-selected', '--reason', 'x').code, 0,
  );
  const rel = 'docs/lifecycle.json';
  const lifecycle = await readJson(root, rel);
  const { approvedAt, digest } = lifecycle.designApproval.directions.admin;
  lifecycle.designApproval.directions.admin = { approvedAt, digest }; // 老形态
  await writeFile(path.join(root, rel), `${JSON.stringify(lifecycle, null, 2)}\n`);
  const report = (vima(root, 'design', 'check'), await readJson(root, '.vima/reports/design-check.json'));
  assert.deepEqual(report.directionSelectors, [{ app: 'admin', selectedBy: 'unrecorded', reason: null }]);
});

test('A45 D-A45-04：pattern: workbench 进 suggestFidelity 判据（≥D1），form/detail 不扩面', async () => {
  const { suggestFidelity } = await import('../../lib/commands/design.mjs');
  // 病例还原：工作台被拍平成表格容器序列后，旧判据只从压扁后的结果取值 → 判 D0
  const flattenedWorkbench = {
    design: { pattern: 'workbench' },
    components: [{ block: 'table', data: { shape: 'table' } }],
  };
  assert.equal(suggestFidelity(flattenedWorkbench), 'D1');
  // 不扩面（C2 红线一）：登记型页面维持 D0
  assert.equal(suggestFidelity({ design: { pattern: 'list' }, components: [] }), 'D0');
  assert.equal(suggestFidelity({ design: { pattern: 'form' }, components: [] }), 'D0');
  assert.equal(suggestFidelity({ design: { pattern: 'detail' }, components: [] }), 'D0');
  // custom 仍优先判 D2，不被 workbench 分支抢走
  assert.equal(suggestFidelity({ design: { pattern: 'custom' }, components: [] }), 'D2');
});
