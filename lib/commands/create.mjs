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
import { fileExists, walkFiles } from '../util/fs.mjs';
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
  return name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'app';
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
      throw usageError(`端 "${id}" 未指定 kind 且模板 apps 无同名条目（写法 id:kind，如 patient:mp-native）`);
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
 * picks → manifest v2 端册条目（契约 §6.4）：N=1 落项目根 dir "."，N≥2 一律 apps/<id>/；
 * sharedDirs 取模板条目声明（相对各自 dir，无变量）。
 */
export function buildRoster(template, picks) {
  const multi = picks.length > 1;
  return picks.map((pick) => {
    const entry = templateAppEntry(template, pick) ?? {};
    return {
      id: pick.id,
      name: typeof entry.name === 'string' ? entry.name : pick.id,
      kind: pick.kind,
      dir: multi ? `apps/${pick.id}` : '.',
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
]);
const NO_EXT_TEXT_MAX = 1024 * 1024; // 无扩展名文件（如 mvnw）：≤1MB 且不含 \0 才视为文本

/** 判定 scaffold 文件是否按文本处理（做变量替换）；否则按二进制原字节拷贝。 */
function isTextScaffoldFile(rel, buf) {
  const base = path.basename(rel).toLowerCase();
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
async function copyDir(template, srcRel, target, destKeyRaw, vars) {
  const destKey = destKeyRaw === '.' ? '' : destKeyRaw;
  const srcDir = path.join(template.dir, String(srcRel));
  if (!(await fileExists(srcDir))) return 0;
  let count = 0;
  for (const rel of await walkFiles(srcDir, { exclude: ['node_modules'] })) {
    const srcPath = path.join(srcDir, rel);
    const buf = await readFile(srcPath);
    const { mode } = await stat(srcPath);
    let destRel = renderVars(destKey ? `${destKey}/${rel}` : rel, vars);
    // 落地改名：模板源用 "_gitignore" 存放（npm 发包会剥离 .gitignore 文件，
    // 模板目录里放不住点号原名），拷贝到生成项目时改回 ".gitignore"。
    if (path.basename(destRel) === '_gitignore') {
      destRel = path.join(path.dirname(destRel), '.gitignore');
    }
    const out = isTextScaffoldFile(rel, buf)
      ? Buffer.from(renderVars(buf.toString('utf8'), vars), 'utf8')
      : buf;
    await atomicWriteScaffoldFile(path.join(target, destRel), out, mode);
    count += 1;
  }
  return count;
}

/**
 * 旧形态拷贝：scaffold 字段为 { 目标位置: 相对目录 }，目标位置 "." 或 ""
 * 表示项目根（设计 §15）；缺省（preview 模板）时整个 scaffold/ 落到项目根。
 */
async function copyScaffold(template, target, vars) {
  const entries =
    template.scaffold && typeof template.scaffold === 'object'
      ? Object.entries(template.scaffold)
      : [['', 'scaffold']];
  let count = 0;
  for (const [destKey, srcRel] of entries) {
    count += await copyDir(template, srcRel, target, destKey, vars);
  }
  return count;
}

/**
 * A16 端册拷贝：逐端拷贝各 kind 骨架（{{appId}} 注入该端 id）+ backend 骨架
 * （appId 注入 "backend"）。kind status=preview 或无骨架声明的端跳过拷贝（入册不生成，
 * A5 分级下推到 kind），返回 skipped 供调用方显式警告。
 */
async function copyRosterScaffold(template, target, roster, baseVars) {
  const kinds = kindsOf(template);
  let count = 0;
  const skipped = [];
  for (const app of roster) {
    const entry = templateAppEntry(template, app) ?? {};
    if (kinds[app.kind]?.status === 'preview' || typeof entry.scaffold !== 'string') {
      skipped.push(app);
      continue;
    }
    count += await copyDir(template, entry.scaffold, target, app.dir, { ...baseVars, appId: app.id });
  }
  if (template.backend && typeof template.backend.scaffold === 'string') {
    const dir = typeof template.backend.dir === 'string' ? template.backend.dir : 'backend';
    count += await copyDir(template, template.backend.scaffold, target, dir, { ...baseVars, appId: 'backend' });
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
  if (roster) {
    const r = await copyRosterScaffold(template, target, roster, vars);
    fileCount = r.count;
    for (const app of r.skipped) {
      // preview kind：入册但跳过骨架（A5 分级下推到 kind，PLANNING 可先行）
      process.stdout.write(
        `⚠️ 端 ${app.id}（kind ${app.kind}）为 preview：已入册但跳过骨架生成，` +
          'PLANNING 全流程可用，骨架随后续版本提供\n',
      );
    }
  } else {
    fileCount = await copyScaffold(template, target, vars);
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
    files: prev?.files ?? { managed: [], userOwned: [] },
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
    `\n✅ 项目 "${name}" 创建完成！\n\n下一步：\n  1. cd ${name}\n  2. vima init\n  3. claude\n`,
  );
  return EXIT.OK;
}
