// vima certify —— 交付等级认证（A32；契约 §6.19）
// 只读证据聚合：四级阶梯（spec-approved → implemented → converged → pipeline-green），
// 每级判据全部取自磁盘既有真源；deliveryLevel = 自底向上连续满足的最高级。
// 灵魂是「显式非宣称」：deployable/stable 需要部署环境与运行期证据，vima 不采集、
// 也不认证——缺的等级如实说缺，不许用 pipeline-green 或「进入 MAINTAINING」冒充。
// exit 恒 0（评估不是闸门；闸门已有 approve / converge / /go 收口）。
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { EXIT, VimaError, usageFromParseArgs, precondition } from '../util/errors.mjs';
import { atomicWriteFile, stableStringify, fileExists, sha256 } from '../util/fs.mjs';
import { loadLifecycle } from '../model/lifecycle.mjs';
import { loadTasks } from '../model/tasks.mjs';
import { loadTemplate, readProjectTemplateId } from '../model/template.mjs';

const REPORT_REL = '.vima/reports/certify.json';
const CONVERGENCE_REL = '.vima/reports/convergence.json';
const NOT_CERTIFIED = 'deployable/stable 需要部署环境与运行期证据，vima 不采集、也不认证';

/** A5 模板成熟度（stable|preview）；模板未知/不可解析 → null（如实缺席，不猜）。 */
async function templateMaturityOf(root, cliRoot) {
  try {
    const templateId = await readProjectTemplateId(root);
    if (templateId === null) return null;
    return (await loadTemplate(cliRoot, templateId)).status ?? null;
  } catch (err) {
    if (err instanceof VimaError) return null;
    throw err;
  }
}

/** 等级 1：spec-approved —— approve 闸门已过。 */
function checkSpecApproved(lifecycle) {
  const planning = lifecycle.checklists?.PLANNING ?? {};
  if (planning.tasksApproved === true) {
    const at = typeof planning.tasksApprovedAt === 'string' ? `（tasksApprovedAt ${planning.tasksApprovedAt}）` : '';
    return { satisfied: true, evidence: [`docs/lifecycle.json checklists.PLANNING.tasksApproved=true${at}`], missing: [] };
  }
  return { satisfied: false, evidence: [], missing: ['任务评审未确认（vima approve 未通过）'] };
}

/** 等级 2：implemented —— shared+business 全 done 且 done 的 business 任务有 Verifier 通过报告。 */
async function checkImplemented(root, tasks) {
  const impl = tasks.filter((t) => t.fm.layer === 'shared' || t.fm.layer === 'business');
  if (impl.length === 0) {
    return { satisfied: false, evidence: [], missing: ['无任何 shared/business 任务（PLANNING 未拆解）'] };
  }
  const missing = [];
  const undone = impl.filter((t) => t.fm.status !== 'done').map((t) => t.id);
  if (undone.length > 0) {
    missing.push(`任务未 done：${undone.slice(0, 5).join('、')}${undone.length > 5 ? ' 等' : ''}（共 ${undone.length} 个）`);
  }
  const noPass = [];
  for (const t of impl.filter((x) => x.fm.layer === 'business' && x.fm.status === 'done')) {
    const rel = `.vima/reports/${t.id}-verifier.json`;
    let ok = false;
    try {
      const data = JSON.parse(await readFile(path.join(root, rel), 'utf8'));
      ok = data.result === 'pass';
    } catch {
      ok = false; // 缺失或损坏都算无通过证据
    }
    if (!ok) noPass.push(t.id);
  }
  if (noPass.length > 0) {
    missing.push(`缺 Verifier 通过报告（<taskId>-verifier.json result=pass）：${noPass.slice(0, 5).join('、')}${noPass.length > 5 ? ' 等' : ''}（共 ${noPass.length} 个）`);
  }
  if (missing.length > 0) return { satisfied: false, evidence: [], missing };
  return {
    satisfied: true,
    evidence: [
      `docs/tasks/ shared+business 任务 ${impl.length} 个全部 done`,
      `business done 任务的 Verifier 报告全部 result=pass（.vima/reports/<taskId>-verifier.json）`,
    ],
    missing: [],
  };
}

/** 等级 3：converged —— 集成对账报告存在且零 error / 零未过点位。 */
async function checkConverged(root) {
  const abs = path.join(root, CONVERGENCE_REL);
  let text;
  try {
    text = await readFile(abs, 'utf8');
  } catch {
    return { satisfied: false, evidence: [], missing: [`未生成 ${CONVERGENCE_REL}（先跑 vima converge）`] };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { satisfied: false, evidence: [], missing: [`${CONVERGENCE_REL} 不可解析（重跑 vima converge）`] };
  }
  const errors = data.summary?.errors ?? null;
  const openPoints = data.summary?.openPoints ?? null;
  if (errors === 0 && openPoints === 0) {
    return {
      satisfied: true,
      evidence: [`${CONVERGENCE_REL} summary.errors=0 openPoints=0 (sha256 ${sha256(text)})`],
      missing: [],
    };
  }
  return {
    satisfied: false,
    evidence: [],
    missing: [`集成对账未过：errors=${errors ?? '?'} openPoints=${openPoints ?? '?'}（vima converge 后按 byTask 回修）`],
  };
}

/** 等级 4：pipeline-green —— 收尾流水线存在且全部 done。 */
function checkPipelineGreen(tasks) {
  const pipeline = tasks.filter((t) => t.fm.layer === 'pipeline');
  if (pipeline.length === 0) {
    return { satisfied: false, evidence: [], missing: ['无 pipeline 任务（按 _template-full-test.md / _template-code-audit.md 补收尾流水线）'] };
  }
  const undone = pipeline.filter((t) => t.fm.status !== 'done').map((t) => t.id);
  if (undone.length > 0) {
    return { satisfied: false, evidence: [], missing: [`pipeline 任务未全部 done：${undone.join('、')}`] };
  }
  return { satisfied: true, evidence: [`pipeline 任务 ${pipeline.length} 个（${pipeline.map((t) => t.id).join('、')}）全部 done`], missing: [] };
}

/** vima certify [--json] */
export async function run(argv, ctx) {
  let opts;
  try {
    ({ values: opts } = parseArgs({
      args: argv,
      options: { json: { type: 'boolean' } },
      allowPositionals: false,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }

  const root = ctx.cwd;
  // 同 plan/converge/retro 守卫：非 vima 项目不产出空认证，不凭空创建 .vima/reports/
  if (!(await fileExists(path.join(root, 'docs', 'tasks')))) {
    throw precondition(
      'NO_TASKS',
      '未找到 docs/tasks/ 目录（非 vima 项目或 PLANNING 未产出任务），无可认证的交付物',
      'docs/tasks',
    );
  }
  const lifecycle = await loadLifecycle(root);
  const tasks = await loadTasks(root);

  const levels = [
    { level: 'spec-approved', ...checkSpecApproved(lifecycle) },
    { level: 'implemented', ...(await checkImplemented(root, tasks)) },
    { level: 'converged', ...(await checkConverged(root)) },
    { level: 'pipeline-green', ...checkPipelineGreen(tasks) },
  ];

  // deliveryLevel = 自底向上连续满足的最高级（跳级不算——高层证据建立在低层之上）
  let deliveryLevel = 'none';
  for (const l of levels) {
    if (!l.satisfied) break;
    deliveryLevel = l.level;
  }

  const report = {
    schemaVersion: '1',
    templateMaturity: await templateMaturityOf(root, ctx.cliRoot),
    deliveryLevel,
    notCertified: NOT_CERTIFIED,
    levels,
  };

  const text = stableStringify(report);
  await atomicWriteFile(path.join(root, REPORT_REL), text);

  if (opts.json) {
    process.stdout.write(text);
    return EXIT.OK;
  }

  const lines = [`🏅 交付等级：${deliveryLevel}（阶梯 spec-approved → implemented → converged → pipeline-green）`];
  for (const l of levels) {
    lines.push(`   ${l.satisfied ? '✅' : '❌'} ${l.level}`);
    for (const e of l.evidence) lines.push(`      证据：${e}`);
    for (const m of l.missing) lines.push(`      缺口：${m}`);
  }
  lines.push(
    `   模板成熟度：${report.templateMaturity ?? '（未知）'}（A5，说的是模板能力，不是本项目——模板 stable ≠ 项目 stable）`,
    `   ⚠️ ${NOT_CERTIFIED}——本报告的最高可认证等级是 pipeline-green，不宣称更高`,
    `   报告：${REPORT_REL}`,
  );
  process.stdout.write(`${lines.join('\n')}\n`);
  return EXIT.OK;
}
