// hook 公共件 —— 定位 vima 内核 · 读 stdin · 失败要么放行要么喊出来。
//
// 岗位说明：这四个 hook 是**采集**，不是否决。约束 C4「设计与开发阶段不阻塞」，
// 所以没有 PreToolUse、没有 exit 2。hook 存在的唯一理由是它**非自愿**——
// 不依赖模型意愿必然执行，这是「没凭证不入账」唯一的地基。
//
// 上一代的两个病，这里逐个对着治：
//   1. hook 命令写相对路径 → agent 一 cd 就静默失效（实测 4 个 hook 全未生效
//      而体检报「通过」）。→ settings.json 一律 `$CLAUDE_PROJECT_DIR` 绝对锚定。
//   2. 拦截时喊得很大声、失效时一声不吭。→ 本文件的 run()：内部异常一律写
//      stderr 并 exit 1（非阻塞错误，用户看得见），绝不吞掉。
//      「不在 vima 项目里」不算失败，静默 exit 0。
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { access, readFile, realpath, stat } from 'node:fs/promises';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORE_REL = path.join('lib', 'core', 'project.mjs');

async function hasCore(dir) {
  try {
    await access(path.join(dir, CORE_REL));
    return true;
  } catch {
    return false;
  }
}

/** 从某个目录起向上找带 lib/core/ 的 vima 安装根。 */
async function upward(from) {
  let dir = path.resolve(from);
  for (;;) {
    if (await hasCore(dir)) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/**
 * 找到 vima 的安装根。
 *
 * 四条路径按「显式 → 就近 → 解析器 → PATH」排列。找不到就抛，
 * 由 run() 打成一行清楚的 stderr——猜一个路径去 import 只会换来更难查的报错。
 */
export async function findVimaHome(env = process.env) {
  const tried = [];

  if (env.VIMA_HOME) {
    tried.push(`VIMA_HOME=${env.VIMA_HOME}`);
    if (await hasCore(env.VIMA_HOME)) return env.VIMA_HOME;
  }

  // 就近：项目自己装了 vima 时，node_modules 里就有
  let dir = HERE;
  for (;;) {
    const cand = path.join(dir, 'node_modules', '@vima-tech', 'cli');
    if (await hasCore(cand)) return cand;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  tried.push(`node_modules 自 ${HERE} 逐级向上`);

  try {
    const req = createRequire(import.meta.url);
    const p = req.resolve('@vima-tech/cli/lib/core/project.mjs');
    return path.resolve(path.dirname(p), '..', '..');
  } catch {
    tried.push('require.resolve("@vima-tech/cli")');
  }

  for (const p of (env.PATH ?? '').split(path.delimiter)) {
    if (!p) continue;
    const bin = path.join(p, 'vima');
    try {
      await access(bin);
      const home = await upward(path.dirname(await realpath(bin)));
      if (home) return home;
    } catch { /* 下一个 */ }
  }
  tried.push('PATH 中的 vima 可执行文件');

  throw new Error(
    `找不到 vima 内核（需要 <home>/${CORE_REL}）。已尝试：${tried.join('；')}。`
    + ' 设 VIMA_HOME 指向 vima 安装目录即可修复。',
  );
}

/** 动态加载内核三件。定位逻辑只有 core/project.mjs 一处真源，hook 不自己造。 */
export async function loadCore(env = process.env) {
  const home = await findVimaHome(env);
  const url = (rel) => pathToFileURL(path.resolve(home, 'lib', 'core', rel)).href;
  const [project, events, claims] = await Promise.all([
    import(url('project.mjs')),
    import(url('events.mjs')),
    import(url('claims.mjs')),
  ]);
  return { home, project, events, claims };
}

export async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * hook 外壳。
 *
 * 约定：fn 返回字符串 → 作为 additionalContext 注入；返回 undefined → 什么都不输出。
 * 任何异常 → stderr 一行 + exit 1（**非阻塞**错误码；exit 2 才是否决，我们永不用）。
 */
export async function run(name, event, fn) {
  // 用 exitCode 而不是 process.exit()：stdout/stderr 接到管道时是异步写，
  // 立刻 exit 会把注入的上下文截断，而且截断得没有任何提示。
  let input = {};
  try {
    const raw = await readStdin();
    if (raw.trim()) input = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(`vima hook ${name}: 读不懂 stdin 的 JSON：${err?.message ?? err}\n`);
    process.exitCode = 1;
    return;
  }
  try {
    const out = await fn(input);
    if (typeof out === 'string' && out !== '') {
      process.stdout.write(`${JSON.stringify({
        hookSpecificOutput: { hookEventName: event, additionalContext: out },
      })}\n`);
    }
  } catch (err) {
    process.stderr.write(`vima hook ${name}: ${err?.stack ?? err?.message ?? err}\n`);
    process.exitCode = 1;
  }
}

const MAX_PROJECTION_BYTES = 4 * 1024 * 1024;

/**
 * 项目现状摘要 —— SessionStart 与 UserPromptSubmit 共用。
 *
 * 两个 hook 的价值都是「在场权」：会话一开始就知道自己在哪个项目、做到哪了，
 * 每轮提问都知道当前前沿与待复核的裁定。用同一个投影，避免两处口径分叉。
 */
export async function status(root, core) {
  const file = path.join(root, '.vima', 'events.jsonl');
  try {
    const st = await stat(file);
    if (st.size > MAX_PROJECTION_BYTES) {
      return { oversize: true, bytes: st.size };
    }
  } catch { /* 无事件日志：按空投影继续 */ }

  const config = await core.project.readConfig(root);
  const { events, corrupt } = await core.events.readAll(root);
  const projected = core.claims.project(events);
  const layers = core.claims.LAYERS.map((layer) => {
    let total = 0;
    let met = 0;
    for (const c of projected.claims.values()) {
      if (c.layer !== layer) continue;
      total += 1;
      if (core.claims.meets(c)) met += 1;
    }
    return { layer, total, met };
  });
  // 前沿 = 从上游往下第一个「有命题但没做完」的层。它是派生的，不落盘，
  // 因此不会出现「阶段字段说 DEVELOPING 而实际 spec 还没写完」那种双真源矛盾。
  const frontier = layers.find((l) => l.total > 0 && l.met < l.total) ?? null;
  const openRulings = projected.rulings.filter((r) => !r.overriddenBy);
  return {
    oversize: false,
    config,
    corrupt,
    eventCount: events.length,
    stats: projected.stats,
    layers,
    frontier,
    openRulings,
  };
}

export function fmtRuling(r) {
  const conf = r.confidence ?? 'unknown';
  const blast = r.blastRadius ? ` · 影响面 ${r.blastRadius}` : '';
  return `- [${r.id.slice(0, 8)}] ${r.question} → ${r.chosen ?? '（未记录选项）'}（置信度 ${conf}${blast}）`;
}

export async function readText(file) {
  return readFile(file, 'utf8');
}
