// vima validate —— PLANNING 产物机械校验（契约 §8 规则表 / §6.8 报告格式 / 设计 §13.1 §19.5）
// 确定性、零 token：结构 + 必填要素 + 交叉引用逐条检查，报告落盘留痕。
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';
import { VimaError, EXIT, usageError, usageFromParseArgs } from '../util/errors.mjs';
import { atomicWriteFile, stableStringify, fileExists, walkFiles } from '../util/fs.mjs';
import { extractBlocks, hasCheckbox } from '../util/md.mjs';
import { loadSpec } from '../model/spec.mjs';
import { loadContracts, apiKey } from '../model/contracts.mjs';
import { loadTasks } from '../model/tasks.mjs';
import { loadLifecycle, saveLifecycle, designCapabilityOf, designScopePagesOf } from '../model/lifecycle.mjs';
import { resolveApps, appOf, consumersOf, BUILTIN_KINDS } from '../model/apps.mjs';

const SPEC_REL = 'docs/spec.md';
const COVERAGE_REL = 'docs/coverage-matrix.md';
const REPORT_REL = '.vima/reports/planning-validation.json';

// D-A34-29：PLANNING → DESIGNING 的独立语义面。任务、覆盖矩阵、实现与代码规则
// 此刻尚未形成或仍属旧实现，不得反向阻塞 Design Brief。
const PLANNING_BRIEF_RULE = /^(?:V-SPEC-|V-DEC-|V-CON-|V-PEND-|V-SRC-|V-DSN-(?:0[1-8]|10|11|12)$)/;

// V-SPEC-01：九章标题前缀（level 2，第八章为 A4 吸收项，第九章为 A13）
const REQUIRED_CHAPTERS = [
  '1. 系统概述', '2. 数据模型', '3. 页面清单', '4. 接口清单',
  '5. 业务规则', '6. 权限设计', '7. 技术栈', '8. 关键决策记录', '9. 本期不做',
];

// V-SPEC-09：业务规则 type 词表（A13；对应 planning-guide 终点清单 E 的四类）
const RULE_TYPES = new Set(['validation', 'transition', 'calculation', 'constraint']);
const RULE_ID_RE = /^RULE-\d{2}$/;
const NG_ID_RE = /^NG-\d{2}$/;

// V-SPEC-04：布局/区块枚举词表（§7 vima:page）
const LAYOUT_VOCAB = new Set(['toolbar', 'search', 'table', 'form', 'cards', 'tabs', 'pagination', 'steps', 'collapse', 'anchor']);

// V-SPEC-12：分栏列宽（A14 regions）——固定列 <n>px 或弹性列 <n>fr
const REGION_WIDTH = /^(?:\d+(?:\.\d+)?px|\d+(?:\.\d+)?fr)$/;

// 交互三种（§13.3）：action → 必须携带的目标字段
const ACTIONS = new Set(['nav', 'modal', 'api']);

// A27 PDL 枚举（契约 §7：全部可选、声明即承诺）
// A34 D-A34-06：增 custom——某些页面就是独特的，不要求六种模式全能解释；
// custom 必须自带 intent + fidelity: D2（V-DSN-10），沿用 shape: freeform 的诚实标注口径。
const DSN_PATTERNS = new Set(['list', 'detail', 'form', 'workbench', 'master-detail', 'board', 'custom']);
const DSN_DENSITIES = new Set(['compact', 'default', 'loose']);
const DSN_SHAPES = new Set(['list', 'record', 'metrics', 'timeline', 'chart', 'freeform']);
const DSN_PRIORITIES = new Set(['primary', 'secondary', 'overflow']);
const MODAL_PRESENTATIONS = new Set(['dialog', 'drawer']);
// A34 保真分级（D-A34-01）。注意 V-DSN-02 是空号（已退役），A34 新规则用 09/10/11/12。
const DSN_FIDELITIES = new Set(['D0', 'D1', 'D2']);
// A34 mustPreserve 类型即执行者路由（D-A34-05）：看图可裁的归 design，必须跑链路的归 experience。
const MP_KINDS = new Set(['visual', 'interaction', 'runtime']);
const MP_VERIFIERS = new Set(['design', 'experience']);
const MP_KIND_VERIFIER = { visual: 'design', interaction: 'experience', runtime: 'experience' };

function entry(rule, message, p) {
  return { rule, message, path: p };
}

/**
 * V-DSN-11（A34 D-A34-04/05）：保真级带来的必填声明。
 * D1/D2 必填 `primaryTask`（全套声明里唯一回答「这页为何存在」的键，也是 Experience 验收的被测对象）；
 * D2 再必填 `mustPreserve`——**带类型的结构**而非字符串数组：
 * 「配置与预览同步」「切换患者不重挂载」无法靠一张截图裁定，无 kind 就无执行者（A6）。
 * kind → verifier 的相容关系是硬映射：visual 归 design，interaction/runtime 归 experience。
 * @param {string} id 页面 id
 * @param {object} d 已确认为映射的 design 块
 * @returns {Array<{rule:string,message:string,path:string}>}
 */
function checkDesignFidelityContract(id, d) {
  const errs = [];
  const fid = d.fidelity;
  if (fid !== 'D1' && fid !== 'D2') return errs;

  if (typeof d.primaryTask !== 'string' || d.primaryTask.trim() === '') {
    errs.push(entry('V-DSN-11', `页面 ${id} 是 ${fid} 但缺 design.primaryTask——D1/D2 必须一句话写明本页用户最重要的任务`, SPEC_REL));
  }
  if (fid !== 'D2') return errs;

  const mp = d.mustPreserve;
  if (!Array.isArray(mp) || mp.length === 0) {
    errs.push(entry('V-DSN-11', `页面 ${id} 是 D2 但缺 design.mustPreserve——D2 必须登记「不得被降级掉」的交互事实（非空数组）`, SPEC_REL));
    return errs;
  }
  const seen = new Set();
  for (const [i, item] of mp.entries()) {
    const at = `design.mustPreserve[${i}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errs.push(entry('V-DSN-11', `页面 ${id} 的 ${at} 须是映射（id / kind / statement / verifier 四键）`, SPEC_REL));
      continue;
    }
    if (typeof item.id !== 'string' || item.id === '') {
      errs.push(entry('V-DSN-11', `页面 ${id} 的 ${at} 缺 id（报告按 id 逐条对账，不能省）`, SPEC_REL));
    } else if (seen.has(item.id)) {
      errs.push(entry('V-DSN-11', `页面 ${id} 的 mustPreserve id "${item.id}" 重复（页内须唯一）`, SPEC_REL));
    } else {
      seen.add(item.id);
    }
    if (typeof item.statement !== 'string' || item.statement.trim() === '') {
      errs.push(entry('V-DSN-11', `页面 ${id} 的 ${at} 缺 statement（要保住的是什么，须可读可裁）`, SPEC_REL));
    }
    if (!MP_KINDS.has(item.kind)) {
      errs.push(entry('V-DSN-11', `页面 ${id} 的 ${at}.kind "${item.kind ?? ''}" 非法（须 ∈ ${[...MP_KINDS].join('|')}）`, SPEC_REL));
      continue; // kind 非法则相容性无从判定
    }
    if (!MP_VERIFIERS.has(item.verifier)) {
      errs.push(entry('V-DSN-11', `页面 ${id} 的 ${at}.verifier "${item.verifier ?? ''}" 非法（须 ∈ ${[...MP_VERIFIERS].join('|')}）`, SPEC_REL));
      continue;
    }
    const want = MP_KIND_VERIFIER[item.kind];
    if (item.verifier !== want) {
      errs.push(entry(
        'V-DSN-11',
        `页面 ${id} 的 ${at} kind: ${item.kind} 与 verifier: ${item.verifier} 不相容——`
          + `${item.kind} 类只能由 ${want} 执行（看图可裁的归 design，必须跑链路的归 experience）`,
        SPEC_REL,
      ));
    }
  }
  return errs;
}

// ---------------------------------------------------------------------------
// 页面规则（V-SPEC-03/04/05）—— 渲染命令复用的导出
// ---------------------------------------------------------------------------

/** 收集一个 page 块内的全部交互条目（components[].items[] 带 action + rowActions[]）。 */
function collectInteractions(page) {
  const out = [];
  const components = Array.isArray(page.components) ? page.components : [];
  for (let i = 0; i < components.length; i++) {
    const comp = components[i] ?? {};
    const items = Array.isArray(comp.items) ? comp.items : [];
    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      if (item && typeof item === 'object' && item.action !== undefined) {
        out.push({ where: `components[${i}].items[${j}]`, it: item });
      }
    }
    // A27 操作附着点：actions[] 条目与 items 按钮同 schema，同校验同计点（契约 §7/§8）
    const actions = Array.isArray(comp.actions) ? comp.actions : [];
    for (let j = 0; j < actions.length; j++) {
      const item = actions[j];
      if (item && typeof item === 'object') {
        out.push({ where: `components[${i}].actions[${j}]`, it: item });
      }
    }
    const rowActions = Array.isArray(comp.rowActions) ? comp.rowActions : [];
    for (let j = 0; j < rowActions.length; j++) {
      const item = rowActions[j];
      if (item && typeof item === 'object') {
        out.push({ where: `components[${i}].rowActions[${j}]`, it: item });
      }
    }
  }
  return out;
}

/**
 * 只跑 V-SPEC-03/04/05 的页面规则（render-review / render-prototype 渲染前复用）。
 * @param {object} spec loadSpec 的返回值（pages/roles/menus/flows/text）
 * @returns {Array<{rule, message, path}>}
 */
/** 条目归属端的 kind 定义（A16）：app 缺失/非法时回退 admin-web，避免归属错误引发的连锁噪声。 */
function kindDefOf(entry, roster) {
  if (!roster) return BUILTIN_KINDS['admin-web'];
  const app = appOf(entry, roster);
  const rApp = roster.apps.find((a) => a.id === app);
  return (rApp && roster.kinds[rApp.kind]) || BUILTIN_KINDS['admin-web'];
}

export function validatePages(spec, roster = null) {
  const errors = [];
  const pages = spec.pages instanceof Map ? spec.pages : new Map();
  // A16：布局词表按页面归属端的 kind 取（roster 缺省 = 现行 admin-web 词表，render 兼容路径）
  const vocabOf = (page) => {
    if (!roster) return LAYOUT_VOCAB;
    const def = kindDefOf(page, roster);
    return new Set(Array.isArray(def.layoutVocab) && def.layoutVocab.length > 0 ? def.layoutVocab : [...LAYOUT_VOCAB]);
  };

  // ── V-SPEC-13 端归属（A16）：多端必填、声明须合法、nav 同端 ──
  if (roster && roster.apps.length > 0) {
    const ids = new Set(roster.apps.map((a) => a.id));
    for (const [id, page] of pages) {
      const declared = typeof page.app === 'string' && page.app !== '' ? page.app : null;
      if (declared !== null && !ids.has(declared)) {
        errors.push(entry('V-SPEC-13', `页面 ${id} 的 app "${declared}" 不在端册（可用：${[...ids].join('|')}）`, SPEC_REL));
      } else if (declared === null && roster.multi) {
        errors.push(entry('V-SPEC-13', `页面 ${id} 缺少 app 键（多端项目必填，端册：${[...ids].join('|')}）`, SPEC_REL));
      }
    }
    for (const [id, page] of pages) {
      const from = appOf(page, roster);
      if (!from || !ids.has(from)) continue; // 归属缺失/非法已单独报
      for (const { where, it } of collectInteractions(page)) {
        if (it.action !== 'nav' || typeof it.target !== 'string' || !pages.has(it.target)) continue;
        const to = appOf(pages.get(it.target), roster);
        if (to && ids.has(to) && to !== from) {
          errors.push(entry(
            'V-SPEC-13',
            `页面 ${id} 的 ${where} nav 跨端指向 ${it.target}（${from} → ${to}）——跨端交接只能表达在 vima:flow`,
            SPEC_REL,
          ));
        }
      }
    }
  }

  // ── V-SPEC-03 四要素齐全 + 交互结构 ──
  for (const [id, page] of pages) {
    if (!Array.isArray(page.layout) || page.layout.length === 0) {
      errors.push(entry('V-SPEC-03', `页面 ${id} 缺少非空 layout`, SPEC_REL));
    }
    if (!Array.isArray(page.components) || page.components.length === 0) {
      errors.push(entry('V-SPEC-03', `页面 ${id} 缺少非空 components`, SPEC_REL));
    }
    if (!Array.isArray(page.apis) || page.apis.length === 0) {
      errors.push(entry('V-SPEC-03', `页面 ${id} 缺少非空 apis`, SPEC_REL));
    }
    for (const { where, it } of collectInteractions(page)) {
      if (!ACTIONS.has(it.action)) {
        errors.push(entry('V-SPEC-03', `页面 ${id} 的 ${where} action "${it.action}" 不合法（须为 nav|modal|api）`, SPEC_REL));
        continue;
      }
      if ((it.action === 'nav' || it.action === 'modal') && (typeof it.target !== 'string' || it.target === '')) {
        errors.push(entry('V-SPEC-03', `页面 ${id} 的 ${where} action=${it.action} 缺少 target 字段`, SPEC_REL));
      }
      if (it.action === 'api' && (typeof it.api !== 'string' || it.api === '')) {
        errors.push(entry('V-SPEC-03', `页面 ${id} 的 ${where} action=api 缺少 api 字段`, SPEC_REL));
      }
    }
  }

  // ── V-SPEC-04 词表约束（A16 端化：词表按页面归属端的 kind 取，与渲染器同源于 kinds 配置）──
  for (const [id, page] of pages) {
    const vocab = vocabOf(page);
    const layout = Array.isArray(page.layout) ? page.layout : [];
    for (const word of layout) {
      if (!vocab.has(word)) {
        errors.push(entry('V-SPEC-04', `页面 ${id} 的 layout 含非法词 "${word}"（该端词表：${[...vocab].join('|')}）`, SPEC_REL));
      }
    }
    const components = Array.isArray(page.components) ? page.components : [];
    for (const comp of components) {
      const block = comp && typeof comp === 'object' ? comp.block : undefined;
      if (!vocab.has(block)) {
        errors.push(entry('V-SPEC-04', `页面 ${id} 的 components 含非法区块 "${block}"（该端词表：${[...vocab].join('|')}）`, SPEC_REL));
      }
    }
  }

  // ── V-SPEC-12 分栏版面（A14）：regions 可选；未声明的页面完全不受影响 ──
  // 模型：regions = 纵向若干「带」，每带二选一——全宽带 { blocks } 或分栏带 { columns }
  for (const [id, page] of pages) {
    if (page.regions === undefined) continue;
    // A16 kind 门控：仅 kind 声明 regions: true 的端可用（手机单列，多栏带是规格谎言）
    if (roster && kindDefOf(page, roster).regions !== true) {
      errors.push(entry('V-SPEC-12', `页面 ${id} 归属端的 kind 不支持 regions 分栏（A16 门控）`, SPEC_REL));
      continue;
    }
    if (!Array.isArray(page.regions) || page.regions.length === 0) {
      errors.push(entry('V-SPEC-12', `页面 ${id} 的 regions 须是非空数组`, SPEC_REL));
      continue;
    }
    const vocab = vocabOf(page);
    const flat = [];
    const collect = (words, at) => {
      for (const word of words) {
        if (!vocab.has(word)) {
          errors.push(entry('V-SPEC-12', `页面 ${id} 的 ${at} 含非法词 "${word}"（该端词表：${[...vocab].join('|')}）`, SPEC_REL));
        }
        flat.push(String(word));
      }
    };
    for (const [i, band] of page.regions.entries()) {
      const at = `regions[${i}]`;
      if (!band || typeof band !== 'object' || Array.isArray(band)) {
        errors.push(entry('V-SPEC-12', `页面 ${id} 的 ${at} 须是映射（全宽带 blocks 或分栏带 columns）`, SPEC_REL));
        continue;
      }
      const hasBlocks = Array.isArray(band.blocks) && band.blocks.length > 0;
      const hasColumns = Array.isArray(band.columns) && band.columns.length > 0;
      if (hasBlocks === hasColumns) {
        errors.push(entry('V-SPEC-12', `页面 ${id} 的 ${at} 须且只须有一个非空 blocks（全宽带）或 columns（分栏带）`, SPEC_REL));
        continue;
      }
      if (hasBlocks) {
        collect(band.blocks, `${at}.blocks`);
        continue;
      }
      for (const [j, col] of band.columns.entries()) {
        const cat = `${at}.columns[${j}]`;
        if (!col || typeof col !== 'object' || Array.isArray(col)) {
          errors.push(entry('V-SPEC-12', `页面 ${id} 的 ${cat} 须是映射（name / width / blocks）`, SPEC_REL));
          continue;
        }
        if (col.width !== undefined && !REGION_WIDTH.test(String(col.width))) {
          errors.push(entry('V-SPEC-12', `页面 ${id} 的 ${cat}.width "${col.width}" 非法（须形如 264px 或 1fr；缺省 1fr）`, SPEC_REL));
        }
        if (!Array.isArray(col.blocks) || col.blocks.length === 0) {
          errors.push(entry('V-SPEC-12', `页面 ${id} 的 ${cat} 缺少非空 blocks`, SPEC_REL));
          continue;
        }
        collect(col.blocks, `${cat}.blocks`);
      }
    }
    // 防漂移：regions 铺开后与 layout 必须是同一多重集（带内/列内顺序才是渲染序，故不比顺序）
    const bag = (arr) => [...arr].map(String).sort().join(',');
    if (bag(flat) !== bag(Array.isArray(page.layout) ? page.layout : [])) {
      errors.push(entry(
        'V-SPEC-12',
        `页面 ${id} 的 regions 区块集合与 layout 不一致——` +
          `regions=[${[...flat].sort().join(', ')}]，layout=[${(Array.isArray(page.layout) ? [...page.layout] : []).map(String).sort().join(', ')}]`,
        SPEC_REL,
      ));
    }
  }

  // ── V-DSN PDL 设计声明（A27，声明即承诺：未声明的键完全不触发，存量零影响）──
  for (const [id, page] of pages) {
    const components = Array.isArray(page.components) ? page.components : [];
    const names = new Set();
    // 组件实例名收集 + 页内唯一（V-DSN-03 后半）
    for (const [i, comp] of components.entries()) {
      const name = comp && typeof comp === 'object' ? comp.name : undefined;
      if (name === undefined) continue;
      if (typeof name !== 'string' || name === '') {
        errors.push(entry('V-DSN-03', `页面 ${id} 的 components[${i}].name 须为非空字符串`, SPEC_REL));
        continue;
      }
      if (names.has(name)) {
        errors.push(entry('V-DSN-03', `页面 ${id} 的组件实例名 "${name}" 重复（页内须唯一）`, SPEC_REL));
      }
      names.add(name);
    }
    // V-DSN-03 前半：同词多例必须逐例带 name（否则渲染/对账/评审分不清「哪个 cards」）
    const wordCount = new Map();
    for (const comp of components) {
      const w = comp && typeof comp === 'object' ? String(comp.block ?? '') : '';
      wordCount.set(w, (wordCount.get(w) ?? 0) + 1);
    }
    for (const [i, comp] of components.entries()) {
      if (!comp || typeof comp !== 'object') continue;
      const w = String(comp.block ?? '');
      if ((wordCount.get(w) ?? 0) > 1 && (typeof comp.name !== 'string' || comp.name === '')) {
        errors.push(entry('V-DSN-03', `页面 ${id} 的区块词 "${w}" 出现多例，components[${i}] 缺少实例名 name`, SPEC_REL));
      }
    }

    // V-DSN-01：design 声明完整性 + 全部密度/role 取值（页面级 / 块级 / 列级同规则）
    const d = page.design;
    if (d !== undefined) {
      if (!d || typeof d !== 'object' || Array.isArray(d)) {
        errors.push(entry('V-DSN-01', `页面 ${id} 的 design 须是映射（pattern / density / fold）`, SPEC_REL));
      } else {
        // A27 的「声明即承诺」只管 A27 自己的键：页面一旦用了 pattern/density/fold 任一，
        // pattern 与 density 就必填。A34 的 fidelity/primaryTask/mustPreserve 住在同一个块里
        // 但属另一关注点——只带 A34 键的 design 块**不触发** A27 完整性，
        // 否则 V-DSN-12「每页必须声明 fidelity」会连带把 PDL 变成全页强制（未授权的扩面）。
        const hasA27 = d.pattern !== undefined || d.density !== undefined || d.fold !== undefined;
        if (hasA27 && !DSN_PATTERNS.has(d.pattern)) {
          errors.push(entry('V-DSN-01', `页面 ${id} 的 design.pattern "${d.pattern ?? ''}" 非法（须 ∈ ${[...DSN_PATTERNS].join('|')}）`, SPEC_REL));
        }
        if (hasA27 && !DSN_DENSITIES.has(d.density)) {
          errors.push(entry('V-DSN-01', `页面 ${id} 的 design.density "${d.density ?? ''}" 非法（须 ∈ ${[...DSN_DENSITIES].join('|')}）`, SPEC_REL));
        }
        if (d.fold !== undefined) {
          if (!Array.isArray(d.fold) || d.fold.length === 0) {
            errors.push(entry('V-DSN-07', `页面 ${id} 的 design.fold 须是非空数组（首屏承诺的组件实例名）`, SPEC_REL));
          } else {
            for (const f of d.fold) {
              if (!names.has(f)) {
                errors.push(entry('V-DSN-07', `页面 ${id} 的 design.fold 引用不存在的组件实例 "${f}"（可用：${[...names].join('、') || '（本页无命名实例）'}）`, SPEC_REL));
              }
            }
          }
        }
        // A34：fidelity 取值合法性归 V-DSN-01（同 pattern/density 口径）；
        // 「必须显式声明」归 V-DSN-12（需 lifecycle 判 legacy 豁免，故在 validateProject 里）。
        if (d.fidelity !== undefined && !DSN_FIDELITIES.has(d.fidelity)) {
          errors.push(entry('V-DSN-01', `页面 ${id} 的 design.fidelity "${d.fidelity}" 非法（须 ∈ ${[...DSN_FIDELITIES].join('|')}）`, SPEC_REL));
        }
        errors.push(...checkDesignFidelityContract(id, d));
      }
    }
    // V-DSN-10：pattern: custom 的诚实标注三件套（intent + fidelity: D2）。
    // 设计目录不在此查——它由 pageId 推导、存在性归 V-DSN-09 在 DESIGNING 出口触发。
    if (d && typeof d === 'object' && !Array.isArray(d) && d.pattern === 'custom') {
      if (typeof d.intent !== 'string' || d.intent === '') {
        errors.push(entry('V-DSN-10', `页面 ${id} 声明 pattern: custom 但缺 design.intent——独特版面必须声明意图（诚实标注好过假覆盖）`, SPEC_REL));
      }
      if (d.fidelity !== 'D2') {
        errors.push(entry('V-DSN-10', `页面 ${id} 声明 pattern: custom 但 fidelity 为 "${d.fidelity ?? '（未声明）'}"——custom 页必须是 D2（须有交互原型与体验验收）`, SPEC_REL));
      }
    }
    for (const [i, comp] of components.entries()) {
      if (!comp || typeof comp !== 'object') continue;
      if (comp.density !== undefined && !DSN_DENSITIES.has(comp.density)) {
        errors.push(entry('V-DSN-01', `页面 ${id} 的 components[${i}].density "${comp.density}" 非法（须 ∈ ${[...DSN_DENSITIES].join('|')}）`, SPEC_REL));
      }
      // V-DSN-04：内容形态枚举；freeform 必带 intent（自由发挥区必须声明意图）
      if (comp.data !== undefined) {
        if (!comp.data || typeof comp.data !== 'object' || Array.isArray(comp.data)) {
          errors.push(entry('V-DSN-04', `页面 ${id} 的 components[${i}].data 须是映射（shape / of / keyFields）`, SPEC_REL));
        } else {
          if (comp.data.shape !== undefined && !DSN_SHAPES.has(comp.data.shape)) {
            errors.push(entry('V-DSN-04', `页面 ${id} 的 components[${i}].data.shape "${comp.data.shape}" 非法（须 ∈ ${[...DSN_SHAPES].join('|')}）`, SPEC_REL));
          }
          if (comp.data.shape === 'freeform' && (typeof comp.intent !== 'string' || comp.intent === '')) {
            errors.push(entry('V-DSN-04', `页面 ${id} 的 components[${i}] 声明 shape: freeform 但缺 intent——自由发挥区必须声明意图`, SPEC_REL));
          }
        }
      }
    }
    // 列级 role / density（regions 已由 V-SPEC-12 做结构校验，这里只查 A27 新键取值）
    for (const band of Array.isArray(page.regions) ? page.regions : []) {
      for (const col of Array.isArray(band?.columns) ? band.columns : []) {
        if (!col || typeof col !== 'object') continue;
        if (col.role !== undefined && col.role !== 'primary') {
          errors.push(entry('V-DSN-01', `页面 ${id} 的分栏列 role "${col.role}" 非法（唯一取值 primary）`, SPEC_REL));
        }
        if (col.density !== undefined && !DSN_DENSITIES.has(col.density)) {
          errors.push(entry('V-DSN-01', `页面 ${id} 的分栏列 density "${col.density}" 非法（须 ∈ ${[...DSN_DENSITIES].join('|')}）`, SPEC_REL));
        }
      }
    }

    // V-DSN-05：优先级枚举 + primary 上限（页面级动作 items+actions 合计 ≤1；每块 rowActions ≤1）
    let pagePrimary = 0;
    for (const [i, comp] of components.entries()) {
      if (!comp || typeof comp !== 'object') continue;
      const scan = (list, label, isRow) => {
        let rowPrimary = 0;
        for (const [j, it] of (Array.isArray(list) ? list : []).entries()) {
          if (!it || typeof it !== 'object' || it.priority === undefined) continue;
          if (!DSN_PRIORITIES.has(it.priority)) {
            errors.push(entry('V-DSN-05', `页面 ${id} 的 components[${i}].${label}[${j}].priority "${it.priority}" 非法（须 ∈ ${[...DSN_PRIORITIES].join('|')}）`, SPEC_REL));
            continue;
          }
          if (it.priority !== 'primary') continue;
          if (isRow) rowPrimary += 1;
          else pagePrimary += 1;
        }
        if (isRow && rowPrimary > 1) {
          errors.push(entry('V-DSN-05', `页面 ${id} 的 components[${i}].rowActions 声明了 ${rowPrimary} 个 primary（每块行内 ≤1）`, SPEC_REL));
        }
      };
      scan(comp.items, 'items', false);
      scan(comp.actions, 'actions', false);
      scan(comp.rowActions, 'rowActions', true);
    }
    if (pagePrimary > 1) {
      errors.push(entry('V-DSN-05', `页面 ${id} 的页面级动作声明了 ${pagePrimary} 个 primary（items+actions 合计 ≤1——两个主按钮 = 没有主按钮）`, SPEC_REL));
    }

    // modal presentation（A27 C-A27-03：抽屉是弹窗的呈现变体）
    for (const mo of Array.isArray(page.modals) ? page.modals : []) {
      if (mo && typeof mo === 'object' && mo.presentation !== undefined && !MODAL_PRESENTATIONS.has(mo.presentation)) {
        errors.push(entry('V-SPEC-03', `页面 ${id} 的弹窗 ${mo.id ?? '?'} presentation "${mo.presentation}" 非法（须 ∈ dialog|drawer）`, SPEC_REL));
      }
    }
  }

  // ── V-SPEC-05 引用存在性 + ID 全文档唯一 ──
  for (const [id, page] of pages) {
    const modalIds = new Set(
      (Array.isArray(page.modals) ? page.modals : [])
        .map((m) => (m && typeof m === 'object' ? m.id : undefined))
        .filter((v) => typeof v === 'string'),
    );
    for (const { where, it } of collectInteractions(page)) {
      if (it.action === 'nav' && typeof it.target === 'string' && !pages.has(it.target)) {
        errors.push(entry('V-SPEC-05', `页面 ${id} 的 ${where} nav 指向不存在的页面 "${it.target}"`, SPEC_REL));
      }
      if (it.action === 'modal' && typeof it.target === 'string' && !modalIds.has(it.target)) {
        errors.push(entry('V-SPEC-05', `页面 ${id} 的 ${where} modal 目标 "${it.target}" 未在本页 modals 中定义`, SPEC_REL));
      }
    }
  }

  // ID 唯一性：page（尽量从原文块抓重复——Map 会去重）+ modal + role + menu + flow
  const seen = new Map(); // id → 首次出现的类别
  const dup = (id, kind) => {
    if (id === undefined || id === null || id === '') return;
    if (seen.has(id)) {
      errors.push(entry('V-SPEC-05', `${kind} ID "${id}" 与 ${seen.get(id)} 重复（须全文档唯一）`, SPEC_REL));
    } else {
      seen.set(id, kind);
    }
  };
  if (typeof spec.text === 'string') {
    for (const block of extractBlocks(spec.text, 'page', { path: SPEC_REL })) {
      const pageId = block.data?.id;
      // 缺 id 的 page 块被 loadSpec 丢弃（spec.mjs：不入 pages Map），此后 V-SPEC-03/04/05/13
      // 全部看不见它——整块静默消失。这里是唯一还能看到原文块的地方，必须在此报出，
      // 否则「写了页面但机检全绿、渲染无此页」正是 spec 机检要防的假成功。
      if (typeof pageId !== 'string' || pageId === '') {
        errors.push(entry('V-SPEC-03', `第 ${block.line} 行开栏的 vima:page 块缺少非空 id（缺 id 的页面块不会进入任何页面规则）`, SPEC_REL));
      }
      dup(pageId, 'PAGE');
    }
  } else {
    for (const id of pages.keys()) dup(id, 'PAGE');
  }
  for (const page of pages.values()) {
    for (const m of Array.isArray(page.modals) ? page.modals : []) {
      if (m && typeof m === 'object') dup(m.id, 'MODAL');
    }
  }
  for (const r of Array.isArray(spec.roles) ? spec.roles : []) {
    if (r && typeof r === 'object') dup(r.id, 'ROLE');
  }
  for (const m of Array.isArray(spec.menus) ? spec.menus : []) {
    if (m && typeof m === 'object') dup(m.id, 'MENU');
  }
  for (const f of Array.isArray(spec.flows) ? spec.flows : []) {
    if (f && typeof f === 'object') dup(f.id, 'FLOW');
  }
  // A13：RULE-xx / NG-xx 并入同一 ID 命名空间（契约 §7 全文档唯一）
  for (const r of Array.isArray(spec.rules) ? spec.rules : []) {
    if (r && typeof r === 'object') dup(r.id, 'RULE');
  }
  for (const n of Array.isArray(spec.nonGoals) ? spec.nonGoals : []) {
    if (n && typeof n === 'object') dup(n.id, 'NG');
  }

  return errors;
}

// ---------------------------------------------------------------------------
// spec 规则（V-SPEC-01/02/06/07 + V-DEC-01）
// ---------------------------------------------------------------------------

function checkChapters(spec, errors) {
  for (const prefix of REQUIRED_CHAPTERS) {
    const hit = spec.chapters.some((c) => c.level === 2 && c.title.startsWith(prefix));
    if (!hit) errors.push(entry('V-SPEC-01', `docs/spec.md 缺少章节「## ${prefix}」`, SPEC_REL));
  }
}

function checkEntities(spec, errors) {
  const blocks = typeof spec.text === 'string' ? extractBlocks(spec.text, 'entities', { path: SPEC_REL }) : [];
  if (blocks.length === 0) {
    errors.push(entry('V-SPEC-02', 'docs/spec.md 缺少 vima:entities 数据块', SPEC_REL));
    return;
  }
  const entities = Array.isArray(spec.entities) ? spec.entities : [];
  if (entities.length === 0) {
    errors.push(entry('V-SPEC-02', 'vima:entities 块中 entities 为空', SPEC_REL));
  }
  for (const e of entities) {
    const name = e && typeof e === 'object' ? e.name : undefined;
    if (!e || !Array.isArray(e.fields) || e.fields.length === 0) {
      errors.push(entry('V-SPEC-02', `实体 "${name ?? '(未命名)'}" 缺少非空 fields`, SPEC_REL));
    }
  }
}

function checkRolesMenus(spec, errors, roster = null) {
  const menus = Array.isArray(spec.menus) ? spec.menus : [];
  const roles = Array.isArray(spec.roles) ? spec.roles : [];
  const menuIds = new Set(menus.map((m) => m?.id).filter((v) => typeof v === 'string'));

  // ── V-SPEC-13 菜单端归属（A16）：多端必填、声明合法、menu.page 同端 ──
  if (roster && roster.apps.length > 0) {
    const ids = new Set(roster.apps.map((a) => a.id));
    for (const menu of menus) {
      if (!menu || typeof menu !== 'object') continue;
      const mid = menu.id ?? '(未命名菜单)';
      const declared = typeof menu.app === 'string' && menu.app !== '' ? menu.app : null;
      if (declared !== null && !ids.has(declared)) {
        errors.push(entry('V-SPEC-13', `菜单 ${mid} 的 app "${declared}" 不在端册（可用：${[...ids].join('|')}）`, SPEC_REL));
        continue;
      }
      if (declared === null && roster.multi) {
        errors.push(entry('V-SPEC-13', `菜单 ${mid} 缺少 app 键（多端项目必填，端册：${[...ids].join('|')}）`, SPEC_REL));
        continue;
      }
      const mApp = appOf(menu, roster);
      if (mApp && ids.has(mApp) && typeof menu.page === 'string' && spec.pages?.has?.(menu.page)) {
        const pApp = appOf(spec.pages.get(menu.page), roster);
        if (pApp && ids.has(pApp) && pApp !== mApp) {
          errors.push(entry('V-SPEC-13', `菜单 ${mid}（端 ${mApp}）指向另一端的页面 ${menu.page}（端 ${pApp}）——菜单只能挂本端页面`, SPEC_REL));
        }
      }
    }
  }
  const covered = new Set();
  for (const role of roles) {
    const rid = role?.id ?? '(未命名角色)';
    const roleMenus = Array.isArray(role?.menus) ? role.menus : [];
    if (roleMenus.length === 0) {
      errors.push(entry('V-SPEC-06', `角色 ${rid} 的 menus 为空`, SPEC_REL));
    }
    for (const mid of roleMenus) {
      if (!menuIds.has(mid)) {
        errors.push(entry('V-SPEC-06', `角色 ${rid} 引用不存在的菜单 "${mid}"`, SPEC_REL));
      } else {
        covered.add(mid);
      }
    }
  }
  for (const menu of menus) {
    const mid = menu?.id;
    if (typeof mid !== 'string') continue;
    if (!covered.has(mid) && menu.uncovered !== true) {
      errors.push(entry('V-SPEC-06', `菜单 ${mid} 无任何角色覆盖且未显式声明 uncovered: true（权限盲区）`, SPEC_REL));
    }
  }
}

/** V-SPEC-14 端覆盖（A16）：端册每个 app 在 spec 中 ≥1 个页面（防「入册未设计」漂移）。 */
function checkAppCoverage(spec, errors, roster) {
  if (!roster || roster.apps.length === 0) return;
  for (const a of roster.apps) {
    let hit = false;
    for (const page of spec.pages.values()) {
      if (appOf(page, roster) === a.id) { hit = true; break; }
    }
    if (!hit) {
      errors.push(entry('V-SPEC-14', `端 ${a.id}（${a.kind}）在 spec 中没有任何页面——端册与规格漂移（入册未设计）`, SPEC_REL));
    }
  }
}

// ---------------------------------------------------------------------------
// V-YAML-01（warn）：流式上下文里的裸花括号（跨 spec 与契约）
//
// 背景：路径参数必须写成 `{id}`（V-CODE 的 normalizePathParams 只归一花括号形式），
// 但 YAML 规范里 flow 上下文（`[...]` / `{...}` 内）的 plain scalar 不允许出现 `{`。
// 本解析器容忍 flow 序列里的裸花括号、却在 flow 映射上报「键 X 后缺少 :」——
// 于是同一份文件「vima 能读、标准 YAML 读不了」，且报错信息与真实病因相去甚远。
// 统一出路是给含花括号的值加引号：两边都能解析。block 序列（`- GET /api/x/{id}`）
// 是 block 上下文，本就合法，不在检测范围内。
// ---------------------------------------------------------------------------

/** 屏蔽引号内内容（保留长度），便于按结构扫描而不被字符串里的括号干扰。 */
function maskQuoted(s) {
  return s.replace(/'[^']*'|"[^"]*"/g, (m) => '\0'.repeat(m.length));
}

/**
 * 扫描一段 YAML 文本里「flow 上下文中出现未加引号花括号」的行。
 * @returns {Array<{line: number, text: string}>} line 为相对该段文本的行号（1 起）
 */
export function findUnquotedBracesInFlow(raw) {
  const out = [];
  const lines = String(raw ?? '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const masked = maskQuoted(line);
    let depth = 0;
    for (let j = 0; j < masked.length; j++) {
      const ch = masked[j];
      if (ch === '[') depth++;
      else if (ch === ']') depth = Math.max(0, depth - 1);
      else if (ch === '{') {
        // A22：区分「嵌套 flow 集合」与「plain scalar 里的花括号」。
        // 前者（`params: { step: x }`、`fields: [{ name: y }]`）是合法标准 YAML，vima 也解析得了；
        // 后者（`api: GET /api/x/{id}`）才是本规则的目标。判据取 `{` 前的首个非空字符：
        // 位于值位（: , [ {）或行首 ⇒ 集合起始，放行；否则是嵌在标量里的花括号 ⇒ 报告。
        const prev = masked.slice(0, j).replace(/\s+$/, '').slice(-1);
        const isCollectionStart = prev === '' || prev === ':' || prev === ',' || prev === '[' || prev === '{' || prev === '-';
        if (depth > 0 && !isCollectionStart) { out.push({ line: i + 1, text: line.trim() }); break; }
        depth++;
      } else if (ch === '}') depth = Math.max(0, depth - 1);
    }
  }
  return out;
}

/** 对一份文件的全部 vima 块跑 V-YAML-01（块内相对行号 → 文件绝对行号）。 */
function checkFlowBraces(text, fileRel, warnings) {
  let blocks;
  try {
    blocks = extractBlocks(text, undefined, { path: fileRel });
  } catch {
    return; // 解析失败已由 V-SPEC-01 / V-CON-01 报告
  }
  for (const b of blocks) {
    for (const hit of findUnquotedBracesInFlow(b.raw)) {
      warnings.push(entry(
        'V-YAML-01',
        `第 ${b.line + hit.line} 行 flow 上下文中有未加引号的花括号，标准 YAML 解析器无法读取（vima 解析器容忍）` +
          `——请给该值加引号：${hit.text.slice(0, 80)}`,
        fileRel,
      ));
    }
  }
}

/** 把 "get /api/x" 形式的接口串归一为 "GET /api/x"。 */
export function normalizeApiRef(s) {
  const str = String(s ?? '').trim();
  const idx = str.indexOf(' ');
  if (idx < 0) return str.toUpperCase();
  return `${str.slice(0, idx).toUpperCase()} ${str.slice(idx + 1).trim()}`;
}

// ---------------------------------------------------------------------------
// A22 字段级机检（出自 sustain-v3 实战反馈 F1/F3；现有规则全部停在引用级，
// 「页面 apis ⊆ 契约」通过不代表字段对得上——实测 4 条功能级阻断都在字段级）
// ---------------------------------------------------------------------------

/** 路径中的 `{name}` 占位符名集合（路径参数由上下文提供，不该要求弹窗有对应字段）。 */
function pathParamsOf(p) {
  const out = new Set();
  for (const m of String(p ?? '').matchAll(/\{([^}]+)\}/g)) out.add(m[1]);
  return out;
}

/**
 * 契约 api 的入参视图（A22/F1 与 F4 的交汇点）：
 * - names：可用于比对的入参名集合 = 顶层名 ∪ 已声明子结构（`fields`）的 json 字段的子字段名
 * - requiredNames：必填名集合（json 字段声明了子结构时，用其必填子字段代替父名参与反向对账）
 * - opaqueJson：存在 `type: json` 且**未声明** `fields` 的入参 —— 无从判断哪些弹窗字段
 *   会被拼进去，此时整个 api 的双向对账必须跳过（实测这是误报的主要来源）
 */
function requestViewOf(api) {
  const names = new Set();
  const requiredNames = new Set();
  let opaqueJson = false;
  const params = pathParamsOf(api?.path);
  for (const f of Array.isArray(api?.request) ? api.request : []) {
    if (!f || typeof f !== 'object' || typeof f.name !== 'string' || f.name === '') continue;
    names.add(f.name);
    const isJson = f.type === 'json';
    const sub = Array.isArray(f.fields) ? f.fields : null;
    if (isJson && sub === null) {
      opaqueJson = true;
      continue; // 不透明聚合字段不参与必填反向对账
    }
    if (isJson && sub !== null) {
      for (const s of sub) {
        if (!s || typeof s !== 'object' || typeof s.name !== 'string' || s.name === '') continue;
        names.add(s.name);
        if (s.required === true) requiredNames.add(s.name);
      }
      continue; // 父名不参与必填反向对账，由子字段代表
    }
    if (f.required === true && !params.has(f.name)) requiredNames.add(f.name);
  }
  return { names, requiredNames, opaqueJson };
}

/**
 * V-SPEC-15（warn）弹窗必填字段 ↔ 提交端点入参双向对账（A22/F1，契约 §8）。
 * 定位是**候选清单**不是判决——反馈文档实测三版脚本给出 54 → 32 → 13，前两个都是错的，
 * 最终定性靠实现者实地验证。故恒为 warn，且三条排除项一条不能少。
 */
function checkModalFields(spec, contracts, warnings) {
  const apiByKey = new Map();
  for (const c of contracts ?? []) {
    for (const api of c.apis ?? []) apiByKey.set(apiKey(api), api);
  }
  if (apiByKey.size === 0) return;

  for (const [pageId, page] of spec.pages) {
    for (const modal of Array.isArray(page.modals) ? page.modals : []) {
      if (!modal || typeof modal !== 'object') continue;
      const mid = typeof modal.id === 'string' ? modal.id : '(未命名弹窗)';
      const submitApi = modal.submit && typeof modal.submit === 'object' ? modal.submit.api : undefined;
      if (typeof submitApi !== 'string' || submitApi === '') continue;
      const key = normalizeApiRef(submitApi);
      // 排除①：选择/参考类弹窗（submit 指向 GET）——字段本就不提交
      if (key.startsWith('GET ')) continue;
      const api = apiByKey.get(key);
      if (api === undefined) continue; // 端点不存在归 V-SPEC-07，本规则不重复报

      const view = requestViewOf(api);
      // 排除③：存在未声明子结构的 json 聚合入参 —— 无从判断嵌套，整个 api 跳过
      if (view.opaqueJson) continue;

      const fields = Array.isArray(modal.fields) ? modal.fields : [];
      const modalNames = new Set(
        fields
          .filter((f) => f && typeof f === 'object' && typeof f.field === 'string' && f.field !== '')
          .map((f) => f.field),
      );

      // 正向：弹窗必填字段须能提交上去（否则用户填了即丢）
      for (const f of fields) {
        if (!f || typeof f !== 'object' || f.required !== true) continue;
        if (typeof f.field !== 'string' || f.field === '') continue;
        if (view.names.has(f.field)) continue;
        warnings.push(entry(
          'V-SPEC-15',
          `页面 ${pageId} 弹窗 ${mid} 的必填字段 "${f.field}" 不在提交端点 ${key} 的入参里`
            + '——用户填了即丢；请核对是契约漏了该入参，还是弹窗多了该字段',
          SPEC_REL,
        ));
      }
      // 反向：契约必填入参须有地方填（否则提交必被参数校验拒绝）
      for (const name of [...view.requiredNames].sort()) {
        if (modalNames.has(name)) continue;
        warnings.push(entry(
          'V-SPEC-15',
          `提交端点 ${key} 的必填入参 "${name}" 在页面 ${pageId} 弹窗 ${mid} 里没有对应字段`
            + '——提交将被参数校验拒绝；缺的入参往往正是某个业务判断的输入',
          SPEC_REL,
        ));
      }
    }
  }
}

/**
 * V-SPEC-16（error）跨页导航参数取值域闭环（A22/F3，契约 §8）。
 * 每个页面单看都自洽，只有跨页对照才暴露——目标页对未知 key 静默落兜底分支且不报错。
 * 不携带 params 的 nav 完全不触发：规则由声明主动开启，存量项目零影响。
 */
function checkNavParams(spec, errors) {
  const domainOf = (page) => {
    const out = new Map();
    for (const p of Array.isArray(page?.params) ? page.params : []) {
      if (!p || typeof p !== 'object' || typeof p.name !== 'string' || p.name === '') continue;
      out.set(p.name, new Set((Array.isArray(p.values) ? p.values : []).map((v) => String(v))));
    }
    return out;
  };
  for (const [pageId, page] of spec.pages) {
    for (const { where, it } of collectInteractions(page)) {
      if (it.action !== 'nav') continue;
      const params = it.params;
      if (params === undefined || params === null) continue;
      if (typeof params !== 'object' || Array.isArray(params)) {
        errors.push(entry('V-SPEC-16', `页面 ${pageId} ${where} 的 nav params 须为映射（如 { step: screening }）`, SPEC_REL));
        continue;
      }
      const target = typeof it.target === 'string' ? spec.pages.get(it.target) : undefined;
      if (target === undefined) continue; // 目标页不存在归 V-SPEC-05
      const domain = domainOf(target);
      for (const [k, v] of Object.entries(params)) {
        if (!domain.has(k)) {
          errors.push(entry(
            'V-SPEC-16',
            `页面 ${pageId} ${where} 跳转 ${it.target} 时携带参数 "${k}"，但 ${it.target} 未声明该导航参数`
              + '（目标页 params 是取值域的唯一声明处；未知参数会被静默忽略并落到兜底分支）',
            SPEC_REL,
          ));
          continue;
        }
        const values = domain.get(k);
        if (values.size > 0 && !values.has(String(v))) {
          errors.push(entry(
            'V-SPEC-16',
            `页面 ${pageId} ${where} 跳转 ${it.target} 时 "${k}" 取值 "${v}" 不在 ${it.target} 声明的取值域内`
              + `（合法值：${[...values].sort().join('、')}）`,
            SPEC_REL,
          ));
        }
      }
    }
  }
}

function checkPageApisInContracts(spec, contracts, errors, roster = null) {
  const contractKeys = new Set();
  const consumersByKey = new Map(); // A16：归一键 → 消费端（null = 多端未声明，由 V-CON-07 契约侧报）
  for (const c of contracts) {
    for (const api of c.apis) {
      contractKeys.add(apiKey(api));
      if (roster) consumersByKey.set(apiKey(api), consumersOf(api, roster));
    }
  }
  const rosterIds = roster ? new Set(roster.apps.map((a) => a.id)) : null;
  for (const [id, page] of spec.pages) {
    const pApp = roster ? appOf(page, roster) : null;
    for (const ref of Array.isArray(page.apis) ? page.apis : []) {
      if (!contractKeys.has(normalizeApiRef(ref))) {
        errors.push(entry('V-SPEC-07', `页面 ${id} 引用的接口 "${ref}" 不在任何契约中`, SPEC_REL));
        continue;
      }
      // V-CON-07 页面侧（A16）：page.apis ⊆ 其归属端可见的接口集（越权引用设计期拦截）
      if (pApp && rosterIds?.has(pApp)) {
        const cs = consumersByKey.get(normalizeApiRef(ref));
        if (Array.isArray(cs) && !cs.includes(pApp)) {
          errors.push(entry('V-CON-07', `页面 ${id}（端 ${pApp}）引用了未授权接口 "${ref}"（consumers: [${cs.join(', ')}]）——越权引用`, SPEC_REL));
        }
      }
    }
  }
  // V-SPEC-08：菜单功能点接口闭环——feature.api（存在时）必须在契约中（§13.2 视图②）；
  // A16 端化：该接口的 consumers 还须含 menu.app（与 V-CON-07 同口径）
  for (const menu of Array.isArray(spec.menus) ? spec.menus : []) {
    const mApp = roster ? appOf(menu, roster) : null;
    for (const f of Array.isArray(menu?.features) ? menu.features : []) {
      if (!(f && typeof f === 'object' && typeof f.api === 'string' && f.api !== '')) continue;
      if (!contractKeys.has(normalizeApiRef(f.api))) {
        errors.push(entry('V-SPEC-08', `菜单 ${menu.id} 的功能点「${f.name ?? '(未命名)'}」引用的接口 "${f.api}" 不在任何契约中`, SPEC_REL));
        continue;
      }
      if (mApp && rosterIds?.has(mApp)) {
        const cs = consumersByKey.get(normalizeApiRef(f.api));
        if (Array.isArray(cs) && !cs.includes(mApp)) {
          errors.push(entry('V-SPEC-08', `菜单 ${menu.id}（端 ${mApp}）的功能点「${f.name ?? '(未命名)'}」引用了未授权接口 "${f.api}"（consumers: [${cs.join(', ')}]）`, SPEC_REL));
        }
      }
    }
  }
}

/**
 * V-SPEC-09 业务规则结构化 + V-SPEC-10 规则接口闭环（A13）。
 * entity 必填（∈ vima:entities[].name）管语义归属；apis 可选，给出即须落在契约上。
 */
function checkRules(spec, contracts, errors) {
  if (!spec.hasRulesBlock) {
    errors.push(entry('V-SPEC-09', 'docs/spec.md 第五章缺少 vima:rules 数据块（A13：业务规则须结构化）', SPEC_REL));
    return;
  }
  const rules = Array.isArray(spec.rules) ? spec.rules : [];
  if (rules.length === 0) {
    errors.push(entry('V-SPEC-09', 'vima:rules 块中 rules 为空（业务规则至少一条）', SPEC_REL));
    return;
  }

  const entityNames = new Set(
    (Array.isArray(spec.entities) ? spec.entities : [])
      .map((e) => (e && typeof e === 'object' ? e.name : undefined))
      .filter((v) => typeof v === 'string' && v !== ''),
  );
  const contractKeys = new Set();
  for (const c of contracts ?? []) {
    for (const api of c.apis ?? []) contractKeys.add(apiKey(api));
  }

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    const where = r && typeof r === 'object' && typeof r.id === 'string' ? r.id : `rules[${i}]`;
    if (!r || typeof r !== 'object') {
      errors.push(entry('V-SPEC-09', `业务规则 ${where} 不是合法条目`, SPEC_REL));
      continue;
    }
    if (typeof r.id !== 'string' || !RULE_ID_RE.test(r.id)) {
      errors.push(entry('V-SPEC-09', `业务规则 ${where} 的 id 不合法（须匹配 RULE-\\d{2}）`, SPEC_REL));
    }
    if (!RULE_TYPES.has(r.type)) {
      errors.push(entry('V-SPEC-09', `业务规则 ${where} 的 type "${r.type}" 不合法（词表：${[...RULE_TYPES].join('|')}）`, SPEC_REL));
    }
    if (typeof r.entity !== 'string' || r.entity === '') {
      errors.push(entry('V-SPEC-09', `业务规则 ${where} 缺少 entity 字段（须指向 vima:entities 中的实体）`, SPEC_REL));
    } else if (!entityNames.has(r.entity)) {
      errors.push(entry('V-SPEC-09', `业务规则 ${where} 的 entity "${r.entity}" 不存在于 vima:entities`, SPEC_REL));
    }
    if (typeof r.desc !== 'string' || r.desc.trim() === '') {
      errors.push(entry('V-SPEC-09', `业务规则 ${where} 缺少非空 desc`, SPEC_REL));
    }
    // V-SPEC-10：apis 可选；给出则每条须落在契约上（归一同 V-SPEC-07）
    if (r.apis !== undefined) {
      if (!Array.isArray(r.apis) || r.apis.length === 0) {
        errors.push(entry('V-SPEC-10', `业务规则 ${where} 的 apis 存在但不是非空数组（不需要关联接口时请整体省略该字段）`, SPEC_REL));
      } else {
        for (const ref of r.apis) {
          if (!contractKeys.has(normalizeApiRef(ref))) {
            errors.push(entry('V-SPEC-10', `业务规则 ${where} 关联的接口 "${ref}" 不在任何契约中`, SPEC_REL));
          }
        }
      }
    }
  }
}

/**
 * V-SPEC-17（error）flow 步骤引用闭环 + V-SPEC-18（warn）步骤角色可达性（A33）。
 * flows 此前是 spec 数据块中唯一零引用校验的块（V-SPEC-05 只查 FLOW ID 唯一性）——
 * 写 page: PAGE-99 的流程能通过全部规则。只校验**已声明**的字段（声明即承诺，同 A27）：
 * 悬空引用是确凿缺陷判 error；可达性恒 warn（页面可经 nav 从他页到达，菜单不是唯一入口）。
 */
function checkFlows(spec, contracts, errors, warnings) {
  const flows = Array.isArray(spec.flows) ? spec.flows : [];
  if (flows.length === 0) return;

  const contractKeys = new Set();
  for (const c of contracts ?? []) {
    for (const api of c.apis ?? []) contractKeys.add(apiKey(api));
  }
  const roleById = new Map(
    (Array.isArray(spec.roles) ? spec.roles : [])
      .filter((r) => r && typeof r === 'object' && typeof r.id === 'string')
      .map((r) => [r.id, r]),
  );

  for (let i = 0; i < flows.length; i++) {
    const f = flows[i];
    const fid = f && typeof f === 'object' && typeof f.id === 'string' && f.id !== '' ? f.id : `flows[${i}]`;
    const steps = f && typeof f === 'object' && Array.isArray(f.steps) ? f.steps : [];
    if (steps.length === 0) {
      errors.push(entry('V-SPEC-17', `流程 ${fid} 没有任何 steps（空流程无法审计业务闭环）`, SPEC_REL));
      continue;
    }
    for (let j = 0; j < steps.length; j++) {
      const s = steps[j];
      const where = `${fid}.steps[${j}]`;
      if (!s || typeof s !== 'object') {
        errors.push(entry('V-SPEC-17', `流程步骤 ${where} 不是合法条目`, SPEC_REL));
        continue;
      }
      if (typeof s.role === 'string' && s.role !== '' && !roleById.has(s.role)) {
        errors.push(entry('V-SPEC-17', `流程步骤 ${where} 引用不存在的角色 "${s.role}"`, SPEC_REL));
      }
      if (typeof s.page === 'string' && s.page !== '' && !spec.pages.has(s.page)) {
        errors.push(entry('V-SPEC-17', `流程步骤 ${where} 引用不存在的页面 "${s.page}"`, SPEC_REL));
      }
      if (typeof s.next === 'string' && s.next !== '' && !spec.pages.has(s.next)) {
        errors.push(entry('V-SPEC-17', `流程步骤 ${where} 的去向 next 引用不存在的页面 "${s.next}"`, SPEC_REL));
      }
      if (typeof s.api === 'string' && s.api !== '' && !contractKeys.has(normalizeApiRef(s.api))) {
        errors.push(entry('V-SPEC-17', `流程步骤 ${where} 的接口 "${s.api}" 不在任何契约中（归一同 V-SPEC-07）`, SPEC_REL));
      }
      // V-SPEC-18：步骤角色对该页菜单不可达（role 与 page 都声明且都存在、页面挂有菜单时才判）
      if (typeof s.role === 'string' && roleById.has(s.role)
        && typeof s.page === 'string' && spec.pages.has(s.page)) {
        const menuId = spec.pages.get(s.page).menu;
        if (typeof menuId === 'string' && menuId !== ''
          && !(roleById.get(s.role).menus ?? []).includes(menuId)) {
          warnings.push(entry(
            'V-SPEC-18',
            `流程步骤 ${where}：角色 ${s.role} 未拥有页面 ${s.page} 的菜单 ${menuId}——`
              + '该步入口对此角色不可达（页面若经 nav 从他页到达属正常，请人工复核）',
            SPEC_REL,
          ));
        }
      }
    }
  }
}

/** V-SPEC-11 本期不做显式声明（A13）：空清单也必须写出来，缺声明与声明为空必须可区分。 */
function checkNonGoals(spec, errors) {
  if (!spec.hasNonGoalsBlock) {
    errors.push(entry(
      'V-SPEC-11',
      'docs/spec.md 第九章缺少 vima:non-goals 块或块内缺少 non-goals 键（A13：空清单也须显式写 non-goals: []）',
      SPEC_REL,
    ));
    return;
  }
  const items = Array.isArray(spec.nonGoals) ? spec.nonGoals : [];
  for (let i = 0; i < items.length; i++) {
    const n = items[i];
    const where = n && typeof n === 'object' && typeof n.id === 'string' ? n.id : `non-goals[${i}]`;
    if (!n || typeof n !== 'object') {
      errors.push(entry('V-SPEC-11', `本期不做条目 ${where} 不是合法条目`, SPEC_REL));
      continue;
    }
    if (typeof n.id !== 'string' || !NG_ID_RE.test(n.id)) {
      errors.push(entry('V-SPEC-11', `本期不做条目 ${where} 的 id 不合法（须匹配 NG-\\d{2}）`, SPEC_REL));
    }
    if (typeof n.desc !== 'string' || n.desc.trim() === '') {
      errors.push(entry('V-SPEC-11', `本期不做条目 ${where} 缺少非空 desc`, SPEC_REL));
    }
  }
}

/** 第八章正文（该 level-2 标题到下一个 level-2 标题之间）。 */
function chapterEightText(spec) {
  const chapters = spec.chapters.filter((c) => c.level === 2);
  const idx = chapters.findIndex((c) => c.title.startsWith('8. 关键决策记录'));
  if (idx < 0) return null;
  const lines = spec.text.split('\n');
  const start = chapters[idx].line; // line 为 1 起，标题的下一行下标恰为 line
  const end = idx + 1 < chapters.length ? chapters[idx + 1].line - 1 : lines.length;
  return lines.slice(start, end).join('\n');
}

function checkDecisionTable(spec, errors) {
  const text = chapterEightText(spec);
  if (text === null) {
    errors.push(entry('V-DEC-01', '第八章缺失，无法检查决策表（A4）', SPEC_REL));
    return;
  }
  const rows = text.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'));
  const hasHeader = rows.some((row) => row.split('|').map((c) => c.trim()).includes('已否决方案'));
  if (!hasHeader) {
    errors.push(entry('V-DEC-01', '第八章缺少含「已否决方案」列的决策表（A4）', SPEC_REL));
  }
}

// ---------------------------------------------------------------------------
// 契约规则（V-CON-01/02/03/04）
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// A22 契约字段级机检（sustain-v3 实战反馈 F2/F4）
// ---------------------------------------------------------------------------

/**
 * V-CON-08（warn）字段四面对账·疑似只进不出（A22/F2，契约 §8）。
 * 同一 module 内按 create(POST.request) / update(PUT·PATCH.request) / read(GET.response)
 * 三桶归集；只出现在一个桶 → warn。实测同一个错犯了三次（只加 POST 忘了 GET/PUT），
 * 前端表现为「新建能填、编辑那栏是灰的」且**不报错**。
 * 「GET 列表/详情响应」合并为一个 read 桶是**有意的保守化**：四面模型下 id/createdAt
 * 会各自单独成面而误报，合并后自然免疫，而三条真实实例（只在 create 桶）照样命中。
 */
function checkFieldFaces(contracts, warnings) {
  for (const c of contracts ?? []) {
    if (c.module === null) continue;
    const buckets = { create: new Set(), update: new Set(), read: new Set() };
    const exempt = new Set(); // 显式声明单向的字段（readOnly / writeOnly）不参与
    const addField = (bucket, f) => {
      if (!f || typeof f !== 'object' || typeof f.name !== 'string' || f.name === '') return;
      if (f.readOnly === true || f.writeOnly === true) exempt.add(f.name);
      buckets[bucket].add(f.name);
    };
    for (const api of c.apis ?? []) {
      const method = String(api?.method ?? '').toUpperCase();
      if (method === 'POST') for (const f of Array.isArray(api.request) ? api.request : []) addField('create', f);
      else if (method === 'PUT' || method === 'PATCH') {
        for (const f of Array.isArray(api.request) ? api.request : []) addField('update', f);
      }
      if (method === 'GET') for (const f of Array.isArray(api.response) ? api.response : []) addField('read', f);
    }
    // 三桶都为空（如纯 DELETE 模块）不判
    const filled = ['create', 'update', 'read'].filter((b) => buckets[b].size > 0);
    if (filled.length < 2) continue; // 只有一个面有内容时无从对账（如只读模块），不制造噪声
    if (buckets.read.size === 0) continue; // 没有读面就谈不上「只进不出」
    // **只查「只进」方向**：写面出现、读面从不出现 → 建完再也看不见。
    // 反方向（只在 read 面）不查——id/createdAt/计算字段天然只在响应里，实测在 4 个接口的
    // 夹具上就产生 3 条纯噪声，正是反馈文档警告的「误报率高到没人看」。
    const writeNames = new Set([...buckets.create, ...buckets.update]);
    for (const name of [...writeNames].sort()) {
      if (exempt.has(name)) continue;
      if (buckets.read.has(name)) continue;
      const faces = ['create', 'update'].filter((b) => buckets[b].has(name));
      warnings.push(entry(
        'V-CON-08',
        `契约 ${c.module} 的字段 "${name}" 只出现在写面（${faces.join('+')}），任何 GET 响应里都没有`
          + '——疑似「只进不出」：新建时能填，之后查不到、改不了，且前端不会报错。'
          + '确属只写字段（如密码、批量操作入参）请显式标 writeOnly: true',
        c.file,
      ));
    }
  }
}

/** 聚合字段子结构的稳定指纹（名+类型+必填，按名排序）——用于同名不同义比对。 */
function subSchemaSignature(fields) {
  return (Array.isArray(fields) ? fields : [])
    .filter((f) => f && typeof f === 'object' && typeof f.name === 'string')
    .map((f) => `${f.name}:${f.type ?? ''}${f.required === true ? '!' : ''}`)
    .sort()
    .join(',');
}

/**
 * V-CON-09（warn）聚合 json 子协议（A22/F4，契约 §8）。
 * `type: json` 内部零约束 ⇒ 写入方/读取方/后端计算方各写各的，编译期与机检都看不见，
 * 运行时表现为「存进去了但算不对」。第二条子检查只提示同名不同义，**不判错**——
 * 实测 content 在 6 个模块里是 6 种领域对象且确实是有意的，统一成一套是过度抽象。
 */
function checkJsonSubSchema(contracts, warnings) {
  const byName = new Map(); // 聚合字段名 → [{ module, file, sig }]
  for (const c of contracts ?? []) {
    if (c.module === null) continue;
    for (const api of c.apis ?? []) {
      const key = apiKey(api);
      for (const side of ['request', 'response']) {
        for (const f of Array.isArray(api[side]) ? api[side] : []) {
          if (!f || typeof f !== 'object' || f.type !== 'json') continue;
          const name = typeof f.name === 'string' ? f.name : '(未命名)';
          const hasSub = Array.isArray(f.fields);
          if (!hasSub && f.enforced !== false) {
            warnings.push(entry(
              'V-CON-09',
              `契约 ${c.module} 的 ${key} 中聚合字段 "${name}"（type: json）既无 fields 子结构`
                + '也无 enforced: false——内部结构零约束时写入方/读取方/计算方会各写各的；'
                + '确实没有权威结构请显式标 enforced: false',
              c.file,
            ));
          }
          if (hasSub) {
            if (!byName.has(name)) byName.set(name, []);
            byName.get(name).push({ module: c.module, file: c.file, sig: subSchemaSignature(f.fields) });
          }
        }
      }
    }
  }
  for (const [name, uses] of [...byName.entries()].sort()) {
    const modules = new Map();
    for (const u of uses) if (!modules.has(u.module)) modules.set(u.module, u);
    if (modules.size < 2) continue;
    const sigs = new Set([...modules.values()].map((u) => u.sig));
    if (sigs.size < 2) continue;
    const list = [...modules.keys()].sort().join('、');
    warnings.push(entry(
      'V-CON-09',
      `聚合字段 "${name}" 在 ${modules.size} 个契约（${list}）中给出了不同子结构`
        + '——同名不同义，确认是否有意（不同领域对象重名是允许的，统一成一套反而是过度抽象）',
      [...modules.values()][0].file,
    ));
  }
}

function checkContracts(contracts, spec, tasks, errors, warnings, roster = null, { checkTaskBindings = true } = {}) {
  // V-CON-01：五要素齐全（request 允许空数组，但字段必须显式存在）
  for (const c of contracts) {
    if (c.module === null && c.apis.length === 0) {
      errors.push(entry('V-CON-01', '契约文件缺少 vima:contract 数据块', c.file));
      continue;
    }
    for (const api of c.apis) {
      const missing = [];
      if (typeof api.method !== 'string' || api.method === '') missing.push('method');
      if (typeof api.path !== 'string' || api.path === '') missing.push('path');
      if (!Array.isArray(api.request)) missing.push('request');
      if (!Array.isArray(api.response)) missing.push('response');
      if (!Array.isArray(api.errors)) missing.push('errors');
      if (missing.length > 0) {
        const label = apiKey(api).trim() || '(未命名接口)';
        errors.push(entry('V-CON-01', `契约接口 ${label} 缺少要素：${missing.join('/')}`, c.file));
      }
    }
  }

  // V-CON-04：module 名与 `METHOD path` 键跨全部契约唯一（防后写覆盖先写）
  const moduleSeen = new Map();
  const keySeen = new Map();
  for (const c of contracts) {
    if (typeof c.module === 'string' && c.module !== '') {
      if (moduleSeen.has(c.module)) {
        errors.push(entry('V-CON-04', `契约 module "${c.module}" 重复定义（首见于 ${moduleSeen.get(c.module)}）`, c.file));
      } else {
        moduleSeen.set(c.module, c.file);
      }
    }
    for (const api of c.apis) {
      if (typeof api.method !== 'string' || api.method === '' || typeof api.path !== 'string' || api.path === '') continue;
      const k = apiKey(api);
      if (keySeen.has(k)) {
        errors.push(entry('V-CON-04', `契约接口 ${k} 重复定义（首见于 ${keySeen.get(k)}）`, c.file));
      } else {
        keySeen.set(k, c.file);
      }
    }
  }

  // V-CON-02（warn）：孤儿接口——未被任何页面 apis 引用
  const referenced = new Set();
  if (spec) {
    for (const page of spec.pages.values()) {
      for (const ref of Array.isArray(page.apis) ? page.apis : []) {
        referenced.add(normalizeApiRef(ref));
      }
    }
  }
  for (const c of contracts) {
    for (const api of c.apis) {
      if (!referenced.has(apiKey(api))) {
        warnings.push(entry('V-CON-02', `契约接口 ${apiKey(api)} 未被任何页面引用（孤儿接口）`, c.file));
      }
    }
  }

  // V-CON-07 契约侧（A16）：多端项目每个 api 必填非空 consumers 且 ⊆ 端册
  const rosterIds = roster ? new Set(roster.apps.map((a) => a.id)) : null;
  if (roster?.multi) {
    for (const c of contracts) {
      for (const api of c.apis) {
        const label = apiKey(api).trim() || '(未命名接口)';
        if (!Array.isArray(api.consumers) || api.consumers.length === 0) {
          errors.push(entry('V-CON-07', `契约接口 ${label} 缺少非空 consumers（多端项目必填，端册：${[...rosterIds].join('|')}）`, c.file));
          continue;
        }
        for (const cs of api.consumers) {
          if (!rosterIds.has(cs)) {
            errors.push(entry('V-CON-07', `契约接口 ${label} 的 consumers 含端册之外的端 "${cs}"（端册：${[...rosterIds].join('|')}）`, c.file));
          }
        }
      }
    }
  }

  // V-CON-03（A16 端化「谁消费谁承接」）：每 module ≥1 backend 任务；且对每个消费该
  // module ≥1 个 api 的端，须有 ≥1 个该端的 frontend|fullstack 任务经 contract 引用。
  // 单端项目 consumersOf 缺省 = 唯一端，天然退化为原「前后端成对」语义；
  // 无前端语义项目（apps 空）保持旧口径。planning-brief 阶段任务尚未形成，延后此条
  // 跨任务绑定规则；契约自身的 V-CON-01/02/04/07 仍正常执行。
  for (const c of checkTaskBindings ? contracts : []) {
    if (c.module === null) continue;
    const refs = tasks.filter((t) => t.fm.contract === c.file);
    const hasBe = refs.some((t) => t.fm.side === 'backend' || t.fm.side === 'fullstack');
    if (!hasBe) {
      errors.push(entry('V-CON-03', `契约模块 "${c.module}" 缺少 backend 任务引用`, c.file));
    }
    if (!roster || roster.apps.length === 0) {
      const hasFe = refs.some((t) => t.fm.side === 'frontend' || t.fm.side === 'fullstack');
      if (!hasFe) {
        errors.push(entry('V-CON-03', `契约模块 "${c.module}" 缺少 frontend 任务引用（前后端须成对）`, c.file));
      }
      continue;
    }
    const consumingApps = new Set();
    for (const api of c.apis) {
      for (const cs of consumersOf(api, roster) ?? []) {
        if (rosterIds.has(cs)) consumingApps.add(cs); // 非法端已由 V-CON-07 报
      }
    }
    for (const appId of consumingApps) {
      const hasFe = refs.some(
        (t) => (t.fm.side === 'frontend' || t.fm.side === 'fullstack') && appOf(t.fm, roster) === appId,
      );
      if (!hasFe) {
        errors.push(entry(
          'V-CON-03',
          `契约模块 "${c.module}" 的消费端 ${appId} 没有该端的 frontend 任务引用（谁消费谁承接，A16）`,
          c.file,
        ));
      }
    }
  }
}

/** 读取 docs/contracts 下参与校验的契约原文（跳过 _ 前缀）。 */
async function readContractTexts(root) {
  const dir = path.join(root, 'docs', 'contracts');
  let names = [];
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith('.md') && !n.startsWith('_')).sort();
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return [];
  }
  const out = [];
  for (const name of names) {
    out.push({ file: `docs/contracts/${name}`, text: await readFile(path.join(dir, name), 'utf8') });
  }
  return out;
}

// ---------------------------------------------------------------------------
// V-CON-05（warn）：占位符特征——模板套壳没填完的痕迹
//
// 实测来源：某项目 20 份契约里 14 份带 `q1/q2/q3` 式无语义参数名、7 份带 `preview?: string`
// 伪参数、11 份 POST/PUT 却 `request: []`。这类内容能通过全部结构性校验（五要素俱在），
// 却与真实需求毫无关系。此规则零配置、纯形态判断，不依赖任何项目物料。
// ---------------------------------------------------------------------------

const PLACEHOLDER_NAME_RE = /^q\d+$/i; // q1/q2/q3……

function checkPlaceholders(contracts, warnings) {
  for (const c of contracts) {
    for (const api of c.apis) {
      const key = apiKey(api);
      const req = Array.isArray(api.request) ? api.request : [];
      const bad = req
        .map((f) => (f && typeof f === 'object' ? String(f.name ?? '') : ''))
        .filter((n) => PLACEHOLDER_NAME_RE.test(n));
      if (bad.length > 0) {
        warnings.push(entry(
          'V-CON-05',
          `契约接口 ${key} 的请求参数名疑似占位符：${bad.join('/')}——真实字段名不会是 q1/q2 这种形态`,
          c.file,
        ));
      }
      const method = String(api.method ?? '').toUpperCase();
      if ((method === 'POST' || method === 'PUT') && req.length === 0) {
        warnings.push(entry(
          'V-CON-05',
          `契约接口 ${key} 是写操作却声明空请求体 request: []——请确认确实无入参，而非模板未填`,
          c.file,
        ));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// V-CON-06（error）：契约三方计数一致
// 头部「接口 N 个」/ 人读 `## <METHOD> /path` 小节数 / 机读 yaml apis 条目数，
// 三者必须相等。实测这三处会各自漂移，且漂移后没有任何规则会发现。
// ---------------------------------------------------------------------------

const CONTRACT_SECTION_RE = /^##\s+(GET|POST|PUT|DELETE|PATCH)\s+(\S+)\s*$/gm;
const CONTRACT_HEADER_COUNT_RE = /接口\s*(\d+)\s*个/;

function checkContractCounts(file, text, contracts, errors, warnings) {
  const c = contracts.find((x) => x.file === file);
  if (!c || c.module === null) return; // 无 vima:contract 块的文件由 V-CON-01 负责
  const yamlCount = c.apis.length;

  const sections = [...text.matchAll(CONTRACT_SECTION_RE)];
  if (sections.length > 0 && sections.length !== yamlCount) {
    errors.push(entry(
      'V-CON-06',
      `契约人读小节 ${sections.length} 个与机读 apis ${yamlCount} 条不一致——两处须逐接口一一对应`,
      file,
    ));
  }
  // 人读小节与机读块的键集合比对（数量相同也可能内容不同）
  if (sections.length > 0) {
    const secKeys = new Set(sections.map((m) => `${m[1].toUpperCase()} ${m[2]}`));
    for (const api of c.apis) {
      const k = apiKey(api);
      if (!secKeys.has(k)) {
        errors.push(entry('V-CON-06', `契约机读块声明了 ${k}，但人读小节里没有对应的「## ${k}」`, file));
      }
    }
  }
  const head = CONTRACT_HEADER_COUNT_RE.exec(text.slice(0, 500));
  if (head && Number(head[1]) !== yamlCount) {
    warnings.push(entry(
      'V-CON-06',
      `契约头部声明「接口 ${head[1]} 个」与机读 apis ${yamlCount} 条不一致——头部计数已过期`,
      file,
    ));
  }
}

// ---------------------------------------------------------------------------
// V-SRC-01（warn，选择性启用）：契约端点可溯源到真源锚点
//
// 这是整套规则里唯一的「外部锚点」。其余规则全是 spec ↔ 契约 ↔ 任务之间的内部一致性——
// 当契约是从 spec 反向生成时，那个闭环恒真，虚构端点一条都查不出来（实测：209 个端点里
// 大量虚构路径全数通过校验）。启用方式：在 docs/ 下放锚点清单并在 lifecycle.json 的
// endpointAnchor 指明其相对路径；锚点里逐行出现的 `/api/...` 即视为真实存在的端点。
// 未配置时本规则整条跳过，不影响既有项目。
// ---------------------------------------------------------------------------

const ANCHOR_PATH_RE = /\/api\/[A-Za-z0-9_\-{}/.]*/g;

/**
 * 契约人读小节里被标注「新增需求」的接口键集合——本期新立、真源本就没有，豁免 V-SRC-01。
 * 取 `## <METHOD> <path>` 到下一个 `## ` 之间的正文判定。
 */
function declaredNewRequirements(texts) {
  const out = new Set();
  for (const { text } of texts) {
    const parts = String(text).split(/^## /m);
    for (const part of parts) {
      const m = /^(GET|POST|PUT|DELETE|PATCH)\s+(\S+)\s*$/m.exec(part.split('\n')[0] ?? '');
      if (!m) continue;
      if (/新增需求/.test(part)) out.add(`${m[1].toUpperCase()} ${m[2]}`);
    }
  }
  return out;
}

async function checkEndpointProvenance(root, contracts, warnings, texts = []) {
  let lc = null;
  try {
    lc = await loadLifecycle(root);
  } catch {
    return;
  }
  const anchorRel = typeof lc?.endpointAnchor === 'string' ? lc.endpointAnchor.trim() : '';
  if (anchorRel === '') return;
  let anchorText;
  try {
    anchorText = await readFile(path.join(root, anchorRel), 'utf8');
  } catch {
    warnings.push(entry('V-SRC-01', `endpointAnchor 指向的锚点文件不可读：${anchorRel}`, 'docs/lifecycle.json'));
    return;
  }
  const anchor = new Set();
  for (const m of anchorText.matchAll(ANCHOR_PATH_RE)) anchor.add(normalizePathParams(m[0]));
  if (anchor.size === 0) {
    warnings.push(entry('V-SRC-01', `锚点文件 ${anchorRel} 中未解析出任何 /api 路径，请确认格式`, 'docs/lifecycle.json'));
    return;
  }
  // 例外声明：契约人读小节里带「新增需求」字样的接口豁免（本期新立、真源本就没有）
  const exempt = declaredNewRequirements(texts);
  for (const c of contracts) {
    for (const api of c.apis) {
      const p = typeof api.path === 'string' ? api.path : '';
      if (p === '' || anchor.has(normalizePathParams(p)) || exempt.has(apiKey(api))) continue;
      warnings.push(entry(
        'V-SRC-01',
        `契约接口 ${apiKey(api)} 在真源锚点 ${anchorRel} 中查无实据——若确属本期新立需求，` +
          '请在契约人读小节标注「新增需求」并在评审时确认',
        c.file,
      ));
    }
  }
}

// ---------------------------------------------------------------------------
// 任务规则（V-TASK-01…09）
// ---------------------------------------------------------------------------

/** 页面任务点数（B3 覆盖度基数）：交互数（items 带 action + rowActions）+ 弹窗字段数。 */
function countPagePoints(page) {
  const interactions = collectInteractions(page).length;
  let fields = 0;
  for (const mo of Array.isArray(page.modals) ? page.modals : []) {
    if (mo && typeof mo === 'object' && Array.isArray(mo.fields)) fields += mo.fields.length;
  }
  return interactions + fields;
}

/** 任务正文里出现的接口引用（`GET /api/x`），用于 V-TASK-08 反向对账。 */
const TASK_API_RE = /\b(GET|POST|PUT|DELETE|PATCH)\s+(\/api\/[A-Za-z0-9_\-{}/.]*)/g;

/**
 * 否定式提及：验收清单常写「真源无 GET /api/x」「不请求 GET /api/x」「已废弃」来固化
 * 「这个端点不该被调用」这一约束——这类行里的接口引用是反面教材，不是失效引用。
 * 词表按实际产物里的写法收敛，不做泛化的中文否定判断（「不」单字太常见，会误伤
 * 「不得少于」这类正常措辞）。
 */
const NEGATED_MENTION_RE = /真源无|不存在|已废弃|已移除|已删除|不再|不请求|不调用|不提供|无对应|无该/;

/**
 * V-TASK-08（warn）：任务正文引用的接口必须落在该任务的作用域内。
 * 作用域 = 带 page 时取该页面 apis，否则取 frontmatter.contract 指向契约的 apis。
 * 实测价值：产物重建后，任务验收清单会长期停留在旧端点上（「导出台账」「作废」等按钮
 * 对应的端点早已不存在），而 V-TASK-07 只数复选框个数、不看内容，完全发现不了。
 */
function checkTaskApiRefs(t, spec, contracts, warnings) {
  const scope = new Set();
  let scopeLabel = '';
  if (Array.isArray(t.fm.apis) && t.fm.apis.length > 0) {
    // A18：声明了负责接口集时，作用域收窄到该子集（引用兄弟子任务的端点即失效引用）
    for (const ref of t.fm.apis) scope.add(normalizeApiRef(ref));
    scopeLabel = `任务负责接口集 apis（${scope.size} 条）`;
  } else if (typeof t.fm.page === 'string' && spec?.pages?.has(t.fm.page)) {
    for (const ref of spec.pages.get(t.fm.page).apis ?? []) scope.add(normalizeApiRef(ref));
    scopeLabel = `页面 ${t.fm.page} 的 apis`;
  } else if (typeof t.fm.contract === 'string' && t.fm.contract !== '') {
    const c = contracts.find((x) => x.file === t.fm.contract);
    if (!c) return;
    for (const api of c.apis) scope.add(apiKey(api));
    scopeLabel = `契约 ${t.fm.contract}`;
  } else {
    return;
  }
  if (scope.size === 0) return;
  const seen = new Set();
  for (const line of t.body.split('\n')) {
    if (NEGATED_MENTION_RE.test(line)) continue; // 反面教材行不参与对账
    for (const m of line.matchAll(TASK_API_RE)) {
      const key = `${m[1].toUpperCase()} ${m[2]}`;
      if (seen.has(key) || scope.has(key)) continue;
      seen.add(key);
      warnings.push(entry(
        'V-TASK-08',
        `任务 ${t.id} 正文引用的接口 ${key} 不在${scopeLabel}中——产物变更后验收清单可能已失效`,
        t.file,
      ));
    }
  }
}

/** V-TASK-09（warn）：任务正文内嵌的「N 个接口」计数须与契约条目数一致。 */
const TASK_COUNT_RE = /契约声明的\s*\*{0,2}(\d+)\s*个接口/;

function checkTaskContractCount(t, contracts, warnings) {
  if (typeof t.fm.contract !== 'string' || t.fm.contract === '') return;
  const m = TASK_COUNT_RE.exec(t.body);
  if (!m) return;
  const c = contracts.find((x) => x.file === t.fm.contract);
  if (!c || c.module === null) return;
  if (Number(m[1]) !== c.apis.length) {
    warnings.push(entry(
      'V-TASK-09',
      `任务 ${t.id} 正文写「契约声明的 ${m[1]} 个接口」，而 ${t.fm.contract} 实为 ${c.apis.length} 条——计数已随契约变更漂移`,
      t.file,
    ));
  }
}

// A18：任务规模上限。判据是「均衡」不是「小」——批次时长取批内最大值，
// 超大任务把本可并行的工作串行化（sustain-v3 实测：单任务 4527 行 = 同批最小任务的 7 倍，
// 并行槽空转率 52–54%）。上限取 10 个接口 ≈ 1300 行 ≈ 当前中位任务量级。
const TASK_API_LIMIT = 10;

/** 任务负责的接口集（A18）：声明 apis 时取其归一集，否则取契约全集；无契约返回 null。 */
export function ownedApisOf(t, contracts) {
  if (Array.isArray(t.fm.apis) && t.fm.apis.length > 0) {
    return { keys: new Set(t.fm.apis.map(normalizeApiRef)), declared: true };
  }
  if (typeof t.fm.contract !== 'string' || t.fm.contract === '') return null;
  const c = contracts.find((x) => x.file === t.fm.contract);
  if (!c || c.module === null) return null;
  return { keys: new Set(c.apis.map(apiKey)), declared: false };
}

/**
 * V-TASK-11（warn）任务规模上限 + V-TASK-12（error）负责接口集闭环（A18，契约 §8）。
 * 拆分大任务会引入原本不存在的失败模式（同契约子任务之间漏实现/重复实现），
 * 故拆分能力与其完整性机检同批落地。
 */
function checkTaskApiOwnership(tasks, contracts, errors, warnings) {
  const byContract = new Map(); // 契约文件 → side=backend 的任务列表
  for (const t of tasks) {
    if (t.fm.layer !== 'business') continue;

    // V-TASK-12 第一项：apis 条目须 ∈ 该契约 apis（对任意 side 生效）
    if (Array.isArray(t.fm.apis) && t.fm.apis.length > 0) {
      if (typeof t.fm.contract !== 'string' || t.fm.contract === '') {
        errors.push(entry('V-TASK-12', `任务 ${t.id} 声明了 apis 却没有 contract 字段（无从核对归属）`, t.file));
      } else {
        const c = contracts.find((x) => x.file === t.fm.contract);
        if (c && c.module !== null) {
          const full = new Set(c.apis.map(apiKey));
          for (const raw of t.fm.apis) {
            const key = normalizeApiRef(raw);
            if (!full.has(key)) {
              errors.push(entry(
                'V-TASK-12',
                `任务 ${t.id} 的 apis 含 "${key}"，不在契约 ${t.fm.contract} 中`,
                t.file,
              ));
            }
          }
        }
      }
    }

    // V-TASK-11：规模上限（只对承担实现的 backend/fullstack 任务；前端任务的实际范围由页面决定）
    if (t.fm.side === 'backend' || t.fm.side === 'fullstack') {
      const owned = ownedApisOf(t, contracts);
      // A24/F10：已 done 的任务不参与。本规则的唯一行动项是「拆分任务」，对已完成任务
      // 不可执行——实测 9 个已完成任务长期挂着清不掉的 warn。而 A22 新增的
      // V-SPEC-15/V-CON-08/V-CON-09 全是 warn 且需要人逐条看，warn 列表里躺着一批
      // 永远无法清除的条目会训练出「整个 warn 列表不用看」的习惯，把它们一起废掉。
      // 仅本条豁免：V-TASK-07/08/09 在任务完成后仍可执行（补清单、改引用），不适用。
      if (owned && owned.keys.size > TASK_API_LIMIT && t.fm.status !== 'done') {
        warnings.push(entry(
          'V-TASK-11',
          `任务 ${t.id} 负责 ${owned.keys.size} 个接口，超出上限 ${TASK_API_LIMIT}`
            + `（${owned.declared ? 'frontmatter apis' : `契约 ${t.fm.contract} 全集`}）`
            + '——建议按子域拆成多个任务并用 apis 声明各自负责集（A18：批次时长取批内最大值）',
          t.file,
        ));
      }
      if (typeof t.fm.contract === 'string' && t.fm.contract !== '') {
        if (!byContract.has(t.fm.contract)) byContract.set(t.fm.contract, []);
        if (t.fm.side === 'backend') byContract.get(t.fm.contract).push(t);
      }
    }
  }

  // V-TASK-12 第二/三项：同契约 backend 任务之间不相交；全声明时并集 = 契约全集
  for (const [file, group] of [...byContract.entries()].sort()) {
    const declaredTasks = group.filter((t) => Array.isArray(t.fm.apis) && t.fm.apis.length > 0);
    if (declaredTasks.length === 0) continue;
    const owner = new Map(); // 归一键 → 首个声明它的任务 id
    for (const t of declaredTasks) {
      for (const raw of t.fm.apis) {
        const key = normalizeApiRef(raw);
        if (owner.has(key)) {
          errors.push(entry(
            'V-TASK-12',
            `接口 "${key}" 同时被任务 ${owner.get(key)} 与 ${t.id} 声明负责（同契约 ${file} 内不得重叠）`,
            t.file,
          ));
        } else {
          owner.set(key, t.id);
        }
      }
    }
    // 全部 backend 任务都声明了 apis 才判并集——存在未声明者时它按语义覆盖全集，不构成漏实现
    if (declaredTasks.length === group.length) {
      const c = contracts.find((x) => x.file === file);
      if (c && c.module !== null) {
        const missing = c.apis.map(apiKey).filter((k) => !owner.has(k)).sort();
        if (missing.length > 0) {
          errors.push(entry(
            'V-TASK-12',
            `契约 ${file} 的 ${missing.length} 个接口无任何 backend 任务负责：${missing.join('、')}`,
            file,
          ));
        }
      }
    }
  }
}

/**
 * V-TASK-13（warn）收尾流水线存在性（A20，契约 §8）。
 * 存在业务任务却无 pipeline 任务 ⇒ /go 步骤 5 的「流水线全部通过」恒真，
 * 全量测试与代码审计从未执行。设计期只 warn（不阻断存量项目开工，守 A19
 * 升级可达性）；收口期同一判据由 converge 的 V-INT-05 升级为 error。
 */
function checkPipelinePresence(tasks, warnings) {
  if (!tasks.some((t) => t.fm.layer === 'business')) return;
  if (tasks.some((t) => t.fm.layer === 'pipeline')) return;
  warnings.push(entry(
    'V-TASK-13',
    '存在 business 任务却无任何 layer=pipeline 任务——收尾流水线（全量测试 → 代码审计）'
      + '缺失时 /go 的进阶条件恒真，集成问题无人兜底；请按 docs/tasks/_template-full-test.md 与 _template-code-audit.md '
      + '补 full-test 与 code-audit（A20）',
    'docs/tasks',
  ));
}

async function checkTasks(root, tasks, spec, contracts, errors, warnings, roster = null) {
  checkTaskApiOwnership(tasks, contracts, errors, warnings); // V-TASK-11/12（A18，跨任务分组判定）
  checkPipelinePresence(tasks, warnings); // V-TASK-13（A20，全任务集合判定）
  const ids = new Set(tasks.map((t) => t.id));
  const rosterIds = roster ? new Set(roster.apps.map((a) => a.id)) : null;
  for (const t of tasks) {
    checkTaskApiRefs(t, spec, contracts, warnings);
    checkTaskContractCount(t, contracts, warnings);
    // V-TASK-10 任务端归属（A16）：backend 禁带 app；fe|fullstack 多端必填、声明合法、与 page 同端
    if (roster && roster.apps.length > 0) {
      const declared = typeof t.fm.app === 'string' && t.fm.app !== '' ? t.fm.app : null;
      if (t.fm.side === 'backend') {
        if (declared !== null) {
          errors.push(entry('V-TASK-10', `backend 任务 ${t.id} 不得携带 app 字段（后端单数，A16）`, t.file));
        }
      } else {
        if (declared !== null && !rosterIds.has(declared)) {
          errors.push(entry('V-TASK-10', `任务 ${t.id} 的 app "${declared}" 不在端册（可用：${[...rosterIds].join('|')}）`, t.file));
        } else if (declared === null && roster.multi) {
          errors.push(entry('V-TASK-10', `任务 ${t.id}（side=${t.fm.side}）缺少 app 字段（多端项目必填，端册：${[...rosterIds].join('|')}）`, t.file));
        }
        const tApp = declared ?? (roster.multi ? null : roster.apps[0].id);
        if (tApp && rosterIds.has(tApp) && typeof t.fm.page === 'string' && spec?.pages?.has?.(t.fm.page)) {
          const pApp = appOf(spec.pages.get(t.fm.page), roster);
          if (pApp && rosterIds.has(pApp) && pApp !== tApp) {
            errors.push(entry('V-TASK-10', `任务 ${t.id}（端 ${tApp}）引用了另一端的页面 ${t.fm.page}（端 ${pApp}）——接线错误`, t.file));
          }
        }
      }
    }
    // V-TASK-01 补充：business 任务必须有 contract（frontmatter 结构由 loadTasks 把关）
    if (t.fm.layer === 'business' && (typeof t.fm.contract !== 'string' || t.fm.contract === '')) {
      errors.push(entry('V-TASK-01', `business 任务 ${t.id} 缺少 contract 字段`, t.file));
    }
    // V-TASK-02：验收清单 + 至少 1 个复选框
    if (!/^##\s+验收清单\s*$/m.test(t.body)) {
      errors.push(entry('V-TASK-02', `任务 ${t.id} 缺少「## 验收清单」章节`, t.file));
    } else if (!hasCheckbox(t.body)) {
      errors.push(entry('V-TASK-02', `任务 ${t.id} 的验收清单没有复选框`, t.file));
    }
    // V-TASK-03：contract 指向的文件存在
    if (typeof t.fm.contract === 'string' && t.fm.contract !== '') {
      if (!(await fileExists(path.join(root, t.fm.contract)))) {
        errors.push(entry('V-TASK-03', `任务 ${t.id} 的 contract 指向不存在的文件 "${t.fm.contract}"`, t.file));
      }
    }
    // V-TASK-04：dependsOn 与 conflictsWith（A8）引用的任务均存在
    for (const dep of t.fm.dependsOn) {
      if (!ids.has(dep)) {
        errors.push(entry('V-TASK-04', `任务 ${t.id} 依赖不存在的任务 "${dep}"`, t.file));
      }
    }
    for (const other of t.fm.conflictsWith ?? []) {
      if (!ids.has(other)) {
        errors.push(entry('V-TASK-04', `任务 ${t.id} 的 conflictsWith 指向不存在的任务 "${other}"`, t.file));
      }
    }
    // V-TASK-05（A2 单一真源）：带 page 字段的任务不得手写页面结构
    if (t.fm.page !== undefined) {
      if (/^##\s+页面结构\s*$/m.test(t.body) || t.body.includes('组件树')) {
        errors.push(entry('V-TASK-05', `任务 ${t.id} 带 page 字段却手写「页面结构/组件树」（单一真源 A2：以 spec 数据块为准）`, t.file));
      }
      // V-TASK-06：page 引用存在于 spec pages；spec 缺失/不可解析时同样报错（不静默跳过，契约 §8）
      if (!spec) {
        errors.push(entry('V-TASK-06', `任务 ${t.id} 带 page "${t.fm.page}" 但 docs/spec.md 不可用，无法核对页面引用`, t.file));
      } else if (!spec.pages.has(t.fm.page)) {
        errors.push(entry('V-TASK-06', `任务 ${t.id} 的 page "${t.fm.page}" 不存在于 spec 页面清单`, t.file));
      } else {
        // V-TASK-07（warn，B3 覆盖度）：清单复选框数 < 该页任务点数 → 可能漏点
        const points = countPagePoints(spec.pages.get(t.fm.page));
        const boxes = (t.body.match(/- \[[ xX]\]/g) ?? []).length;
        if (boxes < points) {
          warnings.push(entry(
            'V-TASK-07',
            `任务 ${t.id} 验收清单仅 ${boxes} 项，少于页面 ${t.fm.page} 的任务点数 ${points}` +
              '（交互 + 弹窗字段）——请逐点核对是否漏写',
            t.file,
          ));
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 代码 ↔ 契约对账（V-CODE-01/02，A6）——只扫带 @vima 标注的业务代码
// 作用域自锚定：底座/共享层文件无 @vima 标注，天然不参与；单向对账（代码不得
// 出现契约之外的接口）；实现是否完整由 Verifier 逐点判定负责。
// ---------------------------------------------------------------------------

const MARKER_RE = /@vima\s+[a-z0-9][a-z0-9-]*/;

/** 路径参数归一：契约 `{id}` 与代码模板串 `${expr}` 都归一成 `{*}` 再比对。 */
export function normalizePathParams(p) {
  return p.replace(/\$\{[^}]*\}/g, '{*}').replace(/\{[^}]*\}/g, '{*}');
}

/** 前端调用路径 → 契约键：request baseURL 已是 /api，非 /api 开头的路径补前缀。 */
export function feApiKey(method, rawPath) {
  const withPrefix = rawPath === '/api' || rawPath.startsWith('/api/')
    ? rawPath
    : `/api${rawPath.startsWith('/') ? '' : '/'}${rawPath}`;
  return `${method.toUpperCase()} ${normalizePathParams(withPrefix)}`;
}

/** Mapping 注解括号内的路径：只认 value=/path= 显式指定或首个位置字符串参数。 */
export function mappingPath(inner) {
  if (!inner) return '';
  let m = /(?:value|path)\s*=\s*"([^"]*)"/.exec(inner);
  if (m) return m[1];
  m = /^\s*"([^"]*)"/.exec(inner);
  if (m) return m[1];
  return ''; // 仅 produces= 等具名属性、无路径 → 落在类级基路径上
}

/** 扫描 subdir 下带 @vima 标注的文件（业务代码作用域）。 */
export async function scanMarkedFiles(root, subdir, exts) {
  const dir = path.join(root, subdir);
  if (!(await fileExists(dir))) return [];
  const out = [];
  for (const rel of await walkFiles(dir, { exclude: ['node_modules', 'dist', 'target', '.vima', 'vendor'] })) {
    if (!exts.some((e) => rel.endsWith(e))) continue;
    const text = await readFile(path.join(dir, rel), 'utf8');
    if (!MARKER_RE.test(text)) continue;
    out.push({ rel: `${subdir}/${rel}`, text });
  }
  return out;
}

/**
 * V-CODE-01（A16 端化）：逐端扫描 <dir>/<codeDir>（弃字面量 'src'），
 * request.<method>(路径字面量) 必须 ∈ 契约（含模板串归一），且该接口的 consumers
 * 须含文件归属端（越权调用）。请求门面 request.<verb>(path) 是各 kind 骨架契约，
 * 故一条正则通吃全部端（契约 §8）。
 */
async function checkFrontendCode(root, contractKeys, errors, roster = null, consumersByKey = null) {
  const apps =
    roster && roster.apps.length > 0 ? roster.apps : [{ id: null, dir: '.', codeDir: 'src' }];
  const re = /\brequest\s*\.\s*(get|post|put|delete|patch)\s*(?:<[^>(]*>)?\s*\(\s*(['"`])([^'"`\n]*)\2/g;
  for (const app of apps) {
    const subdir = app.dir === '.' || app.dir === '' ? app.codeDir : `${app.dir}/${app.codeDir}`;
    const files = await scanMarkedFiles(root, subdir, ['.ts', '.tsx', '.vue', '.js', '.mjs']);
    for (const f of files) {
      let m;
      while ((m = re.exec(f.text)) !== null) {
        const key = feApiKey(m[1], m[3]);
        if (!contractKeys.has(key)) {
          errors.push(entry(
            'V-CODE-01',
            `前端调用了契约之外的接口 ${key}（接口以契约为唯一真源：先改契约再写代码，§9.5）`,
            f.rel,
          ));
          continue;
        }
        if (app.id && consumersByKey) {
          const cs = consumersByKey.get(key);
          if (Array.isArray(cs) && !cs.includes(app.id)) {
            errors.push(entry(
              'V-CODE-01',
              `端 ${app.id} 越权调用接口 ${key}（consumers: [${cs.join(', ')}]）——该端未被契约授权（A16）`,
              f.rel,
            ));
          }
        }
      }
    }
  }
}

/** V-CODE-02：后端 @RequestMapping（类级基路径）+ @*Mapping 拼接路径必须 ∈ 契约。 */
async function checkBackendCode(root, contractKeys, errors, roster = null) {
  const backendDir = roster?.backend?.dir ?? 'backend'; // A16：后端目录读端册（单数不变）
  const files = await scanMarkedFiles(root, `${backendDir}/src`, ['.java']);
  const reMapping = /@(Get|Post|Put|Delete|Patch)Mapping\s*(?:\(([^)]*)\))?/g;
  for (const f of files) {
    const baseM = /@RequestMapping\s*\(([^)]*)\)/.exec(f.text);
    const base = baseM ? mappingPath(baseM[1]) : '';
    let m;
    while ((m = reMapping.exec(f.text)) !== null) {
      const sub = mappingPath(m[2] ?? '');
      const joined = (`${base}${sub === '' || sub.startsWith('/') ? '' : '/'}${sub}` || '/').replace(/\/{2,}/g, '/');
      const key = `${m[1].toUpperCase()} ${normalizePathParams(joined)}`;
      if (!contractKeys.has(key)) {
        errors.push(entry(
          'V-CODE-02',
          `后端声明了契约之外的接口 ${key}（接口以契约为唯一真源：先改契约再写代码，§9.5）`,
          f.rel,
        ));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 覆盖矩阵（V-COV-01）
// ---------------------------------------------------------------------------

async function checkCoverage(root, errors, multi = false) {
  const p = path.join(root, COVERAGE_REL);
  let text;
  try {
    text = await readFile(p, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      errors.push(entry('V-COV-01', 'docs/coverage-matrix.md 不存在', COVERAGE_REL));
      return;
    }
    throw err;
  }
  const rows = text.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|') && l.endsWith('|'));
  const isSeparator = (cells) => cells.every((c) => /^:?-{3,}:?$/.test(c));
  const cellsOf = (row) => {
    const cells = [];
    let current = '';
    const inner = row.slice(1, -1);
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === '\\' && inner[i + 1] === '|') {
        current += '|';
        i++;
      } else if (inner[i] === '|') {
        cells.push(current.trim());
        current = '';
      } else {
        current += inner[i];
      }
    }
    cells.push(current.trim());
    return cells;
  };
  const dataRows = [];
  let headerCols = 0;
  let headerCells = null;
  for (const row of rows) {
    const cells = cellsOf(row);
    if (isSeparator(cells)) continue;
    if (headerCols === 0) {
      headerCols = cells.length;
      headerCells = cells; // 首行为表头
      continue;
    }
    dataRows.push(cells);
  }
  if (headerCols < 3) {
    errors.push(entry('V-COV-01', '覆盖矩阵缺少 ≥3 列的对齐表格', COVERAGE_REL));
    return;
  }
  // A16：多端项目首列须为「端」（产物由 vima render-matrix 生成，此处防手改漂移）
  if (multi && headerCells && headerCells[0] !== '端') {
    errors.push(entry('V-COV-01', `多端项目覆盖矩阵首列须为「端」（当前首列：「${headerCells[0]}」）——请重跑 vima render-matrix`, COVERAGE_REL));
  }
  if (dataRows.length === 0) {
    errors.push(entry('V-COV-01', '覆盖矩阵没有数据行', COVERAGE_REL));
    return;
  }
  for (let i = 0; i < dataRows.length; i++) {
    const cells = dataRows[i];
    if (cells.length !== headerCols) {
      errors.push(entry('V-COV-01', `覆盖矩阵第 ${i + 1} 数据行列数为 ${cells.length}，须与表头 ${headerCols} 列一致`, COVERAGE_REL));
    }
    for (let j = 0; j < cells.length; j++) {
      if (cells[j] === '' || /\bTODO\b/i.test(cells[j])) {
        errors.push(entry('V-COV-01', `覆盖矩阵第 ${i + 1} 数据行第 ${j + 1} 列存在缺口（空单元格或 TODO）`, COVERAGE_REL));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// pendingConfirm 收集（V-PEND-01，A 信息源分级）
// ---------------------------------------------------------------------------

/** 深度遍历一个数据块，收集全部 pendingConfirm: true 的条目位置。 */
function collectPendingInBlock(block, fileRel, out) {
  const walk = (value, label) => {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) walk(value[i], `${label}[${i}]`);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    // 条目自带稳定 ID（PAGE-xx/MODAL-xx/ROLE-xx…）时用 ID 作定位根，可读性优先
    const here = typeof value.id === 'string' && value.id !== '' ? value.id : label;
    if (value.pendingConfirm === true) out.push({ where: here, path: fileRel });
    for (const [k, v] of Object.entries(value)) {
      if (k === 'pendingConfirm') continue;
      walk(v, `${here}.${k}`);
    }
  };
  walk(block.data, block.kind);
}

/** 扫描 spec 与全部契约文件里的 vima:* 块，收集 pendingConfirm 条目。 */
async function collectPendingConfirm(root, { includeSpec, includeContracts }, specText) {
  const out = [];
  if (includeSpec && typeof specText === 'string') {
    for (const block of extractBlocks(specText, undefined, { path: SPEC_REL })) collectPendingInBlock(block, SPEC_REL, out);
  }
  if (includeContracts) {
    const dir = path.join(root, 'docs', 'contracts');
    let names = [];
    try {
      names = (await readdir(dir)).filter((n) => n.endsWith('.md') && !n.startsWith('_')).sort();
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    for (const name of names) {
      const rel = `docs/contracts/${name}`;
      const text = await readFile(path.join(dir, name), 'utf8');
      // 解析失败已由 V-CON-01 逐份报告，这里跳过即可——不得让它短路整轮校验
      let blocks = [];
      try {
        blocks = extractBlocks(text, undefined, { path: rel });
      } catch (err) {
        if (!(err instanceof VimaError)) throw err;
        continue;
      }
      for (const block of blocks) collectPendingInBlock(block, rel, out);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

/** --artifact 路径 → 规则组（spec/contracts/tasks/coverage；code 组仅全量校验时跑）。 */
function resolveGroups(artifact) {
  const all = { spec: true, contracts: true, tasks: true, coverage: true, code: true, contractTaskBindings: true };
  if (!artifact) return all;
  const norm = artifact.split(path.sep).join('/').replace(/^\.\//, '');
  if (norm.endsWith('spec.md')) return { spec: true, contracts: false, tasks: false, coverage: false, code: false, contractTaskBindings: false };
  if (norm.includes('docs/contracts')) return { spec: false, contracts: true, tasks: false, coverage: false, code: false, contractTaskBindings: true };
  if (norm.includes('docs/tasks')) return { spec: false, contracts: false, tasks: true, coverage: false, code: false, contractTaskBindings: false };
  if (norm.endsWith('coverage-matrix.md')) return { spec: false, contracts: false, tasks: false, coverage: true, code: false, contractTaskBindings: false };
  throw usageError(`--artifact 无法识别的产物路径 "${artifact}"（支持 spec/contracts/tasks/coverage-matrix）`);
}

/**
 * 校验整个项目的 PLANNING 产物。
 * @param {string} root 项目根
 * @param {{artifact?: string, cliRoot?: string, profile?: string}} [opts] artifact 给定时只跑关联规则组
 * @returns {Promise<{pass: boolean, errors: Array, warnings: Array, pendingConfirm: Array}>}
 */
export async function validateProject(root, { artifact, cliRoot, profile } = {}) {
  const groups = profile === 'planning-brief'
    ? { spec: true, contracts: true, tasks: false, coverage: false, code: false, contractTaskBindings: false }
    : resolveGroups(artifact);
  const errors = [];
  const warnings = [];

  // A16 端册：全部端化规则的口径来源（apps 空 = 无前端语义项目，端化规则整体退化为现状）
  const roster = await resolveApps(root, { cliRoot });

  // A34 V-DSN-12 的豁免口径：pre-A34 项目标 designCapability: legacy（D-A34-18 存量迁移），
  // 其页面允许缺 fidelity。lifecycle 读不到时按 legacy 处理——校验不该因状态文件缺失而误伤。
  let lifecycleForDesign = null;
  try {
    lifecycleForDesign = await loadLifecycle(root);
  } catch {
    /* 无 lifecycle：按 legacy 豁免 */
  }
  const designCapability = designCapabilityOf(lifecycleForDesign);
  const scopedDesignPages = new Set(designScopePagesOf(lifecycleForDesign));

  // ── 数据装载（各自失败降级为对应规则的 error，不中断其他组）──
  let spec = null;
  try {
    spec = await loadSpec(root);
  } catch (err) {
    if (!(err instanceof VimaError)) throw err;
    if (groups.spec) errors.push(entry('V-SPEC-01', `docs/spec.md 不可用：${err.message}`, SPEC_REL));
  }
  let contracts = [];
  try {
    // tolerant：坏契约不再让整轮校验短路，逐份报告后继续——避免「修一个才发现下一个」的往返
    contracts = await loadContracts(root, { tolerant: true });
  } catch (err) {
    if (!(err instanceof VimaError)) throw err;
    if (groups.contracts) errors.push(entry('V-CON-01', `契约文件不可解析：${err.message}`, err.path ?? 'docs/contracts'));
  }
  if (groups.contracts) {
    for (const c of contracts.filter((x) => x.parseError)) {
      errors.push(entry('V-CON-01', `契约文件不可解析：${c.parseError}`, c.file));
    }
  }
  // 解析失败的契约不参与后续规则（避免用空 apis 误报孤儿/成对/唯一性）
  contracts = contracts.filter((c) => !c.parseError);
  let tasks = [];
  if (groups.tasks || groups.contractTaskBindings) {
    try {
      tasks = await loadTasks(root);
    } catch (err) {
      if (!(err instanceof VimaError)) throw err;
      if (groups.tasks) errors.push(entry('V-TASK-01', `任务文件不合法：${err.message}`, err.path ?? 'docs/tasks'));
    }
  }

  // ── spec 组：V-SPEC-01…14 + V-DEC-01 + V-YAML-01 ──
  if (groups.spec && spec) {
    checkChapters(spec, errors);
    checkEntities(spec, errors);
    errors.push(...validatePages(spec, roster));
    checkRolesMenus(spec, errors, roster);
    checkAppCoverage(spec, errors, roster);
    checkPageApisInContracts(spec, contracts, errors, roster);
    checkRules(spec, contracts, errors);
    checkFlows(spec, contracts, errors, warnings); // A33：V-SPEC-17/18
    checkNonGoals(spec, errors);
    checkDecisionTable(spec, errors);
    checkFlowBraces(spec.text, SPEC_REL, warnings);
    // A22：字段级下探。V-SPEC-15 需要契约（跨文件），仅当契约组也在跑时才有意义；
    // V-SPEC-16 只看 spec 自身。两者都不进 validatePages——render 不依赖导航参数，
    // 不该因参数取值域问题拒绝出人审产物。
    checkNavParams(spec, errors);
    if (groups.contracts) checkModalFields(spec, contracts, warnings);

    // ── V-DSN-12（A34 D-A34-01）：fidelity 必须显式声明 ──
    // A27 的「全部可选、未声明零影响」口径适用于增量润色，**不适用于一条以「堵逃生口」为目的的机制**：
    // 不写 fidelity → 不是 D1/D2 → 跳过全部设计流程、全绿进开发，正是 A34 要治的那个洞。
    // D0 是一次明确裁定，不能用「缺失」等价替代。legacy 项目整体豁免（D-A34-18）。
    if (designCapability !== 'legacy' || scopedDesignPages.size > 0) {
      for (const [id, page] of spec.pages) {
        if (designCapability === 'legacy' && !scopedDesignPages.has(id)) continue;
        const fid = page?.design?.fidelity;
        if (fid === undefined) {
          errors.push(entry(
            'V-DSN-12',
            `页面 ${id} 未声明 design.fidelity——A34 起每页必须显式定级（D0/D1/D2），`
              + 'D0 也要写出来（「缺失」不等价于 D0）',
            SPEC_REL,
          ));
        }
      }
    }

    // ── V-DSN warn 族（A27）：收纳提示与信息优先级——候选清单不是判决，恒 warn ──
    for (const [id, page] of spec.pages) {
      const components = Array.isArray(page.components) ? page.components : [];
      for (const [i, comp] of components.entries()) {
        if (!comp || typeof comp !== 'object') continue;
        const rows = Array.isArray(comp.rowActions) ? comp.rowActions : [];
        if (rows.length > 3 && !rows.some((r) => r && typeof r === 'object' && r.priority === 'overflow')) {
          warnings.push(entry(
            'V-DSN-06',
            `页面 ${id} 的 components[${i}].rowActions 有 ${rows.length} 条且无一条 overflow——` +
              '建议把低频动作标 priority: overflow 收进「更多」（骨架 ActionGroup 按密度档收纳）',
            SPEC_REL,
          ));
        }
        if (comp.data && typeof comp.data === 'object' && comp.data.shape === 'list' &&
            !(Array.isArray(comp.data.keyFields) && comp.data.keyFields.length > 0)) {
          warnings.push(entry(
            'V-DSN-08',
            `页面 ${id} 的 components[${i}]（shape: list）未声明 keyFields——` +
              '列表没有主字段，渲染与实现都只能瞎排信息优先级',
            SPEC_REL,
          ));
        }
      }
    }
  }

  // ── 契约组：V-CON-01…07 + V-YAML-01 + V-SRC-01 ──
  if (groups.contracts) {
    checkContracts(contracts, spec, tasks, errors, warnings, roster, {
      checkTaskBindings: groups.contractTaskBindings,
    });
    const texts = await readContractTexts(root);
    for (const { file, text } of texts) {
      checkFlowBraces(text, file, warnings);
      checkContractCounts(file, text, contracts, errors, warnings);
    }
    checkPlaceholders(contracts, warnings);
    checkFieldFaces(contracts, warnings); // A22/F2
    checkJsonSubSchema(contracts, warnings); // A22/F4
    await checkEndpointProvenance(root, contracts, warnings, texts);
  }

  // ── 任务组：V-TASK-01…10 ──
  if (groups.tasks) {
    await checkTasks(root, tasks, spec, contracts, errors, warnings, roster);
  }

  // ── 覆盖矩阵：V-COV-01 ──
  if (groups.coverage) {
    await checkCoverage(root, errors, roster.multi);
  }

  // ── 代码 ↔ 契约对账：V-CODE-01/02（A6；带 @vima 标注的业务代码才参与）──
  if (groups.code) {
    const contractKeys = new Set();
    const consumersByKey = new Map(); // 归一键 → consumers（A16 越权判定；null=多端未声明，V-CON-07 已报）
    for (const c of contracts) {
      for (const api of c.apis) {
        if (typeof api.method === 'string' && api.method !== '' && typeof api.path === 'string' && api.path !== '') {
          const key = `${api.method.toUpperCase()} ${normalizePathParams(api.path)}`;
          contractKeys.add(key);
          consumersByKey.set(key, consumersOf(api, roster));
        }
      }
    }
    await checkFrontendCode(root, contractKeys, errors, roster, consumersByKey);
    await checkBackendCode(root, contractKeys, errors, roster);
  }

  // ── V-PEND-01（warn）：收集 pendingConfirm 条目进报告 ──
  const pendingConfirm = await collectPendingConfirm(
    root,
    { includeSpec: groups.spec && spec !== null, includeContracts: groups.contracts },
    spec?.text,
  );
  if (pendingConfirm.length > 0) {
    warnings.push(entry(
      'V-PEND-01',
      `存在 ${pendingConfirm.length} 处 pendingConfirm 推断项待用户确认（approve 时阻断）`,
      pendingConfirm[0].path,
    ));
  }

  if (profile === 'planning-brief') {
    const scopedErrors = errors.filter((e) => PLANNING_BRIEF_RULE.test(e.rule));
    const scopedWarnings = warnings.filter((e) => PLANNING_BRIEF_RULE.test(e.rule));
    return { pass: scopedErrors.length === 0, errors: scopedErrors, warnings: scopedWarnings, pendingConfirm };
  }
  return { pass: errors.length === 0, errors, warnings, pendingConfirm };
}

function formatLine(e) {
  return `${e.rule}: ${e.message} (${e.path})`;
}

/** vima validate [--artifact <path>] */
export async function run(argv, ctx) {
  let opts;
  try {
    ({ values: opts } = parseArgs({
      args: argv,
      options: { artifact: { type: 'string' } },
      allowPositionals: false,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }

  const root = ctx.cwd;
  const result = await validateProject(root, { artifact: opts.artifact, cliRoot: ctx.cliRoot });

  // 报告落盘（§6.8）
  await atomicWriteFile(
    path.join(root, REPORT_REL),
    stableStringify({
      schemaVersion: '1',
      pass: result.pass,
      errors: result.errors,
      warnings: result.warnings,
      pendingConfirm: result.pendingConfirm,
    }),
  );

  // ❌/⚠️ 诊断走 stderr；待确认清单与统计行走 stdout（契约 §3 输出流向）
  const diag = [];
  if (result.errors.length > 0) {
    diag.push('❌ 错误：');
    for (const e of result.errors) diag.push(`  ${formatLine(e)}`);
  }
  if (result.warnings.length > 0) {
    diag.push('⚠️ 警告：');
    for (const w of result.warnings) diag.push(`  ${formatLine(w)}`);
  }
  if (diag.length > 0) process.stderr.write(`${diag.join('\n')}\n`);

  const out = [];
  if (result.pendingConfirm.length > 0) {
    out.push('待确认（pendingConfirm 推断项）：');
    for (const p of result.pendingConfirm) out.push(`  ${p.where} (${p.path})`);
  }
  out.push(`校验完成：${result.errors.length} 错误 / ${result.warnings.length} 警告 / ${result.pendingConfirm.length} 待确认（报告：${REPORT_REL}）`);
  process.stdout.write(`${out.join('\n')}\n`);

  if (!result.pass) return EXIT.CHECK_FAILED;

  // 全量通过 → lifecycle 存在时置 artifactsValidated（--artifact 局部校验不落章，避免虚假的绿）
  if (!opts.artifact) {
    try {
      const lifecycle = await loadLifecycle(root);
      lifecycle.checklists ??= {};
      lifecycle.checklists.PLANNING ??= {};
      lifecycle.checklists.PLANNING.artifactsValidated = true;
      await saveLifecycle(root, lifecycle);
    } catch (err) {
      if (!(err instanceof VimaError && err.code === 'NO_LIFECYCLE')) throw err;
    }
  }
  return EXIT.OK;
}
