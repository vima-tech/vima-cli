// vima render-prototype —— 渲染无样式线框原型 + prototype.manifest.json（契约 §11/§6.7；设计 §13.3/§19.7）
// 流程：loadSpec + loadContracts + resolveApps → 页面块校验（V-SPEC-03/04/05/12/13，缺失拒绝渲染）→
//       动态 import 模板渲染器 → 逐端渲染（A16：N=1 保留旧名 prototype.html，N≥2 输出
//       prototype.<appId>.html）→ manifest 单文件聚合为顶层 apps map（§6.7 新形态，N=1 同）
//       → 全部产物 atomicWriteFile → 置 lifecycle.prototypeRendered。
// --app <id>：只渲染指定端；--output 仅单端产物语境（N=1 或配合 --app）有效，多端全量
// 给 --output → usage exit 3（一个路径接不住 N 份产物，不做静默截断）。
// --check：内存渲染与磁盘各端 html + manifest 逐字节比对，任一不一致或缺失 → exit 2 且不写盘。
// checkPrototypeFresh（A12）：approve 前置 2 的新鲜度判定，遍历全部端，与 --check 共用 driftOf。
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { EXIT, VimaError, precondition, usageError, usageFromParseArgs } from '../util/errors.mjs';
import { atomicWriteFile, driftOf, stableStringify } from '../util/fs.mjs';
import { loadSpec } from '../model/spec.mjs';
import { loadContracts } from '../model/contracts.mjs';
import { loadLifecycle, saveLifecycle } from '../model/lifecycle.mjs';
import { loadTemplate, readProjectTemplateId } from '../model/template.mjs';
import { resolveApps } from '../model/apps.mjs';
import { validatePages } from './validate.mjs';

const DEFAULT_OUTPUT = 'docs/review/prototype.html';
const MANIFEST_NAME = 'prototype.manifest.json';

/** 渲染目标端集合：--app 指定单端；缺省全部端；空端册回退单次渲染（app=null 旧行为）。 */
function renderTargets(apps, appFlag) {
  if (appFlag !== undefined) {
    const hit = apps.apps.find((a) => a.id === appFlag);
    if (!hit) {
      throw usageError(`--app "${appFlag}" 不在端册（可用：${apps.apps.map((a) => a.id).join(' | ') || '（空端册）'}）`);
    }
    return [hit];
  }
  return apps.apps.length > 0 ? apps.apps : [null];
}

/** 单端产物相对路径：N=1 保留旧名；N≥2 按端命名（A16，契约 §6.7）。 */
function outRelOf(apps, app, outputFlag) {
  if (outputFlag) return outputFlag;
  if (!apps.multi || app === null) return DEFAULT_OUTPUT;
  return `docs/review/prototype.${app.id}.html`;
}

/**
 * 逐端内存渲染（run 与 checkPrototypeFresh 共用，保证「看的图 = 当前 spec」判定单一实现）。
 * @returns {Promise<{skip: boolean, files: Array<[abs, rel, content]>, manifestText: string,
 *   pageCount: number, linkCount: number, outRels: string[]}>}
 */
async function renderAll(root, cliRoot, { appFlag, outputFlag } = {}) {
  const spec = await loadSpec(root);
  const contracts = await loadContracts(root);
  const apps = await resolveApps(root, { cliRoot });

  // 渲染前先过页面块校验（§19.6/§19.7；契约 §11 复用 validatePages，A16 传端册）
  const errors = validatePages(spec, apps.apps.length > 0 ? apps : null).map(formatRuleError);
  if (errors.length > 0) return { skip: false, errors };

  const loaded = await loadRenderer(cliRoot, root);
  if (loaded.skip) return { skip: true, templateId: loaded.templateId };

  if (apps.multi && appFlag === undefined && outputFlag !== undefined) {
    throw usageError('多端项目全量渲染不支持 --output（N 份产物接不进一个路径）；请配合 --app <id> 使用');
  }

  const targets = renderTargets(apps, appFlag);
  const files = [];
  const manifestApps = {};
  let pageCount = 0;
  let linkCount = 0;
  for (const app of targets) {
    const model = {
      projectName: path.basename(root),
      spec,
      contracts,
      apps: apps.apps.length > 0 ? apps : null,
      app: app?.id ?? null,
    };
    const { html, manifest } = loaded.renderPrototype(model);
    const rel = outRelOf(apps, app, outputFlag);
    files.push([path.resolve(root, rel), rel, html]);
    manifestApps[app?.id ?? 'default'] = { pages: manifest.pages };
    pageCount += manifest.pages.length;
    linkCount += manifest.pages.reduce((n, p) => n + p.links.length, 0);
  }
  // §6.7 新形态：单文件 manifest，顶层 apps 按 id 排序（stableStringify 保证 key 排序与字节稳定）
  const manifestText = stableStringify({ schemaVersion: '1', apps: manifestApps });
  const manifestRel = path.join(path.dirname(files[0][1]), MANIFEST_NAME);
  // --app 单端渲染时 manifest 只含该端——仅供预览；全量渲染才写全端 manifest
  return {
    skip: false,
    files,
    manifestAbs: path.join(path.dirname(files[0][0]), MANIFEST_NAME),
    manifestRel,
    manifestText,
    pageCount,
    linkCount,
    partial: appFlag !== undefined && apps.multi,
  };
}

export async function run(argv, ctx) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        check: { type: 'boolean', default: false },
        output: { type: 'string' },
        app: { type: 'string' }, // A16：单端渲染
      },
      allowPositionals: true,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }

  const root = ctx.cwd;
  const r = await renderAll(root, ctx.cliRoot, { appFlag: values.app, outputFlag: values.output });
  if (r.errors) {
    process.stderr.write('❌ 页面数据块校验不通过，拒绝渲染（请先修补 spec 并通过 vima validate）：\n');
    for (const e of r.errors) process.stderr.write(`  - ${e}\n`);
    return EXIT.CHECK_FAILED;
  }
  if (r.skip) {
    // 无页面概念的模板声明 prototype: false → 渲染器跳过（设计 §13.3 模板边界）
    process.stdout.write(`ℹ️ 模板 "${r.templateId}" 声明 prototype: false，跳过原型渲染\n`);
    return EXIT.OK;
  }

  const pairs = [...r.files, ...(r.partial ? [] : [[r.manifestAbs, r.manifestRel, r.manifestText]])];

  if (values.check) {
    // 只比对不写盘：各端 html 与 manifest 任一缺失或字节不一致 → exit 2（与 approve 前置 2 共用 driftOf，A12）
    const drift = await driftOf(pairs);
    if (drift.length > 0) {
      process.stderr.write('❌ --check 失败（请重新执行 vima render-prototype）：\n');
      for (const d of drift) process.stderr.write(`  - ${d}\n`);
      return EXIT.CHECK_FAILED;
    }
    process.stdout.write(`✅ --check 通过：${pairs.map((p) => p[1]).join('、')} 均与 spec 无漂移\n`);
    return EXIT.OK;
  }

  for (const [abs, , content] of pairs) await atomicWriteFile(abs, content);
  await markLifecycle(root);
  process.stdout.write(
    `✅ 线框原型已生成: ${r.files.map((f) => f[1]).join('、')}${r.partial ? '（--app 单端，manifest 未重写）' : ` + ${r.manifestRel}`}（页面 ${r.pageCount} / 连线 ${r.linkCount}）\n`,
  );
  return EXIT.OK;
}

/**
 * A12 新鲜度判定（approve 前置 2；契约 §11）：全部端内存渲染与磁盘 html + manifest 逐字节比对。
 * 前提：调用方已保证 vima validate 通过（approve 由前置 1 保证）。
 * @returns {Promise<{skip: boolean, drift: string[]}>} skip = 模板声明 prototype:false
 */
export async function checkPrototypeFresh(root, cliRoot) {
  const r = await renderAll(root, cliRoot, {});
  if (r.skip) return { skip: true, drift: [] };
  if (r.errors) return { skip: false, drift: r.errors.map((e) => `docs/spec.md 页面块校验未通过：${e}`) };
  const drift = await driftOf([...r.files, [r.manifestAbs, r.manifestRel, r.manifestText]]);
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

// ── 页面块校验展示层：validatePages 条目（V-SPEC-03/04/05/12/13）→ 单行文案 ──

function formatRuleError(e) {
  if (typeof e === 'string') return e;
  const rule = e.rule ? `[${e.rule}] ` : '';
  return `${rule}${e.message ?? JSON.stringify(e)}`;
}
