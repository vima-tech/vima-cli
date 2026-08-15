// vima render-journal —— 过程轨迹视图（A36；契约 §11.1）
//
// 流程：loadLifecycle + loadTasks + collectReports + trace.json → 动态 import 模板渲染器
//       → atomicWriteFile 到 .vima/reports/journal.html。
//
// 与 render-review/prototype 的三点刻意不同（契约 §11.1 决策表 D-A36-01）：
//   1. 产物落 .vima/reports/（随 _gitignore 忽略），不落 docs/review/——数据源本就不进版本控制；
//   2. 含时间戳，但全部取自输入文件已落盘的字段，本命令与渲染器均不读系统时钟；
//   3. **不提供 --check、不进 doctor 的 render-drift 体检**——过程数据每推进一个任务就变，
//      漂移机检会恒红。与 D-A33-01（运行态不入受 A12 新鲜度机检管辖的产物）同源同向。
//
// 只读不批：本命令不写回 lifecycle 任何 checklist 键（写回会给它不该有的闸门语义）。
import path from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { EXIT, VimaError, usageFromParseArgs, precondition } from '../util/errors.mjs';
import { atomicWriteFile } from '../util/fs.mjs';
import { loadTasks } from '../model/tasks.mjs';
import { loadLifecycle } from '../model/lifecycle.mjs';
import { loadTemplate, readProjectTemplateId } from '../model/template.mjs';
import {
  collectReports, phaseDurations, readJsonSafe, V_INT_RULES, loadJournal, journalMetrics,
} from '../model/journal.mjs';

// 产物路径固定，**不提供 --output**：本视图是随数据源一并被 gitignore 的本地产物，
// 允许改写落点等于给「把每次都变的产物写进版本控制」开了口子——正是 D-A36-01 第 1 行要防的。
const OUTPUT_REL = '.vima/reports/journal.html';
const TRACE_REL = '.vima/reports/trace.json';

/** 任务切片：过程视图**刻意包含**运行态（status/retryCount/updatedAt）——见文件头第 3 条。 */
async function loadTaskSlice(root) {
  let tasks;
  try {
    tasks = await loadTasks(root);
  } catch {
    return null; // 缺失或不可解析 → 视图如实标注不可用，不臆测
  }
  return tasks.map((t) => ({
    id: t.id,
    title: t.fm.title ?? null,
    layer: t.fm.layer ?? null,
    side: t.fm.side ?? null,
    status: t.fm.status ?? null,
    retryCount: t.fm.retryCount ?? 0,
    updatedAt: t.fm.updatedAt ?? null,
  }));
}

/** 构建渲染模型（run 的唯一实现，无 --check 分支故无第二处调用者）。 */
async function buildModel(root, ctx) {
  const templateId = await readProjectTemplateId(root);
  if (!templateId) {
    throw precondition('NO_TEMPLATE_ID', '未能确定项目模板（.vima/manifest.json 与 docs/lifecycle.json 均无 templateId）', '.vima/manifest.json');
  }
  const tpl = await loadTemplate(ctx.cliRoot, templateId);
  const rel = tpl.planning?.renderers?.journal;
  if (!rel) {
    throw precondition('NO_RENDERER', `模板 "${templateId}" 未声明过程轨迹渲染器（planning.renderers.journal）`, `templates/${templateId}/template.json`);
  }
  const mod = await import(pathToFileURL(path.join(tpl.dir, rel)).href);
  if (typeof mod.renderJournal !== 'function') {
    throw new VimaError('BAD_RENDERER', '渲染器缺少 renderJournal 导出', { path: rel });
  }

  let lifecycle = null;
  try {
    lifecycle = await loadLifecycle(root);
  } catch {
    lifecycle = null; // 过程视图不该因缺 lifecycle 失败：阶段区如实标注缺席
  }

  return {
    render: mod.renderJournal,
    model: {
      projectName: path.basename(root),
      phases: phaseDurations(lifecycle),
      tasks: await loadTaskSlice(root),
      agg: await collectReports(root),
      trace: await readJsonSafe(path.join(root, TRACE_REL)),
      vIntRules: V_INT_RULES,
      // A35 W3：过程轨迹。未落地/未开启/换 clone → 空数组，视图如实标注缺席。
      journal: await loadJournal(root),
      journalMetrics: journalMetrics(await loadJournal(root)),
    },
  };
}

/** vima render-journal（不接任何选项） */
export async function run(argv, ctx) {
  try {
    // 刻意不接 --check（过程数据每次推进都变，漂移机检必恒红）与 --output（见 OUTPUT_REL）。
    // parseArgs 对未声明的 flag 抛错 → usage exit 3，不静默忽略。
    parseArgs({ args: argv, options: {}, allowPositionals: false });
  } catch (err) {
    throw usageFromParseArgs(err);
  }

  const root = ctx.cwd;
  const { render, model } = await buildModel(root, ctx);
  await atomicWriteFile(path.join(root, OUTPUT_REL), render(model));

  const t = model.tasks;
  const done = t ? t.filter((x) => x.status === 'done').length : 0;
  process.stdout.write(
    `✅ 过程轨迹视图已生成: ${OUTPUT_REL}\n`
    + `   任务 ${done}/${t ? t.length : 0} done │ 重试 ${t ? t.filter((x) => (x.retryCount ?? 0) > 0).length : 0}`
    + ` │ 未过点位 ${model.agg.verification.failedPoints} │ 收口未决 ${model.agg.convergence.openPoints}`
    + ` │ 运行时错误 ${model.agg.runtime.errors}\n`
    + '   本视图不做漂移机检（过程数据每次推进都变），过程推进后重新运行本命令刷新。\n',
  );
  return EXIT.OK;
}
