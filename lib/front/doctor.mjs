// 工具体检 —— 「vima 这套工具在这个项目里装对没有」。
//
// ─────────────────────────────────────────────────────────────────────────
// 为什么它不是第二个 audit（反查 docs/v4-optimization-recommendations.md P1-3）
//
//   audit   项目符不符合规格、证据够不够   —— 看的是命题与代码
//   doctor  工具装对没有                   —— 看的是 hook 会不会真触发、
//                                             MCP 可不可达、投影有没有漂、
//                                             版本兼不兼容、资产在不在
//
// 两者的判据不许互抄：凡 audit 已经有判据的（死规则、登记的皮/块读不读得出、
// 覆盖率、闭合），doctor 一律不重复；凡 doctor 要用别处已有的判据的
// （投影漂移 = `vima sync --check`），一律**调它**，不在这里再写一份。
//
// ## 这个命令的灵魂：问「它生效了吗」，不是「它在吗」
//
// v3 用血的教训证明过「资产文件存在」≠「会话里生效」：4 个 hook、6 个子代理、
// 4 个 skill 一个都没注册，而体检报「通过」，开发期跑完 88 个任务、
// `vima status` 显示 0/0/0。所以本文件的每一项都要往前推一步：
//
//   文件在  → 还要 settings.json 真的接了它（接了不存在的 / 存在没接的，两头都查）
//   接上了  → 还要命令锚在 $CLAUDE_PROJECT_DIR（v3 栽在相对路径 + agent 一 cd
//             就找不到，且**失败无任何输出**）
//   锚对了  → 还要**真起一次进程**看退出码（import 挂了、找不到内核，文件照样在）
//
// ## 三条输出纪律
//
//   ① 每项都要说清「查了什么」（checked 字段）。
//   ② **查不了的要明说「没查」（warn），不许显示通过。** 这个仓库的核心价值观是
//      「静默为空不算通过」——doctor 自己违反它，就没有任何东西还能兜底。
//   ③ 每条 error/warn 给可执行的下一步（跑什么命令能修），不是「请检查配置」。
// ─────────────────────────────────────────────────────────────────────────
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { readFile, readdir, access, mkdir, mkdtemp, rm } from 'node:fs/promises';

import { frontmatter, atomicWrite } from '../core/fsx.mjs';

/**
 * `.claude/` 的落点清单。
 *
 * 分层边界的**明文例外**（见 CLAUDE.md）：`lib/` 平台中立、不实现 Claude Code
 * 语义，唯一例外是 init/doctor 作为安装器/体检器持有的这份落点清单。
 * 它变更时必须与 `templates/project/.claude/` 同步——否则体检会去查一个
 * 早已搬家的落点，然后报「通过」。
 */
export const LAYOUT = Object.freeze({
  settings: ['.claude', 'settings.json'],
  hooksDir: ['.claude', 'hooks'],
  agentsDir: ['.claude', 'agents'],
  skillsDir: ['.claude', 'skills'],
  rulesDir: ['.claude', 'rules'],
  mcp: ['.mcp.json'],
});

/** hooks 目录里以 `_` 开头的是公共件不是 hook——判据与 z.seams 的接线检查同口径。 */
const NOT_A_HOOK = (f) => f.startsWith('_') || !f.endsWith('.mjs');

const HOOK_TIMEOUT_MS = 15_000;
const MCP_TIMEOUT_MS = 15_000;

// ── 小工具 ────────────────────────────────────────────────────────────────

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function listDir(dir) {
  try { return (await readdir(dir)).sort(); } catch (err) { if (err.code === 'ENOENT') return null; throw err; }
}

/**
 * 起一个子进程，喂 stdin，收 stdout/stderr 与退出码。
 *
 * 一律带超时并 SIGKILL：体检可以报「起不来」，但绝不许自己挂死——
 * hook 与 MCP 服务恰好都是「读 stdin 直到 EOF」的形态，写错一点就是永不返回。
 */
function exec(cmd, args, { input = '', cwd, env, timeoutMs = HOOK_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      resolve({ code: null, stdout: '', stderr: String(err?.message ?? err), timedOut: false });
      return;
    }
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    };
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => { stderr += String(err?.message ?? err); finish(null); });
    child.on('close', (code) => finish(code));
    child.stdin.on('error', () => { /* 进程先死了，写 stdin 会 EPIPE——不是我们要报的错 */ });
    child.stdin.end(input);
  });
}

/**
 * 从一坨 stderr 里挑**说得清原因**的那一行。
 *
 * 不能直接取第一行：Node 的堆栈第一行是 `node:internal/modules/cjs/loader:1503`
 * 这种位置信息，把它印出来等于什么都没说。优先挑带错误字样的那行——
 * 「给可执行的下一步」这条纪律，从「先说清是什么错」开始。
 */
function errorLine(s, max = 200) {
  const lines = String(s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const line = lines.find((l) => /Error|error:|Cannot find|找不到|读不懂/.test(l)) ?? lines[0] ?? '';
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

// ── hook 命令的解析 ───────────────────────────────────────────────────────

/**
 * 把 settings.json 里的一条 command 拆成 `{ runner, script }`。
 *
 * 只认 `node <脚本>` 这一种形态（模板发的就是它）。别的形态不猜、不硬跑——
 * 返回 null，调用方报「没法机检」。**猜错了去跑一条陌生命令**比不查更坏。
 */
export function parseHookCommand(command) {
  const m = /^\s*node\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*$/.exec(String(command ?? ''));
  if (!m) return null;
  return { runner: 'node', script: m[1] ?? m[2] ?? m[3] };
}

/**
 * 命令里的脚本路径是不是**锚定**的。
 *
 * v3 的原病：写成 `node .claude/hooks/x.mjs`，Claude Code 按 cwd 解析，
 * agent 一 `cd` 到子目录就找不到文件——而且失败**没有任何输出**。
 * 所以判据是「不依赖 cwd」：要么显式用 `$CLAUDE_PROJECT_DIR`，要么绝对路径。
 */
export function isAnchored(script) {
  const s = String(script ?? '');
  return s.includes('$CLAUDE_PROJECT_DIR') || s.includes('${CLAUDE_PROJECT_DIR') || path.isAbsolute(s);
}

/** 把 `$CLAUDE_PROJECT_DIR` 展开成真项目根，用于「真起一次」。 */
export function expandProjectDir(script, root) {
  return String(script ?? '')
    .replaceAll(/\$\{CLAUDE_PROJECT_DIR(?::-[^}]*)?\}/g, root)
    .replaceAll('$CLAUDE_PROJECT_DIR', root);
}

/** 摊平 settings.hooks → [{ event, matcher, command, timeout }]。 */
export function flattenHooks(settings) {
  const out = [];
  for (const [event, groups] of Object.entries(settings?.hooks ?? {})) {
    if (!Array.isArray(groups)) continue;
    for (const g of groups) {
      for (const h of g?.hooks ?? []) {
        out.push({ event, matcher: g?.matcher ?? null, command: h?.command ?? '', timeout: h?.timeout ?? null });
      }
    }
  }
  return out;
}

// ── 各项检查 ──────────────────────────────────────────────────────────────

const mk = (id, title, status, checked, message, fix = null, detail = null) =>
  ({ id, title, status, checked, message, fix, detail });

/** ① Node 版本满不满足 engines（P1-3「版本是否兼容」）。 */
async function checkNode(pkgRoot) {
  const title = 'Node 版本';
  const checked = `process.versions.node（${process.versions.node}）比对 ${path.join(pkgRoot, 'package.json')} 的 engines.node`;
  let engines;
  try {
    engines = JSON.parse(await readFile(path.join(pkgRoot, 'package.json'), 'utf8')).engines?.node;
  } catch (err) {
    return mk('node', title, 'warn', checked, `读不出 vima 自己的 package.json：${err.message}——没查，不是通过`,
      '检查 vima 安装是否完整（npm i -g @vima-tech/cli 重装）');
  }
  if (typeof engines !== 'string') {
    return mk('node', title, 'warn', checked, 'package.json 里没有 engines.node——没查，不是通过',
      '给 package.json 补 engines.node；没有它就没有版本兼容判据');
  }
  const want = /(\d+)/.exec(engines);
  if (!want) {
    return mk('node', title, 'warn', checked, `engines.node = ${engines}，解析不出最低主版本——没查，不是通过`,
      'engines.node 写成 ">=20" 这类能解析出主版本号的形态');
  }
  const have = Number(process.versions.node.split('.')[0]);
  const min = Number(want[1]);
  if (have < min) {
    return mk('node', title, 'error', checked,
      `当前 Node v${process.versions.node}，低于 engines.node ${engines}`,
      `升级到 Node ${min} 及以上（nvm install ${min}）——低版本会在 parseArgs / node:test 这些内建面上以奇怪的方式失败`,
      { engines, current: process.versions.node });
  }
  return mk('node', title, 'ok', checked, `Node v${process.versions.node} 满足 engines.node ${engines}`,
    null, { engines, current: process.versions.node });
}

/**
 * ② vima 自身的安装完整性。
 *
 * 与 audit 的资产健康**不是一回事**：audit 查「你登记的皮/块读不读得出」（项目侧），
 * 这里查「vima 这个包带没带全资产仓与模板」（工具侧）。npm 包的 files 字段漏一项、
 * 全局安装装坏一半，表现都是 `vima next` 供料静默变空——项目侧一点问题也没有。
 */
async function checkInstall(pkgRoot, assetsRoot, registry) {
  const title = 'vima 安装完整性';
  const want = [
    ['bin/vima.mjs', path.join(pkgRoot, 'bin', 'vima.mjs')],
    ['assets/', assetsRoot],
    ['templates/project/', path.join(pkgRoot, 'templates', 'project')],
  ];
  const missing = [];
  for (const [label, p] of want) if (!(await exists(p))) missing.push(label);
  const checked = `安装根 ${pkgRoot} 下的 ${want.map(([l]) => l).join(' · ')}`
    + (registry ? '；并用 registry.listBlocks 真列一次资产仓' : '；资产仓列举未做（registry 模块缺席）');

  if (missing.length) {
    return mk('install', title, 'error', checked, `安装不完整，缺：${missing.join('、')}`,
      '重装：npm i -g @vima-tech/cli（或检查 package.json 的 files 字段有没有漏）', { missing });
  }
  if (!registry) {
    return mk('install', title, 'warn', checked,
      '三个落点都在，但资产仓列不列得出来**没查**（lib/assets/registry.mjs 缺席）',
      '等 registry 模块落地后重跑；在此之前不要把本项当成通过');
  }
  let blocks;
  try {
    blocks = await registry.listBlocks(assetsRoot);
  } catch (err) {
    return mk('install', title, 'error', checked, `资产仓列不出块：${err.message}`,
      '重装 vima；assets/ 在但读不动，多半是安装被截断了');
  }
  if (!blocks.length) {
    return mk('install', title, 'warn', checked, '资产仓里一个业务块都没有——vima block add 无料可装',
      '检查 assets/blocks/ 是否随包发出（package.json 的 files 字段）');
  }
  return mk('install', title, 'ok', checked, `安装完整；资产仓列出 ${blocks.length} 个业务块`,
    null, { blocks: blocks.length });
}

/**
 * ③ hook 接线：settings.json 接的文件在不在，磁盘上的 hook 有没有被接上。
 *
 * 两个方向都查。只查一边的话：接了不存在的文件 → Claude Code 静默跳过；
 * 写了没接的文件 → 永远不触发。两种都表现为「这个 hook 怎么没反应」，
 * 而且都不会有任何报错。v3 那次「4 个 hook 一个都没注册」就死在后一个方向。
 */
async function checkHooksWired(root) {
  const title = 'hook 接线';
  const settingsPath = path.join(root, ...LAYOUT.settings);
  const hooksDir = path.join(root, ...LAYOUT.hooksDir);
  const checked = `${LAYOUT.settings.join('/')} 里登记的每条 command ↔ ${LAYOUT.hooksDir.join('/')}/ 里的每个 .mjs，双向比对`;

  let settings;
  try {
    settings = JSON.parse(await readFile(settingsPath, 'utf8'));
  } catch (err) {
    const why = err.code === 'ENOENT' ? '文件不存在' : `解析失败：${err.message}`;
    return mk('hooks-wired', title, 'error', checked,
      `${LAYOUT.settings.join('/')} ${why}——一个 hook 都不会注册，会话里 vima 全程失声`,
      'vima init 补齐模板（已有文件不会被覆盖；要覆盖用 vima init --force）');
  }

  const entries = flattenHooks(settings);
  const onDisk = (await listDir(hooksDir))?.filter((f) => !NOT_A_HOOK(f)) ?? [];
  const wired = new Set();
  const problems = [];

  for (const e of entries) {
    const m = /hooks[/\\]([A-Za-z0-9._-]+\.mjs)/.exec(e.command);
    if (!m) { problems.push(`${e.event} 的 command 里认不出 hook 文件名：${e.command}`); continue; }
    wired.add(m[1]);
    const parsed = parseHookCommand(e.command);
    // 相对路径按**项目根**解析（不按 doctor 自己的 cwd）：本项查的是「文件在不在」，
    // 「依不依赖 cwd」归下一项（hook 命令锚定）管，一个故障不许报两处红。
    const script = parsed ? path.resolve(root, expandProjectDir(parsed.script, root)) : path.join(hooksDir, m[1]);
    if (!(await exists(script))) problems.push(`${e.event} 接了 ${m[1]}，但文件不存在（${script}）——Claude Code 会静默跳过`);
  }
  for (const f of onDisk) {
    if (!wired.has(f)) problems.push(`${LAYOUT.hooksDir.join('/')}/${f} 写了却没接进 settings.json——永远不会触发`);
  }
  if (!entries.length) {
    return mk('hooks-wired', title, 'error', checked,
      'settings.json 里一个 hook 都没登记——「没凭证不入账」的地基整个不在',
      'vima init --force 用模板覆盖 .claude/settings.json', { events: [], onDisk });
  }
  if (problems.length) {
    return mk('hooks-wired', title, 'error', checked,
      `${entries.length} 条登记 / ${onDisk.length} 个文件，对不上 ${problems.length} 处：${problems.join('；')}`,
      'vima init --force 用模板覆盖 .claude/settings.json 与 .claude/hooks/', { problems });
  }
  return mk('hooks-wired', title, 'ok', checked,
    `${entries.length} 条登记覆盖 ${wired.size} 个 hook 文件，磁盘上 ${onDisk.length} 个全部接上，双向一致`,
    null, { events: [...new Set(entries.map((e) => e.event))].sort(), files: [...wired].sort() });
}

/** ④ hook 命令锚定：不许依赖 cwd。 */
async function checkHooksAnchored(root) {
  const title = 'hook 命令锚定';
  const checked = `settings.json 里每条 command 的脚本路径是否锚在 $CLAUDE_PROJECT_DIR 或绝对路径（不依赖 cwd）`;
  let settings;
  try {
    settings = JSON.parse(await readFile(path.join(root, ...LAYOUT.settings), 'utf8'));
  } catch {
    return mk('hooks-anchored', title, 'warn', checked,
      'settings.json 读不出来，锚定**没查**（hook 接线那项已经报过原因）',
      '先修 hook 接线那一项，再重跑 vima doctor');
  }
  const entries = flattenHooks(settings);
  if (!entries.length) {
    return mk('hooks-anchored', title, 'warn', checked, 'settings.json 里没有 hook，无从检查锚定——没查，不是通过',
      '先修 hook 接线那一项');
  }
  const bad = [];
  const unknown = [];
  for (const e of entries) {
    const parsed = parseHookCommand(e.command);
    if (!parsed) { unknown.push(`${e.event}: ${e.command}`); continue; }
    if (!isAnchored(parsed.script)) bad.push(`${e.event}: ${e.command}`);
  }
  if (bad.length) {
    return mk('hooks-anchored', title, 'error', checked,
      `${bad.length} 条命令写的是相对路径，按 cwd 解析——agent 一 cd 到子目录就找不到文件，`
      + `且**失败没有任何输出**（v3 就栽在这里）：${bad.join('；')}`,
      '改成 node "$CLAUDE_PROJECT_DIR/.claude/hooks/<名字>.mjs"，或 vima init --force 用模板覆盖',
      { bad });
  }
  if (unknown.length) {
    return mk('hooks-anchored', title, 'warn', checked,
      `${entries.length} 条里 ${unknown.length} 条不是 \`node <脚本>\` 形态，锚定**没查**：${unknown.join('；')}`,
      '自查这些命令里的路径是否依赖 cwd；vima 只机检 node 形态的命令', { unknown });
  }
  return mk('hooks-anchored', title, 'ok', checked, `${entries.length} 条命令全部锚定，不依赖 cwd`);
}

/**
 * ⑤ hook 真跑得起来。
 *
 * 「文件在」不等于「跑得起来」：import 挂了、找不到 vima 内核、语法错——
 * 文件照样躺在那儿，而 hook 在会话里一声不吭地全灭。所以这里**真起一次进程**，
 * 喂一份最小合法 stdin，只看退出码。
 *
 * 跑在一次性沙箱项目里（cwd + VIMA_PROJECT_DIR 都指向 mkdtemp 出来的临时项目），
 * **不碰你的 .vima/events.jsonl**——体检不该往事件流里写东西。
 * 相应地，这里查的是「起得来、跑得完、退出码 0」，不是各事件的业务逻辑
 * （那由 tests/unit/tpl.hooks.run.test.mjs 覆盖）。
 */
async function checkHooksRunnable(root, theme) {
  const title = 'hook 真跑得起来';
  const checked = '把每个 hook 当子进程真起一次，喂最小合法 stdin（公共字段），看退出码；'
    + '跑在一次性沙箱项目里，不写你的 .vima/events.jsonl';
  let settings;
  try {
    settings = JSON.parse(await readFile(path.join(root, ...LAYOUT.settings), 'utf8'));
  } catch {
    return mk('hooks-runnable', title, 'warn', checked,
      'settings.json 读不出来，**一个 hook 都没试跑**（不是跑通了）',
      '先修 hook 接线那一项，再重跑 vima doctor');
  }
  const entries = flattenHooks(settings);
  if (!entries.length) {
    return mk('hooks-runnable', title, 'warn', checked, '没有 hook 可试跑——没查，不是通过', '先修 hook 接线那一项');
  }

  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'vima-doctor-'));
  const results = [];
  const skipped = [];
  try {
    await mkdir(path.join(sandbox, '.vima'), { recursive: true });
    // 沙箱里这两个文件也走原子写——硬约束「写文件一律 atomicWrite」没有
    // 「临时目录除外」这一条，开了这个口子下次就有人在真项目里开同样的口子。
    await atomicWrite(path.join(sandbox, '.vima', 'project.json'),
      `${JSON.stringify({ schema: '4', name: 'vima doctor 沙箱', theme: theme ?? 'enterprise-blue', apps: [], blocks: [] }, null, 2)}\n`);
    await atomicWrite(path.join(sandbox, '.vima', 'events.jsonl'), '');

    // 环境：把根**钉死在沙箱**。CLAUDE_PROJECT_DIR 必须删——resolveRoot 把它排在
    // cwd 前面，留着就会让 hook 去写真项目的事件流（体检不该有副作用）。
    // VIMA_HOME 刻意**不设**：hook 找不找得到 vima 内核，正是本项要查的东西之一，
    // 替它指路就等于把这个故障模式盖掉。
    const env = { ...process.env, VIMA_PROJECT_DIR: sandbox };
    delete env.CLAUDE_PROJECT_DIR;

    for (const e of entries) {
      const parsed = parseHookCommand(e.command);
      if (!parsed) { skipped.push(`${e.event}: 命令形态不是 \`node <脚本>\`，没试跑`); continue; }
      // 相对路径**在这里按项目根解析**（不按沙箱 cwd）：本项的判据是
      // 「这个脚本跑得起来吗」，「它依不依赖 cwd」是上一项（hook 命令锚定）的活。
      // 一个故障让两项同时报红，会让人以为有两个毛病，然后修错地方。
      const script = path.resolve(root, expandProjectDir(parsed.script, root));
      const input = `${JSON.stringify({
        session_id: 'vima-doctor', transcript_path: '', cwd: sandbox, hook_event_name: e.event,
      })}\n`;
      const r = await exec(process.execPath, [script], { input, cwd: sandbox, env, timeoutMs: HOOK_TIMEOUT_MS });
      results.push({ event: e.event, script, code: r.code, timedOut: r.timedOut, stderr: errorLine(r.stderr) });
    }
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }

  const failed = results.filter((r) => r.code !== 0);
  if (failed.length) {
    return mk('hooks-runnable', title, 'error', checked,
      `${results.length} 个试跑，${failed.length} 个起不来：`
      + failed.map((f) => `${f.event}(${f.timedOut ? `超时 ${HOOK_TIMEOUT_MS}ms` : `exit ${f.code}`}${f.stderr ? ` · ${f.stderr}` : ''})`).join('；'),
      `照着报错手跑一次看全文：echo '{}' | node "${failed[0].script}"。找不到 vima 内核的话设 VIMA_HOME 指向 vima 安装目录`,
      { results, skipped });
  }
  if (skipped.length) {
    return mk('hooks-runnable', title, 'warn', checked,
      `${results.length} 个试跑全部 exit 0，但另有 ${skipped.length} 个**没试跑**：${skipped.join('；')}`,
      '自己手跑一次那些命令确认它们真能起来；vima 只机检 node 形态的命令', { results, skipped });
  }
  return mk('hooks-runnable', title, 'ok', checked,
    `${results.length} 个 hook 全部真起过一次，退出码 0`, null, { results });
}

/**
 * ⑥ MCP 可达。
 *
 * `.mcp.json` 是项目级 MCP 的落点（`vima sync` 写）。指向一个不存在的 bin
 * 时，Claude Code 那边只会显示服务器起不来——而 agent 的 vima 工具全没了。
 *
 * **只对 vima 这个服务真起进程**（`node <bin> --version`，我们知道它会打印并退出）；
 * 别人家的服务只查文件在不在——陌生的 MCP 服务多半是「读 stdin 直到 EOF」，
 * 真起它等于让体检挂在那儿。
 */
async function checkMcp(root) {
  const title = 'MCP 可达';
  const file = path.join(root, ...LAYOUT.mcp);
  const checked = `${LAYOUT.mcp.join('/')} 解析 + vima 服务的 bin 真跑一次 \`node <bin> --version\``;
  let conf;
  try {
    conf = JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    const why = err.code === 'ENOENT' ? '不存在' : `解析失败：${err.message}`;
    return mk('mcp', title, 'error', checked,
      `${LAYOUT.mcp.join('/')} ${why}——clone 下来的人没有项目级 vima 工具`,
      'vima sync 重建（.mcp.json 是派生投影，真源在 lib/front/claude.mjs 的 mcpConfig）');
  }
  const servers = conf?.mcpServers ?? {};
  const vima = servers.vima;
  if (!vima) {
    return mk('mcp', title, 'error', checked,
      `${LAYOUT.mcp.join('/')} 里没有 vima 服务（现有：${Object.keys(servers).join('、') || '无'}）`,
      'vima sync 重建');
  }
  const bin = Array.isArray(vima.args) ? vima.args[0] : null;
  if (vima.command !== 'node' || typeof bin !== 'string' || !bin) {
    return mk('mcp', title, 'error', checked,
      `vima 服务的启动方式不是 \`node <bin> mcp\`（command=${vima.command}, args=${JSON.stringify(vima.args)}）`,
      'vima sync 重建——这个字段是派生的，手改会被下次 sync 冲掉');
  }
  if (!(await exists(bin))) {
    return mk('mcp', title, 'error', checked,
      `vima 服务指向的 bin 不存在：${bin}——多半是 vima 换了安装位置（换机器 / 重装 / 从 npx 跑过一次）`,
      'vima sync 重建，让 .mcp.json 指向当前这份安装', { bin });
  }
  const r = await exec(process.execPath, [bin, '--version'], { cwd: root, timeoutMs: MCP_TIMEOUT_MS });
  if (r.code !== 0 || !r.stdout.trim()) {
    return mk('mcp', title, 'error', checked,
      `bin 在，但跑不通：node ${bin} --version → ${r.timedOut ? `超时 ${MCP_TIMEOUT_MS}ms` : `exit ${r.code}`}`
      + `${r.stderr ? ` · ${errorLine(r.stderr)}` : ''}`,
      `手跑一次看全文：node "${bin}" --version`, { bin, code: r.code });
  }
  const others = Object.keys(servers).filter((k) => k !== 'vima');
  const note = others.length ? `；另有 ${others.length} 个第三方服务（${others.join('、')}）**没试起**——不认识的服务不敢真跑` : '';
  return mk('mcp', title, others.length ? 'warn' : 'ok', checked,
    `vima 服务可达（${bin} → v${r.stdout.trim()}）${note}`,
    others.length ? '第三方 MCP 服务请自行确认；vima 只机检自己那一条' : null,
    { bin, version: r.stdout.trim(), others });
}

/**
 * ⑦ 子代理。
 *
 * 查的是「它会不会被派上用场」而不是「文件在不在」：frontmatter 有一行读不懂
 * （unparsed 非空）就可能整块不被认；`skills:` 引用一个不存在的 skill，
 * 预加载会静默落空——而 agent 照样能跑，只是少了规程。两种都无声。
 */
async function checkAgents(root) {
  const title = '子代理';
  const dir = path.join(root, ...LAYOUT.agentsDir);
  const skillsDir = path.join(root, ...LAYOUT.skillsDir);
  const checked = `${LAYOUT.agentsDir.join('/')}/*.md 的 frontmatter 能否被 core/fsx.frontmatter 解析（unparsed 必须为空）、`
    + 'name 是否等于文件名、有没有 description、skills: 引用的 skill 是否真的存在';
  const files = await listDir(dir);
  if (files === null) {
    return mk('agents', title, 'warn', checked, `${LAYOUT.agentsDir.join('/')}/ 不存在——一个子代理都不在场，并行编码工位没有`,
      'vima init 补齐模板');
  }
  const mds = files.filter((f) => f.endsWith('.md'));
  if (!mds.length) {
    return mk('agents', title, 'warn', checked, `${LAYOUT.agentsDir.join('/')}/ 是空的——一个子代理都不在场`, 'vima init 补齐模板');
  }
  const problems = [];
  const ok = [];
  for (const f of mds) {
    const name = f.replace(/\.md$/, '');
    const { data, unparsed } = frontmatter(await readFile(path.join(dir, f), 'utf8'));
    if (unparsed.length) {
      problems.push(`${f} 的 frontmatter 有 ${unparsed.length} 行读不懂（第 ${unparsed.map((u) => u.line).join('/')} 行）`);
      continue;
    }
    if (!data.name) { problems.push(`${f} 没有 name——不写 name 的子代理派不出去`); continue; }
    if (data.name !== name) { problems.push(`${f} 的 name=${data.name} 与文件名对不上`); continue; }
    if (!data.description) { problems.push(`${f} 没有 description——没有它就不会被自动派发`); continue; }
    const wanted = Array.isArray(data.skills) ? data.skills : (data.skills ? [data.skills] : []);
    const dead = [];
    for (const s of wanted) {
      if (!(await exists(path.join(skillsDir, s, 'SKILL.md')))) dead.push(s);
    }
    if (dead.length) { problems.push(`${f} 的 skills: 引用了不存在的 ${dead.join('、')}——预加载会静默落空`); continue; }
    ok.push(name);
  }
  if (problems.length) {
    return mk('agents', title, 'error', checked, `${mds.length} 个子代理，${problems.length} 个有问题：${problems.join('；')}`,
      'vima init --force 用模板覆盖 .claude/agents/（自己写的子代理照上面逐条改）', { problems });
  }
  return mk('agents', title, 'ok', checked, `${ok.length} 个子代理 frontmatter 解析干净、skills 引用都在：${ok.join('、')}`,
    null, { agents: ok });
}

/** ⑧ skill：同 ⑦ 的口径，判据是「会不会被 Claude Code 认」。 */
async function checkSkills(root) {
  const title = 'skill';
  const dir = path.join(root, ...LAYOUT.skillsDir);
  const checked = `${LAYOUT.skillsDir.join('/')}/*/SKILL.md 存不存在、frontmatter 能否解析（unparsed 必须为空）、`
    + 'name 是否等于目录名、有没有 description';
  const entries = await listDir(dir);
  if (entries === null) {
    return mk('skills', title, 'warn', checked, `${LAYOUT.skillsDir.join('/')}/ 不存在——四条规程一条都不在场`, 'vima init 补齐模板');
  }
  const dirs = [];
  for (const e of entries) {
    if (e.startsWith('.')) continue;
    const st = await listDir(path.join(dir, e));
    if (st !== null) dirs.push(e);
  }
  if (!dirs.length) {
    return mk('skills', title, 'warn', checked, `${LAYOUT.skillsDir.join('/')}/ 是空的——一条规程都不在场`, 'vima init 补齐模板');
  }
  const problems = [];
  const ok = [];
  for (const name of dirs) {
    const file = path.join(dir, name, 'SKILL.md');
    if (!(await exists(file))) { problems.push(`${name}/ 里没有 SKILL.md——这个目录不会被当成 skill`); continue; }
    const { data, unparsed } = frontmatter(await readFile(file, 'utf8'));
    if (unparsed.length) {
      problems.push(`${name}/SKILL.md 的 frontmatter 有 ${unparsed.length} 行读不懂（第 ${unparsed.map((u) => u.line).join('/')} 行）`);
      continue;
    }
    if (data.name !== name) { problems.push(`${name}/SKILL.md 的 name=${data.name ?? '(缺)'} 与目录名对不上`); continue; }
    if (!data.description) { problems.push(`${name}/SKILL.md 没有 description——没有它模型判断不出何时该用`); continue; }
    ok.push(name);
  }
  if (problems.length) {
    return mk('skills', title, 'error', checked, `${dirs.length} 个 skill，${problems.length} 个有问题：${problems.join('；')}`,
      'vima init --force 用模板覆盖 .claude/skills/（自己写的 skill 照上面逐条改）', { problems });
  }
  return mk('skills', title, 'ok', checked, `${ok.length} 个 skill frontmatter 解析干净：${ok.join('、')}`, null, { skills: ok });
}

/**
 * ⑨ 派生投影有没有漂。
 *
 * **判据不在这里**——`vima sync --check` 已经能回答，doctor 调它。
 * 为什么这属于 doctor 而不只属于 sync：规则在**会话启动时**加载，
 * 投影旧了不会报错，只会让这次会话遵守上一版规则。
 */
async function checkProjectionDrift(checkProjection) {
  const title = '派生投影';
  const checked = '调 `vima sync --check` 的同一份判据（不写盘），比对 .claude/rules/ 与 .mcp.json 是否等于当前真源的投影';
  if (typeof checkProjection !== 'function') {
    return mk('projection', title, 'warn', checked, '投影判据不可用（lib/front/claude.mjs 缺席）——**没查**',
      '等 claude.mjs 落地后重跑 vima doctor');
  }
  let r;
  try {
    r = await checkProjection();
  } catch (err) {
    return mk('projection', title, 'warn', checked, `投影检查跑不起来：${err.message}——**没查**，不是没漂`,
      '先跑 vima sync --check 看完整报错');
  }
  const { rules, mcp, drifted } = r;
  if (drifted) {
    const what = [
      ...rules.written.map((f) => `.claude/rules/${f} 需更新`),
      ...rules.removed.map((f) => `.claude/rules/${f} 需删除`),
      ...(mcp.changed ? [`${mcp.path} 需更新`] : []),
    ];
    return mk('projection', title, 'error', checked,
      `投影已漂移 ${drifted} 处：${what.join('；')}——规则在会话启动时加载，`
      + '不重建就等于这次会话遵守的是上一版规则（而且不会报错）',
      'vima sync', { written: rules.written, removed: rules.removed, mcp: mcp.changed });
  }
  return mk('projection', title, 'ok', checked,
    `与真源一致：规则投影 ${rules.total} 条（其中 ${rules.unconditional} 条无 paths、每次会话都加载）、${mcp.path} 一致`,
    null, { total: rules.total, unconditional: rules.unconditional });
}

// ── 入口 ──────────────────────────────────────────────────────────────────

/**
 * 跑一遍体检。
 *
 * 依赖从 front/actions 注入而不是在这里 import：
 *   · checkProjection —— 投影漂移的判据只有 sync 一处真源，这里调它，不重写
 *   · registry        —— 并行开发中可能缺席，缺席时本项报「没查」而不是通过
 *
 * → { ok, counts:{ok,warn,error}, checks:[{id,title,status,checked,message,fix,detail}] }
 */
export async function runDoctor({ root, config = {}, assetsRoot, pkgRoot, checkProjection, registry = null } = {}) {
  const checks = [
    await checkNode(pkgRoot),
    await checkInstall(pkgRoot, assetsRoot, registry),
    await checkHooksWired(root),
    await checkHooksAnchored(root),
    await checkHooksRunnable(root, config.theme),
    await checkMcp(root),
    await checkAgents(root),
    await checkSkills(root),
    await checkProjectionDrift(checkProjection),
  ];
  const counts = { ok: 0, warn: 0, error: 0 };
  for (const c of checks) counts[c.status] += 1;
  return { ok: counts.error === 0, counts, checks };
}
