// 六个 hook 的行为断言：真起进程、喂真形状的 stdin、看事件日志与注入文本。
//
// stdin 形状取自 Claude Code 2.1.233 的 hook 输入 schema（2026-08-16 实测确认 +
// hooks 文档核对）：
//   公共      session_id · transcript_path · cwd · permission_mode? · agent_id? · agent_type?
//   PostToolUse         + tool_name · tool_input · tool_response · tool_use_id · duration_ms?
//   PostToolUseFailure  + tool_name · tool_input · tool_use_id · error · is_interrupt? · duration_ms?
//   SubagentStart       + agent_id · agent_type
//   SubagentStop        + stop_hook_active · agent_id · agent_type · agent_transcript_path
//                         · last_assistant_message?
//   SessionStart        + source · model? · session_title?
//   UserPromptSubmit    + prompt · source?
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { append } from '../../lib/core/events.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOOKS = path.join(REPO, 'templates', 'project', '.claude', 'hooks');

/** 起一个 hook 子进程。VIMA_HOME 指向本仓，模拟 hook 在项目里找到 vima 安装。 */
function fire(file, input, env = {}) {
  // CLAUDE_PROJECT_DIR 必须显式剔除：hook 的 resolveRoot 把它排在 cwd 之前，
  // 而跑测试的会话往往就开在一个 Claude Code 项目里。曾经因此发生过：
  // 仓库根被某次探针 init 出了 .vima/，于是**所有 hook 测试的事件都写进了
  // 仓库根**而不是各自的临时项目——两条「不在项目里就静默」的测试变红，
  // 看起来像刚改的功能坏了，实际是测试环境向被测进程泄漏。
  const clean = { ...process.env, VIMA_HOME: REPO, ...env };
  if (!('CLAUDE_PROJECT_DIR' in env)) delete clean.CLAUDE_PROJECT_DIR;
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [path.join(HOOKS, file)],
      { env: clean },
      (err, stdout, stderr) => resolve({ code: err?.code ?? 0, stdout, stderr }),
    );
    child.stdin.end(JSON.stringify(input));
  });
}

async function makeProject() {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-tpl-'));
  await mkdir(path.join(root, '.vima'), { recursive: true });
  await writeFile(path.join(root, '.vima', 'project.json'),
    JSON.stringify({ schema: '4', name: '演示项目', theme: 'enterprise-blue', apps: [{ id: 'admin' }], blocks: [] }));
  return root;
}

async function events(root) {
  const raw = await readFile(path.join(root, '.vima', 'events.jsonl'), 'utf8');
  return raw.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

/** 直接写事件日志——测试扮演「系统」，不经 agent。 */
async function seed(root, lines) {
  await writeFile(path.join(root, '.vima', 'events.jsonl'),
    lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
}

const CLAIM = (id, layer, extra = {}) => ({
  id: `e-${id}`, ts: '2026-08-16T00:00:00.000Z', kind: 'claim', actor: 'system',
  subject: id, payload: { layer, statement: id, need: 'derived', ...extra },
});

/**
 * 用**真** append 落一条命题（+ 可选证据），让 hook 那边用**真** project/meets 读回。
 * 不喂合成投影：合成的那份必然与真投影有对不上的一天，而那天它掩盖的是真 bug。
 */
async function seedClaim(root, id, { need = 'derived', evidence = null } = {}) {
  await append(root, {
    kind: 'claim', actor: 'system', subject: id,
    payload: { layer: 'impl', statement: `做 ${id}`, need },
  }, { now: new Date('2026-08-16T00:00:00.000Z') });
  if (evidence) {
    await append(root, {
      kind: 'evidence', actor: 'system', subject: id,
      payload: { strength: evidence, by: 'test' },
    }, { now: new Date('2026-08-16T00:00:01.000Z') });
  }
}

/** 子代理转录里的一轮工具调用。形状照 Claude Code 的 JSONL 转录：message.content[]。 */
const TOOL_USE = (name, input) => ({
  type: 'assistant',
  timestamp: '2026-08-16T00:00:05.000Z',
  message: {
    usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: 'tool_use', name, input }],
  },
});

async function agentLog(root, records, file = 'agent.jsonl') {
  const p = path.join(root, file);
  await writeFile(p, records.map((r) => JSON.stringify(r)).join('\n'));
  return p;
}

test('PostToolUse：把「文件被改了」记成 run 事件，subject 是项目内相对路径', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'src', 'a.ts');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, 'export const a = 1;\n');

  const r = await fire('post-tool-use.mjs', {
    session_id: 's1', transcript_path: '/x', cwd: root,
    hook_event_name: 'PostToolUse', tool_name: 'Write',
    tool_input: { file_path: file }, tool_response: {}, tool_use_id: 'tu1', duration_ms: 12,
  });
  assert.equal(r.code, 0, r.stderr);

  const [e] = await events(root);
  assert.equal(e.kind, 'run');
  assert.equal(e.actor, 'agent:main');
  assert.equal(e.subject, 'src/a.ts');
  assert.equal(e.payload.op, 'write');
  assert.equal(e.payload.tool, 'Write');
  assert.equal(e.payload.bytes, 20);
  assert.match(e.payload.digest, /^sha256:[0-9a-f]{32}$/);
  assert.deepEqual(e.cost, { ms: 12 });
  // 记的是「文件被改了」这个事实，不是「任务完成了」这个断言
  assert.equal(e.kind === 'claim', false);
});

test('PostToolUse：子代理写的文件，actor 记成 subagent', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'b.ts');
  await writeFile(file, 'x');
  await fire('post-tool-use.mjs', {
    session_id: 's1', cwd: root, tool_name: 'Edit', tool_input: { file_path: file },
    agent_id: 'ag-9', agent_type: 'Explore',
  });
  const [e] = await events(root);
  assert.equal(e.actor, 'subagent:Explore');
});

test('PostToolUse：被写文件属于内层嵌套项目时，事件落到内层（不是 cwd 那层）', async (t) => {
  const outer = await makeProject();
  t.after(() => rm(outer, { recursive: true, force: true }));
  const inner = path.join(outer, 'packages', 'inner');
  await mkdir(path.join(inner, '.vima'), { recursive: true });
  const file = path.join(inner, 'c.ts');
  await writeFile(file, 'x');

  await fire('post-tool-use.mjs', {
    cwd: outer, tool_name: 'Write', tool_input: { file_path: file },
  }, { CLAUDE_PROJECT_DIR: outer });

  const inners = await events(inner);
  assert.equal(inners.length, 1);
  assert.equal(inners[0].subject, 'c.ts');
  await assert.rejects(() => events(outer), /ENOENT/, '外层不该有事件');
});

test('PostToolUse：不在 vima 项目里就静默放行，不写盘不报错', async (t) => {
  const plain = await mkdtemp(path.join(tmpdir(), 'vima-plain-'));
  t.after(() => rm(plain, { recursive: true, force: true }));
  const file = path.join(plain, 'd.ts');
  await writeFile(file, 'x');
  const r = await fire('post-tool-use.mjs', { cwd: plain, tool_name: 'Write', tool_input: { file_path: file } });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
});

test('PostToolUse：不采集 .vima/ 下的写入（否则采集自己的事件日志）', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, '.vima', 'index', 'x.json');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, '{}');
  await fire('post-tool-use.mjs', { cwd: root, tool_name: 'Write', tool_input: { file_path: file } });
  await assert.rejects(() => events(root), /ENOENT/);
});

test('SubagentStop：能读到子代理转录时，从 usage 推导 tokens 与墙钟跨度', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  const tp = path.join(root, 'agent.jsonl');
  await writeFile(tp, [
    JSON.stringify({ type: 'user', timestamp: '2026-08-16T00:00:00.000Z' }),
    JSON.stringify({
      type: 'assistant', timestamp: '2026-08-16T00:00:05.000Z',
      message: { usage: { input_tokens: 2, output_tokens: 100, cache_creation_input_tokens: 1000, cache_read_input_tokens: 500 } },
    }),
    JSON.stringify({
      type: 'assistant', timestamp: '2026-08-16T00:00:10.000Z',
      message: { usage: { input_tokens: 3, output_tokens: 7 } },
    }),
  ].join('\n'));

  const r = await fire('subagent-stop.mjs', {
    session_id: 's1', cwd: root, hook_event_name: 'SubagentStop', stop_hook_active: false,
    agent_id: 'ag-1', agent_type: 'general-purpose', agent_transcript_path: tp,
    last_assistant_message: '我把三个文件改好了',
  });
  assert.equal(r.code, 0, r.stderr);

  const [e] = await events(root);
  assert.equal(e.kind, 'run');
  assert.equal(e.actor, 'subagent:general-purpose');
  assert.equal(e.subject, 'ag-1');
  assert.equal(e.payload.op, 'subagent');
  assert.equal(e.payload.costSource, 'transcript');
  assert.equal(e.payload.turns, 2);
  assert.deepEqual(e.cost, { tokens: 1612, ms: 10000 });
  // 子代理的收尾发言是自称，必须带 saidBy 标记，不能混成事实
  assert.equal(e.payload.report.saidBy, 'subagent');
  assert.equal(e.payload.report.text, '我把三个文件改好了');
});

test('SubagentStop：拿不到成本时如实记 unavailable，绝不填 0', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  const r = await fire('subagent-stop.mjs', {
    cwd: root, agent_id: 'ag-2', agent_type: 'Explore',
    agent_transcript_path: path.join(root, '不存在.jsonl'),
  });
  assert.equal(r.code, 0, r.stderr);
  const [e] = await events(root);
  assert.equal(e.payload.costSource, 'unavailable');
  assert.match(e.payload.costNote, /本环境无成本数据/);
  assert.equal(e.cost, undefined, '没测到就不能有 cost 字段——0 会被当成「没花钱」');
  assert.equal(e.payload.turns, null);
});

test('SubagentStop：连 agent_transcript_path 都没有时同样如实记', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  await fire('subagent-stop.mjs', { cwd: root, agent_id: 'ag-3', agent_type: 'x' });
  const [e] = await events(root);
  assert.equal(e.payload.costSource, 'unavailable');
  assert.match(e.payload.costNote, /未提供 agent_transcript_path/);
});

test('SubagentStop：认领了却没达标 → 打回，两种认领形态都要扫到', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  // 真写盘：一条有证据但不够硬，一条压根没证据
  await seedClaim(root, 'ui-list', { need: 'executed', evidence: 'derived' });
  await seedClaim(root, 'api-list', { need: 'derived' });
  const tp = await agentLog(root, [
    TOOL_USE('mcp__vima__claim', { claimId: 'ui-list' }),            // MCP 形态
    TOOL_USE('Bash', { command: 'vima claim api-list && npm test' }), // Bash 形态
  ]);

  const r = await fire('subagent-stop.mjs', {
    cwd: root, hook_event_name: 'SubagentStop', stop_hook_active: false,
    agent_id: 'ag-b1', agent_type: 'builder', agent_transcript_path: tp,
    last_assistant_message: '都做完了',
  });
  assert.equal(r.code, 0, r.stderr);
  assert.notEqual(r.code, 2, '打回走 stdout 的 decision，不靠 exit 2');

  const out = JSON.parse(r.stdout);
  // 形状按文档「Stop decision control」：顶层 decision:"block" + reason。
  // 塞进 hookSpecificOutput 的 decision 会被无视——那是静默失效，测这里就是为了防它。
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /ui-list/);
  assert.match(out.reason, /需要 ≥ executed，当前 derived/);
  assert.match(out.reason, /api-list/);
  assert.match(out.reason, /当前 none/);
  assert.match(out.reason, /vima submit ui-list/, '话术必须给出下一条命令');
  assert.match(out.reason, /vima submit api-list/);

  const e = (await events(root)).at(-1);
  assert.equal(e.payload.op, 'subagent', '打回也要照常记账');
  assert.equal(e.payload.blocked, true);
  assert.deepEqual(e.payload.claimed.sort(), ['api-list', 'ui-list']);
  assert.equal(e.payload.claimScan, 'scanned');
  assert.deepEqual(
    e.payload.unmet.map((u) => `${u.id}:${u.need}:${u.got}`).sort(),
    ['api-list:derived:none', 'ui-list:executed:derived'],
  );
});

test('SubagentStop：认领的都达标了 → 不打回', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  await seedClaim(root, 'ui-list', { need: 'derived', evidence: 'executed' });
  const tp = await agentLog(root, [TOOL_USE('mcp__vima__claim', { claimId: 'ui-list' })]);

  const r = await fire('subagent-stop.mjs', {
    cwd: root, agent_id: 'ag-b2', agent_type: 'builder', agent_transcript_path: tp,
  });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout, '', '达标了还打回，就是在教人关掉这个 hook');
  const e = (await events(root)).at(-1);
  assert.equal(e.payload.blocked, false);
  assert.deepEqual(e.payload.claimed, ['ui-list']);
  assert.equal(e.payload.unmet, undefined);
});

test('SubagentStop：一条都没认领 → 不打回（只读子代理不该被卡住）', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  await seedClaim(root, 'ui-list', { need: 'executed' }); // 没达标，但这个子代理没认领它
  const tp = await agentLog(root, [TOOL_USE('Read', { file_path: '/x/y.ts' })]);

  const r = await fire('subagent-stop.mjs', {
    cwd: root, agent_id: 'ag-r1', agent_type: 'Explore', agent_transcript_path: tp,
  });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout, '', '「没认领」和「认领了没做完」是两回事');
  const e = (await events(root)).at(-1);
  assert.equal(e.payload.blocked, false);
  assert.deepEqual(e.payload.claimed, []);
});

test('SubagentStop：stop_hook_active 为真时不再打回（防死循环），但必须留痕', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  await seedClaim(root, 'ui-list', { need: 'executed', evidence: 'derived' });
  const tp = await agentLog(root, [TOOL_USE('mcp__vima__claim', { claimId: 'ui-list' })]);

  const r = await fire('subagent-stop.mjs', {
    cwd: root, agent_id: 'ag-b3', agent_type: 'builder', agent_transcript_path: tp,
    stop_hook_active: true,
  });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout, '', '已经因 hook 续过一轮，再打回就是死循环');
  const e = (await events(root)).at(-1);
  assert.equal(e.payload.blocked, false);
  assert.equal(e.payload.blockSuppressed, 'stop_hook_active',
    '放行的理由必须留痕，否则回放时「没打回」会被读成「没问题」');
  assert.equal(e.payload.unmet.length, 1, '没打回不等于没查出问题，清单照记');
});

test('SubagentStop：读不到转录 → 不打回，但记明「没法核」而不是「核过了」', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  await seedClaim(root, 'ui-list', { need: 'executed' });

  const r = await fire('subagent-stop.mjs', {
    cwd: root, agent_id: 'ag-b4', agent_type: 'builder',
    agent_transcript_path: path.join(root, '不存在.jsonl'),
  });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout, '');
  const e = (await events(root)).at(-1);
  assert.equal(e.payload.claimScan, 'unavailable');
  assert.match(e.payload.claimScanNote, /没法核认领/);
  assert.match(e.payload.claimScanNote, /不是核过了/);
  assert.equal(e.payload.blocked, false);
});

test('SubagentStop：认领了一条不存在的命题时不打回，但把它记下来', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  const tp = await agentLog(root, [TOOL_USE('mcp__vima__claim', { claimId: 'ghost' })]);
  await fire('subagent-stop.mjs', {
    cwd: root, agent_id: 'ag-b5', agent_type: 'builder', agent_transcript_path: tp,
  });
  const e = (await events(root)).at(-1);
  assert.deepEqual(e.payload.unknownClaims, ['ghost'], '核不了的要能被 audit 看见');
  assert.equal(e.payload.blocked, false);
});

test('SubagentStart：记派工，actor/subject 与 SubagentStop 同形（配对算墙钟靠它）', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  const r = await fire('subagent-start.mjs', {
    session_id: 's7', transcript_path: '/x', cwd: root,
    hook_event_name: 'SubagentStart', agent_id: 'agent-abc123', agent_type: 'Explore',
  });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout, '', '派工不注入上下文');

  const [e] = await events(root);
  assert.equal(e.kind, 'run');
  assert.equal(e.actor, 'subagent:Explore');
  assert.equal(e.subject, 'agent-abc123');
  assert.equal(e.payload.op, 'subagent-start');
  assert.equal(e.payload.agentType, 'Explore');
  assert.equal(e.payload.sessionId, 's7');
  assert.equal(e.cost, undefined, '派工那一刻还没有耗用，写 { ms: 0 } 会被聚合成「花了 0」');
});

test('SubagentStart：Start 与 Stop 能按 agent_id 配对出真实墙钟', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = { cwd: root, agent_id: 'ag-pair', agent_type: 'builder' };
  await fire('subagent-start.mjs', input);
  await fire('subagent-stop.mjs', input);
  const es = await events(root);
  assert.equal(es.length, 2);
  const [start, stop] = es;
  assert.equal(start.actor, stop.actor, 'actor 不同形就配不上对');
  assert.equal(start.subject, stop.subject);
  assert.ok(Date.parse(stop.ts) >= Date.parse(start.ts));
});

test('PostToolUseFailure：跑红的 Bash 也进日志（只记成功等于只记好看的那一半）', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  const r = await fire('post-tool-use-failure.mjs', {
    session_id: 's8', cwd: root, hook_event_name: 'PostToolUseFailure',
    tool_name: 'Bash', tool_input: { command: 'npm test', description: '跑测试' },
    tool_use_id: 'toolu_1', error: "Exit code 1\nError: Cannot find module 'express'",
    is_interrupt: false, duration_ms: 4187,
  });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout, '', '只观测，不改变流程');

  const [e] = await events(root);
  assert.equal(e.kind, 'run');
  assert.equal(e.actor, 'agent:main');
  assert.equal(e.payload.op, 'tool-failed');
  assert.equal(e.payload.tool, 'Bash');
  assert.equal(e.payload.toolUseId, 'toolu_1');
  assert.equal(e.payload.command, 'npm test');
  assert.match(e.payload.error, /Exit code 1/);
  assert.equal(e.payload.errorTruncated, false);
  assert.equal(e.payload.interrupt, undefined);
  assert.deepEqual(e.cost, { ms: 4187 });
});

test('PostToolUseFailure：错误文本截断并标记，不把整段输出塞进事件', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  await fire('post-tool-use-failure.mjs', {
    cwd: root, tool_name: 'Edit', tool_input: { file_path: path.join(root, 'src', 'a.ts') },
    error: `Exit code 1 ${'x'.repeat(5000)}`,
    agent_id: 'ag-9', agent_type: 'builder',
  });
  const [e] = await events(root);
  assert.equal(e.actor, 'subagent:builder');
  assert.equal(e.subject, 'src/a.ts', '文件类失败照样记到项目内相对路径');
  assert.equal(e.payload.errorTruncated, true);
  assert.ok(e.payload.error.length <= 600, `错误文本没截住：${e.payload.error.length} 字符`);
});

test('PostToolUseFailure：环境没给错误文本时记 null + 原因，不写空串充数', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  await fire('post-tool-use-failure.mjs', { cwd: root, tool_name: 'Bash', tool_input: { command: 'x' } });
  const [e] = await events(root);
  assert.equal(e.payload.error, null);
  assert.match(e.payload.errorNote, /没有可读的错误文本/);
});

test('PostToolUseFailure：不在 vima 项目里就静默放行', async (t) => {
  const plain = await mkdtemp(path.join(tmpdir(), 'vima-plain-'));
  t.after(() => rm(plain, { recursive: true, force: true }));
  const r = await fire('post-tool-use-failure.mjs', { cwd: plain, tool_name: 'Bash', tool_input: { command: 'x' }, error: 'boom' });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
});

test('SessionStart：注入项目状态，含前沿层与待复核裁定', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  await seed(root, [
    CLAIM('i1', 'intent'),
    { id: 'ev1', ts: '2026-08-16T00:00:01.000Z', kind: 'evidence', actor: 'system', subject: 'i1', payload: { strength: 'executed', by: 'test' } },
    CLAIM('s1', 'spec'),
    CLAIM('s2', 'spec'),
    {
      id: 'r1', ts: '2026-08-16T00:00:02.000Z', kind: 'ruling', actor: 'agent:main', subject: null,
      payload: { question: '时间字段用 UTC 还是本地时区', chosen: 'UTC', confidence: 'low', blastRadius: '全站' },
    },
  ]);

  const r = await fire('session-start.mjs', {
    session_id: 's1', cwd: root, hook_event_name: 'SessionStart', source: 'startup', model: 'x',
  });
  assert.equal(r.code, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  const ctx = out.hookSpecificOutput.additionalContext;
  assert.match(ctx, /演示项目/);
  assert.match(ctx, /enterprise-blue/);
  assert.match(ctx, /命题 1\/3 达标/);
  assert.match(ctx, /当前前沿 \*\*spec\*\*/);
  assert.match(ctx, /时间字段用 UTC 还是本地时区/);
  assert.match(ctx, /置信度 low · 影响面 全站/);
});

test('SessionStart：不是 vima 项目就什么都不注入', async (t) => {
  const plain = await mkdtemp(path.join(tmpdir(), 'vima-plain-'));
  t.after(() => rm(plain, { recursive: true, force: true }));
  const r = await fire('session-start.mjs', { cwd: plain, source: 'startup' });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
});

test('UserPromptSubmit：注入前沿与待裁决项，且刻意压短', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  await seed(root, [
    CLAIM('c1', 'contract'),
    CLAIM('c2', 'contract'),
    { id: 'r1', ts: '2026-08-16T00:00:02.000Z', kind: 'ruling', actor: 'agent:main', subject: null, payload: { question: '分页用游标', chosen: '游标', confidence: 'medium' } },
  ]);
  const r = await fire('user-prompt-submit.mjs', {
    session_id: 's1', cwd: root, hook_event_name: 'UserPromptSubmit', prompt: '继续', source: 'user',
  });
  assert.equal(r.code, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  const ctx = out.hookSpecificOutput.additionalContext;
  assert.match(ctx, /命题 0\/2 达标/);
  assert.match(ctx, /前沿 contract/);
  assert.match(ctx, /分页用游标/);
  assert.ok(ctx.split('\n').length <= 5, `每轮都注入的东西必须短，实际 ${ctx.split('\n').length} 行`);
});

test('UserPromptSubmit：空项目不注入噪音', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  const r = await fire('user-prompt-submit.mjs', { cwd: root, prompt: 'hi' });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
});

test('找不到 vima 内核时：喊出来（stderr + exit 1），不静默失败，也不阻塞（不是 exit 2）', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'e.ts');
  await writeFile(file, 'x');
  const r = await fire('post-tool-use.mjs',
    { cwd: root, tool_name: 'Write', tool_input: { file_path: file } },
    { VIMA_HOME: '/nonexistent-vima-home', PATH: '/nonexistent-bin' });
  assert.equal(r.code, 1, '必须是非零非 2：非阻塞错误，用户看得见');
  assert.notEqual(r.code, 2);
  assert.match(r.stderr, /找不到 vima 内核/);
  assert.match(r.stderr, /VIMA_HOME/);
});

// ── 未认领就改代码（堵住「不调 claim 就能绕过闸门」）─────────────────────

test('SubagentStop：改了项目代码却一条都没认领 → 打回，并列出改了哪些文件', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  const tp = await agentLog(root, [
    TOOL_USE('Edit', { file_path: `${root}/apps/web/src/LoginPage.vue` }),
    TOOL_USE('Write', { file_path: `${root}/apps/api/UserController.java` }),
  ]);

  const r = await fire('subagent-stop.mjs', {
    cwd: root, agent_id: 'ag-u1', agent_type: 'vima-builder', agent_transcript_path: tp,
  });
  assert.equal(r.code, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.decision, 'block', '不认领就能走，闸门等于不存在');
  assert.match(out.reason, /apps\/web\/src\/LoginPage\.vue/, '要指名改了什么，不能只说「你没认领」');
  assert.match(out.reason, /vima claim/, '要给出正常做法');
  assert.match(out.reason, /vima rule/, '必须留出口——没有出口的闸门会被整段删掉');

  const e = (await events(root)).at(-1);
  assert.equal(e.payload.blocked, true);
  assert.equal(e.payload.unclaimedWork, true);
  assert.deepEqual(e.payload.touched, ['apps/api/UserController.java', 'apps/web/src/LoginPage.vue']);
});

test('SubagentStop：只写 docs/ 不算——规格真源本来就先于命题存在', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  const tp = await agentLog(root, [
    TOOL_USE('Write', { file_path: `${root}/docs/spec/login.md` }),
    TOOL_USE('Write', { file_path: `${root}/.vima/rules/x.md` }),
    TOOL_USE('Write', { file_path: `${root}/.claude/skills/y/SKILL.md` }),
  ]);

  const r = await fire('subagent-stop.mjs', {
    cwd: root, agent_id: 'ag-u2', agent_type: 'vima-intake', agent_transcript_path: tp,
  });
  assert.equal(r.stdout, '', 'intake 写 docs/ 时还没有命题可认领，拦它等于让 intake 无法收工');
  const e = (await events(root)).at(-1);
  assert.equal(e.payload.blocked, false);
  assert.equal(e.payload.touched, undefined, '被豁免的写入不该进 touched');
});

test('SubagentStop：改项目外的文件不算本项目的账', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  const tp = await agentLog(root, [TOOL_USE('Write', { file_path: '/tmp/scratch/notes.ts' })]);

  const r = await fire('subagent-stop.mjs', {
    cwd: root, agent_id: 'ag-u3', agent_type: 'vima-builder', agent_transcript_path: tp,
  });
  assert.equal(r.stdout, '', '项目外的写入拦下来只会让人困惑');
});

test('SubagentStop：认领了就走原来那条判据，不重复拦', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  await seedClaim(root, 'ui-list', { need: 'derived', evidence: 'derived' });
  const tp = await agentLog(root, [
    TOOL_USE('Bash', { command: 'vima claim ui-list' }),
    TOOL_USE('Edit', { file_path: `${root}/apps/web/src/List.vue` }),
  ]);

  const r = await fire('subagent-stop.mjs', {
    cwd: root, agent_id: 'ag-u4', agent_type: 'vima-builder', agent_transcript_path: tp,
  });
  assert.equal(r.stdout, '', '认领了且达标了就该放行');
  const e = (await events(root)).at(-1);
  assert.equal(e.payload.unclaimedWork, undefined);
  assert.deepEqual(e.payload.touched, ['apps/web/src/List.vue'], '放行也要记下改了什么');
});

test('SubagentStop：读不到转录时不因「没认领」打回——那是没法核，不是没改', async (t) => {
  const root = await makeProject();
  t.after(() => rm(root, { recursive: true, force: true }));
  const r = await fire('subagent-stop.mjs', {
    cwd: root, agent_id: 'ag-u5', agent_type: 'vima-builder',
    agent_transcript_path: `${root}/.vima/nope.jsonl`,
  });
  assert.equal(r.stdout, '', 'fail-open：核不了就不拦');
  const e = (await events(root)).at(-1);
  assert.equal(e.payload.claimScan, 'unavailable');
  assert.equal(e.payload.unclaimedWork, undefined);
});
