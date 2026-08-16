// 骨架自身的合宪性守卫（A42 D-A42-05）：
// 骨架是 builder 打开项目看到的第一批代码，Agent 天然模仿上下文——
// 它违反一次「禁止写死颜色/圆角」，整个项目就会跟着违反。
// 这份守卫由 vima-cli 仓库自己承担，不派给项目里的 code-audit 代理
// （审计者无权改骨架，报了也没人能接单；见 A42「明确不做」第三条）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'templates', 'admin', 'scaffold', 'frontend', 'src');
const TOKENS = path.join(SRC, 'styles', 'tokens.css');

/** 递归收 src 下的 .vue / .css（vendor 与构建产物不在骨架源码里，不必排除）。 */
async function sourceFiles(dir = SRC, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) await sourceFiles(abs, acc);
    else if (/\.(vue|css)$/.test(entry.name)) acc.push(abs);
  }
  return acc;
}

const BARE_COLOR = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b|rgba?\(\s*\d/;
const BARE_RADIUS = /border-radius:\s*\d+px/;

test('骨架前端源码零裸色值：唯一允许写字面色的地方是 tokens.css 的定义区', async () => {
  const offenders = [];
  for (const abs of await sourceFiles()) {
    if (abs === TOKENS) continue;
    const text = await readFile(abs, 'utf8');
    for (const [i, line] of text.split('\n').entries()) {
      if (BARE_COLOR.test(line)) offenders.push(`${path.relative(SRC, abs)}:${i + 1}: ${line.trim()}`);
    }
  }
  assert.deepEqual(offenders, [], `骨架里出现裸色值（应取 var(--v-*)）：\n${offenders.join('\n')}`);
});

test('骨架前端源码零裸圆角：全部取 --v-radius-* 阶梯（正圆 50% 除外）', async () => {
  const offenders = [];
  for (const abs of await sourceFiles()) {
    if (abs === TOKENS) continue;
    const text = await readFile(abs, 'utf8');
    for (const [i, line] of text.split('\n').entries()) {
      if (BARE_RADIUS.test(line)) offenders.push(`${path.relative(SRC, abs)}:${i + 1}: ${line.trim()}`);
    }
  }
  assert.deepEqual(offenders, [], `骨架里出现裸圆角（应取 var(--v-radius-*)）：\n${offenders.join('\n')}`);
});

test('圆角只有一条阶梯：tokens.css 定义 6 档，不得再冒出第七个数', async () => {
  const tokens = await readFile(TOKENS, 'utf8');
  const rungs = [...tokens.matchAll(/--v-radius-([a-z]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]);
  assert.deepEqual(rungs, [
    ['xs', '2px'],
    ['sm', '9px'],
    ['ctl', '13px'],
    ['card', '16px'],
    ['xl', '28px'],
    ['pill', '999px'],
  ], '圆角阶梯变更须同步本断言：新增一档等于放弃「一条阶梯」这条纪律，要有明确理由');
});

test('登录页专用色定义在 tokens.css，不散在 view 里（--v-login-* 命名标明只此一页）', async () => {
  const tokens = await readFile(TOKENS, 'utf8');
  const login = await readFile(path.join(SRC, 'views', 'login', 'index.vue'), 'utf8');
  assert.ok(/--v-login-canvas:/.test(tokens), 'tokens.css 须持有登录页专用令牌的定义');
  assert.ok(!/--v-login-[a-z0-9-]+:\s*[^;]/.test(login), 'login/index.vue 只许引用登录页令牌，不许在 view 里定义');
  assert.ok(/var\(--v-login-canvas\)/.test(login), 'login/index.vue 须引用登录页令牌');
});

test('骨架页面不带 @vima 标注；唯一带标注的是 shared-base 认领的 layout.css', async () => {
  // @vima <taskId> 是任务归属标注：taskId 必须在 docs/tasks/ 里存在，否则 `vima trace --strict`
  // 判「野生标注」而永远失败。骨架页面比任何业务任务都早存在，塞一个业务 taskId 是虚报；
  // 塞一个约定 id（如 `scaffold`）则既是野生标注、又会把骨架拉进 V-CODE 与 code-audit 的
  // 扫描面——那正是 D-A42-05 要拿掉的东西。骨架的作用域纪律由「不标注」本身承载。
  // 例外 layout.css：`shared-base` 是 planning-guide 每个项目都会生成的共享层任务
  // （见 _template-fe.md 的 dependsOn 默认值），版面原语确实归它维护——它接得了单。
  const marked = [];
  for (const abs of await sourceFiles()) {
    const m = /@vima\s+([a-z0-9][a-z0-9-]*)/.exec(await readFile(abs, 'utf8'));
    if (m) marked.push(`${path.relative(SRC, abs)} → ${m[1]}`);
  }
  assert.deepEqual(marked, ['styles/layout.css → shared-base'],
    `骨架标注面变了；新增标注前先回答「哪个任务接得了这个单」：\n${marked.join('\n')}`);
});
