// 规格模型：docs/spec.md 结构化数据块加载（internal-contracts §5 / §7）
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { VimaError, precondition } from '../util/errors.mjs';
import { extractBlocks, listChapters } from '../util/md.mjs';

const SPEC_REL = 'docs/spec.md';

/**
 * 加载 docs/spec.md 并抽取全部 vima:* 数据块。
 * @returns {Promise<{
 *   text: string,
 *   chapters: Array<{level: number, title: string, line: number}>,
 *   entities: Array<object>, enums: Array<object>,
 *   pages: Map<string, object>,  // PAGE-xx → vima:page 块数据
 *   roles: Array<object>, menus: Array<object>, flows: Array<object>,
 *   rules: Array<object>,        // A13：vima:rules 条目
 *   nonGoals: Array<object>,     // A13：vima:non-goals 条目
 *   hasRulesBlock: boolean, hasNonGoalsBlock: boolean,  // A13：块是否存在（空清单与缺块必须可区分）
 * }>}
 * @throws VimaError('NO_SPEC', exitCode 4) 文件缺失
 */
export async function loadSpec(root) {
  const p = path.join(root, SPEC_REL);
  let text;
  try {
    text = await readFile(p, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw precondition('NO_SPEC', '未找到 docs/spec.md（请先完成 PLANNING 产物）', SPEC_REL);
    }
    throw err;
  }

  const chapters = listChapters(text);
  let blocks;
  try {
    blocks = extractBlocks(text);
  } catch (err) {
    if (err instanceof VimaError && !err.path) err.path = SPEC_REL;
    throw err;
  }

  const entities = [];
  const enums = [];
  const roles = [];
  const menus = [];
  const flows = [];
  const rules = [];
  const nonGoals = [];
  const pages = new Map();
  // A13：块存在性与清单是否为空是两件事（V-SPEC-11 要求空清单显式声明）
  let hasRulesBlock = false;
  let hasNonGoalsBlock = false;

  for (const block of blocks) {
    const data = block.data ?? {};
    switch (block.kind) {
      case 'entities':
        if (Array.isArray(data.entities)) entities.push(...data.entities);
        if (Array.isArray(data.enums)) enums.push(...data.enums);
        break;
      case 'page':
        // 无 id 的残缺块不入 Map（结构合法性由 validate 规则负责报告）
        if (typeof data.id === 'string' && data.id !== '') pages.set(data.id, data);
        break;
      case 'roles':
        if (Array.isArray(data.roles)) roles.push(...data.roles);
        break;
      case 'menus':
        if (Array.isArray(data.menus)) menus.push(...data.menus);
        break;
      case 'flow':
        flows.push(data);
        break;
      case 'rules':
        hasRulesBlock = true;
        if (Array.isArray(data.rules)) rules.push(...data.rules);
        break;
      case 'non-goals':
        // key 存在即算「已声明」——空数组是合法声明，缺 key 才是未声明（V-SPEC-11）
        if (Array.isArray(data['non-goals'])) {
          hasNonGoalsBlock = true;
          nonGoals.push(...data['non-goals']);
        }
        break;
      default:
        break; // 其他 vima:* 块（如 contract 不应出现在 spec）忽略
    }
  }

  return {
    text, chapters, entities, enums, pages, roles, menus, flows,
    rules, nonGoals, hasRulesBlock, hasNonGoalsBlock,
  };
}
