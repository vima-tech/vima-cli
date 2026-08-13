// vima approve —— 用户评审的机械确认（设计 §19.10 / §13.1 第三道闸门的落痕动作）
// 前置链依次检查：validate 通过 → 审计视图/原型已渲染且与当前 spec 无漂移（A12 新鲜度机检）
// → pendingConfirm 清零；任一失败 exit 4 并列清单。通过后打印任务汇总表并写 lifecycle 留痕。
import { parseArgs } from 'node:util';
import { EXIT, usageFromParseArgs } from '../util/errors.mjs';
import { loadTasks } from '../model/tasks.mjs';
import { loadLifecycle, saveLifecycle } from '../model/lifecycle.mjs';
import { validateProject } from './validate.mjs';
import { checkReviewFresh } from './render-review.mjs';
import { checkPrototypeFresh } from './render-prototype.mjs';

/** 任务汇总表：taskId/title/layer/side/dependsOn/contract 六列，供用户最后核对。 */
function renderTaskTable(tasks) {
  const rows = tasks.map((t) => [
    t.id,
    t.fm.title,
    t.fm.layer,
    t.fm.side,
    t.fm.dependsOn.length > 0 ? t.fm.dependsOn.join(',') : '-',
    t.fm.contract ?? '-',
  ]);
  const header = ['taskId', 'title', 'layer', 'side', 'dependsOn', 'contract'];
  const lines = [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`];
  for (const row of rows) lines.push(`| ${row.join(' | ')} |`);
  return lines.join('\n');
}

/** vima approve */
export async function run(argv, ctx) {
  try {
    parseArgs({ args: argv, options: {}, allowPositionals: false });
  } catch (err) {
    throw usageFromParseArgs(err);
  }
  const root = ctx.cwd;
  const out = (s) => process.stdout.write(`${s}\n`);
  const fail = (s) => process.stderr.write(`${s}\n`); // ❌ 前置未满足块走 stderr（契约 §3 输出流向）

  // ── 前置 1：机械校验必须通过 ──
  const result = await validateProject(root);
  if (!result.pass) {
    fail('❌ 前置未满足：vima validate 未通过，先修复以下错误再 approve：');
    for (const e of result.errors) fail(`  ${e.rule}: ${e.message} (${e.path})`);
    return EXIT.PRECONDITION;
  }

  // ── 前置 2：审计视图与原型必须已渲染且与当前 spec 无漂移（A12 新鲜度机检；契约 §11）──
  // 用户评审的必须是当前 spec 的渲染结果——渲染后又改过 spec 的过期产物一律拦截。
  const review = await checkReviewFresh(root, ctx.cliRoot);
  const proto = await checkPrototypeFresh(root, ctx.cliRoot);
  const drift = [...review.drift, ...proto.drift];
  if (drift.length > 0) {
    fail('❌ 前置未满足：评审载体缺失或与当前 spec 存在漂移（用户看的必须是当前 spec 的渲染结果）：');
    for (const d of drift) fail(`  ${d}`);
    fail('请运行 vima render-review / vima render-prototype 重新渲染后再 approve。');
    return EXIT.PRECONDITION;
  }

  // ── 前置 3：pendingConfirm 推断项必须清零（信息源分级：未确认的推断不得放行）──
  if (result.pendingConfirm.length > 0) {
    fail('❌ 前置未满足：存在未确认的 pendingConfirm 推断项，请逐项与用户确认后清除标记：');
    for (const p of result.pendingConfirm) fail(`  ${p.where} (${p.path})`);
    return EXIT.PRECONDITION;
  }

  // ── 通过：任务汇总表 → 写 lifecycle 留痕 ──
  const tasks = await loadTasks(root);
  out('任务汇总表（最后核对一遍，approve 即定稿）：');
  out(renderTaskTable(tasks));

  const lifecycle = await loadLifecycle(root); // 缺 lifecycle → NO_LIFECYCLE exit 4
  lifecycle.checklists ??= {};
  lifecycle.checklists.PLANNING ??= {};
  lifecycle.checklists.PLANNING.tasksApproved = true;
  // approve 属记录真实时间戳的例外命令（契约 §3）
  lifecycle.checklists.PLANNING.tasksApprovedAt = new Date().toISOString();
  await saveLifecycle(root, lifecycle);

  out('✅ 评审确认已留痕（tasksApproved = true），可以 /go');
  return EXIT.OK;
}
