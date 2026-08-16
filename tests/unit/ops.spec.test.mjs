// docs/ markdown → 编译批次。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseSpec, readSpecs, SpecError } from '../../lib/ops/spec.mjs';

const md = (...lines) => lines.join('\n');

test('常见情形是纯散文：id + 一句话，其余全从文件头继承', () => {
  const b = parseSpec(md(
    '---', 'layer: spec', 'upstream: [intent-login]', 'trust: stated', 'need: derived', '---', '',
    '这一段是背景说明，不该变成命题。', '',
    '- `spec-login-remember` 登录页提供「记住我」勾选框', '',
  ));
  assert.equal(b.layer, 'spec');
  assert.deepEqual(b.upstream, ['intent-login']);
  assert.equal(b.items.length, 1);
  assert.deepEqual(b.items[0], {
    id: 'spec-login-remember', statement: '登录页提供「记住我」勾选框',
    trust: 'stated', need: 'derived',
  });
});

test('条目属性覆盖文件头缺省', () => {
  const b = parseSpec(md(
    '---', 'layer: spec', 'upstream: [i-1]', 'need: derived', '---', '',
    '- `s-1` 普通的一条',
    '- `s-2` 门槛更高的一条',
    '  - need: executed',
    '  - from: i-1, i-2',
  ));
  assert.equal(b.items[0].need, 'derived');
  assert.equal(b.items[1].need, 'executed');
  assert.deepEqual(b.items[1].from, ['i-1', 'i-2']);
});

test('代码围栏里的示例不算命题——格式说明本身要拿围栏举例', () => {
  const b = parseSpec(md(
    '---', 'layer: spec', 'upstream: [i-1]', '---', '',
    '写法如下：', '', '```', '- `not-a-claim` 这是示例', '```', '',
    '- `real-claim` 这条才是真的',
  ));
  assert.deepEqual(b.items.map((i) => i.id), ['real-claim']);
});

test('正文段落会结束属性块，下一段里的「键: 值」不会被吸进上一条命题', () => {
  const b = parseSpec(md(
    '---', 'layer: spec', 'upstream: [i-1]', '---', '',
    '- `s-1` 一条命题',
    '  - need: executed', '',
    '备注：本页 need: observed 是将来的目标。', '',
    '- `s-2` 另一条',
  ));
  assert.equal(b.items[0].need, 'executed');
  assert.equal(b.items[1].need, undefined, '第二条不该继承上一条的属性');
});

test('ruling 用点号键写全五件事', () => {
  const b = parseSpec(md(
    '---', 'layer: spec', 'upstream: [i-1]', '---', '',
    '- `s-1` 设备状态只有两值',
    '  - ruling.question: spec 三值、契约两值',
    '  - ruling.chosen: contract',
    '  - ruling.options: spec 三值, contract 两值',
    '  - ruling.rationale: 契约与后端一致',
    '  - ruling.confidence: low',
    '  - ruling.blastRadius: 列表页, 详情页',
  ));
  assert.deepEqual(b.items[0].ruling, {
    question: 'spec 三值、契约两值',
    chosen: 'contract',
    options: ['spec 三值', 'contract 两值'],
    rationale: '契约与后端一致',
    confidence: 'low',
    blastRadius: ['列表页', '详情页'],
  });
});

test('没有 layer 文件头的 markdown 不是规格，返回 null 而不是抛', () => {
  assert.equal(parseSpec('# 随便一篇笔记\n\n- `x` 看起来像命题'), null);
});

test('未知键当场抛，不静默忽略——被忽略的 needs: 会让门槛悄悄掉回默认值', () => {
  assert.throws(() => parseSpec(md('---', 'layer: spec', 'sides: [fe]', '---', '')), SpecError);
  assert.throws(() => parseSpec(md(
    '---', 'layer: spec', 'upstream: [i]', '---', '', '- `s-1` x', '  - needs: executed',
  )), /未知属性 needs/);
});

test('层名写错当场抛，不留到编译时才发现', () => {
  assert.throws(() => parseSpec(md('---', 'layer: phase-2', '---', '')), /不合法/);
});

test('属性上面没有命题条目 → 抛，且报真实行号', () => {
  try {
    parseSpec(md('---', 'layer: spec', '---', '', '  - need: executed'), 'docs/x.md');
    assert.fail('应当抛');
  } catch (e) {
    assert.ok(e instanceof SpecError);
    assert.equal(e.line, 5, `行号应指向源文件第 5 行，实际 ${e.line}`);
  }
});

test('readSpecs 按层排序——顺序错了下游会整批报「上游不在事件流里」', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima4-spec-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, 'spec'), { recursive: true });
  await mkdir(path.join(dir, 'raw'), { recursive: true });
  // 文件名故意让字典序与层序相反：a-contract < intent < spec/b
  await writeFile(path.join(dir, 'a-contract.md'), md('---', 'layer: contract', 'upstream: [s]', '---', '', '- `c-1` x'));
  await writeFile(path.join(dir, 'intent.md'), md('---', 'layer: intent', 'source: raw/kickoff.md', '---', '', '- `i-1` x'));
  await writeFile(path.join(dir, 'spec', 'b.md'), md('---', 'layer: spec', 'upstream: [i-1]', '---', '', '- `s-1` x'));
  await writeFile(path.join(dir, 'notes.md'), '# 没有 layer 头');
  await writeFile(path.join(dir, 'raw', 'kickoff.md'), md('---', 'layer: intent', '---', '', '- `bogus` 物料里的假命题'));

  const { batches, skipped } = await readSpecs(dir);
  assert.deepEqual(batches.map((b) => b.batch.layer), ['intent', 'spec', 'contract']);
  assert.deepEqual(skipped, ['notes.md']);
  assert.ok(!batches.some((b) => b.rel.startsWith('raw/')), 'raw/ 是原始物料，不参与编译');
});

test('id 不合法 → 抛错带行号，绝不当散文静默跳过', () => {
  // 曾经：`login_remember`（下划线）整行匹配不上 ITEM，被当散文丢弃，
  // compile 打出「+1」，人以为三条都进去了。markdown 是唯一真源，
  // 它这一侧静默丢条目，比 JSON 路的任何报错都致命。
  try {
    parseSpec(md('---', 'layer: spec', 'upstream: [i]', '---', '',
      '- `ok-one` 合法的一条',
      '- `login_remember` 下划线不合法',
    ), 'docs/x.md');
    assert.fail('应当抛');
  } catch (e) {
    assert.ok(e instanceof SpecError, String(e));
    assert.match(e.message, /login_remember/);
    assert.equal(e.line, 7, `行号应指向出错那行，实际 ${e.line}`);
  }
  // 大写同理
  assert.throws(() => parseSpec(md('---', 'layer: spec', 'upstream: [i]', '---', '', '- `Login-Sso` 大写')), /Login-Sso/);
});
