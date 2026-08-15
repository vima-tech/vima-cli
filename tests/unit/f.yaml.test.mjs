// F 单测：lib/util/yaml.mjs —— 子集全特性 / round-trip / 错误行号
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseYaml, stringifyYaml } from '../../lib/util/yaml.mjs';
import { VimaError } from '../../lib/util/errors.mjs';

// ---------------------------------------------------------------------------
// 解析：标量与基础类型
// ---------------------------------------------------------------------------

test('标量类型：字符串/数字/布尔/null', () => {
  const doc = [
    'str: hello world',
    'zh: 设备名称 2-50 字符',
    'int: 42',
    'neg: -7',
    'float: 3.14',
    'exp: 1e3',
    'yes: true',
    'no: false',
    'nil: null',
    'tilde: ~',
    'empty:',
    'zero: 0',
  ].join('\n');
  assert.deepEqual(parseYaml(doc), {
    str: 'hello world',
    zh: '设备名称 2-50 字符',
    int: 42,
    neg: -7,
    float: 3.14,
    exp: 1000,
    yes: true,
    no: false,
    nil: null,
    tilde: null,
    empty: null,
    zero: 0,
  });
});

test('时间戳与 URL 中的冒号不误判为映射', () => {
  const v = parseYaml('updatedAt: 2026-08-12T10:00:00Z\nurl: http://example.com/a');
  assert.equal(v.updatedAt, '2026-08-12T10:00:00Z');
  assert.equal(v.url, 'http://example.com/a');
});

test('空文档返回 null', () => {
  assert.equal(parseYaml(''), null);
  assert.equal(parseYaml('\n# 只有注释\n\n'), null);
});

// ---------------------------------------------------------------------------
// 解析：引号字符串
// ---------------------------------------------------------------------------

test('单双引号字符串与转义', () => {
  const doc = [
    `single: 'a: b # not comment'`,
    `escaped: 'it''s ok'`,
    `double: "line\\nbreak\\ttab \\"q\\""`,
    `numstr: "007"`,
    `boolstr: 'true'`,
  ].join('\n');
  assert.deepEqual(parseYaml(doc), {
    single: 'a: b # not comment',
    escaped: "it's ok",
    double: 'line\nbreak\ttab "q"',
    numstr: '007',
    boolstr: 'true',
  });
});

test('普通标量中的撇号不视为引号', () => {
  assert.deepEqual(parseYaml("title: it's fine"), { title: "it's fine" });
});

// ---------------------------------------------------------------------------
// 解析：注释
// ---------------------------------------------------------------------------

test('整行注释与尾注释', () => {
  const doc = [
    '# 头注释',
    'a: 1   # 尾注释',
    'b: [x, y]  # 数组后注释',
    'c: "内含 # 不是注释"',
    '  # 缩进的整行注释',
    'd: done',
  ].join('\n');
  assert.deepEqual(parseYaml(doc), { a: 1, b: ['x', 'y'], c: '内含 # 不是注释', d: 'done' });
});

// ---------------------------------------------------------------------------
// 解析：嵌套映射 / 列表 / 内联集合
// ---------------------------------------------------------------------------

test('嵌套映射（2 空格缩进）', () => {
  const doc = ['outer:', '  inner:', '    k: v', '  sibling: 1', 'top: 2'].join('\n');
  assert.deepEqual(parseYaml(doc), { outer: { inner: { k: 'v' }, sibling: 1 }, top: 2 });
});

test('列表：标量项/内联对象项/嵌套映射项', () => {
  const doc = [
    'scalars:',
    '  - one',
    '  - 2',
    '  - true',
    'objects:',
    '  - { name: id, type: number, required: true, desc: 主键 }',
    'maps:',
    '  - name: Device',
    '    fields:',
    '      - { name: name, type: string }',
    '  - name: User',
  ].join('\n');
  assert.deepEqual(parseYaml(doc), {
    scalars: ['one', 2, true],
    objects: [{ name: 'id', type: 'number', required: true, desc: '主键' }],
    maps: [{ name: 'Device', fields: [{ name: 'name', type: 'string' }] }, { name: 'User' }],
  });
});

test('列表项与键同缩进（key 下一行顶格 -）', () => {
  const doc = ['items:', '- a', '- b'].join('\n');
  assert.deepEqual(parseYaml(doc), { items: ['a', 'b'] });
});

test('内联数组：标量含空格与斜杠', () => {
  const doc = 'apis: [GET /api/device/list, POST /api/device, POST /api/device/batch-delete]';
  assert.deepEqual(parseYaml(doc), {
    apis: ['GET /api/device/list', 'POST /api/device', 'POST /api/device/batch-delete'],
  });
});

test('内联数组：空数组、嵌套、含内联对象', () => {
  const doc = ['empty: []', 'nested: [[1, 2], [3]]', 'objs: [{ a: 1 }, { b: 2 }]'].join('\n');
  assert.deepEqual(parseYaml(doc), {
    empty: [],
    nested: [[1, 2], [3]],
    objs: [{ a: 1 }, { b: 2 }],
  });
});

test('内联对象：值为标量/内联数组，空对象', () => {
  const doc = [
    'submit: { api: POST /api/device }',
    'enum: { name: DeviceType, values: [sensor, actuator, gateway] }',
    'blank: {}',
  ].join('\n');
  assert.deepEqual(parseYaml(doc), {
    submit: { api: 'POST /api/device' },
    enum: { name: 'DeviceType', values: ['sensor', 'actuator', 'gateway'] },
    blank: {},
  });
});

test('裸 "-" 项：嵌套列表', () => {
  const doc = ['matrix:', '  -', '    - 1', '    - 2', '  -', '    - 3'].join('\n');
  assert.deepEqual(parseYaml(doc), { matrix: [[1, 2], [3]] });
});

// ---------------------------------------------------------------------------
// 解析：契约文档中的真实样例
// ---------------------------------------------------------------------------

test('契约 §6.1 任务 frontmatter 样例', () => {
  const doc = [
    'taskId: device-list-fe        # ^[a-z0-9][a-z0-9-]*$',
    'title: 设备管理列表页（前端）',
    'status: pending               # pending|running|done|failed|blocked',
    'layer: business',
    'side: frontend',
    'dependsOn: [shared-base]      # 可为空数组',
    'retryCount: 0',
    'contract: docs/contracts/device-api.md',
    'page: PAGE-01',
    'updatedAt: 2026-08-12T10:00:00Z',
  ].join('\n');
  assert.deepEqual(parseYaml(doc), {
    taskId: 'device-list-fe',
    title: '设备管理列表页（前端）',
    status: 'pending',
    layer: 'business',
    side: 'frontend',
    dependsOn: ['shared-base'],
    retryCount: 0,
    contract: 'docs/contracts/device-api.md',
    page: 'PAGE-01',
    updatedAt: '2026-08-12T10:00:00Z',
  });
});

test('契约 §7 vima:page 样例全结构', () => {
  const doc = [
    'id: PAGE-01',
    'title: 设备列表',
    'menu: MENU-01',
    'layout: [search, toolbar, table, pagination]',
    'components:',
    '  - block: search',
    '    items:',
    '      - { type: input, label: 设备名称 }',
    '      - { type: select, label: 状态, options: [在线, 离线, 维护中] }',
    '  - block: toolbar',
    '    items:',
    '      - { type: button, label: 新增, action: modal, target: MODAL-01 }',
    '      - { type: button, label: 批量删除, action: api, api: POST /api/device/batch-delete }',
    '  - block: table',
    '    api: GET /api/device/list',
    '    rowActions:',
    '      - { label: 编辑, action: modal, target: MODAL-01 }',
    '      - { label: 详情, action: nav, target: PAGE-02 }',
    '  - block: pagination',
    '    items: []',
    'modals:',
    '  - id: MODAL-01',
    '    title: 设备表单',
    '    fields:',
    '      - { field: name, label: 设备名称, type: input, required: true }',
    '    submit: { api: POST /api/device }',
    'apis: [GET /api/device/list, POST /api/device, POST /api/device/batch-delete]',
  ].join('\n');
  const page = parseYaml(doc);
  assert.equal(page.id, 'PAGE-01');
  assert.deepEqual(page.layout, ['search', 'toolbar', 'table', 'pagination']);
  assert.equal(page.components.length, 4);
  assert.deepEqual(page.components[0].items[1], {
    type: 'select',
    label: '状态',
    options: ['在线', '离线', '维护中'],
  });
  assert.equal(page.components[2].api, 'GET /api/device/list');
  assert.deepEqual(page.components[2].rowActions[1], { label: '详情', action: 'nav', target: 'PAGE-02' });
  assert.deepEqual(page.components[3].items, []);
  assert.deepEqual(page.modals[0].submit, { api: 'POST /api/device' });
  assert.equal(page.modals[0].fields[0].required, true);
  assert.equal(page.apis.length, 3);
});

// ---------------------------------------------------------------------------
// 解析错误：VimaError + 行号
// ---------------------------------------------------------------------------

function assertParseError(text, lineNo, opts) {
  let err = null;
  try {
    parseYaml(text, opts);
  } catch (e) {
    err = e;
  }
  assert.ok(err !== null, '应抛出解析错误');
  assert.ok(err instanceof VimaError, `应抛 VimaError，实际 ${err.constructor.name}`);
  assert.equal(err.code, 'YAML_PARSE');
  assert.match(err.message, new RegExp(`第 ${lineNo} 行`));
  return err;
}

test('错误：Tab 缩进（含行号）', () => {
  assertParseError('a: 1\n\tb: 2', 2);
});

test('错误：引号未闭合（含行号）', () => {
  assertParseError("a: 1\nb: 'oops", 2);
});

test('错误：内联数组未闭合（含行号）', () => {
  assertParseError('x: ok\ny: ok\nz: [1, 2', 3);
});

test('错误：内联对象缺冒号（含行号）', () => {
  assertParseError('a: { k v }', 1);
});

test('错误：缩进错乱（含行号）', () => {
  assertParseError('a: 1\n    b: 2', 2);
});

test('错误：重复键（含行号）', () => {
  assertParseError('a: 1\na: 2', 2);
});

test('错误：值后多余内容（含行号）', () => {
  assertParseError('a: [1, 2] extra', 1);
});

test('错误携带 path 上下文', () => {
  const err = assertParseError("a: 'x", 1, { path: 'docs/spec.md' });
  assert.equal(err.path, 'docs/spec.md');
});

test('拒绝会改变对象原型的映射键', () => {
  assertParseError('__proto__: { taskId: ghost }', 1);
  assertParseError('{ constructor: { taskId: ghost } }', 1);
});

// ---------------------------------------------------------------------------
// stringifyYaml：输出形态与 round-trip
// ---------------------------------------------------------------------------

test('stringify 保持键的输入顺序（不排序）', () => {
  const out = stringifyYaml({ zebra: 1, alpha: 2, mid: 3 });
  const keys = out.trim().split('\n').map((l) => l.split(':')[0]);
  assert.deepEqual(keys, ['zebra', 'alpha', 'mid']);
});

test('stringify 以换行结尾且空集合内联', () => {
  const out = stringifyYaml({ a: [], b: {}, c: null });
  assert.equal(out, 'a: []\nb: {}\nc: null\n');
});

test('round-trip：复杂嵌套结构', () => {
  const value = {
    taskId: 'device-list-fe',
    title: '设备管理列表页（前端）',
    dependsOn: ['shared-base', 'device-api-be'],
    retryCount: 0,
    updatedAt: '2026-08-12T10:00:00Z',
    nested: { deep: { list: [{ a: 1, b: [true, false, null] }, 'plain', 42] } },
    emptyArr: [],
    emptyObj: {},
    matrix: [[1, 2], [3]],
  };
  assert.deepEqual(parseYaml(stringifyYaml(value)), value);
});

test('round-trip：需要引号保护的字符串', () => {
  const value = {
    empty: '',
    numLike: '007',
    sciLike: '1e3',
    boolLike: 'true',
    nullLike: 'null',
    colonSpace: 'a: b',
    endColon: 'ends:',
    hash: 'has # inside',
    leadHash: '# starts with hash',
    leadDash: '- leading dash',
    leadBracket: '[not an array]',
    spaces: '  padded  ',
    newline: 'line1\nline2',
    quote: `it's "quoted"`,
    listOfTricky: ['a, b', 'x: y', ''],
  };
  assert.deepEqual(parseYaml(stringifyYaml(value)), value);
});

test('round-trip：顶层数组与顶层标量', () => {
  const arr = [{ id: 'PAGE-01', apis: ['GET /x'] }, 'plain', 7];
  assert.deepEqual(parseYaml(stringifyYaml(arr)), arr);
  assert.equal(parseYaml(stringifyYaml('hello')), 'hello');
  assert.equal(parseYaml(stringifyYaml(3.5)), 3.5);
  assert.equal(parseYaml(stringifyYaml(null)), null);
});

test('round-trip：契约 §7 页面块解析结果', () => {
  const page = {
    id: 'PAGE-01',
    title: '设备列表',
    layout: ['search', 'toolbar'],
    components: [
      { block: 'search', items: [{ type: 'select', label: '状态', options: ['在线', '离线'] }] },
      { block: 'table', api: 'GET /api/device/list', rowActions: [{ label: '编辑', action: 'modal', target: 'MODAL-01' }] },
      { block: 'pagination', items: [] },
    ],
    modals: [{ id: 'MODAL-01', fields: [{ field: 'name', required: true }], submit: { api: 'POST /api/device' } }],
    apis: ['GET /api/device/list', 'POST /api/device'],
  };
  assert.deepEqual(parseYaml(stringifyYaml(page)), page);
});
