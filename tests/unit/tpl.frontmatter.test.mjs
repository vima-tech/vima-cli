// `.claude/agents/` 与 `.claude/skills/` 的 frontmatter，以及 skill 正文里的动态注入。
//
// ## 为什么这些检查长这样
//
// 这两类文件的真正消费方是 Claude Code，它不在本仓里，所以「拿真加载器验」在这里
// 只能做到两件事，而这两件都必须做：
//
//   ① **用本仓唯一的真解析器读**（`lib/core/fsx.mjs` 的 frontmatter）。它是极简的：
//      只认 `key: value` 与行内数组，**读不懂的行直接跳过**。跳过是静默的，
//      所以光「能读」不构成检查——必须同时断言**一行都没被跳过**。
//      于是块状 YAML 列表（`- x` 分行写）、折叠标量（`>` / `|`）这类
//      「Claude Code 认、本仓解析器不认」的写法会当场失败，模板被钉在两边的交集里。
//      这正是上一次翻车的形状：两边各自绿着，拼起来抛异常。
//
//   ② **用真 CLI 判命令存不存在**。skill 的 `allowed-tools` 与正文注入里写的
//      `vima <子命令>`，一律拿 `lib/front/cli.mjs` 的 main 跑一次 `--help`：
//      它认就是认，不认就 USAGE。这里**不列一份命令清单**——列了就是第二个真源，
//      而 SPECS 改了它不会跟着改。
//
// 同理，这里也不列一份「agent 允许哪些 frontmatter 键」的清单：那份清单的真源在
// Claude Code 手里，抄过来只会抄出一份会过期的。能查的是形状、必填、拼写一致性，
// 以及**引用得到不到**（`skills:` 指的 skill 真的存在吗）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { frontmatter } from '../../lib/core/fsx.mjs';
import { main } from '../../lib/front/cli.mjs';
import { EXIT } from '../../lib/front/actions.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TPL = path.join(REPO, 'templates', 'project');
const AGENTS_DIR = path.join(TPL, '.claude', 'agents');
const SKILLS_DIR = path.join(TPL, '.claude', 'skills');
const BIN = path.join(REPO, 'bin', 'vima.mjs');

const AGENTS = (await readdir(AGENTS_DIR)).filter((f) => f.endsWith('.md')).sort();
const SKILLS = (await readdir(SKILLS_DIR, { withFileTypes: true }))
  .filter((e) => e.isDirectory()).map((e) => e.name).sort();

/** frontmatter 里真正承载信息的行（空行与 YAML 注释不算）。 */
function payloadLines(text, who) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  assert.ok(m, `${who} 没有 frontmatter`);
  return m[1].split('\n').filter((l) => l.trim() !== '' && !l.trim().startsWith('#'));
}

/**
 * 解析 + 断言一行都没被静默跳过。跳过 = 两边解析器对不上，就是上次翻车的形状。
 *
 * 判据是解析器自报的 `unparsed`，不是「键数 == 行数」。
 * 后者原先是没有真信号时的启发式：它对块列表会误报（两行一个键，其实读懂了），
 * 而且报出来的建议「改成行内数组」是错的。现在 fsx.frontmatter 会如实说出
 * 哪一行没读懂——有了真信号就不该再留着近似的那个。
 */
function parseStrict(text, who) {
  const { data, body, unparsed } = frontmatter(text);
  payloadLines(text, who); // 顺带确认 frontmatter 存在
  assert.deepEqual(unparsed, [],
    `${who} 的 frontmatter 有读不懂的行：${unparsed.map((u) => `第 ${u.line} 行 ${JSON.stringify(u.text)}`).join('；')}`
    + '——只支持 `键: 值`、行内数组、缩进的 `- 列表项`。');
  assert.ok(Object.keys(data).length > 0, `${who} 的 frontmatter 一个键都没解析出来`);
  return { data, body };
}

const NULL_SINK = { write: () => true };

/** 真 CLI 认不认这个子命令。判据是它自己，不是这里抄的一份清单。 */
async function cliKnows(sub) {
  const code = await main([sub, '--help'], {
    out: NULL_SINK, err: NULL_SINK, env: {}, cwd: REPO, stdin: { isTTY: true },
  });
  return code === EXIT.OK;
}

/** 把一段 shell 拆成「每一节的命令头」：vima 的取到子命令，其它取首词。 */
function commandHeads(snippet) {
  return snippet.split(/\|\||&&|[;|]/).map((seg) => seg.trim()).filter(Boolean)
    .map((seg) => {
      const tokens = seg.split(/\s+/).filter((t) => !t.startsWith('2>') && !t.startsWith('>'));
      return tokens[0] === 'vima' && tokens[1] ? `vima ${tokens[1]}` : tokens[0];
    });
}

/** skill 正文里的动态注入：行首或空白后的 !`…`。 */
function injections(body) {
  return [...body.matchAll(/(?:^|\s)!`([^`]+)`/gm)].map((m) => m[1]);
}

// ── 子代理 ────────────────────────────────────────────────────────────────

test('两个子代理都在（建造者 / 取证者），与 ARCHITECTURE 的「项目内」小节一致', async () => {
  await stat(path.join(AGENTS_DIR, 'vima-builder.md'));
  await stat(path.join(AGENTS_DIR, 'vima-verifier.md'));
});

for (const file of AGENTS) {
  test(`agent ${file}：frontmatter 整份读得下来，name 与文件名一致，skills 引用得到`, async () => {
    const text = await readFile(path.join(AGENTS_DIR, file), 'utf8');
    const { data, body } = parseStrict(text, file);
    const base = file.slice(0, -'.md'.length);

    assert.equal(data.name, base, 'name 必须等于文件名——两处不一致时被调用的是哪个说不清');
    assert.equal(typeof data.description, 'string');
    // description 决定自动委派。一句话概括的子代理永远不会在对的时候被派出去。
    assert.ok(data.description.length >= 60,
      `${file} 的 description 只有 ${data.description.length} 字，写清楚什么时候该派它`);
    assert.ok(body.trim().length >= 300, `${file} 的系统提示太短（${body.trim().length} 字符）`);

    for (const s of data.skills ?? []) {
      await stat(path.join(SKILLS_DIR, s, 'SKILL.md')); // 引用了不存在的 skill 就 ENOENT
    }
  });
}

test('vima-builder 靠 worktree 隔离并行（R5），不靠「大家别碰同一个文件」的约定', async () => {
  const text = await readFile(path.join(AGENTS_DIR, 'vima-builder.md'), 'utf8');
  const { data, body } = parseStrict(text, 'vima-builder.md');
  assert.equal(data.isolation, 'worktree',
    '删了 isolation 这个 agent 就没有存在理由——旧版就是靠约定，约定不成立时才发现');
  assert.ok((data.skills ?? []).length > 0,
    '要预加载规程，别指望它自己想起来去 invoke（C1：不能指望它自觉去查）');
  // 决定性纪律 1：自称不入账，收工必须让系统取证
  assert.match(body, /vima submit/);
  assert.match(body, /vima claim/);
});

test('vima-verifier 是物理只读（C1）：没有 Write / Edit，就不可能边改边宣布验过了', async () => {
  const text = await readFile(path.join(AGENTS_DIR, 'vima-verifier.md'), 'utf8');
  const { data } = parseStrict(text, 'vima-verifier.md');
  const denied = String(data.disallowedTools ?? '').split(',').map((s) => s.trim());
  for (const tool of ['Write', 'Edit']) {
    assert.ok(denied.includes(tool),
      `disallowedTools 里缺 ${tool}——少一个写文件的工具，取证者就退化成又一个会自称的执行者`);
  }
});

test('子代理不许配 memory —— 那会给「经验复用」造出第二个真源', async () => {
  for (const file of AGENTS) {
    const text = await readFile(path.join(AGENTS_DIR, file), 'utf8');
    const { data } = parseStrict(text, file);
    assert.equal(data.memory, undefined,
      `${file} 配了 memory。auto memory 是机器本地的、不跨机器、不进版本控制；`
      + 'R11 要的是沉进资产仓、可 review 可分发的那一种（走 vima-harvest 提名）。');
  }
});

// ── skill frontmatter ─────────────────────────────────────────────────────

for (const name of SKILLS) {
  test(`skill ${name}：frontmatter 整份读得下来，没有被静默跳过的行`, async () => {
    const text = await readFile(path.join(SKILLS_DIR, name, 'SKILL.md'), 'utf8');
    const { data } = parseStrict(text, name);
    // description + when_to_use 合计有上限，超了会被截断，而截断是静默的
    const budget = String(data.description ?? '').length + String(data.when_to_use ?? '').length;
    assert.ok(budget <= 1536, `${name} 的 description + when_to_use 合计 ${budget} 字，超过 1536 会被截断`);
  });

  test(`skill ${name} 的 allowed-tools 只授权真 CLI 认得的 vima 命令`, async () => {
    const text = await readFile(path.join(SKILLS_DIR, name, 'SKILL.md'), 'utf8');
    const { data } = parseStrict(text, name);
    const allowed = data['allowed-tools'] ?? [];
    assert.ok(Array.isArray(allowed) && allowed.length > 0,
      `${name} 没有 allowed-tools：元规则 1「确定性的事走 vima」就只剩自觉`);
    for (const entry of allowed) {
      const m = /^Bash\(vima ([a-z][a-z-]*)/.exec(entry);
      if (!m) continue; // 非 vima 的授权项（如 echo）不归这条管
      assert.ok(await cliKnows(m[1]),
        `${name} 授权了 vima ${m[1]}，但 lib/front/cli.mjs 的 SPECS 里没有这个命令`);
    }
  });
}

// ── 动态注入 ──────────────────────────────────────────────────────────────

for (const name of SKILLS) {
  test(`skill ${name} 的动态注入：命令真实、被 allowed-tools 覆盖、vima 缺席时也不炸`, async () => {
    const text = await readFile(path.join(SKILLS_DIR, name, 'SKILL.md'), 'utf8');
    const { data, body } = parseStrict(text, name);
    const allowed = data['allowed-tools'] ?? [];
    const shots = injections(body);
    assert.ok(shots.length > 0,
      `${name} 一处动态注入都没有：规程展开时不带真实状态，就多一个「它可能不去查」的环节`);

    for (const snippet of shots) {
      for (const head of commandHeads(snippet)) {
        const sub = /^vima ([a-z][a-z-]*)$/.exec(head);
        if (sub) {
          assert.ok(await cliKnows(sub[1]), `${name} 注入了不存在的命令 vima ${sub[1]}`);
        }
        assert.ok(allowed.some((a) => a.startsWith(`Bash(${head}`)),
          `${name} 注入里用了 ${head}，但 allowed-tools 没覆盖它——展开时会弹权限询问`);
      }
      // 没装 vima / 不在 PATH：注入必须退化成一句「拿不到」，不能吐一堆错误文本
      const r = spawnSync('/bin/sh', ['-c', snippet], {
        env: { PATH: path.join(tmpdir(), 'vima-absent-on-purpose') },
        encoding: 'utf8',
      });
      assert.equal(r.status, 0, `${name} 的注入在 vima 缺席时退出码 ${r.status}`);
      assert.match(r.stdout, /拿不到/,
        `${name} 的注入在 vima 缺席时没说「拿不到」——空白与错误文本都会被当成真实状态读`);
      assert.equal(r.stderr, '', `${name} 的注入把错误文本漏进了输出：${r.stderr}`);
    }
  });
}

test('注入的前提：vima status 在非 vima 项目里仍然 exit 0', () => {
  const r = spawnSync(process.execPath, [BIN, 'status'], {
    cwd: tmpdir(), encoding: 'utf8', env: { PATH: process.env.PATH ?? '' },
  });
  assert.equal(r.status, 0,
    'status 一旦非零，注入的 `|| echo` 兜底会在「只是不在项目里」时误报成「拿不到」');
});
