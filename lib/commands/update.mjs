// vima update —— 更新项目中的 vima 生成物（设计 §4.5/§19.3；契约 §6.4；A15 更名自 vima upgrade）
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
import { resolveApps } from '../model/apps.mjs';
import { parseOpts, projectPkgOf, readCliVersion, renderVars, scaffoldChecksums } from './create.mjs';
import { buildInstallPlan, applyManagedEntry } from './init.mjs';
import { loadLifecycle, saveLifecycle } from '../model/lifecycle.mjs';

const OPTS = {
  'dry-run': { type: 'boolean' },
  yes: { type: 'boolean' }, // 接受但无额外行为：本实现非交互，默认即自动接受安全覆盖
  'scaffold-diff': { type: 'boolean' }, // A19：骨架三方比较，只读报告
};

/**
 * A19：骨架三方比较（基线 / 磁盘现状 / 当前模板源重渲染）。
 * 骨架一旦生成就是用户的业务代码，故本函数**只产报告，绝不写盘**——
 * 合不合、怎么合由用户决定（A19「不做」：不提供 --scaffold-apply）。
 * @returns {{safe: string[], manual: string[]}} safe=用户没改过而模板变了；manual=两边都变了
 */
export function diffScaffold(baseline, diskSums, templateSums) {
  const safe = [];
  const manual = [];
  for (const { path: rel, checksum } of baseline) {
    const disk = diskSums.get(rel);
    const tpl = templateSums.get(rel);
    if (tpl === undefined || tpl === checksum) continue; // 模板没变 → 无可更新
    if (disk === undefined) continue; // 用户删掉了该文件 → 不越俎代庖
    if (disk === checksum) safe.push(rel);
    else manual.push(rel);
  }
  return { safe: safe.sort(), manual: manual.sort() };
}

/**
 * A18：项目的安装形态（决定 update 重建的计划范围，进而决定模板新增文件该不该装）。
 * 优先取 manifest.install（init 写入）；旧 manifest 无该键时按已记录文件确定性反推——
 * 判据来自 buildInstallPlan 的结构：--minimal 只装 AGENTS.md + .claude/**（无任何 docs/ 条目）；
 * --skip-scan 只跳过 docs/ui-framework/**。两条都是精确判据，不是启发式。
 * @param {object} manifest
 * @returns {{minimal: boolean, skipScan: boolean}}
 */
export function installOptionsOf(manifest) {
  const rec = manifest?.install;
  if (rec && typeof rec === 'object') {
    return { minimal: rec.minimal === true, skipScan: rec.skipScan === true };
  }
  const paths = (manifest?.files?.managed ?? []).map((e) => e.path);
  const minimal = !paths.some((p) => p.startsWith('docs/'));
  return { minimal, skipScan: !minimal && !paths.some((p) => p.startsWith('docs/ui-framework/')) };
}

/**
 * A19：manifest v1 → v2 端册迁移（契约 §6.4 既有宣称的落实）。
 * 已有 apps（create 写入的多端项目）不动；缺 apps 时把 roster 固化进 manifest。
 *
 * **保护面不得因迁移变弱**（实测陷阱）：guard-shared 对 v1 manifest（无 apps 键）走内置
 * 字面量兜底保护 `backend/**​/{config,security}/`；一旦写入 apps，它改走 v2 分支且
 * **不再回退**——若此时 backend.sharedDirs 为空（resolveApps 对 v1 合成的正是空数组），
 * 后端共享层会一点保护都不剩。故 backend 段改为按模板声明渲染，且**逐个校验目录真实存在**；
 * 校验不过就整体放弃迁移（保住 v1 兜底），不静默降级。
 *
 * @param {object} manifest
 * @param {object} roster resolveApps 结果
 * @param {{backendSharedDirs: string[], exists: (rel: string) => boolean}} probe
 *   backendSharedDirs = 模板 backend.sharedDirs 渲染后的相对路径；exists 判定其在磁盘是否在位
 * @returns {{summary: string}|{skipped: string}|null} 迁移摘要 / 放弃原因 / null（无需迁移）
 */
export function migrateRoster(manifest, roster, probe) {
  if (Array.isArray(manifest.apps)) {
    // 已是 v2：只在 schemaVersion 落后时补齐版本号
    if (manifest.schemaVersion !== '2') {
      manifest.schemaVersion = '2';
      return { summary: `schemaVersion 补齐为 2（端册 ${manifest.apps.length} 端，原样保留）` };
    }
    return null;
  }
  if (!roster || roster.apps.length === 0) return null; // 合成不出端册（无模板/preview）→ 不硬造

  // backend 共享层：模板声明为准，逐个校验在位；缺一个就放弃整次迁移
  let backendEntry = null;
  if (roster.backend) {
    const dirs = probe?.backendSharedDirs ?? [];
    const base = roster.backend.dir;
    const missing = dirs.filter((d) => !probe.exists(`${base}/${d}`));
    if (dirs.length > 0 && missing.length > 0) {
      return {
        skipped:
          `后端共享层目录不在位（${missing.join('、')}）——迁移会使 guard-shared 失去 v1 兜底保护面，` +
          '已放弃本次端册迁移（manifest 保持 v1，保护照旧）',
      };
    }
    backendEntry = { dir: base, sharedDirs: dirs };
  }

  manifest.schemaVersion = '2';
  manifest.apps = roster.apps.map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    dir: a.dir,
    codeDir: a.codeDir,
    sharedDirs: [...a.sharedDirs],
  }));
  if (backendEntry) manifest.backend = backendEntry;
  return {
    summary: `${manifest.apps.map((a) => `${a.id}:${a.kind}`).join('、')}`
      + `${backendEntry ? ` + backend（共享层 ${backendEntry.sharedDirs.length} 条）` : ''}`,
  };
}

/**
 * A19 `vima update --scaffold-diff`：骨架三方比较的只读报告子模式。
 * **不写任何文件、不改 manifest**——骨架是用户的业务代码，合不合由用户决定。
 */
async function runScaffoldDiff(root, template, manifest, ctx) {
  const baseline = manifest.files?.scaffold ?? [];
  if (baseline.length === 0) {
    process.stdout.write(
      'ℹ️ 本项目 create 时未记录骨架基线（A19 之前的版本），无法区分「你的业务改动」与「模板变更」。\n'
        + '   任何 diff 都会混着你自己的代码，给不出可信结论，故不做猜测。\n'
        + '   骨架基线自本版本起由 vima create 记录，新建项目可用。\n',
    );
    return EXIT.OK;
  }
  // 重渲染变量：createdAt 取 manifest 记录（骨架文件实测无 {{createdAt}} 占位，仍取以保确定性）
  const projectName = path.basename(root);
  const vars = { projectName, projectPkg: projectPkgOf(projectName), createdAt: manifest.createdAt ?? '' };
  const roster = Array.isArray(manifest.apps) ? manifest.apps : null;
  const templateSums = await scaffoldChecksums(template, vars, roster);

  const diskSums = new Map();
  for (const { path: rel } of baseline) {
    const abs = path.join(root, rel);
    if (await fileExists(abs)) diskSums.set(rel, `sha256:${await sha256File(abs)}`);
  }

  const { safe, manual } = diffScaffold(baseline, diskSums, templateSums);
  const lines = [`🧱 骨架三方比较（基线 ${baseline.length} 个文件 / 模板源 ${templateSums.size} 个）——只读报告，未写盘`];
  if (safe.length === 0 && manual.length === 0) {
    lines.push('  ✅ 模板骨架自本项目创建以来无变更，或变更的文件你都已自行改过（无可安全更新项）');
  }
  if (safe.length > 0) {
    lines.push(`  🟢 可安全更新（你未改过，模板已更新）共 ${safe.length} 个：`);
    for (const rel of safe) lines.push(`     ${rel}`);
  }
  if (manual.length > 0) {
    lines.push(`  🟡 需人工判断（你改过且模板也变了）共 ${manual.length} 个：`);
    for (const rel of manual) lines.push(`     ${rel}`);
  }
  lines.push('  ℹ️ 本命令不写盘（骨架 = 你的业务代码）。要合并请自行对照模板源：'
    + `${path.relative(root, template.dir) || template.dir}`);
  process.stdout.write(`${lines.join('\n')}\n`);
  return EXIT.OK;
}

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

  // A19 --scaffold-diff：只读子模式，独立于常规更新流程（不写任何文件、不改 manifest）
  if (values['scaffold-diff'] === true) {
    return runScaffoldDiff(root, template, manifest, ctx);
  }
  // A18：安装形态取自 manifest.install（init 写入）；旧 manifest 无该键时按已记录文件
  // **确定性反推**——计划的形态直接决定「模板新增文件该不该装」，不能靠猜。
  const install = installOptionsOf(manifest);
  const roster = await resolveApps(root, { cliRoot: ctx.cliRoot }); // A16：与 init 同源的按端组件文档映射
  const plan = await buildInstallPlan(root, template, vars, {
    minimal: install.minimal,
    skipScan: install.skipScan,
    roster,
  });
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
  // 模板源新增而 manifest 未记录的文件（A18）：**按与既有文件同一套三方比较处理并安装**。
  // 旧行为是只提示不装，代价是新增受管文件到不了存量项目——A18 的 Stop hook 就撞上了这条：
  // settings.json 被更新成引用新 hook，hook 本身却没装，配置直接指向不存在的文件。
  // 项目形态由 install 判定（见 installOptionsOf），--minimal 项目的计划里本就没有这些文件。
  for (const e of plan.managed) {
    if (recordedByPath.has(e.rel)) continue;
    const newSum = `sha256:${sha256(e.content)}`;
    const abs = path.join(root, e.rel);
    if (!(await fileExists(abs))) {
      actions.push({ rel: e.rel, action: 'new', src: e, newSum, note: '模板新增文件，已安装' });
      continue;
    }
    // 磁盘上已有同名文件却无记录（手工放置/上个版本残留）：等于模板源则采信，否则走人工合并
    const diskSum = `sha256:${await sha256File(abs)}`;
    if (diskSum === newSum) {
      actions.push({ rel: e.rel, action: 'adopt', newSum, note: '模板新增文件，磁盘已有同内容，仅登记' });
    } else {
      actions.push({
        rel: e.rel,
        action: 'merge',
        src: e,
        note: `模板新增文件，磁盘已有不同内容 → 新版本写 ${e.rel}.vima-new，请人工合并`,
      });
    }
  }
  actions.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

  const vimaVersion = await readCliVersion(ctx.cliRoot);

  // --dry-run：只打印动作表，不写盘
  process.stdout.write(
    `vima update：${manifest.vimaVersion ?? '?'} → ${vimaVersion}（模板：${template.id}）` +
      `${dryRun ? '【--dry-run，仅预览】' : ''}\n\n`,
  );
  for (const a of actions) {
    process.stdout.write(`  [${ACTION_LABEL[a.action]}] ${a.rel} —— ${a.note}\n`);
  }
  if (actions.length === 0) process.stdout.write('  （manifest 中没有 managed 记录）\n');
  if (dryRun) {
    process.stdout.write('\n未写盘（--dry-run）。去掉 --dry-run 执行实际更新。\n');
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
        // 有旧记录则保留（合并后再对齐）；模板新增文件无记录 → 不登记，下次 update 重新提示
        if (record) newManaged.push({ path: a.rel, checksum: record.checksum });
        break;
      case 'deprecated':
        newManaged.push({ path: a.rel, checksum: record.checksum }); // 保留记录与文件，仅提示
        break;
      case 'new': // A18：模板新增文件按计划安装并登记（含 hooks 的可执行位，applyManagedEntry 负责）
        await applyManagedEntry(root, a.src);
        newManaged.push({ path: a.rel, checksum: a.newSum });
        break;
      default:
        break;
    }
  }
  newManaged.sort((a, b) => (a.path < b.path ? -1 : 1));

  manifest.vimaVersion = vimaVersion;
  manifest.install = install; // A18：把（可能是反推出来的）安装形态固化，下次不必再反推
  manifest.files = { ...(manifest.files ?? {}), managed: newManaged };
  // A19：v1 manifest 端册迁移（兑现契约 §6.4 既有宣称）。前端段写入的正是消费方每次运行时
  // 由 resolveApps 合成的同一份端册；后端共享层按模板声明渲染并校验在位（见 migrateRoster）。
  const backendSharedDirs = (template.backend?.sharedDirs ?? []).map((d) => renderVars(d, vars));
  const existsCache = new Map();
  for (const d of backendSharedDirs) {
    const rel = `${roster.backend?.dir ?? 'backend'}/${d}`;
    existsCache.set(rel, await fileExists(path.join(root, rel)));
  }
  const migrated = migrateRoster(manifest, roster, {
    backendSharedDirs,
    exists: (rel) => existsCache.get(rel) === true,
  });
  await saveManifest(root, manifest);
  // 契约 §6.4：**lifecycle 与 manifest 的 vimaVersion 同源于 CLI package.json**。
  // init 两处都写，update 此前只写 manifest —— 升级后两处永久分叉，而 A21 复盘指纹
  // 读的是 lifecycle 那处（retro.mjs），于是每个升级过的项目都会向公开 issue 谎报 vima 版本。
  // 无条件写当前版本，顺带自愈已经分叉的存量项目。lifecycle 缺失时静默跳过（非本命令职责）。
  let lifecycleSynced = false;
  try {
    const lifecycle = await loadLifecycle(root);
    if (lifecycle.vimaVersion !== vimaVersion) {
      lifecycle.vimaVersion = vimaVersion;
      await saveLifecycle(root, lifecycle);
      lifecycleSynced = true;
    }
  } catch {
    /* 无 lifecycle.json：update 不负责创建它（那是 init 的职责） */
  }
  if (migrated?.summary) process.stdout.write(`\n🔀 manifest 端册已迁移为 v2：${migrated.summary}\n`);
  if (migrated?.skipped) process.stdout.write(`\n⚠️ 端册迁移已跳过：${migrated.skipped}\n`);

  process.stdout.write(
    `\n✅ 更新完成：vimaVersion 已更新为 ${vimaVersion}`
    + `${lifecycleSynced ? '（manifest 与 docs/lifecycle.json 两处同步）' : ''}\n`,
  );
  if (mergePending.length > 0) {
    process.stdout.write(
      '\n⚠️ 以下文件你已修改，未被覆盖；新版本已写至 <path>.vima-new，请人工合并后删除 .vima-new：\n' +
        mergePending.map((p) => `  - ${p}（新版本：${p}.vima-new）`).join('\n') +
        '\n',
    );
  }
  return EXIT.OK;
}
