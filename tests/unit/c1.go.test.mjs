// C1 单测：vima go —— 从任意项目子目录锚定根目录启动全新 Claude /go 会话。
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runCli } from '../helpers.mjs';

async function project(t, { skill = true } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'vima-c1-go-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.vima'), { recursive: true });
  await writeFile(path.join(root, '.vima', 'manifest.json'), '{"templateId":"admin"}\n');
  if (skill) {
    await mkdir(path.join(root, '.claude', 'skills', 'go'), { recursive: true });
    await writeFile(path.join(root, '.claude', 'skills', 'go', 'SKILL.md'), '---\ndescription: go\n---\n');
  }
  const subdir = path.join(root, 'apps', 'admin');
  await mkdir(subdir, { recursive: true });
  return { root, subdir };
}

test('go --dry-run：从子目录定位项目根，并展示确定的全新 /go 启动命令', async (t) => {
  const { root, subdir } = await project(t);
  const proc = runCli(['go', '--dry-run', '--commit'], { cwd: subdir });
  assert.equal(proc.status, 0, proc.stderr);
  assert.match(proc.stderr, /已定位项目根/);
  assert.match(proc.stdout, new RegExp(`项目根：${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(proc.stdout, /claude "\/go --commit"/);
  assert.match(proc.stdout, /全新交互会话/);
});

test('go：真实启动时把 Claude cwd 锚定项目根，并传入 /go 初始提示', async (t) => {
  const { root, subdir } = await project(t);
  const fakeBin = await mkdtemp(path.join(os.tmpdir(), 'vima-fake-claude-'));
  t.after(() => rm(fakeBin, { recursive: true, force: true }));
  const fake = path.join(fakeBin, 'claude');
  await writeFile(fake, '#!/bin/sh\nprintf "cwd=%s\\narg=%s\\n" "$PWD" "$1"\n');
  await chmod(fake, 0o755);

  const proc = runCli(['go'], { cwd: subdir, env: { PATH: `${fakeBin}:${process.env.PATH}` } });
  assert.equal(proc.status, 0, proc.stderr);
  assert.match(proc.stdout, new RegExp(`cwd=${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(proc.stdout, /arg=\/go/);
});

test('go：缺正式 skill 时稳定报 GO_SKILL_MISSING，提示 update', async (t) => {
  const { root } = await project(t, { skill: false });
  const proc = runCli(['go', '--dry-run'], { cwd: root });
  assert.equal(proc.status, 4);
  assert.match(proc.stderr, /^vima go: GO_SKILL_MISSING:/);
  assert.match(proc.stderr, /vima update/);
});

test('go：PATH 中没有 Claude Code 时稳定报 CLAUDE_NOT_FOUND', async (t) => {
  const { root } = await project(t);
  const proc = runCli(['go'], { cwd: root, env: { PATH: '' } });
  assert.equal(proc.status, 4);
  assert.match(proc.stderr, /^vima go: CLAUDE_NOT_FOUND:/);
});

test('go：拒绝未知选项与位置参数', async (t) => {
  const { root } = await project(t);
  for (const args of [['go', '--bogus'], ['go', 'extra']]) {
    const proc = runCli(args, { cwd: root });
    assert.equal(proc.status, 3, `${args.join(' ')}: ${proc.stderr}`);
  }
});
