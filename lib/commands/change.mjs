// vima change —— 维护期变更事务（A31；契约 §6.18 / §3.1）
// 变更包 = 基线快照 + 确定性影响面 + 传播闸门：让「哪些受影响 / 哪些 done 要重开 /
// 哪些验证要重跑 / 传播完没有 / 差异与批准记录在哪」五问全部可机器回答。
// 解析与判定全部复用既有实现（loadSpec/loadContracts/loadTasks/ownedApisOf/
// validateProject/converge.run），不写第二套。impact.json 无时间戳，同输入同字节。
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';
import { EXIT, VimaError, usageError, usageFromParseArgs, precondition, checkFailed } from '../util/errors.mjs';
import { atomicWriteFile, stableStringify, fileExists, sha256 } from '../util/fs.mjs';
import { loadSpec } from '../model/spec.mjs';
import { loadContracts, apiKey } from '../model/contracts.mjs';
import { loadTasks, saveTaskFrontmatter } from '../model/tasks.mjs';
import { normalizeApiRef, ownedApisOf, validateProject } from './validate.mjs';
import { run as convergeRun } from './converge.mjs';
import {
  loadLifecycle, saveLifecycle, designApprovalOf, designCapabilityOf, designScopePagesOf,
} from '../model/lifecycle.mjs';

// A34 D-A34-19：DESIGNING 的受控回写环复用本模块的基线快照与影响面算法，
// 但用自己的关闭闸门（不要求任务 done）——故此处导出，勿改为局部常量。
export const CHANGES_REL = '.vima/changes';
const ID_RE = /^chg-\d{3}$/;

// ---------------------------------------------------------------------------
// 变更包读写
// ---------------------------------------------------------------------------

async function listChangeDirs(root) {
  let names;
  try {
    names = await readdir(path.join(root, CHANGES_REL));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return names.filter((n) => ID_RE.test(n)).sort();
}

async function readChange(root, id) {
  const rel = `${CHANGES_REL}/${id}/change.json`;
  const text = await readFile(path.join(root, rel), 'utf8');
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new VimaError('ERROR', `变更包状态文件解析失败: ${err.message}`, { path: rel, exitCode: EXIT.ERROR });
  }
}

async function loadAllChanges(root) {
  const out = [];
  for (const id of await listChangeDirs(root)) out.push(await readChange(root, id));
  return out;
}

async function saveChange(root, change) {
  await atomicWriteFile(path.join(root, CHANGES_REL, change.id, 'change.json'), stableStringify(change));
}

/** 目标变更包：显式 id，否则唯一在途（非 closed）；无在途 → NO_CHANGE。 */
async function resolveChange(root, explicitId) {
  if (explicitId !== undefined) {
    if (!ID_RE.test(explicitId)) throw usageError(`变更 id "${explicitId}" 不合法（形如 chg-001）`);
    if (!(await fileExists(path.join(root, CHANGES_REL, explicitId, 'change.json')))) {
      throw usageError(`变更包 ${explicitId} 不存在（vima change list 查看现有变更）`);
    }
    return readChange(root, explicitId);
  }
  const open = (await loadAllChanges(root)).filter((c) => c.status !== 'closed');
  if (open.length === 0) {
    throw precondition('NO_CHANGE', '没有在途（非 closed）的变更包——先 vima change open "<描述>"', CHANGES_REL);
  }
  return open[0]; // 单变更在途（CHANGE_ACTIVE 保证 ≤1）
}

// ---------------------------------------------------------------------------
// 基线快照与哈希
// ---------------------------------------------------------------------------

/** 契约文件清单（与 loadContracts 同过滤口径：.md、跳过 _ 前缀）。 */
async function contractFileNames(rootLike) {
  let names;
  try {
    names = await readdir(path.join(rootLike, 'docs', 'contracts'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return names.filter((n) => n.endsWith('.md') && !n.startsWith('_')).sort();
}

/** 现状真源哈希（open 记 baseline，close 记 closedSourceHash——同一实现防口径漂移）。 */
async function sourceHashes(root) {
  const out = { spec: null, contracts: {} };
  const specPath = path.join(root, 'docs', 'spec.md');
  if (await fileExists(specPath)) out.spec = sha256(await readFile(specPath, 'utf8'));
  for (const name of await contractFileNames(root)) {
    out.contracts[`docs/contracts/${name}`] = sha256(await readFile(path.join(root, 'docs', 'contracts', name), 'utf8'));
  }
  return out;
}

/** 逐字节快照 docs/spec.md 与 docs/contracts/*.md 到变更包 baseline/（镜像 docs/ 结构）。 */
export async function snapshotBaseline(root, changeDir) {
  const specPath = path.join(root, 'docs', 'spec.md');
  if (await fileExists(specPath)) {
    await atomicWriteFile(path.join(changeDir, 'baseline', 'docs', 'spec.md'), await readFile(specPath, 'utf8'));
  }
  for (const name of await contractFileNames(root)) {
    await atomicWriteFile(
      path.join(changeDir, 'baseline', 'docs', 'contracts', name),
      await readFile(path.join(root, 'docs', 'contracts', name), 'utf8'),
    );
  }
}

// ---------------------------------------------------------------------------
// 影响面推导（契约 §6.18；确定性 join，无时间戳）
// ---------------------------------------------------------------------------

/** 宽容加载 spec：缺失（NO_SPEC）视为空集——基线期没有 spec 的项目不因此炸锅。 */
async function loadSpecOrNull(rootLike) {
  try {
    return await loadSpec(rootLike);
  } catch (err) {
    if (err instanceof VimaError && err.code === 'NO_SPEC') return null;
    throw err;
  }
}

/** 解析成功且带机读块的契约（parseError / 无块的文件不参与 diff——它们没有可比对的 apis）。 */
async function loadParsedContracts(rootLike) {
  return (await loadContracts(rootLike, { tolerant: true })).filter((c) => !c.parseError && c.module !== null);
}

/** 按 id 的三档 diff：added / removed / modified（modified = stableStringify 不等）。 */
function diffById(baseArr, curArr, idOf) {
  const base = new Map();
  for (const e of baseArr) {
    const id = idOf(e);
    if (typeof id === 'string' && id !== '') base.set(id, e);
  }
  const cur = new Map();
  for (const e of curArr) {
    const id = idOf(e);
    if (typeof id === 'string' && id !== '') cur.set(id, e);
  }
  const added = [...cur.keys()].filter((id) => !base.has(id)).sort();
  const removed = [...base.keys()].filter((id) => !cur.has(id)).sort();
  const modified = [...cur.keys()]
    .filter((id) => base.has(id) && stableStringify(cur.get(id)) !== stableStringify(base.get(id)))
    .sort();
  return { added, removed, modified };
}

/** 契约集合 → 归一键 → { api, file }（同键后写覆盖先写——V-CON-04 已保证跨契约唯一）。 */
function apiIndexOf(contracts) {
  const out = new Map();
  for (const c of contracts) {
    for (const api of c.apis) {
      if (typeof api.method !== 'string' || api.method === '') continue;
      if (typeof api.path !== 'string' || api.path === '') continue;
      out.set(normalizeApiRef(apiKey(api)), { api, file: c.file });
    }
  }
  return out;
}

/** 计算影响面（只读；调用方决定是否落盘 impact.json）。 */
export async function computeImpact(root, change) {
  const baselineRoot = path.join(root, CHANGES_REL, change.id, 'baseline');
  const baseSpec = await loadSpecOrNull(baselineRoot);
  const curSpec = await loadSpecOrNull(root);
  const baseContracts = await loadParsedContracts(baselineRoot);
  const curContracts = await loadParsedContracts(root);
  const tasks = await loadTasks(root);

  const specDiff = {
    pages: diffById(baseSpec ? [...baseSpec.pages.values()] : [], curSpec ? [...curSpec.pages.values()] : [], (p) => p.id),
    menus: diffById(baseSpec?.menus ?? [], curSpec?.menus ?? [], (m) => m?.id),
    roles: diffById(baseSpec?.roles ?? [], curSpec?.roles ?? [], (r) => r?.id),
    flows: diffById(baseSpec?.flows ?? [], curSpec?.flows ?? [], (f) => f?.id),
    rules: diffById(baseSpec?.rules ?? [], curSpec?.rules ?? [], (r) => r?.id),
    nonGoals: diffById(baseSpec?.nonGoals ?? [], curSpec?.nonGoals ?? [], (n) => n?.id),
    entities: diffById(baseSpec?.entities ?? [], curSpec?.entities ?? [], (e) => e?.name),
  };

  const baseApis = apiIndexOf(baseContracts);
  const curApis = apiIndexOf(curContracts);
  const apisDiff = diffById(
    [...baseApis.entries()].map(([key, v]) => ({ key, ...v.api })),
    [...curApis.entries()].map(([key, v]) => ({ key, ...v.api })),
    (e) => e.key,
  );
  const changedKeys = new Set([...apisDiff.added, ...apisDiff.removed, ...apisDiff.modified]);

  // 变更键 → 契约文件（removed 键在现状契约里已不存在，须回基线归属）
  const fileOfKey = (key) => curApis.get(key)?.file ?? baseApis.get(key)?.file ?? null;

  // 变更规则的实体（added/modified 取现状条目，removed 取基线条目）
  const ruleById = new Map();
  for (const r of baseSpec?.rules ?? []) if (r?.id) ruleById.set(r.id, r);
  for (const r of curSpec?.rules ?? []) if (r?.id) ruleById.set(r.id, r);
  const changedRules = [...specDiff.rules.added, ...specDiff.rules.removed, ...specDiff.rules.modified]
    .map((id) => ruleById.get(id))
    .filter(Boolean);

  const changedPages = new Set([...specDiff.pages.modified, ...specDiff.pages.removed]);

  // ── 受影响任务（reasons 逐条留痕）──
  const affectedTasks = [];
  for (const t of tasks) {
    const reasons = [];

    if (typeof t.fm.page === 'string' && changedPages.has(t.fm.page)) {
      reasons.push(`页面 ${t.fm.page} 变更`);
    }

    // 任务负责键集：声明 apis 取声明集；否则契约全集（基线 ∪ 现状——removed 键也要能命中）
    let taskKeys = new Set();
    if (typeof t.fm.contract === 'string' && t.fm.contract !== '') {
      const owned = ownedApisOf(t, curContracts);
      if (owned?.declared) {
        taskKeys = new Set([...owned.keys].map(normalizeApiRef));
      } else {
        for (const [key, v] of curApis) if (v.file === t.fm.contract) taskKeys.add(key);
        for (const [key, v] of baseApis) if (v.file === t.fm.contract) taskKeys.add(key);
      }
      const hits = [...changedKeys].filter((k) => taskKeys.has(k) && fileOfKey(k) === t.fm.contract).sort();
      if (hits.length > 0) {
        reasons.push(`契约 ${t.fm.contract} 接口变更命中负责集（${hits.slice(0, 3).join('、')}${hits.length > 3 ? ' 等' : ''}）`);
      }
    }

    // 规则 join：任务接口集 = 页面 apis ∪ 契约负责集（A13 context 同口径）
    const pageApis = typeof t.fm.page === 'string' && curSpec?.pages.has(t.fm.page)
      ? (curSpec.pages.get(t.fm.page).apis ?? []).map(normalizeApiRef)
      : [];
    const taskApiSet = new Set([...taskKeys, ...pageApis]);
    for (const rule of changedRules) {
      if (Array.isArray(rule.apis) && rule.apis.length > 0) {
        if (rule.apis.map(normalizeApiRef).some((k) => taskApiSet.has(k))) {
          reasons.push(`规则 ${rule.id} 变更命中任务接口`);
        }
      } else if (t.fm.layer === 'business') {
        reasons.push(`全局规则 ${rule.id} 变更`);
      }
    }

    if (reasons.length > 0) affectedTasks.push({ taskId: t.id, status: t.fm.status, reasons });
  }
  affectedTasks.sort((a, b) => (a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0));
  const reopen = affectedTasks.filter((t) => t.status === 'done').map((t) => t.taskId);

  // ── recheck 静态推导（契约 §6.18）──
  const specChanges = Object.values(specDiff)
    .reduce((s, d) => s + d.added.length + d.removed.length + d.modified.length, 0);
  const apiChanges = changedKeys.size;
  const recheck = ['vima validate'];
  if (specChanges > 0) recheck.push('vima render-review', 'vima render-prototype');
  if (specDiff.pages.added.length + specDiff.pages.removed.length + specDiff.pages.modified.length > 0
    || apiChanges > 0) recheck.push('vima render-matrix');
  if (apiChanges > 0 || affectedTasks.length > 0) recheck.push('vima converge');

  return {
    schemaVersion: '1',
    changeId: change.id,
    spec: specDiff,
    apis: { added: apisDiff.added, removed: apisDiff.removed, modified: apisDiff.modified },
    affectedTasks,
    reopen,
    recheck,
    summary: {
      specChanges,
      apiChanges,
      affectedTasks: affectedTasks.length,
      reopen: reopen.length,
    },
  };
}

export async function writeImpact(root, impact) {
  await atomicWriteFile(
    path.join(root, CHANGES_REL, impact.changeId, 'impact.json'),
    stableStringify(impact),
  );
}

function printImpact(impact) {
  const s = impact.summary;
  const lines = [
    `📦 变更 ${impact.changeId} 影响面：spec 条目 ${s.specChanges} │ 接口 ${s.apiChanges} │ 受影响任务 ${s.affectedTasks}（其中 done 待重开 ${s.reopen}）`,
  ];
  for (const t of impact.affectedTasks) {
    lines.push(`   - ${t.taskId} [${t.status}] ← ${t.reasons.join('；')}`);
  }
  lines.push(`   须重跑：${impact.recheck.join(' → ')}`);
  lines.push(`   报告：${CHANGES_REL}/${impact.changeId}/impact.json`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

// ---------------------------------------------------------------------------
// 子命令
// ---------------------------------------------------------------------------

async function cmdOpen(root, positionals) {
  const description = positionals.join(' ').trim();
  if (description === '') throw usageError('变更描述必填：vima change open "<变更描述>"');
  const active = (await loadAllChanges(root)).filter((c) => c.status !== 'closed');
  if (active.length > 0) {
    throw precondition(
      'CHANGE_ACTIVE',
      `已存在在途变更包 ${active[0].id}（${active[0].status}）——单变更在途：先 vima change close 再开新变更`,
      `${CHANGES_REL}/${active[0].id}`,
    );
  }
  const ids = await listChangeDirs(root);
  const next = ids.length === 0 ? 1 : Math.max(...ids.map((id) => Number(id.slice(4)))) + 1;
  const id = `chg-${String(next).padStart(3, '0')}`;
  const changeDir = path.join(root, CHANGES_REL, id);
  await snapshotBaseline(root, changeDir);
  const change = {
    schemaVersion: '1',
    id,
    description,
    status: 'open',
    openedAt: new Date().toISOString(),
    appliedAt: null,
    closedAt: null,
    baseline: await sourceHashes(root),
    reopened: [],
    closedSourceHash: null,
  };
  await saveChange(root, change);
  process.stdout.write(
    `✅ 变更包已开启：${id}「${description}」\n`
    + `   基线快照：${CHANGES_REL}/${id}/baseline/（spec ${change.baseline.spec === null ? '缺失' : '已快照'} / 契约 ${Object.keys(change.baseline.contracts).length} 份）\n`
    + '   下一步：改 docs/spec.md 与契约 → vima change impact 查看影响面 → vima change apply 重开受影响任务\n',
  );
  return EXIT.OK;
}

async function cmdList(root) {
  const changes = await loadAllChanges(root);
  if (changes.length === 0) {
    process.stdout.write('（无变更包）vima change open "<描述>" 开启维护期变更事务\n');
    return EXIT.OK;
  }
  const lines = ['变更包（.vima/changes/）：'];
  for (const c of changes) {
    lines.push(`  ${c.id}  [${c.status}]  ${c.description}（开启 ${c.openedAt}${c.closedAt ? `，关闭 ${c.closedAt}` : ''}）`);
  }
  process.stdout.write(`${lines.join('\n')}\n`);
  return EXIT.OK;
}

async function cmdImpact(root, change) {
  const impact = await computeImpact(root, change);
  await writeImpact(root, impact);
  printImpact(impact);
  return EXIT.OK;
}

async function cmdApply(root, change) {
  if (change.status === 'closed') {
    throw precondition('NO_CHANGE', `变更包 ${change.id} 已关闭（closed），不可 apply`, `${CHANGES_REL}/${change.id}`);
  }
  const impact = await computeImpact(root, change);
  await writeImpact(root, impact);
  const tasks = await loadTasks(root);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const id of impact.reopen) {
    await saveTaskFrontmatter(byId.get(id), { status: 'pending', updatedAt: new Date().toISOString() });
  }

  // 页面语义改变后，旧页面批准不再代表当前产品。legacy 只让受影响页进入局部 A34，
  // 新项目则沿用全量能力；两者都回到 DESIGNING，避免维护期绕开设计轨道。
  const pageDiff = impact.spec?.pages ?? { added: [], removed: [], modified: [] };
  const changedPages = [...new Set([...pageDiff.added, ...pageDiff.modified, ...pageDiff.removed])].sort();
  const activeDesignPages = [...new Set([...pageDiff.added, ...pageDiff.modified])].sort();
  if (changedPages.length > 0) {
    const lifecycle = await loadLifecycle(root);
    const approval = designApprovalOf(lifecycle);
    for (const id of changedPages) delete approval.pages[id];
    lifecycle.designApproval = approval;

    if (designCapabilityOf(lifecycle) === 'legacy') {
      const removed = new Set(pageDiff.removed);
      lifecycle.designScope = {
        pages: [...new Set([
          ...designScopePagesOf(lifecycle).filter((id) => !removed.has(id)),
          ...activeDesignPages,
        ])].sort(),
      };
    }

    if (activeDesignPages.length > 0) {
      const now = new Date().toISOString();
      lifecycle.checklists ??= {};
      lifecycle.checklists.PLANNING ??= {};
      lifecycle.checklists.PLANNING.tasksApproved = false;
      lifecycle.checklists.PLANNING.tasksApprovedInvalidatedAt = now;
      lifecycle.checklists.PLANNING.tasksApprovedInvalidatedReason = `变更 ${change.id} 新增/修改页面：${activeDesignPages.join('、')}，须重走局部设计与任务批准`;
      lifecycle.phaseHistory ??= [];
      const open = [...lifecycle.phaseHistory].reverse().find((h) => h.completedAt === null);
      if (open && open.phase !== 'DESIGNING') open.completedAt = now;
      lifecycle.currentPhase = 'DESIGNING';
      if (!lifecycle.phaseHistory.some((h) => h.phase === 'DESIGNING' && h.completedAt === null)) {
        lifecycle.phaseHistory.push({
          phase: 'DESIGNING', enteredAt: now, completedAt: null,
          note: `变更 ${change.id} 的页面影响面进入局部设计轨道`,
        });
      }
    }
    await saveLifecycle(root, lifecycle);
  }
  change.status = 'applied';
  change.appliedAt = new Date().toISOString();
  change.reopened = [...new Set([...change.reopened, ...impact.reopen])].sort();
  await saveChange(root, change);
  printImpact(impact);
  process.stdout.write(
    impact.reopen.length === 0
      ? 'ℹ️ 无 done 任务需要重开（受影响任务本就未完成，或影响面为空）\n'
      : `✅ 已重开 ${impact.reopen.length} 个任务（done → pending）：${impact.reopen.join('、')}\n`,
  );
  return EXIT.OK;
}

async function cmdClose(root, change, ctx) {
  if (change.status === 'closed') {
    throw precondition('NO_CHANGE', `变更包 ${change.id} 已关闭（closed）`, `${CHANGES_REL}/${change.id}`);
  }
  const impact = await computeImpact(root, change);
  await writeImpact(root, impact);

  const gaps = [];
  const undone = impact.affectedTasks.filter((t) => t.status !== 'done');
  if (undone.length > 0) {
    gaps.push(`受影响任务未全部 done：${undone.map((t) => `${t.taskId}[${t.status}]`).join('、')}`);
  }
  const validation = await validateProject(root, { cliRoot: ctx.cliRoot });
  if (validation.errors.length > 0) {
    gaps.push(`vima validate 有 ${validation.errors.length} 个 error（先修复并重跑 vima validate）`);
  }
  // 存在重开记录或接口变更 → 集成对账必须新鲜且为绿（进程内跑，顺带落新报告）
  if (gaps.length === 0 && (change.reopened.length > 0 || impact.summary.apiChanges > 0)) {
    const code = await convergeRun([], ctx);
    if (code !== EXIT.OK) gaps.push('vima converge 未通过（见上方对账输出与 .vima/reports/convergence.json）');
  }

  if (gaps.length > 0) {
    process.stderr.write(`❌ 变更 ${change.id} 传播闸门未过：\n${gaps.map((g) => `  - ${g}`).join('\n')}\n`);
    throw checkFailed('CHANGE_UNPROPAGATED', `变更未完整传播（${gaps.length} 项缺口，见 stderr 清单）`, `${CHANGES_REL}/${change.id}`);
  }

  change.status = 'closed';
  change.closedAt = new Date().toISOString();
  change.closedSourceHash = await sourceHashes(root);
  await saveChange(root, change);
  process.stdout.write(
    `✅ 变更 ${change.id} 已关闭：受影响任务 ${impact.summary.affectedTasks} 个全部 done，validate 零 error`
    + `${change.reopened.length > 0 || impact.summary.apiChanges > 0 ? '，converge 通过' : ''}\n`
    + `   审计留痕：${CHANGES_REL}/${change.id}/（baseline 快照保留，差异与批准记录见 change.json / impact.json）\n`,
  );
  return EXIT.OK;
}

/** vima change open|list|impact|apply|close [<id>] */
export async function run(argv, ctx) {
  let positionals;
  try {
    ({ positionals } = parseArgs({ args: argv, options: {}, allowPositionals: true }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }
  const sub = positionals[0];
  const root = ctx.cwd;
  switch (sub) {
    case 'open':
      return cmdOpen(root, positionals.slice(1));
    case 'list':
      if (positionals.length > 1) throw usageError(`多余的位置参数 "${positionals[1]}"`);
      return cmdList(root);
    case 'impact':
      if (positionals.length > 2) throw usageError(`多余的位置参数 "${positionals[2]}"`);
      return cmdImpact(root, await resolveChange(root, positionals[1]));
    case 'apply':
      if (positionals.length > 2) throw usageError(`多余的位置参数 "${positionals[2]}"`);
      return cmdApply(root, await resolveChange(root, positionals[1]));
    case 'close':
      if (positionals.length > 2) throw usageError(`多余的位置参数 "${positionals[2]}"`);
      return cmdClose(root, await resolveChange(root, positionals[1]), ctx);
    case undefined:
      throw usageError('缺少子命令：vima change open|list|impact|apply|close');
    default:
      throw usageError(`未知子命令 "${sub}"（可用：open|list|impact|apply|close）`);
  }
}
