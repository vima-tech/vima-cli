// Web 观测平台 —— 服务器契约：起停、只绑回环、各页可达、只读出口的穿越防护、空项目不崩。
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';

import { append } from '../../lib/core/events.mjs';
import { serve, resolveInRoot, HOST } from '../../lib/front/web.mjs';

async function emptyProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'vima-web-'));
  await mkdir(path.join(root, '.vima'), { recursive: true });
  return root;
}

async function seededProject() {
  const root = await emptyProject();
  const at = (s) => ({ now: new Date(`2026-08-16T0${s}:00:00.000Z`) });
  await append(root, {
    kind: 'claim', actor: 'compile', subject: 'c-login',
    payload: { layer: 'spec', statement: '登录接口返回 token', trust: 'fact', need: 'derived', source: 'docs/auth.md#L3' },
  }, at(1));
  await append(root, {
    kind: 'evidence', actor: 'attest', subject: 'c-login',
    payload: { strength: 'derived', by: 'extract:route', detail: 'AuthController.java:22' },
  }, at(2));
  await append(root, {
    kind: 'ruling', actor: 'ai', subject: 'c-login',
    payload: { question: '登录失败锁定几次', chosen: '5 次', options: ['3 次', '5 次'], confidence: 'low', blastRadius: 9 },
  }, at(3));
  await append(root, {
    kind: 'run', actor: 'agent-a', subject: 'c-login',
    payload: { op: 'compile' }, cost: { tokens: 1200, ms: 800 },
  }, at(4));
  await writeFile(path.join(root, 'readme-fixture.txt'), 'alpha\nbeta\ngamma\n', 'utf8');
  return root;
}

/** 原始请求：不能用 fetch —— WHATWG URL 会在客户端把 `..` 规范化掉，穿越就测不到了。 */
function rawGet(port, rawPath, { method = 'GET', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: HOST, port, path: rawPath, method, headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('resolveInRoot 拒绝一切越界形态，放行根内相对路径', () => {
  const root = path.resolve('/tmp/vima-guard');
  assert.equal(resolveInRoot(root, '../../etc/passwd'), null);
  assert.equal(resolveInRoot(root, '..%2f..%2fetc%2fpasswd'), null);
  assert.equal(resolveInRoot(root, '%2e%2e%2f%2e%2e%2fetc%2fpasswd'), null);
  assert.equal(resolveInRoot(root, '/etc/passwd'), null);
  assert.equal(resolveInRoot(root, 'C:\\Windows\\win.ini'), null);
  assert.equal(resolveInRoot(root, '..\\..\\etc\\passwd'), null);
  assert.equal(resolveInRoot(root, 'a/%00b'), null);
  assert.equal(resolveInRoot(root, '%zz'), null);
  assert.equal(resolveInRoot(root, ''), null);
  assert.equal(resolveInRoot(root, 'docs/a.md'), path.join(root, 'docs/a.md'));
  assert.equal(resolveInRoot(root, 'docs/../docs/a.md'), path.join(root, 'docs/a.md'));
});

test('起服务 → 只绑回环 → 各页可访问 → 关服务', async () => {
  const root = await seededProject();
  const ui = await serve({ root });
  try {
    const addr = ui.server.address();
    assert.equal(addr.address, '127.0.0.1', '只能绑回环');
    assert.equal(ui.host, HOST);
    assert.match(ui.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);

    for (const p of ['/', '/claims', '/rulings', '/timeline', '/cost', '/claim/c-login', '/timeline?at=2']) {
      const r = await rawGet(ui.port, p);
      assert.equal(r.status, 200, `${p} 应可访问`);
      assert.match(r.headers['content-type'], /text\/html/);
      assert.match(r.body, /^<!doctype html>/);
      assert.match(r.body, /vima/);
      assert.doesNotMatch(r.body, /undefined<|>undefined/, `${p} 不应把 undefined 渲染出来`);
    }
  } finally {
    await ui.close();
    await rm(root, { recursive: true, force: true });
  }
  // 关掉之后端口不再接受连接
  await assert.rejects(() => rawGet(ui.port, '/'), /ECONNREFUSED|ECONNRESET/);
});

test('空项目（零事件）不崩，且如实显示为空', async () => {
  const root = await emptyProject();
  const ui = await serve({ root });
  try {
    const home = await rawGet(ui.port, '/');
    assert.equal(home.status, 200);
    assert.match(home.body, /零事件/);
    // 空 ≠ 绿：不能出现「达标」类的正向结论
    assert.doesNotMatch(home.body, /全部命题均达到/);

    for (const p of ['/claims', '/rulings', '/timeline', '/cost']) {
      const r = await rawGet(ui.port, p);
      assert.equal(r.status, 200, `${p} 空项目下也要能打开`);
      assert.match(r.body, /暂无|没有|还没有|零事件/, `${p} 要如实说空`);
    }
    // 不存在的命题 → 404，而不是渲染一个空壳假装有
    const missing = await rawGet(ui.port, '/claim/nope');
    assert.equal(missing.status, 404);
  } finally {
    await ui.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('/file/* 只读出口：根内可读，越界一律拒绝', async () => {
  const root = await seededProject();
  await symlink('/etc/passwd', path.join(root, 'escape-link')).catch(() => {});
  const ui = await serve({ root });
  try {
    const ok = await rawGet(ui.port, '/file/readme-fixture.txt');
    assert.equal(ok.status, 200);
    assert.match(ok.body, /beta/);

    const raw = await rawGet(ui.port, '/file/readme-fixture.txt?raw=1');
    assert.equal(raw.status, 200);
    assert.match(raw.headers['content-type'], /text\/plain/);
    assert.equal(raw.body, 'alpha\nbeta\ngamma\n');

    const traversals = [
      '/file/../../etc/passwd',
      '/file/..%2f..%2fetc%2fpasswd',
      '/file/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '/file//etc/passwd',
      '/file/....//....//etc/passwd',
      '/file/subdir/../../../etc/passwd',
      '/file/escape-link',
      '/file/',
      '/file',
    ];
    for (const p of traversals) {
      const r = await rawGet(ui.port, p);
      assert.ok(r.status === 403 || r.status === 404, `${p} 必须被拒（实得 ${r.status}）`);
      assert.doesNotMatch(r.body, /root:x:/, `${p} 绝不能吐出根外内容`);
    }

    // 目录不是文件出口
    const dir = await rawGet(ui.port, '/file/.vima');
    assert.equal(dir.status, 404);
  } finally {
    await ui.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('只读：非 GET 一律 405；外部 Host 一律 403（防 DNS rebinding 借道 /file/*）', async () => {
  const root = await seededProject();
  const ui = await serve({ root });
  try {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const r = await rawGet(ui.port, '/', { method });
      assert.equal(r.status, 405, `${method} 应被拒——观测平台没有写入口`);
    }
    const rebind = await rawGet(ui.port, '/file/readme-fixture.txt', { headers: { host: 'evil.example.com' } });
    assert.equal(rebind.status, 403);
  } finally {
    await ui.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('未知路由 404，且响应头钉死只读/自包含姿态', async () => {
  const root = await seededProject();
  const ui = await serve({ root });
  try {
    const r = await rawGet(ui.port, '/nope');
    assert.equal(r.status, 404);
    const home = await rawGet(ui.port, '/');
    assert.equal(home.headers['x-content-type-options'], 'nosniff');
    assert.match(home.headers['content-security-policy'], /default-src 'none'/);
    // 页面自包含：不引任何外链
    assert.doesNotMatch(home.body, /https?:\/\/(?!127\.0\.0\.1)[a-z]/i);
  } finally {
    await ui.close();
    await rm(root, { recursive: true, force: true });
  }
});
