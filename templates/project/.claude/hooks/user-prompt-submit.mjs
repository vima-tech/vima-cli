#!/usr/bin/env node
// UserPromptSubmit —— 每轮提问前注入当前前沿与待裁决项。
//
// 成本极低（一次 jsonl 读 + 一次投影）而在场权满格：不注入的话，
// 会话中段的 agent 会忘掉自己在哪一层、忘掉有条裁定还挂着，然后按记忆里的
// 旧状态继续干活。刷新的东西刻意压到两三行——每轮都出现的东西必须短。
//
// 只读、不写事件。**永不 exit 2**：exit 2 会把用户这条提问直接挡掉，那是否决。
import { fmtRuling, loadCore, run, status } from './_lib.mjs';

const MAX_RULINGS = 3;

run('user-prompt-submit', 'UserPromptSubmit', async (input) => {
  const core = await loadCore();
  const root = await core.project.resolveRoot({ env: process.env, cwd: input.cwd });
  if (!root) return;

  const s = await status(root, core);
  if (s.oversize) return; // 日志过大：这一轮什么都不注入，别为了刷状态拖慢每次提问

  const { stats, frontier, openRulings } = s;
  if (stats.total === 0 && openRulings.length === 0) return; // 空项目没什么可提醒的

  const lines = [
    `vima：命题 ${stats.met}/${stats.total} 达标`
      + (stats.stale ? ` · 失效 ${stats.stale}` : '')
      + (frontier ? ` · 前沿 ${frontier.layer}` : ''),
  ];
  if (openRulings.length) {
    lines.push(`待复核裁定 ${openRulings.length} 条：`);
    for (const r of openRulings.slice(0, MAX_RULINGS)) lines.push(fmtRuling(r));
  }
  return lines.join('\n');
});
