// Web 观测平台（R2）—— 把事件流投影渲染成一个人能扫读的只读界面。
//
// ─────────────────────────────────────────────────────────────────────────
// 它只回答五个问题，且必须在同一套数据上回答（数据同源 = 只有 project(events)）：
//   ① 这条做对了吗、凭什么      → 命题 + 证据，**两个强度轴同屏并列**
//   ② 整体做到哪、能交付吗      → 证据强度分布 vs 各自声明的门槛
//   ③ 过程怎么走的、谁做的      → 事件流回放（append-only ⇒ 可重建当时状态）+ actor 维度
//   ④ 花了多少                  → run 事件的 cost，按环节 / 代理 / 任务聚合
//   ⑤ 哪些是 AI 替我定的        → 裁定台账，按 confidence 与 blastRadius 排序
//
// 三条不可退让的呈现纪律：
//
//   **两轴必须同屏。** 一条命题可以「来源可信但没实现」，也可以「实现扎实但
//   来源是份过期文档」。只显示一轴会给人「整条链都很硬」的错觉——追溯链恰恰
//   是在最上游断掉的。
//
//   **裁定台账必须能排序筛选，低 confidence + 大 blastRadius 排最前。**
//   这不是美化：一份 200 条的流水账同构于「永远消不掉的告警」，结局是人不看了。
//   未声明 confidence / blastRadius 一律按「最需要关注」处理，不按「没问题」处理。
//
//   **暂缺就显示暂缺，绝不用弱证据冒充，绝不把空白显示成绿色。**
//   最强档 observed（真跑一遍界面）本轮不建采集设施，这是已接受的风险。
//   UI 如实标注是整个观测平台可信度的底线——一旦这里注水，上面四条全部作废。
//
// 只读。写入口全系统只有一个（events.append），人和 agent 走同一条路：
// 二次裁决在这里只生成一条 CLI 命令让人去跑，本模块不写盘。
// ─────────────────────────────────────────────────────────────────────────
import http from 'node:http';
import path from 'node:path';
import { readFile, realpath, stat } from 'node:fs/promises';

import { readAll, STRENGTH, TRUST, strengthRank, trustRank } from '../core/events.mjs';
import { project, best, meets, LAYERS } from '../core/claims.mjs';
import { readConfig } from '../core/project.mjs';

/** 只绑回环。观测平台读得到整个仓库，不能出网卡。 */
export const HOST = '127.0.0.1';

/** 文件查看器上限——超过就如实拒绝，不半截渲染。 */
const MAX_VIEW_BYTES = 2 * 1024 * 1024;

/**
 * 二次裁决入口生成的命令。
 *
 * 观测平台不写盘：它只把「这条我要改判」翻译成一条人去跑的命令。
 * 二次裁决就是**再记一条裁定**——走 R3 同一条失效传播链路，不为裁定单独设计回滚，
 * 所以这里用的是既有的 `vima rule`，没有另造一个 override 子命令。
 *
 * 关联靠 `--overrides=<旧id>`（结构化），**不靠 rationale 文本**。
 * 早先这里把旧 id 写进 rationale 文案，投影根本不解析它——于是旧裁定永远
 * 显示未复核，改判和被改判在数据上毫无关联，台账成了只进不出的表。
 *
 * 命令旁边那句提示与本函数是同一件事的两面，改一处必须改另一处：命令带了
 * `--overrides`，提示就得说「跑完即转已复核」。它曾停在「CLI 目前没有这个入参」，
 * 于是界面在劝人别指望一个已经做好的能力——比功能没做还糟，人会绕道去手改账本。
 */
export function overrideCommand(ruling) {
  const q = (s) => `'${String(s ?? '').replace(/'/g, `'\\''`)}'`;
  return [
    'vima rule',
    `--overrides=${q(ruling.id)}`,
    `--question=${q(ruling.question || '<原问题>')}`,
    `--chosen=${q('<你的裁决>')}`,
    '--confidence=high',
    `--blast=${q(blastSize(ruling.blastRadius) ?? '<影响面>')}`,
    `--rationale=${q('<为什么推翻>')}`,
  ].join(' ');
}

// ── 路径穿越防护 ────────────────────────────────────────────────────────────

/**
 * 把 /file/ 后面的相对路径解析到项目根内，越界一律返回 null。
 *
 * 单独导出是为了能被直接测——只读出口的防护判据不该只存在于请求处理里。
 * 三道：NUL 字节 / 绝对路径（含 Windows 盘符）/ resolve 后的前缀包含检查。
 * 符号链接逃逸由调用方在 realpath 后再查一次（磁盘状态无法静态判断）。
 */
export function resolveInRoot(root, rel) {
  if (typeof rel !== 'string' || rel === '') return null;
  let decoded = rel;
  if (decoded.includes('%')) {
    try { decoded = decodeURIComponent(decoded); } catch { return null; }
  }
  if (decoded.includes('\0')) return null;
  decoded = decoded.replace(/\\/g, '/');
  if (decoded.startsWith('/') || /^[a-zA-Z]:/.test(decoded)) return null;
  const base = path.resolve(root);
  const abs = path.resolve(base, decoded);
  if (abs !== base && !abs.startsWith(base + path.sep)) return null;
  return abs;
}

async function insideRoot(root, abs) {
  try {
    const realRoot = await realpath(path.resolve(root));
    const real = await realpath(abs);
    return real === realRoot || real.startsWith(realRoot + path.sep);
  } catch {
    return false;
  }
}

// ── 状态加载 ────────────────────────────────────────────────────────────────

async function loadState(root) {
  const { events, corrupt } = await readAll(root);
  const config = await readConfig(root).catch(() => null);
  return { root, events, corrupt, config, ...project(events) };
}

/** 回放：append-only 的直接红利——取前 n 条重投影就是当时的状态。 */
function snapshotAt(events, n) {
  return project(events.slice(0, Math.max(0, Math.min(n, events.length))));
}

// ── 小工具 ──────────────────────────────────────────────────────────────────

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const attr = (v) => esc(v);

/** 时间只按事件里记的原样显示。不做「3 分钟前」——那要读系统时钟，同一输入就不再同一输出。 */
function fmtTs(ts) {
  const s = String(ts ?? '');
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(s);
  return m ? `${m[1]} ${m[2]}` : (s || '—');
}

function fmtNum(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US');
}

function fmtVal(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

// ── 强度轴 ──────────────────────────────────────────────────────────────────

const TRUST_ASC = [...TRUST].reverse();          // ruled → stated → superseded → fact
const TRUST_LABEL = {
  fact: 'fact 事实', superseded: 'superseded 被取代', stated: 'stated 自陈', ruled: 'ruled AI 裁定',
};
const STRENGTH_LABEL = {
  claimed: 'claimed 自称', derived: 'derived 推导', executed: 'executed 跑过', observed: 'observed 实测',
};

/** 本轮不建 observed 采集设施——凡是它出现的地方都要带这句，不许沉默。 */
const OBSERVED_GAP = 'observed（真跑一遍界面）本轮未建采集设施，属已接受的风险；此处为暂缺，不是「已通过」';

/**
 * 命题状态四分。任何一档都不能落到「看起来是绿的」除非真的达标。
 *
 * 这里曾有一段注释说「失效当前无法由真实事件流造出」——那是并行开发早期的
 * 事实，core 修好后没人回来更新，而 web.render.test 一直拿它当「可以用合成
 * 投影」的理由。**过期注释比没有注释危险**：它在为一条违反测试纪律的做法背书。
 * 现状：真实事件流完全造得出 stale（见 core.roundtrip.test），测试该走真流。
 */
export function claimStatus(c) {
  if (c.stale) return { key: 'stale', tone: 'bad', label: '失效' };
  const b = best(c);
  if (!b) return { key: 'none', tone: 'gap', label: '无证据' };
  if (meets(c)) return { key: 'met', tone: 'ok', label: '达标' };
  const short = strengthRank(c.need) - strengthRank(b.strength);
  const unreachable = c.need === 'observed';
  return {
    key: 'short',
    tone: unreachable ? 'gap' : 'warn',
    label: unreachable ? `门槛暂不可达（差 ${short} 档）` : `未达标（差 ${short} 档）`,
    note: unreachable ? OBSERVED_GAP : null,
  };
}

/** S 轴阶梯：这条命题凭什么进来的。 */
function trustLadder(c) {
  const r = trustRank(c.trust);
  const segs = TRUST_ASC.map((t, i) => {
    const on = r >= 0 && i <= r;
    const cls = ['seg', on ? 'on' : 'off'];
    if (on && t === 'superseded' && c.trust === 'superseded') cls.push('warn');
    if (on && t === 'ruled' && c.trust === 'ruled') cls.push('ruled');
    return `<i class="${cls.join(' ')}" title="${attr(TRUST_LABEL[t])}"></i>`;
  }).join('');
  const tone = c.trust === 'fact' ? 'ok' : c.trust === 'superseded' ? 'warn' : c.trust === 'ruled' ? 'ruled' : 'neutral';
  return `<span class="ladder t-${tone}">${segs}</span>`;
}

/** E 轴阶梯：这条命题做到了没有。门槛就画在阶梯上，不另开一列让人对着找。 */
function strengthLadder(c) {
  const b = best(c);
  const bi = b ? strengthRank(b.strength) : -1;
  const ni = strengthRank(c.need);
  const st = claimStatus(c);
  const segs = STRENGTH.map((s, i) => {
    const on = i <= bi;
    const cls = ['seg', on ? 'on' : 'off'];
    if (i === ni) cls.push('need');
    if (s === 'observed' && !on) cls.push('unavail');
    const title = s === 'observed' && !on ? OBSERVED_GAP : STRENGTH_LABEL[s];
    return `<i class="${cls.join(' ')}" title="${attr(title)}"></i>`;
  }).join('');
  return `<span class="ladder e-${st.tone}">${segs}</span>`;
}

function statusBadge(c) {
  const st = claimStatus(c);
  const note = st.note ? ` title="${attr(st.note)}"` : '';
  return `<span class="badge ${st.tone}"${note}>${esc(st.label)}</span>`;
}

// ── 裁定：优先级 ────────────────────────────────────────────────────────────

const CONFIDENCE = ['low', 'medium', 'high'];

/** 未声明 = -1，排最前。「没标置信度」不等于「没问题」，界面不替它兜底。 */
function confRank(c) {
  if (typeof c === 'number' && Number.isFinite(c)) return Math.max(0, Math.min(1, c)) * 2;
  const i = CONFIDENCE.indexOf(String(c ?? '').toLowerCase());
  return i < 0 ? -1 : i;
}
function confLabel(c) {
  if (typeof c === 'number' && Number.isFinite(c)) return c.toFixed(2);
  const s = String(c ?? '').toLowerCase();
  return CONFIDENCE.includes(s) ? s : '未声明';
}
function confTone(c) {
  const r = confRank(c);
  if (r < 0) return 'gap';
  if (r < 0.75) return 'bad';
  if (r < 1.75) return 'warn';
  return 'ok';
}
/** 筛选用的档位。数值置信度也要能被 low/medium/high 筛到，否则筛选会漏。 */
function confBucket(c) {
  const r = confRank(c);
  if (r < 0) return '未声明';
  return r < 0.75 ? 'low' : r < 1.75 ? 'medium' : 'high';
}

/** 影响面大小。未声明返回 null——排序时视同「最大」，不视同「零」。 */
function blastSize(b) {
  if (b == null) return null;
  if (typeof b === 'number' && Number.isFinite(b)) return b;
  if (Array.isArray(b)) return b.length;
  if (typeof b === 'object') return typeof b.count === 'number' ? b.count : null;
  const m = /^\s*(\d+)/.exec(String(b));
  return m ? Number(m[1]) : null;
}
function blastLabel(b) {
  if (b == null) return '未声明';
  if (Array.isArray(b)) return `${b.length} 条：${b.join(', ')}`;
  if (typeof b === 'object') return fmtVal(b);
  return String(b);
}

/** 默认序：已复核沉底 → 低置信在前 → 大影响面在前 → 新的在前。 */
function byAttention(a, b) {
  const ra = a.overriddenBy ? 1 : 0;
  const rb = b.overriddenBy ? 1 : 0;
  if (ra !== rb) return ra - rb;
  const ca = confRank(a.confidence);
  const cb = confRank(b.confidence);
  if (ca !== cb) return ca - cb;
  const ba = blastSize(a.blastRadius);
  const bb = blastSize(b.blastRadius);
  const va = ba == null ? Infinity : ba;
  const vb = bb == null ? Infinity : bb;
  if (va !== vb) return vb - va;
  return String(b.at).localeCompare(String(a.at));
}

// ── 成本聚合 ────────────────────────────────────────────────────────────────

function costKeys(runs) {
  const keys = new Set();
  for (const r of runs) {
    for (const [k, v] of Object.entries(r.cost ?? {})) if (typeof v === 'number') keys.add(k);
  }
  return [...keys].sort((a, b) => (a === 'tokens' ? -1 : b === 'tokens' ? 1 : a.localeCompare(b)));
}

function groupCost(runs, pick, keys) {
  const rows = new Map();
  for (const r of runs) {
    const k = pick(r) ?? '（未记录）';
    let row = rows.get(k);
    if (!row) { row = { key: k, n: 0, priced: 0, sums: Object.fromEntries(keys.map((x) => [x, 0])) }; rows.set(k, row); }
    row.n += 1;
    if (r.cost) row.priced += 1;
    for (const key of keys) {
      const v = r.cost?.[key];
      if (typeof v === 'number') row.sums[key] += v;
    }
  }
  const sortKey = keys[0];
  return [...rows.values()].sort((a, b) => (sortKey ? b.sums[sortKey] - a.sums[sortKey] : b.n - a.n) || a.key.localeCompare(b.key));
}

// ── 页面外壳 ────────────────────────────────────────────────────────────────

const CSS = `
*,*::before,*::after{box-sizing:border-box}
:root{
  color-scheme:light dark;
  --bg:#fbfbf9; --panel:#ffffff; --panel-2:#f5f4f1;
  --ink:#1b1b19; --dim:#5a594f; --faint:#8d8b80;
  --line:#e3e1da; --line-2:#cbc9c0;
  --ok:#186c46; --ok-bg:#e4f2ea; --ok-line:#8cc4a8;
  --warn:#8a5300; --warn-bg:#fbf0da; --warn-line:#dcb463;
  --bad:#a02121; --bad-bg:#fae9e8; --bad-line:#dd9b98;
  --gap:#6a6860; --gap-bg:#eceae4; --gap-line:#bab7ac;
  --ruled:#6b3fa0; --ruled-bg:#f0e9f8; --ruled-line:#bda4dc;
  --accent:#2a54c9;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
:root:not([data-theme="light"]){}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --bg:#14140f; --panel:#1c1c17; --panel-2:#232320;
    --ink:#eceae2; --dim:#a7a496; --faint:#7d7a6e;
    --line:#33332c; --line-2:#4a493f;
    --ok:#5fc191; --ok-bg:#152a20; --ok-line:#2f6b4c;
    --warn:#e0ac52; --warn-bg:#2b2314; --warn-line:#6d5423;
    --bad:#ef8b86; --bad-bg:#2e1a19; --bad-line:#7a3b38;
    --gap:#9b988c; --gap-bg:#26251f; --gap-line:#54524a;
    --ruled:#c3a5ec; --ruled-bg:#231c30; --ruled-line:#54406f;
    --accent:#8aa8ff;
  }
}
:root[data-theme="dark"]{
  --bg:#14140f; --panel:#1c1c17; --panel-2:#232320;
  --ink:#eceae2; --dim:#a7a496; --faint:#7d7a6e;
  --line:#33332c; --line-2:#4a493f;
  --ok:#5fc191; --ok-bg:#152a20; --ok-line:#2f6b4c;
  --warn:#e0ac52; --warn-bg:#2b2314; --warn-line:#6d5423;
  --bad:#ef8b86; --bad-bg:#2e1a19; --bad-line:#7a3b38;
  --gap:#9b988c; --gap-bg:#26251f; --gap-line:#54524a;
  --ruled:#c3a5ec; --ruled-bg:#231c30; --ruled-line:#54406f;
  --accent:#8aa8ff;
}
html,body{margin:0;padding:0}
body{background:var(--bg);color:var(--ink);
  font:13px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC","PingFang SC","Hiragino Sans GB",sans-serif;
  -webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
code,.mono{font-family:var(--mono);font-size:12px}
header.top{position:sticky;top:0;z-index:20;background:var(--panel);border-bottom:1px solid var(--line)}
.topin{max-width:1240px;margin:0 auto;padding:8px 18px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.brand{font-weight:700;letter-spacing:.04em}
.brand small{font-weight:400;color:var(--faint);margin-left:6px;letter-spacing:0}
nav.main{display:flex;gap:2px;flex-wrap:wrap}
nav.main a{padding:4px 9px;border-radius:5px;color:var(--dim)}
nav.main a.on{background:var(--panel-2);color:var(--ink);font-weight:600}
.spacer{flex:1}
.ro{border:1px solid var(--line-2);color:var(--faint);border-radius:99px;padding:1px 8px;font-size:11px}
button.tt{background:var(--panel-2);border:1px solid var(--line);color:var(--dim);border-radius:5px;
  padding:3px 8px;cursor:pointer;font:inherit;font-size:12px}
main{max-width:1240px;margin:0 auto;padding:18px}
h1{font-size:17px;margin:0 0 4px}
h2{font-size:13px;margin:0 0 10px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
h3{font-size:13px;margin:14px 0 6px}
p.lede{margin:0 0 16px;color:var(--dim)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px 16px;margin:0 0 14px}
.card.alarm{border-color:var(--bad-line);background:var(--bad-bg)}
.card.gapnote{border-color:var(--gap-line);background:var(--gap-bg)}
.grid{display:grid;gap:14px}
.g2{grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:1px;background:var(--line);
  border:1px solid var(--line);border-radius:8px;overflow:hidden;margin:0 0 14px}
.kpi{background:var(--panel);padding:10px 12px}
.kpi .n{font-size:22px;font-weight:650;line-height:1.15;font-variant-numeric:tabular-nums}
.kpi .l{color:var(--faint);font-size:11px;margin-top:2px}
.kpi.ok .n{color:var(--ok)} .kpi.bad .n{color:var(--bad)}
.kpi.warn .n{color:var(--warn)} .kpi.gap .n{color:var(--gap)}
.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
table{border-collapse:collapse;width:100%;font-size:12.5px}
th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{background:var(--panel-2);color:var(--dim);font-weight:600;white-space:nowrap;
  position:sticky;top:0;font-size:11px;letter-spacing:.04em;text-transform:uppercase}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover{background:var(--panel-2)}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;font-family:var(--mono)}
tr.future td{opacity:.4}
tr.here td{background:var(--panel-2);box-shadow:inset 3px 0 0 var(--accent)}
.badge{display:inline-block;border-radius:4px;padding:1px 6px;font-size:11px;white-space:nowrap;border:1px solid transparent}
.badge.ok{color:var(--ok);background:var(--ok-bg);border-color:var(--ok-line)}
.badge.warn{color:var(--warn);background:var(--warn-bg);border-color:var(--warn-line)}
.badge.bad{color:var(--bad);background:var(--bad-bg);border-color:var(--bad-line)}
.badge.gap{color:var(--gap);background:var(--gap-bg);border-color:var(--gap-line)}
.badge.ruled{color:var(--ruled);background:var(--ruled-bg);border-color:var(--ruled-line)}
.badge.neutral{color:var(--dim);background:var(--panel-2);border-color:var(--line)}
.ladder{display:inline-flex;gap:2px;vertical-align:middle}
.ladder .seg{width:13px;height:11px;border-radius:2px;border:1px solid var(--line-2);background:transparent;display:inline-block}
.ladder .seg.on{background:var(--dim);border-color:var(--dim)}
.ladder.e-ok .seg.on{background:var(--ok);border-color:var(--ok)}
.ladder.e-warn .seg.on{background:var(--warn);border-color:var(--warn)}
.ladder.e-bad .seg.on{background:var(--bad);border-color:var(--bad)}
.ladder.e-gap .seg.on{background:var(--gap);border-color:var(--gap)}
.ladder.t-ok .seg.on{background:var(--ok);border-color:var(--ok)}
.ladder.t-warn .seg.on{background:var(--warn);border-color:var(--warn)}
.ladder.t-ruled .seg.on{background:var(--ruled);border-color:var(--ruled)}
.ladder.t-neutral .seg.on{background:var(--dim);border-color:var(--dim)}
.ladder .seg.need{outline:2px solid var(--ink);outline-offset:1px}
/* 暂缺一律用斜纹灰，永远不会被误读成「绿=通过」 */
.ladder .seg.unavail{background:repeating-linear-gradient(45deg,var(--gap-line) 0 2px,transparent 2px 4px);
  border-style:dashed;border-color:var(--gap-line)}
.axes{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.axis{display:flex;gap:6px;align-items:center;white-space:nowrap}
.axis .k{color:var(--faint);font-size:11px}
.axis .v{font-size:11.5px;color:var(--dim);font-family:var(--mono)}
.legend{display:flex;gap:14px;flex-wrap:wrap;color:var(--faint);font-size:11.5px;margin-top:8px}
.matrix td.cell{text-align:center;font-variant-numeric:tabular-nums;font-family:var(--mono)}
.matrix td.cell.on{font-weight:700}
.matrix td.z{color:var(--faint)}
.bar{height:8px;border-radius:3px;background:var(--panel-2);overflow:hidden;display:flex;min-width:120px}
.bar i{display:block;height:100%}
.bar i.ok{background:var(--ok)} .bar i.warn{background:var(--warn)}
.bar i.bad{background:var(--bad)} .bar i.gap{background:var(--gap)}
.controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 10px}
.controls label{color:var(--dim);font-size:12px;display:flex;gap:5px;align-items:center}
.controls input[type=search],.controls select{background:var(--panel);color:var(--ink);
  border:1px solid var(--line-2);border-radius:5px;padding:3px 7px;font:inherit;font-size:12px}
.empty{padding:26px 16px;text-align:center;color:var(--gap);background:var(--gap-bg);
  border:1px dashed var(--gap-line);border-radius:8px}
.empty b{display:block;color:var(--ink);font-size:14px;margin-bottom:4px}
.cmd{display:flex;gap:8px;align-items:center;margin-top:6px}
.cmd code{flex:1;background:var(--panel-2);border:1px solid var(--line);border-radius:5px;
  padding:5px 8px;overflow-x:auto;white-space:pre;display:block}
.cmd button{background:var(--panel-2);border:1px solid var(--line-2);color:var(--dim);
  border-radius:5px;padding:4px 9px;cursor:pointer;font:inherit;font-size:12px;white-space:nowrap}
.stmt{color:var(--ink)}
.sub{color:var(--faint);font-size:11.5px}
dl.kv{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;margin:0}
dl.kv dt{color:var(--faint);font-size:11.5px}
dl.kv dd{margin:0}
ol.ev{list-style:none;margin:0;padding:0;border-left:2px solid var(--line);}
ol.ev li{position:relative;padding:6px 0 8px 16px}
ol.ev li::before{content:"";position:absolute;left:-5px;top:11px;width:8px;height:8px;border-radius:50%;
  background:var(--line-2);border:2px solid var(--panel)}
ol.ev li.up::before{background:var(--ok)}
.replay{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.replay input[type=range]{flex:1;min-width:200px;accent-color:var(--accent)}
pre.src{margin:0;overflow-x:auto;font-family:var(--mono);font-size:12px;line-height:1.5}
pre.src .ln{display:inline-block;width:4.5em;padding-right:1em;text-align:right;color:var(--faint);
  user-select:none;border-right:1px solid var(--line);margin-right:.9em}
pre.src mark{background:var(--warn-bg);color:inherit;display:inline-block;width:100%}
footer{max-width:1240px;margin:0 auto;padding:6px 18px 26px;color:var(--faint);font-size:11.5px}
`;

const SCRIPT = `
(function(){
  var K='vima-theme', d=document.documentElement, s=null;
  try{s=localStorage.getItem(K)}catch(e){}
  if(s)d.setAttribute('data-theme',s);
  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-theme-toggle]');
    if(t){
      var cur=d.getAttribute('data-theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
      var next=cur==='dark'?'light':'dark';
      d.setAttribute('data-theme',next);
      try{localStorage.setItem(K,next)}catch(err){}
      return;
    }
    var c=e.target.closest('[data-copy]');
    if(c){
      var txt=c.getAttribute('data-copy');
      var done=function(){var o=c.textContent;c.textContent='已复制';setTimeout(function(){c.textContent=o},1200)};
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done,function(){})}
      else{var ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();
        try{document.execCommand('copy');done()}catch(err){}document.body.removeChild(ta)}
    }
  });
  // 表格筛选 / 排序：行上带 data-*，没有 JS 时全部行照常显示（服务端已按关注度排好序）
  document.querySelectorAll('[data-table]').forEach(function(box){
    var tb=box.querySelector('tbody'); if(!tb) return;
    var rows=[].slice.call(tb.rows);
    var ctl=document.querySelector('[data-controls="'+box.getAttribute('data-table')+'"]');
    if(!ctl) return;
    function num(r,k){var v=r.getAttribute('data-'+k);if(v===''||v==null)return NaN;var n=Number(v);return isNaN(n)?NaN:n}
    function apply(){
      var q=(ctl.querySelector('[data-q]')||{}).value||'';
      q=q.trim().toLowerCase();
      var fs=[].slice.call(ctl.querySelectorAll('[data-filter]'));
      var vis=rows.filter(function(r){
        if(q&&(r.getAttribute('data-text')||'').indexOf(q)<0)return false;
        return fs.every(function(f){
          var k=f.getAttribute('data-filter'), v=f.type==='checkbox'?(f.checked?f.value:''):f.value;
          if(!v)return true;
          return (r.getAttribute('data-'+k)||'')===v;
        });
      });
      var sel=ctl.querySelector('[data-sort]');
      var key=sel?sel.value:'';
      if(key){
        var dir=key.charAt(0)==='-'?-1:1, k=key.replace(/^-/,'');
        vis=vis.slice().sort(function(a,b){
          var x=num(a,k), y=num(b,k);
          if(isNaN(x)&&isNaN(y))return 0;
          // 未声明一律排最前（两个方向都是）：「没标」不等于「没问题」
          if(isNaN(x))return -1;
          if(isNaN(y))return 1;
          return (x-y)*dir;
        });
      }
      rows.forEach(function(r){r.style.display='none'});
      vis.forEach(function(r){r.style.display='';tb.appendChild(r)});
      var n=box.querySelector('[data-count]')||document.querySelector('[data-count="'+box.getAttribute('data-table')+'"]');
      if(n)n.textContent=vis.length+' / '+rows.length;
    }
    ctl.addEventListener('input',apply); ctl.addEventListener('change',apply);
    apply();
  });
  var rp=document.querySelector('[data-replay]');
  if(rp){var out=document.querySelector('[data-replay-out]');
    rp.addEventListener('input',function(){if(out)out.textContent=rp.value});
    rp.addEventListener('change',function(){rp.form.submit()});}
})();
`;

const NAV = [
  ['/', '总览'],
  ['/claims', '命题与证据'],
  ['/rulings', '裁定台账'],
  ['/timeline', '过程回放'],
  ['/cost', '成本'],
];

function shell({ title, active, root, state, body }) {
  const n = state?.events?.length ?? 0;
  const nav = NAV.map(([href, label]) =>
    `<a href="${attr(href)}"${href === active ? ' class="on"' : ''}>${esc(label)}</a>`).join('');
  return `<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(title)} · vima 观测</title>
<style>${CSS}</style>
</head><body>
<header class="top"><div class="topin">
  <span class="brand">vima<small>观测平台</small></span>
  <nav class="main">${nav}</nav>
  <span class="spacer"></span>
  <span class="ro" title="本平台不提供任何写操作入口">只读 · ${n} 事件</span>
  <button class="tt" type="button" data-theme-toggle>明/暗</button>
</div></header>
<main>${body}</main>
<footer>项目根 <code>${esc(root)}</code> · 数据源 <code>.vima/events.jsonl</code>（append-only，唯一写入口）${
  state?.corrupt ? ` · <span class="badge bad">${state.corrupt} 行无法解析，已跳过</span>` : ''}</footer>
<script>${SCRIPT}</script>
</body></html>`;
}

function emptyState(title, detail) {
  return `<div class="empty"><b>${esc(title)}</b>${esc(detail)}</div>`;
}

/** 全局暂缺声明。四个页面都挂——「诚实呈现暂缺」是底线，不能只在一处提。 */
const GAP_CARD = `<div class="card gapnote">
  <h2>本平台已知的暂缺</h2>
  <p style="margin:0">
    <span class="badge gap">observed 暂缺</span>
    最强验证档 observed（真跑一遍界面）本轮<strong>未建采集设施</strong>，是已接受的风险。
    凡门槛声明为 observed 的命题，界面标注为「门槛暂不可达」并按<strong>未达标</strong>计，
    不按通过计，也不用更弱的证据顶替。斜纹格 <span class="ladder e-gap"><i class="seg unavail"></i></span> 一律表示暂缺。
  </p>
</div>`;

// ── 页面：总览 ──────────────────────────────────────────────────────────────

/** 导出仅为可测：它是 state 的纯函数，失效清单的渲染要能在合成投影上断言。 */
export function pageOverview(state) {
  const claims = [...state.claims.values()];
  const s = state.stats;
  if (claims.length === 0 && state.events.length === 0) {
    return `<h1>总览</h1><p class="lede">还没有任何事件——这个项目的观测面是空的。</p>
      ${emptyState('零事件', '事件由系统在取证后写入（agent 只能触发、不能自己写）。跑一次 compile / attest 之后这里才会有内容。')}
      ${GAP_CARD}`;
  }

  const stale = claims.filter((c) => c.stale);
  const noEv = claims.filter((c) => !c.stale && !best(c));
  const short = claims.filter((c) => !c.stale && best(c) && !meets(c));
  const met = claims.filter((c) => meets(c));

  // 失效清单：R3 的判据是「改完了 = 失效清单清空」，所以它是首页一等公民
  const staleCard = stale.length
    ? `<div class="card alarm">
        <h2 style="color:var(--bad)">失效清单 · ${stale.length} 条</h2>
        <p style="margin:0 0 8px">上游改过、下游证据已过期。<strong>「改完了」的判据就是这张表清空</strong>，不是谁觉得改完了。</p>
        <div class="tablewrap"><table>
          <thead><tr><th>命题</th><th>层</th><th>S 来源</th><th>E 验证</th><th>失效来自</th></tr></thead>
          <tbody>${stale.map((c) => `<tr>
            <td><a href="/claim/${encodeURIComponent(c.id)}"><code>${esc(c.id)}</code></a>
              <div class="sub">${esc(c.statement)}</div></td>
            <td>${esc(c.layer)}</td>
            <td>${trustLadder(c)}</td>
            <td>${strengthLadder(c)}</td>
            <td>${(c.from ?? []).map((f) => `<code>${esc(f)}</code>`).join(' ') || '<span class="sub">—</span>'}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`
    : `<div class="card"><h2>失效清单</h2>
        <p style="margin:0"><span class="badge ok">清空</span> 没有命题因上游变更而失效。
        （R3 的判据：改完了 = 这张表清空。）</p></div>`;

  const kpi = (n, l, tone = '') => `<div class="kpi ${tone}"><div class="n">${n}</div><div class="l">${esc(l)}</div></div>`;

  const deliverable = stale.length === 0 && short.length === 0 && noEv.length === 0;
  const readiness = `<div class="card">
    <h2>能交付吗</h2>
    <p style="margin:0 0 8px">
      ${deliverable
        ? '<span class="badge ok">全部命题均达到各自声明的门槛</span>'
        : `<span class="badge ${stale.length ? 'bad' : 'warn'}">还不能</span>
           <span class="sub">${stale.length} 失效 · ${short.length} 未达标 · ${noEv.length} 无证据</span>`}
    </p>
    <div class="bar" title="达标 / 未达标 / 无证据 / 失效">
      ${met.length ? `<i class="ok" style="width:${pct(met.length, claims.length)}%"></i>` : ''}
      ${short.length ? `<i class="warn" style="width:${pct(short.length, claims.length)}%"></i>` : ''}
      ${noEv.length ? `<i class="gap" style="width:${pct(noEv.length, claims.length)}%"></i>` : ''}
      ${stale.length ? `<i class="bad" style="width:${pct(stale.length, claims.length)}%"></i>` : ''}
    </div>
    <div class="legend">
      <span><span class="badge ok">达标 ${met.length}</span></span>
      <span><span class="badge warn">未达标 ${short.length}</span></span>
      <span><span class="badge gap">无证据 ${noEv.length}</span></span>
      <span><span class="badge bad">失效 ${stale.length}</span></span>
    </div>
  </div>`;

  // 门槛矩阵：每条命题自己声明要多硬（need），实际最强证据到哪一档（best）
  const needs = STRENGTH.filter((n) => claims.some((c) => c.need === n));
  const matrix = `<div class="card">
    <h2>证据强度分布 vs 各自声明的门槛</h2>
    <div class="tablewrap"><table class="matrix">
      <thead><tr><th>门槛 need ↓ / 实际 best →</th><th class="num">无证据</th>
        ${STRENGTH.map((s2) => `<th class="num"${s2 === 'observed' ? ` title="${attr(OBSERVED_GAP)}"` : ''}>${esc(s2)}${s2 === 'observed' ? ' *' : ''}</th>`).join('')}
        <th class="num">合计</th></tr></thead>
      <tbody>${needs.map((need) => {
        const row = claims.filter((c) => c.need === need);
        const none = row.filter((c) => !best(c)).length;
        const cells = STRENGTH.map((s2) => {
          const n = row.filter((c) => best(c)?.strength === s2).length;
          const passing = strengthRank(s2) >= strengthRank(need);
          const cls = n === 0 ? 'cell z' : `cell on ${passing ? 'pass' : ''}`;
          const color = n === 0 ? '' : passing ? ' style="color:var(--ok)"' : ' style="color:var(--warn)"';
          return `<td class="${cls}"${color}>${n || '·'}</td>`;
        }).join('');
        return `<tr><td><code>${esc(need)}</code>${need === 'observed' ? ` <span class="badge gap" title="${attr(OBSERVED_GAP)}">门槛暂不可达</span>` : ''}</td>
          <td class="cell${none ? '' : ' z'}"${none ? ' style="color:var(--gap)"' : ''}>${none || '·'}</td>
          ${cells}<td class="cell">${row.length}</td></tr>`;
      }).join('')}</tbody>
    </table></div>
    <div class="legend"><span>绿 = 达到该行门槛</span><span>黄 = 有证据但不够硬</span>
      <span>灰 = 一条证据也没有</span><span>* observed 列本轮无采集设施</span></div>
  </div>`;

  const rulings = state.rulings.slice().sort(byAttention);
  const pending = rulings.filter((r) => !r.overriddenBy);
  const topRulings = pending.slice(0, 5);
  const rulingCard = `<div class="card">
    <h2>AI 替我定的（最需要复核的 5 条）</h2>
    ${rulings.length === 0
      ? emptyState('暂无裁定', '不阻塞纪律下，需要人裁定的会先由 AI 定夺并记成 ruling 事件；现在一条也没有。')
      : `<div class="tablewrap"><table><thead><tr><th>问题</th><th>选了</th><th>置信</th><th>影响面</th></tr></thead>
        <tbody>${topRulings.map((r) => `<tr>
          <td><a href="/rulings#r-${encodeURIComponent(r.id)}">${esc(r.question || '（未记录问题）')}</a></td>
          <td>${esc(fmtVal(r.chosen)) || '<span class="sub">—</span>'}</td>
          <td><span class="badge ${confTone(r.confidence)}">${esc(confLabel(r.confidence))}</span></td>
          <td>${blastSize(r.blastRadius) == null
            ? '<span class="badge gap">未声明</span>'
            : `<span class="mono">${esc(blastLabel(r.blastRadius))}</span>`}</td>
        </tr>`).join('')}</tbody></table></div>
        <p class="sub" style="margin:8px 0 0">共 ${rulings.length} 条，${pending.length} 条未复核 ·
          <a href="/rulings">看完整台账（可排序筛选）</a></p>`}
  </div>`;

  const cost = s.cost ?? { tokens: 0, ms: 0 };
  return `<h1>总览</h1>
  <p class="lede">全部数字都来自同一处投影 <code>project(events)</code>，页面之间不存在第二份口径。</p>
  <div class="kpis">
    ${kpi(claims.length, '命题')}
    ${kpi(met.length, '达标', met.length === claims.length && claims.length ? 'ok' : '')}
    ${kpi(stale.length, '失效（R3 判据）', stale.length ? 'bad' : '')}
    ${kpi(noEv.length, '无证据', noEv.length ? 'gap' : '')}
    ${kpi(pending.length, 'AI 裁定待复核', pending.length ? 'warn' : '')}
    ${kpi(fmtNum(cost.tokens), '累计 tokens')}
  </div>
  ${staleCard}
  ${readiness}
  <div class="grid g2">${matrix}${rulingCard}</div>
  ${GAP_CARD}`;
}

// ── 页面：命题与证据 ────────────────────────────────────────────────────────

function pageClaims(state) {
  const claims = [...state.claims.values()];
  if (claims.length === 0) {
    return `<h1>命题与证据</h1>
      ${emptyState('还没有命题', '命题是事件流的投影、不存盘。没有 claim 事件时这里如实为空。')}
      ${GAP_CARD}`;
  }
  const order = { stale: 0, none: 1, short: 2, met: 3 };
  claims.sort((a, b) => {
    const d = order[claimStatus(a).key] - order[claimStatus(b).key];
    if (d) return d;
    const l = LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer);
    return l || a.id.localeCompare(b.id);
  });

  const rows = claims.map((c) => {
    const st = claimStatus(c);
    const b = best(c);
    const text = `${c.id} ${c.statement} ${c.layer} ${c.trust} ${c.need}`.toLowerCase();
    return `<tr data-status="${attr(st.key)}" data-layer="${attr(c.layer)}" data-trust="${attr(c.trust)}"
      data-text="${attr(text)}" data-evrank="${b ? strengthRank(b.strength) : -1}" data-trank="${trustRank(c.trust)}">
      <td><a href="/claim/${encodeURIComponent(c.id)}"><code>${esc(c.id)}</code></a>
        <div class="sub">${esc(c.statement) || '（无陈述）'}</div></td>
      <td><span class="badge neutral">${esc(c.layer)}</span></td>
      <td>${trustLadder(c)} <span class="axis"><span class="v">${esc(c.trust)}</span></span>
        ${c.source ? `<div class="sub">${esc(fmtVal(c.source))}</div>` : '<div class="sub">来源未记</div>'}</td>
      <td>${strengthLadder(c)} <span class="axis"><span class="v">${b ? esc(b.strength) : '无证据'} / 需 ${esc(c.need)}</span></span>
        ${b?.by ? `<div class="sub">取证 ${esc(fmtVal(b.by))}</div>` : '<div class="sub">—</div>'}</td>
      <td>${statusBadge(c)}</td>
      <td class="num">${c.evidence.length}</td>
      <td class="num">r${c.revision}</td>
    </tr>`;
  }).join('');

  const layerOpts = LAYERS.filter((l) => claims.some((c) => c.layer === l))
    .map((l) => `<option value="${attr(l)}">${esc(l)}</option>`).join('');

  return `<h1>命题与证据</h1>
  <p class="lede"><strong>两个强度轴并列显示，永远同屏</strong>：S 来源可信度答「这条凭什么进来」，
    E 验证强度答「这条做到了没有」。只看一轴会以为整条链都很硬——断点通常在另一轴上。</p>
  <div class="card" style="padding:10px 14px">
    <div class="controls" data-controls="claims">
      <label>搜索 <input type="search" data-q placeholder="id / 陈述 / 层"></label>
      <label>状态 <select data-filter="status">
        <option value="">全部</option><option value="stale">失效</option>
        <option value="none">无证据</option><option value="short">未达标</option><option value="met">达标</option>
      </select></label>
      <label>层 <select data-filter="layer"><option value="">全部</option>${layerOpts}</select></label>
      <label>排序 <select data-sort>
        <option value="">默认（问题优先）</option>
        <option value="evrank">E 验证强度 ↑</option>
        <option value="-evrank">E 验证强度 ↓</option>
        <option value="trank">S 来源可信度 ↑</option>
        <option value="-trank">S 来源可信度 ↓</option>
      </select></label>
      <span class="sub" data-count="claims"></span>
    </div>
    <div class="tablewrap" data-table="claims"><table>
      <thead><tr><th>命题</th><th>层</th><th>S 来源可信度</th><th>E 验证强度（含门槛）</th><th>状态</th><th class="num">证据</th><th class="num">修订</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="legend">
      <span>S 阶梯：ruled → stated → superseded → fact</span>
      <span>E 阶梯：claimed → derived → executed → observed</span>
      <span>黑框格 = 该命题声明的门槛</span>
      <span>斜纹格 = 暂缺（无采集设施）</span>
    </div>
  </div>
  ${GAP_CARD}`;
}

// ── 页面：单条命题 ──────────────────────────────────────────────────────────

function implLink(v) {
  const s = String(v ?? '');
  const m = /^(.+?)(?::(\d+))?$/.exec(s);
  if (!m || !s.includes('/')) return `<code>${esc(s)}</code>`;
  const href = `/file/${m[1].split('/').map(encodeURIComponent).join('/')}${m[2] ? `?line=${m[2]}#L${m[2]}` : ''}`;
  return `<a href="${attr(href)}"><code>${esc(s)}</code></a>`;
}

function pageClaim(state, id) {
  const c = state.claims.get(id);
  if (!c) return null;
  const st = claimStatus(c);
  const b = best(c);
  const downstream = [...state.claims.values()].filter((o) => (o.from ?? []).includes(id));
  const related = state.events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.subject === id);

  // 证据怎么一步步变强 —— 这是回放要求在单条命题上的落点
  let running = -1;
  const ladderHistory = c.evidence.map((ev) => {
    const r = strengthRank(ev.strength);
    const up = r > running;
    if (up) running = r;
    return { ev, up, running };
  });

  const rulingsHere = state.rulings.filter(
    (r) => r.chosen === id || String(r.question ?? '').includes(id) || (Array.isArray(r.blastRadius) && r.blastRadius.includes(id)),
  );

  return `<h1><code>${esc(c.id)}</code> ${statusBadge(c)}</h1>
  <p class="lede">${esc(c.statement) || '（无陈述）'}</p>

  <div class="grid g2">
    <div class="card">
      <h2>S · 来源可信度（这条凭什么进来）</h2>
      <div class="axes">${trustLadder(c)}
        <span class="badge ${c.trust === 'fact' ? 'ok' : c.trust === 'superseded' ? 'warn' : c.trust === 'ruled' ? 'ruled' : 'neutral'}">${esc(TRUST_LABEL[c.trust] ?? c.trust)}</span></div>
      <dl class="kv" style="margin-top:10px">
        <dt>来源</dt><dd>${c.source ? esc(fmtVal(c.source)) : '<span class="badge gap">未记录</span>'}</dd>
        <dt>层</dt><dd><code>${esc(c.layer)}</code></dd>
        <dt>修订</dt><dd>r${c.revision}</dd>
      </dl>
      ${c.trust === 'superseded' ? '<p class="sub" style="margin:8px 0 0">来源已被取代：实现再扎实，上游也已经不算数了。</p>' : ''}
      ${c.trust === 'ruled' ? '<p class="sub" style="margin:8px 0 0">这条是 AI 替你定的 —— 见 <a href="/rulings">裁定台账</a>。</p>' : ''}
    </div>
    <div class="card">
      <h2>E · 验证强度（这条做到了没有）</h2>
      <div class="axes">${strengthLadder(c)}
        <span class="badge ${st.tone}">${b ? esc(STRENGTH_LABEL[b.strength]) : '无证据'}</span>
        <span class="sub">门槛 <code>${esc(c.need)}</code></span></div>
      <dl class="kv" style="margin-top:10px">
        <dt>状态</dt><dd>${statusBadge(c)}${st.note ? `<div class="sub">${esc(st.note)}</div>` : ''}</dd>
        <dt>取证方式</dt><dd>${b?.by ? `<code>${esc(fmtVal(b.by))}</code>` : '<span class="badge gap">无</span>'}</dd>
        <dt>失效</dt><dd>${c.stale ? '<span class="badge bad">是（上游已变更）</span>' : '否'}</dd>
      </dl>
    </div>
  </div>

  <div class="card">
    <h2>证据是怎么一步步变强的</h2>
    ${c.evidence.length === 0
      ? emptyState('一条证据也没有', '这不是「暂时没显示」，是真的没有。取证由系统做，agent 说做完了不算数。')
      : `<ol class="ev">${ladderHistory.map(({ ev, up, running: r }) => `<li class="${up ? 'up' : ''}">
          <div><span class="badge ${up ? 'ok' : 'neutral'}">${esc(ev.strength)}</span>
            <span class="sub">${esc(fmtTs(ev.at))}</span>
            ${up ? `<span class="sub">→ 当时最强 ${esc(STRENGTH[r])}</span>` : '<span class="sub">未提升当时最强档</span>'}</div>
          <div class="sub">取证方式 ${ev.by ? `<code>${esc(fmtVal(ev.by))}</code>` : '未记录（与自称无异）'}</div>
          ${ev.detail ? `<div class="sub">${esc(fmtVal(ev.detail))}</div>` : ''}
        </li>`).join('')}</ol>`}
  </div>

  <div class="grid g2">
    <div class="card">
      <h2>上游（编译边 from）</h2>
      ${(c.from ?? []).length === 0 ? '<p class="sub" style="margin:0">无上游。</p>'
        : `<ul style="margin:0;padding-left:18px">${c.from.map((f) => {
          const up = state.claims.get(f);
          return `<li><a href="/claim/${encodeURIComponent(f)}"><code>${esc(f)}</code></a>
            ${up ? statusBadge(up) : '<span class="badge bad">上游命题不存在</span>'}</li>`;
        }).join('')}</ul>`}
      <h3>下游</h3>
      ${downstream.length === 0 ? '<p class="sub" style="margin:0">无下游。</p>'
        : `<ul style="margin:0;padding-left:18px">${downstream.map((d) => `<li>
            <a href="/claim/${encodeURIComponent(d.id)}"><code>${esc(d.id)}</code></a> ${statusBadge(d)}</li>`).join('')}</ul>`}
    </div>
    <div class="card">
      <h2>实现边（落在哪些符号上）</h2>
      ${(c.impl ?? []).length === 0
        ? '<p class="sub" style="margin:0">没有实现边。提取能力只到文件级——没有标注就连不上。</p>'
        : `<ul style="margin:0;padding-left:18px">${c.impl.map((i) => `<li>${implLink(i)}</li>`).join('')}</ul>`}
      ${rulingsHere.length ? `<h3>相关裁定</h3><ul style="margin:0;padding-left:18px">${rulingsHere.map((r) => `<li>
        <a href="/rulings#r-${encodeURIComponent(r.id)}">${esc(r.question || r.id)}</a>
        <span class="badge ${confTone(r.confidence)}">${esc(confLabel(r.confidence))}</span></li>`).join('')}</ul>` : ''}
    </div>
  </div>

  <div class="card">
    <h2>相关事件（${related.length}）</h2>
    ${related.length === 0 ? '<p class="sub" style="margin:0">无。</p>' : `<div class="tablewrap"><table>
      <thead><tr><th>时间</th><th>种类</th><th>actor</th><th>内容</th><th>回放</th></tr></thead>
      <tbody>${related.map(({ e, i }) => `<tr>
        <td class="mono">${esc(fmtTs(e.ts))}</td>
        <td><span class="badge neutral">${esc(e.kind)}</span></td>
        <td>${esc(e.actor)}</td>
        <td class="sub">${esc(eventSummary(e))}</td>
        <td><a href="/timeline?at=${i + 1}#e${i}">回到此刻</a></td>
      </tr>`).join('')}</tbody></table></div>`}
  </div>`;
}

// ── 页面：裁定台账 ──────────────────────────────────────────────────────────

function pageRulings(state) {
  const rulings = state.rulings.slice().sort(byAttention);
  if (rulings.length === 0) {
    return `<h1>裁定台账</h1>
      <p class="lede">不阻塞（C4）：需要人裁定的先由 AI 定夺 → 记成 ruling → 在这里等你复核。</p>
      ${emptyState('暂无裁定', 'AI 还没有替你定过任何事——或者定了但没走 ruling 事件（那样它不会出现在任何地方，属于流程漏采）。')}`;
  }
  const pending = rulings.filter((r) => !r.overriddenBy).length;
  const unrated = rulings.filter((r) => confRank(r.confidence) < 0 || blastSize(r.blastRadius) == null).length;

  const rows = rulings.map((r) => {
    const bs = blastSize(r.blastRadius);
    const text = `${r.question} ${fmtVal(r.chosen)} ${r.rationale} ${r.actor}`.toLowerCase();
    const cmd = overrideCommand(r);
    return `<tr id="r-${attr(r.id)}"
      data-conf="${confRank(r.confidence) < 0 ? '' : confRank(r.confidence)}"
      data-blast="${bs == null ? '' : bs}"
      data-review="${r.overriddenBy ? 'done' : 'open'}"
      data-level="${attr(confBucket(r.confidence))}"
      data-text="${attr(text)}">
      <td>
        <div class="stmt">${esc(r.question) || '（未记录问题）'}</div>
        <div class="sub">${esc(fmtTs(r.at))} · ${esc(r.actor)}${r.overriddenBy ? ` · <span class="badge ok">已复核：${esc(fmtVal(r.overriddenBy))}</span>` : ''}</div>
      </td>
      <td>
        <div>${esc(fmtVal(r.chosen)) || '<span class="sub">—</span>'}</div>
        ${(r.options ?? []).length > 1 ? `<div class="sub">备选 ${r.options.filter((o) => o !== r.chosen).map((o) => esc(fmtVal(o))).join(' / ')}</div>` : ''}
        ${r.rationale ? `<div class="sub">${esc(r.rationale)}</div>` : ''}
      </td>
      <td><span class="badge ${confTone(r.confidence)}">${esc(confLabel(r.confidence))}</span></td>
      <td>${bs == null
        ? `<span class="badge gap" title="未声明不等于影响面小，排序时按最需关注处理">未声明</span>`
        : `<span class="mono">${esc(blastLabel(r.blastRadius))}</span>`}</td>
      <td style="min-width:280px">
        <div class="sub">二次裁决不在这里写盘 —— 复制这条命令去跑，它就是再记一条裁定，走 R3 同一条传播链路：</div>
        <div class="cmd"><code>${esc(cmd)}</code>
          <button type="button" data-copy="${attr(cmd)}">复制</button></div>
        ${r.overriddenBy ? '' : '<div class="sub">跑完本条即转「已复核」：<code>--overrides</code> 把新裁定结构化地指向它，投影据此回填 overriddenBy，关联命题随之修订并走同一条失效传播链路。</div>'}
      </td>
    </tr>`;
  }).join('');

  return `<h1>裁定台账 · AI 替我定的</h1>
  <p class="lede">默认按<strong>最需要关注</strong>排序：未复核在前 → 低置信在前 → 大影响面在前。
    <strong>未声明 confidence / blastRadius 一律排最前</strong>，因为「没标」不等于「没问题」。
    一份人不看的流水账，和一张永远消不掉的告警表是同一个东西。</p>
  <div class="kpis">
    <div class="kpi"><div class="n">${rulings.length}</div><div class="l">裁定总数</div></div>
    <div class="kpi ${pending ? 'warn' : 'ok'}"><div class="n">${pending}</div><div class="l">未复核</div></div>
    <div class="kpi ${unrated ? 'gap' : ''}"><div class="n">${unrated}</div><div class="l">置信/影响面未声明</div></div>
  </div>
  <div class="card" style="padding:10px 14px">
    <div class="controls" data-controls="rulings">
      <label>搜索 <input type="search" data-q placeholder="问题 / 选项 / 理由 / actor"></label>
      <label>置信 <select data-filter="level">
        <option value="">全部</option><option value="未声明">未声明</option>
        <option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
      </select></label>
      <label><input type="checkbox" data-filter="review" value="open"> 只看未复核</label>
      <label>排序 <select data-sort>
        <option value="">默认（关注度）</option>
        <option value="conf">置信 ↑（低的在前）</option>
        <option value="-conf">置信 ↓</option>
        <option value="-blast">影响面 ↓（大的在前）</option>
        <option value="blast">影响面 ↑</option>
      </select></label>
      <span class="sub" data-count="rulings"></span>
    </div>
    <div class="tablewrap" data-table="rulings"><table>
      <thead><tr><th>问题</th><th>定了什么</th><th>置信</th><th>影响面</th><th>二次裁决</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

// ── 页面：过程回放 ──────────────────────────────────────────────────────────

function eventSummary(e) {
  const p = e.payload ?? {};
  switch (e.kind) {
    case 'claim': return `${p.layer ?? ''} ${p.statement ?? ''}${p.trust ? ` · trust=${p.trust}` : ''}${p.need ? ` · need=${p.need}` : ''}`.trim();
    case 'evidence': return `strength=${p.strength ?? '?'}${p.by ? ` · by=${fmtVal(p.by)}` : ' · 取证方式未记'}${p.detail ? ` · ${fmtVal(p.detail)}` : ''}`;
    case 'ruling': return `${p.question ?? ''} → ${fmtVal(p.chosen)} · confidence=${p.confidence ?? '未声明'}`;
    case 'run': return `${p.op ?? 'unknown'}${e.cost ? ` · ${Object.entries(e.cost).map(([k, v]) => `${k}=${fmtVal(v)}`).join(' ')}` : ''}`;
    default: return fmtVal(p);
  }
}

function pageTimeline(state, query) {
  const events = state.events;
  const n = events.length;
  if (n === 0) {
    return `<h1>过程回放</h1>
      <p class="lede">事件流 append-only，所以任何一个时间点的状态都能重建。</p>
      ${emptyState('零事件', '没有事件就没有过程。这里如实为空，不做任何推测性填充。')}`;
  }
  const raw = Number.parseInt(query.get('at') ?? '', 10);
  const at = Number.isFinite(raw) ? Math.max(0, Math.min(raw, n)) : n;
  const snap = at === n ? state : snapshotAt(events, at);
  const live = at === n;

  // actor 维度：谁做的
  const actors = new Map();
  for (const e of events.slice(0, at)) {
    let a = actors.get(e.actor);
    if (!a) { a = { actor: e.actor, total: 0, kinds: {}, tokens: 0, ms: 0 }; actors.set(e.actor, a); }
    a.total += 1;
    a.kinds[e.kind] = (a.kinds[e.kind] ?? 0) + 1;
    if (typeof e.cost?.tokens === 'number') a.tokens += e.cost.tokens;
    if (typeof e.cost?.ms === 'number') a.ms += e.cost.ms;
  }
  const actorRows = [...actors.values()].sort((a, b) => b.total - a.total);

  const kindFilter = query.get('kind') ?? '';
  const actorFilter = query.get('actor') ?? '';

  const rows = events.map((e, i) => {
    const future = i >= at;
    const here = i === at - 1;
    const hidden = (kindFilter && e.kind !== kindFilter) || (actorFilter && e.actor !== actorFilter);
    if (hidden) return '';
    return `<tr id="e${i}" class="${future ? 'future' : ''}${here ? ' here' : ''}">
      <td class="num">${i + 1}</td>
      <td class="mono">${esc(fmtTs(e.ts))}</td>
      <td><span class="badge ${e.kind === 'ruling' ? 'ruled' : 'neutral'}">${esc(e.kind)}</span></td>
      <td>${esc(e.actor)}</td>
      <td>${e.subject
        ? (state.claims.has(e.subject)
          ? `<a href="/claim/${encodeURIComponent(e.subject)}"><code>${esc(e.subject)}</code></a>`
          : `<code>${esc(e.subject)}</code>`)
        : '<span class="sub">—</span>'}</td>
      <td class="sub">${esc(eventSummary(e))}</td>
      <td><a href="?at=${i + 1}${kindFilter ? `&kind=${encodeURIComponent(kindFilter)}` : ''}${actorFilter ? `&actor=${encodeURIComponent(actorFilter)}` : ''}#e${i}">停在这</a></td>
    </tr>`;
  }).join('');

  const snapClaims = [...snap.claims.values()];
  const snapMet = snapClaims.filter((c) => meets(c)).length;
  const snapStale = snapClaims.filter((c) => c.stale).length;
  const snapNone = snapClaims.filter((c) => !best(c)).length;

  const opt = (v, cur, label) => `<option value="${attr(v)}"${v === cur ? ' selected' : ''}>${esc(label ?? (v || '全部'))}</option>`;

  return `<h1>过程回放</h1>
  <p class="lede">事件是 append-only 的，因此「第 k 条事件之后世界长什么样」可以精确重建——
    下面的快照就是 <code>project(events.slice(0, ${at}))</code> 的结果，不是估算。</p>

  <div class="card">
    <h2>回放位置 ${live ? '<span class="badge ok">最新</span>' : `<span class="badge warn">回放中：第 ${at} / ${n} 条之后</span>`}</h2>
    <form method="get" class="replay">
      ${kindFilter ? `<input type="hidden" name="kind" value="${attr(kindFilter)}">` : ''}
      ${actorFilter ? `<input type="hidden" name="actor" value="${attr(actorFilter)}">` : ''}
      <a href="?at=0">⏮ 起点</a>
      <input type="range" name="at" min="0" max="${n}" value="${at}" data-replay>
      <output data-replay-out class="mono">${at}</output>
      <button class="tt" type="submit">跳转</button>
      <a href="?at=${n}">最新 ⏭</a>
    </form>
    <div class="kpis" style="margin-top:12px">
      <div class="kpi"><div class="n">${snapClaims.length}</div><div class="l">当时的命题数</div></div>
      <div class="kpi ${snapMet ? 'ok' : ''}"><div class="n">${snapMet}</div><div class="l">当时达标</div></div>
      <div class="kpi ${snapStale ? 'bad' : ''}"><div class="n">${snapStale}</div><div class="l">当时失效</div></div>
      <div class="kpi ${snapNone ? 'gap' : ''}"><div class="n">${snapNone}</div><div class="l">当时无证据</div></div>
      <div class="kpi"><div class="n">${snap.rulings.length}</div><div class="l">当时的裁定</div></div>
    </div>
    ${snapClaims.length === 0
      ? '<p class="sub" style="margin:0">这一刻还没有任何命题。</p>'
      : `<div class="tablewrap"><table>
        <thead><tr><th>命题</th><th>S</th><th>E（当时）</th><th>当时状态</th></tr></thead>
        <tbody>${snapClaims.map((c) => `<tr>
          <td><a href="/claim/${encodeURIComponent(c.id)}"><code>${esc(c.id)}</code></a></td>
          <td>${trustLadder(c)}</td>
          <td>${strengthLadder(c)} <span class="v mono">${best(c)?.strength ?? '无证据'} / 需 ${esc(c.need)}</span></td>
          <td>${statusBadge(c)}</td>
        </tr>`).join('')}</tbody></table></div>`}
  </div>

  <div class="card">
    <h2>谁做的（actor 维度，截至第 ${at} 条）</h2>
    ${actorRows.length === 0 ? '<p class="sub" style="margin:0">这一刻还没有任何人做过事。</p>' : `<div class="tablewrap"><table>
      <thead><tr><th>actor</th><th class="num">事件</th><th class="num">claim</th><th class="num">evidence</th>
        <th class="num">ruling</th><th class="num">run</th><th class="num">tokens</th><th class="num">ms</th></tr></thead>
      <tbody>${actorRows.map((a) => `<tr>
        <td><a href="?at=${at}&actor=${encodeURIComponent(a.actor)}">${esc(a.actor)}</a></td>
        <td class="num">${a.total}</td>
        <td class="num">${a.kinds.claim ?? 0}</td><td class="num">${a.kinds.evidence ?? 0}</td>
        <td class="num">${a.kinds.ruling ?? 0}</td><td class="num">${a.kinds.run ?? 0}</td>
        <td class="num">${a.tokens ? fmtNum(a.tokens) : '—'}</td><td class="num">${a.ms ? fmtNum(a.ms) : '—'}</td>
      </tr>`).join('')}</tbody></table></div>`}
  </div>

  <div class="card" style="padding:10px 14px">
    <form method="get" class="controls">
      <input type="hidden" name="at" value="${at}">
      <label>种类 <select name="kind">${['', 'claim', 'evidence', 'ruling', 'run'].map((k) => opt(k, kindFilter)).join('')}</select></label>
      <label>actor <select name="actor">${['', ...actorRows.map((a) => a.actor)].map((k) => opt(k, actorFilter)).join('')}</select></label>
      <button class="tt" type="submit">筛选</button>
      ${kindFilter || actorFilter ? `<a href="?at=${at}">清除</a>` : ''}
      <span class="sub">灰行 = 回放位置之后尚未发生</span>
    </form>
    <div class="tablewrap"><table>
      <thead><tr><th class="num">#</th><th>时间</th><th>种类</th><th>actor</th><th>subject</th><th>内容</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7" class="sub">没有匹配的事件。</td></tr>'}</tbody>
    </table></div>
  </div>`;
}

// ── 页面：成本 ──────────────────────────────────────────────────────────────

function pageCost(state) {
  const runs = state.runs;
  if (runs.length === 0) {
    return `<h1>成本</h1>
      <p class="lede">成本来自 run 事件上的 <code>cost</code>，没有第二处口径。</p>
      ${emptyState('没有 run 事件', '一次代理执行都没有被记录，因此花费未知——注意是「未知」，不是「零」。')}`;
  }
  const keys = costKeys(runs);
  const priced = runs.filter((r) => r.cost).length;
  const groups = [
    ['按环节（op）', groupCost(runs, (r) => r.op, keys), '环节'],
    ['按代理（actor）', groupCost(runs, (r) => r.actor, keys), '代理'],
    ['按任务（subject）', groupCost(runs, (r) => r.subject, keys), '任务'],
  ];

  const totals = Object.fromEntries(keys.map((k) => [k, runs.reduce((a, r) => a + (typeof r.cost?.[k] === 'number' ? r.cost[k] : 0), 0)]));

  return `<h1>成本</h1>
  <p class="lede">口径唯一：run 事件的 <code>cost</code> 字段。没记 cost 的 run 单独计数——
    不摊平、不估算，缺就是缺。</p>
  <div class="kpis">
    <div class="kpi"><div class="n">${runs.length}</div><div class="l">run 事件</div></div>
    ${runs.length !== priced ? `<div class="kpi gap"><div class="n">${runs.length - priced}</div><div class="l">未记 cost（花费未知）</div></div>` : ''}
    ${keys.map((k) => `<div class="kpi"><div class="n">${fmtNum(totals[k])}</div><div class="l">合计 ${esc(k)}</div></div>`).join('')}
  </div>
  ${keys.length === 0 ? `<div class="card gapnote"><p style="margin:0">
      <span class="badge gap">全部 run 都没有 cost</span> 有执行记录但没有花费数据，界面不替它编一个数字。</p></div>` : ''}
  ${groups.map(([title, rows, unit]) => `<div class="card">
    <h2>${esc(title)}</h2>
    <div class="tablewrap"><table>
      <thead><tr><th>${esc(unit)}</th><th class="num">run</th><th class="num">有 cost</th>
        ${keys.map((k) => `<th class="num">${esc(k)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td><code>${esc(r.key)}</code></td>
        <td class="num">${r.n}</td>
        <td class="num">${r.priced === r.n ? r.priced : `<span class="badge gap">${r.priced}/${r.n}</span>`}</td>
        ${keys.map((k) => `<td class="num">${fmtNum(r.sums[k])}</td>`).join('')}
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`).join('')}
  <div class="card">
    <h2>明细</h2>
    <div class="tablewrap"><table>
      <thead><tr><th>时间</th><th>op</th><th>actor</th><th>subject</th>
        ${keys.map((k) => `<th class="num">${esc(k)}</th>`).join('')}</tr></thead>
      <tbody>${runs.slice().reverse().map((r) => `<tr>
        <td class="mono">${esc(fmtTs(r.at))}</td>
        <td><code>${esc(r.op)}</code></td>
        <td>${esc(r.actor)}</td>
        <td>${r.subject
          ? (state.claims.has(r.subject)
            ? `<a href="/claim/${encodeURIComponent(r.subject)}"><code>${esc(r.subject)}</code></a>`
            : `<code>${esc(r.subject)}</code>`)
          : '<span class="sub">—</span>'}</td>
        ${keys.map((k) => `<td class="num">${typeof r.cost?.[k] === 'number' ? fmtNum(r.cost[k]) : '<span class="sub">未记</span>'}</td>`).join('')}
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

// ── 页面：文件查看（只读出口） ──────────────────────────────────────────────

function pageFile(rel, text, highlight) {
  const lines = text.split('\n');
  const body = lines.map((l, i) => {
    const no = i + 1;
    const row = `<span class="ln">${no}</span>${esc(l)}`;
    return no === highlight ? `<mark id="L${no}">${row}</mark>` : `<span id="L${no}">${row}</span>`;
  }).join('\n');
  return `<h1>${esc(rel)}</h1>
  <p class="lede">只读出口 · ${lines.length} 行 · <a href="/file/${rel.split('/').map(encodeURIComponent).join('/')}?raw=1">纯文本</a></p>
  <div class="card"><pre class="src">${body}</pre></div>`;
}

// ── 路由 ────────────────────────────────────────────────────────────────────

function send(res, status, body, type = 'text/html; charset=utf-8') {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    // 只读界面全自包含（内联 CSS/JS，不引 CDN），因此可以把外联能力整个关掉
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; form-action 'self'",
    'referrer-policy': 'no-referrer',
  });
  res.end(body);
}

function errorPage(root, state, status, title, detail) {
  return shell({
    title, active: '', root, state,
    body: `<h1>${esc(status)} ${esc(title)}</h1>${emptyState(title, detail)}<p><a href="/">回总览</a></p>`,
  });
}

async function handle(req, res, { root }) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // 只读平台：没有任何写入口。写只有一条路——events.append，人和 agent 都走它。
    send(res, 405, '仅支持 GET —— 观测平台是只读的\n', 'text/plain; charset=utf-8');
    return;
  }

  // 只绑回环还不够：浏览器会把外部域名解析到 127.0.0.1（DNS rebinding），
  // 那时同一个 /file/* 出口就能被任意网页读走整个仓库。Host 一并校验。
  const host = String(req.headers.host ?? '');
  const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  if (hostname && !['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
    send(res, 403, '仅接受来自回环地址的请求\n', 'text/plain; charset=utf-8');
    return;
  }

  let url;
  try {
    url = new URL(req.url, 'http://127.0.0.1');
  } catch {
    send(res, 400, '无法解析的 URL\n', 'text/plain; charset=utf-8');
    return;
  }
  const pathname = url.pathname;
  const q = url.searchParams;

  // /file/* —— 唯一的文件出口，穿越防护在 resolveInRoot + realpath 两道
  if (pathname === '/file' || pathname.startsWith('/file/')) {
    const rel = pathname.slice('/file/'.length);
    const abs = resolveInRoot(root, rel);
    if (!abs) {
      send(res, 403, '路径越界：只读出口只服务项目根以内的文件\n', 'text/plain; charset=utf-8');
      return;
    }
    if (!(await insideRoot(root, abs))) {
      send(res, 404, '文件不存在或不可读\n', 'text/plain; charset=utf-8');
      return;
    }
    let st;
    try { st = await stat(abs); } catch { st = null; }
    if (!st || !st.isFile()) {
      send(res, 404, '文件不存在或不是普通文件\n', 'text/plain; charset=utf-8');
      return;
    }
    if (st.size > MAX_VIEW_BYTES) {
      send(res, 413, `文件 ${st.size} 字节，超过查看上限 ${MAX_VIEW_BYTES}\n`, 'text/plain; charset=utf-8');
      return;
    }
    const buf = await readFile(abs);
    if (buf.subarray(0, 4096).includes(0)) {
      send(res, 415, '二进制文件，本平台不渲染\n', 'text/plain; charset=utf-8');
      return;
    }
    const text = buf.toString('utf8');
    if (q.get('raw')) {
      // 一律 text/plain：仓库里的 .html 不能被当页面执行
      send(res, 200, text, 'text/plain; charset=utf-8');
      return;
    }
    const line = Number.parseInt(q.get('line') ?? '', 10);
    const state = await loadState(root);
    send(res, 200, shell({
      title: path.posix.basename(decodeURIComponent(rel)),
      active: '', root, state,
      body: pageFile(decodeURIComponent(rel), text, Number.isFinite(line) ? line : 0),
    }));
    return;
  }

  const state = await loadState(root);

  if (pathname === '/' || pathname === '') {
    send(res, 200, shell({ title: '总览', active: '/', root, state, body: pageOverview(state) }));
    return;
  }
  if (pathname === '/claims') {
    send(res, 200, shell({ title: '命题与证据', active: '/claims', root, state, body: pageClaims(state) }));
    return;
  }
  if (pathname.startsWith('/claim/')) {
    const id = decodeURIComponent(pathname.slice('/claim/'.length));
    const body = pageClaim(state, id);
    if (!body) {
      send(res, 404, errorPage(root, state, 404, '没有这条命题', `事件流里不存在 id 为 ${id} 的命题。命题是投影，不存盘——只有 claim 事件能造出它。`));
      return;
    }
    send(res, 200, shell({ title: id, active: '/claims', root, state, body }));
    return;
  }
  if (pathname === '/rulings') {
    send(res, 200, shell({ title: '裁定台账', active: '/rulings', root, state, body: pageRulings(state) }));
    return;
  }
  if (pathname === '/timeline') {
    send(res, 200, shell({ title: '过程回放', active: '/timeline', root, state, body: pageTimeline(state, q) }));
    return;
  }
  if (pathname === '/cost') {
    send(res, 200, shell({ title: '成本', active: '/cost', root, state, body: pageCost(state) }));
    return;
  }
  send(res, 404, errorPage(root, state, 404, '没有这个页面', `${pathname} 不是本平台的路由。`));
}

/**
 * 造一个未监听的 server。测试与 `vima ui` 共用同一个请求处理，不存在第二套。
 */
export function createServer({ root } = {}) {
  if (!root) throw new Error('createServer 需要项目根');
  const server = http.createServer((req, res) => {
    handle(req, res, { root }).catch((err) => {
      if (res.headersSent) { res.end(); return; }
      send(res, 500, `观测平台内部错误：${err?.message ?? err}\n`, 'text/plain; charset=utf-8');
    });
  });
  return server;
}

/**
 * 起服务。按需起、不常驻——`vima ui` 调它，人关掉就结束。
 * port=0 让内核挑端口（测试并行时不抢端口）。host 固定回环，不开放覆盖。
 */
export async function serve({ root, port = 0 } = {}) {
  const server = createServer({ root });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: HOST, port }, resolve);
  });
  const addr = server.address();
  return {
    server,
    host: HOST,
    port: addr.port,
    url: `http://${HOST}:${addr.port}/`,
    close: () => new Promise((resolve) => { server.close(() => resolve()); }),
  };
}
