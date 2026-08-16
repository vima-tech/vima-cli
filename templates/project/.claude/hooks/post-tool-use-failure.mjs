#!/usr/bin/env node
// PostToolUseFailure —— 工具跑红了也要进日志。
//
// PostToolUse 只在工具**成功后**触发。只挂它，等于日志里只留下漂亮的那一半：
// 编译失败、测试跑红、Edit 匹配不上——这些恰恰是「过程怎么走的」（R2 第三问）
// 信息量最大的部分，却一条都不在。这与 ops/attest「每次取证都记一条 run，
// 哪怕没取到」是同一条纪律，只是之前没贯彻到 hook 层。
//
// ## matcher 为什么比 PostToolUse 宽（Write|Edit|Bash）
//
// 成功侧只收 Write|Edit，是因为成功侧的价值是「文件变成什么样了」（sha256），
// 而 Bash 成功一次并不改变任何可指纹的东西。失败侧的价值恰好相反：
// 值钱的是**它为什么没成**，而这类信息绝大多数来自 Bash（跑测试、跑构建、跑迁移）。
// 用同一个 matcher 会把最该记的那类失败整类漏掉——口径「一致」但目的不一致。
//
// 这个 hook 只观测：不注入上下文，不改变任何流程。**永不 exit 2**——
// 在这个事件上 exit 2 会把 stderr 再喊给 Claude 一遍，而失败本身工具已经报给它了。
// 内部异常照 _lib 的规矩 exit 1（非阻塞、用户看得见），不静默吞。
import path from 'node:path';
import { loadCore, run } from './_lib.mjs';

const MAX_ERROR_CHARS = 600;
const MAX_TARGET_CHARS = 200;

/**
 * 捞错误文本。文档给的是顶层 `error`（Bash 首行是 `Exit code N`，其后是输出）；
 * 后面几个候选是防御性的——这个字段名换过一次，换了不会报错，只会静默变成 null。
 * 捞不到返回 null，不编造「未知错误」凑格式。
 */
function errorText(input) {
  const cands = [
    input?.error,
    input?.tool_error,
    input?.tool_result?.error,
    input?.tool_response?.error,
    typeof input?.tool_response === 'string' ? input.tool_response : null,
  ];
  for (const c of cands) {
    if (typeof c === 'string' && c.trim() !== '') return c;
  }
  return null;
}

function clip(text, max) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  return { text: t.slice(0, max), truncated: t.length > max };
}

run('post-tool-use-failure', 'PostToolUseFailure', async (input) => {
  const core = await loadCore();
  const filePath = typeof input?.tool_input?.file_path === 'string' ? input.tool_input.file_path : null;
  // 定位口径与 post-tool-use 一致：被写文件优先，这样嵌套项目里失败也落对地方。
  const root = await core.project.resolveRoot({
    ...(filePath ? { filePath } : {}),
    env: process.env,
    cwd: input.cwd,
  });
  if (!root) return; // 不在 vima 项目里：正常情况，不是失败

  let subject = null;
  if (filePath) {
    const rel = path.relative(root, path.resolve(filePath)).split(path.sep).join('/');
    subject = rel === '' || rel.startsWith('../') ? null : rel;
  }

  // 命令留个短摘要就够了：这条事件是索引，不是日志转储。
  // 要看全文去看转录——把整段 stderr 塞进 events.jsonl 会让投影越读越慢。
  const cmd = typeof input?.tool_input?.command === 'string' ? clip(input.tool_input.command, MAX_TARGET_CHARS) : null;
  const err = errorText(input);
  const clipped = err === null ? null : clip(err, MAX_ERROR_CHARS);

  await core.events.append(root, {
    kind: 'run',
    actor: input.agent_id ? `subagent:${input.agent_type ?? 'unknown'}` : 'agent:main',
    subject,
    payload: {
      op: 'tool-failed',
      tool: input.tool_name ?? null,
      sessionId: input.session_id ?? null,
      toolUseId: input.tool_use_id ?? null,
      ...(cmd ? { command: cmd.text, commandTruncated: cmd.truncated } : {}),
      // 中断 ≠ 失败：被打断的命令不该被回放成「这个 agent 又跑红了一次」。
      ...(input.is_interrupt === true ? { interrupt: true } : {}),
      // 环境没给错误文本时如实记 null + 一句原因，不写空串充数
      error: clipped?.text ?? null,
      errorTruncated: clipped?.truncated ?? false,
      ...(clipped ? {} : { errorNote: '本次失败没有可读的错误文本：环境未提供 error / tool_response' }),
    },
    ...(typeof input.duration_ms === 'number' ? { cost: { ms: input.duration_ms } } : {}),
  }, { now: new Date() });
});
