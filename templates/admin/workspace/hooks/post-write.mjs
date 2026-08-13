#!/usr/bin/env node
// post-write.mjs —— 写后巡检（PostToolUse hook，matcher: Write|Edit）
//
// 行为（设计 §5.4 体量保护 / §10.5 第三道防线 / §8.3 约束锁定 / §13.3 / §16.3；
// 契约 §14；增补项 A6 规范执行者阶梯）：
//   1. CLAUDE.md 行数 > 50 → stderr 告警（exit 0，只告警不阻断）
//   2. src/ 业务代码导入与反馈规范（.vue/.ts/.tsx，命中 → exit 2 反馈修复）：
//      · 深路径导入底层库（vendor/vima-ui-admin/dist 或 @vima-tech/ui-admin/dist）
//      · 导入不存在的包 @vima/ui（幻包名——组件已全局注册，无需 import）
//      · 原生 window.confirm()/alert()（用 @/utils/feedback）
//   3. 业务页面规范（仅带 data-page 的 .vue，即按 spec 生成的页面；内置壳层页不涉及）：
//      · 页面根须挂 .vui-page 类（框架的内边距/高度链/滚动契约）
//      · 字面量色值（#hex/rgb/hsl）只允许出现在自定义属性定义行（--x: …）
//      · 操作列禁止手写字面量 width（宽度由 VTable 按行内按钮文案自动计算，L1 已吸收）
//   4. VIcon 图标名机检（.vue 内 name/type 静态字面量 ∈ vendor ai-manifest icons；
//      动态绑定 :name 不查；manifest 缺失时跳过）
//   5. 区块标记机械对账（§13.3 hook 半，契约 §14）：.vue 含 data-page="PAGE-xx" 时按
//      docs/review/prototype.manifest.json 逐项比对 data-block / data-modal，
//      缺失/多余 → exit 2；manifest 缺失或文件无 data-page 时跳过本项
//   全部检查定位「防误不防恶意」：输入解析失败、资产缺失一律放行，不误伤。

import { readFileSync } from 'node:fs';
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

  // 项目根：优先取 hook JSON 的 cwd；相对 file_path 一律相对项目根解析
  const root = (input && input.cwd) || process.cwd();
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
  let vimaManifest = null;
  try {
    vimaManifest = JSON.parse(readFileSync(path.join(root, '.vima', 'manifest.json'), 'utf8'));
  } catch {
    /* 缺失/损坏 → 回退面 */
  }
  let appId = null;   // 归属端 id（新形态 manifest 对账用）
  let appDir = '';    // 归属端 dir（vendor ai-manifest 路径用；'' = 项目根）
  let inScope = false;
  if (vimaManifest && Array.isArray(vimaManifest.apps)) {
    for (const a of vimaManifest.apps) {
      const base = !a.dir || a.dir === '.' ? '' : `${String(a.dir).replace(/\/+$/, '')}/`;
      const codeDir = typeof a.codeDir === 'string' && a.codeDir !== '' ? a.codeDir : 'src';
      if (rel.startsWith(`${base}${codeDir}/`)) {
        inScope = true;
        appId = typeof a.id === 'string' ? a.id : null;
        appDir = base;
        break;
      }
    }
  } else {
    inScope = rel.startsWith('src/');
  }
  if (!inScope || !/\.(vue|ts|tsx)$/.test(rel)) process.exit(0);

  let text;
  try {
    text = readFileSync(absPath, 'utf8');
  } catch {
    process.exit(0);
  }

  const problems = [];

  // ── 2. 导入与反馈规范（§10.5 第三道防线 / §8.3）──
  if (/from\s+["'][^"'\n]*(?:vendor\/vima-ui-admin\/dist|@vima-tech\/ui-admin\/dist)/.test(text)) {
    problems.push(
      '深路径导入底层库（…/vima-ui-admin/dist/…）：组件已全局注册无需导入；' +
        '函数式 API 从包入口 @vima-tech/ui-admin 导入',
    );
  }
  if (/from\s+["']@vima\/ui["']/.test(text)) {
    problems.push(
      '导入了不存在的包 @vima/ui（幻包名）：组件已全局注册直接使用；' +
        '函数式 API 从 @vima-tech/ui-admin 具名导入（见 docs/coding-standards.md）',
    );
  }
  if (/(?:^|[^.\w])(?:window\.)?(?:confirm|alert)\s*\(/m.test(text)) {
    problems.push('使用了原生 confirm()/alert()：请改用 @/utils/feedback 的 confirmAsync/toast（见 docs/coding-standards.md）');
  }

  const isVue = /\.vue$/.test(rel);
  const pageM = isVue ? /data-page="(PAGE-\d{2})"/.exec(text) : null;
  const lines = text.split('\n');

  // ── 3. 业务页面规范（带 data-page 的 .vue 才检查；A6）──
  if (pageM) {
    if (!/class="[^"]*\bvui-page\b[^"]*"/.test(text)) {
      problems.push(
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
      problems.push(
        `业务页出现字面量色值（行 ${colorHits.join('、')}）：颜色只取 src/styles/tokens.css 的 --v-* 令牌；` +
          '确需局部值时先在选择器里定义 --x: …，属性值用 var(--x) 引用',
      );
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isActionCol =
        /title:\s*(['"])操作\1/.test(line) || /(?:key|customSlot):\s*(['"])\w*[Oo]perator\1/.test(line);
      if (isActionCol && /width:\s*\d/.test(line)) {
        problems.push(
          `操作列手写了字面量 width（行 ${i + 1}）：宽度由 VTable 按行内按钮文案自动计算（L1 已吸收），` +
            '删除 width 字段即可',
        );
      }
    }
  }

  // ── 4. VIcon 图标名机检（静态字面量；:name 动态绑定不查）──
  if (isVue) {
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
        problems.push(
          `VIcon 使用了注册表中不存在的图标名：${detail}` +
            '——从候选中选用或查 docs/ui-framework/ICONS.md 全清单，不得杜撰图标名',
        );
      }
    }
  }

  if (problems.length > 0) {
    console.error(
      `编码规范检查未通过 —— ${rel}\n` +
        problems.map((p) => `  · ${p}`).join('\n') +
        `\n请立即修正后重写该文件（§10.5 第三道防线 / A6 机检扩展，细则见 docs/coding-standards.md）。`,
    );
    process.exit(2);
  }

  // ── 5. 区块标记机械对账（§13.3 机械化路径的 hook 半）──
  // 仅当 .vue 文件声明了 data-page 时执行；manifest 未渲染时静默跳过。
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
        console.error(
          `区块标记对账：${rel} 声明 data-page="${pageM[1]}"，但 prototype.manifest.json 中无此页面。\n` +
            `可能：spec 改动后未重跑 vima render-prototype，或页面 ID 拼错。`,
        );
        process.exit(2);
      }
      const declared = [];
      const reBlock = /data-block="([^"]+)"/g;
      let mB;
      while ((mB = reBlock.exec(text)) !== null) declared.push(mB[1]);
      const layout = Array.isArray(page.layout) ? page.layout : [];
      const missing = [...new Set(layout)].filter((w) => !declared.includes(w));
      const extra = [...new Set(declared)].filter((w) => !layout.includes(w));
      const modalIds = (Array.isArray(page.modals) ? page.modals : [])
        .map((mo) => (mo && typeof mo === 'object' ? mo.id : null))
        .filter(Boolean);
      const missModals = modalIds.filter((id) => text.indexOf(`data-modal="${id}"`) < 0);
      const issues = [];
      if (missing.length) issues.push(`缺区块标记 data-block：${missing.join('、')}`);
      if (extra.length) issues.push(`多出设计外区块标记 data-block：${extra.join('、')}（layout 词表见 manifest 该页）`);
      if (missModals.length) issues.push(`缺弹窗标记 data-modal：${missModals.join('、')}`);
      if (issues.length > 0) {
        console.error(
          `区块标记对账未通过 —— ${rel}（${pageM[1]}，基线 prototype.manifest.json）\n` +
            issues.map((p) => `  · ${p}`).join('\n') +
            `\n页面结构以 spec/manifest 为唯一真源：结构确需变更时先改 spec 并重渲染，再改代码（§13.4）。`,
        );
        process.exit(2);
      }
    }
  }
  process.exit(0);
});
