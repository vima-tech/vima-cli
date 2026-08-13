// vima render-prototype —— 渲染无样式线框原型 + prototype.manifest.json（契约 §11/§6.7；设计 §13.3/§19.7）
// 流程：loadSpec + loadContracts → 页面块校验（V-SPEC-03/04/05，缺失拒绝渲染）→
//       动态 import 模板渲染器 → html 与 manifest 双产物 atomicWriteFile → 置 lifecycle.prototypeRendered。
// --check：内存渲染与磁盘 html + manifest 逐字节比对，任一不一致或缺失 → exit 2 且不写盘。
// checkPrototypeFresh（A12）：approve 前置 2 的新鲜度判定，与 --check 共用 driftOf 比对。
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { EXIT, VimaError, precondition, usageFromParseArgs } from '../util/errors.mjs';
import { atomicWriteFile, driftOf, stableStringify } from '../util/fs.mjs';
import { loadSpec } from '../model/spec.mjs';
import { loadContracts } from '../model/contracts.mjs';
import { loadLifecycle, saveLifecycle } from '../model/lifecycle.mjs';
import { loadTemplate, readProjectTemplateId } from '../model/template.mjs';
import { validatePages } from './validate.mjs';

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
    throw usageFromParseArgs(err);
  }

  const root = ctx.cwd;
  const spec = await loadSpec(root);
  const contracts = await loadContracts(root);

  // 渲染前先过页面块校验（§19.6/§19.7：四要素缺失拒绝渲染并输出缺失清单；契约 §11 复用 validatePages）
  const errors = validatePages(spec).map(formatRuleError);
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
    // 只比对不写盘：html 与 manifest 任一缺失或字节不一致 → exit 2（与 approve 前置 2 共用 driftOf，A12）
    const drift = await driftOf([
      [outPath, outRel, html],
      [manifestPath, manifestRel, manifestText],
    ]);
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

/**
 * A12 新鲜度判定（approve 前置 2；契约 §11）：内存渲染原型与磁盘 html + manifest 逐字节比对。
 * 前提：调用方已保证 vima validate 通过（approve 前置 1）。
 * @returns {Promise<{skip: boolean, drift: string[]}>} skip = 模板声明 prototype:false
 */
export async function checkPrototypeFresh(root, cliRoot, outRel = DEFAULT_OUTPUT) {
  const spec = await loadSpec(root);
  const contracts = await loadContracts(root);
  const loaded = await loadRenderer(cliRoot, root);
  if (loaded.skip) return { skip: true, drift: [] };
  const { html, manifest } = loaded.renderPrototype({ projectName: path.basename(root), spec, contracts });
  const outPath = path.resolve(root, outRel);
  const manifestPath = path.join(path.dirname(outPath), MANIFEST_NAME);
  const manifestRel = path.join(path.dirname(outRel), MANIFEST_NAME);
  const drift = await driftOf([
    [outPath, outRel, html],
    [manifestPath, manifestRel, stableStringify(manifest)],
  ]);
  return { skip: false, drift };
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

// ── 页面块校验展示层：validatePages 条目（V-SPEC-03/04/05）→ 单行文案 ──

function formatRuleError(e) {
  if (typeof e === 'string') return e;
  const rule = e.rule ? `[${e.rule}] ` : '';
  return `${rule}${e.message ?? JSON.stringify(e)}`;
}
