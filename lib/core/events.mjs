// 事件日志 —— 整个系统唯一的写入口（R2）。
//
// 一条纪律决定了这个模块的全部形状：**agent 不能通过正式接口提交证据结论**。
// 事件的「发生」由 agent 触发（它调 submit），事件的「内容」由系统生成
// （系统自己去取证，再自己写）。若 agent 能自己写「我做完了」，整套观测立刻
// 退化成自称——那正是上一代实测到的形状：43 个任务都写了「Service 层单元测试」
// 验收项而实际覆盖 0/58。
//
// 因此本模块只导出 `append`，且 append 的入参是**已经发生的事实**，不是意图。
// 没有 update、没有 delete：append-only 是过程可观测（R2 第三问）的前提，
// 原地改写会让「这条命题怎么走到现在这样」永远答不出来。
import { appendFile, readFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export const EVENTS_REL = '.vima/events.jsonl';

/**
 * 事件种类 —— 封闭集合。
 *
 * 刻意只有四种。R2 的五个问题各自需要什么，逐条对过：
 *   「这条做对了吗」        → claim + evidence
 *   「整体做到哪、能交付吗」 → claim/evidence 聚合，无需新种类
 *   「过程怎么走的、谁做的」 → 全部事件按时序回放；actor 字段答「谁」
 *   「花了多少」            → run 事件的 cost；不另设 cost 种类
 *   「哪些是 AI 替我定的」   → ruling
 * 加第五种之前先回答它对应哪一问——答不出就是镀金。
 */
export const KINDS = Object.freeze(['claim', 'evidence', 'ruling', 'run']);

/** 来源可信度（S 轴）：这条命题凭什么进来的。高 → 低。 */
export const TRUST = Object.freeze(['fact', 'superseded', 'stated', 'ruled']);

/** 验证强度（E 轴）：这条命题做到了没有。低 → 高。 */
export const STRENGTH = Object.freeze(['claimed', 'derived', 'executed', 'observed']);

/** 两轴正交：一条需求可以「来源可信但没实现」，也可以「实现扎实但来源是份过期文档」。 */
export function strengthRank(s) {
  const i = STRENGTH.indexOf(s);
  return i < 0 ? -1 : i;
}
export function trustRank(t) {
  const i = TRUST.indexOf(t);
  return i < 0 ? -1 : TRUST.length - 1 - i; // fact 最高
}

/** 稳定序列化：键排序，保证同一输入字节一致（投影可重建的前提）。 */
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
}

/**
 * 追加一条事件。
 *
 * `now` 由调用方注入而不是读系统时钟——同一输入必须产出同一结果，否则测试无法
 * 断言、投影无法比对。这条纪律从上一代继承，它当时换来了 --watch 的正确架构。
 */
export async function append(root, event, { now = new Date() } = {}) {
  if (!KINDS.includes(event.kind)) {
    throw new Error(`未知事件种类 ${event.kind}（合法：${KINDS.join(' / ')}）`);
  }
  if (typeof event.actor !== 'string' || event.actor === '') {
    throw new Error('事件必须记录 actor——「谁做的」是 R2 第三问，不可缺');
  }
  const rec = {
    id: event.id ?? randomUUID(),
    ts: (event.ts ?? now).toISOString?.() ?? String(event.ts ?? now),
    kind: event.kind,
    actor: event.actor,
    subject: event.subject ?? null,
    payload: event.payload ?? {},
    ...(event.cost ? { cost: event.cost } : {}),
  };
  const file = path.join(root, ...EVENTS_REL.split('/'));
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${stable(rec)}\n`, 'utf8');
  return rec;
}

/** 读全部事件。坏行跳过不抛——一条写坏的记录不该让整个观测面打不开。 */
export async function readAll(root) {
  const file = path.join(root, ...EVENTS_REL.split('/'));
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { events: [], corrupt: 0 };
    throw err;
  }
  const events = [];
  let corrupt = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    try {
      const rec = JSON.parse(line);
      if (KINDS.includes(rec?.kind)) events.push(rec);
      else corrupt += 1;
    } catch {
      corrupt += 1;
    }
  }
  return { events, corrupt };
}

// 这里曾有一个 fingerprint(events)（给「投影缓存判新鲜度」用），全仓零调用。
// 删掉：反查不到需求的导出就是「块定义了没人消费」——将来真做 .vima/index/
// 缓存时再写，那时它会和消费方一起落地，而不是先躺在这儿等人记得。
