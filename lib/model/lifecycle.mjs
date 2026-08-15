// 生命周期模型：docs/lifecycle.json 读写与默认结构（internal-contracts §5 / §6.2，设计 §14.2）
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { VimaError, precondition } from '../util/errors.mjs';
import { atomicWriteFile, stableStringify } from '../util/fs.mjs';

const LIFECYCLE_REL = 'docs/lifecycle.json';

/**
 * 阶段序列（A34 D-A34-13：PLANNING 与 DEVELOPING 之间插入 DESIGNING）。
 * 单一真源——doctor 的阶段一致性体检、/go 的阶段分派、approve 的推进目标都取自这里，
 * 免得「加了阶段但某个消费方还按旧序判定」产生状态机分叉。
 */
export const PHASES = ['BOOTSTRAP', 'PLANNING', 'DESIGNING', 'DEVELOPING', 'MAINTAINING'];

/**
 * DESIGNING 的**持久化** checklist 键（A34 D-A34-10）。
 * 只有这两个是人工里程碑、无从推导，故落盘；
 * directionApproved / signaturePagesApproved / fidelityClassified / designArtifactsComplete
 * / designApprovalFresh / designSystemFrozen 六项**一律不落盘**，由 `vima design status`
 * 每次从 spec、设计目录 manifest、designApproval 摘要确定性派生——
 * 落盘就会与 designApproval 表达同一事实，退回本增补项自己要治的双真源。
 */
export const DESIGNING_PERSISTED_KEYS = ['briefReady', 'directionsExplored'];

/**
 * 默认 lifecycle 结构（§14.2）：currentPhase=PLANNING，
 * phaseHistory 含 BOOTSTRAP 与 PLANNING 两条（enteredAt/completedAt 由调用方填真实时间）。
 * A34 增三个**加性**键：DESIGNING checklist / designApproval / designCapability——
 * 存量 lifecycle 缺这三键时按 legacy 处理（D-A34-18：存量不倒退阶段、不强制回炉）。
 */
export function defaultLifecycle(templateId) {
  return {
    schemaVersion: '2.0',
    vimaVersion: '3.1.2', // 与 package.json version 同步（f.model 测试锁定；init 写入时以 readCliVersion 覆盖）
    templateId,
    currentPhase: 'PLANNING',
    // A34：新建项目具备 Design-First 能力；pre-A34 项目为 'legacy'（V-DSN-12 据此豁免）
    designCapability: 'a34',
    phaseHistory: [
      { phase: 'BOOTSTRAP', enteredAt: null, completedAt: null, note: 'vima init 完成' },
      { phase: 'PLANNING', enteredAt: null, completedAt: null, note: '开始需求梳理' },
    ],
    checklists: {
      PLANNING: {
        rawDocsCollected: false,
        modulesConfirmed: false,
        specGenerated: false,
        contractsGenerated: false,
        tasksDecomposed: false,
        artifactsValidated: false,
        reviewRendered: false,
        prototypeRendered: false,
        tasksApproved: false,
      },
      DESIGNING: {
        briefReady: false,
        directionsExplored: false,
      },
      DEVELOPING: {
        sharedLayerDone: false,
        businessTasksDone: false,
        pipelineDone: false,
        testsPassed: false,
        codeAudited: false,
      },
    },
    // A34 D-A34-12：批准 = 时间戳 + 内容摘要，唯一持久化批准状态。
    // 按端存 directions（A0 已改按端发散，多端各选方向时单键表达不了），按页存 pages。
    designApproval: { directions: {}, pages: {} },
    // legacy 项目经 vima change 新增/修改页面时，只让受影响页进入 A34，不强迫整项目回炉。
    designScope: { pages: [] },
    taskStats: { total: 0, done: 0, failed: 0, blocked: 0, updatedAt: null },
  };
}

/**
 * 读取 designCapability，缺失按 'legacy'（存量项目不因新增字段而变红）。
 * @param {object|null} lc
 * @returns {'a34'|'legacy'}
 */
export function designCapabilityOf(lc) {
  return lc?.designCapability === 'a34' ? 'a34' : 'legacy';
}

/** legacy 项目局部启用 A34 的页面集合；新建 a34 项目由 capability 覆盖全部页。 */
export function designScopePagesOf(lc) {
  const pages = lc?.designScope?.pages;
  return Array.isArray(pages)
    ? [...new Set(pages.filter((x) => typeof x === 'string' && x !== ''))].sort()
    : [];
}

/** 当前项目是否存在必须执行的 A34 设计轨道。 */
export function hasA34DesignScope(lc) {
  return designCapabilityOf(lc) === 'a34' || designScopePagesOf(lc).length > 0;
}

/**
 * 取 designApproval，缺失补空壳——调用方无需到处写 ?? {}。
 * @param {object|null} lc
 * @returns {{directions: Record<string, object>, pages: Record<string, object>}}
 */
export function designApprovalOf(lc) {
  const a = lc?.designApproval;
  return {
    directions: (a && typeof a.directions === 'object' && a.directions) || {},
    pages: (a && typeof a.pages === 'object' && a.pages) || {},
  };
}

/**
 * 读取 docs/lifecycle.json。
 * @throws VimaError('NO_LIFECYCLE', exitCode 4) 文件缺失
 */
export async function loadLifecycle(root) {
  const p = path.join(root, LIFECYCLE_REL);
  let text;
  try {
    text = await readFile(p, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw precondition('NO_LIFECYCLE', '未找到 docs/lifecycle.json（请先运行 vima init）', LIFECYCLE_REL);
    }
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new VimaError('LIFECYCLE_PARSE', `lifecycle.json 解析失败: ${err.message}`, { path: LIFECYCLE_REL });
  }
}

/** 写回 docs/lifecycle.json（stableStringify + 原子写）。 */
export async function saveLifecycle(root, obj) {
  await atomicWriteFile(path.join(root, LIFECYCLE_REL), stableStringify(obj));
}
