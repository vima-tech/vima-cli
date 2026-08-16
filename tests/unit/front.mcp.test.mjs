// MCP 门面测试：initialize · tools/list · tools/call 三个 JSON-RPC 往返，
// 既走内存处理器（快、可断言细节），也走真进程 stdio（证明分帧与 stdout 洁净）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createHandler, TOOLS, PROTOCOL_VERSIONS } from '../../lib/front/mcp.mjs';
import { append } from '../../lib/core/events.mjs';

const BIN = fileURLToPath(new URL('../../bin/vima.mjs', import.meta.url));
const NOW = new Date('2026-08-16T00:00:00.000Z');

function cleanEnv() {
  const env = { ...process.env };
  delete env.VIMA_PROJECT_DIR;
  delete env.CLAUDE_PROJECT_DIR;
  return env;
}

async function tmpProject() {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-mcp-'));
  await mkdir(path.join(dir, '.vima'), { recursive: true });
  return dir;
}

function handlerFor(cwd) {
  return createHandler({ cwd, env: cleanEnv(), now: () => NOW });
}

test('initialize：回协议版本、能力与 serverInfo；客户端版本在表里就照它回', async () => {
  const h = handlerFor(process.cwd());
  const r = await h({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', clientInfo: { name: 'claude-code' }, capabilities: {} } });
  assert.equal(r.jsonrpc, '2.0');
  assert.equal(r.id, 1);
  assert.equal(r.result.protocolVersion, '2024-11-05');
  assert.equal(r.result.serverInfo.name, 'vima');
  assert.ok(r.result.capabilities.tools);
  // instructions 是运行时**真发给 agent** 的话，口径必须与威胁模型表一致：
  // 承诺得起的是「正式接口不采信自述」，承诺不起的是「你写不了事件」。
  // 这里正着反着各钉一条——只钉正面的话，旧口径悄悄加回来也照样绿。
  assert.match(r.result.instructions, /不能通过正式接口提交证据结论/);
  assert.doesNotMatch(r.result.instructions, /不能写事件/,
    '这句超出实际能力：拥有 Write/Bash 的 agent 物理上改得了 events.jsonl');

  const unknown = await h({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
  assert.equal(unknown.result.protocolVersion, PROTOCOL_VERSIONS[0]);

  // 通知不回
  assert.equal(await h({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
});

test('tools/list：刻意只有五个工具，每个都说清什么时候用', async () => {
  const h = handlerFor(process.cwd());
  const r = await h({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const names = r.result.tools.map((t) => t.name);
  assert.deepEqual(names, ['next', 'claim', 'submit', 'rule', 'ask']);
  for (const t of r.result.tools) {
    assert.ok(t.description.includes('【什么时候用】'), `${t.name} 的 description 没说什么时候用`);
    assert.equal(t.inputSchema.type, 'object');
  }
  // submit 只收 claimId：不接受任何自述，也不让 agent 指定取证方式
  const submit = TOOLS.find((t) => t.name === 'submit');
  assert.deepEqual(Object.keys(submit.inputSchema.properties), ['claimId']);
  assert.deepEqual(submit.inputSchema.required, ['claimId']);
  assert.equal(submit.inputSchema.additionalProperties, false);
});

test('tools/call next：返回 structuredContent；未知工具走协议错误', async () => {
  const root = await tmpProject();
  await append(root, { kind: 'claim', actor: 'test', subject: 'c-1', payload: { layer: 'spec', statement: '列表页要有空态', need: 'derived' } }, { now: NOW });
  const h = handlerFor(root);

  const r = await h({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'next', arguments: {} } });
  assert.equal(r.result.isError, false);
  assert.equal(r.result.structuredContent.task.id, 'c-1');
  assert.equal(JSON.parse(r.result.content[0].text).task.id, 'c-1');

  const bad = await h({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'init', arguments: {} } });
  assert.equal(bad.error.code, -32602, 'CLI 的命令不该在 MCP 上存在');
});

test('tools/call：认领 → 查询 一条链走通，事件由系统写', async () => {
  const root = await tmpProject();
  await append(root, { kind: 'claim', actor: 'test', subject: 'c-1', payload: { layer: 'spec', statement: 'X', need: 'derived' } }, { now: NOW });
  const h = handlerFor(root);
  await h({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL_VERSIONS[0], clientInfo: { name: 'tester' } } });

  const claimed = await h({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'claim', arguments: { claimId: 'c-1' } } });
  assert.equal(claimed.result.isError, false);

  const asked = await h({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ask', arguments: { claimId: 'c-1' } } });
  const d = asked.result.structuredContent;
  assert.equal(d.runs.length, 1);
  // actor 由系统按 clientInfo 生成，不由 agent 自报
  assert.equal(d.runs[0].actor, 'agent/tester');
  assert.equal(d.claim.met, false);
});

test('tools/call 失败按 isError 回，不吞成协议错误', async () => {
  const nowhere = await mkdtemp(path.join(tmpdir(), 'vima-mcp-nowhere-'));
  const h = handlerFor(nowhere);

  const r = await h({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'next', arguments: {} } });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /NO_PROJECT/);
  assert.match(r.result.content[0].text, /会话可能开在了错目录/);

  const root = await tmpProject();
  const h2 = handlerFor(root);
  const missing = await h2({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'ask', arguments: { claimId: 'nope' } } });
  assert.equal(missing.result.isError, true);
  assert.match(missing.result.content[0].text, /NOT_FOUND/);

  const noArg = await h2({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'submit', arguments: {} } });
  assert.equal(noArg.result.isError, true);
  assert.match(noArg.result.content[0].text, /claimId/);
});

test('协议边角：坏请求 / 未知方法 / ping / 批量', async () => {
  const h = handlerFor(process.cwd());
  assert.equal((await h({ id: 1, method: 'x' })).error.code, -32600);
  assert.equal((await h({ jsonrpc: '2.0', id: 1, method: 'resources/list' })).error.code, -32601);
  assert.deepEqual((await h({ jsonrpc: '2.0', id: 1, method: 'ping' })).result, {});
  const batch = await h([
    { jsonrpc: '2.0', id: 1, method: 'ping' },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  ]);
  assert.equal(batch.length, 2, '通知不产生响应');
});

test('真进程 stdio：三个往返按行分帧，stdout 只有 JSON-RPC', async () => {
  const root = await tmpProject();
  await append(root, { kind: 'claim', actor: 'test', subject: 'c-1', payload: { layer: 'spec', statement: 'X', need: 'derived' } }, { now: NOW });

  const p = spawn(process.execPath, [BIN, 'mcp'], { cwd: root, env: cleanEnv() });
  const lines = [];
  let buf = '';
  p.stdout.on('data', (c) => {
    buf += c;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) lines.push(JSON.parse(line)); // 任何非 JSON 输出都会在这里炸
    }
  });

  const send = (msg) => p.stdin.write(`${JSON.stringify(msg)}\n`);
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL_VERSIONS[0], clientInfo: { name: 'e2e' }, capabilities: {} } });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'next', arguments: {} } });
  p.stdin.end();

  const code = await new Promise((resolve) => p.on('close', resolve));
  assert.equal(code, 0);
  assert.equal(lines.length, 3, `期望 3 条响应，实得 ${JSON.stringify(lines)}`);
  assert.equal(lines[0].result.serverInfo.name, 'vima');
  assert.equal(lines[1].result.tools.length, 5);
  assert.equal(lines[2].result.structuredContent.task.id, 'c-1');
});
