// vima trace —— 代码 @vima 标注与任务清单对账（契约 §10 / §6.6，A1 吸收自 PACT）
// 抓两类问题：野生（标注的 taskId 不在任务清单，error）与
// 虚报嫌疑（status=done 的 shared/business 任务无任何标注，warn；--strict 升级为阻断）。
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { EXIT, usageFromParseArgs } from '../util/errors.mjs';
import { atomicWriteFile, stableStringify, fileExists, walkFiles } from '../util/fs.mjs';
import { loadTasks } from '../model/tasks.mjs';
import { buildTraceability } from '../model/traceability.mjs';
import { readProjectTemplateId, loadTemplate } from '../model/template.mjs';
import { resolveApps } from '../model/apps.mjs';

const REPORT_REL = '.vima/reports/trace.json';
const DEFAULT_CODE_DIRS = ['src', 'backend/src'];
/**
 * 参与代码级追溯的文件类型。
 *
 * **必须覆盖端册里每种 kind 的产物形态**（A41）：A23 把 mp-native 收为一等端后，
 * 小程序页面的产物是 `.wxml`/`.wxss`/`.wxs` 三件套，而本集合长期只有 Web/Java 那几种
 * ——后果是小程序端的 `@vima` 标注**一条都扫不到**：代码级追溯对该端整体失效，
 * 且 `--strict` 下会把「产物以 wxml/wxss 为主」的页面任务误判成「done 却无标注 = 虚报嫌疑」。
 * 实证（sustain-v4，2026-08-15）：mp 骨架 8 个 wxml/wxss 文件，trace 命中 0。
 * 同仓 `create.mjs` 的 TEXT_EXTS 与 post-write hook 都早已认得这三种，唯独这里漏了。
 */
const SCAN_EXTS = new Set([
  '.ts', '.tsx', '.vue', '.js', '.mjs', '.cjs', '.java',
  '.wxml', '.wxss', '.wxs', // A23 mp-native 三件套
]);
const EXCLUDE_DIRS = ['node_modules', 'dist', 'target', '.vima'];
const MARKER_RE = /@vima\s+([a-z0-9][a-z0-9-]*)/g;

/**
 * codeDirs 解析（A16 端册化）：端册各端 <dir>/<codeDir> + backend/src 优先；
 * 端册为空时退回模板 codeDirs（兼容回退）→ 默认；--dir 追加（去重、posix 化）。
 */
async function resolveCodeDirs(root, cliRoot, extraDirs) {
  let dirs = DEFAULT_CODE_DIRS;
  try {
    const roster = await resolveApps(root, { cliRoot });
    if (roster.apps.length > 0) {
      dirs = roster.apps.map((a) => (a.dir === '.' || a.dir === '' ? a.codeDir : `${a.dir}/${a.codeDir}`));
      if (roster.backend) dirs.push(`${roster.backend.dir}/src`);
    } else {
      const templateId = await readProjectTemplateId(root);
      if (templateId) {
        const template = await loadTemplate(cliRoot, templateId);
        if (Array.isArray(template.codeDirs) && template.codeDirs.length > 0) {
          dirs = template.codeDirs;
        }
      }
    }
  } catch {
    // 模板/端册不可用不阻断对账：退回默认扫描目录
  }
  const out = [];
  for (const d of [...dirs, ...extraDirs]) {
    const norm = d.split(path.sep).join('/').replace(/\/+$/, '');
    if (norm !== '' && !out.includes(norm)) out.push(norm);
  }
  return out;
}

/** 扫描一个代码目录，收集全部 @vima 标注（文件相对项目根，'/' 分隔 + 行号）。 */
async function scanDir(root, dir, markers) {
  const abs = path.join(root, ...dir.split('/'));
  if (!(await fileExists(abs))) return;
  const files = await walkFiles(abs, { exclude: EXCLUDE_DIRS });
  for (const rel of files) {
    if (!SCAN_EXTS.has(path.extname(rel))) continue;
    const text = await readFile(path.join(abs, ...rel.split('/')), 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const m of lines[i].matchAll(MARKER_RE)) {
        markers.push({ taskId: m[1], file: `${dir}/${rel}`, line: i + 1 });
      }
    }
  }
}

function byFileLine(a, b) {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  if (a.line !== b.line) return a.line - b.line;
  return a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0;
}

/** vima trace [--dir <path>]... [--strict] */
export async function run(argv, ctx) {
  let opts;
  try {
    ({ values: opts } = parseArgs({
      args: argv,
      options: {
        dir: { type: 'string', multiple: true },
        strict: { type: 'boolean' },
      },
      allowPositionals: false,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }

  const root = ctx.cwd;
  const tasks = await loadTasks(root);
  const knownIds = new Set(tasks.map((t) => t.id));

  const dirs = await resolveCodeDirs(root, ctx.cliRoot, opts.dir ?? []);
  const all = [];
  for (const dir of dirs) await scanDir(root, dir, all);
  all.sort(byFileLine);

  const markers = all.filter((m) => knownIds.has(m.taskId));
  const wild = all.filter((m) => !knownIds.has(m.taskId));

  // 虚报嫌疑：status=done 且 layer∈{shared,business} 却没有任何代码标注
  const markedIds = new Set(markers.map((m) => m.taskId));
  const unmarked = tasks
    .filter((t) => t.fm.status === 'done'
      && (t.fm.layer === 'shared' || t.fm.layer === 'business')
      && !markedIds.has(t.id))
    .map((t) => t.id)
    .sort();

  // 追溯图（A41）：把代码标注、契约端点、任务 frontmatter、报告与 journal 拼成
  // 三张可反查索引（byTask / byEndpoint / byFile）。判定口径不变——野生与虚报仍由
  // 上面那段算，本图只增维不改判，避免同一结论出现第二个真源。
  let graph = null;
  try {
    graph = await buildTraceability(root, { cliRoot: ctx.cliRoot, extraDirs: opts.dir ?? [] });
  } catch {
    graph = null; // 追溯图失败不阻断对账：trace 的底线职责是抓野生与虚报
  }

  // 报告落盘（§6.6 + A41 增维）
  await atomicWriteFile(
    path.join(root, REPORT_REL),
    stableStringify({
      schemaVersion: graph ? '2' : '1',
      markers,
      wild,
      unmarked,
      summary: {
        markers: markers.length,
        wildTaskIds: wild.length,
        doneWithoutMarker: unmarked.length,
        ...(graph ? graph.summary : {}),
      },
      ...(graph
        ? {
          apps: graph.apps,
          byTask: graph.byTask,
          byFile: graph.byFile,
          byEndpoint: graph.byEndpoint,
          unknownCalls: graph.unknownCalls,
          unknownImpls: graph.unknownImpls,
          orphanEndpoints: graph.orphanEndpoints,
          uncalledEndpoints: graph.uncalledEndpoints,
          doubleImplemented: graph.doubleImplemented,
        }
        : {}),
    }),
  );

  // 结果摘要走 stdout，❌/⚠️ 失败诊断走 stderr（契约 §3 输出流向）
  const lines = [`✅ 有效 @vima 标注 ${markers.length} 处（扫描目录：${dirs.join(', ') || '(无)'}）`];
  if (graph) {
    const s = graph.summary;
    lines.push(
      `   追溯图：任务 ${s.tasksWithCode}/${s.tasks} 有代码 · `
      + `${s.tasksWithBuilderReport} 有构建报告 · ${s.tasksWithVerifierReport} 有验收报告 · ${s.tasksWithJournal} 有轨迹`,
      `   端点：${s.endpointsImplemented}/${s.endpoints} 已实现`
      + `（孤儿 ${s.endpointsOrphan} · 无人调用 ${s.endpointsUncalled} · 重复实现 ${s.endpointsDoubleImplemented}）`,
    );
  }
  lines.push(`对账报告：${REPORT_REL}`);
  process.stdout.write(`${lines.join('\n')}\n`);
  const diag = [];
  if (wild.length > 0) {
    diag.push(`❌ 野生标注 ${wild.length} 处（taskId 不在任务清单）：`);
    for (const w of wild) diag.push(`  ${w.taskId} → ${w.file}:${w.line}`);
  }
  if (unmarked.length > 0) {
    diag.push(`⚠️ 虚报嫌疑 ${unmarked.length} 个（status=done 却无任何代码标注）：`);
    for (const id of unmarked) diag.push(`  ${id}`);
  }
  if (diag.length > 0) process.stderr.write(`${diag.join('\n')}\n`);

  if (wild.length > 0) return EXIT.CHECK_FAILED;
  if (opts.strict && unmarked.length > 0) return EXIT.CHECK_FAILED;
  return EXIT.OK;
}
