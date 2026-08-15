// vima plan —— 从任务 frontmatter 拓扑生成批次计划（internal-contracts §9，设计 §19.9 / §9.6）
// 只读命令（报告文件除外）：不修改任何任务/lifecycle 状态。
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadTasks } from '../model/tasks.mjs';
import { atomicWriteFile, fileExists, stableStringify } from '../util/fs.mjs';
import { EXIT, checkFailed, precondition, usageFromParseArgs } from '../util/errors.mjs';

// A18：默认并行度 5 → 8，并由 --max-parallel 可配（原 5 与现 8 同为取值判断，故给配置入口）
export const DEFAULT_MAX_PARALLEL = 8;
export const PARALLEL_RANGE = [1, 10];
const REPORT_REL = '.vima/reports/batch-plan.json';

/**
 * 核心批次算法（纯函数，sync 复用；internal-contracts §9）：
 *   1. dependsOn 指向不存在的任务 → VimaError(exit 2)；conflictsWith 同（PLAN_CONFLICT，A8）
 *   2. 全图 DFS 环检测 → 发现环抛错，message 含环路径（a → b → a）
 *   3. shared 任务按拓扑序，每任务单独一个 serial 批（level = 组内拓扑序号）
 *   4. business 任务按 dependsOn 拓扑分层（只算 business 间依赖，shared 视为已满足）；
 *      层内按 id 排序做贪心首适应切批：容量 ≤ maxParallel 且批内任务互不 conflictsWith（A8）；
 *      同层切出的全部子批 level 相同（A18：同 level ⇒ 批间无依赖 ⇒ 主 Agent 可流水线化派发）
 *   5. pipeline 任务按拓扑序放末尾，每任务一个 serial 批（level = 组内拓扑序号）
 *   6. 批内任务按 id 排序；批次 index 连续编号
 * @param {Array<{id: string, fm: object}>} tasks loadTasks 的结果
 * @param {number} [maxParallel] 批内并行度上限（缺省 DEFAULT_MAX_PARALLEL）
 * @returns {Array<{index: number, layer: string, level: number, mode: string, tasks: string[]}>}
 */
export function computeBatches(tasks, maxParallel = DEFAULT_MAX_PARALLEL) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const layerRank = { shared: 0, business: 1, pipeline: 2 };

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

  // 固定执行层序只能承接同层或前层依赖；逆层依赖若不拒绝，会被后续组内拓扑静默当成已满足。
  const backwards = [];
  for (const t of tasks) {
    for (const dep of t.fm.dependsOn) {
      if (layerRank[byId.get(dep).fm.layer] > layerRank[t.fm.layer]) {
        backwards.push(`${t.id}(${t.fm.layer}) → ${dep}(${byId.get(dep).fm.layer})`);
      }
    }
  }
  if (backwards.length > 0) {
    throw checkFailed('PLAN_LAYER_DEP', `dependsOn 违反 shared → business → pipeline 层序: ${backwards.sort().join('，')}`);
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
  const push = (layer, level, mode, ids) => {
    batches.push({ index: batches.length, layer, level, mode, tasks: [...ids].sort() });
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

  // 3) shared：拓扑序，每任务一个 serial 批（level 各不相同 ⇒ 天然不参与流水线化）
  {
    let lv = 0;
    for (const id of topoOrder(ofLayer('shared'))) push('shared', lv++, 'serial', [id]);
  }

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
      // 层内切批（贪心首适应，确定性）：容量 ≤ maxParallel 且批内互不冲突（conflictsWith，A8）
      const buckets = [];
      for (const id of ids) {
        const fit = buckets.find(
          (bucket) => bucket.length < maxParallel && bucket.every((member) => !conflicts(id, member)),
        );
        if (fit) fit.push(id);
        else buckets.push([id]);
      }
      // 同一拓扑层切出的子批共享同一 level（A18 流水线化判据）
      for (const bucket of buckets) push('business', lv, 'parallel', bucket);
    }
  }

  // 5) pipeline：拓扑序放末尾，每任务一个 serial 批
  {
    let lv = 0;
    for (const id of topoOrder(ofLayer('pipeline'))) push('pipeline', lv++, 'serial', [id]);
  }

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
      options: {
        json: { type: 'boolean', default: false },
        'max-parallel': { type: 'string' }, // A18：整数 1–10，缺省 DEFAULT_MAX_PARALLEL
      },
      allowPositionals: false,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }

  // A18：并行度取值校验（越界/非整数 → PLAN_PARALLEL exit 2，契约 §3.1/§9 步骤 7）
  let maxParallel = DEFAULT_MAX_PARALLEL;
  if (values['max-parallel'] !== undefined) {
    const raw = values['max-parallel'];
    const n = Number(raw);
    if (!Number.isInteger(n) || n < PARALLEL_RANGE[0] || n > PARALLEL_RANGE[1]) {
      throw checkFailed(
        'PLAN_PARALLEL',
        `--max-parallel "${raw}" 不合法（须为 ${PARALLEL_RANGE[0]}–${PARALLEL_RANGE[1]} 的整数）`,
      );
    }
    maxParallel = n;
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
  const batches = computeBatches(tasks, maxParallel); // 缺依赖/成环 → 抛 exit 2，环路径随错误消息进 stderr
  const report = {
    schemaVersion: '1',
    batches,
    maxParallel,
    stats: countStats(tasks),
  };

  if (values.json) {
    // --json：批次计划只输出到 stdout（设计 §19.9「默认写文件」），不落盘
    process.stdout.write(stableStringify(report));
    return EXIT.OK;
  }

  await atomicWriteFile(path.join(root, REPORT_REL), stableStringify(report));

  const lines = [`📋 批次计划：${batches.length} 个批次 / ${tasks.length} 个任务（单批并行度 ≤${maxParallel}）`];
  for (const b of batches) {
    lines.push(
      `📦 批次 ${b.index} [${b.mode === 'parallel' ? '并行' : '串行'}] (${b.layer} L${b.level}): ${b.tasks.join('、')}`,
    );
  }
  // A18：同 layer 同 level 的多个批之间无依赖，可流水线化派发（go.md 步骤 3 消费）
  const pipelinable = new Map();
  for (const b of batches) {
    const key = `${b.layer}:${b.level}`;
    pipelinable.set(key, (pipelinable.get(key) ?? 0) + 1);
  }
  const groups = [...pipelinable.values()].filter((n) => n > 1).length;
  if (groups > 0) {
    lines.push(`🔀 ${groups} 组同层子批之间无依赖，可流水线化派发（上批 Verifier 与下批 Builder 同轮）`);
  }
  lines.push(`📄 已写入 ${REPORT_REL}`);
  process.stdout.write(`${lines.join('\n')}\n`);
  return EXIT.OK;
}
