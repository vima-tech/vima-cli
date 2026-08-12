// 任务模型：docs/tasks/*.md frontmatter 读写（internal-contracts §5 / §6.1）
import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { VimaError, EXIT } from '../util/errors.mjs';
import { splitFrontmatter } from '../util/md.mjs';
import { parseYaml, stringifyYaml } from '../util/yaml.mjs';
import { atomicWriteFile } from '../util/fs.mjs';

const STATUS_VALUES = ['pending', 'running', 'done', 'failed', 'blocked'];
const LAYER_VALUES = ['shared', 'business', 'pipeline'];
const SIDE_VALUES = ['frontend', 'backend', 'fullstack'];
const REQUIRED_FIELDS = ['taskId', 'title', 'status', 'layer', 'side', 'dependsOn', 'retryCount', 'updatedAt'];
const TASK_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

function taskError(msg, p) {
  return new VimaError('TASK_FM', msg, { path: p, exitCode: EXIT.CHECK_FAILED });
}

/** frontmatter 严格校验：必填字段齐全、枚举取值合法、类型正确。 */
function validateFrontmatter(fm, rel) {
  if (fm === null || typeof fm !== 'object' || Array.isArray(fm)) {
    throw taskError('frontmatter 不是映射结构', rel);
  }
  for (const field of REQUIRED_FIELDS) {
    if (fm[field] === undefined || fm[field] === null) {
      throw taskError(`frontmatter 缺少必填字段 "${field}"`, rel);
    }
  }
  if (typeof fm.taskId !== 'string' || !TASK_ID_RE.test(fm.taskId)) {
    throw taskError(`taskId "${fm.taskId}" 不合法（须匹配 ^[a-z0-9][a-z0-9-]*$）`, rel);
  }
  if (typeof fm.title !== 'string' || fm.title === '') {
    throw taskError('title 必须是非空字符串', rel);
  }
  if (!STATUS_VALUES.includes(fm.status)) {
    throw taskError(`status "${fm.status}" 不合法（须为 ${STATUS_VALUES.join('|')}）`, rel);
  }
  if (!LAYER_VALUES.includes(fm.layer)) {
    throw taskError(`layer "${fm.layer}" 不合法（须为 ${LAYER_VALUES.join('|')}）`, rel);
  }
  if (!SIDE_VALUES.includes(fm.side)) {
    throw taskError(`side "${fm.side}" 不合法（须为 ${SIDE_VALUES.join('|')}）`, rel);
  }
  if (!Array.isArray(fm.dependsOn) || fm.dependsOn.some((d) => typeof d !== 'string')) {
    throw taskError('dependsOn 必须是任务 ID 字符串数组（可为空数组）', rel);
  }
  if (typeof fm.retryCount !== 'number' || !Number.isInteger(fm.retryCount) || fm.retryCount < 0) {
    throw taskError('retryCount 必须是非负整数', rel);
  }
  if (typeof fm.updatedAt !== 'string' || fm.updatedAt === '') {
    throw taskError('updatedAt 必须是非空字符串（ISO 时间）', rel);
  }
  if (fm.contract !== undefined && typeof fm.contract !== 'string') {
    throw taskError('contract 必须是契约文件路径字符串', rel);
  }
}

/**
 * 读取全部任务文件（docs/tasks/*.md，跳过 _ 前缀与 README.md）。
 * @returns {Promise<Array<{file: string, path: string, id: string, fm: object, body: string}>>}
 *   file 为相对 root 的 '/' 分隔路径，path 为绝对路径；按文件名稳定排序。
 * @throws VimaError('TASK_FM') frontmatter 缺失/缺字段/枚举非法
 */
export async function loadTasks(root) {
  const dir = path.join(root, 'docs', 'tasks');
  let names;
  try {
    names = await readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  names = names
    .filter((n) => n.endsWith('.md') && !n.startsWith('_') && n !== 'README.md')
    .sort();
  const tasks = [];
  for (const name of names) {
    const abs = path.join(dir, name);
    const rel = `docs/tasks/${name}`;
    const text = await readFile(abs, 'utf8');
    const { fm: fmRaw, body } = splitFrontmatter(text);
    if (fmRaw === null) throw taskError('任务文件缺少 frontmatter（--- 围栏）', rel);
    const fm = parseYaml(fmRaw, { path: rel });
    validateFrontmatter(fm, rel);
    tasks.push({ file: rel, path: abs, id: fm.taskId, fm, body });
  }
  return tasks;
}

/**
 * 整体重写任务 frontmatter（合并 updates，保留 body 原文），原子写盘。
 * 同步更新内存中的 task.fm 并返回 task。
 */
export async function saveTaskFrontmatter(task, updates) {
  const fm = { ...task.fm, ...updates };
  validateFrontmatter(fm, task.file);
  const target = task.path ?? task.file;
  await atomicWriteFile(target, `---\n${stringifyYaml(fm)}---\n${task.body}`);
  task.fm = fm;
  task.id = fm.taskId;
  return task;
}
