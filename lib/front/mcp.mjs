// MCP —— 给 agent 的门面。stdio 上的 JSON-RPC 2.0，用 node 内建实现，不引 SDK。
//
// 解决的需求：ARCHITECTURE front 层「MCP（给 agent）」+ 决定性纪律 1。
//
// ─────────────────────────────────────────────────────────────────────────
// 两条形状决定性的纪律，改这个文件前先读完：
//
// ① **agent 不能通过正式接口提交证据结论。**
//    （这是接口设计不是物理防篡改：挡 T1 自述通道，不挡 T2 直接改文件——
//     措辞边界见 ARCHITECTURE 决定性纪律 0，两句话不能混说。）
//    这里没有任何一个工具接受「我做完了 / 这条已实现 / 覆盖率 90%」这类断言。
//    submit 的入参只有 claimId：事件的「发生」由 agent 触发，事件的「内容」
//    由系统生成（系统自己去取证，自己写 evidence）。这条塌了，整套观测立刻
//    退化成自称——上一代实测过那个形状：43 个任务都写了「Service 层单元测试」
//    验收项，实际覆盖 0/58，而所有报告都是绿的。
//    推论：绕过工具直接改文件不被禁止，但那样没有事件、没有证据、进度不涨。
//    **不需要禁止绕过，绕过没有收益。**
//
// ② **工具刻意只有五个。** 不把 CLI 全量映射过来，理由有两条且都硬：
//    工具定义占用**每一次**请求的上下文；以及多一个门面就多一个真源。
//    init / compile / status / audit / ui 是人与 CI 的动作，不是 agent 的动作
//    ——尤其 compile：agent 若能自己造命题，就是自己给自己出题。
// ─────────────────────────────────────────────────────────────────────────
//
// 本模块同样是薄壳：所有判据在 lib/front/actions.mjs，与 CLI 共用同一份。
import readline from 'node:readline';

import * as A from './actions.mjs';
import { FrontError } from './actions.mjs';

/** 我们说得出口的协议版本，新 → 旧。客户端要的在表里就照它回，否则回最新。 */
export const PROTOCOL_VERSIONS = Object.freeze(['2025-06-18', '2025-03-26', '2024-11-05']);

const SERVER_NAME = 'vima';

/**
 * 五个工具。
 *
 * description 里最要紧的是**什么时候用它**——那是 agent 唯一的选择依据。
 * 只写「做什么」会让它在该调 next 的时候去调 ask。
 */
export const TOOLS = Object.freeze([
  {
    name: 'next',
    title: '下一步该做什么',
    description:
      '【什么时候用】不知道接下来做什么时；刚做完一件事要接下一件时；开工前对齐规则时。**动手写代码之前先调它。**\n'
      + '返回：task（下一条待办命题，含它要求的证据强度）、rules（这条命题的适用规则）、assets（按层裁剪的供料）、\n'
      + 'context（主题 / 端 / 已装块）、progress，以及三个与调度有关的字段：\n'
      + '  derivesFrom —— 这条陈述**来自**哪些上游陈述。追溯用，**不阻塞你开工**。\n'
      + '  dependsOn / blockedBy —— 必须先存在的 contract/impl，以及其中还没达标的那些。这些才是真阻塞。\n'
      + '  leased —— 此刻被别的执行者占着的候选（不会派给你）。\n'
      + '规则不是建议，是这条命题的验收面——不照着写，submit 时系统取证会当场发现。\n'
      + '选择判据在系统这边：未达标的按层序排，执行依赖已达标的优先，失效的会重新进候选，'
      + '被未过期租约占着的不派。你不需要自己挑，也不需要担心和别的执行者撞题。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'claim',
    title: '认领一条命题',
    description:
      '【什么时候用】开始动手做某条命题之前，声明你在做它。\n'
      + '它只记录「谁、什么时候、开始做哪条」，**不改变命题状态，也不代表做完**。\n'
      + '跳过它不会被拦，但过程与成本就没人记得住（谁做的、花了多久，事后答不出来）。',
    inputSchema: {
      type: 'object',
      properties: { claimId: { type: 'string', description: 'vima next 给出的命题 id' } },
      required: ['claimId'],
      additionalProperties: false,
    },
  },
  {
    name: 'submit',
    title: '交活（系统自己取证）',
    description:
      '【什么时候用】你认为某条命题做完了的时候。\n'
      + '**它不接受「我做完了」这类断言，入参只有 claimId。** 系统会自己去取证（跑检查、扫代码、比对契约），'
      + '自己写证据事件——你说什么不影响结果。\n'
      + '返回是否达标；不达标会告诉你差在哪（要求的强度 vs 实际取到的强度、以及取证为什么没成），修完再调一次。\n'
      + '连取证方式也不由你定：能指定「跑哪条命令」就等于能用一条永远返回 0 的命令换一份绿证据。',
    inputSchema: {
      type: 'object',
      properties: {
        claimId: { type: 'string', description: '要交的命题 id' },
      },
      required: ['claimId'],
      additionalProperties: false,
    },
  },
  {
    name: 'rule',
    title: '记一条裁定',
    description:
      '【什么时候用】规格没说清、需要拍板才能往下走的时候——**记一条裁定然后继续做，不要停下来等人**。\n'
      + '记录：拿不准的是什么、有哪些选项、你定了哪个、为什么、置信度、以及定错了会波及什么。\n'
      + 'confidence 与 blastRadius 必填：它们决定人事后先看哪条。没有优先级的裁定台账会走向和'
      + '「永远消不掉的告警」同一个结局——人不看了，于是等于没记。\n'
      + '人可以在观测平台上二次裁决，走的是同一条失效传播链路，你不用为回滚做任何准备。',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: '拿不准的到底是什么' },
        chosen: { type: 'string', description: '你定了哪个' },
        options: { type: 'array', items: { type: 'string' }, description: '还有哪些选项被考虑过' },
        rationale: { type: 'string', description: '为什么这么定' },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'], description: '这条你有多大把握' },
        blastRadius: {
          type: 'string',
          description: '定错了会波及什么。优先给受影响的命题 id，逗号分隔（如 "s-1,s-2"）；'
            + '说不出具体是哪些就给条数（如 "3"）。观测平台按这个排序，一句笼统的话会被当成「未声明」排到最前。',
        },
        subject: { type: 'string', description: '可选：这条裁定挂在哪条命题上' },
      },
      required: ['question', 'chosen', 'confidence', 'blastRadius'],
      additionalProperties: false,
    },
  },
  {
    name: 'ask',
    title: '查一条命题',
    description:
      '【什么时候用】想知道某条命题现在什么状态、有哪些证据、上下游是谁、被哪些裁定影响过。只读，不写任何事件。\n'
      + '典型场景：next 告诉你上游没达标，你想看看上游卡在哪；或者 submit 没过，你想看已有证据到了哪一档。',
    inputSchema: {
      type: 'object',
      properties: { claimId: { type: 'string' } },
      required: ['claimId'],
      additionalProperties: false,
    },
  },
]);

const TOOL_NAMES = new Set(TOOLS.map((t) => t.name));

// ── 工具实现：一律转发给 actions，本文件不含任何判据 ───────────────────────

async function runTool(name, args, session) {
  const ctx = await A.makeCtx({ cwd: session.cwd, env: session.env, now: session.now?.(), actor: session.actor });
  switch (name) {
    case 'next': return A.next(ctx);
    case 'claim': return A.claimTask(ctx, req(args, 'claimId'));
    // 只传 claimId：取证方式由系统定（默认 derived）。CLI 那边人与 CI 可以给
    // executed + cmd，agent 不行——那等于让被考的人自己出卷子。
    case 'submit': return A.submit(ctx, req(args, 'claimId'));
    case 'rule': return A.rule(ctx, args ?? {});
    case 'ask': return A.ask(ctx, req(args, 'claimId'));
    default: throw new FrontError('USAGE', `未知工具 ${name}`, { exit: A.EXIT.USAGE });
  }
}

function req(args, key) {
  const v = args?.[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new FrontError('USAGE', `缺少参数 ${key}`, { exit: A.EXIT.USAGE });
  }
  return v.trim();
}

// ── JSON-RPC 2.0 ──────────────────────────────────────────────────────────

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

function ok(id, result) {
  return { jsonrpc: '2.0', id, result };
}
function fail(id, code, message, data) {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } };
}

/**
 * 造一个消息处理器。返回值为 null 表示「这是通知，不回」。
 * 单独导出是为了可测：三个 JSON-RPC 往返不必真起进程就能断言。
 */
export function createHandler({ cwd = process.cwd(), env = process.env, now, version = null } = {}) {
  const session = { cwd, env, now, actor: 'agent', initialized: false };

  return async function handle(msg) {
    if (Array.isArray(msg)) {
      const out = [];
      for (const m of msg) {
        const r = await handle(m);
        if (r) out.push(r);
      }
      return out.length ? out : null;
    }
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      return fail(msg?.id ?? null, INVALID_REQUEST, 'JSON-RPC 2.0 请求格式不对（需要 jsonrpc:"2.0" 与 method）');
    }
    const isNotification = msg.id === undefined || msg.id === null;
    const { id, method, params } = msg;

    try {
      switch (method) {
        case 'initialize': {
          const want = params?.protocolVersion;
          const clientName = params?.clientInfo?.name;
          if (typeof clientName === 'string' && clientName) session.actor = `agent/${clientName}`;
          session.initialized = true;
          return ok(id, {
            protocolVersion: PROTOCOL_VERSIONS.includes(want) ? want : PROTOCOL_VERSIONS[0],
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: SERVER_NAME, version: version ?? await A.version() },
            // 这段是**运行时真发给 agent** 的文案，口径以 ARCHITECTURE 决定性纪律 0
            // 的威胁模型表为准。这里曾经是已废口径「你不能写事件」——读者当场能证伪的话：
            // 拥有 Write/Bash 的 agent 物理上改得了 events.jsonl。对一个看得穿的读者
            // 说一句做不到的承诺，会把同一段里那句**真成立**的「绕过没有收益」一起贬值，
            // 而后者才是整个设计真正指望它自觉遵守的部分。
            // （文件头注释先改的口径，这段漏了整整一轮——所以现在有机检，见 z.seams。）
            instructions:
              'vima 记录「做了什么、凭什么算做到了」。工作节奏：next → claim → 干活 → submit。\n'
              + '你不能通过正式接口提交证据结论，只能触发取证：submit 只收 claimId，证据由系统自己去取。'
              + '自称「做完了」不会让进度涨一分，绕过工具直接改文件也不会——绕过没有收益。\n'
              + '规格没说清就调 rule 记一条裁定然后继续，不要停下来等人。',
          });
        }

        case 'notifications/initialized':
        case 'notifications/cancelled':
        case 'notifications/progress':
          return null;

        case 'ping':
          return isNotification ? null : ok(id, {});

        case 'tools/list':
          return ok(id, { tools: TOOLS });

        case 'tools/call': {
          const name = params?.name;
          if (!TOOL_NAMES.has(name)) {
            return fail(id, INVALID_PARAMS, `没有名为 ${name} 的工具（可用：${[...TOOL_NAMES].join(' · ')}）`);
          }
          // 工具执行失败按 MCP 约定回 isError:true 的 result，而不是协议级错误：
          // 「不在项目里」「模块尚未实现」「命题不存在」都是 agent 需要读到并据此
          // 改变行为的信息，塞进协议错误会被大多数客户端吞成一句「工具调用失败」。
          try {
            const data = await runTool(name, params?.arguments ?? {}, session);
            return ok(id, {
              content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
              structuredContent: data,
              isError: false,
            });
          } catch (e) {
            const text = e instanceof FrontError
              ? `${e.code}: ${e.message}${e.hint ? `\n  → ${e.hint}` : ''}`
              : `INTERNAL: ${e?.message ?? e}`;
            return ok(id, { content: [{ type: 'text', text }], isError: true });
          }
        }

        // 没实现的能力如实回 method not found，不假装支持
        default:
          return isNotification ? null : fail(id, METHOD_NOT_FOUND, `不支持的方法 ${method}`);
      }
    } catch (e) {
      if (isNotification) return null;
      return fail(id, INTERNAL_ERROR, e?.message ?? String(e));
    }
  };
}

/**
 * 在 stdio 上跑服务。MCP 的 stdio 传输是**按行分隔的 JSON**（不是 LSP 的
 * Content-Length 分帧），一条消息一行，行内不得有裸换行。
 *
 * stdout 只允许出现 JSON-RPC 消息——任何一句多余的打印都会让客户端解析失败。
 * 诊断一律走 stderr。
 */
export async function serve({ cwd = process.cwd(), env = process.env, input = process.stdin, output = process.stdout, errorOutput = process.stderr, now } = {}) {
  const handle = createHandler({ cwd, env, now });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  // 串行处理：事件是 append-only 的单一写入口，并发写会把两条记录交织到一行。
  let chain = Promise.resolve();

  const send = (msg) => {
    if (msg) output.write(`${JSON.stringify(msg)}\n`);
  };

  rl.on('line', (line) => {
    const text = line.trim();
    if (!text) return;
    chain = chain.then(async () => {
      let msg;
      try {
        msg = JSON.parse(text);
      } catch {
        send(fail(null, PARSE_ERROR, 'JSON 解析失败'));
        return;
      }
      try {
        send(await handle(msg));
      } catch (e) {
        errorOutput.write(`vima mcp: ${e?.stack ?? e}\n`);
        send(fail(msg?.id ?? null, INTERNAL_ERROR, e?.message ?? String(e)));
      }
    });
  });

  await new Promise((resolve) => rl.once('close', resolve));
  await chain;
}
