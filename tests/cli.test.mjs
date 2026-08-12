// CLI 路由与帮助测试（契约 §3 顶层路由 / §3.1 错误码登记表 / §13）
// 覆盖：help 家族、子命令 --help、未知命令、无参数、version、parseArgs 中文翻译、
//       USAGE 提示行、DEBUG 堆栈门控、A5 模板成熟度标注防漂移、空目录错误码矩阵。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runCli, CLI_ROOT } from './helpers.mjs';

const ALL_COMMANDS = [
  'create', 'init', 'upgrade', 'doctor', 'validate', 'render-review',
  'render-prototype', 'sync', 'plan', 'approve', 'context', 'trace',
];

async function emptyDir(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-cli-route-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('help / --help / -h：全部命令列出，stdout exit 0', () => {
  for (const args of [['help'], ['--help'], ['-h']]) {
    const r = runCli(args);
    assert.equal(r.status, 0, args.join(' '));
    assert.equal(r.stderr, '');
    for (const name of [...ALL_COMMANDS, 'version', 'help']) {
      assert.ok(new RegExp(`^  ${name} `, 'm').test(r.stdout), `help 缺少命令行：${name}`);
    }
  }
});

test('help 命令表与 lib/commands/ 目录一一对应（防新增命令漏接线 cli.mjs COMMANDS）', async () => {
  const files = (await readdir(path.join(CLI_ROOT, 'lib', 'commands')))
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => f.replace(/\.mjs$/, ''))
    .sort();
  const listed = runCli(['help'])
    .stdout.split('\n')
    .filter((l) => /^ {2}[a-z][a-z-]* {2,}/.test(l))
    .map((l) => l.trim().split(/\s+/)[0])
    .filter((n) => n !== 'version' && n !== 'help')
    .sort();
  assert.deepEqual(listed, files, '新增/删除命令后须同步 lib/cli.mjs 的 COMMANDS 表与本文件 ALL_COMMANDS');
});

test('help 的模板成熟度标注与 template.json status 一致（A5 防漂移）', async () => {
  const ids = (await readdir(path.join(CLI_ROOT, 'templates'))).sort();
  const stable = [];
  for (const id of ids) {
    const tpl = JSON.parse(await readFile(path.join(CLI_ROOT, 'templates', id, 'template.json'), 'utf8'));
    if (tpl.status === 'stable') stable.push(id);
  }
  // 若此断言失败：模板成熟度变了，须同步 lib/cli.mjs 中 create 的 desc 与选项文案
  assert.deepEqual(stable, ['admin'], '当前唯一 stable 模板应为 admin');
  const createLine = runCli(['help']).stdout.split('\n').find((l) => l.trimStart().startsWith('create'));
  for (const id of ids) assert.ok(createLine.includes(id), `create 行缺模板 ${id}`);
  assert.ok(createLine.includes('admin 之外均为 preview'), 'create 行须标注成熟度分级');
});

test('每个子命令都支持 --help，且与 vima help <cmd> 字节一致（stdout exit 0）', () => {
  for (const name of ALL_COMMANDS) {
    const viaFlag = runCli([name, '--help']);
    const viaTopic = runCli(['help', name]);
    assert.equal(viaFlag.status, 0, `${name} --help 应 exit 0`);
    assert.equal(viaTopic.status, 0, `help ${name} 应 exit 0`);
    assert.equal(viaFlag.stdout, viaTopic.stdout, `${name}: 两种入口的帮助应一致`);
    assert.match(viaFlag.stdout, new RegExp(`^用法: vima ${name}`), `${name}: 帮助须以用法行开头`);
    assert.match(viaFlag.stdout, /示例:/, `${name}: 帮助须含示例`);
  }
});

test('`--` 分隔符之后的 --help 不再拦截（按位置参数交给命令自身处理）', () => {
  const r = runCli(['create', '--', '--help']);
  assert.equal(r.status, 3); // "--help" 成为非法项目名/多余参数 → usage 错误
  assert.ok(!r.stdout.includes('用法: vima create'), '不应输出帮助');
});

test('help 未知 topic → stderr 一行错误 + 提示，exit 3', () => {
  const r = runCli(['help', 'nosuchcmd']);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /^vima help: USAGE: 未知命令 "nosuchcmd"/);
  assert.match(r.stderr, /提示: 运行 vima help 查看全部命令/);
});

test('无参数：完整用法进 stderr，exit 3（契约 §3）', () => {
  const r = runCli([]);
  assert.equal(r.status, 3);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /^用法: vima <command>/);
});

test('未知命令：一行错误 + 提示，不倾倒全量帮助，exit 3', () => {
  const r = runCli(['nosuchcmd']);
  assert.equal(r.status, 3);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /^vima nosuchcmd: USAGE: 未知命令 "nosuchcmd"/);
  assert.match(r.stderr, /提示: 运行 vima help 查看全部命令/);
  assert.ok(!r.stderr.includes('命令:'), '未知命令不应输出全量命令表');
});

test('version / --version / -v：裸版本号 = package.json version，exit 0', async () => {
  const pkg = JSON.parse(await readFile(path.join(CLI_ROOT, 'package.json'), 'utf8'));
  for (const args of [['version'], ['--version'], ['-v']]) {
    const r = runCli(args);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, `${pkg.version}\n`);
    assert.equal(r.stderr, '');
  }
});

test('parseArgs 中文翻译：未知选项 / 缺少取值 / 多余位置参数，均带 --help 提示行', () => {
  const unknown = runCli(['create', '--bogus', 'x']);
  assert.equal(unknown.status, 3);
  assert.match(unknown.stderr, /^vima create: USAGE: 未知选项 "--bogus"/);
  assert.match(unknown.stderr, /提示: 运行 vima create --help 查看用法/);
  assert.ok(!/Unknown option/.test(unknown.stderr), '不应透传英文原始报错');

  const missing = runCli(['create', 'x', '--template']);
  assert.equal(missing.status, 3);
  assert.match(missing.stderr, /缺少取值/);

  const positional = runCli(['validate', 'extra']); // validate 不收位置参数
  assert.equal(positional.status, 3);
  assert.match(positional.stderr, /多余的位置参数 "extra"/);
});

test('错误码矩阵（契约 §3.1）：空目录前置错误以稳定 code 输出到 stderr', async (t) => {
  const dir = await emptyDir(t);
  const cases = [
    [['plan'], 4, 'NO_TASKS'],
    [['sync'], 4, 'NO_LIFECYCLE'],
    [['upgrade'], 4, 'NO_MANIFEST'],
    [['render-review'], 4, 'NO_SPEC'],
    [['init', '--template', 'nosuch'], 3, 'NO_TEMPLATE'],
  ];
  for (const [args, exit, code] of cases) {
    const r = runCli(args, { cwd: dir });
    assert.equal(r.status, exit, `${args.join(' ')} 应 exit ${exit}，stderr: ${r.stderr}`);
    assert.match(r.stderr, new RegExp(`^vima ${args[0]}: ${code}: `), `${args.join(' ')} 应输出稳定 code ${code}`);
  }
});

test('DEBUG 堆栈门控（契约 §14）：默认无堆栈，DEBUG=vima 时附带', async (t) => {
  const dir = await emptyDir(t);
  const off = runCli(['plan'], { cwd: dir });
  assert.equal(off.status, 4);
  assert.ok(!/\n\s+at /.test(off.stderr), '默认不应输出堆栈');
  const on = runCli(['plan'], { cwd: dir, env: { DEBUG: 'vima' } });
  assert.equal(on.status, 4);
  assert.match(on.stderr, /\n\s+at /, 'DEBUG=vima 应附堆栈');
});
