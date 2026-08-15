// vima converge —— 跨任务集成对账（A20；契约 §8.1 规则族 / §6.13 报告格式 / 设计 §19.14）
// 确定性、零 token。V-CODE-01/02 是单向对账（单个文件不得出现契约之外的接口）；
// 本命令是跨任务的合并视角——契约的每个接口在整个代码库里被实现了几次、被谁实现。
// 扫描原语复用 validate.mjs 的导出，不复制实现（契约 §2 所有权）。
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';
import { EXIT, usageFromParseArgs, precondition } from '../util/errors.mjs';
import { atomicWriteFile, stableStringify, fileExists } from '../util/fs.mjs';
import { loadTasks } from '../model/tasks.mjs';
import { loadContracts, apiKey } from '../model/contracts.mjs';
import { resolveApps, consumersOf } from '../model/apps.mjs';
import {
  scanMarkedFiles,
  mappingPath,
  feApiKey,
  normalizePathParams,
  ownedApisOf,
} from './validate.mjs';

const REPORT_REL = '.vima/reports/convergence.json';
const REPORTS_DIR = '.vima/reports';
const RUNTIME_RE = /^runtime-errors(?:\.[^.]+)?\.jsonl$/;
const VERIFIER_RE = /^(.+)-verifier\.json$/;
const MARKER_RE = /@vima\s+([a-z0-9][a-z0-9-]*)/g;

const FE_EXTS = ['.ts', '.tsx', '.vue', '.js', '.mjs'];
const FE_CALL_RE = /\brequest\s*\.\s*(get|post|put|delete|patch)\s*(?:<[^>(]*>)?\s*\(\s*(['"`])([^'"`\n]*)\2/g;
const BE_MAPPING_RE = /@(Get|Post|Put|Delete|Patch)Mapping\s*(?:\(([^)]*)\))?/g;
const BE_BASE_RE = /@RequestMapping\s*\(([^)]*)\)/;

/** 归一到「代码键」：METHOD 大写 + 路径参数统一为 `{*}`（与 validate code 组同口径）。 */
function codeKeyOf(rawKey) {
  const i = rawKey.indexOf(' ');
  if (i < 0) return rawKey.toUpperCase();
  return `${rawKey.slice(0, i).toUpperCase()} ${normalizePathParams(rawKey.slice(i + 1))}`;
}

/** 一个文件里出现的全部 @vima taskId（升序去重）。 */
function markersOf(text) {
  const set = new Set();
  for (const m of text.matchAll(MARKER_RE)) set.add(m[1]);
  return [...set].sort();
}

/**
 * 后端实现表：归一键 → [{ file, taskIds }]，每个文件对同一键只记一次
 * （方法重载 / 同方法多注解属正常，不算重复实现）。
 */
function backendEndpointsOf(files) {
  const out = new Map();
  for (const f of files) {
    const baseM = BE_BASE_RE.exec(f.text);
    const base = baseM ? mappingPath(baseM[1]) : '';
    const taskIds = markersOf(f.text);
    const seen = new Set();
    let m;
    BE_MAPPING_RE.lastIndex = 0;
    while ((m = BE_MAPPING_RE.exec(f.text)) !== null) {
      const sub = mappingPath(m[2] ?? '');
      const joined = (`${base}${sub === '' || sub.startsWith('/') ? '' : '/'}${sub}` || '/').replace(/\/{2,}/g, '/');
      const key = `${m[1].toUpperCase()} ${normalizePathParams(joined)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!out.has(key)) out.set(key, []);
      out.get(key).push({ file: f.rel, taskIds });
    }
  }
  return out;
}

/** 前端调用表：端 id → { 该端带标注代码里出现过的归一键集合, 带标注文件数, 标注 taskId }。 */
async function frontendCallsOf(root, roster) {
  const apps = roster.apps.length > 0 ? roster.apps : [{ id: null, dir: '.', codeDir: 'src' }];
  const byApp = new Map();
  for (const app of apps) {
    const subdir = app.dir === '.' || app.dir === '' ? app.codeDir : `${app.dir}/${app.codeDir}`;
    const files = await scanMarkedFiles(root, subdir, FE_EXTS);
    const keys = new Set();
    const taskIds = new Set();
    for (const f of files) {
      let m;
      FE_CALL_RE.lastIndex = 0;
      while ((m = FE_CALL_RE.exec(f.text)) !== null) keys.add(feApiKey(m[1], m[3]));
      for (const id of markersOf(f.text)) taskIds.add(id);
    }
    byApp.set(app.id, { keys, taskIds, markedFiles: files.length });
  }
  return byApp;
}

/** 聚合 .vima/reports/<taskId>-verifier.json 的未过点位（豁免不计；A13 越界项计入且不可豁免）。 */
async function collectOpenPoints(root) {
  const dir = path.join(root, REPORTS_DIR);
  let names;
  try {
    names = await readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const out = [];
  for (const name of names.sort()) {
    const m = VERIFIER_RE.exec(name);
    if (!m) continue;
    let data;
    try {
      data = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
    } catch {
      continue; // 报告损坏不阻断对账（诊断归 /check 与人工）
    }
    const taskId = typeof data.taskId === 'string' && data.taskId !== '' ? data.taskId : m[1];
    for (const p of Array.isArray(data.points) ? data.points : []) {
      if (!p || typeof p !== 'object') continue;
      const label = typeof p.point === 'string' ? p.point : '';
      const isNg = /^NG-\d{2}\s*越界/.test(label);
      if (p.passed === true) continue;
      if (p.waived === true && !isNg) continue; // 越界项不适用豁免（§6.9 / A13）
      out.push({ taskId, point: label, kind: isNg ? 'ng' : 'failed' });
    }
  }
  out.sort((a, b) => (a.taskId === b.taskId
    ? (a.point < b.point ? -1 : a.point > b.point ? 1 : 0)
    : (a.taskId < b.taskId ? -1 : 1)));
  return out;
}

/** 运行时错误条数（全部 runtime-errors[.<appId>].jsonl 的非空行之和）。 */
async function countRuntimeErrors(root) {
  const dir = path.join(root, REPORTS_DIR);
  let names;
  try {
    names = await readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return 0;
    throw err;
  }
  let n = 0;
  for (const name of names) {
    if (!RUNTIME_RE.test(name)) continue;
    const text = await readFile(path.join(dir, name), 'utf8');
    n += text.split('\n').filter((l) => l.trim() !== '').length;
  }
  return n;
}

function finding(rule, level, key, owners, paths, message) {
  return { rule, level, key, owners: [...new Set(owners)].sort(), paths: [...new Set(paths)].sort(), message };
}

/**
 * 集成对账的**唯一评估器**：只读、确定性，返回 §6.13 报告对象——不写盘、不打印、不判退出码。
 *
 * 为什么要拆出来：`.vima/reports/convergence.json` 只是这次扫描的缓存证据，不是可信布尔值。
 * certify 的 converged 级若直接采信磁盘上的旧报告，spec/任务在报告生成后改动就会被认证为
 * 已收敛——正是 A32「显式非宣称」要防的假成功。certify 因此复用本函数重算现状并与缓存比对，
 * 与 design 的 `evaluateDesignVerification` 同口径（视觉证据早已这么做，此处补齐同一标准）。
 *
 * @param {string} root 项目根
 * @param {{cliRoot: string}} opts
 * @returns {Promise<object>} §6.13 convergence.json 的完整报告对象
 * @throws VimaError('NO_TASKS') 无 docs/tasks/（非 vima 项目）
 */
export async function evaluateConvergence(root, { cliRoot }) {
  // 与 plan 同一道守卫（契约 §9 第 0 步）：非 vima 项目不静默产出空报告、
  // 不凭空创建 .vima/reports/——空报告会被误读成「集成对账通过」。
  if (!(await fileExists(path.join(root, 'docs', 'tasks')))) {
    throw precondition(
      'NO_TASKS',
      '未找到 docs/tasks/ 目录（非 vima 项目或 PLANNING 未产出任务），不做集成对账',
      'docs/tasks',
    );
  }
  const tasks = await loadTasks(root);
  const contracts = (await loadContracts(root, { tolerant: true })).filter((c) => c.module !== null);
  const roster = await resolveApps(root, { cliRoot });

  const findings = [];

  // ── 后端实现表（带 @vima 标注的业务代码才参与，与 V-CODE-02 同作用域）──
  const backendDir = roster.backend?.dir ?? 'backend';
  const beFiles = await scanMarkedFiles(root, `${backendDir}/src`, ['.java']);
  const impl = backendEndpointsOf(beFiles);
  const skipped = beFiles.length === 0 ? 'no-marked-backend' : null;

  // ── 前端调用表 ──
  const feByApp = await frontendCallsOf(root, roster);
  const markedFrontendFiles = [...feByApp.values()].reduce((s, v) => s + v.markedFiles, 0);

  // ── 责任田：契约 api 归一键 → 负责的 backend 任务（A18 ownedApisOf 缺省语义）──
  const ownersByKey = new Map();
  const declaredByContract = new Map();
  let contractApis = 0;
  for (const c of contracts) {
    // 责任田含 fullstack：与 V-TASK-11 的「承担实现的 side」同口径。只认 backend 会让
    // 「一个任务做完前后端」的形态整体逃过 V-INT-01/03（实测：fullstack 任务标 done、
    // 契约 4 个接口只实现 1 个，仍零 error 放行）。
    const beTasks = tasks.filter(
      (t) => t.fm.layer === 'business'
        && (t.fm.side === 'backend' || t.fm.side === 'fullstack')
        && t.fm.contract === c.file,
    );
    declaredByContract.set(
      c.file,
      beTasks.some((t) => Array.isArray(t.fm.apis) && t.fm.apis.length > 0),
    );
    const ownedSets = beTasks.map((t) => ({
      t,
      keys: new Set([...(ownedApisOf(t, contracts)?.keys ?? [])].map(codeKeyOf)),
    }));
    for (const api of c.apis) {
      if (typeof api.method !== 'string' || api.method === '') continue;
      if (typeof api.path !== 'string' || api.path === '') continue;
      contractApis += 1;
      const key = codeKeyOf(apiKey(api));
      const owners = ownedSets.filter((o) => o.keys.has(key)).map((o) => o.t);
      ownersByKey.set(key, { owners, contract: c.file, api });
    }
  }

  // ── V-INT-01/02/03（后端族；无带标注后端文件时整族跳过）──
  if (skipped === null) {
    for (const [key, info] of [...ownersByKey.entries()].sort()) {
      const entries = impl.get(key) ?? [];

      // V-INT-01 接口零实现：仅当负责任务全部 done（开发中途跑不假红）
      if (entries.length === 0) {
        if (info.owners.length > 0 && info.owners.every((t) => t.fm.status === 'done')) {
          findings.push(finding(
            'V-INT-01', 'error', key,
            info.owners.map((t) => t.id),
            [info.contract],
            `接口 ${key} 在契约 ${info.contract} 中声明，但带 @vima 标注的后端代码里没有任何实现`
              + `——负责任务 ${info.owners.map((t) => t.id).join('、')} 已标 done（漏实现）`,
          ));
        }
        continue;
      }

      // V-INT-02 接口重复实现：同一键落在 ≥2 个不同文件
      if (entries.length >= 2) {
        findings.push(finding(
          'V-INT-02', 'error', key,
          entries.flatMap((e) => e.taskIds),
          entries.map((e) => e.file),
          `接口 ${key} 在 ${entries.length} 处后端文件重复实现`
            + `（${entries.map((e) => `${e.file}${e.taskIds.length > 0 ? ` [@vima ${e.taskIds.join(',')}]` : ''}`).join(' / ')}）`
            + '——运行期路由冲突，需保留一处并删除其余',
        ));
      }

      // V-INT-03 越界实现：责任田已由 apis 声明时，实现者须在负责任务集内
      if (declaredByContract.get(info.contract) === true && info.owners.length > 0) {
        const ownerIds = new Set(info.owners.map((t) => t.id));
        for (const e of entries) {
          if (e.taskIds.length === 0) continue; // 无标注不参与（作用域自锚定）
          if (e.taskIds.some((id) => ownerIds.has(id))) continue;
          findings.push(finding(
            'V-INT-03', 'error', key,
            [...e.taskIds, ...ownerIds],
            [e.file],
            `接口 ${key} 由 ${e.file} 实现（@vima ${e.taskIds.join(',')}），`
              + `但该接口的负责任务是 ${[...ownerIds].sort().join('、')}（A18 apis 责任田被越界实现）`
              + '——须由负责任务承接，否则负责任务再实现一遍即成重复实现',
          ));
        }
      }
    }
  }

  // ── V-INT-04（warn）消费端调用缺失 ──
  for (const [key, info] of [...ownersByKey.entries()].sort()) {
    const consumers = consumersOf(info.api, roster);
    if (!Array.isArray(consumers)) continue; // 多端未声明 consumers 由 V-CON-07 报
    for (const appId of [...consumers].sort()) {
      const fe = feByApp.get(appId) ?? (roster.apps.length === 0 ? feByApp.get(null) : undefined);
      if (!fe || fe.markedFiles === 0) continue; // 该端尚未开工：不判
      if (fe.keys.has(key)) continue;
      const feOwners = tasks
        .filter((t) => t.fm.layer === 'business'
          && (t.fm.side === 'frontend' || t.fm.side === 'fullstack')
          && t.fm.contract === info.contract
          && (roster.multi ? t.fm.app === appId : true))
        .map((t) => t.id);
      findings.push(finding(
        'V-INT-04', 'warn', key, feOwners, [info.contract],
        `契约授权端 ${appId} 消费接口 ${key}，但该端带 @vima 标注的代码中没有任何调用`
          + '——前后端联调断点或契约冗余（接口没人用应回契约删除）',
      ));
    }
  }

  // ── V-INT-05（error）缺收尾流水线 ──
  if (tasks.some((t) => t.fm.layer === 'business') && !tasks.some((t) => t.fm.layer === 'pipeline')) {
    findings.push(finding(
      'V-INT-05', 'error', '', [], ['docs/tasks'],
      '存在 business 任务却无任何 layer=pipeline 任务——全量测试与代码审计不会被执行，'
        + '收口闸门形同虚设；请按 docs/tasks/_template-full-test.md 与 _template-code-audit.md 补 full-test 与 code-audit',
    ));
  }

  findings.sort((a, b) => {
    if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1;
    if (a.key !== b.key) return a.key < b.key ? -1 : 1;
    const pa = a.paths[0] ?? '';
    const pb = b.paths[0] ?? '';
    return pa < pb ? -1 : pa > pb ? 1 : 0;
  });

  // ── 既有红信号收口 ──
  const openPoints = await collectOpenPoints(root);
  const runtimeErrors = await countRuntimeErrors(root);
  const markedIds = new Set();
  for (const f of beFiles) for (const id of markersOf(f.text)) markedIds.add(id);
  for (const fe of feByApp.values()) for (const id of fe.taskIds) markedIds.add(id);
  const unmarkedDone = tasks
    .filter((t) => t.fm.status === 'done'
      && (t.fm.layer === 'shared' || t.fm.layer === 'business')
      && !markedIds.has(t.id))
    .map((t) => t.id)
    .sort();

  // ── byTask：修复调度的确定性输入（主 Agent 不自行判断派给谁）──
  const byTask = {};
  const push = (id, line) => {
    if (!Object.hasOwn(byTask, id)) byTask[id] = [];
    if (!byTask[id].includes(line)) byTask[id].push(line);
  };
  for (const f of findings) {
    for (const id of f.owners) push(id, `${f.rule}${f.key === '' ? '' : ` ${f.key}`}`);
  }
  for (const p of openPoints) push(p.taskId, `未过点位 ${p.point}`);
  for (const id of Object.keys(byTask)) byTask[id].sort();

  return {
    schemaVersion: '1',
    scope: {
      markedBackendFiles: beFiles.length,
      markedFrontendFiles,
      contractApis,
      skipped,
    },
    summary: {
      errors: findings.filter((f) => f.level === 'error').length,
      warnings: findings.filter((f) => f.level === 'warn').length,
      openPoints: openPoints.length,
      runtimeErrors,
      unmarkedDone: unmarkedDone.length,
    },
    findings,
    openPoints,
    unmarkedDone,
    byTask,
  };
}

/** vima converge [--json] [--strict] */
export async function run(argv, ctx) {
  let opts;
  try {
    ({ values: opts } = parseArgs({
      args: argv,
      options: { json: { type: 'boolean' }, strict: { type: 'boolean' } },
      allowPositionals: false,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }

  const root = ctx.cwd;
  const report = await evaluateConvergence(root, { cliRoot: ctx.cliRoot });
  const { contractApis, markedBackendFiles, markedFrontendFiles, skipped } = report.scope;
  const { openPoints, unmarkedDone, findings } = report;
  const runtimeErrors = report.summary.runtimeErrors;
  const errors = findings.filter((f) => f.level === 'error');
  const warnings = findings.filter((f) => f.level === 'warn');

  const text = stableStringify(report);
  await atomicWriteFile(path.join(root, REPORT_REL), text);
  if (opts.json) {
    process.stdout.write(text);
  } else {
    const lines = [
      `🔗 集成对账：契约接口 ${contractApis} 个 │ 带标注后端文件 ${markedBackendFiles} │ 前端 ${markedFrontendFiles}`,
      `   error ${errors.length} │ warn ${warnings.length} │ 未过点位 ${openPoints.length} │ 运行时错误 ${runtimeErrors} │ done 无标注 ${unmarkedDone.length}`,
      `   报告：${REPORT_REL}`,
    ];
    if (skipped !== null) lines.push('   ⏭️ 后端族规则跳过：没有带 @vima 标注的后端文件（V-INT-01/02/03 不判）');
    if (errors.length === 0 && openPoints.length === 0) lines.push('✅ 集成对账通过（无阻断项）');
    process.stdout.write(`${lines.join('\n')}\n`);
  }

  const diag = [];
  for (const f of errors) diag.push(`❌ ${f.rule} ${f.key}: ${f.message}`);
  for (const f of warnings) diag.push(`⚠️ ${f.rule} ${f.key}: ${f.message}`);
  if (openPoints.length > 0) {
    diag.push(`❌ 未过点位 ${openPoints.length} 条（Verifier 报告聚合，豁免不计）：`);
    for (const p of openPoints.slice(0, 20)) diag.push(`  ${p.taskId}: ${p.point}`);
    if (openPoints.length > 20) diag.push(`  …其余 ${openPoints.length - 20} 条见报告`);
  }
  if (unmarkedDone.length > 0) {
    diag.push(`⚠️ done 却无任何 @vima 标注 ${unmarkedDone.length} 个：${unmarkedDone.join('、')}`);
  }
  if (diag.length > 0) process.stderr.write(`${diag.join('\n')}\n`);

  if (errors.length > 0 || openPoints.length > 0) return EXIT.CHECK_FAILED;
  if (opts.strict && warnings.length > 0) return EXIT.CHECK_FAILED;
  return EXIT.OK;
}
