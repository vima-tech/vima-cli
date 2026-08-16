#!/usr/bin/env node
// SubagentStart —— 记「派工」这个事实。
//
// 它单看没什么信息量，价值全在**与 SubagentStop 配对**：
//   真实墙钟 = Stop 事件的 ts − Start 事件的 ts（同一个 agent_id）
//   并行度   = 任一时刻「已 Start 未 Stop」的 agent_id 个数
//
// 为什么非记不可：SubagentStop 那边推导出来的 ms 是**子代理转录的首末时间戳之差**,
// 那是它自己的记录跨度——派工前的排队、收工后的收尾都不在里面。
// 没有 Start 这一半，「派一批子代理到底省了多少时间」（R5）只能靠猜。
//
// 与 Stop 同款纪律：这里只记事实，不做判断，不阻塞。
import { loadCore, run } from './_lib.mjs';

run('subagent-start', 'SubagentStart', async (input) => {
  const core = await loadCore();
  const root = await core.project.resolveRoot({ env: process.env, cwd: input.cwd });
  if (!root) return; // 不在 vima 项目里：正常情况，不是失败

  await core.events.append(root, {
    kind: 'run',
    // actor / subject 与 SubagentStop 逐字同形，配对全靠这两个字段对得上。
    // 改一处不改另一处 = 配不上 = 墙钟算不出来，且外部完全看不出来。
    actor: `subagent:${input.agent_type ?? 'unknown'}`,
    subject: input.agent_id ?? null,
    payload: {
      op: 'subagent-start',
      agentType: input.agent_type ?? null,
      sessionId: input.session_id ?? null,
    },
    // 刻意不写 cost：派工那一刻还没有任何耗用。写 { ms: 0 } 会被聚合成「花了 0」，
    // 与 Stop 那边「拿不到就不填」是同一条纪律。
  }, { now: new Date() });
});
