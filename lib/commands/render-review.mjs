// vima render-review —— 从 spec 结构化数据块确定性渲染人类审计视图（契约 §11；设计 §13.2/§19.6）
// 流程：loadSpec + loadContracts → 页面块校验（V-SPEC-03/04/05，缺失拒绝渲染）→
//       动态 import 模板渲染器 → atomicWriteFile → 置 lifecycle.reviewRendered。
// --check：内存渲染与磁盘文件逐字节比对，不一致或缺失 → exit 2 且不写盘。
// checkReviewFresh（A12）：approve 前置 2 的新鲜度判定，与 --check 共用 driftOf 比对。
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { EXIT, VimaError, precondition, usageFromParseArgs } from '../util/errors.mjs';
import { atomicWriteFile, driftOf } from '../util/fs.mjs';
import { loadSpec } from '../model/spec.mjs';
import { loadContracts } from '../model/contracts.mjs';
import { loadLifecycle, saveLifecycle } from '../model/lifecycle.mjs';
import { loadTemplate, readProjectTemplateId } from '../model/template.mjs';
import { resolveApps } from '../model/apps.mjs';
import { validatePages } from './validate.mjs';

const DEFAULT_OUTPUT = 'docs/review/index.html';

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
  const apps = await resolveApps(root, { cliRoot: ctx.cliRoot }); // A16：多端分组/端徽标数据源

  // 渲染前先过页面块校验（§19.6：四要素缺失拒绝渲染并输出缺失清单；契约 §11 复用 validatePages）
  const errors = validatePages(spec, apps.apps.length > 0 ? apps : null).map(formatRuleError);
  if (errors.length > 0) {
    process.stderr.write('❌ 页面数据块校验不通过，拒绝渲染（请先修补 spec 并通过 vima validate）：\n');
    for (const e of errors) process.stderr.write(`  - ${e}\n`);
    return EXIT.CHECK_FAILED;
  }

  const renderReview = await loadRenderer(ctx.cliRoot, root);
  const model = { projectName: path.basename(root), spec, contracts, apps: apps.apps.length > 0 ? apps : null };
  const html = renderReview(model);

  const outRel = values.output ?? DEFAULT_OUTPUT;
  const outPath = path.resolve(root, outRel);

  if (values.check) {
    // 只比对不写盘：文件缺失或字节不一致 → exit 2（与 approve 前置 2 共用 driftOf，A12）
    const drift = await driftOf([[outPath, outRel, html]]);
    if (drift.length > 0) {
      process.stderr.write('❌ --check 失败（请重新执行 vima render-review）：\n');
      for (const d of drift) process.stderr.write(`  - ${d}\n`);
      return EXIT.CHECK_FAILED;
    }
    process.stdout.write(`✅ --check 通过：${outRel} 与 spec 无漂移\n`);
    return EXIT.OK;
  }

  await atomicWriteFile(outPath, html);
  await markLifecycle(root);
  process.stdout.write(
    `✅ 审计视图已生成: ${outRel}（角色 ${spec.roles.length} / 菜单 ${spec.menus.length} / 页面 ${spec.pages.size} / 流程 ${spec.flows.length} / 规则 ${spec.rules.length} / 本期不做 ${spec.nonGoals.length}）\n`,
  );
  return EXIT.OK;
}

/**
 * A12 新鲜度判定（approve 前置 2；契约 §11）：内存渲染审计视图与磁盘产物逐字节比对。
 * 前提：调用方已保证 vima validate 通过（approve 前置 1）。
 * @returns {Promise<{drift: string[]}>}
 */
export async function checkReviewFresh(root, cliRoot, outRel = DEFAULT_OUTPUT) {
  const spec = await loadSpec(root);
  const contracts = await loadContracts(root);
  const apps = await resolveApps(root, { cliRoot }); // A16：与 run 同一 model 口径
  const renderReview = await loadRenderer(cliRoot, root);
  const html = renderReview({
    projectName: path.basename(root), spec, contracts,
    apps: apps.apps.length > 0 ? apps : null,
  });
  const outPath = path.resolve(root, outRel);
  return { drift: await driftOf([[outPath, outRel, html]]) };
}

/** 解析项目模板并动态加载审计视图渲染器（templateId 默认 admin）。 */
async function loadRenderer(cliRoot, root) {
  const templateId = (await readProjectTemplateId(root)) ?? 'admin';
  const tpl = await loadTemplate(cliRoot, templateId);
  const rel = tpl.planning?.renderers?.review;
  if (!rel) {
    throw precondition('NO_RENDERER', `模板 "${templateId}" 未声明审计视图渲染器（planning.renderers.review）`, `templates/${templateId}/template.json`);
  }
  const mod = await import(pathToFileURL(path.join(tpl.dir, rel)).href);
  if (typeof mod.renderReview !== 'function') {
    throw new VimaError('BAD_RENDERER', `渲染器缺少 renderReview 导出`, { path: rel });
  }
  return mod.renderReview;
}

/** lifecycle 存在时置 checklists.PLANNING.reviewRendered = true（缺失时静默跳过）。 */
async function markLifecycle(root) {
  let lifecycle;
  try {
    lifecycle = await loadLifecycle(root);
  } catch (err) {
    if (err instanceof VimaError && err.code === 'NO_LIFECYCLE') return;
    throw err;
  }
  lifecycle.checklists = lifecycle.checklists ?? {};
  lifecycle.checklists.PLANNING = lifecycle.checklists.PLANNING ?? {};
  lifecycle.checklists.PLANNING.reviewRendered = true;
  await saveLifecycle(root, lifecycle);
}

// ── 页面块校验展示层：validatePages 条目（V-SPEC-03/04/05）→ 单行文案 ──

function formatRuleError(e) {
  if (typeof e === 'string') return e;
  const rule = e.rule ? `[${e.rule}] ` : '';
  return `${rule}${e.message ?? JSON.stringify(e)}`;
}
