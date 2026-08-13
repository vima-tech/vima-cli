// vima doctor —— 一键体检（设计 §19.4，internal-contracts §3/§6）：
//   ①环境依赖 ②CLAUDE.md 体量 ③lifecycle 结构 ④taskStats 对账 ⑤README 一致性
//   ⑥.claude 完整性 ⑦hooks 可执行位 ⑧manifest 校验和 ⑨对齐产物漂移 ⑩评审批准时效
//   ⑪端册完整性 ⑫产物形态与当前规则的差距（A19 升级迁移）
// 逐项 ✅/⚠️/❌ 各一行；任一 ❌ → exit 2；--json 输出结构化结果。
import path from 'node:path';
import { readFile, readdir, stat } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { loadTasks } from '../model/tasks.mjs';
import { loadLifecycle } from '../model/lifecycle.mjs';
import { loadManifest } from '../model/manifest.mjs';
import { loadTemplate, readProjectTemplateId } from '../model/template.mjs';
import { resolveApps } from '../model/apps.mjs';
import { fileExists, sha256File, stableStringify } from '../util/fs.mjs';
import { EXIT, usageFromParseArgs } from '../util/errors.mjs';
import { countTaskStats, renderReadme } from './sync.mjs';
import { computeBatches } from './plan.mjs';
import { checkPrerequisites as probePrerequisites } from './create.mjs';

const PHASES = ['BOOTSTRAP', 'PLANNING', 'DEVELOPING', 'MAINTAINING'];
const CLAUDE_MD_MAX_LINES = 50;
const CLAUDE_DIR_REQUIRED = [
  '.claude/settings.json',
  '.claude/commands/go.md',
  '.claude/commands/check.md',
  '.claude/agents/vima-builder.md',
  '.claude/agents/vima-verifier.md',
  '.claude/agents/vima-planner.md',
  '.claude/hooks/guard-shared.mjs',
  '.claude/hooks/post-write.mjs',
  '.claude/hooks/go-continue.mjs', // A18：/go 批间续跑器（Stop hook）
];
const HOOK_FILES = [
  '.claude/hooks/guard-shared.mjs',
  '.claude/hooks/post-write.mjs',
  '.claude/hooks/go-continue.mjs',
];

/** 单项检查结果：status ∈ ok|warn|error。 */
function result(id, name, status, messages) {
  return { id, name, status, messages, detail: messages.join('；') };
}

/** 三态聚合：有 error 取 error，否则有 warn 取 warn，否则 ok。 */
function worst(statuses) {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('warn')) return 'warn';
  return 'ok';
}

// ── ① 模板 prerequisites（复用 create.mjs 的同一份预检逻辑，§3.6/契约 §14）──
async function checkPrerequisites(root, ctx) {
  const name = '① 环境依赖（模板 prerequisites）';
  let templateId = null;
  try {
    templateId = await readProjectTemplateId(root);
  } catch {
    return result('prerequisites', name, 'warn', ['manifest/lifecycle 不可读，无法确定模板，跳过']);
  }
  if (!templateId) return result('prerequisites', name, 'warn', ['无法确定项目模板 id，跳过环境依赖检查']);

  let template;
  try {
    template = await loadTemplate(ctx.cliRoot, templateId);
  } catch {
    return result('prerequisites', name, 'warn', [`模板 "${templateId}" 不可用，跳过环境依赖检查`]);
  }
  const prereqs = template.prerequisites ?? [];
  if (prereqs.length === 0) return result('prerequisites', name, 'ok', [`模板 "${templateId}" 未声明环境依赖`]);

  const { lines, failures } = probePrerequisites(prereqs);
  const status = failures.length > 0 ? 'error' : lines.some((l) => l.startsWith('⚠️')) ? 'warn' : 'ok';
  return result('prerequisites', name, status, lines);
}

// ── ② CLAUDE.md 行数 ≤ 50 ──────────────────────────────────────────────────
async function checkClaudeMd(root) {
  const name = `② CLAUDE.md 体量（≤${CLAUDE_MD_MAX_LINES} 行）`;
  const p = path.join(root, 'CLAUDE.md');
  if (!(await fileExists(p))) return result('claude-md', name, 'warn', ['未找到 CLAUDE.md']);
  const text = await readFile(p, 'utf8');
  const parts = text.split('\n');
  if (parts.at(-1) === '') parts.pop(); // 结尾换行不算一行
  const n = parts.length;
  if (n > CLAUDE_MD_MAX_LINES) {
    // §5.4：超限为「告警」级——提示迁移，不使体检整体失败（契约 §14）
    return result('claude-md', name, 'warn', [`CLAUDE.md 有 ${n} 行，超过 ${CLAUDE_MD_MAX_LINES} 行上限——把详情移入 .claude/commands/ 或 docs/，只留指针`]);
  }
  return result('claude-md', name, 'ok', [`CLAUDE.md ${n} 行`]);
}

// ── ③ lifecycle 结构 ───────────────────────────────────────────────────────
async function checkLifecycle(root) {
  const name = '③ lifecycle 结构（schemaVersion 2.0）';
  let lifecycle;
  try {
    lifecycle = await loadLifecycle(root);
  } catch (err) {
    return { check: result('lifecycle', name, 'error', [`docs/lifecycle.json 不可用：${err.message}`]), lifecycle: null };
  }
  const problems = [];
  if (lifecycle.schemaVersion !== '2.0') problems.push(`schemaVersion 应为 "2.0"，实际 "${lifecycle.schemaVersion}"`);
  if (!PHASES.includes(lifecycle.currentPhase)) problems.push(`currentPhase "${lifecycle.currentPhase}" 不合法（须为 ${PHASES.join('|')}）`);
  if (problems.length > 0) return { check: result('lifecycle', name, 'error', problems), lifecycle };
  return { check: result('lifecycle', name, 'ok', [`schemaVersion 2.0，currentPhase ${lifecycle.currentPhase}`]), lifecycle };
}

// ── ④ taskStats 与 frontmatter 对账 ────────────────────────────────────────
function checkTaskStats(lifecycle, tasks, tasksError) {
  const name = '④ taskStats 与任务 frontmatter 对账';
  if (tasksError) return result('task-stats', name, 'error', [`任务文件不可读：${tasksError.message}`]);
  if (!lifecycle) return result('task-stats', name, 'warn', ['lifecycle 不可用，跳过对账']);
  const actual = countTaskStats(tasks);
  const recorded = lifecycle.taskStats ?? {};
  const diffs = ['total', 'done', 'failed', 'blocked']
    .filter((k) => recorded[k] !== actual[k])
    .map((k) => `${k} 记录 ${recorded[k] ?? '缺'} / 实际 ${actual[k]}`);
  if (diffs.length > 0) return result('task-stats', name, 'error', [`${diffs.join('，')}——运行 vima sync 重建`]);
  return result('task-stats', name, 'ok', [`taskStats 一致（total ${actual.total}，done ${actual.done}）`]);
}

// ── ⑤ tasks/README.md 与 frontmatter 一致性（字节级：用 sync 生成器重建比对）──
async function checkTasksReadme(root, tasks, tasksError) {
  const name = '⑤ tasks/README.md 与 frontmatter 一致性';
  if (tasksError) return result('tasks-readme', name, 'warn', ['任务文件不可读，跳过']);
  const p = path.join(root, 'docs', 'tasks', 'README.md');
  if (!(await fileExists(p))) return result('tasks-readme', name, 'warn', ['docs/tasks/README.md 未生成——运行 vima sync']);
  let expected;
  try {
    expected = renderReadme(tasks, computeBatches(tasks));
  } catch (err) {
    return result('tasks-readme', name, 'warn', [`依赖图不可用（${err.message}），无法重建比对`]);
  }
  const text = await readFile(p, 'utf8');
  if (text !== expected) {
    return result('tasks-readme', name, 'warn', ['README 与 frontmatter 重建结果不一致（批次/状态已漂移）——运行 vima sync 重建']);
  }
  return result('tasks-readme', name, 'ok', [`与 ${tasks.length} 个任务的 frontmatter 重建结果字节一致`]);
}

// ── ⑥ .claude 完整性 ───────────────────────────────────────────────────────
async function checkClaudeDir(root) {
  const name = '⑥ .claude 配置完整性（settings + 2 命令 + 3 角色 + 3 hooks）';
  const missing = [];
  for (const rel of CLAUDE_DIR_REQUIRED) {
    if (!(await fileExists(path.join(root, rel)))) missing.push(rel);
  }
  if (missing.length > 0) return result('claude-dir', name, 'error', [`缺失：${missing.join('、')}——运行 vima init 修复`]);
  return result('claude-dir', name, 'ok', [`${CLAUDE_DIR_REQUIRED.length} 个文件齐全`]);
}

// ── ⑦ hooks 可执行位 ───────────────────────────────────────────────────────
async function checkHooksExecutable(root) {
  const name = '⑦ hooks 脚本可执行位';
  const bad = [];
  let seen = 0;
  for (const rel of HOOK_FILES) {
    const p = path.join(root, rel);
    if (!(await fileExists(p))) continue; // 缺文件由 ⑥ 负责
    seen += 1;
    const st = await stat(p);
    if ((st.mode & 0o111) === 0) bad.push(rel);
  }
  if (seen === 0) return result('hooks-exec', name, 'warn', ['hooks 脚本不存在，跳过（见 ⑥）']);
  if (bad.length > 0) return result('hooks-exec', name, 'error', [`不可执行：${bad.join('、')}——运行 chmod +x 修复`]);
  return result('hooks-exec', name, 'ok', [`${seen} 个 hook 脚本均可执行`]);
}

// ── ⑧ manifest managed 校验和对账 ─────────────────────────────────────────
async function checkManifest(root) {
  const name = '⑧ manifest 受管文件校验和对账';
  let manifest;
  try {
    manifest = await loadManifest(root);
  } catch (err) {
    return result('manifest', name, 'error', [`manifest.json 不可读：${err.message}`]);
  }
  if (!manifest) return result('manifest', name, 'warn', ['未找到 .vima/manifest.json（未 vima init？）']);
  const managed = manifest.files?.managed ?? [];
  const missing = [];
  const modified = [];
  for (const entry of managed) {
    const p = path.join(root, entry.path);
    if (!(await fileExists(p))) {
      missing.push(entry.path);
      continue;
    }
    const expected = String(entry.checksum ?? '').replace(/^sha256:/, '');
    if ((await sha256File(p)) !== expected) modified.push(entry.path);
  }
  const messages = [];
  const statuses = [];
  if (missing.length > 0) {
    messages.push(`受管文件缺失：${missing.join('、')}——运行 vima update 修复`);
    statuses.push('error');
  }
  if (modified.length > 0) {
    messages.push(`受管文件被手改：${modified.join('、')}（升级时将按三方比较处理）`);
    statuses.push('warn');
  }
  if (messages.length === 0) messages.push(`${managed.length} 个受管文件与清单一致`);
  return result('manifest', name, worst(statuses), messages);
}

// ── ⑩ 评审批准时效（tasksApproved 是否早于产物最后改动）────────────────────
//
// tasksApproved 只能由 vima approve 置位，却没有任何失效路径：产物在批准之后被大改，
// 标志位仍是 true，下一次 /go 会拿着一份没人看过的规格直接进 DEVELOPING。
// 这里按 mtime 给出时效判断——批准早于 spec/契约的最后改动即视为过期。
async function checkApprovalFreshness(root, lifecycle) {
  const name = '⑩ 评审批准时效（tasksApproved 是否覆盖当前产物）';
  if (!lifecycle) return result('approval', name, 'warn', ['lifecycle 不可用，跳过']);
  const pl = lifecycle.checklists?.PLANNING ?? {};
  if (pl.tasksApproved !== true) {
    return result('approval', name, 'ok', ['tasksApproved 未置位，无时效问题']);
  }
  const at = Date.parse(pl.tasksApprovedAt ?? '');
  if (!Number.isFinite(at)) {
    return result('approval', name, 'warn', ['tasksApproved 为 true 但 tasksApprovedAt 缺失/非法，无法判断时效']);
  }
  const watched = ['docs/spec.md'];
  const dir = path.join(root, 'docs', 'contracts');
  try {
    for (const n of await readdir(dir)) {
      if (n.endsWith('.md') && !n.startsWith('_')) watched.push(`docs/contracts/${n}`);
    }
  } catch { /* 无契约目录时只看 spec */ }
  const newer = [];
  for (const rel of watched) {
    try {
      const st = await stat(path.join(root, rel));
      if (st.mtimeMs > at) newer.push(rel);
    } catch { /* 文件缺失由其他规则负责 */ }
  }
  if (newer.length === 0) {
    return result('approval', name, 'ok', [`批准于 ${pl.tasksApprovedAt}，其后产物未再改动`]);
  }
  const sample = newer.slice(0, 3).join('、') + (newer.length > 3 ? ` 等 ${newer.length} 个文件` : '');
  return result('approval', name, 'error', [
    `批准于 ${pl.tasksApprovedAt}，但 ${sample} 在其后被修改——该批准已失效，`
    + '请重新评审后再次运行 vima approve（否则 /go 会带着未经评审的规格进入 DEVELOPING）',
  ]);
}

// ── ⑫ 产物形态与当前 CLI 规则的差距（A19 升级迁移体检）─────────────────────
// 与 validate 的分工：validate 说「缺什么」并据此阻断 /go；本项说「这是哪个增补项引入的、
// 补在哪一章、块长什么样」。级别与对应 validate 规则对齐，口径不打架。
// 只列**后加增补项引入的结构要求**——新项目的 spec 骨架天然满足，故本项只会命中老项目。
const ARTIFACT_SHAPE_RULES = [
  {
    id: 'A4-decision-table',
    from: 'A4',
    level: 'error', // 同 V-DEC-01
    target: 'docs/spec.md',
    label: 'spec 第八章决策表（含「已否决方案」列）',
    hint: '在第八章补 markdown 表，列：决策 / 理由 / 已否决方案 / 否决理由（编号 D-01…）',
    test: ({ spec }) => spec.includes('已否决方案'),
  },
  {
    id: 'A13-rules',
    from: 'A13',
    level: 'error', // 同 V-SPEC-09
    target: 'docs/spec.md',
    label: 'spec 第五章 vima:rules 块',
    hint: '在第五章补 ```yaml vima:rules 块，每条 id(RULE-xx)/type/entity/desc 四要素齐全',
    test: ({ spec }) => /```yaml\s+vima:rules\b/.test(spec),
  },
  {
    id: 'A13-non-goals',
    from: 'A13',
    level: 'error', // 同 V-SPEC-11
    target: 'docs/spec.md',
    label: 'spec 第九章 vima:non-goals 块',
    hint: '在第九章补 ```yaml vima:non-goals 块；空清单也须显式写 non-goals: []',
    test: ({ spec }) => /```yaml\s+vima:non-goals\b/.test(spec),
  },
  {
    id: 'A2-task-page',
    from: 'A2',
    level: 'warn', // 无对应 validate 规则：缺 page 不违规，只是享受不到单一真源与页面块切片
    target: 'docs/tasks/*.md',
    label: '前端业务任务带 page: PAGE-xx 引用',
    hint: '给 side=frontend 的 business 任务补 page 字段，并删掉正文里手写的页面结构/组件树',
    test: ({ feTasks }) => feTasks.length === 0 || feTasks.every((t) => typeof t.fm.page === 'string'),
  },
];

async function checkArtifactShape(root, tasks, tasksError) {
  const name = '⑫ 产物形态与当前规则的差距（升级迁移）';
  const specPath = path.join(root, 'docs', 'spec.md');
  if (!(await fileExists(specPath))) {
    return result('artifact-shape', name, 'warn', ['docs/spec.md 未生成，跳过（PLANNING 尚未产出规格）']);
  }
  const spec = await readFile(specPath, 'utf8');
  const feTasks = tasksError
    ? []
    : tasks.filter((t) => t.fm.layer === 'business' && t.fm.side === 'frontend');
  const ctxData = { spec, feTasks };

  const gaps = ARTIFACT_SHAPE_RULES.filter((r) => !r.test(ctxData));
  if (gaps.length === 0) {
    return result('artifact-shape', name, 'ok', [`${ARTIFACT_SHAPE_RULES.length} 项产物结构要求均已满足`]);
  }
  const messages = gaps.map(
    (r) => `缺「${r.label}」（${r.from} 引入，${r.target}）→ ${r.hint}`,
  );
  const status = gaps.some((r) => r.level === 'error') ? 'error' : 'warn';
  return result('artifact-shape', name, status, messages);
}

// ── ⑪ 端册完整性（A16）：dirs 在位 / id 合法 / kind 已声明 / 骨架就绪 ────────
const APP_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

async function checkAppsRoster(root, ctx, lifecycle) {
  const name = '⑪ 端册完整性（A16 apps）';
  // 契约 §14：骨架/目录缺失在 PLANNING 期为 ⚠️（设计先行合法态），DEVELOPING 起为 ❌ 阻断
  const missingLevel = lifecycle?.currentPhase === 'DEVELOPING' || lifecycle?.currentPhase === 'MAINTAINING' ? 'error' : 'warn';
  const roster = await resolveApps(root, { cliRoot: ctx.cliRoot });
  if (roster.apps.length === 0) {
    return result('apps', name, 'ok', ['无前端端册（该模板无前端语义），跳过']);
  }
  const messages = [];
  let status = 'ok';
  const bump = (level) => {
    if (level === 'error' || status === 'error') status = 'error';
    else status = 'warn';
  };
  const seen = new Set();
  for (const a of roster.apps) {
    if (!APP_ID_RE.test(a.id)) {
      messages.push(`端 id "${a.id}" 非法（须匹配 ^[a-z0-9][a-z0-9-]*$）`);
      bump('error');
    }
    if (seen.has(a.id)) {
      messages.push(`端 id "${a.id}" 在端册中重复`);
      bump('error');
    }
    seen.add(a.id);
    if (!roster.kinds[a.kind]) {
      messages.push(`端 ${a.id} 的 kind "${a.kind}" 未在模板 planning.kinds 声明（词表/外壳无从取）`);
      bump('error');
    }
    const dirAbs = path.join(root, a.dir === '.' ? '' : a.dir, a.codeDir);
    if (!(await fileExists(dirAbs))) {
      const kindStatus = roster.kinds[a.kind]?.status;
      if (kindStatus === 'preview') {
        // preview kind：入册未生成骨架是诚实状态——PLANNING 可先行，进 DEVELOPING 前须补齐
        messages.push(`端 ${a.id}（kind ${a.kind}，preview）骨架未生成：${a.dir}/${a.codeDir} 不在位（PLANNING 可先行）`);
        bump(missingLevel);
      } else {
        messages.push(`端 ${a.id} 的代码目录不在位：${a.dir}/${a.codeDir}${missingLevel === 'warn' ? '（进 DEVELOPING 前须补齐）' : ''}`);
        bump(missingLevel);
      }
    }
  }
  if (roster.backend && !(await fileExists(path.join(root, roster.backend.dir)))) {
    messages.push(`后端目录不在位：${roster.backend.dir}/${missingLevel === 'warn' ? '（进 DEVELOPING 前须补齐）' : ''}`);
    bump(missingLevel);
  }
  if (messages.length === 0) {
    messages.push(`端册 ${roster.apps.length} 端（${roster.apps.map((a) => `${a.id}:${a.kind}`).join('、')}）${roster.backend ? ' + backend' : ''}，目录齐整`);
  }
  return result('apps', name, status, messages);
}

// ── ⑨ 对齐产物漂移（等价 render-* --check）─────────────────────────────────
async function checkRenderDrift(root, ctx) {
  const name = '⑨ 对齐产物漂移（review/prototype 与 spec 字节一致）';
  // A16：原型产物按端册展开（多端 = prototype.<appId>.html；单端 = 旧名）——
  // 静态清单不得按字面路径检查，否则多端项目假阻塞（契约 §6.3 展开规则）
  const roster = await resolveApps(root, { cliRoot: ctx.cliRoot });
  const protoTargets = roster.multi
    ? roster.apps.map((a) => ({ product: `docs/review/prototype.${a.id}.html`, cmd: 'render-prototype' }))
    : [{ product: 'docs/review/prototype.html', cmd: 'render-prototype' }];
  const targets = [
    { product: 'docs/review/index.html', cmd: 'render-review' },
    ...protoTargets,
  ];
  const messages = [];
  const statuses = [];
  for (const { product, cmd } of targets) {
    const cmdModule = path.join(ctx.cliRoot, 'lib', 'commands', `${cmd}.mjs`);
    if (!(await fileExists(cmdModule))) {
      messages.push(`${cmd} 命令未就绪，跳过`);
      statuses.push('warn');
      continue;
    }
    if (!(await fileExists(path.join(root, product)))) {
      messages.push(`${product} 未渲染——运行 vima ${cmd}`);
      statuses.push('warn');
      continue;
    }
    const proc = spawnSync(process.execPath, [path.join(ctx.cliRoot, 'bin', 'vima.mjs'), cmd, '--check'], {
      cwd: root,
      encoding: 'utf8',
    });
    if (proc.status === 0) {
      messages.push(`${product} 与 spec 一致`);
      statuses.push('ok');
    } else if (proc.status === 2) {
      messages.push(`${product} 已漂移——重新运行 vima ${cmd}`);
      statuses.push('error');
    } else {
      messages.push(`${cmd} --check 异常退出（exit ${proc.status}），无法判定`);
      statuses.push('warn');
    }
  }
  return result('render-drift', name, worst(statuses), messages);
}

const ICONS = { ok: '✅', warn: '⚠️', error: '❌' };

export async function run(argv, ctx) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        json: { type: 'boolean', default: false },
        verbose: { type: 'boolean', default: false },
      },
      allowPositionals: true,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }

  const root = ctx.cwd;
  const vimaProject =
    (await fileExists(path.join(root, 'docs', 'lifecycle.json'))) ||
    (await fileExists(path.join(root, '.vima', 'manifest.json')));

  const checks = [];
  checks.push(await checkPrerequisites(root, ctx));
  checks.push(await checkClaudeMd(root));

  if (vimaProject) {
    const { check: lifecycleCheck, lifecycle } = await checkLifecycle(root);
    checks.push(lifecycleCheck);

    let tasks = [];
    let tasksError = null;
    try {
      tasks = await loadTasks(root);
    } catch (err) {
      tasksError = err;
    }
    checks.push(checkTaskStats(lifecycle, tasks, tasksError));
    checks.push(await checkTasksReadme(root, tasks, tasksError));
    checks.push(await checkClaudeDir(root));
    checks.push(await checkHooksExecutable(root));
    checks.push(await checkManifest(root));
    checks.push(await checkRenderDrift(root, ctx));
    checks.push(await checkApprovalFreshness(root, lifecycle));
    checks.push(await checkAppsRoster(root, ctx, lifecycle)); // A16 端册完整性
  checks.push(await checkArtifactShape(root, tasks, tasksError)); // A19 产物形态迁移体检
  }

  const pass = checks.every((c) => c.status !== 'error');

  if (values.json) {
    const report = {
      schemaVersion: '1',
      vimaProject,
      pass,
      checks: checks.map(({ id, name, status, detail, messages }) => ({ id, name, status, detail, messages })),
    };
    process.stdout.write(stableStringify(report));
    return pass ? EXIT.OK : EXIT.CHECK_FAILED;
  }

  const lines = [];
  if (!vimaProject) {
    lines.push('⚠️ 非 vima 项目（缺 docs/lifecycle.json 与 .vima/manifest.json），仅执行基础检查 ①②');
  }
  for (const c of checks) {
    lines.push(`${ICONS[c.status]} ${c.name}：${c.detail}`);
    if (values.verbose && c.messages.length > 1) {
      for (const m of c.messages) lines.push(`    - ${m}`);
    }
  }
  lines.push(pass ? '✅ 体检通过' : '❌ 体检未通过（存在 ❌ 项）');
  process.stdout.write(`${lines.join('\n')}\n`);
  return pass ? EXIT.OK : EXIT.CHECK_FAILED;
}
