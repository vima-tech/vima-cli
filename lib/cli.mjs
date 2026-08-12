// 命令路由（internal-contracts §4：每个命令模块导出 async run(argv, ctx) → exitCode）
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { VimaError, EXIT, formatError } from './util/errors.mjs';

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const COMMANDS = {
  'create': '创建项目骨架（--template admin|cli|script|lib|h5）',
  'init': '在当前项目生成 Claude Code 工作环境（宪法/生命周期/命令/子代理/hooks）',
  'upgrade': '升级 vima 生成物到当前 CLI 版本（manifest 三方比较，用户文件永不覆盖）',
  'doctor': '体检：环境依赖 / 宪法行数 / 状态一致性 / 对齐产物漂移',
  'validate': 'PLANNING 产物机械校验（结构/必填要素/交叉引用，零 token）',
  'render-review': '从 spec 结构化数据块确定性渲染人类审计视图（--check 验漂移）',
  'render-prototype': '渲染无样式线框原型 + prototype.manifest.json（--check 验漂移）',
  'sync': '确定性状态重建：frontmatter → taskStats + tasks/README.md',
  'plan': '从任务 frontmatter 拓扑生成批次计划（含环检测）',
  'approve': '任务评审机械确认：置 tasksApproved（/go 前置闸门）',
  'trace': '代码 @vima 标注与任务对账：抓虚报与野生代码（吸收自 PACT）',
};

function usage() {
  const lines = ['用法: vima <command> [options]', '', '命令:'];
  for (const [name, desc] of Object.entries(COMMANDS)) {
    lines.push(`  ${name.padEnd(18)} ${desc}`);
  }
  lines.push('  version            输出版本号');
  lines.push('  help               输出本帮助');
  return lines.join('\n');
}

async function printVersion() {
  const pkg = JSON.parse(await readFile(path.join(CLI_ROOT, 'package.json'), 'utf8'));
  process.stdout.write(`${pkg.version}\n`);
  return EXIT.OK;
}

export async function main(argv) {
  const cmd = argv[0];
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    process.stdout.write(`${usage()}\n`);
    return cmd ? EXIT.OK : EXIT.USAGE;
  }
  if (cmd === 'version' || cmd === '--version' || cmd === '-v') return printVersion();

  if (!Object.hasOwn(COMMANDS, cmd)) {
    process.stderr.write(`vima: USAGE: 未知命令 "${cmd}"\n\n${usage()}\n`);
    return EXIT.USAGE;
  }

  const ctx = { cwd: process.cwd(), cliRoot: CLI_ROOT };
  // §20.2 调试模式：DEBUG=vima:*（或 *）时错误附带完整堆栈（契约 §14）
  const debug = /^(\*|vima)/.test(process.env.DEBUG ?? '');
  try {
    const mod = await import(`./commands/${cmd}.mjs`);
    const code = await mod.run(argv.slice(1), ctx);
    return code ?? EXIT.OK;
  } catch (err) {
    if (err instanceof VimaError) {
      process.stderr.write(`${formatError(cmd, err)}\n`);
      if (debug && err.stack) process.stderr.write(`${err.stack}\n`);
      return err.exitCode;
    }
    process.stderr.write(`vima ${cmd}: ERROR: ${err.stack || err.message}\n`);
    return EXIT.ERROR;
  }
}
