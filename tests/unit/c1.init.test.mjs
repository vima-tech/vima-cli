// C1 单测：vima init（mkdtemp 沙箱 + spawnSync 跑真实 CLI）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fileExists, walkFiles } from '../../lib/util/fs.mjs';

const BIN = fileURLToPath(new URL('../../bin/vima.mjs', import.meta.url));

function vima(cwd, ...args) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
}

async function sandbox(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-c1-init-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

/** 建好一个 admin 项目并返回其根目录（create --no-git --no-install）。 */
async function createAdminProject(t, name = 'my-admin') {
  const box = await sandbox(t);
  const r = vima(box, 'create', name, '--template', 'admin', '--no-git', '--no-install');
  assert.equal(r.status, 0, `create 失败: ${r.stderr}`);
  return path.join(box, name);
}

test('init：CLAUDE.md < 50 行、hooks 可执行位、manifest.managed > 0、lifecycle=PLANNING', async (t) => {
  const proj = await createAdminProject(t);
  const r = vima(proj, 'init');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);

  // CLAUDE.md：存在、行数 < 50、变量已替换
  const claudeMd = await readFile(path.join(proj, 'CLAUDE.md'), 'utf8');
  assert.ok(claudeMd.trimEnd().split('\n').length < 50, 'CLAUDE.md 应少于 50 行');
  assert.ok(claudeMd.includes('my-admin'), 'CLAUDE.md 应替换 {{projectName}}');
  assert.ok(!claudeMd.includes('{{projectName}}'));

  // hooks 可执行位
  const hooks = await walkFiles(path.join(proj, '.claude/hooks'));
  assert.ok(hooks.length > 0, '.claude/hooks 应有文件');
  for (const rel of hooks) {
    const mode = (await stat(path.join(proj, '.claude/hooks', rel))).mode;
    assert.ok((mode & 0o111) !== 0, `hook 应可执行: ${rel}`);
  }

  // manifest：managed 数量 > 0，每条带 sha256 校验和；userOwned 为契约 §6.4 列表
  const manifest = JSON.parse(await readFile(path.join(proj, '.vima/manifest.json'), 'utf8'));
  assert.ok(manifest.files.managed.length > 0);
  for (const e of manifest.files.managed) {
    assert.match(e.checksum, /^sha256:[0-9a-f]{64}$/);
  }
  assert.ok(manifest.files.userOwned.includes('CLAUDE.md'));
  assert.ok(manifest.files.userOwned.includes('docs/spec.md'));
  assert.ok(typeof manifest.initializedAt === 'string');

  // lifecycle：currentPhase=PLANNING，BOOTSTRAP completedAt / PLANNING enteredAt 已填
  const lifecycle = JSON.parse(await readFile(path.join(proj, 'docs/lifecycle.json'), 'utf8'));
  assert.equal(lifecycle.currentPhase, 'PLANNING');
  assert.equal(lifecycle.templateId, 'admin');
  const bootstrap = lifecycle.phaseHistory.find((p) => p.phase === 'BOOTSTRAP');
  const planning = lifecycle.phaseHistory.find((p) => p.phase === 'PLANNING');
  assert.ok(bootstrap.completedAt, 'BOOTSTRAP.completedAt 应已填');
  assert.ok(planning.enteredAt, 'PLANNING.enteredAt 应已填');

  // 关键产物齐全
  for (const rel of [
    'docs/spec.md',
    'docs/planning-guide.md',
    'docs/planning-validation/validate.checklist.md',
    'docs/planning-validation/coverage-matrix.example.md',
    'docs/contracts/_example.md',
    'docs/tasks/_template-fe.md',
    'docs/tasks/_template-be.md',
    'docs/raw/.gitkeep',
    'docs/review/.gitkeep',
    'docs/ui-framework/CAPABILITY.md',
    '.claude/settings.json',
    '.claude/commands/go.md',
    '.claude/agents/vima-builder.md',
  ]) {
    assert.ok(await fileExists(path.join(proj, rel)), `应存在: ${rel}`);
  }
});

test('init：重复 init 无 --force → exit 4 并提示 vima upgrade', async (t) => {
  const proj = await createAdminProject(t);
  assert.equal(vima(proj, 'init').status, 0);
  const again = vima(proj, 'init');
  assert.equal(again.status, 4);
  assert.match(again.stderr, /vima upgrade/);
});

test('init --force：可重建，且已存在的 userOwned 文件保留用户版本', async (t) => {
  const proj = await createAdminProject(t);
  assert.equal(vima(proj, 'init').status, 0);
  // 用户改 CLAUDE.md 后 --force 重建：CLAUDE.md 不被覆盖
  const marker = '\n<!-- 用户自定义宪法条款 -->\n';
  const before = await readFile(path.join(proj, 'CLAUDE.md'), 'utf8');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path.join(proj, 'CLAUDE.md'), before + marker);
  const r = vima(proj, 'init', '--force');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stderr, /保留用户版本/); // 独立 ⚠️ 提示走 stderr（契约 §3 输出流向）
  const after = await readFile(path.join(proj, 'CLAUDE.md'), 'utf8');
  assert.ok(after.includes(marker.trim()), 'userOwned 的 CLAUDE.md 不应被 --force 覆盖');
});

test('init：preview 模板项目 → exit 4（A5 TEMPLATE_PREVIEW）', async (t) => {
  const box = await sandbox(t);
  assert.equal(vima(box, 'create', 'demo-cli', '-t', 'cli', '--no-git', '--no-install').status, 0);
  const r = vima(path.join(box, 'demo-cli'), 'init');
  assert.equal(r.status, 4);
  assert.match(r.stderr, /TEMPLATE_PREVIEW/);
  assert.match(r.stderr, /planning/);
});

test('init：无模板信息且未给 --template → exit 3；--template 可兜底', async (t) => {
  const box = await sandbox(t);
  const bare = path.join(box, 'bare');
  await mkdir(bare, { recursive: true });
  const r = vima(bare, 'init');
  assert.equal(r.status, 3);
  assert.match(r.stderr, /--template/);
  // --template admin 兜底可初始化
  const r2 = vima(bare, 'init', '--template', 'admin');
  assert.equal(r2.status, 0, `stderr: ${r2.stderr}`);
  assert.ok(await fileExists(path.join(bare, 'docs/lifecycle.json')));
});

test('init --minimal：只装 CLAUDE.md / lifecycle / .claude / manifest', async (t) => {
  const proj = await createAdminProject(t, 'mini-admin');
  const r = vima(proj, 'init', '--minimal');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.ok(await fileExists(path.join(proj, 'CLAUDE.md')));
  assert.ok(await fileExists(path.join(proj, 'docs/lifecycle.json')));
  assert.ok(await fileExists(path.join(proj, '.claude/settings.json')));
  assert.ok(await fileExists(path.join(proj, '.vima/manifest.json')));
  // 非 minimal 的产物不应出现
  assert.ok(!(await fileExists(path.join(proj, 'docs/spec.md'))));
  assert.ok(!(await fileExists(path.join(proj, 'docs/planning-guide.md'))));
  assert.ok(!(await fileExists(path.join(proj, 'docs/ui-framework/CAPABILITY.md'))));
});

test('init --skip-scan：跳过组件文档拷贝（契约 §6.4），其余规划资产照常落地', async (t) => {
  const proj = await createAdminProject(t, 'scan-admin');
  const r = vima(proj, 'init', '--skip-scan');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.ok(
    !(await fileExists(path.join(proj, 'docs/ui-framework/CAPABILITY.md'))),
    '--skip-scan 不应拷贝组件文档',
  );
  assert.ok(await fileExists(path.join(proj, 'docs/spec.md')), '其余规划资产不受影响');
  assert.ok(await fileExists(path.join(proj, 'CLAUDE.md')));
});

test('init：安装 AGENTS.md 跨工具指针（A8，managed；真源仍是 CLAUDE.md）', async (t) => {
  const proj = await createAdminProject(t);
  assert.equal(vima(proj, 'init').status, 0);
  const text = await readFile(path.join(proj, 'AGENTS.md'), 'utf8');
  assert.match(text, /CLAUDE\.md/, '指针文件必须声明真源是 CLAUDE.md');
  assert.match(text, /my-admin/, '{{projectName}} 须已渲染');
  assert.ok(!text.includes('{{project'), '不得残留模板占位符');
  const manifest = JSON.parse(await readFile(path.join(proj, '.vima/manifest.json'), 'utf8'));
  assert.ok(
    manifest.files.managed.some((e) => e.path === 'AGENTS.md'),
    'AGENTS.md 应为 managed 文件（随模板升级，用户定制走 CLAUDE.md）',
  );
});

test('init：安装 docs/coding-standards.md（§5.2 详细规范指针落点，契约 §6.3 codingStandards）', async (t) => {
  const proj = await createAdminProject(t);
  assert.equal(vima(proj, 'init').status, 0);
  const text = await readFile(path.join(proj, 'docs/coding-standards.md'), 'utf8');
  assert.match(text, /编码规范/);
  // 记入 manifest managed（upgrade 可升级）
  const manifest = JSON.parse(await readFile(path.join(proj, '.vima/manifest.json'), 'utf8'));
  assert.ok(
    manifest.files.managed.some((e) => e.path === 'docs/coding-standards.md'),
    'coding-standards 应为 managed 文件',
  );
});
