// Claude Code 资产投影 —— 把 vima 的真源投影成 Claude Code 认的形态。
//
// ─────────────────────────────────────────────────────────────────────────
// 为什么有这个模块，以及它和 assets/rules.mjs 是不是打架
//
// `assets/rules.mjs` 的头注释论证过：**规则声明适用维度，不写 glob 路径**——
// 路径匹配回答的是「这个文件长什么样」，而任务问的是「我现在在做什么」。
// 那个论证成立，本模块不推翻它。
//
// 本模块加的是**第二个触发面**，补的是另一个洞：`vima next()` 的下发只在
// agent **主动来问**的时候发生。C1 的原话是「执行者会偷懒会自称完成」——
// 指望它每次动手前都先来问一句，正是我们不该做的假设。
//
//   vima next()          主动，按任务维度   —— 文件还不存在时就要遵守的约束
//   .claude/rules/paths: 被动，按文件 glob  —— 它没来问的时候规则仍然在场
//
// 两者互补，不能合并：只有前者会漏掉不问就开干的情形，只有后者说不清
// 「这一层/这个块」这类与文件无关的约束。
//
// ## 派生投影的纪律
//
// `.claude/rules/vima-*.md` 与 `.mcp.json` 是**派生产物**，性质等同 `.vima/index/`：
// 真源在别处（`.vima/rules/` + `assets/rules/`），投影可随时重建，手改必被冲掉。
// 所以：
//   · 文件名一律 `vima-` 前缀，且只删自己写的——人手写进 .claude/rules/ 的不碰
//   · 每份投影头部写明它是投影、真源在哪、别手改
//   · `sync --check` 能在不写盘的前提下报出漂移（CI 用）
// ─────────────────────────────────────────────────────────────────────────
import path from 'node:path';
import { readFile, readdir, unlink, mkdir } from 'node:fs/promises';
import { atomicWrite } from '../core/fsx.mjs';
import { loadRules } from '../assets/rules.mjs';

const RULES_DIR = ['.claude', 'rules'];
const MCP_REL = '.mcp.json';
/** 投影文件名前缀。删除时只认它——人手写的规则不归我们管。 */
export const PREFIX = 'vima-';

/**
 * 由规则的适用维度推出 `paths:` glob。
 *
 * 唯一真源在这里。三处口径必须一致，否则规则会「看起来限定了端、实际处处生效」：
 *   · `app.kind` 就是规则的 side 取值   —— 同 actions.next() 的 `side: only?.kind`
 *   · 端一律落 `apps/<id>/`             —— 同 ops/attest.codeDirs
 *   · 这里的推导
 *
 * → string[]  有 glob，规则按文件触发
 * → null      没限定端（只有 layer/block），无条件加载
 * → []        限定了端但一个都不存在 —— 调用方必须**跳过**它，见下
 */
export function rulePaths(applies = {}, apps = []) {
  const known = apps.filter((a) => a && typeof a.id === 'string' && a.id);
  let ids = null;

  if (applies.app) {
    const wanted = new Set(applies.app);
    ids = known.filter((a) => wanted.has(a.id)).map((a) => a.id);
  }
  if (applies.side) {
    const wanted = new Set(applies.side);
    const bySide = known.filter((a) => wanted.has(a.kind)).map((a) => a.id);
    ids = ids === null ? bySide : ids.filter((id) => bySide.includes(id));
  }

  if (ids === null) return null;
  return [...new Set(ids)].sort().map((id) => `apps/${id}/**/*`);
}

function render(rule, paths) {
  const head = paths === null
    ? []
    : ['---', 'paths:', ...paths.map((p) => `  - "${p}"`), '---', ''];
  const dims = Object.entries(rule.applies)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}=${v.join('|')}`);
  return [
    ...head,
    `<!-- 由 \`vima sync\` 生成的投影，**请勿手改**。`,
    `     真源：${rule.origin === 'builtin' ? `assets/rules/${rule.id}.md（内置）` : `.vima/rules/${rule.id}.md`}`,
    `     适用维度：${dims.length ? dims.join(' · ') : '（不限）'}`,
    `     改真源后重跑 \`vima sync\`；\`vima sync --check\` 会报漂移。 -->`,
    '',
    rule.text,
    '',
  ].join('\n');
}

/**
 * 把规则投影进 `.claude/rules/`。
 *
 * → { written:[rel], removed:[rel], unconditional:n, skipped:[{id, why}], files:Map }
 *   check 模式下不写盘，written/removed 表达的是「本该怎么改」。
 */
export async function syncRules(root, { assetsRoot, config = {}, check = false } = {}) {
  const rules = await loadRules(assetsRoot, root);
  const apps = config.apps ?? [];
  const dir = path.join(root, ...RULES_DIR);

  const files = new Map();
  const skipped = [];
  let unconditional = 0;

  for (const rule of rules) {
    const paths = rulePaths(rule.applies, apps);
    if (Array.isArray(paths) && paths.length === 0) {
      // 限定了端、但项目里一个匹配的端都没有。
      // **不能投影成无条件加载**——那会把「只在小程序生效」变成「处处生效」，
      // 正是 assets/rules.mjs 花大篇幅警告的那种静默扩面。跳过并报出来。
      // 「项目还没登记端」和「登记了但对不上」是两回事，别混成一句话：
      // 前者是新项目的正常状态（每次 init 都刷一屏才会训练人忽略提示），
      // 后者多半是规则里的 app/side 写错了，是真信号。
      const dims = [
        rule.applies.app && `app=${rule.applies.app.join('|')}`,
        rule.applies.side && `side=${rule.applies.side.join('|')}`,
      ].filter(Boolean).join(' ');
      skipped.push({
        id: rule.id,
        reason: apps.length === 0 ? 'no-apps' : 'no-match',
        why: apps.length === 0
          ? `限定了 ${dims}，而项目还没登记任何端`
          : `限定了 ${dims}，但项目登记的端（${apps.map((a) => `${a.id}:${a.kind}`).join(', ')}）里没有匹配的`,
      });
      continue;
    }
    if (paths === null) unconditional += 1;
    files.set(`${PREFIX}${rule.id}.md`, render(rule, paths));
  }

  // 只清理自己写过的。人手写进 .claude/rules/ 的文件不归我们管——
  // 派生投影删掉人写的东西，是这类机制被关掉的最快方式。
  let existing = [];
  try {
    existing = (await readdir(dir)).filter((f) => f.startsWith(PREFIX) && f.endsWith('.md'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const written = [];
  const removed = [];

  for (const [name, body] of files) {
    let old = null;
    try { old = await readFile(path.join(dir, name), 'utf8'); } catch { /* 新文件 */ }
    if (old === body) continue;
    written.push(name);
    if (!check) {
      await mkdir(dir, { recursive: true });
      await atomicWrite(path.join(dir, name), body);
    }
  }
  for (const name of existing) {
    if (files.has(name)) continue;
    removed.push(name);
    if (!check) await unlink(path.join(dir, name));
  }

  written.sort();
  removed.sort();
  return { written, removed, unconditional, skipped, total: files.size };
}

/**
 * `.mcp.json` 的内容。**这是项目级 MCP 配置的唯一真源**——
 * `vima mcp-install` 打印的那份也从这里来，不许各写一份。
 */
export function mcpConfig({ binPath }) {
  return { mcpServers: { vima: { command: 'node', args: [binPath, 'mcp'] } } };
}

/**
 * 写 `.mcp.json`（项目级 MCP，进版本控制，全队 clone 下来就有）。
 *
 * 官方项目级 scope 就是仓库根的这个文件，首次使用会弹一次批准。
 * 注意不要在 args 里用裸 `${CLAUDE_PROJECT_DIR}`——文档明写它在 .mcp.json 里
 * 需要默认值 `${CLAUDE_PROJECT_DIR:-.}`，我们干脆写绝对路径，绕开这个坑。
 */
export async function syncMcp(root, { binPath, check = false } = {}) {
  const file = path.join(root, MCP_REL);
  const body = `${JSON.stringify(mcpConfig({ binPath }), null, 2)}\n`;
  let old = null;
  try { old = await readFile(file, 'utf8'); } catch { /* 新文件 */ }
  if (old === body) return { path: MCP_REL, changed: false };
  if (!check) await atomicWrite(file, body);
  return { path: MCP_REL, changed: true };
}

/** 一次刷全部投影。init 调它，`vima sync` 调它，CI 用 `--check` 调它。 */
export async function sync(root, { assetsRoot, config, binPath, check = false } = {}) {
  const rules = await syncRules(root, { assetsRoot, config, check });
  const mcp = await syncMcp(root, { binPath, check });
  const drifted = rules.written.length + rules.removed.length + (mcp.changed ? 1 : 0);
  return { rules, mcp, drifted };
}
