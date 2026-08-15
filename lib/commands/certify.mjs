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
import { evaluateDesignVerification } from './design.mjs';
import { evaluateConvergence } from './converge.mjs';

const REPORT_REL = '.vima/reports/certify.json';
const CONVERGENCE_REL = '.vima/reports/convergence.json';
const DESIGN_VERIFY_REL = '.vima/reports/design-verify.json';
const NOT_APPLICABLE_VISUAL = '全页 D0 或 legacy 项目：A34 视觉轨道不适用，如实标注而非冒充已验收';
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

/**
 * 等级 2：implemented —— shared+business 全 done、done 的 business 任务有 Verifier 通过报告，
 * **且视觉与体验验收按报告矩阵齐全**（A34 D-A34-31）。
 *
 * 为什么视觉证据要进这一级而不是新开一级：A34 的立项前提就是 A5 诚实分级。
 * certify 若只采集任务与集成证据，就可能把「视觉与体验一次没跑」的项目评为 pipeline-green——
 * 那正是 A34 要治的「全绿但不能用」假成功，只是换到了认证报告里。
 * 「视觉」不构成独立交付阶段，它是 implemented 的一部分，故扩面而非加级（四级模型不动）。
 */
async function checkImplemented(root, tasks, ctx) {
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
  // A34：视觉与体验验收按报告矩阵齐全（D0=Semantic / D1=+Design / D2=+Experience，且未 stale）。
  // 汇总文件只是缓存证据，不是可信布尔值。复用 design 的唯一评估器重算现状，
  // 并要求缓存与重算结果完全一致，防止伪造或改稿后的过期 pass 被 certify 接受。
  const visual = await readDesignVerify(root, ctx);
  if (visual.applicable && !visual.pass) {
    missing.push(
      `视觉与体验验收未齐全（${DESIGN_VERIFY_REL}）：未覆盖 ${visual.uncovered} 项 / 过期 ${visual.stale} 项`
        + '——先跑 vima design verify 并补齐 D1/D2 页的 design/experience 报告',
    );
  }
  if (missing.length > 0) return { satisfied: false, evidence: [], missing };
  const evidence = [
    `docs/tasks/ shared+business 任务 ${impl.length} 个全部 done`,
    `business done 任务的 Verifier 报告全部 result=pass（.vima/reports/<taskId>-verifier.json）`,
  ];
  evidence.push(
    visual.applicable
      ? `视觉与体验验收按报告矩阵齐全且未过期（${DESIGN_VERIFY_REL}）`
      : `无 D1/D2 页面或未启用 A34 设计能力——视觉验收不适用（${NOT_APPLICABLE_VISUAL}）`,
  );
  return { satisfied: true, evidence, missing: [] };
}

/**
 * 读 design verify 汇总。报告缺失 ⇒ 若项目确有 D1/D2 页则视为未覆盖（不能靠「没跑」蒙混），
 * 否则不适用（纯 D0 项目不为视觉验收付成本）。
 */
async function readDesignVerify(root, ctx) {
  const current = await evaluateDesignVerification(root, ctx, { writeDependencies: false });
  const required = current.pages.some((p) => p.required.length > 0);
  if (!required) return { applicable: false, pass: true, uncovered: 0, stale: 0 };

  let cached = null;
  try {
    cached = JSON.parse(await readFile(path.join(root, DESIGN_VERIFY_REL), 'utf8'));
  } catch {
    cached = null;
  }
  const fresh = cached !== null && stableStringify(cached) === stableStringify(current);
  return {
    applicable: true,
    pass: current.pass === true && fresh,
    uncovered: cached === null ? '（报告缺失）' : current.uncovered.length,
    stale: current.stale.length + (fresh ? 0 : 1),
  };
}

/**
 * 等级 3：converged —— 集成对账零 error / 零未过点位，**且磁盘报告与当前重算逐字节一致**。
 *
 * 与本级同文件的 checkImplemented 对视觉证据的做法同口径（A34 D-A34-31）：
 * 汇总文件只是**缓存证据**，不是可信布尔值。只采信磁盘上的旧 convergence.json，
 * 会把「报告生成之后又改了 spec/契约/任务/代码」的项目认证为已收敛——
 * 那正是 A32 立项要治的「全绿但不能用」假成功，只是换到了认证报告里。
 * 故复用 converge 的唯一评估器重算现状，并要求缓存与重算一致。
 */
async function checkConverged(root, ctx) {
  const abs = path.join(root, CONVERGENCE_REL);
  let text;
  try {
    text = await readFile(abs, 'utf8');
  } catch {
    return { satisfied: false, evidence: [], missing: [`未生成 ${CONVERGENCE_REL}（先跑 vima converge）`] };
  }
  let cached;
  try {
    cached = JSON.parse(text);
  } catch {
    return { satisfied: false, evidence: [], missing: [`${CONVERGENCE_REL} 不可解析（重跑 vima converge）`] };
  }

  // 重算现状。评估器抛错（任务/契约损坏等）不让 certify 崩——certify exit 恒 0，如实报缺。
  let current;
  try {
    current = await evaluateConvergence(root, { cliRoot: ctx.cliRoot });
  } catch (err) {
    if (!(err instanceof VimaError)) throw err;
    return { satisfied: false, evidence: [], missing: [`无法重算集成对账（${err.code}：${err.message}）——修好后重跑 vima converge`] };
  }

  const errors = current.summary?.errors ?? null;
  const openPoints = current.summary?.openPoints ?? null;
  if (errors !== 0 || openPoints !== 0) {
    return {
      satisfied: false,
      evidence: [],
      missing: [`集成对账未过：errors=${errors ?? '?'} openPoints=${openPoints ?? '?'}（vima converge 后按 byTask 回修）`],
    };
  }
  if (stableStringify(cached) !== stableStringify(current)) {
    return {
      satisfied: false,
      evidence: [],
      missing: [
        `${CONVERGENCE_REL} 已过期：与当前 spec/契约/任务/代码的重算结果不一致`
          + '——报告生成之后项目又变了，重跑 vima converge 再认证',
      ],
    };
  }
  return {
    satisfied: true,
    evidence: [`${CONVERGENCE_REL} summary.errors=0 openPoints=0，且与当前重算逐字节一致 (sha256 ${sha256(text)})`],
    missing: [],
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
    { level: 'implemented', ...(await checkImplemented(root, tasks, ctx)) },
    { level: 'converged', ...(await checkConverged(root, ctx)) },
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
