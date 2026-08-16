// 编译 —— 上游命题 → 下游命题（intent → spec → contract → impl → behavior）。
//
// ─────────────────────────────────────────────────────────────────────────
// 这个模块只解决一件事：**让下游命题的出处可反查**。
//
// 「每处设计都应能反查到『这是哪条需求要的』，反查不到 = 未经授权的复杂度」——
// 这条纪律要成立，前提是每条下游命题都物理地带着它的上游。所以 `from` 不是
// 可选的元数据，是准入条件：说不出出处的命题**不予编译**，连事件都不产出。
// 上一代把这条留给人自觉（在 markdown 里写「对应需求 §N」），结果是文档里的
// 引用与实际实现两张皮，追溯链在最上游断掉。
//
// 第二件：`trust`（S 轴，来源可信度）必须显式给。
// 「来源可信但没实现」与「实现扎实但来源是份过期文档」是两种完全不同的风险，
// 默认一个 trust 等于替调用方隐瞒了其中一种。所以 trust 缺失 = 拒绝，
// 不像 `need` 那样有默认值（need 是门槛，漏了从严有 claims.mjs 的 'derived' 兜底；
// trust 是事实陈述，漏了没有「从严」的方向可兜）。
//
// 第三件：不写盘（C4 不阻塞 / 可预演）。
// 本模块只产出**事件草稿**（kind/actor/subject/payload），交给调用方决定是否
// 落进 events.append。这样才能干跑：把一批下游命题编出来先给人看，看完再写。
// 也因此 `now` 与事件 id 都不在这里生成——events.append 仍是唯一写入口，
// 时间戳仍由它按注入的 now 打，本模块从头到尾不碰时钟。
// ─────────────────────────────────────────────────────────────────────────
import { TRUST, STRENGTH, readAll } from '../core/events.mjs';
import { LAYERS, project } from '../core/claims.mjs';

/**
 * 命题 id 的合法形状。
 *
 * 不是随手定的：`core/extract.mjs` 的 `@vima <claimId>` 标注正则是
 * `[a-z0-9][a-z0-9-]*`。id 一旦不匹配它，这条命题就**永远**不可能被代码标注
 * 命中，也就永远拿不到 derived 及以上的证据——它从出生起就只能停在 claimed。
 * 与其让它在半年后表现为「这条怎么老是取不到证」，不如编译时当场拒。
 */
export const CLAIM_ID = /^[a-z0-9][a-z0-9-]*$/;

/** 裁定置信度。三档足够排序，再细分只会变成没人校准的数字。 */
export const CONFIDENCE = Object.freeze(['high', 'medium', 'low']);

/**
 * 编译一批下游命题。
 *
 * ctx   { root, config?, actor, claims? }
 *        claims 给了就用（干跑/测试），没给就从 root 的事件流现算。
 * input { upstream, layer, items }
 *        upstream —— 这批的默认上游（命题 id 或 id 数组）
 *        layer    —— 这批下游命题所在层
 *        items    —— [{ id, statement, trust, from?, source?, need?, impl?, ruling? }]
 *                     出处二选一，按层定：顶层（intent）必须给 source（物料出处），
 *                     其余层必须给 from（上游命题 id）。两者都缺 = 说不出出处 = 拒。
 *
 * → { events, claims, rejected }
 *   events   事件草稿数组，按「先裁定后命题」排好序，直接喂 events.append
 *   claims   本批被接受的下游命题（预览用，非投影）
 *   rejected [{ id, reasons }] —— 被拒的项与逐条理由
 *
 * 逐条拒而不是整批拒：一条命题说不出出处，不该让同批另外九条返工。
 * 调用方看见 rejected 非空自己决定要不要写——这个决定权本来就在它那儿。
 */
export async function compile(ctx = {}, input = {}) {
  const actor = requireActor(ctx);
  const layer = input.layer;
  if (!LAYERS.includes(layer)) {
    // 层写错是调用方的编程错误，不是数据问题——抛，别混进 rejected 里让人当数据看。
    throw new Error(`未知命题层 ${layer}（合法：${LAYERS.join(' → ')}）`);
  }
  const known = await knownClaims(ctx);
  const batchUpstream = toArray(input.upstream);
  const items = toArray(input.items);

  const events = [];
  const claims = [];
  const rejected = [];
  const seen = new Set();

  for (const item of items) {
    const reasons = [];
    const id = item?.id;

    if (typeof id !== 'string' || !CLAIM_ID.test(id)) {
      reasons.push(`命题 id 必须匹配 ${CLAIM_ID}——否则代码里的 @vima 标注永远命中不了它`);
    } else if (seen.has(id)) {
      reasons.push(`同一批里 id 重复：后一条会覆盖前一条，两条都失去意义`);
    }

    const statement = typeof item?.statement === 'string' ? item.statement.trim() : '';
    if (!statement) reasons.push('缺 statement：没有陈述的命题无从判断做没做到');

    // ── 硬规则一：出处 ────────────────────────────────────────────────
    // 纪律只有一条：**说不出出处的命题不予编译。** 但「出处」在最顶层与其它层
    // 是两种东西，这一点不能含糊：
    //
    //   顶层（intent）—— 上面没有命题了，出处只能是**物料**：会议纪要、聊天记录、
    //                    旧文档、一张截图。写进 source。
    //   其它层        —— 出处是上游命题，写进 from，且必须已在事件流里。
    //
    // 早先只认 from，于是顶层命题无论怎么填都被拒（from 空 → 缺 from；from 非空 →
    // 上游不在 intent 之上）。后果不是「少个功能」，是**全新项目的第一条命题编不进去**，
    // 整条链路从零起步这件事根本走不通——而 R1 的原话是「起点大概率什么都没有」。
    // 那次是端到端冒烟第一次真跑时暴露的：165 个单元测试全绿，没有一条走过空项目。
    const isTop = LAYERS.indexOf(layer) === 0;
    const source = typeof item?.source === 'string' ? item.source.trim() : '';
    const from = isTop
      ? []
      : toArray(item?.from ?? batchUpstream).filter((x) => typeof x === 'string' && x);

    if (isTop) {
      // 顶层给了 from 多半是误解了模型，直说，别让它去猜「上游不在之上」是什么意思
      if (toArray(item?.from ?? batchUpstream).length > 0) {
        reasons.push(`${layer} 是最顶层，没有上游命题——物料出处写 source，不要写 from`);
      }
      if (!source) {
        reasons.push('缺 source：顶层命题的出处是物料（纪要/聊天/旧文档/截图），'
          + '说不出物料出处的意图 = AI 自己想出来的需求，不予编译');
      }
    } else {
      if (from.length === 0) {
        reasons.push('缺 from：说不出出处的命题 = 未经授权的复杂度，不予编译');
      }
      for (const upId of from) {
        const up = known.get(upId);
        if (!up) {
          reasons.push(`上游 ${upId} 不在事件流里——出处必须是已存在的命题，不能是口头引用`);
          continue;
        }
        if (LAYERS.indexOf(up.layer) >= LAYERS.indexOf(layer)) {
          reasons.push(`上游 ${upId} 在 ${up.layer} 层，不在 ${layer} 之上——编译边只能自上而下`);
        }
      }
    }

    // ── 硬规则二：来源可信度 ──────────────────────────────────────────
    const ruling = item?.ruling ?? null;
    let trust = item?.trust;
    if (ruling) {
      // 带裁定的命题只能是 ruled。允许它自称 fact/stated 就是允许「AI 定的」
      // 伪装成「文档写的」——裁定台账立刻失去意义。
      if (trust != null && trust !== 'ruled') {
        reasons.push(`带 ruling 的命题 trust 只能是 'ruled'，给的是 '${trust}'`);
      }
      trust = 'ruled';
      checkRuling(ruling, reasons);
    }
    if (!TRUST.includes(trust)) {
      reasons.push(`缺 trust 或取值非法（合法：${TRUST.join(' > ')}）——来源可信度不可默认`);
    }

    // need 是门槛，可以缺省（claims.mjs 兜底 'derived'）；给了就必须合法。
    const need = item?.need;
    if (need != null && !STRENGTH.includes(need)) {
      reasons.push(`need 取值非法（合法：${STRENGTH.join(' < ')}）`);
    }

    if (reasons.length) {
      rejected.push({ id: typeof id === 'string' ? id : null, reasons });
      continue;
    }

    seen.add(id);

    // 裁定事件排在命题事件之前：回放时看到的顺序是「先定夺、后落命题」，
    // 与实际因果一致。倒过来会让台账看起来像事后补的。
    if (ruling) {
      events.push({
        kind: 'ruling',
        actor,
        subject: id,
        payload: {
          question: String(ruling.question).trim(),
          chosen: ruling.chosen,
          options: toArray(ruling.options),
          rationale: ruling.rationale ?? '',
          confidence: ruling.confidence,
          blastRadius: toArray(ruling.blastRadius),
        },
      });
    }

    const claim = {
      id,
      layer,
      statement,
      trust,
      source: source || null,
      need: need ?? 'derived',
      from,
      impl: toArray(item?.impl),
      // 这条命题的证据策略 id（`.vima/policies/<id>.json`）。声明了它，
      // submit 就只能触发那条预登记命令，换不了别的——`need: executed`
      // 想真的达标，必须走这里，因为现挑的命令产不出正式证据。
      policy: typeof item?.policy === 'string' && item.policy ? item.policy : null,
    };
    events.push({
      kind: 'claim',
      actor,
      subject: id,
      payload: {
        layer: claim.layer,
        statement: claim.statement,
        trust: claim.trust,
        source: claim.source,
        need: claim.need,
        from: claim.from,
        impl: claim.impl,
        policy: claim.policy,
      },
    });
    claims.push(claim);
  }

  return { events, claims, rejected };
}

/**
 * 裁定的准入检查。
 *
 * confidence 与 blastRadius 不是装饰：没有优先级的裁定台账会走向和「永远消不掉的
 * 告警」同一个结局——攒到三位数，人不看了，C4「先由 AI 定夺、人可二次裁决」的
 * 后半句就永远不会发生。所以两者缺一即拒，而不是像 claims.mjs 那样兜底成
 * 'unknown'/null（那层兜底是为了读旧事件不炸，不是给新事件开口子）。
 */
function checkRuling(r, reasons) {
  if (typeof r.question !== 'string' || !r.question.trim()) {
    reasons.push('ruling 缺 question：答不出「当时在定夺什么」的裁定无法二次裁决');
  }
  if (r.chosen == null || r.chosen === '') {
    reasons.push('ruling 缺 chosen：没有结论的不是裁定');
  }
  if (!CONFIDENCE.includes(r.confidence)) {
    reasons.push(`ruling 缺 confidence（合法：${CONFIDENCE.join(' / ')}）`);
  }
  const blast = toArray(r.blastRadius);
  if (blast.length === 0 || blast.some((x) => typeof x !== 'string' || !x)) {
    reasons.push('ruling 缺 blastRadius：说不出影响面的裁定无法排优先级（至少写它自己）');
  }
}

/** 现有命题图。给了 claims 就用（干跑/测试不必落盘），否则从事件流现算。 */
async function knownClaims(ctx) {
  if (ctx.claims instanceof Map) return ctx.claims;
  if (!ctx.root) throw new Error('compile 需要 ctx.root（从事件流读上游）或 ctx.claims（干跑时直接给）');
  const { events } = await readAll(ctx.root);
  return project(events).claims;
}

/** actor 在这里就查，不等 events.append 才炸——事件草稿在返回给调用方之前就该是完整的。 */
function requireActor(ctx) {
  if (typeof ctx.actor !== 'string' || ctx.actor === '') {
    throw new Error('compile 需要 ctx.actor——「谁编的」是 R2 第三问，不可缺');
  }
  return ctx.actor;
}

function toArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}
