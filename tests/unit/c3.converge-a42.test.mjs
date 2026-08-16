// C3 单测：converge 的 A42 增补——V-INT-06「被读的必须有人写」（D-A42-03）
// 与 D-A42-04 的契约缺口收口通道（contractGaps 进收口清单、不计退出码）。
// 独立文件：与 c3.converge.test.mjs 的 V-INT-01~05 用例并行演进，互不搅动。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(HERE, '..', '..');
const BIN = path.join(CLI_ROOT, 'bin', 'vima.mjs');
const GOLDEN = path.join(CLI_ROOT, 'tests', 'fixtures', 'golden');
const REPORT_REL = '.vima/reports/convergence.json';
const JAVA_DIR = 'backend/src/main/java/demo';
const CONTROLLER_REL = `${JAVA_DIR}/DeviceController.java`;

async function cloneGolden(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-c3-a42-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(GOLDEN, root, { recursive: true });
  return root;
}

function vima(cwd, ...args) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

async function readReport(root) {
  return JSON.parse(await readFile(path.join(root, REPORT_REL), 'utf8'));
}

async function writeJava(root, name, text) {
  await mkdir(path.join(root, JAVA_DIR), { recursive: true });
  await writeFile(path.join(root, JAVA_DIR, name), text);
}

/**
 * 契约 device-api.md 的响应字段是 id / name / type / status / createdAt / deleted。
 * 实体按此建：id 框架托管、type 带初始化值、internalNote 不在任何响应里。
 */
const ENTITY = `// @vima device-api-be
package demo;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@Entity
@Table(name = "device")
public class Device {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 50)
    private String name;

    @Column(length = 16)
    private String status;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(length = 16)
    private String type = "sensor";

    @Column(name = "internal_note", length = 200)
    private String internalNote;
}
`;

/** 写入方：new + setter，接收者类型可解析。omit 里的属性故意不写。 */
function writer(omit = []) {
  const sets = [
    ['name', '        d.setName(n);'],
    ['status', '        d.setStatus("active");'],
    ['createdAt', '        d.setCreatedAt(LocalDateTime.now());'],
    ['internalNote', '        d.setInternalNote("x");'],
  ].filter(([p]) => !omit.includes(p)).map(([, line]) => line).join('\n');
  return `package demo;

import java.time.LocalDateTime;

public class DeviceWriter {
    private DeviceRepository repo;

    public void create(String n) {
        Device d = new Device();
${sets}
        repo.save(d);
    }
}
`;
}

function findingsOf(report) {
  return report.findings.filter((f) => f.rule === 'V-INT-06');
}

// ── V-INT-06 正例：所有属性都有写入点 → 不报 ─────────────────────────────

test('V-INT-06 正例：实体属性都有写入点 → 零告警', async (t) => {
  const root = await cloneGolden(t);
  await writeJava(root, 'Device.java', ENTITY);
  await writeJava(root, 'DeviceWriter.java', writer());
  const r = vima(root, 'converge');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const report = await readReport(root);
  assert.deepEqual(findingsOf(report), [], JSON.stringify(findingsOf(report), null, 2));
});

test('V-INT-06 正例：@Builder 链赋值也算写入点', async (t) => {
  const root = await cloneGolden(t);
  await writeJava(root, 'Device.java', ENTITY);
  await writeJava(root, 'DeviceWriter.java', `package demo;

import java.time.LocalDateTime;

public class DeviceWriter {
    public Device create(String n) {
        return Device.builder()
                .name(n)
                .status("active")
                .createdAt(LocalDateTime.now())
                .internalNote("x")
                .build();
    }
}
`);
  const report = await (async () => { vima(root, 'converge'); return readReport(root); })();
  assert.deepEqual(findingsOf(report), [], JSON.stringify(findingsOf(report)));
});

test('V-INT-06 正例：实体自身 @PrePersist 里的裸赋值算写入点', async (t) => {
  const root = await cloneGolden(t);
  await writeJava(root, 'Device.java', ENTITY.replace('    @Column(name = "internal_note", length = 200)\n    private String internalNote;\n', `    @Column(name = "internal_note", length = 200)
    private String internalNote;

    @PrePersist
    public void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
`));
  await writeJava(root, 'DeviceWriter.java', writer(['createdAt']));
  vima(root, 'converge');
  const report = await readReport(root);
  assert.deepEqual(findingsOf(report), [], JSON.stringify(findingsOf(report)));
});

// ── V-INT-06 反例 ────────────────────────────────────────────────────────

test('V-INT-06 反例·属性级：单列无写入点 → warn，key 为 实体.属性', async (t) => {
  const root = await cloneGolden(t);
  await writeJava(root, 'Device.java', ENTITY);
  await writeJava(root, 'DeviceWriter.java', writer(['status']));
  const r = vima(root, 'converge');
  const report = await readReport(root);
  const hits = findingsOf(report);
  assert.equal(hits.length, 1, JSON.stringify(hits.map((h) => h.key)));
  assert.equal(hits[0].key, 'Device.status');
  assert.equal(hits[0].level, 'warn');
  assert.deepEqual(hits[0].owners, ['device-api-be']); // 实体文件的 @vima 归属
  assert.deepEqual(hits[0].paths, [CONTROLLER_REL.replace('DeviceController', 'Device')]);
  assert.match(hits[0].message, /恒空/);
  assert.match(hits[0].message, /docs\/contracts\/device-api\.md/);
  // warn 不计退出码（--strict 才升级），且进 byTask 供修复调度
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  assert.ok(report.byTask['device-api-be'].includes('V-INT-06 Device.status'));
  assert.equal(vima(root, 'converge', '--strict').code, 2);
});

test('V-INT-06 反例·实体级：整张表没有生产者 → 按实体报一条，不逐列刷屏', async (t) => {
  const root = await cloneGolden(t);
  await writeJava(root, 'Device.java', ENTITY); // 全仓无 new Device()/Device.builder()
  vima(root, 'converge');
  const report = await readReport(root);
  const hits = findingsOf(report);
  assert.equal(hits.length, 1, JSON.stringify(hits.map((h) => h.key)));
  assert.equal(hits[0].key, 'Device');
  assert.equal(hits[0].level, 'warn');
  assert.match(hits[0].message, /没有任何写入方/);
  // 列举的是「契约响应字段里出现过的死列」：
  for (const p of ['name', 'status', 'createdAt']) assert.ok(hits[0].message.includes(p), p);
  // 框架托管列（@Id/@GeneratedValue）与带初始化值的列不在其中
  assert.ok(!/、id、|字段 id、/.test(hits[0].message), hits[0].message);
  assert.ok(!hits[0].message.includes('type'), hits[0].message);
  // 契约响应里没有的列不算「被读」，不进消息
  assert.ok(!hits[0].message.includes('internalNote'), hits[0].message);
});

// ── 零假阳性的四条收窄，逐条守 ──────────────────────────────────────────

test('V-INT-06 收窄①：接收者类型解析不出的链式 setter → 同名属性全局压制', async (t) => {
  const root = await cloneGolden(t);
  await writeJava(root, 'Device.java', ENTITY);
  await writeJava(root, 'DeviceWriter.java', writer(['status']));
  await writeJava(root, 'DeviceOther.java', `package demo;

public class DeviceOther {
    private DeviceRepository repo;

    public void touch(Long id) {
        repo.findById(id).orElseThrow().setStatus("maintain");
    }
}
`);
  vima(root, 'converge');
  const report = await readReport(root);
  assert.deepEqual(findingsOf(report), [], '链式 setter 的接收者不可解析，宁可少报');
});

test('V-INT-06 收窄②：@RequestBody 绑定的实体整类跳过（Jackson 反射写入）', async (t) => {
  const root = await cloneGolden(t);
  await writeJava(root, 'Device.java', ENTITY);
  await writeJava(root, 'DeviceBindController.java', `package demo;

import org.springframework.web.bind.annotation.*;

public class DeviceBindController {
    @PostMapping("/api/device/bind")
    public Object save(@RequestBody @Valid Device req) {
        return req;
    }
}
`);
  vima(root, 'converge');
  const report = await readReport(root);
  assert.deepEqual(findingsOf(report), [], '框架反射写入，源码里没有写入点属正常');
});

test('V-INT-06 收窄③：契约响应字段里没有同名字段 → 没有「有人读」的证据，不判', async (t) => {
  const root = await cloneGolden(t);
  // 实体只留一个不在任何契约响应里的列
  await writeJava(root, 'Device.java', `// @vima device-api-be
package demo;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
public class Device {
    @Id
    private Long id;

    @Column(name = "internal_note", length = 200)
    private String internalNote;
}
`);
  vima(root, 'converge');
  const report = await readReport(root);
  assert.deepEqual(findingsOf(report), []);
});

test('V-INT-06 收窄④：无 @vima 标注的实体不参与（底座/共享层天然不判）', async (t) => {
  const root = await cloneGolden(t);
  await writeJava(root, 'Device.java', ENTITY.replace('// @vima device-api-be\n', ''));
  vima(root, 'converge');
  const report = await readReport(root);
  assert.deepEqual(findingsOf(report), []);
});

test('V-INT-06 写入点证据不限 @vima 作用域：无标注的底座写入方照样算数', async (t) => {
  const root = await cloneGolden(t);
  await writeJava(root, 'Device.java', ENTITY);
  await writeJava(root, 'DeviceWriter.java', writer()); // 无 @vima 标注
  vima(root, 'converge');
  const report = await readReport(root);
  assert.deepEqual(findingsOf(report), [], '漏看底座写入方只会造假阳性');
});

test('V-INT-06 随后端族跳过：无带标注后端文件时整族不判', async (t) => {
  const root = await cloneGolden(t);
  await writeJava(root, 'Device.java', ENTITY);
  // 抹掉全部后端 @vima 标注（含实体自己）→ scope.skipped=no-marked-backend
  for (const rel of [CONTROLLER_REL, `${JAVA_DIR}/Device.java`]) {
    const p = path.join(root, rel);
    await writeFile(p, (await readFile(p, 'utf8')).replace(/\/\/ @vima [^\n]*\n/g, ''));
  }
  const r = vima(root, 'converge');
  const report = await readReport(root);
  assert.equal(report.scope.skipped, 'no-marked-backend');
  assert.deepEqual(findingsOf(report), []);
  assert.match(r.stdout, /V-INT-01\/02\/03\/06 不判/);
});

test('V-INT-06 确定性：同一输入两次运行字节一致', async (t) => {
  const root = await cloneGolden(t);
  await writeJava(root, 'Device.java', ENTITY);
  await writeJava(root, 'DeviceWriter.java', writer(['status', 'createdAt']));
  vima(root, 'converge');
  const first = await readFile(path.join(root, REPORT_REL), 'utf8');
  vima(root, 'converge');
  assert.equal(await readFile(path.join(root, REPORT_REL), 'utf8'), first);
});

// ── D-A42-04：契约缺口进收口清单，但绝不阻断 ───────────────────────────

async function writeVerifier(root, name, data) {
  await mkdir(path.join(root, '.vima/reports'), { recursive: true });
  await writeFile(path.join(root, '.vima/reports', name), JSON.stringify(data));
}

test('contractGaps：计入 summary 与收口清单，exit 0（实现侧已合规处置，不是 fail）', async (t) => {
  const root = await cloneGolden(t);
  await writeVerifier(root, 'page-68-fe-verifier.json', {
    taskId: 'page-68-fe',
    result: 'pass',
    points: [{ point: '控件置灰 + 说明文案', passed: true }],
    contractGaps: [
      '契约声明 attachmentId 入参，33 个端点里却没有任何上传端点',
      { issue: '错误码 40901 实现抛出但契约未声明' },
    ],
  });
  const r = vima(root, 'converge');
  assert.equal(r.code, 0, `契约缺口不得阻断；stderr: ${r.stderr}`);
  const report = await readReport(root);
  assert.equal(report.summary.contractGaps, 2);
  assert.equal(report.summary.openPoints, 0);
  assert.deepEqual(report.contractGaps.map((g) => g.taskId), ['page-68-fe', 'page-68-fe']);
  assert.ok(report.contractGaps.some((g) => g.gap.includes('attachmentId')));
  assert.ok(report.contractGaps.some((g) => g.gap.includes('40901')), '对象写法取 issue 字段');
  // 不进 byTask：行动项是回契约补齐/立变更事务，派回任务修没有意义
  assert.ok(!Object.hasOwn(report.byTask, 'page-68-fe'), JSON.stringify(report.byTask));
  assert.match(r.stdout, /契约缺口 2/);
  assert.match(r.stderr, /📋 契约缺口 2 条/);
  assert.match(r.stderr, /变更事务/);
});

test('contractGaps：与未过点位并存时，退出码只由未过点位决定', async (t) => {
  const root = await cloneGolden(t);
  await writeVerifier(root, 'device-list-fe-verifier.json', {
    taskId: 'device-list-fe',
    points: [{ point: 'RULE-01 设备名唯一', passed: false }],
    contractGaps: ['契约缺口一条'],
  });
  const r = vima(root, 'converge');
  assert.equal(r.code, 2);
  const report = await readReport(root);
  assert.equal(report.summary.openPoints, 1);
  assert.equal(report.summary.contractGaps, 1);
  // 缺口不混入 openPoints
  assert.equal(report.openPoints.length, 1);
  assert.equal(report.openPoints[0].point, 'RULE-01 设备名唯一');
});

test('contractGaps：存量报告没有该键 → 缺省 0，行为不变', async (t) => {
  const root = await cloneGolden(t);
  await writeVerifier(root, 'device-list-fe-verifier.json', {
    taskId: 'device-list-fe',
    points: [{ point: 'toolbar/新增 → MODAL-01', passed: true }],
  });
  const r = vima(root, 'converge');
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const report = await readReport(root);
  assert.equal(report.summary.contractGaps, 0);
  assert.deepEqual(report.contractGaps, []);
  assert.ok(!r.stderr.includes('契约缺口'));
});
