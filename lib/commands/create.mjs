// vima create —— 多模板项目起盘（设计 §3.5/§3.6/§19.1；契约 §3/§6.3/§6.4/§12-A5）
// 流程：模板选择 → 环境依赖预检 → 拷贝 scaffold（内容与路径变量替换）
//       → 写 .vima/manifest.json → git init / npm install（可跳过）→ nextSteps。
// 偏离说明（契约 §6.3 已声明）：骨架只用内置 builtin 目录拷贝，不执行 npm create/spring init。
import path from 'node:path';
import { chmod, mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { EXIT, usageError, precondition, usageFromParseArgs } from '../util/errors.mjs';
import { fileExists, sha256, walkFiles } from '../util/fs.mjs';
import { listTemplates, loadTemplate } from '../model/template.mjs';
import { loadManifest, saveManifest } from '../model/manifest.mjs';
import { BUILTIN_KINDS } from '../model/apps.mjs';

const OPTS = {
  template: { type: 'string', short: 't' },
  apps: { type: 'string' }, // A16：端册声明 "id[:kind],..."（仅新形态模板支持）
  interactive: { type: 'boolean', short: 'i' },
  force: { type: 'boolean', short: 'f' },
  'no-git': { type: 'boolean' },
  'no-install': { type: 'boolean' },
};

const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/;
const APP_ID_RE = /^[a-z0-9][a-z0-9-]*$/; // A16：端 id 词法（同 taskId，契约 §14）

/** 统一 parseArgs 封装：非法/未知选项翻译为中文 usageError（exit 3，契约 §3）。C1 三命令共用。 */
export function parseOpts(argv, options) {
  try {
    return parseArgs({ args: argv, options, allowPositionals: true });
  } catch (err) {
    throw usageFromParseArgs(err);
  }
}

/** projectPkg：项目名小写并去掉全部非 a-z0-9 字符（Java 包名等场景）；空则回退 app。 */
export function projectPkgOf(name) {
  const compact = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'app';
  return /^[a-z]/.test(compact) ? compact : `app${compact}`;
}

/** 模板变量替换：内容与相对路径中的 {{projectName}}/{{projectPkg}}/{{createdAt}}/{{appId}}（A16）。 */
export function renderVars(text, vars) {
  return text.replace(/\{\{(projectName|projectPkg|createdAt|appId)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

/** 读 CLI 自身版本号（<cliRoot>/package.json）。 */
export async function readCliVersion(cliRoot) {
  const pkg = JSON.parse(await readFile(path.join(cliRoot, 'package.json'), 'utf8'));
  return pkg.version;
}

/** 执行单条 prerequisite 的 check 命令，从输出提取首个 x.y.z 版本号。 */
function probeTool(check) {
  const [cmd, ...args] = String(check).split(/\s+/).filter(Boolean);
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.error) return { found: false };
  const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  const m = out.match(/(\d+)\.(\d+)\.(\d+)/);
  return { found: true, version: m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null, versionText: m ? m[0] : null };
}

/** 版本约束比较：true 满足 / false 不满足 / null 无法判定（提不出版本号）。 */
function meetsConstraint(version, constraint) {
  if (!constraint || constraint === '*') return true;
  const m = String(constraint).match(/^>=\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!m) return true; // 未知约束语法：宽松放行（本版只支持 >= 与 *）
  if (!version) return null;
  const want = [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
  for (let i = 0; i < 3; i++) {
    if (version[i] > want[i]) return true;
    if (version[i] < want[i]) return false;
  }
  return true;
}

/**
 * 环境依赖预检（§3.6）：逐项 spawnSync 执行 check 命令。
 * @returns {{ lines: string[], failures: string[] }} failures 非空表示必需项不满足（调用方 exit 4）。
 */
export function checkPrerequisites(prerequisites = []) {
  const lines = [];
  const failures = [];
  for (const p of prerequisites) {
    const hint = p.hint ? `（${p.hint}）` : '';
    const probe = probeTool(p.check);
    if (!probe.found) {
      if (p.optional) {
        lines.push(`⚠️ 可选工具 ${p.tool} 未安装${hint}`);
      } else {
        lines.push(`❌ ${p.tool} 未安装（要求 ${p.constraint}）`);
        failures.push(`${p.tool} 未安装：请先安装并满足版本约束 ${p.constraint}（检查命令：${p.check}）`);
      }
      continue;
    }
    const ok = meetsConstraint(probe.version, p.constraint);
    if (ok === true) {
      lines.push(`✅ ${p.tool} ${probe.versionText ?? '已安装'} 满足 ${p.constraint}`);
    } else if (ok === null) {
      lines.push(`⚠️ ${p.tool} 已安装但无法提取版本号，跳过版本比较（要求 ${p.constraint}）`);
    } else if (p.optional) {
      lines.push(`⚠️ 可选工具 ${p.tool} 版本 ${probe.versionText} 低于 ${p.constraint}${hint}`);
    } else {
      lines.push(`❌ ${p.tool} 版本 ${probe.versionText} 低于要求 ${p.constraint}`);
      failures.push(`${p.tool} 当前版本 ${probe.versionText}，要求 ${p.constraint}，请升级后重试`);
    }
  }
  return { lines, failures };
}

/** 交互式模板选单（§3.3 简化版：node:readline 数字选单；非 TTY 抛 usageError）。 */
async function chooseTemplate(cliRoot) {
  const templates = await listTemplates(cliRoot);
  if (templates.length === 0) throw usageError('templates/ 目录下没有任何可用模板');
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw usageError(`非交互环境请用 --template 指定模板（可选：${templates.map((t) => t.id).join(' | ')}）`);
  }
  process.stdout.write('? 请选择项目模板：\n');
  templates.forEach((t, i) => {
    const mark = t.status === 'preview' ? ' [preview]' : '';
    process.stdout.write(`  ${i + 1}. ${t.name} (${t.id})${mark} - ${t.description}\n`);
  });
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let answer;
  try {
    answer = (await rl.question(`请输入序号 (1-${templates.length}): `)).trim();
  } finally {
    rl.close();
  }
  const idx = Number.parseInt(answer, 10);
  if (!Number.isInteger(idx) || idx < 1 || idx > templates.length) {
    throw usageError(`无效选择 "${answer}"（应输入 1-${templates.length} 的序号）`);
  }
  return templates[idx - 1].id;
}

// ── A16 端册（契约 §6.3/§6.4/§14）─────────────────────────────────────────────

/** 模板 kind 全集：内置缺省 + planning.kinds 覆盖（与 resolveApps 同口径）。 */
function kindsOf(template) {
  return { ...BUILTIN_KINDS, ...(template.planning?.kinds ?? {}) };
}

/** 模板 apps 声明里找骨架配置条目：同 id 命中优先，其次同 kind（同 kind 多实例场景）。 */
export function templateAppEntry(template, pick) {
  const declared = Array.isArray(template.apps) ? template.apps : [];
  return declared.find((a) => a && a.id === pick.id) ?? declared.find((a) => a && a.kind === pick.kind) ?? null;
}

/** 解析 --apps "id[:kind],..." → [{id, kind}]；id 词法 / kind 存在性 / id 唯一性均在此拦截。 */
export function parseAppsArg(str, template) {
  const declared = Array.isArray(template.apps) ? template.apps : [];
  if (declared.length === 0) {
    throw usageError(`模板 "${template.id}" 未声明端册（apps），不支持 --apps`);
  }
  const kinds = kindsOf(template);
  const picks = [];
  for (const partRaw of String(str).split(',')) {
    const part = partRaw.trim();
    if (part === '') continue;
    const [id, kindRaw] = part.split(':').map((s) => s.trim());
    if (!APP_ID_RE.test(id ?? '')) {
      throw usageError(`非法端 id "${id ?? ''}"（须匹配 ^[a-z0-9][a-z0-9-]*$）`);
    }
    const kind = kindRaw || declared.find((a) => a && a.id === id)?.kind;
    if (!kind) {
      throw usageError(`端 "${id}" 未指定 kind 且模板 apps 无同名条目（写法 id:kind，如 mp:mp-native）`);
    }
    if (!Object.hasOwn(kinds, kind)) {
      throw usageError(`未知 kind "${kind}"（模板 "${template.id}" 可用：${Object.keys(kinds).sort().join(' | ')}）`);
    }
    if (picks.some((p) => p.id === id)) throw usageError(`端 id "${id}" 重复`);
    picks.push({ id, kind });
  }
  if (picks.length === 0) throw usageError('--apps 为空（写法 id:kind，逗号分隔）');
  return picks;
}

/** 缺省端册：模板 apps 里 default:true 条目（无标记回落首条）。 */
function defaultPicks(template) {
  const declared = Array.isArray(template.apps) ? template.apps : [];
  const defaults = declared.filter((a) => a && a.default === true);
  const chosen = defaults.length > 0 ? defaults : declared.slice(0, 1);
  return chosen.map((a) => ({ id: a.id, kind: a.kind }));
}

/** 交互多选端（TTY；回车 = 缺省端册）。 */
async function chooseApps(template) {
  const declared = Array.isArray(template.apps) ? template.apps : [];
  const kinds = kindsOf(template);
  process.stdout.write('? 请选择要创建的端（逗号分隔序号，回车 = 默认）：\n');
  declared.forEach((a, i) => {
    const mark = kinds[a.kind]?.status === 'preview' ? ' [preview：仅规划，骨架待后续版本]' : '';
    const def = a.default === true ? '（默认）' : '';
    process.stdout.write(`  ${i + 1}. ${a.name ?? a.id} (${a.id}:${a.kind})${def}${mark}\n`);
  });
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let answer;
  try {
    answer = (await rl.question(`请输入序号 (1-${declared.length}，可多选): `)).trim();
  } finally {
    rl.close();
  }
  if (answer === '') return defaultPicks(template);
  const picks = [];
  for (const tok of answer.split(',')) {
    const idx = Number.parseInt(tok.trim(), 10);
    if (!Number.isInteger(idx) || idx < 1 || idx > declared.length) {
      throw usageError(`无效选择 "${tok.trim()}"（应输入 1-${declared.length} 的序号，逗号分隔）`);
    }
    const a = declared[idx - 1];
    if (!picks.some((p) => p.id === a.id)) picks.push({ id: a.id, kind: a.kind });
  }
  return picks;
}

/**
 * picks → manifest v2 端册条目（契约 §6.4）：布局一律 apps/<id>/（A28，改判 D-A16-03
 * 的按 N 分叉；存量根布局 dir "." 仍合法，消费方按 dir 数据寻址）；
 * sharedDirs 取模板条目声明（相对各自 dir，无变量）。
 */
export function buildRoster(template, picks) {
  return picks.map((pick) => {
    const entry = templateAppEntry(template, pick) ?? {};
    return {
      id: pick.id,
      name: typeof entry.name === 'string' ? entry.name : pick.id,
      kind: pick.kind,
      dir: `apps/${pick.id}`,
      codeDir: typeof entry.codeDir === 'string' && entry.codeDir !== '' ? entry.codeDir : 'src',
      sharedDirs: Array.isArray(entry.sharedDirs) ? entry.sharedDirs : [],
    };
  });
}

// 需做 {{var}} 内容替换的文本扩展名白名单（其余按原始字节透传，保证二进制安全）。
// 点文件（.gitkeep/.env）的 path.extname 为空串，走 basename 兜底匹配。
const TEXT_EXTS = new Set([
  '.ts', '.tsx', '.vue', '.js', '.mjs', '.cjs', '.json', '.md', '.html', '.css', '.svg',
  '.yml', '.yaml', '.xml', '.properties', '.txt', '.gitkeep', '.cmd', '.sh', '.env', '.java',
  // A23 mp-native：小程序三件套也是文本（WXML 自己的 {{ }} 不受影响——
  // renderVars 只认 projectName/projectPkg/createdAt/appId 四个名字）
  '.wxml', '.wxss', '.wxs',
]);
const NO_EXT_TEXT_MAX = 1024 * 1024; // 无扩展名文件（如 mvnw）：≤1MB 且不含 \0 才视为文本

/** 判定 scaffold 文件是否按文本处理（做变量替换）；否则按二进制原字节拷贝。 */
function isTextScaffoldFile(rel, buf) {
  const base = path.basename(rel).toLowerCase();
  if (base === '_env.demo') return true; // A27：落地改名为 .env.demo 的 demo 态开关，文本
  const ext = path.extname(base);
  if (ext) return TEXT_EXTS.has(ext);
  if (TEXT_EXTS.has(base)) return true; // .gitkeep / .env 这类点文件
  return buf.length <= NO_EXT_TEXT_MAX && !buf.includes(0); // 如 mvnw
}

// 临时文件序号：pid + 进程内自增（与 lib/util/fs.mjs 同款手法，不用随机数/时间戳）
let tmpSeq = 0;

/**
 * Buffer 原子写盘（契约 §4 的 atomicWriteFile 只收字符串，二进制路径在此内联实现）：
 * ensureDir → 写临时文件 → 继承源文件可执行位 → rename。
 */
async function atomicWriteScaffoldFile(dest, buf, srcMode) {
  await mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.${process.pid}.${++tmpSeq}.tmp`;
  try {
    await writeFile(tmp, buf);
    if (srcMode & 0o111) await chmod(tmp, srcMode & 0o777); // mvnw 等须可执行落地
    await rename(tmp, dest);
  } catch (err) {
    try {
      await unlink(tmp);
    } catch {
      /* 忽略清理失败 */
    }
    throw err;
  }
}

/**
 * 拷贝单个骨架源目录到目标位置（destKey "" = 项目根）：相对路径一律做变量替换；
 * 内容仅对文本文件替换，二进制（.png/.woff2 等）原字节透传；源文件可执行位保留。
 */
/**
 * 解算一个骨架源目录的落盘条目（**纯读**：不写任何文件）。
 * copyDir 与 A19 的 `update --scaffold-diff` 共用同一份实现——渲染/改名/文本判定
 * 只此一处，避免两份逻辑各自漂移。
 * @returns {Promise<Array<{destRel: string, out: Buffer, mode: number}>>} destRel 为 '/' 分隔
 */
export async function resolveScaffoldEntries(template, srcRel, destKeyRaw, vars) {
  const destKey = destKeyRaw === '.' ? '' : destKeyRaw;
  const srcDir = path.join(template.dir, String(srcRel));
  if (!(await fileExists(srcDir))) return [];
  const entries = [];
  // 排除依赖与构建产物目录：模板源若被本地构建污染（如 backend 的 target/），
  // 垃圾会连着进生成项目与 A19 骨架基线（carelink-admin 实测中招 3 条）
  for (const rel of await walkFiles(srcDir, { exclude: ['node_modules', 'target'] })) {
    const srcPath = path.join(srcDir, rel);
    const buf = await readFile(srcPath);
    const { mode } = await stat(srcPath);
    let destRel = renderVars(destKey ? `${destKey}/${rel}` : rel, vars);
    // 落地改名：模板源用 "_gitignore"/"_env.demo" 存放（npm 发包会剥离 .gitignore
    // 与 .env* 文件，模板目录里放不住点号原名），拷贝到生成项目时改回点号名。
    if (path.basename(destRel) === '_gitignore') {
      destRel = path.join(path.dirname(destRel), '.gitignore');
    }
    if (path.basename(destRel) === '_env.demo') {
      destRel = path.join(path.dirname(destRel), '.env.demo');
    }
    const out = isTextScaffoldFile(rel, buf)
      ? Buffer.from(renderVars(buf.toString('utf8'), vars), 'utf8')
      : buf;
    entries.push({ destRel: destRel.split(path.sep).join('/'), out, mode });
  }
  return entries;
}

async function copyDir(template, srcRel, target, destKeyRaw, vars, baseline = null) {
  const entries = await resolveScaffoldEntries(template, srcRel, destKeyRaw, vars);
  for (const { destRel, out, mode } of entries) {
    await atomicWriteScaffoldFile(path.join(target, destRel), out, mode);
    // A19：记录**落盘后实际内容**的哈希作骨架基线，供 update --scaffold-diff 三方比较
    if (baseline) baseline.push({ path: destRel, checksum: `sha256:${sha256(out)}` });
  }
  return entries.length;
}

/**
 * A19：当前模板源解算出的全部骨架条目哈希（与 create 落盘内容同源同算法）。
 * @returns {Promise<Map<string, string>>} destRel → 'sha256:<hex>'
 */
export async function scaffoldChecksums(template, vars, roster = null) {
  const out = new Map();
  const add = async (srcRel, destKey, v) => {
    for (const e of await resolveScaffoldEntries(template, srcRel, destKey, v)) {
      out.set(e.destRel, `sha256:${sha256(e.out)}`);
    }
  };
  if (roster) {
    const kinds = kindsOf(template);
    for (const app of roster) {
      const entry = templateAppEntry(template, app) ?? {};
      if (kinds[app.kind]?.status === 'preview' || typeof entry.scaffold !== 'string') continue;
      await add(entry.scaffold, app.dir, { ...vars, appId: app.id });
    }
    if (template.backend && typeof template.backend.scaffold === 'string') {
      const dir = typeof template.backend.dir === 'string' ? template.backend.dir : 'backend';
      await add(template.backend.scaffold, dir, { ...vars, appId: 'backend' });
    }
    if (template.root && typeof template.root.scaffold === 'string') {
      await add(template.root.scaffold, '', { ...vars, appId: 'root' }); // A28 根卫生资产，与 create 同源
    }
    return out;
  }
  const pairs =
    template.scaffold && typeof template.scaffold === 'object'
      ? Object.entries(template.scaffold)
      : [['', 'scaffold']];
  for (const [destKey, srcRel] of pairs) await add(srcRel, destKey, vars);
  return out;
}

/**
 * 旧形态拷贝：scaffold 字段为 { 目标位置: 相对目录 }，目标位置 "." 或 ""
 * 表示项目根（设计 §15）；缺省（preview 模板）时整个 scaffold/ 落到项目根。
 */
async function copyScaffold(template, target, vars, baseline = null) {
  const entries =
    template.scaffold && typeof template.scaffold === 'object'
      ? Object.entries(template.scaffold)
      : [['', 'scaffold']];
  let count = 0;
  for (const [destKey, srcRel] of entries) {
    count += await copyDir(template, srcRel, target, destKey, vars, baseline);
  }
  return count;
}

/**
 * A16 端册拷贝：逐端拷贝各 kind 骨架（{{appId}} 注入该端 id）+ backend 骨架
 * （appId 注入 "backend"）。kind status=preview 或无骨架声明的端跳过拷贝（入册不生成，
 * A5 分级下推到 kind），返回 skipped 供调用方显式警告。
 */
async function copyRosterScaffold(template, target, roster, baseVars, baseline = null) {
  const kinds = kindsOf(template);
  let count = 0;
  const skipped = [];
  for (const app of roster) {
    const entry = templateAppEntry(template, app) ?? {};
    if (kinds[app.kind]?.status === 'preview' || typeof entry.scaffold !== 'string') {
      skipped.push(app);
      continue;
    }
    count += await copyDir(template, entry.scaffold, target, app.dir, { ...baseVars, appId: app.id }, baseline);
  }
  if (template.backend && typeof template.backend.scaffold === 'string') {
    const dir = typeof template.backend.dir === 'string' ? template.backend.dir : 'backend';
    count += await copyDir(template, template.backend.scaffold, target, dir, { ...baseVars, appId: 'backend' }, baseline);
  }
  // A28：项目根卫生资产（README/.gitignore 等项目级文件）。端一律落 apps/<id>/ 后，
  // 项目根不再有任何端骨架顺带提供的文件，跨端关注点（忽略规则、项目说明）由此补位。
  if (template.root && typeof template.root.scaffold === 'string') {
    count += await copyDir(template, template.root.scaffold, target, '', { ...baseVars, appId: 'root' }, baseline);
  }
  return { count, skipped };
}

export async function run(argv, ctx) {
  const { values, positionals } = parseOpts(argv, OPTS);
  const name = positionals[0];
  if (!name) throw usageError('缺少项目名：vima create <project-name> [--template <id>]');
  if (positionals.length > 1) throw usageError(`多余的位置参数 "${positionals[1]}"`);
  if (!NAME_RE.test(name)) {
    throw usageError(`非法项目名 "${name}"（须以字母或数字开头，只含字母/数字/-/_）`);
  }

  const target = path.resolve(ctx.cwd, name);
  if ((await fileExists(target)) && !values.force) {
    throw precondition('DIR_EXISTS', `目录 "${name}" 已存在（如需覆盖请加 --force）`, name);
  }

  // -i/--interactive 强制进入交互选单（§19.1，契约 §14）；否则 --template 直用，缺省回落交互
  const interactive = values.interactive || !values.template;
  const templateId = !interactive ? values.template : await chooseTemplate(ctx.cliRoot);
  const template = await loadTemplate(ctx.cliRoot, templateId);

  // A5 能力诚实分级：preview 模板照常创建，但打印显眼警告
  if (template.status === 'preview') {
    process.stdout.write(
      '\n⚠️⚠️ 该模板为 preview：仅有代码骨架，规划体系（planning 资产）尚未就绪，\n' +
        '     vima init 将拒绝在此项目运行（A5 能力诚实分级），后续版本补齐。\n\n',
    );
  }

  // A16 端册（契约 §14）：--apps 显式声明 > 交互多选 > 模板 default 端；旧形态模板走原路径
  const isRosterTemplate = Array.isArray(template.apps) && template.apps.length > 0;
  let picks = null;
  if (values.apps !== undefined) {
    picks = parseAppsArg(values.apps, template);
  } else if (isRosterTemplate) {
    picks =
      interactive && template.apps.length > 1 && process.stdin.isTTY && process.stdout.isTTY
        ? await chooseApps(template)
        : defaultPicks(template);
  }
  const roster = picks ? buildRoster(template, picks) : null;

  // A16 --force 重跑保护：已有 manifest 且 templateId 不同 → TEMPLATE_MISMATCH（防端册/清单被覆写）
  const prev = await loadManifest(target);
  if (prev && typeof prev.templateId === 'string' && prev.templateId !== template.id) {
    throw precondition(
      'TEMPLATE_MISMATCH',
      `目录已有 manifest（templateId=${prev.templateId}），与本次模板 ${template.id} 不一致；` +
        '如确要换模板请先自行处理 .vima/manifest.json',
      '.vima/manifest.json',
    );
  }

  // 环境依赖预检（§3.6）：必需缺失/版本不足 → exit 4 并输出安装指引
  const { lines, failures } = checkPrerequisites(template.prerequisites);
  if (lines.length > 0) process.stdout.write(`环境依赖预检：\n${lines.map((l) => `  ${l}`).join('\n')}\n`);
  if (failures.length > 0) {
    throw precondition(
      'PREREQ',
      `环境依赖不满足，已中止创建：\n${failures.map((f) => `  - ${f}`).join('\n')}`,
    );
  }

  // 拷贝骨架（变量替换）：端册模板逐端拷贝（{{appId}} 注入），旧形态走原路径
  const createdAt = new Date().toISOString(); // 真实时间戳（契约 §3 例外项）
  const vars = { projectName: name, projectPkg: projectPkgOf(name), createdAt };
  let fileCount;
  const scaffoldBaseline = []; // A19：骨架基线（落盘内容哈希），写入 manifest.files.scaffold
  if (roster) {
    const r = await copyRosterScaffold(template, target, roster, vars, scaffoldBaseline);
    fileCount = r.count;
    for (const app of r.skipped) {
      // preview kind：入册但跳过骨架（A5 分级下推到 kind，PLANNING 可先行）
      process.stdout.write(
        `⚠️ 端 ${app.id}（kind ${app.kind}）为 preview：已入册但跳过骨架生成，` +
          'PLANNING 全流程可用，骨架随后续版本提供\n',
      );
    }
  } else {
    fileCount = await copyScaffold(template, target, vars, scaffoldBaseline);
  }
  const rosterNote = roster ? `，端：${roster.map((a) => a.id).join(' + ')}` : '';
  process.stdout.write(`已生成骨架文件 ${fileCount} 个（模板：${template.name} ${template.id}${rosterNote}）\n`);

  // 写 .vima/manifest.json（契约 §6.4；managed 由 vima init 填充，此处先空）。
  // A16：端册模板写 schemaVersion 2 + apps/backend（sharedDirs 渲染变量为具体路径）；
  // --force 重跑合并：保留既有 files/createdAt/端册（端册已存在时不覆盖并警告）。
  const vimaVersion = await readCliVersion(ctx.cliRoot);
  const keepRoster = prev && Array.isArray(prev.apps);
  if (keepRoster && roster) {
    process.stderr.write('⚠️ 端册已存在于 manifest，保留原值（增端请用后续版本的 vima app add）\n');
  }
  const backendEntry =
    template.backend && typeof template.backend === 'object'
      ? {
          dir: typeof template.backend.dir === 'string' ? template.backend.dir : 'backend',
          sharedDirs: (Array.isArray(template.backend.sharedDirs) ? template.backend.sharedDirs : []).map((d) =>
            renderVars(d, vars),
          ),
        }
      : undefined;
  await saveManifest(target, {
    schemaVersion: roster || keepRoster ? '2' : '1',
    vimaVersion,
    templateId: template.id,
    createdAt: prev?.createdAt ?? createdAt,
    ...(keepRoster
      ? { apps: prev.apps, ...(prev.backend ? { backend: prev.backend } : {}) }
      : roster
        ? { apps: roster, ...(backendEntry ? { backend: backendEntry } : {}) }
        : {}),
    files: {
      ...(prev?.files ?? { managed: [], userOwned: [] }),
      // A19 骨架基线：--force 重跑时按本次实际落盘重建（旧基线已不再对应磁盘内容）
      scaffold: scaffoldBaseline.sort((a, b) => (a.path < b.path ? -1 : 1)),
    },
  });

  // git init（--no-git 跳过；git 不存在 → 警告继续）
  if (!values['no-git']) {
    const r = spawnSync('git', ['init'], { cwd: target, encoding: 'utf8' });
    if (r.error || r.status !== 0) {
      // 独立 ⚠️ 提示走 stderr（契约 §3 输出流向）
      process.stderr.write('⚠️ git 不可用或初始化失败，已跳过 git init（可稍后手动执行）\n');
    } else {
      process.stdout.write('✅ 已初始化 Git 仓库\n');
    }
  }

  // npm install（--no-install 跳过；A16 逐端执行——各端 package.json 在各自 dir；失败 → 警告不中止）
  if (!values['no-install']) {
    const installDirs = roster
      ? roster.map((a) => ({ label: `端 ${a.id}`, dir: a.dir === '.' ? target : path.join(target, a.dir) }))
      : [{ label: '前端', dir: target }];
    for (const { label, dir } of installDirs) {
      if (!(await fileExists(path.join(dir, 'package.json')))) continue;
      process.stdout.write(`正在安装${label}依赖（npm install，可能需要几分钟）…\n`);
      const r = spawnSync('npm', ['install'], { cwd: dir, encoding: 'utf8' });
      if (r.error || r.status !== 0) {
        process.stderr.write(`⚠️ ${label} npm install 失败，已跳过（可稍后手动执行）\n`);
      } else {
        process.stdout.write(`✅ ${label}依赖安装完成\n`);
      }
    }
  }

  process.stdout.write(
    `\n✅ 项目 "${name}" 创建完成！\n\n下一步：\n  1. cd ${name}\n  2. vima init\n  3. vima go\n`,
  );
  warnClaudeSessionAssets(target);
  return EXIT.OK;
}

/**
 * Claude Code 资产未注册告警（A40）。
 *
 * Claude Code **只在会话启动时**加载会话项目根的 `.claude/settings.json`。由此推出一条
 * **永真**的事实：在一条已经开着的会话里 create/init 出来的 `.claude/`，
 * 在这条会话里一定不生效——它在会话启动那一刻还不存在。若项目根本身还不是会话项目根
 * （会话开在工作区根、项目建在子目录），那就连重启也救不了，必须在项目根重开。
 *
 * 不生效的后果全是**静默**的：guard-shared 不设防、post-write 巡检不运行、
 * journal 收不到 report 事件，于是 `vima status` 的「有轨迹/已验收」两档恒为 0，
 * 而 doctor 在 A40 之前还会报「体检通过」。实战代价：sustain-v4（2026-08-15）整整一个
 * 开发期跑完才发现。提示放在创建/初始化的当场——纠正成本在那一刻最低（一条 cd）。
 *
 * 判据分两级，都不猜：
 *   · `CLAUDE_PROJECT_DIR` 存在且 ≠ 项目根 → 确定错位，给「必须换目录重开」；
 *   · 只能确认「在 Claude 会话里」（`CLAUDE_CODE_SESSION_ID` / `AI_AGENT`）→
 *     给「本会话尚未加载，需重开」。两者都不成立（普通终端）→ 不打印。
 *
 * @param {string} projectRoot 目标项目根绝对路径
 * @returns {boolean} 是否打印了告警（供测试与调用方判断）
 */
export function warnClaudeSessionAssets(projectRoot) {
  const sessionDir = process.env.CLAUDE_PROJECT_DIR;
  const inClaude = Boolean(sessionDir || process.env.CLAUDE_CODE_SESSION_ID || process.env.AI_AGENT);
  if (!inClaude) return false;
  const target = path.resolve(projectRoot);
  const session = sessionDir ? path.resolve(sessionDir) : null;
  const mismatched = session !== null && session !== target;

  const head = mismatched
    ? [
      '⚠️  会话根错位：本会话的项目根是',
      `      ${session}`,
      '    而本项目在',
      `      ${target}`,
    ]
    : ['⚠️  本会话尚未加载本项目的 .claude —— 它在会话启动时还不存在'];

  process.stderr.write(
    [
      '',
      ...head,
      '',
      '    Claude Code 只在会话启动时加载会话项目根的 .claude/settings.json，所以现在',
      '    hooks / 子代理 / skills 都未注册：共享层写保护、写后巡检、过程轨迹采集均不生效，',
      '    vima status 的「有轨迹/已验收」会一直显示 0（这不是进度为 0，是采集链路没接上）。',
      '',
      '    生效方式（二选一）：',
      `      · cd ${target} && claude     # 在项目根重开会话`,
      '      · vima go                     # 从项目根另起一条 /go 会话',
      '',
    ].join('\n'),
  );
  return true;
}

