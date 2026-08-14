// CLI 路由与帮助测试（契约 §3 顶层路由 / §3.1 错误码登记表 / §13）
// 覆盖：help 家族、子命令 --help、未知命令、无参数、version、parseArgs 中文翻译、
//       USAGE 提示行、DEBUG 堆栈门控、A5 模板成熟度标注防漂移、空目录错误码矩阵。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, rm, readFile, readdir, mkdir, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runCli, CLI_ROOT } from './helpers.mjs';

const ALL_COMMANDS = [
  'create', 'init', 'update', 'upgrade', 'doctor', 'validate', 'render-review',
  'render-prototype', 'render-matrix', 'sync', 'plan', 'approve', 'context', 'trace',
];

async function emptyDir(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'vima-cli-route-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

/**
 * A24：带项目标记的临时目录。项目内命令现在会向上定位项目根，找不到就 NOT_IN_PROJECT——
 * 要测「命令自身的前置错误码」必须先让它认得出这是个项目，否则测到的是顶层守卫。
 */
async function projectDir(t) {
  const dir = await emptyDir(t);
  // 标记用空的 .vima/ 而非 docs/lifecycle.json——后者会顺带满足 sync 的前置，
  // 让「各命令自身的前置错误码」测不出来。空目录足以让 findProjectRoot 认出这是项目。
  await mkdir(path.join(dir, '.vima'), { recursive: true });
  return dir;
}

async function mjsFilesUnder(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await mjsFilesUnder(target));
    else if (entry.name.endsWith('.mjs')) files.push(target);
  }
  return files;
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

test('parseArgs 中文翻译：未知选项 / 缺少取值 / 多余位置参数，均带 --help 提示行', async (t) => {
  const unknown = runCli(['create', '--bogus', 'x']);
  assert.equal(unknown.status, 3);
  assert.match(unknown.stderr, /^vima create: USAGE: 未知选项 "--bogus"/);
  assert.match(unknown.stderr, /提示: 运行 vima create --help 查看用法/);
  assert.ok(!/Unknown option/.test(unknown.stderr), '不应透传英文原始报错');

  const missing = runCli(['create', 'x', '--template']);
  assert.equal(missing.status, 3);
  assert.match(missing.stderr, /缺少取值/);

  // validate 是项目内命令：A24 后必须在项目里跑，否则先撞顶层 NOT_IN_PROJECT 守卫
  const dir = await projectDir(t);
  const positional = runCli(['validate', 'extra'], { cwd: dir }); // validate 不收位置参数
  assert.equal(positional.status, 3);
  assert.match(positional.stderr, /多余的位置参数 "extra"/);
});

test('错误码矩阵（契约 §3.1）：项目内的前置错误以稳定 code 输出到 stderr', async (t) => {
  const dir = await projectDir(t);
  const cases = [
    [['plan'], 4, 'NO_TASKS'],
    [['sync'], 4, 'NO_LIFECYCLE'],
    [['update'], 4, 'NO_MANIFEST'],
    [['render-review'], 4, 'NO_SPEC'],
    [['init', '--template', 'nosuch'], 3, 'NO_TEMPLATE'],
  ];
  for (const [args, exit, code] of cases) {
    const r = runCli(args, { cwd: dir });
    assert.equal(r.status, exit, `${args.join(' ')} 应 exit ${exit}，stderr: ${r.stderr}`);
    assert.match(r.stderr, new RegExp(`^vima ${args[0]}: ${code}: `), `${args.join(' ')} 应输出稳定 code ${code}`);
  }
});

test('契约 §3.1 覆盖 lib/ 中全部稳定错误 code（新增 code 不得漏登记）', async () => {
  const contract = await readFile(path.join(CLI_ROOT, 'docs', 'internal-contracts.md'), 'utf8');
  const section = contract.match(/### 3\.1[\s\S]*?(?=\n## 4\.)/)?.[0];
  assert.ok(section, 'internal-contracts.md 缺 §3.1');

  const rows = [...section.matchAll(/^\| ([A-Z][A-Z0-9_]+) \|/gm)].map((m) => m[1]);
  const registered = new Set(rows);
  assert.equal(registered.size, rows.length, '§3.1 不得重复登记 code');

  const actual = new Set(['USAGE']); // usageError / usageFromParseArgs 工厂的固定 code
  for (const file of await mjsFilesUnder(path.join(CLI_ROOT, 'lib'))) {
    const source = await readFile(file, 'utf8');
    const calls = source.matchAll(
      /(?:new\s+VimaError|precondition|checkFailed)\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,
    );
    for (const match of calls) actual.add(match[1]);
    for (const match of source.matchAll(/vima [^:\n]+: ([A-Z][A-Z0-9_]+):/g)) actual.add(match[1]);
  }

  const missing = [...actual].filter((code) => !registered.has(code)).sort();
  assert.deepEqual(missing, [], `以下稳定 code 未登记于 §3.1：${missing.join(', ')}`);
});

test('DEBUG 堆栈门控（契约 §14）：默认无堆栈，DEBUG=vima 时附带', async (t) => {
  const dir = await projectDir(t);
  const off = runCli(['plan'], { cwd: dir });
  assert.equal(off.status, 4);
  assert.ok(!/\n\s+at /.test(off.stderr), '默认不应输出堆栈');
  const on = runCli(['plan'], { cwd: dir, env: { DEBUG: 'vima' } });
  assert.equal(on.status, 4);
  assert.match(on.stderr, /\n\s+at /, 'DEBUG=vima 应附堆栈');
});

// ── A24 项目根感知（顶层守卫）──

test('A24：项目内命令在子目录运行 → 定位项目根，结果与在根一致且不产生游离报告', async (t) => {
  const dir = await projectDir(t);
  await mkdir(path.join(dir, 'backend', 'src'), { recursive: true });
  await mkdir(path.join(dir, 'docs'), { recursive: true });
  await writeFile(path.join(dir, 'docs', 'lifecycle.json'), JSON.stringify({ schemaVersion: '2.0', taskStats: {} }));
  const atRoot = runCli(['sync', '--dry-run'], { cwd: dir });
  const atSub = runCli(['sync', '--dry-run'], { cwd: path.join(dir, 'backend') });
  assert.equal(atSub.status, atRoot.status, '子目录结果须与项目根一致');
  assert.match(atSub.stderr, /已定位项目根/, '定位提示须走 stderr（stdout 留给机读输出）');
  const stray = await readdir(path.join(dir, 'backend'));
  assert.ok(!stray.includes('.vima'), '不得在子目录凭空创建 .vima/');
});

test('A24：非项目目录 → NOT_IN_PROJECT exit 4，且一个文件都不写', async (t) => {
  const dir = await emptyDir(t);
  for (const cmd of ['validate', 'plan', 'converge', 'retro', 'trace', 'certify']) {
    const r = runCli([cmd], { cwd: dir });
    assert.equal(r.status, 4, `${cmd} 应 exit 4，stderr: ${r.stderr}`);
    assert.match(r.stderr, new RegExp(`^vima ${cmd}: NOT_IN_PROJECT: `));
  }
  assert.deepEqual(await readdir(dir), [], '顶层守卫拒绝后不得留下任何文件');
});

test('A24：doctor 与 init 不受顶层守卫拒绝（各有既定的「无项目」语义）', async (t) => {
  const dir = await emptyDir(t);
  const doc = runCli(['doctor'], { cwd: dir });
  assert.equal(doc.status, 0, 'doctor 在非项目目录应降级运行而非拒绝');
  assert.match(doc.stdout, /非 vima 项目/);
  const ini = runCli(['init', '--template', 'nosuch'], { cwd: dir });
  assert.equal(ini.status, 3, 'init 应走到自身的模板校验，而不是被守卫挡下');
  assert.match(ini.stderr, /NO_TEMPLATE/);
});

test('A24：大于管道缓冲区的 stdout 不被截断（process.exit 会丢弃未 flush 的写入）', async (t) => {
  // 实测过的失效形态：`vima context --stdout | grep` 在恰好 8192 字节处被腰斩且不报错，
  // 机读输出（converge/retro/plan 的 --json）在真实项目上同样会被截断。
  const golden = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');
  const dir = await emptyDir(t);
  await cp(golden, dir, { recursive: true });

  const r = runCli(['context', 'device-list-fe', '--stdout'], { cwd: dir });
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  const bytes = Buffer.byteLength(r.stdout, 'utf8');
  assert.ok(bytes > 8192, `上下文包应大于一个管道缓冲区才有意义，实际 ${bytes} 字节`);
  assert.notEqual(bytes, 8192, '恰好 8192 字节 = 被管道缓冲区截断');
  assert.ok(r.stdout.trimEnd().endsWith('```') || /\n$/.test(r.stdout), '输出须完整收尾');
  assert.ok(r.stdout.includes('## 编码规范'), '末尾分节须完整出现（截断时它会消失）');
});
