#!/usr/bin/env node
// post-write.mjs —— 写后巡检（PostToolUse hook，matcher: Write|Edit）
//
// 行为（设计 §5.4 体量保护 / §10.5 第三道防线 / §8.3 约束锁定 / §13.3 / §16.3；
// 契约 §14；增补项 A6 规范执行者阶梯）：
//   1. CLAUDE.md 行数 > 50 → stderr 告警（exit 0，只告警不阻断）
//   **规范面按端分派（A23/A25）**——三个 kind 各查各的，套错比不查更糟：
//   2. 导入与反馈规范（命中 → exit 2 反馈修复）：
//      · admin-web：深路径导入 vendor/vima-ui-admin/dist、幻包名 @vima/ui、
//        原生 confirm()/alert()（用 @/utils/feedback）
//      · h5-mobile：深路径导入 vendor/vima-ui-h5/dist/{components,feedback}（应从 '@ui' 入口）、
//        原生 confirm()/alert()（用 '@ui' 的 confirmAsync / toast）
//      · mp-native：不查（该端没有 Vue 与包导入这套东西）
//   3. 业务页面规范（仅带 data-page 的文件，即按 spec 生成的页面；内置壳层页不涉及）：
//      · admin-web（.vue）：页面根须挂 .vui-page；字面量色值只允许在 --x: … 定义行；
//        操作列禁止手写 width（宽度由 VTable 自动计算，L1 已吸收）
//      · mp-native（.wxml）：页面根须挂 .vm-page；.wxml/.wxss 禁裸色值
//        （只豁免 app.wxss——page 元素在 .vm-page 之外令牌够不着）
//      · h5-mobile（.vue）：页面根须挂 .vm-body / .vm-sheet——**不是 .vm-page**，
//        它在 App.vue 根上（全局反馈组件要在同一令牌作用域内）；.vue 禁裸色值
//   4. VIcon 图标名机检（admin-web 专属：.vue 内 name/type 静态字面量 ∈ vendor ai-manifest；
//      动态绑定 :name 不查；manifest 缺失时跳过）
//   5. 区块标记机械对账（§13.3 hook 半，契约 §14；A42 D-A42-01 改为按页聚合）：
//      .vue/.wxml 含 data-page="PAGE-xx" 时按 docs/review/prototype.manifest.json 比对
//      data-block / data-modal，缺失/多余 → exit 2；manifest 缺失或文件无 data-page 时跳过。
//      **「缺」按同页文件集合聚合判定**——合并页（壳页 + panes/ 子目录）是 vima 自己支持
//      并鼓励的形态，逐文件判定会让「编辑壳页必 exit 2」，而这是永远无法清除的告警；
//      「多」仍按被写文件判定（越界标记的责任田就是写它的那个文件）
//   6. A27 版面纪律（业务页 = 带 data-page；admin .vue / h5 .vue / mp 按 sibling wxml 判定）：
//      · 裸尺寸：gap/padding/margin/font-size 出现 px 数值 → 拦（--x: 定义行豁免；
//        「再紧一点」的正确动作是换密度档，不是写 10px）
//      · 页面根类（vui-page/vm-page/vm-body/vm-sheet）不许被页面样式覆写 height/overflow
//   全部检查定位「防误不防恶意」：输入解析失败、资产缺失一律放行，不误伤。
//   **本 hook 不检查、也永远不会检查「是否使用了组件」**（A27 P17）：机检对象是风格合规
//   与结构对账；组件是形态的一种实现，不是设计的单位——表达形式的选择权在页面。

import { readFileSync, readdirSync, appendFileSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';

/** 编辑距离（Levenshtein）：图标名拦截时给近似候选用（A8，确定性零依赖）。 */
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[n];
}

/** 对杜撰的图标名给出最近的 3 个真实候选（距离升序，同距按字典序，确定性）。 */
function nearestIcons(name, iconNames) {
  return [...iconNames]
    .map((candidate) => ({ candidate, d: editDistance(name.toLowerCase(), candidate) }))
    .sort((x, y) => x.d - y.d || (x.candidate < y.candidate ? -1 : 1))
    .slice(0, 3)
    .map((x) => x.candidate);
}

/** vendor ai-manifest 的图标名全集（含别名，统一小写）；读不到返回 null 表示跳过。
 *  A16：vendor 在归属端的 dir 下（单端根布局 appDir=''，多端 apps/<id>/）。 */
function loadIconNames(root, appDir = '') {
  try {
    const manifest = JSON.parse(
      readFileSync(path.join(root, appDir, 'vendor', 'vima-ui-admin', 'dist', 'ai-manifest.json'), 'utf8'),
    );
    if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) return null;
    const names = new Set();
    for (const icon of manifest.icons) {
      if (typeof icon === 'string') names.add(icon.toLowerCase());
      else if (icon && typeof icon === 'object') {
        if (typeof icon.name === 'string') names.add(icon.name.toLowerCase());
        for (const alias of Array.isArray(icon.aliases) ? icon.aliases : []) {
          if (typeof alias === 'string') names.add(alias.toLowerCase());
        }
      }
    }
    return names.size > 0 ? names : null;
  } catch {
    return null;
  }
}

/**
 * A27 裸尺寸检查：业务页样式里 gap/padding/margin/font-size 出现 px 数值 → 违规。
 * 自定义属性定义行（--x: …）豁免——「先定义局部令牌再 var() 引用」是唯一合法出口。
 * 「想再紧一点」的正确动作是换密度档（.vui-density-*），不是写 10px。
 */
function nakedSizeLines(lines) {
  const hits = [];
  const PROP = /(?:^|[;{])\s*(?:gap|row-gap|column-gap|padding(?:-[a-z]+)?|margin(?:-[a-z]+)?|font-size)\s*:[^;{}]*\d(?:\.\d+)?px/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(?:\/\/|\/\*|\*)/.test(line)) continue;      // 注释
    if (/^\s*--[\w-]+\s*:/.test(line)) continue;             // 自定义属性定义行豁免
    if (PROP.test(line)) hits.push(i + 1);
  }
  return hits;
}

/**
 * A27 页面根覆写检查：页面私有样式不得对页面根类重设 height/overflow——
 * 骨架契约（flex-shrink/末卡撑满/滚动落点）是全站一致性的地基，页面一覆写就回到
 * 「撑不满/被裁」的老路。命中返回 [{cls, prop}]。
 */
function pageRootOverrides(text) {
  const out = [];
  const re = /\.(vui-page|vm-page|vm-body|vm-sheet)[^{}]*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    for (const prop of ['height', 'overflow']) {
      const pr = new RegExp(`(?:^|[;{\\s])${prop}(?:-[a-z]+)?\\s*:`, 'm');
      if (pr.test(m[2])) out.push({ cls: m[1], prop });
    }
  }
  return out;
}

// ── A42 D-A42-01：区块对账的「同页文件集合」──────────────────────────────
// 逐文件判定对「一页 = 一个文件」成立，对**合并页**不成立：sustain-v4 的 PAGE-03 壳页
// 自身只声明 4 个 data-block，其余 6 个 block 与 25 个 data-modal 分散在九个 pane 文件里
// ⇒ 只要有人编辑壳页就 exit 2，而实现其实是完整的。判据与 V-TASK-11 的 done 豁免同源：
// **产生永远无法清除的告警，比不告警更有害**——它训练人忽略整张告警表。
//
// 聚合作用域取「被写文件所在目录树」，不取「全项目扫一遍找同 data-page 的文件」：
// 本 hook 每次写文件都跑，全项目扫描（sustain-v4 admin 端 800+ 源文件）会把每次写入
// 都压上一次全树 IO；而合并页的物理形态本来就是「壳页 + 其子目录」，目录树既覆盖实证
// 形态又天然有界。代价是「壳页与 pane 分居两棵树」时仍会误报——该形态本轮无实证，
// 按防过度设计不预先支持（真出现再扩，见 v2.1-amendments A42）。

/** 同页文件集合的扫描硬顶：hook 是写入热路径，扫描面必须有确定上限。 */
const PAGE_SET_MAX_FILES = 300;
/** 递归时永不进入的目录：依赖/构建产物/共享层——页面片段不会落在这里。 */
const PAGE_SET_SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'vendor', 'miniprogram_npm']);

/** 把一段文本里的 data-block / data-modal 标记并入两个集合。 */
function collectMarkers(text, blocks, modals) {
  const reBlock = /data-block="([^"]+)"/g;
  let m;
  while ((m = reBlock.exec(text)) !== null) blocks.add(m[1]);
  const reModal = /data-modal="([^"]+)"/g;
  while ((m = reModal.exec(text)) !== null) modals.add(m[1]);
}

/**
 * 收集被写文件所在目录树里**本页片段文件**的标记（不含被写文件自身）。
 *
 * 片段的判据是「不自带 data-page」：自带页号的文件是独立的页面单元，它的区块归它自己的
 * 页对账——否则同目录下另一个完整实现的页面会把本页的缺失掩掉，检查就成了永真。
 *
 * @returns {number} 实际并入的片段文件数（用于 stderr 说明聚合面，便于人核对）
 */
function collectPageFragments(dirAbs, ext, selfAbs, blocks, modals) {
  let budget = PAGE_SET_MAX_FILES;
  let used = 0;
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // 读不到就当没有——hook「防误不防恶意」，扫描失败不得改变判定方向
    }
    for (const e of entries) {
      if (budget <= 0) return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (PAGE_SET_SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
        walk(p);
        continue;
      }
      if (!e.isFile() || !e.name.endsWith(ext) || p === selfAbs) continue;
      budget -= 1;
      let t;
      try {
        t = readFileSync(p, 'utf8');
      } catch {
        continue;
      }
      if (/data-page="PAGE-\d{2}"/.test(t)) continue; // 独立页面单元，不是本页片段
      used += 1;
      collectMarkers(t, blocks, modals);
    }
  };
  walk(dirAbs);
  return used;
}

// ── A35 过程轨迹采集（契约 §6.21）──────────────────────────────────────────
// 本 hook 是独立脚本，取不到 vima 的 lib/util——故内联一份 appendJsonLine，
// 纪律与 lib/util/fs.mjs 的那份逐条一致（≤1024B 原子追加 / 超长截 ref / 异常全吞）。

/**
 * 项目根定位（多源回退）。**不能只用 cwd**：hook 进程的 cwd 是会话 cwd，
 * 它可能是项目的子目录（Agent `cd apps/admin` 之后写文件）、也可能是项目的父目录
 * （会话开在工作区根、项目建在子目录）。任一情形下按 cwd 解析都会算出错误的根，
 * 后果是 guard 形同虚设、journal 写去别处——而且**静默**，正是 A37 立项要治的那类失效。
 *
 * 优先级：
 *   1. 被写文件路径**向上**回溯（写入类 hook 最可靠的信号：文件在哪个项目里，就是哪个根，
 *      嵌套项目下这是唯一不会判错的来源）；
 *   2. `CLAUDE_PROJECT_DIR`（Claude Code 注入的会话项目根）——命中判据才采信；
 *   3. hook JSON 的 `cwd` 向上回溯；
 *   4. 进程 cwd 向上回溯。
 * 判据与内核 findProjectRoot 一致（`.vima/` 或 `docs/lifecycle.json`），判据只能有一个真源。
 * 全部落空 = 不在 Vima 项目里，返回 null 由调用方直接放行——hook 是「防误不防恶意」，
 * 拿 cwd 硬凑一个根会让 guard 去比对不存在的共享目录、journal 写进用户的任意目录。
 */
function findProjectRoot(from) {
  if (!from) return null;
  let dir = path.resolve(from);
  for (;;) {
    for (const probe of ['.vima', path.join('docs', 'lifecycle.json')]) {
      try {
        statSync(path.join(dir, probe));
        return dir;
      } catch { /* 继续探下一个判据 */ }
    }
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function resolveRoot(input, filePath) {
  const env = process.env.CLAUDE_PROJECT_DIR;
  const candidates = [
    // 被写文件路径排第一：文件在哪个项目里，就按哪个项目判。嵌套项目场景
    // （会话根本身是 vima 项目、文件属于其中嵌套的另一个项目）下，env 先行会判到外层根，
    // guard 对内层共享层静默放行——这与 A40 要治的病是同一株。
    filePath ? findProjectRoot(path.dirname(path.resolve(filePath))) : null,
    env ? findProjectRoot(env) : null,
    input && input.cwd ? findProjectRoot(input.cwd) : null,
    findProjectRoot(process.cwd()),
  ];
  for (const c of candidates) {
    if (c) return c;
  }
  return null; // 四源都不在 Vima 项目里 → 由调用方退出，不拿 cwd 硬凑一个根
}

const JOURNAL_MAX_LINE = 1024;

/**
 * 规范条目名的**封闭枚举**（D-A35-10）。
 *
 * 两条纪律：
 *   1. **禁止在命中处现拼字符串**——journal 会流向 vima retro，而 retro 的产物是要贴进
 *      公开 issue 的；`ref` 一旦带上文件路径 / 页面 ID / 组件名，就把客户项目的文件树
 *      带进了公开仓库。它只回答「哪条规范被违反」，不回答「在哪违反的」——后者是本 hook
 *      当场给 Agent 的 stderr 反馈，不是复盘素材。
 *   2. **跨端同规则合并为一个值**（如 admin 与 h5 的深路径导入）——分布要回答的是
 *      「哪条规范框架没讲清楚」，端别不改变这个答案。
 */
const RULE = {
  DEEP_IMPORT: '§10.5/深路径导入',
  PHANTOM_PKG: '§10.5/幻包名',
  NATIVE_DIALOG: '§8.3/原生弹窗',
  PAGE_ROOT: '§13.3/页面根类',
  NAKED_COLOR: 'A27/裸色值',
  NAKED_SIZE: 'A27/裸尺寸',
  ROOT_OVERRIDE: 'A27/骨架覆写',
  ACTION_COL: 'A27/操作列宽',
  ICON_NAME: 'A6/图标名',
  PAGE_UNKNOWN: '§13.3/页面不在 manifest',
  BLOCK_MARK: '§13.3/区块标记',
};

/** 默认开启（D-A35-07）；VIMA_JOURNAL=0 关闭。 */
const journalOn = () => process.env.VIMA_JOURNAL !== '0';

/** 追加一行；任何异常一律吞掉——采集是旁路，绝不能改变本 hook 的退出码。 */
function journalAppend(root, obj) {
  if (!journalOn()) return;
  try {
    let line = `${JSON.stringify(obj)}\n`;
    if (Buffer.byteLength(line) > JOURNAL_MAX_LINE && typeof obj.ref === 'string') {
      const over = Buffer.byteLength(line) - JOURNAL_MAX_LINE;
      line = `${JSON.stringify({ ...obj, ref: obj.ref.slice(0, Math.max(0, obj.ref.length - over - 1)) })}\n`;
    }
    if (Buffer.byteLength(line) > JOURNAL_MAX_LINE) return;
    const dir = path.join(root, '.vima', 'reports');
    mkdirSync(dir, { recursive: true });
    appendFileSync(path.join(dir, 'journal.jsonl'), line);
  } catch {
    /* 采集失败不影响巡检本体 */
  }
}

/** 规范命中事件：同一次写入里同条规范只记一次（去重后逐条落盘）。 */
function journalGuards(root, rules) {
  for (const ref of [...new Set(rules)]) {
    journalAppend(root, { ts: new Date().toISOString(), kind: 'guard', ref, outcome: 'block' });
  }
}

/**
 * 把 Agent 报告压成 journal 事件前先做最小 schema/一致性校验。
 * 这不能把 Agent 报告升级成独立防伪证据，但能拒绝 `{result:"pass"}` 这类空壳与文件名冒名。
 */
function reportEventOf(rep, taskId, role) {
  if (!rep || typeof rep !== 'object' || rep.taskId !== taskId) return null;
  if (role === 'builder') {
    if (!['completed', 'failed'].includes(rep.status)) return null;
    const acceptance = rep.acceptance && typeof rep.acceptance === 'object' ? rep.acceptance : {};
    const total = Number.isFinite(acceptance.total) ? acceptance.total : 0;
    const passed = Number.isFinite(acceptance.passed) ? acceptance.passed : 0;
    return {
      round: 1,
      outcome: rep.status === 'completed' ? 'pass' : 'fail',
      failed: Math.max(0, total - passed),
    };
  }

  if (!Number.isInteger(rep.round) || rep.round < 1 || !['pass', 'fail'].includes(rep.result)) return null;
  if (!Array.isArray(rep.checklist) || !Array.isArray(rep.points)
    || !Array.isArray(rep.missing) || !Array.isArray(rep.contractViolations)) return null;
  // D-A42-04：`contractGaps` 可选（缺省 []）——**存量报告不带该字段必须照常通过校验**；
  // 带了就必须是数组（类型错等于协议没对齐，宁缺勿假，整条不记）。
  if (rep.contractGaps !== undefined && !Array.isArray(rep.contractGaps)) return null;
  // D-A43-01：`commands` 可选，口径同上——缺省照常通过；带了就必须是数组且逐条合形
  //（`cmd` 非空字符串 / `exitCode` 整数）。取值判定（退出码是否为 0）不在这里做：
  // 本函数只管形状，`pipeline-green` 的取值判据在 lib/commands/certify.mjs（§6.19）。
  if (rep.commands !== undefined) {
    if (!Array.isArray(rep.commands)) return null;
    for (const c of rep.commands) {
      if (!c || typeof c !== 'object') return null;
      if (typeof c.cmd !== 'string' || c.cmd.trim() === '') return null;
      if (!Number.isInteger(c.exitCode)) return null;
    }
  }
  const entries = [...rep.checklist, ...rep.points];
  if (entries.some((pt) => !pt || typeof pt !== 'object' || typeof pt.passed !== 'boolean')) return null;
  // `contractGaps` **不计 fail**：它记的是「规格本身有缺口、实现侧已做合规处置」
  //（page-68-fe 实证：契约声明 attachmentId? 入参，33 个端点里没有任何上传端点；
  // builder 控件置灰 + 说明文案，不臆造端点、不绕过请求门面——处置恰当却被记 fail，
  // 根因是 verifier 没有别的字段可填）。`contractViolations` 保持原义：真越界，计 fail。
  const failed = entries.filter((pt) => {
    if (pt.passed === true) return false;
    return !(pt.waived === true && typeof pt.reason === 'string' && pt.reason.trim() !== '');
  }).length + rep.missing.length + rep.contractViolations.length;
  return {
    round: rep.round,
    outcome: rep.result === 'pass' && failed === 0 ? 'pass' : 'fail',
    failed,
    gaps: Array.isArray(rep.contractGaps) ? rep.contractGaps.length : 0,
  };
}

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const filePath = (input && input.tool_input && input.tool_input.file_path) || '';
  if (!filePath) process.exit(0);

  // 相对 file_path 一律相对项目根解析
  const root = resolveRoot(input, filePath);
  if (!root) process.exit(0); // 不在 Vima 项目里：无规范可巡、无账本可记
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);

  // ── 1. CLAUDE.md 体量告警（§5.4，第 3 条 Hook 兜底）──
  if (path.basename(filePath) === 'CLAUDE.md') {
    let text;
    try {
      text = readFileSync(absPath, 'utf8');
    } catch {
      process.exit(0);
    }
    const lines = text.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    if (lines.length > 50) {
      console.error(
        `⚠️ CLAUDE.md 体量告警：当前 ${lines.length} 行，超过 50 行上限。\n` +
          `CLAUDE.md 是常驻上下文，只放红线与指针；请把详情迁移到 docs/ 下，` +
          `宪法中只保留一行指针（见体量保护机制）。`,
      );
    }
    process.exit(0);
  }

  // 仅检查前端业务代码。A16 端册化：归属判定读 manifest 端册各端 <dir>/<codeDir>/ 前缀
  //（v1 manifest / 无 manifest 回退 'src/'，与 guard-shared 同款回退口径）
  let rel = path.isAbsolute(filePath) ? path.relative(root, filePath) : filePath;
  rel = rel.split(path.sep).join('/').replace(/^\.\//, '');

  // ── A35 采集口②-1：子代理报告落盘事件 ──────────────────────────────────
  // 位置必须在下方早退门之前——那道门只放行 .vue/.ts/.tsx/.wxml/.wxss，会把 .json 报告挡掉。
  // 由 hook 采而不让子代理自己写（D-A35-02）：子代理是概率性的，漏一条就断一段曲线。
  // §6.9 的文件名与 schema 一字不改（D-A35-03）——被覆盖的仍是内容，留痕的是「第 N 轮什么结果」。
  const repM = /^\.vima\/reports\/([a-z0-9][a-z0-9-]*)-(verifier|builder)\.json$/.exec(rel);
  if (repM) {
    try {
      const rep = JSON.parse(readFileSync(absPath, 'utf8'));
      const event = reportEventOf(rep, repM[1], repM[2]);
      if (event) {
        // `n` 严格保持契约 §6.21 的原义「未过 point 数」——**contractGaps 不并进来**。
        // 三条硬约束把它挡在 journal 之外：① 事件五键封顶且 kind 是三元封闭集，加不了第六个
        // 键、也加不了第四类事件；② `ref` 被 lib/model/{progress,journal}.mjs 用
        // `^(.+)/(verifier|builder)/r(\d+)$` 逐条解析，加后缀会让整条事件掉出 tracked；
        // ③ 把 gaps 折进 `n`，就会出现「outcome=pass 而 n=3」——journal 是给人看曲线的，
        // 这一眼读起来就是「过了但有 3 个点没过」，是实打实的语义破坏。
        // 缺口条数的下游通道是**报告文件本身**（D-A42-04 原文：「进 converge 的收口清单」）：
        // `lib/model/journal.mjs` 的 collectReports 已逐个读 `-verifier.json`，
        // 加一个 `contractGaps` 计数即可——那是内核侧的落点，不在本 hook 的责任田。
        journalAppend(root, {
          ts: new Date().toISOString(),
          kind: 'report',
          ref: `${repM[1]}/${repM[2]}/r${event.round}`,
          outcome: event.outcome,
          n: event.failed,
        });
        // 缺口不计 fail，但**不能静默**：当场在 stderr 说清「记了几条、下一步归谁」，
        // 与本 hook 既有纪律一致（失败给清楚提示；这里 exit 0，只提示不阻断）。
        if (event.gaps > 0) {
          console.error(
            `契约缺口已登记（不计 fail）—— ${repM[1]} 第 ${event.round} 轮：contractGaps ${event.gaps} 条。\n` +
              '  · contractGaps = 规格本身有缺口、实现侧已做合规处置（D-A42-04），与 contractViolations（真越界，计 fail）分开；\n' +
              '  · 它不改变本轮验收结论，但必须进 converge 的收口清单——收口前不得当作「已解决」。',
          );
        }
      }
    } catch {
      /* 报告不可解析 → 不记（宁缺勿假） */
    }
    process.exit(0); // 报告不是前端业务代码，后续规范面不适用
  }
  let vimaManifest = null;
  try {
    vimaManifest = JSON.parse(readFileSync(path.join(root, '.vima', 'manifest.json'), 'utf8'));
  } catch {
    /* 缺失/损坏 → 回退面 */
  }
  let appId = null;   // 归属端 id（新形态 manifest 对账用）
  let appDir = '';    // 归属端 dir（vendor ai-manifest 路径用；'' = 项目根）
  let appKind = null; // 归属端 kind（A23/A25：三个 kind 的规范面互不相同）
  let codeBase = 'src/'; // 归属端代码根（app.wxss 豁免判定用）
  let inScope = false;
  if (vimaManifest && Array.isArray(vimaManifest.apps)) {
    for (const a of vimaManifest.apps) {
      const base = !a.dir || a.dir === '.' ? '' : `${String(a.dir).replace(/\/+$/, '')}/`;
      const codeDir = typeof a.codeDir === 'string' && a.codeDir !== '' ? a.codeDir : 'src';
      if (rel.startsWith(`${base}${codeDir}/`)) {
        inScope = true;
        appId = typeof a.id === 'string' ? a.id : null;
        appDir = base;
        appKind = typeof a.kind === 'string' ? a.kind : null;
        codeBase = `${base}${codeDir}/`;
        break;
      }
    }
  } else {
    inScope = rel.startsWith('src/');
  }
  // vendor 是共享层（guard-shared 已挡写），这里跳过以免同一次写入报两套话
  if (/(?:^|\/)vendor\//.test(rel)) process.exit(0);
  if (!inScope || !/\.(vue|ts|tsx|wxml|wxss)$/.test(rel)) process.exit(0);
  // 规范面按端分派（A23/A25）：三个 kind 的规范面互不相同，套错比不查更糟——
  // h5 页面本来就该用 vm-* 类，套 admin 的面会报「缺少 vui-page 类」，把对的说成错的。
  // v1 manifest / 无 manifest 时 appKind 为 null，按现状走 admin-web 分支，行为不变。
  const isMp = appKind === 'mp-native';
  const isH5 = appKind === 'h5-mobile';
  const isVmKind = isMp || isH5; // 共用 vm-* 类契约的两个移动端（A25）

  let text;
  try {
    text = readFileSync(absPath, 'utf8');
  } catch {
    process.exit(0);
  }

  const problems = [];
  // A35：与 problems 平行的规范枚举命中表——命中处只填枚举，不拼现场（D-A35-10）
  const guardHits = [];
  const flag = (rule, msg) => { guardHits.push(rule); problems.push(msg); };

  // ── 2. 导入与反馈规范（§10.5 第三道防线 / §8.3）——按端各查各的 ──
  if (isH5) {
    // 深路径导入 vendor 组件（应从 @ui 入口取，与 admin 端「组件已全局注册」同款理由：
    // 逐处深导入会让「哪些是框架能力」不可机检）
    if (/from\s+["'][^"'\n]*vendor\/vima-ui-h5\/dist\/(?:components|feedback)/.test(text)) {
      flag(RULE.DEEP_IMPORT, 
        '深路径导入 vendor/vima-ui-h5/dist/…：组件已全局注册（main.ts 的 app.use），'
          + "模板直接写 <VmNavbar>；函数式 API 从 '@ui' 入口具名导入（toast / confirmAsync）",
      );
    }
    if (/(?:^|[^.\w])(?:window\.)?(?:confirm|alert)\s*\(/m.test(text)) {
      flag(RULE.NATIVE_DIALOG, 
        "使用了原生 confirm()/alert()：请改用 '@ui' 的 confirmAsync（Promise 化）与 toast"
          + '——原生弹窗样式不可控且在 iOS 上阻塞页面（见 docs/coding-standards.md 端规范：h5-mobile）',
      );
    }
  }
  if (!isVmKind) {
  if (/from\s+["'][^"'\n]*(?:vendor\/vima-ui-admin\/dist|@vima-tech\/ui-admin\/dist)/.test(text)) {
    flag(RULE.DEEP_IMPORT, 
      '深路径导入底层库（…/vima-ui-admin/dist/…）：组件已全局注册无需导入；' +
        '函数式 API 从包入口 @vima-tech/ui-admin 导入',
    );
  }
  if (/from\s+["']@vima\/ui["']/.test(text)) {
    flag(RULE.PHANTOM_PKG, 
      '导入了不存在的包 @vima/ui（幻包名）：组件已全局注册直接使用；' +
        '函数式 API 从 @vima-tech/ui-admin 具名导入（见 docs/coding-standards.md）',
    );
  }
  if (/(?:^|[^.\w])(?:window\.)?(?:confirm|alert)\s*\(/m.test(text)) {
    flag(RULE.NATIVE_DIALOG, '使用了原生 confirm()/alert()：请改用 @/utils/feedback 的 confirmAsync/toast（见 docs/coding-standards.md）');
  }
  }

  const isVue = /\.vue$/.test(rel);
  const isWxml = /\.wxml$/.test(rel);
  const isWxss = /\.wxss$/.test(rel);
  // 页面标记：admin-web 在 .vue 上，mp-native 在 .wxml 上（§13.3 机制对位复制）
  const pageM = isVue || isWxml ? /data-page="(PAGE-\d{2})"/.exec(text) : null;
  const lines = text.split('\n');

  // ── 3a. vm-* 类契约两端的业务页面规范（A23 / A25）──
  if (isVmKind) {
    // 页面根的契约两端不同：小程序每页自带 vm-page（令牌作用域挂在它上面）；
    // H5 的 vm-page 在 App.vue 根（全局反馈组件也要在同一作用域内），
    // 因此 H5 的页面组件从 vm-body / vm-sheet 写起，再套一层 vm-page 会嵌套两个页面容器。
    if (pageM && isMp && !/class="[^"]*\bvm-page\b[^"]*"/.test(text)) {
      flag(RULE.PAGE_ROOT, 
        `页面根缺少 vm-page 类：业务页面根必须是 <view class="vm-page" data-page="${pageM[1]}">` +
          '（令牌作用域与适老化的框架契约，见 docs/coding-standards.md 端规范：mp-native）',
      );
    }
    if (pageM && isH5 && !/class="[^"]*\bvm-(?:body|sheet)\b[^"]*"/.test(text)) {
      flag(RULE.PAGE_ROOT, 
        `页面根缺少 vm-body / vm-sheet 类：H5 业务页从内容区写起`
          + `（<div class="vm-body" data-page="${pageM[1]}">），vm-page 在 App.vue 根上，`
          + '页面里不要再套一层（见 docs/coding-standards.md 端规范：h5-mobile）',
      );
    }
    // 裸色值：整端的 .wxml/.wxss 都查（不像 admin 只查带 data-page 的页面——
    // 小程序样式散在每页 .wxss 里，没有 data-page 可依附）。
    // 唯一豁免 app.wxss：page 元素在 .vm-page 之外，令牌够不着，那一处裸值是设计使然。
    const isGlobalWxss = rel === `${codeBase}app.wxss`;
    if ((isWxml || isWxss || (isH5 && isVue)) && !isGlobalWxss) {
      const colorHits = [];
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*(?:\/\*|\*)/.test(lines[i])) continue; // 注释行不计
        let stripped = lines[i].replace(/--[\w-]+\s*:\s*[^;{}]*/g, '');
        // 窄豁免：原生组件的颜色属性（<switch color> / <progress activeColor> 等）是
        // 组件属性不是 CSS，吃不到 var()，只能写字面值。豁免只覆盖这几个属性名本身，
        // 不放宽整行——同一行里别处的裸色值照样报。
        stripped = stripped.replace(/\b(?:color|activeColor|backgroundColor|selectedColor|backgroundTextStyle)="[^"]*"/g, '');
        if (/#[0-9a-fA-F]{3,8}\b/.test(stripped) || /\brgba?\(/.test(stripped) || /\bhsla?\(/.test(stripped)) {
          colorHits.push(i + 1);
        }
      }
      if (colorHits.length > 0) {
        flag(RULE.NAKED_COLOR, 
          `出现字面量色值（行 ${colorHits.join('、')}）：颜色只取框架 tokens 的 --vm-* 令牌`
            + `（${isMp ? 'vendor/vima-ui-mp/dist/tokens.wxss' : 'vendor/vima-ui-h5/dist/tokens.css'}）；`
            + '确需局部值时先定义 --x: …，属性值用 var(--x) 引用',
        );
      }
    }
    // A27：业务页裸尺寸与根类覆写（h5 = 带 data-page 的 .vue；
    // mp 的样式在同名 .wxss——按 sibling .wxml 是否带 data-page 判定业务页归属）
    let vmBizStyle = null;
    if (isH5 && isVue && pageM) vmBizStyle = text;
    if (isMp && isWxss) {
      try {
        const wxml = readFileSync(absPath.replace(/\.wxss$/, '.wxml'), 'utf8');
        if (/data-page="PAGE-\d{2}"/.test(wxml)) vmBizStyle = text;
      } catch {
        /* 无同名 wxml：非页面 wxss，不查 */
      }
    }
    if (vmBizStyle !== null) {
      const sizeHits = nakedSizeLines(vmBizStyle.split('\n'));
      if (sizeHits.length > 0) {
        flag(RULE.NAKED_SIZE, 
          `业务页出现裸尺寸（行 ${sizeHits.join('、')}）：gap/padding/margin/font-size 只取 var(--vm-*) 或 0；` +
            '「再紧/再松一点」换密度档，确需局部值先定义 --x: … 再 var(--x) 引用',
        );
      }
      for (const o of pageRootOverrides(vmBizStyle)) {
        flag(RULE.ROOT_OVERRIDE, 
          `页面私有样式覆写了页面根类 .${o.cls} 的 ${o.prop}：撑满/滚动由框架契约统一保证——删除该声明`,
        );
      }
    }
  }

  // ── 3. admin-web 业务页面规范（带 data-page 的 .vue 才检查；A6）──
  if (!isVmKind && pageM) {
    if (!/class="[^"]*\bvui-page\b[^"]*"/.test(text)) {
      flag(RULE.PAGE_ROOT, 
        `页面根缺少 vui-page 类：业务页面根必须是 <div class="vui-page" data-page="${pageM[1]}">` +
          '（内边距/高度链/滚动的框架契约，见 docs/coding-standards.md）',
      );
    }
    const colorHits = [];
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*(?:\/\/|\/\*|\*)/.test(lines[i])) continue; // 注释行不计
      // 自定义属性定义片段豁免（--x: #hex 合法）：剥掉定义片段后再查残余
      const stripped = lines[i].replace(/--[\w-]+\s*:\s*[^;{}]*/g, '');
      if (/#[0-9a-fA-F]{3,8}\b/.test(stripped) || /\brgba?\(/.test(stripped) || /\bhsla?\(/.test(stripped)) {
        colorHits.push(i + 1);
      }
    }
    if (colorHits.length > 0) {
      flag(RULE.NAKED_COLOR, 
        `业务页出现字面量色值（行 ${colorHits.join('、')}）：颜色只取 src/styles/tokens.css 的 --v-* 令牌；` +
          '确需局部值时先在选择器里定义 --x: …，属性值用 var(--x) 引用',
      );
    }
    // A27：裸尺寸（间距/字号写死 px）——密度档与令牌是唯一取值出口
    const sizeHits = nakedSizeLines(lines);
    if (sizeHits.length > 0) {
      flag(RULE.NAKED_SIZE, 
        `业务页出现裸尺寸（行 ${sizeHits.join('、')}）：gap/padding/margin/font-size 只取 var(--v-*) 或 0；` +
          '「再紧/再松一点」换密度档（vui-density-compact/loose），确需局部值先定义 --x: … 再 var(--x) 引用',
      );
    }
    // A27：页面根类不许被页面私有样式覆写 height/overflow（骨架契约是全站一致性的地基）
    for (const o of pageRootOverrides(text)) {
      flag(RULE.ROOT_OVERRIDE, 
        `页面私有样式覆写了页面根类 .${o.cls} 的 ${o.prop}：撑满/滚动由骨架契约统一保证，` +
          '页面一覆写就回到「撑不满/被裁」的老路——删除该声明，滚动落点交给框架',
      );
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isActionCol =
        /title:\s*(['"])操作\1/.test(line) || /(?:key|customSlot):\s*(['"])\w*[Oo]perator\1/.test(line);
      if (isActionCol && /width:\s*\d/.test(line)) {
        flag(RULE.ACTION_COL, 
          `操作列手写了字面量 width（行 ${i + 1}）：宽度由 VTable 按行内按钮文案自动计算（L1 已吸收），` +
            '删除 width 字段即可',
        );
      }
    }
  }

  // ── 4. VIcon 图标名机检（静态字面量；:name 动态绑定不查）── admin-web 专属
  if (isVue && !isVmKind) {
    const iconNames = loadIconNames(root, appDir);
    if (iconNames) {
      const bad = new Set();
      const re = /<VIcon\b[^>]*?\s(?:name|type)="([^"]+)"/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const name = m[1].trim();
        if (name !== '' && !iconNames.has(name.toLowerCase())) bad.add(name);
      }
      if (bad.size > 0) {
        const detail = [...bad]
          .map((n) => `${n}（近似候选：${nearestIcons(n, iconNames).join('、')}）`)
          .join('；');
        flag(RULE.ICON_NAME, 
          `VIcon 使用了注册表中不存在的图标名：${detail}` +
            '——从候选中选用或查 docs/ui-framework/ICONS.md 全清单，不得杜撰图标名',
        );
      }
    }
  }

  if (problems.length > 0) {
    journalGuards(root, guardHits); // A35 采集口②-2：规范命中（阻断才算 block）
    console.error(
      `编码规范检查未通过 —— ${rel}\n` +
        problems.map((p) => `  · ${p}`).join('\n') +
        `\n请立即修正后重写该文件（§10.5 第三道防线 / A6 机检扩展，细则见 docs/coding-standards.md）。`,
    );
    process.exit(2);
  }

  // ── 5. 区块标记机械对账（§13.3 机械化路径的 hook 半）──
  // admin-web 在 .vue、mp-native 在 .wxml（A23 机制对位复制）；manifest 未渲染时静默跳过。
  if (pageM) {
    let manifest = null;
    try {
      manifest = JSON.parse(readFileSync(path.join(root, 'docs', 'review', 'prototype.manifest.json'), 'utf8'));
    } catch {
      /* 原型尚未渲染，跳过本项 */
    }
    // §6.7 A16 新形态：顶层 apps map（按归属端取，取不到时扫全部端）；兼容旧 pages 数组
    let pageList = null;
    if (manifest && manifest.apps && typeof manifest.apps === 'object') {
      if (appId && manifest.apps[appId] && Array.isArray(manifest.apps[appId].pages)) {
        pageList = manifest.apps[appId].pages;
      } else {
        pageList = Object.values(manifest.apps).flatMap((a) => (Array.isArray(a?.pages) ? a.pages : []));
      }
    } else if (manifest && Array.isArray(manifest.pages)) {
      pageList = manifest.pages;
    }
    if (pageList) {
      const page = pageList.find((p) => p && p.id === pageM[1]);
      if (!page) {
        journalGuards(root, [RULE.PAGE_UNKNOWN]); // A35 采集口②-2
        console.error(
          `区块标记对账：${rel} 声明 data-page="${pageM[1]}"，但 prototype.manifest.json 中无此页面。\n` +
            `可能：spec 改动后未重跑 vima render-prototype，或页面 ID 拼错。`,
        );
        process.exit(2);
      }
      // D-A42-01：「缺」按同页文件集合聚合，「多」仍按被写文件——
      // 越界标记的责任田就是写它的那个文件，聚合会让别的片段的越界标记记到本文件头上；
      // 反过来「缺」只有聚合才成立（合并页的区块本就分散在壳页与 panes/ 里）。
      const selfBlocks = new Set();
      const selfModals = new Set();
      collectMarkers(text, selfBlocks, selfModals);
      const blocks = new Set(selfBlocks);
      const modals = new Set(selfModals);
      const ext = isWxml ? '.wxml' : '.vue';
      const fragments = collectPageFragments(path.dirname(absPath), ext, absPath, blocks, modals);
      const layout = Array.isArray(page.layout) ? page.layout : [];
      const missing = [...new Set(layout)].filter((w) => !blocks.has(w));
      const extra = [...selfBlocks].filter((w) => !layout.includes(w));
      const modalIds = (Array.isArray(page.modals) ? page.modals : [])
        .map((mo) => (mo && typeof mo === 'object' ? mo.id : null))
        .filter(Boolean);
      const missModals = modalIds.filter((id) => !modals.has(id));
      const issues = [];
      if (missing.length) issues.push(`缺区块标记 data-block：${missing.join('、')}`);
      if (extra.length) issues.push(`多出设计外区块标记 data-block：${extra.join('、')}（layout 词表见 manifest 该页）`);
      if (missModals.length) issues.push(`缺弹窗标记 data-modal：${missModals.join('、')}`);
      if (issues.length > 0) {
        journalGuards(root, [RULE.BLOCK_MARK]); // A35 采集口②-2
        const scope = `${path.posix.dirname(rel)}/`;
        console.error(
          `区块标记对账未通过 —— ${rel}（${pageM[1]}，基线 prototype.manifest.json）\n` +
            issues.map((p) => `  · ${p}`).join('\n') +
            `\n「缺」已按同页文件集合聚合判定：作用域 ${scope}（含 ${fragments} 个不自带 data-page 的片段 ${ext} 文件）。` +
            `\n合并页把区块分散到 panes/ 等子目录是允许的——但整页合起来必须齐全；` +
            `\n页面结构以 spec/manifest 为唯一真源：结构确需变更时先改 spec 并重渲染，再改代码（§13.4）。`,
        );
        process.exit(2);
      }
    }
  }
  process.exit(0);
});
