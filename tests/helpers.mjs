// 测试公共 helper（契约 §13）：BIN 与 runCli 的单一来源。
// 统一用 process.execPath 而非 PATH 上的 node——engines 约束下保证测试跑在当前解释器。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');

/**
 * 跑真实 CLI。
 * @returns {{ status: number, stdout: string, stderr: string, out: string }} out 为两流合并（粗断言用）
 */
export function runCli(args, { cwd, env } = {}) {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: 'utf8',
    env: env ? { ...process.env, ...env } : process.env,
  });
  return {
    status: r.status,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    out: `${r.stdout ?? ''}${r.stderr ?? ''}`,
  };
}
