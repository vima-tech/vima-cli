// F 单测：lib/model/*.mjs 与 lib/util/fs.mjs —— mkdtemp 临时夹具，不依赖 tests/fixtures/golden
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { VimaError, EXIT } from '../../lib/util/errors.mjs';
import {
  ensureDir, fileExists, atomicWriteFile, stableStringify, sha256, sha256File, walkFiles, findProjectRoot,
} from '../../lib/util/fs.mjs';
import { loadTasks, saveTaskFrontmatter } from '../../lib/model/tasks.mjs';
import { defaultLifecycle, loadLifecycle, saveLifecycle } from '../../lib/model/lifecycle.mjs';
import { loadSpec } from '../../lib/model/spec.mjs';
import { loadContracts, apiKey } from '../../lib/model/contracts.mjs';
import { loadManifest, saveManifest } from '../../lib/model/manifest.mjs';
import {
  tally, readJsonSafe, phaseDurations, collectReports, V_INT_RULES,
} from '../../lib/model/journal.mjs';
import {
  templatesRoot, listTemplates, loadTemplate, readProjectTemplateId,
} from '../../lib/model/template.mjs';
import { resolveApps, appOf, consumersOf } from '../../lib/model/apps.mjs';

/** 建临时项目根，测试完自动清理。 */
async function tempRoot(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-f-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function taskDoc(overrides = {}, extraLines = []) {
  const fm = {
    taskId: 'device-list-fe',
    title: '设备管理列表页（前端）',
    status: 'pending',
    layer: 'business',
    side: 'frontend',
    dependsOn: '[shared-base, device-api-be]',
    retryCount: '0',
    contract: 'docs/contracts/device-api.md',
    updatedAt: '2026-08-12T10:00:00Z',
    ...overrides,
  };
  const lines = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    if (v !== undefined) lines.push(`${k}: ${v}`);
  }
  lines.push(...extraLines, '---', '', '# 设备管理列表页', '', '## 验收清单', '', '- [ ] 列表可分页', '');
  return lines.join('\n');
}

async function writeTask(root, name, content) {
  await mkdir(path.join(root, 'docs', 'tasks'), { recursive: true });
  await writeFile(path.join(root, 'docs', 'tasks', name), content);
}

async function expectVimaError(fn, { code, exitCode, messageRe }) {
  let err = null;
  try {
    await fn();
  } catch (e) {
    err = e;
  }
  assert.ok(err !== null, '应抛出错误');
  assert.ok(err instanceof VimaError, `应抛 VimaError，实际 ${err.constructor.name}: ${err.message}`);
  if (code) assert.equal(err.code, code);
  if (exitCode !== undefined) assert.equal(err.exitCode, exitCode);
  if (messageRe) assert.match(err.message, messageRe);
  return err;
}

// ---------------------------------------------------------------------------
// lib/util/fs.mjs
// ---------------------------------------------------------------------------

test('fs：atomicWriteFile 自动建目录且无临时文件残留', async (t) => {
  const root = await tempRoot(t);
  const target = path.join(root, 'a', 'b', 'c.json');
  await atomicWriteFile(target, 'hello');
  assert.equal(await readFile(target, 'utf8'), 'hello');
  const files = await walkFiles(root);
  assert.deepEqual(files, ['a/b/c.json']); // 无 .tmp 残留
});

test('fs：stableStringify 深度 key 排序、2 空格缩进、结尾换行', () => {
  const out = stableStringify({ b: { z: 1, a: [3, 1, { y: 0, x: 0 }] }, a: true });
  assert.equal(out, `${JSON.stringify({ a: true, b: { a: [3, 1, { x: 0, y: 0 }], z: 1 } }, null, 2)}\n`);
  // 数组顺序不被改动
  assert.ok(out.indexOf('3') < out.indexOf('1'));
});

test('fs：sha256 / sha256File / fileExists / ensureDir', async (t) => {
  const root = await tempRoot(t);
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const p = path.join(root, 'x.txt');
  assert.equal(await fileExists(p), false);
  await writeFile(p, 'abc');
  assert.equal(await fileExists(p), true);
  assert.equal(await sha256File(p), sha256('abc'));
  await ensureDir(path.join(root, 'd1', 'd2'));
  await ensureDir(path.join(root, 'd1', 'd2')); // 幂等
  assert.equal(await fileExists(path.join(root, 'd1', 'd2')), true);
});

test('fs：walkFiles 相对路径稳定排序并支持 exclude 目录名', async (t) => {
  const root = await tempRoot(t);
  await atomicWriteFile(path.join(root, 'src', 'b.ts'), '');
  await atomicWriteFile(path.join(root, 'src', 'a.ts'), '');
  await atomicWriteFile(path.join(root, 'node_modules', 'pkg', 'index.js'), '');
  await atomicWriteFile(path.join(root, 'README.md'), '');
  assert.deepEqual(await walkFiles(root, { exclude: ['node_modules'] }), [
    'README.md', 'src/a.ts', 'src/b.ts',
  ]);
});

test('findProjectRoot：普通 .vima 文件不是项目标记', async (t) => {
  const root = await tempRoot(t);
  await writeFile(path.join(root, '.vima'), 'not a directory');
  assert.equal(await findProjectRoot(root), null);
});

// ---------------------------------------------------------------------------
// lib/model/tasks.mjs
// ---------------------------------------------------------------------------

test('loadTasks：正常读取，跳过 _ 前缀与 README.md，按文件名排序', async (t) => {
  const root = await tempRoot(t);
  await writeTask(root, 'device-list-fe.md', taskDoc());
  await writeTask(root, 'a-shared-base.md', taskDoc({
    taskId: 'shared-base', title: '共享层', layer: 'shared', side: 'fullstack',
    dependsOn: '[]', contract: undefined,
  }));
  await writeTask(root, '_template-fe.md', '不是任务');
  await writeTask(root, 'README.md', '# 任务依赖图');
  const tasks = await loadTasks(root);
  assert.deepEqual(tasks.map((x) => x.id), ['shared-base', 'device-list-fe']);
  const fe = tasks[1];
  assert.equal(fe.file, 'docs/tasks/device-list-fe.md');
  assert.equal(fe.fm.status, 'pending');
  assert.equal(fe.fm.retryCount, 0);
  assert.deepEqual(fe.fm.dependsOn, ['shared-base', 'device-api-be']);
  assert.equal(fe.fm.contract, 'docs/contracts/device-api.md');
  assert.match(fe.body, /## 验收清单/);
  // contract 可选：shared 任务无 contract 也合法
  assert.equal(tasks[0].fm.contract, undefined);
});

test('loadTasks：docs/tasks 目录缺失返回空数组', async (t) => {
  const root = await tempRoot(t);
  assert.deepEqual(await loadTasks(root), []);
});

test('loadTasks：缺必填字段抛 TASK_FM（含 path）', async (t) => {
  const root = await tempRoot(t);
  await writeTask(root, 'bad.md', taskDoc({ status: undefined }));
  const err = await expectVimaError(() => loadTasks(root), {
    code: 'TASK_FM', exitCode: EXIT.CHECK_FAILED, messageRe: /status/,
  });
  assert.equal(err.path, 'docs/tasks/bad.md');
});

test('loadTasks：非法枚举值抛 TASK_FM', async (t) => {
  const cases = [
    [{ status: 'doing' }, /status/],
    [{ layer: 'infra' }, /layer/],
    [{ side: 'middle' }, /side/],
    [{ taskId: 'Bad_Id' }, /taskId/],
    [{ retryCount: '-1' }, /retryCount/],
    [{ dependsOn: '[1, 2]' }, /dependsOn/],
  ];
  for (const [overrides, re] of cases) {
    const root = await tempRoot(t);
    await writeTask(root, 'bad.md', taskDoc(overrides));
    await expectVimaError(() => loadTasks(root), { code: 'TASK_FM', messageRe: re });
  }
});

test('loadTasks：缺 frontmatter 围栏抛 TASK_FM', async (t) => {
  const root = await tempRoot(t);
  await writeTask(root, 'bad.md', '# 没有 frontmatter 的任务');
  await expectVimaError(() => loadTasks(root), { code: 'TASK_FM', messageRe: /frontmatter/ });
});

test('loadTasks：重复 taskId 抛 TASK_FM，并指出两个任务文件', async (t) => {
  const root = await tempRoot(t);
  await writeTask(root, 'a.md', taskDoc({ taskId: 'same-task' }));
  await writeTask(root, 'b.md', taskDoc({ taskId: 'same-task' }));
  await expectVimaError(() => loadTasks(root), {
    code: 'TASK_FM', messageRe: /same-task.*docs\/tasks\/a\.md/,
  });
});

test('saveTaskFrontmatter：整体重写 frontmatter 并保留 body 原文', async (t) => {
  const root = await tempRoot(t);
  await writeTask(root, 'device-list-fe.md', taskDoc());
  const [task] = await loadTasks(root);
  const bodyBefore = task.body;
  await saveTaskFrontmatter(task, { status: 'done', retryCount: 1, updatedAt: '2026-08-12T11:00:00Z' });
  assert.equal(task.fm.status, 'done'); // 内存同步更新
  const [reloaded] = await loadTasks(root);
  assert.equal(reloaded.fm.status, 'done');
  assert.equal(reloaded.fm.retryCount, 1);
  assert.equal(reloaded.fm.updatedAt, '2026-08-12T11:00:00Z');
  assert.equal(reloaded.fm.title, '设备管理列表页（前端）'); // 未更新字段保留
  assert.equal(reloaded.body, bodyBefore); // body 原文不动
});

test('saveTaskFrontmatter：非法更新被拒绝', async (t) => {
  const root = await tempRoot(t);
  await writeTask(root, 'device-list-fe.md', taskDoc());
  const [task] = await loadTasks(root);
  await expectVimaError(() => saveTaskFrontmatter(task, { status: 'shipped' }), {
    code: 'TASK_FM', messageRe: /status/,
  });
});

// ---------------------------------------------------------------------------
// lib/model/lifecycle.mjs
// ---------------------------------------------------------------------------

test('defaultLifecycle：结构符合契约 §6.2 / 设计 §14.2', () => {
  const lc = defaultLifecycle('admin');
  assert.equal(lc.schemaVersion, '2.0');
  assert.equal(lc.templateId, 'admin');
  assert.equal(lc.currentPhase, 'PLANNING');
  assert.deepEqual(lc.phaseHistory.map((x) => x.phase), ['BOOTSTRAP', 'PLANNING']);
  assert.deepEqual(Object.keys(lc.checklists.PLANNING).sort(), [
    'artifactsValidated', 'contractsGenerated', 'modulesConfirmed', 'prototypeRendered',
    'rawDocsCollected', 'reviewRendered', 'specGenerated', 'tasksApproved', 'tasksDecomposed',
  ]);
  assert.ok(Object.values(lc.checklists.PLANNING).every((v) => v === false));
  assert.deepEqual(Object.keys(lc.checklists.DEVELOPING).sort(), [
    'businessTasksDone', 'codeAudited', 'pipelineDone', 'sharedLayerDone', 'testsPassed',
  ]);
  assert.deepEqual(lc.taskStats, { total: 0, done: 0, failed: 0, blocked: 0, updatedAt: null });
});

test('defaultLifecycle：vimaVersion 缺省值与 package.json 同步（防升版漂移；init 运行时另以 readCliVersion 覆盖）', async () => {
  const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(defaultLifecycle('admin').vimaVersion, pkg.version);
});

test('lifecycle：缺文件抛 NO_LIFECYCLE（exitCode 4），读写往返一致', async (t) => {
  const root = await tempRoot(t);
  await expectVimaError(() => loadLifecycle(root), {
    code: 'NO_LIFECYCLE', exitCode: EXIT.PRECONDITION,
  });
  const lc = defaultLifecycle('admin');
  lc.checklists.PLANNING.specGenerated = true;
  await saveLifecycle(root, lc);
  const loaded = await loadLifecycle(root);
  assert.deepEqual(loaded, lc);
  // 落盘为 stableStringify 格式（结尾换行）
  const raw = await readFile(path.join(root, 'docs', 'lifecycle.json'), 'utf8');
  assert.ok(raw.endsWith('}\n'));
});

// ---------------------------------------------------------------------------
// lib/model/spec.mjs
// ---------------------------------------------------------------------------

const SPEC_MD = [
  '# 演示项目规格',
  '',
  '## 2. 数据模型',
  '',
  '```yaml vima:entities',
  'entities:',
  '  - name: Device',
  '    fields:',
  '      - { name: id, type: number, required: true, desc: 主键 }',
  '      - { name: name, type: string, required: true, desc: 设备名称 }',
  'enums:',
  '  - { name: DeviceType, values: [sensor, actuator, gateway] }',
  '```',
  '',
  '## 3. 页面清单',
  '',
  '```yaml vima:page',
  'id: PAGE-01',
  'title: 设备列表',
  'menu: MENU-01',
  'layout: [search, table]',
  'components:',
  '  - block: table',
  '    api: GET /api/device/list',
  'apis: [GET /api/device/list]',
  '```',
  '',
  '```yaml vima:page',
  'id: PAGE-02',
  'title: 设备详情',
  'menu: MENU-01',
  'layout: [form]',
  'components:',
  '  - block: form',
  '    items: []',
  'apis: [GET /api/device/detail]',
  '```',
  '',
  '## 6. 权限设计',
  '',
  '```yaml vima:roles',
  'roles:',
  '  - { id: ROLE-01, name: 管理员, menus: [MENU-01] }',
  '```',
  '',
  '```yaml vima:menus',
  'menus:',
  '  - id: MENU-01',
  '    name: 设备管理',
  '    page: PAGE-01',
  '    features:',
  '      - { name: 设备查询, api: GET /api/device/list }',
  '```',
  '',
  '## 7. 业务流程',
  '',
  '```yaml vima:flow',
  'id: FLOW-01',
  'name: 设备上架流程',
  'steps:',
  '  - { role: ROLE-01, page: PAGE-01, action: 点击新增, api: POST /api/device, next: PAGE-01 }',
  '```',
  '',
].join('\n');

test('loadSpec：pages 为 Map，entities/enums/roles/menus/flows 正确抽取', async (t) => {
  const root = await tempRoot(t);
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await writeFile(path.join(root, 'docs', 'spec.md'), SPEC_MD);
  const spec = await loadSpec(root);

  assert.equal(spec.text, SPEC_MD);
  assert.deepEqual(spec.chapters[0], { level: 1, title: '演示项目规格', line: 1 });
  assert.ok(spec.chapters.some((c) => c.title === '3. 页面清单'));

  assert.ok(spec.pages instanceof Map);
  assert.deepEqual([...spec.pages.keys()], ['PAGE-01', 'PAGE-02']);
  assert.equal(spec.pages.get('PAGE-01').title, '设备列表');
  assert.deepEqual(spec.pages.get('PAGE-02').layout, ['form']);

  assert.equal(spec.entities.length, 1);
  assert.equal(spec.entities[0].fields.length, 2);
  assert.deepEqual(spec.enums[0].values, ['sensor', 'actuator', 'gateway']);

  assert.deepEqual(spec.roles, [{ id: 'ROLE-01', name: '管理员', menus: ['MENU-01'] }]);
  assert.equal(spec.menus[0].id, 'MENU-01');
  assert.equal(spec.menus[0].features[0].api, 'GET /api/device/list');

  assert.equal(spec.flows.length, 1);
  assert.equal(spec.flows[0].id, 'FLOW-01');
  assert.equal(spec.flows[0].steps[0].action, '点击新增');
});

test('loadSpec：docs/spec.md 缺失抛 NO_SPEC（exitCode 4）', async (t) => {
  const root = await tempRoot(t);
  await expectVimaError(() => loadSpec(root), { code: 'NO_SPEC', exitCode: EXIT.PRECONDITION });
});

// ---------------------------------------------------------------------------
// lib/model/contracts.mjs
// ---------------------------------------------------------------------------

const CONTRACT_MD = [
  '# 设备管理 API 契约',
  '',
  '## GET /api/device/list',
  '',
  '```yaml vima:contract',
  'module: device',
  'apis:',
  '  - method: GET',
  '    path: /api/device/list',
  '    request:',
  '      - { name: pageNum, type: number, required: true }',
  '    response:',
  '      - { name: id, type: number }',
  '      - { name: name, type: string }',
  '    errors:',
  '      - { code: 40001, msg: 参数校验失败 }',
  '  - method: post',
  '    path: /api/device',
  '    request: []',
  '    response: []',
  '    errors: []',
  '```',
  '',
].join('\n');

test('loadContracts：读取 vima:contract 块，跳过 _ 前缀', async (t) => {
  const root = await tempRoot(t);
  await mkdir(path.join(root, 'docs', 'contracts'), { recursive: true });
  await writeFile(path.join(root, 'docs', 'contracts', 'device-api.md'), CONTRACT_MD);
  await writeFile(path.join(root, 'docs', 'contracts', '_draft.md'), '草稿，应被跳过');
  await writeFile(path.join(root, 'docs', 'contracts', 'empty.md'), '# 还没写数据块');

  const contracts = await loadContracts(root);
  assert.deepEqual(contracts.map((c) => c.file), [
    'docs/contracts/device-api.md', 'docs/contracts/empty.md',
  ]);
  const [device, empty] = contracts;
  assert.equal(device.module, 'device');
  assert.equal(device.apis.length, 2);
  assert.equal(device.apis[0].method, 'GET');
  assert.deepEqual(device.apis[0].request[0], { name: 'pageNum', type: 'number', required: true });
  assert.deepEqual(device.apis[0].errors[0], { code: 40001, msg: '参数校验失败' });
  // 无数据块的文件返回空条目，供校验规则报告
  assert.deepEqual(empty, { file: 'docs/contracts/empty.md', module: null, apis: [] });
});

test('loadContracts：docs/contracts 缺失返回空数组', async (t) => {
  const root = await tempRoot(t);
  assert.deepEqual(await loadContracts(root), []);
});

test('apiKey：method 统一大写拼 path', () => {
  assert.equal(apiKey({ method: 'get', path: '/api/device/list' }), 'GET /api/device/list');
  assert.equal(apiKey({ method: 'POST', path: '/api/device' }), 'POST /api/device');
});

// ---------------------------------------------------------------------------
// lib/model/manifest.mjs
// ---------------------------------------------------------------------------

test('manifest：缺文件返回 null，读写往返一致', async (t) => {
  const root = await tempRoot(t);
  assert.equal(await loadManifest(root), null);
  const m = {
    schemaVersion: '1',
    vimaVersion: '2.0.0',
    templateId: 'admin',
    initializedAt: '2026-08-12T10:00:00Z',
    createdAt: '2026-08-12T10:00:00Z',
    files: {
      managed: [{ path: '.claude/commands/go.md', checksum: 'sha256:abc' }],
      userOwned: ['CLAUDE.md', 'docs/spec.md'],
    },
  };
  await saveManifest(root, m);
  assert.deepEqual(await loadManifest(root), m);
});

// ---------------------------------------------------------------------------
// lib/model/template.mjs
// ---------------------------------------------------------------------------

async function makeCliRoot(t) {
  const cliRoot = await mkdtemp(path.join(tmpdir(), 'vima-cli-root-'));
  t.after(() => rm(cliRoot, { recursive: true, force: true }));
  const write = async (id, json) => {
    await mkdir(path.join(cliRoot, 'templates', id), { recursive: true });
    await writeFile(path.join(cliRoot, 'templates', id, 'template.json'), JSON.stringify(json));
  };
  await write('h5', { id: 'h5', name: 'H5 应用', status: 'preview', description: '移动端' });
  await write('admin', { id: 'admin', name: '管理后台', status: 'stable', description: '中后台', version: '2.0.0' });
  return cliRoot;
}

test('templatesRoot / listTemplates：按 id 排序', async (t) => {
  const cliRoot = await makeCliRoot(t);
  assert.equal(templatesRoot(cliRoot), path.join(cliRoot, 'templates'));
  const list = await listTemplates(cliRoot);
  assert.deepEqual(list, [
    { id: 'admin', name: '管理后台', status: 'stable', description: '中后台' },
    { id: 'h5', name: 'H5 应用', status: 'preview', description: '移动端' },
  ]);
});

test('listTemplates：templates 目录缺失返回空数组', async (t) => {
  const empty = await mkdtemp(path.join(tmpdir(), 'vima-noroot-'));
  t.after(() => rm(empty, { recursive: true, force: true }));
  assert.deepEqual(await listTemplates(empty), []);
});

test('loadTemplate：返回 template.json 内容 + dir；未知 id 抛 NO_TEMPLATE（exit 3）', async (t) => {
  const cliRoot = await makeCliRoot(t);
  const tpl = await loadTemplate(cliRoot, 'admin');
  assert.equal(tpl.name, '管理后台');
  assert.equal(tpl.version, '2.0.0');
  assert.equal(tpl.dir, path.join(cliRoot, 'templates', 'admin'));
  await expectVimaError(() => loadTemplate(cliRoot, 'nope'), {
    code: 'NO_TEMPLATE', exitCode: EXIT.USAGE,
  });
});

test('readProjectTemplateId：manifest 优先于 lifecycle，双缺返回 null', async (t) => {
  // 1) 双缺 → null
  const bare = await tempRoot(t);
  assert.equal(await readProjectTemplateId(bare), null);
  // 2) 仅 lifecycle → lifecycle.templateId
  const lcOnly = await tempRoot(t);
  await saveLifecycle(lcOnly, defaultLifecycle('h5'));
  assert.equal(await readProjectTemplateId(lcOnly), 'h5');
  // 3) manifest 存在时优先
  await saveManifest(lcOnly, { schemaVersion: '1', templateId: 'admin' });
  assert.equal(await readProjectTemplateId(lcOnly), 'admin');
});

// ── lib/model/apps.mjs（A16 端册，契约 §5）──────────────────────────────────

test('resolveApps：manifest v2 端册原样归一返回（multi/缺省补齐）', async (t) => {
  const root = await tempRoot(t);
  await saveManifest(root, {
    schemaVersion: '2', templateId: 'nope-template',
    apps: [
      { id: 'admin', name: '院内后台', kind: 'admin-web', dir: 'apps/admin', codeDir: 'src',
        sharedDirs: ['src/components', 'src/utils', 'vendor'] },
      { id: 'patient', kind: 'mp-native', dir: 'apps/patient' }, // name/codeDir/sharedDirs 缺省
    ],
    backend: { dir: 'backend', sharedDirs: ['src/main/java/com/x/config'] },
  });
  const roster = await resolveApps(root, {});
  assert.equal(roster.multi, true);
  assert.equal(roster.apps.length, 2);
  assert.deepEqual(roster.apps[1], {
    id: 'patient', name: 'patient', kind: 'mp-native', dir: 'apps/patient', codeDir: 'src', sharedDirs: [],
  });
  assert.deepEqual(roster.backend, { dir: 'backend', sharedDirs: ['src/main/java/com/x/config'] });
  // templateId 指向不存在的模板 → 静默用内置 kinds（防误不防恶意）
  assert.ok(roster.kinds['admin-web']);
  assert.equal(roster.kinds['admin-web'].regions, true);
});

test('resolveApps：拒绝绝对路径与逃逸项目根的端册路径', async (t) => {
  const root = await tempRoot(t);
  await saveManifest(root, {
    schemaVersion: '2.0',
    templateId: 'admin',
    apps: [{ id: 'admin', kind: 'admin-web', dir: '../outside', codeDir: 'src', sharedDirs: [] }],
    backend: { dir: '/tmp/backend', sharedDirs: [] },
  });
  await expectVimaError(() => resolveApps(root), {
    code: 'APP_PATH', exitCode: EXIT.CHECK_FAILED, messageRe: /\.\.\/outside/,
  });
});

test('resolveApps：v1 manifest + 旧三键模板 → 合成单端 admin 端册', async (t) => {
  const root = await tempRoot(t);
  const cliRoot = await mkdtemp(path.join(tmpdir(), 'vima-cli-root-'));
  t.after(() => rm(cliRoot, { recursive: true, force: true }));
  await mkdir(path.join(cliRoot, 'templates', 'admin'), { recursive: true });
  await writeFile(path.join(cliRoot, 'templates', 'admin', 'template.json'), JSON.stringify({
    id: 'admin', name: '管理后台', status: 'stable',
    codeDirs: ['src', 'backend/src'],
    sharedDirs: ['src/components', 'src/utils', 'vendor', 'backend/src/main/java/com/{{projectPkg}}/config'],
  }));
  await saveManifest(root, { schemaVersion: '1', templateId: 'admin' });
  const roster = await resolveApps(root, { cliRoot });
  assert.equal(roster.multi, false);
  assert.deepEqual(roster.apps, [{
    id: 'admin', name: '管理后台', kind: 'admin-web', dir: '.', codeDir: 'src',
    sharedDirs: ['src/components', 'src/utils', 'vendor'],
  }]);
  assert.deepEqual(roster.backend, { dir: 'backend', sharedDirs: [] });
});

test('resolveApps：新形态模板（apps 声明）合成 default 端；kinds 被模板覆盖合并', async (t) => {
  const root = await tempRoot(t);
  const cliRoot = await mkdtemp(path.join(tmpdir(), 'vima-cli-root-'));
  t.after(() => rm(cliRoot, { recursive: true, force: true }));
  await mkdir(path.join(cliRoot, 'templates', 'admin'), { recursive: true });
  await writeFile(path.join(cliRoot, 'templates', 'admin', 'template.json'), JSON.stringify({
    id: 'admin', name: '管理后台', status: 'stable',
    apps: [
      { id: 'admin', name: '管理后台', kind: 'admin-web', default: true,
        scaffold: 'scaffold/frontend', codeDir: 'src', sharedDirs: ['src/components'] },
      { id: 'patient', name: '患者端', kind: 'mp-native', scaffold: 'scaffold/mp-native' },
    ],
    backend: { scaffold: 'scaffold/backend', dir: 'backend' },
    planning: { kinds: { 'mp-native': { layoutVocab: ['list'], regions: false, shell: 'phone-tabbar', status: 'preview' } } },
  }));
  await saveManifest(root, { schemaVersion: '1', templateId: 'admin' });
  const roster = await resolveApps(root, { cliRoot });
  assert.equal(roster.multi, false);
  assert.equal(roster.apps.length, 1); // 只合成 default 端
  assert.equal(roster.apps[0].id, 'admin');
  assert.equal(roster.apps[0].dir, '.');
  assert.deepEqual(roster.kinds['mp-native'].layoutVocab, ['list']);
  assert.ok(roster.kinds['admin-web']); // 内置缺省仍在
});

test('resolveApps：非 vima 项目 / 无前端模板 → 空端册', async (t) => {
  const bare = await tempRoot(t);
  const roster = await resolveApps(bare, {});
  assert.deepEqual(roster, { multi: false, apps: [], backend: null, kinds: roster.kinds });
  assert.equal(roster.apps.length, 0);
});

test('appOf / consumersOf：声明优先；单端缺省 = 唯一端；多端缺省 = null', () => {
  const single = { multi: false, apps: [{ id: 'admin' }], backend: null, kinds: {} };
  const multi = { multi: true, apps: [{ id: 'admin' }, { id: 'patient' }], backend: null, kinds: {} };
  assert.equal(appOf({ app: 'patient' }, single), 'patient'); // 声明原样返回（合法性归校验）
  assert.equal(appOf({}, single), 'admin');
  assert.equal(appOf({}, multi), null);
  assert.deepEqual(consumersOf({ consumers: ['patient'] }, multi), ['patient']);
  assert.deepEqual(consumersOf({}, single), ['admin']);
  assert.equal(consumersOf({}, multi), null);
});

// ── lib/model/journal.mjs（A36 过程轨迹归集器；抽自 retro.mjs）────────────────

test('journal.tally：按 key 聚数，空/null key 跳过', () => {
  assert.deepEqual(tally([{ r: 'V-A' }, { r: 'V-A' }, { r: 'V-B' }], (x) => x.r), { 'V-A': 2, 'V-B': 1 });
  assert.deepEqual(tally([{ r: null }, { r: '' }, {}], (x) => x.r), {});
});

test('journal.readJsonSafe：坏文件与缺文件一律 null（不抛）', async (t) => {
  const root = await tempRoot(t);
  assert.equal(await readJsonSafe(path.join(root, 'nope.json')), null);
  await writeFile(path.join(root, 'bad.json'), '{ not json');
  assert.equal(await readJsonSafe(path.join(root, 'bad.json')), null);
  await writeFile(path.join(root, 'ok.json'), '{"a":1}');
  assert.deepEqual(await readJsonSafe(path.join(root, 'ok.json')), { a: 1 });
});

test('journal.phaseDurations：两端齐全才算天数，缺一端 → null（不读系统时钟）', () => {
  const out = phaseDurations({
    phaseHistory: [
      { phase: 'PLANNING', enteredAt: '2026-08-01T00:00:00.000Z', completedAt: '2026-08-03T12:00:00.000Z' },
      { phase: 'DEVELOPING', enteredAt: '2026-08-03T12:00:00.000Z', completedAt: null },
    ],
  });
  assert.deepEqual(out, [{ phase: 'PLANNING', days: 2.5 }, { phase: 'DEVELOPING', days: null }]);
  assert.deepEqual(phaseDurations(null), []);
  assert.deepEqual(phaseDurations({}), []);
});

test('journal.collectReports：报告目录缺失 → 全零对象，不抛', async (t) => {
  const root = await tempRoot(t);
  const agg = await collectReports(root);
  assert.equal(agg.verification.reports, 0);
  assert.equal(agg.runtime.errors, 0);
  assert.equal(agg.batches.count, 0);
  assert.deepEqual(agg.planning.ruleHits, {});
  for (const r of V_INT_RULES) assert.equal(agg.convergence[r], 0, `${r} 归零`);
});

test('journal.collectReports：verifier 点位分类（未过/豁免/NG 越界）与坏报告跳过', async (t) => {
  const root = await tempRoot(t);
  const dir = path.join(root, '.vima', 'reports');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'a-verifier.json'), JSON.stringify({
    taskId: 'a',
    round: 2,
    points: [
      { point: '按钮：保存', passed: true },
      { point: '字段：手机号', passed: false },
      { point: '字段：备注', passed: false, waived: true },
      { point: 'NG-01 越界：导出报表', passed: false },
    ],
  }));
  await writeFile(path.join(dir, 'b-verifier.json'), '{ 坏报告');
  await writeFile(path.join(dir, 'c-builder.json'), JSON.stringify({ sharedChangeRequest: '需加公共分页组件' }));
  await writeFile(path.join(dir, 'runtime-errors.jsonl'), '{"m":"1"}\n\n{"m":"2"}\n');

  const agg = await collectReports(root);
  assert.equal(agg.verification.reports, 1, '坏报告不计入（跳过而非崩）');
  assert.equal(agg.verification.maxRound, 2);
  assert.equal(agg.verification.points, 4);
  assert.equal(agg.verification.failedPoints, 2, '未过 = 手机号 + NG 越界（NG 不算豁免）');
  assert.equal(agg.verification.waived, 1);
  assert.equal(agg.verification.ngViolations, 1);
  assert.equal(agg.shared.changeRequests, 1);
  assert.equal(agg.runtime.errors, 2, 'jsonl 空行不计');
});

test('journal.collectReports：convergence / batch-plan / planning-validation 三源聚合', async (t) => {
  const root = await tempRoot(t);
  const dir = path.join(root, '.vima', 'reports');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'convergence.json'), JSON.stringify({
    findings: [{ rule: 'V-INT-02' }, { rule: 'V-INT-02' }, { rule: 'V-INT-03' }, { rule: 'V-NOPE' }],
    summary: { openPoints: 3, unmarkedDone: 1 },
  }));
  await writeFile(path.join(dir, 'batch-plan.json'), JSON.stringify({
    maxParallel: 8,
    batches: [
      { layer: 'shared', level: 0, tasks: ['s1'] },
      { layer: 'business', level: 1, tasks: ['b1', 'b2'] },
    ],
  }));
  await writeFile(path.join(dir, 'planning-validation.json'), JSON.stringify({
    errors: [{ rule: 'V-SPEC-04' }, { rule: 'V-SPEC-04' }],
    warnings: [{ rule: 'V-TASK-07' }],
    pendingConfirm: [{ where: 'PAGE-01' }],
  }));

  const agg = await collectReports(root);
  assert.equal(agg.convergence['V-INT-02'], 2);
  assert.equal(agg.convergence['V-INT-03'], 1);
  assert.equal(agg.convergence['V-INT-01'], 0, '未命中的规则仍在且为 0');
  assert.equal(agg.convergence.openPoints, 3);
  assert.equal(agg.convergence.unmarkedDone, 1);
  assert.deepEqual(agg.batches, { count: 2, maxParallel: 8, sizes: [1, 2], levels: 2 });
  assert.deepEqual(agg.planning.ruleHits, { 'V-SPEC-04': 2, 'V-TASK-07': 1 });
  assert.equal(agg.planning.pendingConfirm, 1);
});
