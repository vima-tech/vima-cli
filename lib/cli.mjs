// 命令路由与帮助（internal-contracts §3：顶层路由 / §4：命令模块 async run(argv, ctx) → exitCode）
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { VimaError, EXIT, formatError, usageError } from './util/errors.mjs';

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 每命令帮助数据（文案对齐设计 §19.1–§19.12；选项以实现为唯一真源，契约 §3 顶层路由）
const COMMANDS = {
  create: {
    desc: '创建项目骨架（--template admin|cli|script|lib|h5，admin 之外均为 preview）',
    usage: 'vima create <project-name> [options]',
    intro: '多模板起盘：环境依赖预检 → 拷贝骨架（变量替换）→ git init / npm install（可跳过）。',
    options: [
      ['-t, --template <id>', '指定模板（admin=stable；cli/script/lib/h5=preview，仅骨架）'],
      ['--apps <id:kind,...>', 'A16 端册：声明前端端（如 admin:admin-web,patient:mp-native；缺省=模板默认端；N≥2 落 apps/<id>/）'],
      ['-i, --interactive', '强制进入交互式选择（即使给了 --template）'],
      ['-f, --force', '允许在已存在目录中创建并覆盖同名文件（不清空目录；不清空 manifest 端册与 files）'],
      ['--no-git', '不初始化 Git 仓库'],
      ['--no-install', '不自动安装前端依赖'],
    ],
    examples: [
      'vima create my-project',
      'vima create my-project --template admin',
      'vima create nutri -t admin --apps admin:admin-web,patient:mp-native',
    ],
  },
  init: {
    desc: '在当前项目生成 Claude Code 工作环境（宪法/生命周期/命令/子代理/hooks）',
    usage: 'vima init [options]',
    intro: '部署 Agent 工作环境并写 .vima/manifest.json；preview 模板拒绝运行（A5 能力诚实分级）。',
    options: [
      ['-t, --template <id>', '项目无 manifest/lifecycle 记录时指定模板'],
      ['--force', '已初始化时强制重建（覆盖 managed 文件，慎用）'],
      ['--skip-scan', '跳过 UI 组件文档拷贝（docs/ui-framework/）'],
      ['--minimal', '最小化初始化（仅宪法 / lifecycle / .claude / manifest）'],
    ],
    examples: ['vima init', 'vima init --minimal', 'vima init --template admin'],
  },
  update: {
    desc: '更新 vima 生成物到当前 CLI 版本（manifest 三方比较，用户文件永不覆盖）',
    usage: 'vima update [options]',
    intro:
      '三方比较（记录校验和 / 磁盘现状 / 新模板源）：用户改过的 managed 文件在旁路写 <path>.vima-new 供自行合并，userOwned 永不触碰。A15 起由 vima upgrade 更名而来。',
    options: [
      ['--dry-run', '只输出动作预览表，不写盘'],
      ['--yes', '兼容保留（实现恒非交互，无额外行为）'],
      ['--scaffold-diff', '骨架三方比较只读报告（基线/磁盘/模板源），不写盘（A19）'],
    ],
    examples: ['vima update --dry-run', 'vima update'],
  },
  upgrade: {
    desc: '升级 vima CLI 自身到 npm 最新版（默认只检查，--yes 才安装）',
    usage: 'vima upgrade [options]',
    intro:
      '查 npm registry 最新版并识别安装方式（npm/pnpm/bun 全局 · npx · 源码开发态）。全仓唯一联网、唯一改 cwd 之外文件的命令，因此默认只报告不安装。更新项目产物请用 vima update。',
    options: [
      ['--yes', '确认执行安装器（不加则只打印版本与升级指令）'],
      ['--dry-run', '兼容保留（新语义下「只检查」即默认行为，无额外行为）'],
    ],
    examples: ['vima upgrade', 'vima upgrade --yes'],
  },
  doctor: {
    desc: '体检：环境依赖 / 宪法行数 / 状态一致性 / 对齐产物漂移',
    usage: 'vima doctor [options]',
    intro: '十二项体检（非 vima 项目仅执行环境与宪法两项）；存在 ❌ 项 → exit 2；CLAUDE.md 超 50 行为告警级。',
    options: [
      ['--json', 'JSON 格式输出（stdout 仅 JSON）'],
      ['--verbose', '展开每项检查的明细行'],
    ],
    examples: ['vima doctor', 'vima doctor --json'],
  },
  validate: {
    desc: 'PLANNING 产物机械校验（结构/必填要素/交叉引用，零 token）',
    usage: 'vima validate [options]',
    intro:
      '按契约 §8 规则表逐条机检（V-SPEC/V-DEC/V-CON/V-TASK/V-COV/V-PEND/V-CODE）；报告落盘 .vima/reports/planning-validation.json；有 error → exit 2。',
    options: [
      ['--artifact <path>', '只校验指定产物（docs/spec.md | docs/contracts | docs/tasks | docs/coverage-matrix.md）'],
    ],
    examples: ['vima validate', 'vima validate --artifact docs/spec.md'],
  },
  'render-review': {
    desc: '从 spec 结构化数据块确定性渲染人类审计视图（--check 验漂移）',
    usage: 'vima render-review [options]',
    intro: '单文件 HTML 四视图（角色权限矩阵/菜单功能点/流程泳道/页面详情），字节确定；渲染前先过页面块校验。',
    options: [
      ['--check', '不写盘，与磁盘产物字节级比对（不一致 → exit 2）'],
      ['--output <path>', '输出路径（默认 docs/review/index.html）'],
    ],
    examples: ['vima render-review', 'vima render-review --check'],
  },
  'render-prototype': {
    desc: '渲染无样式线框原型 + prototype.manifest.json（--check 验漂移；多端逐端产物）',
    usage: 'vima render-prototype [options]',
    intro:
      '语义占位线框 + 按端外壳（admin-web=桌面侧栏；mp-native=手机框+tabbar，A16），同时产出 manifest 供 Verifier 对账；' +
      '多端项目输出 prototype.<appId>.html（单端保留旧名）；模板声明 prototype:false 时跳过。',
    options: [
      ['--check', '不写盘，与磁盘各端产物字节级比对（不一致 → exit 2）'],
      ['--app <id>', '只渲染指定端（A16；manifest 不重写）'],
      ['--output <path>', '输出路径（仅单端产物语境有效；多端全量渲染给此项 → exit 3）'],
    ],
    examples: ['vima render-prototype', 'vima render-prototype --check', 'vima render-prototype --app patient'],
  },
  'render-matrix': {
    desc: '从 spec/契约/任务确定性重生成需求覆盖矩阵（--check 验漂移）',
    usage: 'vima render-matrix [options]',
    intro:
      '推导「页面 → 接口 → 契约 → 承接任务」四列表，供 V-COV-01 校验；产物由本命令生成，不要手改。',
    options: [
      ['--check', '不写盘，与磁盘产物字节级比对（不一致 → exit 2）'],
      ['--output <path>', '输出路径（默认 docs/coverage-matrix.md）'],
    ],
    examples: ['vima render-matrix', 'vima render-matrix --check'],
  },
  sync: {
    desc: '确定性状态重建：frontmatter → taskStats + tasks/README.md',
    usage: 'vima sync [options]',
    intro: '扫描 docs/tasks/*.md frontmatter 重建 lifecycle.taskStats 与任务 README 批次视图；清理过期共享层写令牌。',
    options: [['--dry-run', '只输出差异预览，不写盘']],
    examples: ['vima sync --dry-run', 'vima sync'],
  },
  plan: {
    desc: '从任务 frontmatter 拓扑生成批次计划（含环检测）',
    usage: 'vima plan [options]',
    intro:
      '共享层串行 → 业务层按依赖分层批内并行（≤maxParallel，默认 8）→ 流水线收尾；成环/缺依赖 → exit 2；默认写 .vima/reports/batch-plan.json。每批带 level 字段：同 layer 同 level 的批次之间无依赖，可流水线化派发（A18）。',
    options: [
      ['--json', '批次计划输出到 stdout（不落盘）'],
      ['--max-parallel <n>', '批内并行度上限（1–10，默认 8；越界 → PLAN_PARALLEL exit 2）'],
    ],
    examples: ['vima plan', 'vima plan --json', 'vima plan --max-parallel 5'],
  },
  approve: {
    desc: '任务评审机械确认：置 tasksApproved（/go 前置闸门）',
    usage: 'vima approve',
    intro: '前置：validate 通过 + 审计视图/原型已渲染且与 spec 无漂移（A12 新鲜度机检）+ pendingConfirm 清零；通过后输出任务汇总表并写 lifecycle 留痕。',
    options: [],
    examples: ['vima approve'],
  },
  context: {
    desc: '任务上下文确定性打包：任务/契约/页面块/组件文档切片/编码规范 → 单文件（A8）',
    usage: 'vima context <taskId> [options]',
    intro:
      '把任务开工所需规划上下文机械汇编为 .vima/context/<taskId>.md 并输出分节字节计量；Builder 以包为第一必读（上游编译、下游不自由检索）。',
    options: [
      ['--budget <bytes>', '总字节预算：超出 → exit 2（包仍写盘便于排查超因）'],
      ['--stdout', '打包内容直接输出到 stdout，不写盘'],
    ],
    examples: ['vima context device-list-fe', 'vima context device-list-fe --budget 30000'],
  },
  trace: {
    desc: '代码 @vima 标注与任务对账：抓虚报与野生代码（吸收自 PACT）',
    usage: 'vima trace [options]',
    intro:
      '扫描模板 codeDirs 中的 @vima <taskId> 注释：标注无任务=野生（exit 2）；done 任务无标注=虚报嫌疑（--strict 时 exit 2）；报告落盘 .vima/reports/trace.json。',
    options: [
      ['--strict', '虚报嫌疑也非零退出'],
      ['--dir <path>', '在模板 codeDirs 之外追加扫描目录（可重复）'],
    ],
    examples: ['vima trace', 'vima trace --strict', 'vima trace --dir packages/shared'],
  },
};

// version / help 不是命令模块，但同样进帮助索引（对齐列宽，防手工对齐脱钩）
const TOPICS = {
  ...COMMANDS,
  version: { desc: '输出版本号', usage: 'vima version（同 vima --version / vima -v）', options: [], examples: [] },
  help: { desc: '输出本帮助', usage: 'vima help [command]', options: [], examples: ['vima help', 'vima help create'] },
};

function usage() {
  const lines = ['用法: vima <command> [options]', '', '命令:'];
  for (const [name, t] of Object.entries(TOPICS)) {
    lines.push(`  ${name.padEnd(18)} ${t.desc}`);
  }
  lines.push('', '查看单个命令的用法：vima help <command> 或 vima <command> --help');
  return lines.join('\n');
}

function commandHelp(name) {
  const t = TOPICS[name];
  const lines = [`用法: ${t.usage}`, '', t.intro ?? t.desc];
  if (t.options.length > 0) {
    lines.push('', '选项:');
    for (const [flag, desc] of t.options) lines.push(`  ${flag.padEnd(22)} ${desc}`);
  }
  if (t.examples.length > 0) {
    lines.push('', '示例:');
    for (const ex of t.examples) lines.push(`  ${ex}`);
  }
  return lines.join('\n');
}

async function printVersion() {
  const pkg = JSON.parse(await readFile(path.join(CLI_ROOT, 'package.json'), 'utf8'));
  process.stdout.write(`${pkg.version}\n`);
  return EXIT.OK;
}

/** `--` 分隔符之前是否出现 --help / -h（其后属位置参数，不拦截）。 */
function wantsHelp(rest) {
  const sep = rest.indexOf('--');
  const scan = sep === -1 ? rest : rest.slice(0, sep);
  return scan.includes('--help') || scan.includes('-h');
}

export async function main(argv) {
  const cmd = argv[0];

  // help 家族：`vima help [command]` / `--help` / `-h` → stdout，exit 0（契约 §3 顶层路由）
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    const topic = argv[1];
    if (topic === undefined) {
      process.stdout.write(`${usage()}\n`);
      return EXIT.OK;
    }
    if (!Object.hasOwn(TOPICS, topic)) {
      process.stderr.write(`${formatError('help', usageError(`未知命令 "${topic}"`))}\n提示: 运行 vima help 查看全部命令\n`);
      return EXIT.USAGE;
    }
    process.stdout.write(`${commandHelp(topic)}\n`);
    return EXIT.OK;
  }

  // 无参数：用法错误（契约 §3 退出码 3），完整用法输出到 stderr
  if (!cmd) {
    process.stderr.write(`${usage()}\n`);
    return EXIT.USAGE;
  }

  if (cmd === 'version' || cmd === '--version' || cmd === '-v') return printVersion();

  if (!Object.hasOwn(COMMANDS, cmd)) {
    process.stderr.write(`${formatError(cmd, usageError(`未知命令 "${cmd}"`))}\n提示: 运行 vima help 查看全部命令\n`);
    return EXIT.USAGE;
  }

  // `vima <cmd> --help|-h`：在命令自身解析参数之前拦截（契约 §3 顶层路由）
  if (wantsHelp(argv.slice(1))) {
    process.stdout.write(`${commandHelp(cmd)}\n`);
    return EXIT.OK;
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
      if (err.code === 'USAGE') process.stderr.write(`提示: 运行 vima ${cmd} --help 查看用法\n`);
      if (debug && err.stack) process.stderr.write(`${err.stack}\n`);
      return err.exitCode;
    }
    // 未预期异常：message 稳定输出，完整堆栈仅在 DEBUG 下附带（契约 §3/§14）
    process.stderr.write(`vima ${cmd}: ERROR: ${err.message}\n`);
    if (debug && err.stack) process.stderr.write(`${err.stack}\n`);
    return EXIT.ERROR;
  }
}
