// 生命周期模型：docs/lifecycle.json 读写与默认结构（internal-contracts §5 / §6.2，设计 §14.2）
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { VimaError, precondition } from '../util/errors.mjs';
import { atomicWriteFile, stableStringify } from '../util/fs.mjs';

const LIFECYCLE_REL = 'docs/lifecycle.json';

/**
 * 默认 lifecycle 结构（§14.2）：currentPhase=PLANNING，
 * phaseHistory 含 BOOTSTRAP 与 PLANNING 两条（enteredAt/completedAt 由调用方填真实时间）。
 */
export function defaultLifecycle(templateId) {
  return {
    schemaVersion: '2.0',
    vimaVersion: '3.0.0', // 与 package.json version 同步（f.model 测试锁定；init 写入时以 readCliVersion 覆盖）
    templateId,
    currentPhase: 'PLANNING',
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
      DEVELOPING: {
        sharedLayerDone: false,
        businessTasksDone: false,
        pipelineDone: false,
        testsPassed: false,
        codeAudited: false,
      },
    },
    taskStats: { total: 0, done: 0, failed: 0, blocked: 0, updatedAt: null },
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
