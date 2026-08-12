// C2 单测：vima doctor 体检项（设计 §19.4）——重点断言 ②④ 的 ✅/❌ 翻转与 exit 码
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, cp, mkdir, writeFile, readFile, chmod, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(HERE, '..', '..', 'bin', 'vima.mjs');
const GOLDEN = path.join(HERE, '..', 'fixtures', 'golden');

function runCli(cwd, args) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
}

/** 人造小夹具：黄金 docs（lifecycle+tasks）+ 合规 CLAUDE.md + 完整 .claude 目录。 */
async function makeProject(t) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'vima-c2-doctor-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));
  await cp(path.join(GOLDEN, 'docs'), path.join(tmp, 'docs'), { recursive: true });

  // 合规 CLAUDE.md（10 行）
  await writeFile(path.join(tmp, 'CLAUDE.md'), Array.from({ length: 10 }, (_, i) => `# 第 ${i + 1} 行`).join('\n') + '\n');

  // 完整 .claude：settings + 2 命令 + 3 角色 + 2 hooks（可执行）
  const files = {
    '.claude/settings.json': '{}\n',
    '.claude/commands/go.md': '# /go\n',
    '.claude/commands/check.md': '# /check\n',
    '.claude/agents/vima-builder.md': '# builder\n',
    '.claude/agents/vima-verifier.md': '# verifier\n',
    '.claude/agents/vima-planner.md': '# planner\n',
    '.claude/hooks/guard-shared.sh': '#!/bin/bash\nexit 0\n',
    '.claude/hooks/post-write.sh': '#!/bin/bash\nexit 0\n',
  };
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(tmp, rel);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, content);
  }
  await chmod(path.join(tmp, '.claude/hooks/guard-shared.sh'), 0o755);
  await chmod(path.join(tmp, '.claude/hooks/post-write.sh'), 0o755);
  return tmp;
}

/** 取 stdout 中某个检查项所在行。 */
function lineOf(stdout, label) {
  const line = stdout.split('\n').find((l) => l.includes(label));
  assert.ok(line, `输出应含 "${label}" 检查行：\n${stdout}`);
  return line;
}

test('doctor：健康夹具 → exit 0，②④ 为 ✅', async (t) => {
  const tmp = await makeProject(t);
  const proc = runCli(tmp, ['doctor']);
  assert.equal(proc.status, 0, `stdout: ${proc.stdout}\nstderr: ${proc.stderr}`);
  assert.match(lineOf(proc.stdout, '② CLAUDE.md'), /^✅/);
  assert.match(lineOf(proc.stdout, '④ taskStats'), /^✅/);
  assert.match(proc.stdout, /✅ 体检通过/);
});

test('doctor：CLAUDE.md 超 50 行 → ② ⚠️ 告警（§5.4），不改变退出码', async (t) => {
  const tmp = await makeProject(t);
  await writeFile(path.join(tmp, 'CLAUDE.md'), Array.from({ length: 51 }, (_, i) => `第 ${i + 1} 行`).join('\n') + '\n');

  const proc = runCli(tmp, ['doctor']);
  assert.equal(proc.status, 0, `stdout: ${proc.stdout}\nstderr: ${proc.stderr}`);
  assert.match(lineOf(proc.stdout, '② CLAUDE.md'), /^⚠️/);
  assert.match(lineOf(proc.stdout, '② CLAUDE.md'), /51 行/);
});

test('doctor：taskStats 与 frontmatter 不一致 → ④ ❌、提示 vima sync 且 exit 2', async (t) => {
  const tmp = await makeProject(t);
  const p = path.join(tmp, 'docs', 'lifecycle.json');
  const lifecycle = JSON.parse(await readFile(p, 'utf8'));
  lifecycle.taskStats.done = 3; // 实际 done=1
  await writeFile(p, JSON.stringify(lifecycle, null, 2));

  const proc = runCli(tmp, ['doctor']);
  assert.equal(proc.status, 2);
  const line = lineOf(proc.stdout, '④ taskStats');
  assert.match(line, /^❌/);
  assert.match(line, /vima sync/);
});

test('doctor：hooks 缺可执行位 → ⑦ ❌ 且 exit 2', async (t) => {
  const tmp = await makeProject(t);
  await chmod(path.join(tmp, '.claude/hooks/guard-shared.sh'), 0o644);

  const proc = runCli(tmp, ['doctor']);
  assert.equal(proc.status, 2);
  assert.match(lineOf(proc.stdout, '⑦ hooks'), /^❌/);
});

test('doctor --json：结构化输出（9 个检查项 + pass 标志）', async (t) => {
  const tmp = await makeProject(t);
  const proc = runCli(tmp, ['doctor', '--json']);
  assert.equal(proc.status, 0, `stdout: ${proc.stdout}`);
  const report = JSON.parse(proc.stdout);
  assert.equal(report.schemaVersion, '1');
  assert.equal(report.vimaProject, true);
  assert.equal(report.pass, true);
  assert.equal(report.checks.length, 9);
  for (const c of report.checks) {
    assert.ok(['ok', 'warn', 'error'].includes(c.status), `非法 status: ${c.status}`);
    assert.equal(typeof c.detail, 'string');
  }
  const stats = report.checks.find((c) => c.id === 'task-stats');
  assert.equal(stats.status, 'ok');
});

test('doctor：非 vima 项目（无 lifecycle 无 manifest）→ 只跑 ①② 并注明', async (t) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'vima-c2-doctor-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));

  const proc = runCli(tmp, ['doctor']);
  assert.equal(proc.status, 0, `stdout: ${proc.stdout}\nstderr: ${proc.stderr}`);
  assert.match(proc.stdout, /非 vima 项目/);

  const json = runCli(tmp, ['doctor', '--json']);
  const report = JSON.parse(json.stdout);
  assert.equal(report.vimaProject, false);
  assert.deepEqual(report.checks.map((c) => c.id), ['prerequisites', 'claude-md']);
});
