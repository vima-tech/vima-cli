// CLI —— 给人与 CI 的门面。
//
// 解决的需求：ARCHITECTURE front 层「CLI（给人与 CI）」。它是**薄壳**：
// 解析入参 → 调 lib/front/actions.mjs → 渲染。这里不允许出现任何判据，
// 一条也不行——判据在 actions/ops/core，两个门面共用同一份。
//
// 两条硬性输出纪律：
//   ① 结果走 stdout，诊断走 stderr。管道里 `vima next --json | jq` 必须干净。
//   ② 退出码有明确语义（见 EXIT 与 help），CI 靠码判断，不靠 grep 文本。
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import * as A from './actions.mjs';
import { EXIT, FrontError } from './actions.mjs';
// 纯函数、同层、无副作用——`.mcp.json` 与 mcp-install 打印的必须是同一份配置，
// 两处各写一份正是这套系统存在的理由要消灭的东西。
import { mcpConfig } from './claude.mjs';

const COMMON = {
  json: { type: 'boolean', default: false },
  cwd: { type: 'string' },
  help: { type: 'boolean', short: 'h', default: false },
};

// 导出只为一件事：z.seams 拿它比对「help 宣传的旗标」与「真认的旗标」。
// help 文本与这张表漂移不会报错，只会让照着 help 敲命令的人 exit 1。
export const SPECS = {
  init: { ...COMMON, name: { type: 'string' }, theme: { type: 'string' }, force: { type: 'boolean', default: false } },
  compile: { ...COMMON, docs: { type: 'string' }, plan: { type: 'boolean', default: false } },
  sync: { ...COMMON, check: { type: 'boolean', default: false } },
  // --include-leased：默认不显示被别人占着的题（那才是「我该干什么」的答案）；
  // 要看谁在做什么时才加它。
  next: { ...COMMON, 'include-leased': { type: 'boolean', default: false } },
  claim: { ...COMMON, actor: { type: 'string' } },
  submit: { ...COMMON, how: { type: 'string' }, actor: { type: 'string' } },
  rule: {
    ...COMMON,
    question: { type: 'string' },
    chosen: { type: 'string' },
    options: { type: 'string' },
    rationale: { type: 'string' },
    confidence: { type: 'string' },
    blast: { type: 'string' },
    subject: { type: 'string' },
    overrides: { type: 'string' },
    actor: { type: 'string' },
  },
  ask: { ...COMMON },
  // 子命令（add/list/remove…）走位置参数，值走旗标——与 rule 同一种形态，不发明新的
  app: { ...COMMON, id: { type: 'string' }, kind: { type: 'string' } },
  theme: { ...COMMON },
  block: { ...COMMON, check: { type: 'boolean', default: false } }, // upgrade --check：只报不改
  status: { ...COMMON },
  audit: { ...COMMON },
  doctor: { ...COMMON },
  ui: { ...COMMON, port: { type: 'string' } },
  mcp: { help: COMMON.help, cwd: COMMON.cwd },
  'mcp-install': { ...COMMON },
  help: { ...COMMON },
  version: { ...COMMON },
};

export async function main(argv = [], io = {}) {
  const out = io.out ?? process.stdout;
  const err = io.err ?? process.stderr;
  const env = io.env ?? process.env;
  const cwd0 = io.cwd ?? process.cwd();
  const say = (s = '') => out.write(`${s}\n`);
  const warn = (s = '') => err.write(`${s}\n`);

  const cmd = argv[0];
  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    say(helpText(argv[1]));
    return EXIT.OK;
  }
  if (cmd === '--version' || cmd === '-v' || cmd === 'version') {
    say(await A.version());
    return EXIT.OK;
  }
  if (!Object.hasOwn(SPECS, cmd)) {
    warn(`vima: 未知命令 ${cmd}`);
    warn('vima help 看全部命令。');
    return EXIT.USAGE;
  }

  let parsed;
  try {
    parsed = parseArgs({ args: argv.slice(1), options: SPECS[cmd], allowPositionals: true, strict: true });
  } catch (e) {
    warn(`vima ${cmd}: USAGE: ${e.message}`);
    warn(`vima help ${cmd}`);
    return EXIT.USAGE;
  }
  const { values: v, positionals: pos } = parsed;
  if (v.help) {
    say(helpText(cmd));
    return EXIT.OK;
  }
  const cwd = v.cwd ? path.resolve(cwd0, v.cwd) : cwd0;
  const emit = (data, human) => {
    if (v.json) say(JSON.stringify(data, null, 2));
    else say(human);
  };

  try {
    switch (cmd) {
      case 'init': {
        const r = await A.init({ cwd, name: v.name, theme: v.theme, force: v.force });
        for (const n of r.notes) warn(`vima init: 注意: ${n}`);
        emit(r, renderInit(r));
        return EXIT.OK;
      }

      case 'status': {
        // 恒 exit 0：它要可视化的正是「会话开在错目录」这种故障
        const r = await A.status({ cwd, env });
        emit(r, renderStatus(r));
        return EXIT.OK;
      }

      case 'mcp-install': {
        // 工具清单从 mcp.mjs 现取。这里曾手抄一份 ['next','claim',...]——
        // 同一个文件为了不复制 .mcp.json 专门 import 了 mcpConfig，却把工具清单
        // 抄了一份；改 TOOLS 时 mcp-install 会静默说错。同病同治：只留一个真源。
        const { TOOLS } = await import('./mcp.mjs');
        emit(mcpInstallData(TOOLS), mcpInstallText(TOOLS));
        return EXIT.OK;
      }

      case 'mcp': {
        const { serve } = await import('./mcp.mjs');
        await serve({ cwd, env });
        return EXIT.OK;
      }

      default: break;
    }

    const ctx = await A.makeCtx({ cwd, env, actor: v.actor || 'cli' });

    switch (cmd) {
      case 'compile': {
        // 默认走 docs/——那是设计里唯一的真源。批次 JSON 仍然收（CI 与测试要它），
        // 但它是旁路，不是主路：主路上人改的是 markdown。
        //
        // 「有没有喂批次」不能用 isTTY 判：CI、hook、cron、脚本里 stdin 都是
        // 非 TTY 的空管道，那样会把「什么都没喂」当成「喂了空 JSON」，
        // 报一句莫名其妙的解析失败。判据只能是**读出来的东西空不空**。
        const input = await readBatch(pos[0], io.stdin ?? process.stdin);
        const r = input
          ? await A.compile(ctx, input)
          : await A.compileDocs(ctx, path.join(ctx.root, v.docs ?? 'docs'), { plan: v.plan });
        emit(r, renderCompile(r));
        // 一个规格文件都没扫到 → 用法错误。它不是「合法的空状态」：
        // 人刚下令编译，结果什么都没有可编，多半是 docs/ 空着或忘了写 layer 文件头。
        // 静默 exit 0 会让这件事一路混到「怎么一条命题都没有」才被发现。
        if (r.files && r.files.length === 0) return EXIT.USAGE;
        // 逐条拒不是整批失败，但「有条目没编进去」必须让 CI 看见
        return r.rejected.length ? EXIT.UNMET : EXIT.OK;
      }

      case 'sync': {
        const r = await A.sync({ root: ctx.root, config: ctx.config, check: v.check });
        emit(r, renderSync(r, v.check));
        // --check 有漂移 → exit 5（跑通了，但结论是「不一致」）。CI 靠它。
        return (v.check && r.drifted) ? EXIT.UNMET : EXIT.OK;
      }

      case 'next': {
        const r = await A.next(ctx, { includeLeased: v['include-leased'] });
        for (const n of r.notes) warn(`vima next: ${n}`);
        emit(r, renderNext(r));
        return EXIT.OK;
      }

      case 'claim': {
        if (!pos[0]) return usage(warn, 'claim', 'vima claim <claimId>');
        // worktree 传 cwd：并行时每个 Builder 在自己的 worktree 里跑，
        // 这是租约里唯一能说清「占着它的那个人在哪干活」的一段。
        const r = await A.claimTask(ctx, pos[0], { worktree: cwd });
        for (const n of r.notes) warn(`vima claim: ${n}`);
        emit(r, [`已认领 ${r.claimId}（${r.claim.layer}）：${r.claim.statement || '(无陈述)'}`,
          `  租约到 ${r.lease.expiresAt} 过期${r.renewed ? '（续租）' : r.reclaimed ? '（回收了一份过期租约）' : ''}`,
        ].join('\n'));
        return EXIT.OK;
      }

      case 'submit': {
        if (!pos[0]) return usage(warn, 'submit', 'vima submit <claimId> [--how=derived|executed|claimed|<JSON>]');
        let how = v.how ?? null;
        if (typeof how === 'string' && how.trim().startsWith('{')) {
          try { how = JSON.parse(how); } catch { return usage(warn, 'submit', '--how 的 JSON 解析不了'); }
        }
        const r = await A.submit(ctx, pos[0], how);
        emit(r, renderSubmit(r));
        // 不达标不是「命令失败」，是「结论是没达标」——给它自己的码，CI 能分开处置
        return r.met ? EXIT.OK : EXIT.UNMET;
      }

      case 'rule': {
        const r = await A.rule(ctx, {
          question: v.question ?? pos[0],
          chosen: v.chosen ?? pos[1],
          options: v.options,
          rationale: v.rationale,
          confidence: v.confidence,
          blastRadius: v.blast,
          subject: v.subject,
          overrides: v.overrides,
        });
        const lines = [`已记裁定 ${r.id}`,
          `  问题  ${r.question}`, `  裁定  ${r.chosen}`, `  置信  ${r.confidence}  影响面 ${r.blastRadius}`];
        if (r.overrides) lines.push(`  改判  ${r.overrides}（旧裁定转为已复核）`);
        if (r.revised) lines.push(`  命题 ${r.revised} 已随改判修订——它和它的下游会进失效清单，走同一条传播链路。`);
        emit(r, lines.join('\n'));
        return EXIT.OK;
      }

      case 'ask': {
        if (!pos[0]) return usage(warn, 'ask', 'vima ask <claimId>');
        const r = await A.ask(ctx, pos[0]);
        emit(r, renderAsk(r));
        return EXIT.OK;
      }

      // ── config 的受管写入口（P1-4）：门面只分发子命令，判据全在 actions ──

      case 'app': {
        switch (pos[0]) {
          case 'add': {
            const r = await A.appAdd(ctx, { id: v.id, kind: v.kind });
            for (const n of r.notes) warn(`vima app: 注意: ${n}`);
            emit(r, `已登记端 ${r.id}（${r.kind}）${r.synced ? '，规则投影已刷新' : ''}——共 ${r.apps.length} 个端`);
            return EXIT.OK;
          }
          case 'list': {
            const r = await A.appList(ctx);
            emit(r, r.apps.length
              ? r.apps.map((a) => `  ${a.id}  (${a.kind})`).join('\n')
              : '还没登记任何端。vima app add --id=<id> --kind=<kind>');
            return EXIT.OK;
          }
          case 'remove': {
            const r = await A.appRemove(ctx, { id: v.id });
            for (const n of r.notes) warn(`vima app: 注意: ${n}`);
            emit(r, `已移除端 ${r.id}（${r.kind}）${r.synced ? '，规则投影已刷新' : ''}——剩 ${r.apps.length} 个端`);
            return EXIT.OK;
          }
          default:
            return usage(warn, 'app', 'vima app add --id=<id> --kind=<kind> | list | remove --id=<id>');
        }
      }

      case 'theme': {
        switch (pos[0]) {
          case 'set': {
            const r = await A.themeSet(ctx, pos[1]);
            emit(r, r.changed ? `主题已切换：${r.before ?? '-'} → ${r.theme}` : `主题本来就是 ${r.theme}（变更事件照记）`);
            return EXIT.OK;
          }
          case 'show': {
            const r = await A.themeShow(ctx);
            emit(r, r.ok
              ? `主题 ${r.theme}（资产仓里存在，令牌与词表读得出）`
              : `主题 ${r.theme ?? '-'}\n  ! ${r.error}`);
            return EXIT.OK;
          }
          default:
            return usage(warn, 'theme', 'vima theme set <name> | show');
        }
      }

      case 'block': {
        switch (pos[0]) {
          case 'add': {
            if (!pos[1]) return usage(warn, 'block', 'vima block add <set>/<name>');
            const r = await A.blockAdd(ctx, pos[1]);
            for (const n of r.notes) warn(`vima block: 注意: ${n}`);
            emit(r, `已安装块 ${r.id}（层：${r.layers.join(' ')}）——共 ${r.blocks.length} 个块`);
            return EXIT.OK;
          }
          case 'list': {
            const r = await A.blockList(ctx);
            emit(r, renderBlockList(r));
            return EXIT.OK;
          }
          case 'remove': {
            if (!pos[1]) return usage(warn, 'block', 'vima block remove <set>/<name>');
            const r = await A.blockRemove(ctx, pos[1]);
            emit(r, `已移除块 ${r.id}——剩 ${r.blocks.length} 个块`);
            return EXIT.OK;
          }
          case 'upgrade': {
            const r = await A.blockUpgrade(ctx, { check: v.check });
            for (const n of r.notes) warn(`vima block: 注意: ${n}`);
            emit(r, renderBlockUpgrade(r));
            // --check 有漂 → exit 5（跑通了，但结论是「资产已经不是锁的那一版」）。
            // apply 之后是 0：升级本身成功了，要不要重新取证是人接下来的事。
            return (r.check && r.drifted) ? EXIT.UNMET : EXIT.OK;
          }
          default:
            return usage(warn, 'block', 'vima block add <set>/<name> | list | remove <set>/<name> | upgrade [--check]');
        }
      }

      case 'audit': {
        const r = await A.audit(ctx);
        emit(r, renderAudit(r));
        return r.errors > 0 ? EXIT.UNMET : EXIT.OK;
      }

      case 'doctor': {
        const r = await A.doctor(ctx);
        emit(r, renderDoctor(r));
        // 与 audit 同口径：跑通了但结论是「有项不达标」→ exit 5，CI 靠它。
        return r.counts.error > 0 ? EXIT.UNMET : EXIT.OK;
      }

      case 'ui': {
        const r = await A.ui(ctx, { port: v.port ? Number(v.port) : undefined });
        if (r && typeof r === 'object' && r.url) say(String(r.url));
        warn('Ctrl-C 结束。按需起、不常驻。');
        return EXIT.OK;
      }

      default:
        warn(`vima: 未知命令 ${cmd}`);
        return EXIT.USAGE;
    }
  } catch (e) {
    if (e instanceof FrontError) {
      warn(`vima ${cmd}: ${e.code}: ${e.message}`);
      if (e.hint) warn(`  → ${e.hint}`);
      return e.exit;
    }
    warn(`vima ${cmd}: INTERNAL: ${e?.message ?? e}`);
    if (e?.stack) warn(e.stack.split('\n').slice(1, 4).join('\n'));
    return EXIT.INTERNAL;
  }
}

/** 编译批次：从文件或 stdin 读一份 { upstream, layer, items } —— 不在这里发明第二种格式。 */
/** 读批次 JSON。没给文件、stdin 也没内容 → 返回 null（调用方回落到 docs/）。 */
async function readBatch(file, stdin) {
  let text = '';
  if (file) {
    text = await readFile(file, 'utf8');
  } else if (stdin && !stdin.isTTY) {
    const chunks = [];
    for await (const c of stdin) chunks.push(c);
    text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
  }
  if (!text.trim()) {
    // 显式给了文件却是空的，是真的错——别悄悄回落成编 docs/，
    // 那会让人以为自己那份批次生效了。
    if (file) throw new FrontError('USAGE', `批次文件 ${file} 是空的`, { exit: EXIT.USAGE });
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new FrontError('USAGE', `批次 JSON 解析失败：${e.message}`, { exit: EXIT.USAGE });
  }
}

function usage(warn, cmd, line) {
  warn(`vima ${cmd}: USAGE: 缺少参数`);
  warn(`  ${line}`);
  return EXIT.USAGE;
}

// ── 渲染（只格式化，不判断）────────────────────────────────────────────────

function renderInit(r) {
  const lines = [`已在 ${r.root} 立起 vima 项目`];
  for (const c of r.created) lines.push(`  + ${c}`);
  lines.push(r.templates ? '  + .claude/（来自 templates/project/）' : '  ! .claude/ 未落（模板缺席）');
  lines.push('', '下一步：在 docs/ 写规格 → vima compile → vima next');
  return lines.join('\n');
}

function renderStatus(r) {
  if (!r.ok) {
    return [
      'vima status: 当前不在 vima 项目里',
      `  cwd                 ${r.cwd}`,
      `  VIMA_PROJECT_DIR    ${r.checked.VIMA_PROJECT_DIR ?? '(未设置)'}`,
      `  CLAUDE_PROJECT_DIR  ${r.checked.CLAUDE_PROJECT_DIR ?? '(未设置)'}`,
      `  → ${r.hint}`,
    ].join('\n');
  }
  const t = r.tiers;
  const lines = [
    `${r.name || path.basename(r.root)}  (${r.root})`,
    `  主题 ${r.theme ?? '-'}   端 ${r.apps.length}   块 ${r.blocks.length}`,
    '',
    '  进度三档',
    `    声明   ${t.declared}`,
    `    有证据 ${t.evidenced}`,
    `    达标   ${t.met}`,
    '',
    `  成本   tokens ${r.cost.tokens}   ms ${r.cost.ms}   （run ${r.runs} 次，裁定 ${r.rulings} 条）`,
  ];
  if (r.stale.length) {
    lines.push('', `  失效清单（${r.stale.length}）—— 上游变了，这些的证据不再算数`);
    for (const s of r.stale) lines.push(`    ${s.id}  [${s.layer}]  ← ${s.from.join(', ') || '(无上游)'}`);
  } else {
    lines.push('', '  失效清单  空');
  }
  if (r.corrupt) lines.push('', `  ! events.jsonl 有 ${r.corrupt} 行读不出来（已跳过）`);
  return lines.join('\n');
}

function renderNext(r) {
  if (!r.task) return ['没有下一步。', ...r.notes.map((n) => `  ${n}`), ...leasedLines(r)].join('\n');
  const t = r.task;
  const lines = [
    `下一条  ${t.id}  [${t.layer}]${t.stale ? '  (已失效，需重做)' : ''}`,
    `  ${t.statement || '(无陈述)'}`,
    `  来源 ${t.trust}   需要证据强度 ≥ ${t.need}   当前 ${t.best?.strength ?? 'none'}`,
  ];
  // 两种边分开显示：来源（追溯用，不挡你开工）vs 执行依赖（挡）。
  // 合成一行「上游」正是 P0-9 说的那种污染——人会以为来源没达标就不能动手。
  if (t.from.length) lines.push(`  派生自 ${t.from.join(', ')}（derivesFrom：追溯用，不阻塞开工）`);
  if (r.dependsOn?.length) lines.push(`  依赖 ${r.dependsOn.join(', ')}（dependsOn：必须先有）`);
  if (r.blockedBy.length) lines.push(`  ! 执行依赖未达标：${r.blockedBy.join(', ')}（先做它们）`);
  if (r.lease) lines.push(`  ! 这条正被 ${r.lease.actor} 占着，租约到 ${r.lease.expiresAt} 过期`);
  if (t.impl.length) lines.push(`  落点 ${t.impl.join(', ')}`);
  if (r.rules.length) {
    lines.push('', `  适用规则（${r.rules.length}）`);
    for (const rule of r.rules) lines.push(`    ${rule.id}${rule.origin ? `  (${rule.origin})` : ''}`);
  }
  const assets = r.assets ?? { vocab: [], blocks: [] };
  if (assets.vocab.length) {
    lines.push('', '  词表切片（按层裁剪，词条 id 是封闭集合——只能从这些里挑）');
    for (const s of assets.vocab) lines.push(`    ${s.vocab}.${s.group}  ${s.terms.join(' ')}`);
  }
  for (const b of assets.blocks) {
    lines.push('', `  块供料 ${b.block} ${b.layer}  ← ${b.source}`);
    if (b.text != null) lines.push(...b.text.split('\n').map((l) => `    ${l}`));
    else lines.push(`    （正文 ${b.bytes} 字节已降级为引用——自己读上面那个文件）`);
  }
  lines.push('', `  上下文  主题 ${r.context.theme ?? '-'}   块 ${r.context.blocks.join(', ') || '-'}`);
  lines.push(`  提取能力  ${r.context.extract.engine}/${r.context.extract.granularity}，看不见：${r.context.extract.blind.join('、')}`);
  lines.push(...leasedLines(r));
  lines.push('', `  做完了跑 vima submit ${t.id}（系统自己取证，不用你自述）`);
  return lines.join('\n');
}

/** 被租约挡在候选外的题。不显示它们，人只会看到「怎么少了几条」然后去查一遍事件流。 */
function leasedLines(r) {
  if (!r.leased?.length) return [];
  const out = ['', `  别人手上（${r.leased.length}，未过期租约）`];
  for (const l of r.leased) out.push(`    ${l.claimId}  ${l.actor}  到 ${l.expiresAt} 过期  ${l.worktree ?? ''}`.trimEnd());
  return out;
}

function renderSync(r, check) {
  const lines = [];
  const { rules, mcp } = r;
  // 两种漂移的**修法不同**（投影重建 vs 资产升级），所以分开数、分开报。
  // 曾经这里只认投影漂：资产锁漂了照样打印「跑 vima sync 重建」，
  // 而 sync 根本不动 lock——人照做一遍，什么都没变，然后不再信这条提示。
  const projectionDrift = rules.written.length + rules.removed.length + (mcp.changed ? 1 : 0);
  const assets = r.assets ?? null;
  if (check) {
    if (!r.drifted) {
      return assets && assets.unlocked.length
        ? `派生投影与真源一致；资产锁也对得上。\n  ${assets.unlocked.length} 项资产还没锁（${assets.unlocked.map((u) => u.id).join('、')}）——没锁就查不出漂没漂。`
        : '派生投影与真源一致；资产锁也对得上。';
    }
    if (projectionDrift) lines.push('派生投影已漂移（真源改过但没重跑 sync）：');
  }
  for (const f of rules.written) lines.push(`  ${check ? '需更新' : '写入'}  .claude/rules/${f}`);
  for (const f of rules.removed) lines.push(`  ${check ? '需删除' : '删除'}  .claude/rules/${f}`);
  if (mcp.changed) lines.push(`  ${check ? '需更新' : '写入'}  ${mcp.path}`);
  if (!check) {
    lines.push('', `规则投影 ${rules.total} 条（其中 ${rules.unconditional} 条无 paths、每次会话都加载）`);
  }
  const noApps = rules.skipped.filter((s) => s.reason === 'no-apps');
  if (noApps.length) lines.push(`  ${noApps.length} 条端限定规则暂未投影（项目还没登记端），仍由 vima next 下发`);
  for (const s of rules.skipped) {
    if (s.reason === 'no-apps') continue;
    lines.push(`  ! ${s.id} 未投影：${s.why}`);
  }
  if (check && projectionDrift) lines.push('', '跑 `vima sync` 重建。');
  if (assets && assets.drifted) {
    lines.push('', `资产锁对不上（${assets.drifted} 项）——项目以为用的是 lock 记的那一版，实际不是：`);
    for (const e of assets.entries) {
      if (e.status === 'ok') continue;
      lines.push(`  ${e.status.padEnd(10)} ${e.kind} ${e.id}   ${e.why}`);
    }
    lines.push('  这些内容可能已经被用来取过证了。跑 `vima block upgrade --check` 看波及哪些命题。');
  }
  if (check && assets && assets.unlocked.length) {
    lines.push(`  ${assets.unlocked.length} 项资产还没锁（${assets.unlocked.map((u) => u.id).join('、')}）——没锁就查不出漂没漂。`);
  }
  return lines.join('\n') || '无变化。';
}

function renderCompile(r) {
  const lines = [];
  if (r.files) {
    // 一个规格文件都没扫到，却输出「已写入 0 条事件」并 exit 0——那是最坏的那种成功。
    // 多半是 docs/ 里的 markdown 忘了写 layer 文件头，人只会看见「怎么什么都没发生」。
    if (r.files.length === 0) {
      lines.push('docs/ 下没有可编译的规格文件（规格必须有 `layer:` 文件头）。');
      if (r.skipped?.length) lines.push(`  跳过的 markdown：${r.skipped.join('、')}`);
      lines.push('');
    } else {
      for (const f of r.files) {
        lines.push(`  ${f.layer.padEnd(8)} ${f.file}  +${f.written}${f.rejected ? ` 拒${f.rejected}` : ''}`);
      }
      lines.push('');
    }
  }
  // 计划态与提交态必须一眼分得开：`--plan` 说的是「会改什么」，不是「改了什么」。
  if (r.planned !== undefined && !r.committed) {
    lines.push(r.rejected.length
      ? `计划 ${r.planned} 条事件，但有条目被拒——**零写入**（要么整次提交，要么什么都不动）`
      : `计划 ${r.planned} 条事件（--plan：只算不写）`);
  } else {
    lines.push(`已写入 ${r.written} 条事件（命题 ${r.claims.length} 条）`);
  }
  // 幂等的证据是这个数字，不是「没退休任何东西」。
  // 原样重跑应当 written=0 且 noop 覆盖全部命题——不说出来，人无从判断它真幂等。
  if (r.noop?.length) {
    lines.push(`  ${r.noop.length} 条与现状一致，未产生事件（compile 可重跑）`);
  }
  if (r.retired?.length) {
    lines.push(`退休 ${r.retired.length} 条（docs 里已不存在）：${r.retired.join('、')}`);
    lines.push('  依赖它们的命题会进失效清单——上游没了不等于上游满足了。');
  }
  if (r.rejected.length) {
    lines.push('', `被拒 ${r.rejected.length} 条（**整次未提交**，改完重跑）`);
    for (const x of r.rejected) {
      lines.push(`  ${x.id ?? '(无 id)'}`);
      for (const why of x.reasons ?? []) lines.push(`    - ${why}`);
    }
  }
  return lines.join('\n');
}

function renderSubmit(r) {
  const head = r.met
    ? `✓ ${r.claimId} 达标（需要 ≥ ${r.need}，取到 ${r.got}）`
    : `✗ ${r.claimId} 未达标（需要 ≥ ${r.need}，取到 ${r.got ?? 'none'}）`;
  const lines = [head];
  if (!r.attested && r.reason) lines.push(`  取证没成：${r.reason}`);
  for (const e of r.evidence.slice(-5)) {
    lines.push(`    ${e.strength}  ${e.by ? JSON.stringify(e.by) : '(未记取证方式)'}`);
  }
  if (r.stale) lines.push('  ! 这条已失效：上游改过，先处理上游');
  // 「强度够了却没达标」是最容易看懵的一种失败——必须指名说出为什么。
  // 不说的话，人只看到「取到 executed / 需要 ≥ executed / 未达标」，
  // 会以为是 bug，然后去找绕过的办法。
  if (r.blockedByAdHoc) {
    lines.push('  ! 强度够了，但那份证据是**临时命令**跑出来的（adHoc），不算正式。');
    lines.push('    挑什么命令就验出什么结论——所以现挑的命令换不来达标。');
    lines.push('    正式做法：在 .vima/policies/<id>.json 写一条证据策略（人写、可 review、进版本控制），');
    lines.push('    命题里声明 `policy: <id>`，然后跑 `vima submit <claimId>`（不带 --how）。');
  }
  if (!r.met) lines.push('  → 改完再跑一次 submit。系统只认取证结果，不认自述。');
  return lines.join('\n');
}

function renderAsk(r) {
  const c = r.claim;
  const lines = [
    `${c.id}  [${c.layer}]  ${c.met ? '达标' : '未达标'}${c.stale ? ' · 已失效' : ''}`,
    `  ${c.statement || '(无陈述)'}`,
    `  来源 ${c.trust}   门槛 ${c.need}   最强证据 ${c.best?.strength ?? 'none'}   修订 ${c.revision}`,
  ];
  if (r.evidence.length) {
    lines.push('', `  证据（${r.evidence.length}）`);
    for (const e of r.evidence) lines.push(`    ${e.at}  ${e.strength}  ${e.by ?? '(未记取证方式)'}`);
  } else {
    lines.push('', '  证据  无');
  }
  if (r.upstream.length) {
    lines.push('', '  上游');
    for (const u of r.upstream) lines.push(`    ${u.id}  ${u.missing ? '(不存在)' : u.met ? '达标' : '未达标'}`);
  }
  if (r.downstream.length) {
    lines.push('', '  下游');
    for (const d of r.downstream) lines.push(`    ${d.id}  ${d.met ? '达标' : '未达标'}${d.stale ? ' · 已失效' : ''}`);
  }
  if (r.rulings.length) {
    lines.push('', '  相关裁定');
    for (const x of r.rulings) lines.push(`    ${x.chosen}  (置信 ${x.confidence})  ${x.question}`);
  }
  return lines.join('\n');
}

/** 摘要在人读输出里只给前 12 位——够对眼，不糊屏。要全量看 --json。 */
const shortDigest = (d) => (d ? String(d).replace(/^sha256:/, '').slice(0, 12) : '?');

function renderBlockUpgrade(r) {
  const lines = [];
  if (!r.drifted) {
    lines.push(r.status.locked
      ? `已锁的 ${r.status.locked} 项资产与资产仓一致。`
      : '还没有任何资产被锁——block add / theme set 会写 .vima/assets.lock.json。');
  } else {
    lines.push(r.check
      ? `资产已经不是 lock 记的那一版（${r.changed} 项内容变了）：`
      : `升级了 ${r.applied.length} 项资产的锁定摘要：`);
  }
  for (const e of r.impacted) {
    lines.push('', `  ${e.kind} ${e.id}   ${shortDigest(e.locked)} → ${shortDigest(e.actual)}`);
    if (e.claims.length === 0) {
      lines.push('    还没有命题会读到它——本次升级不波及任何证据。');
      continue;
    }
    lines.push(`    会读到它的命题 ${e.claims.length} 条（取过证的那些要重新看）：`);
    for (const c of e.claims) {
      lines.push(`      ${c.id}  [${c.layer}]  ${c.met ? `已达标（${c.strength}）` : '未达标'}`);
    }
  }
  // 「哪条要重新取证」是人的判断，不是本命令的结论——说清楚，别让人以为已经处理了
  if (r.drifted) {
    lines.push('', r.check
      ? '这只是 --check：锁没动。确认要采用新版内容就跑 `vima block upgrade`。'
      : '证据没有被自动作废。哪条要重新取证由人确认，然后跑 vima submit <claimId>。');
  }
  return lines.join('\n');
}

function renderBlockList(r) {
  const lines = [];
  lines.push(r.installed.length ? `已安装（${r.installed.length}）` : '还没装任何块。vima block add <set>/<name>');
  for (const id of r.installed) lines.push(`  ${id}`);
  lines.push('', `资产仓可用（${r.available.length}）`);
  for (const b of r.available) {
    lines.push(`  ${b.installed ? '✓' : ' '} ${b.id}  层 ${b.layers.join(' ') || '(无)'}`);
  }
  return lines.join('\n');
}

function renderAudit(r) {
  const s = r.summary;
  const lines = [];
  if (!r.findings.length) lines.push('对账通过：没有发现。');
  else {
    lines.push(`对账发现 ${r.findings.length} 条（error ${r.errors} · warn ${r.warns}）`);
    for (const f of r.findings) {
      lines.push(`  [${f.severity}] ${f.kind}  ${f.subject}  ${f.message}`);
    }
  }
  if (s) {
    lines.push('', `  覆盖 ${s.coverage.covered}/${s.coverage.total}   达标 ${s.conformance.met}/${s.conformance.total}   失效 ${s.stale.length}`);
    // rules:null = 这次没查（规则模块缺席），不是「查了 0 条」。同 closure 的口径。
    lines.push(s.rules
      ? `  规则 ${s.rules.total} 条，其中死规则 ${s.rules.dead.length} 条`
      : '  规则层未检查（规则模块缺席）——不是没死规则，是没看');
    // assets:null 同 rules:null 的口径——「这次没查」要说出来，不许静默当成没问题
    if (s.assets !== undefined) {
      lines.push(s.assets
        ? `  资产 主题 ${s.assets.theme ? `${s.assets.theme.name}${s.assets.theme.ok ? '' : '（读不出）'}` : '-'}   块 ${s.assets.blocks.length} 个（坏 ${s.assets.blocks.filter((b) => !b.ok).length} 个）`
        : '  资产层未检查（registry 缺席）——不是没问题，是没看');
    }
    lines.push(`  扫描 ${s.scan.files} 个文件 / ${s.scan.marks} 处标注（${s.scan.dirs.join(', ') || '无代码目录'}）`);
    lines.push(`  提取能力 ${s.extract.engine}/${s.extract.granularity}，看不见：${s.extract.blind.join('、')}`);
  }
  return lines.join('\n');
}

const DOCTOR_MARK = Object.freeze({ ok: '✓', warn: '!', error: '✗' });

/**
 * 体检报告。**每项都印「查了什么」**——这是本命令与「显示一排绿勾」的全部区别：
 * 看得见判据，才知道一个 ✓ 到底覆盖了多大范围；warn 里那句「没查」才有分量。
 */
function renderDoctor(r) {
  const c = r.counts;
  const lines = [
    `工具体检 ${r.checks.length} 项：通过 ${c.ok} · 警告 ${c.warn} · 失败 ${c.error}`,
    '（audit 管「项目符不符合规格」，doctor 管「工具装对没有」——两回事）',
    '',
  ];
  for (const x of r.checks) {
    lines.push(`  ${DOCTOR_MARK[x.status]} ${x.title}  ${x.message}`);
    lines.push(`      查了：${x.checked}`);
    if (x.fix) lines.push(`      → ${x.fix}`);
  }
  lines.push('', c.error ? '有项目失败：修完重跑 vima doctor。' : '没有失败项。警告项是「没查/查不了」，别当成通过。');
  return lines.join('\n');
}

// ── MCP 可发现性 ──────────────────────────────────────────────────────────
//
// 为什么必须装在 user scope：项目级配置只在「会话恰好开在项目根」时存在。
// 而会话开错目录正是最常发生、也最难自察的故障——那一刻项目级资产全部不存在，
// 连报错都无从报起。装在 user scope 的 MCP 与 cwd 无关，它在任何目录都能起来，
// 于是「你开错目录了」这句话本身有人说得出口。

function mcpInstallData(TOOLS = []) {
  const cmd = `claude mcp add --scope user vima -- node ${A.BIN_PATH} mcp`;
  return {
    command: cmd,
    scope: 'user',
    why: 'user scope 与 cwd 无关：会话开错目录时项目级资产全部不存在，而 MCP 仍在，'
      + '于是 vima 还能告诉你「你开错目录了」。装 project scope 的话，最需要它的那一刻它恰好不在。',
    // 那 `vima init` 写的 `.mcp.json`（project scope）算什么？—— **两个都要，不冲突**。
    // 官方 scope 优先级 local > project > user，同名按名字去重，两份内容一样，所以：
    //   project scope  clone 下来就有，全队零配置          —— 覆盖「新人 / CI / 换机器」
    //   user scope     与 cwd 无关，开错目录时仍在         —— 覆盖「会话开错目录」
    // 少了 project 就得每人手装一遍；少了 user 就在最需要诊断的那一刻失声。
    alsoProject: '.mcp.json（由 vima init / vima sync 写，进版本控制）',
    manual: {
      file: '~/.claude.json（user scope）',
      entry: mcpConfig({ binPath: A.BIN_PATH }),
    },
    tools: TOOLS.map((t) => t.name),
  };
}

function mcpInstallText(TOOLS = []) {
  const d = mcpInstallData(TOOLS);
  return [
    '把 vima 装成 MCP 服务（user scope）：',
    '',
    `  ${d.command}`,
    '',
    '为什么一定要 --scope user：',
    `  ${d.why}`,
    '',
    '手工装（等价）：在 ~/.claude.json 的 mcpServers 里加',
    JSON.stringify(d.manual.entry.mcpServers, null, 2).split('\n').map((l) => `  ${l}`).join('\n'),
    '',
    `项目级还另有一份 ${d.alsoProject}——两个都要：`,
    '  project scope 让全队 clone 下来零配置；user scope 让开错目录时 vima 还能说话。',
    '',
    `装好后 agent 能用的工具：${d.tools.join(' · ')}`,
    '（刻意只有五个：工具定义占每次请求的上下文，且 CLI 全量映射会制造第二个真源）',
  ].join('\n');
}

// ── help ──────────────────────────────────────────────────────────────────

const USAGE_LINES = [
  ['init', '在当前目录立起 .vima/ 与 .claude/'],
  ['compile', '从 docs/ 编译命题（不带参数就是编整棵 docs/）'],
  ['sync', '重建 Claude Code 派生投影（.claude/rules/ 与 .mcp.json）'],
  ['next', '我该干什么：下一条命题 + 适用规则 + 上下文'],
  ['claim <id>', '声明我开始做这条了（只记过程，不改状态）'],
  ['submit <id>', '交活：系统自己取证，不收自述'],
  ['rule', '记一条裁定（规格没说清时先定夺，不阻塞）'],
  ['ask <id>', '查任意命题的状态与证据'],
  ['app add|list|remove', '登记端：config.apps 的受管写入口（变更即刷新规则投影）'],
  ['theme set|show', '换/看主题皮——set 先验资产仓里真的有这套皮'],
  ['block add|list|remove|upgrade', '装业务块——装上后 vima next 按层下发块内容；upgrade 看资产变了波及谁'],
  ['status', '三档进度 + 成本 + 失效清单（恒 exit 0）'],
  ['audit', '跑对账：覆盖 / 达标 / 闭合'],
  ['doctor', '工具体检：hook 会不会真触发 · MCP 可不可达 · 投影漂没漂 · 版本兼不兼容'],
  ['ui', '起 Web 观测平台'],
  ['mcp', '在 stdio 上跑 MCP 服务（给 agent 用，一般由客户端拉起）'],
  ['mcp-install', '怎么把 vima 装成 MCP，以及为什么要装 user scope'],
  ['help / version', ''],
];

const DETAIL = {
  init: 'vima init [--name=<名字>] [--theme=<主题>] [--force]\n  可重跑：已存在的文件原样保留。--force 用模板覆盖同名文件。',
  sync: 'vima sync [--check]\n'
    + '  把 .vima/rules/ + assets/rules/ 投影成 .claude/rules/（带 paths glob），并写 .mcp.json。\n'
    + '  这两个是**派生产物**，性质同 .vima/index/：真源在别处，手改会被下次 sync 冲掉。\n'
    + '  为什么规则要投影一份：vima next 的下发只在 agent 主动来问时发生，而它不一定会问。\n'
    + '  --check 不写盘，只回答有没有漂；漂了 exit 5，给 CI 用。\n'
    + '  --check 同时查**资产锁**：.vima/assets.lock.json 记的摘要与资产仓当下算出来的\n'
    + '  对不上，也是漂（同样 exit 5）。这条最值钱——安装包升级了、块内容改了，而项目\n'
    + '  还以为用的是老版本，偏偏那些内容已经被用来取过证了。资产漂了修法不同：\n'
    + '  不是重跑 sync，是 vima block upgrade。',
  compile: 'vima compile [--plan] [--docs=<目录>]     （不带参数 = 编整棵 docs/）\n'
    + '       vima compile [批次.json]                （旁路：批次 JSON，不给文件就从 stdin 读）\n'
    + '  **整棵 docs 编译是一次事务**：先算计划、全部校验、再一次提交。\n'
    + '    有任何条目被拒 → 整次零写入（exit 5），不留一半新状态。\n'
    + '    与现状一致的命题不产生事件——原样重跑 written=0，事件流不增长。\n'
    + '    docs 里消失的命题自动退休，依赖它们的进失效清单（上游没了 ≠ 上游满足了）。\n'
    + '  --plan 只算不写，先看「这次会改什么」再决定要不要承受它。\n'
    + '  只有它能造命题——markdown 是真源，agent 不能自己出题，所以 MCP 上没有这个工具。',
  next: 'vima next [--json] [--include-leased]\n'
    + '  选择判据：未达标的按层序（intent→spec→contract→impl→behavior）排，**执行依赖**已达标的优先。\n'
    + '  两种边不同处置：derivesFrom（来自哪条陈述）只用于追溯，不阻塞；dependsOn（必须先有的\n'
    + '  contract/impl）才阻塞。否则「上线后才能验的 intent」会把整个项目锁死在第一步。\n'
    + '  失效的命题会重新进候选——「改完了」的判据是失效清单清空。\n'
    + '  被未过期租约占着的默认不派（并行时不会两个人拿到同一条）；--include-leased 看它们。',
  claim: 'vima claim <claimId>\n'
    + '  落一条 run 事件（谁、什么时候、开始做哪条）**并取租约**：同一条命题同时只有一个执行者。\n'
    + '  拿不到租约是 exit 5，会告诉你被谁占着、什么时候过期。执行者崩溃时租约过期即自动可回收。\n'
    + '  同一持有者重新认领 = 续租。跳过它不会被拦，但过程与成本就没人记得住，并行也不再有保护。',
  submit: 'vima submit <claimId> [--how=derived|executed|claimed|<JSON>]\n'
    + '  **只收 claimId 与取证方式，不收结论。** 系统调 ops/attest 自己取证、自己写证据事件。\n'
    + '  --how 默认 derived（扫代码里的 @vima 标注）。要跑命令：\n'
    + '    --how=\'{"mode":"executed","cmd":["npm","test"]}\'   —— 只收 argv 数组，字符串过 shell 就不可重放\n'
    + '  达标 exit 0，未达标 exit 5——「命令跑通了」和「结论是达标」是两件事。\n'
    + '  MCP 上的 submit 只收 claimId：让 agent 自己指定要跑哪条命令，等于让它用 `true` 换一条 executed 证据。',
  rule: 'vima rule --question=<拿不准的是什么> --chosen=<你定了哪个> --confidence=<low|medium|high> --blast=<影响面>\n'
    + '       [--options=a|b|c] [--rationale=<为什么>] [--subject=<claimId>] [--overrides=<旧裁定id>]\n'
    + '  confidence 与 blast 必填：没有优先级的裁定台账会走向和「永远消不掉的告警」同一个结局。\n'
    + '  --blast 优先给命题 id 列表（s-1,s-2），说不出具体就给条数（3）——观测平台按它排序。\n'
    + '  --overrides 是**二次裁决**：旧裁定转为已复核，关联命题随之修订并走同一条失效传播链路。\n'
    + '    关联靠结构化 id，不靠 rationale 文本。改判一条已被改判过的会拒——那会形成两条现行结论。',
  ask: 'vima ask <claimId> [--json]\n  命题不存盘，它是事件流的投影——这里看到的永远是当下重算的结果。',
  app: 'vima app add --id=<id> --kind=<kind>\nvima app list [--json]\nvima app remove --id=<id>\n'
    + '  kind 的合法取值 = ia 词表 sides 组（assets/style/ia.vocab.json），真的现读、不抄清单。\n'
    + '  每次变更走原子写并落一条 run 事件（payload.op=config，带 what/before/after）——\n'
    + '  「谁什么时候登记了端」要能从事件流回放出来。add/remove 后自动重投影 .claude/rules/。\n'
    + '  重复 add 同 id 是用法错误（exit 1）；remove 不存在的端 exit 4。',
  theme: 'vima theme set <name>\nvima theme show [--json]\n'
    + '  set 先 loadStyle 验证这套皮真的存在——皮不存在 exit 4 并列出现有的，\n'
    + '  不再有「--theme=不存在的皮 静默成功」这条路。变更同样落 config 事件。',
  block: 'vima block add <set>/<name>\nvima block list [--json]\nvima block remove <set>/<name>\n'
    + 'vima block upgrade [--check] [--json]\n'
    + '  add 先 readBlock 验证块存在且读得出层（exit 4 并列出现有的），再走一遍依赖 DAG：\n'
    + '  依赖的块不在资产仓 exit 4、还没装 exit 1、成环 exit 5——缺依赖就不装，\n'
    + '  半截块装进来，缺的那部分要到取证时才显形。装上之后 vima next 会按命题的层\n'
    + '  下发对应内容：contract 给 L1，impl 给 L2/L3。\n'
    + '\n'
    + '  add / theme set 同时写 .vima/assets.lock.json（进版本控制）：project.json 记\n'
    + '  「想用什么」，lock 记「实际用的那一版长什么样」（内容摘要）。同一份 lock 在\n'
    + '  不同机器上必须解析到字节一致的资产——这就是可复现性的定义。\n'
    + '  upgrade --check 列出摘要对不上的资产、以及会读到它们的命题（exit 5）；\n'
    + '  不带 --check 才把锁更新到当下这一版。**证据不会自动失效**——哪条要重新\n'
    + '  取证由人确认后跑 vima submit，不由这条命令替人决定。',
  status: 'vima status [--json]\n  **恒 exit 0。** 它要可视化的正是「会话开在错目录」这种故障；非零码会让宿主只显示空白。',
  audit: 'vima audit [--json]\n  有 error 级发现时 exit 5。',
  doctor: 'vima doctor [--json]\n'
    + '  **它不是第二个 audit。** audit 回答「项目符不符合规格、证据够不够」；\n'
    + '  doctor 回答「工具装对没有」：hook 会不会真触发、MCP 可不可达、投影有没有漂、\n'
    + '  版本兼不兼容、子代理与 skill 的 frontmatter 认不认得出。\n'
    + '  每项都问「它**生效**了吗」，不是「它**在**吗」——v3 用 4 个 hook / 6 个子代理 /\n'
    + '  4 个 skill 一个都没注册而体检报「通过」证明过这两者不是一回事。\n'
    + '  hook 那项会**真起一次进程**（喂最小 stdin，跑在一次性沙箱项目里，不写你的事件流）。\n'
    + '  三档 ok / warn / error：**warn 多数是「没查」，不是通过**。有 error 时 exit 5。',
  // 刻意只有 --port。**没有 --host**：host 由 web 自己钉死在回环，
  // 按需起的观测面不是对外服务，给个覆盖口子就等于给了「不小心暴露出去」的路。
  ui: 'vima ui [--port=<端口>]\n  只绑回环（127.0.0.1），不提供 --host 覆盖。Ctrl-C 结束，不常驻。',
  mcp: 'vima mcp\n  stdio 上的 JSON-RPC 2.0。工具只有五个：next · claim · submit · rule · ask。',
  'mcp-install': 'vima mcp-install [--json]',
};

function helpText(topic) {
  if (topic && DETAIL[topic]) return `${DETAIL[topic]}\n\n${exitText()}`;
  const w = Math.max(...USAGE_LINES.map(([c]) => c.length));
  return [
    'vima —— 定形 · 供料 · 验形',
    '',
    '  用法  vima <命令> [参数]',
    '',
    ...USAGE_LINES.map(([c, d]) => `  ${c.padEnd(w)}  ${d}`),
    '',
    '  通用参数  --json 机器可读输出   --cwd=<目录> 换个目录执行   -h 单条命令详解',
    '',
    '  结果走 stdout，诊断走 stderr。',
    '',
    exitText(),
  ].join('\n');
}

function exitText() {
  return [
    '退出码',
    `  ${EXIT.OK}   成功`,
    `  ${EXIT.USAGE}   用法错误：命令或参数不对`,
    `  ${EXIT.NO_PROJECT}   不在 vima 项目里（向上找不到 .vima/）——多半是会话开错目录；status 例外，它恒 0`,
    `  ${EXIT.NOT_IMPLEMENTED}   依赖的模块尚未实现（ops/ · assets/ · web）`,
    `  ${EXIT.NOT_FOUND}   命题或目标不存在`,
    `  ${EXIT.UNMET}   跑通了，但结论是不达标（submit 没到门槛 / audit 有 error）`,
    `  ${EXIT.INTERNAL}  内部错误`,
  ].join('\n');
}
