#!/usr/bin/env node
// SubagentStop —— 采集子代理的产出与耗用，并在它想空手走人时打回。
//
// ## 这个环境到底给了什么（2026-08-16 对 Claude Code 2.1.233 实测确认）
//
// 输入 JSON 的字段是：
//   session_id · transcript_path · cwd · permission_mode? · prompt_id?
//   hook_event_name:"SubagentStop" · stop_hook_active · agent_id · agent_type
//   agent_transcript_path · last_assistant_message? · background_tasks?
//
// **没有 tokens、没有 duration_ms、没有 cost。** 直接拿是拿不到的。
// 但 `agent_transcript_path` 指向子代理自己的 JSONL 转录，其中每条 assistant 记录
// 带 `message.usage`（input_tokens / output_tokens / cache_creation_input_tokens /
// cache_read_input_tokens）与 `timestamp`。于是成本是**可推导**的，不是可观测的：
//   tokens = 各轮 usage 求和            → 强度 derived
//   ms     = 最后一条 ts − 第一条 ts     → 墙钟跨度，含等待，不是纯推理耗时
//     （派工→收工的真实跨度要拿 subagent-start 那条事件的 ts 来配对算，见该文件）
//
// 读不到转录（路径缺失/权限/格式变了）时，写 `costSource:"unavailable"` 加一句原因，
// **绝不填 0**。填 0 会让对账表把「没测到」和「没花钱」混成同一格，这正是要治的病。
//
// ## 打回（C1 唯一的机械执行点）
//
// 「执行者会偷懒、会自称完成」这条约束，全系统只有这一处能机械地拦住——
// 就在它准备走人那一刻。同一份已经读进来的转录，再扫一遍它**认领过哪些命题**，
// 凡是认领了却没有达标证据的，原样打回并告诉它下一步跑什么。
//
// 还有一个洞，必须一起堵：**跳过 `vima claim` 就绕过了上面整段。**
// 一个 builder 只要不认领，扫出来就是零条，然后大摇大摆走人。所以第二条判据：
// **改了项目代码、却一条命题都没认领 → 同样打回。**
//
// 这不是扩面，是同一条约束的另一面：一处改动说不出它属于哪条命题，就是
// 「未经授权的复杂度」（C2 的原话）。出口留着——真属于任何命题都装不下的改动，
// 记一条裁定说明为什么，照样能走。有出口的闸门才活得下来。
//
// 排除三类写入，它们本来就不该先有命题：
//   docs/    规格真源本身（intake 的产物，命题是它的投影，先有它才有命题）
//   .vima/   事件与配置
//   .claude/ 会话资产
// 于是 vima-verifier 天然不受影响（它连 Write/Edit 都没有），intake 也不受影响。
//
// 三条边界（都不是可选项，缺一条这个 hook 就会被人关掉）：
//   1. **既没认领、也没改代码 → 不打回。** 只读子代理、纯查询的子代理都该放行。
//      把它们也拦下来，人第二天就会去 settings.json 里把这段删掉，
//      然后连采集一起没了——过严的闸门最终等于没有闸门。
//   2. **读不到转录 → 不打回**，但事件里记明「没法核」（claimScan:"unavailable"），
//      与 costSource 同一价值观：绝不把「没测到」写成「没问题」。
//   3. **stop_hook_active 为真 → 不再打回。** 它意味着这一轮本来就是被 hook 续出来的，
//      再打回就是死循环。此时照常记事件，并标 blockSuppressed 说明为什么放行。
//
// 打回与否，那条 run 事件**照记**：记账不能因为打回就丢，R2 要能回放「它被打回过几次」。
import { readFile } from 'node:fs/promises';
import { loadCore, run } from './_lib.mjs';

const MAX_REPORT_CHARS = 2000;
const MAX_UNMET_LISTED = 12;

/** 与 lib/ops/compile.mjs 的 CLAIM_ID 同形。这里是识别，准入判定仍在 compile。 */
const CLAIM_ID = /^[a-z0-9][a-z0-9-]*$/;
/** Bash 形态：`vima claim <id>`，容忍中间夹的旗标（`vima claim --actor=x a-b`）。 */
const BASH_CLAIM = /\bvima\s+claim\s+(?:--\S+\s+)*([a-z0-9][a-z0-9-]*)/g;
/** MCP 形态：工具名是 `mcp__vima__claim`，本地/改名装法可能只剩 `claim`。 */
const MCP_CLAIM = /(?:^|__)claim$/;

/** 写文件类工具。NotebookEdit 一并算上——它同样是在改产物。 */
const WRITE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit']);
/** 这些前缀下的写入不需要先有命题，理由见文件头。 */
const NO_CLAIM_NEEDED = ['docs/', '.vima/', '.claude/'];
const MAX_TOUCHED_LISTED = 8;

/** 从子代理转录推导耗用。推不出返回 null——宁可缺一格，不要一格假数。 */
function deriveCost(text) {
  let tokens = 0;
  let turns = 0;
  let sawUsage = false;
  let first = null;
  let last = null;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    const t = rec?.timestamp ? Date.parse(rec.timestamp) : NaN;
    if (Number.isFinite(t)) {
      if (first === null || t < first) first = t;
      if (last === null || t > last) last = t;
    }
    const u = rec?.message?.usage;
    if (!u) continue;
    sawUsage = true;
    turns += 1;
    tokens += (u.input_tokens ?? 0) + (u.output_tokens ?? 0)
      + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  }
  if (!sawUsage) return null;
  const cost = { tokens };
  if (first !== null && last !== null) cost.ms = last - first;
  return { cost, turns };
}

/**
 * 从同一份转录里扫出这个子代理认领过哪些命题。
 *
 * 两种形态都要扫：MCP 工具调用 `claim`（入参 claimId）、Bash 里的 `vima claim <id>`。
 * 只扫一种会让另一条路径变成免检通道——而 agent 用哪条路是它自己挑的。
 */
function scanClaims(text, root) {
  const ids = new Set();
  const touched = new Set();
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    const content = rec?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (b?.type !== 'tool_use') continue;
      const name = typeof b.name === 'string' ? b.name : '';
      if (MCP_CLAIM.test(name)) {
        const id = b.input?.claimId;
        if (typeof id === 'string' && CLAIM_ID.test(id)) ids.add(id);
      } else if (WRITE_TOOLS.has(name)) {
        const rel = projectRelative(b.input?.file_path ?? b.input?.notebook_path, root);
        if (rel && !NO_CLAIM_NEEDED.some((p) => rel.startsWith(p))) touched.add(rel);
      } else if (name === 'Bash') {
        const cmd = b.input?.command;
        if (typeof cmd !== 'string') continue;
        for (const m of cmd.matchAll(BASH_CLAIM)) ids.add(m[1]);
      }
    }
  }
  return { ids: [...ids], touched: [...touched].sort() };
}

/**
 * 绝对路径 → 项目内相对路径。落在项目外的一律不算——子代理去改别的仓库
 * 不是本项目的账，把它算进来会让 worktree 里的 builder 莫名其妙被拦。
 */
function projectRelative(file, root) {
  if (typeof file !== 'string' || file === '' || typeof root !== 'string') return null;
  const norm = (s) => s.replace(/\\/g, '/').replace(/\/+$/, '');
  const f = norm(file);
  const r = norm(root);
  if (f === r) return null;
  return f.startsWith(`${r}/`) ? f.slice(r.length + 1) : null;
}

/** 打回话术。列到 id、列到差在哪、列到下一条命令——「请完成工作」不是可执行的下一步。 */
function blockReason(unmet, touched) {
  // 两种打回情形都可能同时成立吗？不会——unclaimedWork 的前提是 claimed 为空，
  // 而 unmet 非空必然意味着认领过。分开写，各自给各自的下一步。
  if (unmet.length === 0) {
    const shown = touched.slice(0, MAX_TOUCHED_LISTED);
    const more = touched.length > shown.length ? [`- …还有 ${touched.length - shown.length} 个文件`] : [];
    return [
      `vima：你改了这 ${touched.length} 个文件，却一条命题都没认领——这些改动说不出它属于哪条需求。`,
      ...shown.map((p) => `- ${p}`),
      ...more,
      '正常做法：`vima next` 看该做哪条 → `vima claim <id>` 认领 → 改 → `vima submit <id>` 让系统取证。',
      '这些改动确实不属于任何命题的（临时排查、环境修补），记一条裁定说明为什么：',
      '  vima rule --question="这批改动属于哪条命题" --chosen="不属于任何命题" --rationale=... --confidence=low --blast=...',
      '记下来就能走。不记的话，半年后没人说得清这几行是为什么改的。',
    ].join('\n');
  }
  const shown = unmet.slice(0, MAX_UNMET_LISTED);
  const lines = shown.map((u) => (u.stale
    ? `- ${u.id}：证据已失效（上游改过，当前 ${u.got}），要重新取证 → \`vima submit ${u.id}\``
    : `- ${u.id}：需要 ≥ ${u.need}，当前 ${u.got} → \`vima submit ${u.id}\``));
  if (unmet.length > shown.length) lines.push(`- …还有 ${unmet.length - shown.length} 条，\`vima status\` 看全量`);
  return [
    `vima：你认领了这 ${unmet.length} 条命题但它们还没有达标的证据，先补齐再收工。`,
    ...lines,
    'submit 只收命题 id：系统自己去取证、自己写证据事件，说「做完了」不入账。',
    '确实做不动的，记一条裁定说明为什么（vima rule --question=... --chosen=... --subject=<id>），别默默走人。',
  ].join('\n');
}

run('subagent-stop', 'SubagentStop', async (input) => {
  const core = await loadCore();
  const root = await core.project.resolveRoot({ env: process.env, cwd: input.cwd });
  if (!root) return;

  // ── 转录只读一次，成本与认领两件事共用同一份文本 ──────────────────────
  let text = null;
  let costSource = 'unavailable';
  let costNote = '本环境无成本数据：SubagentStop 未提供 agent_transcript_path';
  let claimScan = 'unavailable';
  let claimScanNote = '没法核认领：SubagentStop 未提供 agent_transcript_path（不是核过了）';
  const tp = input.agent_transcript_path;
  if (typeof tp === 'string' && tp !== '') {
    try {
      text = await readFile(tp, 'utf8');
    } catch (err) {
      const why = err?.code ?? err?.message ?? 'unknown';
      costNote = `本环境无成本数据：读不到子代理转录（${why}）`;
      claimScanNote = `没法核认领：读不到子代理转录（${why}）——不是核过了`;
    }
  }

  let derived = null;
  if (text !== null) {
    derived = deriveCost(text);
    if (derived) {
      costSource = 'transcript';
      costNote = null;
    } else {
      costNote = '本环境无成本数据：子代理转录里没有任何带 usage 的记录';
    }
    claimScan = 'scanned';
    claimScanNote = null;
  }

  // ── 认领了什么、达标没有 ────────────────────────────────────────────
  const scan = text === null ? { ids: [], touched: [] } : scanClaims(text, root);
  const claimed = scan.ids;
  const touched = scan.touched;
  const unmet = [];
  const unknown = [];
  if (claimed.length > 0) {
    const { events } = await core.events.readAll(root);
    const projected = core.claims.project(events);
    for (const id of claimed) {
      const c = projected.claims.get(id);
      if (!c) { unknown.push(id); continue; } // 认领了一条不存在的命题：核不了，交给 audit
      if (core.claims.meets(c)) continue;
      unmet.push({
        id,
        need: c.need,
        got: core.claims.best(c)?.strength ?? 'none',
        stale: c.stale,
      });
    }
  }

  // 改了项目代码却一条都没认领 → 也要打回，否则「不调 claim」就成了绕过闸门的门路。
  // 只在**确实扫过转录**时判：读不到转录时 touched 恒为空，那是「没法核」不是「没改」。
  const unclaimedWork = claimScan === 'scanned' && claimed.length === 0 && touched.length > 0;

  // stop_hook_active：这一轮本来就是 hook 续出来的，再打回就是死循环。
  const wouldBlock = unmet.length > 0 || unclaimedWork;
  const loopGuarded = wouldBlock && input.stop_hook_active === true;
  const blocked = wouldBlock && !loopGuarded;

  const said = typeof input.last_assistant_message === 'string'
    ? input.last_assistant_message.slice(0, MAX_REPORT_CHARS)
    : null;

  await core.events.append(root, {
    kind: 'run',
    actor: `subagent:${input.agent_type ?? 'unknown'}`,
    subject: input.agent_id ?? null,
    payload: {
      op: 'subagent',
      agentType: input.agent_type ?? null,
      sessionId: input.session_id ?? null,
      turns: derived?.turns ?? null,
      costSource,
      ...(costNote ? { costNote } : {}),
      claimScan,
      ...(claimScanNote ? { claimScanNote } : {}),
      claimed,
      ...(unknown.length ? { unknownClaims: unknown } : {}),
      blocked,
      ...(unmet.length ? { unmet } : {}),
      // 改了哪些需要出处的文件。即使没打回也记——R2 要能回放「谁动了什么」，
      // 而且这是日后核对「改动落点是否属于它认领的命题」的原料。
      ...(touched.length ? { touched } : {}),
      ...(unclaimedWork ? { unclaimedWork: true } : {}),
      // 因防死循环而放行时必须留痕：否则回放时「没打回」会被读成「没问题」。
      ...(loopGuarded ? { blockSuppressed: 'stop_hook_active' } : {}),
      // 子代理的收尾发言是**它自己说的**，不是事实。标 saidBy 存档，
      // 让下游一眼看出这是自称——投影不会拿它当证据，审计可以拿它对质。
      ...(said ? { report: { saidBy: 'subagent', text: said, truncated: said.length >= MAX_REPORT_CHARS } } : {}),
    },
    ...(derived ? { cost: derived.cost } : {}),
  }, { now: new Date() });

  // 打回走**顶层** decision:"block" + reason，不走 run() 的 additionalContext 通道。
  //
  // 形状按 Claude Code hooks 文档「Stop decision control」一节（同一节管 SubagentStop）：
  //   decision: "block"  阻止子代理停下；省略即放行。reason 在 block 时必填，
  //                      它会作为子代理的下一条指令送过去——所以 reason 必须可执行。
  //   hookSpecificOutput 在 Stop 族里只接受 additionalContext（非错误反馈），
  //                      没有 decision 字段；把 decision 塞进去等于什么都没做。
  // 这段写死在这里，是因为「打回」是 C1 唯一的机械执行点：形状写错不会报错，
  // 只会静默退化成「记了一笔然后放它走」——外部完全看不出闸门已经不在了。
  if (blocked) {
    process.stdout.write(`${JSON.stringify({
      decision: 'block',
      reason: blockReason(unmet, touched),
    })}\n`);
  }
});
