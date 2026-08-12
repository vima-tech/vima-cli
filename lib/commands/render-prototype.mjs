// vima render-prototype —— 渲染无样式线框原型 + prototype.manifest.json（契约 §11/§6.7；设计 §13.3/§19.7）
// 流程：loadSpec + loadContracts → 页面块校验（V-SPEC-03/04/05，缺失拒绝渲染）→
//       动态 import 模板渲染器 → html 与 manifest 双产物 atomicWriteFile → 置 lifecycle.prototypeRendered。
// --check：内存渲染与磁盘 html + manifest 逐字节比对，任一不一致或缺失 → exit 2 且不写盘。
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { EXIT, VimaError, usageError, precondition } from '../util/errors.mjs';
import { atomicWriteFile, fileExists, stableStringify } from '../util/fs.mjs';
import { extractBlocks } from '../util/md.mjs';
import { loadSpec } from '../model/spec.mjs';
import { loadContracts } from '../model/contracts.mjs';
import { loadLifecycle, saveLifecycle } from '../model/lifecycle.mjs';
import { loadTemplate, readProjectTemplateId } from '../model/template.mjs';

const DEFAULT_OUTPUT = 'docs/review/prototype.html';
const MANIFEST_NAME = 'prototype.manifest.json';

export async function run(argv, ctx) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { check: { type: 'boolean', default: false }, output: { type: 'string' } },
      allowPositionals: true,
    }));
  } catch (err) {
    throw usageError(`参数解析失败: ${err.message}`);
  }

  const root = ctx.cwd;
  const spec = await loadSpec(root);
  const contracts = await loadContracts(root);

  // 渲染前先过页面块校验（§19.6/§19.7：四要素缺失拒绝渲染并输出缺失清单）
  const errors = await collectPageErrors(spec);
  if (errors.length > 0) {
    process.stderr.write('❌ 页面数据块校验不通过，拒绝渲染（请先修补 spec 并通过 vima validate）：\n');
    for (const e of errors) process.stderr.write(`  - ${e}\n`);
    return EXIT.CHECK_FAILED;
  }

  const loaded = await loadRenderer(ctx.cliRoot, root);
  if (loaded.skip) {
    // 无页面概念的模板声明 prototype: false → 渲染器跳过（设计 §13.3 模板边界）
    process.stdout.write(`ℹ️ 模板 "${loaded.templateId}" 声明 prototype: false，跳过原型渲染\n`);
    return EXIT.OK;
  }
  const model = { projectName: path.basename(root), spec, contracts };
  const { html, manifest } = loaded.renderPrototype(model);
  const manifestText = stableStringify(manifest);

  const outRel = values.output ?? DEFAULT_OUTPUT;
  const outPath = path.resolve(root, outRel);
  const manifestPath = path.join(path.dirname(outPath), MANIFEST_NAME);
  const manifestRel = path.join(path.dirname(outRel), MANIFEST_NAME);

  if (values.check) {
    // 只比对不写盘：html 与 manifest 任一缺失或字节不一致 → exit 2
    const drift = [];
    for (const [p, rel, content] of [
      [outPath, outRel, html],
      [manifestPath, manifestRel, manifestText],
    ]) {
      if (!(await fileExists(p))) {
        drift.push(`${rel} 不存在`);
        continue;
      }
      const disk = await readFile(p);
      if (!disk.equals(Buffer.from(content, 'utf8'))) drift.push(`${rel} 与 spec 渲染结果不一致`);
    }
    if (drift.length > 0) {
      process.stderr.write('❌ --check 失败（请重新执行 vima render-prototype）：\n');
      for (const d of drift) process.stderr.write(`  - ${d}\n`);
      return EXIT.CHECK_FAILED;
    }
    process.stdout.write(`✅ --check 通过：${outRel} 与 ${manifestRel} 均与 spec 无漂移\n`);
    return EXIT.OK;
  }

  await atomicWriteFile(outPath, html);
  await atomicWriteFile(manifestPath, manifestText);
  await markLifecycle(root);
  const links = manifest.pages.reduce((n, p) => n + p.links.length, 0);
  process.stdout.write(
    `✅ 线框原型已生成: ${outRel} + ${manifestRel}（页面 ${manifest.pages.length} / 连线 ${links}）\n`,
  );
  return EXIT.OK;
}

/** 解析项目模板并动态加载原型渲染器（templateId 默认 admin；prototype:false 时跳过）。 */
async function loadRenderer(cliRoot, root) {
  const templateId = (await readProjectTemplateId(root)) ?? 'admin';
  const tpl = await loadTemplate(cliRoot, templateId);
  if (tpl.planning?.prototype === false) return { skip: true, templateId };
  const rel = tpl.planning?.renderers?.prototype;
  if (!rel) {
    throw precondition('NO_RENDERER', `模板 "${templateId}" 未声明原型渲染器（planning.renderers.prototype）`, `templates/${templateId}/template.json`);
  }
  const mod = await import(pathToFileURL(path.join(tpl.dir, rel)).href);
  if (typeof mod.renderPrototype !== 'function') {
    throw new VimaError('BAD_RENDERER', `渲染器缺少 renderPrototype 导出`, { path: rel });
  }
  return { skip: false, templateId, renderPrototype: mod.renderPrototype };
}

/** lifecycle 存在时置 checklists.PLANNING.prototypeRendered = true（缺失时静默跳过）。 */
async function markLifecycle(root) {
  let lifecycle;
  try {
    lifecycle = await loadLifecycle(root);
  } catch (err) {
    if (err instanceof VimaError && err.code === 'NO_LIFECYCLE') return;
    throw err;
  }
  lifecycle.checklists = lifecycle.checklists ?? {};
  lifecycle.checklists.PLANNING = lifecycle.checklists.PLANNING ?? {};
  lifecycle.checklists.PLANNING.prototypeRendered = true;
  await saveLifecycle(root, lifecycle);
}

// ── 页面块校验：优先复用 C3 的规则函数；C3 并行开发未就绪时退化为内联同规则校验 ──
// （契约 §2 所有权：命令层公共流程两命令各自实现，小工具函数就地写，不新建共享文件）

async function collectPageErrors(spec) {
  try {
    const mod = await import('./validate.mjs');
    if (typeof mod.validatePages === 'function') {
      const res = await mod.validatePages(spec);
      if (Array.isArray(res)) return res.map(formatRuleError);
    }
  } catch {
    /* validate.mjs 未就绪（C3 并行开发中）→ 内联实现同规则 */
  }
  return inlinePageErrors(spec);
}

function formatRuleError(e) {
  if (typeof e === 'string') return e;
  const rule = e.rule ? `[${e.rule}] ` : '';
  return `${rule}${e.message ?? JSON.stringify(e)}`;
}

// 布局区块枚举词表（契约 §8 V-SPEC-04）
const BLOCK_WORDS = new Set(['toolbar', 'search', 'table', 'form', 'cards', 'tabs', 'pagination']);
const ACTIONS = new Set(['nav', 'modal', 'api']);

/** 内联实现 V-SPEC-03/04/05（与契约 §8 规则表逐条对应）。 */
function inlinePageErrors(spec) {
  const errors = [];
  const pageIds = new Set(spec.pages.keys());
  const sortedIds = [...spec.pages.keys()].sort();

  // V-SPEC-05：PAGE/MODAL/ROLE/MENU/FLOW ID 全文档唯一
  const idCount = new Map();
  const record = (id) => {
    if (typeof id !== 'string' || id === '') return;
    idCount.set(id, (idCount.get(id) ?? 0) + 1);
  };
  // page 块重复 id 会在 Map 中互相覆盖，须从原文重扫
  for (const b of extractBlocks(spec.text, 'page')) record(b.data?.id);
  for (const [, p] of [...spec.pages.entries()].sort()) for (const mo of p.modals ?? []) record(mo.id);
  for (const r of spec.roles ?? []) record(r.id);
  for (const m of spec.menus ?? []) record(m.id);
  for (const f of spec.flows ?? []) record(f.id);
  for (const [id, n] of idCount) {
    if (n > 1) errors.push(`[V-SPEC-05] ID "${id}" 全文档重复出现 ${n} 次`);
  }

  for (const id of sortedIds) {
    const p = spec.pages.get(id);
    const modalIds = new Set((p.modals ?? []).map((mo) => mo.id));

    // V-SPEC-03：四要素齐全
    if (!Array.isArray(p.layout) || p.layout.length === 0) errors.push(`[V-SPEC-03] ${id}: layout 缺失或为空`);
    if (!Array.isArray(p.components) || p.components.length === 0) errors.push(`[V-SPEC-03] ${id}: components 缺失或为空`);
    if (!Array.isArray(p.apis) || p.apis.length === 0) errors.push(`[V-SPEC-03] ${id}: apis 缺失或为空`);

    // V-SPEC-04：布局词表
    for (const w of Array.isArray(p.layout) ? p.layout : []) {
      if (!BLOCK_WORDS.has(String(w))) errors.push(`[V-SPEC-04] ${id}: layout 含词表外区块 "${w}"`);
    }

    const checkInteraction = (it, where) => {
      if (it.action == null) return;
      if (!ACTIONS.has(it.action)) {
        errors.push(`[V-SPEC-03] ${id}: ${where} action "${it.action}" 非法（仅 nav|modal|api）`);
        return;
      }
      if (it.action === 'api') {
        if (typeof it.api !== 'string' || it.api === '') errors.push(`[V-SPEC-03] ${id}: ${where} action=api 缺少 api 字段`);
        return;
      }
      if (typeof it.target !== 'string' || it.target === '') {
        errors.push(`[V-SPEC-03] ${id}: ${where} action=${it.action} 缺少 target 字段`);
        return;
      }
      // V-SPEC-05：nav 指向存在的 PAGE；modal 指向本页 modals
      if (it.action === 'nav' && !pageIds.has(it.target)) {
        errors.push(`[V-SPEC-05] ${id}: ${where} nav target "${it.target}" 指向不存在的页面`);
      }
      if (it.action === 'modal' && !modalIds.has(it.target)) {
        errors.push(`[V-SPEC-05] ${id}: ${where} modal target "${it.target}" 未在本页 modals 中定义`);
      }
    };

    for (const comp of Array.isArray(p.components) ? p.components : []) {
      // V-SPEC-04：components[].block 词表
      if (!BLOCK_WORDS.has(String(comp.block))) {
        errors.push(`[V-SPEC-04] ${id}: components 含词表外区块 "${comp.block}"`);
      }
      let i = 0;
      for (const it of comp.items ?? []) checkInteraction(it, `components[${comp.block}].items[${i++}]`);
      i = 0;
      for (const ra of comp.rowActions ?? []) checkInteraction(ra, `components[${comp.block}].rowActions[${i++}]`);
    }
  }
  return errors;
}
