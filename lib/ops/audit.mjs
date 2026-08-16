// 对账 —— 覆盖 / 达标 / 闭合（R2 第二问「整体做到哪、能交付吗」+ R3「改完了没」）。
//
// ─────────────────────────────────────────────────────────────────────────
// 三类检查，各回答一个不同的问题：
//   覆盖 coverage    每条命题都有证据吗          —— 有没有人验过
//   达标 conformance 证据强度够它声明的门槛吗    —— 验得够不够硬（claims.meets）
//   闭合 closure     相邻层命题集合互相蕴含吗    —— 契约与实现有没有对上
//
// 外加三份「说实话」的附录，它们比上面三项更容易被省掉，也更贵：
//   野生证据  证据指向不存在的命题 —— 一条谁也挂不上的记录，看着像验过了
//   失效清单  stale 的命题        —— R3 的判据，清单清空才算改完
//   提取边界  extract.CAPABILITY  —— 这次检查**看得见什么、看不见什么**
//
// 最后一项是本模块最要紧的一条纪律。上一代最贵的一次事故不是报错，是**假绿**：
// 三份拷贝的正则把 281 个调用点里的 216 个静默跳过，两条规则全绿。
// 结论是：**看不见的时候要说看不见，不能沉默通过**。所以本模块凡是扫不到东西
// （没有代码目录、扫不到路由、没有命题声明端点）都出一条 warn 说明「这一侧没判」，
// 而不是让它悄悄计为 0 个问题。
// ─────────────────────────────────────────────────────────────────────────
import { readAll } from '../core/events.mjs';
import { project, best, meets, LAYERS } from '../core/claims.mjs';
import { scanTree, endpointKey, CAPABILITY } from '../core/extract.mjs';
import { codeDirs } from './attest.mjs';

// 严重度只有两档：error 挡交付，warn 要人看一眼。第三档会让人开始忽略前两档。
// （曾导出过一个 SEVERITY 常量，零消费——本模块内部本来就用字面量，删了。）

/**
 * 对整个项目对账。
 *
 * ctx  { root, config?, dirs? }
 * → { findings, summary }
 *
 * 不写盘、不改事件流：审计是只读的。它要是能改状态，人就会开始「让审计通过」
 * 而不是「让代码达标」。
 */
export async function audit(ctx = {}) {
  if (!ctx.root) throw new Error('audit 需要 ctx.root');

  const { events, corrupt } = await readAll(ctx.root);
  const { claims, rulings, runs, stats } = project(events);
  const dirs = codeDirs(ctx);
  const scan = await scanTree(ctx.root, dirs);

  const findings = [];

  // ── 覆盖 / 达标 / 失效 ───────────────────────────────────────────────
  // 一条命题只出一条主诊断，按 stale > uncovered > weak 取先。
  // 三条一起报会让计数虚高，人看两次就开始只看总数。
  const stale = [];
  let covered = 0;
  let met = 0;
  for (const c of sortedClaims(claims)) {
    const b = best(c);
    if (b) covered += 1;
    if (meets(c)) met += 1;

    if (c.stale) {
      stale.push(c.id);
      findings.push(f('stale', 'error', c.id,
        '上游改过之后没重新取证——这是 R3 的失效清单，清单清空才算改完',
        { layer: c.layer, from: c.from }));
    } else if (!b) {
      findings.push(f('uncovered', 'error', c.id,
        `命题没有任何证据（声明的门槛是 ${c.need}）`,
        { layer: c.layer, need: c.need }));
    } else if (!meets(c)) {
      findings.push(f('weak', 'error', c.id,
        `证据强度 ${b.strength} 够不上声明的门槛 ${c.need}`,
        { layer: c.layer, need: c.need, got: b.strength, by: b.by }));
    }
  }

  // ── 野生证据 ─────────────────────────────────────────────────────────
  // claims.project 对指不到命题的证据是静默丢弃的（它没法处理，也不该处理）。
  // 丢弃本身没错，错在没人说——所以这里回到原始事件流把它们捞出来。
  const orphanEvidence = [];
  for (const e of events) {
    if (e.kind !== 'evidence') continue;
    if (e.subject && claims.has(e.subject)) continue;
    orphanEvidence.push({ event: e.id, subject: e.subject ?? null, at: e.ts });
  }
  for (const o of orphanEvidence) {
    findings.push(f('orphan-evidence', 'warn', o.subject ?? '(null)',
      '证据指向不存在的命题：它没落到任何命题上，等于白验了一次',
      { event: o.event }));
  }

  // ── 野生标注 ─────────────────────────────────────────────────────────
  // 代码里写了 @vima xxx 而 xxx 不是命题：多半是 id 打错了。
  // 后果不显眼但很贵——那个文件永远拿不到 derived 证据，而看起来「已经标过了」。
  const orphanMarks = new Map();
  for (const m of scan.marks) {
    if (claims.has(m.claimId)) continue;
    if (!orphanMarks.has(m.claimId)) orphanMarks.set(m.claimId, []);
    orphanMarks.get(m.claimId).push({ file: m.file, line: m.line });
  }
  for (const [claimId, at] of [...orphanMarks].sort(byKey)) {
    findings.push(f('orphan-mark', 'warn', claimId,
      '代码里标注了不存在的命题 id（多半是拼错）——这个标注永远不会被取证命中',
      { at }));
  }

  // ── 闭合 ─────────────────────────────────────────────────────────────
  const closure = checkClosure({ claims, scan, dirs, findings });

  // ── 死规则 ───────────────────────────────────────────────────────────
  // 判定本身在 assets/rules.deadRules（它拿 selectRules 穷举，判据只有那一处）；
  // 结果由调用方注入进 ctx，本模块只负责把它变成 finding——ops 不 import assets/，
  // 依赖方向单向向下，两者是兄弟层。同 ctx.claims / ctx.dirs 的既有做法。
  //
  // 为什么这条必须有出口：assets/rules.mjs 早就实现了 deadRules，但没有任何
  // 命令能问到它，vima-harvest 的「反向清单」规程因此写了却拿不到数据。
  // 项目硬约束里「立项即做透」点名的就是这种——块定义了没人消费。
  //
  // 为什么是 warn 不是 error：一条规则暂时不命中不挡交付。但它必须被看见，
  // 因为规则只增不减的仓库最后没人看得完，等于没有规则——规则层的常见死法。
  const deadRules = ctx.deadRules ?? [];
  for (const r of deadRules) {
    // 把限定维度写进消息本身。只说「这条死了」，人得自己去翻规则文件才知道为什么；
    // 写上 `side=wechat` 之后，「本项目没有小程序端」这个原因当场就看出来了。
    const dims = Object.entries(r.applies ?? {})
      .filter(([, v]) => v !== null)
      .map(([k, v]) => `${k}=${v.join('|')}`).join(' ') || '（不限）';
    findings.push(f('dead-rule', 'warn', r.id,
      `限定 ${dims}，在本项目的维度全集里一次都不会被选中——要么补覆盖面，要么删掉`,
      { applies: r.applies, origin: r.origin }));
  }

  const counts = {
    error: findings.filter((x) => x.severity === 'error').length,
    warn: findings.filter((x) => x.severity === 'warn').length,
  };
  findings.sort(byFinding);

  return {
    findings,
    summary: {
      ok: counts.error === 0,
      counts,
      coverage: { total: claims.size, covered, uncovered: claims.size - covered },
      conformance: { total: claims.size, met, unmet: claims.size - met },
      // 失效清单单独摆出来：它是「改完了没」的判据，不该埋在 findings 里数。
      stale,
      orphanEvidence,
      closure,
      // 规则层健康度。rules:null 表示**这次没查**（调用方没注入），
      // 与「查了，0 条死规则」是两回事——同 closure-unchecked 的价值观。
      rules: ctx.deadRules
        ? { total: ctx.ruleCount ?? null, dead: deadRules.map((r) => r.id) }
        : null,
      claims: stats,
      scan: { dirs, files: scan.files.length, marks: scan.marks.length },
      log: { events: events.length, corrupt, runs: runs.length, rulings: rulings.length },
      // 如实带上提取能力边界：让读报告的人知道这次检查看得见什么、看不见什么。
      // 少了这一段，一份全绿的报告会被当成「系统全对」，而它其实只是
      // 「用文件级正则看过、没看出问题」。
      extract: CAPABILITY,
    },
  };
}

/**
 * 闭合：相邻层的命题集合互相蕴含吗。
 *
 * 能查到什么，完全由 extract 看得见什么决定——它给的是 @vima 标注、前端请求调用、
 * 后端路由注解三样，所以闭合只能做到**端点粒度**：
 *   契约声明的端点有实现吗   declared → routes
 *   实现的端点在契约里吗     routes   → declared
 *   被读的数据有人写吗       calls    → routes（前端读的端点，后端有人提供吗）
 *
 * 第三条是「被读的数据有人写吗」在当前能力下的忠实投影：extract 看不见 import 图
 * 也判不到符号，做不了字段级的读写对账，所以就做到端点级，并在报告里说清楚
 * （summary.extract）。**不能因为做不到字段级就假装端点级等于字段级。**
 *
 * 命题怎么声明端点：claim.impl 里形如 `GET /api/users/{id}` 的条目即端点声明，
 * 其余条目当文件路径。三个来源（声明 / 调用 / 路由）里只有 calls 走过
 * extract.endpointKey，另外两个没走，所以比对前统一过一遍同一个函数——
 * 「端点键怎么算」的判据仍然只有 extract 一处，本模块不自造。
 */
function checkClosure({ claims, scan, dirs, findings }) {
  const declared = new Map();  // key → [claimId]
  for (const c of sortedClaims(claims)) {
    for (const item of c.impl ?? []) {
      const key = asEndpoint(item);
      if (!key) continue;
      if (!declared.has(key)) declared.set(key, []);
      declared.get(key).push(c.id);
    }
  }
  const routes = group(scan.routes);
  const calls = group(scan.calls);

  const scanned = dirs.length > 0 && scan.files.length > 0;
  const result = {
    scanned,
    declared: declared.size,
    routes: routes.size,
    calls: calls.size,
    unimplemented: [],
    uncontracted: [],
    unserved: [],
    uncalled: [],
  };

  if (!scanned) {
    // 一行都没扫到还报「闭合无问题」，就是上一代那种最危险的绿。
    findings.push(f('closure-unchecked', 'warn', '(closure)',
      dirs.length === 0
        ? '没有配置代码目录（config.apps 为空），闭合完全没检查——不是没问题，是没看'
        : `代码目录 ${dirs.join(', ')} 里没扫到可识别的文件，闭合完全没检查`,
      { dirs }));
    return result;
  }

  if (declared.size === 0) {
    findings.push(f('closure-unchecked', 'warn', '(contract)',
      '没有任何命题在 impl 里声明端点，契约侧无从比对——「实现的端点在契约里吗」这一问没答',
      { hint: 'claim.impl 写 `GET /api/xxx` 即声明端点' }));
  }
  if (routes.size === 0) {
    findings.push(f('closure-unchecked', 'warn', '(backend)',
      '没扫到任何后端路由注解，后端侧无从比对（可能是纯前端项目，也可能是没扫到）',
      { dirs }));
  }
  if (calls.size === 0) {
    findings.push(f('closure-unchecked', 'warn', '(frontend)',
      '没扫到任何前端请求调用，调用侧无从比对',
      { dirs }));
  }

  // 契约声明的端点有实现吗
  if (routes.size > 0) {
    for (const [key, owners] of [...declared].sort(byKey)) {
      if (routes.has(key)) continue;
      result.unimplemented.push(key);
      findings.push(f('endpoint-unimplemented', 'error', key,
        `契约声明了这个端点，代码里没有对应的路由实现（声明它的命题：${owners.join(', ')}）`,
        { claims: owners }));
    }
  }

  // 实现的端点在契约里吗（少了是缺口，多了是未授权的复杂度：要人看，但不挡交付）
  if (declared.size > 0) {
    for (const [key, at] of [...routes].sort(byKey)) {
      if (declared.has(key)) continue;
      result.uncontracted.push(key);
      findings.push(f('endpoint-uncontracted', 'warn', key,
        '实现了契约里没有的端点——要么补契约，要么它就是未授权的复杂度',
        { at }));
    }
  }

  // 被读的数据有人写吗（前端读的端点，后端有人提供吗）
  if (routes.size > 0) {
    const already = new Set(result.unimplemented);
    for (const [key, at] of [...calls].sort(byKey)) {
      if (routes.has(key)) continue;
      result.unserved.push(key);
      // 已经以「契约声明了但没实现」报过的，不再从调用侧重报一遍：同一个洞一条诊断。
      if (already.has(key)) continue;
      findings.push(f('call-unserved', 'error', key,
        '前端在读这个端点，后端没有任何路由提供它',
        { at }));
    }
  }

  // 反向：实现了没人调。可能是给别的端或外部用的，所以是 warn 不是 error。
  if (calls.size > 0) {
    for (const [key, at] of [...routes].sort(byKey)) {
      if (calls.has(key)) continue;
      result.uncalled.push(key);
      findings.push(f('route-uncalled', 'warn', key,
        '实现了路由但扫描范围内没有任何前端调用它',
        { at }));
    }
  }

  return result;
}

/** `GET /api/x/{id}` 形状的 impl 条目 → 归一端点键；不是端点形状返回 null。 */
function asEndpoint(item) {
  if (typeof item !== 'string') return null;
  const m = /^\s*(GET|POST|PUT|DELETE|PATCH)\s+(\S+)\s*$/i.exec(item);
  return m ? endpointKey(m[1], m[2]) : null;
}

/** 扫描结果 → key → 出现位置。key 统一过 extract.endpointKey 再比对。 */
function group(rows) {
  const out = new Map();
  for (const r of rows) {
    const m = /^(\S+)\s+(\S+)$/.exec(r.key);
    const key = m ? endpointKey(m[1], m[2]) : r.key;
    if (!out.has(key)) out.set(key, []);
    out.get(key).push({ file: r.file, line: r.line });
  }
  return out;
}

function f(kind, severity, subject, message, detail = null) {
  return { kind, severity, subject, message, detail };
}

/** 命题按层序再按 id：报告顺序稳定，同一输入两次跑出同一份文本。 */
function sortedClaims(claims) {
  return [...claims.values()].sort((a, b) => {
    const d = LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer);
    return d !== 0 ? d : cmp(a.id, b.id);
  });
}

function byFinding(a, b) {
  return cmp(a.kind, b.kind) || cmp(a.subject, b.subject) || cmp(a.message, b.message);
}
function byKey(a, b) { return cmp(a[0], b[0]); }
function cmp(a, b) { return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0; }
