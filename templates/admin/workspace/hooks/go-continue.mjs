#!/usr/bin/env node
// go-continue.mjs —— /go 批间续跑器（Stop hook）
//
// 机制（增补项 A18，契约 §6.12；推翻 A17「不用 Stop hook」的结论）：
//   A17 否决 Stop hook 的理由是「hook 无法区分合法停点与非法停顿，一刀切会击穿
//   合法停点」。该理由成立的前提是 hook 只能猜——**让主 Agent 把停因写成机读文件，
//   hook 就不必猜**：
//     - 主 Agent 每次结束回合前写 .vima/go-state.json（stopReason 取 A17 停点白名单）
//     - stopReason = in-progress（调度未完成的非法停顿）→ 阻止停轮并注入续跑指令
//     - stopReason ∈ {budget, terminal, gate, user} → 放行（合法停点）
//
// 放行优先（「防误不防恶意」，与 guard-shared / post-write 同口径）：
//   状态文件缺失 / JSON 解析失败 / 字段非法 / phase ≠ DEVELOPING / 状态文件早于本次
//   回合 / 连续续跑达上限 / stop_hook_active 已置位 —— 一律放行，绝不误伤非 /go 场景。
//   因此本 hook 在任何异常或版本不匹配下都退化为「今天的行为」，不会卡住会话。
//
// 输出契约：阻止停轮 = stdout 输出 {"decision":"block","reason":"…"} 且 exit 0。

import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';


/**
 * 项目根定位（多源回退）。**不能只用 cwd**：hook 进程的 cwd 是会话 cwd，
 * 它可能是项目的子目录（Agent `cd apps/admin` 之后写文件）、也可能是项目的父目录
 * （会话开在工作区根、项目建在子目录）。任一情形下按 cwd 解析都会算出错误的根，
 * 后果是 guard 形同虚设、journal 写去别处——而且**静默**，正是 A37 立项要治的那类失效。
 *
 * 优先级：
 *   1. 被写文件路径**向上**回溯（写入类 hook 最可靠的信号：文件在哪个项目里，就是哪个根，
 *      嵌套项目下这是唯一不会判错的来源）；
 *   2. `CLAUDE_PROJECT_DIR`（Claude Code 注入的会话项目根）——命中判据才采信；
 *   3. hook JSON 的 `cwd` 向上回溯；
 *   4. 进程 cwd 向上回溯。
 * 判据与内核 findProjectRoot 一致（`.vima/` 或 `docs/lifecycle.json`），判据只能有一个真源。
 * 全部落空 = 不在 Vima 项目里，返回 null 由调用方直接放行——hook 是「防误不防恶意」，
 * 拿 cwd 硬凑一个根会让 guard 去比对不存在的共享目录、journal 写进用户的任意目录。
 */
function findProjectRoot(from) {
  if (!from) return null;
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

function resolveRoot(input, filePath) {
  const env = process.env.CLAUDE_PROJECT_DIR;
  const candidates = [
    // 被写文件路径排第一：文件在哪个项目里，就按哪个项目判。嵌套项目场景
    // （会话根本身是 vima 项目、文件属于其中嵌套的另一个项目）下，env 先行会判到外层根，
    // guard 对内层共享层静默放行——这与 A40 要治的病是同一株。
    filePath ? findProjectRoot(path.dirname(path.resolve(filePath))) : null,
    env ? findProjectRoot(env) : null,
    input && input.cwd ? findProjectRoot(input.cwd) : null,
    findProjectRoot(process.cwd()),
  ];
  for (const c of candidates) {
    if (c) return c;
  }
  return null; // 四源都不在 Vima 项目里 → 由调用方退出，不拿 cwd 硬凑一个根
}

const MAX_CONSECUTIVE_RESUMES = 5; // 防死循环兜底（契约 §6.12）
const STALE_MS = 10 * 60 * 1000; // 状态文件早于 10 分钟视为上次会话遗留，不据以续跑

const allow = () => process.exit(0);

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    allow(); // 无输入 / 非 JSON：本 hook 不适用，放行
    return;
  }
  // Claude Code 已因本 hook 续跑过一次仍在停 → 放行，避免与内层循环叠加
  if (input && input.stop_hook_active === true) allow();

  const root = resolveRoot(input, null);
  if (!root) allow(); // 不在 Vima 项目里：不干预 Stop
  const statePath = path.join(root, '.vima', 'go-state.json');

  let state;
  try {
    const st = statSync(statePath);
    if (Date.now() - st.mtimeMs > STALE_MS) allow(); // 陈旧状态不驱动续跑
    state = JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    allow(); // 文件缺失或不可解析：非 /go 场景，放行
    return;
  }
  if (!state || typeof state !== 'object') allow();
  if (state.phase !== 'DEVELOPING') allow();
  if (state.stopReason !== 'in-progress') allow(); // budget/terminal/gate/user = 合法停点

  const resumes = Number.isInteger(state.consecutiveResumes) ? state.consecutiveResumes : 0;
  if (resumes >= MAX_CONSECUTIVE_RESUMES) {
    console.error(
      `/go 续跑器：已连续续跑 ${resumes} 次仍未达终态，放行本次停轮以免死循环。\n` +
        '请检查 .vima/reports/ 下最近的 builder/verifier 报告，确认调度是否卡在某个任务上。',
    );
    allow();
  }

  process.stdout.write(
    `${JSON.stringify({
      decision: 'block',
      reason:
        '批次调度尚未达终态（.vima/go-state.json 的 stopReason=in-progress）。'
        + '按 go.md「合法停点白名单」，批次完成 / 检查点提交受阻 / 补偿批插入都不是停点——'
        + '请继续派发下一批；同 level 的子批可流水线化派发（上一子批 Verifier 与下一子批 Builder 同轮）。'
        + '若确实到达合法停点（预算耗尽 / 全部终态 / 闸门阻断需用户裁定），'
        + '先把 .vima/go-state.json 的 stopReason 改成对应值（budget|terminal|gate|user）再结束回合；'
        + `每成功推进 ≥1 个任务后把 consecutiveResumes 归零（当前 ${resumes}，上限 ${MAX_CONSECUTIVE_RESUMES}）。`,
    })}\n`,
  );
  process.exit(0);
});
