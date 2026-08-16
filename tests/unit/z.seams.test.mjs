// 接缝测试 —— 用真实的 A 去读真实的 B。
//
// ─────────────────────────────────────────────────────────────────────────
// 为什么单独立这个文件
//
// 本轮重写时并行开工，五个模块各自单元测试全绿（157/157），而 templates 写的
// 规则示例用 `id` + `blocks`、assets 的加载器只认 `layer/side/app/block`——
// **拼起来当场抛异常，但没有一条测试红。**
//
// 原因很简单：每个模块都在测自己的假设。templates 的测试锁住「允许键集合」，
// 锁的是它自己那份；assets 的测试拿自己造的夹具喂自己的加载器。两边都对，
// 合起来不通。这正是整套设计要治的那一类——四个最高影响面缺陷没有一条是
// 「代码写错了」，全是接缝。
//
// 所以：**凡是「A 产出的东西要被 B 吃掉」的地方，这里必须有一条测试，
// 且必须用真文件真函数，不许造夹具。** 造夹具就是把假设又复制了一份。
// ─────────────────────────────────────────────────────────────────────────
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadRules, selectRules } from '../../lib/assets/rules.mjs';
import { loadStyle, listBlocks } from '../../lib/assets/registry.mjs';
import { LAYERS } from '../../lib/core/claims.mjs';
import { STRENGTH, TRUST, KINDS } from '../../lib/core/events.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASSETS = path.join(REPO, 'assets');
const TPL = path.join(REPO, 'templates', 'project');

test('接缝：templates 的规则示例能被 assets 的真加载器读进去', async () => {
  // 这条就是本轮实际漏掉的那个接缝。用真模板目录喂真加载器。
  const rules = await loadRules(ASSETS, TPL);
  const project = rules.filter((r) => r.origin !== 'builtin');
  assert.ok(project.length >= 1, '模板里的示例规则应当被加载出来，而不是抛异常');
});

test('接缝：内置规则全部能被真加载器读进去', async () => {
  const rules = await loadRules(ASSETS, TPL);
  assert.ok(rules.length >= 5, `内置规则应被加载，实际 ${rules.length}`);
  for (const r of rules) {
    assert.ok(typeof r.id === 'string' && r.id !== '', '每条规则必须有 id');
    assert.ok(r.applies && typeof r.applies === 'object', `${r.id} 缺 applies`);
    assert.ok(typeof r.text === 'string' && r.text.trim() !== '', `${r.id} 正文为空`);
  }
});

test('接缝：规则的适用维度只能取 core 与词表里真实存在的值', async () => {
  // 一条限定 layer:'phase-2' 的规则永远不会命中——它是活着的死规则，
  // 而 deadRules 只能发现「没被命中」，发现不了「值本来就不存在」。
  const rules = await loadRules(ASSETS, TPL);
  const style = await loadStyle(ASSETS, 'enterprise-blue');

  // 这里曾经写成 `groups.sides.items` —— 而词表里的键是 **terms**。
  // 于是 sides 恒为空集，下面那段 side 校验被 `if (sides.size > 0)` 整段跳过，
  // **一次都没跑过**。同期模板示例规则写着 `side: frontend`（不在封闭词表里），
  // 这条测试从头到尾报绿。防「值本来就不存在」的检查，自己成了只会报绿的检查。
  //
  // 两处教训写进代码：① 键名从真词表取，取不到就炸，不留 `?? []` 的软着陆；
  // ② 不写 `if (集合非空) 才校验` —— 那个 if 就是让检查静默失效的开关。
  const sides = new Set((style.ia?.groups?.sides?.terms ?? []).map((t) => t.id ?? t.name ?? t).filter(Boolean));
  assert.ok(sides.size > 0,
    'ia 词表里读不出 sides 取值——词表结构变了，而这条校验会因此静默失效。'
    + `实际读到：${JSON.stringify(style.ia?.groups?.sides ? Object.keys(style.ia.groups.sides) : null)}`);

  for (const r of rules) {
    for (const layer of [].concat(r.applies.layer ?? [])) {
      assert.ok(LAYERS.includes(layer), `${r.id} 的 layer '${layer}' 不在 core/claims.LAYERS 里`);
    }
    for (const side of [].concat(r.applies.side ?? [])) {
      assert.ok(sides.has(side),
        `${r.id} 的 side '${side}' 不在 ia 词表的 sides 组里（合法：${[...sides].join('/')}）`
        + '——这条规则永远不可能被 selectRules 命中，是活着的死规则');
    }
  }
});

test('接缝：selectRules 用真规则 + 真维度选得出东西', async () => {
  const rules = await loadRules(ASSETS, TPL);
  // side 取值必须是词表里真有的（'frontend' 不是——上一条测试现在会拦住它）
  const picked = selectRules(rules, { layer: 'impl', side: 'admin', app: 'admin' });
  assert.ok(Array.isArray(picked), 'selectRules 应返回数组');
  // 不断言具体条数——那会把规则内容焊死。只断言这条链路真的通。
  for (const r of picked) assert.ok(r.id, '选出的规则应当是完整对象');
});

test('接缝：资产仓的业务块能被真读取，且视觉层默认不提供', async () => {
  const blocks = await listBlocks(ASSETS);
  assert.ok(blocks.length >= 1, '至少应有一个示例块');
  const withMeta = blocks.filter((b) => b.meta);
  assert.ok(withMeta.length >= 1, '至少一个块有完整 block.json');
  for (const b of withMeta) {
    assert.ok(!('L4' in (b.layers ?? {})) || b.layers.L4 == null,
      `${b.set}/${b.name} 带了 L4 视觉层——默认不提供是一条决定（会与 UI 设计代理冲突）`);
  }
});

test('接缝：模板自带的 docs/ 能被真解析器编译，且不把自己的格式说明当成命题', async () => {
  // 模板里的 intent.md 同时是「示例」和「格式说明书」，说明书里必然有围栏示例。
  // 解析器若不跳围栏，`vima init` 出来的项目第一次 compile 就会凭空多出几条
  // 名叫 spec-login-remember 的命题——而没有任何一条测试会觉得不对。
  const { readSpecs } = await import('../../lib/ops/spec.mjs');
  const { batches, skipped } = await readSpecs(path.join(TPL, 'docs'));
  assert.ok(batches.length >= 1, `模板 docs/ 应至少有一份可编译的规格，实际 ${batches.length}（跳过 ${skipped.join('、')}）`);
  const ids = batches.flatMap((b) => b.batch.items.map((i) => i.id));
  for (const bogus of ['spec-login-remember', 'spec-login-captcha', 'spec-device-status']) {
    assert.ok(!ids.includes(bogus), `格式说明里的示例 ${bogus} 被当成真命题编进去了——围栏没跳过`);
  }
});

test('接缝：模板 docs/ 的每条命题都满足 compile 的准入（不靠真跑才发现）', async () => {
  // 模板发出去就是别人项目的起点。它自己过不了 compile，等于所有新项目
  // 第一步就踩坑——而 R1 的原话是「起点大概率什么都没有」。
  const { readSpecs } = await import('../../lib/ops/spec.mjs');
  const { compile } = await import('../../lib/ops/compile.mjs');
  const { batches } = await readSpecs(path.join(TPL, 'docs'));
  const known = new Map();
  for (const { rel, batch } of batches) {
    const out = await compile({ actor: 'test', claims: known }, batch);
    assert.deepEqual(out.rejected, [], `模板 ${rel} 里有条目过不了 compile`);
    for (const c of out.claims) known.set(c.id, c);
  }
  assert.ok(known.size >= 1, '模板应当至少编出一条命题');
});

test('接缝：投影出的 .claude/rules/ 必须是 Claude Code 认的形状', async () => {
  // 投影写错了不会有任何报错——Claude Code 只是默默不加载，或者更糟：
  // paths 写错导致一条端限定规则处处生效。所以形状必须在这里钉死。
  const { mkdtemp, rm, mkdir, writeFile, readFile, readdir } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { syncRules } = await import('../../lib/front/claude.mjs');
  const { frontmatter } = await import('../../lib/core/fsx.mjs');

  const root = await mkdtemp(path.join(tmpdir(), 'vima4-seam-cc-'));
  try {
    await mkdir(path.join(root, '.vima', 'rules'), { recursive: true });
    await writeFile(path.join(root, '.vima', 'rules', 'scoped.md'), '---\nside: admin\n---\n\n约束正文。\n');
    await syncRules(root, {
      assetsRoot: path.join(REPO, 'assets'),
      config: { apps: [{ id: 'console', kind: 'admin' }] },
    });

    const dir = path.join(root, '.claude', 'rules');
    for (const f of await readdir(dir)) {
      const text = await readFile(path.join(dir, f), 'utf8');
      assert.ok(f.startsWith('vima-') && f.endsWith('.md'), `投影文件名要有 vima- 前缀：${f}`);
      const { data, body, unparsed } = frontmatter(text);
      // 只查键名是不够的——这一课是自己上的：块列表 `paths:` 的**值**被解析器
      // 丢掉时，键仍然在，键名断言照样绿。必须连值一起验，还要确认没有读不懂的行。
      assert.deepEqual(unparsed, [], `${f} 的前置头有读不懂的行：${JSON.stringify(unparsed)}`);
      // paths 是唯一允许的键。多写一个 Claude Code 不认的键不会报错，只会被忽略——
      // 而我们会以为它生效了。
      for (const k of Object.keys(data)) {
        assert.equal(k, 'paths', `${f} 的前置头出现了 paths 之外的键 ${k}`);
        assert.ok(Array.isArray(data.paths) && data.paths.length > 0,
          `${f} 写了 paths 却读不出内容——空 paths 等于「没限定」，端限定规则会变成处处生效`);
        for (const p of data.paths) assert.match(p, /^apps\/[^/]+\/\*\*\/\*$/, `${f} 的 glob 形状不对：${p}`);
      }
      assert.ok(body.trim() !== '', `${f} 正文为空`);
      assert.match(body, /请勿手改/, `${f} 没写「勿手改」——派生投影被人手改是迟早的事`);
    }

    const scoped = await readFile(path.join(dir, 'vima-scoped.md'), 'utf8');
    assert.match(scoped, /paths:\n {2}- "apps\/console\/\*\*\/\*"/, `端限定规则的 glob 不对：\n${scoped}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('接缝：.mcp.json 与 mcp-install 打印的是同一份配置', async () => {
  // 两处各写一份 MCP 配置 = 两个真源。上一轮的四个最高影响面缺陷没有一个是
  // 「代码写错了」，全是这种。
  const { mcpConfig } = await import('../../lib/front/claude.mjs');
  const cli = await readFile(path.join(REPO, 'lib', 'front', 'cli.mjs'), 'utf8');
  assert.match(cli, /mcpConfig\(\{\s*binPath/, 'mcp-install 必须调 claude.mcpConfig，不许自己拼一份');
  const cfg = mcpConfig({ binPath: '/x/vima.mjs' });
  assert.deepEqual(Object.keys(cfg), ['mcpServers']);
  assert.deepEqual(cfg.mcpServers.vima, { command: 'node', args: ['/x/vima.mjs', 'mcp'] });
});

test('接缝：CLAUDE.md 模板里的元规则确实下沉不了', async () => {
  // 下沉纪律的守卫：能做成词表/机检的不该留在 CLAUDE.md。
  // 这条不判语义，只卡数量——写超过 5 条就是没认真做下沉判断。
  const text = await readFile(path.join(TPL, '.claude', 'CLAUDE.md'), 'utf8');
  const numbered = text.match(/^\d+\.\s+\*\*/gm) ?? [];
  assert.ok(numbered.length <= 5,
    `CLAUDE.md 有 ${numbered.length} 条元规则。超过 5 条说明有约束该下沉成资产或机检却没下沉`);
  assert.ok(numbered.length >= 1, 'CLAUDE.md 不该是空的——总有真的下沉不了的');
});

test('接缝：hook 里的种类名与 core 的封闭集合一致', async () => {
  // hook 直接构造事件喂给 append。它写死的 kind 字符串若与 KINDS 漂移，
  // append 会抛「未知事件种类」——而那只在真的跑 hook 时才发现。
  // 扫目录，**不写死文件名清单**——写死的清单就是第二个真源：新加一个 hook
  // 忘了加进清单，它写错的 kind 就永远测不到，而 append 只在真跑时才抛。
  const { readdir } = await import('node:fs/promises');
  const dir = path.join(TPL, '.claude', 'hooks');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.mjs'));
  assert.ok(files.length >= 4, `hook 目录里只有 ${files.length} 个文件，是不是路径错了`);
  for (const f of files) {
    const text = await readFile(path.join(dir, f), 'utf8');
    for (const m of text.matchAll(/kind:\s*'([a-z]+)'/g)) {
      assert.ok(KINDS.includes(m[1]), `${f} 里的 kind '${m[1]}' 不在 core 的封闭集合 ${KINDS.join('/')} 里`);
    }
  }
});

test('接缝：settings.json 接的每个 hook 文件都真实存在，且每个 hook 文件都被接上了', async () => {
  // 两个方向都要查。只查一边的话：接了不存在的文件 → Claude Code 静默跳过；
  // 写了没接的文件 → 永远不触发。两种都表现为「这个 hook 怎么没反应」，
  // 而且都不会有任何报错。
  const { readdir } = await import('node:fs/promises');
  const dir = path.join(TPL, '.claude', 'hooks');
  const settings = JSON.parse(await readFile(path.join(TPL, '.claude', 'settings.json'), 'utf8'));

  const wired = new Set();
  for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
    assert.ok(Array.isArray(groups), `${event} 的值应当是数组`);
    for (const g of groups) {
      for (const h of g.hooks ?? []) {
        const m = /hooks\/([a-z0-9-]+\.mjs)/.exec(h.command ?? '');
        assert.ok(m, `${event} 的 command 里找不到 hook 文件名：${h.command}`);
        wired.add(m[1]);
      }
    }
  }

  const onDisk = new Set((await readdir(dir)).filter((f) => f.endsWith('.mjs') && f !== '_lib.mjs'));
  for (const f of wired) assert.ok(onDisk.has(f), `settings.json 接了 ${f}，但文件不存在`);
  for (const f of onDisk) assert.ok(wired.has(f), `${f} 写了却没接进 settings.json，永远不会触发`);

  assert.ok(!('PreToolUse' in (settings.hooks ?? {})),
    'PreToolUse 刻意不发：立场是「绕过不被禁止——绕过只是没有收益」。要改先改 ARCHITECTURE.md');
});

test('接缝：全仓每个相对 import 都解析得到（node --check 查不出这一类）', async () => {
  // CI 的语法扫描跑 `node --check`，它**不解析 import**——一个引用了已删除模块的
  // 文件照样全绿。v3 的 scripts/gen-from-manifest.mjs 就是这么活到 v4 的：
  // 它 import 的 lib/util/fs.mjs 早就随重写删掉了，语法扫描一次都没报过。
  //
  // 只查相对路径。裸模块名（node: 内建）不查——本仓零依赖，没有第三方可失效。
  const { readdir, readFile, access } = await import('node:fs/promises');
  const DIRS = ['bin', 'lib', 'tests', 'scripts', 'templates'];

  async function walk(dir, out = []) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p, out);
      else if (e.name.endsWith('.mjs')) out.push(p);
    }
    return out;
  }

  const files = (await Promise.all(DIRS.map((d) => walk(path.join(REPO, d))))).flat();
  assert.ok(files.length >= 30, `只扫到 ${files.length} 个 .mjs，目录清单是不是错了`);

  const broken = [];
  for (const f of files) {
    const text = await readFile(f, 'utf8');
    const specs = [
      ...text.matchAll(/^\s*import\s+(?:[^'"]*?from\s+)?['"](\.[^'"]+)['"]/gm),
      ...text.matchAll(/import\(\s*['"](\.[^'"]+)['"]\s*\)/g),
    ].map((m) => m[1]);
    for (const s of specs) {
      const target = path.resolve(path.dirname(f), s);
      await access(target).catch(() => {
        broken.push(`${path.relative(REPO, f)} → ${s}`);
      });
    }
  }
  assert.deepEqual(broken, [], `这些 import 指向不存在的模块：\n${broken.join('\n')}`);
});

test('接缝：README 里的命令与真 CLI 双向对齐', async () => {
  // 产品对使用者撒谎，和 agent 自称完成是同一种病——只是发生在门面上。
  // v4 重写把 lib/ 整个换掉，README 却还在写 `vima create` / `vima plan`
  // 这些已经不存在的命令，整整一轮没人发现。所以这条锁上。
  //
  // 两个方向都查：写了不存在的命令 → 使用者照做会撞墙；
  // 存在却没写进 README → 做了没人知道。后者同样是缺陷，只是不痛。
  const { main } = await import('../../lib/front/cli.mjs');
  const SINK = { write: () => true };
  const knows = async (sub) => (await main([sub, '--help'], {
    out: SINK, err: SINK, env: {}, cwd: REPO, stdin: { isTTY: true },
  })) === 0;

  const readme = await readFile(path.join(REPO, 'README.md'), 'utf8');
  // 命令一览表里的第一列：`| \`vima xxx ...\` |`
  const documented = new Set(
    [...readme.matchAll(/^\|\s*`vima ([a-z-]+)[^`]*`\s*\|/gm)].map((m) => m[1]),
  );
  assert.ok(documented.size >= 8, `README 命令表只解析出 ${documented.size} 条，表格格式变了？`);

  for (const sub of documented) {
    assert.ok(await knows(sub), `README 写了 \`vima ${sub}\`，但真 CLI 不认这个命令`);
  }

  // 反向：CLI 认的命令都该在 README 里。全集取 **SPECS**，不去解析 help 排版。
  //
  // 这里曾用正则从 help 文本里捞命令名（`^ {2}([a-z-]+)(?: <[^>]+>)?\s{2,}\S`）。
  // 新增的子命令行长这样：`  app add|list|remove    登记端：…`——`add|list|remove`
  // 既不是 `<…>` 也不是空白，整行匹配不上。于是 app/theme/block **对这条检查
  // 完全隐形**：三个命令没写进 README，而本该抓「存在却没写」的检查一声不吭。
  // 与 `items`/`terms` 那次同形：防呆的检查自己有盲区，且盲区里正好躺着缺陷。
  //
  // 教训：命令全集的真源是 SPECS（parseArgs 认的就是它），不是 help 的缩进。
  // 从渲染文本反推结构，就是在给自己造一个会漂的第二真源。
  const { SPECS } = await import('../../lib/front/cli.mjs');
  const skip = new Set(['help', 'version']); // 门面文档不必列出这两个
  const listed = Object.keys(SPECS).filter((s) => !skip.has(s));
  assert.ok(listed.length >= 8, `SPECS 只有 ${listed.length} 条命令？`);
  for (const sub of listed) {
    assert.ok(documented.has(sub), `\`vima ${sub}\` 存在但 README 没写——做了没人知道`);
  }
});

test('接缝：help 详解里宣传的每个旗标都在 SPECS 里定义过', async () => {
  // 「README 命令双向对齐」那条只比**命令名**，不比旗标——于是
  // `vima help ui` 宣传了 `--host` 与 `--open`，而 SPECS.ui 只有 port、
  // parseArgs 是 strict，照做当场 exit 1。产品对使用者撒谎，只是换了粒度。
  //
  // 判法：help 文本 vs SPECS 定义，**不真跑带旗标的命令**——
  // 第一版用「探针实跑」判定，结果 `vima ui --port=x` 真把服务起起来了，
  // 测试挂死 180 秒。对带副作用的命令，静态比对才是对的工具。
  const { main, SPECS } = await import('../../lib/front/cli.mjs');
  assert.ok(SPECS && typeof SPECS === 'object', 'cli.mjs 需要导出 SPECS 供本测试比对');
  const SINK = { write: () => true };

  let helpText = '';
  await main(['help'], { out: { write: (s) => { helpText += s; return true; } }, err: SINK, env: {}, cwd: REPO, stdin: { isTTY: true } });
  const subs = [...helpText.matchAll(/^ {2}([a-z-]+)(?: <[^>]+>)?\s{2,}\S/gm)].map((m) => m[1])
    .filter((s) => !['help', 'version'].includes(s));
  assert.ok(subs.length >= 8, `只解析出 ${subs.length} 个命令`);

  const bad = [];
  for (const sub of subs) {
    let detail = '';
    await main([sub, '--help'], { out: { write: (s) => { detail += s; return true; } }, err: SINK, env: {}, cwd: REPO, stdin: { isTTY: true } });
    const known = new Set(Object.keys(SPECS[sub] ?? {}));
    // 只查「vima <本命令> …」用法行里的旗标——详解正文会举别的命令当例子
    // （如 submit 的详解里教「先跑 vima rule」），那些旗标属于被举例的命令。
    const usageLines = detail.split('\n').filter((l) => l.includes(`vima ${sub}`));
    for (const line of usageLines) {
      for (const m of line.matchAll(/--([a-z][a-z-]*)/g)) {
        if (!known.has(m[1])) bad.push(`vima ${sub} 的 help 用法行写了 --${m[1]}，但 SPECS.${sub} 没定义它`);
      }
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('接缝：RELEASING 的命令示例里不许出现具体版本号', async () => {
  // `release.yml` 的 "Sync version from tag" 以 **tag 为版本真源**——照抄一条
  // `git tag v2.0.1` 就会真的把 2.0.1 发出去，没有任何东西会拦。
  // 而发布文档里的版本示例天然会过期：这份文档一度停在 v2.0.1，而包已经是 4.0.0-alpha.1。
  //
  // 解法不是「每次发版记得改文档」（那必然会忘），是**根本不写具体版本号**：
  // 用 vX.Y.Z 占位，照抄会当场失败，而不是静默发错版本。
  //
  // 只查围栏内的命令。正文里提历史版本（「v3.0.6 首发即栽在这里」）是合法的。
  const text = await readFile(path.join(REPO, 'RELEASING.md'), 'utf8');
  const fences = [...text.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.ok(fences.length >= 2, `RELEASING 只解析出 ${fences.length} 个代码块，格式变了？`);
  const offenders = [];
  for (const block of fences) {
    for (const m of block.matchAll(/\bv\d+\.\d+\.\d+[\w.-]*/g)) offenders.push(m[0]);
  }
  assert.deepEqual(offenders, [],
    `RELEASING 的命令示例里出现了具体版本号 ${offenders.join('、')}——改成 vX.Y.Z 占位。`
    + '照抄带真版本号的 git tag 会真的发那个版本出去。');
});

test('接缝：README 与 CLAUDE.md 指向的文件都真实存在', async () => {
  // 死链不会报错，只会让读的人以为自己找错了地方。
  const { access } = await import('node:fs/promises');
  for (const doc of ['README.md', 'CLAUDE.md']) {
    const text = await readFile(path.join(REPO, doc), 'utf8');
    // 只查仓库内的相对链接，跳过 http(s) 与锚点
    const links = [...text.matchAll(/\]\((?!https?:|#)([^)]+)\)/g)].map((m) => m[1].split('#')[0]);
    for (const rel of links) {
      if (rel === '') continue;
      await access(path.join(REPO, rel)).catch(() => {
        assert.fail(`${doc} 指向了不存在的 ${rel}`);
      });
    }
  }
});

test('接缝：代码里引用的每个 R#/C# 都在需求基线里存在', async () => {
  // 硬约束是「每处实现必须能反查到 R# 或 C#，反查不到的不写」。
  // 但重写后一度**没有任何地方列出 R1–R11**——通篇引用，无处可查。
  // 那条约束于是成了无法证伪的口号：谁都能写「反查 R5」，谁都核不了。
  //
  // 现在基线写在 ARCHITECTURE.md 的「需求基线」一节，这条测试把引用与基线焊死：
  // 写了个不存在的 R12 会当场红，而不是变成一句没人查的话。
  const arch = await readFile(path.join(REPO, 'ARCHITECTURE.md'), 'utf8');
  // 标题允许带后缀（现为「需求基线（索引）」），但那一节必须在
  const section = /## 需求基线[^\n]*\n([\s\S]*?)\n---/.exec(arch);
  assert.ok(section, 'ARCHITECTURE.md 里找不到「需求基线」一节——反查没有落点');

  // 基线表格里的 `**R5**` / `**C1**` 就是全部合法编号
  const defined = new Set([...section[1].matchAll(/\*\*([RC]\d+)\*\*/g)].map((m) => m[1]));
  assert.ok(defined.size >= 10, `基线只解析出 ${defined.size} 条，表格格式变了？`);
  assert.ok(defined.has('R1') && defined.has('C1'), '基线应当至少含 R1 与 C1');

  const { readdir } = await import('node:fs/promises');
  async function walk(dir, out = []) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p, out);
      else if (/\.(mjs|md|json)$/.test(e.name)) out.push(p);
    }
    return out;
  }
  const files = [
    ...(await walk(path.join(REPO, 'lib'))),
    ...(await walk(path.join(REPO, 'templates'))),
    ...(await walk(path.join(REPO, 'assets'))),
    path.join(REPO, 'ARCHITECTURE.md'),
    path.join(REPO, 'README.md'),
    path.join(REPO, 'CLAUDE.md'),
  ];

  const unknown = new Map();
  for (const f of files) {
    const text = await readFile(f, 'utf8');
    // 只认「反查 R5」「（C1：…）」「| R2 |」这类**引用姿态**，
    // 不去扫裸 R5——普通文字里的 R5/C4 可能是别的东西（如颜色、坐标）。
    for (const m of text.matchAll(/(?:反查|见|依据|——)\s*((?:[RC]\d+(?:\s*[·、,/]\s*)?)+)|\((([RC]\d+)[：:])/g)) {
      const blob = m[1] ?? m[3] ?? '';
      for (const id of blob.match(/[RC]\d+/g) ?? []) {
        if (!defined.has(id)) {
          const rel = path.relative(REPO, f);
          unknown.set(`${id} @ ${rel}`, true);
        }
      }
    }
  }
  assert.deepEqual([...unknown.keys()], [],
    `这些编号在 ARCHITECTURE.md 的需求基线里不存在：\n${[...unknown.keys()].join('\n')}`);
});

test('接缝：需求基线的每条 R#/C# 都带非空判据，且正本在仓库里', async () => {
  // 基线原文的立身之本是「每条附**判据**——怎么算满足，而不只是想要什么」。
  // 而 ARCHITECTURE 的基线表是人从正本抄过来的摘要，抄的时候**判据整列被丢掉过**：
  // 表里只剩「要点」。后果不是文档不好看——是 R5 的并发可观测、R7 的骨架不豁免自己、
  // R11 的拿错端机检三条判据当时全是零实现，**而没有任何人发现**。
  // 判据不在册，就没有人会发现它没做。所以这条把「判据必须在册」焊死。
  const arch = await readFile(path.join(REPO, 'ARCHITECTURE.md'), 'utf8');

  // 正本必须在仓库里（C3：真源可读可 diff 可 review）。只有摘要在册时，
  // 最上游那份依据反而是仓库外的一个链接，谁也 review 不了它改没改。
  const baselineRel = 'docs/requirements-baseline.md';
  const baseline = await readFile(path.join(REPO, baselineRel), 'utf8').catch(() => null);
  assert.ok(baseline, `需求基线正本 ${baselineRel} 不在仓库里——摘要不能当真源`);
  assert.ok(arch.includes(baselineRel), `ARCHITECTURE.md 必须指向正本 ${baselineRel}`);

  const section = /## 需求基线[^\n]*\n([\s\S]*?)\n---/.exec(arch);
  assert.ok(section, 'ARCHITECTURE.md 里找不到「需求基线」一节');

  // 表格行形如：| **R5** | 并行加速 | <判据> | <落地> |
  // 判据 = 第三格。空、或只有占位符（—/待补/TODO），一律判红。
  const rows = [...section[1].matchAll(/^\|\s*\*\*([RC]\d+)\*\*\s*\|([^\n]*)$/gm)];
  assert.ok(rows.length >= 12, `基线表只解析出 ${rows.length} 行，表格结构变了？`);

  const missing = [];
  for (const [, id, rest] of rows) {
    const cells = rest.split('|').map((c) => c.trim());
    const criterion = cells[1] ?? '';                       // cells[0] 是需求名，cells[1] 是判据
    if (criterion === '' || /^[—\-–]*$/.test(criterion) || /TODO|待补|待定/i.test(criterion)) {
      missing.push(id);
    }
  }
  assert.deepEqual(missing, [],
    `这些条目没有判据（「怎么算满足」缺席）：${missing.join('、')}\n`
    + `判据在 ${baselineRel} 里逐条写着，抄过来时不许只抄「要点」那一列——`
    + '上一次丢掉判据的三条，实现也一并没人做。');

  // 落地状态列也必须在：一条判据成立却没做，必须**看得见地欠着**，
  // 不许悄悄从表里消失（同 ARCHITECTURE「已知未接线」那一节的纪律）。
  const noStatus = rows.filter(([, , rest]) => (rest.split('|')[2] ?? '').trim() === '')
    .map(([, id]) => id);
  assert.deepEqual(noStatus, [], `这些条目没写落地状态：${noStatus.join('、')}——欠着可以，不许不写`);
});

test('接缝：apps/<id>/ 落点在 codeDirs 与 rulePaths 两处同口径', async () => {
  // ARCHITECTURE 明写「这三处必须同口径，否则规则会看起来限定了端、实际处处生效」，
  // 但此前没有任何测试盯着。不比实现字符串，比**行为**：同一份 config，
  // 取证扫哪个目录、规则投影到哪个 glob，前缀必须是同一个。
  const { codeDirs } = await import('../../lib/ops/attest.mjs');
  const { rulePaths } = await import('../../lib/front/claude.mjs');
  const apps = [{ id: 'console', kind: 'admin' }];
  const dir = codeDirs({ config: { apps } })[0];                       // 'apps/console'
  const glob = rulePaths({ app: ['console'], side: null, layer: null, block: null }, apps)[0]; // 'apps/console/**/*'
  assert.ok(glob.startsWith(`${dir}/`),
    `两处落点口径漂了：codeDirs 扫 ${dir}，rulePaths 投影 ${glob}——`
    + '端限定规则会作用不到取证扫描的那批文件上');
});

test('接缝：分层边界——core 不 import 上层，ops 与 assets 互不 import', async () => {
  // ARCHITECTURE 写着「依赖方向单向向下」，此前没有任何机检——
  // 漂了不会有任何提示，只会在某天表现为循环依赖或平台语义渗进内核。
  const { readdir } = await import('node:fs/promises');
  const rules = [
    { dir: 'lib/core', forbid: [/\.\.\/(ops|assets|front)\//], why: 'core 是最底层' },
    { dir: 'lib/ops', forbid: [/\.\.\/(assets|front)\//], why: 'ops 与 assets 是兄弟层，要对方的结果由 front 注入 ctx' },
    { dir: 'lib/assets', forbid: [/\.\.\/(ops|front)\//], why: '同上，反方向' },
  ];
  const bad = [];
  for (const { dir, forbid, why } of rules) {
    for (const f of await readdir(path.join(REPO, dir))) {
      if (!f.endsWith('.mjs')) continue;
      const text = await readFile(path.join(REPO, dir, f), 'utf8');
      for (const m of text.matchAll(/from\s+'([^']+)'/g)) {
        if (forbid.some((re) => re.test(m[1]))) bad.push(`${dir}/${f} import 了 ${m[1]}（${why}）`);
      }
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('接缝：两个强度轴的取值在全仓一致', async () => {
  // S 轴与 E 轴的字面量散落在 ops / front / templates 里。
  // 拼错一个字母不会有任何提示，只会让那条证据永远算不进强度。
  const suspicious = [];
  for (const rel of [
    'lib/ops/attest.mjs', 'lib/ops/compile.mjs', 'lib/ops/audit.mjs',
    'lib/front/actions.mjs', 'lib/front/web.mjs',
  ]) {
    let text;
    try { text = await readFile(path.join(REPO, rel), 'utf8'); } catch { continue; }
    for (const m of text.matchAll(/strength:\s*'([a-z]+)'/g)) {
      if (!STRENGTH.includes(m[1])) suspicious.push(`${rel} strength '${m[1]}'`);
    }
    for (const m of text.matchAll(/trust:\s*'([a-z]+)'/g)) {
      if (!TRUST.includes(m[1])) suspicious.push(`${rel} trust '${m[1]}'`);
    }
  }
  assert.deepEqual(suspicious, [], `发现不在封闭集合里的强度字面量：\n${suspicious.join('\n')}`);
});

// ── 超承诺措辞 ──────────────────────────────────────────────────────────────
//
// 威胁模型（ARCHITECTURE 决定性纪律 0）承诺 T0 + T1，**明确不承诺 T2**。
// 于是有一批词是这套系统永远兑现不了的：拥有 Write/Bash 的 agent 物理上改得了
// events.jsonl。说得出口却兑现不了的承诺不只是「不准确」——它会把同一段里
// 那些**真成立**的话（「绕过没有收益」）一起贬值，而后者才是整个设计指望人
// 自觉遵守的部分。
//
// 为什么要机检：codex 评估 P0-8 之后，全仓措辞是靠人眼一处处改的。结果
// mcp.mjs 的文件头注释改了，**运行时真发给 agent 的 instructions 漏了**，
// 整整一轮没人发现。凡是靠「记得全仓一起改」维持的一致性，都迟早漏一处。
const OVERPROMISE = ['不能写事件', '无法篡改', 'tamper', '不可伪造', '防篡改'];

// 怎么区分「宣称拥有」和「明确否认」——这是这条检查唯一有技术含量的地方。
//
// 威胁模型表本身、README 的边界说明、CHANGELOG 的改口径记录，都必须**引用**
// 这些词才说得清「我们不承诺它」。所以不能见词就红，否则第一个被删掉的就是
// 那张把边界钉死的表。
//
// 判据：**默认判违规**，只有当这些词所在的**同一句**里出现一个否认词时才放行。
// 举证责任压在「想写这个词」的人身上，而不是压在检查上——想蒙混过关，得在同一句
// 里凑一个否认词，那不是手滑能做到的。
// 逐句判（不是逐行、不是全文）是刻意的：全文判会让文件里任何一处否认句
// 给整个文件开绿灯；逐行判则会把「不得出现 tamper-proof / 不可伪造」这种
// 一句话否认两个词的写法误伤成违规。
//
// 已知的软肋，写下来免得后人以为它比实际更聪明：「vima 是防篡改的，不是玩具」
// 这种句子会被放行。接受——它换来的是判据只有一行、任何人扫一眼就知道自己
// 为什么红了。真要更严就得做语义判定，而那正是硬约束禁止交给概率性行为的东西。
const DENIAL = ['不承诺', '不是', '不说', '不得出现', '不算', '不宣称', '而非', '≠', '改为', '已废'];

// 显式豁免。**不是白名单，是账**：每条都必须仍然对得上，对不上就说明那处已经
// 改好了，这条豁免要跟着删——否则豁免会像 TODO 一样越攒越多，最后没人知道
// 哪条还成立。所以下面第二条断言查的是「豁免有没有过期」。
//
// 这两处是文件头注释（不是运行时文案），归属另一条会话的改动面，本轮没动。
// 落账在 ARCHITECTURE「已知未接线」第 4 条。
// 空了——两处旧措辞已改（2026-08-16）。豁免表清零是它该有的终点：
// 加豁免时就配了「过期检查」，所以它是**只出不进的临时账**，不是白名单。
// 白名单的问题从来不是它存在，是它只进不出、最后没人记得为什么在里面。
const EXEMPT = [];

test('接缝：全仓不出现超出威胁模型承诺的措辞（否认句除外）', async () => {
  // 变异验证（2026-08-16 手工做过一轮，结论写在这里，免得后人怀疑它只会报绿）：
  // 把 mcp.mjs 的 instructions 那一行改回旧口径，本条当场红，报
  // `lib/front/mcp.mjs:210 命中「不能写事件」 → + '你不能写事件，…'`；改回新口径即绿。
  // 顺带验了否认句不误伤：ARCHITECTURE 威胁模型表那三行、README 的边界段、
  // CHANGELOG 的改口径记录，在同一轮里全部放行。
  // 第二条断言（豁免过期）也同法验过：往 EXEMPT 塞一条对不上的记录，当场红。
  // 两条都验，是因为「只会报绿的检查」这个坑本文件上面已经踩过一次（sides/terms 那条）。
  const { readdir } = await import('node:fs/promises');

  async function walk(dir, out = []) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p, out);
      else if (/\.(mjs|md|json)$/.test(e.name)) out.push(p);
    }
    return out;
  }

  // 扫的是「会被人或 agent 读到的话」：实现与它的注释、门面文档、模板发出去的资产。
  // tests/ 刻意不扫——这个文件自己就得把那些词写出来才说得清要禁什么。
  const files = [
    ...(await walk(path.join(REPO, 'lib'))),
    ...(await walk(path.join(REPO, 'templates'))),
    path.join(REPO, 'README.md'),
    path.join(REPO, 'ARCHITECTURE.md'),
    path.join(REPO, 'CHANGELOG.md'),
  ];
  assert.ok(files.length >= 30, `只扫到 ${files.length} 个文件，目录清单是不是错了`);

  const hits = [];
  for (const f of files) {
    const text = await readFile(f, 'utf8');
    const rel = path.relative(REPO, f).split(path.sep).join('/');
    // 逐句切。换行也算句界：markdown 的一段会被硬换行拆成多行，
    // 而否认词与被否认的词几乎总在同一行里成对出现。
    let start = 0;
    for (let i = 0; i <= text.length; i += 1) {
      if (i < text.length && !'\n。；;！!？?'.includes(text[i])) continue;
      const sentence = text.slice(start, i);
      start = i + 1;
      if (sentence.trim() === '') continue;
      const lower = sentence.toLowerCase();
      const found = OVERPROMISE.filter((t) => lower.includes(t));
      if (found.length === 0) continue;
      if (DENIAL.some((d) => sentence.includes(d))) continue;
      const line = text.slice(0, i).split('\n').length;
      for (const term of found) hits.push({ rel, line, term, sentence: sentence.trim() });
    }
  }

  const exempted = (h) => EXEMPT.some((e) => e.file === h.rel && e.term === h.term);
  const bad = hits.filter((h) => !exempted(h)).map(
    (h) => `${h.rel}:${h.line} 命中「${h.term}」 → ${h.sentence.slice(0, 100)}`,
  );
  assert.deepEqual(bad, [],
    '这些措辞超出了威胁模型的承诺（ARCHITECTURE 决定性纪律 0：承诺 T0+T1，不承诺 T2）：\n'
    + `${bad.join('\n')}\n`
    + '改成能兑现的说法（「不通过正式接口提交证据结论」「官方接口不采信自述」），'
    + '或者把它写成一句明确否认——同一句里带上否认词即可放行。');

  // 豁免过期检查。少了这条，EXEMPT 就是个只进不出的白名单：
  // 那两处改好之后没人会想起来删豁免，下一次真的漂回去就再也测不出来了。
  const stale = EXEMPT.filter((e) => !hits.some((h) => h.rel === e.file && h.term === e.term))
    .map((e) => `${e.file} 已经不含「${e.term}」`);
  assert.deepEqual(stale, [],
    `这些豁免过期了——对应文件已经改好，把它们从 EXEMPT 里删掉（同时删掉 ARCHITECTURE「已知未接线」第 4 条）：\n${stale.join('\n')}`);
});
