#!/usr/bin/env node
// SessionStart —— 注入当前项目状态。
//
// 买的是**在场权**：会话第一句话之前就知道「我在哪个项目、这个项目做到哪了、
// 有哪些是 AI 替人定的还没复核」。不注入的话，agent 每次都得先花几轮工具调用
// 把这些问出来，而且经常不问就开干。
//
// 只读、不写事件。会话开始本身不是项目事实。
import { fmtRuling, loadCore, run, status } from './_lib.mjs';

const MAX_RULINGS = 5;

run('session-start', 'SessionStart', async (input) => {
  const core = await loadCore();
  const root = await core.project.resolveRoot({ env: process.env, cwd: input.cwd });
  if (!root) return; // 不是 vima 项目：不吭声，别在别人的会话里刷存在感

  const s = await status(root, core);
  if (s.oversize) {
    return `## vima\n项目根 ${root}\n事件日志 ${s.bytes} 字节，超过本 hook 的投影上限，本次不展开状态。运行 \`vima audit\` 查看。`;
  }

  const { config, stats, layers, frontier, openRulings } = s;
  const lines = [
    '## vima 项目状态',
    `根目录 ${root}`,
    `项目 ${config.name || '(未命名)'} · 皮 ${config.theme}`
      + ` · 端 ${config.apps.length ? config.apps.map((a) => a.id).join(',') : '无'}`
      + ` · 块 ${config.blocks.length}`,
    `命题 ${stats.met}/${stats.total} 达标 · 失效 ${stats.stale} · 无证据 ${stats.noEvidence}`,
    `分层 ${layers.map((l) => `${l.layer} ${l.met}/${l.total}`).join(' · ')}`,
    frontier
      ? `当前前沿 **${frontier.layer}**（${frontier.total} 条里 ${frontier.met} 条达标）`
      : (stats.total ? '全部命题已达标' : '尚无命题——先跑 `vima compile` 从 docs/ 编译'),
  ];

  if (openRulings.length) {
    lines.push(`待复核裁定 ${openRulings.length} 条${openRulings.length > MAX_RULINGS ? `（列前 ${MAX_RULINGS} 条）` : ''}：`);
    for (const r of openRulings.slice(0, MAX_RULINGS)) lines.push(fmtRuling(r));
  }

  lines.push(`事件 ${s.eventCount} 条${s.corrupt ? ` · 坏行 ${s.corrupt}（\`vima audit\` 会报出来）` : ''}`);
  return lines.join('\n');
});
