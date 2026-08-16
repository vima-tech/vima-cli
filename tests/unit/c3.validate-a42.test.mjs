// C3 单测 · A42 接缝对账（validate 侧）：
//   D-A42-01 V-TASK-07 按页聚合（切片任务不再假阳性）
//   D-A42-02 V-CODE-03 错误码对账 / V-CODE-04 权限点三面对账 / V-SRC-02 编号引用校验
// 每条规则都成对给出正例（真实形态下不得误报）与反例（真实缺陷必须命中）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli, CLI_ROOT } from '../helpers.mjs';

const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');
const REPORT_REL = '.vima/reports/planning-validation.json';
const BE_DIR = 'backend/src/main/java/demo';

/** 黄金夹具的根布局副本（同 c3.validate.test.mjs：折回 src/，覆盖存量项目寻址分支）。 */
async function cloneGolden(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-a42-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(GOLDEN, root, { recursive: true });
  await cp(path.join(root, 'apps/admin/src'), path.join(root, 'src'), { recursive: true });
  await rm(path.join(root, 'apps'), { recursive: true, force: true });
  return root;
}

function vima(cwd, ...args) {
  const r = runCli(args, { cwd });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

async function readReport(root) {
  return JSON.parse(await readFile(path.join(root, REPORT_REL), 'utf8'));
}

async function mutate(root, rel, from, to) {
  const p = path.join(root, rel);
  const text = await readFile(p, 'utf8');
  assert.ok(text.includes(from), `变异目标未找到: ${from}`);
  await writeFile(p, text.replace(from, to));
}

async function write(root, rel, text) {
  const p = path.join(root, rel);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, text);
}

/** 跑一轮 validate 并取某条规则的命中（errors + warnings 合并，逐条含级别）。 */
async function hits(root, rule) {
  const r = vima(root, 'validate');
  const report = await readReport(root);
  return {
    code: r.code,
    stderr: r.stderr,
    errors: report.errors.filter((e) => e.rule === rule),
    warnings: report.warnings.filter((w) => w.rule === rule),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// D-A42-01 · V-TASK-07 按页聚合
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 把 PAGE-01 的前端任务切成两片（合并页是 vima 自己支持的形态）。
 * 原任务保留 keep 条复选框，新任务承担其余 rest 条。
 */
async function splitPageTask(root, { keep, rest }) {
  const rel = 'docs/tasks/device-list-fe.md';
  const text = await readFile(path.join(root, rel), 'utf8');
  const boxes = text.match(/- \[ \] .*\n/g) ?? [];
  assert.equal(boxes.length, 6, '黄金夹具 device-list-fe 应有 6 条验收项');
  let head = text;
  for (const b of boxes.slice(keep)) head = head.replace(b, '');
  await writeFile(path.join(root, rel), head);

  const slice = [
    '---',
    'taskId: device-list-fe-2',
    'title: 设备管理列表页（前端·第二片）',
    'status: pending',
    'layer: business',
    'side: frontend',
    'dependsOn: [device-list-fe]',
    'retryCount: 0',
    'contract: docs/contracts/device-api.md',
    'page: PAGE-01',
    'updatedAt: 2026-08-12T10:00:00Z',
    '---',
    '',
    '# 设备管理列表页（第二片）',
    '',
    '## 任务目标',
    '',
    '承担 PAGE-01 的弹窗与批量删除部分（同页分片，页面结构以 spec 数据块为准）。',
    '',
    '## 验收清单',
    '',
    ...boxes.slice(keep, keep + rest).map((b) => b.trimEnd()),
  ].join('\n');
  await write(root, 'docs/tasks/device-list-fe-2.md', `${slice}\n`);
}

test('V-TASK-07 正例：PAGE-01 被两个任务分片、复选框数之和 = 任务点数 → 零告警（A42 D-A42-01）', async (t) => {
  const root = await cloneGolden(t);
  await splitPageTask(root, { keep: 3, rest: 3 }); // 3 + 3 = 6 = 该页任务点数
  const h = await hits(root, 'V-TASK-07');
  assert.equal(h.code, 0, `stderr: ${h.stderr}`);
  assert.deepEqual(
    h.warnings, [],
    '双向差集为空却报警 = 永远无法清除的告警，它训练人忽略整张告警表（A42 立项判据）',
  );
});

test('V-TASK-07 反例：分片后合计仍少于任务点数 → 每页只报一条，消息列出参与任务与各自条数', async (t) => {
  const root = await cloneGolden(t);
  await splitPageTask(root, { keep: 3, rest: 2 }); // 3 + 2 = 5 < 6
  const h = await hits(root, 'V-TASK-07');
  assert.equal(h.code, 0, 'V-TASK-07 恒 warn，不阻断');
  assert.equal(h.warnings.length, 1, `每页只报一条，实得：${JSON.stringify(h.warnings)}`);
  const msg = h.warnings[0].message;
  assert.match(msg, /合计仅 5 项，少于页面 PAGE-01 的任务点数 6/);
  assert.match(msg, /device-list-fe（3 项）/);
  assert.match(msg, /device-list-fe-2（2 项）/);
});

test('V-TASK-07 聚合只限本条：V-TASK-06 仍逐任务判定（一个分片写错 page 即报）', async (t) => {
  const root = await cloneGolden(t);
  await splitPageTask(root, { keep: 3, rest: 3 });
  await mutate(root, 'docs/tasks/device-list-fe-2.md', 'page: PAGE-01', 'page: PAGE-99');
  const h = await hits(root, 'V-TASK-06');
  assert.equal(h.code, 2);
  assert.equal(h.errors.length, 1, JSON.stringify(h.errors));
  assert.match(h.errors[0].message, /device-list-fe-2 的 page "PAGE-99"/);
});

// ═══════════════════════════════════════════════════════════════════════════
// D-A42-02 · V-CODE-03 错误码对账（实现抛了、契约没声明）
// ═══════════════════════════════════════════════════════════════════════════

const ERROR_CODE_JAVA = [
  'package demo;',
  '',
  '/** 项目自建错误码枚举（非 vima 骨架资产）。 */',
  'public enum ErrorCode {',
  '    VALIDATION_FAILED(40001, "参数校验失败"),',
  '    BATCH_TOO_LARGE(40002, "批量删除超过 100 条"),',
  '    DEVICE_IN_MAINTENANCE(40003, "维护中设备禁止删除"),',
  '    DEVICE_NOT_FOUND(40004, "设备不存在"),',
  '    DEVICE_NAME_CONFLICT(40901, "设备名称已存在");',
  '',
  '    private final int code;',
  '    private final String msg;',
  '',
  '    ErrorCode(int code, String msg) {',
  '        this.code = code;',
  '        this.msg = msg;',
  '    }',
  '}',
].join('\n');

/** 真实形态的 Service：泛型 + 折行抛出 + 注释里的反面教材。 */
function deviceService({ extraThrow = '' } = {}) {
  return [
    '// @vima device-api-be',
    'package demo;',
    '',
    'import java.util.List;',
    '',
    'public class DeviceService {',
    '',
    '    /** 反面教材（注释行不算实现）：throw new BusinessException(ErrorCode.DEVICE_NAME_CONFLICT); */',
    '    public List<java.util.Map<String, Object>> batchDelete(List<Long> ids) {',
    '        if (ids.size() > 100) {',
    '            throw new BusinessException(ErrorCode.BATCH_TOO_LARGE);',
    '        }',
    '        // 折行写法：格式化器把参数推到下一行，逐行扫描一条都命中不了',
    '        throw new BusinessException(',
    '            ErrorCode.DEVICE_IN_MAINTENANCE, "维护中设备禁止删除");',
    '    }',
    extraThrow,
    '}',
  ].join('\n');
}

test('V-CODE-03 正例：抛的错误码都在本模块契约 errors[] 中（含折行与注释反面教材）→ 放行', async (t) => {
  const root = await cloneGolden(t);
  await write(root, `${BE_DIR}/ErrorCode.java`, ERROR_CODE_JAVA);
  await write(root, `${BE_DIR}/DeviceService.java`, deviceService());
  const h = await hits(root, 'V-CODE-03');
  assert.equal(h.code, 0, `stderr: ${h.stderr}`);
  assert.deepEqual(h.errors, []);
});

const THROW_CONFLICT = [
  '    public void create(String name) {',
  '        if (name == null) {',
  '            throw new BusinessException(ErrorCode.DEVICE_NAME_CONFLICT, "设备名称已存在");',
  '        }',
  '    }',
].join('\n');

test('V-CODE-03 反例：该码项目别处声明过、本契约漏了 → error（确实是业务码）', async (t) => {
  const root = await cloneGolden(t);
  await write(root, `${BE_DIR}/ErrorCode.java`, ERROR_CODE_JAVA);
  await write(root, `${BE_DIR}/DeviceService.java`, deviceService({ extraThrow: THROW_CONFLICT }));
  // 另一份契约声明过 40901 ⇒ 项目确实把它当业务码 ⇒ 这里漏声明是缺陷
  await write(root, 'docs/contracts/other-api.md', [
    '# 其它模块契约', '',
    '## POST /api/other/act', '',
    '- 请求参数：无', '- 响应：`ApiResponse<void>`', '- 错误码：40901 业务状态冲突', '',
    '```yaml vima:contract',
    'module: other',
    'apis:',
    '  - method: POST',
    '    path: /api/other/act',
    '    consumers: [admin]',
    '    request: []',
    '    response: []',
    '    errors:',
    '      - { code: 40901, msg: 业务状态冲突 }',
    '```', '',
  ].join('\n'));

  const h = await hits(root, 'V-CODE-03');
  assert.equal(h.code, 2);
  assert.equal(h.errors.length, 1, JSON.stringify(h.errors));
  assert.match(h.errors[0].message, /错误码 40901（ErrorCode\.DEVICE_NAME_CONFLICT）/);
  assert.match(h.errors[0].message, /项目别处的契约声明过该码/);
  assert.match(h.errors[0].message, /docs\/contracts\/device-api\.md/);
  assert.equal(h.errors[0].path, `${BE_DIR}/DeviceService.java`);
  assert.match(h.stderr, /V-CODE-03/);
});

test('V-CODE-03 分级：该码全项目零声明 → warn 不 error（框架码与漏声明二义，判定权在项目）', async (t) => {
  // 实证（sustain-v4）：40101 认证失效被抛 2 次、22 份契约零声明，而项目的错误码约定文档
  // 明写「由底座统一拦截，不进业务契约 errors[]」——报 error 是假阳性。
  // 但不能简单跳过：同一轮的 40902 同样零声明却是真缺陷（契约全都漏了）。
  // 那份约定文档不是 vima 的资产，vima 无从区分 ⇒ 降 warn 并把两种可能都说清。
  const root = await cloneGolden(t);
  await write(root, `${BE_DIR}/ErrorCode.java`, ERROR_CODE_JAVA);
  await write(root, `${BE_DIR}/DeviceService.java`, deviceService({ extraThrow: THROW_CONFLICT }));

  const h = await hits(root, 'V-CODE-03');
  assert.equal(h.errors.length, 0, `零声明的码不得报 error：${JSON.stringify(h.errors)}`);
  assert.equal(h.warnings.length, 1, JSON.stringify(h.warnings));
  assert.match(h.warnings[0].message, /全部契约.*都没被声明过/);
  assert.match(h.warnings[0].message, /框架码/, '消息须给出「底座统一拦截」这一可能');
  assert.match(h.warnings[0].message, /整个项目都漏了声明/, '消息须给出另一可能');
  assert.equal(h.warnings[0].path, `${BE_DIR}/DeviceService.java`);
});

test('V-CODE-03 闸门：项目无 ErrorCode 枚举 → 整条规则静默跳过（该约定非 vima 骨架资产）', async (t) => {
  const root = await cloneGolden(t);
  await write(root, `${BE_DIR}/DeviceService.java`, deviceService({
    extraThrow: '    public void x() { throw new BusinessException(ErrorCode.WHATEVER); }',
  }));
  const h = await hits(root, 'V-CODE-03');
  assert.equal(h.code, 0, `映射不出数字码时不得臆断，stderr: ${h.stderr}`);
  assert.deepEqual(h.errors, []);
});

test('V-CODE-03 闸门：标注指向无 contract 的任务（共享层）→ 无从归属，不判', async (t) => {
  const root = await cloneGolden(t);
  await write(root, `${BE_DIR}/ErrorCode.java`, ERROR_CODE_JAVA);
  await write(root, `${BE_DIR}/CommonGuard.java`, [
    '// @vima shared-base',
    'package demo;',
    'public class CommonGuard {',
    '    public void guard() { throw new BusinessException(ErrorCode.DEVICE_NAME_CONFLICT); }',
    '}',
  ].join('\n'));
  const h = await hits(root, 'V-CODE-03');
  assert.equal(h.code, 0, `stderr: ${h.stderr}`);
  assert.deepEqual(h.errors, []);
});

// ═══════════════════════════════════════════════════════════════════════════
// D-A42-02 · V-CODE-04 权限点三面对账
// ═══════════════════════════════════════════════════════════════════════════

/** 给 MENU-01 的「设备新增」功能点声明权限点。 */
async function declarePerm(root, perm = 'device:device:add') {
  await mutate(
    root, 'docs/spec.md',
    '      - { name: 设备新增, api: POST /api/device }',
    `      - { name: 设备新增, api: POST /api/device, perms: [${perm}] }`,
  );
}

const CONTROLLER_WITH_PERM = [
  '// @vima device-api-be',
  'package demo;',
  'public class DevicePermController {',
  '    @PreAuthorize("@perm.has(\'device:device:add\')")',
  '    public Object create() { return null; }',
  '}',
].join('\n');

const VUE_WITH_AUTH = [
  '<!-- @vima device-list-fe -->',
  '<template>',
  '  <div class="vui-page">',
  '    <VButton v-auth="\'device:device:add\'">新增</VButton>',
  '    <VButton v-auth="[\'device:device:edit\', \'device:device:remove\']">保存</VButton>',
  '  </div>',
  '</template>',
].join('\n');

test('V-CODE-04 正例：权限点三面齐全（含数组写法）→ 零告警', async (t) => {
  const root = await cloneGolden(t);
  await declarePerm(root);
  await write(root, `${BE_DIR}/DevicePermController.java`, CONTROLLER_WITH_PERM);
  await write(root, 'src/views/DeviceList/index.vue', VUE_WITH_AUTH);
  const h = await hits(root, 'V-CODE-04');
  assert.equal(h.code, 0, `stderr: ${h.stderr}`);
  assert.deepEqual(h.errors, []);
  assert.deepEqual(h.warnings, []);
});

test('V-CODE-04 正例：v-auth 数组里的权限点算命中（前端 warn 不误报）', async (t) => {
  const root = await cloneGolden(t);
  await declarePerm(root, 'device:device:edit'); // 只出现在数组写法里
  await write(root, `${BE_DIR}/DevicePermController.java`,
    CONTROLLER_WITH_PERM.replace('device:device:add', 'device:device:edit'));
  await write(root, 'src/views/DeviceList/index.vue', VUE_WITH_AUTH);
  const h = await hits(root, 'V-CODE-04');
  assert.equal(h.code, 0, `stderr: ${h.stderr}`);
  assert.deepEqual(h.warnings, []);
});

test('V-CODE-04 反例：缺后端 → error（越权风险）；缺前端 → warn（入口不设防）', async (t) => {
  const root = await cloneGolden(t);
  await declarePerm(root);
  await write(root, 'src/views/DeviceList/index.vue', VUE_WITH_AUTH.replace("'device:device:add'", "'device:other:add'"));
  const h = await hits(root, 'V-CODE-04');
  assert.equal(h.code, 2);
  assert.equal(h.errors.length, 1, JSON.stringify(h.errors));
  assert.match(h.errors[0].message, /device:device:add.*MENU-01 功能点「设备新增」/);
  assert.match(h.errors[0].message, /@PreAuthorize/);
  assert.equal(h.warnings.length, 1, JSON.stringify(h.warnings));
  assert.match(h.warnings[0].message, /v-auth/);
});

test('V-CODE-04 闸门：该面尚无带标注的业务代码 → 不判（规格期不得把每个权限点报一遍）', async (t) => {
  const root = await cloneGolden(t);
  await declarePerm(root);
  // 前端已有带标注文件（api/device.ts）但无 v-auth → 前端面照判；后端标注文件全删 → 后端面不判
  await rm(path.join(root, `${BE_DIR}/DeviceController.java`));
  const h = await hits(root, 'V-CODE-04');
  assert.equal(h.code, 0, `后端尚未开工时报 error 会阻断规划期，stderr: ${h.stderr}`);
  assert.deepEqual(h.errors, []);
  assert.equal(h.warnings.length, 1, '前端面有带标注代码，仍按 warn 提示入口不设防');
});

test('V-CODE-04：spec 未声明 perms 的项目完全不触发（存量零影响）', async (t) => {
  const root = await cloneGolden(t);
  await write(root, `${BE_DIR}/DevicePermController.java`, CONTROLLER_WITH_PERM);
  const h = await hits(root, 'V-CODE-04');
  assert.equal(h.code, 0, `stderr: ${h.stderr}`);
  assert.deepEqual(h.errors, []);
  assert.deepEqual(h.warnings, []);
});

// ═══════════════════════════════════════════════════════════════════════════
// D-A42-02 · V-SRC-02 编号引用校验
// ═══════════════════════════════════════════════════════════════════════════

test('V-SRC-02 正例：引用真实编号（data-page / data-block / 注释）→ 放行', async (t) => {
  const root = await cloneGolden(t);
  await write(root, 'src/views/DeviceList/index.vue', [
    '<!-- @vima device-list-fe · 本页对应 PAGE-01，弹窗 MODAL-01 -->',
    '<template>',
    '  <div class="vui-page" data-page="PAGE-01">',
    '    <!-- RULE-03：批量删除一次最多 100 条 -->',
    '    <section data-block="table"></section>',
    '  </div>',
    '</template>',
  ].join('\n'));
  await write(root, `${BE_DIR}/DeviceRules.java`, [
    '// @vima device-api-be',
    'package demo;',
    '/** RULE-04 维护中设备禁止删除；NG-01 明确不做导出。 */',
    'public class DeviceRules {}',
  ].join('\n'));
  const h = await hits(root, 'V-SRC-02');
  assert.equal(h.code, 0, `stderr: ${h.stderr}`);
  assert.deepEqual(h.errors, []);
});

test('V-SRC-02 反例：data-page 指向已删页面 → error（锚点悬空时字段级机检静默失效）', async (t) => {
  const root = await cloneGolden(t);
  await write(root, 'src/views/DeviceList/pane.vue', [
    '<!-- @vima device-list-fe -->',
    '<template>',
    '  <div class="vui-page" data-page="PAGE-41">',
    '    <span>PAGE-41 的内容（同一编号出现两次只报一条）</span>',
    '  </div>',
    '</template>',
  ].join('\n'));
  const h = await hits(root, 'V-SRC-02');
  assert.equal(h.code, 2);
  assert.equal(h.errors.length, 1, `同文件同编号只报一条，实得：${JSON.stringify(h.errors)}`);
  assert.match(h.errors[0].message, /不存在的编号 PAGE-41/);
  assert.equal(h.errors[0].path, 'src/views/DeviceList/pane.vue');
});

test('V-SRC-02 反例：注释里给自己发豁免的 NG-16 与失效的 RULE-35 → 逐条 error', async (t) => {
  const root = await cloneGolden(t);
  await write(root, `${BE_DIR}/DeviceStub.java`, [
    '// @vima device-api-be',
    'package demo;',
    '/**',
    ' * 微信登录本期留桩，依据 NG-16（本期不做第三方登录）。',
    ' * 校验规则见 RULE-35。',
    ' */',
    'public class DeviceStub {}',
  ].join('\n'));
  const h = await hits(root, 'V-SRC-02');
  assert.equal(h.code, 2);
  assert.equal(h.errors.length, 2, JSON.stringify(h.errors));
  assert.ok(h.errors.some((e) => /不存在的编号 NG-16/.test(e.message)), '注释里的豁免依据必须被拦住');
  assert.ok(h.errors.some((e) => /不存在的编号 RULE-35/.test(e.message)));
});

test('V-SRC-02 作用域：无 @vima 标注的文件不参与（底座/共享层天然豁免，与 V-CODE 同口径）', async (t) => {
  const root = await cloneGolden(t);
  await write(root, 'src/utils/legacy.ts', 'export const doc = "历史文档提到 PAGE-41 与 NG-16"\n');
  const h = await hits(root, 'V-SRC-02');
  assert.equal(h.code, 0, `stderr: ${h.stderr}`);
  assert.deepEqual(h.errors, []);
});

test('V-SRC-02：spec 里声明为空号/不复用的编号仍算不存在（只认结构化数据块）', async (t) => {
  const root = await cloneGolden(t);
  await mutate(
    root, 'docs/spec.md',
    '## 3. 页面清单',
    '## 3. 页面清单\n\n> 编号 PAGE-41~49 为空号（D-16 合并时已删），保留不复用。',
  );
  await write(root, 'src/views/DeviceList/pane.vue', [
    '<!-- @vima device-list-fe -->',
    '<template><div data-page="PAGE-41"></div></template>',
  ].join('\n'));
  const h = await hits(root, 'V-SRC-02');
  assert.equal(h.code, 2, '空号在正文里出现不构成「存在」');
  assert.equal(h.errors.length, 1, JSON.stringify(h.errors));
  assert.match(h.errors[0].message, /PAGE-41/);
});
