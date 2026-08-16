import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { audit } from '../../lib/ops/audit.mjs';
import { append } from '../../lib/core/events.mjs';
import { CAPABILITY } from '../../lib/core/extract.mjs';

const NOW = new Date('2026-08-16T00:00:00.000Z');

/** 建一个真项目：claims / evidence 走 events.append，代码写进 apps/web、apps/api。 */
async function fixture(t, { claims = [], evidence = [], files = {} } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-audit-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.vima'), { recursive: true });
  for (const c of claims) {
    await append(root, {
      kind: 'claim', actor: 'agent:planner', subject: c.id,
      payload: {
        layer: c.layer ?? 'contract', statement: c.statement ?? c.id,
        trust: c.trust ?? 'stated', need: c.need ?? 'derived', from: c.from ?? [], impl: c.impl ?? [],
      },
    }, { now: NOW });
  }
  for (const e of evidence) {
    await append(root, {
      kind: 'evidence', actor: 'system', subject: e.subject,
      payload: { strength: e.strength, by: e.by ?? { mode: e.strength }, detail: null },
    }, { now: NOW });
  }
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(root, ...rel.split('/'));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text, 'utf8');
  }
  const ctx = { root, config: { apps: [{ id: 'web', kind: 'admin' }, { id: 'api', kind: 'backend' }] } };
  return { root, ctx };
}

const FE_LOGIN = `// @vima c-login-post
export const login = (body) => request.post('/login', body);
`;
const BE_LOGIN = `// @vima c-login-post
@RestController
@RequestMapping("/api/login")
public class LoginController {
  @PostMapping
  public void login() {}
}
`;

const kinds = (r) => r.findings.map((x) => x.kind);
const of = (r, kind) => r.findings.filter((x) => x.kind === kind);

test('正例：覆盖、达标、闭合三样都对 —— 一条 finding 都不该有', async (t) => {
  const { ctx } = await fixture(t, {
    claims: [{ id: 'c-login-post', impl: ['POST /api/login'] }],
    evidence: [{ subject: 'c-login-post', strength: 'derived' }],
    files: { 'apps/web/src/login.js': FE_LOGIN, 'apps/api/LoginController.java': BE_LOGIN },
  });
  const r = await audit(ctx);

  assert.deepEqual(r.findings, [], JSON.stringify(r.findings, null, 2));
  assert.equal(r.summary.ok, true);
  assert.deepEqual(r.summary.coverage, { total: 1, covered: 1, uncovered: 0 });
  assert.deepEqual(r.summary.conformance, { total: 1, met: 1, unmet: 0 });
  assert.equal(r.summary.closure.scanned, true);
  assert.deepEqual(r.summary.closure.unimplemented, []);
  assert.deepEqual(r.summary.closure.unserved, []);
});

test('覆盖：没有证据的命题报 uncovered', async (t) => {
  const { ctx } = await fixture(t, { claims: [{ id: 'c-bare' }] });
  const r = await audit(ctx);
  const [x] = of(r, 'uncovered');
  assert.equal(x.severity, 'error');
  assert.equal(x.subject, 'c-bare');
  assert.equal(r.summary.ok, false);
  assert.deepEqual(r.summary.coverage, { total: 1, covered: 0, uncovered: 1 });
});

test('达标：有证据但够不上门槛报 weak，且说清差在哪一档', async (t) => {
  const { ctx } = await fixture(t, {
    claims: [{ id: 'c-weak', need: 'executed' }],
    evidence: [{ subject: 'c-weak', strength: 'claimed' }],
  });
  const r = await audit(ctx);
  const [x] = of(r, 'weak');
  assert.equal(x.severity, 'error');
  assert.match(x.message, /claimed.*executed/);
  assert.deepEqual(r.summary.coverage, { total: 1, covered: 1, uncovered: 0 }, '有证据算覆盖');
  assert.deepEqual(r.summary.conformance, { total: 1, met: 0, unmet: 1 }, '但不算达标');
  assert.equal(kinds(r).includes('uncovered'), false, '一条命题只出一条主诊断');
});

test('野生证据：指向不存在命题的证据要被捞出来说，不能悄悄丢掉', async (t) => {
  const { ctx } = await fixture(t, {
    claims: [{ id: 'c-real' }],
    evidence: [{ subject: 'c-real', strength: 'derived' }, { subject: 'c-ghost', strength: 'executed' }],
  });
  const r = await audit(ctx);
  const [x] = of(r, 'orphan-evidence');
  assert.equal(x.severity, 'warn');
  assert.equal(x.subject, 'c-ghost');
  assert.equal(r.summary.orphanEvidence.length, 1);
});

test('野生标注：代码标了不存在的命题 id（拼错），要报出来并给位置', async (t) => {
  const { ctx } = await fixture(t, {
    claims: [{ id: 'c-login-post', impl: ['POST /api/login'] }],
    evidence: [{ subject: 'c-login-post', strength: 'derived' }],
    files: {
      'apps/web/src/login.js': FE_LOGIN,
      'apps/api/LoginController.java': BE_LOGIN,
      'apps/web/src/typo.js': '// @vima c-login-pst\nexport const x = 1;\n',
    },
  });
  const r = await audit(ctx);
  const [x] = of(r, 'orphan-mark');
  assert.equal(x.subject, 'c-login-pst');
  assert.deepEqual(x.detail.at, [{ file: 'apps/web/src/typo.js', line: 1 }]);
});

test('闭合：契约声明的端点没有实现 → endpoint-unimplemented（挡交付）', async (t) => {
  const { ctx } = await fixture(t, {
    claims: [
      { id: 'c-login-post', impl: ['POST /api/login'] },
      { id: 'c-login-del', impl: ['DELETE /api/login/{id}'] },
    ],
    evidence: [
      { subject: 'c-login-post', strength: 'derived' },
      { subject: 'c-login-del', strength: 'derived' },
    ],
    files: { 'apps/web/src/login.js': FE_LOGIN, 'apps/api/LoginController.java': BE_LOGIN },
  });
  const r = await audit(ctx);
  const [x] = of(r, 'endpoint-unimplemented');
  assert.equal(x.severity, 'error');
  assert.equal(x.subject, 'DELETE /api/login/{*}', '路径参数归一后再比对');
  assert.deepEqual(x.detail.claims, ['c-login-del']);
});

test('闭合：实现了契约里没有的端点 → endpoint-uncontracted（要人看，不挡交付）', async (t) => {
  const { ctx } = await fixture(t, {
    claims: [{ id: 'c-login-post', impl: ['POST /api/login'] }],
    evidence: [{ subject: 'c-login-post', strength: 'derived' }],
    files: {
      'apps/web/src/login.js': FE_LOGIN,
      'apps/api/LoginController.java': BE_LOGIN,
      'apps/api/SecretController.java': `// @vima c-login-post
@RequestMapping("/api/secret")
public class SecretController {
  @GetMapping("/{id}")
  public void peek() {}
}
`,
    },
  });
  const r = await audit(ctx);
  const [x] = of(r, 'endpoint-uncontracted');
  assert.equal(x.severity, 'warn');
  assert.equal(x.subject, 'GET /api/secret/{*}');
  // 同一个端点没人调，从另一个角度也该被看见
  assert.equal(of(r, 'route-uncalled')[0].subject, 'GET /api/secret/{*}');
});

test('闭合：前端读的端点后端没人提供 → call-unserved（「被读的数据有人写吗」）', async (t) => {
  const { ctx } = await fixture(t, {
    claims: [{ id: 'c-login-post', impl: ['POST /api/login'] }],
    evidence: [{ subject: 'c-login-post', strength: 'derived' }],
    files: {
      'apps/web/src/login.js': `${FE_LOGIN}export const profile = () => request.get('/profile');\n`,
      'apps/api/LoginController.java': BE_LOGIN,
    },
  });
  const r = await audit(ctx);
  const [x] = of(r, 'call-unserved');
  assert.equal(x.severity, 'error');
  assert.equal(x.subject, 'GET /api/profile');
  assert.deepEqual(r.summary.closure.unserved, ['GET /api/profile']);
});

test('闭合：同一个洞只出一条诊断——声明了没实现，就不再从调用侧重报一次', async (t) => {
  const { ctx } = await fixture(t, {
    claims: [
      { id: 'c-login-post', impl: ['POST /api/login'] },
      { id: 'c-profile', impl: ['GET /api/profile'] },
    ],
    evidence: [
      { subject: 'c-login-post', strength: 'derived' },
      { subject: 'c-profile', strength: 'derived' },
    ],
    files: {
      'apps/web/src/login.js': `${FE_LOGIN}export const profile = () => request.get('/profile');\n`,
      'apps/api/LoginController.java': BE_LOGIN,
    },
  });
  const r = await audit(ctx);
  assert.equal(of(r, 'endpoint-unimplemented').length, 1);
  assert.equal(of(r, 'call-unserved').length, 0);
  assert.deepEqual(r.summary.closure.unserved, ['GET /api/profile'], '计数里仍如实记着');
});

test('看不见就要说看不见：没有代码目录时闭合报 unchecked，而不是静默全绿', async (t) => {
  const { root } = await fixture(t, {
    claims: [{ id: 'c-x' }],
    evidence: [{ subject: 'c-x', strength: 'derived' }],
  });
  const r = await audit({ root, config: { apps: [] } });
  const x = of(r, 'closure-unchecked').find((y) => y.subject === '(closure)');
  assert.ok(x, '必须明说这一侧没检查');
  assert.equal(r.summary.closure.scanned, false);
  assert.equal(r.summary.ok, true, 'warn 不挡交付，但它在报告里');
});

test('看不见就要说看不见：命题没声明端点 / 扫不到路由 / 扫不到调用，三侧各出一条', async (t) => {
  const { ctx } = await fixture(t, {
    claims: [{ id: 'c-x' }],
    evidence: [{ subject: 'c-x', strength: 'derived' }],
    files: { 'apps/web/src/a.js': '// @vima c-x\nexport const x = 1;\n' },
  });
  const r = await audit(ctx);
  const subjects = of(r, 'closure-unchecked').map((x) => x.subject).sort();
  assert.deepEqual(subjects, ['(backend)', '(contract)', '(frontend)']);
});

test('审计报告如实带上提取能力边界与日志健康度', async (t) => {
  const { root, ctx } = await fixture(t, { claims: [{ id: 'c-x' }] });
  await writeFile(path.join(root, '.vima', 'events.jsonl'), '{ 这行是坏的\n', { flag: 'a' });
  const r = await audit(ctx);

  // 原样透传 extract 的自陈，不复制一份到 audit 里——复制出来的那份迟早和真的不一致，
  // 而报告上「看不见什么」写错比不写更糟。
  assert.equal(r.summary.extract, CAPABILITY);
  assert.ok(r.summary.extract.blind.length > 0, '看不见的东西必须有清单');
  assert.equal(r.summary.extract.granularity, 'file');
  assert.equal(r.summary.log.corrupt, 1, '坏行数如实报，不当作没发生');
  assert.deepEqual(r.summary.scan.dirs, ['apps/web', 'apps/api']);
});

test('findings 顺序确定：同一输入两次跑出同一份报告', async (t) => {
  const { ctx } = await fixture(t, {
    claims: [{ id: 'c-b' }, { id: 'c-a' }, { id: 'c-c', need: 'executed' }],
    evidence: [{ subject: 'c-c', strength: 'claimed' }, { subject: 'c-ghost', strength: 'derived' }],
  });
  const a = await audit(ctx);
  const b = await audit(ctx);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.deepEqual(a.findings.map((x) => `${x.kind}:${x.subject}`), [
    'closure-unchecked:(closure)',
    'orphan-evidence:c-ghost',
    'uncovered:c-a',
    'uncovered:c-b',
    'weak:c-c',
  ]);
});

// 失效清单是 R3「改完了没」的判据，audit 把它单独摆在 summary.stale 而不是
// 只埋进 findings 里数——「清单清空才算改完」要能一眼看到清单本身。
test('失效：上游改过之后下游进失效清单，且盖过 uncovered/weak 只出一条主诊断', async (t) => {
  const { root, ctx } = await fixture(t, {
    claims: [
      { id: 's-up', layer: 'spec', statement: '原始规格' },
      { id: 'c-down', layer: 'contract', from: ['s-up'] },
    ],
    evidence: [{ subject: 'c-down', strength: 'derived' }],
  });
  await append(root, {
    kind: 'claim', actor: 'human', subject: 's-up',
    payload: { layer: 'spec', statement: '规格改了', trust: 'stated' },
  }, { now: new Date('2026-08-17T00:00:00.000Z') });

  const r = await audit(ctx);
  assert.deepEqual(r.summary.stale, ['c-down']);
  assert.equal(of(r, 'stale')[0].severity, 'error');
  assert.equal(of(r, 'weak').length, 0);
  assert.equal(r.summary.ok, false, '失效清单没清空就不算改完');
});

// ── 死规则 ──────────────────────────────────────────────────────────────
//
// deadRules 早就实现了，却没有任何命令能问到它——vima-harvest 的「反向清单」
// 规程因此写了拿不到数据。项目硬约束里「立项即做透」点名的就是这种：
// 块定义了没人消费。这几条测的是那个出口。

test('死规则由调用方注入，audit 只负责变成 finding，消息里带出为什么死', async (t) => {
  const { ctx } = await fixture(t);
  const r = await audit({
    ...ctx,
    deadRules: [{ id: 'wechat-only', applies: { layer: null, side: ['wechat'], app: null, block: null }, origin: 'builtin' }],
    ruleCount: 9,
  });
  const dead = of(r, 'dead-rule');
  assert.equal(dead.length, 1);
  assert.equal(dead[0].severity, 'warn', '死规则不挡交付，但必须被看见');
  assert.match(dead[0].message, /side=wechat/, '不写清限定维度，人得自己翻规则文件才知道为什么死');
  assert.deepEqual(r.summary.rules, { total: 9, dead: ['wechat-only'] });
});

test('没注入规则 → summary.rules 为 null（「没查」≠「查了 0 条」）', async (t) => {
  const { ctx } = await fixture(t);
  const r = await audit(ctx);
  assert.equal(r.summary.rules, null, '与 closure-unchecked 同一价值观：没看就说没看');
  assert.equal(of(r, 'dead-rule').length, 0);
});

test('闭合事实不按 @vima 标注门控——未标注文件里的路由与调用同样是事实', async (t) => {
  // 曾经 scanTree 对无标注文件直接 continue，两个方向都错：
  //   假红  路由实现在未标注文件里 → endpoint-unimplemented（error 挡交付）
  //   假绿  未标注文件里的真实调用永远不进对账
  // 而报告还写着「扫描 N 个文件」——读的人以为 N 个都判过了。
  // 标注门控只对**归属**成立（标注连命题），对**闭合**不成立：
  // 一个真实的 request.get 不因为文件没写 @vima 就不存在。
  const { ctx } = await fixture(t, {
    claims: [{ id: 'c-beta', layer: 'contract', need: 'derived',
      impl: ['GET /api/beta'], statement: '读 beta' }],
    evidence: [{ subject: 'c-beta', strength: 'derived' }],
    files: {
      // 路由实现在**未标注**的文件里——契约命题不该因此报 unimplemented
      'apps/api/Beta.java': [
        '@RestController',
        '@RequestMapping("/beta")',
        'class Beta { @GetMapping void get() {} }',
      ].join('\n'),
      // 未标注文件里的真实调用——它读的端点没人提供，必须被看见
      'apps/web/src/unmarked.ts': "request.get('/gamma')",
    },
  });
  const r = await audit(ctx);
  assert.equal(of(r, 'endpoint-unimplemented').length, 0,
    '路由真实存在，只是文件没标注——报 unimplemented 是假红');
  const unserved = of(r, 'call-unserved');
  assert.ok(unserved.some((x) => x.subject.includes('/api/gamma')),
    '未标注文件里的调用不进对账 = 假绿，这正是要治的静默跳过');
});
