// vima upgrade —— 升级项目中的 vima 生成物（设计 §4.5/§19.3；契约 §6.4）
// 三方比较（记录校验和 / 磁盘现状 / 新模板源）：
//   磁盘 == 记录（用户未改）→ 用模板源覆盖并更新记录；
//   磁盘 != 记录（用户改过）→ 写 <path>.vima-new 并列入待合并报告（原文件不动）；
//   模板源已无此文件        → 提示废弃，不删除；
//   userOwned               → 永不触碰。
// 偏离说明：待合并采用 <path>.vima-new 文件而非 §4.5 的 .vima/upgrade-preview/<file>.diff；
//           --yes 即默认行为（本实现非交互，不做逐文件确认）。
import path from 'node:path';
import { EXIT, usageError, precondition } from '../util/errors.mjs';
import { atomicWriteFile, fileExists, sha256, sha256File } from '../util/fs.mjs';
import { loadTemplate } from '../model/template.mjs';
import { loadManifest, saveManifest } from '../model/manifest.mjs';
import { parseOpts, projectPkgOf, readCliVersion } from './create.mjs';
import { buildInstallPlan, applyManagedEntry } from './init.mjs';

const OPTS = {
  'dry-run': { type: 'boolean' },
  yes: { type: 'boolean' }, // 接受但无额外行为：本实现非交互，默认即自动接受安全覆盖
};

const ACTION_LABEL = {
  overwrite: '覆盖',
  unchanged: '最新',
  reinstall: '重装',
  merge: '合并',
  adopt: '采信',
  deprecated: '废弃',
  new: '新增',
};

export async function run(argv, ctx) {
  const { values, positionals } = parseOpts(argv, OPTS);
  if (positionals.length > 0) throw usageError(`多余的位置参数 "${positionals[0]}"`);
  const root = ctx.cwd;
  const dryRun = values['dry-run'] === true;

  // 前置：必须先 init 出 manifest
  const manifest = await loadManifest(root);
  if (!manifest) {
    throw precondition('NO_MANIFEST', '未找到 .vima/manifest.json，请先运行 vima init', '.vima/manifest.json');
  }
  const templateId = manifest.templateId;
  if (!templateId) {
    throw precondition('NO_TEMPLATE_ID', 'manifest 缺少 templateId，无法定位模板源，请重新运行 vima init', '.vima/manifest.json');
  }
  const template = await loadTemplate(ctx.cliRoot, templateId);

  // 用当前模板源重建 managed 计划（与 init 完全同源，保证映射一致）
  const projectName = path.basename(root);
  const vars = { projectName, projectPkg: projectPkgOf(projectName), createdAt: '' };
  const plan = await buildInstallPlan(root, template, vars, { skipScan: false });
  const planByRel = new Map(plan.managed.map((e) => [e.rel, e]));

  const recorded = manifest.files?.managed ?? [];
  const recordedByPath = new Map(recorded.map((e) => [e.path, e]));

  // 逐个 managed 记录做三方比较，得出动作表
  const actions = []; // { rel, action, src?, note }
  for (const entry of recorded) {
    const src = planByRel.get(entry.path);
    if (!src) {
      actions.push({ rel: entry.path, action: 'deprecated', note: '模板源已无此文件，保留在磁盘上（不删除）' });
      continue;
    }
    const newSum = `sha256:${sha256(src.content)}`;
    const abs = path.join(root, entry.path);
    if (!(await fileExists(abs))) {
      actions.push({ rel: entry.path, action: 'reinstall', src, newSum, note: '磁盘缺失，按模板源重装' });
      continue;
    }
    const diskSum = `sha256:${await sha256File(abs)}`;
    if (diskSum === entry.checksum) {
      // 用户未改：覆盖为新模板源（内容相同则只对齐记录）
      actions.push({
        rel: entry.path,
        action: diskSum === newSum ? 'unchanged' : 'overwrite',
        src,
        newSum,
        note: diskSum === newSum ? '已是最新' : '未修改，随模板更新',
      });
    } else if (diskSum === newSum) {
      // 用户改过，但恰好等于新模板源（手动升级过）：只更新记录
      actions.push({ rel: entry.path, action: 'adopt', newSum, note: '磁盘内容已等于新模板源，仅更新记录' });
    } else {
      actions.push({
        rel: entry.path,
        action: 'merge',
        src,
        note: `用户已修改 → 新版本写 ${entry.path}.vima-new，请人工合并`,
      });
    }
  }
  // 模板源新增而 manifest 未记录的文件：只提示，不自动安装（避免破坏 --minimal 项目形态）
  for (const e of plan.managed) {
    if (!recordedByPath.has(e.rel)) {
      actions.push({ rel: e.rel, action: 'new', note: '模板新增文件（未安装；如需获取请运行 vima init --force）' });
    }
  }
  actions.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

  const vimaVersion = await readCliVersion(ctx.cliRoot);

  // --dry-run：只打印动作表，不写盘
  process.stdout.write(
    `vima upgrade：${manifest.vimaVersion ?? '?'} → ${vimaVersion}（模板：${template.id}）` +
      `${dryRun ? '【--dry-run，仅预览】' : ''}\n\n`,
  );
  for (const a of actions) {
    process.stdout.write(`  [${ACTION_LABEL[a.action]}] ${a.rel} —— ${a.note}\n`);
  }
  if (actions.length === 0) process.stdout.write('  （manifest 中没有 managed 记录）\n');
  if (dryRun) {
    process.stdout.write('\n未写盘（--dry-run）。去掉 --dry-run 执行实际升级。\n');
    return EXIT.OK;
  }

  // 应用动作并更新 manifest 记录
  const mergePending = [];
  const newManaged = [];
  for (const a of actions) {
    const record = recordedByPath.get(a.rel);
    switch (a.action) {
      case 'overwrite':
      case 'reinstall':
        await applyManagedEntry(root, a.src);
        newManaged.push({ path: a.rel, checksum: a.newSum });
        break;
      case 'unchanged':
        newManaged.push({ path: a.rel, checksum: a.newSum });
        break;
      case 'adopt':
        newManaged.push({ path: a.rel, checksum: a.newSum });
        break;
      case 'merge':
        await atomicWriteFile(path.join(root, `${a.rel}.vima-new`), a.src.content);
        mergePending.push(a.rel);
        newManaged.push({ path: a.rel, checksum: record.checksum }); // 保留旧记录，合并后再对齐
        break;
      case 'deprecated':
        newManaged.push({ path: a.rel, checksum: record.checksum }); // 保留记录与文件，仅提示
        break;
      case 'new':
        break; // 不安装、不记录
      default:
        break;
    }
  }
  newManaged.sort((a, b) => (a.path < b.path ? -1 : 1));

  manifest.vimaVersion = vimaVersion;
  manifest.files = { ...(manifest.files ?? {}), managed: newManaged };
  await saveManifest(root, manifest);

  process.stdout.write(`\n✅ 升级完成：vimaVersion 已更新为 ${vimaVersion}\n`);
  if (mergePending.length > 0) {
    process.stdout.write(
      '\n⚠️ 以下文件你已修改，未被覆盖；新版本已写至 <path>.vima-new，请人工合并后删除 .vima-new：\n' +
        mergePending.map((p) => `  - ${p}（新版本：${p}.vima-new）`).join('\n') +
        '\n',
    );
  }
  return EXIT.OK;
}
