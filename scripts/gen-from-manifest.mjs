#!/usr/bin/env node
// 从 admin 模板 vendor 的 ai-manifest.json 生成两份派生物（同源两渲染，防手工漂移）：
//   1. templates/admin/ui-docs/ICONS.md
//      —— 图标名清单：AI 写 <VIcon name="…"> 的唯一依据（post-write hook 按同一 manifest 机检）
//   2. templates/admin/scaffold/frontend/src/components.d.ts
//      —— GlobalComponents 全量声明：组件库 install() 全局注册全部组件，
//         此文件此前手工维护，曾漂移到 44/63（AI-First 评估 §6A5）
// 防谎言断言：manifest 里的组件名必须能在 dist/index.d.ts 中找到，否则拒绝生成。
// 字节确定性：内容只取 manifest、排序输出、无时间戳——同输入必得同字节（仓库硬约束）。
// 用法：node scripts/gen-from-manifest.mjs（vendor 组件库同步后重跑一次）
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { atomicWriteFile } from '../lib/util/fs.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const VENDOR = path.join(ROOT, 'templates/admin/scaffold/frontend/vendor/vima-ui-admin/dist');

const manifest = JSON.parse(readFileSync(path.join(VENDOR, 'ai-manifest.json'), 'utf8'));

// 包类型出口全文 = index.d.ts + 其一层 `export * from './x'` 指向的 .d.ts
// （如 VTemplateEditor 经 export * from './template' 再导出，只扫 index.d.ts 会漏）
function typeSurface() {
  const indexDts = readFileSync(path.join(VENDOR, 'index.d.ts'), 'utf8');
  const parts = [indexDts];
  const reStar = /export \* from '(\.[^']+)'/g;
  let m;
  while ((m = reStar.exec(indexDts)) !== null) {
    for (const candidate of [`${m[1]}.d.ts`, `${m[1]}/index.d.ts`]) {
      try {
        parts.push(readFileSync(path.join(VENDOR, candidate), 'utf8'));
        break;
      } catch {
        /* 试下一个候选 */
      }
    }
  }
  return parts.join('\n');
}
const indexDts = typeSurface();

// ── 防谎言断言：声明出去的组件名必须真实存在于包类型出口 ──
const componentNames = manifest.components
  .map((c) => c.name)
  .filter((n) => typeof n === 'string' && n !== '')
  .sort();
const missing = componentNames.filter((n) => !indexDts.includes(n));
if (missing.length > 0) {
  process.stderr.write(`✘ manifest 组件在 dist/index.d.ts 中找不到出口：${missing.join('、')}\n`);
  process.stderr.write('  拒绝生成——先核对 vendor 同步是否完整（manifest 与 dist 必须同版本）。\n');
  process.exit(2);
}

// ── 1. ICONS.md ──
const icons = manifest.icons
  .map((i) => (typeof i === 'string' ? { name: i, aliases: [], category: '' } : i))
  .filter((i) => typeof i.name === 'string' && i.name !== '')
  .sort((a, b) => a.name.localeCompare(b.name));

const iconRows = icons.map((i) => {
  const aliases = Array.isArray(i.aliases) && i.aliases.length > 0 ? i.aliases.map((a) => `\`${a}\``).join('、') : '—';
  return `| \`${i.name}\` | ${aliases} | ${i.category || '—'} |`;
});
const iconsMd = `<!-- 生成自 @vima-tech/ui-admin ${manifest.version} ai-manifest.json，勿手改；由 vima-cli 仓库 scripts/gen-from-manifest.mjs 重新生成 -->

# 图标名清单（ICONS.md）

> \`<VIcon name="…">\` 的 \`name\` 只能取本清单中的值（含别名）；清单之外的名字渲染不出图标。
> post-write hook 对 .vue 中的静态字面量图标名按同一 manifest 机检（契约 §14），
> 动态绑定 \`:name\` 不在机检范围，取值同样必须落在本清单内。

共 **${icons.length}** 个图标。

| 图标名 | 别名 | 分类 |
|---|---|---|
${iconRows.join('\n')}
`;
await atomicWriteFile(path.join(ROOT, 'templates/admin/ui-docs/ICONS.md'), iconsMd);

// ── 2. components.d.ts ──
const dtsEntries = componentNames.map((n) => `    ${n}: typeof import('@vima-tech/ui-admin')['${n}']`);
const dts = `// 生成自 vendor/vima-ui-admin/dist/ai-manifest.json（${manifest.version}），勿手改；
// 由 vima-cli 仓库 scripts/gen-from-manifest.mjs 重新生成（同源防漂移，评估 §6A5）。
// 组件库 install() 已全局注册全部组件（main.ts app.use），本声明为模板中的
// 全局组件提供类型与 IDE 补全。
declare module 'vue' {
  export interface GlobalComponents {
${dtsEntries.join('\n')}
  }
}

export {}
`;
await atomicWriteFile(path.join(ROOT, 'templates/admin/scaffold/frontend/src/components.d.ts'), dts);

// ── 3. llms-full.txt（A8：ui-docs 全量档，llms.txt 多档分级思想——CAPABILITY 是索引档，
//       本文件供支持大上下文的外部工具单文件消费；顺序稳定保证字节确定）──
const uiDocsDir = path.join(ROOT, 'templates/admin/ui-docs');
const { readdirSync } = await import('node:fs');
const docNames = readdirSync(uiDocsDir)
  .filter((n) => n.endsWith('.md') && n !== 'CAPABILITY.md' && n !== 'ICONS.md')
  .sort();
const fullParts = [
  `<!-- 生成自 templates/admin/ui-docs/*.md（@vima-tech/ui-admin ${manifest.version}），勿手改；` +
    '由 scripts/gen-from-manifest.mjs 重新生成。单文件全量档：索引档见 CAPABILITY.md，' +
    '按需单读组件文档更省上下文，本文件供支持大上下文的工具一次性消费。 -->',
  '',
  readFileSync(path.join(uiDocsDir, 'CAPABILITY.md'), 'utf8').trim(),
  '',
  iconsMd.trim(),
];
for (const name of docNames) {
  fullParts.push('', '---', '', readFileSync(path.join(uiDocsDir, name), 'utf8').trim());
}
await atomicWriteFile(path.join(uiDocsDir, 'llms-full.txt'), `${fullParts.join('\n')}\n`);

process.stdout.write(
  `✔ ICONS.md（${icons.length} 图标） + components.d.ts（${componentNames.length} 组件）` +
    ` + llms-full.txt（${docNames.length + 2} 篇）已生成\n`,
);
