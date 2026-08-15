#!/usr/bin/env node
// go-autostart.mjs —— DEVELOPING 期自动开工（SessionStart hook）
//
// 补的缺口（增补项 A39 / D-A39-03；出自 sustain-v3 实证）：
//   A18 的 go-continue.mjs 是**续跑器，不是启动器**——它只在 `.vima/go-state.json`
//   已存在且 stopReason=in-progress 时才阻止停轮。于是「起」这一步没有任何自动化：
//   人不敲 /go，调度器就永远不启动。而会话并不会因此闲着，它会照着任务文件手写代码——
//   sustain-v3 实测 79 个源文件落盘、backend 93 个 .java、零份 builder 报告、
//   134 个任务 frontmatter 全 pending、go-state.json 从未生成，记账链路全程哑火，
//   并行度 8 的批次计划退化成单线程串行（约 34 秒/文件）。
//
// 本 hook 把「起」也自动化：只要会话开在 DEVELOPING 期的 Vima 项目里，
// 就把调度协议注入上下文，不依赖任何 slash command 被人记得敲。
//
// **注入而非执行**：hook 不能替 Agent 干活，它只把「现在该按 go.md 并发调度」
// 变成 Agent 一进会话就看得见的指令。调度正文仍以 `.claude/commands/go.md` 为唯一
// 真源——在这里复制一份必然与它漂移（同 skills/go/SKILL.md 的做法）。
//
// 放行优先（与 guard-shared / post-write / go-continue 同口径）：判据不成立、文件缺失、
// JSON 解析失败一律静默 exit 0。SessionStart 本就不能 block，硬失败只会让用户开不了工。
//
// 关闭：`VIMA_AUTOSTART=0`（与 post-write 的 VIMA_JOURNAL=0 同风格）。

import { readFileSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** 已有会话在跑调度的判定窗口：go-state.json 比这更新就认为有人在跑，本会话不插手。 */
const ACTIVE_WINDOW_MS = 10 * 60 * 1000;

const quiet = () => process.exit(0);

/** 与内核 findProjectRoot 同判据（`.vima/` 或 `docs/lifecycle.json`）——判据只能有一个真源。 */
function findProjectRoot(from) {
  let dir = path.resolve(from);
  for (;;) {
    for (const probe of ['.vima', path.join('docs', 'lifecycle.json')]) {
      try {
        statSync(path.join(dir, probe));
        return dir;
      } catch { /* 继续探下一个判据 */ }
    }
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/**
 * 数未完成任务：只取 frontmatter 的 status，读不出的按未完成计（宁可多报也不漏工）。
 *
 * 文件筛选必须与内核 `lib/model/tasks.mjs` 逐字一致（`.md` + 非 `_` 前缀 + 非 README.md）——
 * 判据只能有一个真源。初版漏了 README.md，于是 hook 报 135 个任务而 `vima status` 报 134，
 * 同一个仓库两个数字，读者无从判断谁对。
 */
function countUnfinished(root) {
  let total = 0;
  let unfinished = 0;
  let dir;
  try {
    dir = readdirSync(path.join(root, 'docs', 'tasks'));
  } catch {
    return { total: 0, unfinished: 0 };
  }
  for (const name of dir) {
    if (!name.endsWith('.md') || name.startsWith('_') || name === 'README.md') continue;
    total += 1;
    let status = null;
    try {
      const m = /^status:\s*(\S+)\s*$/m.exec(readFileSync(path.join(root, 'docs', 'tasks', name), 'utf8'));
      status = m ? m[1] : null;
    } catch { /* 读不出 → 按未完成计 */ }
    if (status !== 'done') unfinished += 1;
  }
  return { total, unfinished };
}

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  if (process.env.VIMA_AUTOSTART === '0') quiet();

  let input = {};
  try {
    input = JSON.parse(raw) || {};
  } catch { /* 无输入 / 非 JSON：仍按 cwd 继续判定 */ }

  // resume / compact 的会话已经带着上文，再注入一遍只会和既有进度打架。
  // source 缺失时按全新会话处理（保守方向是「注入」——漏注入等于回到没有自动开工）。
  const source = typeof input.source === 'string' ? input.source : 'startup';
  if (source !== 'startup' && source !== 'clear') quiet();

  const root = findProjectRoot(input.cwd || process.cwd());
  if (!root) quiet(); // 不在 Vima 项目里：本 hook 不适用

  let lifecycle;
  try {
    lifecycle = JSON.parse(readFileSync(path.join(root, 'docs', 'lifecycle.json'), 'utf8'));
  } catch {
    quiet(); // 未 init / 文件损坏 → 不猜阶段
  }
  if (lifecycle?.currentPhase !== 'DEVELOPING') quiet(); // 只在实现期开工

  const { total, unfinished } = countUnfinished(root);
  if (total === 0 || unfinished === 0) quiet(); // 没有可做的任务

  // 已有会话在跑调度 → 不插手。两个会话同时派发会竞写路由/菜单这类硬编码热文件。
  try {
    const st = statSync(path.join(root, '.vima', 'go-state.json'));
    if (Date.now() - st.mtimeMs < ACTIVE_WINDOW_MS) quiet();
  } catch { /* 不存在 = 没人在跑，正是本 hook 要处理的情形 */ }

  const context = [
    `【Vima 自动开工】本项目处于 DEVELOPING 阶段，${total} 个任务中 ${unfinished} 个未完成，`,
    '且当前没有其他会话在跑调度（.vima/go-state.json 不存在或已过期）。',
    '',
    '请**立即按批次并发调度**开始实现，不要等用户再输入 /go，也不要自己按任务文件手写代码：',
    '',
    `1. 完整读取 ${path.join(root, '.claude', 'commands', 'go.md')}——它是调度协议的唯一正文，`,
    '   严格执行其中的阶段分派、Builder → Verifier、断点续跑、会话预算与合法停点规则。',
    '2. 按 .vima/reports/batch-plan.json 的批次与并行度派发 vima-builder 子代理，',
    '   **同一批次的任务必须在同一条消息里并发派发**（串行手写会把并行度退化成 1）。',
    '3. 每个任务完成后写 `.vima/reports/<taskId>-<builder|verifier>.json` 报告——',
    '   post-write hook 据此采集 journal 轨迹事件，这是 `vima status` 里「有轨迹/已验收」',
    '   两档的唯一来源。不写报告 = 进度永远显示 0，收口闸门无据可查。',
    '4. 每次结束回合前把停因写入 `.vima/go-state.json`（A18），否则批间续跑器无法工作。',
    '',
    '若用户本轮明确提出了别的任务，以用户的要求优先，本提示可忽略。',
    '（关闭自动开工：设环境变量 VIMA_AUTOSTART=0）',
  ].join('\n');

  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
  })}\n`);
  process.exit(0);
});
