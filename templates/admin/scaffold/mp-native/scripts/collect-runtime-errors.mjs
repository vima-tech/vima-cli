#!/usr/bin/env node
/**
 * A7 运行时证据采集器（契约 §6.10 的 mp-native 通道）。
 *
 * 用 miniprogram-automator 驱动微信开发者工具跑起本端，把运行期的未捕获错误
 * 落成 `<项目根>/.vima/reports/runtime-errors.<appId>.jsonl`，
 * 给不开开发者工具的 Agent 当眼睛。
 *
 * 用法：
 *   1. 开发者工具 → 设置 → 安全设置 → 打开「服务端口」（automator 靠它连）
 *   2. npm run runtime:collect            # 采集 25 秒后退出
 *      WX_CLI=/path/to/cli npm run runtime:collect
 *
 * **诚实降级（这条比采集本身重要）**：依赖缺失 / 工具不在场 / 端口没开，
 * 一律打印原因并以 exit 0 结束，**不写空文件**——
 * 空的 runtime-errors 文件会被 /check 读成「跑过且零错误」，
 * 而真相是「根本没跑」。「没测到」和「测了没问题」不是一回事。
 */
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ID = '{{appId}}';
const DURATION_MS = Number(process.env.VIMA_COLLECT_MS || 25000);
/** 与 src/utils/report.ts 的 MARKER 一致，改一处必须改两处 */
const MARKER = '[vima-runtime]';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');

/** 向上找含 .vima/ 的最近祖先 —— 多端布局下骨架在 apps/<id>/，dev cwd 不等于项目根。 */
function findProjectRoot(from) {
  let dir = from;
  for (;;) {
    if (existsSync(path.join(dir, '.vima'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function bail(reason) {
  console.log(`[runtime:collect] 未采集：${reason}`);
  console.log('[runtime:collect] 不写空文件——/check 会如实报「该端无运行时证据通道」。');
  process.exit(0);
}

const projectRoot = findProjectRoot(appRoot);
if (!projectRoot) bail('向上没找到 .vima/，这个骨架似乎不在 vima 项目里');

const outDir = path.join(projectRoot, '.vima', 'reports');
const outFile = path.join(outDir, `runtime-errors.${APP_ID}.jsonl`);

let automator;
try {
  automator = (await import('miniprogram-automator')).default;
} catch {
  bail('miniprogram-automator 未安装（npm i 后重试）');
}

/** 开发者工具 CLI：显式环境变量优先，其次按平台猜常见安装位置。Linux 无官方开发者工具。 */
function resolveCli() {
  if (process.env.WX_CLI) return process.env.WX_CLI;
  if (process.platform === 'darwin') {
    return '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
  }
  if (process.platform === 'win32') {
    return 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
  }
  return null;
}

const cliPath = resolveCli();
if (!cliPath) bail(`${process.platform} 上没有微信开发者工具（可用 WX_CLI 指定 cli 路径）`);
if (!existsSync(cliPath)) bail(`开发者工具 CLI 不在 ${cliPath}（可用 WX_CLI 覆盖）`);

let miniProgram;
try {
  miniProgram = await automator.launch({ cliPath, projectPath: appRoot });
} catch (err) {
  bail(`启动开发者工具失败：${err && err.message ? err.message : err}（多半是「服务端口」没打开）`);
}

mkdirSync(outDir, { recursive: true });
let count = 0;

function write(record) {
  // receivedAt 是真实时间戳：这是证据文件，不是确定性渲染产物
  appendFileSync(outFile, `${JSON.stringify({ ...record, receivedAt: new Date().toISOString() })}\n`);
  count += 1;
}

if (typeof miniProgram.on === 'function') {
  miniProgram.on('console', (msg) => {
    const args = Array.isArray(msg?.args) ? msg.args : [];
    if (String(args[0] ?? '') !== MARKER) return;
    try {
      write(JSON.parse(String(args[1] ?? '{}')));
    } catch {
      write({ kind: 'error', message: String(args[1] ?? ''), page: '' });
    }
  });
  miniProgram.on('exception', (err) => {
    write({ kind: 'error', message: err?.message ?? String(err), page: '' });
  });
}

console.log(`[runtime:collect] 采集中（${DURATION_MS / 1000}s）→ ${path.relative(projectRoot, outFile)}`);
await new Promise((resolve) => setTimeout(resolve, DURATION_MS));

try {
  await miniProgram.close();
} catch {
  /* 关不掉不影响已采集内容 */
}
console.log(`[runtime:collect] 结束，本次写入 ${count} 条`);
