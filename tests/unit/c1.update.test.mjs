// C1 单测：vima update（A15 前叫 vima upgrade）（mkdtemp 沙箱 + spawnSync 跑真实 CLI）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, appendFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fileExists } from '../../lib/util/fs.mjs';

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
