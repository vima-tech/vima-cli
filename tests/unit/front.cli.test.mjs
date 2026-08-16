// CLI 门面测试：**退出码是被测对象**，不是副产品。
// CI 靠码分支，宿主靠码决定显不显示——所以每条码都要有一条测试钉住它。
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { append } from '../../lib/core/events.mjs';

const PKG = fileURLToPath(new URL('../../', import.meta.url));
const BIN = path.join(PKG, 'bin', 'vima.mjs');

/** 干净环境：不让宿主的 VIMA_PROJECT_DIR / CLAUDE_PROJECT_DIR 干扰定位判据。 */
function cleanEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.VIMA_PROJECT_DIR;
  delete env.CLAUDE_PROJECT_DIR;
  return env;
}

function run(args, { cwd, env, stdin = '' } = {}) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [BIN, ...args], { cwd, env: cleanEnv(env) });
    p.stdin.end(stdin);
    let out = ''; let err = '';
    p.stdout.on('data', (c) => { out += c; });
    p.stderr.on('data', (c) => { err += c; });
    p.on('close', (code) => resolve({ code, out, err }));
  });
}

async function tmpProject() {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-cli-'));
  await mkdir(path.join(dir, '.vima'), { recursive: true });
  return dir;
}

const NOW = new Date('2026-08-16T00:00:00.000Z');

async function seedClaim(root, id, payload = {}) {
  return append(root, {
    kind: 'claim',
    actor: 'test',
    subject: id,
    payload: { layer: 'spec', statement: `命题 ${id}`, need: 'derived', from: [], ...payload },
  }, { now: NOW });
}

test('version / help：exit 0，help 写明每一个退出码', async () => {
  const v = await run(['version']);
  assert.equal(v.code, 0);
  assert.match(v.out.trim(), /^\d+\.\d+\.\d+/);

  const h = await run(['help']);
  assert.equal(h.code, 0);
  for (const line of ['退出码', '0   成功', '1   用法错误', '2   不在 vima 项目里', '3   依赖的模块尚未实现', '4   命题或目标不存在', '5   跑通了', '70  内部错误']) {
    assert.ok(h.out.includes(line), `help 缺退出码说明：${line}`);
  }
  assert.ok(h.out.includes('mcp-install'), 'help 要说得出 MCP 怎么装');
});

test('未知命令 / 未知参数 → exit 1，诊断走 stderr', async () => {
  const a = await run(['nope']);
  assert.equal(a.code, 1);
  assert.equal(a.out, '', '错误不许污染 stdout');
  assert.match(a.err, /未知命令/);

  const b = await run(['next', '--nonsense']);
  assert.equal(b.code, 1);
  assert.match(b.err, /USAGE/);
});

test('非项目根：需要项目的命令 exit 2，status 恒 exit 0 且解释为什么空', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-nowhere-'));

  for (const cmd of [['next'], ['ask', 'x'], ['audit'], ['claim', 'x']]) {
    const r = await run(cmd, { cwd: dir });
    assert.equal(r.code, 2, `${cmd[0]} 应该报 NO_PROJECT`);
    assert.match(r.err, /NO_PROJECT/);
  }

  // 会话开错目录正是 status 要可视化的故障——非零码会让宿主只显示空白
  const s = await run(['status'], { cwd: dir });
  assert.equal(s.code, 0);
  assert.match(s.out, /不在 vima 项目里/);
  assert.match(s.out, /cwd/);
  assert.match(s.out, /VIMA_PROJECT_DIR/);

  const sj = await run(['status', '--json'], { cwd: dir });
  assert.equal(sj.code, 0);
  const data = JSON.parse(sj.out);
  assert.equal(data.ok, false);
  assert.equal(data.reason, 'no-project');
});

test('init：立起 .vima/ 骨架；模板缺席时如实报告而不是崩', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-init-'));
  const r = await run(['init'], { cwd: dir });
  assert.equal(r.code, 0, r.err);
  await access(path.join(dir, '.vima', 'events.jsonl'));
  await access(path.join(dir, '.vima', 'project.json'));
  const cfg = JSON.parse(await readFile(path.join(dir, '.vima', 'project.json'), 'utf8'));
  assert.equal(cfg.schema, '4');
  assert.equal(cfg.name, path.basename(dir));

  let templates = true;
  try { await access(path.join(PKG, 'templates', 'project')); } catch { templates = false; }
  if (templates) await access(path.join(dir, '.claude', 'settings.json'));
  else assert.match(r.err, /templates\/project\/ 尚未提供/);

  // 可重跑
  const again = await run(['init', '--theme=x'], { cwd: dir });
  assert.equal(again.code, 0);
  const cfg2 = JSON.parse(await readFile(path.join(dir, '.vima', 'project.json'), 'utf8'));
  assert.equal(cfg2.theme, 'x');

  // init 之后 status 认得出这是项目
  const s = await run(['status', '--json'], { cwd: dir });
  assert.equal(s.code, 0);
  assert.equal(JSON.parse(s.out).ok, true);
});

test('next：给出下一条命题、进度三档与上下文；--json 干净可解析', async () => {
  const root = await tmpProject();
  await seedClaim(root, 'c-spec');
  await seedClaim(root, 'c-impl', { layer: 'impl', from: ['c-spec'] });

  const r = await run(['next', '--json'], { cwd: root });
  assert.equal(r.code, 0, r.err);
  const d = JSON.parse(r.out);
  // 层序在前 + 上游未达标者靠后 → 先做 spec
  assert.equal(d.task.id, 'c-spec');
  assert.equal(d.progress.declared, 2);
  assert.equal(d.progress.met, 0);
  assert.ok(d.context.extract.blind.length > 0, '要如实呈现提取能力边界');

  const human = await run(['next'], { cwd: root });
  assert.equal(human.code, 0);
  assert.match(human.out, /c-spec/);
});

test('claim / ask：认领只记过程不改状态；查不存在的命题 exit 4', async () => {
  const root = await tmpProject();
  await seedClaim(root, 'c-1');

  const miss = await run(['ask', 'nope'], { cwd: root });
  assert.equal(miss.code, 4);
  assert.match(miss.err, /NOT_FOUND/);

  const c = await run(['claim', 'c-1'], { cwd: root });
  assert.equal(c.code, 0, c.err);

  const a = await run(['ask', 'c-1', '--json'], { cwd: root });
  assert.equal(a.code, 0);
  const d = JSON.parse(a.out);
  assert.equal(d.claim.met, false, '认领不等于做完');
  assert.equal(d.runs.length, 1);
  assert.equal(d.runs[0].op, 'claim');
});

test('rule：confidence 与 blastRadius 必填，缺了 exit 1；齐了落一条 ruling 事件', async () => {
  const root = await tmpProject();

  const bad = await run(['rule', '--question=用哪个', '--chosen=A'], { cwd: root });
  assert.equal(bad.code, 1);
  assert.match(bad.err, /confidence/);

  const noBlast = await run(['rule', '--question=用哪个', '--chosen=A', '--confidence=high'], { cwd: root });
  assert.equal(noBlast.code, 1);
  assert.match(noBlast.err, /blastRadius/);

  const good = await run(['rule', '--question=用哪个', '--chosen=A', '--confidence=high', '--blast=只影响列表页', '--options=A|B'], { cwd: root });
  assert.equal(good.code, 0, good.err);

  const log = await readFile(path.join(root, '.vima', 'events.jsonl'), 'utf8');
  const rulings = log.trim().split('\n').map((l) => JSON.parse(l)).filter((e) => e.kind === 'ruling');
  assert.equal(rulings.length, 1);
  assert.equal(rulings[0].payload.confidence, 'high');
  assert.deepEqual(rulings[0].payload.options, ['A', 'B']);
});

test('submit：只收 claimId；取不到证据 exit 5，取到了 exit 0', async () => {
  const root = await tmpProject();
  await seedClaim(root, 'c-1');

  assert.equal((await run(['submit', 'nope'], { cwd: root })).code, 4);
  assert.equal((await run(['submit'], { cwd: root })).code, 1);

  // 没有代码目录 → 取不到 derived 证据。「命令跑通了」≠「结论是达标」
  const unmet = await run(['submit', 'c-1'], { cwd: root });
  assert.equal(unmet.code, 5, unmet.err);
  assert.match(unmet.out, /未达标/);
  assert.match(unmet.out, /取证没成/);

  // 打上 @vima 标注，系统自己扫得到 → 达标
  await writeFile(path.join(root, '.vima', 'project.json'), JSON.stringify({ schema: '4', apps: [{ id: 'web', kind: 'web' }] }));
  await mkdir(path.join(root, 'apps', 'web'), { recursive: true });
  await writeFile(path.join(root, 'apps', 'web', 'list.mjs'), '// @vima c-1\nexport const x = 1;\n');
  const met = await run(['submit', 'c-1', '--json'], { cwd: root });
  assert.equal(met.code, 0, met.err);
  const d = JSON.parse(met.out);
  assert.equal(d.met, true);
  assert.equal(d.got, 'derived');
  // 证据由系统写，actor 不是触发者
  const log = (await readFile(path.join(root, '.vima', 'events.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
  const evidence = log.filter((e) => e.kind === 'evidence');
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].actor, 'system');
});

test('compile：批次 JSON 走文件或 stdin；逐条拒时 exit 5', async () => {
  const root = await tmpProject();
  await append(root, {
    kind: 'claim', actor: 'test', subject: 'i-1',
    payload: { layer: 'intent', statement: '要有列表页', trust: 'stated' },
  }, { now: NOW });

  const good = { upstream: 'i-1', layer: 'spec', items: [{ id: 's-1', statement: '列表页要有空态', trust: 'stated' }] };
  const viaStdin = await run(['compile', '--json'], { cwd: root, stdin: JSON.stringify(good) });
  assert.equal(viaStdin.code, 0, viaStdin.err);
  assert.equal(JSON.parse(viaStdin.out).written, 1);

  const batch = path.join(root, 'batch.json');
  await writeFile(batch, JSON.stringify({ upstream: 'i-1', layer: 'spec', items: [{ id: 's-2', statement: '缺 trust 的' }] }));
  const rejected = await run(['compile', batch], { cwd: root });
  assert.equal(rejected.code, 5, rejected.err);
  assert.match(rejected.out, /被拒 1 条/);

  // 没有批次也没有 stdin 内容 → 用法错误，不是内部错误
  assert.equal((await run(['compile'], { cwd: root })).code, 1);

  // 编译进来的命题立刻进投影；next 仍先给上游（intent 在 spec 之上）
  const n = JSON.parse((await run(['next', '--json'], { cwd: root })).out);
  assert.equal(n.progress.declared, 2);
  assert.equal(n.task.id, 'i-1');
});

test('audit：空项目没有发现 exit 0；有未取证命题 exit 5', async () => {
  const empty = await tmpProject();
  const a = await run(['audit'], { cwd: empty });
  assert.equal(a.code, 0, a.err);
  assert.match(a.out, /提取能力/, '审计报告要如实带上提取能力边界');

  const root = await tmpProject();
  await seedClaim(root, 'c-1');
  const b = await run(['audit', '--json'], { cwd: root });
  assert.equal(b.code, 5);
  assert.ok(JSON.parse(b.out).errors > 0);
});

test('ui：接到 web.serve 上，起得来也关得掉（web 未实现时给 3 而不是崩）', async () => {
  const A = await import('../../lib/front/actions.mjs');
  const root = await tmpProject();
  const ctx = await A.makeCtx({ cwd: root, env: cleanEnv() });
  if (!(await A.optional('web'))) {
    await assert.rejects(() => A.ui(ctx, { port: 0 }), (e) => e.exit === 3 && e.code === 'NOT_IMPLEMENTED');
    return;
  }
  const s = await A.ui(ctx, { port: 0 });
  assert.match(s.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
  await s.close();
});

test('rule：影响面归一成 id 数组或条数，不多造第三种形态', async () => {
  const A = await import('../../lib/front/actions.mjs');
  const root = await tmpProject();
  const ctx = await A.makeCtx({ cwd: root, env: cleanEnv(), now: NOW, actor: 'test' });
  const base = { question: 'q', chosen: 'a', confidence: 'low' };
  assert.deepEqual((await A.rule(ctx, { ...base, blastRadius: 's-1, s-2' })).blastRadius, ['s-1', 's-2']);
  assert.equal((await A.rule(ctx, { ...base, blastRadius: '3' })).blastRadius, 3);
  assert.equal((await A.rule(ctx, { ...base, blastRadius: '只影响列表页' })).blastRadius, '只影响列表页');
});

test('--cwd：可以在别处执行而不改变判据', async () => {
  const root = await tmpProject();
  const elsewhere = await mkdtemp(path.join(tmpdir(), 'vima-else-'));
  const r = await run(['status', '--json', `--cwd=${root}`], { cwd: elsewhere });
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(r.out).ok, true);
});

test('mcp-install：给出 user scope 的装法，并说清为什么必须 user scope', async () => {
  const r = await run(['mcp-install']);
  assert.equal(r.code, 0);
  assert.match(r.out, /--scope user/);
  assert.match(r.out, /开错目录/);
  const j = await run(['mcp-install', '--json']);
  const d = JSON.parse(j.out);
  assert.equal(d.scope, 'user');
  assert.deepEqual(d.tools, ['next', 'claim', 'submit', 'rule', 'ask']);
});
