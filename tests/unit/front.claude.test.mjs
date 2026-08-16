// Claude Code 派生投影：.claude/rules/ 与 .mcp.json
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rulePaths, mcpConfig, syncRules, syncMcp, sync } from '../../lib/front/claude.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASSETS = path.join(REPO, 'assets');

async function tmpRoot(t, rules = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima4-cc-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.vima', 'rules'), { recursive: true });
  for (const [name, body] of Object.entries(rules)) {
    await writeFile(path.join(root, '.vima', 'rules', name), body);
  }
  return root;
}

const RULE = (fm, body = '正文。') => `---\n${fm}\n---\n\n${body}\n`;

// ── paths 推导 ──────────────────────────────────────────────────────────

test('只有 layer/block 的规则不写 paths —— 与文件无关的约束必须每次都在场', () => {
  assert.equal(rulePaths({ layer: ['impl'], side: null, app: null, block: null }, [{ id: 'a', kind: 'admin' }]), null);
  assert.equal(rulePaths({ layer: null, side: null, app: null, block: ['auth/login'] }, []), null);
});

test('app 限定 → apps/<id>/**/*', () => {
  const apps = [{ id: 'console', kind: 'admin' }, { id: 'mini', kind: 'wechat' }];
  assert.deepEqual(rulePaths({ app: ['console'], side: null, layer: null, block: null }, apps),
    ['apps/console/**/*']);
});

test('side 限定 → 展开成该 kind 的所有端（app.kind 就是 side，同 next() 口径）', () => {
  const apps = [{ id: 'console', kind: 'admin' }, { id: 'ops', kind: 'admin' }, { id: 'mini', kind: 'wechat' }];
  assert.deepEqual(rulePaths({ side: ['admin'], app: null, layer: null, block: null }, apps),
    ['apps/console/**/*', 'apps/ops/**/*']);
});

test('app 与 side 同时给 → 取交集，不是并集', () => {
  const apps = [{ id: 'console', kind: 'admin' }, { id: 'mini', kind: 'wechat' }];
  assert.deepEqual(rulePaths({ app: ['console', 'mini'], side: ['wechat'], layer: null, block: null }, apps),
    ['apps/mini/**/*']);
});

test('限定了端但一个都不匹配 → 返回空数组（调用方必须跳过，不能当无条件）', () => {
  assert.deepEqual(rulePaths({ side: ['wechat'], app: null, layer: null, block: null }, [{ id: 'a', kind: 'admin' }]), []);
});

// ── 投影 ────────────────────────────────────────────────────────────────

test('端限定规则在没有匹配端时被跳过——绝不能投影成无条件加载', async (t) => {
  // 这是本模块最危险的一处。若把空 glob 写成「没有 paths」，
  // 一条「只在小程序生效」的规则会变成「处处生效」——正是 assets/rules.mjs
  // 花大篇幅警告的静默扩面，而且它不会报错，只会让规则集慢慢变成噪音。
  const root = await tmpRoot(t, {
    'wx-only.md': RULE('side: wechat', '只在小程序成立的约束。'),
  });
  const r = await syncRules(root, { assetsRoot: ASSETS, config: { apps: [{ id: 'console', kind: 'admin' }] } });
  const files = await readdir(path.join(root, '.claude', 'rules'));
  assert.ok(!files.includes('vima-wx-only.md'), '不匹配的端限定规则不该落盘');
  const skipped = r.skipped.find((s) => s.id === 'wx-only');
  assert.ok(skipped, '跳过必须被报出来，不能静默');
  assert.equal(skipped.reason, 'no-match', '项目登记了端却对不上 → 真信号');
});

test('「还没登记端」与「登记了对不上」分成两种 reason', async (t) => {
  const root = await tmpRoot(t, { 'wx-only.md': RULE('side: wechat') });
  const r = await syncRules(root, { assetsRoot: ASSETS, config: { apps: [] } });
  assert.equal(r.skipped.find((s) => s.id === 'wx-only').reason, 'no-apps');
});

test('投影带 paths 前置头，且注明真源与勿手改', async (t) => {
  const root = await tmpRoot(t, { 'admin-tables.md': RULE('side: admin', '表格必须有空态。') });
  await syncRules(root, { assetsRoot: ASSETS, config: { apps: [{ id: 'console', kind: 'admin' }] } });
  const text = await readFile(path.join(root, '.claude', 'rules', 'vima-admin-tables.md'), 'utf8');
  assert.match(text, /^---\npaths:\n {2}- "apps\/console\/\*\*\/\*"\n---/, `前置头不对：\n${text}`);
  assert.match(text, /请勿手改/);
  assert.match(text, /\.vima\/rules\/admin-tables\.md/, '要指回真源');
  assert.match(text, /表格必须有空态。/, '正文必须原样带上');
});

test('幂等：同样的输入第二次跑不写任何文件', async (t) => {
  const root = await tmpRoot(t, { 'x.md': RULE('layer: impl') });
  const cfg = { assetsRoot: ASSETS, config: { apps: [] } };
  await syncRules(root, cfg);
  const again = await syncRules(root, cfg);
  assert.deepEqual(again.written, [], '内容没变就不该重写——否则每次 sync 都制造无谓 diff');
  assert.deepEqual(again.removed, []);
});

test('真源删了，投影跟着删；但人手写进 .claude/rules/ 的一律不碰', async (t) => {
  const root = await tmpRoot(t, { 'gone.md': RULE('layer: impl') });
  const cfg = { assetsRoot: ASSETS, config: { apps: [] } };
  await syncRules(root, cfg);
  await writeFile(path.join(root, '.claude', 'rules', 'my-own.md'), '# 人手写的\n');
  await rm(path.join(root, '.vima', 'rules', 'gone.md'));

  const r = await syncRules(root, cfg);
  assert.ok(r.removed.includes('vima-gone.md'), '真源没了，投影要跟着没');
  const files = await readdir(path.join(root, '.claude', 'rules'));
  assert.ok(files.includes('my-own.md'), '人手写的文件不归投影管——删了人就会把这机制关掉');
});

test('check 模式不写盘，只回答「本该怎么改」', async (t) => {
  const root = await tmpRoot(t, { 'x.md': RULE('layer: impl') });
  const cfg = { assetsRoot: ASSETS, config: { apps: [] } };
  const r = await syncRules(root, { ...cfg, check: true });
  assert.ok(r.written.includes('vima-x.md'));
  await assert.rejects(() => readdir(path.join(root, '.claude', 'rules')), /ENOENT/, 'check 不该建目录');
});

// ── .mcp.json ───────────────────────────────────────────────────────────

test('.mcp.json 是 stdio 形态，且 args 用绝对路径', async (t) => {
  const root = await tmpRoot(t);
  const bin = '/opt/vima/bin/vima.mjs';
  await syncMcp(root, { binPath: bin });
  const cfg = JSON.parse(await readFile(path.join(root, '.mcp.json'), 'utf8'));
  assert.deepEqual(cfg, mcpConfig({ binPath: bin }));
  assert.equal(cfg.mcpServers.vima.command, 'node');
  // 官方文档：.mcp.json 里裸 ${CLAUDE_PROJECT_DIR} 需要默认值才展开。
  // 写绝对路径直接绕开这个坑——踩上去的表现是 MCP 静默起不来。
  assert.ok(!JSON.stringify(cfg).includes('${'), '不该出现未展开的变量');
});

test('sync 汇总两侧的漂移数', async (t) => {
  const root = await tmpRoot(t, { 'x.md': RULE('layer: impl') });
  const opts = { assetsRoot: ASSETS, config: { apps: [] }, binPath: '/opt/vima/bin/vima.mjs' };
  const first = await sync(root, opts);
  assert.ok(first.drifted > 0, '首次必然全是新文件');
  const second = await sync(root, opts);
  assert.equal(second.drifted, 0, '幂等：第二次应当零漂移');
});
