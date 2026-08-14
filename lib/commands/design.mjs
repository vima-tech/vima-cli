// vima design —— A34 视觉真源的**确定性侧**（契约 §6.20）
//
// 分层边界（CLAUDE.md 硬约束 + A34 D-A34-17）：本模块只做确定性文件操作——
// 校验存在、计算哈希、登记摘要、更新状态、汇总报告。
// **Claude Design MCP 调用、无头浏览器、截图冻结一律不在这里**，它们是 Claude Code
// 专属语义，只存在于 templates/*/workspace/（design.md 命令 + vima-designer 子代理）。
// 本文件因此零网络、零浏览器、零外部依赖；d2 断言会盯着这一点。
//
// 子命令与它们各自的时间点（D-A34-21：一个命令跨两阶段用两套未声明的通过条件 = 死锁）：
//   status     任意时刻    重生成只读派生索引 INDEX.json（--check 验漂移，同 render-* 口径）
//   check      DESIGNING 出口   V-DSN-09 + 六项派生状态（此时页面尚未实现，不看任何实现期报告）
//   verify     DEVELOPING 收口  汇总 design/experience 报告 + implementationDigest + uncovered/stale
//   approve    人工裁定    把方向/页面批准连同内容摘要写进 lifecycle.designApproval
//   invalidate 人工作废    显式撤销批准（留理由）
//   reconcile  DESIGNING   受控回写环：复用 A31 影响面算法，用 DESIGNING 口径闸门
import path from 'node:path';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { EXIT, usageError, usageFromParseArgs, precondition } from '../util/errors.mjs';
import { atomicWriteFile, stableStringify, fileExists, sha256, sha256File } from '../util/fs.mjs';
import {
  loadLifecycle, saveLifecycle, designApprovalOf, designCapabilityOf, designScopePagesOf,
  hasA34DesignScope, DESIGNING_PERSISTED_KEYS,
} from '../model/lifecycle.mjs';
import { loadSpec } from '../model/spec.mjs';
import { loadTasks } from '../model/tasks.mjs';
import { resolveApps } from '../model/apps.mjs';
import { computeImpact, snapshotBaseline, writeImpact, CHANGES_REL } from './change.mjs';
import { validateProject } from './validate.mjs';

const DESIGN_DIR_REL = 'docs/review/design';
const INDEX_REL = `${DESIGN_DIR_REL}/INDEX.json`;
const CHECK_REPORT_REL = '.vima/reports/design-check.json';
const VERIFY_REPORT_REL = '.vima/reports/design-verify.json';
const VERIFY_INPUTS_REL = '.vima/reports/design-verify-inputs.json';
const DESIGN_REPORT_DIR = '.vima/reports/design';
const EXPERIENCE_REPORT_DIR = '.vima/reports/experience';
const IMPLEMENTATION_DEPS_DIR = '.vima/reports/implementation-deps';
/** DESIGNING 回写环的基线快照包（借 A31 的存储布局，故 computeImpact 无需改造）。 */
export const DESIGNING_BASELINE_ID = 'designing-baseline';

const SUBCOMMANDS = new Set(['status', 'check', 'verify', 'approve', 'invalidate', 'reconcile']);

/**
 * 各保真级**必需**的设计文件（D-A34-11）。
 * 路径由 pageId 推导，不存 designRef——路径既已固定，字段就是可推导冗余，
 * 留着只会多一个能与真源不一致的写入口（D-A34-02）。
 */
const REQUIRED_FILES = {
  D0: [],
  D1: ['default.png', 'empty.png'],
  D2: ['default.png', 'empty.png', 'prototype.html', 'scenarios.md'],
};

/** 报告矩阵（D-A34-21）：哪个保真级需要哪几份验收报告。 */
const REPORT_MATRIX = {
  D0: [],
  D1: ['design'],
  D2: ['design', 'experience'],
};

const FIDELITY_RANK = { D0: 0, D1: 1, D2: 2 };
const DIRECTION_REQUIRED_FILES = [
  'brief.md', 'direction-a.png', 'direction-b.png', 'direction-c.png', 'comparison.md', 'selection.md',
];

function appBaseOf(app) {
  return app?.dir && app.dir !== '.' ? `${app.dir}/` : '';
}

/** 每种端的 Stage A 样式真源；移动端没有桌面端的 src/styles 目录。 */
function stageAStyleFilesOf(app) {
  const base = appBaseOf(app);
  if (app?.kind === 'mp-native') {
    return [`${base}src/vendor/vima-ui-mp/dist/ui.wxss`, `${base}src/vendor/vima-ui-mp/dist/tokens.wxss`];
  }
  if (app?.kind === 'h5-mobile') {
    return [`${base}vendor/vima-ui-h5/dist/ui.css`, `${base}vendor/vima-ui-h5/dist/tokens.css`];
  }
  return [`${base}src/styles/layout.css`, `${base}src/styles/tokens.css`];
}

function stageAFilesForPage(view, roster) {
  const app = roster.apps.find((a) => a.id === view.app) ?? roster.apps[0] ?? null;
  const files = app ? stageAStyleFilesOf(app) : [];
  files.push('docs/design-language.md');
  if (view.fidelity === 'D1' || view.fidelity === 'D2') files.push('docs/interaction-language.md');
  return [...new Set(files)].sort();
}

function scopedViewsOf(views, lifecycle) {
  if (designCapabilityOf(lifecycle) === 'a34') return views;
  const scope = new Set(designScopePagesOf(lifecycle));
  return views.filter((v) => scope.has(v.id));
}


/**
 * 保真级**建议值**（D-A34-03）。判据必须可从 spec 判定，否则「自动建议」就退化成凭空判断：
 *   pattern: custom 或任一块 shape: freeform            → D2（独特版面/自由发挥区）
 *   任一块 shape ∈ {metrics,timeline,chart} 或 regions ≥2 列 → D1（领域信息页）
 *   其余                                                 → D0
 * **只是建议**：首次裁定时人可选任意级别（机器建议必有误判，锁死会把设计器页钉成 D0）；
 * 批准之后的降级才需显式豁免。
 */
export function suggestFidelity(page) {
  const d = (page && typeof page.design === 'object' && !Array.isArray(page.design)) ? page.design : {};
  const comps = Array.isArray(page?.components) ? page.components : [];
  const shapes = comps.map((c) => c?.data?.shape).filter(Boolean);
  if (d.pattern === 'custom' || shapes.includes('freeform')) return 'D2';
  const richShape = shapes.some((x) => ['metrics', 'timeline', 'chart'].includes(x));
  const multiCol = (Array.isArray(page?.regions) ? page.regions : [])
    .some((band) => Array.isArray(band?.columns) && band.columns.length >= 2);
  return richShape || multiCol ? 'D1' : 'D0';
}

/** 页面设计目录（相对项目根，posix 分隔）。 */
export function pageDesignDirRel(pageId) {
  return `${DESIGN_DIR_REL}/${pageId}`;
}

/** 从 spec 抽出 A34 关心的页面视图（保真级 / 主任务 / 不可降级项 / 归属端）。 */
function pageViewsOf(spec) {
  const out = [];
  for (const [id, page] of spec.pages) {
    const d = (page && typeof page.design === 'object' && !Array.isArray(page.design)) ? page.design : {};
    out.push({
      id,
      app: page?.app ?? null,
      title: page?.title ?? '',
      pattern: d.pattern ?? null,
      fidelity: d.fidelity ?? null,
      primaryTask: d.primaryTask ?? null,
      mustPreserve: Array.isArray(d.mustPreserve) ? d.mustPreserve : [],
      apis: Array.isArray(page?.apis) ? [...page.apis].sort() : [],
      raw: page,
    });
  }
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

/**
 * specDigest 的计算范围（D-A34-21）：**本页 vima:page 数据块 + 本页 apis 引用到的契约切片**。
 * 不 hash 整库（无关页面改动会让所有报告 stale），也不只 hash 页面自身
 * （契约字段变了却不使页面失效，正是要防的漂移）。
 */
function specDigestOf(view, contractApiIndex) {
  const slices = view.apis.map((a) => ({ api: a, def: contractApiIndex.get(normalizeApi(a)) ?? null }));
  return sha256(stableStringify({ page: view.raw, contracts: slices }));
}

/** 契约接口引用归一（与 validate 的 `METHOD /path` 口径一致，容忍多空格）。 */
function normalizeApi(ref) {
  return String(ref).trim().replace(/\s+/g, ' ');
}

/** 建立 `METHOD /path` → 接口定义 的索引（用于 specDigest 的契约切片）。 */
async function contractApiIndexOf(root) {
  const idx = new Map();
  const dir = path.join(root, 'docs/contracts');
  let names = [];
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith('.md') && !n.startsWith('_'));
  } catch {
    return idx;
  }
  const { loadContracts } = await import('../model/contracts.mjs');
  let contracts = [];
  try {
    contracts = await loadContracts(root, { tolerant: true });
  } catch {
    return idx;
  }
  for (const c of contracts) {
    for (const api of c.apis ?? []) {
      if (!api?.method || !api?.path) continue;
      idx.set(normalizeApi(`${api.method} ${api.path}`), api);
    }
  }
  return idx;
}

/** 读一页的设计 manifest；不存在或不可解析 → null（调用方按 V-DSN-09 报缺）。 */
async function readPageManifest(root, pageId) {
  const p = path.join(root, pageDesignDirRel(pageId), 'manifest.json');
  try {
    return JSON.parse(await readFile(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * designDigest 的计算范围（D-A34-21）：manifest **及其声明的全部文件内容**。
 * 逐文件哈希而非目录哈希——目录哈希在不同文件系统上顺序不稳，会假 stale。
 */
async function designDigestOf(root, view, manifest, roster) {
  if (!manifest) return null;
  const dir = pageDesignDirRel(view.id);
  const files = Array.isArray(manifest.files) ? [...manifest.files].sort() : [];
  const entries = [];
  for (const f of files) {
    const abs = path.join(root, dir, f);
    entries.push({ file: f, sha: (await fileExists(abs)) ? await sha256File(abs) : null });
  }
  const stageA = [];
  for (const rel of stageAFilesForPage(view, roster)) {
    stageA.push({ file: rel, sha: (await fileExists(path.join(root, rel))) ? await sha256File(path.join(root, rel)) : null });
  }
  return sha256(stableStringify({ manifest, entries, stageA }));
}

// ---------------------------------------------------------------------------
// 静态 import 可达图（D-A34-21：依赖集必须确定性解析，不交给 Agent 判断）
// ---------------------------------------------------------------------------

const IMPORT_RE = /(?:import|export)[\s\S]{0,200}?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const RESOLVE_EXT = ['', '.ts', '.tsx', '.js', '.mjs', '.vue', '/index.ts', '/index.js', '/index.vue'];
/** 只收敛到这两类落点——其余（框架层、第三方）不构成本页实现的一部分。 */
const DEPENDENCY_ROOTS = ['src/features/', 'src/styles/'];

/** 解析一条 import 说明符到项目内相对路径；解析不到返回 null（第三方、裸模块名等）。 */
async function resolveSpecifier(root, fromRel, spec, appDir) {
  let baseRel;
  if (spec.startsWith('.')) {
    baseRel = path.posix.join(path.posix.dirname(fromRel), spec);
  } else if (spec.startsWith('@/')) {
    // vite 骨架约定：@ → <appDir>/src
    baseRel = path.posix.join(appDir, 'src', spec.slice(2));
  } else {
    return null; // 裸模块名 = 第三方，不进依赖集
  }
  for (const ext of RESOLVE_EXT) {
    const cand = `${baseRel}${ext}`;
    if (await fileExists(path.join(root, cand))) return cand;
  }
  return null;
}

/**
 * 从若干入口文件出发做静态可达图，收集落在 DEPENDENCY_ROOTS 下的文件。
 * 深度不限但按已访问集去环；只读不写。
 */
export async function reachableDependencies(root, entryRels, appDir) {
  return (await reachableDependencySnapshot(root, entryRels, appDir)).files;
}

async function reachableDependencySnapshot(root, entryRels, appDir) {
  const seen = new Set();
  const queue = [...entryRels];
  const hits = new Set();
  let fallback = false;
  while (queue.length > 0) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    seen.add(rel);
    let text;
    try {
      text = await readFile(path.join(root, rel), 'utf8');
    } catch {
      continue;
    }
    if (DEPENDENCY_ROOTS.some((p) => rel.includes(p))) hits.add(rel);
    for (const dm of text.matchAll(/import\s*\(([^)]+)\)/g)) {
      if (!/^\s*['"][^'"]+['"]\s*$/.test(dm[1])) fallback = true;
    }
    IMPORT_RE.lastIndex = 0;
    let m;
    while ((m = IMPORT_RE.exec(text)) !== null) {
      const spec = m[1] ?? m[2];
      if (!spec) continue;
      const next = await resolveSpecifier(root, rel, spec, appDir);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  if (fallback) {
    const featureFiles = [];
    await walkCollect(path.join(root, appDir, 'src/features'), root, featureFiles);
    for (const rel of featureFiles) hits.add(rel);
  }
  return { files: [...hits].sort(), fallback };
}

// ---------------------------------------------------------------------------
// 派生状态（D-A34-10：这六项一律不落盘，每次从真源确定性推导）
// ---------------------------------------------------------------------------

function safeManifestFile(file) {
  return typeof file === 'string' && file !== '' && !path.posix.isAbsolute(file)
    && !file.split('/').includes('..') && !file.includes('\\');
}

async function readDirectionManifest(root, appId) {
  try {
    return JSON.parse(await readFile(path.join(root, DESIGN_DIR_REL, '_shell', appId, 'manifest.json'), 'utf8'));
  } catch {
    return null;
  }
}

async function directionDigestOf(root, appId, manifest) {
  if (!manifest) return null;
  const dir = `${DESIGN_DIR_REL}/_shell/${appId}`;
  const entries = [];
  for (const file of [...(Array.isArray(manifest.files) ? manifest.files : [])].sort()) {
    const abs = path.join(root, dir, file);
    entries.push({ file, sha: (await fileExists(abs)) ? await sha256File(abs) : null });
  }
  return sha256(stableStringify({ manifest, entries }));
}

async function directionPackageState(root, appId) {
  const dir = `${DESIGN_DIR_REL}/_shell/${appId}`;
  const manifest = await readDirectionManifest(root, appId);
  const findings = [];
  if (!manifest) {
    findings.push({ rule: 'V-DSN-09', app: appId, path: `${dir}/manifest.json`, message: `端 ${appId} 缺方向交付清单 manifest.json` });
    return { manifest: null, digest: null, findings };
  }
  if (manifest.appId !== appId) {
    findings.push({ rule: 'V-DSN-09', app: appId, path: `${dir}/manifest.json`, message: `方向 manifest.appId 应为 ${appId}` });
  }
  const declared = new Set(Array.isArray(manifest.files) ? manifest.files : []);
  for (const req of DIRECTION_REQUIRED_FILES) {
    if (!declared.has(req)) findings.push({ rule: 'V-DSN-09', app: appId, path: `${dir}/manifest.json`, message: `端 ${appId} 缺方向交付物 ${req}` });
  }
  for (const file of declared) {
    if (!safeManifestFile(file)) {
      findings.push({ rule: 'V-DSN-09', app: appId, path: `${dir}/manifest.json`, message: `方向 manifest.files 含不安全路径 ${file}` });
    } else if (!(await fileExists(path.join(root, dir, file)))) {
      findings.push({ rule: 'V-DSN-09', app: appId, path: `${dir}/${file}`, message: `方向 manifest 声明了 ${file} 但文件不存在` });
    }
  }
  return { manifest, digest: await directionDigestOf(root, appId, manifest), findings };
}

/**
 * 计算六项派生 checklist 状态。
 * 与 lifecycle 的两个持久键（briefReady / directionsExplored）严格分开——
 * 落盘就会与 designApproval 表达同一事实，退回本增补项自己要治的双真源。
 */
async function deriveStates(root, views, lifecycle, roster) {
  const approval = designApprovalOf(lifecycle);
  const capability = designCapabilityOf(lifecycle);
  const activeViews = scopedViewsOf(views, lifecycle);
  const graded = activeViews.filter((v) => v.fidelity !== null);
  const needArtifacts = activeViews.filter((v) => v.fidelity === 'D1' || v.fidelity === 'D2');

  // ① 全部页面已明确定级（V-DSN-12 的口径；legacy 项目整体豁免）
  const fidelityClassified = capability === 'legacy' && activeViews.length === 0
    ? true
    : graded.length === activeViews.length;

  // ② 全部 D1/D2 页的 manifest 与必需文件齐全（V-DSN-09）
  const artifactFindings = [];
  for (const v of needArtifacts) {
    const dir = pageDesignDirRel(v.id);
    const manifest = await readPageManifest(root, v.id);
    if (!manifest) {
      artifactFindings.push({ rule: 'V-DSN-09', page: v.id, path: `${dir}/manifest.json`, message: `${v.fidelity} 页 ${v.id} 缺设计清单 manifest.json（设计目录由 pageId 推导，无需在 spec 写路径）` });
      continue;
    }
    if (manifest.pageId !== v.id) {
      artifactFindings.push({ rule: 'V-DSN-09', page: v.id, path: `${dir}/manifest.json`, message: `manifest.pageId 应为 ${v.id}` });
    }
    if (manifest.fidelity !== undefined && manifest.fidelity !== v.fidelity) {
      artifactFindings.push({ rule: 'V-DSN-09', page: v.id, path: `${dir}/manifest.json`, message: `manifest.fidelity ${manifest.fidelity} 与 spec ${v.fidelity} 不一致` });
    }
    const declared = new Set(Array.isArray(manifest.files) ? manifest.files : []);
    for (const req of REQUIRED_FILES[v.fidelity]) {
      if (!declared.has(req)) {
        artifactFindings.push({ rule: 'V-DSN-09', page: v.id, path: `${dir}/manifest.json`, message: `${v.fidelity} 页 ${v.id} 的 manifest.files 未声明必需产物 ${req}` });
      }
    }
    for (const f of declared) {
      if (!safeManifestFile(f)) {
        artifactFindings.push({ rule: 'V-DSN-09', page: v.id, path: `${dir}/manifest.json`, message: `${v.id} manifest.files 含不安全路径 ${f}` });
      } else if (!(await fileExists(path.join(root, dir, f)))) {
        artifactFindings.push({ rule: 'V-DSN-09', page: v.id, path: `${dir}/${f}`, message: `${v.fidelity} 页 ${v.id} 的 manifest 声明了 ${f} 但文件不存在（承诺过的载体必须真的在）` });
      }
    }
    if (v.fidelity === 'D2' && declared.has('prototype.html')) {
      const html = await readFile(path.join(root, dir, 'prototype.html'), 'utf8').catch(() => '');
      if (/https?:\/\//i.test(html)) {
        artifactFindings.push({ rule: 'V-DSN-09', page: v.id, path: `${dir}/prototype.html`, message: `${v.id} prototype.html 含外部网络 URL，D2 冻结物必须自包含` });
      }
    }
  }
  const designArtifactsComplete = artifactFindings.length === 0;

  // ③④ 批准派生：方向按端、页面按页；批准的摘要须与现状一致（陈旧布尔是 D-A34-12 的病根）
  // D-A34-13：全页 D0 的项目确定性跳过 DESIGNING——没有 D1/D2 就没有要发散的标志性页面，
  // 方向批准**空真**（vacuous），不是「没批」。否则纯 CRUD 项目会被一道永远过不去的闸门挡住。
  // 单端项目的 page.app 合法省略（A16）；legacy 局部启用 A34 时也必须能归到唯一默认端，
  // 否则 scopedApps 为空，方向批准会成为永远无法转绿的死门。
  const scopedApps = new Set(activeViews
    .map((v) => v.app ?? (roster.apps.length === 1 ? roster.apps[0].id : null))
    .filter(Boolean));
  const appIds = (capability === 'a34'
    ? roster.apps.map((a) => a.id)
    : roster.apps.filter((a) => scopedApps.has(a.id)).map((a) => a.id)).sort();
  const d0Only = needArtifacts.length === 0;
  const directionFindings = [];
  const directionStates = new Map();
  if (!d0Only) {
    for (const id of appIds) {
      const state = await directionPackageState(root, id);
      directionStates.set(id, state);
      directionFindings.push(...state.findings);
    }
  }
  const directionApproved = d0Only
    || (appIds.length > 0 && appIds.every((id) => approval.directions[id]?.approvedAt && directionStates.get(id)?.findings.length === 0));
  const signaturePagesApproved = needArtifacts.length === 0
    || needArtifacts.every((v) => approval.pages[v.id]?.approvedAt);

  // ⑤ 批准新鲜度：任一 digest 漂移即失效
  const apiIndex = await contractApiIndexOf(root);
  const staleApprovals = [];
  for (const id of appIds) {
    const rec = approval.directions[id];
    if (!rec?.approvedAt) continue;
    const current = directionStates.get(id) ?? await directionPackageState(root, id);
    if (current.findings.length > 0 || rec.digest === null || rec.digest !== current.digest) {
      staleApprovals.push({ app: id, kind: 'direction', reason: '方向 Brief / 三稿 / 差异矩阵 / 用户选择已变或不完整' });
    }
  }
  const byId = new Map(activeViews.map((v) => [v.id, v]));
  for (const [pageId, rec] of Object.entries(approval.pages)) {
    const view = byId.get(pageId);
    if (!view || !rec?.fidelity || FIDELITY_RANK[view.fidelity] >= FIDELITY_RANK[rec.fidelity]) continue;
    const waiver = rec.downgradeWaiver;
    if (!waiver || waiver.from !== rec.fidelity || waiver.to !== view.fidelity || typeof waiver.reason !== 'string' || waiver.reason.trim() === '') {
      staleApprovals.push({ page: pageId, kind: 'downgrade', reason: `批准后从 ${rec.fidelity} 降为 ${view.fidelity}，缺用户显式豁免与理由` });
    }
  }
  for (const v of needArtifacts) {
    const rec = approval.pages[v.id];
    if (!rec?.approvedAt) continue;
    const spec = specDigestOf(v, apiIndex);
    const design = await designDigestOf(root, v, await readPageManifest(root, v.id), roster);
    if (rec.specDigest !== spec) staleApprovals.push({ page: v.id, reason: 'spec 数据块或其契约切片已变' });
    else if (rec.designDigest !== design) staleApprovals.push({ page: v.id, reason: '设计目录内容已变' });
  }
  const designApprovalFresh = staleApprovals.length === 0;

  // ⑥ Stage A 产物 + 交互语言（D-A34-24 五处接线之一：进 designSystemFrozen 摘要）。
  // **只对磁盘上真的有前端骨架的端要求**——没有前端目录的项目（纯后端 / 纯文档）
  // 谈不上版面语言，硬要它的 css 是把判据写死，会挡住本就不该被挡的项目。
  const relevantApps = capability === 'a34' ? roster.apps : roster.apps.filter((a) => scopedApps.has(a.id));
  const liveApps = [];
  for (const app of relevantApps) {
    const base = app.dir === '.' ? '' : `${app.dir}/`;
    if (await fileExists(path.join(root, base, 'src'))) liveApps.push(app);
  }
  const stageA = [];
  for (const app of liveApps) stageA.push(...stageAStyleFilesOf(app));
  if (liveApps.length > 0) stageA.push('docs/design-language.md');
  if (liveApps.length > 0 && needArtifacts.length > 0) stageA.push('docs/interaction-language.md');
  const stageAMissing = [];
  for (const rel of stageA) {
    if (!(await fileExists(path.join(root, rel)))) stageAMissing.push(rel);
  }
  const designSystemFrozen = stageAMissing.length === 0;

  return {
    derived: {
      fidelityClassified,
      designArtifactsComplete,
      directionApproved,
      signaturePagesApproved,
      designApprovalFresh,
      designSystemFrozen,
    },
    artifactFindings,
    directionFindings,
    staleApprovals,
    stageAMissing,
    graded,
    needArtifacts,
    d0Only,
  };
}

// ---------------------------------------------------------------------------
// 子命令实现
// ---------------------------------------------------------------------------

/** `vima design status [--check]`：重生成只读派生索引。不含 approved——批准状态唯一住在 lifecycle。 */
async function cmdStatus(root, { check }, ctx) {
  const spec = await loadSpec(root);
  const views = pageViewsOf(spec);
  const lifecycle = await loadLifecycle(root);
  const roster = await resolveApps(root, { cliRoot: ctx.cliRoot });
  const apiIndex = await contractApiIndexOf(root);
  const states = await deriveStates(root, views, lifecycle, roster);

  const pages = [];
  for (const v of views) {
    const manifest = await readPageManifest(root, v.id);
    pages.push({
      id: v.id,
      app: v.app,
      fidelity: v.fidelity,
      pattern: v.pattern,
      dir: pageDesignDirRel(v.id),
      hasManifest: manifest !== null,
      files: Array.isArray(manifest?.files) ? [...manifest.files].sort() : [],
      mustPreserveIds: v.mustPreserve.map((m) => m?.id).filter((x) => typeof x === 'string').sort(),
      specDigest: specDigestOf(v, apiIndex),
      designDigest: await designDigestOf(root, v, manifest, roster),
      suggestedFidelity: suggestFidelity(v.raw),
    });
  }
  const byFidelity = { D0: 0, D1: 0, D2: 0, ungraded: 0 };
  for (const p of pages) byFidelity[p.fidelity ?? 'ungraded'] += 1;

  // 建议与实际不一致时列出来供人复核——**不改任何东西**，裁定权始终在人手上
  const suggestions = pages
    .filter((p) => p.fidelity !== null && p.suggestedFidelity !== p.fidelity)
    .map((p) => ({ id: p.id, declared: p.fidelity, suggested: p.suggestedFidelity }));
  const index = { schemaVersion: '1', generatedBy: 'vima design status', summary: byFidelity, suggestions, pages };
  const text = stableStringify(index);
  const abs = path.join(root, INDEX_REL);

  if (check) {
    const current = (await fileExists(abs)) ? await readFile(abs, 'utf8') : null;
    if (current !== text) {
      throw precondition(
        'DESIGN_INDEX_DRIFT',
        `${INDEX_REL} 与 spec/设计目录现状不一致（跑 vima design status 重生成）`,
        INDEX_REL,
      );
    }
    process.stdout.write(`✅ ${INDEX_REL} 无漂移（${pages.length} 页：D0 ${byFidelity.D0} / D1 ${byFidelity.D1} / D2 ${byFidelity.D2}）\n`);
    for (const [name, ok] of Object.entries(states.derived)) {
      process.stdout.write(`   ${ok ? '✅' : '❌'} ${name}\n`);
    }
    return EXIT.OK;
  }
  await mkdir(path.dirname(abs), { recursive: true });
  await atomicWriteFile(abs, text);
  process.stdout.write(
    `✅ 已重生成 ${INDEX_REL}（只读派生物，不含批准状态）\n`
    + `   ${pages.length} 页：D0 ${byFidelity.D0} / D1 ${byFidelity.D1} / D2 ${byFidelity.D2}`
    + `${byFidelity.ungraded > 0 ? ` / 未定级 ${byFidelity.ungraded}` : ''}\n`,
  );
  for (const sg of suggestions) {
    process.stdout.write(`   ℹ️ ${sg.id} 声明 ${sg.declared}，按 spec 判据建议 ${sg.suggested}（仅供复核，裁定权在你）\n`);
  }
  for (const [name, ok] of Object.entries(states.derived)) {
    process.stdout.write(`   ${ok ? '✅' : '❌'} ${name}\n`);
  }
  return EXIT.OK;
}

/**
 * `vima design check`：**DESIGNING 出口**闸门。
 * 此时页面尚未实现——**不看任何实现期报告**，只看设计面。
 * （v2 曾让一个命令同时管两个时间点，那会让项目永远进不了 DEVELOPING。）
 */
async function cmdCheck(root, ctx) {
  const spec = await loadSpec(root);
  const views = pageViewsOf(spec);
  const lifecycle = await loadLifecycle(root);
  const roster = await resolveApps(root, { cliRoot: ctx.cliRoot });
  const st = await deriveStates(root, views, lifecycle, roster);

  const blocking = Object.entries(st.derived).filter(([, ok]) => ok === false).map(([k]) => k);
  const report = {
    schemaVersion: '1',
    phase: lifecycle.currentPhase ?? null,
    designCapability: designCapabilityOf(lifecycle),
    derived: st.derived,
    findings: st.artifactFindings,
    directionFindings: st.directionFindings,
    stale: st.staleApprovals,
    stageAMissing: st.stageAMissing,
    counts: { pages: views.length, graded: st.graded.length, needArtifacts: st.needArtifacts.length },
    d0Only: st.d0Only,
    note: st.d0Only ? '全页 D0——本项目确定性跳过 DESIGNING 发散轮；设计语言仍由 A30 确定性推导产出 Stage A' : null,
    pass: blocking.length === 0,
  };
  await mkdir(path.join(root, '.vima/reports'), { recursive: true });
  await atomicWriteFile(path.join(root, CHECK_REPORT_REL), stableStringify(report));

  for (const [k, ok] of Object.entries(st.derived)) {
    process.stdout.write(`${ok ? '✅' : '❌'} ${k}\n`);
  }
  for (const f of st.artifactFindings) process.stdout.write(`   ${f.rule} ${f.message}（${f.path}）\n`);
  for (const f of st.directionFindings) process.stdout.write(`   ${f.rule} ${f.message}（${f.path}）\n`);
  for (const s of st.staleApprovals) process.stdout.write(`   批准已失效：${s.page} —— ${s.reason}\n`);
  for (const m of st.stageAMissing) process.stdout.write(`   Stage A 产物缺失：${m}\n`);
  if (st.d0Only) process.stdout.write('ℹ️ 全页 D0：跳过 DESIGNING 发散轮（Stage A 仍由 A30 确定性推导产出）\n');
  process.stdout.write(`报告：${CHECK_REPORT_REL}\n`);
  return report.pass ? EXIT.OK : EXIT.CHECK_FAILED;
}

/**
 * `vima design verify`：**DEVELOPING 收口**汇总。
 * 按报告矩阵算 uncovered，按三个 digest 算 stale；/go 的收口硬门只消费本报告。
 */
export async function evaluateDesignVerification(root, ctx, { writeDependencies = false } = {}) {
  const spec = await loadSpec(root);
  const lifecycle = await loadLifecycle(root);
  const views = scopedViewsOf(pageViewsOf(spec), lifecycle);
  const roster = await resolveApps(root, { cliRoot: ctx.cliRoot });
  const apiIndex = await contractApiIndexOf(root);
  const tasks = await loadTasks(root);

  const uncovered = [];
  const stale = [];
  const pages = [];
  for (const v of views) {
    const want = REPORT_MATRIX[v.fidelity ?? 'D0'] ?? [];
    const specDigest = specDigestOf(v, apiIndex);
    const designDigest = await designDigestOf(root, v, await readPageManifest(root, v.id), roster);
    const implementation = await implementationSnapshotOf(root, v, tasks, roster);
    const implementationDigest = implementation.digest;
    if (writeDependencies) {
      await atomicWriteFile(
        path.join(root, IMPLEMENTATION_DEPS_DIR, `${v.id}.json`),
        stableStringify(implementation.report),
      );
    }
    if (want.length > 0 && designDigest === null) {
      uncovered.push({ page: v.id, fidelity: v.fidelity, kind: 'design', path: pageDesignDirRel(v.id), reason: '设计基线缺失，无法验收' });
    }
    if (want.length > 0 && implementationDigest === null) {
      uncovered.push({ page: v.id, fidelity: v.fidelity, kind: 'implementation', path: `${IMPLEMENTATION_DEPS_DIR}/${v.id}.json`, reason: '未找到本页任务 @vima 实现入口，不能对空实现出通过报告' });
    }
    const got = {};
    for (const kind of want) {
      const rel = `${kind === 'design' ? DESIGN_REPORT_DIR : EXPERIENCE_REPORT_DIR}/${v.id}.json`;
      let rep = null;
      try {
        rep = JSON.parse(await readFile(path.join(root, rel), 'utf8'));
      } catch {
        uncovered.push({ page: v.id, fidelity: v.fidelity, kind, path: rel, reason: '报告缺失' });
        continue;
      }
      got[kind] = rep;
      if (rep.pageId !== v.id) {
        uncovered.push({ page: v.id, fidelity: v.fidelity, kind, path: rel, reason: `pageId=${rep.pageId ?? '（缺）'}，应为 ${v.id}` });
      }
      if (rep.verdict !== 'pass') {
        uncovered.push({ page: v.id, fidelity: v.fidelity, kind, path: rel, reason: `verdict=${rep.verdict ?? '（缺）'}` });
      }
      const evidence = Array.isArray(rep.evidence) ? rep.evidence : [];
      if (evidence.length === 0 || evidence.some((e) => !e || typeof e !== 'object'
        || typeof e.kind !== 'string' || e.kind === '' || typeof e.path !== 'string' || e.path === '')) {
        uncovered.push({ page: v.id, fidelity: v.fidelity, kind, path: rel, reason: 'evidence 必须是非空结构化对象数组（至少含 kind/path）' });
      } else {
        for (const item of evidence) {
          if (!safeManifestFile(item.path) || !(await fileExists(path.join(root, item.path)))) {
            uncovered.push({ page: v.id, fidelity: v.fidelity, kind, path: rel, reason: `evidence.path 不安全或文件不存在：${item.path}` });
          }
        }
      }
      // 三个 digest 任一漂移 → 旧报告判 stale（D-A34-21）
      const drift = [];
      if (rep.specDigest !== specDigest) drift.push('specDigest');
      if (rep.designDigest !== designDigest) drift.push('designDigest');
      if (rep.implementationDigest !== implementationDigest) drift.push('implementationDigest');
      if (drift.length > 0) stale.push({ page: v.id, kind, path: rel, drift });
      // mustPreserve 逐条对账（按 id，不按顺序——顺序变了不该判失败）
      const wantIds = v.mustPreserve.filter((m) => m?.verifier === kind).map((m) => m.id).sort();
      const results = Array.isArray(rep.mustPreserveResults) ? rep.mustPreserveResults : [];
      const gotIds = results.map((r) => r?.id).filter((x) => typeof x === 'string').sort();
      for (const id of wantIds) {
        const hit = results.find((r) => r?.id === id);
        if (!hit) {
          uncovered.push({ page: v.id, fidelity: v.fidelity, kind, path: rel, reason: `mustPreserve "${id}" 未对账` });
        } else if (hit.verdict !== 'pass') {
          uncovered.push({ page: v.id, fidelity: v.fidelity, kind, path: rel, reason: `mustPreserve "${id}" verdict=${hit.verdict ?? '（缺）'}` });
        }
      }
      if (new Set(gotIds).size !== gotIds.length) {
        uncovered.push({ page: v.id, fidelity: v.fidelity, kind, path: rel, reason: 'mustPreserveResults.id 重复' });
      }
      if (kind === 'experience') {
        const primary = rep.primaryTaskResult;
        if (!primary || primary.completed !== true) {
          uncovered.push({ page: v.id, fidelity: v.fidelity, kind, path: rel, reason: 'primaryTaskResult.completed 必须为 true' });
        }
        if (!primary || primary.statement !== v.primaryTask || !Number.isInteger(primary.steps) || primary.steps < 1) {
          uncovered.push({ page: v.id, fidelity: v.fidelity, kind, path: rel, reason: 'primaryTaskResult 必须逐字对应 spec primaryTask，且 steps 为正整数' });
        }
        if (primary && (!Array.isArray(primary.interruptions) || primary.interruptions.length > 0)) {
          uncovered.push({ page: v.id, fidelity: v.fidelity, kind, path: rel, reason: 'primaryTask 存在中断，不能判定为一口气完成' });
        }
      }
    }
    pages.push({
      id: v.id, fidelity: v.fidelity, required: want, specDigest, designDigest, implementationDigest,
      reports: Object.fromEntries(Object.entries(got).map(([k, r]) => [k, r.verdict ?? null])),
    });
  }

  return {
    schemaVersion: '1', pages, uncovered, stale, pass: uncovered.length === 0 && stale.length === 0,
  };
}

async function cmdVerify(root, ctx, { prepare = false } = {}) {
  const lifecycle = await loadLifecycle(root);
  if (lifecycle.currentPhase !== 'DEVELOPING' && lifecycle.currentPhase !== 'MAINTAINING') {
    throw precondition(
      'PHASE_TRANSITION',
      `design verify 只允许在 DEVELOPING/MAINTAINING 收口阶段执行；当前为 ${lifecycle.currentPhase ?? '（缺失）'}`,
      'docs/lifecycle.json',
    );
  }
  const report = await evaluateDesignVerification(root, ctx, { writeDependencies: true });
  await mkdir(path.join(root, '.vima/reports'), { recursive: true });

  // 报告作者不能自行重写 digest 算法，也不能等报告写完后才得到 digest。
  // --prepare 先产出确定性输入清单；它不覆盖最终汇总，也不因报告尚缺而失败。
  if (prepare) {
    const inputs = {
      schemaVersion: '1',
      pages: report.pages.map((p) => ({
        id: p.id,
        fidelity: p.fidelity,
        required: p.required,
        specDigest: p.specDigest,
        designDigest: p.designDigest,
        implementationDigest: p.implementationDigest,
      })),
    };
    await atomicWriteFile(path.join(root, VERIFY_INPUTS_REL), stableStringify(inputs));
    process.stdout.write(`✅ 已准备视觉验收摘要输入：${VERIFY_INPUTS_REL}（报告作者逐页抄写三个 digest）\n`);
    return EXIT.OK;
  }
  await atomicWriteFile(path.join(root, VERIFY_REPORT_REL), stableStringify(report));

  process.stdout.write(
    `${report.pass ? '✅' : '❌'} 视觉与体验验收汇总：${report.pages.length} 页，`
    + `未覆盖 ${report.uncovered.length} 项，过期 ${report.stale.length} 项\n`,
  );
  for (const u of report.uncovered) process.stdout.write(`   未覆盖 ${u.page}[${u.fidelity}] ${u.kind}：${u.reason}\n`);
  for (const s of report.stale) process.stdout.write(`   过期 ${s.page} ${s.kind}：${s.drift.join('、')} 已变\n`);
  process.stdout.write(`报告：${VERIFY_REPORT_REL}\n`);
  return report.pass ? EXIT.OK : EXIT.CHECK_FAILED;
}

/**
 * implementationDigest（D-A34-21）：本页任务 @vima 标注的文件
 * + 静态可达的 features 组件与 Stage A 样式资产。范围固定，不 hash 整库。
 */
async function implementationSnapshotOf(root, view, tasks, roster) {
  const app = roster.apps.find((a) => a.id === view.app) ?? roster.apps[0] ?? null;
  const appDir = app ? (app.dir === '.' ? '' : app.dir) : '';
  const owners = tasks.filter((t) => t.fm.page === view.id).map((t) => t.id);
  if (owners.length === 0) {
    return { digest: null, report: { schemaVersion: '1', pageId: view.id, entries: [], fallback: false, digest: null } };
  }

  // 本页任务标注过的文件（A1 @vima 已有归属，不另造归属机制）
  const codeRoot = path.join(root, appDir, 'src');
  const tagged = [];
  await walkCollect(codeRoot, root, tagged);
  const mine = [];
  for (const rel of tagged) {
    const text = await readFile(path.join(root, rel), 'utf8').catch(() => '');
    if (owners.some((id) => new RegExp(`@vima\\s+${id}(?![a-z0-9-])`).test(text))) mine.push(rel);
  }
  if (mine.length === 0) {
    return { digest: null, report: { schemaVersion: '1', pageId: view.id, entries: [], fallback: false, digest: null } };
  }
  const dep = await reachableDependencySnapshot(root, mine, appDir);
  const stageAStyles = [];
  if (app) {
    for (const rel of stageAStyleFilesOf(app)) {
      if (await fileExists(path.join(root, rel))) stageAStyles.push(rel);
    }
  }
  const all = [...new Set([...mine, ...dep.files, ...stageAStyles])].sort();
  const entries = [];
  for (const rel of all) entries.push({ file: rel, sha: await sha256File(path.join(root, rel)).catch(() => null) });
  const digest = sha256(stableStringify(entries));
  return {
    digest,
    report: { schemaVersion: '1', pageId: view.id, entries, fallback: dep.fallback, digest },
  };
}

/** 递归收集代码文件（相对项目根，posix）。node_modules/dist 不进。 */
async function walkCollect(absDir, root, out) {
  let items = [];
  try {
    items = await readdir(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const it of items) {
    if (it.name === 'node_modules' || it.name === 'dist' || it.name.startsWith('.')) continue;
    const abs = path.join(absDir, it.name);
    if (it.isDirectory()) await walkCollect(abs, root, out);
    else if (/\.(ts|tsx|js|mjs|vue|css)$/.test(it.name)) out.push(path.relative(root, abs).split(path.sep).join('/'));
  }
}

/** `vima design approve direction --app <id>` / `... pages [--page <id>]`：批准 = 时间戳 + 内容摘要。 */
async function cmdApprove(root, target, opts, ctx) {
  const lifecycle = await loadLifecycle(root);
  if (lifecycle.currentPhase !== 'DESIGNING') {
    throw precondition(
      'PHASE_TRANSITION',
      `design approve 只允许在 DESIGNING 阶段执行；当前为 ${lifecycle.currentPhase ?? '（缺失）'}`,
      'docs/lifecycle.json',
    );
  }
  const spec = await loadSpec(root);
  const views = pageViewsOf(spec);
  const roster = await resolveApps(root, { cliRoot: ctx.cliRoot });
  const apiIndex = await contractApiIndexOf(root);
  const approval = designApprovalOf(lifecycle);
  const now = new Date().toISOString();

  if (target === 'direction') {
    const appIds = opts.app ? [opts.app] : roster.apps.map((a) => a.id);
    if (appIds.length === 0) throw usageError('design approve direction 需要端册非空，或用 --app 指定端' + '（用法：' + 'vima design approve direction --app <id>' + '）');
    for (const id of appIds) {
      if (!roster.apps.some((a) => a.id === id)) {
        throw precondition('NO_APP', `端 "${id}" 不在端册中`, '.vima/manifest.json');
      }
      const state = await directionPackageState(root, id);
      if (state.findings.length > 0) {
        throw precondition(
          'DIRECTION_ARTIFACTS',
          `端 ${id} 的方向交付物不完整：${state.findings.map((f) => f.message).join('；')}`,
          `${DESIGN_DIR_REL}/_shell/${id}`,
        );
      }
      approval.directions[id] = {
        approvedAt: now,
        digest: state.digest,
      };
    }
    process.stdout.write(`✅ 已记录方向批准：${appIds.join('、')}（按端存，多端各选各的）\n`);
  } else {
    const targets = opts.page
      ? views.filter((v) => v.id === opts.page)
      : views.filter((v) => v.fidelity === 'D1' || v.fidelity === 'D2');
    if (targets.length === 0) throw precondition('NO_PAGE', opts.page ? `页面 ${opts.page} 不存在` : '无 D1/D2 页面需要批准', 'docs/spec.md');
    for (const v of targets) {
      const previous = approval.pages[v.id];
      const downgraded = previous?.fidelity && FIDELITY_RANK[v.fidelity] < FIDELITY_RANK[previous.fidelity];
      if (downgraded && (!opts.allowDowngrade || typeof opts.reason !== 'string' || opts.reason.trim() === '')) {
        if (opts.allowDowngrade) throw usageError('批准后降级必须同时提供非空 --reason');
        throw precondition(
          'FIDELITY_DOWNGRADE',
          `页面 ${v.id} 已从 ${previous.fidelity} 降为 ${v.fidelity}；须由用户运行 --allow-downgrade --reason <理由> 显式豁免`,
          'docs/lifecycle.json',
        );
      }
      approval.pages[v.id] = {
        approvedAt: now,
        fidelity: v.fidelity,
        specDigest: specDigestOf(v, apiIndex),
        designDigest: await designDigestOf(root, v, await readPageManifest(root, v.id), roster),
        ...(downgraded ? {
          downgradeWaiver: { from: previous.fidelity, to: v.fidelity, reason: opts.reason.trim(), approvedAt: now },
        } : {}),
      };
    }
    process.stdout.write(`✅ 已记录页面批准 ${targets.length} 页（连同 spec 与设计目录摘要，改稿即自动失效）\n`);
  }
  lifecycle.designApproval = approval;
  await saveLifecycle(root, lifecycle);
  return EXIT.OK;
}

/** `vima design invalidate`：显式作废批准（留理由；A5 诚实口径——作废要留痕，不是悄悄清空）。 */
async function cmdInvalidate(root, opts) {
  const lifecycle = await loadLifecycle(root);
  const approval = designApprovalOf(lifecycle);
  const reason = opts.reason ?? '未说明';
  const now = new Date().toISOString();
  let n = 0;
  if (opts.page) {
    if (approval.pages[opts.page]) { delete approval.pages[opts.page]; n += 1; }
  } else if (opts.app) {
    if (approval.directions[opts.app]) { delete approval.directions[opts.app]; n += 1; }
  } else {
    n = Object.keys(approval.directions).length + Object.keys(approval.pages).length;
    approval.directions = {};
    approval.pages = {};
  }
  lifecycle.designApproval = approval;
  lifecycle.designApprovalInvalidatedAt = now;
  lifecycle.designApprovalInvalidatedReason = reason;
  await saveLifecycle(root, lifecycle);
  process.stdout.write(`✅ 已作废 ${n} 条设计批准（理由：${reason}）\n`);
  return EXIT.OK;
}

/**
 * `vima design reconcile`：受控回写环（D-A34-19）。
 * 复用 A31 的基线快照与 computeImpact，但用 **DESIGNING 口径的关闭闸门**——
 * 只检 spec/契约闭环，**不要求受影响任务 done、不跑 converge**（那正是直接复用
 * `vima change close` 会死锁的地方：DESIGNING 期任务尚未拆解）。
 *
 * 六步顺序里最关键的是第 ⑤ 步：**不要求「回写后方向批准仍新鲜」**——
 * 方向批准的摘要不含 spec，否则它会被自己触发的回写作废，形成自我失效死循环。
 */
async function cmdReconcile(root, ctx) {
  const lifecycle = await loadLifecycle(root);
  const roster = await resolveApps(root, { cliRoot: ctx.cliRoot });
  const approval = designApprovalOf(lifecycle);

  if (lifecycle.currentPhase !== 'DESIGNING') {
    throw precondition(
      'PHASE_TRANSITION',
      `design reconcile 只允许在 DESIGNING 阶段执行；当前为 ${lifecycle.currentPhase ?? '（缺失）'}`,
      'docs/lifecycle.json',
    );
  }

  // ① 前置：所选方向批准有效
  const directionStates = new Map();
  for (const app of roster.apps) directionStates.set(app.id, await directionPackageState(root, app.id));
  const missing = roster.apps.map((a) => a.id).filter((id) => {
    const state = directionStates.get(id);
    const rec = approval.directions[id];
    return !rec?.approvedAt || state.findings.length > 0 || rec.digest !== state.digest;
  });
  if (missing.length > 0) {
    throw precondition(
      'NO_DIRECTION',
      `以下端尚未批准设计方向，不能回写：${missing.join('、')}（先跑 vima design approve direction）`,
      'docs/lifecycle.json',
    );
  }

  const baselineDir = path.join(root, CHANGES_REL, DESIGNING_BASELINE_ID);
  if (!(await fileExists(path.join(baselineDir, 'baseline')))) {
    throw precondition(
      'NO_BASELINE',
      `缺 DESIGNING 基线快照（${CHANGES_REL}/${DESIGNING_BASELINE_ID}/baseline）——它由 vima approve --planning 建立`,
      `${CHANGES_REL}/${DESIGNING_BASELINE_ID}`,
    );
  }

  // ③ 复用 A31 影响面算法（同一实现，防两份逻辑漂移）
  const impact = await computeImpact(root, { id: DESIGNING_BASELINE_ID });

  // ④ 回写后必须仍是一份自洽的 planning brief；任务与代码尚未拆解，不在此时检查。
  const validation = await validateProject(root, { cliRoot: ctx.cliRoot, profile: 'planning-brief' });
  if (validation.errors.length > 0) {
    const detail = validation.errors.map((e) => `${e.rule}: ${e.message} (${e.path})`).join('；');
    throw precondition('DESIGN_RECONCILE_INVALID', `受控回写后的 spec/契约不闭环：${detail}`, 'docs/spec.md');
  }
  await writeImpact(root, impact);

  // ⑤ 旧页面批准与旧任务批准失效（设计改了产品，下游一律回炉）
  const invalidatedPages = Object.keys(approval.pages);
  approval.pages = {};
  lifecycle.designApproval = approval;
  const planning = lifecycle.checklists?.PLANNING;
  const hadTasksApproved = planning?.tasksApproved === true;
  if (planning && hadTasksApproved) {
    planning.tasksApproved = false;
    planning.tasksApprovedInvalidatedAt = new Date().toISOString();
    planning.tasksApprovedInvalidatedReason = 'DESIGNING 受控回写：设计方向改变了 spec/契约，任务拆解与批准须重建';
  }
  await saveLifecycle(root, lifecycle);

  const pageChanges = ['added', 'removed', 'modified']
    .reduce((n, kind) => n + (impact.spec?.pages?.[kind]?.length ?? 0), 0);

  process.stdout.write(
    '✅ 受控回写环已收口（DESIGNING 口径：只检 spec/契约闭环，不要求任务 done）\n'
    + `   影响面：页面 ${pageChanges} 处 / 接口 ${impact.summary?.apiChanges ?? 0} 处\n`
    + `   已失效页面批准 ${invalidatedPages.length} 条${hadTasksApproved ? '；tasksApproved 已置 false（须重建任务拆解并重新 approve）' : ''}\n`
    + '   ⑤ 方向批准**不因本次回写失效**——其摘要不含 spec，否则会自我失效死循环\n',
  );
  return EXIT.OK;
}

/**
 * 供 `vima approve`（DESIGNING → DEVELOPING）复用的闸门状态。
 * 与 `vima design check` 同一实现——闸门判据只有一份，防两处口径漂移。
 */
export async function designGateStates(root, ctx) {
  const spec = await loadSpec(root);
  const views = pageViewsOf(spec);
  const lifecycle = await loadLifecycle(root);
  const roster = await resolveApps(root, { cliRoot: ctx.cliRoot });
  return deriveStates(root, views, lifecycle, roster);
}

/** 供 approve --planning 调用：建立/刷新 DESIGNING 基线快照。 */
export async function ensureDesigningBaseline(root) {
  const dir = path.join(root, CHANGES_REL, DESIGNING_BASELINE_ID);
  await mkdir(dir, { recursive: true });
  await snapshotBaseline(root, dir);
  return `${CHANGES_REL}/${DESIGNING_BASELINE_ID}/baseline`;
}

export { DESIGNING_PERSISTED_KEYS };

export async function run(argv, ctx) {
  const sub = argv[0];
  if (!sub || !SUBCOMMANDS.has(sub)) {
    throw usageError(`design 需要子命令（${[...SUBCOMMANDS].join(' | ')}）` + '（用法：' + 'vima design <status|check|verify|approve|invalidate|reconcile> [options]' + '）');
  }
  let values;
  try {
    ({ values } = parseArgs({
      args: argv.slice(sub === 'approve' ? 2 : 1),
      options: {
        check: { type: 'boolean', default: false },
        app: { type: 'string' },
        page: { type: 'string' },
        reason: { type: 'string' },
        prepare: { type: 'boolean', default: false },
        'allow-downgrade': { type: 'boolean', default: false },
      },
      allowPositionals: false,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }
  const root = ctx.cwd;
  switch (sub) {
    case 'status': return cmdStatus(root, { check: values.check }, ctx);
    case 'check': return cmdCheck(root, ctx);
    case 'verify': return cmdVerify(root, ctx, { prepare: values.prepare });
    case 'approve': {
      const target = argv[1];
      if (target !== 'direction' && target !== 'pages') {
        throw usageError('design approve 需要 direction 或 pages' + '（用法：' + 'vima design approve <direction|pages> [--app <id>] [--page <id>]' + '）');
      }
      return cmdApprove(root, target, { ...values, allowDowngrade: values['allow-downgrade'] }, ctx);
    }
    case 'invalidate': return cmdInvalidate(root, values);
    case 'reconcile': return cmdReconcile(root, ctx);
    default: throw usageError(`未知 design 子命令 ${sub}`);
  }
}
