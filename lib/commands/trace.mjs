// vima trace —— 代码 @vima 标注与任务清单对账（契约 §10 / §6.6，A1 吸收自 PACT）
// 抓两类问题：野生（标注的 taskId 不在任务清单，error）与
// 虚报嫌疑（status=done 的 shared/business 任务无任何标注，warn；--strict 升级为阻断）。
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { EXIT, usageError } from '../util/errors.mjs';
import { atomicWriteFile, stableStringify, fileExists, walkFiles } from '../util/fs.mjs';
import { loadTasks } from '../model/tasks.mjs';
import { readProjectTemplateId, loadTemplate } from '../model/template.mjs';

const REPORT_REL = '.vima/reports/trace.json';
const DEFAULT_CODE_DIRS = ['src', 'backend/src'];
const SCAN_EXTS = new Set(['.ts', '.tsx', '.vue', '.js', '.mjs', '.cjs', '.java']);
const EXCLUDE_DIRS = ['node_modules', 'dist', 'target', '.vima'];
const MARKER_RE = /@vima\s+([a-z0-9][a-z0-9-]*)/g;

/** codeDirs 解析：模板声明优先，取不到用默认；--dir 追加（去重、posix 化）。 */
async function resolveCodeDirs(root, cliRoot, extraDirs) {
  let dirs = DEFAULT_CODE_DIRS;
  try {
    const templateId = await readProjectTemplateId(root);
    if (templateId) {
      const template = await loadTemplate(cliRoot, templateId);
      if (Array.isArray(template.codeDirs) && template.codeDirs.length > 0) {
        dirs = template.codeDirs;
      }
    }
  } catch {
    // 模板不可用不阻断对账：退回默认扫描目录
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
    throw usageError(`参数解析失败：${err.message}`);
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

  // 报告落盘（§6.6）
  await atomicWriteFile(
    path.join(root, REPORT_REL),
    stableStringify({
      schemaVersion: '1',
      markers,
      wild,
      unmarked,
      summary: {
        markers: markers.length,
        wildTaskIds: wild.length,
        doneWithoutMarker: unmarked.length,
      },
    }),
  );

  // stdout 摘要
  const out = [];
  out.push(`✅ 有效 @vima 标注 ${markers.length} 处（扫描目录：${dirs.join(', ') || '(无)'}）`);
  if (wild.length > 0) {
    out.push(`❌ 野生标注 ${wild.length} 处（taskId 不在任务清单）：`);
    for (const w of wild) out.push(`  ${w.taskId} → ${w.file}:${w.line}`);
  }
  if (unmarked.length > 0) {
    out.push(`⚠️ 虚报嫌疑 ${unmarked.length} 个（status=done 却无任何代码标注）：`);
    for (const id of unmarked) out.push(`  ${id}`);
  }
  out.push(`对账报告：${REPORT_REL}`);
  process.stdout.write(`${out.join('\n')}\n`);

  if (wild.length > 0) return EXIT.CHECK_FAILED;
  if (opts.strict && unmarked.length > 0) return EXIT.CHECK_FAILED;
  return EXIT.OK;
}
