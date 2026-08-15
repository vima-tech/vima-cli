// C2 单测：vima doctor 体检项（设计 §19.4）——重点断言 ②④ 的 ✅/❌ 翻转与 exit 码
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, cp, mkdir, writeFile, readFile, chmod, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(HERE, '..', '..', 'bin', 'vima.mjs');
const GOLDEN = path.join(HERE, '..', 'fixtures', 'golden');

function runCli(cwd, args) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
}

/** 人造小夹具：黄金 docs（lifecycle+tasks）+ 合规 CLAUDE.md + 完整 .claude 目录。 */
async function makeProject(t) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'vima-c2-doctor-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));
  await cp(path.join(GOLDEN, 'docs'), path.join(tmp, 'docs'), { recursive: true });

  // 合规 CLAUDE.md（10 行）
  await writeFile(path.join(tmp, 'CLAUDE.md'), Array.from({ length: 10 }, (_, i) => `# 第 ${i + 1} 行`).join('\n') + '\n');

  // 完整 .claude：settings + 4 skills + 3 工作流正文 + 6 角色 + 4 hooks
  // （可执行；A18 增 go-continue，A39 增 go-autostart）
  const files = {
    '.claude/settings.json': '{}\n',
    '.claude/skills/go/SKILL.md': '---\ndescription: 继续 Vima 项目开发\n---\n${CLAUDE_SKILL_DIR} ${CLAUDE_PROJECT_DIR}\n',
    '.claude/skills/check/SKILL.md': '---\ndescription: 检查 Vima 项目完成度\n---\n${CLAUDE_SKILL_DIR} ${CLAUDE_PROJECT_DIR}\n',
    '.claude/skills/design/SKILL.md': '---\ndescription: 执行 Vima 设计工作流\n---\n${CLAUDE_SKILL_DIR} ${CLAUDE_PROJECT_DIR}\n',
    '.claude/skills/vima/SKILL.md': '---\ndescription: 执行任意 Vima CLI 命令\n---\n${CLAUDE_SKILL_DIR} ${CLAUDE_PROJECT_DIR}\n',
    '.claude/commands/go.md': '# /go\n',
    '.claude/commands/check.md': '# /check\n',
    '.claude/commands/design.md': '# /design\n',
    '.claude/agents/vima-builder.md': '# builder\n',
    '.claude/agents/vima-verifier.md': '# verifier\n',
    '.claude/agents/vima-planner.md': '# planner\n',
    '.claude/agents/vima-designer.md': '# designer\n',
    '.claude/agents/vima-design-reviewer.md': '# design reviewer\n',
    '.claude/agents/vima-experience-verifier.md': '# experience verifier\n',
    '.claude/hooks/guard-shared.mjs': '// stub\nprocess.exit(0)\n',
    '.claude/hooks/post-write.mjs': '// stub\nprocess.exit(0)\n',
    '.claude/hooks/go-continue.mjs': '// stub\nprocess.exit(0)\n',
    '.claude/hooks/go-autostart.mjs': '// stub\nprocess.exit(0)\n',
  };
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(tmp, rel);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, content);
  }
  await chmod(path.join(tmp, '.claude/hooks/guard-shared.mjs'), 0o755);
  await chmod(path.join(tmp, '.claude/hooks/post-write.mjs'), 0o755);
  await chmod(path.join(tmp, '.claude/hooks/go-continue.mjs'), 0o755);
  await chmod(path.join(tmp, '.claude/hooks/go-autostart.mjs'), 0o755);
  return tmp;
}

/** 取 stdout 中某个检查项所在行。 */
function lineOf(stdout, label) {
  const line = stdout.split('\n').find((l) => l.includes(label));
  assert.ok(line, `输出应含 "${label}" 检查行：\n${stdout}`);
  return line;
}

test('doctor：健康夹具 → exit 0，②④ 为 ✅', async (t) => {
  const tmp = await makeProject(t);
  const proc = runCli(tmp, ['doctor']);
  assert.equal(proc.status, 0, `stdout: ${proc.stdout}\nstderr: ${proc.stderr}`);
  assert.match(lineOf(proc.stdout, '② CLAUDE.md'), /^✅/);
  assert.match(lineOf(proc.stdout, '④ taskStats'), /^✅/);
  assert.match(proc.stdout, /✅ 体检通过/);
});

test('doctor：CLAUDE.md 超 50 行 → ② ⚠️ 告警（§5.4），不改变退出码', async (t) => {
  const tmp = await makeProject(t);
  await writeFile(path.join(tmp, 'CLAUDE.md'), Array.from({ length: 51 }, (_, i) => `第 ${i + 1} 行`).join('\n') + '\n');

  const proc = runCli(tmp, ['doctor']);
  assert.equal(proc.status, 0, `stdout: ${proc.stdout}\nstderr: ${proc.stderr}`);
  assert.match(lineOf(proc.stdout, '② CLAUDE.md'), /^⚠️/);
  assert.match(lineOf(proc.stdout, '② CLAUDE.md'), /51 行/);
});

test('doctor：taskStats 与 frontmatter 不一致 → ④ ❌、提示 vima sync 且 exit 2', async (t) => {
  const tmp = await makeProject(t);
  const p = path.join(tmp, 'docs', 'lifecycle.json');
  const lifecycle = JSON.parse(await readFile(p, 'utf8'));
  lifecycle.taskStats.done = 3; // 实际 done=1
  await writeFile(p, JSON.stringify(lifecycle, null, 2));

  const proc = runCli(tmp, ['doctor']);
  assert.equal(proc.status, 2);
  const line = lineOf(proc.stdout, '④ taskStats');
  assert.match(line, /^❌/);
  assert.match(line, /vima sync/);
});

test('doctor：hooks 缺可执行位 → ⑦ ❌ 且 exit 2', async (t) => {
  const tmp = await makeProject(t);
  await chmod(path.join(tmp, '.claude/hooks/guard-shared.mjs'), 0o644);

  const proc = runCli(tmp, ['doctor']);
  assert.equal(proc.status, 2);
  assert.match(lineOf(proc.stdout, '⑦ hooks'), /^❌/);
});

test('doctor：正式 go skill 缺失 → ⑥ ❌，不能以 legacy command 冒充可稳定触发', async (t) => {
  const tmp = await makeProject(t);
  await rm(path.join(tmp, '.claude/skills/go/SKILL.md'));

  const proc = runCli(tmp, ['doctor']);
  assert.equal(proc.status, 2);
  assert.match(lineOf(proc.stdout, '⑥ .claude'), /^❌/);
  assert.match(proc.stdout, /\.claude\/skills\/go\/SKILL\.md/);
  assert.match(proc.stdout, /vima update/);
});

test('doctor：任一正式命令入口 skill 缺失 → ⑥ ❌', async (t) => {
  for (const name of ['check', 'design', 'vima']) {
    const tmp = await makeProject(t);
    await rm(path.join(tmp, `.claude/skills/${name}/SKILL.md`));

    const proc = runCli(tmp, ['doctor']);
    assert.equal(proc.status, 2, `${name}: ${proc.stdout}`);
    assert.match(lineOf(proc.stdout, '⑥ .claude'), /^❌/);
    assert.match(proc.stdout, new RegExp(`\\.claude/skills/${name}/SKILL\\.md`));
  }
});

test('doctor：skill 无描述、禁用模型触发或缺项目根校验 → ⑥ ❌', async (t) => {
  const cases = [
    ['---\nname: check\n---\n${CLAUDE_SKILL_DIR} ${CLAUDE_PROJECT_DIR}\n', /缺有效 description/],
    ['---\ndescription: check\ndisable-model-invocation: yes\n---\n${CLAUDE_SKILL_DIR} ${CLAUDE_PROJECT_DIR}\n', /禁用了模型触发/],
    ['---\ndescription: check\n---\n无根校验\n', /缺项目根校验变量/],
  ];
  for (const [content, expected] of cases) {
    const tmp = await makeProject(t);
    await writeFile(path.join(tmp, '.claude/skills/check/SKILL.md'), content);
    const proc = runCli(tmp, ['doctor']);
    assert.equal(proc.status, 2, proc.stdout);
    assert.match(proc.stdout, expected);
  }
});

test('doctor --json：结构化输出（14 个检查项 + pass 标志，A40 增资产可达性项）', async (t) => {
  const tmp = await makeProject(t);
  const proc = runCli(tmp, ['doctor', '--json']);
  assert.equal(proc.status, 0, `stdout: ${proc.stdout}`);
  const report = JSON.parse(proc.stdout);
  assert.equal(report.schemaVersion, '1');
  assert.equal(report.vimaProject, true);
  assert.equal(report.pass, true);
  assert.equal(report.checks.length, 14); // A16：⑪ 端册完整性；A38：⑬ 未来时间戳；A40：⑭ 资产可达性
  for (const c of report.checks) {
    assert.ok(['ok', 'warn', 'error'].includes(c.status), `非法 status: ${c.status}`);
    assert.equal(typeof c.detail, 'string');
  }
  const stats = report.checks.find((c) => c.id === 'task-stats');
  assert.equal(stats.status, 'ok');
});

test('doctor：非 vima 项目（无 lifecycle 无 manifest）→ 只跑 ①② 并注明', async (t) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'vima-c2-doctor-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));

  const proc = runCli(tmp, ['doctor']);
  assert.equal(proc.status, 0, `stdout: ${proc.stdout}\nstderr: ${proc.stderr}`);
  assert.match(proc.stdout, /非 vima 项目/);

  const json = runCli(tmp, ['doctor', '--json']);
  const report = JSON.parse(json.stdout);
  assert.equal(report.vimaProject, false);
  assert.deepEqual(report.checks.map((c) => c.id), ['prerequisites', 'claude-md']);
});

test('doctor ⑩：批准早于产物最后改动 → ❌ 判定批准失效且 exit 2', async (t) => {
  const tmp = await makeProject(t);
  const lcPath = path.join(tmp, 'docs', 'lifecycle.json');
  const lc = JSON.parse(await readFile(lcPath, 'utf8'));

  // ① 批准晚于产物 mtime → ⑩ 应为 ok
  lc.checklists.PLANNING.tasksApproved = true;
  lc.checklists.PLANNING.tasksApprovedAt = new Date(Date.now() + 60_000).toISOString();
  await writeFile(lcPath, `${JSON.stringify(lc, null, 2)}\n`);
  let report = JSON.parse(runCli(tmp, ['doctor', '--json']).stdout);
  let approval = report.checks.find((c) => c.id === 'approval');
  assert.equal(approval.status, 'ok', JSON.stringify(approval));

  // ② 批准早于产物 mtime → ⑩ 应为 error 且整体 exit 2
  lc.checklists.PLANNING.tasksApprovedAt = '2000-01-01T00:00:00.000Z';
  await writeFile(lcPath, `${JSON.stringify(lc, null, 2)}\n`);
  const proc = runCli(tmp, ['doctor', '--json']);
  assert.equal(proc.status, 2, `stdout: ${proc.stdout}`);
  report = JSON.parse(proc.stdout);
  approval = report.checks.find((c) => c.id === 'approval');
  assert.equal(approval.status, 'error');
  assert.match(approval.detail, /批准已失效/);

  // ③ 未置位时不判时效
  lc.checklists.PLANNING.tasksApproved = false;
  await writeFile(lcPath, `${JSON.stringify(lc, null, 2)}\n`);
  report = JSON.parse(runCli(tmp, ['doctor', '--json']).stdout);
  approval = report.checks.find((c) => c.id === 'approval');
  assert.equal(approval.status, 'ok');
});

// ── A19 ⑫ 产物形态与当前规则的差距（升级迁移体检）──

test('doctor ⑫：spec 骨架齐全 → ok；缺 A13 数据块/A4 决策表 → ❌ 且指出出处与补写指引', async (t) => {
  const { writeFile } = await import('node:fs/promises');
  const tmp = await makeProject(t);
  assert.match(lineOf(runCli(tmp, ['doctor']).stdout, '⑫ 产物形态'), /^✅/);

  // 模拟 A13/A4 之前建的老项目：删掉 vima:rules 块与决策表的「已否决方案」列
  const specPath = path.join(tmp, 'docs/spec.md');
  const spec = await readFile(specPath, 'utf8');
  await writeFile(
    specPath,
    spec.replace(/```yaml vima:rules[\s\S]*?```\n/, '').replace(/已否决方案/g, '旧方案'),
  );

  const proc = runCli(tmp, ['doctor']);
  assert.equal(proc.status, 2, '产物形态缺 error 级项须使体检不通过');
  const line = lineOf(proc.stdout, '⑫ 产物形态');
  assert.match(line, /^❌/);
  assert.match(line, /A13/, '须指出是哪个增补项引入的');
  assert.match(line, /A4/);
  assert.match(line, /第五章/, '须给出补写位置');
});

test('doctor ⑫：spec 未生成 → 跳过（不误伤 BOOTSTRAP 期项目）', async (t) => {
  const { rm } = await import('node:fs/promises');
  const tmp = await makeProject(t);
  await rm(path.join(tmp, 'docs/spec.md'));
  const line = lineOf(runCli(tmp, ['doctor']).stdout, '⑫ 产物形态');
  assert.match(line, /^⚠️/);
  assert.match(line, /未生成/);
});

// ── A38 D-A38-03：未来时间戳 = 绕过内核手改 frontmatter 的铁证 ────────────────

test('doctor ⑬：全部 updatedAt 为过去 → ✅', async (t) => {
  const tmp = await makeProject(t);
  const line = lineOf(runCli(tmp, ['doctor']).stdout, '⑬ 任务 updatedAt');
  assert.match(line, /^✅/);
  assert.match(line, /均不晚于当前时钟/);
});

test('doctor ⑬：updatedAt 为未来 → ❌ 且指名文件（内核只写真实时间）', async (t) => {
  const tmp = await makeProject(t);
  const p = path.join(tmp, 'docs/tasks/device-api-be.md');
  const text = await readFile(p, 'utf8');
  await writeFile(p, text.replace(/^updatedAt: .*$/m, 'updatedAt: 2099-01-01T00:00:00Z'));

  const proc = runCli(tmp, ['doctor']);
  const line = lineOf(proc.stdout, '⑬ 任务 updatedAt');
  assert.match(line, /^❌/);
  assert.match(line, /device-api-be\.md/, '必须指名是哪个文件——只报个数无法行动');
  assert.equal(proc.status, 2, '存在 ❌ 项 → exit 2');
});

test('doctor ⑬：换 clone 场景（无 .vima/reports）不假阳性', async (t) => {
  // D-A38-03 否掉了「taskStats.updatedAt 对不上 journal 的 sync 事件」这条候选判据，
  // 正是因为 .vima/reports/ 不进版本控制、换 clone 后必然假阳性。本条守住替代判据无此缺陷。
  const tmp = await makeProject(t);
  await rm(path.join(tmp, '.vima'), { recursive: true, force: true });
  const line = lineOf(runCli(tmp, ['doctor']).stdout, '⑬ 任务 updatedAt');
  assert.match(line, /^✅/, '判据只看 frontmatter 与系统时钟，与 journal 是否存在无关');
});

test('doctor ⑬：5 分钟内的时钟偏差不算数（跨机协作容差）', async (t) => {
  const tmp = await makeProject(t);
  const p = path.join(tmp, 'docs/tasks/device-api-be.md');
  const text = await readFile(p, 'utf8');
  const soon = new Date(Date.now() + 60_000).toISOString(); // 未来 1 分钟，在容差内
  await writeFile(p, text.replace(/^updatedAt: .*$/m, `updatedAt: ${soon}`));
  const line = lineOf(runCli(tmp, ['doctor']).stdout, '⑬ 任务 updatedAt');
  assert.match(line, /^✅/);
});

// ── A40 ⑭ Claude Code 资产可达性 ──────────────────────────────────────────
// 立项实证：sustain-v4（2026-08-15）⑥⑦⑧ 全绿、doctor 报「体检通过」，而项目的
// hooks/子代理/skills 在那条会话里一个都没注册——前六项查「在不在」，没有一项查「生效没生效」。

/** 在夹具里写一份带 hooks 的 settings.json。anchored=false 时用会被 cwd 解析的相对路径。 */
async function writeSettings(root, { anchored }) {
  const cmd = anchored
    ? 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/post-write.mjs"'
    : 'node .claude/hooks/post-write.mjs';
  await writeFile(path.join(root, '.claude/settings.json'), JSON.stringify({
    hooks: { PostToolUse: [{ matcher: 'Write|Edit', hooks: [{ type: 'command', command: cmd }] }] },
  }));
}

test('doctor ⑭：hook 命令未锚定项目根 → error 并指路 vima update', async (t) => {
  const tmp = await makeProject(t);
  await writeSettings(tmp, { anchored: false });
  const proc = runCli(tmp, ['doctor']);
  assert.equal(proc.status, 2, `stdout: ${proc.stdout}`);
  const line = lineOf(proc.stdout, '⑭');
  assert.match(line, /❌/);
  assert.match(line, /未锚定项目根/);
  assert.match(line, /vima update/);
});

test('doctor ⑭：hook 命令已锚定 → 该项不报错', async (t) => {
  const tmp = await makeProject(t);
  await writeSettings(tmp, { anchored: true });
  const proc = runCli(tmp, ['doctor']);
  const line = lineOf(proc.stdout, '⑭');
  assert.doesNotMatch(line, /未锚定项目根/);
});

test('doctor ⑭：报告已落盘但 journal 无 report 事件 → error（post-write hook 未生效的指纹）', async (t) => {
  const tmp = await makeProject(t);
  await writeSettings(tmp, { anchored: true });
  await mkdir(path.join(tmp, '.vima/reports'), { recursive: true });
  await writeFile(path.join(tmp, '.vima/reports/task-1-builder.json'), '{"taskId":"task-1"}');
  // journal 里只有命令事件——正是「hook 没接上」时的样子
  await writeFile(path.join(tmp, '.vima/reports/journal.jsonl'),
    '{"ts":"2026-08-15T00:00:00.000Z","kind":"cmd","ref":"validate"}\n');
  const proc = runCli(tmp, ['doctor']);
  assert.equal(proc.status, 2, `stdout: ${proc.stdout}`);
  const line = lineOf(proc.stdout, '⑭');
  assert.match(line, /0 条 report 事件/);
  assert.match(line, /post-write hook 未生效/);
});

test('doctor ⑭：采集链路通畅（报告 + journal report 事件）→ ✅', async (t) => {
  const tmp = await makeProject(t);
  await writeSettings(tmp, { anchored: true });
  await mkdir(path.join(tmp, '.vima/reports'), { recursive: true });
  await writeFile(path.join(tmp, '.vima/reports/task-1-verifier.json'), '{"taskId":"task-1"}');
  await writeFile(path.join(tmp, '.vima/reports/journal.jsonl'),
    '{"ts":"2026-08-15T00:00:00.000Z","kind":"report","ref":"task-1/verifier/r1","outcome":"pass"}\n');
  const proc = runCli(tmp, ['doctor']);
  const line = lineOf(proc.stdout, '⑭');
  assert.match(line, /✅/);
  assert.match(line, /采集链路通畅/);
});

test('doctor ⑭：CLAUDE_PROJECT_DIR 指向别处 → error 指出资产整体未注册', async (t) => {
  const tmp = await makeProject(t);
  await writeSettings(tmp, { anchored: true });
  const proc = spawnSync(process.execPath, [BIN, 'doctor'], {
    cwd: tmp,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: path.dirname(tmp) },
  });
  assert.equal(proc.status, 2, `stdout: ${proc.stdout}`);
  const line = lineOf(proc.stdout, '⑭');
  assert.match(line, /本会话的项目根是/);
  assert.match(line, /全部未注册/);
});

test('doctor ⑭：hook 词元为绝对路径（无空格直执行 / 解释器在前）→ 均视为已锚定', async (t) => {
  const tmp = await makeProject(t);
  await writeFile(path.join(tmp, '.claude/settings.json'), JSON.stringify({
    hooks: { PostToolUse: [{ matcher: 'Write|Edit', hooks: [
      { type: 'command', command: `"${tmp}/.claude/hooks/post-write.mjs"` },          // 直执行，无空格
      { type: 'command', command: `/usr/bin/node "${tmp}/.claude/hooks/guard-shared.mjs"` }, // 解释器绝对路径在前
    ] }] },
  }));
  const proc = runCli(tmp, ['doctor']);
  const line = lineOf(proc.stdout, '⑭');
  assert.doesNotMatch(line, /未锚定项目根/, `绝对路径词元不应误报：${line}`);
});
