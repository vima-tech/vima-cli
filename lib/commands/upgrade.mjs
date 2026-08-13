// vima upgrade —— 升级 CLI 自身（增补项 A15；设计 §19.13；契约 §3.1 三个新错误码）
// 全仓唯一联网、且唯一会改 cwd 之外文件的命令，因此：
//   默认只检查不安装（打印 当前版本 / 最新版本 / 安装方式 / 升级指令，exit 0）；
//   --yes 才执行安装器；源码态与 npx 态不可自升级，带 --yes 时 exit 4。
// 项目产物的更新是另一条命令：vima update（A15 更名前叫 vima upgrade）。
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { EXIT, usageError, checkFailed, precondition } from '../util/errors.mjs';
import { fileExists } from '../util/fs.mjs';
import { parseOpts } from './create.mjs';

const OPTS = {
  yes: { type: 'boolean' },
  // A15 过渡兼容：新语义下「只检查」即默认行为，接受但无额外行为（2.x 的 `vima upgrade --dry-run` 不报错）
  'dry-run': { type: 'boolean' },
};

const REGISTRY = 'https://registry.npmjs.org';
const FETCH_TIMEOUT_MS = 5000;

// kind → { label, 是否可自升级, 安装器 argv 前缀（不含包名） }
const INSTALLERS = {
  npm: { label: 'npm 全局安装', cmd: 'npm', args: ['install', '-g'] },
  pnpm: { label: 'pnpm 全局安装', cmd: 'pnpm', args: ['add', '-g'] },
  bun: { label: 'bun 全局安装', cmd: 'bun', args: ['add', '-g'] },
  source: { label: '源码 / npm link 开发态', hint: '在 CLI 源码仓库执行 git pull 后重新 npm link' },
  npx: { label: 'npx 临时运行', hint: 'npx 每次都会取最新版本，无需自升级' },
};

/** 安装方式识别：只看 cliRoot 的路径与文件存在性，不执行外部命令探测（A15 规格 2）。 */
export async function detectInstallKind(cliRoot) {
  if (await fileExists(path.join(cliRoot, '.git'))) return 'source';
  const segs = cliRoot.split(/[/\\]+/);
  if (segs.includes('_npx')) return 'npx';
  if (segs.includes('.pnpm') || segs.includes('pnpm')) return 'pnpm';
  if (segs.includes('.bun')) return 'bun';
  return 'npm';
}

/** 语义化版本比较：a>b → 1；a<b → -1；相等 → 0。非数字段按 0 处理（预发布后缀忽略）。 */
export function compareSemver(a, b) {
  const parse = (v) => String(v).split('.').slice(0, 3).map((s) => Number.parseInt(s, 10) || 0);
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0) ? 1 : -1;
  }
  return 0;
}

/** 读 CLI 自身 package.json 的 name + version。 */
async function readCliPkg(cliRoot) {
  const pkg = JSON.parse(await readFile(path.join(cliRoot, 'package.json'), 'utf8'));
  return { name: pkg.name, version: pkg.version };
}

/**
 * 查 registry 上的最新版本（Node 20 内建 fetch，零运行时依赖）。
 * 环境变量 VIMA_UPGRADE_LATEST 非空时直接采信并跳过请求（契约 §13：单测不得依赖网络）。
 * 失败/超时/响应无 version → REGISTRY_UNREACHABLE（exit 2），绝不静默降级为「已是最新」。
 */
export async function fetchLatestVersion(pkgName) {
  const injected = process.env.VIMA_UPGRADE_LATEST;
  if (injected) return injected.trim();
  const url = `${REGISTRY}/${pkgName}/latest`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (err) {
    throw checkFailed('REGISTRY_UNREACHABLE', `无法访问 npm registry（${err.message}）`, url);
  }
  if (!res.ok) throw checkFailed('REGISTRY_UNREACHABLE', `npm registry 响应 HTTP ${res.status}`, url);
  let body;
  try {
    body = await res.json();
  } catch (err) {
    throw checkFailed('REGISTRY_UNREACHABLE', `npm registry 响应不是合法 JSON（${err.message}）`, url);
  }
  if (!body?.version) throw checkFailed('REGISTRY_UNREACHABLE', 'npm registry 响应缺少 version 字段', url);
  return String(body.version);
}

export async function run(argv, ctx) {
  const { values, positionals } = parseOpts(argv, OPTS);
  if (positionals.length > 0) throw usageError(`多余的位置参数 "${positionals[0]}"`);
  const doInstall = values.yes === true;

  const { name, version: current } = await readCliPkg(ctx.cliRoot);
  const kind = await detectInstallKind(ctx.cliRoot);
  const installer = INSTALLERS[kind];
  const upgradable = Boolean(installer.cmd);
  const command = upgradable ? [installer.cmd, ...installer.args, `${name}@latest`].join(' ') : null;

  const latest = await fetchLatestVersion(name);
  const cmp = compareSemver(latest, current);

  const out = [
    `vima upgrade：升级 CLI 自身（${name}）`,
    '',
    `  当前版本    ${current}`,
    `  最新版本    ${latest}`,
    `  安装方式    ${installer.label}`,
    `  安装位置    ${ctx.cliRoot}`,
  ];
  out.push(`  升级指令    ${command ?? `不适用——${installer.hint}`}`);
  process.stdout.write(`${out.join('\n')}\n\n`);

  // 迁移提示：老用户在 vima 项目里跑旧命令，一定看得到正确去处（A15 规格 6）
  const inProject = await fileExists(path.join(ctx.cwd, '.vima/manifest.json'));
  const migrationNote = inProject
    ? '\n提示：更新项目里的 vima 生成物请用 vima update（该行为原属 vima upgrade，A15 起更名）。\n'
    : '';

  if (cmp <= 0) {
    process.stdout.write(cmp === 0 ? '✅ 已是最新版本，无需升级。\n' : '✅ 本地版本高于 registry 最新版（开发版），无需升级。\n');
    process.stdout.write(migrationNote);
    return EXIT.OK;
  }

  if (!upgradable) {
    process.stdout.write(`ℹ️ 有新版本 ${latest}，但当前安装方式无法自升级：${installer.hint}。\n`);
    process.stdout.write(migrationNote);
    if (doInstall) {
      throw precondition(
        'UPGRADE_UNSUPPORTED',
        `当前安装方式（${installer.label}）不支持自升级：${installer.hint}`,
        ctx.cliRoot,
      );
    }
    return EXIT.OK;
  }

  if (!doInstall) {
    process.stdout.write(`ℹ️ 有新版本 ${latest}。执行升级请加 --yes：vima upgrade --yes\n`);
    process.stdout.write(migrationNote);
    return EXIT.OK;
  }

  process.stdout.write(`⏳ 正在执行：${command}\n\n`);
  const r = spawnSync(installer.cmd, [...installer.args, `${name}@latest`], { stdio: 'inherit' });
  if (r.error) {
    throw checkFailed('INSTALL_FAILED', `安装器无法执行（${r.error.message}）：${command}`, installer.cmd);
  }
  if (r.status !== 0) {
    throw checkFailed('INSTALL_FAILED', `安装器以退出码 ${r.status} 结束：${command}`, installer.cmd);
  }
  process.stdout.write(`\n✅ 已升级到 ${latest}。运行 vima version 确认。\n`);
  process.stdout.write(migrationNote);
  return EXIT.OK;
}
