// vima init —— 在当前项目部署 Claude Code 工作环境（设计 §4.4/§19.2；契约 §3/§6.2/§6.4/§12-A5）
// 安装清单（严格按契约 §6.4 的 userOwned 划分）：
//   userOwned：CLAUDE.md（← workspace/CLAUDE.project.md 变量替换）、docs/spec.md（← spec 骨架）
//              —— 已存在则跳过并提示「保留用户版本」，update 永不覆盖；
//   managed  ：AGENTS.md（← workspace/AGENTS.project.md，跨工具指针文件 A8）、
//              docs/planning-guide.md、docs/coding-standards.md、docs/planning-validation/*、docs/contracts/_example.md、
//              docs/tasks/_template-*.md、docs/raw|review/.gitkeep、docs/ui-framework/**（组件文档，
//              拷自模板 ui-docs/，生成自组件库 api.generated.json）、
//              .claude/{settings.json,commands/*,agents/*,hooks/*}（hooks chmod 0o755），
//              全量 sha256 记入 .vima/manifest.json 供 vima update 三方比较。
import path from 'node:path';
import { readFile, chmod } from 'node:fs/promises';
import { EXIT, usageError, precondition } from '../util/errors.mjs';
import { atomicWriteFile, fileExists, sha256, walkFiles } from '../util/fs.mjs';
import { loadTemplate, readProjectTemplateId } from '../model/template.mjs';
import { defaultLifecycle, loadLifecycle, saveLifecycle } from '../model/lifecycle.mjs';
import { loadManifest, saveManifest } from '../model/manifest.mjs';
import { resolveApps } from '../model/apps.mjs';
import { parseOpts, projectPkgOf, renderVars, readCliVersion, templateAppEntry } from './create.mjs';

const OPTS = {
  template: { type: 'string', short: 't' },
  force: { type: 'boolean' },
  'skip-scan': { type: 'boolean' },
  minimal: { type: 'boolean' },
};

// 契约 §6.4 userOwned 列表（原样落盘，update 永不触碰）
const USER_OWNED = ['CLAUDE.md', 'docs/spec.md', 'docs/contracts/', 'docs/tasks/', 'docs/raw/', 'docs/coverage-matrix.md'];

/**
 * 构建安装计划（init 与 update 共用同一份「managed 文件 → 模板源」映射）。
 * @returns {{ managed: Array<{rel,content,mode?}>, userOwned: Array<{rel,content}> }}
 */
export async function buildInstallPlan(root, template, vars, { minimal = false, skipScan = false, roster = null } = {}) {
  const managed = [];
  const userOwned = [];
  const wsDir = path.join(template.dir, template.workspace ?? 'workspace');
  const asset = (rel) => readFile(path.join(template.dir, rel), 'utf8');

  // userOwned：CLAUDE.md（变量替换，< 50 行由模板资产保证）
  userOwned.push({
    rel: 'CLAUDE.md',
    content: renderVars(await readFile(path.join(wsDir, 'CLAUDE.project.md'), 'utf8'), vars),
  });

  // managed：AGENTS.md（A8 跨工具兼容——agents.md 标准的指针文件，真源仍是 CLAUDE.md，
  // 供 Cursor/Codex 等读取 AGENTS.md 的工具使用；用户定制走 CLAUDE.md，本文件随模板升级）
  if (await fileExists(path.join(wsDir, 'AGENTS.project.md'))) {
    managed.push({
      rel: 'AGENTS.md',
      content: renderVars(await readFile(path.join(wsDir, 'AGENTS.project.md'), 'utf8'), vars),
    });
  }

  // managed：.claude/ 工作环境（settings + commands + agents + hooks）
  if (await fileExists(path.join(wsDir, 'settings.json'))) {
    managed.push({ rel: '.claude/settings.json', content: await readFile(path.join(wsDir, 'settings.json'), 'utf8') });
  }
  for (const sub of ['commands', 'agents', 'hooks']) {
    const dir = path.join(wsDir, sub);
    if (!(await fileExists(dir))) continue;
    for (const rel of await walkFiles(dir)) {
      managed.push({
        rel: `.claude/${sub}/${rel}`,
        content: await readFile(path.join(dir, rel), 'utf8'),
        ...(sub === 'hooks' ? { mode: 0o755 } : {}),
      });
    }
  }

  if (!minimal) {
    const planning = template.planning ?? {};
    // userOwned：spec 骨架（变量替换）
    if (planning.spec) {
      userOwned.push({ rel: 'docs/spec.md', content: renderVars(await asset(planning.spec), vars) });
    }
    // managed：规划资产
    if (planning.guide) managed.push({ rel: 'docs/planning-guide.md', content: await asset(planning.guide) });
    if (planning.codingStandards) {
      // CLAUDE.md「详细规范」指针的落点（§5.2/§5.4：详情外置，宪法只留指针）
      managed.push({ rel: 'docs/coding-standards.md', content: await asset(planning.codingStandards) });
    }
    if (planning.checklist) {
      managed.push({ rel: 'docs/planning-validation/validate.checklist.md', content: await asset(planning.checklist) });
    }
    if (planning.coverageExample) {
      managed.push({
        rel: 'docs/planning-validation/coverage-matrix.example.md',
        content: await asset(planning.coverageExample),
      });
    }
    if (planning.contractExample) {
      managed.push({ rel: 'docs/contracts/_example.md', content: await asset(planning.contractExample) });
    }
    for (const tRel of planning.taskTemplates ?? []) {
      managed.push({ rel: `docs/tasks/${path.basename(tRel)}`, content: await asset(tRel) });
    }
    managed.push({ rel: 'docs/raw/.gitkeep', content: '' });
    managed.push({ rel: 'docs/review/.gitkeep', content: '' });
    // managed：docs/ui-framework/** —— 组件文档由模板 ui-docs/ 预置整套拷入。
    // 决策说明：骨架现在 vendor 组件库（vendor/），组件文档由构建期从组件库
    // api.generated.json 生成后放进模板，init 不再扫描 node_modules/@vima-tech/ui-admin
    // ——运行时扫描 .d.ts 只能拿到导出名，模板预置文档带完整 props/events/slots，
    // 且离线、字节稳定（便于 manifest 校验和比较）。--skip-scan 现在表示跳过这套拷贝。
    // A16 多端：按端册逐端拷入 docs/ui-framework/<appId>/**（源 = 各 app 条目 uiDocs）；
    // 单端保留平铺旧形态（context 两种形态都认，契约 §6.4）。
    if (!skipScan) {
      const multi = Boolean(roster && roster.apps.length > 1);
      if (multi) {
        for (const app of roster.apps) {
          const entry = templateAppEntry(template, app);
          if (!entry || typeof entry.uiDocs !== 'string') continue;
          const dir = path.join(template.dir, entry.uiDocs);
          if (!(await fileExists(dir))) continue;
          for (const rel of await walkFiles(dir)) {
            managed.push({
              rel: `docs/ui-framework/${app.id}/${rel}`,
              content: await readFile(path.join(dir, rel), 'utf8'),
            });
          }
        }
      } else {
        const entry = roster?.apps[0] ? templateAppEntry(template, roster.apps[0]) : null;
        const uiDocsDir = path.join(template.dir, entry?.uiDocs ?? 'ui-docs');
        if (await fileExists(uiDocsDir)) {
          for (const rel of await walkFiles(uiDocsDir)) {
            managed.push({
              rel: `docs/ui-framework/${rel}`,
              content: await readFile(path.join(uiDocsDir, rel), 'utf8'),
            });
          }
        }
      }
    }
  }

  return { managed, userOwned };
}

/** 落盘一个 managed 计划项（原子写 + 可执行位），update 复用。 */
export async function applyManagedEntry(root, entry) {
  const abs = path.join(root, entry.rel);
  await atomicWriteFile(abs, entry.content);
  if (entry.mode) await chmod(abs, entry.mode);
}

export async function run(argv, ctx) {
  const { values, positionals } = parseOpts(argv, OPTS);
  if (positionals.length > 0) throw usageError(`多余的位置参数 "${positionals[0]}"`);
  const root = ctx.cwd;

  // 1. 确定模板：项目记录（manifest/lifecycle）优先，其次 --template
  const templateId = (await readProjectTemplateId(root)) ?? values.template;
  if (!templateId) {
    throw usageError(
      '无法确定项目模板：未找到 .vima/manifest.json 或 docs/lifecycle.json 中的 templateId，' +
        '请用 --template <id> 指定（如 vima init --template admin）',
    );
  }
  const template = await loadTemplate(ctx.cliRoot, templateId);

  // 2. A5 能力诚实分级：preview 模板拒绝 init（骨架可用 ≠ 工作流可用）
  if (template.status === 'preview') {
    throw precondition(
      'TEMPLATE_PREVIEW',
      `模板 "${templateId}" 为 preview，vima init 暂不支持：缺失 planning 资产` +
        '（planning-guide / spec 骨架 / 校验清单 / 任务模板 / 审计视图与原型渲染器 / workspace 工作环境），' +
        '将在后续版本补齐。当前仅可使用代码骨架本身。',
      `templates/${templateId}/template.json`,
    );
  }

  // 3. 已初始化检查：docs/lifecycle.json 或 .claude/settings.json 存在且非 --force → exit 4
  const initialized =
    (await fileExists(path.join(root, 'docs/lifecycle.json'))) ||
    (await fileExists(path.join(root, '.claude/settings.json')));
  if (initialized && !values.force) {
    throw precondition('ALREADY_INIT', '项目已初始化。更新生成物请使用 vima update，强制重建请加 --force');
  }

  // 4. 构建安装计划并落盘
  const now = new Date().toISOString(); // 真实时间戳（契约 §3 例外项）
  const projectName = path.basename(root);
  const vars = { projectName, projectPkg: projectPkgOf(projectName), createdAt: now };
  const plan = await buildInstallPlan(root, template, vars, {
    minimal: values.minimal === true,
    skipScan: values['skip-scan'] === true,
    roster: await resolveApps(root, { cliRoot: ctx.cliRoot }), // A16：组件文档按端安装
  });

  const skipped = [];
  const keptState = []; // A18：已存在的状态文件（lifecycle）——保留不重写，末尾提示
  for (const entry of plan.userOwned) {
    if (await fileExists(path.join(root, entry.rel))) {
      skipped.push(entry.rel);
      continue;
    }
    await atomicWriteFile(path.join(root, entry.rel), entry.content);
  }
  for (const entry of plan.managed) {
    await applyManagedEntry(root, entry);
  }

  // 5. docs/lifecycle.json：**状态不是生成物**——已存在则原样保留（与 userOwned 同口径）。
  //    --force 的语义是「强制重建生成物」，不是「清空进度」：重写会把 DEVELOPING 打回
  //    PLANNING 并丢掉 taskStats/phaseHistory/tasksApproved（A18 落地时在 sustain-v3 实测发现）。
  const vimaVersion = await readCliVersion(ctx.cliRoot);
  const prevLifecycle = await loadLifecycle(root).catch(() => null);
  if (prevLifecycle) {
    keptState.push(`docs/lifecycle.json（currentPhase=${prevLifecycle.currentPhase}）`);
  } else {
    const lifecycle = defaultLifecycle(template.id);
    lifecycle.vimaVersion = vimaVersion; // 与 manifest 同源（package.json），不用模型层缺省值
    for (const ph of lifecycle.phaseHistory) {
      if (ph.phase === 'BOOTSTRAP') ph.completedAt = now;
      if (ph.phase === 'PLANNING') ph.enteredAt = now;
    }
    await saveLifecycle(root, lifecycle);
  }

  // 6. .vima/manifest.json：managed 全量 sha256 清单 + userOwned 列表（契约 §6.4）
  //    **合并写**：create 写入的端册（apps/backend，A16 schemaVersion 2）与其余既有键
  //    必须原样保留——整体覆盖会把多端项目降级成 v1，resolveApps 合成的默认端册
  //    与真实布局不符（doctor ⑪ 误报「代码目录不在位」）。
  const prev = await loadManifest(root);
  await saveManifest(root, {
    ...(prev ?? {}),
    schemaVersion: prev?.schemaVersion ?? '1',
    vimaVersion,
    templateId: template.id,
    createdAt: prev?.createdAt ?? now,
    initializedAt: now,
    // A18：记录安装形态，供 update 构建与本项目一致的计划（否则新增受管文件无从判断该不该装）
    install: { minimal: values.minimal === true, skipScan: values['skip-scan'] === true },
    files: {
      ...(prev?.files ?? {}),
      managed: plan.managed
        .map((e) => ({ path: e.rel, checksum: `sha256:${sha256(e.content)}` }))
        .sort((a, b) => (a.path < b.path ? -1 : 1)),
      userOwned: USER_OWNED,
    },
  });

  // 7. 完成输出（§4.4 样式）
  for (const rel of skipped) {
    // 独立 ⚠️ 提示走 stderr（契约 §3 输出流向）
    process.stderr.write(`⚠️ ${rel} 已存在，保留用户版本（未覆盖）\n`);
  }
  for (const rel of keptState) {
    process.stderr.write(`⚠️ ${rel} 已存在，保留既有状态（未重置）\n`);
  }
  const minimal = values.minimal === true;
  const structure = minimal
    ? [
        '  CLAUDE.md                    # 项目宪法（< 50 行）',
        '  docs/',
        '    lifecycle.json             # 生命周期状态（当前：PLANNING）',
        '  .claude/                     # 斜杠命令 / 子代理 / hooks / settings',
        '  .vima/manifest.json          # 生成物清单（升级迁移用）',
      ]
    : [
        '  CLAUDE.md                    # 项目宪法（< 50 行）',
        '  docs/',
        '    lifecycle.json             # 生命周期状态（当前：PLANNING）',
        '    planning-guide.md          # PLANNING 阶段执行引导',
        '    coding-standards.md        # 编码规范（CLAUDE.md 指针落点）',
        '    planning-validation/       # 机械校验清单 + 覆盖矩阵示例',
        '    spec.md                    # 规格骨架（八章，待填充）',
        '    raw/                       # 存放原始文档',
        '    contracts/                 # API 契约目录（含 _example.md）',
        '    tasks/                     # 任务文件目录（含前后端模板）',
        '    review/                    # 审计视图与原型输出目录',
        '    ui-framework/              # UI 组件文档（CAPABILITY.md + 每组件一份）',
        '  .claude/',
        '    commands/                  # 斜杠命令（/go /check）',
        '    agents/                    # 子代理角色模板',
        '    hooks/                     # 校验 / 共享层写保护 / go 批间续跑钩子',
        '  .vima/manifest.json          # 生成物清单（升级迁移用）',
      ];
  process.stdout.write(
    [
      '',
      `✅ 初始化完成！（模板：${template.name} ${template.id}${minimal ? '，--minimal' : ''}）`,
      '',
      '项目结构：',
      ...structure,
      '',
      '下一步：',
      '  1. 将原始文档放入 docs/raw/ 目录',
      '  2. 运行 claude 启动 Claude Code',
      '  3. 通过自然语言描述需求，让 Agent 按 docs/planning-guide.md 整理文档',
      '',
    ].join('\n'),
  );
  return EXIT.OK;
}
