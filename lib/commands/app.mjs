// vima app —— 端册生命周期（A16 Wave 3，契约 §6.4/§14）
//
//   vima app list                        列出端册
//   vima app add <id> --kind <kind>      后补一个前端端
//
// 为什么必须有它（不是「顺手加个命令」）：A16 的模型是「后端单数、前端复数」，而真实节奏
// 是**先有后台、后要患者端**。端册只能由 create 一次写死的话，存量项目要加第二个前端就只能
// 手改 .vima/manifest.json——那正是「宣称与实现两张皮」的起点。
//
// 布局：新端一律落 `apps/<id>/`（A28 后 create 的既有端本就在 apps/，追加即均质）；
// 改判前创建的存量根布局项目（dir "."）不动，
// 于是出现「根 + apps/」的混合布局——这是 A16 D-A16-03 明确接受的形态，
// 因为 dir 是端册里的**数据**，全部消费方（validate/trace/guard/context/渲染器）
// 经 resolveApps 读声明，对布局无感。存量端零迁移是这条设计的全部意义。
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { EXIT, usageError, precondition, usageFromParseArgs } from '../util/errors.mjs';
import { fileExists, sha256, walkFiles } from '../util/fs.mjs';
import { loadManifest, saveManifest } from '../model/manifest.mjs';
import { loadTemplate } from '../model/template.mjs';
import { resolveApps } from '../model/apps.mjs';
import { renderVars, templateAppEntry, resolveScaffoldEntries } from './create.mjs';
import { applyManagedEntry } from './init.mjs';
import { mkdir, writeFile, rename, chmod, unlink } from 'node:fs/promises';

// 端 id 词法与 create 的 APP_ID_RE 同一条（契约 §14「同 taskId 词法」），不另立标准
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/** 端册条目的展示行（list 与 add 完成提示共用同一格式，两处口径不分叉）。 */
function rosterLine(app, kinds, scaffolded = null) {
  const status = kinds?.[app.kind]?.status ?? 'unknown';
  const flag = status === 'stable' ? '' : ` （kind ${status}）`;
  // 骨架在位状态（契约 §14）：preview kind 入册但无骨架是**预期**，如实标注而不是报错
  const mark = scaffolded === null ? '' : scaffolded ? ' ✅骨架在位' : ' ⚠️无骨架';
  return `  ${app.id.padEnd(12)} ${String(app.kind).padEnd(12)} ${String(app.dir).padEnd(16)}${mark}${flag}`;
}

/** Buffer 原子写（骨架文件可能是二进制；与 create 同款手法，不用随机数/时间戳）。 */
let tmpSeq = 0;
async function atomicWriteBuffer(dest, buf, mode) {
  await mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.${process.pid}.${++tmpSeq}.tmp`;
  try {
    await writeFile(tmp, buf);
    if (mode & 0o111) await chmod(tmp, mode & 0o777);
    await rename(tmp, dest);
  } catch (err) {
    try {
      await unlink(tmp);
    } catch {
      /* 忽略清理失败 */
    }
    throw err;
  }
}

export async function run(argv, ctx) {
  const root = ctx.cwd;
  const sub = argv[0];
  if (sub !== 'list' && sub !== 'add') {
    throw usageError('用法：vima app list | vima app add <id> --kind <kind>');
  }

  const manifest = await loadManifest(root);
  if (!manifest) {
    throw precondition('NOT_INITIALIZED', '未找到 .vima/manifest.json——请先运行 vima init', root);
  }
  const template = await loadTemplate(ctx.cliRoot, manifest.templateId);
  const kinds = template?.planning?.kinds ?? {};
  // 端册以 manifest 为准；v1（无 apps 键）由 resolveApps 合成，与 update 迁移同一份结果
  const roster = await resolveApps(root, { cliRoot: ctx.cliRoot });

  if (sub === 'list') {
    process.stdout.write(`端册（${roster.apps.length} 端）\n`);
    process.stdout.write(`  ${'ID'.padEnd(12)} ${'KIND'.padEnd(12)} ${'DIR'.padEnd(16)}骨架\n`);
    for (const app of roster.apps) {
      const at = app.dir === '.' || app.dir === '' ? root : path.join(root, app.dir);
      process.stdout.write(`${rosterLine(app, kinds, await fileExists(at))}\n`);
    }
    if (roster.backend) process.stdout.write(`  后端        —            ${roster.backend.dir}\n`);
    return EXIT.OK;
  }

  // ── app add ──
  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv.slice(1),
      options: { kind: { type: 'string' }, name: { type: 'string' } },
      allowPositionals: true,
    }));
  } catch (err) {
    throw usageFromParseArgs(err);
  }

  const id = positionals[0];
  if (!id) throw usageError('缺少端 id：vima app add <id> --kind <kind>');
  if (!ID_RE.test(id)) throw usageError(`非法端 id "${id}"（须匹配 ^[a-z0-9][a-z0-9-]*$）`);
  if (roster.apps.some((a) => a.id === id)) {
    throw precondition('APP_EXISTS', `端 "${id}" 已在端册中（vima app list 可查看）`, root);
  }

  const kind = values.kind;
  if (!kind) throw usageError('缺少 --kind：可选 ' + Object.keys(kinds).join(' / '));
  if (!Object.hasOwn(kinds, kind)) {
    throw usageError(`未知 kind "${kind}"：模板 "${template.id}" 声明的是 ${Object.keys(kinds).join(' / ')}`);
  }

  const entry = templateAppEntry(template, { id, kind });
  if (!entry) {
    throw usageError(`模板 "${template.id}" 的 apps 里没有 kind "${kind}" 的条目，无法确定骨架来源`);
  }

  const dir = `apps/${id}`;
  if (await fileExists(path.join(root, dir))) {
    throw precondition('APP_EXISTS', `目录 ${dir}/ 已存在——先移走它，或换一个端 id`, path.join(root, dir));
  }

  // 变量与 create 同源：projectName 取项目根目录名，createdAt 取 manifest（A19 的
  // 确定性依据——同一项目重跑渲染必得同字节，不引入新的时间戳）
  const vars = {
    projectName: path.basename(root),
    projectPkg: String(manifest.templateId ?? 'app'),
    createdAt: manifest.createdAt ?? '',
    appId: id,
  };
  // projectPkg 与 create 口径一致：项目名小写去非字母数字
  vars.projectPkg = vars.projectName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'app';

  const preview = kinds[kind].status === 'preview';
  let written = 0;
  const scaffoldBaseline = [];
  if (!preview && typeof entry.scaffold === 'string') {
    for (const e of await resolveScaffoldEntries(template, entry.scaffold, dir, vars)) {
      await atomicWriteBuffer(path.join(root, e.destRel), e.out, e.mode);
      // A19 骨架基线：记录落盘后的实际内容哈希，新端一并享有 update --scaffold-diff
      scaffoldBaseline.push({ path: e.destRel, checksum: `sha256:${sha256(e.out)}` });
      written += 1;
    }
  }

  // 组件文档按端安装到 docs/ui-framework/<id>/**（init 的多端形态，契约 §6.4）。
  // 已有单端项目的平铺 docs/ui-framework/** 不动——context 两种形态都认，
  // 移动它反而要改 manifest.files.managed 的既有条目，得不偿失。
  const managedAdded = [];
  if (typeof entry.uiDocs === 'string') {
    const src = path.join(template.dir, entry.uiDocs);
    if (await fileExists(src)) {
      for (const rel of await walkFiles(src)) {
        const item = {
          rel: `docs/ui-framework/${id}/${rel}`,
          content: renderVars(await readFile(path.join(src, rel), 'utf8'), vars),
        };
        await applyManagedEntry(root, item);
        managedAdded.push({ path: item.rel, checksum: `sha256:${sha256(item.content)}` });
      }
    }
  }

  // 端册落账（manifest 是「有哪些端」的唯一真源，A16 设计原则 2）
  const sharedDirs = (Array.isArray(entry.sharedDirs) ? entry.sharedDirs : []).map((d) => renderVars(d, vars));
  manifest.schemaVersion = '2';
  if (!Array.isArray(manifest.apps)) {
    // v1 项目：先把现算端册固化下来，再追加新端（与 vima update 的迁移同一份结果）
    manifest.apps = roster.apps.map((a) => ({
      id: a.id, name: a.name, kind: a.kind, dir: a.dir, codeDir: a.codeDir, sharedDirs: a.sharedDirs,
    }));
    if (roster.backend && !manifest.backend) manifest.backend = { ...roster.backend };
  }
  manifest.apps.push({
    id,
    name: values.name ?? entry.name ?? id,
    kind,
    dir,
    codeDir: typeof entry.codeDir === 'string' ? entry.codeDir : 'src',
    sharedDirs,
  });
  manifest.files = manifest.files ?? {};
  if (scaffoldBaseline.length > 0) {
    manifest.files.scaffold = [...(manifest.files.scaffold ?? []), ...scaffoldBaseline];
  }
  if (managedAdded.length > 0) {
    manifest.files.managed = [...(manifest.files.managed ?? []), ...managedAdded];
  }
  await saveManifest(root, manifest);

  if (preview) {
    process.stdout.write(`⚠️ kind ${kind} 为 preview：已入册但跳过骨架生成，PLANNING 全流程可用\n`);
  }
  process.stdout.write(`✅ 端 "${id}" 已加入端册（骨架 ${written} 个文件，组件文档 ${managedAdded.length} 份）\n`);
  process.stdout.write(`\n端册（${manifest.apps.length} 端）\n`);
  for (const app of manifest.apps) process.stdout.write(`${rosterLine(app, kinds)}\n`);
  process.stdout.write(
    '\n下一步（多端项目的显式声明要求，缺了会被 validate 拦住）：\n'
      + `  1. docs/spec.md 第三章：该端页面块补 app: ${id}（端册每个端至少要有一个页面）\n`
      + '  2. docs/spec.md 第六章：vima:menus 每条补 app 键（mobile 端的菜单 = tabbar，3–5 项）\n'
      + `  3. docs/contracts/*.md：每个 api 补 consumers（多端必填；该端能调的接口才写上 ${id}）\n`
      + '  4. vima validate → vima render-prototype → vima approve\n',
  );
  return EXIT.OK;
}
