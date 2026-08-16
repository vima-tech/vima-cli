// templates/project/.claude —— 采集面的结构断言。
//
// 三条是防漂移锁，不是形式主义：
//   1. hook 命令必须 $CLAUDE_PROJECT_DIR 绝对锚定。上一代实测：相对路径的 4 个 hook
//      全未生效（agent cd 一下就解析错），而体检报「通过」。
//   2. settings.json 里不得出现 PreToolUse。C4 明确不阻塞，采集面不是否决面；
//      这条锁死，防日后有人「顺手加个保护」把闸门偷偷装回来。
//      （唯一的否决点是 SubagentStop 打回——它否的不是「你不能这么做」，是「你还没做完」。）
//   3. 挂上的每个 hook 都在、都是合法 ES module、都可执行。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TPL = path.join(REPO, 'templates', 'project');
const HOOKS = path.join(TPL, '.claude', 'hooks');

const HOOK_FILES = Object.freeze({
  PostToolUse: 'post-tool-use.mjs',
  PostToolUseFailure: 'post-tool-use-failure.mjs',
  SubagentStart: 'subagent-start.mjs',
  SubagentStop: 'subagent-stop.mjs',
  SessionStart: 'session-start.mjs',
  UserPromptSubmit: 'user-prompt-submit.mjs',
});

async function settings() {
  return JSON.parse(await readFile(path.join(TPL, '.claude', 'settings.json'), 'utf8'));
}

test('settings.json 只挂这六个事件（五个采集 + 一个打回）', async () => {
  const s = await settings();
  assert.deepEqual(Object.keys(s.hooks).sort(), Object.keys(HOOK_FILES).sort());
});

test('settings.json 里不得出现 PreToolUse —— 采集面不是否决面（C4）', async () => {
  const raw = await readFile(path.join(TPL, '.claude', 'settings.json'), 'utf8');
  assert.ok(!raw.includes('PreToolUse'), 'settings.json 出现了 PreToolUse');
  // 连字符串里都不许有：加回否决点的人多半是从这里下手的
  const s = await settings();
  assert.equal(s.hooks.PreToolUse, undefined);
});

test('hook 文件本身也不得含 PreToolUse', async () => {
  for (const f of ['_lib.mjs', ...Object.values(HOOK_FILES)]) {
    const raw = await readFile(path.join(HOOKS, f), 'utf8');
    const hits = raw.split('\n').filter((l) => l.includes('PreToolUse') && !l.trimStart().startsWith('//'));
    assert.deepEqual(hits, [], `${f} 出现了 PreToolUse（注释之外）`);
  }
});

test('每条 hook 命令都用 $CLAUDE_PROJECT_DIR 绝对锚定，不留相对路径', async () => {
  const s = await settings();
  let seen = 0;
  for (const [event, groups] of Object.entries(s.hooks)) {
    for (const g of groups) {
      for (const h of g.hooks) {
        seen += 1;
        assert.equal(h.type, 'command', `${event} 的 hook 必须是 command 型`);
        assert.match(h.command, /\$CLAUDE_PROJECT_DIR/, `${event} 未锚定 $CLAUDE_PROJECT_DIR：${h.command}`);
        assert.match(h.command, /^node "\$CLAUDE_PROJECT_DIR\/\.claude\/hooks\/[a-z-]+\.mjs"$/,
          `${event} 命令形状不对（相对路径按 cwd 解析会静默失效）：${h.command}`);
      }
    }
  }
  assert.equal(seen, Object.keys(HOOK_FILES).length);
});

test('PostToolUse 只匹配 Write|Edit', async () => {
  const s = await settings();
  assert.equal(s.hooks.PostToolUse.length, 1);
  assert.equal(s.hooks.PostToolUse[0].matcher, 'Write|Edit');
});

test('PostToolUseFailure 的 matcher 比成功侧宽，必须含 Bash', async () => {
  // 成功侧收 Write|Edit 是因为价值在「文件变成什么样」（sha256）；失败侧的价值是
  // 「为什么没成」，而那绝大多数来自 Bash（跑测试、跑构建）。同口径会把最该记的漏光。
  const s = await settings();
  assert.equal(s.hooks.PostToolUseFailure.length, 1);
  assert.match(s.hooks.PostToolUseFailure[0].matcher, /Bash/);
});

test('settings.json 指向的每个 hook 文件都存在、可执行、且是合法 module', async () => {
  const s = await settings();
  for (const [event, file] of Object.entries(HOOK_FILES)) {
    const abs = path.join(HOOKS, file);
    const st = await stat(abs);
    assert.ok(st.isFile(), `${file} 不存在`);
    assert.ok(st.mode & 0o111, `${file} 没有可执行位`);
    await run(process.execPath, ['--check', abs]); // 语法坏了这里就抛
    const cmd = s.hooks[event][0].hooks[0].command;
    assert.ok(cmd.endsWith(`/${file}"`), `${event} 指向的不是 ${file}`);
  }
});

test('每个 hook 都带 timeout，UserPromptSubmit 最短（每轮都跑）', async () => {
  const s = await settings();
  const t = (e) => s.hooks[e][0].hooks[0].timeout;
  for (const e of Object.keys(HOOK_FILES)) assert.equal(typeof t(e), 'number', `${e} 缺 timeout`);
  assert.ok(t('UserPromptSubmit') <= t('SessionStart'));
});
