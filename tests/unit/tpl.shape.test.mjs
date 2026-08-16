// templates/project/ 的目录形状与 skills / 项目规则示例。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { frontmatter } from '../../lib/core/fsx.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TPL = path.join(REPO, 'templates', 'project');

const SKILLS = ['vima-intake', 'vima-adopt', 'vima-harvest', 'vima-reskin'];

test('目录形状与 ARCHITECTURE 的「项目内」小节一致', async () => {
  for (const rel of [
    'docs/README.md',
    '.vima/rules',
    '.claude/CLAUDE.md',
    '.claude/settings.json',
    '.claude/hooks',
    '.claude/skills',
    '.claude/agents',
  ]) {
    await stat(path.join(TPL, rel)); // 缺就抛 ENOENT
  }
});

test('模板不预置 .vima/project.json —— 缺省值的真源在 core/project.mjs', async () => {
  await assert.rejects(() => stat(path.join(TPL, '.vima', 'project.json')), /ENOENT/);
});

test('模板不预置 .vima/events.jsonl 与 index/ —— 一个是运行产物，一个是派生缓存', async () => {
  await assert.rejects(() => stat(path.join(TPL, '.vima', 'events.jsonl')), /ENOENT/);
  await assert.rejects(() => stat(path.join(TPL, '.vima', 'index')), /ENOENT/);
});

test('.vima/rules/ 的示例能被真加载器吃下去（键集合由加载器裁定，这里不复述）', async () => {
  // 这条曾经写成「断言 frontmatter 有 id、有 blocks」——那是把加载器的契约
  // 抄了一份在测试里。抄的那份写错了（真加载器只认 layer/side/app/block、
  // id 从文件名推导），于是模板与加载器各自绿着、拼起来抛 RULE_UNKNOWN_KEY。
  //
  // 教训：**消费方的契约不许在生产方的测试里复述。** 复述出来的是第二个真源，
  // 而两个真源必然有对不上的一天——这正是 vima 本身要治的病。
  // 所以这里不列允许键，直接让真加载器判：它不抛，就是对齐的。
  const { loadRules } = await import('../../lib/assets/rules.mjs');
  const rules = await loadRules(path.join(TPL, '..', '..', 'assets'), TPL);
  const example = rules.find((r) => r.id === 'example-list-page');
  assert.ok(example, '示例规则应当被加载出来（id 从文件名推导，不来自 frontmatter）');
  assert.ok(Object.keys(example.applies).length > 0, '示例应当至少限定一个维度，否则演示不了维度下发');

  const { body } = frontmatter(await readFile(path.join(TPL, '.vima', 'rules', 'example-list-page.md'), 'utf8'));
  assert.ok(body.includes('示例文件'), '示例必须自陈是示例，不然会被当成真规则');
});

for (const name of SKILLS) {
  test(`skill ${name}：frontmatter 齐、description 能撑起触发判断、正文够长`, async () => {
    const file = path.join(TPL, '.claude', 'skills', name, 'SKILL.md');
    const text = await readFile(file, 'utf8');
    const { data, body } = frontmatter(text);
    assert.equal(data.name, name, 'frontmatter 的 name 必须等于目录名');
    assert.equal(typeof data.description, 'string');
    // description 决定它何时被触发——一句话概括的 skill 永远不会在对的时候加载
    assert.ok(data.description.length >= 60,
      `${name} 的 description 只有 ${data.description.length} 字，写清楚什么时候用它`);
    // 长规程才值得按需加载；短的应该直接下沉进 CLAUDE.md 或规则
    assert.ok(body.length >= 800,
      `${name} 正文只有 ${body.length} 字符，太短的东西不该做成 skill`);
  });
}

test('vima-adopt 必须写死「来源可信度 ≠ 验证强度」这条纪律', async () => {
  const text = await readFile(path.join(TPL, '.claude', 'skills', 'vima-adopt', 'SKILL.md'), 'utf8');
  // 不做这个区分，接管等于把既有缺陷追认成规格——这是 adopt 唯一不可省的一段
  assert.match(text, /不得自动继承/);
  assert.match(text, /追认成规格/);
});

test('vima-intake 必须写死「AI 定夺 → 记 ruling → 不阻塞」', async () => {
  const text = await readFile(path.join(TPL, '.claude', 'skills', 'vima-intake', 'SKILL.md'), 'utf8');
  assert.match(text, /不阻塞/);
  assert.match(text, /confidence/);
  assert.match(text, /blastRadius/);
});

test('vima-harvest 必须写死两条收录判据', async () => {
  const text = await readFile(path.join(TPL, '.claude', 'skills', 'vima-harvest', 'SKILL.md'), 'utf8');
  assert.match(text, /语义跨项目稳定/);
  assert.match(text, /实现有标准解/);
  assert.match(text, /两条判据是与/);
});
