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

const SPEC_REL = 'docs/spec.md';
const COVERAGE_REL = 'docs/coverage-matrix.md';
const REPORT_REL = '.vima/reports/planning-validation.json';

// V-SPEC-01：八章标题前缀（level 2，第八章为 A4 吸收项）
const REQUIRED_CHAPTERS = [
  '1. 系统概述', '2. 数据模型', '3. 页面清单', '4. 接口清单',
  '5. 业务规则', '6. 权限设计', '7. 技术栈', '8. 关键决策记录',
];

// V-SPEC-04：布局/区块枚举词表（§7 vima:page）
const LAYOUT_VOCAB = new Set(['toolbar', 'search', 'table', 'form', 'cards', 'tabs', 'pagination']);

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
export function validatePages(spec) {
  const errors = [];
  const pages = spec.pages instanceof Map ? spec.pages : new Map();

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

  // ── V-SPEC-04 词表约束 ──
  for (const [id, page] of pages) {
    const layout = Array.isArray(page.layout) ? page.layout : [];
    for (const word of layout) {
      if (!LAYOUT_VOCAB.has(word)) {
        errors.push(entry('V-SPEC-04', `页面 ${id} 的 layout 含非法词 "${word}"（词表：${[...LAYOUT_VOCAB].join('|')}）`, SPEC_REL));
      }
    }
    const components = Array.isArray(page.components) ? page.components : [];
    for (const comp of components) {
      const block = comp && typeof comp === 'object' ? comp.block : undefined;
      if (!LAYOUT_VOCAB.has(block)) {
        errors.push(entry('V-SPEC-04', `页面 ${id} 的 components 含非法区块 "${block}"（词表：${[...LAYOUT_VOCAB].join('|')}）`, SPEC_REL));
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
    for (const block of extractBlocks(spec.text, 'page')) {
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
  const blocks = typeof spec.text === 'string' ? extractBlocks(spec.text, 'entities') : [];
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

function checkRolesMenus(spec, errors) {
  const menus = Array.isArray(spec.menus) ? spec.menus : [];
  const roles = Array.isArray(spec.roles) ? spec.roles : [];
  const menuIds = new Set(menus.map((m) => m?.id).filter((v) => typeof v === 'string'));
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

/** 把 "get /api/x" 形式的接口串归一为 "GET /api/x"。 */
function normalizeApiRef(s) {
  const str = String(s ?? '').trim();
  const idx = str.indexOf(' ');
  if (idx < 0) return str.toUpperCase();
  return `${str.slice(0, idx).toUpperCase()} ${str.slice(idx + 1).trim()}`;
}

function checkPageApisInContracts(spec, contracts, errors) {
  const contractKeys = new Set();
  for (const c of contracts) {
    for (const api of c.apis) contractKeys.add(apiKey(api));
  }
  for (const [id, page] of spec.pages) {
    for (const ref of Array.isArray(page.apis) ? page.apis : []) {
      if (!contractKeys.has(normalizeApiRef(ref))) {
        errors.push(entry('V-SPEC-07', `页面 ${id} 引用的接口 "${ref}" 不在任何契约中`, SPEC_REL));
      }
    }
  }
  // V-SPEC-08：菜单功能点接口闭环——feature.api（存在时）必须在契约中（§13.2 视图②）
  for (const menu of Array.isArray(spec.menus) ? spec.menus : []) {
    for (const f of Array.isArray(menu?.features) ? menu.features : []) {
      if (f && typeof f === 'object' && typeof f.api === 'string' && f.api !== '' && !contractKeys.has(normalizeApiRef(f.api))) {
        errors.push(entry('V-SPEC-08', `菜单 ${menu.id} 的功能点「${f.name ?? '(未命名)'}」引用的接口 "${f.api}" 不在任何契约中`, SPEC_REL));
      }
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

function checkContracts(contracts, spec, tasks, errors, warnings) {
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

  // V-CON-03：每个契约 module 前后端任务成对（fullstack 视为两端皆可承接）
  for (const c of contracts) {
    if (c.module === null) continue;
    const refs = tasks.filter((t) => t.fm.contract === c.file);
    const hasFe = refs.some((t) => t.fm.side === 'frontend' || t.fm.side === 'fullstack');
    const hasBe = refs.some((t) => t.fm.side === 'backend' || t.fm.side === 'fullstack');
    if (!hasFe || !hasBe) {
      const lack = [!hasFe ? 'frontend' : null, !hasBe ? 'backend' : null].filter(Boolean).join(' 与 ');
      errors.push(entry('V-CON-03', `契约模块 "${c.module}" 缺少 ${lack} 任务引用（前后端须成对）`, c.file));
    }
  }
}

// ---------------------------------------------------------------------------
// 任务规则（V-TASK-01…07）
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

async function checkTasks(root, tasks, spec, errors, warnings) {
  const ids = new Set(tasks.map((t) => t.id));
  for (const t of tasks) {
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

/** V-CODE-01：前端 request.<method>(路径字面量) 必须 ∈ 契约（含模板串归一）。 */
async function checkFrontendCode(root, contractKeys, errors) {
  const files = await scanMarkedFiles(root, 'src', ['.ts', '.tsx', '.vue', '.js', '.mjs']);
  const re = /\brequest\s*\.\s*(get|post|put|delete|patch)\s*(?:<[^>(]*>)?\s*\(\s*(['"`])([^'"`\n]*)\2/g;
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
      }
    }
  }
}

/** V-CODE-02：后端 @RequestMapping（类级基路径）+ @*Mapping 拼接路径必须 ∈ 契约。 */
async function checkBackendCode(root, contractKeys, errors) {
  const files = await scanMarkedFiles(root, 'backend/src', ['.java']);
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

async function checkCoverage(root, errors) {
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
  for (const row of rows) {
    const cells = cellsOf(row);
    if (isSeparator(cells)) continue;
    if (headerCols === 0) {
      headerCols = cells.length;
      continue; // 首行为表头
    }
    dataRows.push(cells);
  }
  if (headerCols < 3) {
    errors.push(entry('V-COV-01', '覆盖矩阵缺少 ≥3 列的对齐表格', COVERAGE_REL));
    return;
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
    for (const block of extractBlocks(specText)) collectPendingInBlock(block, SPEC_REL, out);
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
      for (const block of extractBlocks(text)) collectPendingInBlock(block, rel, out);
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
export async function validateProject(root, { artifact } = {}) {
  const groups = resolveGroups(artifact);
  const errors = [];
  const warnings = [];

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
    contracts = await loadContracts(root);
  } catch (err) {
    if (!(err instanceof VimaError)) throw err;
    if (groups.contracts) errors.push(entry('V-CON-01', `契约文件不可解析：${err.message}`, err.path ?? 'docs/contracts'));
  }
  let tasks = [];
  try {
    tasks = await loadTasks(root);
  } catch (err) {
    if (!(err instanceof VimaError)) throw err;
    if (groups.tasks) errors.push(entry('V-TASK-01', `任务文件不合法：${err.message}`, err.path ?? 'docs/tasks'));
  }

  // ── spec 组：V-SPEC-01…07 + V-DEC-01 ──
  if (groups.spec && spec) {
    checkChapters(spec, errors);
    checkEntities(spec, errors);
    errors.push(...validatePages(spec));
    checkRolesMenus(spec, errors);
    checkPageApisInContracts(spec, contracts, errors);
    checkDecisionTable(spec, errors);
  }

  // ── 契约组：V-CON-01…03 ──
  if (groups.contracts) {
    checkContracts(contracts, spec, tasks, errors, warnings);
  }

  // ── 任务组：V-TASK-01…07 ──
  if (groups.tasks) {
    await checkTasks(root, tasks, spec, errors, warnings);
  }

  // ── 覆盖矩阵：V-COV-01 ──
  if (groups.coverage) {
    await checkCoverage(root, errors);
  }

  // ── 代码 ↔ 契约对账：V-CODE-01/02（A6；带 @vima 标注的业务代码才参与）──
  if (groups.code) {
    const contractKeys = new Set();
    for (const c of contracts) {
      for (const api of c.apis) {
        if (typeof api.method === 'string' && api.method !== '' && typeof api.path === 'string' && api.path !== '') {
          contractKeys.add(`${api.method.toUpperCase()} ${normalizePathParams(api.path)}`);
        }
      }
    }
    await checkFrontendCode(root, contractKeys, errors);
    await checkBackendCode(root, contractKeys, errors);
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
  const result = await validateProject(root, { artifact: opts.artifact });

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
