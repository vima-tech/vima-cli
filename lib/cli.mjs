// 命令路由与帮助（internal-contracts §3：顶层路由 / §4：命令模块 async run(argv, ctx) → exitCode）
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { VimaError, EXIT, formatError, usageError, precondition } from './util/errors.mjs';
import { findProjectRoot, appendJsonLine } from './util/fs.mjs';

// A24：项目内命令——需要读项目产物，因此必须锚定项目根而不是当前目录。
// create 建新目录、upgrade 管 CLI 自身，两者与项目无关，不参与。
const PROJECT_SCOPED = new Set([
  'init', 'update', 'validate', 'plan', 'sync', 'doctor', 'approve', 'trace',
  'context', 'render-review', 'render-prototype', 'render-matrix', 'render-journal', 'converge', 'retro',
  'app', 'mock', 'change', 'certify', 'design', 'go', 'status',
]);
// 找不到项目根时**拒绝执行**的子集。三个例外各有既定语义，不得被本项误伤：
// init   —— 在尚不是 vima 项目的目录里首次初始化，本就是它的正常路径；
// doctor —— 「非 vima 项目只跑环境与宪法两项并注明」是它声明过的降级能力（§19.4）；
// status —— `--line` 供 Claude Code statusLine 常驻调用，**恒 exit 0 且恒输出单行**
//           （A37 D-A37-04）。在此拒绝执行会让状态栏显示空白，而「会话开在非项目根」
//           正是它要可视化的那个故障——拒绝执行等于在最需要它的场景下把它关掉。
const PROJECT_REQUIRED = new Set(
  [...PROJECT_SCOPED].filter((c) => c !== 'init' && c !== 'doctor' && c !== 'status'),
);

// ── A35 过程轨迹采集（契约 §6.21）────────────────────────────────────────────
// 口径（D-A35-01）：**失败全记 + 成功仅白名单**，且成功时排除 --check/--dry-run。
//   ①全记 → doctor / render --check 高频成功刷屏，信噪比塌；
//   ②只记失败 → 画不出「修好了」那一端，曲线只剩半条。
// retro 不在白名单是**自我豁免**（D-A35-12）：retro 读 journal 生成报告，若它自己也写
// 一行，A21 既有判据「连续两次 retro 字节一致」当场失败——本项自审时实际写错过一次。
const JOURNAL_ON_SUCCESS = new Set([
  'init', 'update', 'sync', 'plan', 'validate', 'approve', 'converge', 'certify', 'change', 'design',
]);
const JOURNAL_REL = '.vima/reports/journal.jsonl';
// **明确声明「不写盘」的 flag 一律排除**——它们承诺零写盘，采集写 journal 会破坏该承诺
// （`update --scaffold-diff` 的 c1.update 用例用全项目指纹守着这一条）。
// `--json` 通常只是额外输出 stdout；唯一零写盘例外是 `plan --json`，在 journalCommand
// 里按命令名精确排除，避免误伤 validate/doctor 等仍需产出报告的 JSON 模式。
// 新增只读 flag 时必须同步本表——c3.journal 的守卫用例扫帮助面逐个实跑，强制这一点。
const JOURNAL_READONLY_FLAGS = new Set(['--check', '--dry-run', '--scaffold-diff']);
// **连失败也不记的命令**（`status`，A37 硬约束 4）。与 retro 的自我豁免（D-A35-12）同类
// 但理由不同：retro 是「读 journal 又写 journal 会破坏字节一致判据」，status 是
//   ① 它声明「一律不落盘」——写一行 journal 就是落盘，且会把自己变成第 4 个状态源；
//   ② `--line` 由 statusLine 高频调用，一旦失败会把 journal 刷成一片同样的错误行，
//      A35 的过程曲线当场被噪声淹没。
const JOURNAL_EXEMPT = new Set(['status']);
// 默认开启（D-A35-07）：A21 的教训原文就是「反哺全靠自觉」——默认关 = 数据永远不存在。
// 开关只为可复现测试与用户知情权而存在。
const journalEnabled = () => process.env.VIMA_JOURNAL !== '0';

/**
 * 记一条 cmd 事件。
 *
 * **判据是「root 下确实有 .vima/」，不是「root 非 null」**——顶层的 `root` 对非
 * PROJECT_SCOPED 命令（create/upgrade/version/help）恒等于 cwd，用非空判据会让
 * 「在任意目录里跑失败的 vima create」往那个目录里扔 `.vima/reports/journal.jsonl`。
 * journal 是**项目产物**，判据必须落在「这里是不是一个项目」上。
 * （`init` 成功后 .vima 已建成，故它的事件正常落进新项目——这正是期望行为。）
 */
function journalCommand(root, cmd, argv, exitCode) {
  if (!root || !journalEnabled() || JOURNAL_EXEMPT.has(cmd) || !existsSync(path.join(root, '.vima'))) return;
  const dryish = argv.some((a) => JOURNAL_READONLY_FLAGS.has(a)) || (cmd === 'plan' && argv.includes('--json'));
  const record = exitCode !== EXIT.OK
    ? true                                        // 失败全记——这就是「踩坑」
    : (JOURNAL_ON_SUCCESS.has(cmd) && !dryish);   // 成功仅白名单——这就是「爬出来了」
  if (!record) return;
  appendJsonLine(path.join(root, JOURNAL_REL), {
    ts: new Date().toISOString(), // 采集端允许读时钟；消费端一律不得（A35「与硬约束的关系」）
    kind: 'cmd',
    ref: cmd,
    outcome: exitCode === EXIT.OK ? 'ok' : 'fail',
    n: exitCode, // D-A35-09：出口只拿得到退出码，error 条数已在 planning-validation.json
  });
}

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 每命令帮助数据（文案对齐设计 §19.1–§19.12；选项以实现为唯一真源，契约 §3 顶层路由）
const COMMANDS = {
  create: {
    desc: '创建骨架：admin|cli|script|lib|h5；admin 之外均为 preview',
    usage: 'vima create <project-name> [options]',
    intro: '多模板起盘：环境依赖预检 → 拷贝骨架（变量替换）→ git init / npm install（可跳过）。',
    options: [
      ['-t, --template <id>', '指定模板（admin=stable；cli/script/lib=preview 仅骨架；h5 见 --apps 的 h5-mobile kind）'],
      ['--apps <id:kind,...>', 'A16 端册：声明前端端（kind ∈ admin-web/mp-native/h5-mobile；缺省=模板默认端；N≥2 落 apps/<id>/）'],
      ['-i, --interactive', '强制进入交互式选择（即使给了 --template）'],
      ['-f, --force', '允许在已存在目录中创建并覆盖同名文件（不清空目录；不清空 manifest 端册与 files）'],
      ['--no-git', '不初始化 Git 仓库'],
      ['--no-install', '不自动安装前端依赖'],
    ],
    examples: [
      'vima create my-project',
      'vima create my-project --template admin',
      'vima create shop -t admin --apps admin:admin-web,mp:mp-native',
    ],
  },
  init: {
    desc: '生成 Claude Code 工作环境（宪法/skills/子代理/hooks）',
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
    desc: '更新生成物到当前 CLI 版本（用户文件永不覆盖）',
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
    intro: '十三项体检（非 vima 项目仅执行环境与宪法两项）；存在 ❌ 项 → exit 2；CLAUDE.md 超 50 行为告警级。',
    options: [
      ['--json', 'JSON 格式输出（stdout 仅 JSON）'],
      ['--verbose', '展开每项检查的明细行'],
    ],
    examples: ['vima doctor', 'vima doctor --json'],
  },
  go: {
    desc: '从项目根启动全新 Claude /go 会话（支持断点继续）',
    usage: 'vima go [options]',
    intro:
      '校验正式 go skill 后，从探测到的 Vima 项目根启动全新 Claude Code 交互会话，并自动发送 /go。'
      + '用于避免错误 cwd、旧会话上下文膨胀和项目配置未加载。',
    options: [
      ['--commit', '授权 /go 为完成批次创建 Git 检查点提交'],
      ['--dry-run', '只显示项目根与启动命令，不启动 Claude、也不写盘'],
    ],
    examples: ['vima go', 'vima go --commit', 'vima go --dry-run'],
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
    desc: '从 spec 确定性渲染人类审计视图（--check 验漂移）',
    usage: 'vima render-review [options]',
    intro: '单文件 HTML 四视图（角色权限矩阵/菜单功能点/流程泳道/页面详情），字节确定；渲染前先过页面块校验。',
    options: [
      ['--check', '不写盘，与磁盘产物字节级比对（不一致 → exit 2）'],
      ['--output <path>', '输出路径（默认 docs/review/index.html）'],
    ],
    examples: ['vima render-review', 'vima render-review --check'],
  },
  'render-prototype': {
    desc: '渲染线框原型 + manifest（--check 验漂移；多端逐端）',
    usage: 'vima render-prototype [options]',
    intro:
      '语义占位线框 + 按端外壳（admin-web=桌面侧栏；mp-native=手机框+tabbar，A16），同时产出 manifest 供 Verifier 对账；' +
      '多端项目输出 prototype.<appId>.html（单端保留旧名）；模板声明 prototype:false 时跳过。',
    options: [
      ['--check', '不写盘，与磁盘各端产物字节级比对（不一致 → exit 2）'],
      ['--app <id>', '只渲染指定端（A16；manifest 不重写）'],
      ['--output <path>', '输出路径（仅单端产物语境有效；多端全量渲染给此项 → exit 3）'],
    ],
    examples: ['vima render-prototype', 'vima render-prototype --check', 'vima render-prototype --app mp'],
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
  'render-journal': {
    desc: '过程轨迹视图：人类审核窗口（A36，只读不批）',
    usage: 'vima render-journal [options]',
    intro:
      '六区单文件 HTML（阶段时间线/任务台账/验收点位/集成对账/规则命中/运行时与代码溯源），'
      + '产物落 .vima/reports/journal.html（随数据源一并被 gitignore）。'
      + '**刻意不提供 --check**：过程数据每推进一个任务就变，漂移机检会恒红（契约 §11.1）。'
      + '审的是「实际发生了什么」；「要建什么」看 vima render-review。'
      + '**不接任何选项**：产物路径固定，避免把每次都变的产物写进版本控制。',
    options: [],
    examples: ['vima render-journal'],
  },
  status: {
    desc: '运行状态：三档进度 / 任务量 / 用时 / 预估（只读）',
    usage: 'vima status [options]',
    intro:
      '同屏并列三档口径——自称（frontmatter status）/ 有轨迹 / 已验收（后两者取 journal 事件，'
      + '由 hook 采集但仍受 Agent 报告输入影响），差值即状态源打架的信号。用时取 lifecycle 真实时间戳；'
      + '预估只用带真时间的验收样本，样本 <3 一律拒绝外推而不给数字。'
      + '恒 exit 0、只写 stdout、不产出任何文件（A37）。',
    options: [
      ['--watch', '常驻重绘：文件变化即重算，每秒刷新用时与预估（Ctrl+C 退出）'],
      ['--json', '结构化输出到 stdout（stableStringify）'],
      ['--line', '单行输出，供 Claude Code statusLine；数据/运行异常仍 exit 0'],
    ],
    examples: ['vima status', 'vima status --watch', 'vima status --json'],
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
  app: {
    desc: '端册：查看 / 后补前端端（A16 一后端 × 多前端）',
    usage: 'vima app list | vima app add <id> --kind <kind>',
    intro:
      '端册（.vima/manifest.json 的 apps）是「有哪些端」的唯一真源。新端一律落 apps/<id>/，'
      + '已有的单端项目保持根布局不动——dir 是数据，validate/trace/guard/context/渲染器对布局无感。'
      + '加端后 spec 的页面/菜单须补 app 键、契约的 api 须补 consumers（多端必填）。',
    options: [
      ['--kind <kind>', '端形态：admin-web / mp-native / h5-mobile（取自模板 planning.kinds）'],
      ['--name <name>', '端的中文名（缺省取模板条目名，再缺省取 id）'],
    ],
    examples: [
      'vima app list',
      'vima app add mp --kind mp-native',
      'vima app add h5 --kind h5-mobile',
    ],
  },
  mock: {
    desc: '契约驱动的确定性 mock 生成（A27）',
    usage: 'vima mock',
    intro:
      '8 种字段类型 8 条固定规则、四档数据量（default 3 / empty 0 / many 20 / long 超长文本），'
      + '零随机零时间戳、同输入同字节。mock 必须由契约生成不得手写——手写 mock 是第二份契约，必然漂移。'
      + '消费方：demo 态 request 分支、vite /__vima/mock 中间件、layout-smoke 探针。',
    options: [],
    examples: ['vima mock'],
  },
  approve: {
    desc: '任务评审机械确认：置 tasksApproved（/go 前置闸门）',
    usage: 'vima approve',
    intro: '前置：validate 通过 + 审计视图/原型已渲染且与 spec 无漂移（A12 新鲜度机检）+ pendingConfirm 清零；通过后输出任务汇总表并写 lifecycle 留痕。',
    options: [],
    examples: ['vima approve'],
  },
  context: {
    desc: '任务上下文确定性打包为单文件（A8）',
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
  converge: {
    desc: '跨任务集成对账：漏实现/重复/越界收口（A20）',
    usage: 'vima converge [options]',
    intro:
      '把并行批次的产出当成一个整体校验（V-INT 规则族）：契约接口零实现（V-INT-01）、'
      + '同一接口在多处后端文件重复实现（V-INT-02）、实现越出 apis 责任田（V-INT-03）、'
      + '授权端无调用（V-INT-04，warn）、缺收尾流水线任务（V-INT-05）；'
      + '同时收口既有红信号（Verifier 未过点位、运行时错误、done 无标注）。'
      + '报告落盘 .vima/reports/convergence.json，其中 byTask 是修复调度的确定性输入。'
      + '有 error 或未过点位 → exit 2。',
    options: [
      ['--json', '报告同时输出到 stdout'],
      ['--strict', 'warn 也非零退出'],
    ],
    examples: ['vima converge', 'vima converge --json', 'vima converge --strict'],
  },
  retro: {
    desc: '复盘采集：项目经验 → 可反哺的 issue 正文（A21）',
    usage: 'vima retro [options]',
    intro:
      '从项目产物确定性采集一手证据（重试分布 / 集成冲突命中 / 共享层变更请求 / 豁免与越界 / '
      + '批次形态 / 校验规则命中分布），按阈值输出观察项与建议落点，渲染成 '
      + 'docs/retro/vima-feedback.md（issue 正文）+ .vima/reports/retro.json。'
      + '**默认脱敏**：只含计数与分布，不含任务/接口/页面标识（vima-cli 是公开仓库，'
      + '而使用它的常是客户项目）；--with-ids 才携带。'
      + '离线、只读、不提交——提交由你确认后用 gh issue create 执行。',
    options: [
      ['--json', '报告同时输出到 stdout'],
      ['--with-ids', '携带任务标识（关闭默认脱敏，仅自用仓库）'],
    ],
    examples: ['vima retro', 'vima retro --json', 'vima retro --with-ids'],
  },
  change: {
    desc: '维护期变更事务：快照 → 影响面 → 重开 → 闸门（A31）',
    usage: 'vima change open "<描述>" | list | impact [<id>] | apply [<id>] | close [<id>]',
    intro:
      '把「改需求」从散文协议升级为机器闭环：open 快照 spec/契约基线；impact 结构化 diff '
      + '推导受影响的页面/接口/规则/任务（reasons 逐条留痕，impact.json 无时间戳字节稳定）；'
      + 'apply 把受影响的 done 任务重开为 pending（调用即授权，appliedAt 留痕）；'
      + 'close 是传播闸门——受影响任务全 done + validate 零 error（+ 有任务/接口影响时 '
      + 'converge 通过）才允许关闭，否则 CHANGE_UNPROPAGATED exit 2。'
      + '单变更在途：存在非 closed 变更时不可再 open（CHANGE_ACTIVE）。基线保留作审计证据。',
    options: [],
    examples: [
      'vima change open "设备列表增加批量删除"',
      'vima change impact',
      'vima change apply && vima change close',
    ],
  },
  design: {
    desc: '视觉真源的确定性侧：产物存在性 / 批准摘要 / 验收汇总（A34）',
    usage: 'vima design <status|check|verify|approve|invalidate|reconcile> [options]',
    intro:
      'A34 视觉轨道的执行者。status 重生成只读派生索引 INDEX.json（--check 验漂移）；'
      + 'check 是 DESIGNING 出口闸门（V-DSN-09 + 六项派生状态，此时页面尚未实现，不看实现期报告）；'
      + 'verify 是 DEVELOPING 收口汇总（design/experience 报告矩阵 + 三个 digest 的 stale 判定）；'
      + 'approve/invalidate 记录与作废批准（连同内容摘要，改稿即自动失效）；'
      + 'reconcile 是受控回写环——复用 A31 影响面算法但用 DESIGNING 口径闸门（不要求任务 done）。'
      + '**Claude Design MCP、无头浏览器、截图冻结不在本命令内**，它们只存在于 workspace 资产。',
    options: [
      ['--check', 'status 专用：只验 INDEX.json 漂移，不写盘（漂移 exit 4）'],
      ['--app <id>', 'approve direction / invalidate 限定端'],
      ['--page <id>', 'approve pages / invalidate 限定页面'],
      ['--allow-downgrade', 'approve pages：显式授权已批准页面降级（必须同时提供 --reason）'],
      ['--reason <text>', 'invalidate 的作废理由，或保真降级的用户确认理由'],
      ['--prepare', 'verify 专用：先生成报告作者所需的三个 digest，报告尚缺时仍 exit 0'],
    ],
    examples: [
      'vima design status',
      'vima design check',
      'vima design approve direction --app admin',
      'vima design verify --prepare',
      'vima design verify',
    ],
  },
  certify: {
    desc: '交付等级认证：四级证据阶梯（A32）',
    usage: 'vima certify [options]',
    intro:
      '只读证据聚合：spec-approved（approve 已过）→ implemented（任务全 done + Verifier '
      + '通过报告）→ converged（集成对账零 error）→ pipeline-green（收尾流水线全绿）；'
      + 'deliveryLevel = 自底向上连续满足的最高级，每级列出证据与「下一级缺什么」。'
      + '同报告分离展示模板成熟度（A5 status）与项目交付等级——模板 stable ≠ 项目 stable。'
      + 'deployable/stable 需要部署环境证据，vima 不采集也不认证（诚实分级，不冒充）。'
      + '报告落盘 .vima/reports/certify.json；评估不是闸门，exit 恒 0。',
    options: [['--json', '报告输出到 stdout（机读全量）']],
    examples: ['vima certify', 'vima certify --json'],
  },
};

// version / help 不是命令模块，但同样进帮助索引（对齐列宽，防手工对齐脱钩）
const TOPICS = {
  ...COMMANDS,
  version: { desc: '输出版本号', usage: 'vima version（同 vima --version / vima -v）', options: [], examples: [] },
  help: { desc: '输出本帮助', usage: 'vima help [command]', options: [], examples: ['vima help', 'vima help create'] },
};

/**
 * 顶层帮助的分组（按项目生命周期，与 lifecycle.PHASES 对齐）。
 * 24 条平铺列表看不出「现在该用哪个」——分组本身就是引导。
 * 只影响呈现：命令集合的唯一真源仍是 TOPICS，漏进分组表的会落进「其他」兜底，
 * 且由 cli.test 的对账用例断言分组表与 TOPICS 无差集。
 */
const HELP_GROUPS = [
  ['项目结构', ['create', 'init', 'app', 'update', 'upgrade', 'doctor']],
  ['规划期（PLANNING）', ['validate', 'render-review', 'render-prototype', 'render-matrix', 'mock', 'approve']],
  ['设计期（DESIGNING）', ['design']],
  ['开发期（DEVELOPING）', ['go', 'status', 'plan', 'sync', 'context', 'trace', 'render-journal']],
  ['收口与维护', ['converge', 'certify', 'retro', 'change']],
  ['其他', ['version', 'help']],
];

/** 编辑距离（与 post-write.mjs 的图标最近邻同款手法，A8 T1-2）。 */
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i];
    for (let j = 1; j <= n; j += 1) {
      cur[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * 拼错命令名时的近似候选（最多 3 个）。
 * vima 对**图标名**拼错早就给最近邻候选（A8 T1-2 吸收自 v0），对**命令名**却只说
 * 「未知命令」——同一个仓库里两套待遇。阈值取 ≤ 名字长度的一半且 ≤4，
 * 宁可不给也不给一串风马牛不相及的候选。
 */
function nearestCommands(name) {
  const lower = String(name).toLowerCase();
  const limit = Math.min(4, Math.max(1, Math.floor(lower.length / 2)));
  return Object.keys(TOPICS)
    .map((candidate) => ({ candidate, d: editDistance(lower, candidate) }))
    .filter((x) => x.d <= limit)
    .sort((x, y) => x.d - y.d || (x.candidate < y.candidate ? -1 : 1))
    .slice(0, 3)
    .map((x) => x.candidate);
}

/** 未知命令的统一提示：有近似候选就先给候选，再给 help 兜底。 */
function unknownCommandHint(name) {
  const near = nearestCommands(name);
  return near.length > 0
    ? `提示: 你是不是要 ${near.map((c) => `vima ${c}`).join(' / ')}？（全部命令：vima help）\n`
    : '提示: 运行 vima help 查看全部命令\n';
}

function usage() {
  const lines = ['用法: vima <command> [options]', ''];
  const listed = new Set();
  for (const [group, names] of HELP_GROUPS) {
    lines.push(`${group}:`);
    for (const name of names) {
      const t = TOPICS[name];
      if (!t) continue; // 分组表引用了不存在的命令 → 静默跳过，由 cli.test 的对账用例抓
      listed.add(name);
      lines.push(`  ${name.padEnd(18)} ${t.desc}`);
    }
    lines.push('');
  }
  // 兜底：新增命令若忘了进分组表，仍然列得出来（不静默消失）
  const rest = Object.keys(TOPICS).filter((n) => !listed.has(n));
  if (rest.length > 0) {
    lines.push('其他:');
    for (const name of rest) lines.push(`  ${name.padEnd(18)} ${TOPICS[name].desc}`);
    lines.push('');
  }
  lines.push('查看单个命令的用法：vima help <command> 或 vima <command> --help');
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
      process.stderr.write(`${formatError('help', usageError(`未知命令 "${topic}"`))}\n${unknownCommandHint(topic)}`);
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
    process.stderr.write(`${formatError(cmd, usageError(`未知命令 "${cmd}"`))}\n${unknownCommandHint(cmd)}`);
    return EXIT.USAGE;
  }

  // `vima <cmd> --help|-h`：在命令自身解析参数之前拦截（契约 §3 顶层路由）
  if (wantsHelp(argv.slice(1))) {
    process.stdout.write(`${commandHelp(cmd)}\n`);
    return EXIT.OK;
  }

  // §20.2 调试模式：DEBUG=vima:*（或 *）时错误附带完整堆栈（契约 §14）
  const debug = /^(\*|vima)/.test(process.env.DEBUG ?? '');

  // A24 项目根感知：项目内命令锚定项目根而非当前目录。原行为在子目录静默按 cwd 工作，
  // 会给出「假结论」并**把它落盘**（实测：backend/ 下 validate 报 2 错误并写出 pass:false）。
  const invokedFrom = process.cwd();
  let root = invokedFrom;
  if (PROJECT_SCOPED.has(cmd)) {
    const found = await findProjectRoot(invokedFrom);
    if (found === null) {
      // 不在项目里就没有可读的产物，按 cwd 硬跑只会产出错误结论与游离报告。
      // PROJECT_REQUIRED 之外的两个命令有各自的合法「无项目」语义，照常放行。
      if (PROJECT_REQUIRED.has(cmd)) {
        const err = precondition(
          'NOT_IN_PROJECT',
          '当前目录及其任何祖先都不是 vima 项目（未找到 .vima/ 或 docs/lifecycle.json）——'
            + '请切换到项目根，或先运行 vima create / vima init',
          invokedFrom,
        );
        process.stderr.write(`${formatError(cmd, err)}\n`);
        if (debug && err.stack) process.stderr.write(`${err.stack}\n`); // 契约 §14 同口径
        return err.exitCode;
      }
    } else {
      root = found;
      if (root !== invokedFrom) {
        // 定位提示走 stderr：stdout 要留给 --json 等机读输出（契约 §3 输出流向）
        process.stderr.write(`ℹ️ 已定位项目根：${root}（当前目录 ${invokedFrom}）\n`);
      }
    }
  }

  const ctx = { cwd: root, cliRoot: CLI_ROOT, invokedFrom };
  const rest = argv.slice(1);
  // A35：三个返回点全部经 journalCommand——漏一条路径，曲线就断一段。
  try {
    const mod = await import(`./commands/${cmd}.mjs`);
    const code = (await mod.run(rest, ctx)) ?? EXIT.OK;
    journalCommand(root, cmd, rest, code);
    return code;
  } catch (err) {
    if (err instanceof VimaError) {
      process.stderr.write(`${formatError(cmd, err)}\n`);
      if (err.code === 'USAGE') process.stderr.write(`提示: 运行 vima ${cmd} --help 查看用法\n`);
      if (debug && err.stack) process.stderr.write(`${err.stack}\n`);
      journalCommand(root, cmd, rest, err.exitCode);
      return err.exitCode;
    }
    // 未预期异常：message 稳定输出，完整堆栈仅在 DEBUG 下附带（契约 §3/§14）
    process.stderr.write(`vima ${cmd}: ERROR: ${err.message}\n`);
    if (debug && err.stack) process.stderr.write(`${err.stack}\n`);
    journalCommand(root, cmd, rest, EXIT.ERROR);
    return EXIT.ERROR;
  }
}
