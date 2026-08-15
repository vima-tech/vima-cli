#!/usr/bin/env node
// 生成 stable admin 三端项目并执行真实构建；CI 与 npm 发布前共用这一条验收链。
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = mkdtempSync(path.join(tmpdir(), 'vima-stable-scaffold-'));
const project = path.join(sandbox, 'ci-stable');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const mvnw = process.platform === 'win32' ? 'mvnw.cmd' : './mvnw';

function run(command, args, cwd) {
  process.stdout.write(`\n> ${command} ${args.join(' ')}\n`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} 退出码 ${result.status}`);
}

try {
  run(process.execPath, [
    path.join(root, 'bin', 'vima.mjs'), 'create', 'ci-stable',
    '--template', 'admin',
    '--apps', 'admin:admin-web,mp:mp-native,h5:h5-mobile',
    '--no-git', '--no-install',
  ], sandbox);
  run(npm, ['install'], path.join(project, 'apps', 'admin'));
  run(npm, ['run', 'build:check'], path.join(project, 'apps', 'admin'));
  run(npm, ['install'], path.join(project, 'apps', 'h5'));
  run(npm, ['run', 'build:check'], path.join(project, 'apps', 'h5'));
  run(npm, ['install'], path.join(project, 'apps', 'mp'));
  run(npm, ['run', 'typecheck'], path.join(project, 'apps', 'mp'));
  run(npm, ['audit'], path.join(project, 'apps', 'mp'));
  run(mvnw, ['test'], path.join(project, 'backend'));
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
