// vima doctor —— 工具体检的行为断言。
//
// 纪律：**真临时项目 + 真起 hook 进程**，不造夹具模拟。
// 理由与 doctor 本身要解决的问题同源——夹具能证明的只有「我的假设自洽」，
// 而 v3 那次「4 个 hook 一个都没注册、体检报通过」恰恰是假设与现实脱节。
// 所以这里每个项目都是真 `vima init` 出来的，每次断言都让 doctor 真去起进程。
//
// ── 变异验证（2026-08-16 真做过三轮，逐条记结果，免得后人怀疑它只会报绿）──
//   ① lib/front/doctor.mjs 的 isAnchored 改成 `return true || …`（永远认为锚定了）：
//      18 项里红 2 项——「锚定判据」与「故意弄坏①」。改回即 18 全绿。
//   ② checkHooksRunnable 的失败判据 `r.code !== 0` 改成 `r.code === null`
//      （只认 spawn 失败、不认非零退出）：红「故意弄坏⑤」，1 项。改回即绿。
//   ③ checkMcp 里 `if (!(await exists(bin))) { … }` 整段删掉（让它一路走到真起进程）：
//      红「故意弄坏②」，1 项——真起会报 exit 1，而断言要的是 message 里含 bin 路径
//      与「不存在」，所以红得住。改回即绿。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as A from '../../lib/front/actions.mjs';
import { isAnchored, parseHookCommand, flattenHooks, expandProjectDir } from '../../lib/front/doctor.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * 真起一个项目。
 *
 * `node_modules/@vima-tech/cli` 软链到本仓，是为了让 hook 的 findVimaHome 走
 * 「就近 node_modules」那条分支找到内核——真实项目就是这个样子。
 * **不设 VIMA_HOME**：那会替 hook 指路，把「找不到内核」这个故障模式盖掉，
 * 而它正是 doctor 该发现的东西之一。
 */
async function makeProject() {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-doctor-t-'));
  await A.init({ cwd: root, name: '体检样板' });
  await mkdir(path.join(root, 'node_modules', '@vima-tech'), { recursive: true });
  await symlink(REPO, path.join(root, 'node_modules', '@vima-tech', 'cli'), 'dir');
  return root;
}

async function doctorOn(root) {
  const ctx = await A.makeCtx({ cwd: root, env: {} });
  return A.doctor(ctx);
}

const pick = (r, id) => {
  const c = r.checks.find((x) => x.id === id);
  assert.ok(c, `体检里没有 ${id} 这一项`);
  return c;
};

async function readSettings(root) {
  return JSON.parse(await readFile(path.join(root, '.claude', 'settings.json'), 'utf8'));
}
async function writeSettings(root, s) {
  await writeFile(path.join(root, '.claude', 'settings.json'), `${JSON.stringify(s, null, 2)}\n`);
}

// ── 纯函数（判据本身）──────────────────────────────────────────────────────

test('锚定判据：$CLAUDE_PROJECT_DIR 或绝对路径才算，相对路径不算', () => {
  assert.equal(isAnchored('$CLAUDE_PROJECT_DIR/.claude/hooks/x.mjs'), true);
  assert.equal(isAnchored('${CLAUDE_PROJECT_DIR}/.claude/hooks/x.mjs'), true);
  assert.equal(isAnchored('${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/x.mjs'), true);
  assert.equal(isAnchored('/opt/proj/.claude/hooks/x.mjs'), true);
  // v3 就死在这一行上：按 cwd 解析，agent 一 cd 就找不到，且失败没有任何输出
  assert.equal(isAnchored('.claude/hooks/x.mjs'), false);
  assert.equal(isAnchored('./hooks/x.mjs'), false);
});

test('命令解析：只认 `node <脚本>`，别的形态返回 null 而不是猜', () => {
  assert.deepEqual(parseHookCommand('node "$CLAUDE_PROJECT_DIR/a.mjs"'), { runner: 'node', script: '$CLAUDE_PROJECT_DIR/a.mjs' });
  assert.deepEqual(parseHookCommand('node a.mjs'), { runner: 'node', script: 'a.mjs' });
  // 猜错了去跑一条陌生命令比不查更坏——所以这些一律 null，由调用方报「没法机检」
  assert.equal(parseHookCommand('bash -c "node a.mjs"'), null);
  assert.equal(parseHookCommand('python x.py'), null);
  assert.equal(parseHookCommand('node a.mjs && rm -rf /'), null);
  assert.equal(parseHookCommand(''), null);
  assert.equal(parseHookCommand(undefined), null);
});

test('展开：${CLAUDE_PROJECT_DIR:-.} 的默认值写法也要认', () => {
  assert.equal(expandProjectDir('${CLAUDE_PROJECT_DIR:-.}/x', '/r'), '/r/x');
  assert.equal(expandProjectDir('$CLAUDE_PROJECT_DIR/x', '/r'), '/r/x');
});

test('摊平：结构坏掉的 settings 不抛，只是摊不出东西', () => {
  assert.deepEqual(flattenHooks(null), []);
  assert.deepEqual(flattenHooks({ hooks: { X: 'not-an-array' } }), []);
  assert.equal(flattenHooks({ hooks: { X: [{ hooks: [{ command: 'node a.mjs' }] }] } }).length, 1);
});

// ── 健康项目 ──────────────────────────────────────────────────────────────

test('刚 init 出来的项目：九项全绿，且每项都说得出「查了什么」', async () => {
  const root = await makeProject();
  try {
    const r = await doctorOn(root);
    const bad = r.checks.filter((c) => c.status !== 'ok')
      .map((c) => `${c.id}[${c.status}] ${c.message}`);
    assert.deepEqual(bad, [], `模板发出去的项目自己体检不过：\n${bad.join('\n')}`);
    assert.equal(r.ok, true);
    assert.equal(r.counts.error, 0);

    // 「查了什么」是这个命令的灵魂：一个 ✓ 不说清覆盖范围，与「一排绿勾」无异
    for (const c of r.checks) {
      assert.ok(c.checked && c.checked.length > 10, `${c.id} 没说清查了什么：${c.checked}`);
      assert.ok(c.message, `${c.id} 没有结论文本`);
      assert.equal(c.fix, null, `${c.id} 通过了却还给修复建议——ok 项不该有下一步`);
    }
    // 九项的 id 是对外契约（--json 的消费者按 id 取），钉住
    assert.deepEqual(r.checks.map((c) => c.id).sort(), [
      'agents', 'hooks-anchored', 'hooks-runnable', 'hooks-wired',
      'install', 'mcp', 'node', 'projection', 'skills',
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('体检不写项目的事件流——沙箱跑 hook，真项目一个字节都不动', async () => {
  // subagent-start / post-tool-use 这些 hook 真跑起来是**会写事件**的。
  // 体检必须无副作用：一个「看一眼」的命令往账本里写东西，比不体检更坏。
  const root = await makeProject();
  try {
    const log = path.join(root, '.vima', 'events.jsonl');
    const before = (await stat(log)).size;
    await doctorOn(root);
    assert.equal((await stat(log)).size, before, 'doctor 往真项目的 events.jsonl 里写了东西');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ── 故意弄坏 ──────────────────────────────────────────────────────────────

test('故意弄坏①：hook 命令换成相对路径 → 必须报出来（v3 的原病）', async () => {
  const root = await makeProject();
  try {
    const s = await readSettings(root);
    s.hooks.SessionStart[0].hooks[0].command = 'node .claude/hooks/session-start.mjs';
    await writeSettings(root, s);

    const r = await doctorOn(root);
    const anchored = pick(r, 'hooks-anchored');
    assert.equal(anchored.status, 'error', `相对路径没被报出来：${anchored.message}`);
    assert.match(anchored.message, /SessionStart/);
    assert.match(anchored.fix, /CLAUDE_PROJECT_DIR/, '修复建议要能照着做，不是「请检查配置」');

    // 一个故障只许报一处红：脚本本身没坏，「跑得起来」那项要照常绿。
    // 两项同时红会让人以为有两个毛病，然后修错地方。
    assert.equal(pick(r, 'hooks-runnable').status, 'ok', 'cwd 依赖被算成了「脚本跑不起来」');
    assert.equal(r.ok, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('故意弄坏②：.mcp.json 的 bin 指到不存在的路径 → 必须报出来', async () => {
  const root = await makeProject();
  try {
    const file = path.join(root, '.mcp.json');
    const conf = JSON.parse(await readFile(file, 'utf8'));
    conf.mcpServers.vima.args[0] = '/definitely/not/here/vima.mjs';
    await writeFile(file, `${JSON.stringify(conf, null, 2)}\n`);

    const r = await doctorOn(root);
    const mcp = pick(r, 'mcp');
    assert.equal(mcp.status, 'error', `bin 不存在没被报出来：${mcp.message}`);
    assert.match(mcp.message, /\/definitely\/not\/here\/vima\.mjs/);
    assert.match(mcp.message, /不存在/);
    assert.match(mcp.fix, /vima sync/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('故意弄坏③：hook 文件删掉但 settings 还接着 → 「接了不存在的」', async () => {
  const root = await makeProject();
  try {
    await unlink(path.join(root, '.claude', 'hooks', 'subagent-stop.mjs'));
    const r = await doctorOn(root);
    const wired = pick(r, 'hooks-wired');
    assert.equal(wired.status, 'error');
    assert.match(wired.message, /subagent-stop\.mjs/);
    assert.match(wired.message, /静默跳过/, 'Claude Code 对这种情况一声不吭，说明里要写清楚');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('故意弄坏④：hook 文件在但没接进 settings → 「写了永远不会触发」', async () => {
  // 这个方向正是 v3 栽过的那个：文件全在，一个都没注册，而体检报「通过」。
  const root = await makeProject();
  try {
    await writeFile(path.join(root, '.claude', 'hooks', 'orphan.mjs'), '// 没人接我\n');
    const r = await doctorOn(root);
    const wired = pick(r, 'hooks-wired');
    assert.equal(wired.status, 'error', '「文件在但没注册」被当成通过了——这正是 v3 的原病');
    assert.match(wired.message, /orphan\.mjs/);
    assert.match(wired.message, /永远不会触发/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('故意弄坏⑤：hook 文件在、也接上了，但跑不起来 → 真起进程才发现', async () => {
  // 「文件在」不等于「跑得起来」。import 一个不存在的模块——静态检查、
  // 文件存在检查、接线检查全部照绿，只有真起一次进程才会红。
  const root = await makeProject();
  try {
    await writeFile(path.join(root, '.claude', 'hooks', 'session-start.mjs'),
      "import './does-not-exist.mjs';\n");
    const r = await doctorOn(root);

    assert.equal(pick(r, 'hooks-wired').status, 'ok', '文件在、也接上了，接线那项不该红');
    const run = pick(r, 'hooks-runnable');
    assert.equal(run.status, 'error', '起不来的 hook 没被报出来——那本项就只是在查文件存不存在');
    assert.match(run.message, /SessionStart/);
    assert.match(run.fix, /node/, '修复建议要给一条能复现的命令');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('故意弄坏⑥：子代理 skills: 引用一个不存在的 skill → 预加载会静默落空', async () => {
  const root = await makeProject();
  try {
    const file = path.join(root, '.claude', 'agents', 'vima-builder.md');
    const text = await readFile(file, 'utf8');
    await writeFile(file, text.replace('skills: [vima-intake]', 'skills: [vima-nowhere]'));
    const r = await doctorOn(root);
    const agents = pick(r, 'agents');
    assert.equal(agents.status, 'error');
    assert.match(agents.message, /vima-nowhere/);
    assert.match(agents.message, /静默/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('故意弄坏⑦：SKILL.md 的 frontmatter 有读不懂的行 → 不许当成「解析通过」', async () => {
  const root = await makeProject();
  try {
    const file = path.join(root, '.claude', 'skills', 'vima-intake', 'SKILL.md');
    const text = await readFile(file, 'utf8');
    // 插一行既不是 `k: v` 也不是列表项的东西：frontmatter() 会把它记进 unparsed
    await writeFile(file, text.replace('---\nname:', '---\n这一行读不懂\nname:'));
    const r = await doctorOn(root);
    const skills = pick(r, 'skills');
    assert.equal(skills.status, 'error', 'unparsed 非空 = 有行没读懂，不能算解析通过');
    assert.match(skills.message, /vima-intake/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('故意弄坏⑧：投影漂移 → 报 error 并指向 vima sync（判据调 sync --check，不重写）', async () => {
  const root = await makeProject();
  try {
    const dir = path.join(root, '.claude', 'rules');
    const { readdir } = await import('node:fs/promises');
    const [first] = (await readdir(dir)).filter((f) => f.startsWith('vima-'));
    assert.ok(first, '项目里应当有投影出来的规则文件');
    await writeFile(path.join(dir, first), '被人手改过的投影\n');

    const r = await doctorOn(root);
    const p = pick(r, 'projection');
    assert.equal(p.status, 'error');
    assert.match(p.message, new RegExp(first.replace(/\./g, '\\.')));
    assert.equal(p.fix, 'vima sync');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ── 「查不了」必须说没查 ────────────────────────────────────────────────────

test('settings.json 缺席：接线报 error，锚定与试跑报 warn「没查」而不是 ok', async () => {
  // 这条锁的是本仓的核心价值观：**静默为空不算通过**。
  // 查不了的显示绿勾，比不查更坏——它把「没看」包装成了「没问题」。
  const root = await makeProject();
  try {
    await unlink(path.join(root, '.claude', 'settings.json'));
    const r = await doctorOn(root);

    assert.equal(pick(r, 'hooks-wired').status, 'error');
    for (const id of ['hooks-anchored', 'hooks-runnable']) {
      const c = pick(r, id);
      assert.equal(c.status, 'warn', `${id} 在查不了的时候报了 ${c.status}`);
      assert.match(c.message, /没查|没试跑/, `${id} 没明说「没查」：${c.message}`);
      assert.ok(c.fix, `${id} 报了 warn 却不给下一步`);
    }
    // warn 不算失败：exit 码只由 error 决定，否则「没查」会把 CI 变成噪音
    assert.equal(r.ok, false, 'hooks-wired 是 error，整体应当不 ok');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('子代理/skill 目录整个不在：报 warn 而不是 ok——「不在场」不是「没问题」', async () => {
  const root = await makeProject();
  try {
    await rm(path.join(root, '.claude', 'agents'), { recursive: true, force: true });
    await rm(path.join(root, '.claude', 'skills'), { recursive: true, force: true });
    const r = await doctorOn(root);
    assert.equal(pick(r, 'agents').status, 'warn');
    assert.equal(pick(r, 'skills').status, 'warn');
    assert.match(pick(r, 'agents').fix, /vima init/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ── CLI 门面 ──────────────────────────────────────────────────────────────

test('CLI：有 error 时 exit 5（同 audit 口径），--json 机器可读', async () => {
  const { main } = await import('../../lib/front/cli.mjs');
  const { EXIT } = A;
  const root = await makeProject();
  try {
    const conf = JSON.parse(await readFile(path.join(root, '.mcp.json'), 'utf8'));
    conf.mcpServers.vima.args[0] = '/definitely/not/here/vima.mjs';
    await writeFile(path.join(root, '.mcp.json'), `${JSON.stringify(conf, null, 2)}\n`);

    let out = '';
    const io = { out: { write: (s) => { out += s; return true; } }, err: { write: () => true }, env: {}, cwd: root, stdin: { isTTY: true } };
    assert.equal(await main(['doctor', '--json'], io), EXIT.UNMET);
    const data = JSON.parse(out);
    assert.equal(data.ok, false);
    assert.ok(data.counts.error >= 1);
    assert.ok(data.checks.every((c) => c.id && c.status && c.checked), '--json 的每一项都要带 id/status/checked');

    out = '';
    assert.equal(await main(['doctor'], io), EXIT.UNMET);
    assert.match(out, /工具体检/);
    assert.match(out, /查了：/, '人读版必须逐项印「查了什么」');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('CLI：健康项目 exit 0', async () => {
  const { main } = await import('../../lib/front/cli.mjs');
  const { EXIT } = A;
  const root = await makeProject();
  try {
    const io = { out: { write: () => true }, err: { write: () => true }, env: {}, cwd: root, stdin: { isTTY: true } };
    assert.equal(await main(['doctor'], io), EXIT.OK);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
