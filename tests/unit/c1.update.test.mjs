// C1 单测：vima update（A15 前叫 vima upgrade）（mkdtemp 沙箱 + spawnSync 跑真实 CLI）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, appendFile, unlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fileExists } from '../../lib/util/fs.mjs';
import { installOptionsOf, diffScaffold } from '../../lib/commands/update.mjs';

/** 全项目文件内容指纹（排除 node_modules）：用于证明命令零写盘。 */
async function treeFingerprint(root) {
  const { createHash } = await import('node:crypto');
  const { walkFiles } = await import('../../lib/util/fs.mjs');
  const h = createHash('sha256');
  for (const rel of (await walkFiles(root, { exclude: ['node_modules'] })).sort()) {
    h.update(rel).update(await readFile(path.join(root, rel)));
  }
  return h.digest('hex');
}

const BIN = fileURLToPath(new URL('../../bin/vima.mjs', import.meta.url));

function vima(cwd, ...args) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
}

async function sandbox(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-c1-update-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

/** create + init 出一个就绪项目。 */
async function initializedProject(t, name = 'up-admin') {
  const box = await sandbox(t);
  assert.equal(vima(box, 'create', name, '-t', 'admin', '--no-git', '--no-install').status, 0);
  const proj = path.join(box, name);
  const r = vima(proj, 'init');
  assert.equal(r.status, 0, `init 失败: ${r.stderr}`);
  return proj;
}

test('update：篡改 managed 文件 → 出现 .vima-new 且原文件未被覆盖', async (t) => {
  const proj = await initializedProject(t);
  const target = path.join(proj, 'docs/planning-guide.md');
  const marker = '\n<!-- 用户手改的一行 -->\n';
  await appendFile(target, marker);

  const r = vima(proj, 'update');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /vima-new/);

  // 新版本写到 .vima-new，原文件保留用户修改
  assert.ok(await fileExists(`${target}.vima-new`), '应生成 docs/planning-guide.md.vima-new');
  const disk = await readFile(target, 'utf8');
  assert.ok(disk.includes(marker.trim()), '用户修改过的原文件不应被覆盖');
  const fresh = await readFile(`${target}.vima-new`, 'utf8');
  assert.ok(!fresh.includes(marker.trim()), '.vima-new 应为干净的模板源');
});

test('update：未修改的 managed 文件被覆盖/保持最新，manifest.vimaVersion 更新', async (t) => {
  const proj = await initializedProject(t);
  const before = JSON.parse(await readFile(path.join(proj, '.vima/manifest.json'), 'utf8'));
  const r = vima(proj, 'update');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /更新完成/);
  const after = JSON.parse(await readFile(path.join(proj, '.vima/manifest.json'), 'utf8'));
  assert.ok(typeof after.vimaVersion === 'string' && after.vimaVersion.length > 0);
  assert.equal(after.files.managed.length, before.files.managed.length);
  // 未篡改场景不应产生任何 .vima-new
  assert.ok(!(await fileExists(path.join(proj, 'docs/planning-guide.md.vima-new'))));
});

test('update：磁盘缺失的 managed 文件按模板源重装', async (t) => {
  const proj = await initializedProject(t);
  const target = path.join(proj, '.claude/commands/go.md');
  await unlink(target);
  const r = vima(proj, 'update');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.ok(await fileExists(target), '被删除的 managed 文件应被重装');
});

test('update --dry-run：只打印动作表，不写盘', async (t) => {
  const proj = await initializedProject(t);
  const target = path.join(proj, 'docs/planning-guide.md');
  await appendFile(target, '\n<!-- 用户手改 -->\n');
  const before = await readFile(path.join(proj, '.vima/manifest.json'), 'utf8');

  const r = vima(proj, 'update', '--dry-run');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /dry-run/);
  assert.match(r.stdout, /合并/);
  // 不写盘：无 .vima-new、manifest 原样
  assert.ok(!(await fileExists(`${target}.vima-new`)));
  assert.equal(await readFile(path.join(proj, '.vima/manifest.json'), 'utf8'), before);
});

test('update：无 manifest → exit 4 提示先 init', async (t) => {
  const box = await sandbox(t);
  const r = vima(box, 'update');
  assert.equal(r.status, 4);
  assert.match(r.stderr, /vima init/);
});

test('update --yes：与默认行为一致（非交互实现）', async (t) => {
  const proj = await initializedProject(t);
  const r = vima(proj, 'update', '--yes');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /更新完成/);
});

// ── A18：模板新增受管文件的交付路径（旧行为只提示不装，导致新文件到不了存量项目）──

test('update：manifest 未记录的模板新增文件 → 自动安装并登记（含 hooks 可执行位）', async (t) => {
  const proj = await initializedProject(t);
  const rel = '.claude/hooks/go-continue.mjs';
  // 还原成「旧项目」：manifest 无 install 键、无该文件记录，磁盘也没有该文件
  const mPath = path.join(proj, '.vima/manifest.json');
  const m = JSON.parse(await readFile(mPath, 'utf8'));
  delete m.install;
  m.files.managed = m.files.managed.filter((e) => e.path !== rel);
  await writeFile(mPath, `${JSON.stringify(m, null, 2)}\n`);
  await unlink(path.join(proj, rel));

  const r = vima(proj, 'update');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /\[新增\] \.claude\/hooks\/go-continue\.mjs —— 模板新增文件，已安装/);
  assert.ok(await fileExists(path.join(proj, rel)), '新增受管文件应被安装');
  assert.equal((await stat(path.join(proj, rel))).mode & 0o111 ? true : false, true, 'hooks 须带可执行位');

  const after = JSON.parse(await readFile(mPath, 'utf8'));
  assert.ok(after.files.managed.some((e) => e.path === rel), '新增文件须登记进 manifest');
  assert.deepEqual(after.install, { minimal: false, skipScan: false }, '安装形态须固化到 manifest');
});

test('update：--minimal 项目不会被灌入 docs/ 资产（形态由 install 判定，旧 manifest 靠反推）', async (t) => {
  const box = await sandbox(t);
  assert.equal(vima(box, 'create', 'min-admin', '-t', 'admin', '--no-git', '--no-install').status, 0);
  const proj = path.join(box, 'min-admin');
  assert.equal(vima(proj, 'init', '--minimal').status, 0);

  // 抹掉 install 键，强制走反推路径
  const mPath = path.join(proj, '.vima/manifest.json');
  const m = JSON.parse(await readFile(mPath, 'utf8'));
  delete m.install;
  await writeFile(mPath, `${JSON.stringify(m, null, 2)}\n`);

  const r = vima(proj, 'update');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.ok(!/\[新增\] docs\//.test(r.stdout), 'minimal 项目不得被安装 docs/ 资产');
  assert.equal(await fileExists(path.join(proj, 'docs/planning-guide.md')), false);
  const after = JSON.parse(await readFile(mPath, 'utf8'));
  assert.equal(after.install.minimal, true, '反推出的形态须为 minimal 并固化');
});

test('installOptionsOf：install 键优先；缺失时按已记录文件确定性反推', () => {
  assert.deepEqual(
    installOptionsOf({ install: { minimal: true, skipScan: false }, files: { managed: [{ path: 'docs/x.md' }] } }),
    { minimal: true, skipScan: false },
    'install 键存在时以其为准（不再看文件）',
  );
  assert.deepEqual(
    installOptionsOf({ files: { managed: [{ path: 'AGENTS.md' }, { path: '.claude/settings.json' }] } }),
    { minimal: true, skipScan: false },
    '无任何 docs/ 条目 = minimal 安装',
  );
  assert.deepEqual(
    installOptionsOf({ files: { managed: [{ path: 'docs/planning-guide.md' }] } }),
    { minimal: false, skipScan: true },
    '有 docs/ 但无 docs/ui-framework/ = skip-scan 安装',
  );
  assert.deepEqual(
    installOptionsOf({ files: { managed: [{ path: 'docs/ui-framework/VButton.md' }] } }),
    { minimal: false, skipScan: false },
    '有组件文档 = 完整安装',
  );
});

// ── A19：存量项目升级可达性（端册迁移 / 骨架三方比较）──

test('update：v1 manifest 迁移为 v2 端册，幂等且不覆盖既有端册（A19）', async (t) => {
  const proj = await initializedProject(t);
  const mPath = path.join(proj, '.vima/manifest.json');
  const m = JSON.parse(await readFile(mPath, 'utf8'));
  delete m.apps;
  delete m.backend;
  m.schemaVersion = '1';
  await writeFile(mPath, `${JSON.stringify(m, null, 2)}\n`);

  const r = vima(proj, 'update');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /manifest 端册已迁移为 v2/);
  const after = JSON.parse(await readFile(mPath, 'utf8'));
  assert.equal(after.schemaVersion, '2');
  assert.equal(after.apps.length, 1);
  // 后端共享层必须带上真实路径：否则 guard-shared 走 v2 分支后会失去全部后端保护面
  assert.ok(after.backend.sharedDirs.length > 0, '迁移不得写出空的 backend.sharedDirs');
  assert.ok(after.backend.sharedDirs.every((d) => d.includes('/config') || d.includes('/security')));

  // 幂等：再跑一次不再提示迁移
  const again = vima(proj, 'update');
  assert.equal(again.status, 0);
  assert.ok(!/端册已迁移/.test(again.stdout), '已是 v2 不应重复迁移');
});

test('update：后端共享层目录不在位 → 放弃端册迁移，保住 v1 兜底保护面（A19）', async (t) => {
  const { rename } = await import('node:fs/promises');
  const proj = await initializedProject(t, 'guard-admin');
  const mPath = path.join(proj, '.vima/manifest.json');
  const m = JSON.parse(await readFile(mPath, 'utf8'));
  delete m.apps;
  delete m.backend;
  m.schemaVersion = '1';
  await writeFile(mPath, `${JSON.stringify(m, null, 2)}\n`);

  // 模拟用户重命名过包路径：security 包不在模板声明的位置
  const secDir = path.join(proj, 'backend/src/main/java/com/guardadmin/security');
  await rename(secDir, `${secDir}_moved`);

  const r = vima(proj, 'update');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /端册迁移已跳过/);
  const after = JSON.parse(await readFile(mPath, 'utf8'));
  assert.equal(after.schemaVersion, '1', '放弃迁移时 manifest 须保持 v1');
  assert.equal(after.apps, undefined, 'apps 未写入 → guard-shared 继续走 v1 字面量兜底');
});

test('diffScaffold：三态判定——只有模板变=可安全更新，两边都变=需人工，只有用户变=不列', () => {
  const baseline = [
    { path: 'a.ts', checksum: 'sha256:A' },
    { path: 'b.ts', checksum: 'sha256:B' },
    { path: 'c.ts', checksum: 'sha256:C' },
    { path: 'gone.ts', checksum: 'sha256:G' },
  ];
  const disk = new Map([['a.ts', 'sha256:A'], ['b.ts', 'sha256:BB'], ['c.ts', 'sha256:CC']]);
  const tpl = new Map([['a.ts', 'sha256:A2'], ['b.ts', 'sha256:B2'], ['c.ts', 'sha256:C'], ['gone.ts', 'sha256:G2']]);
  const { safe, manual } = diffScaffold(baseline, disk, tpl);
  assert.deepEqual(safe, ['a.ts'], '用户未改而模板变了 → 可安全更新');
  assert.deepEqual(manual, ['b.ts'], '两边都变 → 需人工');
  // c.ts 只有用户改（模板没变）不列；gone.ts 磁盘已删不越俎代庖
});

test('update --scaffold-diff：只读报告，全项目文件指纹不变；无基线时如实说明（A19）', async (t) => {
  const proj = await initializedProject(t, 'sd-admin');
  const before = await treeFingerprint(proj);
  const r = vima(proj, 'update', '--scaffold-diff');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /骨架三方比较/);
  assert.match(r.stdout, /未写盘/);
  assert.equal(await treeFingerprint(proj), before, '--scaffold-diff 必须零写盘');

  // 无基线（A19 之前建的项目）：如实说明能力边界，不猜
  const mPath = path.join(proj, '.vima/manifest.json');
  const m = JSON.parse(await readFile(mPath, 'utf8'));
  delete m.files.scaffold;
  await writeFile(mPath, `${JSON.stringify(m, null, 2)}\n`);
  const noBase = vima(proj, 'update', '--scaffold-diff');
  assert.equal(noBase.status, 0);
  assert.match(noBase.stdout, /未记录骨架基线/);
});
