// Web 观测平台 —— 呈现契约：两轴同屏、裁定按关注度排序、暂缺如实、失效清单一等公民、回放可重建。
//
// 这些断言不是「界面好看」的检查，是**可信度**的检查：任何一条塌掉，
// 平台就会给出「整条链都很硬」的错觉，而那正是它存在的理由所要消灭的东西。
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';

import { append } from '../../lib/core/events.mjs';
import { serve, HOST, pageOverview, claimStatus } from '../../lib/front/web.mjs';

const at = (h) => ({ now: new Date(`2026-08-16T${String(h).padStart(2, '0')}:00:00.000Z`) });

function get(port, p) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: HOST, port, path: p }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

const count = (s, needle) => s.split(needle).length - 1;

/** 四条命题覆盖四种状态：达标 / 未达标 / 门槛暂不可达（observed）/ 无证据。 */
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'vima-webr-'));
  await mkdir(path.join(root, '.vima'), { recursive: true });

  await append(root, { kind: 'claim', actor: 'compile', subject: 'c-met', payload: { layer: 'spec', statement: '达标的命题', trust: 'fact', need: 'derived' } }, at(1));
  await append(root, { kind: 'evidence', actor: 'attest', subject: 'c-met', payload: { strength: 'executed', by: 'test:unit' } }, at(2));

  await append(root, { kind: 'claim', actor: 'compile', subject: 'c-short', payload: { layer: 'impl', statement: '来源过期但实现扎实', trust: 'superseded', need: 'executed' } }, at(3));
  await append(root, { kind: 'evidence', actor: 'attest', subject: 'c-short', payload: { strength: 'derived', by: 'extract:mark' } }, at(4));

  await append(root, { kind: 'claim', actor: 'compile', subject: 'c-observed', payload: { layer: 'behavior', statement: '要求真跑一遍界面', trust: 'stated', need: 'observed' } }, at(5));
  await append(root, { kind: 'evidence', actor: 'attest', subject: 'c-observed', payload: { strength: 'executed', by: 'test:e2e' } }, at(6));

  await append(root, { kind: 'claim', actor: 'compile', subject: 'c-none', payload: { layer: 'contract', statement: 'AI 定的且一条证据都没有', trust: 'ruled', need: 'derived' } }, at(7));

  // 裁定：故意打乱写入顺序，看界面会不会自己排对
  await append(root, { kind: 'ruling', actor: 'ai', subject: null, payload: { question: 'R-HIGH 小影响面高置信', chosen: 'A', confidence: 'high', blastRadius: 1 } }, at(8));
  await append(root, { kind: 'ruling', actor: 'ai', subject: null, payload: { question: 'R-LOWBIG 低置信大影响面', chosen: 'B', confidence: 'low', blastRadius: 42 } }, at(9));
  await append(root, { kind: 'ruling', actor: 'ai', subject: null, payload: { question: 'R-UNRATED 什么都没声明', chosen: 'C' } }, at(10));
  await append(root, { kind: 'ruling', actor: 'ai', subject: null, payload: { question: 'R-LOWSMALL 低置信小影响面', chosen: 'D', confidence: 'low', blastRadius: 2 } }, at(11));
  // 「已复核」用**真实形状**造：先记旧裁定，再记一条 overrides 指向它的新裁定。
  // 这里曾直接在 payload 里塞 overriddenBy——那个形状真实系统根本产不出来
  // （overriddenBy 只由投影回填），合成形状喂测试正是被测试纪律点名的病。
  const done = await append(root, { kind: 'ruling', actor: 'ai', subject: null, payload: { question: 'R-DONE 已复核', chosen: 'E', confidence: 'low', blastRadius: 99 } }, at(12));
  await append(root, { kind: 'ruling', actor: 'human', subject: null, payload: { question: 'R-OVERRIDE 人的改判', chosen: 'F', confidence: 'high', blastRadius: 99, overrides: done.id } }, at(13));

  await append(root, { kind: 'run', actor: 'agent-a', subject: 'c-met', payload: { op: 'compile' }, cost: { tokens: 100, ms: 10 } }, at(14));
  await append(root, { kind: 'run', actor: 'agent-b', subject: 'c-short', payload: { op: 'attest' }, cost: { tokens: 900, ms: 40 } }, at(15));
  await append(root, { kind: 'run', actor: 'agent-b', subject: 'c-none', payload: { op: 'attest' } }, at(16));
  return root;
}

async function withUi(fn) {
  const root = await fixture();
  const ui = await serve({ root });
  try {
    await fn(ui, root);
  } finally {
    await ui.close();
    await rm(root, { recursive: true, force: true });
  }
}

test('硬性①：两个强度轴在同一屏并列，每条命题都各出一条', async () => {
  await withUi(async (ui) => {
    const { body } = await get(ui.port, '/claims');
    assert.match(body, /S 来源可信度/);
    assert.match(body, /E 验证强度/);
    // 4 条命题 → 4 条 S 阶梯 + 4 条 E 阶梯（另加暂缺说明卡里的示意格）
    assert.equal(count(body, 'class="ladder t-'), 4, '每条命题必须有 S 轴');
    assert.ok(count(body, 'class="ladder e-') >= 4, '每条命题必须有 E 轴');
    // 「来源可信但没实现」与「实现扎实但来源过期」必须都能一眼看出
    assert.match(body, /superseded/);
    assert.match(body, /ruled/);
  });
});

test('硬性②：裁定台账默认按关注度排序（未声明 → 低置信大影响面 → 高置信 → 已复核沉底），且带筛选与排序控件', async () => {
  await withUi(async (ui) => {
    const { body } = await get(ui.port, '/rulings');
    const order = ['R-UNRATED', 'R-LOWBIG', 'R-LOWSMALL', 'R-HIGH', 'R-DONE'];
    const idx = order.map((k) => body.indexOf(k));
    assert.ok(idx.every((i) => i > 0), '五条裁定都要出现');
    for (let i = 1; i < idx.length; i += 1) {
      assert.ok(idx[i - 1] < idx[i], `${order[i - 1]} 应排在 ${order[i]} 之前`);
    }
    assert.match(body, /data-sort/);
    assert.match(body, /data-filter="level"/);
    assert.match(body, /只看未复核/);
    assert.match(body, /未声明/);
  });
});

test('硬性②续：二次裁决只生成一条 CLI 命令，页面不提供任何写操作', async () => {
  await withUi(async (ui) => {
    const { body } = await get(ui.port, '/rulings');
    // 生成的必须是 CLI 真有的命令面（vima rule 的既有入参），不能凭空造一个子命令
    // 二次裁决命令必须带结构化 --overrides——旧版把旧 id 写进 rationale 文案，
    // 投影根本不解析它，改判与被改判在数据上毫无关联。
    assert.match(body, /vima rule --overrides=/);
    assert.match(body, /--confidence=/);
    assert.match(body, /--blast=/);
    // 命令旁边那句提示必须跟着命令走。它曾停在「CLI 目前没有这个入参」，
    // 而入参早就做好了——界面劝人别指望一个已经能用的能力，人就会绕道手改账本。
    assert.match(body, /跑完本条即转「已复核」/);
    assert.doesNotMatch(body, /CLI 目前没有这个入参/);
    assert.doesNotMatch(body, /<form[^>]*method="post"/i);
    assert.doesNotMatch(body, /method=post/i);
    // 只读姿态在页面上明说
    assert.match(body, /只读/);
  });
});

test('硬性③：失效清单是首页一等公民；有失效时列出来，没有时明说清空', async () => {
  await withUi(async (ui) => {
    const { body } = await get(ui.port, '/');
    assert.match(body, /失效清单/);
    const headTail = body.indexOf('失效清单');
    assert.ok(headTail < body.indexOf('能交付吗'), '失效清单要排在交付判断之前');
    assert.match(body, /清空/);
  });

  // 失效渲染走**真实事件流**：上游改内容 → 下游 stale。
  // 这里曾用合成投影，理由是「真实流当前造不出 stale」——那是并行开发早期的
  // 事实，core 修好后注释没更新，这条测试就一直拿过期理由违反「不喂合成对象」。
  // 合成投影的危险不是假想：propagateStale 的 lastTouched 死代码正是被它掩盖过。
  const root = await mkdtemp(path.join(os.tmpdir(), 'vima-web-stale-'));
  try {
    const at = (s) => new Date(`2026-08-16T00:00:0${s}Z`);
    await append(root, { kind: 'claim', actor: 'h', subject: 'c-up', payload: { layer: 'spec', statement: 'v1', need: 'claimed', trust: 'stated' } }, { now: at(1) });
    await append(root, { kind: 'claim', actor: 'a', subject: 'c-stale', payload: { layer: 'impl', statement: '上游改过', need: 'derived', from: ['c-up'] } }, { now: at(2) });
    await append(root, { kind: 'evidence', actor: 'system', subject: 'c-stale', payload: { strength: 'executed', by: 'test' } }, { now: at(3) });
    await append(root, { kind: 'claim', actor: 'h', subject: 'c-up', payload: { layer: 'spec', statement: 'v2', need: 'claimed', trust: 'stated' } }, { now: at(4) });

    const { readAll } = await import('../../lib/core/events.mjs');
    const { project } = await import('../../lib/core/claims.mjs');
    const p = project((await readAll(root)).events);
    assert.equal(p.claims.get('c-stale').stale, true, '真实事件流必须造得出 stale——造不出说明 R3 又断了');

    const html = pageOverview(p);
    assert.match(html, /失效清单 · 1 条/);
    assert.match(html, /c-stale/);
    assert.match(html, /改完了.*失效清单.*清空|「改完了」的判据就是这张表清空/);
    assert.equal(claimStatus(p.claims.get('c-stale')).tone, 'bad');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('硬性④：observed 暂缺如实呈现——不冒充、不显示成绿色', async () => {
  await withUi(async (ui) => {
    const claims = await get(ui.port, '/claims');
    assert.match(claims.body, /未建采集设施/);
    assert.match(claims.body, /seg unavail/, '暂缺档必须是斜纹格，不是空白也不是绿色');

    const one = await get(ui.port, '/claim/c-observed');
    assert.match(one.body, /门槛暂不可达/);
    // 该命题有 executed 证据但门槛是 observed —— 绝不能显示为达标
    assert.doesNotMatch(one.body, /badge ok">达标/);

    const home = await get(ui.port, '/');
    assert.match(home.body, /observed 暂缺/);
    assert.doesNotMatch(home.body, /全部命题均达到/, '有未达标时不许给出可交付结论');

    // 无证据的命题必须写「无证据」，而不是留白
    const none = await get(ui.port, '/claim/c-none');
    assert.match(none.body, /一条证据也没有|无证据/);
  });
});

test('硬性⑤：过程回放能重建当时状态，且能看出证据一步步变强', async () => {
  await withUi(async (ui) => {
    const zero = await get(ui.port, '/timeline?at=0');
    assert.match(zero.body, /这一刻还没有任何命题/);

    const early = await get(ui.port, '/timeline?at=1');   // 只有 c-met 的 claim，还没证据
    assert.match(early.body, /回放中：第 1 \/ 16 条之后/);
    assert.match(early.body, /c-met/);
    assert.match(early.body, /<tr id="e\d+" class="future"/, '回放位置之后的事件要标成尚未发生');

    const later = await get(ui.port, '/timeline?at=2');   // 证据到位
    assert.match(later.body, /c-met/);
    // 快照（不是事件流本身）随回放位置变化：命题数 1 → 2 之前只有 c-met，达标 0 → 1
    const kpi = (html, label) => new RegExp(`<div class="n">(\\d+)</div><div class="l">${label}</div>`).exec(html)?.[1];
    assert.equal(kpi(early.body, '当时的命题数'), '1', '第 1 条事件时只存在一条命题');
    assert.equal(kpi(early.body, '当时达标'), '0');
    assert.equal(kpi(later.body, '当时达标'), '1');
    assert.equal(kpi(await get(ui.port, '/timeline').then((r) => r.body), '当时的命题数'), '4');

    // actor 维度
    assert.match(later.body, /谁做的（actor 维度/);
    assert.match(later.body, /compile/);

    // 单条命题上的证据变强轨迹
    const one = await get(ui.port, '/claim/c-met');
    assert.match(one.body, /证据是怎么一步步变强的/);
    assert.match(one.body, /当时最强 executed/);

    // 越界的 at 被夹住而不是崩
    const over = await get(ui.port, '/timeline?at=9999');
    assert.equal(over.status, 200);
    const junk = await get(ui.port, '/timeline?at=abc');
    assert.equal(junk.status, 200);
  });
});

test('成本按环节 / 代理 / 任务聚合，缺 cost 的 run 如实标为未知而不是零', async () => {
  await withUi(async (ui) => {
    const { body } = await get(ui.port, '/cost');
    assert.match(body, /按环节（op）/);
    assert.match(body, /按代理（actor）/);
    assert.match(body, /按任务（subject）/);
    assert.match(body, /1,000/, 'tokens 合计 100 + 900');
    assert.match(body, /未记 cost（花费未知）/);
    assert.match(body, /agent-b/);
  });
});

test('总览的达标口径与 claims/meets 一致，不另立第二份数字', async () => {
  await withUi(async (ui) => {
    const { body } = await get(ui.port, '/');
    // 4 条命题：c-met 达标；c-short 未达标；c-observed 门槛暂不可达；c-none 无证据
    assert.match(body, /<div class="n">4<\/div><div class="l">命题<\/div>/);
    assert.match(body, /<div class="n">1<\/div><div class="l">达标<\/div>/);
    assert.match(body, /<div class="n">1<\/div><div class="l">无证据<\/div>/);
    assert.match(body, /证据强度分布 vs 各自声明的门槛/);
  });
});

test('明暗两套配色都成立：颜色只走 CSS 变量，且三种主题状态都定义', async () => {
  await withUi(async (ui) => {
    const { body } = await get(ui.port, '/');
    assert.match(body, /prefers-color-scheme:dark/);
    assert.match(body, /:root:not\(\[data-theme="light"\]\)/);
    assert.match(body, /:root\[data-theme="dark"\]/);
    assert.match(body, /data-theme-toggle/);
    // 颜色不能只活在媒体查询里：裸 :root 必须先给全一套
    const bare = /:root\{[^}]*--bg:[^}]*--ok:[^}]*\}/s.test(body);
    assert.ok(bare, '浅色调色板必须定义在裸 :root 上');
  });
});
