// C4 渲染层单测：render-journal 过程轨迹视图（A36，契约 §11.1）
// 覆盖：exit 0 / 字节确定性 / 零外部请求 / 无 --check（usage exit 3）/ 运行态如实呈现 /
//       缺数据不崩（PLANNING 期）/ 产物落 .vima/reports 而非 docs/review / 不写回 lifecycle。
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');
const OUT_REL = path.join('.vima', 'reports', 'journal.html');

function vima(cwd, ...args) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
}

let root;

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'vima-c4j-'));
  await cp(GOLDEN, root, { recursive: true });
});

test('render-journal：黄金夹具渲染 exit 0，产物落 .vima/reports/（不落 docs/review/）', async () => {
  const r = vima(root, 'render-journal');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  const html = await readFile(path.join(root, OUT_REL), 'utf8');
  assert.ok(html.includes('过程轨迹'), '标题含「过程轨迹」');
  assert.ok(html.includes('阶段时间线'), '含区①');
  assert.ok(html.includes('任务台账'), '含区②');
  assert.ok(html.includes('集成对账'), '含区④');
  assert.ok(html.endsWith('\n') && !html.endsWith('\n\n'), '末尾单个换行');
  // A36 落点：产物不得落进版本控制目录 docs/review/
  await assert.rejects(
    () => readFile(path.join(root, 'docs', 'review', 'journal.html'), 'utf8'),
    '产物不得落 docs/review/（该目录进版本控制，数据源却被 gitignore）',
  );
});

test('字节确定性：同一输入渲染两遍逐字节一致（渲染器不读系统时钟）', async () => {
  const first = await readFile(path.join(root, OUT_REL));
  const r = vima(root, 'render-journal');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.ok(first.equals(await readFile(path.join(root, OUT_REL))), '过程轨迹视图字节一致');
});

test('单文件零外部请求：href 仅 # 锚点，无 src/http', async () => {
  const html = await readFile(path.join(root, OUT_REL), 'utf8');
  assert.equal((html.match(/src=/g) ?? []).length, 0, '无任何 src=');
  assert.equal((html.match(/href="http/g) ?? []).length, 0, '无 http 外链');
  for (const m of html.match(/href="[^"]*"/g) ?? []) {
    assert.ok(m.startsWith('href="#'), `href 必须是锚点，实际：${m}`);
  }
  assert.equal((html.match(/<script/g) ?? []).length, 0, '禁 JS：不得含 <script>');
});

test('不接任何选项：--check / --output / 位置参数一律 usage exit 3，不静默忽略', () => {
  // --check：过程数据每次推进都变，漂移机检必恒红（契约 §11.1 D-A36-01 第 3 行）
  // --output：改写落点等于给「把每次都变的产物写进版本控制」开口子（防过度设计红线③）
  for (const bad of [['--check'], ['--output', 'docs/journal.html'], ['extra-arg']]) {
    const r = vima(root, 'render-journal', ...bad);
    assert.equal(r.status, 3, `${bad.join(' ')} 应为 usage exit 3，实际 ${r.status}；stderr: ${r.stderr}`);
    assert.match(r.stderr, /USAGE/, `${bad.join(' ')} 应走 USAGE 通道`);
  }
});

test('运行态如实呈现：status / retryCount / updatedAt 三项进产物（与 D-A33-01 的分工）', async () => {
  // 造一个重试过且 failed 的任务——它必须出现在任务台账里
  const taskPath = path.join(root, 'docs', 'tasks', 'zz-journal-probe.md');
  await writeFile(taskPath, [
    '---',
    'taskId: zz-journal-probe',
    'title: 过程轨迹探针任务',
    'status: failed',
    'layer: business',
    'side: frontend',
    'dependsOn: []',
    'retryCount: 2',
    'updatedAt: "2026-08-15T03:04:05.000Z"',
    '---',
    '',
    '# 探针',
    '',
  ].join('\n'));
  const r = vima(root, 'render-journal');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  const html = await readFile(path.join(root, OUT_REL), 'utf8');
  assert.ok(html.includes('zz-journal-probe'), '任务 id 出现在台账');
  assert.ok(html.includes('failed'), 'status 出现');
  assert.ok(html.includes('2026-08-15T03:04:05.000Z'), 'updatedAt 原样出现（时间戳取自输入，非系统时钟）');
  await rm(taskPath);
});

test('不写回 lifecycle 任何 checklist 键（只读视图不得有闸门语义）', async () => {
  const lcPath = path.join(root, 'docs', 'lifecycle.json');
  const before = await readFile(lcPath, 'utf8');
  const r = vima(root, 'render-journal');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.equal(await readFile(lcPath, 'utf8'), before, 'lifecycle.json 逐字节未变');
});

test('缺数据不崩：无 .vima/reports、无 docs/tasks 时仍 exit 0 并如实标注（判据 5）', async () => {
  const bare = await mkdtemp(path.join(tmpdir(), 'vima-c4j-bare-'));
  await cp(GOLDEN, bare, { recursive: true });
  await rm(path.join(bare, '.vima'), { recursive: true, force: true });
  await rm(path.join(bare, 'docs', 'tasks'), { recursive: true, force: true });

  const r = vima(bare, 'render-journal');
  assert.equal(r.status, 0, `PLANNING 期空项目应 exit 0，实际 ${r.status}；stderr: ${r.stderr}`);
  const html = await readFile(path.join(bare, OUT_REL), 'utf8');
  // loadTasks 对缺目录返回 []（确实零任务），与 null（不可解析）是两种不同事实，分别标注
  assert.ok(html.includes('尚无任务'), '零任务如实标注，而不是渲染空表头');
  assert.ok(html.includes('尚未运行 vima trace'), 'trace 缺席如实标注');
  assert.ok(html.includes('尚无阶段记录') === false, 'lifecycle 仍在，阶段区应有内容');
  await rm(bare, { recursive: true, force: true });
});

test('无 templateId：干净报错 NO_TEMPLATE_ID exit 4，不崩栈（与 render 家族同口径）', async () => {
  const noTpl = await mkdtemp(path.join(tmpdir(), 'vima-c4j-notpl-'));
  await cp(GOLDEN, noTpl, { recursive: true });
  // .vima/ 存在 → 通过 CLI 的项目根守卫；但无 manifest 且无 lifecycle → templateId 无源。
  // （两者皆无时先触发 NOT_IN_PROJECT，那是顶层守卫的职责，不是本命令的）
  await mkdir(path.join(noTpl, '.vima'), { recursive: true });
  await rm(path.join(noTpl, 'docs', 'lifecycle.json'), { force: true });
  const r = vima(noTpl, 'render-journal');
  assert.equal(r.status, 4, `应为 precondition exit 4，实际 ${r.status}；stderr: ${r.stderr}`);
  assert.match(r.stderr, /NO_TEMPLATE_ID/, '走 VimaError 稳定错误通道');
  assert.doesNotMatch(r.stderr, /at .*\.mjs:\d+/, '不得抛出未捕获栈');
  await rm(noTpl, { recursive: true, force: true });
});

test('trace.json 字段名对齐真 schema：markers / wildTaskIds / doneWithoutMarker 三项都进产物', async () => {
  // 防静默失效：字段名写错时本区会空白而不报错，故用真实 schema 的夹具守住
  const dir = path.join(root, '.vima', 'reports');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'trace.json'), JSON.stringify({
    schemaVersion: '1',
    markers: [],
    wild: [],
    unmarked: [],
    summary: { markers: 7, wildTaskIds: 2, doneWithoutMarker: 3 },
  }));
  const r = vima(root, 'render-journal');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  const html = await readFile(path.join(root, OUT_REL), 'utf8');
  assert.ok(html.includes('有效 @vima 标注'), '标注计数行存在');
  assert.ok(html.includes('野生标注'), '野生标注行存在');
  assert.ok(html.includes('虚报嫌疑'), '虚报嫌疑行存在');
  assert.ok(/有效 @vima 标注<\/td><td>7</.test(html.replace(/\n/g, '')), 'markers=7 落到产物');
  assert.ok(html.includes('>2</span>') && html.includes('>3</span>'), '非零异常项染警示色');
  assert.ok(!html.includes('尚未运行 vima trace'), 'trace 存在时不得再显示缺席提示');
  await rm(path.join(dir, 'trace.json'));
});

test('明细可行动：未过点位 / 集成对账 / 虚报嫌疑三处都列出具体对象，不止计数', async () => {
  // A36 立项理由：retro 是脱敏统计，本视图是带标识明细。只给计数则审核者无法行动。
  const dir = path.join(root, '.vima', 'reports');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'zz-det-verifier.json'), JSON.stringify({
    taskId: 'zz-det',
    round: 1,
    points: [
      { point: '按钮：新增', passed: true },
      { point: '字段：设备编号（必填校验）', passed: false },
      { point: '字段：备注', passed: false, waived: true },
      { point: 'NG-01 越界：批量导出', passed: false },
    ],
  }));
  await writeFile(path.join(dir, 'convergence.json'), JSON.stringify({
    findings: [{
      rule: 'V-INT-03', level: 'error', key: 'GET /api/devices/export',
      owners: ['zz-det'], message: '实现越出 apis 责任田',
    }],
    summary: { openPoints: 2, unmarkedDone: 0 },
  }));
  await writeFile(path.join(dir, 'trace.json'), JSON.stringify({
    schemaVersion: '1',
    markers: [],
    wild: [{ taskId: 'ghost-task', file: 'src/x.ts', line: 12 }],
    unmarked: ['zz-det'],
    summary: { markers: 0, wildTaskIds: 1, doneWithoutMarker: 1 },
  }));

  const r = vima(root, 'render-journal');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  const html = await readFile(path.join(root, OUT_REL), 'utf8');

  // ③ 逐点明细：三种类别与点位原文
  assert.ok(html.includes('逐点明细'), '③ 有逐点明细区');
  assert.ok(html.includes('字段：设备编号（必填校验）'), '未过点位原文可见');
  assert.ok(html.includes('NG-01 越界：批量导出'), 'NG 越界点位原文可见');
  assert.ok(html.includes('NG 越界') && html.includes('豁免'), '类别标签齐全');
  // 严重度排序：NG 越界必须排在「未过」之前
  assert.ok(html.indexOf('NG-01 越界：批量导出') < html.indexOf('字段：设备编号'),
    'NG 越界排在未过之前（审核动线：先看最该管的）');

  // ④ 逐条明细：规则 + 对象 + 负责任务
  assert.ok(html.includes('逐条明细'), '④ 有逐条明细区');
  assert.ok(html.includes('GET /api/devices/export'), '越界的具体接口可见');
  assert.ok(html.includes('实现越出 apis 责任田'), 'finding message 可见');
  assert.ok(html.includes('负责：zz-det'), 'owners 可见——直接指向该改谁');

  // ⑥ trace 明细：野生标注定位到文件行，虚报嫌疑列 taskId
  assert.ok(html.includes('野生标注明细'), '⑥ 有野生标注明细');
  assert.ok(html.includes('ghost-task') && html.includes('src/x.ts:12'), '野生标注定位到文件行');
  assert.ok(html.includes('虚报嫌疑明细'), '⑥ 有虚报嫌疑明细');

  await rm(path.join(dir, 'zz-det-verifier.json'));
  await rm(path.join(dir, 'convergence.json'));
  await rm(path.join(dir, 'trace.json'));
});

test('明细含 taskId 但不得污染 retro 的默认脱敏产物（details 只供带标识消费方）', async () => {
  const dir = path.join(root, '.vima', 'reports');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'zz-leak-verifier.json'), JSON.stringify({
    taskId: 'zz-leak-probe', round: 1, points: [{ point: '字段：秘密', passed: false }],
  }));
  const r = vima(root, 'retro');
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  const json = await readFile(path.join(root, '.vima', 'reports', 'retro.json'), 'utf8');
  assert.ok(!json.includes('zz-leak-probe'), 'retro 默认脱敏产物不得出现 taskId');
  assert.ok(!json.includes('details'), 'retro 不得取用 details 键');
  await rm(path.join(dir, 'zz-leak-verifier.json'));
});
