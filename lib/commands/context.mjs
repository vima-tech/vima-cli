// vima context —— 任务上下文确定性打包（A8，契约 §6.11/§14；设计依据：市场对标报告
// docs/design/ai-scaffold-benchmarks.md §2.2 的三重收敛——上游编译、下游不自由检索）。
// 把一个任务开工所需的规划上下文机械汇编为单文件：任务原文 + 契约原文 + spec 页面块 +
// 按受限词表映射的组件文档切片 + 业务规则切片 + 本期不做（A13）+ 编码规范；
// stdout 输出分节字节计量。
// 上下文预算首次成为机检项：--budget 超限 → 包仍写盘（便于排查）但 exit 2。
// 确定性：内容只取输入文件，无时间戳——同输入必得同字节。
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { VimaError, EXIT, usageError, checkFailed, precondition, usageFromParseArgs } from '../util/errors.mjs';
import { atomicWriteFile, fileExists, walkFiles } from '../util/fs.mjs';
import { extractBlocks } from '../util/md.mjs';
import { loadTasks } from '../model/tasks.mjs';
import { resolveApps, appOf } from '../model/apps.mjs';

// 受限词表 → 组件映射（契约 §6.11 唯一依据，与 spec 词表 V-SPEC-04 同步演进）
const BLOCK_COMPONENTS = {
  table: ['VTable'],
  pagination: ['VPagination'],
  search: ['VForm', 'VFormItem'],
  form: ['VForm', 'VFormItem'],
  tabs: ['VTab', 'VTabItem'],
  cards: ['VCard'],
  toolbar: ['VButton'],
  // A27 新词（admin-web 词表 +3，契约 §7）
  steps: ['VSteps', 'VStep'],
  collapse: ['VCollapse', 'VCollapseItem'],
  anchor: ['VLink'],
};
const TYPE_COMPONENTS = {
  input: ['VInput'],
  select: ['VSelect'],
  textarea: ['VTextarea'],
  number: ['VInputNumber'],
  date: ['VDatePicker'],
  time: ['VTimePicker'],
  radio: ['VRadioGroup', 'VRadio'],
  checkbox: ['VCheckboxGroup', 'VCheckbox'],
  switch: ['VSwitch'],
  button: ['VButton'],
  upload: ['VUpload'],
  tree: ['VTree'],
};

/**
 * 从 vima:page 数据块收集应打包的组件名（去重排序，未知词静默跳过）。
 * A16：kind 声明 componentMap（{ 布局词/控件 type → 组件文档名数组 }）时以其为映射真源；
 * 缺省 = 内置 admin-web 表（契约 §6.3/§14——mp-native 须随 Wave 2 ui-docs 显式声明）。
 */
export function componentsOfPage(page, componentMap = null) {
  const blockMap = componentMap ?? BLOCK_COMPONENTS;
  const typeMap = componentMap ?? TYPE_COMPONENTS;
  const names = new Set();
  const addAll = (list) => (list ?? []).forEach((n) => names.add(n));
  for (const word of Array.isArray(page.layout) ? page.layout : []) addAll(blockMap[word]);
  const components = Array.isArray(page.components) ? page.components : [];
  for (const comp of components) {
    if (comp && typeof comp === 'object') {
      addAll(blockMap[comp.block]);
      for (const item of Array.isArray(comp.items) ? comp.items : []) {
        if (item && typeof item === 'object') addAll(typeMap[item.type]);
      }
    }
  }
  const modals = Array.isArray(page.modals) ? page.modals : [];
  // A23：弹窗承载组件原先硬编码 VLayer，绕过了 componentMap 这个映射真源——
  // mp 端的弹层是 VmPopup，写死 VLayer 等于该端弹窗切片恒空。改由 componentMap 的
  // `modal` 键决定；admin-web 不声明 componentMap，回落 VLayer，行为逐字节不变。
  if (modals.length > 0) addAll(blockMap.modal ?? ['VLayer']);
  // A27：presentation: drawer 的弹窗额外注入 VDrawer 文档（componentMap 有 drawer 键时以其为准）
  if (modals.some((mo) => mo && typeof mo === 'object' && mo.presentation === 'drawer')) {
    addAll(blockMap.drawer ?? ['VDrawer']);
  }
  for (const mo of modals) {
    for (const f of Array.isArray(mo?.fields) ? mo.fields : []) {
      // 同上：这里原先写死 TYPE_COMPONENTS，声明了 componentMap 的端弹窗字段一样取不到组件
      if (f && typeof f === 'object') addAll(typeMap[f.type]);
    }
  }
  return [...names].sort();
}

const bytesOf = (s) => Buffer.byteLength(s, 'utf8');

/** 接口串归一为 `METHOD /path`（与 validate.normalizeApiRef / audit-view.normApiKey 同构）。 */
function normApi(s) {
  const str = String(s ?? '').trim();
  const i = str.indexOf(' ');
  if (i < 0) return str.toUpperCase();
  return `${str.slice(0, i).toUpperCase()} ${str.slice(i + 1).trim()}`;
}

/** 接口小节标题：`## <METHOD> <path>`，允许 `## GET /a / POST /b` 的多接口写法。 */
const API_HEADING_RE = /^##\s+((?:GET|POST|PUT|DELETE|PATCH)\s+\/\S*(?:\s*\/\s*(?:GET|POST|PUT|DELETE|PATCH)\s+\/\S*)*)\s*$/;

/**
 * A18 契约切片（契约 §6.11）：任务声明 `apis` 负责集时，只保留本任务负责的接口小节，
 * 非接口小节（头部说明、错误码表、共享类型、机读块）原样保留；机读块 apis 同步过滤。
 * 多接口标题按 `/` 拆开逐个判定，**任一命中即整段保留**（保守侧，宁多勿漏）。
 * @param {string} text 契约原文
 * @param {Set<string>} owned 归一后的负责接口键集合
 * @returns {{text: string, kept: number, dropped: number}}
 */
export function sliceContract(text, owned) {
  const lines = text.split('\n');
  const out = [];
  let kept = 0;
  let dropped = 0;
  let skipping = false;
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) inFence = !inFence;
    const m = inFence ? null : API_HEADING_RE.exec(line);
    if (m) {
      const hit = m[1]
        .split(/\s*\/\s*(?=GET|POST|PUT|DELETE|PATCH)/)
        .some((one) => owned.has(normApi(one)));
      skipping = !hit;
      if (hit) kept += 1;
      else dropped += 1;
    } else if (!inFence && /^##\s+/.test(line)) {
      skipping = false; // 非接口小节一律保留（错误码表 / 共享类型 / 机读块）
    }
    if (!skipping) out.push(line);
  }
  return { text: out.join('\n'), kept, dropped };
}

/**
 * A18：机读 vima:contract 块的 apis 数组同步过滤为负责集（其余键不动）。
 * 在切片后的文本上做行级过滤——块内每个 `- method:` 条目起一段，不属负责集的整段删除。
 */
export function sliceContractBlock(text, owned) {
  const lines = text.split('\n');
  const out = [];
  let inBlock = false;
  let inApis = false;
  let entryLines = null;
  let entryIndent = null; // 条目缩进：apis 下第一个 `- ` 的缩进量；更深的 `- ` 是条目内嵌套项
  /** 条目键取自条目内的 method + path；两者缺一 → 键为 null，保守保留（宁多勿漏）。 */
  const flush = () => {
    if (entryLines === null) return;
    const joined = entryLines.join('\n');
    const method = /method:\s*"?([A-Za-z]+)"?/.exec(joined);
    const p = /path:\s*"?([^"\s]+)"?/.exec(joined);
    const key = method && p ? normApi(`${method[1]} ${p[1]}`) : null;
    if (key === null || owned.has(key)) out.push(...entryLines);
    entryLines = null;
  };
  for (const line of lines) {
    if (/^```yaml\s+vima:contract\s*$/.test(line)) { inBlock = true; out.push(line); continue; }
    if (inBlock && /^```\s*$/.test(line)) { flush(); inApis = false; inBlock = false; out.push(line); continue; }
    if (!inBlock) { out.push(line); continue; }
    if (/^apis:\s*$/.test(line)) { flush(); inApis = true; entryIndent = null; out.push(line); continue; }
    if (inApis && /^\S/.test(line)) { flush(); inApis = false; out.push(line); continue; }
    if (!inApis) { out.push(line); continue; }
    const dash = /^(\s+)-\s/.exec(line);
    if (dash && (entryIndent === null || dash[1].length === entryIndent)) {
      if (entryIndent === null) entryIndent = dash[1].length;
      flush();
      entryLines = [line];
    } else if (entryLines !== null) {
      entryLines.push(line);
    } else {
      out.push(line);
    }
  }
  flush();
  return out.join('\n');
}

/**
 * A13 业务规则切片的过滤（契约 §6.11）：规则入选 ⟺ 无 apis 字段（全局规则）
 * 或 rule.apis 与任务 apis 集合有交集。输出按 id 升序，保证同输入同字节。
 */
export function rulesForTask(rules, taskApis) {
  return (Array.isArray(rules) ? rules : [])
    .filter((r) => {
      if (!r || typeof r !== 'object') return false;
      if (!Array.isArray(r.apis)) return true; // 全局规则
      return r.apis.some((a) => taskApis.has(normApi(a)));
    })
    .slice()
    .sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')));
}

/** 读文件，缺失返回 null（存在性问题归 validate/doctor，打包只标注跳过）。 */
// ---------------------------------------------------------------------------
// A22 检索线一：系统底座接口索引
// 实测最大的系统性返工源——Builder 把 docs/contracts/ 当唯一事实来源，于是
// 「契约里没写」=「系统里没有」，做出降级实现（把底座已有的 getDeptList/getUserList
// 判为不存在 → 科室下拉空着）。底座代码天然没有 @vima 标注（不属任何任务），
// 正好用「无标注」把它精确圈出来。只出名字与路径，不贴实现——字节预算是硬约束。
// ---------------------------------------------------------------------------

const MARKER_RE = /@vima\s+[a-z0-9][a-z0-9-]*/;
const FE_EXPORT_RE = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g;
const FE_CALL_RE = /\brequest\s*\.\s*(get|post|put|delete|patch)\s*(?:<[^>(]*>)?\s*\(\s*(['"`])([^'"`\n]*)\2/g;
const BE_MAPPING_RE = /@(Get|Post|Put|Delete|Patch)Mapping\s*(?:\(([^)]*)\))?/g;
const BE_BASE_RE = /@RequestMapping\s*\(([^)]*)\)/;
const BASELINE_EXCLUDE = ['node_modules', 'dist', 'target', '.vima', 'vendor'];

/** 注解括号内的路径（与 validate V-CODE-02 同口径：value=/path= 或首个位置字符串）。 */
function mappingPathOf(inner) {
  if (!inner) return '';
  let m = /(?:value|path)\s*=\s*"([^"]*)"/.exec(inner);
  if (m) return m[1];
  m = /^\s*"([^"]*)"/.exec(inner);
  return m ? m[1] : '';
}

/** 扫一个目录下**没有** @vima 标注的文件（= 底座/共享层，不属任何任务）。 */
async function scanUnmarked(root, subdir, exts) {
  const dir = path.join(root, subdir);
  if (!(await fileExists(dir))) return [];
  const out = [];
  for (const rel of await walkFiles(dir, { exclude: BASELINE_EXCLUDE })) {
    if (!exts.some((e) => rel.endsWith(e))) continue;
    const text = await readFile(path.join(dir, rel), 'utf8');
    if (MARKER_RE.test(text)) continue;
    out.push({ rel: `${subdir}/${rel}`, text });
  }
  return out;
}

/** 系统底座接口索引：前端 api 层导出 + 后端无标注 controller 的 Mapping。 */
async function baselineIndex(root, roster) {
  const apps = roster && roster.apps.length > 0 ? roster.apps : [{ id: null, dir: '.', codeDir: 'src' }];
  const frontend = [];
  for (const app of apps) {
    const base = app.dir === '.' || app.dir === '' ? app.codeDir : `${app.dir}/${app.codeDir}`;
    for (const f of await scanUnmarked(root, `${base}/api`, ['.ts', '.tsx', '.js', '.mjs'])) {
      const names = [...f.text.matchAll(FE_EXPORT_RE)].map((m) => m[1]);
      const paths = [];
      FE_CALL_RE.lastIndex = 0;
      let m;
      while ((m = FE_CALL_RE.exec(f.text)) !== null) paths.push(`${m[1].toUpperCase()} ${m[3]}`);
      if (names.length === 0 && paths.length === 0) continue;
      frontend.push({
        app: app.id,
        file: f.rel,
        names: [...new Set(names)].sort(),
        paths: [...new Set(paths)].sort(),
      });
    }
  }
  const backendDir = roster?.backend?.dir ?? 'backend';
  const backend = [];
  for (const f of await scanUnmarked(root, `${backendDir}/src`, ['.java'])) {
    const baseM = BE_BASE_RE.exec(f.text);
    const base = baseM ? mappingPathOf(baseM[1]) : '';
    const paths = new Set();
    BE_MAPPING_RE.lastIndex = 0;
    let m;
    while ((m = BE_MAPPING_RE.exec(f.text)) !== null) {
      const sub = mappingPathOf(m[2] ?? '');
      const joined = (`${base}${sub === '' || sub.startsWith('/') ? '' : '/'}${sub}` || '/').replace(/\/{2,}/g, '/');
      paths.add(`${m[1].toUpperCase()} ${joined}`);
    }
    if (paths.size === 0) continue;
    backend.push({ file: f.rel, paths: [...paths].sort() });
  }
  frontend.sort((a, b) => (a.file < b.file ? -1 : 1));
  backend.sort((a, b) => (a.file < b.file ? -1 : 1));
  return { frontend, backend };
}

// ---------------------------------------------------------------------------
// A22 检索线二：spec 指名的 docs/raw/ 真源片段
// 实测：spec 正文写着「真源为 docs/raw/…:行号」，Builder 仍然没去看——因为上下文包里
// 没有它，于是把现成的九步 roles 判为「未给出」，RULE-28 半实现。
// ---------------------------------------------------------------------------

const RAW_REF_RE = /docs\/raw\/[^\s，,。；;）)"'`）】\]]+/g;
const RAW_SLICE_LINES = 20;
const RAW_MAX_BYTES = 8 * 1024;

/** 从若干段文本里收集 docs/raw 引用：路径 + 可选行号（`:12` 或 `:12-30`）。 */
function collectRawRefs(texts) {
  const refs = new Map(); // 路径 → Set(行号锚点)
  for (const t of texts) {
    if (typeof t !== 'string') continue;
    for (const m of t.matchAll(RAW_REF_RE)) {
      const raw = m[0].replace(/[:：]$/, '');
      const lineM = /^(.*?):(\d+)(?:-(\d+))?$/.exec(raw);
      const file = lineM ? lineM[1] : raw;
      if (!/\.[A-Za-z0-9]+$/.test(file)) continue; // 只认带扩展名的具体文件
      if (!refs.has(file)) refs.set(file, new Set());
      if (lineM) refs.get(file).add(lineM[3] ? `${lineM[2]}-${lineM[3]}` : lineM[2]);
    }
  }
  return refs;
}

async function readIfExists(abs) {
  try {
    return await readFile(abs, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * 汇编上下文包（纯函数式装配，契约 §6.11）。
 * @returns {Promise<{bundle: string, sections: Array<{label, bytes, note?}>, total: number}>}
 */
export async function buildContextBundle(root, task, roster = null) {
  // A16：任务归属端与该端 kind（组件文档目录 / componentMap / 规范切片的口径来源）
  const taskApp = roster && roster.apps.length > 0 ? (appOf(task.fm, roster) ?? null) : null;
  const taskKind = taskApp ? roster.apps.find((a) => a.id === taskApp)?.kind ?? null : null;
  const kindDef = taskKind ? roster.kinds?.[taskKind] ?? null : null;
  const sections = [];
  const parts = [];
  const pushSection = (label, heading, content, note) => {
    const text = `\n## ${heading}\n\n${content.trimEnd()}\n`;
    parts.push(text);
    sections.push({ label, bytes: bytesOf(text), ...(note ? { note } : {}) });
  };

  // 1) 任务文件原文（frontmatter + body）
  const taskText = await readFile(task.path, 'utf8');
  pushSection('任务文件', `任务文件（${task.file}）`, taskText);

  // spec 原文只读一次（页面块 + A13 业务规则/本期不做共用）
  const specText = await readIfExists(path.join(root, 'docs', 'spec.md'));
  // A13 过滤键：任务 apis 集合 = page.apis ∪ contract.apis（契约 §6.11）
  const taskApis = new Set();

  // 2) 契约原文（A18：任务声明 apis 负责集时按其切片——Builder 只看自己那份）
  if (typeof task.fm.contract === 'string' && task.fm.contract !== '') {
    const contractText = await readIfExists(path.join(root, task.fm.contract));
    if (contractText !== null) {
      const owned = Array.isArray(task.fm.apis) && task.fm.apis.length > 0
        ? new Set(task.fm.apis.map(normApi))
        : null;
      let text = contractText;
      let note;
      if (owned !== null) {
        const sliced = sliceContract(contractText, owned);
        text = sliceContractBlock(sliced.text, owned);
        note = `按 apis 切片：保留 ${sliced.kept} / 删除 ${sliced.dropped} 个接口小节`;
      }
      pushSection('契约', `契约（${task.fm.contract}）`, text, note);
      // A13 规则过滤键取**切片后**的接口集：负责集之外的规则不该进本任务上下文
      for (const b of extractBlocks(text, 'contract', { path: task.fm.contract })) {
        for (const api of Array.isArray(b.data?.apis) ? b.data.apis : []) {
          if (api && typeof api === 'object') taskApis.add(normApi(`${api.method} ${api.path}`));
        }
      }
    } else {
      pushSection('契约', `契约（${task.fm.contract}）`, '（契约文件缺失——存在性由 vima validate V-TASK-03 把关，此处跳过。）', '缺失跳过');
    }
  }

  // 3) spec 页面块 + 4) 组件文档切片（带 page 字段的任务才有）
  if (typeof task.fm.page === 'string' && task.fm.page !== '') {
    const block = specText === null
      ? undefined
      : extractBlocks(specText, 'page', { path: 'docs/spec.md' }).find((b) => b.data?.id === task.fm.page);
    for (const a of Array.isArray(block?.data?.apis) ? block.data.apis : []) taskApis.add(normApi(a));
    if (block) {
      pushSection(
        'spec 页面块',
        `spec 页面块（${task.fm.page}）`,
        '页面结构唯一真源（A2）——layout/components/交互/apis 四要素以此为准：\n\n' +
          '```yaml vima:page\n' + block.raw.trimEnd() + '\n```',
      );

      // A16：kind 声明 componentMap 时以其为映射真源（admin-web 缺省 = 内置表，契约 §6.3）
      const compNames = componentsOfPage(block.data, kindDef?.componentMap ?? null);
      if (compNames.length > 0) {
        const chunks = [];
        const missing = [];
        for (const name of compNames) {
          // A16：按端目录优先（docs/ui-framework/<app>/），平铺旧路径回退（兼容单端存量）
          const doc =
            (taskApp ? await readIfExists(path.join(root, 'docs', 'ui-framework', taskApp, `${name}.md`)) : null) ??
            (await readIfExists(path.join(root, 'docs', 'ui-framework', `${name}.md`)));
          if (doc === null) missing.push(name);
          else chunks.push(`### ${name}\n\n${doc.trim()}`);
        }
        const head = `按本页受限词表映射出的组件（契约 §6.11 映射表）：${compNames.join('、')}。` +
          (missing.length > 0 ? `\n（文档缺失跳过：${missing.join('、')}——docs/ui-framework/ 未安装或组件文档不全。）` : '');
        pushSection(
          '组件文档切片',
          '组件文档切片',
          `${head}${chunks.length > 0 ? `\n\n${chunks.join('\n\n')}` : ''}`,
          missing.length > 0 ? `缺失 ${missing.length}` : undefined,
        );
      }
    } else {
      pushSection(
        'spec 页面块',
        `spec 页面块（${task.fm.page}）`,
        '（spec 缺失或该页面块不存在——由 vima validate V-TASK-06 把关，此处跳过。）',
        '缺失跳过',
      );
    }
  }

  // 5) 业务规则切片（A13）：按 apis 交集过滤 + 全局规则
  if (specText === null) {
    pushSection('业务规则切片', '业务规则切片', '（docs/spec.md 缺失——存在性由 vima validate 把关，此处跳过。）', '缺失跳过');
  } else {
    const allRules = extractBlocks(specText, 'rules', { path: 'docs/spec.md' }).flatMap((b) => (Array.isArray(b.data?.rules) ? b.data.rules : []));
    const picked = rulesForTask(allRules, taskApis);
    const body = picked.length === 0
      ? '（本任务无匹配的业务规则——spec 第五章 vima:rules 未声明相关规则。）'
      : picked
        .map((r) => {
          const scope = Array.isArray(r.apis) ? r.apis.map((a) => normApi(a)).join('、') : '全局规则（不限接口）';
          return `- **${r.id}**〔${r.type}〕${r.entity}：${r.desc}\n  适用范围：${scope}`;
        })
        .join('\n');
    pushSection(
      '业务规则切片',
      '业务规则切片',
      '实现必须满足以下业务规则（spec 第五章 vima:rules，A13）；单测期望值可直接引用规则 ID 作独立事实源（A10）：\n\n' + body,
      picked.length === 0 ? '无匹配' : undefined,
    );
  }

  // 6) 本期不做（A13 范围红线）：不过滤，每个 Builder 一律可见
  if (specText !== null) {
    const ngBlocks = extractBlocks(specText, 'non-goals', { path: 'docs/spec.md' });
    const declared = ngBlocks.some((b) => Array.isArray(b.data?.['non-goals']));
    const items = ngBlocks.flatMap((b) => (Array.isArray(b.data?.['non-goals']) ? b.data['non-goals'] : []));
    const body = !declared
      ? '（spec 第九章未声明 vima:non-goals——由 vima validate V-SPEC-11 把关。）'
      : items.length === 0
        ? '（本期无 non-goals 声明：spec 第九章已显式写 `non-goals: []`。）'
        : items.map((n) => `- **${n.id}**：${n.desc}`).join('\n');
    pushSection(
      '本期不做',
      '本期不做（范围红线）',
      '以下内容**本期明确不做**（spec 第九章 vima:non-goals，A13）。实现触碰任一条即为越界，'
        + 'Verifier 会记 fail——不要「顺便也支持一下」：\n\n' + body,
      declared && items.length === 0 ? '空清单（已显式声明）' : undefined,
    );
  }

  // 7) 系统底座接口索引（A22 检索线一）：判断「系统里有没有」的第二条线。
  //    只列名字与路径——Builder 据此知道该去读哪个文件，而不是直接判「不存在」。
  {
    const idx = await baselineIndex(root, roster);
    const lines = [];
    if (idx.frontend.length > 0) {
      lines.push('### 前端既有 API 封装（无 `@vima` 标注 = 底座/共享层，直接复用，勿重写）', '');
      for (const f of idx.frontend) {
        lines.push(`- \`${f.file}\`${f.app ? `（端 ${f.app}）` : ''}`);
        if (f.names.length > 0) lines.push(`  - 导出：${f.names.map((n) => `\`${n}\``).join('、')}`);
        if (f.paths.length > 0) lines.push(`  - 请求：${f.paths.map((p) => `\`${p}\``).join('、')}`);
      }
      lines.push('');
    }
    if (idx.backend.length > 0) {
      lines.push('### 后端既有端点（无 `@vima` 标注 = 底座）', '');
      for (const f of idx.backend) lines.push(`- \`${f.file}\`：${f.paths.map((p) => `\`${p}\``).join('、')}`);
      lines.push('');
    }
    const empty = idx.frontend.length === 0 && idx.backend.length === 0;
    pushSection(
      '系统底座接口索引',
      '系统底座接口索引',
      '**判断「系统里有没有某能力」要查三条线：本任务契约 → 本索引（系统底座）→ spec 指名的真源**。\n'
        + '契约里没写 **不等于** 系统里没有——照「不存在」实现会做出降级功能（实测：把底座已有的\n'
        + '科室/用户列表判为不存在，导致下拉框空着、指派功能退化成自分配）。\n\n'
        + (empty
          ? '（本项目暂无无标注的既有 API 封装或底座端点——要么尚未开工，要么底座代码不在扫描范围内。）'
          : lines.join('\n')),
      empty ? '无命中' : `前端 ${idx.frontend.length} 文件 / 后端 ${idx.backend.length} 文件`,
    );
  }

  // 8) 真源片段（A22 检索线二）：spec 指名的 docs/raw/ 引用必须随包送达。
  {
    const scanTexts = [specText ?? ''];
    const refs = collectRawRefs(scanTexts);
    const chunks = [];
    const missing = [];
    for (const [rel, anchors] of [...refs.entries()].sort()) {
      const text = await readIfExists(path.join(root, ...rel.split('/')));
      if (text === null) {
        missing.push(rel);
        continue;
      }
      const all = text.split('\n');
      if (anchors.size === 0) {
        let body = text;
        let note = '';
        if (bytesOf(body) > RAW_MAX_BYTES) {
          body = Buffer.from(body, 'utf8').subarray(0, RAW_MAX_BYTES).toString('utf8');
          note = `\n（已截断至 ${RAW_MAX_BYTES} 字节——完整内容见原文件）`;
        }
        chunks.push(`#### \`${rel}\`（全文）\n\n\`\`\`\n${body.trimEnd()}\n\`\`\`${note}`);
        continue;
      }
      for (const anchor of [...anchors].sort()) {
        const [a, b] = anchor.split('-').map((n) => Number.parseInt(n, 10));
        const from = Math.max(1, (Number.isFinite(a) ? a : 1) - RAW_SLICE_LINES);
        const to = Math.min(all.length, (Number.isFinite(b) ? b : a) + RAW_SLICE_LINES);
        const body = all.slice(from - 1, to).join('\n');
        chunks.push(`#### \`${rel}:${anchor}\`（第 ${from}–${to} 行）\n\n\`\`\`\n${body.trimEnd()}\n\`\`\``);
      }
    }
    const head = '以下是 **spec 正文指名引用**的原始真源片段（A22）。spec 说「真源在这里」就必须去读，'
      + '不得因为契约里没写而判为「未给出」——实测两次降级实现都出在这一步。';
    const body = chunks.length === 0
      ? '（spec 未指名引用任何 `docs/raw/` 文件——本任务无附带真源片段。）'
      : chunks.join('\n\n');
    const tail = missing.length > 0
      ? `\n\n（引用了但文件不存在，已跳过：${missing.map((m) => `\`${m}\``).join('、')}）`
      : '';
    pushSection(
      '真源片段',
      '真源片段',
      `${head}\n\n${body}${tail}`,
      chunks.length === 0 ? '无引用' : `${chunks.length} 段${missing.length > 0 ? ` / 缺失 ${missing.length}` : ''}`,
    );
  }

  // 8.5) 设计上下文（A34 检索线三）：把本页的视觉真源随包送达。
  // Builder 只见自己那一页是跨页同质化的直接原因——相邻页面的稿一并列出，
  // 让它能感知跨页节奏，而不是在自己的格子里独立装修一遍。
  if (typeof task.fm.page === 'string' && task.fm.page !== '' && specText !== null) {
    const pageId = task.fm.page;
    const designDir = `docs/review/design/${pageId}`;
    const manifestText = await readIfExists(path.join(root, designDir, 'manifest.json'));
    const lines = [];
    let note;

    // 本页保真级 / primaryTask / mustPreserve —— 从 spec 页面块原文里摘（context 不重解析 spec）
    const blockRe = new RegExp(`\`\`\`yaml vima:page\\n([\\s\\S]*?)\`\`\``, 'g');
    let pageYaml = null;
    let m;
    while ((m = blockRe.exec(specText)) !== null) {
      if (new RegExp(`^id:\\s*${pageId}\\s*$`, 'm').test(m[1])) { pageYaml = m[1]; break; }
    }
    const pick = (key) => {
      if (pageYaml === null) return null;
      const mm = new RegExp(`^\\s{2}${key}:\\s*(.+)$`, 'm').exec(pageYaml);
      // 剥行尾 YAML 注释——spec 里这些键常带 `# 说明`，原样带进上下文会污染取值
      return mm ? mm[1].replace(/\s+#.*$/, '').trim() : null;
    };
    const fidelity = pick('fidelity');
    const primaryTask = pick('primaryTask');

    if (fidelity === null) {
      lines.push('本页未声明 `design.fidelity`（存量项目形态）——按结构真源实现即可。');
      note = '无保真级';
    } else {
      lines.push(`**保真级**：${fidelity}`);
      if (primaryTask) lines.push(`**本页主任务（primaryTask）**：${primaryTask}`);
      if (fidelity === 'D0') {
        lines.push('', 'D0 = 标准 CRUD：按 `docs/design-language.md` 的模式库条目实现即可，无逐页稿。');
        note = 'D0';
      } else if (manifestText === null) {
        lines.push('', `⚠️ ${fidelity} 页但 \`${designDir}/manifest.json\` 不存在——`
          + '设计产物尚未冻结，**不要凭空发挥**，先让主 Agent 走 `/design` 出稿。');
        note = `${fidelity} 缺稿`;
      } else {
        let files = [];
        try { files = JSON.parse(manifestText).files ?? []; } catch { files = []; }
        lines.push('', `**视觉真源**：\`${designDir}/\`（路径由 pageId 推导，spec 里没有也不该有路径字段）`);
        for (const f of files) lines.push(`- \`${designDir}/${f}\``);
        lines.push('', '实现须 **1:1 对照**：主区域关系 / 动作主次 / 信息层级 / 状态与空态。',
          '**不得把稿里的图表、消息流、画布、时间线或实时预览降级为表格或 textarea**——'
          + '接口全对、字段全对但产品心智没了，验收一样判失败。');
        note = `${fidelity} · ${files.length} 件产物`;
      }

      // 正常态/空态必须用契约同源 mock，不让 Builder 临时编一套恰好适配版面的假数据。
      const mockRel = '.vima/mock/contract-mock.json';
      if (await readIfExists(path.join(root, mockRel)) !== null) {
        lines.push('', `**契约同源 mock**：\`${mockRel}\``,
          '- 正常态：`?__mock=default`', '- 空态：`?__mock=empty`',
          '两档都要对照冻结稿实现；mock 字段来自契约，不得手写第二份。');
      } else if (fidelity === 'D1' || fidelity === 'D2') {
        lines.push('', `⚠️ 缺 \`${mockRel}\`——先运行 \`vima mock\`，再实现正常态与空态。`);
      }
      // mustPreserve 原文块（结构化，逐条都要兑现）
      if (pageYaml !== null && /^\s{2}mustPreserve:/m.test(pageYaml)) {
        const mp = /^\s{2}mustPreserve:[\s\S]*?(?=^\s{2}\S|$(?![\s\S]))/m.exec(pageYaml);
        if (mp) lines.push('', '**不可降级项（mustPreserve，逐条对账）**：', '```yaml', mp[0].trimEnd(), '```');
      }
    }

    // 项目设计语言与交互语言（Stage A 冻结产物）
    for (const [rel, label] of [['docs/design-language.md', '版面语言'], ['docs/interaction-language.md', '交互语言']]) {
      if (await readIfExists(path.join(root, rel)) !== null) lines.push(`- ${label}：\`${rel}\``);
    }

    // 所属端的获胜方向包（shell / 视觉重心 / 用户选择）。页面稿不能脱离端级方向孤立消费。
    if (taskApp) {
      const shellDir = `docs/review/design/_shell/${taskApp}`;
      const shellManifest = await readIfExists(path.join(root, shellDir, 'manifest.json'));
      if (shellManifest !== null) {
        let files = [];
        try { files = JSON.parse(shellManifest).files ?? []; } catch { files = []; }
        lines.push('', `**所属端方向基线**：\`${shellDir}/\``);
        for (const f of files) lines.push(`- \`${shellDir}/${f}\``);
      } else if (fidelity === 'D1' || fidelity === 'D2') {
        lines.push('', `⚠️ 所属端 ${taskApp} 缺方向基线 \`${shellDir}/manifest.json\`——不得自行补一套壳层风格。`);
      }
    }

    // 相邻页面的稿（跨页节奏；只列路径不塞内容，控包体）
    const neighbours = [];
    const idRe = /^id:\s*(PAGE-[\w-]+)\s*$/gm;
    let im;
    while ((im = idRe.exec(specText)) !== null) if (im[1] !== pageId) neighbours.push(im[1]);
    const withDesign = [];
    for (const n of neighbours) {
      if (await readIfExists(path.join(root, 'docs/review/design', n, 'manifest.json')) !== null) withDesign.push(n);
    }
    if (withDesign.length > 0) {
      lines.push('', '**相邻页面已冻结的稿**（看一眼跨页节奏，别让本页成为孤岛）：');
      for (const n of withDesign.slice(0, 8)) {
        const base = `docs/review/design/${n}`;
        const refs = [];
        for (const file of ['default.png', 'empty.png']) {
          if (await readIfExists(path.join(root, base, file)) !== null) refs.push(`\`${base}/${file}\``);
        }
        lines.push(`- ${refs.length > 0 ? refs.join('、') : `\`${base}/\``}`);
      }
    }

    pushSection('设计上下文', `设计上下文（A34 · ${pageId}）`, lines.join('\n'), note);
  }

  // 9) 编码规范。A16 kind 切片：文档含「## 端规范：<kind>」二级节时，注入 = 通用部分
  // （首个端规范节之前）+ 本任务端 kind 的节；无分节或无归属 kind 时整份注入（现状）。
  const standards = await readIfExists(path.join(root, 'docs', 'coding-standards.md'));
  if (standards !== null) {
    let sliced = standards;
    const SECTION_RE = /^## 端规范：(.+)$/m;
    if (taskKind && SECTION_RE.test(standards)) {
      const firstIdx = standards.search(SECTION_RE);
      const common = standards.slice(0, firstIdx).trimEnd();
      const m = new RegExp(`^## 端规范：${taskKind}\\s*$([\\s\\S]*?)(?=^## 端规范：|$(?![\\s\\S]))`, 'm').exec(standards);
      sliced = m ? `${common}\n\n## 端规范：${taskKind}${m[1].trimEnd()}\n` : common + '\n';
      pushSection('编码规范', `编码规范（docs/coding-standards.md · ${taskKind} 切片）`, sliced);
    } else {
      pushSection('编码规范', '编码规范（docs/coding-standards.md）', standards);
    }
  } else {
    pushSection('编码规范', '编码规范（docs/coding-standards.md）', '（未安装——vima init 后可用，此处跳过。）', '缺失跳过');
  }

  // 10) 项目补充规范（A24/F9）：docs/coding-standards.local.md 存在时一并分发。
  // 动机：coding-standards.md 是受管文件，却**是唯一随 context 分发到每个任务的规范文件**
  // ——实测中它成了止血最有效的落点（往里加了三节），代价是 doctor ⑧ 从此长期报
  // 「受管文件被手改」。本节给项目定制一个不受管的落点，让它不必污染受管基线。
  const localStandards = await readIfExists(path.join(root, 'docs', 'coding-standards.local.md'));
  if (localStandards !== null) {
    pushSection(
      '项目补充规范',
      '项目补充规范（docs/coding-standards.local.md）',
      '本项目自己的补充规范（**不受 vima 管理**，随项目演进自由增删）。'
        + '与上一节冲突时**以本节为准**——受管基线给的是通用底线，项目现实优先：\n\n'
        + localStandards.trimEnd(),
    );
  }

  const title = typeof task.fm.title === 'string' ? task.fm.title : '';
  const header =
    '<!-- vima context 生成（A8 确定性上下文打包，契约 §6.11）：本包是任务开工所需规划\n' +
    '上下文的只读快照；真源（任务/契约/spec/规范）变更后重跑 `vima context <taskId>` 重建。\n' +
    'Builder 以本包为第一必读，不再自行翻找规划上下文（上游编译、下游不自由检索）。 -->\n\n' +
    `# 任务上下文包：${task.id} — ${title}\n`;
  const bundle = header + parts.join('');
  return { bundle, sections, total: bytesOf(bundle) };
}

/** vima context <taskId> [--budget <bytes>] [--stdout] */
export async function run(argv, ctx) {
  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      options: {
        budget: { type: 'string' },
        stdout: { type: 'boolean', default: false },
      },
      allowPositionals: true,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }
  if (positionals.length !== 1) {
    throw usageError('用法：vima context <taskId>（缺少或多余的任务 ID 参数）');
  }
  const taskId = positionals[0];
  let budget;
  if (values.budget !== undefined) {
    budget = Number(values.budget);
    if (!Number.isInteger(budget) || budget <= 0) {
      throw usageError(`--budget 必须是正整数字节数（收到 "${values.budget}"）`);
    }
  }

  const root = ctx.cwd;
  if (!(await fileExists(path.join(root, 'docs', 'tasks')))) {
    throw precondition('NO_TASKS', '未找到 docs/tasks/ 目录（非 vima 项目或 PLANNING 未产出任务）', 'docs/tasks');
  }
  const tasks = await loadTasks(root);
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    throw usageError(`未知任务 "${taskId}"（docs/tasks/ 中无此 taskId）`);
  }

  const roster = await resolveApps(root, { cliRoot: ctx.cliRoot }); // A16
  const { bundle, sections, total } = await buildContextBundle(root, task, roster);

  if (values.stdout) {
    process.stdout.write(bundle);
  } else {
    const rel = `.vima/context/${taskId}.md`;
    await atomicWriteFile(path.join(root, rel), bundle);
    const lines = [`📦 上下文包：${rel}（共 ${total} 字节）`];
    for (const s of sections) {
      lines.push(`  · ${s.label} ${s.bytes} 字节${s.note ? `（${s.note}）` : ''}`);
    }
    process.stdout.write(`${lines.join('\n')}\n`);
  }

  // 预算是硬门（A8：上下文预算首次成为机检项）；包已写盘/已输出，便于排查超因
  if (budget !== undefined && total > budget) {
    throw checkFailed(
      'CONTEXT_BUDGET',
      `上下文包 ${total} 字节超出预算 ${budget}（超 ${total - budget}）——裁剪 spec 页面块/契约或拆分任务`,
      `.vima/context/${taskId}.md`,
    );
  }
  return EXIT.OK;
}
