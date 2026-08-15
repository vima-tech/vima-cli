// vima approve —— 用户评审的机械确认（设计 §19.10 / §13.1 第三道闸门的落痕动作）
//
// 两种口径（A34 D-A34-28/29 阶段推进事件表）：
//   `vima approve --planning`  PLANNING → DESIGNING
//     用**独立校验 profile**：spec/契约/权限/pendingConfirm + V-DSN-10/11/12，
//     **暂不要求 V-TASK-* 与 V-COV-01**——DESIGNING 期任务尚未拆解，跑完整 validate
//     必然报错（V-COV-01 要求 coverage-matrix.md 无空格无 TODO，而它由任务生成），
//     PLANNING 就永远过不去。同时建立 DESIGNING 基线快照供受控回写环用。
//   `vima approve`（无参）        DESIGNING → DEVELOPING
//     完整前置链：validate 全绿 → 评审载体新鲜 → pendingConfirm 清零
//     → **`vima design check` 的六项派生全绿**（设计未完成不得开工）。
import { parseArgs } from 'node:util';
import { EXIT, usageFromParseArgs, precondition } from '../util/errors.mjs';
import { loadTasks } from '../model/tasks.mjs';
import { loadLifecycle, saveLifecycle, hasA34DesignScope } from '../model/lifecycle.mjs';
import { validateProject } from './validate.mjs';
import { checkReviewFresh } from './render-review.mjs';
import { checkPrototypeFresh } from './render-prototype.mjs';
import { ensureDesigningBaseline, designGateStates } from './design.mjs';

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

/** PLANNING → DESIGNING：独立 profile + 基线快照（D-A34-29）。 */
async function runPlanning(root, ctx, out, fail) {
  const lifecycle = await loadLifecycle(root);
  if (lifecycle.currentPhase !== 'PLANNING') {
    throw precondition(
      'PHASE_TRANSITION',
      `approve --planning 只允许 PLANNING → DESIGNING；当前为 ${lifecycle.currentPhase ?? '（缺失）'}`,
      'docs/lifecycle.json',
    );
  }
  const result = await validateProject(root, { cliRoot: ctx.cliRoot, profile: 'planning-brief' });
  if (result.errors.length > 0) {
    fail('❌ 前置未满足：PLANNING profile 校验未通过（spec / 契约 / 权限 / 设计声明），先修复：');
    for (const e of result.errors) fail(`  ${e.rule}: ${e.message} (${e.path})`);
    fail('（planning-brief 执行规格/契约自身规则及指定 V-DSN；V-CON-03 任务承接关系与任务、覆盖、代码规则延后。）');
    return EXIT.PRECONDITION;
  }
  if (result.pendingConfirm.length > 0) {
    fail('❌ 前置未满足：存在未确认的 pendingConfirm 推断项，请逐项与用户确认后清除标记：');
    for (const p of result.pendingConfirm) fail(`  ${p.where} (${p.path})`);
    return EXIT.PRECONDITION;
  }

  const baselineRel = await ensureDesigningBaseline(root);
  lifecycle.currentPhase = 'DESIGNING';
  lifecycle.phaseHistory ??= [];
  const last = lifecycle.phaseHistory.at(-1);
  if (last && last.phase === 'PLANNING' && last.completedAt === null) last.completedAt = new Date().toISOString();
  if (!lifecycle.phaseHistory.some((h) => h.phase === 'DESIGNING' && h.completedAt === null)) {
    lifecycle.phaseHistory.push({
      phase: 'DESIGNING', enteredAt: new Date().toISOString(), completedAt: null, note: '进入设计期（A0 发散 → 选型 → 反向提炼 → 逐页稿）',
    });
  }
  lifecycle.checklists ??= {};
  lifecycle.checklists.DESIGNING ??= { briefReady: false, directionsExplored: false };
  await saveLifecycle(root, lifecycle);

  out('✅ 结构评审通过，已进入 DESIGNING');
  out(`   基线快照：${baselineRel}（受控回写环 vima design reconcile 的比较基准）`);
  out('   下一步：出 Design Brief → Stage A0 三方向发散（按端各一张标志性页面）→ 用户选型');
  return EXIT.OK;
}

/** vima approve [--planning] */
export async function run(argv, ctx) {
  let values;
  try {
    ({ values } = parseArgs({ args: argv, options: { planning: { type: 'boolean', default: false } }, allowPositionals: false }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }
  const root = ctx.cwd;
  const out = (s) => process.stdout.write(`${s}\n`);
  const fail = (s) => process.stderr.write(`${s}\n`); // ❌ 前置未满足块走 stderr（契约 §3 输出流向）

  if (values.planning) return runPlanning(root, ctx, out, fail);

  const lifecycle = await loadLifecycle(root); // 缺 lifecycle → NO_LIFECYCLE exit 4
  const designScoped = hasA34DesignScope(lifecycle);
  if (designScoped && lifecycle.currentPhase === 'PLANNING'
    && lifecycle.checklists?.PLANNING?.tasksApproved !== true) {
    throw precondition(
      'PHASE_TRANSITION',
      'A34 项目必须先运行 vima approve --planning 进入 DESIGNING，不能从 PLANNING 直接批准开工',
      'docs/lifecycle.json',
    );
  }

  // ── 前置 1：机械校验必须通过（A16：cliRoot 供端册 kinds 解析，缺了会误用回退词表）──
  const result = await validateProject(root, { cliRoot: ctx.cliRoot });
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

  // ── 前置 4（A34 D-A34-28）：设计闸门六项派生必须全绿，设计未完成不得开工。 ──
  // legacy 项目整体豁免——A19 存量可达性：已交付项目不因新增阶段而被挡住。
  if (designScoped) {
    const gate = await designGateStates(root, ctx);
    const bad = Object.entries(gate.derived).filter(([, ok]) => ok === false).map(([k]) => k);
    if (bad.length > 0) {
      fail('❌ 前置未满足：设计闸门未全绿（vima design check 的派生状态）：');
      for (const k of bad) fail(`  ${k} = false`);
      for (const f of gate.artifactFindings) fail(`  ${f.rule}: ${f.message} (${f.path})`);
      for (const f of gate.directionFindings) fail(`  ${f.rule}: ${f.message} (${f.path})`);
      for (const s of gate.staleApprovals) fail(`  批准已失效：${s.page} —— ${s.reason}`);
      for (const m of gate.stageAMissing) fail(`  Stage A 产物缺失：${m}`);
      fail('请跑 vima design check 查看详情；D1/D2 页缺稿或批准过期时不得进入 DEVELOPING。');
      return EXIT.PRECONDITION;
    }
    // 恒不阻断（D-A34-03：首次裁定人可选任意级别），但必须在批准这一刻如实呈报。
    // 否则「全项目声明 D0 → d0Only 确定性跳过发散轮 → 闸门全绿」就是一条
    // 无人看得见的降级通道，等同 A34 立项要治的 G2 换了个壳（契约 §6.20）。
    if (gate.fidelitySuggestions.length > 0) {
      out(`⚠️ ${gate.fidelitySuggestions.length} 页的声明保真级低于/不同于 spec 判据建议（不阻断，由你裁定）：`);
      for (const s of gate.fidelitySuggestions) {
        out(`   ${s.id} 声明 ${s.declared}，按判据建议 ${s.suggested}`);
      }
      out('   若确属标准 CRUD，照此批准即可；若是因设计通道不可用而降级，请记入完成报告。');
    }
  }

  // ── 通过：任务汇总表 → 写 lifecycle 留痕 ──
  const tasks = await loadTasks(root);
  out('任务汇总表（最后核对一遍，approve 即定稿）：');
  out(renderTaskTable(tasks));

  lifecycle.checklists ??= {};
  lifecycle.checklists.PLANNING ??= {};
  lifecycle.checklists.PLANNING.tasksApproved = true;
  // approve 属记录真实时间戳的例外命令（契约 §3）
  lifecycle.checklists.PLANNING.tasksApprovedAt = new Date().toISOString();

  const entersDeveloping = (designScoped && lifecycle.currentPhase === 'DESIGNING')
    || (!designScoped && lifecycle.currentPhase === 'PLANNING');
  if (entersDeveloping) {
    const now = new Date().toISOString();
    const openCurrent = [...(lifecycle.phaseHistory ?? [])].reverse()
      .find((h) => h.phase === lifecycle.currentPhase && h.completedAt === null);
    if (openCurrent) openCurrent.completedAt = now;
    lifecycle.currentPhase = 'DEVELOPING';
    lifecycle.phaseHistory ??= [];
    if (!lifecycle.phaseHistory.some((h) => h.phase === 'DEVELOPING' && h.completedAt === null)) {
      lifecycle.phaseHistory.push({
        phase: 'DEVELOPING', enteredAt: now, completedAt: null,
        note: designScoped ? '设计冻结、任务批准完成，进入实现期' : 'legacy 项目任务批准完成，进入实现期',
      });
    }
  }
  await saveLifecycle(root, lifecycle);

  out(`✅ 评审确认已留痕（tasksApproved = true）${lifecycle.currentPhase === 'DEVELOPING' ? '，已进入 DEVELOPING' : ''}，可以 /go`);
  return EXIT.OK;
}
