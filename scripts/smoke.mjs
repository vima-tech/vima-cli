#!/usr/bin/env node
// 端到端冒烟 —— 只有整合层能做的验证。
//
// 单元测试各自证明「我这块对」，冒烟证明「拼起来能跑」。上一代反复吃亏的
// 恰恰是接缝：四个最高影响面缺陷没有一条是「代码写错了」，全是两个正确的
// 部件按各自正确的方式做完、合起来不通。
//
// 所以这个脚本走的是**真实 CLI 进程**，不是 import 内部函数——import 会绕过
// 参数解析、退出码、stdout/stderr 分流这些只有真跑才暴露的东西。
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
// 同步版：step() 的回调是同步的，异步断言里抛的错它接不住（会变成静默通过）
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const BIN = path.join(REPO, 'bin', 'vima.mjs');

let pass = 0; let fail = 0;
const failures = [];

function step(name, fn) {
  try {
    const r = fn();
    // async 回调返回 Promise，它抛的错这里接不住，会被记成通过——
    // 一个只会报绿的检查比没有检查更糟。宁可当场判定用法错误。
    if (r && typeof r.then === 'function') throw new Error('step 的回调必须是同步的（异步断言会被静默吞掉）');
    pass += 1;
    process.stdout.write(`  ✔ ${name}\n`);
  } catch (err) {
    fail += 1;
    failures.push({ name, message: err.message });
    process.stdout.write(`  ✖ ${name}\n      ${err.message}\n`);
  }
}

function vima(cwd, args, input) {
  // FORCE_COLOR 必须删掉而不是靠 NO_COLOR 压——两个都在时 Node 让 FORCE_COLOR 赢，
  // 转义序列会混进断言比对的文本里。
  const env = { ...process.env, NO_COLOR: '1' };
  delete env.FORCE_COLOR;
  return spawnSync(process.execPath, [BIN, ...args], { cwd, input, encoding: 'utf8', env });
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), 'vima4-smoke-'));
  process.stdout.write(`\nvima v4 端到端冒烟\n工作目录 ${root}\n\n`);

  try {
    // ── 1. 立项 ────────────────────────────────────────────────────────
    process.stdout.write('1 · 立项\n');
    const init = vima(root, ['init']);
    step('init 退出码 0', () => assert(init.status === 0, `实际 ${init.status}: ${init.stderr}`));
    step('init 建出 .vima/——它是项目根的唯一判据', () => {
      const st = vima(root, ['status']);
      assert(!/NO_PROJECT/.test(st.stderr), `status 找不到项目根: ${st.stderr}`);
    });

    // ── 1b. Claude Code 派生投影 ───────────────────────────────────────
    process.stdout.write('\n1b · 派生投影（.claude/rules/ 与 .mcp.json）\n');
    step('init 就把投影写出来了——不用人再想起来跑一次', () => {
      const mcp = JSON.parse(readFileSync(path.join(root, '.mcp.json'), 'utf8'));
      assert(mcp.mcpServers?.vima?.command === 'node', `.mcp.json 形状不对：${JSON.stringify(mcp)}`);
      const rules = readdirSync(path.join(root, '.claude', 'rules'));
      assert(rules.length > 0, '至少该投影出无条件的那几条内置规则');
      assert(rules.every((f) => f.startsWith('vima-')), `投影文件必须带前缀：${rules.join(', ')}`);
    });
    step('sync --check 在一致时 exit 0', () => {
      const c = vima(root, ['sync', '--check']);
      assert(c.status === 0, `实际 exit ${c.status}：\n${c.stdout}${c.stderr}`);
    });
    step('改了真源没重跑 sync → --check 报漂移并 exit 5（给 CI 用）', () => {
      writeFileSync(path.join(root, '.vima', 'rules', 'smoke-probe.md'),
        '---\nlayer: impl\n---\n\n冒烟探针规则。\n');
      const c = vima(root, ['sync', '--check']);
      assert(c.status === 5, `应当 exit 5，实际 ${c.status}：\n${c.stdout}`);
      assert(/漂移/.test(c.stdout), `应当明说漂了：\n${c.stdout}`);
      const fixed = vima(root, ['sync']);
      assert(fixed.status === 0, `sync 应当能修好：${fixed.stderr}`);
      assert(vima(root, ['sync', '--check']).status === 0, 'sync 之后应当不再漂');
    });
    step('人手写进 .claude/rules/ 的文件不会被投影删掉', () => {
      const mine = path.join(root, '.claude', 'rules', 'my-own.md');
      writeFileSync(mine, '# 人手写的\n\n不该被删。\n');
      vima(root, ['sync']);
      assert(readdirSync(path.join(root, '.claude', 'rules')).includes('my-own.md'),
        '删掉人写的文件是这类机制被关掉的最快方式');
    });

    // ── 2. 空项目如实为空 ──────────────────────────────────────────────
    process.stdout.write('\n2 · 空项目\n');
    const empty = vima(root, ['status']);
    step('空项目 status 恒 exit 0（它要可视化的正是「开错目录」这种故障）',
      () => assert(empty.status === 0, `实际 ${empty.status}`));
    step('空项目不假装有进度', () => {
      assert(!/100%/.test(empty.stdout), `零命题不该显示 100%：\n${empty.stdout}`);
    });

    // ── 3. 编译命题 ────────────────────────────────────────────────────
    // 走的是**主路**：人改 docs/ 的 markdown，vima compile 从那里编。
    // 批次 JSON 是旁路，冒烟不该拿旁路冒充主路——上一版就是这么漏掉了
    // 「markdown 根本没有解析器」这个洞。
    process.stdout.write('\n3 · 编译（docs/ markdown 是唯一真源）\n');
    await writeFile(path.join(root, 'docs', 'intent.md'), [
      '---', 'layer: intent', 'trust: stated', 'need: claimed',
      'source: docs/raw/2026-08-10-kickoff.md', '---', '',
      '- `intent-login` 用户能登录并保持登录态', '',
    ].join('\n'));
    await mkdir(path.join(root, 'docs', 'spec'), { recursive: true });
    await writeFile(path.join(root, 'docs', 'spec', 'login.md'), [
      '---', 'layer: spec', 'upstream: [intent-login]', 'trust: stated', 'need: derived', '---', '',
      '这一段是背景，不参与编译。', '',
      '- `spec-login-remember` 登录页提供「记住我」勾选框',
      '- `spec-login-captcha` 连续失败 3 次后出验证码',
      '  - need: executed', '',
    ].join('\n'));

    const c1 = vima(root, ['compile']);
    step('从零起步：init 后直接 compile 就能把第一条命题编进去（R1）',
      () => assert(c1.status === 0, `${c1.status}: ${c1.stdout}${c1.stderr}`));
    step('层序由系统定：intent 先于 spec 写入，spec 才连得上上游', () => {
      assert(/intent.*intent\.md/s.test(c1.stdout), `应按层报告逐文件结果：\n${c1.stdout}`);
      assert(/命题 3 条/.test(c1.stdout), `应编出 3 条命题：\n${c1.stdout}`);
    });
    step('条目属性覆盖文件头缺省（spec-login-captcha 的门槛是 executed）', () => {
      const ask = vima(root, ['ask', 'spec-login-captcha']);
      assert(/executed/.test(ask.stdout), `门槛应为 executed：\n${ask.stdout}`);
    });

    const bad = { layer: 'spec', upstream: [], items: [{ id: 'no-source', statement: '说不出出处' }] };
    const c2 = vima(root, ['compile'], JSON.stringify(bad));
    step('说不出出处的命题被拒——未授权复杂度不落盘',
      () => assert(c2.status !== 0, `应当拒绝，实际 exit ${c2.status}`));

    const c3 = vima(root, ['compile', '--docs', 'nonexistent-dir']);
    step('一个规格文件都没扫到 → 报错而不是「已写入 0 条」式的静默成功',
      () => assert(c3.status !== 0, `应当报错，实际 exit ${c3.status}：\n${c3.stdout}`));

    // ── 3b. 对账：docs 是全量真源，删了的命题要退休 ────────────────────
    process.stdout.write('\n3b · 声明集对账（docs 删除 → 退休 → 下游失效）\n');
    step('重跑 compile（docs 未改）→ 真幂等：written=0 且事件流不增长', () => {
      // 这条断言此前只查「没退休任何东西」——测试名叫「幂等」，实际保证弱得多，
      // 而真实行为是每次重跑都写入等价 claim 事件（实测 2 条 → 4 条）。
      // 名字比保证强的测试比没有测试更糟：它让人以为这件事有人盯着。
      const before = readFileSync(path.join(root, '.vima', 'events.jsonl'), 'utf8').split('\n').filter(Boolean).length;
      const again = vima(root, ['compile']);
      assert(again.status === 0, `${again.status}: ${again.stdout}`);
      const after = readFileSync(path.join(root, '.vima', 'events.jsonl'), 'utf8').split('\n').filter(Boolean).length;
      assert(after === before, `事件流不该增长：${before} → ${after}\n${again.stdout}`);
      assert(/已写入 0 条/.test(again.stdout), `written 应为 0：\n${again.stdout}`);
      assert(!/退休/.test(again.stdout), `docs 没动就不该退人：\n${again.stdout}`);
    });

    step('--plan 只算不写；有条目被拒时整次零写入', () => {
      const before = readFileSync(path.join(root, '.vima', 'events.jsonl'), 'utf8').split('\n').filter(Boolean).length;
      const planned = vima(root, ['compile', '--plan']);
      assert(planned.status === 0, `${planned.status}: ${planned.stdout}`);
      assert(/--plan：只算不写/.test(planned.stdout), `要说清这是计划态：\n${planned.stdout}`);

      // 塞一条过不了准入的（缺 trust），整次都不该落盘
      writeFileSync(path.join(root, 'docs', 'spec', 'bad.md'), [
        '---', 'layer: spec', 'upstream: [intent-login]', '---', '',
        '- `spec-ok-one` 合法的一条', '  - trust: stated',
        '- `spec-bad-one` 缺 trust 的一条', '',
      ].join('\n'));
      const c = vima(root, ['compile']);
      assert(c.status === 5, `有拒绝应 exit 5，实际 ${c.status}`);
      const after = readFileSync(path.join(root, '.vima', 'events.jsonl'), 'utf8').split('\n').filter(Boolean).length;
      assert(after === before, `有拒绝时必须零写入，实际 ${before} → ${after}\n${c.stdout}`);
      assert(/整次未提交/.test(c.stdout), `要说清是整次未提交而非逐条：\n${c.stdout}`);
      rmSync(path.join(root, 'docs', 'spec', 'bad.md'));
    });
    step('从 docs 删掉一条命题 → compile 报退休，下游进失效清单', () => {
      writeFileSync(path.join(root, 'docs', 'spec', 'login.md'), [
        '---', 'layer: spec', 'upstream: [intent-login]', 'trust: stated', 'need: derived', '---', '',
        '- `spec-login-remember` 登录页提供「记住我」勾选框', '',
      ].join('\n')); // spec-login-captcha 被删了
      const c = vima(root, ['compile']);
      assert(/退休 1 条/.test(c.stdout), `应报退休：\n${c.stdout}`);
      assert(/spec-login-captcha/.test(c.stdout), `要指名退了谁：\n${c.stdout}`);
      const st = vima(root, ['status']);
      assert(!/spec-login-captcha.*待办|待办.*spec-login-captcha/s.test(st.stdout),
        '退休的命题不该再出现在任何待办里');
    });

    // ── 4. 取证：自称够不着更高门槛 ────────────────────────────────────
    process.stdout.write('\n4 · 取证（C1：执行者会自称完成）\n');
    const s1 = vima(root, ['submit', 'spec-login-remember',
      '--how', JSON.stringify({ mode: 'claimed', note: '我做完了' })]);
    step('自称可以进日志，但不能让命题达标', () => {
      const ask = vima(root, ['ask', 'spec-login-remember']);
      assert(/claimed/.test(ask.stdout), `证据应记为最弱档：\n${ask.stdout}`);
      assert(s1.status !== 0 || !/达标|met/.test(ask.stdout.split('\n')[0] ?? ''),
        '自称不该让 derived 门槛的命题达标');
    });

    // ── 5. 执行级取证：绿了不算，正式才算 ──────────────────────────────
    //
    // 这一节此前自己在演示放水：拿 `node -e "process.exit(0)"` 换一份 executed
    // 证据，然后断言「出证据了」。命令确实跑了、确实退出 0——但它什么也没验。
    // codex 评估把这条列为最优先剩余风险，而**产品的冒烟脚本正是那个反面教材**。
    process.stdout.write('\n5 · 执行级取证（现挑的命令换不来达标，正式策略才行）\n');

    const adhoc = vima(root, ['submit', 'spec-login-captcha',
      '--how', JSON.stringify({ mode: 'executed', cmd: [process.execPath, '-e', 'process.exit(0)'] })]);
    step('恒成功命令 → 证据如实记 executed，但**不达标**', () => {
      const ask = vima(root, ['ask', 'spec-login-captcha']);
      assert(/executed/.test(ask.stdout), `命令真跑了，证据要如实记：\n${ask.stdout}`);
      assert(adhoc.status === 5, `现挑命令不该让命题达标，应 exit 5（不达标），实际 ${adhoc.status}`);
      assert(/临时|adHoc|ad-hoc|不算正式/i.test(ask.stdout + adhoc.stdout),
        `要说清为什么不算：\n${ask.stdout}\n${adhoc.stdout}`);
    });

    // 先验「策略跑绿但没验到东西」，再验「策略真的通过」。
    // 顺序不能反：反了的话第二步已经落下一份正式证据，命题恒达标，
    // 第一步就再也断言不出「没取到证据」——测试会变成一条永远绿的检查。
    step('声明策略：改 docs 走真源那条路', () => {
      mkdirSync(path.join(root, '.vima', 'policies'), { recursive: true });
      writeFileSync(path.join(root, 'docs', 'spec', 'login.md'), [
        '---', 'layer: spec', 'upstream: [intent-login]', 'trust: stated', 'need: derived', '---', '',
        '- `spec-login-remember` 登录页提供「记住我」勾选框',
        '- `spec-login-captcha` 连续失败 3 次后出验证码',
        '  - need: executed',
        '  - policy: captcha-test', '',
      ].join('\n'));
      const c = vima(root, ['compile']);
      assert(c.status === 0, `${c.status}: ${c.stdout}${c.stderr}`);
    });

    step('策略跑绿但没满足 expects → 执行成功 ≠ 取到证据', () => {
      writeFileSync(path.join(root, '.vima', 'policies', 'captcha-test.json'), JSON.stringify({
        mode: 'executed',
        cmd: [process.execPath, '-e', 'process.exit(0)'], // 退出 0，但零输出
        expects: { stdoutMatch: '\\d+ passing' },
      }, null, 2));
      const s = vima(root, ['submit', 'spec-login-captcha']);
      assert(s.status !== 0, '零输出的「测试」不该算取到证据');
      assert(/期望|expects/i.test(s.stdout + s.stderr), `要说清差在哪条期望：\n${s.stdout}${s.stderr}`);
    });

    step('策略缺 expects → 加载就拒（只看退出码的策略等于没有策略）', () => {
      writeFileSync(path.join(root, '.vima', 'policies', 'captcha-test.json'), JSON.stringify({
        mode: 'executed', cmd: [process.execPath, '-e', 'process.exit(0)'],
      }, null, 2));
      const s = vima(root, ['submit', 'spec-login-captcha']);
      assert(s.status !== 0, '缺 expects 的策略不该能用');
      assert(/expects/.test(s.stdout + s.stderr), `要指出缺的是 expects：\n${s.stdout}${s.stderr}`);
    });

    step('策略满足 expects → 正式证据 → 达标', () => {
      writeFileSync(path.join(root, '.vima', 'policies', 'captcha-test.json'), JSON.stringify({
        mode: 'executed',
        cmd: [process.execPath, '-e', 'console.log("captcha: 3 passing")'],
        expects: { stdoutMatch: '\\d+ passing' },
      }, null, 2));
      const s = vima(root, ['submit', 'spec-login-captcha']);
      assert(s.status === 0, `走策略应当达标，实际 exit ${s.status}：\n${s.stdout}${s.stderr}`);
    });

    const redRun = vima(root, ['submit', 'spec-login-remember',
      '--how', JSON.stringify({ mode: 'executed', cmd: [process.execPath, '-e', 'process.exit(1)'] })]);
    step('命令红 → 不出证据，但过程留痕', () => {
      assert(redRun.status !== 0, '红了不该报成功');
    });

    // ── 6. 观测面 ──────────────────────────────────────────────────────
    process.stdout.write('\n6 · 观测（R2 最高优先）\n');
    const st = vima(root, ['status']);
    step('status 能给出命题总数与达标数', () => {
      assert(st.status === 0, `exit ${st.status}`);
      assert(st.stdout.trim().length > 0, 'status 不能是空输出');
    });
    const audit = vima(root, ['audit']);
    step('audit 如实带上提取能力边界——看不见的时候必须说看不见', () => {
      const text = audit.stdout + audit.stderr;
      assert(/regex|file|能力|capab/i.test(text), `审计应透传 extract.CAPABILITY：\n${text.slice(0, 400)}`);
    });

    // ── 7. 裁定不阻塞 ──────────────────────────────────────────────────
    process.stdout.write('\n7 · 裁定（C4：不阻塞，但必须留痕）\n');
    const rule = vima(root, ['rule',
      '--question', '设备状态枚举三方冲突',
      '--chosen', 'contract',
      '--confidence', 'low',
      '--blast', 'spec-login-remember',
      '--rationale', '契约与后端一致']);
    step('裁定被记录且不阻塞', () => assert(rule.status === 0, `${rule.status}: ${rule.stderr}`));
    step('裁定带 confidence——没有优先级的台账人不会看', () => {
      const events = vima(root, ['status', '--json']);
      const text = events.stdout + rule.stdout;
      assert(/low|confidence/i.test(text), '裁定应保留置信度');
    });

    // ── 7b. 二次裁决闭环（C4 的另一半：人事后能推翻）───────────────────
    process.stdout.write('\n7b · 二次裁决\n');
    step('override：旧裁定转已复核，且不能改判一条已被改判的', () => {
      const first = JSON.parse(vima(root, ['rule', '--json',
        '--question', '枚举取几值', '--chosen', 'two', '--confidence', 'low', '--blast', 'x']).stdout);
      const second = vima(root, ['rule', '--overrides', first.id,
        '--question', '枚举取几值', '--chosen', 'three', '--confidence', 'high', '--blast', 'x']);
      assert(second.status === 0, second.stderr);
      assert(/改判/.test(second.stdout), `要说清这是改判：\n${second.stdout}`);
      const third = vima(root, ['rule', '--overrides', first.id,
        '--question', '枚举取几值', '--chosen', 'four', '--confidence', 'high', '--blast', 'x']);
      assert(third.status !== 0, '改判一条已被改判的裁定 = 两条现行结论，必须拒绝');
      assert(/已被.*改判/.test(third.stderr), `拒绝理由要指路改判最新那条：\n${third.stderr}`);
    });

    // ── 8. 事件日志是唯一写入口 ────────────────────────────────────────
    process.stdout.write('\n8 · 事件日志\n');
    const log = await readFile(path.join(root, '.vima', 'events.jsonl'), 'utf8');
    const lines = log.split('\n').filter((l) => l.trim());
    step('每一步都留下了事件', () => assert(lines.length >= 6, `只有 ${lines.length} 条事件`));
    step('证据事件的 actor 恒为 system——「内容由系统生成」落成数据里能查的差别', () => {
      const evs = lines.map((l) => JSON.parse(l)).filter((e) => e.kind === 'evidence');
      assert(evs.length > 0, '应当有证据事件');
      for (const e of evs) assert(e.actor === 'system', `证据事件 actor 应为 system，实际 ${e.actor}`);
    });
    step('append-only：没有任何一行被改写', () => {
      const ids = lines.map((l) => JSON.parse(l).id);
      assert(new Set(ids).size === ids.length, '事件 id 重复 = 有改写发生');
    });

    // ── 9. MCP 前端 ────────────────────────────────────────────────────
    process.stdout.write('\n9 · MCP 前端\n');
    const rpc = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    ].map((m) => JSON.stringify(m)).join('\n');
    const mcp = vima(root, ['mcp'], `${rpc}\n`);
    step('MCP 能完成 initialize 与 tools/list', () => {
      assert(/"result"/.test(mcp.stdout), `无 JSON-RPC 响应：\n${mcp.stdout.slice(0, 300)}\n${mcp.stderr.slice(0, 300)}`);
    });
    step('MCP 工具集刻意小（只暴露 agent 真正需要的）', () => {
      const n = (mcp.stdout.match(/"name"\s*:/g) ?? []).length;
      assert(n > 0 && n <= 8, `工具数应在 1–8，实际 ${n}——全量映射会占上下文且制造第二个真源`);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  process.stdout.write(`\n${'─'.repeat(56)}\n冒烟结果：${pass} 通过 / ${fail} 失败\n`);
  if (fail > 0) {
    process.stdout.write('\n失败项：\n');
    for (const f of failures) process.stdout.write(`  · ${f.name}\n    ${f.message}\n`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  process.stderr.write(`冒烟脚本自身出错：${err.stack}\n`);
  process.exitCode = 70;
});
