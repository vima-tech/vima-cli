// C5 单测：A41 追溯图（lib/model/traceability.mjs）与 `vima web` 本地只读视图。
// 重点断言三件事：①端点反查真的能从代码里找到实现与调用（含嵌套泛型这种主流写法）；
// ②小程序三件套参与追溯；③web 只读、只绑回环、路径穿越被拒。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTraceability } from '../../lib/model/traceability.mjs';
import { scanFeCalls } from '../../lib/commands/validate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(HERE, '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');

const CONTRACT = `# 演示契约

## GET /api/demo/items

- 请求参数：无
- 响应：\`ApiResponse<Item[]>\`
- 错误码：40001 参数校验失败

## DELETE /api/demo/items/{id}

- 请求参数：\`id: number\`
- 响应：\`ApiResponse<{ deleted: number }>\`
- 错误码：40401 资源不存在

\`\`\`yaml vima:contract
module: demo
apis:
  - method: GET
    path: /api/demo/items
    consumers: [admin]
    request: []
    response:
      - { name: id, type: number, desc: 主键 }
    errors:
      - { code: 40001, msg: 参数校验失败 }
  - method: DELETE
    path: /api/demo/items/{id}
    consumers: [admin]
    request:
      - { name: id, type: number, required: true }
    response:
      - { name: deleted, type: number, desc: 删除条数 }
    errors:
      - { code: 40401, msg: 资源不存在 }
\`\`\`
`;

const TASK = `---
taskId: demo-fe
title: 演示页面
status: done
layer: business
side: frontend
dependsOn: []
retryCount: 0
contract: docs/contracts/demo-api.md
updatedAt: 2026-01-01T00:00:00Z
---

# 演示页面

## 验收清单

- [ ] 构建通过
`;

async function makeProject(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c5-trace-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.vima/reports'), { recursive: true });
  await mkdir(path.join(root, 'docs/contracts'), { recursive: true });
  await mkdir(path.join(root, 'docs/tasks'), { recursive: true });
  await mkdir(path.join(root, 'src/api'), { recursive: true });
  await mkdir(path.join(root, 'src/pages/demo'), { recursive: true });
  await writeFile(path.join(root, 'docs/contracts/demo-api.md'), CONTRACT);
  await writeFile(path.join(root, 'docs/tasks/demo-fe.md'), TASK);
  await writeFile(path.join(root, 'docs/lifecycle.json'), JSON.stringify({
    schemaVersion: '2.0', currentPhase: 'DEVELOPING', phaseHistory: [], checklists: {},
  }));
  return root;
}

test('A41 追溯图：嵌套泛型的 request 调用也能被识别（回归：曾漏 77% 调用点）', async (t) => {
  const root = await makeProject(t);
  await writeFile(path.join(root, 'src/api/demo.ts'),
    '// @vima demo-fe\n'
    + "import request from '@/utils/request'\n"
    + "export function listItems() { return request.get<unknown, ApiResponse<Item[]>>('/demo/items') }\n"
    // 内层还有一个 `>`——旧正则 `[^>(]*` 在此断裂，整条调用被静默跳过
    + "export function removeItem(id: number) { return request.delete<any, ApiResponse<{ deleted: number }>>(`/demo/items/${id}`) }\n");

  const g = await buildTraceability(root, { cliRoot: CLI_ROOT });
  const del = g.byEndpoint['DELETE /api/demo/items/{*}'];
  assert.ok(del, `端点应在图里：${Object.keys(g.byEndpoint).join(' | ')}`);
  assert.equal(del.calledBy.length, 1, '嵌套泛型的 delete 调用必须被识别');
  assert.ok(del.calledBy[0].taskIds.includes('demo-fe'), '调用点应归属到标注它的任务');
  assert.equal(g.byEndpoint['GET /api/demo/items'].calledBy.length, 1, '单层泛型调用同样识别');
  assert.equal(g.summary.endpointsUncalled, 0, '两个端点都有调用，无人调用数应为 0');
});

test('A41 追溯图：折成多行的 request 调用也能被识别（回归：曾误报 39 个端点无人调用）', async (t) => {
  const root = await makeProject(t);
  // 泛型一长，格式化器就把调用折成三行——方法名、泛型段、路径字面量各占一行。
  // 逐行扫描一条都匹配不上；validate/converge 按全文扫，追溯图曾按行扫，于是同一事实两个数字。
  await writeFile(path.join(root, 'src/api/demo.ts'),
    '// @vima demo-fe\n'
    + 'export function listItems() {\n'
    + '  return request.get<unknown, { code: number; msg: string; data: Item[] }>(\n'
    + "    '/demo/items'\n"
    + '  )\n'
    + '}\n'
    + 'export function removeItem(id: number) {\n'
    + '  return request.delete<unknown, { code: number; msg: string }>(\n'
    + '    `/demo/items/${id}`\n'
    + '  )\n'
    + '}\n');

  const g = await buildTraceability(root, { cliRoot: CLI_ROOT });
  assert.equal(g.summary.endpointsUncalled, 0, '两个端点都有跨行调用，无人调用数应为 0');
  const get = g.byEndpoint['GET /api/demo/items'];
  assert.equal(get.calledBy.length, 1, '跨行 get 调用必须被识别');
  assert.equal(get.calledBy[0].line, 3, '行号应落在 request.get 那一行，而非路径字面量所在行');
  assert.equal(g.byEndpoint['DELETE /api/demo/items/{*}'].calledBy.length, 1, '跨行 delete 调用同样识别');
});

test('A41 调用点扫描：文档注释里的反例不算调用（回归：教「别这么写」的示例被报 V-CODE-01）', async (t) => {
  const root = await makeProject(t);
  // 共享层 request.ts 的门面说明里就写着这样一对正反例——反例被当成真实调用报了 error，
  // 而它存在的唯一目的正是教人别那么写。
  await writeFile(path.join(root, 'src/api/demo.ts'),
    '// @vima demo-fe\n'
    + '/**\n'
    + " *   ✅ request.get('/demo/items')             路径写字面量，机检看得见\n"
    + " *   ❌ request.get(`/demo/${kind}/list`)      路径拼变量，机检读不出常量部分\n"
    + ' */\n'
    + "// request.post('/demo/legacy')  ← 注释掉的旧调用\n"
    + "export function listItems() { return request.get('/demo/items') }\n");

  const calls = scanFeCalls(await readFile(path.join(root, 'src/api/demo.ts'), 'utf8'));
  assert.deepEqual(calls.map((c) => c.path), ['/demo/items'],
    `只应认出真实调用，实际：${calls.map((c) => c.path).join(' | ')}`);

  const g = await buildTraceability(root, { cliRoot: CLI_ROOT });
  assert.equal(g.unknownCalls.length, 0, '注释里的反例不得进「契约外调用」清单');
  assert.equal(g.byEndpoint['GET /api/demo/items'].calledBy.length, 1);
});

test('A41 追溯图：小程序三件套参与追溯，并归属到正确的任务', async (t) => {
  const root = await makeProject(t);
  await writeFile(path.join(root, 'src/pages/demo/index.wxml'),
    '<!-- @vima demo-fe -->\n<view class="vm-page" data-page="PAGE-01"></view>\n');
  await writeFile(path.join(root, 'src/pages/demo/index.wxss'), '/* @vima demo-fe */\n.vm-page{}\n');

  const g = await buildTraceability(root, { cliRoot: CLI_ROOT });
  const files = g.byTask['demo-fe'].files;
  assert.ok(files.some((f) => f.endsWith('.wxml')), `wxml 应计入任务产物：${files.join(', ')}`);
  assert.ok(files.some((f) => f.endsWith('.wxss')), 'wxss 应计入任务产物');
  assert.equal(g.byTask['demo-fe'].status, 'done');
});

test('A41 追溯图：孤儿端点（契约有、代码无实现）被点名', async (t) => {
  const root = await makeProject(t);
  await writeFile(path.join(root, 'src/api/demo.ts'),
    "// @vima demo-fe\nexport function listItems() { return request.get('/demo/items') }\n");
  const g = await buildTraceability(root, { cliRoot: CLI_ROOT });
  // 没有任何后端 Controller → 两个端点都无实现
  assert.equal(g.summary.endpointsOrphan, 2);
  assert.ok(g.orphanEndpoints.includes('GET /api/demo/items'));
});

test('A41 追溯图：报告与轨迹并列呈现，字段名错的报告如实标为「字段缺失」', async (t) => {
  const root = await makeProject(t);
  await writeFile(path.join(root, 'src/api/demo.ts'), "// @vima demo-fe\nconst x = 1\n");
  // 故意写成 result:success（builder 的真实 schema 是 status:completed）——F3 那类错
  await writeFile(path.join(root, '.vima/reports/demo-fe-builder.json'),
    JSON.stringify({ taskId: 'demo-fe', result: 'success' }));
  const g = await buildTraceability(root, { cliRoot: CLI_ROOT });
  const rep = g.byTask['demo-fe'].reports.builder;
  assert.ok(rep, '报告文件存在就应被收录，哪怕字段名不合 schema');
  assert.equal(rep.status, null, 'status 缺失应如实为 null，供视图标「字段缺失」');
  assert.equal(g.summary.tasksWithBuilderReport, 1);
  assert.equal(g.summary.tasksWithJournal, 0, '报告存在但没有 journal 事件——正是采集断链的指纹');
});

/** 起一个 web 服务，回调里做断言，最后必定关掉。 */
async function withWeb(root, port, fn) {
  const child = spawn(process.execPath, [BIN, 'web', '--port', String(port)], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('web 启动超时')), 15000);
      child.stdout.on('data', (b) => {
        if (String(b).includes('已启动')) { clearTimeout(timer); resolve(); }
      });
      child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`web 提前退出 ${code}`)); });
    });
    await fn();
  } finally {
    child.kill('SIGTERM');
  }
}

test('vima web：四个页面可访问，只绑回环，路径穿越被拒', async (t) => {
  const root = await makeProject(t);
  await writeFile(path.join(root, 'src/api/demo.ts'), "// @vima demo-fe\nconst x = 1\n");
  const port = 5399;
  await withWeb(root, port, async () => {
    for (const p of ['/', '/trace', '/endpoints', '/artifacts']) {
      const r = await fetch(`http://127.0.0.1:${port}${p}`);
      assert.equal(r.status, 200, `${p} 应可访问`);
      const html = await r.text();
      assert.match(html, /vima web/, `${p} 应渲染出页面外壳`);
    }
    const api = await fetch(`http://127.0.0.1:${port}/api/trace`);
    assert.equal(api.status, 200);
    const g = await api.json();
    assert.equal(g.schemaVersion, '2');

    // 只读出口不得穿越到项目根之外
    const esc1 = await fetch(`http://127.0.0.1:${port}/file/../../etc/passwd`);
    assert.ok([403, 404].includes(esc1.status), `路径穿越必须被拒，实际 ${esc1.status}`);
  });
});
