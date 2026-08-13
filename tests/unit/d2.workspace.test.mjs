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

test('A17 批间连续性：go.md 预算任务计数 + 提交授权 + 合法停点（v2.1-amendments A17）', async () => {
  const goMd = await readFile(path.join(ADMIN, 'workspace/commands/go.md'), 'utf8');
  assert.ok(goMd.includes('最多推进 8 个任务'), '会话预算须按任务计数（8 任务/次）');
  assert.ok(
    !goMd.includes('3 个批次'),
    '批次计数口径须退役——串行批下按批计数会在 3 个任务后过早截断',
  );
  assert.ok(goMd.includes('明确授权'), '检查点提交须声明「用户输入 /go 即明确授权」');
  assert.ok(goMd.includes('不是停点'), '提交受阻不得中断调度（不是停点）');
  assert.ok(goMd.includes('合法停点'), '批间反停顿纪律须有合法停点白名单');
  const constitution = await readFile(path.join(ADMIN, 'workspace/CLAUDE.project.md'), 'utf8');
  assert.ok(constitution.includes('明确授权'), '宪法工作协议须同步提交授权口径');
  assert.ok(constitution.includes('合法停点'), '宪法工作协议须同步停点口径');
});

test('A9/A10/A11 吸收项满足验收 grep 判据（v2.1-amendments A9–A11，mattpocock 对标）', async () => {
  // A9 提问三规则：planning-guide §5 + vima-planner 镜像
  const guide = await readFile(path.join(ADMIN, 'planning/planning-guide.md'), 'utf8');
  for (const kw of ['先查后问', '推荐答案', '前置未定不问']) {
    assert.ok(guide.includes(kw), `planning-guide.md 须含提问规则「${kw}」`);
  }
  const planner = await readFile(path.join(ADMIN, 'workspace/agents/vima-planner.md'), 'utf8');
  assert.ok(planner.includes('推荐答案'), 'vima-planner.md 须镜像提问三规则（每问必附推荐答案）');

  // A10 同构断言禁令：coding-standards 后端节〔L5·verifier〕+ _template-be 步骤措辞
  const standards = await readFile(path.join(ADMIN, 'planning/coding-standards.md'), 'utf8');
  assert.ok(standards.includes('独立事实源'), 'coding-standards 须要求期望值来自独立事实源');
  assert.ok(standards.includes('同构'), 'coding-standards 须点名同构断言');
  const beTpl = await readFile(path.join(ADMIN, 'planning/_template-be.md'), 'utf8');
  assert.ok(beTpl.includes('独立事实源'), '_template-be 步骤 5 须提示期望值来源');

  // A11 红绿修复纪律：CLAUDE.project.md 工作协议
  const claude = await readFile(path.join(ADMIN, 'workspace/CLAUDE.project.md'), 'utf8');
  assert.ok(claude.includes('跑红'), 'CLAUDE.project.md 须要求先固化能跑红的命令');
  assert.ok(claude.includes('转绿'), 'CLAUDE.project.md 修复判定须为同一命令转绿');

  // A12 原型先行节拍：planning-guide §5 里程碑 2 逐模块「草→渲→看→定」
  assert.ok(guide.includes('草→渲→看→定'), 'planning-guide 须含 A12 节拍');
  assert.ok(guide.includes('在原型上看过并确认'), 'A12 页面对齐完成判据 = 用户在原型上看过并确认');
});

test('guard-shared.mjs 回退保护面与 template.json 端册 sharedDirs 逐项同步（契约 §6.3/A16 单一真源）', async () => {
  const guard = await readFile(path.join(ADMIN, 'workspace/hooks/guard-shared.mjs'), 'utf8');
  const tpl = JSON.parse(await readFile(path.join(ADMIN, 'template.json'), 'utf8'));
  const fe = /const frontendShared = \[([^\]]*)\]/.exec(guard);
  const be = /const backendShared = \[([^\]]*)\]/.exec(guard);
  assert.ok(fe && be, 'guard 脚本须含 frontendShared/backendShared 数组字面量（v1 manifest 回退面）');
  const parse = (m) =>
    m[1]
      .split(',')
      .map((x) => x.trim().replace(/^"(.*)"$/, '$1'))
      .filter(Boolean);
  const guardFe = parse(fe).map((d) => d.replace(/\/$/, ''));
  const guardBe = parse(be).map((d) => d.replaceAll('/', ''));
  // A16 新形态：guard 的 v1 回退字面量 = default 端（admin）的 sharedDirs + backend 末段
  const defaultApp = (tpl.apps ?? []).find((a) => a.default === true) ?? (tpl.apps ?? [])[0];
  const sharedFe = defaultApp?.sharedDirs ?? [];
  const sharedBe = (tpl.backend?.sharedDirs ?? []).map((d) => d.split('/').at(-1));
  assert.deepEqual([...guardFe].sort(), [...sharedFe].sort(), '前端回退保护面必须与端册 sharedDirs 一致');
  assert.deepEqual([...guardBe].sort(), [...sharedBe].sort(), '后端回退保护面必须与 backend.sharedDirs 一致');
});

test('红线文案与 sharedDirs 同步：CLAUDE.project.md 与 vima-builder.md 覆盖全部前端共享目录', async () => {
  const tpl = JSON.parse(await readFile(path.join(ADMIN, 'template.json'), 'utf8'));
  const defaultApp = (tpl.apps ?? []).find((a) => a.default === true) ?? (tpl.apps ?? [])[0];
  const sharedFe = defaultApp?.sharedDirs ?? [];
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

test('A13 规格边界机检：planning-guide 终点清单 H + vima-verifier 规则/越界纪律（v2.1-amendments A13）', async () => {
  const guide = await readFile(path.join(ADMIN, 'planning/planning-guide.md'), 'utf8');
  assert.ok(guide.includes('A–H'), '终点清单须扩为 A–H（新增本期不做）');
  assert.ok(guide.includes('vima:rules'), 'planning-guide 须要求业务规则写入 vima:rules 块');
  assert.ok(guide.includes('本期不做'), 'planning-guide 须含终点清单 H 本期不做');
  assert.ok(guide.includes('non-goals: []'), '须写明「确实没有也要显式写空数组」');

  const verifier = await readFile(path.join(ADMIN, 'workspace/agents/vima-verifier.md'), 'utf8');
  assert.ok(verifier.includes('RULE-'), 'vima-verifier 须逐条核对 RULE-xx');
  assert.ok(verifier.includes('本期不做'), 'vima-verifier 须做 non-goals 越界判定');
  assert.ok(verifier.includes('越界不适用 waived'), '越界不得走豁免（边界真源是 spec 而非对话）');

  // spec 骨架：第五章 rules 块 + 第九章 non-goals 块，且章标题纪律同步为九章
  const skeleton = await readFile(path.join(ADMIN, 'planning/spec.admin.md'), 'utf8');
  assert.ok(skeleton.includes('```yaml vima:rules'), 'spec 骨架第五章须预置 vima:rules 块');
  assert.ok(skeleton.includes('## 9. 本期不做'), 'spec 骨架须含第九章');
  assert.ok(skeleton.includes('```yaml vima:non-goals'), 'spec 骨架第九章须预置 vima:non-goals 块');
  assert.ok(skeleton.includes('九个章标题一字不改'), '骨架填充纪律须同步为九章');

  // checklist 逐条镜像新规则编号（契约 §8 的 D1 镜像纪律）
  const checklist = await readFile(path.join(ADMIN, 'planning/validate.checklist.md'), 'utf8');
  for (const rule of ['V-SPEC-09', 'V-SPEC-10', 'V-SPEC-11']) {
    assert.ok(checklist.includes(rule), `validate.checklist 须镜像 ${rule}`);
  }
  assert.ok(checklist.includes('## 9. 本期不做'), 'checklist 的 V-SPEC-01 章节表须同步为九章');
});

test('A13 消费端接线不漏：builder 包内分节枚举与 check 聚合口径同步（防半截实现）', async () => {
  const builder = await readFile(path.join(ADMIN, 'workspace/agents/vima-builder.md'), 'utf8');
  assert.ok(builder.includes('业务规则切片'), 'vima-builder 的上下文包分节枚举须含业务规则切片');
  assert.ok(builder.includes('本期不做'), 'vima-builder 的上下文包分节枚举须含本期不做');
  assert.ok(builder.includes('顺便也支持一下'), 'builder 须被明确告知越界红线');

  const check = await readFile(path.join(ADMIN, 'workspace/commands/check.md'), 'utf8');
  assert.ok(check.includes('RULE-'), '/check 聚合口径须覆盖规则点');
  assert.ok(check.includes('越界'), '/check 须单列越界项');
});

// ── A16 端册化 hooks：guard-shared 读 manifest 端册；post-write 多端归属 + 新形态对账 ──

const GUARD = path.join(ADMIN, 'workspace/hooks/guard-shared.mjs');

function runGuard(root, relFile) {
  const input = JSON.stringify({ cwd: root, tool_input: { file_path: relFile } });
  return spawnSync(process.execPath, [GUARD], { input, encoding: 'utf8' });
}

const MULTI_VIMA_MANIFEST = {
  schemaVersion: '2',
  templateId: 'admin',
  apps: [
    { id: 'admin', kind: 'admin-web', dir: '.', codeDir: 'src', sharedDirs: ['src/components', 'src/utils', 'vendor'] },
    { id: 'patient', kind: 'mp-native', dir: 'apps/patient', codeDir: 'src', sharedDirs: ['src/components', 'src/utils'] },
  ],
  backend: { dir: 'backend', sharedDirs: ['src/main/java/demo/config', 'src/main/java/demo/security'] },
};

test('guard-shared A16：端册面拦 apps/<id>/ 共享层；无令牌 exit 2、业务目录放行；v1 回退面仍拦 src/', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-d2-guard-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.vima'), { recursive: true });
  await writeFile(path.join(root, '.vima/manifest.json'), JSON.stringify(MULTI_VIMA_MANIFEST));
  // 患者端共享层无令牌 → 拦
  assert.equal(runGuard(root, 'apps/patient/src/components/Btn.ts').status, 2, '患者端共享层应被拦');
  // admin 端（根布局）共享层 → 拦；后端 security → 拦
  assert.equal(runGuard(root, 'src/utils/request.ts').status, 2);
  assert.equal(runGuard(root, 'backend/src/main/java/demo/security/Token.java').status, 2);
  // 业务目录 → 放行
  assert.equal(runGuard(root, 'apps/patient/src/pages/booking.ts').status, 0, '业务目录应放行');
  assert.equal(runGuard(root, 'src/views/list.vue').status, 0);
  // v1 manifest（无 apps）→ 回退字面量面
  await writeFile(path.join(root, '.vima/manifest.json'), JSON.stringify({ schemaVersion: '1', templateId: 'admin' }));
  assert.equal(runGuard(root, 'src/components/X.vue').status, 2, 'v1 回退面仍拦 src/components');
  assert.equal(runGuard(root, 'apps/patient/src/components/Btn.ts').status, 0, 'v1 面不认 apps/（诚实回退）');
});

test('post-write A16：apps/<id>/src 业务代码不逃逸机检；新形态 manifest 按端对账', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-d2-pw-multi-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'apps/patient/src/pages'), { recursive: true });
  await mkdir(path.join(root, '.vima'), { recursive: true });
  await mkdir(path.join(root, 'docs/review'), { recursive: true });
  await writeFile(path.join(root, '.vima/manifest.json'), JSON.stringify(MULTI_VIMA_MANIFEST));
  // 幻包名导入出现在患者端目录 → exit 2（端册化后机检面不失覆盖，A16 回测缺口②）
  await writeFile(path.join(root, 'apps/patient/src/pages/bad.ts'), "import { x } from '@vima/ui';\n");
  const r = runHook(root, 'apps/patient/src/pages/bad.ts');
  assert.equal(r.status, 2, `stderr: ${r.stderr}`);
  assert.match(r.stderr, /幻包名/);
  // 新形态 manifest（顶层 apps map）区块对账：缺 data-block → exit 2
  await writeFile(path.join(root, 'docs/review/prototype.manifest.json'), JSON.stringify({
    schemaVersion: '1',
    apps: { patient: { pages: [{ id: 'PAGE-11', layout: ['banner', 'form'], modals: [] }] } },
  }));
  await writeFile(path.join(root, 'apps/patient/src/pages/page11.vue'),
    '<template><div class="vui-page" data-page="PAGE-11"><div data-block="banner"/></div></template>');
  const r2 = runHook(root, 'apps/patient/src/pages/page11.vue');
  assert.equal(r2.status, 2);
  assert.match(r2.stderr, /缺区块标记 data-block：form/);
  // 标记齐全 → 放行
  await writeFile(path.join(root, 'apps/patient/src/pages/page11.vue'),
    '<template><div class="vui-page" data-page="PAGE-11"><div data-block="banner"/><div data-block="form"/></div></template>');
  assert.equal(runHook(root, 'apps/patient/src/pages/page11.vue').status, 0);
});
