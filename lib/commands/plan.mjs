// vima plan —— 从任务 frontmatter 拓扑生成批次计划（internal-contracts §9，设计 §19.9 / §9.6）
// 只读命令（报告文件除外）：不修改任何任务/lifecycle 状态。
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadTasks } from '../model/tasks.mjs';
import { atomicWriteFile, fileExists, stableStringify } from '../util/fs.mjs';
import { EXIT, checkFailed, precondition, usageFromParseArgs } from '../util/errors.mjs';

const MAX_PARALLEL = 5;
const REPORT_REL = '.vima/reports/batch-plan.json';

/**
 * 核心批次算法（纯函数，sync 复用；internal-contracts §9）：
 *   1. dependsOn 指向不存在的任务 → VimaError(exit 2)；conflictsWith 同（PLAN_CONFLICT，A8）
 *   2. 全图 DFS 环检测 → 发现环抛错，message 含环路径（a → b → a）
 *   3. shared 任务按拓扑序，每任务单独一个 serial 批
 *   4. business 任务按 dependsOn 拓扑分层（只算 business 间依赖，shared 视为已满足）；
 *      层内按 id 排序做贪心首适应切批：容量 ≤5 且批内任务互不 conflictsWith（A8）
 *   5. pipeline 任务按拓扑序放末尾，每任务一个 serial 批
 *   6. 批内任务按 id 排序；批次 index 连续编号
 * @param {Array<{id: string, fm: object}>} tasks loadTasks 的结果
 * @returns {Array<{index: number, layer: string, mode: string, tasks: string[]}>}
 */
export function computeBatches(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));

  // 1) dependsOn 引用闭包检查（V-TASK-04 同源）
  const missing = [];
  for (const t of tasks) {
    for (const dep of t.fm.dependsOn) {
      if (!byId.has(dep)) missing.push(`${t.id} → ${dep}`);
    }
  }
  if (missing.length > 0) {
    throw checkFailed('PLAN_DEP', `dependsOn 指向不存在的任务: ${missing.sort().join('，')}`);
  }

  // 1b) conflictsWith 引用检查 + 对称冲突集（A8：声明式冲突 → 同层不同批）
  const conflictPairs = new Set(); // "a|b" 与 "b|a" 双向登记
  {
    const badRefs = [];
    for (const t of tasks) {
      for (const other of t.fm.conflictsWith ?? []) {
        if (!byId.has(other)) {
          badRefs.push(`${t.id} → ${other}`);
        } else {
          conflictPairs.add(`${t.id}|${other}`);
          conflictPairs.add(`${other}|${t.id}`);
        }
      }
    }
    if (badRefs.length > 0) {
      throw checkFailed('PLAN_CONFLICT', `conflictsWith 指向不存在的任务: ${badRefs.sort().join('，')}`);
    }
  }
  const conflicts = (a, b) => conflictPairs.has(`${a}|${b}`);

  // 2) 全图 DFS 环检测（0/undefined=白 1=灰 2=黑；按 id 排序保证确定性）
  {
    const color = new Map();
    const dfs = (id, stack) => {
      color.set(id, 1);
      stack.push(id);
      for (const dep of byId.get(id).fm.dependsOn) {
        if (color.get(dep) === 1) {
          const cycle = [...stack.slice(stack.indexOf(dep)), dep];
          throw checkFailed('PLAN_CYCLE', `依赖成环: ${cycle.join(' → ')}`);
        }
        if (!color.get(dep)) dfs(dep, stack);
      }
      stack.pop();
      color.set(id, 2);
    };
    for (const id of [...byId.keys()].sort()) {
      if (!color.get(id)) dfs(id, []);
    }
  }

  const ofLayer = (layer) => tasks.filter((t) => t.fm.layer === layer);
  const batches = [];
  const push = (layer, mode, ids) => {
    batches.push({ index: batches.length, layer, mode, tasks: [...ids].sort() });
  };

  // 组内确定性拓扑序（Kahn 变体）：只看组内依赖，组外依赖视为已满足；每轮就绪集按 id 排序
  const topoOrder = (group) => {
    const inGroup = new Set(group.map((t) => t.id));
    const remaining = new Set(inGroup);
    const order = [];
    while (remaining.size > 0) {
      const ready = [...remaining]
        .filter((id) => byId.get(id).fm.dependsOn.every((d) => !inGroup.has(d) || !remaining.has(d)))
        .sort();
      // 环已在全图检测中排除，此处 ready 必非空
      for (const id of ready) {
        order.push(id);
        remaining.delete(id);
      }
    }
    return order;
  };

  // 3) shared：拓扑序，每任务一个 serial 批
  for (const id of topoOrder(ofLayer('shared'))) push('shared', 'serial', [id]);

  // 4) business：按 dependsOn 拓扑分层（只算 business 间依赖），每层 parallel，层内 >5 切子批
  {
    const business = ofLayer('business');
    const inBusiness = new Set(business.map((t) => t.id));
    const levelMemo = new Map();
    const levelOf = (id) => {
      if (levelMemo.has(id)) return levelMemo.get(id);
      let lv = 0;
      for (const dep of byId.get(id).fm.dependsOn) {
        if (inBusiness.has(dep)) lv = Math.max(lv, levelOf(dep) + 1);
      }
      levelMemo.set(id, lv);
      return lv;
    };
    const byLevel = new Map();
    for (const t of business) {
      const lv = levelOf(t.id);
      if (!byLevel.has(lv)) byLevel.set(lv, []);
      byLevel.get(lv).push(t.id);
    }
    for (const lv of [...byLevel.keys()].sort((a, b) => a - b)) {
      const ids = byLevel.get(lv).sort();
      // 层内切批（贪心首适应，确定性）：容量 ≤5 且批内互不冲突（conflictsWith，A8）
      const buckets = [];
      for (const id of ids) {
        const fit = buckets.find(
          (bucket) => bucket.length < MAX_PARALLEL && bucket.every((member) => !conflicts(id, member)),
        );
        if (fit) fit.push(id);
        else buckets.push([id]);
      }
      for (const bucket of buckets) push('business', 'parallel', bucket);
    }
  }

  // 5) pipeline：拓扑序放末尾，每任务一个 serial 批
  for (const id of topoOrder(ofLayer('pipeline'))) push('pipeline', 'serial', [id]);

  return batches;
}

/** 状态计数（batch-plan.json 的 stats 字段，internal-contracts §6.5）。 */
function countStats(tasks) {
  const stats = { total: tasks.length, pending: 0, done: 0, failed: 0, blocked: 0, running: 0 };
  for (const t of tasks) stats[t.fm.status] += 1;
  return stats;
}

export async function run(argv, ctx) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { json: { type: 'boolean', default: false } },
      allowPositionals: true,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }

  const root = ctx.cwd;
  // 契约 §9 步骤 0：docs/tasks/ 不存在 → exit 4（防在非 vima 项目静默产出空计划并凭空写报告）
  if (!(await fileExists(path.join(root, 'docs', 'tasks')))) {
    throw precondition(
      'NO_TASKS',
      '未找到 docs/tasks/ 目录（非 vima 项目或 PLANNING 未产出任务），不生成批次计划',
      'docs/tasks',
    );
  }
  const tasks = await loadTasks(root);
  const batches = computeBatches(tasks); // 缺依赖/成环 → 抛 exit 2，环路径随错误消息进 stderr
  const report = {
    schemaVersion: '1',
    batches,
    maxParallel: MAX_PARALLEL,
    stats: countStats(tasks),
  };

  if (values.json) {
    // --json：批次计划只输出到 stdout（设计 §19.9「默认写文件」），不落盘
    process.stdout.write(stableStringify(report));
    return EXIT.OK;
  }

  await atomicWriteFile(path.join(root, REPORT_REL), stableStringify(report));

  const lines = [`📋 批次计划：${batches.length} 个批次 / ${tasks.length} 个任务（单批并行度 ≤${MAX_PARALLEL}）`];
  for (const b of batches) {
    lines.push(`📦 批次 ${b.index} [${b.mode === 'parallel' ? '并行' : '串行'}] (${b.layer}): ${b.tasks.join('、')}`);
  }
  lines.push(`📄 已写入 ${REPORT_REL}`);
  process.stdout.write(`${lines.join('\n')}\n`);
  return EXIT.OK;
}
