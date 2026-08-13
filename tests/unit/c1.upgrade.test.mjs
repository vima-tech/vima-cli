// C1 单测：vima upgrade —— 升级 CLI 自身（A15）
// 全程不联网：一律注入 VIMA_UPGRADE_LATEST 短路 registry 请求（契约 §13）。
// 安装器永不会被真正执行——测试跑在本仓库内，cliRoot 有 .git → kind=source → 拒绝安装。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli, CLI_ROOT } from '../helpers.mjs';
import { compareSemver, detectInstallKind } from '../../lib/commands/upgrade.mjs';

/** 期望值来自 package.json 而非实现（A10 同构断言禁令）。 */
async function cliVersion() {
  const { readFile } = await import('node:fs/promises');
  return JSON.parse(await readFile(path.join(CLI_ROOT, 'package.json'), 'utf8')).version;
}

async function emptyDir(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-c1-selfup-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

function upgrade(args, { cwd, latest }) {
  return runCli(['upgrade', ...args], { cwd, env: { VIMA_UPGRADE_LATEST: latest } });
}

test('compareSemver：大小与相等（期望值为人工列举，非实现推导）', () => {
  assert.equal(compareSemver('2.2.0', '2.1.0'), 1);
  assert.equal(compareSemver('2.1.0', '2.2.0'), -1);
  assert.equal(compareSemver('2.1.0', '2.1.0'), 0);
  assert.equal(compareSemver('10.0.0', '9.9.9'), 1, '按数值比较而非字典序');
  assert.equal(compareSemver('2.1.1', '2.1.0'), 1);
});

test('detectInstallKind：按 cliRoot 路径与 .git 判定安装方式（A15 规格 2）', async (t) => {
  const box = await emptyDir(t);

  // 1. 有 .git → 源码 / npm link 开发态
  const src = path.join(box, 'src-checkout');
  await mkdir(path.join(src, '.git'), { recursive: true });
  assert.equal(await detectInstallKind(src), 'source');

  // 2. npx 缓存路径
  const npx = path.join(box, '.npm/_npx/abc123/node_modules/@vima-tech/cli');
  await mkdir(npx, { recursive: true });
  assert.equal(await detectInstallKind(npx), 'npx');

  // 3. pnpm 全局 store 路径
  const pnpm = path.join(box, 'store/node_modules/.pnpm/@vima-tech+cli@2.1.0/node_modules/@vima-tech/cli');
  await mkdir(pnpm, { recursive: true });
  assert.equal(await detectInstallKind(pnpm), 'pnpm');

  // 4. bun 全局路径
  const bun = path.join(box, '.bun/install/global/node_modules/@vima-tech/cli');
  await mkdir(bun, { recursive: true });
  assert.equal(await detectInstallKind(bun), 'bun');

  // 5. 其余按 npm 全局
  const npm = path.join(box, 'usr/lib/node_modules/@vima-tech/cli');
  await mkdir(npm, { recursive: true });
  assert.equal(await detectInstallKind(npm), 'npm');
});

test('upgrade：已是最新 → 报告并 exit 0（--yes 也不执行安装器）', async (t) => {
  const dir = await emptyDir(t);
  const version = await cliVersion();
  for (const args of [[], ['--yes']]) {
    const r = upgrade(args, { cwd: dir, latest: version });
    assert.equal(r.status, 0, `vima upgrade ${args.join(' ')} 应 exit 0，stderr: ${r.stderr}`);
    assert.match(r.stdout, /已是最新版本/);
    assert.match(r.stdout, new RegExp(`当前版本\\s+${version.replace(/\./g, '\\.')}`));
  }
});

test('upgrade：有新版且默认不装 → 打印升级指令，exit 0', async (t) => {
  const dir = await emptyDir(t);
  const r = upgrade([], { cwd: dir, latest: '99.0.0' });
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /最新版本\s+99\.0\.0/);
  assert.match(r.stdout, /有新版本 99\.0\.0/);
  assert.doesNotMatch(r.stdout, /正在执行/, '不带 --yes 绝不执行安装器');
});

test('upgrade --yes：源码/开发态不可自升级 → exit 4 UPGRADE_UNSUPPORTED', async (t) => {
  // 本仓库即源码态（CLI_ROOT 下有 .git），安装器不会被执行
  const dir = await emptyDir(t);
  const r = upgrade(['--yes'], { cwd: dir, latest: '99.0.0' });
  assert.equal(r.status, 4, `stdout: ${r.stdout}\nstderr: ${r.stderr}`);
  assert.match(r.stderr, /^vima upgrade: UPGRADE_UNSUPPORTED: /);
  assert.match(r.stdout, /git pull/, '应给出源码态的正确升级指令');
});

test('upgrade：源码态不带 --yes 只是报告，exit 0（开发者查版本不是错误）', async (t) => {
  const dir = await emptyDir(t);
  const r = upgrade([], { cwd: dir, latest: '99.0.0' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /无法自升级/);
});

test('upgrade --dry-run：A15 过渡兼容，2.x 老用法不报错', async (t) => {
  const dir = await emptyDir(t);
  const r = upgrade(['--dry-run'], { cwd: dir, latest: '99.0.0' });
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /最新版本\s+99\.0\.0/);
});

test('upgrade：在 vima 项目里运行 → 追加指向 vima update 的迁移提示', async (t) => {
  const dir = await emptyDir(t);
  await mkdir(path.join(dir, '.vima'), { recursive: true });
  await writeFile(path.join(dir, '.vima/manifest.json'), '{}\n');

  const inProject = upgrade([], { cwd: dir, latest: '99.0.0' });
  assert.equal(inProject.status, 0, `stderr: ${inProject.stderr}`);
  assert.match(inProject.stdout, /vima update/, '项目内应提示产物更新的正确命令');

  const outside = upgrade([], { cwd: await emptyDir(t), latest: '99.0.0' });
  assert.doesNotMatch(outside.stdout, /vima update/, '非 vima 项目不追加迁移提示');
});

test('upgrade：多余位置参数 → exit 3 USAGE', async (t) => {
  const dir = await emptyDir(t);
  const r = upgrade(['extra'], { cwd: dir, latest: '99.0.0' });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /多余的位置参数 "extra"/);
});
