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
import { loadLifecycle, saveLifecycle } from '../model/lifecycle.mjs';
import { resolveApps, appOf, consumersOf, BUILTIN_KINDS } from '../model/apps.mjs';

const SPEC_REL = 'docs/spec.md';
const COVERAGE_REL = 'docs/coverage-matrix.md';
const REPORT_REL = '.vima/reports/planning-validation.json';

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
const LAYOUT_VOCAB = new Set(['toolbar', 'search', 'table', 'form', 'cards', 'tabs', 'pagination']);

// V-SPEC-12：分栏列宽（A14 regions）——固定列 <n>px 或弹性列 <n>fr
const REGION_WIDTH = /^(?:\d+(?:\.\d+)?px|\d+(?:\.\d+)?fr)$/;

// 交互三种（§13.3）：action → 必须携带的目标字段
const ACTIONS = new Set(['nav', 'modal', 'api']);

function entry(rule, message, p) {
  return { rule, message, path: p };
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
      dup(block.data?.id, 'PAGE');
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
  return s.replace(/'[^']*'|"[^"]*"/g, (m) => ' '.repeat(m.length));
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
        if (depth > 0) { out.push({ line: i + 1, text: line.trim() }); break; }
        depth++; // 本行自身的 flow 映射起始
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
function normalizeApiRef(s) {
  const str = String(s ?? '').trim();
  const idx = str.indexOf(' ');
  if (idx < 0) return str.toUpperCase();
  return `${str.slice(0, idx).toUpperCase()} ${str.slice(idx + 1).trim()}`;
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

function checkContracts(contracts, spec, tasks, errors, warnings, roster = null) {
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
  // 无前端语义项目（apps 空）保持旧口径。
  for (const c of contracts) {
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
  if (typeof t.fm.page === 'string' && spec?.pages?.has(t.fm.page)) {
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

async function checkTasks(root, tasks, spec, contracts, errors, warnings, roster = null) {
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
function normalizePathParams(p) {
  return p.replace(/\$\{[^}]*\}/g, '{*}').replace(/\{[^}]*\}/g, '{*}');
}

/** 前端调用路径 → 契约键：request baseURL 已是 /api，非 /api 开头的路径补前缀。 */
function feApiKey(method, rawPath) {
  const withPrefix = rawPath === '/api' || rawPath.startsWith('/api/')
    ? rawPath
    : `/api${rawPath.startsWith('/') ? '' : '/'}${rawPath}`;
  return `${method.toUpperCase()} ${normalizePathParams(withPrefix)}`;
}

/** Mapping 注解括号内的路径：只认 value=/path= 显式指定或首个位置字符串参数。 */
function mappingPath(inner) {
  if (!inner) return '';
  let m = /(?:value|path)\s*=\s*"([^"]*)"/.exec(inner);
  if (m) return m[1];
  m = /^\s*"([^"]*)"/.exec(inner);
  if (m) return m[1];
  return ''; // 仅 produces= 等具名属性、无路径 → 落在类级基路径上
}

/** 扫描 subdir 下带 @vima 标注的文件（业务代码作用域）。 */
async function scanMarkedFiles(root, subdir, exts) {
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
  const cellsOf = (row) => row.slice(1, -1).split('|').map((c) => c.trim());
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
  const all = { spec: true, contracts: true, tasks: true, coverage: true, code: true };
  if (!artifact) return all;
  const norm = artifact.split(path.sep).join('/').replace(/^\.\//, '');
  if (norm.endsWith('spec.md')) return { spec: true, contracts: false, tasks: false, coverage: false, code: false };
  if (norm.includes('docs/contracts')) return { spec: false, contracts: true, tasks: false, coverage: false, code: false };
  if (norm.includes('docs/tasks')) return { spec: false, contracts: false, tasks: true, coverage: false, code: false };
  if (norm.endsWith('coverage-matrix.md')) return { spec: false, contracts: false, tasks: false, coverage: true, code: false };
  throw usageError(`--artifact 无法识别的产物路径 "${artifact}"（支持 spec/contracts/tasks/coverage-matrix）`);
}

/**
 * 校验整个项目的 PLANNING 产物。
 * @param {string} root 项目根
 * @param {{artifact?: string}} [opts] artifact 给定时只跑关联规则组
 * @returns {Promise<{pass: boolean, errors: Array, warnings: Array, pendingConfirm: Array}>}
 */
export async function validateProject(root, { artifact, cliRoot } = {}) {
  const groups = resolveGroups(artifact);
  const errors = [];
  const warnings = [];

  // A16 端册：全部端化规则的口径来源（apps 空 = 无前端语义项目，端化规则整体退化为现状）
  const roster = await resolveApps(root, { cliRoot });

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
  try {
    tasks = await loadTasks(root);
  } catch (err) {
    if (!(err instanceof VimaError)) throw err;
    if (groups.tasks) errors.push(entry('V-TASK-01', `任务文件不合法：${err.message}`, err.path ?? 'docs/tasks'));
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
    checkNonGoals(spec, errors);
    checkDecisionTable(spec, errors);
    checkFlowBraces(spec.text, SPEC_REL, warnings);
  }

  // ── 契约组：V-CON-01…07 + V-YAML-01 + V-SRC-01 ──
  if (groups.contracts) {
    checkContracts(contracts, spec, tasks, errors, warnings, roster);
    const texts = await readContractTexts(root);
    for (const { file, text } of texts) {
      checkFlowBraces(text, file, warnings);
      checkContractCounts(file, text, contracts, errors, warnings);
    }
    checkPlaceholders(contracts, warnings);
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
