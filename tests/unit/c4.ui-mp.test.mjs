// C4 · vima-ui-mp 类名闭包机检（A23 规格 5）
//
// 这套断言的作用不是「测样式好不好看」，是**锁死四份资产的同源关系**：
//   tokens.wxss ↔ ui.wxss ↔ ai-manifest.json ↔ ui-docs-vm/*.md ↔ template.json 的 componentMap
// 任何一处单独改动都会立刻红。出处：vima-ui-admin 的 check-boundary.mjs 第 6 项——
// 它反向验证时抓到过「组件有类名但零样式」这种静默缺陷。
// **不设白名单**：豁免机制天然会被拿来掩盖真缺陷（A23「不做」第一条的同款理由）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MP_SCAFFOLD = path.join(CLI_ROOT, 'templates', 'admin', 'scaffold', 'mp-native');
const UI_DIR = path.join(MP_SCAFFOLD, 'src', 'vendor', 'vima-ui-mp', 'dist');
const DOCS_DIR = path.join(CLI_ROOT, 'templates', 'admin', 'ui-docs-vm');

const read = (p) => readFile(p, 'utf8');

/** 文本里定义/引用的 .vm-* 类名集合。 */
function classesIn(text) {
  return new Set([...text.matchAll(/\.(vm-[a-z0-9-]+)/g)].map((m) => m[1]));
}

/** 骨架 wxml/wxss 里**使用**的 vm- 类名（先剔除 --vm-* 令牌名，它不是类名）。 */
function usedClassesIn(text) {
  const stripped = text.replace(/--vm-[a-z0-9-]+/g, '');
  return new Set([...stripped.matchAll(/\b(vm-[a-z0-9-]+)/g)].map((m) => m[1]));
}

async function walk(dir, filter, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'vendor' && e.name !== 'node_modules') await walk(p, filter, out);
    } else if (filter(e.name)) {
      out.push(p);
    }
  }
  return out;
}

test('vima-ui-mp 令牌闭包：ui.wxss 用到的 --vm-* 都有定义，定义的也都有人用', async () => {
  const tokens = await read(path.join(UI_DIR, 'tokens.wxss'));
  const ui = await read(path.join(UI_DIR, 'ui.wxss'));
  const defined = new Set([...tokens.matchAll(/^\s*(--vm-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
  const used = new Set([...`${tokens}${ui}`.matchAll(/var\((--vm-[a-z0-9-]+)/g)].map((m) => m[1]));
  assert.deepEqual([...used].filter((t) => !defined.has(t)).sort(), [], '有引用但未定义的令牌');
  assert.deepEqual([...defined].filter((t) => !used.has(t)).sort(), [],
    '有定义但没人用的令牌——没人用的令牌不是「预留」，是死代码');
  assert.ok(defined.size > 0);
});

test('vima-ui-mp 主题只覆盖令牌、不含类样式，且覆盖的令牌都是已定义的', async () => {
  const tokens = await read(path.join(UI_DIR, 'tokens.wxss'));
  const theme = await read(path.join(UI_DIR, 'themes', 'clinical-blue.wxss'));
  const defined = new Set([...tokens.matchAll(/^\s*(--vm-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
  const overridden = [...theme.matchAll(/^\s*(--vm-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]);
  assert.ok(overridden.length > 0, '主题应至少覆盖一个令牌');
  assert.deepEqual(overridden.filter((t) => !defined.has(t)), [], '主题覆盖了不存在的令牌（拼错即静默失效）');
  // 主题里只允许出现 page / .vm-page 这个令牌作用域选择器，不许夹带类样式
  const themeClasses = [...classesIn(theme)].filter((c) => c !== 'vm-page');
  assert.deepEqual(themeClasses, [], '主题文件不得包含类样式——一旦在这里写类，换肤就变成了改框架');
});

test('vima-ui-mp 类闭包：ui.wxss 的类集合 == ai-manifest 声明的类集合', async () => {
  const ui = await read(path.join(UI_DIR, 'ui.wxss'));
  const manifest = JSON.parse(await read(path.join(UI_DIR, 'ai-manifest.json')));
  const inCss = classesIn(ui);
  const inManifest = new Set(manifest.components.flatMap((c) => c.classes));
  assert.deepEqual([...inCss].filter((c) => !inManifest.has(c)).sort(), [], 'ui.wxss 有而 manifest 未登记的类');
  assert.deepEqual([...inManifest].filter((c) => !inCss.has(c)).sort(), [], 'manifest 登记了但 ui.wxss 无样式的类');
});

test('vima-ui-mp 文档闭包：manifest 组件名 == ui-docs-vm 文件名，且 doc 字段对得上', async () => {
  const manifest = JSON.parse(await read(path.join(UI_DIR, 'ai-manifest.json')));
  const files = (await readdir(DOCS_DIR)).filter((f) => f.endsWith('.md') && f !== 'CAPABILITY.md');
  const docNames = new Set(files.map((f) => f.replace(/\.md$/, '')));
  const names = manifest.components.map((c) => c.name);
  assert.deepEqual(names.filter((n) => !docNames.has(n)).sort(), [], 'manifest 有组件但没有对应文档');
  assert.deepEqual(manifest.components.filter((c) => c.doc !== `${c.name}.md`).map((c) => c.name), [],
    'manifest.doc 字段与组件名错位');
  // ui-docs-vm 两个 kind 共用（A25）：多出来的文档只能是 h5 侧的行为组件，不能是无主文档
  const h5 = JSON.parse(await read(path.join(CLI_ROOT, 'templates', 'admin', 'scaffold', 'h5-mobile',
    'vendor', 'vima-ui-h5', 'dist', 'ai-manifest.json')));
  const h5Only = h5.components.filter((c) => c.kind === 'vue').map((c) => c.name);
  assert.deepEqual([...docNames].filter((n) => !names.includes(n)).sort(), [...h5Only].sort(),
    '有文档但两端 manifest 都没登记（无主文档）');
});

test('componentMap 指向的组件文档都存在（context 切片的映射真源不许悬空）', async () => {
  const template = JSON.parse(await read(path.join(CLI_ROOT, 'templates', 'admin', 'template.json')));
  const kind = template.planning.kinds['mp-native'];
  assert.ok(kind.componentMap, 'mp-native 必须声明 componentMap，否则该端组件切片恒空（半截实现）');
  const files = (await readdir(DOCS_DIR)).filter((f) => f.endsWith('.md') && f !== 'CAPABILITY.md');
  const docNames = new Set(files.map((f) => f.replace(/\.md$/, '')));
  const mapped = [...new Set(Object.values(kind.componentMap).flat())];
  assert.deepEqual(mapped.filter((n) => !docNames.has(n)).sort(), [], 'componentMap 指向了不存在的组件文档');
  // 冻结词表的每个布局词都要有映射，否则该词的页面拿不到任何组件文档
  for (const word of kind.layoutVocab) {
    assert.ok(kind.componentMap[word], `布局词 ${word} 没有组件映射`);
  }
});

test('mp-native 骨架只用框架已定义的 vm- 类（不许现编类名）', async () => {
  const ui = await read(path.join(UI_DIR, 'ui.wxss'));
  const tokens = await read(path.join(UI_DIR, 'tokens.wxss'));
  const defined = new Set([...classesIn(ui), ...classesIn(tokens)]);
  const files = await walk(path.join(MP_SCAFFOLD, 'src'), (n) => /\.(wxml|wxss)$/.test(n));
  assert.ok(files.length > 0, '骨架应有 wxml/wxss');
  const used = new Set();
  for (const f of files) for (const c of usedClassesIn(await read(f))) used.add(c);
  assert.deepEqual([...used].filter((c) => !defined.has(c)).sort(), [], '骨架用了框架里没有的类');
});

test('mp-native 骨架不写裸色值；三处必要豁免（page 底色 / 原生属性 / tabBar）取值须等于对应令牌', async () => {
  const files = await walk(path.join(MP_SCAFFOLD, 'src'), (n) => /\.(wxml|wxss)$/.test(n));
  const offenders = [];
  for (const f of files) {
    const rel = path.relative(MP_SCAFFOLD, f).split(path.sep).join('/');
    if (rel === 'src/app.wxss') continue;
    for (const line of (await read(f)).split('\n')) {
      if (/^\s*(?:\/\*|\*)/.test(line)) continue;
      const stripped = line
        .replace(/--[\w-]+\s*:\s*[^;{}]*/g, '')
        // 与 post-write 同款窄豁免：原生组件颜色属性吃不到 var()
        .replace(/\b(?:color|activeColor|backgroundColor|selectedColor|backgroundTextStyle)="[^"]*"/g, '');
      if (/#[0-9a-fA-F]{3,8}\b/.test(stripped) || /\brgba?\(/.test(stripped)) offenders.push(`${rel}: ${line.trim()}`);
    }
  }
  assert.deepEqual(offenders, [], '骨架页出现裸色值');
  // 豁免处必须与令牌同值，否则换肤时页面底色留在原地
  const appWxss = await read(path.join(MP_SCAFFOLD, 'src', 'app.wxss'));
  const tokens = await read(path.join(UI_DIR, 'tokens.wxss'));
  const bg = /--vm-bg:\s*(#[0-9a-fA-F]{3,8})/.exec(tokens);
  assert.ok(bg, 'tokens 应定义 --vm-bg');
  assert.match(appWxss, new RegExp(`background-color:\\s*${bg[1]}`),
    `app.wxss 的 page 底色须与 --vm-bg (${bg[1]}) 一致`);

  // 豁免的原生属性色值同样不许自由取值：必须等于对应令牌，否则换肤时它留在原地
  const primary = /--vm-primary:\s*(#[0-9a-fA-F]{3,8})/.exec(tokens);
  assert.ok(primary, 'tokens 应定义 --vm-primary');
  const mine = await read(path.join(MP_SCAFFOLD, 'src', 'pages', 'mine', 'index.wxml'));
  const switchColor = /<switch[^>]*\bcolor="([^"]*)"/.exec(mine);
  assert.ok(switchColor, '骨架应有一处 <switch color> 作为豁免样例');
  assert.equal(switchColor[1].toLowerCase(), primary[1].toLowerCase(),
    '<switch color> 须与 --vm-primary 同值');
  // app.json 的 tabBar 配色同理（JSON 里用不了 CSS 变量）
  const appJson = JSON.parse(await read(path.join(MP_SCAFFOLD, 'src', 'app.json')));
  assert.equal(appJson.tabBar.selectedColor.toLowerCase(), primary[1].toLowerCase(),
    'tabBar.selectedColor 须与 --vm-primary 同值');
  const weak = /--vm-text-weak:\s*(#[0-9a-fA-F]{3,8})/.exec(tokens);
  assert.equal(appJson.tabBar.color.toLowerCase(), weak[1].toLowerCase(),
    'tabBar.color 须与 --vm-text-weak 同值');
  assert.equal(appJson.window.backgroundColor.toLowerCase(), bg[1].toLowerCase(),
    'window.backgroundColor 须与 --vm-bg 同值');
});

test('mp-native 骨架的请求门面形状匹配 V-CODE-01 的扫描正则（机检的前提）', async () => {
  const req = await read(path.join(MP_SCAFFOLD, 'src', 'utils', 'request.ts'));
  // 与 lib/commands/validate.mjs 的 checkFrontendCode 同款正则
  const re = /\brequest\s*\.\s*(get|post|put|delete|patch)\s*(?:<[^>(]*>)?\s*\(\s*(['"`])([^'"`\n]*)\2/g;
  assert.match(req, /export const request\s*=/, '必须导出名为 request 的门面对象');
  for (const m of ['get', 'post', 'put', 'delete', 'patch']) {
    assert.match(req, new RegExp(`\\b${m}:\\s*<T`), `门面缺少 ${m} 方法`);
  }
  // 门面示例调用（文档注释里的正例）应能被扫描正则命中
  const hits = [...`${req}`.matchAll(re)].map((m) => m[3]);
  assert.ok(hits.length > 0, '门面注释里的正例调用应能被 V-CODE-01 正则命中，否则约定与机检对不上');
});

// ── A25：h5-mobile 端与小程序端共用同一份类契约 ──────────────────────────────
const H5_SCAFFOLD = path.join(CLI_ROOT, 'templates', 'admin', 'scaffold', 'h5-mobile');
const H5_UI = path.join(H5_SCAFFOLD, 'vendor', 'vima-ui-h5', 'dist');

test('两端类契约字节一致：h5 的 .css == mp 的 .wxss 按「wxss→css」全局替换（A25 的 D-A25-02）', async () => {
  const pairs = [
    ['tokens.wxss', 'tokens.css'],
    ['ui.wxss', 'ui.css'],
    [path.join('themes', 'clinical-blue.wxss'), path.join('themes', 'clinical-blue.css')],
  ];
  for (const [mp, h5] of pairs) {
    const expected = (await read(path.join(UI_DIR, mp))).replaceAll('wxss', 'css');
    const actual = await read(path.join(H5_UI, h5));
    assert.equal(actual, expected,
      `${h5} 与 ${mp} 不一致——同一套企业 UI 不允许有两套定义，改就两端一起改`);
  }
});

test('h5 manifest 的 class 段与 mp manifest 逐字段一致，vue 段各带 mpEquivalent', async () => {
  const mp = JSON.parse(await read(path.join(UI_DIR, 'ai-manifest.json')));
  const h5 = JSON.parse(await read(path.join(H5_UI, 'ai-manifest.json')));
  const h5Class = h5.components.filter((c) => c.kind === 'class');
  assert.deepEqual(h5Class, mp.components, 'class 段必须与小程序端逐字段一致');
  const vue = h5.components.filter((c) => c.kind === 'vue');
  assert.ok(vue.length > 0, 'h5 应登记浏览器侧行为组件');
  for (const c of vue) {
    assert.ok(c.mpEquivalent, `${c.name} 缺 mpEquivalent——必须写明小程序端用什么原生能力顶替`);
    assert.deepEqual(c.classes, [], 'vue 组件不占类契约命名空间');
  }
});

test('h5 全部组件与文档闭包：manifest 组件名 == ui-docs-vm 文件名', async () => {
  const h5 = JSON.parse(await read(path.join(H5_UI, 'ai-manifest.json')));
  const files = (await readdir(DOCS_DIR)).filter((f) => f.endsWith('.md') && f !== 'CAPABILITY.md');
  const docNames = new Set(files.map((f) => f.replace(/\.md$/, '')));
  const names = h5.components.map((c) => c.name);
  assert.deepEqual(names.filter((n) => !docNames.has(n)).sort(), [], 'manifest 有组件但没有文档');
  assert.deepEqual([...docNames].filter((n) => !names.includes(n)).sort(), [], '有文档但 h5 manifest 未登记');
});

test('h5 骨架只用框架已定义的 vm- 类，且不写裸色值', async () => {
  const defined = new Set([
    ...classesIn(await read(path.join(H5_UI, 'ui.css'))),
    ...classesIn(await read(path.join(H5_UI, 'tokens.css'))),
    ...classesIn(await read(path.join(H5_UI, 'global.css'))),
  ]);
  const files = await walk(path.join(H5_SCAFFOLD, 'src'), (n) => /\.(vue|css)$/.test(n));
  assert.ok(files.length > 0);
  const used = new Set();
  const offenders = [];
  for (const f of files) {
    const text = await read(f);
    for (const c of usedClassesIn(text)) used.add(c);
    const rel = path.relative(H5_SCAFFOLD, f).split(path.sep).join('/');
    for (const line of text.split('\n')) {
      if (/^\s*(?:\/\/|\/\*|\*)/.test(line)) continue;
      const stripped = line.replace(/--[\w-]+\s*:\s*[^;{}]*/g, '');
      if (/#[0-9a-fA-F]{3,8}\b/.test(stripped) || /\brgba?\(/.test(stripped)) offenders.push(`${rel}: ${line.trim()}`);
    }
  }
  assert.deepEqual([...used].filter((c) => !defined.has(c)).sort(), [], 'h5 骨架用了框架里没有的类');
  assert.deepEqual(offenders, [], 'h5 骨架出现裸色值');
});

test('h5 骨架的请求门面同样匹配 V-CODE-01 正则（一条正则通吃三端）', async () => {
  const req = await read(path.join(H5_SCAFFOLD, 'src', 'utils', 'request.ts'));
  assert.match(req, /export \{ request \}/, '必须导出名为 request 的门面');
  const re = /\brequest\s*\.\s*(get|post|put|delete|patch)\s*(?:<[^>(]*>)?\s*\(\s*(['"`])([^'"`\n]*)\2/g;
  assert.ok([...req.matchAll(re)].length > 0, '门面注释里的正例调用应能被 V-CODE-01 正则命中');
});

test('两个 mobile kind 的词表与外壳一致（原型渲染器无需第二套外壳）', async () => {
  const t = JSON.parse(await read(path.join(CLI_ROOT, 'templates', 'admin', 'template.json')));
  const mp = t.planning.kinds['mp-native'];
  const h5 = t.planning.kinds['h5-mobile'];
  assert.deepEqual(h5.layoutVocab, mp.layoutVocab, '同一种手机形态应共用同一批布局词');
  assert.equal(h5.shell, mp.shell);
  assert.equal(h5.regions, false, '手机单列，多栏带是规格谎言');
  assert.deepEqual(h5.componentMap, mp.componentMap);
});

test('每个 kind 都有编码规范端节，且切片互不串味（A23/A25）', async () => {
  const t = JSON.parse(await read(path.join(CLI_ROOT, 'templates', 'admin', 'template.json')));
  const standards = await read(path.join(CLI_ROOT, 'templates', 'admin', 'planning', 'coding-standards.md'));
  const first = /^## 端规范：(.+)$/m.exec(standards);
  assert.ok(first, 'coding-standards 应有端规范分节');
  const common = standards.slice(0, first.index);
  for (const kind of Object.keys(t.planning.kinds)) {
    const m = new RegExp(`^## 端规范：${kind}\\s*$([\\s\\S]*?)(?=^## 端规范：|$(?![\\s\\S]))`, 'm').exec(standards);
    // 缺端节时 context 只会注入通用段——该端任务拿到零前端规范，且不会报错，静默降级
    assert.ok(m, `kind ${kind} 缺「## 端规范：${kind}」节：该端任务会拿到零前端规范`);
    assert.ok(m[1].length > 500, `kind ${kind} 的端节过短，疑似占位`);
  }
  // 通用段不该夹带某一端专属的东西（夹带了就等于所有端都被注入）
  for (const leak of ['vui-page', 'wx.showToast', 'vue-tsc']) {
    assert.ok(!common.includes(leak), `通用段夹带了端专属内容：${leak}`);
  }
});
