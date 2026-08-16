// 追溯图（A41）：把散落在五处的事实拼成一张可反查的图，供 `vima trace` 与 `vima web` 共用。
//
// **为什么要有这一层**：定位一个问题，人得同时看五个地方——代码里的 `@vima` 标注
// （谁写的）、契约（该有哪些端点）、任务 frontmatter（自称做完没）、
// `.vima/reports/<id>-{builder,verifier}.json`（做的时候说了什么）、
// `journal.jsonl`（什么时候发生的）。五处各存各的，靠人脑做 join——
// sustain-v4 实战里「进度为什么是 0」这个问题就是这么被拖了一整个开发期
// （成因其实是采集链路断了，见 A40）。本模块做那个 join，一次算出三张索引：
//
//   byTask     任务 → 它的代码 / 端点 / 报告 / 轨迹      「这个任务到底做到哪一步」
//   byEndpoint 端点 → 谁实现、谁调用、属于哪个契约模块    「这个报错的接口该找谁」
//   byFile     文件 → 归属任务与端                        「这个文件是哪来的」
//
// **只读、纯派生**：不写盘、不读系统时钟（`now` 由调用方注入），任何数据源缺失都降级
// 为空而不抛——追溯视图必须在半成品项目、换 clone、PLANNING 期都能打开。
import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { fileExists, walkFiles } from '../util/fs.mjs';
import { loadTasksTolerant } from './tasks.mjs';
import { loadContracts } from './contracts.mjs';
import { loadJournal, readJsonSafe } from './journal.mjs';
import { resolveApps } from './apps.mjs';
import { scanFeCalls } from '../commands/validate.mjs';
import { readProjectTemplateId, loadTemplate } from './template.mjs';

/** 与 trace 命令同源的扫描面（A41：必须覆盖端册每种 kind 的产物形态）。 */
export const SCAN_EXTS = new Set([
  '.ts', '.tsx', '.vue', '.js', '.mjs', '.cjs', '.java',
  '.wxml', '.wxss', '.wxs',
]);
const EXCLUDE_DIRS = ['node_modules', 'dist', 'target', '.vima', 'build'];
const MARKER_RE = /@vima\s+([a-z0-9][a-z0-9-]*)/g;

// 前端调用点扫描走 validate 的 scanFeCalls（正则 + 全文扫 + 跳注释行，三者同一真源）。
/** 后端类级基路径与方法级映射。 */
const BASE_MAPPING_RE = /@RequestMapping\s*\(([^)]*)\)/;
const METHOD_MAPPING_RE = /@(Get|Post|Put|Delete|Patch)Mapping\s*(?:\(([^)]*)\))?/g;

/** 路径参数归一：契约 `{id}` 与代码模板串 `${expr}` 都归一成 `{*}` 再比对。 */
export function normalizePath(p) {
  return p.replace(/\$\{[^}]*\}/g, '{*}').replace(/\{[^}]*\}/g, '{*}');
}

/** 前端调用路径 → 契约键：request baseURL 已是 /api，非 /api 开头的补前缀。 */
export function feKey(method, rawPath) {
  const withPrefix = rawPath === '/api' || rawPath.startsWith('/api/')
    ? rawPath
    : `/api${rawPath.startsWith('/') ? '' : '/'}${rawPath}`;
  return `${method.toUpperCase()} ${normalizePath(withPrefix)}`;
}

/** Mapping 注解括号内的路径：只认 value=/path= 显式指定或首个位置字符串参数。 */
export function mappingPath(inner) {
  if (!inner) return '';
  let m = /(?:value|path)\s*=\s*"([^"]*)"/.exec(inner);
  if (m) return m[1];
  m = /^\s*"([^"]*)"/.exec(inner);
  if (m) return m[1];
  return '';
}

/**
 * 端册各端 + backend 的代码目录（与 trace 命令同口径）。
 * 端册不可用时退回模板 codeDirs，再退回默认——追溯图不能因为端册缺失而整个打不开。
 */
export async function resolveCodeDirs(root, cliRoot, extraDirs = []) {
  let dirs = ['src', 'backend/src'];
  let apps = [];
  try {
    const roster = await resolveApps(root, { cliRoot });
    apps = roster.apps ?? [];
    if (apps.length > 0) {
      dirs = apps.map((a) => (a.dir === '.' || a.dir === '' ? a.codeDir : `${a.dir}/${a.codeDir}`));
      if (roster.backend) dirs.push(`${roster.backend.dir}/src`);
    } else {
      const templateId = await readProjectTemplateId(root);
      if (templateId) {
        const tpl = await loadTemplate(cliRoot, templateId);
        if (Array.isArray(tpl.codeDirs) && tpl.codeDirs.length > 0) dirs = tpl.codeDirs;
      }
    }
  } catch { /* 端册/模板不可用：用默认目录，不阻断 */ }
  const out = [];
  for (const d of [...dirs, ...extraDirs]) {
    const norm = String(d).split(path.sep).join('/').replace(/\/+$/, '');
    if (norm !== '' && !out.includes(norm)) out.push(norm);
  }
  return { dirs: out, apps };
}

/** 文件相对路径 → 归属端 id（取 dir 最长前缀匹配；后端与无端册返回 null）。 */
function appOf(fileRel, apps) {
  let best = null;
  let bestLen = -1;
  for (const a of apps) {
    const prefix = a.dir === '.' || a.dir === '' ? '' : `${a.dir}/`;
    if (prefix === '') {
      if (bestLen < 0) { best = a.id; bestLen = 0; }
      continue;
    }
    if (fileRel.startsWith(prefix) && prefix.length > bestLen) { best = a.id; bestLen = prefix.length; }
  }
  return best;
}

/**
 * 行号定位器：把「全文匹配下标」换算成 1 起的行号。
 *
 * **调用点必须按全文扫，不能按行扫**（A41）：本项目的真实写法里，
 * 泛型长的请求会被格式化器折成多行——
 * ```ts
 * return request.get<unknown, { code: number; msg: string; data: PatientOverview }>(
 *   `/patients/${id}/overview`
 * )
 * ```
 * 方法名、泛型段、路径字面量分处三行，逐行 `matchAll` 一条都匹配不上。
 * 实证（sustain-v4，2026-08-16）：调用点按行扫时报「无人调用」39 个端点，
 * 而同一条正则在 `validate.checkFrontendCode` / `converge` 里按全文扫只报 2 个
 * ——同一事实两个数字，且**追溯图这一侧是错的那个**。
 * 前端调用点现由 `scanFeCalls` 统一处理；本定位器服务 `@vima` 标注与 Java 注解两处扫描。
 */
function lineLocator(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return (index) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= index) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
}

/**
 * 扫一遍代码：收标注、收前端调用端点、收后端实现端点。
 * 一次遍历同时产出三类事实——分三次扫会让大仓库的追溯视图明显变慢。
 */
async function scanCode(root, dirs, apps) {
  const markers = [];
  const calls = [];   // { key, file, line }
  const impls = [];   // { key, file, line }
  for (const dir of dirs) {
    const abs = path.join(root, ...dir.split('/'));
    if (!(await fileExists(abs))) continue;
    for (const rel of await walkFiles(abs, { exclude: EXCLUDE_DIRS })) {
      if (!SCAN_EXTS.has(path.extname(rel))) continue;
      const fileRel = `${dir}/${rel}`;
      const text = await readFile(path.join(abs, ...rel.split('/')), 'utf8');
      const lineAt = lineLocator(text);
      for (const m of text.matchAll(MARKER_RE)) {
        markers.push({ taskId: m[1], file: fileRel, line: lineAt(m.index), app: appOf(fileRel, apps) });
      }
      // 端点归属只在带标注的业务文件上算——底座/共享层没有标注，天然不参与（同 V-CODE 作用域）
      if (!markers.some((m) => m.file === fileRel)) continue;
      for (const c of scanFeCalls(text)) {
        calls.push({ key: feKey(c.method, c.path), file: fileRel, line: c.line });
      }
      if (fileRel.endsWith('.java')) {
        const baseM = BASE_MAPPING_RE.exec(text);
        const base = baseM ? mappingPath(baseM[1]) : '';
        for (const m of text.matchAll(METHOD_MAPPING_RE)) {
          const sub = mappingPath(m[2]);
          const full = sub ? `${base}${sub}` : base;
          if (!full) continue;
          impls.push({ key: `${m[1].toUpperCase()} ${normalizePath(full)}`, file: fileRel, line: lineAt(m.index) });
        }
      }
    }
  }
  return { markers, calls, impls };
}

/** 读 `.vima/reports/<id>-{builder,verifier}.json`（存在即收，坏 JSON 记为 parseError）。 */
async function loadTaskReports(root) {
  const dir = path.join(root, '.vima', 'reports');
  const out = {};
  let names = [];
  try { names = await readdir(dir); } catch { return out; }
  for (const name of names) {
    const m = /^([a-z0-9][a-z0-9-]*)-(builder|verifier)\.json$/.exec(name);
    if (!m) continue;
    const [, taskId, role] = m;
    const data = await readJsonSafe(path.join(dir, name));
    out[taskId] ??= {};
    out[taskId][role] = data === null
      ? { file: `.vima/reports/${name}`, parseError: true }
      : {
        file: `.vima/reports/${name}`,
        round: Number.isInteger(data.round) ? data.round : null,
        // builder 用 status(completed|failed)，verifier 用 result(pass|fail)——两套字段名
        // 是既有契约（internal-contracts §6.13/§6.14），这里如实并列，不擅自统一。
        status: typeof data.status === 'string' ? data.status : null,
        result: typeof data.result === 'string' ? data.result : null,
        points: Array.isArray(data.points) ? data.points.length : null,
        pointsFailed: Array.isArray(data.points)
          ? data.points.filter((p) => p && p.passed === false && p.waived !== true).length
          : null,
      };
  }
  return out;
}

/**
 * 构建追溯图。
 * @param {string} root 项目根
 * @param {{cliRoot?: string, extraDirs?: string[]}} opts
 */
export async function buildTraceability(root, { cliRoot = null, extraDirs = [] } = {}) {
  const { dirs, apps } = await resolveCodeDirs(root, cliRoot, extraDirs);
  const { markers, calls, impls } = await scanCode(root, dirs, apps);
  const { tasks } = await loadTasksTolerant(root);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const reports = await loadTaskReports(root);
  const events = await loadJournal(root);

  let contracts = [];
  try { contracts = (await loadContracts(root, { tolerant: true })).filter((c) => !c.parseError); } catch { /* 无契约 */ }

  // ── 契约端点索引 ──
  const endpoints = new Map(); // normKey → { key, method, path, module, contractFile, consumers }
  for (const c of contracts) {
    for (const a of c.apis ?? []) {
      const key = `${String(a.method).toUpperCase()} ${normalizePath(a.path)}`;
      endpoints.set(key, {
        key,
        method: String(a.method).toUpperCase(),
        path: a.path,
        module: c.module,
        contractFile: c.file,
        consumers: Array.isArray(a.consumers) ? a.consumers : [],
        implementedBy: [],
        calledBy: [],
      });
    }
  }

  // 文件 → 任务（一个文件可带多个任务标注，取全部）
  const tasksOfFile = new Map();
  for (const m of markers) {
    if (!tasksOfFile.has(m.file)) tasksOfFile.set(m.file, new Set());
    tasksOfFile.get(m.file).add(m.taskId);
  }
  const attribute = (file) => [...(tasksOfFile.get(file) ?? [])].sort();

  const unknownCalls = [];
  for (const c of calls) {
    const ep = endpoints.get(c.key);
    const owners = attribute(c.file);
    const app = appOf(c.file, apps);
    if (!ep) { unknownCalls.push({ ...c, taskIds: owners, app }); continue; }
    ep.calledBy.push({ file: c.file, line: c.line, taskIds: owners, app });
  }
  const unknownImpls = [];
  for (const i of impls) {
    const ep = endpoints.get(i.key);
    const owners = attribute(i.file);
    if (!ep) { unknownImpls.push({ ...i, taskIds: owners }); continue; }
    ep.implementedBy.push({ file: i.file, line: i.line, taskIds: owners });
  }

  // ── 任务索引 ──
  const journalByTask = new Map();
  for (const e of events) {
    const m = /^([a-z0-9][a-z0-9-]*)\/(builder|verifier)\/r(\d+)$/.exec(String(e?.ref ?? ''));
    if (!m) continue;
    if (!journalByTask.has(m[1])) journalByTask.set(m[1], []);
    journalByTask.get(m[1]).push({ ts: e.ts ?? null, role: m[2], round: Number(m[3]), outcome: e.outcome ?? null });
  }

  const knownIds = new Set(tasks.map((t) => t.id));
  const byTask = {};
  for (const t of tasks) {
    const files = markers.filter((m) => m.taskId === t.id);
    const eps = new Set();
    for (const ep of endpoints.values()) {
      if (ep.implementedBy.some((x) => x.taskIds.includes(t.id))) eps.add(ep.key);
      if (ep.calledBy.some((x) => x.taskIds.includes(t.id))) eps.add(ep.key);
    }
    const rep = reports[t.id] ?? {};
    const jv = journalByTask.get(t.id) ?? [];
    byTask[t.id] = {
      taskId: t.id,
      title: t.fm.title ?? null,
      status: t.fm.status ?? null,
      layer: t.fm.layer ?? null,
      side: t.fm.side ?? null,
      app: t.fm.app ?? null,
      page: t.fm.page ?? null,
      contract: t.fm.contract ?? null,
      files: [...new Set(files.map((f) => f.file))].sort(),
      markerCount: files.length,
      endpoints: [...eps].sort(),
      reports: rep,
      journal: { events: jv.length, last: jv.at(-1) ?? null },
    };
  }

  // ── 文件索引 ──
  const byFile = {};
  for (const [file, ids] of tasksOfFile) {
    byFile[file] = { file, taskIds: [...ids].sort(), app: appOf(file, apps) };
  }

  const epList = [...endpoints.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const orphanEndpoints = epList.filter((e) => e.implementedBy.length === 0).map((e) => e.key);
  const uncalledEndpoints = epList.filter((e) => e.calledBy.length === 0).map((e) => e.key);
  const doubleImplemented = epList.filter((e) => new Set(e.implementedBy.map((x) => x.file)).size > 1).map((e) => e.key);

  return {
    schemaVersion: '2',
    dirs,
    apps: apps.map((a) => ({ id: a.id, kind: a.kind, dir: a.dir, codeDir: a.codeDir })),
    markers,
    wild: markers.filter((m) => !knownIds.has(m.taskId)),
    byTask,
    byFile,
    byEndpoint: Object.fromEntries(epList.map((e) => [e.key, e])),
    unknownCalls,
    unknownImpls,
    summary: {
      markers: markers.filter((m) => knownIds.has(m.taskId)).length,
      wildTaskIds: markers.filter((m) => !knownIds.has(m.taskId)).length,
      tasks: tasks.length,
      tasksWithCode: Object.values(byTask).filter((t) => t.markerCount > 0).length,
      tasksClaimedDone: Object.values(byTask).filter((t) => t.status === 'done').length,
      tasksWithBuilderReport: Object.values(byTask).filter((t) => t.reports.builder).length,
      tasksWithVerifierReport: Object.values(byTask).filter((t) => t.reports.verifier).length,
      tasksWithJournal: Object.values(byTask).filter((t) => t.journal.events > 0).length,
      endpoints: epList.length,
      endpointsImplemented: epList.length - orphanEndpoints.length,
      endpointsOrphan: orphanEndpoints.length,
      endpointsUncalled: uncalledEndpoints.length,
      endpointsDoubleImplemented: doubleImplemented.length,
      unknownCalls: unknownCalls.length,
      unknownImpls: unknownImpls.length,
    },
    orphanEndpoints,
    uncalledEndpoints,
    doubleImplemented,
  };
}
