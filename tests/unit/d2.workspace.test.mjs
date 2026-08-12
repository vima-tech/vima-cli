// D2 单测：workspace 文字资产与模板配置的防漂移断言（契约 §13）
// 动机（差距评估结论）：A3 验收判据曾因 go.md 用词漂移而 2/3 失配却无测试报警；
// guard-shared 的保护面与 template.json sharedDirs 曾三处口径不一。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ADMIN = path.join(CLI_ROOT, 'templates', 'admin');

test('A3 冷读门：go.md 满足三条验收 grep 判据（v2.1-amendments A3）', async () => {
  const goMd = await readFile(path.join(ADMIN, 'workspace/commands/go.md'), 'utf8');
  assert.ok(goMd.includes('深度校验'), 'go.md 须含触发词「深度校验」');
  assert.ok(
    goMd.includes('只读 docs/spec.md 与 docs/contracts'),
    '零知识约束「只读 spec+契约」须单行可 grep（不得断行）',
  );
  assert.ok(goMd.includes('pendingConfirm'), '可推断项裁定分支须标 pendingConfirm');
});

test('guard-shared.mjs 保护面与 template.json sharedDirs 逐项同步（契约 §6.3 单一真源）', async () => {
  const guard = await readFile(path.join(ADMIN, 'workspace/hooks/guard-shared.mjs'), 'utf8');
  const tpl = JSON.parse(await readFile(path.join(ADMIN, 'template.json'), 'utf8'));
  const fe = /const frontendShared = \[([^\]]*)\]/.exec(guard);
  const be = /const backendShared = \[([^\]]*)\]/.exec(guard);
  assert.ok(fe && be, 'guard 脚本须含 frontendShared/backendShared 数组字面量');
  const parse = (m) =>
    m[1]
      .split(',')
      .map((x) => x.trim().replace(/^"(.*)"$/, '$1'))
      .filter(Boolean);
  const guardFe = parse(fe).map((d) => d.replace(/\/$/, ''));
  const guardBe = parse(be).map((d) => d.replaceAll('/', ''));
  const shared = tpl.sharedDirs ?? [];
  const sharedFe = shared.filter((d) => !d.startsWith('backend/'));
  const sharedBe = shared.filter((d) => d.startsWith('backend/')).map((d) => d.split('/').at(-1));
  assert.deepEqual([...guardFe].sort(), [...sharedFe].sort(), '前端保护面必须与 sharedDirs 一致');
  assert.deepEqual([...guardBe].sort(), [...sharedBe].sort(), '后端保护面必须与 sharedDirs 一致');
});

test('红线文案与 sharedDirs 同步：CLAUDE.project.md 与 vima-builder.md 覆盖全部前端共享目录', async () => {
  const tpl = JSON.parse(await readFile(path.join(ADMIN, 'template.json'), 'utf8'));
  const sharedFe = (tpl.sharedDirs ?? []).filter((d) => !d.startsWith('backend/'));
  for (const rel of ['workspace/CLAUDE.project.md', 'workspace/agents/vima-builder.md', 'workspace/AGENTS.project.md']) {
    const text = await readFile(path.join(ADMIN, rel), 'utf8');
    for (const dir of sharedFe) {
      assert.ok(text.includes(`${dir}/`), `${rel} 红线文案缺少共享目录 ${dir}/`);
    }
  }
});

test('全部模板 status ∈ {stable, preview} 且 admin=stable（A5 自洽）', async () => {
  const dir = path.join(CLI_ROOT, 'templates');
  const ids = (await readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  assert.ok(ids.length >= 5, `模板数异常: ${ids.join(',')}`);
  for (const id of ids) {
    const tpl = JSON.parse(await readFile(path.join(dir, id, 'template.json'), 'utf8'));
    assert.ok(['stable', 'preview'].includes(tpl.status), `模板 ${id} 的 status 非法: "${tpl.status}"`);
  }
  const admin = JSON.parse(await readFile(path.join(ADMIN, 'template.json'), 'utf8'));
  assert.equal(admin.status, 'stable');
});

test('coding-standards 资产存在、被 planning 声明，CLAUDE.project.md 指针不悬空（§5.2）', async () => {
  const tpl = JSON.parse(await readFile(path.join(ADMIN, 'template.json'), 'utf8'));
  assert.equal(tpl.planning.codingStandards, 'planning/coding-standards.md');
  const text = await readFile(path.join(ADMIN, tpl.planning.codingStandards), 'utf8');
  assert.match(text, /编码规范/);
  const claude = await readFile(path.join(ADMIN, 'workspace/CLAUDE.project.md'), 'utf8');
  assert.ok(claude.includes('docs/coding-standards.md'), 'CLAUDE.project.md 的详细规范指针应指向已安装资产');
});

// ── post-write.mjs 区块标记机械对账 + A6 机检（§13.3 hook 半，契约 §14）──

const HOOK = path.join(ADMIN, 'workspace/hooks/post-write.mjs');

async function markerProject(t, manifest) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-d2-marker-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src/views'), { recursive: true });
  if (manifest) {
    await mkdir(path.join(root, 'docs/review'), { recursive: true });
    await writeFile(path.join(root, 'docs/review/prototype.manifest.json'), JSON.stringify(manifest));
  }
  return root;
}

function runHook(root, relFile) {
  const input = JSON.stringify({ cwd: root, tool_input: { file_path: relFile } });
  return spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8' });
}

const MANIFEST = { pages: [{ id: 'PAGE-01', layout: ['search', 'table'], modals: [{ id: 'MODAL-01' }] }] };

test('区块标记对账：标记齐全 → 放行；缺区块/缺弹窗 → exit 2 且指名', async (t) => {
  const root = await markerProject(t, MANIFEST);
  await writeFile(path.join(root, 'src/views/ok.vue'),
    '<template><div class="vui-page" data-page="PAGE-01"><div data-block="search"/><div data-block="table"/><M data-modal="MODAL-01"/></div></template>');
  assert.equal(runHook(root, 'src/views/ok.vue').status, 0);

  await writeFile(path.join(root, 'src/views/miss.vue'),
    '<template><div class="vui-page" data-page="PAGE-01"><div data-block="search"/></div></template>');
  const r = runHook(root, 'src/views/miss.vue');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /data-block：table/);
  assert.match(r.stderr, /data-modal：MODAL-01/);
});

test('区块标记对账：设计外区块 / 未知页面 → exit 2；无 data-page 或无 manifest → 跳过', async (t) => {
  const root = await markerProject(t, MANIFEST);
  await writeFile(path.join(root, 'src/views/extra.vue'),
    '<template><div class="vui-page" data-page="PAGE-01"><div data-block="search"/><div data-block="table"/><div data-block="cards"/><M data-modal="MODAL-01"/></div></template>');
  const r1 = runHook(root, 'src/views/extra.vue');
  assert.equal(r1.status, 2);
  assert.match(r1.stderr, /设计外区块.*cards/);

  await writeFile(path.join(root, 'src/views/ghost.vue'), '<template><div class="vui-page" data-page="PAGE-99"/></template>');
  const r2 = runHook(root, 'src/views/ghost.vue');
  assert.equal(r2.status, 2);
  assert.match(r2.stderr, /无此页面/);

  await writeFile(path.join(root, 'src/views/part.vue'), '<template><div class="x"/></template>');
  assert.equal(runHook(root, 'src/views/part.vue').status, 0, '无 data-page 的普通组件不参与对账');

  const bare = await markerProject(t, null);
  await writeFile(path.join(bare, 'src/views/a.vue'),
    '<template><div class="vui-page" data-page="PAGE-01"><div data-block="search"/></div></template>');
  assert.equal(runHook(bare, 'src/views/a.vue').status, 0, 'manifest 未渲染时静默跳过');
});

// ── A6 机检扩展（规范执行者阶梯：post-write 新增检查，契约 §14）──

test('A6 机检：幻包名导入 / 缺 vui-page / 字面量色值 / 操作列手写 width → exit 2 且逐项指名', async (t) => {
  const root = await markerProject(t, MANIFEST);

  await writeFile(path.join(root, 'src/views/bad-import.ts'), "import { layer } from '@vima/ui'\n");
  const r0 = runHook(root, 'src/views/bad-import.ts');
  assert.equal(r0.status, 2);
  assert.match(r0.stderr, /@vima\/ui/);

  await writeFile(path.join(root, 'src/views/bad-page.vue'), [
    '<template><div data-page="PAGE-01"><div data-block="search"/><div data-block="table"/><M data-modal="MODAL-01"/></div></template>',
    '<script setup lang="ts">',
    "const columns = [{ title: '操作', key: 'operator', width: 230, customSlot: 'operator' }]",
    '</script>',
    '<style scoped>.a { color: #ff0000; }</style>',
  ].join('\n'));
  const r1 = runHook(root, 'src/views/bad-page.vue');
  assert.equal(r1.status, 2);
  assert.match(r1.stderr, /vui-page/);
  assert.match(r1.stderr, /字面量色值/);
  assert.match(r1.stderr, /操作列手写了字面量 width/);
});

test('A6 机检：合规业务页放行（--x 定义行豁免 + 操作列无 width + 「操作时间」定宽列不误伤）；杜撰图标名拦截', async (t) => {
  const root = await markerProject(t, MANIFEST);
  await mkdir(path.join(root, 'vendor/vima-ui-admin/dist'), { recursive: true });
  await writeFile(
    path.join(root, 'vendor/vima-ui-admin/dist/ai-manifest.json'),
    JSON.stringify({ icons: [{ name: 'alert', aliases: ['warning'] }, 'search'] }),
  );

  const good = [
    '<template><div class="vui-page" data-page="PAGE-01"><div data-block="search"><VIcon name="search" /></div><div data-block="table"/><M data-modal="MODAL-01"/></div></template>',
    '<script setup lang="ts">',
    'const columns = [',
    "  { key: 'operTime', title: '操作时间', width: 170 },",
    "  { title: '操作', key: 'operator', customSlot: 'operator' },",
    ']',
    '</script>',
    '<style scoped>.p { --local-accent: #ff0000; color: var(--local-accent); border-color: var(--v-border); }</style>',
  ].join('\n');
  await writeFile(path.join(root, 'src/views/good.vue'), good);
  const rOk = runHook(root, 'src/views/good.vue');
  assert.equal(rOk.status, 0, rOk.stderr);

  await writeFile(path.join(root, 'src/views/bad-icon.vue'), good.replace('name="search"', 'name="ghost-icon"'));
  const rBad = runHook(root, 'src/views/bad-icon.vue');
  assert.equal(rBad.status, 2);
  assert.match(rBad.stderr, /ghost-icon/);
  assert.match(rBad.stderr, /近似候选：/, 'A8：拦截时须按编辑距离给近似候选');
});

test('任务点台账三件套的文字资产落位（B1/B2，契约 §6.9）', async () => {
  const verifier = await readFile(path.join(ADMIN, 'workspace/agents/vima-verifier.md'), 'utf8');
  assert.ok(verifier.includes('"points"'), 'verifier 报告格式须含 points 字段');
  assert.ok(verifier.includes('逐点展开'), 'verifier 须要求把 manifest 页条目逐点展开');
  assert.ok(verifier.includes('不得把整页折叠成一条结论'), '禁止整页折叠');
  const check = await readFile(path.join(ADMIN, 'workspace/commands/check.md'), 'utf8');
  assert.ok(check.includes('任务点完成度'), '/check 须含任务点完成度信号');
  assert.ok(check.includes('verifier.json'), '/check 须从 verifier 报告聚合');
});

test('waived 豁免语义的文字资产落位（A8，契约 §6.9）', async () => {
  const verifier = await readFile(path.join(ADMIN, 'workspace/agents/vima-verifier.md'), 'utf8');
  assert.ok(verifier.includes('waived'), 'verifier 报告格式须含 waived 字段');
  assert.ok(verifier.includes('不得自行发明豁免'), '豁免必须来自用户裁定');
  assert.ok(verifier.includes('reason'), '豁免必须带 reason');
  const check = await readFile(path.join(ADMIN, 'workspace/commands/check.md'), 'utf8');
  assert.ok(check.includes('豁免'), '/check 须按 通过/豁免/未过 三分计数');
});

test('vima context 集成的文字资产落位（A8）：go.md 派发前打包、builder 第一必读', async () => {
  const goMd = await readFile(path.join(ADMIN, 'workspace/commands/go.md'), 'utf8');
  assert.ok(goMd.includes('vima context'), 'go.md 派发批次前须运行 vima context');
  const builder = await readFile(path.join(ADMIN, 'workspace/agents/vima-builder.md'), 'utf8');
  assert.ok(builder.includes('.vima/context/'), 'builder 须以上下文包为第一必读');
});
