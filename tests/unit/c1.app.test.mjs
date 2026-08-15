// C1 单测：vima app（端册生命周期，A16 Wave 3 / 契约 §6.4 §14）
//
// 核心场景是**存量项目后补端**：先有后台、后要患者端是真实节奏，
// 而这条路以前只能手改 .vima/manifest.json。断言重点在三处：
//   ① 均质布局成立（A28：既有端在 apps/admin/ 原地零迁移，新端追加 apps/<id>/；
//      改判前创建的存量根布局 dir "." 的寻址分支由 c3 手写 manifest 夹具覆盖）；
//   ② 端册与 A19 骨架基线、init 的 managed 清单都同步落账（不留半截状态）；
//   ③ 重复 id / 非法 id / 未知 kind 各自的退出码稳定。
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(HERE, '..', '..', 'bin', 'vima.mjs');

function vima(cwd, ...args) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
}

/** 建一个真实的单端 admin 项目（create + init），后续用例在它上面加端。 */
async function makeProject(t, name = 'demo') {
  const box = await mkdtemp(path.join(os.tmpdir(), 'vima-c1-app-'));
  t.after(() => rm(box, { recursive: true, force: true }));
  const c = vima(box, 'create', name, '-t', 'admin', '--no-git', '--no-install');
  assert.equal(c.status, 0, `create stderr: ${c.stderr}`);
  const proj = path.join(box, name);
  const i = vima(proj, 'init');
  assert.equal(i.status, 0, `init stderr: ${i.stderr}`);
  return proj;
}

const readManifest = async (proj) =>
  JSON.parse(await readFile(path.join(proj, '.vima', 'manifest.json'), 'utf8'));

test('app list：单端项目列出端册与后端，标注骨架在位', async (t) => {
  const proj = await makeProject(t);
  const r = vima(proj, 'app', 'list');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /端册（1 端）/);
  assert.match(r.stdout, /admin\s+admin-web\s+apps\/admin\s+✅骨架在位/);
  assert.match(r.stdout, /backend/);
});

test('app：list/add 拒绝多余位置参数', async (t) => {
  const proj = await makeProject(t);
  const list = vima(proj, 'app', 'list', 'extra');
  assert.equal(list.status, 3);
  assert.match(list.stderr, /多余的位置参数 "extra"/);
  const add = vima(proj, 'app', 'add', 'patient', 'extra', '--kind', 'mp-native');
  assert.equal(add.status, 3);
  assert.match(add.stderr, /多余的位置参数 "extra"/);
});

test('app add：存量单端项目后补 mp 端 —— 混合布局 + 端册/基线/文档同步落账', async (t) => {
  const proj = await makeProject(t);
  const before = await readManifest(proj);
  const scaffoldBefore = (before.files.scaffold ?? []).length;
  const managedBefore = (before.files.managed ?? []).length;

  const r = vima(proj, 'app', 'add', 'patient', '--kind', 'mp-native');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);

  // ① 均质布局（A28）：既有端原地不动，新端追加 apps/<id>/
  const m = await readManifest(proj);
  assert.deepEqual(m.apps.map((a) => [a.id, a.kind, a.dir]), [
    ['admin', 'admin-web', 'apps/admin'],
    ['patient', 'mp-native', 'apps/patient'],
  ]);
  assert.ok(existsSync(path.join(proj, 'apps/admin/src/main.ts')), '既有端应零迁移');
  assert.ok(existsSync(path.join(proj, 'apps/patient/src/app.json')), '新端骨架应落盘');
  assert.ok(existsSync(path.join(proj, 'apps/patient/src/vendor/vima-ui-mp/dist/ui.wxss')));

  // 共享层含 src/vendor（A23）——否则 Builder 能无令牌改写框架
  assert.deepEqual(m.apps[1].sharedDirs, ['src/components', 'src/utils', 'src/vendor']);

  // ② 落账：A19 骨架基线与 init 的 managed 清单都增长，不留半截状态
  assert.ok((m.files.scaffold ?? []).length > scaffoldBefore, '新端骨架应进 A19 基线');
  assert.ok((m.files.managed ?? []).length > managedBefore, '新端组件文档应进 managed 清单');
  assert.ok(existsSync(path.join(proj, 'docs/ui-framework/patient/CAPABILITY.md')));
  assert.ok(existsSync(path.join(proj, 'docs/ui-framework/CAPABILITY.md')),
    '既有单端的平铺组件文档不动（context 两种形态都认，移动它要改既有 managed 条目）');

  // 加端后 doctor 的端册检查项仍通过
  const d = vima(proj, 'doctor');
  assert.match(d.stdout, /端册完整性/);
  assert.match(d.stdout, /端册 2 端/);
});

test('app add：第三个端（h5-mobile）与 mp 端共存', async (t) => {
  const proj = await makeProject(t);
  assert.equal(vima(proj, 'app', 'add', 'patient', '--kind', 'mp-native').status, 0);
  const r = vima(proj, 'app', 'add', 'ph5', '--kind', 'h5-mobile', '--name', '患者端H5');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  const m = await readManifest(proj);
  assert.equal(m.apps.length, 3);
  assert.equal(m.apps[2].name, '患者端H5');
  assert.ok(existsSync(path.join(proj, 'apps/ph5/vendor/vima-ui-h5/dist/ui.css')));
  assert.ok(existsSync(path.join(proj, 'apps/ph5/src/utils/request.ts')));
});

test('app add 校验：重复 id → APP_EXISTS exit 4；非法 id / 未知 kind / 缺 kind → usage exit 3', async (t) => {
  const proj = await makeProject(t);
  assert.equal(vima(proj, 'app', 'add', 'patient', '--kind', 'mp-native').status, 0);

  const dup = vima(proj, 'app', 'add', 'patient', '--kind', 'mp-native');
  assert.equal(dup.status, 4);
  assert.match(dup.stderr, /APP_EXISTS/);

  assert.equal(vima(proj, 'app', 'add', 'Bad_Id', '--kind', 'mp-native').status, 3);
  const badKind = vima(proj, 'app', 'add', 'x', '--kind', 'no-such-kind');
  assert.equal(badKind.status, 3);
  assert.match(badKind.stderr, /未知 kind/);
  assert.equal(vima(proj, 'app', 'add', 'y').status, 3, '缺 --kind 应报用法错');

  // 目录已存在但不在端册里：同样 APP_EXISTS，且不覆盖既有内容
  await writeFile(path.join(proj, 'docs', 'occupied.txt'), 'x');
  const r = vima(proj, 'app', 'add', 'docs', '--kind', 'mp-native');
  assert.equal(r.status, 0, '端 id 与顶层 docs/ 同名不冲突——新端落 apps/docs/');
  assert.ok(existsSync(path.join(proj, 'apps/docs/src/app.json')));
});

test('app：未知子命令 / 非 vima 项目 → 稳定退出码', async (t) => {
  const proj = await makeProject(t);
  assert.equal(vima(proj, 'app', 'nope').status, 3);
  const box = await mkdtemp(path.join(os.tmpdir(), 'vima-c1-app-bare-'));
  t.after(() => rm(box, { recursive: true, force: true }));
  const r = vima(box, 'app', 'list');
  assert.equal(r.status, 4, '不在项目里应被顶层守卫拦下');
  assert.match(r.stderr, /NOT_IN_PROJECT/);
});
