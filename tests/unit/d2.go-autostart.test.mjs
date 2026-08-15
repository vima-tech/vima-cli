// D2 单测：DEVELOPING 期自动开工 hook（A39）
//
// 直接跑 hook 脚本并喂 stdin，断言的是**真实行为**而不是文件里有没有某个字符串——
// hook 是运行时资产，只检查文本会让「写了但跑不起来」照样绿。
//
// 出处：sustain-v3 实战。go-continue.mjs（A18）是续跑器不是启动器，只在
// go-state.json 已存在时工作；于是「起」这一步没有任何自动化，人不敲 /go 就永远不开工，
// 而会话会照着任务文件手写代码——79 个源文件落盘、零份 builder 报告、进度显示 0/134。
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, rm, utimes } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.join(HERE, '..', '..', 'templates', 'admin', 'workspace', 'hooks', 'go-autostart.mjs');

function runHook(cwd, input = {}, env = {}) {
  return spawnSync(process.execPath, [HOOK], {
    cwd,
    input: JSON.stringify({ hook_event_name: 'SessionStart', cwd, ...input }),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

/**
 * 造一个最小 Vima 项目。
 * @param {string} phase currentPhase
 * @param {string[]} statuses 每个任务的 status
 */
async function makeProject(t, phase = 'DEVELOPING', statuses = ['pending', 'pending']) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'vima-d2-autostart-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));
  await mkdir(path.join(tmp, 'docs', 'tasks'), { recursive: true });
  await mkdir(path.join(tmp, '.claude', 'commands'), { recursive: true });
  await writeFile(path.join(tmp, '.claude', 'commands', 'go.md'), '# /go\n');
  await writeFile(
    path.join(tmp, 'docs', 'lifecycle.json'),
    JSON.stringify({ schemaVersion: '2.0', currentPhase: phase, phaseHistory: [] }),
  );
  for (const [i, status] of statuses.entries()) {
    await writeFile(
      path.join(tmp, 'docs', 'tasks', `task-${i}.md`),
      `---\nid: task-${i}\nstatus: ${status}\nside: frontend\n---\n\n# 任务 ${i}\n`,
    );
  }
  return tmp;
}

/** 解析 hook 的 stdout 为注入上下文；无输出返回 null。 */
function contextOf(proc) {
  assert.equal(proc.status, 0, `hook 必须恒 exit 0，stderr: ${proc.stderr}`);
  if (proc.stdout.trim() === '') return null;
  const out = JSON.parse(proc.stdout);
  assert.equal(out.hookSpecificOutput?.hookEventName, 'SessionStart', 'hookEventName 必须是 SessionStart');
  return out.hookSpecificOutput.additionalContext;
}

test('A39：DEVELOPING + 有未完成任务 + 无人在调度 → 注入并发调度指令', async (t) => {
  const tmp = await makeProject(t, 'DEVELOPING', ['pending', 'done', 'pending']);
  const ctx = contextOf(runHook(tmp));
  assert.ok(ctx, '这正是要自动开工的情形，不能静默');
  assert.match(ctx, /3 个任务中 2 个未完成/, '须如实报出任务口径');
  assert.match(ctx, /go\.md/, '须指向调度协议正文，而不是在这里复制一份（会漂移）');
  assert.match(ctx, /并发/, '须要求并发派发——串行手写正是要治的病');
  assert.match(ctx, /reports\/<taskId>/, '须要求写报告，否则 journal 永远没有轨迹');
  assert.match(ctx, /go-state\.json/, '须要求落停因，否则续跑器无法工作');
});

test('A39：任务口径必须与内核 loadTasks 一致——README.md 与 _ 前缀模板不算任务', async (t) => {
  const tmp = await makeProject(t, 'DEVELOPING', ['pending', 'pending']);
  const dir = path.join(tmp, 'docs', 'tasks');
  await writeFile(path.join(dir, 'README.md'), '# 任务索引\n');
  await writeFile(path.join(dir, '_template-fe.md'), '---\nstatus: pending\n---\n');
  const ctx = contextOf(runHook(tmp));
  assert.match(ctx, /2 个任务中 2 个未完成/, 'README.md 与模板计进来会让 hook 与 vima status 报不同的数');
});

test('A39：非 DEVELOPING 阶段静默（PLANNING 期不该有人写业务代码）', async (t) => {
  const tmp = await makeProject(t, 'PLANNING');
  assert.equal(contextOf(runHook(tmp)), null);
});

test('A39：任务全部 done → 静默，不催促已完工的项目', async (t) => {
  const tmp = await makeProject(t, 'DEVELOPING', ['done', 'done']);
  assert.equal(contextOf(runHook(tmp)), null);
});

test('A39：已有会话在跑调度（go-state.json 新鲜）→ 静默，避免两会话竞写热文件', async (t) => {
  const tmp = await makeProject(t);
  await mkdir(path.join(tmp, '.vima'), { recursive: true });
  await writeFile(path.join(tmp, '.vima', 'go-state.json'), JSON.stringify({ stopReason: 'in-progress' }));
  assert.equal(contextOf(runHook(tmp)), null);
});

test('A39：go-state.json 已过期（上次会话遗留）→ 照常开工', async (t) => {
  const tmp = await makeProject(t);
  await mkdir(path.join(tmp, '.vima'), { recursive: true });
  const p = path.join(tmp, '.vima', 'go-state.json');
  await writeFile(p, JSON.stringify({ stopReason: 'in-progress' }));
  const old = new Date(Date.now() - 60 * 60 * 1000);
  await utimes(p, old, old);
  assert.ok(contextOf(runHook(tmp)), '一小时前的遗留状态不代表现在有人在跑');
});

test('A39：VIMA_AUTOSTART=0 → 静默（用户必须能关掉自动开工）', async (t) => {
  const tmp = await makeProject(t);
  assert.equal(contextOf(runHook(tmp, {}, { VIMA_AUTOSTART: '0' })), null);
});

test('A39：resume / compact 的会话不重复注入（已带着上文，再注入会与既有进度打架）', async (t) => {
  const tmp = await makeProject(t);
  assert.equal(contextOf(runHook(tmp, { source: 'resume' })), null);
  assert.equal(contextOf(runHook(tmp, { source: 'compact' })), null);
  assert.ok(contextOf(runHook(tmp, { source: 'startup' })), 'startup 必须注入');
  assert.ok(contextOf(runHook(tmp, { source: 'clear' })), 'clear 后上下文已空，同样要注入');
});

test('A39：非 Vima 项目目录 → 静默，绝不打扰无关会话', async (t) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'vima-d2-autostart-bare-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));
  assert.equal(contextOf(runHook(tmp)), null);
});

test('A39：lifecycle.json 损坏 / 无输入 → 静默 exit 0，绝不阻碍会话启动', async (t) => {
  const tmp = await makeProject(t);
  await writeFile(path.join(tmp, 'docs', 'lifecycle.json'), '{ 这不是 JSON');
  assert.equal(contextOf(runHook(tmp)), null);

  const noInput = spawnSync(process.execPath, [HOOK], { cwd: tmp, input: '', encoding: 'utf8' });
  assert.equal(noInput.status, 0, '非 JSON 输入也必须 exit 0');
});

test('A39：settings.json 模板须把本 hook 注册为 SessionStart', async () => {
  const { readFile } = await import('node:fs/promises');
  const settings = JSON.parse(
    await readFile(path.join(HERE, '..', '..', 'templates', 'admin', 'workspace', 'settings.json'), 'utf8'),
  );
  const cmds = (settings.hooks?.SessionStart ?? []).flatMap((g) => (g.hooks ?? []).map((h) => h.command));
  assert.ok(
    cmds.some((c) => c.includes('go-autostart.mjs')),
    'settings.json 须注册 SessionStart hook go-autostart.mjs，否则自动开工永远不会触发',
  );
});
