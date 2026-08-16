// 命题投影 —— 从事件流算出「现在每条命题是什么状态」。
//
// 命题不存盘。它是事件流的投影，可随时重建（C3：任何索引都是派生物，
// 不得反过来当真源）。这条不是洁癖——上一代把事实散在五处（代码标注/契约/
// frontmatter/两份报告/journal），join 靠人脑，结果「进度为什么是 0」被拖了
// 一整个开发期。
import { strengthRank, trustRank, STRENGTH } from './events.mjs';

/** 命题分层。上游 → 下游，编译边只能顺着这个方向连。 */
export const LAYERS = Object.freeze(['intent', 'spec', 'contract', 'impl', 'behavior']);

/**
 * 把事件流投影成命题图。
 *
 * 返回 { claims, rulings, runs, stats }：
 *   claims  Map<id, Claim>   —— 每条命题的当前状态
 *   rulings Array            —— 裁定台账（R2 第五问）
 *   runs    Array            —— agent 行为与成本（R2 第三、四问）
 */
export function project(events) {
  const claims = new Map();
  const rulings = [];
  const runs = [];

  const rulingById = new Map();
  for (const e of events) {
    switch (e.kind) {
      case 'claim':
        // 退休不是第五种事件，是 claim 事件的一个语义：payload.retired 为真时
        // 这条命题退出活动集。事件照旧 append-only 留在流里，历史可回放；
        // 投影里保留壳（retired:true），让下游能看见「我的上游没了」。
        if ((e.payload ?? {}).retired === true) { retireClaim(claims, e); break; }
        upsertClaim(claims, e);
        break;
      case 'evidence': attachEvidence(claims, e); break;
      case 'ruling': {
        const r = toRuling(e);
        rulings.push(r);
        rulingById.set(r.id, r);
        // 二次裁决：新裁定声明 overrides 时，把旧的标为已复核。
        // 判据是**结构化引用**，不是 rationale 文本匹配——文本匹配迟早漂。
        // Web 的台账早就按 overriddenBy 排序（已复核沉底），但投影此前从没
        // 产出过这个字段：又一例「声明了但不起作用」，旧裁定永远显示未复核。
        if (r.overrides && rulingById.has(r.overrides)) {
          rulingById.get(r.overrides).overriddenBy = r.id;
        }
        break;
      }
      case 'run': runs.push(toRun(e)); break;
      default: break;
    }
  }

  // 失效传播（R3）：上游变了，下游的证据自动失效。
  // 「改完了」的判据是失效清单清空，不是人觉得改完了。
  propagateStale(claims);

  return { claims, rulings, runs, stats: summarize(claims, runs) };
}

/**
 * 退休一条命题。为什么必须有这一步：compile 此前只有 upsert，
 * 从 docs/ 删掉一条命题后它**永久留在投影里**——参与进度、参与 audit、
 * 参与 next 的候选。删不掉的账目会让「声明数」只增不减，
 * 最后没人说得清哪些是真需求、哪些是三个月前删掉的。
 *
 * 退休是**强变化**：依赖它的活动命题必须失效（上游没了 ≠ 上游满足了），
 * 由 propagateStale 里的 retired 分支处理。
 */
function retireClaim(claims, e) {
  const prev = claims.get(e.subject);
  if (!prev) return; // 退休一条不存在的命题：无事发生，audit 的野生检查会报
  prev.retired = true;
  prev.retiredAt = e.ts;
  prev.lastChanged = e.ts; // 退休就是它最后一次「定义变化」——下游据此失效
}

function upsertClaim(claims, e) {
  const id = e.subject;
  if (!id) return;
  const p = e.payload ?? {};
  const prev = claims.get(id);
  const next = {
    id,
    layer: p.layer ?? prev?.layer ?? 'spec',
    statement: p.statement ?? prev?.statement ?? '',
    // 来源可信度（S 轴）——这条凭什么进来的
    trust: p.trust ?? prev?.trust ?? 'stated',
    source: p.source ?? prev?.source ?? null,
    // 所需证据强度（E 轴的门槛）——每条命题自己声明要多硬
    need: p.need ?? prev?.need ?? 'derived',
    from: p.from ?? prev?.from ?? [],   // 编译边：来自哪些上游命题
    impl: p.impl ?? prev?.impl ?? [],   // 实现边：落在哪些符号上
    // 证据策略 id。声明了它，submit 就默认触发那条预登记命令——
    // 这是 `need: executed` 唯一能真正达标的路（现挑的命令产不出正式证据）。
    policy: p.policy ?? prev?.policy ?? null,
    evidence: prev?.evidence ?? [],
    // 被写过几次。只用来观测，**不作失效判据**——见下面 changed。
    revision: (prev?.revision ?? 0) + 1,
    stale: false,
  };

  // ── 变化分三类，处置各不相同：**全系统只有这一处判定**（R3）──────────
  //
  // 曾经只有一个 contentChanged(statement/need/from)，两个方向都错：
  //   改了却不失效  impl 落点、layer 换层不算「变」——实现边整个换掉，旧证据照旧绿
  //   不该清却清了  need 只是门槛：门槛提高该表现为「不再达标」，而不是把
  //                 已经跑绿的测试证据凭空抹掉；trust/source 只是来源元数据，
  //                 「来源从 stated 升为 fact」不该清掉仍然有效的执行证据
  //
  // 所以拆成三类（S/E 两轴正交，变化处置也必须正交）：
  //   定义变化  layer/statement/from/impl → 清本条证据 + 沿 from 传播失效
  //   来源变化  trust/source             → 证据保留；S 轴本来就实时读当前值
  //   门槛变化  need                     → 证据保留；meets() 实时算，自动反映
  // 复活（退休 → 重新声明）一律按定义变化处理：哪怕字面一模一样，
  // 退休期间证据没有被维护过，「碰巧同文」不构成「仍然验过」。
  const definitionChanged = prev ? (prev.retired === true || defChanged(prev, next)) : false;
  if (definitionChanged) next.evidence = [];
  // 定义最后一次**变化**的时刻（不是最后一次被写、也不是来源/门槛调整的时刻）。
  // 下游证据早于它 → 那份证据验的是旧版本，作废。
  // 忘了赋值会让比较恒真、失效永不传播——R3 静默失灵，从外部完全看不出来。
  next.lastChanged = definitionChanged || !prev ? e.ts : prev.lastChanged;
  // 定义改过几次（首次声明算 1）。观测用，不作判据（判据只有 lastChanged 一处）。
  next.contentRevision = (prev?.contentRevision ?? 0) + (definitionChanged || !prev ? 1 : 0);

  claims.set(id, next);
}

/** 定义指纹的组成：这四个字段决定「这条命题说的是哪件事、落在哪」。 */
function defChanged(a, b) {
  return a.layer !== b.layer
    || a.statement !== b.statement
    || JSON.stringify(a.from) !== JSON.stringify(b.from)
    || JSON.stringify(a.impl) !== JSON.stringify(b.impl);
}

function attachEvidence(claims, e) {
  const c = claims.get(e.subject);
  if (!c) return; // 证据指向不存在的命题：静默丢弃，由 audit 报「野生证据」
  const p = e.payload ?? {};
  if (!STRENGTH.includes(p.strength)) return;
  c.evidence.push({
    strength: p.strength,
    by: p.by ?? null,          // 取证方式，必须可重放——否则它和自称没区别
    at: e.ts,
    detail: p.detail ?? null,
  });
}

/**
 * 沿编译边把「上游内容变过」传给下游：下游证据早于上游那次变化即视为过期。
 *
 * 判据**只有一条**：`evidenceAfter(下游, 上游)`，比的是下游最后一份证据的时刻
 * 与上游 `lastChanged`（内容最后一次**变化**的时刻，不是最后被写的时刻）。
 *
 * 这里刻意不再叠加 `up.contentRevision > 1` 之类的第二重判断。曾经叠过
 * `up.revision > 1`，两版判据强弱不一，弱的那版让重跑 compile 把全绿项目打红。
 * 修的时候一度补成「两处都改对」——那仍是两个真源，
 * 只是碰巧一致；下次有人动其中一处，问题会以另一种形态回来。
 */
function propagateStale(claims) {
  const order = [...claims.values()].sort((a, b) => LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer));
  for (const c of order) {
    if (c.retired) continue; // 退休命题自己不再进失效清单——它不是待办
    if (c.stale) continue;
    for (const upId of c.from) {
      const up = claims.get(upId);
      if (!up) continue;
      // 上游退休是**强变化**：把「上游没了」当成「上游满足了」是最危险的默认。
      if (up.retired || up.stale || (c.evidence.length > 0 && !evidenceAfter(c, up))) {
        c.stale = true;
        break;
      }
    }
  }
}

function evidenceAfter(claim, upstream) {
  const last = claim.evidence.at(-1);
  return last ? String(last.at) >= String(upstream.lastChanged ?? '') : false;
}

/** 一条命题的当前最强证据。空数组 → 'none'。 */
export function best(claim) {
  let top = null;
  for (const ev of claim.evidence) {
    if (!top || strengthRank(ev.strength) > strengthRank(top.strength)) top = ev;
  }
  return top;
}

/**
 * 一份证据是不是**正式**的。
 *
 * 判据只有一条：取证方式是不是调用方在交活那一刻自己挑的。
 *   claimed / derived —— 内容由系统生成（自述如实记来源，标注由 extract 机械扫），
 *                        agent 挑不了「验什么」，天然正式
 *   executed          —— 命令来自预登记策略才正式；`--how` 现给的命令标 adHoc
 *
 * 这条不落地，`adHoc` 就只是个没人看的标签：`node -e "process.exit(0)"` 照样
 * 换来 executed 证据、照样让命题达标。codex 评估把它列为「最优先的剩余风险」，
 * 而当时冒烟脚本自己就在用那条恒成功命令——**产品自己在演示怎么放水**。
 */
export function isFormal(evidence) {
  return evidence?.by?.adHoc !== true;
}

/**
 * 达标 = 有**正式**证据 且 强度 ≥ 声明的门槛 且 未失效。
 *
 * 注意这里取的是「够门槛的正式证据里最强的那份」，不是 best()。
 * best() 回答「现在最强的证据是什么」（含 adHoc，观测面要如实显示它），
 * meets() 回答「够不够交付」——两个问题，不能共用一个答案。
 */
export function meets(claim) {
  if (claim.retired) return false; // 退休的命题谈不上达标——它已经不是要求了
  if (claim.stale) return false;
  const need = strengthRank(claim.need);
  return claim.evidence.some((e) => isFormal(e) && strengthRank(e.strength) >= need);
}

/** 够门槛但只有 adHoc 证据 → 「看着够了其实不算」。观测面要能指名说出这种情况。 */
export function blockedByAdHoc(claim) {
  if (meets(claim)) return false;
  const need = strengthRank(claim.need);
  return claim.evidence.some((e) => !isFormal(e) && strengthRank(e.strength) >= need);
}

function toRuling(e) {
  const p = e.payload ?? {};
  return {
    id: e.id, at: e.ts, actor: e.actor,
    // 裁定产生的那条命题。丢了它，台账就只能靠文本匹配回连命题——
    // 而 R3 要求二次裁决能触发失效传播，传播的起点正是这个 id。
    subject: e.subject ?? null,
    question: p.question ?? '',
    chosen: p.chosen ?? null,
    options: p.options ?? [],
    rationale: p.rationale ?? '',
    // 置信度与影响面决定它在观测平台上排多前——没有优先级的裁定台账
    // 会走向和「永远消不掉的告警」同一个结局：人不看了
    confidence: p.confidence ?? 'unknown',
    blastRadius: p.blastRadius ?? null,
    // 我改判了哪条旧裁定（事件里带）；被谁改判（投影时由 overrides 反向回填）。
    // overriddenBy 不进事件——append-only 的日志不能改旧行，只能由新行宣告。
    overrides: p.overrides ?? null,
    overriddenBy: null,
  };
}

function toRun(e) {
  return {
    id: e.id, at: e.ts, actor: e.actor,
    op: e.payload?.op ?? 'unknown',
    subject: e.subject,
    cost: e.cost ?? null,
  };
}

function summarize(claims, runs) {
  const byLayer = {};
  let total = 0; let met = 0; let stale = 0; let noEvidence = 0; let retired = 0;
  const byStrength = Object.fromEntries(STRENGTH.map((s) => [s, 0]));
  for (const c of claims.values()) {
    // 进度只统计**活动**命题。退休的单独计数：让它继续摊进分母，
    // 「删掉 10 条需求」会表现为进度上升——那是账本在撒谎。
    if (c.retired) { retired += 1; continue; }
    total += 1;
    byLayer[c.layer] = (byLayer[c.layer] ?? 0) + 1;
    if (c.stale) stale += 1;
    const b = best(c);
    if (!b) noEvidence += 1; else byStrength[b.strength] += 1;
    if (meets(c)) met += 1;
  }
  const cost = runs.reduce((acc, r) => ({
    tokens: acc.tokens + (r.cost?.tokens ?? 0),
    ms: acc.ms + (r.cost?.ms ?? 0),
  }), { tokens: 0, ms: 0 });
  return { total, met, stale, noEvidence, retired, byLayer, byStrength, runs: runs.length, cost };
}
