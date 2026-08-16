// vima render-matrix —— 从 spec/契约/任务确定性重生成需求覆盖矩阵（V-COV-01 的生成端）
//
// 背景：V-COV-01 强制 docs/coverage-matrix.md 存在、≥3 列、无空单元格，但此前没有任何
// 命令生成它——矩阵靠人/代理手写，产物一变就烂掉，而校验只能发现「烂了」不能修。
// 本命令把「页面 → 接口 → 契约 → 任务」这条链完全由既有数据块推导出来，与 render-review
// 同属确定性渲染：同样的输入必然得到同样的字节，可用 --check 验漂移。
import path from 'node:path';
import { parseArgs } from 'node:util';
import { EXIT, usageFromParseArgs } from '../util/errors.mjs';
import { atomicWriteFile, driftOf } from '../util/fs.mjs';
import { loadSpec } from '../model/spec.mjs';
import { loadContracts, apiKey } from '../model/contracts.mjs';
import { loadTasks } from '../model/tasks.mjs';
import { resolveApps, appOf } from '../model/apps.mjs';
import { rulesForTask } from './context.mjs';

const DEFAULT_OUTPUT = 'docs/coverage-matrix.md';

/** 把 "get /api/x" 归一为 "GET /api/x"（与 validate 同口径）。 */
function normalizeApiRef(s) {
  const str = String(s ?? '').trim();
  const idx = str.indexOf(' ');
  if (idx < 0) return str.toUpperCase();
  return `${str.slice(0, idx).toUpperCase()} ${str.slice(idx + 1).trim()}`;
}

/** 表格单元格转义：竖线会破坏 markdown 表格结构。 */
function cell(s) {
  return String(s ?? '').replace(/\|/g, '\\|').trim();
}

/** 未承接标记前缀：V-COV-02 靠它识别「这一行没人负责」（契约 §8，与 validate 同一约定）。 */
const UNCOVERED = '—（尚无任务承接）';

/**
 * 任务负责的接口集（A44 D-A44-01）。
 *
 * **算法与 `vima context` 同源**：`contract.apis`（任务声明 `apis` 负责集时按其切片）
 * ∪ `page.apis`。同一事实两套实现必然漂移——A41 的实测教训是同一条正则按行扫与按全文扫
 * 给出 39 与 2 两个数字，且追溯图那一侧是错的那个。
 *
 * @param {{fm: object}} task
 * @param {Map<string, string[]>} contractApis 契约文件 → 归一后的接口键
 * @param {Map<string, object>} pages PAGE-xx → vima:page 块
 * @returns {Set<string>}
 */
function taskApiSet(task, contractApis, pages) {
  const out = new Set();
  const cf = task.fm?.contract;
  if (typeof cf === 'string' && cf !== '') {
    const owned = Array.isArray(task.fm.apis) && task.fm.apis.length > 0
      ? new Set(task.fm.apis.map(normalizeApiRef))
      : null;
    for (const k of contractApis.get(cf) ?? []) {
      if (owned === null || owned.has(k)) out.add(k);
    }
  }
  const pg = task.fm?.page;
  if (typeof pg === 'string' && pg !== '') {
    const page = pages.get(pg);
    for (const a of Array.isArray(page?.apis) ? page.apis : []) out.add(normalizeApiRef(a));
  }
  return out;
}

/**
 * 业务规则承接表的数据行（A44 D-A44-01）。
 *
 * 承接判定**直接复用** `rulesForTask`：规则入选 ⟺ 无 `apis`（全局规则）
 * 或 `rule.apis` 与任务接口集有交集。全局规则按定义注入全部任务上下文，
 * 故渲染为「全局」而非缺口。
 *
 * @returns {string[][]} `[规则, 类型, 实体, 接口, 承接任务]`
 */
export function ruleRowsOf({ spec, contracts, tasks }) {
  const contractApis = new Map();
  for (const c of contracts) {
    contractApis.set(c.file, (c.apis ?? []).map((a) => normalizeApiRef(apiKey(a))));
  }
  const apisByTask = tasks.map((t) => ({ id: t.id, apis: taskApiSet(t, contractApis, spec.pages) }));

  const rules = (Array.isArray(spec.rules) ? spec.rules : [])
    .filter((r) => r && typeof r === 'object')
    .slice()
    .sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')));

  return rules.map((r) => {
    const id = typeof r.id === 'string' && r.id !== '' ? r.id : '（缺 id）';
    const global = !Array.isArray(r.apis) || r.apis.length === 0;
    const owners = global
      ? null
      : apisByTask.filter((t) => rulesForTask([r], t.apis).length > 0).map((t) => t.id).sort();
    return [
      `${cell(r.desc ?? id)}（${cell(id)}）`,
      cell(r.type ?? '—'),
      cell(r.entity ?? '—'),
      global ? '全局（不限接口）' : `${r.apis.length} 个接口`,
      global
        ? '全局（注入全部任务上下文）'
        : (owners.length > 0 ? owners.map(cell).join(' / ') : UNCOVERED),
    ];
  });
}

/**
 * 生成矩阵正文（纯函数，便于测试与 --check 比对）。
 * @returns {string} 以换行结尾的 markdown
 */
export function renderMatrix({ spec, contracts, tasks, apps = null }) {
  const multi = Boolean(apps?.multi); // A16：多端项目首列加「端」（V-COV-01 同口径）
  // 接口 → 契约文件
  const apiToContract = new Map();
  for (const c of contracts) {
    for (const api of c.apis) {
      const k = apiKey(api);
      if (!apiToContract.has(k)) apiToContract.set(k, c.file);
    }
  }
  // 契约文件 → 模块级承接任务。只收**不带 page 字段**的任务（后端/模块任务）：
  // 带 page 的前端任务按页面归属，否则同一契约下的兄弟页面任务会互相串行到彼此的行里。
  const contractToTasks = new Map();
  for (const t of tasks) {
    const cf = t.fm?.contract;
    if (typeof cf !== 'string' || cf === '') continue;
    if (typeof t.fm?.page === 'string' && t.fm.page !== '') continue;
    if (!contractToTasks.has(cf)) contractToTasks.set(cf, []);
    contractToTasks.get(cf).push(t.id);
  }
  for (const arr of contractToTasks.values()) arr.sort();
  // 页面 → 承接的前端任务
  const pageToTasks = new Map();
  for (const t of tasks) {
    const pg = t.fm?.page;
    if (typeof pg !== 'string' || pg === '') continue;
    if (!pageToTasks.has(pg)) pageToTasks.set(pg, []);
    pageToTasks.get(pg).push(t.id);
  }
  for (const arr of pageToTasks.values()) arr.sort();

  const rows = [];
  for (const [id, page] of spec.pages) {
    const apis = (Array.isArray(page.apis) ? page.apis : []).map(normalizeApiRef);
    const files = [...new Set(apis.map((a) => apiToContract.get(a)).filter(Boolean))].sort();
    const taskIds = new Set(pageToTasks.get(id) ?? []);
    for (const f of files) for (const tid of contractToTasks.get(f) ?? []) taskIds.add(tid);
    rows.push([
      ...(multi ? [cell(appOf(page, apps) ?? '—')] : []), // A16 端列
      `${cell(page.title ?? id)}（${id}）`,
      `${apis.length} 个接口`,
      files.length > 0 ? files.map(cell).join(' / ') : '—（本页无接口引用）',
      taskIds.size > 0 ? [...taskIds].sort().map(cell).join(' / ') : UNCOVERED,
    ]);
  }

  const ruleRows = ruleRowsOf({ spec, contracts, tasks });
  const ruleGlobal = ruleRows.filter((r) => r[4].startsWith('全局')).length;
  const ruleUncovered = ruleRows.filter((r) => r[4].startsWith('—')).length;

  const out = [
    '# 需求覆盖矩阵',
    '',
    '> 本文件由 `vima render-matrix` 从 spec 页面块 / 业务规则块 / 契约 apis / 任务 frontmatter',
    '> 确定性生成，**不要手改**——改了会在下次生成时被覆盖，也会让 `vima doctor` 的漂移检查报警。',
    '> V-COV-01（error）逐表校验列数与空单元格；V-COV-02（warn）点名末列为「—」的未承接行。',
    '',
    '## 页面承接',
    '',
    `> 口径：${multi ? '端 → ' : ''}页面（需求） → 接口 → 契约 → 承接任务。`,
    '',
    multi ? '| 端 | 需求 | 接口 | 契约 | 任务 |' : '| 需求 | 接口 | 契约 | 任务 |',
    multi ? '|---|---|---|---|---|' : '|---|---|---|---|',
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
    `合计：${rows.length} 个页面 / ${rows.reduce((n, r) => n + Number.parseInt(r[multi ? 2 : 1], 10), 0)} 条页面接口引用 / `
      + `${new Set(contracts.map((c) => c.file)).size} 份契约 / ${tasks.length} 个任务。`,
    '',
    '## 业务规则承接',
    '',
    '> 口径：规则（spec 第五章 `vima:rules`） → 接口 → 承接任务。承接关系与 `vima context`',
    '> 注入任务上下文时用的是同一个判定（`rulesForTask`）：无 `apis` 的规则为全局规则，',
    '> 注入全部任务、按定义不构成缺口；声明了 `apis` 的规则须与某个任务的接口集有交集。',
    '',
    '| 规则 | 类型 | 实体 | 接口 | 承接任务 |',
    '|---|---|---|---|---|',
    ...(ruleRows.length > 0
      ? ruleRows.map((r) => `| ${r.join(' | ')} |`)
      // 空清单不写成「—」开头的承接列：那会被 V-COV-02 当成「有规则但没人负责」。
      // 「一条规则都没声明」是 V-SPEC-09 的职责，不在本表重复报告。
      : ['| （spec 第五章无 vima:rules 条目） | — | — | — | 不适用（无规则） |']),
    '',
    `合计：${ruleRows.length} 条规则，其中全局规则 ${ruleGlobal} 条`
      + `${ruleUncovered > 0 ? ` / 尚无任务承接 ${ruleUncovered} 条` : ''}。`,
    '',
  ];
  return out.join('\n');
}

export async function run(argv, ctx) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { check: { type: 'boolean', default: false }, output: { type: 'string' } },
      allowPositionals: false,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }

  const root = ctx.cwd;
  const spec = await loadSpec(root);
  const contracts = await loadContracts(root);
  const tasks = await loadTasks(root);
  const apps = await resolveApps(root, { cliRoot: ctx.cliRoot }); // A16：多端加端列
  const text = renderMatrix({ spec, contracts, tasks, apps });

  const outRel = values.output ?? DEFAULT_OUTPUT;
  const outPath = path.resolve(root, outRel);

  if (values.check) {
    const drift = await driftOf([[outPath, outRel, text]]);
    if (drift.length > 0) {
      process.stderr.write('❌ --check 失败（请重新执行 vima render-matrix）：\n');
      for (const d of drift) process.stderr.write(`  - ${d}\n`);
      return EXIT.CHECK_FAILED;
    }
    process.stdout.write(`✅ --check 通过：${outRel} 与 spec/契约/任务无漂移\n`);
    return EXIT.OK;
  }

  await atomicWriteFile(outPath, text);
  const gaps = spec.pages.size - [...spec.pages.values()].filter((p) => (p.apis ?? []).length > 0).length;
  process.stdout.write(
    `✅ 覆盖矩阵已生成: ${outRel}（页面 ${spec.pages.size} / 契约 ${contracts.length} / 任务 ${tasks.length}`
      + `${gaps > 0 ? ` / 无接口引用的页面 ${gaps}` : ''}）\n`,
  );
  return EXIT.OK;
}
