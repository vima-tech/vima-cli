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
      taskIds.size > 0 ? [...taskIds].sort().map(cell).join(' / ') : '—（尚无任务承接）',
    ]);
  }

  const out = [
    '# 需求覆盖矩阵',
    '',
    '> 本文件由 `vima render-matrix` 从 spec 页面块 / 契约 apis / 任务 frontmatter 确定性生成，',
    '> **不要手改**——改了会在下次生成时被覆盖，也会让 `vima doctor` 的漂移检查报警。',
    `> 口径：${multi ? '端 → ' : ''}页面（需求） → 接口 → 契约 → 承接任务。V-COV-01 要求任何数据行都不得有空单元格。`,
    '',
    multi ? '| 端 | 需求 | 接口 | 契约 | 任务 |' : '| 需求 | 接口 | 契约 | 任务 |',
    multi ? '|---|---|---|---|---|' : '|---|---|---|---|',
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
    `合计：${rows.length} 个页面 / ${rows.reduce((n, r) => n + Number.parseInt(r[multi ? 2 : 1], 10), 0)} 条页面接口引用 / `
      + `${new Set(contracts.map((c) => c.file)).size} 份契约 / ${tasks.length} 个任务。`,
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
      allowPositionals: true,
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
