// vima converge —— 跨任务集成对账（A20；契约 §8.1 规则族 / §6.13 报告格式 / 设计 §19.14）
// 确定性、零 token。V-CODE-01/02 是单向对账（单个文件不得出现契约之外的接口）；
// 本命令是跨任务的合并视角——契约的每个接口在整个代码库里被实现了几次、被谁实现。
// 扫描原语复用 validate.mjs 的导出，不复制实现（契约 §2 所有权）。
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';
import { EXIT, usageFromParseArgs, precondition } from '../util/errors.mjs';
import { atomicWriteFile, stableStringify, fileExists, walkFiles } from '../util/fs.mjs';
import { loadTasks } from '../model/tasks.mjs';
import { loadContracts, apiKey } from '../model/contracts.mjs';
import { resolveApps, consumersOf } from '../model/apps.mjs';
import {
  scanMarkedFiles,
  mappingPath,
  feApiKey,
  scanFeCalls,
  normalizePathParams,
  ownedApisOf,
} from './validate.mjs';

const REPORT_REL = '.vima/reports/convergence.json';
const REPORTS_DIR = '.vima/reports';
const RUNTIME_RE = /^runtime-errors(?:\.[^.]+)?\.jsonl$/;
const VERIFIER_RE = /^(.+)-verifier\.json$/;
const BUILDER_REPORT_RE = /^(.+)-builder\.json$/;
const MARKER_RE = /@vima\s+([a-z0-9][a-z0-9-]*)/g;

const FE_EXTS = ['.ts', '.tsx', '.vue', '.js', '.mjs'];
// A41：调用点扫描取 validate 导出的单一真源 scanFeCalls（正则 + 全文扫 + 跳注释行三者一体）。
// 此处曾是第三份正则拷贝，且停留在会被嵌套泛型截断的旧式写法
// ——V-INT-04「授权端没调用」因此长期误报（sustain-v4 实测误报 39 条 PUT/DELETE 端点）。
const BE_MAPPING_RE = /@(Get|Post|Put|Delete|Patch)Mapping\s*(?:\(([^)]*)\))?/g;
const BE_BASE_RE = /@RequestMapping\s*\(([^)]*)\)/;

/** 归一到「代码键」：METHOD 大写 + 路径参数统一为 `{*}`（与 validate code 组同口径）。 */
function codeKeyOf(rawKey) {
  const i = rawKey.indexOf(' ');
  if (i < 0) return rawKey.toUpperCase();
  return `${rawKey.slice(0, i).toUpperCase()} ${normalizePathParams(rawKey.slice(i + 1))}`;
}

/** 一个文件里出现的全部 @vima taskId（升序去重）。 */
function markersOf(text) {
  const set = new Set();
  for (const m of text.matchAll(MARKER_RE)) set.add(m[1]);
  return [...set].sort();
}

/**
 * 后端实现表：归一键 → [{ file, taskIds }]，每个文件对同一键只记一次
 * （方法重载 / 同方法多注解属正常，不算重复实现）。
 */
function backendEndpointsOf(files) {
  const out = new Map();
  for (const f of files) {
    const baseM = BE_BASE_RE.exec(f.text);
    const base = baseM ? mappingPath(baseM[1]) : '';
    const taskIds = markersOf(f.text);
    const seen = new Set();
    let m;
    BE_MAPPING_RE.lastIndex = 0;
    while ((m = BE_MAPPING_RE.exec(f.text)) !== null) {
      const sub = mappingPath(m[2] ?? '');
      const joined = (`${base}${sub === '' || sub.startsWith('/') ? '' : '/'}${sub}` || '/').replace(/\/{2,}/g, '/');
      const key = `${m[1].toUpperCase()} ${normalizePathParams(joined)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!out.has(key)) out.set(key, []);
      out.get(key).push({ file: f.rel, taskIds });
    }
  }
  return out;
}

/** 前端调用表：端 id → { 该端带标注代码里出现过的归一键集合, 带标注文件数, 标注 taskId }。 */
async function frontendCallsOf(root, roster) {
  const apps = roster.apps.length > 0 ? roster.apps : [{ id: null, dir: '.', codeDir: 'src' }];
  const byApp = new Map();
  for (const app of apps) {
    const subdir = app.dir === '.' || app.dir === '' ? app.codeDir : `${app.dir}/${app.codeDir}`;
    const files = await scanMarkedFiles(root, subdir, FE_EXTS);
    const keys = new Set();
    const taskIds = new Set();
    for (const f of files) {
      for (const c of scanFeCalls(f.text)) keys.add(feApiKey(c.method, c.path));
      for (const id of markersOf(f.text)) taskIds.add(id);
    }
    byApp.set(app.id, { keys, taskIds, markedFiles: files.length });
  }
  return byApp;
}

// ══ V-INT-06「被读的必须有人写」（A42 D-A42-03）════════════════════════════
// 任务拆分以**端点**为单位（apis 责任田），覆盖矩阵查「端点有人负责」、V-INT-01 查
// 「接口零实现」——但数据的生产者—消费者关系**跨端点**：「谁往 mp_message 写」不对应
// 任何端点，于是不在任何任务的责任田里，任何一层机检都不会喊（sustain-v4 实测：
// 消息中心恒空、就诊记录里处方恒空、随访向导无题可填，三处都不是「代码写错了」）。
//
// **判据必须零假阳性**——永远无法清除的告警会训练人忽略整张告警表（同 D-A42-01 的判据来源）。
// 因此本规则的每一步都往「宁可少报」偏：
//   1. 只判 JPA `@Entity` 类的属性——它们对应真实的表列，「无人写 = 表列恒空」可判定；
//      DTO/VO 不判（它们的赋值面在响应装配处，另有 V-CON-08 管）。
//   2. 写入点识别覆盖 Lombok setter 调用（按变量声明做类型解析）、`@Builder` 链、
//      `new T(...)` 构造器、实体自身的 `this.x = / x =`（`@PrePersist` 生命周期回调）、
//      JPQL `update T t set t.x = ...`。
//   3. **接收者类型解析不出来的 setter（`repo.findById(id).get().setX(...)` 这类链式调用），
//      按同名属性全局压制**——宁可漏掉一整个属性名，也不冒判错的风险。
//   4. `@RequestBody`/`@RequestPart`/`@ModelAttribute`/Jackson `readValue` 绑定的类型整类跳过
//      ——它们由框架反射写入，源码里没有任何写入点却完全正常（sustain-v4 实测的唯一假阳性来源）。
//   5. 框架托管列（`@Id`/`@GeneratedValue`/审计注解/`insertable=false`/字段初始化值）不判。
// 写入点证据**不限 `@vima` 作用域**（底座/共享层写的一样让字段非空，漏看只会造假阳性），
// 但**只对带 `@vima` 标注的实体报告**——与 V-CODE-02 / V-INT-01~03 同口径。

const ENTITY_CLASS_RE = /@Entity\b[\s\S]{0,4000}?\bclass\s+(\w+)/;
/** 字段声明：前导注解块 + 可见性 + 类型 + 名 + 可选初始化值。static/final 不参与。 */
const ENTITY_FIELD_RE = /((?:@\w+(?:\s*\([^;]*?\))?\s*)*)\b(?:private|protected|public)\s+(?!static\b|final\b)([\w.<>[\],\s]+?)\s+(\w+)\s*(=[^;]*)?;/g;
/** 框架/数据库托管的列：写入方不是业务代码，源码里没有写入点属正常。 */
const FRAMEWORK_WRITTEN_RE = /@(?:Id|GeneratedValue|Version|CreatedDate|CreatedBy|LastModifiedDate|LastModifiedBy|CreationTimestamp|UpdateTimestamp|Generated|ColumnDefault|Transient|Formula|OneToMany|ManyToMany)\b|insertable\s*=\s*false/;

const JAVA_DECL_RE = /\b([A-Z][A-Za-z0-9_]*)\s+([a-z_][A-Za-z0-9_]*)\s*(?==|;|,|\)|:)/g;
const JAVA_NEW_ASSIGN_RE = /\b(?:[A-Z][A-Za-z0-9_]*|var)\s+([a-z_][A-Za-z0-9_]*)\s*=\s*new\s+([A-Z][A-Za-z0-9_]*)\s*\(/g;
const JAVA_SETTER_VAR_RE = /(?:^|[^\w.$)\]])([a-z_][A-Za-z0-9_]*)\s*\.\s*set([A-Z][A-Za-z0-9_]*)\s*\(/g;
const JAVA_SETTER_ANY_RE = /\.\s*set([A-Z][A-Za-z0-9_]*)\s*\(/g;
const JAVA_BUILDER_RE = /\b([A-Z][A-Za-z0-9_]*)\s*\.\s*builder\s*\(\s*\)/g;
const JAVA_NEW_RE = /\bnew\s+([A-Z][A-Za-z0-9_]*)\s*\(/g;
const JAVA_BIND_RE = /@(?:RequestBody|RequestPart|ModelAttribute)\s*(?:\([^)]*\)\s*)?(?:@\w+(?:\([^)]*\))?\s*)*([A-Z][A-Za-z0-9_]*)/g;
const JAVA_JACKSON_RE = /\b(?:readValue|convertValue|treeToValue)\s*\([^;]*?\b([A-Z][A-Za-z0-9_]*)\.class/g;
const JPQL_UPDATE_RE = /update\s+([A-Z]\w*)\s+(\w+)\s+set\s+/gi;

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/** 后端全部 java 文件（**含无 @vima 标注的**：写入点证据不限作用域，见规则头注释）。 */
async function scanJavaFiles(root, subdir) {
  const dir = path.join(root, subdir);
  if (!(await fileExists(dir))) return [];
  const out = [];
  for (const rel of await walkFiles(dir, { exclude: ['node_modules', 'dist', 'target', '.vima', 'vendor'] })) {
    if (!rel.endsWith('.java')) continue;
    out.push({ rel: `${subdir}/${rel}`, text: await readFile(path.join(dir, rel), 'utf8') });
  }
  return out;
}

/** JPA 实体表：类名 → { rel, marked, fields: Map<prop, {managed}> }。 */
function jpaEntitiesOf(files) {
  const out = new Map();
  for (const f of files) {
    if (!/@Entity\b/.test(f.text)) continue;
    const cm = ENTITY_CLASS_RE.exec(f.text);
    if (!cm) continue;
    const fields = new Map();
    for (const m of f.text.slice(cm.index).matchAll(ENTITY_FIELD_RE)) {
      if (m[2].includes('(')) continue; // 方法签名误匹配的保险丝
      fields.set(m[3], { managed: FRAMEWORK_WRITTEN_RE.test(m[1]) || m[4] != null });
    }
    out.set(cm[1], { rel: f.rel, marked: markersOf(f.text).length > 0, fields });
  }
  return out;
}

/** 从 `X.builder()` 起逐个吃 `.name(...)` 直到 `.build()`，返回被赋值的属性名。 */
function builderPropsAt(text, from) {
  const props = [];
  let i = from;
  for (;;) {
    const m = /^\s*\.\s*([a-z_][A-Za-z0-9_]*)\s*\(/.exec(text.slice(i, i + 200));
    if (!m) return props;
    let j = i + m[0].length;
    let depth = 1;
    while (j < text.length && depth > 0) {
      const ch = text[j];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      else if (ch === '"') { j += 1; while (j < text.length && !(text[j] === '"' && text[j - 1] !== '\\')) j += 1; }
      j += 1;
    }
    if (m[1] === 'build') return props;
    props.push(m[1]);
    i = j;
  }
}

/** 全仓写入点索引（见规则头注释的五条收窄）。 */
function javaWriteIndexOf(files) {
  const writes = new Set(); // `Type.prop`
  const opaqueProps = new Set(); // 接收者类型解析不出的 setter → 同名属性全局压制
  const constructed = new Set(); // `new T(` / `T.builder()`
  const reflectBound = new Set(); // 框架反射写入的类型

  for (const f of files) {
    const t = f.text;
    const varTypes = new Map();
    const put = (v, ty) => {
      if (!varTypes.has(v)) varTypes.set(v, new Set());
      varTypes.get(v).add(ty);
    };
    for (const m of t.matchAll(JAVA_DECL_RE)) put(m[2], m[1]);
    for (const m of t.matchAll(JAVA_NEW_ASSIGN_RE)) put(m[1], m[2]);

    const resolvedAt = new Set();
    for (const m of t.matchAll(JAVA_SETTER_VAR_RE)) {
      resolvedAt.add(t.indexOf(`.set${m[2]}`, m.index));
      const tys = varTypes.get(m[1]);
      if (tys && tys.size > 0) for (const ty of tys) writes.add(`${ty}.${lowerFirst(m[2])}`);
      else opaqueProps.add(lowerFirst(m[2]));
    }
    for (const m of t.matchAll(JAVA_SETTER_ANY_RE)) {
      if (!resolvedAt.has(m.index)) opaqueProps.add(lowerFirst(m[1]));
    }
    for (const m of t.matchAll(JAVA_BUILDER_RE)) {
      constructed.add(m[1]);
      for (const p of builderPropsAt(t, m.index + m[0].length)) writes.add(`${m[1]}.${p}`);
    }
    for (const m of t.matchAll(JAVA_NEW_RE)) constructed.add(m[1]);
    for (const m of t.matchAll(JAVA_BIND_RE)) reflectBound.add(m[1]);
    for (const m of t.matchAll(JAVA_JACKSON_RE)) reflectBound.add(m[1]);
    for (const m of t.matchAll(JPQL_UPDATE_RE)) {
      const tail = t.slice(m.index, m.index + 800);
      for (const s of tail.matchAll(new RegExp(`\\b${m[2]}\\.(\\w+)\\s*=`, 'g'))) writes.add(`${m[1]}.${s[1]}`);
    }
  }
  return { writes, opaqueProps, constructed, reflectBound };
}

/** 契约响应字段名 → { contracts: Set<file>, endpoints: n }（「有人读」的证据）。 */
function responseFieldIndexOf(contracts) {
  const out = new Map();
  for (const c of contracts) {
    for (const api of c.apis) {
      for (const fld of Array.isArray(api.response) ? api.response : []) {
        if (!fld || typeof fld.name !== 'string' || fld.name === '') continue;
        if (!out.has(fld.name)) out.set(fld.name, { contracts: new Set(), endpoints: 0 });
        const e = out.get(fld.name);
        e.contracts.add(c.file);
        e.endpoints += 1;
      }
    }
  }
  return out;
}

/** 契约来源的引用串：最多点名 2 份，其余计数（响应字段同名跨契约很常见，不逐份铺开）。 */
function citeContracts(set) {
  const list = [...set].sort();
  if (list.length <= 2) return list.join('、');
  return `${list.slice(0, 2).join('、')} 等 ${list.length} 份`;
}

/** V-INT-06（warn）：契约响应字段对应的实体属性全仓无写入点 ⇒ 该字段恒空。 */
function checkDataProducers(javaFiles, contracts) {
  const entities = jpaEntitiesOf(javaFiles);
  if (entities.size === 0) return [];
  const idx = javaWriteIndexOf(javaFiles);
  const respIdx = responseFieldIndexOf(contracts);
  const findings = [];

  for (const [name, e] of [...entities.entries()].sort()) {
    if (!e.marked) continue; // 作用域自锚定：底座/共享层实体没有标注，天然不参与
    if (idx.reflectBound.has(name)) continue; // 框架反射写入，源码里看不见写入点属正常
    // 实体自身的赋值（`@PrePersist` 生命周期回调常用裸 `x = ...`）。**必须锚在语句位置**：
    // 松散地找 `x\s*=` 会把注解实参 `@Column(name = "device")` 当成对 name 列的赋值，
    // 于是「叫 name / length / status 的列」被系统性静默压制（漏报比误报隐蔽得多）。
    const src = javaFiles.find((f) => f.rel === e.rel)?.text ?? '';
    const selfAssigned = new Set(
      [...e.fields.keys()].filter((p) => new RegExp(`(?:^|[;{}])\\s*(?:this\\.)?${p}\\s*=(?!=)`, 'm').test(src)),
    );
    const dead = [...e.fields.keys()].filter((p) => !e.fields.get(p).managed
      && !selfAssigned.has(p)
      && !idx.writes.has(`${name}.${p}`)
      && !idx.opaqueProps.has(p));
    // 「有人读」的证据：契约声明的响应字段里出现过同名字段，才算接缝失效（D-A42-03 的判据面）
    const visible = dead.filter((p) => respIdx.has(p));
    if (visible.length === 0) continue;
    const cited = new Set();
    for (const p of visible) for (const c of respIdx.get(p).contracts) cited.add(c);
    const owners = markersOf(src);

    if (!idx.constructed.has(name)) {
      // 整张表没有生产者——修复单位是「指派一个任务负责写」，不是逐列补赋值，故按实体报一条
      findings.push(finding(
        'V-INT-06', 'warn', name, owners, [e.rel],
        `实体 ${name} 全仓没有任何写入方：既无 new ${name}(...) 也无 ${name}.builder()，`
          + `该表在任何数据下都是空表，而契约（${citeContracts(cited)}）的响应字段 `
          + `${visible.join('、')} 声明要返回它的列——这些字段恒空、按它查询恒无结果。`
          + '数据的生产者—消费者关系跨端点，不在任何任务的 apis 责任田里（A42 接缝二）'
          + '——请指派一个任务负责写入；若该表确实不需要，回契约删除这些响应字段。',
      ));
      continue;
    }
    for (const p of visible) {
      findings.push(finding(
        'V-INT-06', 'warn', `${name}.${p}`, owners, [e.rel],
        `实体属性 ${name}.${p} 全仓没有任何写入点（无 setter 调用 / 构造器赋值 / @Builder 链 / JPQL update），`
          + `而契约（${citeContracts(respIdx.get(p).contracts)}）的响应字段 ${p} 声明要返回它`
          + '——该字段在任何数据下恒空，按它 join/过滤的查询恒无结果。'
          + '请在产生这列数据的那一侧补上写入点；若该列确实不需要，回契约删除该响应字段。',
      ));
    }
  }
  return findings;
}

const byTaskThenText = (key) => (a, b) => (a.taskId === b.taskId
  ? (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0)
  : (a.taskId < b.taskId ? -1 : 1));

/**
 * 聚合 .vima/reports/<taskId>-verifier.json 的两条**互不换算**的通道（A42 D-A42-04）：
 * - `openPoints` 未过点位（豁免不计；A13 越界项计入且不可豁免）——阻断项，计退出码。
 * - `contractGaps` 契约缺口——「规格本身有缺口，实现侧已做合规处置」。
 *   **绝不计 fail、绝不并进 openPoints**：让正确的工程处置变成永远清不掉的 fail，
 *   正是 A42 立项要治的病（实证 page-68-fe：verifier 判 pass、checklist 全过，
 *   却因为没有别的字段可填而把契约缺口填进 contractViolations，journal 记成 fail）。
 *   它的去处是收口清单——呈现给人，行动项是回契约补齐或立变更事务，不是派回任务修。
 * - `emergentDecisions` 涌现决策 B 类（A46 D-A46-03，来自 <taskId>-builder.json）——
 *   「规格未覆盖、Builder 已按保守可逆方案先行」。与 contractGaps 同款通道：
 *   **不计退出码、不进 byTask、不并进 openPoints**，行动项是人批量校准
 *   （认可即结案，不认可立 `vima change` 或派修）。A 类（局部可逆）不进收口清单，
 *   留在报告与 retro 计数——把不需要人看的东西塞进收口清单，训练的是忽略整张清单。
 */
async function collectReportOutcomes(root) {
  const dir = path.join(root, REPORTS_DIR);
  let names;
  try {
    names = await readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return { openPoints: [], contractGaps: [], emergentDecisions: [] };
    throw err;
  }
  const openPoints = [];
  const contractGaps = [];
  const emergentDecisions = [];
  for (const name of names.sort()) {
    const bm = BUILDER_REPORT_RE.exec(name);
    if (bm) {
      let data;
      try {
        data = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
      } catch {
        continue;
      }
      const taskId = typeof data.taskId === 'string' && data.taskId !== '' ? data.taskId : bm[1];
      for (const d of Array.isArray(data.emergentDecisions) ? data.emergentDecisions : []) {
        if (!d || typeof d !== 'object' || d.cls !== 'B') continue;
        if (typeof d.what !== 'string' || d.what.trim() === '') continue;
        const why = typeof d.why === 'string' && d.why.trim() !== '' ? ` | 理由：${d.why}` : '';
        const where = typeof d.where === 'string' && d.where.trim() !== '' ? ` | 位置：${d.where}` : '';
        emergentDecisions.push({ taskId, decision: `${d.what}${why}${where}` });
      }
      continue;
    }
    const m = VERIFIER_RE.exec(name);
    if (!m) continue;
    let data;
    try {
      data = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
    } catch {
      continue; // 报告损坏不阻断对账（诊断归 /check 与人工）
    }
    const taskId = typeof data.taskId === 'string' && data.taskId !== '' ? data.taskId : m[1];
    for (const p of Array.isArray(data.points) ? data.points : []) {
      if (!p || typeof p !== 'object') continue;
      const label = typeof p.point === 'string' ? p.point : '';
      const isNg = /^NG-\d{2}\s*越界/.test(label);
      if (p.passed === true) continue;
      if (p.waived === true && !isNg) continue; // 越界项不适用豁免（§6.9 / A13）
      openPoints.push({ taskId, point: label, kind: isNg ? 'ng' : 'failed' });
    }
    // 缺省 []（存量报告没有这个键）；条目允许是字符串或带 issue 字段的对象
    // ——角色模板两种写法都出现过，与 journal.mjs collectReports 同口径。
    for (const g of Array.isArray(data.contractGaps) ? data.contractGaps : []) {
      const gap = typeof g === 'string' ? g
        : (g && typeof g === 'object' && typeof g.issue === 'string' ? g.issue : '');
      contractGaps.push({ taskId, gap });
    }
  }
  openPoints.sort(byTaskThenText('point'));
  contractGaps.sort(byTaskThenText('gap'));
  emergentDecisions.sort(byTaskThenText('decision'));
  return { openPoints, contractGaps, emergentDecisions };
}

/** 运行时错误条数（全部 runtime-errors[.<appId>].jsonl 的非空行之和）。 */
async function countRuntimeErrors(root) {
  const dir = path.join(root, REPORTS_DIR);
  let names;
  try {
    names = await readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return 0;
    throw err;
  }
  let n = 0;
  for (const name of names) {
    if (!RUNTIME_RE.test(name)) continue;
    const text = await readFile(path.join(dir, name), 'utf8');
    n += text.split('\n').filter((l) => l.trim() !== '').length;
  }
  return n;
}

function finding(rule, level, key, owners, paths, message) {
  return { rule, level, key, owners: [...new Set(owners)].sort(), paths: [...new Set(paths)].sort(), message };
}

/**
 * 集成对账的**唯一评估器**：只读、确定性，返回 §6.13 报告对象——不写盘、不打印、不判退出码。
 *
 * 为什么要拆出来：`.vima/reports/convergence.json` 只是这次扫描的缓存证据，不是可信布尔值。
 * certify 的 converged 级若直接采信磁盘上的旧报告，spec/任务在报告生成后改动就会被认证为
 * 已收敛——正是 A32「显式非宣称」要防的假成功。certify 因此复用本函数重算现状并与缓存比对，
 * 与 design 的 `evaluateDesignVerification` 同口径（视觉证据早已这么做，此处补齐同一标准）。
 *
 * @param {string} root 项目根
 * @param {{cliRoot: string}} opts
 * @returns {Promise<object>} §6.13 convergence.json 的完整报告对象
 * @throws VimaError('NO_TASKS') 无 docs/tasks/（非 vima 项目）
 */
export async function evaluateConvergence(root, { cliRoot }) {
  // 与 plan 同一道守卫（契约 §9 第 0 步）：非 vima 项目不静默产出空报告、
  // 不凭空创建 .vima/reports/——空报告会被误读成「集成对账通过」。
  if (!(await fileExists(path.join(root, 'docs', 'tasks')))) {
    throw precondition(
      'NO_TASKS',
      '未找到 docs/tasks/ 目录（非 vima 项目或 PLANNING 未产出任务），不做集成对账',
      'docs/tasks',
    );
  }
  const tasks = await loadTasks(root);
  const contracts = (await loadContracts(root, { tolerant: true })).filter((c) => c.module !== null);
  const roster = await resolveApps(root, { cliRoot });

  const findings = [];

  // ── 后端实现表（带 @vima 标注的业务代码才参与，与 V-CODE-02 同作用域）──
  const backendDir = roster.backend?.dir ?? 'backend';
  const beFiles = await scanMarkedFiles(root, `${backendDir}/src`, ['.java']);
  const impl = backendEndpointsOf(beFiles);
  const skipped = beFiles.length === 0 ? 'no-marked-backend' : null;

  // ── 前端调用表 ──
  const feByApp = await frontendCallsOf(root, roster);
  const markedFrontendFiles = [...feByApp.values()].reduce((s, v) => s + v.markedFiles, 0);

  // ── 责任田：契约 api 归一键 → 负责的 backend 任务（A18 ownedApisOf 缺省语义）──
  const ownersByKey = new Map();
  const declaredByContract = new Map();
  let contractApis = 0;
  for (const c of contracts) {
    // 责任田含 fullstack：与 V-TASK-11 的「承担实现的 side」同口径。只认 backend 会让
    // 「一个任务做完前后端」的形态整体逃过 V-INT-01/03（实测：fullstack 任务标 done、
    // 契约 4 个接口只实现 1 个，仍零 error 放行）。
    const beTasks = tasks.filter(
      (t) => t.fm.layer === 'business'
        && (t.fm.side === 'backend' || t.fm.side === 'fullstack')
        && t.fm.contract === c.file,
    );
    declaredByContract.set(
      c.file,
      beTasks.some((t) => Array.isArray(t.fm.apis) && t.fm.apis.length > 0),
    );
    const ownedSets = beTasks.map((t) => ({
      t,
      keys: new Set([...(ownedApisOf(t, contracts)?.keys ?? [])].map(codeKeyOf)),
    }));
    for (const api of c.apis) {
      if (typeof api.method !== 'string' || api.method === '') continue;
      if (typeof api.path !== 'string' || api.path === '') continue;
      contractApis += 1;
      const key = codeKeyOf(apiKey(api));
      const owners = ownedSets.filter((o) => o.keys.has(key)).map((o) => o.t);
      ownersByKey.set(key, { owners, contract: c.file, api });
    }
  }

  // ── V-INT-01/02/03（后端族；无带标注后端文件时整族跳过）──
  if (skipped === null) {
    for (const [key, info] of [...ownersByKey.entries()].sort()) {
      const entries = impl.get(key) ?? [];

      // V-INT-01 接口零实现：仅当负责任务全部 done（开发中途跑不假红）
      if (entries.length === 0) {
        if (info.owners.length > 0 && info.owners.every((t) => t.fm.status === 'done')) {
          findings.push(finding(
            'V-INT-01', 'error', key,
            info.owners.map((t) => t.id),
            [info.contract],
            `接口 ${key} 在契约 ${info.contract} 中声明，但带 @vima 标注的后端代码里没有任何实现`
              + `——负责任务 ${info.owners.map((t) => t.id).join('、')} 已标 done（漏实现）`,
          ));
        }
        continue;
      }

      // V-INT-02 接口重复实现：同一键落在 ≥2 个不同文件
      if (entries.length >= 2) {
        findings.push(finding(
          'V-INT-02', 'error', key,
          entries.flatMap((e) => e.taskIds),
          entries.map((e) => e.file),
          `接口 ${key} 在 ${entries.length} 处后端文件重复实现`
            + `（${entries.map((e) => `${e.file}${e.taskIds.length > 0 ? ` [@vima ${e.taskIds.join(',')}]` : ''}`).join(' / ')}）`
            + '——运行期路由冲突，需保留一处并删除其余',
        ));
      }

      // V-INT-03 越界实现：责任田已由 apis 声明时，实现者须在负责任务集内
      if (declaredByContract.get(info.contract) === true && info.owners.length > 0) {
        const ownerIds = new Set(info.owners.map((t) => t.id));
        for (const e of entries) {
          if (e.taskIds.length === 0) continue; // 无标注不参与（作用域自锚定）
          if (e.taskIds.some((id) => ownerIds.has(id))) continue;
          findings.push(finding(
            'V-INT-03', 'error', key,
            [...e.taskIds, ...ownerIds],
            [e.file],
            `接口 ${key} 由 ${e.file} 实现（@vima ${e.taskIds.join(',')}），`
              + `但该接口的负责任务是 ${[...ownerIds].sort().join('、')}（A18 apis 责任田被越界实现）`
              + '——须由负责任务承接，否则负责任务再实现一遍即成重复实现',
          ));
        }
      }
    }

    // ── V-INT-06（warn）被读的数据没人写（A42 D-A42-03；同属后端族，随族跳过）──
    findings.push(...checkDataProducers(await scanJavaFiles(root, `${backendDir}/src`), contracts));
  }

  // ── V-INT-04（warn）消费端调用缺失 ──
  for (const [key, info] of [...ownersByKey.entries()].sort()) {
    const consumers = consumersOf(info.api, roster);
    if (!Array.isArray(consumers)) continue; // 多端未声明 consumers 由 V-CON-07 报
    for (const appId of [...consumers].sort()) {
      const fe = feByApp.get(appId) ?? (roster.apps.length === 0 ? feByApp.get(null) : undefined);
      if (!fe || fe.markedFiles === 0) continue; // 该端尚未开工：不判
      if (fe.keys.has(key)) continue;
      const feOwners = tasks
        .filter((t) => t.fm.layer === 'business'
          && (t.fm.side === 'frontend' || t.fm.side === 'fullstack')
          && t.fm.contract === info.contract
          && (roster.multi ? t.fm.app === appId : true))
        .map((t) => t.id);
      findings.push(finding(
        'V-INT-04', 'warn', key, feOwners, [info.contract],
        `契约授权端 ${appId} 消费接口 ${key}，但该端带 @vima 标注的代码中没有任何调用`
          + '——前后端联调断点或契约冗余（接口没人用应回契约删除）',
      ));
    }
  }

  // ── V-INT-05（error）缺收尾流水线 ──
  if (tasks.some((t) => t.fm.layer === 'business') && !tasks.some((t) => t.fm.layer === 'pipeline')) {
    findings.push(finding(
      'V-INT-05', 'error', '', [], ['docs/tasks'],
      '存在 business 任务却无任何 layer=pipeline 任务——全量测试与代码审计不会被执行，'
        + '收口闸门形同虚设；请按 docs/tasks/_template-full-test.md 与 _template-code-audit.md 补 full-test 与 code-audit',
    ));
  }

  findings.sort((a, b) => {
    if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1;
    if (a.key !== b.key) return a.key < b.key ? -1 : 1;
    const pa = a.paths[0] ?? '';
    const pb = b.paths[0] ?? '';
    return pa < pb ? -1 : pa > pb ? 1 : 0;
  });

  // ── 既有红信号收口 ──
  const { openPoints, contractGaps, emergentDecisions } = await collectReportOutcomes(root);
  const runtimeErrors = await countRuntimeErrors(root);
  const markedIds = new Set();
  for (const f of beFiles) for (const id of markersOf(f.text)) markedIds.add(id);
  for (const fe of feByApp.values()) for (const id of fe.taskIds) markedIds.add(id);
  const unmarkedDone = tasks
    .filter((t) => t.fm.status === 'done'
      && (t.fm.layer === 'shared' || t.fm.layer === 'business')
      && !markedIds.has(t.id))
    .map((t) => t.id)
    .sort();

  // ── byTask：修复调度的确定性输入（主 Agent 不自行判断派给谁）──
  const byTask = {};
  const push = (id, line) => {
    if (!Object.hasOwn(byTask, id)) byTask[id] = [];
    if (!byTask[id].includes(line)) byTask[id].push(line);
  };
  for (const f of findings) {
    for (const id of f.owners) push(id, `${f.rule}${f.key === '' ? '' : ` ${f.key}`}`);
  }
  for (const p of openPoints) push(p.taskId, `未过点位 ${p.point}`);
  for (const id of Object.keys(byTask)) byTask[id].sort();

  return {
    schemaVersion: '1',
    scope: {
      markedBackendFiles: beFiles.length,
      markedFrontendFiles,
      contractApis,
      skipped,
    },
    summary: {
      errors: findings.filter((f) => f.level === 'error').length,
      warnings: findings.filter((f) => f.level === 'warn').length,
      openPoints: openPoints.length,
      // A42 D-A42-04：与 openPoints 并列但**不计退出码**——契约缺口是收口清单项，不是阻断项
      contractGaps: contractGaps.length,
      // A46 D-A46-03：同款通道——B 类涌现决策是待人校准的收口清单项，不是阻断项
      emergentDecisions: emergentDecisions.length,
      runtimeErrors,
      unmarkedDone: unmarkedDone.length,
    },
    findings,
    openPoints,
    contractGaps,
    emergentDecisions,
    unmarkedDone,
    byTask,
  };
}

/** vima converge [--json] [--strict] */
export async function run(argv, ctx) {
  let opts;
  try {
    ({ values: opts } = parseArgs({
      args: argv,
      options: { json: { type: 'boolean' }, strict: { type: 'boolean' } },
      allowPositionals: false,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }

  const root = ctx.cwd;
  const report = await evaluateConvergence(root, { cliRoot: ctx.cliRoot });
  const { contractApis, markedBackendFiles, markedFrontendFiles, skipped } = report.scope;
  const { openPoints, contractGaps, emergentDecisions, unmarkedDone, findings } = report;
  const runtimeErrors = report.summary.runtimeErrors;
  const errors = findings.filter((f) => f.level === 'error');
  const warnings = findings.filter((f) => f.level === 'warn');

  const text = stableStringify(report);
  await atomicWriteFile(path.join(root, REPORT_REL), text);
  if (opts.json) {
    process.stdout.write(text);
  } else {
    const lines = [
      `🔗 集成对账：契约接口 ${contractApis} 个 │ 带标注后端文件 ${markedBackendFiles} │ 前端 ${markedFrontendFiles}`,
      `   error ${errors.length} │ warn ${warnings.length} │ 未过点位 ${openPoints.length} │ 契约缺口 ${contractGaps.length} │ 涌现决策 B ${emergentDecisions.length} │ 运行时错误 ${runtimeErrors} │ done 无标注 ${unmarkedDone.length}`,
      `   报告：${REPORT_REL}`,
    ];
    if (skipped !== null) lines.push('   ⏭️ 后端族规则跳过：没有带 @vima 标注的后端文件（V-INT-01/02/03/06 不判）');
    if (errors.length === 0 && openPoints.length === 0) lines.push('✅ 集成对账通过（无阻断项）');
    process.stdout.write(`${lines.join('\n')}\n`);
  }

  const diag = [];
  for (const f of errors) diag.push(`❌ ${f.rule} ${f.key}: ${f.message}`);
  for (const f of warnings) diag.push(`⚠️ ${f.rule} ${f.key}: ${f.message}`);
  if (openPoints.length > 0) {
    diag.push(`❌ 未过点位 ${openPoints.length} 条（Verifier 报告聚合，豁免不计）：`);
    for (const p of openPoints.slice(0, 20)) diag.push(`  ${p.taskId}: ${p.point}`);
    if (openPoints.length > 20) diag.push(`  …其余 ${openPoints.length - 20} 条见报告`);
  }
  if (contractGaps.length > 0) {
    // A42 D-A42-04：与「未过点位」并列呈现但语义相反——实现侧已合规处置，欠的是契约。
    // 因此不计退出码、不进 byTask（派回任务修没有意义），行动项落在契约与变更事务上。
    diag.push(`📋 契约缺口 ${contractGaps.length} 条（实现侧已合规处置，不计 fail、不阻断）`
      + '——行动项：回契约补齐所缺的声明，或立 `vima change` 变更事务：');
    for (const g of contractGaps.slice(0, 20)) diag.push(`  ${g.taskId}: ${g.gap}`);
    if (contractGaps.length > 20) diag.push(`  …其余 ${contractGaps.length - 20} 条见报告`);
  }
  if (emergentDecisions.length > 0) {
    // A46 D-A46-03：规格未覆盖、Builder 已按保守可逆方案先行——待人批量校准，不阻断。
    diag.push(`🧭 涌现决策 B 类 ${emergentDecisions.length} 条（规格未覆盖、已按保守方案先行，不计 fail、不阻断）`
      + '——行动项：逐条校准，认可即结案，不认可立 `vima change` 或派修：');
    for (const d of emergentDecisions.slice(0, 20)) diag.push(`  ${d.taskId}: ${d.decision}`);
    if (emergentDecisions.length > 20) diag.push(`  …其余 ${emergentDecisions.length - 20} 条见报告`);
  }
  if (unmarkedDone.length > 0) {
    diag.push(`⚠️ done 却无任何 @vima 标注 ${unmarkedDone.length} 个：${unmarkedDone.join('、')}`);
  }
  if (diag.length > 0) process.stderr.write(`${diag.join('\n')}\n`);

  if (errors.length > 0 || openPoints.length > 0) return EXIT.CHECK_FAILED;
  if (opts.strict && warnings.length > 0) return EXIT.CHECK_FAILED;
  return EXIT.OK;
}
