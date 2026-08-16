// 动作层 —— CLI 与 MCP 的**唯一**共享真源。
//
// 解决的需求：ARCHITECTURE「一套逻辑两个门面」。CLI 给人与 CI、MCP 给 agent，
// 但「下一步该做什么」「达标了没有」这类判据只能有一份实现。上一代吃过亏：
// 同一条判据散在三处（validate / converge / traceability），修一处另两处继续沉默，
// 而且都显示通过——最危险的那种绿。
//
// 因此两个门面里**不允许出现任何判据**，它们只做三件事：解析入参 → 调这里 → 渲染。
// 这里也只做一件事：把 core/ 与 ops/ 拼起来，返回**纯数据**（不打印、不退出）。
//
// 另一条纪律（ARCHITECTURE 决定性纪律 1）：**agent 不能通过正式接口提交证据结论**。
// 本层所有会落事件的动作，事件的「内容」都由系统生成（取证结果、时间、actor），
// 调用方只能提供「发生了什么触发」（claimId、裁定的问题与选项）。
// submit 不接受「我做完了」这种断言——它只收 claimId，系统自己去取证。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { access, mkdir, cp, writeFile, readFile } from 'node:fs/promises';

import { append, readAll } from '../core/events.mjs';
import { project, best, meets, blockedByAdHoc, LAYERS } from '../core/claims.mjs';
import * as lease from '../core/lease.mjs';
import { context as projectContext, readConfig, writeConfig } from '../core/project.mjs';
import { CAPABILITY } from '../core/extract.mjs';

// ── 分发物内的固定落点 ──────────────────────────────────────────────────────
export const PKG_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const ASSETS_ROOT = path.join(PKG_ROOT, 'assets');
export const TEMPLATES_PROJECT = path.join(PKG_ROOT, 'templates', 'project');
export const BIN_PATH = path.join(PKG_ROOT, 'bin', 'vima.mjs');

/**
 * 退出码语义（help 里逐条写明；CI 靠它判断，不靠 grep 输出）。
 * 刻意少：每个码对应一类**处置方式不同**的失败，处置一样的不分家。
 */
export const EXIT = Object.freeze({
  OK: 0,               // 成功
  USAGE: 1,            // 用法错误：命令/参数不对，改命令行即可
  NO_PROJECT: 2,       // 不在 vima 项目里（向上找不到 .vima/）——多半是会话开错目录
  NOT_IMPLEMENTED: 3,  // 依赖的模块尚未实现（ops/ 或 assets/ 或 web）
  NOT_FOUND: 4,        // 命题/目标不存在
  UNMET: 5,            // 跑通了但结论是「不达标」：取证没到门槛 / 对账有 error
  INTERNAL: 70,        // 内部错误，带堆栈
});

export class FrontError extends Error {
  constructor(code, message, { exit = EXIT.INTERNAL, hint = null } = {}) {
    super(message);
    this.name = 'FrontError';
    this.code = code;
    this.exit = exit;
    this.hint = hint;
  }
}

// ── 尚未实现的模块：缺席不等于崩溃 ────────────────────────────────────────
//
// ops/ 与 assets/ 由别的实现路径提供，本层按 ARCHITECTURE 的冻结签名调用。
// 它们此刻可能还不存在——那要给出「该模块尚未实现」的清楚提示，而不是
// 抛一个 ERR_MODULE_NOT_FOUND 让人以为是自己装坏了。
//
// 用 access 探路而不是 catch ERR_MODULE_NOT_FOUND：后者会把「模块内部 import 了
// 一个不存在的东西」也吞成「模块不存在」，把真 bug 伪装成未实现。
const OPTIONAL = Object.freeze({
  compile: '../ops/compile.mjs',
  spec: '../ops/spec.mjs',
  claude: './claude.mjs',
  attest: '../ops/attest.mjs',
  audit: '../ops/audit.mjs',
  registry: '../assets/registry.mjs',
  rules: '../assets/rules.mjs',
  lock: '../assets/lock.mjs',
  web: './web.mjs',
});

export async function optional(name) {
  const rel = OPTIONAL[name];
  if (!rel) throw new Error(`未登记的可选模块 ${name}`);
  const url = new URL(rel, import.meta.url);
  try {
    await access(url);
  } catch {
    return null;
  }
  return import(url.href);
}

async function mustLoad(name, why) {
  const mod = await optional(name);
  if (mod) return mod;
  throw new FrontError('NOT_IMPLEMENTED', `${why} 依赖 lib/${OPTIONAL[name].replace(/^\.\.\//, '').replace(/^\.\//, 'front/')}，该模块尚未实现`, {
    exit: EXIT.NOT_IMPLEMENTED,
    hint: '这是并行开发中的正常状态：前端已按冻结签名接好线，等该模块落地即自动可用。',
  });
}

// ── 上下文 ────────────────────────────────────────────────────────────────

/**
 * 构造 ops/ 需要的 ctx。项目根的判据只有一个真源（core/project.findRoot），
 * 这里不自造第二个。
 */
export async function makeCtx({ cwd, env, filePath, now, actor = 'cli' } = {}) {
  const { root, config } = await projectContext({ cwd, env, filePath });
  if (!root) throw noProject({ cwd, env });
  return { root, config, assetsRoot: ASSETS_ROOT, now: now ?? new Date(), actor };
}

export function noProject({ cwd = process.cwd(), env = process.env } = {}) {
  return new FrontError('NO_PROJECT', '当前不在 vima 项目里（判据：向上回溯找不到 .vima/）', {
    exit: EXIT.NO_PROJECT,
    hint: `cwd=${cwd}；VIMA_PROJECT_DIR=${env.VIMA_PROJECT_DIR ?? '(未设置)'}；`
      + `CLAUDE_PROJECT_DIR=${env.CLAUDE_PROJECT_DIR ?? '(未设置)'}。`
      + ' 会话可能开在了错目录：cd 到项目根，或 vima init 立一个。',
  });
}

async function load(root) {
  const { events, corrupt } = await readAll(root);
  const p = project(events);
  return { ...p, events, corrupt };
}

function byLayerThenId(a, b) {
  const d = LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer);
  return d !== 0 ? d : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function dimsOf(ctx, claim) {
  const apps = ctx.config?.apps ?? [];
  const only = apps.length === 1 ? apps[0] : null;
  return {
    layer: claim.layer,
    side: only?.kind ?? null,
    app: only?.id ?? null,
    blocks: ctx.config?.blocks ?? [],
  };
}

function slim(claim) {
  return {
    id: claim.id,
    layer: claim.layer,
    statement: claim.statement,
    trust: claim.trust,
    need: claim.need,
    from: claim.from,
    impl: claim.impl,
    stale: claim.stale,
    met: meets(claim),
    best: best(claim),
    revision: claim.revision,
  };
}

async function ensureFile(file, content) {
  try {
    await access(file);
    return false;
  } catch {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content, 'utf8');
    return true;
  }
}

// ── init ──────────────────────────────────────────────────────────────────

/**
 * 在当前目录立起 `.vima/` 与 `.claude/`。
 *
 * `.vima/` 是项目根的**唯一判据**，所以哪怕模板缺席也必须建出来——否则这个目录
 * 不算项目，后续每条命令都会报 NO_PROJECT，而人会以为是 init 没跑。
 * 模板（`.claude/` 的 hooks / skills / CLAUDE.md）由 templates/project/ 提供，
 * 缺席时如实报告，不假装装好了。
 */
export async function init({ cwd = process.cwd(), name, theme, force = false } = {}) {
  const root = path.resolve(cwd);
  const notes = [];

  let templates = true;
  try {
    await access(TEMPLATES_PROJECT);
  } catch {
    templates = false;
    notes.push('templates/project/ 尚未提供：只落了 .vima/ 骨架，.claude/（hooks / skills / CLAUDE.md）需要该模板落地后重跑 init 补齐。');
  }
  if (templates) {
    // force=false + errorOnExist=false：已存在的文件原样保留，init 可重跑
    await cp(TEMPLATES_PROJECT, root, { recursive: true, force, errorOnExist: false });
  }

  const created = [];
  await mkdir(path.join(root, '.vima', 'index'), { recursive: true });
  if (await ensureFile(path.join(root, '.vima', 'events.jsonl'), '')) created.push('.vima/events.jsonl');
  // 投影是派生物，可随时重建，不进版本控制（C3）
  if (await ensureFile(path.join(root, '.vima', 'index', '.gitignore'), '*\n')) created.push('.vima/index/');
  await mkdir(path.join(root, '.vima', 'rules'), { recursive: true });

  const existing = await readConfig(root);
  const config = {
    ...existing,
    name: name ?? (existing.name || path.basename(root)),
    theme: theme ?? existing.theme,
  };
  await writeConfig(root, config);
  created.push('.vima/project.json');

  // 皮要连锁一起立起来。init 此前只把字符串写进 config，于是新项目的皮
  // **从第一天起就是未锁的**：资产仓改了没人察觉，而项目已经照着旧值取过证。
  // 「受管写入口」这条设计漏了最早的那个入口，等于还是得靠人记得补跑一次。
  //
  // 两件事一并做，理由同 themeSet：
  //   · 皮不存在 → 立刻报，别等到第一次供料才发现形是空的
  //   · 皮存在 → 记进 lock，`sync --check` 从此能报资产漂移
  try {
    const registry = await optional('registry');
    const lock = await optional('lock');
    if (registry && lock) {
      await registry.loadStyle(ASSETS_ROOT, config.theme);
      await lock.recordTheme(root, ASSETS_ROOT, config.theme);
      created.push('.vima/assets.lock.json');
    }
  } catch (err) {
    // 不让 init 失败：项目骨架已经立起来了，这里失败只意味着「皮不可用」，
    // 而那是一句要人看见的提示，不是「重来一次」。
    notes.push(`皮 ${config.theme} 没能锁定：${err.message}`
      + '。这不影响项目骨架，但 sync --check 报不了资产漂移——跑 `vima theme set <可用的皮>` 修。');
  }

  // 派生投影：`.claude/rules/` 与 `.mcp.json`。放在 config 写完之后——
  // 规则的 paths glob 是从 config.apps 推的，顺序反了会投影出空 glob。
  const projected = await sync({ root, config });
  created.push(...projected.rules.written.map((f) => `.claude/rules/${f}`));
  if (projected.mcp.changed) created.push(projected.mcp.path);
  // 新项目还没登记端，端限定规则一条也投影不了——这是正常状态，收成一句。
  // 逐条刷一屏「未投影」只会训练人忽略 init 的提示。
  const noApps = projected.rules.skipped.filter((s) => s.reason === 'no-apps');
  if (noApps.length) {
    notes.push(`${noApps.length} 条端限定规则暂未投影进 .claude/rules/（项目还没登记端）；`
      + '它们仍会由 vima next 按维度下发，登记端后重跑 vima sync 即可投影。');
  }
  for (const s of projected.rules.skipped) {
    if (s.reason === 'no-apps') continue;
    notes.push(`规则 ${s.id} 没投影进 .claude/rules/：${s.why}。多半是 app/side 写错了。`);
  }

  return { root, config, templates, created, notes, projected };
}

// ── sync（刷新 Claude Code 派生投影）─────────────────────────────────────

/**
 * 重建 `.claude/rules/` 与 `.mcp.json`。
 *
 * 为什么是显式命令而不是 hook 自动刷：**规则在会话启动时加载**，
 * 会话中途重写 `.claude/rules/` 要下次会话才生效——自动刷会给人
 * 「已经生效了」的错觉，而它没有。显式命令 + `--check` 报漂移更诚实。
 *
 * check=true 不写盘，只回答「有没有漂」。CI 用它。
 *
 * 「漂移」有两种，一起查（P0-3）：
 *   派生投影漂  `.claude/rules/` 与 `.mcp.json` 落后于真源  → 跑 vima sync 重建
 *   资产锁漂    资产内容变了，而项目还以为用的是 lock 记的那一版 → 走 vima block upgrade
 * 后者才是贵的那种：安装包升级了、块的 L1 契约改了一行，**而那些内容已经被
 * 用来取过证了**。两种漂的修法完全不同，所以分开报，但都计进 `drifted`——
 * 只要有一种漂，`sync --check` 就该是 exit 5。
 */
export async function sync({ root, config, check = false } = {}) {
  const mod = await mustLoad('claude', 'sync');
  const projected = await mod.sync(root, { assetsRoot: ASSETS_ROOT, config, binPath: BIN_PATH, check });
  // mustLoad 不软着陆：lock 模块缺席时宁可整条命令报 NOT_IMPLEMENTED，
  // 也不能让 sync --check 在「资产锁根本没查」的情况下报绿。
  const lock = await mustLoad('lock', 'sync');
  const assets = await lock.checkLock(root, ASSETS_ROOT, config ?? {});
  return { ...projected, assets, drifted: projected.drifted + assets.drifted };
}

// ── app / theme / block：config 的受管写入口（P1-4）──────────────────────
//
// `.vima/project.json` 是人工可读真源，但它的一致性关系不该要人（或 agent）
// 手工维护：kind 要在词表里、theme 要在资产仓里、apps 变了投影要跟着变、
// 变更要能在事件流里回放。手改 config 全部绕过这四条——所以给受管入口。
// 手改仍不被禁止（绕过没有收益）：绕过的后果由 audit 的资产健康检查兜底看见。

/**
 * 每次 config 变更落一条 run 事件（payload.op:'config'，带 what/before/after）。
 * R2 要能回放「谁什么时候登记了端」——writeConfig 是覆盖写，事件流才是时间维。
 */
async function recordConfig(ctx, what, before, after) {
  return append(ctx.root, {
    kind: 'run',
    actor: ctx.actor,
    subject: null,
    payload: { op: 'config', what, before, after },
  }, { now: ctx.now });
}

/**
 * kind 的取值全集 = ia 词表 sides 组。**真的去 loadStyle 读**，不抄清单——
 * 抄一份合法值就是第二真源，词表加一个端这里就开始说谎。
 * 词表结构读不出时硬炸不软着陆（z.seams 的教训：`?? []` 让校验静默失效过一次）。
 */
async function sidesOf(ctx, registry) {
  let style;
  try {
    style = await registry.loadStyle(ctx.assetsRoot, ctx.config?.theme);
  } catch (err) {
    if (err.code === 'THEME_NOT_FOUND') {
      throw new FrontError('NOT_FOUND', `登记的主题读不出来，ia 词表无从加载：${err.message}`, {
        exit: EXIT.NOT_FOUND,
        hint: '先 vima theme set 一个存在的皮，再登记端。',
      });
    }
    throw err;
  }
  const terms = style.ia?.groups?.sides?.terms;
  if (!Array.isArray(terms) || terms.length === 0) {
    throw new Error('ia 词表里读不出 sides 组——词表结构变了，kind 校验无法进行（拒绝软着陆成「不校验」）');
  }
  return terms.map((t) => t.id);
}

/**
 * 登记一个端。之后自动重投影规则——`.claude/rules/` 的 paths glob 从
 * config.apps 推，端变了投影不刷新就是「看起来限定了端、实际没生效」。
 * sync 失败**不连累登记本身**：投影是派生物、可随时重建，config 才是真源；
 * 但失败必须说出来，静默吞掉等于让人以为投影已经跟上了。
 */
export async function appAdd(ctx, { id, kind } = {}) {
  const appId = str(id);
  const appKind = str(kind);
  if (!appId || !appKind) {
    throw new FrontError('USAGE', 'app add 需要 --id=<id> 与 --kind=<kind>', { exit: EXIT.USAGE });
  }
  const registry = await mustLoad('registry', 'app add');
  const sides = await sidesOf(ctx, registry);
  if (!sides.includes(appKind)) {
    throw new FrontError('USAGE', `kind '${appKind}' 不在 ia 词表的 sides 组里（合法：${sides.join(' / ')}）`, {
      exit: EXIT.USAGE,
      hint: '取值全集在 assets/style/ia.vocab.json——加一个端形态是往词表里加词，不是绕过校验。',
    });
  }
  const config = await readConfig(ctx.root);
  if ((config.apps ?? []).some((a) => a?.id === appId)) {
    throw new FrontError('USAGE', `端 ${appId} 已经登记过了`, {
      exit: EXIT.USAGE,
      hint: 'vima app list 看现有的；要改 kind 就先 remove 再 add。',
    });
  }
  const updated = { ...config, apps: [...(config.apps ?? []), { id: appId, kind: appKind }] };
  await writeConfig(ctx.root, updated);
  const ev = await recordConfig(ctx, 'app.add', null, { id: appId, kind: appKind });

  const notes = [];
  let synced = false;
  let projected = null;
  try {
    projected = await sync({ root: ctx.root, config: updated });
    synced = true;
  } catch (err) {
    notes.push(`端已登记，但规则投影没刷成（${err.message}）——config 是真源不受影响，稍后手动 vima sync。`);
  }
  return { id: appId, kind: appKind, apps: updated.apps, event: ev.id, synced, projected, notes };
}

export async function appList(ctx) {
  const config = await readConfig(ctx.root);
  return { apps: config.apps ?? [] };
}

export async function appRemove(ctx, { id } = {}) {
  const appId = str(id);
  if (!appId) throw new FrontError('USAGE', 'app remove 需要 --id=<id>', { exit: EXIT.USAGE });
  const config = await readConfig(ctx.root);
  const found = (config.apps ?? []).find((a) => a?.id === appId);
  if (!found) {
    throw new FrontError('NOT_FOUND', `端 ${appId} 没登记过`, {
      exit: EXIT.NOT_FOUND,
      hint: 'vima app list 看现有的。',
    });
  }
  const updated = { ...config, apps: (config.apps ?? []).filter((a) => a?.id !== appId) };
  await writeConfig(ctx.root, updated);
  const ev = await recordConfig(ctx, 'app.remove', { id: found.id, kind: found.kind }, null);

  // remove 与 add 走同一条理由：端变了，投影就得跟着变——只刷 add 不刷 remove
  // 会留下指向已注销端的 paths glob，规则「看起来还限着一个不存在的端」。
  const notes = [];
  let synced = false;
  try {
    await sync({ root: ctx.root, config: updated });
    synced = true;
  } catch (err) {
    notes.push(`端已移除，但规则投影没刷成（${err.message}）——稍后手动 vima sync。`);
  }
  return { id: found.id, kind: found.kind, apps: updated.apps, event: ev.id, synced, notes };
}

/**
 * 切换主题。**必须真的 loadStyle 验证存在**——这是本组命令存在的直接理由之一：
 * 之前 `--theme=不存在的皮` 一路静默成功，直到 next 供料时才发现形整个缺席。
 */
export async function themeSet(ctx, name) {
  const theme = str(name);
  if (!theme) throw new FrontError('USAGE', 'theme set 需要皮的名字：vima theme set <name>', { exit: EXIT.USAGE });
  const registry = await mustLoad('registry', 'theme set');
  try {
    await registry.loadStyle(ctx.assetsRoot, theme);
  } catch (err) {
    if (err.code === 'THEME_NOT_FOUND') {
      throw new FrontError('NOT_FOUND', err.message, {
        exit: EXIT.NOT_FOUND,
        hint: '皮的清单由 assets/style/tokens/ 下有哪些文件决定——加皮是加文件，不是加代码。',
      });
    }
    throw err; // 皮存在但令牌/词表坏了：这是资产仓的缺陷，如实抛 INTERNAL
  }
  const config = await readConfig(ctx.root);
  const before = config.theme ?? null;
  await writeConfig(ctx.root, { ...config, theme });
  const ev = await recordConfig(ctx, 'theme.set', before, theme);
  // config 记「想用哪套皮」，lock 记「那套皮当时长什么样」。
  // 只写 config 的话，令牌或词表哪天改了，项目察觉不到——而它已经照着旧值取过证。
  const lock = await mustLoad('lock', 'theme set');
  const locked = await lock.recordTheme(ctx.root, ctx.assetsRoot, theme);
  return { theme, before, changed: before !== theme, event: ev.id, locked };
}

export async function themeShow(ctx) {
  const config = await readConfig(ctx.root);
  const registry = await mustLoad('registry', 'theme show');
  const theme = config.theme ?? null;
  if (!theme) return { theme: null, ok: false, error: 'config 里没登记主题' };
  try {
    await registry.loadStyle(ctx.assetsRoot, theme);
    return { theme, ok: true, error: null };
  } catch (err) {
    // show 是只读体检，坏了要报得出而不是抛出去——「看一眼」不该以非零码收场
    return { theme, ok: false, error: err.message };
  }
}

/**
 * 安装一个业务块。**必须 readBlock 验证存在且读得出层**——登记一个读不出内容的
 * 块 id，next 供料时只会静默少一块，比报错难查得多。
 */
export async function blockAdd(ctx, id) {
  const blockId = str(id);
  const parts = blockId.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new FrontError('USAGE', `块 id 必须是 <set>/<name> 形态：${blockId || '(空)'}`, { exit: EXIT.USAGE });
  }
  const registry = await mustLoad('registry', 'block add');
  let block;
  try {
    block = await registry.readBlock(ctx.assetsRoot, parts[0], parts[1]);
  } catch (err) {
    if (err.code === 'BLOCK_NOT_FOUND') {
      const have = (await registry.listBlocks(ctx.assetsRoot)).map((b) => `${b.set}/${b.name}`);
      throw new FrontError('NOT_FOUND', `${err.message}（现有：${have.join('、') || '无'}）`, { exit: EXIT.NOT_FOUND });
    }
    throw err; // 层文件重复 / block.json 坏掉：资产仓的缺陷，如实抛
  }
  const layers = ['L1', 'L2', 'L3', 'L4'].filter((k) => block[k]);
  if (layers.length === 0) {
    throw new FrontError('NOT_FOUND', `块 ${blockId} 存在但一层内容都读不出来——半截块装进来也供不了料`, { exit: EXIT.NOT_FOUND });
  }
  const config = await readConfig(ctx.root);
  if ((config.blocks ?? []).includes(blockId)) {
    throw new FrontError('USAGE', `块 ${blockId} 已经装过了`, { exit: EXIT.USAGE, hint: 'vima block list 看现有的。' });
  }

  // 依赖闸门：装之前把 DAG 走一遍。装个半截的比装不上难查得多——
  // 缺的那块要到 next 供料时才显形，而那时人看到的是「契约里提到的东西没有」。
  const lock = await mustLoad('lock', 'block add');
  const graph = lock.blockGraph(await registry.listBlocks(ctx.assetsRoot));
  const { needs, missing: missingDeps, cycles } = lock.resolveDeps(graph, blockId);
  if (cycles.length) {
    throw new FrontError('UNMET', `块 ${blockId} 的依赖成环：${cycles.map((c) => c.join(' → ')).join('；')}`, {
      exit: EXIT.UNMET,
      hint: '环是资产仓的缺陷，改 block.json 的 depends.blocks——装进来只会让「装齐了没有」永远答不了。',
    });
  }
  if (missingDeps.length) {
    throw new FrontError('NOT_FOUND',
      `块 ${blockId} 依赖资产仓里不存在的块：${missingDeps.map((m) => `${m.from} → ${m.to}`).join('、')}`, {
        exit: EXIT.NOT_FOUND,
        hint: '缺依赖就不装——半截块装进来，缺的那部分要到取证时才显形。',
      });
  }
  const notInstalled = needs.filter((d) => !(config.blocks ?? []).includes(d));
  if (notInstalled.length) {
    throw new FrontError('USAGE', `块 ${blockId} 依赖还没装的块：${notInstalled.join('、')}`, {
      exit: EXIT.USAGE,
      // 刻意不自动装依赖：装什么进项目是人的决定，替人装等于替人扩了供料面。
      hint: `先 ${notInstalled.map((d) => `vima block add ${d}`).join(' && ')}，再装这个。`,
    });
  }

  const updated = { ...config, blocks: [...(config.blocks ?? []), blockId] };
  await writeConfig(ctx.root, updated);
  const ev = await recordConfig(ctx, 'block.add', null, blockId);
  // 锁住「装的是这一版」。config 里那个名字指向的内容会漂，而摘要看得出它漂了。
  const locked = await lock.recordBlock(ctx.root, ctx.assetsRoot, blockId);

  const notes = [];
  const missing = ['L1', 'L2', 'L3'].filter((k) => !block[k]);
  if (missing.length) {
    notes.push(`这个块缺 ${missing.join('、')} 层——装是装上了，vima audit 会一直以 warn 盯着它。`);
  }
  // 人话依赖判不了机检，但也不能假装它不存在——如实转述，由人接住。
  const caps = block.meta?.depends?.capabilities;
  if (Array.isArray(caps) && caps.length) {
    notes.push(`这个块还要求这些能力（人话依赖，机器判不了）：${caps.join('；')}`);
  }
  return { id: blockId, layers, blocks: updated.blocks, event: ev.id, deps: needs, locked, notes };
}

export async function blockList(ctx) {
  const registry = await mustLoad('registry', 'block list');
  const config = await readConfig(ctx.root);
  const installed = new Set(config.blocks ?? []);
  const available = (await registry.listBlocks(ctx.assetsRoot)).map((b) => ({
    id: `${b.set}/${b.name}`,
    layers: b.layers,
    installed: installed.has(`${b.set}/${b.name}`),
  }));
  return { installed: [...(config.blocks ?? [])], available };
}

export async function blockRemove(ctx, id) {
  const blockId = str(id);
  if (!blockId) throw new FrontError('USAGE', 'block remove 需要块 id：vima block remove <set>/<name>', { exit: EXIT.USAGE });
  const config = await readConfig(ctx.root);
  if (!(config.blocks ?? []).includes(blockId)) {
    throw new FrontError('NOT_FOUND', `块 ${blockId} 没装过`, { exit: EXIT.NOT_FOUND, hint: 'vima block list 看现有的。' });
  }
  // ── 反向依赖闸门 ────────────────────────────────────────────────────
  // `add` 保证「装上的集合是依赖闭合的」，`remove` 不查就能把这个保证拆掉——
  // 留下一个依赖它的块指着空气。装的时候拦、拆的时候不拦，等于那道闸门只挡了一半。
  //
  // 不做级联删除：那会替人决定「顺带把依赖它的也卸了」，而人要卸的可能只是这一个。
  // 报出来 + 给出确切命令，让人自己定。
  const lockMod = await mustLoad('lock', 'block remove');
  const registry = await optional('registry');
  if (registry) {
    const dependents = [];
    for (const other of config.blocks ?? []) {
      if (other === blockId) continue;
      const [set, name] = other.split('/');
      const b = await registry.readBlock(ctx.assetsRoot, set, name).catch(() => null);
      if (b && lockMod.dependsOf(other, b.meta).includes(blockId)) dependents.push(other);
    }
    if (dependents.length) {
      throw new FrontError('USAGE',
        `${blockId} 被这些已装的块依赖着：${dependents.join('、')}——拆了它们就指着空气了`, {
          exit: EXIT.USAGE,
          hint: `要么先卸掉它们（${dependents.map((d) => `vima block remove ${d}`).join('；')}），`
            + '要么保留本块。这里不做级联删除——「顺带把依赖它的也卸了」是人的决定，不是命令的默认。',
        });
    }
  }

  const updated = { ...config, blocks: (config.blocks ?? []).filter((b) => b !== blockId) };
  await writeConfig(ctx.root, updated);
  const ev = await recordConfig(ctx, 'block.remove', blockId, null);
  // 锁里同步销账：留着孤儿条目就是 lock 说在用、config 说没装，两份都不可信了。
  const unlocked = await lockMod.forgetBlock(ctx.root, blockId);
  return { id: blockId, blocks: updated.blocks, event: ev.id, unlocked };
}

/**
 * 资产升级的影响分析（P0-3 · R3）：**资产内容变了之后，哪些命题的证据要重新看**。
 *
 *   vima block upgrade --check   只报不改（plan/check）
 *   vima block upgrade           把 lock 里的摘要更新到当下这一版（apply）
 *
 * 判据来自同一处 `lock.checkLock`——`sync --check` 报的漂和这里列的漂是同一份
 * 计算，不是两套各算各的。
 *
 * **刻意不做的事：不自动让证据失效。** 失效传播是 core/claims 的职责（R3 的
 * 那条链路已经有了实现），从这里另开一条「资产变了就清证据」的路，就是第二个
 * 失效真源。而且判据也不该由这里定：块的 L2 改了一个错别字，和 L1 契约换了
 * 端点，对证据的意义完全不同——这个只有人分得清。
 * 所以这里只回答「谁会被波及」，重新取证由人确认后跑 vima submit。
 */
export async function blockUpgrade(ctx, { check = false } = {}) {
  const lock = await mustLoad('lock', 'block upgrade');
  const config = await readConfig(ctx.root);
  const status = await lock.checkLock(ctx.root, ctx.assetsRoot, config);

  // 谁会被波及：判据只能是 next 供料实际用的那张表，不能另写一份。
  // 块正文按命题的层下发（contract→L1，impl→L2/L3），词表切片按 VOCAB_BY_LAYER。
  // 所以「这条命题会不会读到这个资产」= 它那一层在表里有没有条目。
  const p = await load(ctx.root);
  const claims = [...p.claims.values()].filter((c) => !c.retired);
  const hit = (kind, claim) => (kind === 'theme'
    ? (VOCAB_BY_LAYER[claim.layer] ?? []).length > 0
    : (BLOCK_LAYERS_BY_LAYER[claim.layer] ?? []).length > 0);

  const changed = status.entries.filter((e) => e.status === 'drift');
  const impacted = changed.map((e) => ({
    kind: e.kind,
    id: e.id,
    locked: e.locked,
    actual: e.actual,
    claims: claims.filter((c) => hit(e.kind, c)).sort(byLayerThenId).map((c) => ({
      id: c.id,
      layer: c.layer,
      // 有证据的那些才是要重新看的——没取过证的命题本来就还没被这份内容影响
      met: meets(c),
      strength: best(c)?.strength ?? null,
    })),
  }));

  const notes = [];
  for (const e of status.entries) {
    if (e.status === 'unreadable' || e.status === 'orphan') notes.push(`${e.kind} ${e.id}：${e.why}`);
  }
  for (const u of status.unlocked) {
    notes.push(`${u.kind} ${u.id} 还没锁——它没有可复现性保证，也查不出漂没漂（重跑 vima ${u.kind === 'theme' ? `theme set ${u.id}` : `block add ${u.id}`} 补锁）。`);
  }

  const applied = [];
  let event = null;
  if (!check && changed.length) {
    for (const e of changed) {
      if (e.kind === 'block') await lock.recordBlock(ctx.root, ctx.assetsRoot, e.id);
      else await lock.recordTheme(ctx.root, ctx.assetsRoot, e.id);
      applied.push(`${e.kind}:${e.id}`);
    }
    const ev = await recordConfig(ctx, 'assets.upgrade',
      changed.map((e) => ({ kind: e.kind, id: e.id, digest: e.locked })),
      changed.map((e) => ({ kind: e.kind, id: e.id, digest: e.actual })));
    event = ev.id;
  }
  if (changed.length) {
    notes.push('证据不会因为升级自动失效——哪条要重新取证由人判断，确认后跑 vima submit <claimId>。');
  }

  return { check, drifted: status.drifted, changed: changed.length, impacted, applied, event, status, notes };
}

// ── next ──────────────────────────────────────────────────────────────────

// ── 供料的裁剪口径（P0-3）：按命题的层决定给什么，不给「全部」────────────
//
// impl/behavior 在写界面与交互，给 layout+interaction 的组切片（组名+词条 id，
// 不给词条全文——封闭集合的价值在「只能从这些里挑」，挑中了再去词表读细节）；
// contract 层是接口形状，版面词表帮不上忙，刻意不给。
// 块内容按层给对应的 L 层正文：contract 给 L1（契约），impl 给 L2/L3（实现）。
// behavior 层验的是「跑起来对不对」，不需要往上下文里再灌一遍实现正文。
const VOCAB_BY_LAYER = Object.freeze({ impl: ['layout', 'interaction'], behavior: ['layout', 'interaction'] });
const BLOCK_LAYERS_BY_LAYER = Object.freeze({ contract: ['L1'], impl: ['L2', 'L3'] });

/** 供料体积闸门：超了就把正文降级成引用。上下文塞爆比缺料更糟——后面的规则会被挤掉。 */
export const ASSET_BYTE_LIMIT = 16 * 1024;

/**
 * 体积裁剪（导出给测试钉行为：降级判据只有这一份实现）。
 * 超限时只降块正文（那是体积的大头），词表切片本来就是紧凑的 id 引用形态。
 * 每段都留着 source——降级的含义是「自己去读这个文件」，不是「没有了」。
 */
export function packAssets(assets, limit = ASSET_BYTE_LIMIT) {
  let bytes = 0;
  for (const v of assets.vocab) bytes += Buffer.byteLength(JSON.stringify(v));
  for (const b of assets.blocks) bytes += Buffer.byteLength(b.text ?? '');
  assets.bytes = bytes;
  if (bytes > limit) {
    assets.degraded = true;
    for (const b of assets.blocks) {
      b.bytes = Buffer.byteLength(b.text ?? '');
      delete b.text;
    }
  }
  return assets;
}

/**
 * 给命题配料：词表切片 + 已安装块的层正文，每段带 source（从哪个文件来的）。
 * 资产读不出**不让 next 失败**——下一步该做什么和料齐不齐是两个问题，
 * 但缺料必须写进 notes（audit 也会报），静默少一块比报错难查得多。
 */
async function gatherAssets(ctx, registry, claim, notes) {
  const out = { vocab: [], blocks: [], bytes: 0, degraded: false };
  const vocabNames = VOCAB_BY_LAYER[claim.layer] ?? [];
  const blockLayers = BLOCK_LAYERS_BY_LAYER[claim.layer] ?? [];

  if (vocabNames.length) {
    try {
      const style = await registry.loadStyle(ctx.assetsRoot, ctx.config?.theme);
      for (const name of vocabNames) {
        const source = path.join(ctx.assetsRoot, 'style', `${name}.vocab.json`);
        for (const [group, def] of Object.entries(style[name]?.groups ?? {})) {
          out.vocab.push({ vocab: name, group, terms: (def.terms ?? []).map((t) => t.id), source });
        }
      }
    } catch (err) {
      notes.push(`词表切片没附上：主题 ${ctx.config?.theme} 读不出来（${err.message}）——vima theme set 换一个存在的皮。`);
    }
  }

  if (blockLayers.length) {
    for (const id of ctx.config?.blocks ?? []) {
      const [set, name] = String(id).split('/');
      try {
        const block = await registry.readBlock(ctx.assetsRoot, set, name);
        for (const key of blockLayers) {
          if (!block[key]) continue;
          out.blocks.push({
            block: id,
            layer: key,
            source: path.join(ctx.assetsRoot, 'blocks', set, name, block[key].file),
            text: block[key].text,
          });
        }
      } catch (err) {
        notes.push(`已登记的块 ${id} 读不出来（${err.message}）——本次没附它的内容，vima audit 会报这条。`);
      }
    }
  }

  packAssets(out);
  if (out.degraded) {
    notes.push(`资产内容合计 ${out.bytes} 字节超过 ${ASSET_BYTE_LIMIT} 字节，块正文已降级为引用——按各段 source 自行读取。`);
  }
  return out;
}

/**
 * 我该干什么：下一条命题 + 适用规则 + 资产供料 + 项目上下文。
 *
 * 选择判据（只有这一份实现，见 dispatchState）：未达标的命题按层序
 * （intent→behavior）排，**执行依赖（dependsOn）全部达标的优先**，
 * 未过期租约占着的默认排除。失效（stale）的命题天然进候选——R3 的「改完了」
 * 判据是失效清单清空，不是人觉得改完了。
 *
 * 判据不在这里第二次实现：next 与 claim 都调 dispatchState，
 * 否则「这条能不能派」会有两个答案，而两个答案里必然有一个是错的且不报错。
 */
export async function next(ctx, { includeLeased = false } = {}) {
  const p = await load(ctx.root);
  // 退休命题不进任何候选：它 meets 恒 false，不排除的话会永远排在待办里——
  // 「从 docs 删掉的需求变成删不掉的待办」比删不掉的账目更糟。
  const all = [...p.claims.values()].filter((c) => !c.retired);
  const pending = all.filter((c) => !meets(c)).sort(byLayerThenId);

  const { leases, corrupt } = await lease.list(ctx.root);
  const byClaim = new Map(leases.map((l) => [l.claimId, l]));
  const states = pending.map((c) => dispatchState(c, { claims: p.claims, leases: byClaim, now: ctx.now }));

  // 两步，顺序要紧：
  //   ① 租约排除发生在**挑选之前**——先排除再退让，否则「没有 ready 的了」那个
  //      退让分支会把别人手上的题重新派出去，租约等于白做。
  //      --include-leased 放宽的正是这一步（它要的是「让我看看别人在做什么」）。
  //   ② 在可见集合里优先挑执行依赖已达标的；一条都没有就退让给第一条（C4 不阻塞：
  //      宁可派一条上游未定的，也不回一句「没活干」——但 blockedBy 会照实说）。
  const visible = includeLeased ? states : states.filter((s) => !s.leasedBy);
  const state = visible.find((s) => s.blockedBy.length === 0) ?? visible[0] ?? null;
  const pick = state ? p.claims.get(state.id) : null;
  const notes = [];

  const leasedOut = states.filter((s) => s.leasedBy);
  if (leasedOut.length && !includeLeased) {
    notes.push(`${leasedOut.length} 条候选被未过期的租约占着，本次没派：`
      + `${leasedOut.map((s) => `${s.id}→${s.leasedBy.actor}（到 ${s.leasedBy.expiresAt}）`).join('、')}`
      + '。要看它们加 --include-leased；执行者崩溃时等租约过期即可自动回收。');
  }
  if (corrupt.length) {
    notes.push(`${corrupt.length} 个租约文件读不懂（${corrupt.join('、')}）：它们不参与排除，`
      + '对应命题可能被重复派题。删掉它们即可（租约不是真源，删了不丢历史）。');
  }

  let rules = [];
  let assets = { vocab: [], blocks: [], bytes: 0, degraded: false };
  if (pick) {
    const mod = await optional('rules');
    if (mod) {
      const loaded = await mod.loadRules(ctx.assetsRoot, ctx.root);
      rules = mod.selectRules(loaded, dimsOf(ctx, pick));
    } else {
      notes.push('lib/assets/rules.mjs 尚未实现：本次没有附规则，写出来的东西暂时没有机检面。');
    }
    const registry = await optional('registry');
    if (registry) {
      assets = await gatherAssets(ctx, registry, pick, notes);
    } else {
      notes.push('lib/assets/registry.mjs 尚未实现：本次没有附资产内容（词表切片/块正文）。');
    }
  } else if (all.length === 0) {
    notes.push('还没有任何命题。先在 docs/ 写规格，再跑 vima compile 把它编译成命题。');
  } else if (pending.length === 0) {
    notes.push('全部命题已达标且未失效——没有下一步了。');
  } else {
    // 有待办却派不出：只可能是全被租约占着。这两种情况处置完全不同
    // （一个是收工，一个是等别人/等过期），合成一句「没有下一步」会把人引向错误动作。
    notes.push('还有待办，但可派的都被未过期的租约占着——等它们提交或等租约过期，'
      + '或 --include-leased 看看是谁在做。');
  }

  return {
    task: pick ? slim(pick) : null,
    // 执行依赖里还没达标的那些。**只有这一条参与阻塞判断**，
    // 来源追溯边（derivesFrom = task.from）不进这里，见 dependsOn 的注释。
    blockedBy: state?.blockedBy ?? [],
    dependsOn: state?.dependsOn ?? [],
    derivesFrom: pick ? pick.from : [],
    // 这条题此刻在谁手上（--include-leased 时才可能非空——默认它们根本不进候选）
    lease: state?.leasedBy ?? null,
    // 被租约挡在外面的候选，如实列出来：观测面不显示它，人就会以为「没活干了」
    leased: leasedOut.map((s) => ({
      claimId: s.id, actor: s.leasedBy.actor, worktree: s.leasedBy.worktree ?? null, expiresAt: s.leasedBy.expiresAt,
    })),
    includeLeased,
    rules,
    assets,
    context: {
      root: ctx.root,
      theme: ctx.config?.theme ?? null,
      apps: ctx.config?.apps ?? [],
      blocks: ctx.config?.blocks ?? [],
      extract: CAPABILITY,
    },
    progress: tiers(p),
    notes,
  };
}

// ── claim（认领）───────────────────────────────────────────────────────────

/**
 * 声明「我开始做这条了」。
 *
 * 它**不改变命题状态**——认领不是完成。它只落一条 run 事件，答 R2 第三问
 * （过程怎么走的、谁做的）与第四问（花了多少）。内容仍由系统生成：
 * 调用方只给 claimId，时间与 actor 由系统写。
 *
 * 从 P0-4 起它还多做一件事：**取租约**。取不到就抛（带上被谁占着、什么时候过期），
 * 而不是让第二个执行者「认领成功」然后去重复实现同一条题——那正是并行下
 * 最贵的一种失败：两份代码都写完了才在合并时发现。
 *
 * 拿不到租约时**不落 run 事件**：没开工的事不该进过程账。
 */
export async function claimTask(ctx, claimId, { cost = null, worktree = null, ttlMs } = {}) {
  const p = await load(ctx.root);
  const c = p.claims.get(claimId);
  if (!c) throw notFound(claimId);

  const { leases } = await lease.list(ctx.root);
  const state = dispatchState(c, {
    claims: p.claims, leases: new Map(leases.map((l) => [l.claimId, l])), now: ctx.now,
  });

  // worktree 缺省取项目根：Builder 各自在自己的 worktree 里跑 vima 时它天然不同，
  // 这是「持有者身份」里唯一不会撞的那一段（actor 默认都是 'cli'）。
  const here = worktree ?? ctx.root;
  const got = await lease.acquire(ctx.root, claimId, {
    actor: ctx.actor, worktree: here, now: ctx.now, ...(ttlMs ? { ttlMs } : {}),
  });
  if (!got.ok) {
    const h = got.held;
    throw new FrontError('LEASED', h
      ? `${claimId} 已被 ${h.actor} 认领（worktree=${h.worktree ?? '-'}，租约到 ${h.expiresAt} 过期）`
      : `${claimId} 的租约刚被别的执行者抢走`, {
      exit: EXIT.UNMET,
      hint: '换一条：vima next 会自动跳过被占着的命题。'
        + '若那个执行者已经崩溃，等租约过期即可自动回收（不用手删文件，也不该手删）。',
    });
  }

  const ev = await append(ctx.root, {
    kind: 'run',
    actor: ctx.actor,
    subject: claimId,
    payload: { op: 'claim', layer: c.layer, need: c.need },
    ...(cost ? { cost } : {}),
  }, { now: ctx.now });

  const notes = [];
  if (got.renewed) notes.push(`租约续期到 ${got.lease.expiresAt}（同一持有者重新认领 = 续租）。`);
  if (got.reclaimed) notes.push('回收了一份已过期的租约——上一个执行者要么崩了，要么早就走了。');
  if (state.blockedBy.length) {
    // 不拦（C4 不阻塞），但必须说：上游没达标时开工是一个**决定**，得让人看见自己做了这个决定。
    notes.push(`执行依赖还没达标：${state.blockedBy.join('、')}。认领不拦你，但你是在未定的地基上施工。`);
  }
  return {
    claimId,
    event: ev.id,
    at: ev.ts,
    claim: slim(c),
    lease: got.lease,
    renewed: got.renewed,
    reclaimed: got.reclaimed,
    dependsOn: state.dependsOn,
    blockedBy: state.blockedBy,
    notes,
  };
}

// ── submit（交活）─────────────────────────────────────────────────────────

/** 取证方式的默认值：从产物机械推出。自述（claimed）够不着任何门槛，不该当默认。 */
export const DEFAULT_HOW = 'derived';

/**
 * 交活。**只收 claimId，不收任何自述。**
 *
 * 「做完了」由系统去取证（ops/attest），取证结果由系统写成 evidence 事件。
 * 这条塌了整套观测就退化成自称——上一代实测：43 个任务都写了「Service 层
 * 单元测试」验收项，实际覆盖 0/58，而所有报告都是绿的。
 *
 * attest 已经自己记了 op:'attest' 的 run 事件（含发起人、方式、成没成、为什么没成），
 * 这里**不再补记一条 submit**：同一件事两条记录会让「跑了几次」这个数字有两个答案。
 */
export async function submit(ctx, claimId, how = null) {
  const before = await load(ctx.root);
  const c0 = before.claims.get(claimId);
  if (!c0) throw notFound(claimId);

  const mod = await mustLoad('attest', 'submit');
  // 命题声明了证据策略 → 默认就走它（executed），而不是回落到 derived。
  // 不这么定的话，`vima submit <id>`（MCP 那一侧唯一的形态）永远够不着
  // `need: executed`——策略机制等于白做，agent 只能去求人给 --how，
  // 而「给 --how」正是我们刚堵上的那个放水口。
  const fallback = c0.policy ? { mode: 'executed' } : DEFAULT_HOW;
  const out = (await mod.attest(ctx, claimId, how ?? fallback)) ?? {};

  const written = [];
  for (const e of out.events ?? []) {
    written.push(await append(ctx.root, e, { now: ctx.now }));
  }

  const after = await load(ctx.root);
  const c1 = after.claims.get(claimId) ?? c0;
  return {
    claimId,
    met: meets(c1),
    // 「强度够了但只有临时命令的证据」——不单独报出来，人只会看到
    // 「取到 executed / 需要 ≥ executed / 未达标」，以为是 bug 然后去找绕过的办法。
    blockedByAdHoc: blockedByAdHoc(c1),
    need: c1.need,
    got: best(c1)?.strength ?? null,
    attested: out.ok === true,
    reason: out.reason ?? null,
    unimplemented: out.unimplemented === true,
    stale: c1.stale,
    evidence: c1.evidence,
    events: written.map((e) => ({ id: e.id, kind: e.kind, ts: e.ts })),
    progress: tiers(after),
  };
}

// ── rule（裁定）───────────────────────────────────────────────────────────

/**
 * 记一条裁定（C4 不阻塞）：规格没说清的地方先由 AI 定夺，记录下来，人事后二次裁决。
 *
 * confidence 与 blastRadius 是必填——没有优先级的裁定台账会走向和「永远消不掉的
 * 告警」同一个结局：人不看了。这不是形式主义，是这张表能否活下去的前提。
 */
export const CONFIDENCE = Object.freeze(['low', 'medium', 'high']);

export async function rule(ctx, input = {}) {
  const question = str(input.question);
  const chosen = str(input.chosen);
  if (!question || !chosen) {
    throw new FrontError('USAGE', '裁定必须同时给出 question（拿不准的是什么）与 chosen（你定了哪个）', { exit: EXIT.USAGE });
  }
  const confidence = str(input.confidence);
  if (!CONFIDENCE.includes(confidence)) {
    throw new FrontError('USAGE', `裁定必须带 confidence（${CONFIDENCE.join(' / ')}）——没有优先级的裁定台账没人会看`, { exit: EXIT.USAGE });
  }
  const blastRadius = normalizeBlast(input.blastRadius ?? input.blast);
  if (blastRadius === null) {
    throw new FrontError('USAGE', '裁定必须带 blastRadius（这条定错了会波及什么）——它决定人先看哪条', { exit: EXIT.USAGE });
  }
  // ── 二次裁决（override）────────────────────────────────────────────
  // C4 的另一半：AI 先定夺不阻塞，**人事后要能推翻**。没有这一步，
  // 裁定台账就是一张只进不出的表——旧裁定永远「未复核」，人很快不看了。
  const overrides = str(input.overrides) || null;
  let subject = str(input.subject) || null;
  if (overrides) {
    const p = await load(ctx.root);
    const old = p.rulings.find((r) => r.id === overrides);
    if (!old) {
      throw new FrontError('NOT_FOUND', `找不到要改判的裁定 ${overrides}`, { exit: EXIT.NOT_FOUND });
    }
    if (old.overriddenBy) {
      // 改判一条已被改判的裁定 = 台账里出现两条「现行结论」。要求改判最新那条。
      throw new FrontError('USAGE',
        `裁定 ${overrides} 已被 ${old.overriddenBy} 改判过——要再改就改判最新那条，别形成两条现行结论`,
        { exit: EXIT.USAGE });
    }
    // 改判默认沿用旧裁定关联的命题：改判改的是同一个问题的答案
    subject = subject ?? old.subject;
  }

  const ev = await append(ctx.root, {
    kind: 'ruling',
    actor: ctx.actor,
    subject,
    payload: {
      question,
      chosen,
      options: toList(input.options),
      rationale: str(input.rationale),
      confidence,
      blastRadius,
      ...(overrides ? { overrides } : {}),
    },
  }, { now: ctx.now });

  // 改判关联着命题时，命题要跟着修订——走**同一条**定义变化 → 失效传播链路，
  // 不为改判另造回滚机制（ARCHITECTURE 决定性纪律 2 的原话）。
  let revised = null;
  if (overrides && subject) {
    const p = await load(ctx.root);
    const c = p.claims.get(subject);
    if (c && !c.retired) {
      await append(ctx.root, {
        kind: 'claim',
        actor: ctx.actor,
        subject,
        payload: {
          layer: c.layer,
          statement: `${c.statement}（改判 ${ev.id}：${chosen}）`,
          trust: 'ruled',
          need: c.need,
          from: c.from,
          impl: c.impl,
          source: c.source,
        },
      }, { now: ctx.now });
      revised = subject;
    }
  }

  return {
    id: ev.id, at: ev.ts, question, chosen, confidence, blastRadius,
    subject: ev.subject, overrides, revised,
  };
}

// ── ask（查任意命题）───────────────────────────────────────────────────────

export async function ask(ctx, claimId) {
  const p = await load(ctx.root);
  const c = p.claims.get(claimId);
  if (!c) throw notFound(claimId);
  const downstream = [...p.claims.values()]
    .filter((x) => x.from.includes(claimId))
    .map((x) => ({ id: x.id, layer: x.layer, met: meets(x), stale: x.stale }));
  const upstream = c.from.map((id) => {
    const up = p.claims.get(id);
    return { id, layer: up?.layer ?? null, met: up ? meets(up) : null, missing: !up };
  });
  return {
    claim: slim(c),
    evidence: c.evidence,
    upstream,
    downstream,
    // rulings 投影不带 subject，这里回原始事件流取——不自造第二份过滤判据
    rulings: p.events
      .filter((e) => e.kind === 'ruling' && e.subject === claimId)
      .map((e) => ({ id: e.id, at: e.ts, actor: e.actor, ...e.payload })),
    runs: p.runs.filter((r) => r.subject === claimId),
  };
}

// ── status ────────────────────────────────────────────────────────────────

function tiers(p) {
  const s = p.stats;
  return {
    // 三档：声明了 → 有证据 → 达标。中间那档是关键——上一代只有「有没有写」
    // 和「说做完没」，中间的「有证据但不够硬」整档不可见。
    declared: s.total,
    evidenced: s.total - s.noEvidence,
    met: s.met,
    stale: s.stale,
    byLayer: s.byLayer,
    byStrength: s.byStrength,
  };
}

/**
 * 三档进度 + 成本 + 失效清单。
 *
 * **它永远成功。** 它要可视化的正是「会话开在错目录」这类故障——
 * 非零码会让宿主只显示一片空白，而空白正好是最需要解释的那一刻。
 */
export async function status({ cwd = process.cwd(), env = process.env } = {}) {
  const { root, config } = await projectContext({ cwd, env });
  if (!root) {
    return {
      ok: false,
      reason: 'no-project',
      cwd: path.resolve(cwd),
      checked: {
        VIMA_PROJECT_DIR: env.VIMA_PROJECT_DIR ?? null,
        CLAUDE_PROJECT_DIR: env.CLAUDE_PROJECT_DIR ?? null,
      },
      hint: '向上回溯找不到 .vima/。会话可能开在了错目录：cd 到项目根，或在这里 vima init。',
    };
  }
  const p = await load(root);
  const stale = [...p.claims.values()].filter((c) => c.stale)
    .map((c) => ({ id: c.id, layer: c.layer, from: c.from }));
  return {
    ok: true,
    root,
    name: config?.name ?? null,
    theme: config?.theme ?? null,
    apps: config?.apps ?? [],
    blocks: config?.blocks ?? [],
    tiers: tiers(p),
    cost: p.stats.cost,
    runs: p.stats.runs,
    rulings: p.rulings.length,
    stale,
    corrupt: p.corrupt,
  };
}

// ── compile / audit / ui：ops 与 web 的薄转发 ─────────────────────────────

/**
 * 编译命题。
 *
 * 为什么 CLI 有它而 MCP 没有：markdown 是真源，编译是人与 CI 的动作。
 * agent 若能自己造命题，就等于自己给自己出题——那是另一种自称。
 */
export async function compile(ctx, input) {
  const mod = await mustLoad('compile', 'compile');
  const out = (await mod.compile(ctx, input)) ?? {};
  const written = [];
  for (const e of out.events ?? []) {
    written.push(await append(ctx.root, e, { now: ctx.now }));
  }
  return {
    written: written.length,
    claims: out.claims ?? [],
    rejected: out.rejected ?? [],
    events: written.map((e) => ({ id: e.id, kind: e.kind, subject: e.subject })),
  };
}

/**
 * 编译整棵 docs/ 树（`vima compile` 不带参数时走这条）。
 *
 * **逐批写盘，不攒到最后。** compile 校验上游必须已在事件流里，spec 那批要能
 * 看见 intent 那批刚写进去的命题——攒批会让第二层往后全部报「上游不在事件流里」。
 * 顺序由 ops/spec.readSpecs 按层定死。
 *
 * 一批里有条目被拒不中断后续：那条命题的下游本来就会因「上游不存在」跟着被拒，
 * 报告里两条一起看得见，比在第一处停下更容易一次改完。
 */
export async function compileDocs(ctx, dir, { plan = false } = {}) {
  const spec = await mustLoad('spec', 'compile');
  const compileMod = await mustLoad('compile', 'compile');
  const { batches, skipped } = await spec.readSpecs(dir);

  // ── 阶段一：算计划。**一个字都不写盘。** ───────────────────────────────
  //
  // 此前是「逐批编译、逐批写入，最后再对账退休」，三个后果都是真的：
  //   · 原样重跑仍写入等价 claim 事件（实测：2 条 → 4 条），
  //     所谓「幂等」只断言了「没退休任何东西」，比它的名字弱得多；
  //   · 中途有条目被拒时，前面的批次已经落盘了——留下一半新状态；
  //   · 没有 plan → validate → commit，人看不到「这次会改什么」就得先承受它。
  //
  // 现在：全部批次在**内存里**编译（compile 支持 ctx.claims 干跑），
  // 校验全过才提交。批间可见性靠累积那份 known 传递——后一批要看得见
  // 前一批刚编出来的上游，这是层序存在的理由。
  const known = new Map((await load(ctx.root)).claims);
  const drafts = [];        // 待写的 claim 事件草稿
  const rejected = [];
  const claims = [];
  const files = [];
  const noop = [];          // 目标与现状完全一致 → 不产生事件

  for (const { rel, batch } of batches) {
    const r = (await compileMod.compile({ ...ctx, claims: known }, batch)) ?? {};
    rejected.push(...(r.rejected ?? []));
    let changed = 0;
    for (const ev of r.events ?? []) {
      // 只有**真的有变化**才产生事件。这一条是「原样 compile written=0」的全部内容：
      // 不做这个比较，append-only 的日志会被每次重跑撑大一圈，
      // 而回放时满屏都是「什么也没改」的 claim 事件。
      if (ev.kind === 'claim' && sameAsProjected(known.get(ev.subject), ev.payload)) {
        noop.push(ev.subject);
        continue;
      }
      drafts.push(ev);
      if (ev.kind === 'claim') changed += 1;
    }
    for (const c of r.claims ?? []) known.set(c.id, { ...known.get(c.id), ...c });
    claims.push(...(r.claims ?? []));
    files.push({ file: rel, layer: batch.layer, written: changed, rejected: (r.rejected ?? []).length });
  }

  // ── 退休对账：docs 是全量真源，从里面消失的命题要退休 ─────────────────
  // 没有这一步，compile 就只有 upsert：删掉的需求永久留在投影里，
  // 参与进度、参与 audit、排进 next 的待办——账目只增不减。
  //
  // 边界（缺一条就会误杀）：
  //   · 只在**整棵 docs 编译**时对账。单批 JSON 是旁路，看不见全量，不配退人。
  //   · 本轮有条目被拒时不退休——被拒的条目不在目标集里，拿残缺的目标集对账
  //     会把「没编进去」当成「被删了」。（现在整次都不提交，这条更强了。）
  //   · **一个规格文件都没扫到时不对账**。空 docs 是「还没写」或「开错目录」，
  //     不是「把需求全删了」。这条是被测试当场抓出来的。
  const retired = [];
  if (rejected.length === 0 && batches.length > 0) {
    const target = new Set(batches.flatMap((b) => b.batch.items.map((i) => i.id)));
    for (const c of known.values()) {
      if (c.retired || target.has(c.id)) continue;
      drafts.push({
        kind: 'claim',
        actor: ctx.actor,
        subject: c.id,
        payload: { retired: true, reason: 'docs 里已不存在这条命题' },
      });
      retired.push(c.id);
    }
  }

  const result = {
    written: 0,
    planned: drafts.length,
    claims,
    rejected,
    events: [],
    files,
    skipped,
    retired,
    noop,
    committed: false,
  };

  // ── 阶段二：校验通过才提交，否则**零写入** ─────────────────────────────
  // 「要么整次 compile 零写入，要么全部落地」——中间态是最难查的那种状态：
  // 人看到的是一份说不清编到哪儿的账，而下一次 compile 会在它上面继续叠。
  if (plan) return result;
  if (rejected.length > 0) return result;   // 有拒绝 → 一个字都不写
  if (drafts.length === 0) { result.committed = true; return result; }

  for (const ev of drafts) {
    const w = await append(ctx.root, ev, { now: ctx.now });
    result.events.push({ id: w.id, kind: w.kind, subject: w.subject });
  }
  result.written = result.events.length;
  result.committed = true;
  return result;
}

/**
 * 目标载荷与当前投影是不是**完全一样**（一样就不产生事件）。
 *
 * 比的是 compile 会写进 payload 的每一个字段，不是「定义指纹」那一组——
 * 定义指纹管的是「要不要清证据」，这里管的是「要不要写事件」，两个问题。
 * 少比一个字段，那个字段的改动就会**永远写不进去**（人改了 docs 却毫无反应，
 * 比多写一条空事件难查得多）。所以宁可比全。
 */
function sameAsProjected(prev, payload) {
  if (!prev || prev.retired) return false;   // 不存在或已退休 → 这次是新增/复活
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  return same(prev.layer, payload.layer)
    && same(prev.statement, payload.statement)
    && same(prev.trust, payload.trust)
    && same(prev.source, payload.source)
    && same(prev.need, payload.need)
    && same(prev.from, payload.from)
    && same(prev.impl, payload.impl)
    && same(prev.policy, payload.policy);
}

/**
 * 本项目的维度全集——死规则判定要拿它穷举。
 *
 * layer 用 core 的封闭集合（全五层），不用「已有命题的层」：
 * 一条 `layer: impl` 的规则在项目还没走到 impl 时不算死，那只是还没到。
 * side/app/block 则从 config 取——限定了本项目没有的端的规则，在本项目里
 * 确实永远不会命中，与 `.claude/rules/` 投影跳过它是同一个判断、同一份口径。
 */
function projectDims(config = {}) {
  const apps = (config.apps ?? []).filter((a) => a && a.id);
  return {
    layers: [...LAYERS],
    sides: [...new Set(apps.map((a) => a.kind).filter(Boolean))],
    apps: apps.map((a) => a.id),
    blocks: [...(config.blocks ?? [])],
  };
}

export async function audit(ctx) {
  const mod = await mustLoad('audit', 'audit');
  // 死规则：判定在 assets/rules，注入给 audit 格式化。
  // 拿不到规则模块时**什么都不注入**——audit 会把 summary.rules 记成 null，
  // 也就是「这次没查」，而不是「查了，0 条」。
  const rulesMod = await optional('rules');
  let extra = {};
  if (rulesMod) {
    const rules = await rulesMod.loadRules(ASSETS_ROOT, ctx.root);
    extra = {
      deadRules: rulesMod.deadRules(rules, projectDims(ctx.config)),
      ruleCount: rules.length,
    };
  }
  const out = (await mod.audit({ ...ctx, ...extra })) ?? {};
  const findings = out.findings ?? [];
  const summary = out.summary ?? null;

  // ── 资产健康（供料侧）────────────────────────────────────────────────
  // 判定在 assets/registry.checkAssets（theme 存不存在的判据只能是 loadStyle 本身），
  // 这里只把结果变成 finding——与 deadRules 同一个注入模式，只是方向相反：
  // ops 不 import assets（兄弟层），所以格式化留在本层而不是塞给 ops/audit。
  //   theme 读不出 → error：形整个缺席，供料的一半没了，挡交付
  //   块读不出/缺层 → warn：还能半供，但必须被看见（半截块最会装成完整的）
  // registry 缺席时 summary.assets 记 null——「这次没查」不是「查了没问题」，
  // 口径同 summary.rules。
  const registry = await optional('registry');
  if (registry) {
    const assets = await registry.checkAssets(ASSETS_ROOT, ctx.config ?? {});
    if (assets.theme && !assets.theme.ok) {
      findings.push({
        kind: 'theme-missing', severity: 'error', subject: assets.theme.name,
        message: `登记的主题读不出来：${assets.theme.message}——供料的「形」整个缺席。vima theme set 换一个存在的皮`,
        detail: { code: assets.theme.code ?? null },
      });
    }
    for (const b of assets.blocks) {
      if (b.ok) continue;
      findings.push({
        kind: 'block-broken', severity: 'warn', subject: b.id,
        message: `登记的块读不出完整内容：${b.message ?? b.code}——vima next 供料会静默少这一块`,
        detail: { code: b.code ?? null, missing: b.missing },
      });
    }
    if (summary) summary.assets = assets;
  } else if (summary) {
    summary.assets = null;
  }

  // ── 资产锁漂移 ────────────────────────────────────────────────────────
  // 「装的资产已经不是取证时那一版」是一笔**对不上的账**，而 audit 就是对账那个动词。
  // 此前它只在 `sync --check` 里可见——但那条命令的语义是「派生投影对不对」，
  // 人不会为了查证据可信度去跑它。放这里的理由：证据是照着某一版资产取的，
  // 资产换了而证据没换，那份「达标」就悬空了。
  //
  // 判定仍在 lock.checkLock（判据只有一处），这里只把结果变成 finding。
  // 不自动失效证据——那是 core/claims 的职责，在这儿动手就是第二条传播路径。
  const lockMod = await optional('lock');
  if (lockMod) {
    const lk = await lockMod.checkLock(ctx.root, ASSETS_ROOT, ctx.config ?? {});
    // 注意 `lk.drifted` 是**计数**不是数组——遍历它会静默什么都不做，
    // 而那正是「检查存在但从不报」的形状。要报的是 entries 里非 ok 的那些。
    for (const e of (lk.entries ?? []).filter((x) => x.status !== 'ok')) {
      findings.push({
        kind: 'asset-drift', severity: 'warn', subject: e.id,
        message: e.status === 'unreadable'
          ? `锁里记了它，但现在读不出来（${e.why ?? ''}）——**这是没查，不是没问题**`
          : e.status === 'orphan'
            ? `锁里有它、config 里没有——两份记录互相矛盾，跑 \`vima block list\` 对一遍`
            : `内容已与锁里记的那一版不同（${e.why ?? ''}）——照着旧版取的证据现在悬空了。`
              + '跑 `vima block upgrade --check` 看影响面，确认后重新 submit',
        detail: { status: e.status, locked: e.locked, actual: e.actual },
      });
    }
    if (summary) summary.assetLock = { drifted: lk.drifted, unlocked: lk.unlocked ?? [] };
  } else if (summary) {
    summary.assetLock = null;
  }

  const errors = findings.filter((f) => f.severity === 'error').length;
  const warns = findings.filter((f) => f.severity === 'warn').length;
  // 合并后的计数要写回 summary——否则 --json 消费者会看到 ok:true 与 errors>0 并存
  if (summary?.counts) {
    summary.counts = { error: errors, warn: warns };
    summary.ok = errors === 0;
  }
  return { findings, summary, errors, warns };
}

/** 起 Web 观测平台。host 由 web 自己钉死在回环——这里不提供覆盖，按需起不是对外服务。 */
export async function ui(ctx, { port } = {}) {
  const mod = await mustLoad('web', 'ui');
  const fn = mod.serve ?? mod.start ?? mod.default;
  if (typeof fn !== 'function') {
    throw new FrontError('NOT_IMPLEMENTED', 'lib/front/web.mjs 未导出 serve / start / default，起不来', { exit: EXIT.NOT_IMPLEMENTED });
  }
  return fn({ root: ctx.root, ...(Number.isFinite(port) ? { port } : {}) });
}

// ── 杂项 ──────────────────────────────────────────────────────────────────

function notFound(claimId) {
  return new FrontError('NOT_FOUND', `命题 ${claimId} 不存在`, {
    exit: EXIT.NOT_FOUND,
    hint: 'vima next 看现在该做哪条；vima status 看整体。命题不存盘，它是事件流的投影——没编译过就没有。',
  });
}

/**
 * 影响面归一。
 *
 * 形态必须跟 ops/compile 写出来的裁定一致（那边是命题 id 数组），观测平台又按
 * 「条数」排序。这里把人手输的三种写法收成同两种，**不新增第三种形态**——
 * 同一字段三种形状，排序的那一端迟早要为每种写一个分支，然后其中一个分支会写错。
 */
function normalizeBlast(v) {
  if (Array.isArray(v)) {
    const list = v.map((x) => String(x).trim()).filter(Boolean);
    return list.length ? list : null;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = str(v);
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split(/[,，|]/).map((x) => x.trim()).filter(Boolean);
  return parts.length > 1 ? parts : s;
}

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function toList(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(/[|,]/).map((x) => x.trim()).filter(Boolean);
  return [];
}

let cachedVersion = null;
export async function version() {
  if (cachedVersion) return cachedVersion;
  try {
    cachedVersion = JSON.parse(await readFile(path.join(PKG_ROOT, 'package.json'), 'utf8')).version ?? '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion;
}

// ── doctor（P1-3：区分 audit 与 doctor）─────────────────────────────────────

/**
 * 工具体检。**不是第二个 audit**：audit 回答「项目符不符合规格」，
 * doctor 回答「工具装对没有」——hook 会不会真触发、MCP 可不可达、
 * 投影有没有漂、版本兼不兼容。判据全在 lib/front/doctor.mjs。
 *
 * 两样东西从这里注入，而不是让 doctor.mjs 自己去拿：
 *   · checkProjection —— 投影漂移的判据只有 `sync --check` 一处真源，调它，不重写。
 *     它自己会在 claude.mjs 缺席时抛 NOT_IMPLEMENTED，doctor 那边接住报「没查」。
 *   · registry        —— 同 audit 的 optional 口径：缺席时该项报「没查」，
 *                        不是「查了没问题」。
 */
export async function doctor(ctx) {
  const { runDoctor } = await import('./doctor.mjs');
  return runDoctor({
    root: ctx.root,
    config: ctx.config ?? {},
    assetsRoot: ctx.assetsRoot ?? ASSETS_ROOT,
    pkgRoot: PKG_ROOT,
    checkProjection: () => sync({ root: ctx.root, config: ctx.config, check: true }),
    registry: await optional('registry'),
  });
}

// ── 边分型与派题判据（P0-9 + P0-4）─────────────────────────────────────────
//
// `from` 此前同时承担两件事，而这两件事的处置完全相反：
//
//   derivesFrom  这条陈述**来自**哪些上游陈述   → 追溯与变更影响，**不阻塞调度**
//   dependsOn    这个执行动作**必须等**什么     → 阻塞调度
//
// 混在一起的后果不是「不够精细」，是**项目永远开不了工**：
// 「降低登录失败率」这类 intent 要上线后的 observed 数据才可能达标；
// 若要求它先 meets 才允许做下游的 spec/contract/impl，那第一行代码就写不出来。
// 反过来，为了绕开这个死锁而让 Builder 在代码里标一行 `@vima intent-x`
// 把 intent 标绿，又把 intent 这一层的存在意义整个掏空。

/**
 * 会阻塞下游开工的上游层。
 *
 * 判据一句话：**这条上游是不是「必须先物理存在」的东西**。
 *   contract  接口/字段/错误码。它的典型证据是 schema/closure derived + 契约测试，
 *             写出来就能达标，不必等下游。下游按它编码 → 真依赖。
 *   impl      模块/符号。extract derived + 单测 executed，同样先于下游存在。
 * 其余三层都不阻塞：
 *   intent    目标与指标，常需上线后 observed。阻塞它 = 死锁（上面那段）。
 *   spec      用户可见行为，典型证据是验收测试/observed——那要等实现跑起来才有。
 *             要求 spec 先达标才准做 contract/impl，是另一个方向的同一个死锁。
 *   behavior  运行时真实表现，天然在实现之后，不可能成为开工前置。
 *
 * 这条规则**会在什么情况下推错**（必须写下来，否则下一个人只会看见结论）：
 *   ① 真正当「前置决策」用的 intent/spec —— 例如「先定用 A 方案还是 B 方案」
 *      被写成 intent。本规则不拦，Builder 可能照着未定的方向先做出来。
 *      缓解：blockedBy 之外仍原样返回 derivesFrom，人能看见上游没定；
 *      真要拦，正解是在 docs 里显式声明 dependsOn（见下一段），不是把 intent 改成阻塞层。
 *   ② need 被调成 observed 的 contract —— 那条 contract 要等线上数据才达标，
 *      于是下游被它永久阻塞。这时该改的是那条命题的 need，不是这里的层表。
 *   ③ 上游退休 —— meets 恒 false，下游被永久阻塞。这是**刻意**的：上游没了不等于
 *      上游满足了，那条下游需要的是人来修（它同时也已被标 stale），不是继续派工。
 *
 * 为什么不先做「docs 里显式声明 dependsOn」（P0-9 的方案 a）：那要动 ops/spec 的
 * 前置语法与 compile 的准入，是独立的一件事。**现在不为它预留抽象层**（YAGNI）——
 * 将来真加显式声明时，改的就是这一个函数：先读显式值、缺省再回落到本层表。
 */
export const BLOCKING_LAYERS = Object.freeze(['contract', 'impl']);

/**
 * 从 derivesFrom 推导执行依赖。上游不在图里 → 不算依赖（野生引用由 audit 报，不该卡住干活）。
 */
export function dependsOn(claim, claims) {
  return (claim.from ?? []).filter((id) => {
    const up = claims.get(id);
    return !!up && BLOCKING_LAYERS.includes(up.layer);
  });
}

/**
 * 「这条 claim 此刻能不能被派」——**全系统只有这一处判定**。
 *
 * next 用它挑题，claim 用它给出同一套 blockedBy/租约结论。两处各写一份的话，
 * 迟早出现「next 说能派、claim 说不能」，而两边都不会报错。
 *
 * leases 是 Map<claimId, lease>（含已过期的）；有效期在这里判，因为「过期算不算占着」
 * 也是派题判据的一部分，不能让调用方各自决定。
 */
export function dispatchState(claim, { claims, leases = new Map(), now }) {
  const deps = dependsOn(claim, claims);
  const blockedBy = deps.filter((id) => !meets(claims.get(id)));
  const held = leases.get(claim.id);
  const leasedBy = lease.isActive(held, now) ? held : null;
  return {
    id: claim.id,
    dependsOn: deps,
    blockedBy,
    leasedBy,
    dispatchable: blockedBy.length === 0 && !leasedBy,
  };
}
