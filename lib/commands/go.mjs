// vima go —— 从真实项目根启动全新 Claude Code 交互会话，并以 /go 作为初始提示。
// 这是错误 cwd / 超长旧会话的确定性逃生口；项目内 /go 的编排正文仍由 go skill + go.md 承担。
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { EXIT, precondition, usageFromParseArgs } from '../util/errors.mjs';
import { fileExists } from '../util/fs.mjs';

const SKILL_REL = '.claude/skills/go/SKILL.md';

export function goPrompt(commit = false) {
  return commit ? '/go --commit' : '/go';
}

export async function run(argv, ctx) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        commit: { type: 'boolean', default: false },
        'dry-run': { type: 'boolean', default: false },
      },
      allowPositionals: false,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }

  const root = ctx.cwd;
  const skillPath = path.join(root, SKILL_REL);
  if (!(await fileExists(skillPath))) {
    throw precondition(
      'GO_SKILL_MISSING',
      `缺少正式 /go skill；请运行 vima update（尚未初始化则运行 vima init）`,
      SKILL_REL,
    );
  }

  const prompt = goPrompt(values.commit);
  if (values['dry-run']) {
    process.stdout.write(
      `🚦 Vima /go 启动检查通过\n项目根：${root}\n启动：claude "${prompt}"\n`
        + '模式：全新交互会话（不会续接其他目录的旧上下文）\n',
    );
    return EXIT.OK;
  }

  const child = spawnSync('claude', [prompt], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (child.error) {
    throw precondition(
      'CLAUDE_NOT_FOUND',
      '无法启动 Claude Code，请先安装 claude 并确认其已加入 PATH',
      root,
    );
  }
  return Number.isInteger(child.status) ? child.status : EXIT.ERROR;
}
