// C3 单测：A35 过程轨迹 journal.jsonl 的两个采集口（契约 §6.21）
// 覆盖：采集口径表逐行 / 单行上限 / 封闭集 / 开关 / 写失败不改退出码 /
//       只读 flag 排除（含自我强制守卫）/ hook 报告与规范事件 / 脱敏面。
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');
const HOOK = path.join(CLI_ROOT, 'templates', 'admin', 'workspace', 'hooks', 'post-write.mjs');
const JOURNAL_REL = path.join('.vima', 'reports', 'journal.jsonl');

function vima(cwd, args, env = {}) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
}
/** 以 hook 协议喂一次写入事件。 */
function hook(cwd, relPath) {
  return spawnSync(process.execPath, [HOOK], {
    cwd,
    encoding: 'utf8',
    input: JSON.stringify({ cwd, tool_input: { file_path: relPath } }),
  });
}
async function events(root) {
  const text = await readFile(path.join(root, JOURNAL_REL), 'utf8');
  return text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

let root;
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'vima-jr-'));
  await cp(GOLDEN, root, { recursive: true });
  // 先渲染，好让后续的只读检查真的成功（否则它们本身 exit 2，验不到「成功不记」）
  vima(root, ['render-review']);
  vima(root, ['render-prototype']);
});

test('采集口径：白名单命令成功必记；只读成功不记；失败一律记（含非白名单命令）', async () => {
  await rm(path.join(root, JOURNAL_REL), { force: true });

  // ① 只读成功 → 不记
  assert.equal(vima(root, ['render-review', '--check']).status, 0, '前置：--check 应成功');
  assert.ok(!existsSync(path.join(root, JOURNAL_REL)), '只读成功不得落盘');

  // ② 白名单命令成功 → 记
  assert.equal(vima(root, ['validate']).status, 0);
  let ev = await events(root);
  assert.equal(ev.length, 1, '白名单成功记一条');
  assert.deepEqual(
    { kind: ev[0].kind, ref: ev[0].ref, outcome: ev[0].outcome, n: ev[0].n },
    { kind: 'cmd', ref: 'validate', outcome: 'ok', n: 0 },
  );

  // ③ 失败 → 记，且 n = exitCode（D-A35-09）
  const bad = vima(root, ['render-journal', '--nope']);
  assert.equal(bad.status, 3, '前置：未知选项 usage exit 3');
  ev = await events(root);
  const fail = ev.at(-1);
  assert.equal(fail.outcome, 'fail');
  assert.equal(fail.n, 3, 'n 取退出码，不是 error 条数');
  assert.equal(fail.ref, 'render-journal', '非白名单命令失败同样记');
});

test('retro 自我豁免（D-A35-12）：成功不写自己的事件，否则 A21 的字节一致判据当场失败', async () => {
  await rm(path.join(root, JOURNAL_REL), { force: true });
  assert.equal(vima(root, ['retro']).status, 0);
  const ev = existsSync(path.join(root, JOURNAL_REL)) ? await events(root) : [];
  assert.equal(ev.filter((e) => e.ref === 'retro').length, 0, 'retro 不得记录自己');
});

test('plan --json 声明不落盘，因此不写 batch-plan 或 journal', async () => {
  await rm(path.join(root, JOURNAL_REL), { force: true });
  const r = vima(root, ['plan', '--json']);
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.ok(!existsSync(path.join(root, '.vima', 'reports', 'batch-plan.json')));
  assert.ok(!existsSync(path.join(root, JOURNAL_REL)));
});

test('项目外不落盘（journal 是项目产物）', async () => {
  const outside = await mkdtemp(path.join(tmpdir(), 'vima-jr-out-'));
  vima(outside, ['validate']);
  assert.ok(!existsSync(path.join(outside, JOURNAL_REL)), '无项目根 → 不记');
  await rm(outside, { recursive: true, force: true });
});

test('非项目命令不污染当前目录（BUG：root 对非 PROJECT_SCOPED 命令恒等于 cwd）', async () => {
  // 回归防线：判据必须是「这里有没有 .vima/」，不是「root 非 null」——
  // 否则在任意目录里跑一次失败的 `vima create`，就会往那个目录扔 .vima/reports/journal.jsonl。
  // 实测曾污染 vima-cli 仓库自身。
  const bare = await mkdtemp(path.join(tmpdir(), 'vima-jr-bare-'));
  for (const args of [['create'], ['validate'], ['doctor'], ['version']]) {
    vima(bare, args);
    assert.ok(!existsSync(path.join(bare, '.vima')), `vima ${args[0]} 不得在非项目目录建 .vima/`);
  }
  await rm(bare, { recursive: true, force: true });
});

test('VIMA_JOURNAL=0 关闭采集（D-A35-07 开关为可复现测试与知情权而存在）', async () => {
  await rm(path.join(root, JOURNAL_REL), { force: true });
  vima(root, ['validate'], { VIMA_JOURNAL: '0' });
  assert.ok(!existsSync(path.join(root, JOURNAL_REL)), '开关关闭时一行都不写');
  vima(root, ['validate']);
  assert.equal((await events(root)).length, 1, '开关恢复后正常记录');
});

test('写失败不改退出码（D-A35-02：采集是旁路）', async () => {
  vima(root, ['validate']);
  const a = vima(root, ['validate']).status;
  await chmod(path.join(root, JOURNAL_REL), 0o444);
  const b = vima(root, ['validate']).status;
  await chmod(path.join(root, JOURNAL_REL), 0o644);
  assert.equal(a, b, 'journal 只读时退出码不得变化');
});

test('自我强制守卫：帮助面里每个声明「不写盘」的选项，实跑后都不得产生 journal 行', async () => {
  // 纯行为断言（不读内部常量）：防的是「将来新增只读 flag 却忘了排除」——
  // 那会静默打破该命令的零写盘承诺，而零写盘由各自的指纹用例守着，报错点离根因很远。
  const all = vima(root, ['help']).stdout;
  const cmds = [...all.matchAll(/^\s{2}([a-z][a-z-]*)\s{2,}/gm)].map((m) => m[1]);
  assert.ok(cmds.length > 10, `前置：应解析出命令列表，实际 ${cmds.length}`);

  const readonly = [];
  for (const cmd of new Set(cmds)) {
    for (const line of vima(root, ['help', cmd]).stdout.split('\n')) {
      if (!/不写盘/.test(line)) continue;
      const m = /(--[a-z][a-z-]*)/.exec(line);
      if (m) readonly.push([cmd, m[1]]);
    }
  }
  assert.ok(readonly.length >= 2, `前置：应至少找到 --dry-run 与 --scaffold-diff，实际 ${JSON.stringify(readonly)}`);

  for (const [cmd, flag] of readonly) {
    await rm(path.join(root, JOURNAL_REL), { force: true });
    const r = vima(root, [cmd, flag]);
    if (r.status !== 0) continue; // 该 flag 在本夹具下不成立（如缺前置）——失败必记是正确行为
    assert.ok(
      !existsSync(path.join(root, JOURNAL_REL)),
      `${cmd} ${flag} 声明了不写盘，却产生了 journal 行——须加入 JOURNAL_READONLY_FLAGS`,
    );
  }
});

test('hook 采集口②：子代理报告落盘 → report 事件（ref 带轮次，n 为未过点位数）', async () => {
  await rm(path.join(root, JOURNAL_REL), { force: true });
  const rel = path.join('.vima', 'reports', 'demo-verifier.json');
  await mkdir(path.join(root, '.vima', 'reports'), { recursive: true });
  await writeFile(path.join(root, rel), JSON.stringify({
    taskId: 'demo', round: 2, result: 'fail',
    points: [{ point: 'p1', passed: false }, { point: 'p2', passed: true }],
  }));
  const r = hook(root, rel);
  assert.equal(r.status, 0, `hook 应放行报告写入；stderr: ${r.stderr}`);
  const ev = await events(root);
  assert.equal(ev.length, 1);
  assert.deepEqual(
    { kind: ev[0].kind, ref: ev[0].ref, outcome: ev[0].outcome, n: ev[0].n },
    { kind: 'report', ref: 'demo/verifier/r2', outcome: 'fail', n: 1 },
  );
});

test('hook 采集口③：规范命中 → guard 事件；ref 是封闭枚举且不含命中现场（D-A35-10）', async () => {
  await rm(path.join(root, JOURNAL_REL), { force: true });
  const rel = path.join('src', 'views', 'Bad.vue');
  await mkdir(path.join(root, 'src', 'views'), { recursive: true });
  await writeFile(path.join(root, rel), [
    '<template>',
    '  <div data-page="PAGE-01">',
    "    <button @click=\"confirm('x')\">go</button>",
    '  </div>',
    '</template>',
    '<script setup lang="ts">',
    "import { VButton } from 'vendor/vima-ui-admin/dist/components'",
    "import x from '@vima/ui'",
    '</script>',
    '<style scoped>',
    '.a { color: #ff0000; gap: 12px; }',
    '</style>',
    '',
  ].join('\n'));

  const r = hook(root, rel);
  assert.equal(r.status, 2, 'hook 仍按原语义阻断——采集不得改变退出码');
  const ev = await events(root);
  assert.ok(ev.length >= 4, `应记多条 guard，实际 ${ev.length}`);
  assert.ok(ev.every((e) => e.kind === 'guard' && e.outcome === 'block'), 'kind/outcome 固定');
  assert.ok(ev.every((e) => e.n === undefined), 'guard 省略 n（恒 1 无信息量）');
  // 脱敏面：不得带文件名、页面 ID、目录
  const leak = /\.(vue|wxml|wxss|ts|tsx|js|mjs)|PAGE-|MODAL-|src\/|apps\//;
  for (const e of ev) assert.ok(!leak.test(e.ref), `guard ref 泄露命中现场：${e.ref}`);
  // 同一次写入内同条规范只记一次
  assert.equal(new Set(ev.map((e) => e.ref)).size, ev.length, '同条规范去重');
});

test('schema 收口：五键封顶、kind/outcome 封闭集、无 schemaVersion、单行 ≤ 1024 字节', async () => {
  const ev = await events(root);
  const KIND = new Set(['cmd', 'report', 'guard']);
  const OUT = new Set(['ok', 'fail', 'pass', 'block']);
  const KEYS = new Set(['ts', 'kind', 'ref', 'outcome', 'n']);
  for (const e of ev) {
    assert.ok(KIND.has(e.kind), `kind 越界：${e.kind}`);
    assert.ok(OUT.has(e.outcome), `outcome 越界：${e.outcome}`);
    assert.equal(typeof e.ts, 'string');
    assert.equal(e.schemaVersion, undefined, '不带 schemaVersion（版本语义由契约 §6.21 承担）');
    for (const k of Object.keys(e)) assert.ok(KEYS.has(k), `键越出五键封顶：${k}`);
  }
  const text = await readFile(path.join(root, JOURNAL_REL), 'utf8');
  for (const line of text.split('\n').filter(Boolean)) {
    assert.ok(Buffer.byteLength(`${line}\n`) <= 1024, `单行超 1024 字节会破坏并发追加原子性：${line.slice(0, 60)}…`);
  }
});
