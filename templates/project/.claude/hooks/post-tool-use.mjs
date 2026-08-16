#!/usr/bin/env node
// PostToolUse（Write|Edit）—— 采集代码变更事件。
//
// 记的是**已经发生的事实**：「这个文件被改了，改完长这样（sha256）」。
// 不是「任务完成了」——那是断言，断言由 agent 调 submit 触发、由系统取证后才入账。
//
// 为什么不放 PreToolUse：那是否决点，C4 明确不阻塞。这里只看后视镜。
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { loadCore, run } from './_lib.mjs';

const MAX_DIGEST_BYTES = 4 * 1024 * 1024;

run('post-tool-use', 'PostToolUse', async (input) => {
  const filePath = input?.tool_input?.file_path;
  if (typeof filePath !== 'string' || filePath === '') return; // 不是文件写入，无事可记

  const core = await loadCore();
  // 定位只有一处真源：被写文件路径优先的四源回退（core/project.mjs）。
  // hook 装在外层项目、被写文件属于内层嵌套项目时，事件必须落到内层。
  const root = await core.project.resolveRoot({
    filePath,
    env: process.env,
    cwd: input.cwd,
  });
  if (!root) return; // 不在 vima 项目里：正常情况，不是失败

  const abs = path.resolve(filePath);
  const rel = path.relative(root, abs).split(path.sep).join('/');
  if (rel === '' || rel.startsWith('../')) return; // 文件不在这个项目内
  if (rel.startsWith('.vima/')) return;            // 别把自己写的事件日志再采集一遍

  let bytes = null;
  let digest = null;
  try {
    const st = await stat(abs);
    bytes = st.size;
    if (st.size <= MAX_DIGEST_BYTES) {
      digest = `sha256:${createHash('sha256').update(await readFile(abs)).digest('hex').slice(0, 32)}`;
    }
  } catch {
    // 工具刚写完文件却读不到（被后续步骤删了/权限变了）——如实记 null，不编造
  }

  await core.events.append(root, {
    kind: 'run',
    actor: input.agent_id ? `subagent:${input.agent_type ?? 'unknown'}` : 'agent:main',
    subject: rel,
    payload: {
      op: 'write',
      tool: input.tool_name ?? null,
      sessionId: input.session_id ?? null,
      toolUseId: input.tool_use_id ?? null,
      bytes,
      digest,
    },
    // 采集端读真实时钟是刻意的：这是「什么时候发生的」这件事实本身。
    // 消费端（投影/渲染/退出码）一律不得读时钟。
    ...(typeof input.duration_ms === 'number' ? { cost: { ms: input.duration_ms } } : {}),
  }, { now: new Date() });
});
