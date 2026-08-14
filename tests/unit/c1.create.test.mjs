// C1 单测：vima create（mkdtemp 沙箱 + spawnSync 跑真实 CLI，断言退出码与产物）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
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
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-c1-create-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('create admin：目录结构齐全、变量替换无 {{ 残留、manifest 存在', async (t) => {
  const box = await sandbox(t);
  const r = vima(box, 'create', 'my-admin', '--template', 'admin', '--no-git', '--no-install');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);

  const proj = path.join(box, 'my-admin');
  // 目录结构：端一律落 apps/<id>/（A28，改判 D-A16-03），后端在 backend/
  assert.ok(await fileExists(path.join(proj, 'apps/admin/package.json')), '前端 package.json 应在 apps/admin/（A28）');
  assert.ok(await fileExists(path.join(proj, 'apps/admin/src/main.ts')), '前端 src/ 应在 apps/admin/（A28）');
  assert.ok(!(await fileExists(path.join(proj, 'src'))), '项目根不应再有 src/（A28）');
  assert.ok(await fileExists(path.join(proj, 'backend/pom.xml')), 'backend/pom.xml 应存在');
  // vendor 组件库随骨架落地（含预构建 dist）
  assert.ok(
    await fileExists(path.join(proj, 'apps/admin/vendor/vima-ui-admin/package.json')),
    'vendor/vima-ui-admin/package.json 应存在',
  );
  assert.ok(await fileExists(path.join(proj, 'apps/admin/vendor/vima-ui-admin/dist')), 'vendor dist 应存在');
  // 完整管理后台前端：核心 view / util / 布局组件
  for (const f of [
    'apps/admin/src/views/system/user/index.vue',
    'apps/admin/src/utils/request.ts',
    'apps/admin/src/components/layout/MainLayout.vue',
    'apps/admin/scripts/layout-probe.mjs',
    'apps/admin/scripts/layout-smoke.mjs',
  ]) {
    assert.ok(await fileExists(path.join(proj, f)), `${f} 应存在`);
  }
  // 路径变量替换：{{projectPkg}} → myadmin（含 security 包）
  assert.ok(
    await fileExists(path.join(proj, 'backend/src/main/java/com/myadmin/Application.java')),
    'Java 包路径应替换为 com/myadmin',
  );
  assert.ok(
    await fileExists(path.join(proj, 'backend/src/main/java/com/myadmin/security/TokenStore.java')),
    '后端 security/TokenStore.java 应存在',
  );

  // 二进制安全：hero.png 首 8 字节为 PNG magic，且与模板源字节数一致（未被当文本改写）
  const heroSrc = path.join(
    path.dirname(BIN),
    '../templates/admin/scaffold/frontend/src/assets/hero.png',
  );
  const hero = await readFile(path.join(proj, 'apps/admin/src/assets/hero.png'));
  assert.deepEqual(
    [...hero.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    'hero.png 首 8 字节应为 PNG magic',
  );
  assert.equal(hero.length, (await stat(heroSrc)).size, 'hero.png 字节数应与模板源一致');

  // 可执行位保留：mvnw 必须可执行落地
  const mvnwMode = (await stat(path.join(proj, 'backend/mvnw'))).mode;
  assert.ok(mvnwMode & 0o100, 'backend/mvnw 应保留可执行位');

  // 全部路径无 {{ 残留；文本文件内容无 {{project 残留（只查此前缀，避免误伤 vue 模板插值）
  const TEXT_EXT_RE = /\.(ts|tsx|vue|js|mjs|cjs|json|md|html|css|svg|yml|yaml|xml|properties|txt|gitkeep|cmd|sh|env|java)$/i;
  const files = await walkFiles(proj, { exclude: ['node_modules', '.git'] });
  assert.ok(files.length > 0);
  for (const rel of files) {
    assert.ok(!rel.includes('{{'), `路径残留模板变量: ${rel}`);
    if (!TEXT_EXT_RE.test(rel) && path.basename(rel) !== 'mvnw') continue;
    const content = await readFile(path.join(proj, rel), 'utf8');
    assert.ok(!content.includes('{{project'), `${rel} 残留 {{project 模板变量`);
  }

  // _gitignore 落地改名 .gitignore（npm 发包会剥离 .gitignore，模板源用下划线名规避）；
  // A28 根卫生资产：项目根与端目录各一份（根管项目级规则，端管端内构建产物）
  assert.ok(await fileExists(path.join(proj, '.gitignore')), '项目根 .gitignore 应存在（A28 根卫生资产）');
  assert.ok(await fileExists(path.join(proj, 'apps/admin/.gitignore')), '端内 .gitignore 应存在');
  const rootIgnore = await readFile(path.join(proj, '.gitignore'), 'utf8');
  assert.ok(rootIgnore.includes('backend/target/'), '项目级忽略规则（backend/target/）应在根 .gitignore');
  assert.ok(!(await fileExists(path.join(proj, '_gitignore'))), '不应残留 _gitignore 原名文件');
  assert.ok(!(await fileExists(path.join(proj, 'apps/admin/_gitignore'))), '端内不应残留 _gitignore 原名文件');

  // README.md 属项目不属端（A28 迁根）：落项目根，且无 {{ 残留、项目名已替换
  const readme = await readFile(path.join(proj, 'README.md'), 'utf8');
  assert.ok(!readme.includes('{{'), 'README.md 不应残留 {{ 模板变量');
  assert.ok(readme.includes('my-admin'), 'README.md 应替换出项目名 my-admin');
  assert.ok(!(await fileExists(path.join(proj, 'apps/admin/README.md'))), 'README 已迁根，端内不应再有');

  // Sidebar.vue：抬头是图标不是项目缩写（{{projectAbbr}} 变量已删除，英文缩写对使用者无语义）
  const sidebar = await readFile(path.join(proj, 'apps/admin/src/components/layout/Sidebar.vue'), 'utf8');
  assert.ok(!sidebar.includes('{{project'), 'Sidebar.vue 不应残留 {{project 模板变量');
  assert.ok(/v-side-heading-mark[^>]*><VIcon /.test(sidebar), 'Sidebar.vue 抬头标记应为 VIcon 图标');

  // manifest（契约 §6.4：managed 先空数组；A16 端册化后 admin 模板写 schemaVersion 2 + 端册）
  const manifest = JSON.parse(await readFile(path.join(proj, '.vima/manifest.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, '2');
  assert.equal(manifest.templateId, 'admin');
  assert.ok(typeof manifest.createdAt === 'string' && manifest.createdAt.length > 0);
  assert.ok(typeof manifest.vimaVersion === 'string');
  assert.deepEqual(manifest.files.managed, []);
  // A16 端册：缺省 = default 端（admin）；A28：布局一律 apps/<id>/（含单端）
  assert.deepEqual(manifest.apps, [{
    id: 'admin', name: '管理后台', kind: 'admin-web', dir: 'apps/admin', codeDir: 'src',
    sharedDirs: ['src/components', 'src/utils', 'vendor'],
  }]);
  // backend sharedDirs 的 {{projectPkg}} 已渲染为具体路径（契约 §6.4）
  assert.deepEqual(manifest.backend, {
    dir: 'backend',
    sharedDirs: ['src/main/java/com/myadmin/config', 'src/main/java/com/myadmin/security'],
  });
});

test('create --apps 双端（A16/A23）：两端骨架各落 apps/<id>/、端册入 manifest、mp 端共享层含 src/vendor', async (t) => {
  const box = await sandbox(t);
  const r = vima(box, 'create', 'nutri', '-t', 'admin',
    '--apps', 'admin:admin-web,patient:mp-native', '--no-git', '--no-install');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  const proj = path.join(box, 'nutri');
  // N≥2：全部前端落 apps/<id>/；backend 不动
  assert.ok(await fileExists(path.join(proj, 'apps/admin/src/main.ts')), 'admin 端应落 apps/admin/');
  assert.ok(await fileExists(path.join(proj, 'apps/admin/package.json')));
  assert.ok(await fileExists(path.join(proj, 'backend/pom.xml')));
  assert.ok(!(await fileExists(path.join(proj, 'src'))), '多端布局项目根不应再有 src/');
  // A23：mp-native 转 stable，患者端骨架与自研 UI 框架一并落盘
  assert.ok(await fileExists(path.join(proj, 'apps/patient/src/app.json')), 'mp 端骨架应落 apps/patient/');
  assert.ok(await fileExists(path.join(proj, 'apps/patient/src/utils/request.ts')), '请求门面是 V-CODE-01 的前提');
  assert.ok(await fileExists(path.join(proj, 'apps/patient/src/vendor/vima-ui-mp/dist/ui.wxss')), 'vima-ui-mp 应随骨架落盘');
  const wxml = await readFile(path.join(proj, 'apps/patient/src/pages/home/index.wxml'), 'utf8');
  assert.match(wxml, /class="vm-page/, '骨架页应用框架类');
  const manifest = JSON.parse(await readFile(path.join(proj, '.vima/manifest.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, '2');
  assert.equal(manifest.apps.length, 2);
  assert.deepEqual(manifest.apps.map((a) => [a.id, a.kind, a.dir]), [
    ['admin', 'admin-web', 'apps/admin'],
    ['patient', 'mp-native', 'apps/patient'],
  ]);
  // A23：mp 端 vendor 在 src/ 下（miniprogramRoot 之内），必须进共享层保护面
  assert.deepEqual(manifest.apps.find((a) => a.id === 'patient').sharedDirs,
    ['src/components', 'src/utils', 'src/vendor']);
});

test('create --apps 校验：非法 id / 未知 kind / 重复 id → exit 3；旧形态模板不支持 --apps', async (t) => {
  const box = await sandbox(t);
  assert.equal(vima(box, 'create', 'x1', '-t', 'admin', '--apps', 'Bad_Id:admin-web').status, 3);
  const r2 = vima(box, 'create', 'x2', '-t', 'admin', '--apps', 'a:no-such-kind');
  assert.equal(r2.status, 3);
  assert.match(r2.stderr, /未知 kind/);
  assert.equal(vima(box, 'create', 'x3', '-t', 'admin', '--apps', 'a:admin-web,a:mp-native').status, 3);
  const r4 = vima(box, 'create', 'x4', '-t', 'cli', '--apps', 'a:admin-web', '--no-git', '--no-install');
  assert.equal(r4.status, 3);
  assert.match(r4.stderr, /未声明端册/);
});

test('create --force 重跑（A16）：保留既有 manifest 的端册与 files；templateId 不同 → TEMPLATE_MISMATCH exit 4', async (t) => {
  const box = await sandbox(t);
  assert.equal(vima(box, 'create', 'keep', '-t', 'admin', '--no-git', '--no-install').status, 0);
  const mPath = path.join(box, 'keep/.vima/manifest.json');
  const before = JSON.parse(await readFile(mPath, 'utf8'));
  // person A 已 init 过的样子：files.managed 非空
  before.files.managed = [{ path: 'CLAUDE.md', checksum: 'sha256:deadbeef' }];
  const { writeFile } = await import('node:fs/promises');
  await writeFile(mPath, JSON.stringify(before));
  const forced = vima(box, 'create', 'keep', '-t', 'admin', '--force', '--no-git', '--no-install');
  assert.equal(forced.status, 0, `stderr: ${forced.stderr}`);
  const after = JSON.parse(await readFile(mPath, 'utf8'));
  assert.deepEqual(after.files.managed, before.files.managed, '--force 不得清空 files.managed');
  assert.deepEqual(after.apps, before.apps, '--force 不得覆写端册');
  assert.equal(after.createdAt, before.createdAt, '--force 保留 createdAt');
  // templateId 冲突 → TEMPLATE_MISMATCH
  const clash = vima(box, 'create', 'keep', '-t', 'cli', '--force', '--no-git', '--no-install');
  assert.equal(clash.status, 4);
  assert.match(clash.stderr, /TEMPLATE_MISMATCH/);
});

test('create：目录已存在且无 --force → exit 4；--force 可覆盖', async (t) => {
  const box = await sandbox(t);
  assert.equal(vima(box, 'create', 'dup', '-t', 'admin', '--no-git', '--no-install').status, 0);
  const again = vima(box, 'create', 'dup', '-t', 'admin', '--no-git', '--no-install');
  assert.equal(again.status, 4);
  assert.match(again.stderr, /已存在/);
  const forced = vima(box, 'create', 'dup', '-t', 'admin', '--force', '--no-git', '--no-install');
  assert.equal(forced.status, 0, `stderr: ${forced.stderr}`);
});

test('create：用法错误（缺项目名 / 非法项目名 / 未知选项）→ exit 3', async (t) => {
  const box = await sandbox(t);
  assert.equal(vima(box, 'create').status, 3);
  assert.equal(vima(box, 'create', '-bad-name', '-t', 'admin').status, 3);
  assert.equal(vima(box, 'create', 'ok-name', '--bogus-flag').status, 3);
});

test('create：非 TTY 且未给 --template → usageError exit 3', async (t) => {
  const box = await sandbox(t);
  const r = vima(box, 'create', 'no-tpl');
  assert.equal(r.status, 3);
  assert.match(r.stderr, /--template/);
});

test('create：未知模板 → exit 3', async (t) => {
  const box = await sandbox(t);
  const r = vima(box, 'create', 'proj', '--template', 'nope');
  assert.equal(r.status, 3);
  assert.match(r.stderr, /NO_TEMPLATE/);
});

test('create preview 模板：照常创建但打印显眼 preview 警告（A5）', async (t) => {
  const box = await sandbox(t);
  const r = vima(box, 'create', 'demo-cli', '--template', 'cli', '--no-git', '--no-install');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /preview/);
  assert.match(r.stdout, /vima init 将拒绝/);
  const manifest = JSON.parse(await readFile(path.join(box, 'demo-cli/.vima/manifest.json'), 'utf8'));
  assert.equal(manifest.templateId, 'cli');
});

test('create：结尾打印 nextSteps（cd → vima init → claude）', async (t) => {
  const box = await sandbox(t);
  const r = vima(box, 'create', 'steps', '-t', 'admin', '--no-git', '--no-install');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /cd steps/);
  assert.match(r.stdout, /vima init/);
  assert.match(r.stdout, /claude/);
});

test('create -i 强制交互：非 TTY 下即使给了 --template 也 exit 3（§19.1，契约 §14）', async (t) => {
  const box = await sandbox(t);
  const r = vima(box, 'create', 'x-app', '-i', '--template', 'admin', '--no-git', '--no-install');
  assert.equal(r.status, 3, `stdout: ${r.stdout}\nstderr: ${r.stderr}`);
  assert.ok(!(await fileExists(path.join(box, 'x-app'))), '交互失败前不得生成项目目录');
});

test('preview 模板冒烟：script/lib/h5 起盘成功、manifest 落盘、无模板变量残留（D3 防漂移）', async (t) => {
  for (const id of ['script', 'lib', 'h5']) {
    const box = await sandbox(t);
    const r = vima(box, 'create', `demo-${id}`, '--template', id, '--no-git', '--no-install');
    assert.equal(r.status, 0, `${id}: stderr: ${r.stderr}`);
    assert.match(r.stdout, /preview/, `${id}: 应打印 preview 警告（A5）`);
    const proj = path.join(box, `demo-${id}`);
    const manifest = JSON.parse(await readFile(path.join(proj, '.vima/manifest.json'), 'utf8'));
    assert.equal(manifest.templateId, id);
    // 全部文本文件不得残留 {{projectName}}/{{projectPkg}}/{{createdAt}} 占位
    for (const rel of await walkFiles(proj, { exclude: ['node_modules', '.git'] })) {
      const buf = await readFile(path.join(proj, rel));
      if (buf.includes(0)) continue; // 二进制透传文件跳过
      assert.ok(!buf.toString('utf8').includes('{{project'), `${id}: ${rel} 残留模板变量`);
      assert.ok(!buf.toString('utf8').includes('{{createdAt'), `${id}: ${rel} 残留模板变量`);
    }
  }
});

// ── A19：骨架基线（供 update --scaffold-diff 三方比较）──

test('create：manifest 记录骨架基线 files.scaffold（落盘内容哈希，含改名后的 .gitignore）', async (t) => {
  const box = await sandbox(t);
  assert.equal(vima(box, 'create', 'base-admin', '-t', 'admin', '--no-git', '--no-install').status, 0);
  const proj = path.join(box, 'base-admin');
  const m = JSON.parse(await readFile(path.join(proj, '.vima/manifest.json'), 'utf8'));

  const baseline = m.files.scaffold;
  assert.ok(Array.isArray(baseline) && baseline.length > 0, 'create 须记录骨架基线');
  assert.ok(baseline.every((e) => typeof e.path === 'string' && /^sha256:[0-9a-f]{64}$/.test(e.checksum)));
  // 模板源用 _gitignore 存放，落盘改名为 .gitignore——基线须记录**落盘后**的路径
  assert.ok(baseline.some((e) => path.basename(e.path) === '.gitignore'));
  assert.ok(!baseline.some((e) => path.basename(e.path) === '_gitignore'));
  // 基线校验和须等于磁盘实际内容（否则三方比较起点就是错的）
  const sample = baseline.find((e) => e.path === 'apps/admin/package.json') ?? baseline[0];
  const { sha256File } = await import('../../lib/util/fs.mjs');
  assert.equal(`sha256:${await sha256File(path.join(proj, sample.path))}`, sample.checksum);
  // 路径一律 '/' 分隔（跨平台稳定）
  assert.ok(baseline.every((e) => !e.path.includes('\\')));
});
