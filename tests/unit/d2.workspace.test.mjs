// D2 单测：workspace 文字资产与模板配置的防漂移断言（契约 §13）
// 动机（差距评估结论）：A3 验收判据曾因 go.md 用词漂移而 2/3 失配却无测试报警；
// guard-shared 的保护面与 template.json sharedDirs 曾三处口径不一。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ADMIN = path.join(CLI_ROOT, 'templates', 'admin');

test('go 正式入口：project skill 可被用户和 Claude 自动触发，并锚定真实 Vima 根', async () => {
  const skill = await readFile(path.join(ADMIN, 'workspace/skills/go/SKILL.md'), 'utf8');
  assert.match(skill, /^---\n[\s\S]*?\n---\n/);
  assert.match(skill, /description:[^\n]*(继续开发|开始开发)/);
  assert.match(skill, /\$ARGUMENTS/);
  assert.match(skill, /\$\{CLAUDE_SKILL_DIR\}/);
  assert.match(skill, /\$\{CLAUDE_PROJECT_DIR\}/);
  assert.match(skill, /\.claude\/commands\/go\.md/);
  assert.match(skill, /vima go/);
  assert.doesNotMatch(skill, /disable-model-invocation:\s*true/);
});

test('Claude 命令触发面：三条工作流 skill + /vima 全 CLI 路由均可显式和自然语言触发', async () => {
  const skillRoot = path.join(ADMIN, 'workspace/skills');
  assert.deepEqual((await readdir(skillRoot)).sort(), ['check', 'design', 'go', 'vima']);

  for (const name of ['check', 'design', 'go', 'vima']) {
    const skill = await readFile(path.join(skillRoot, name, 'SKILL.md'), 'utf8');
    assert.match(skill, /^---\n[\s\S]*?description:[^\n]+[\s\S]*?\n---\n/, `${name} 须有可发现描述`);
    assert.match(skill, /\$\{CLAUDE_SKILL_DIR\}/, `${name} 须从 skill 位置推导真实根`);
    assert.match(skill, /\$\{CLAUDE_PROJECT_DIR\}/, `${name} 须拒绝错误 Claude 项目根`);
    assert.doesNotMatch(skill, /disable-model-invocation:\s*true/, `${name} 不得关闭模型触发`);
  }

  const check = await readFile(path.join(skillRoot, 'check/SKILL.md'), 'utf8');
  assert.match(check, /\.claude\/commands\/check\.md/);
  const design = await readFile(path.join(skillRoot, 'design/SKILL.md'), 'utf8');
  assert.match(design, /\.claude\/commands\/design\.md/);

  const router = await readFile(path.join(skillRoot, 'vima/SKILL.md'), 'utf8');
  assert.match(router, /\$ARGUMENTS/);
  assert.match(router, /vima help/);
  assert.match(router, /docs\/lifecycle\.json/);
  assert.match(router, /不得.*手工.*模拟|不能.*手工.*模拟/);
  assert.match(router, /\/vima <command>/);

  for (const name of ['go', 'check', 'design']) {
    const legacy = await readFile(path.join(ADMIN, `workspace/commands/${name}.md`), 'utf8');
    assert.match(
      legacy,
      /^---\n[\s\S]*?description:[^\n]+[\s\S]*?\n---\n/,
      `${name}.md 兼容入口也须保留 description，正式 skill 损坏时仍可被发现`,
    );
  }
});

test('项目宪法：所有 Vima 命令与生命周期意图必须经正式 skill，不只特判 go', async () => {
  const constitution = await readFile(path.join(ADMIN, 'workspace/CLAUDE.project.md'), 'utf8');
  assert.match(constitution, /所有 Vima 命令/);
  assert.match(constitution, /`go`、`check`、`design`、`vima`/);
  assert.match(constitution, /不得.*手工.*模拟/);
});

test('A3 冷读门：go.md 满足三条验收 grep 判据（v2.1-amendments A3）', async () => {
  const goMd = await readFile(path.join(ADMIN, 'workspace/commands/go.md'), 'utf8');
  assert.ok(goMd.includes('深度校验'), 'go.md 须含触发词「深度校验」');
  assert.ok(
    goMd.includes('只读 docs/spec.md 与 docs/contracts'),
    '零知识约束「只读 spec+契约」须单行可 grep（不得断行）',
  );
  assert.ok(goMd.includes('pendingConfirm'), '可推断项裁定分支须标 pendingConfirm');
});

test('A29 视觉稿工序：planning-guide 开启说明 + go.md 校准轮 + fe 模板设计稿行（防漂移）', async () => {
  const guide = await readFile(path.join(ADMIN, 'planning/planning-guide.md'), 'utf8');
  assert.ok(guide.includes('/design consent'), 'planning-guide 须含 Claude Design 开启命令说明');
  assert.ok(guide.includes('claude.ai/design'), 'planning-guide 须含 claude.ai/design 指引');
  // A34 D-A34-27：design-links.md 已废止（它被 3 份资产引用却无模板、无 init 落点、
  // 无机检消费方——正是「宣称与实现两张皮」）。台账改为仓库内冻结目录。
  assert.ok(guide.includes('docs/review/design/'), 'planning-guide 须登记仓库内设计冻结目录');
  assert.ok(guide.includes('不得拿线框冒充视觉稿'), 'planning-guide 须写明未接入降级口径');
  const goMd = await readFile(path.join(ADMIN, 'workspace/commands/go.md'), 'utf8');
  assert.ok(goMd.includes('5.2.6'), 'go.md 须含 5.2.6 校准轮步骤');
  assert.ok(goMd.includes('设计稿校准轮'), 'go.md 须含设计稿校准轮触发词');
  const feTpl = await readFile(path.join(ADMIN, 'planning/_template-fe.md'), 'utf8');
  assert.ok(feTpl.includes('设计稿'), '_template-fe 须含设计稿登记行');
});

test('A34 幽灵文件已废止：design-links.md 在内核与模板中零残留', async () => {
  // G1 的病根是「3 份程序资产引用一个从不被创建、从不被机检的文件」。
  // 本断言盯死它不再回来——新增引用会立刻变红。
  const r = spawnSync('grep', ['-rl', 'design-links', path.join(CLI_ROOT, 'lib'), ADMIN], { encoding: 'utf8' });
  assert.equal(r.stdout.trim(), '', `design-links 仍被引用：\n${r.stdout}`);
});

test('A34 Builder 三层授权：锁定/遵循/自由分面，且禁降级为表格（防漂移）', async () => {
  const b = await readFile(path.join(ADMIN, 'workspace/agents/vima-builder.md'), 'utf8');
  assert.ok(b.includes('三层授权'), 'builder 须给出三层授权口径');
  assert.ok(b.includes('自由层'), 'builder 须明确表现层自由层——否则 Agent 选保守实现是理性最优解');
  assert.ok(/降级为表格或\s*textarea/.test(b), 'builder 须禁止把图表/消息流/画布/实时预览降级为表格');
  assert.ok(!b.includes('不在页面里自写'), 'builder 不得再禁止页面内容区自写 grid（G3）');
  const fe = await readFile(path.join(ADMIN, 'planning/_template-fe.md'), 'utf8');
  assert.ok(!fe.includes('不在页面里自写'), '_template-fe 同上（G3 的另一处落点）');
  assert.ok(!fe.includes('无稿'), '_template-fe 不得再提供「写无稿」的零成本降级出口（G2）');
});

test('A34 三类验收角色资产齐备，且各自写结构化报告（防漂移）', async () => {
  for (const [name, mustHave] of [
    ['vima-verifier', '验收'],
    ['vima-design-reviewer', '表达降级'],
    ['vima-experience-verifier', 'primaryTask'],
  ]) {
    const t = await readFile(path.join(ADMIN, `workspace/agents/${name}.md`), 'utf8');
    assert.ok(t.includes(mustHave), `${name} 须含关键判据「${mustHave}」`);
  }
  const dr = await readFile(path.join(ADMIN, 'workspace/agents/vima-design-reviewer.md'), 'utf8');
  assert.ok(dr.includes('.vima/reports/design/'), 'Design Reviewer 须写结构化报告（否则内核无消费方 = 重演 G1）');
  const ev = await readFile(path.join(ADMIN, 'workspace/agents/vima-experience-verifier.md'), 'utf8');
  assert.ok(ev.includes('.vima/reports/experience/'), 'Experience Verifier 同上');
  assert.ok(ev.includes('mustPreserveResults'), '须按 mustPreserve.id 逐条对账');
});

test('A34 designer 资产：MCP 与浏览器只在 workspace 层，且 serve_url 不落盘（防漂移）', async () => {
  const d = await readFile(path.join(ADMIN, 'workspace/agents/vima-designer.md'), 'utf8');
  assert.ok(d.includes('三方向'), 'designer 须承载 Stage A0 发散');
  assert.ok(d.includes('差异矩阵'), '只交三张静态图，「方向」很可能只是三套配色');
  assert.ok(d.includes('不得自行选定胜者') || d.includes('你不得自行选定胜者'), '口味裁定必须留给用户');
  assert.ok(d.includes('serve_url'), 'designer 须写明 serve_url 不许落盘');
  const cmd = await readFile(path.join(ADMIN, 'workspace/commands/design.md'), 'utf8');
  assert.ok(cmd.includes('vima design check'), '/design 须收口到确定性闸门');
});

test('A34 内核分层边界：lib/ 零 MCP 工具名与浏览器依赖（硬约束回归）', async () => {
  const r = spawnSync(
    'grep',
    ['-rliE', 'playwright|puppeteer|claude_design|render_preview|create_project', path.join(CLI_ROOT, 'lib')],
    { encoding: 'utf8' },
  );
  assert.equal(r.stdout.trim(), '', `lib/ 出现了 Claude Code 专属语义或浏览器依赖：\n${r.stdout}`);
});

test('A27 版面冒烟：默认 Kimi WebBridge、Playwright 仅回退且共用探针（防漂移）', async () => {
  const goMd = await readFile(path.join(ADMIN, 'workspace/commands/go.md'), 'utf8');
  assert.ok(goMd.includes('默认 Kimi WebBridge'), '/go 须明确 Kimi WebBridge 是默认通道');
  assert.ok(goMd.includes('$kimi-webbridge'), '/go 须显式加载 kimi-webbridge skill');
  assert.ok(goMd.includes('Playwright 仅回退'), '/go 须限定 Playwright 只作回退');
  assert.ok(goMd.includes('source: "kimi-webbridge"'), '默认报告须记录适配器来源');
  assert.ok(goMd.includes('不要关闭 session/tab'), '真实浏览器会话须遵守不擅自关闭纪律');

  const checkMd = await readFile(path.join(ADMIN, 'workspace/commands/check.md'), 'utf8');
  assert.ok(checkMd.includes('kimi-webbridge / playwright / unknown'), '/check 须兼容新旧报告并展示来源');
  assert.ok(checkMd.includes('Playwright 回退均不可用'), '/check 无报告口径须覆盖两条通道');

  const smoke = await readFile(path.join(ADMIN, 'scaffold/frontend/scripts/layout-smoke.mjs'), 'utf8');
  const probe = await readFile(path.join(ADMIN, 'scaffold/frontend/scripts/layout-probe.mjs'), 'utf8');
  assert.ok(smoke.includes("from './layout-probe.mjs'"), 'Playwright 回退须复用唯一探针实现');
  assert.ok(smoke.includes("source: 'playwright'"), 'Playwright 回退报告须记录来源');
  assert.ok(probe.includes('export function probeInPage'), '浏览器侧共享探针须可被两通道导入');

  const contract = await readFile(path.join(CLI_ROOT, 'docs/internal-contracts.md'), 'utf8');
  assert.ok(contract.includes('Kimi WebBridge 默认输出'), '§6.17 须冻结默认适配器');
  assert.ok(contract.includes('`source` 可取 `kimi-webbridge` 或'), '§6.17 须冻结来源枚举');
});

test('A30 设计工序两段化：design-language 资产 + guide 两段式 + go.md 回修分流（防漂移）', async () => {
  // ── 风格推导方法论（D-A30-06/07：不变层 + 观察量 + 推导规则 + 色彩纲领 + 范例）──
  const dl = await readFile(path.join(ADMIN, 'planning/design-language.md'), 'utf8');
  assert.ok(dl.includes('克制的专业工具感'), 'design-language 须写明不变层的一句话骨相');
  assert.ok(dl.includes('不变层'), 'design-language 须有不参与推导的不变层');
  assert.ok(dl.includes('单一品牌色'), '不变层须含单一品牌色准则');
  assert.ok(dl.includes('深色只作「锚」'), '不变层须写明深色只作锚（受库侧浅色裸值限制）');

  // 观察量：8 项且必须挂「禁推断」纪律，否则「需求分析」退化为凭空判断
  for (const o of ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8']) {
    assert.ok(dl.includes(o), `design-language 须含观察量「${o}」`);
  }
  assert.ok(dl.includes('禁推断'), '观察量须复用 planning-guide 的信息源分级纪律');
  assert.ok(dl.includes('pendingConfirm'), '观察量推断项须走 pendingConfirm 裁定');

  // 推导规则：8 条，覆盖 7 条取向轴
  for (const r of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8']) {
    assert.ok(dl.includes(r), `design-language 须含推导规则「${r}」`);
  }
  for (const axis of ['内容密度', '容器化程度', '装饰度', '强调手法', '形状性格', '深色锚', '底色温度']) {
    assert.ok(dl.includes(axis), `design-language 须含取向轴「${axis}」`);
  }
  assert.ok(
    dl.includes('内容密度」与 PDL `density` 不是一回事'),
    'design-language 须区分取向轴内容密度与 PDL density（两者混用即失控）',
  );

  // 色彩纲领 / 旧信号 / 自检 / 产物 / 范例
  assert.ok(dl.includes('相距 ≥ 30°') || dl.includes('相距 ≥30°'), '色彩纲领须给出色相距离判据');
  assert.ok(dl.includes('旧信号'), 'design-language 须含可 grep 的旧信号清单');
  assert.ok(dl.includes('自检判据'), 'design-language 须含定档后的自检判据');
  assert.ok(dl.includes('本项目定档'), 'design-language 须留推导产物落点');
  assert.ok(dl.includes('规则冲突与裁定'), '产物须留规则冲突的裁定位');
  assert.ok(dl.includes('参考范例'), '三套方案须降级为范例');
  assert.ok(dl.includes('不得直接套用'), '范例须显式禁止直接套用（否则退回挑主题）');
  assert.ok(dl.includes('版面模式库'), 'design-language 须含 Stage A 模式库容器');
  assert.ok(dl.includes('出稿提示骨架'), 'design-language 须含出稿提示骨架');

  // ── 模板键与安装落点（D-A30-03）──
  const tpl = JSON.parse(await readFile(path.join(ADMIN, 'template.json'), 'utf8'));
  assert.equal(tpl.planning.designLanguage, 'planning/design-language.md', 'template.json 须声明 designLanguage 键');

  // ── planning-guide 两段式工序 ──
  const guide = await readFile(path.join(ADMIN, 'planning/planning-guide.md'), 'utf8');
  assert.ok(guide.includes('Stage A'), 'planning-guide 须含 Stage A 版面语言段');
  assert.ok(guide.includes('Stage B'), 'planning-guide 须含 Stage B 页面内容稿段');
  assert.ok(guide.includes('先发散实例，再反向提炼语言'), 'A34 改判后 Stage A 须先有优秀实例再抽象规则');
  assert.ok(guide.includes('不负责生成唯一答案'), 'A30 推导规则须重定位为发散边界，不能替用户选唯一主题');
  assert.ok(guide.includes('观察量'), 'planning-guide 须要求先填观察量再推档位');
  assert.ok(guide.includes('design-language.md'), 'planning-guide 须指向设计语言真源文件');
  assert.ok(guide.includes('云端项目是草稿纸'), 'planning-guide 须写明 Stage A 产出固化纪律（D-A30-02）');
  assert.ok(guide.includes('不动壳层'), 'planning-guide 须写明 Stage B 的不越界口径（D-A30-04）');

  // ── go.md 5.2.6 回修分流（版面级 vs 页面级）──
  const goMd = await readFile(path.join(ADMIN, 'workspace/commands/go.md'), 'utf8');
  assert.ok(goMd.includes('回修分流'), 'go.md 5.2.6 须含回修分流');
  assert.ok(goMd.includes('版面级'), 'go.md 须区分版面级不一致');
  assert.ok(goMd.includes('一处修全站'), 'go.md 须写明版面级回 Stage A 一处修全站');

  // ── 任务卡带所属 pattern ──
  const feTpl = await readFile(path.join(ADMIN, 'planning/_template-fe.md'), 'utf8');
  assert.ok(feTpl.includes('所属 pattern'), '_template-fe 须含所属 pattern 行');
});

test('A17/A18 批间连续性：go.md 预算任务计数 + 提交授权 + 合法停点（A17 基线，A18 改阈值与授权口径）', async () => {
  const goMd = await readFile(path.join(ADMIN, 'workspace/commands/go.md'), 'utf8');
  assert.ok(goMd.includes('最多推进 24 个任务'), '会话预算须按任务计数（A18：24 任务/次）');
  assert.ok(!goMd.includes('推进 8 个任务'), 'A17 的 8 任务阈值须由 A18 取代');
  assert.ok(
    !goMd.includes('3 个批次'),
    '批次计数口径须退役——串行批下按批计数会在 3 个任务后过早截断',
  );
  assert.ok(goMd.includes('明确授权'), '检查点提交须声明明确授权口径');
  assert.ok(goMd.includes('不是停点'), '提交受阻不得中断调度（不是停点）');
  assert.ok(goMd.includes('合法停点'), '批间反停顿纪律须有合法停点白名单');
  const constitution = await readFile(path.join(ADMIN, 'workspace/CLAUDE.project.md'), 'utf8');
  assert.ok(constitution.includes('明确授权'), '宪法工作协议须同步提交授权口径');
  assert.ok(constitution.includes('合法停点'), '宪法工作协议须同步停点口径');
});

test('A18 批次调度效率：七条规格的文字资产落位（v2.1-amendments A18 验收判据镜像）', async () => {
  const goMd = await readFile(path.join(ADMIN, 'workspace/commands/go.md'), 'utf8');
  // 6）提交授权改显式 flag
  assert.ok(goMd.includes('--commit'), 'go.md 须声明 --commit 显式提交授权');
  assert.ok(goMd.includes('完全不碰 git'), '不带 --commit 时须明确「完全不碰 git」');
  // 3）同层子批流水线化
  assert.ok(goMd.includes('level'), 'go.md 须用 batch-plan 的 level 字段做流水线化判据');
  assert.ok(goMd.includes('流水线化'), 'go.md 须写明同层子批流水线化派发');
  // 5）预算前提与续跑提示
  assert.ok(goMd.includes('/clear'), '预算耗尽的续跑提示须改为先 /clear 再 /go');
  // 7）停因落盘 + Stop hook 续跑器
  assert.ok(goMd.includes('go-state.json'), 'go.md 须要求每次结束回合前落盘停因');
  for (const reason of ['in-progress', 'budget', 'terminal', 'gate', 'user']) {
    assert.ok(goMd.includes(reason), `go.md 须登记 stopReason 取值「${reason}」`);
  }

  // 5）回传摘要上限——两个角色模板都要有，否则预算放大失去前提
  for (const role of ['vima-builder.md', 'vima-verifier.md']) {
    const text = await readFile(path.join(ADMIN, 'workspace/agents', role), 'utf8');
    assert.ok(text.includes('≤ 15 行'), `${role} 须规定回传摘要 ≤ 15 行`);
  }

  // 7）Stop hook 注册与实现
  const settings = JSON.parse(await readFile(path.join(ADMIN, 'workspace/settings.json'), 'utf8'));
  const stopCmds = (settings.hooks?.Stop ?? []).flatMap((g) => (g.hooks ?? []).map((h) => h.command));
  assert.ok(
    stopCmds.some((c) => c.includes('go-continue.mjs')),
    'settings.json 须注册 Stop hook go-continue.mjs',
  );
  const hook = await readFile(path.join(ADMIN, 'workspace/hooks/go-continue.mjs'), 'utf8');
  assert.ok(hook.includes('in-progress'), '续跑器须只在 stopReason=in-progress 时阻止停轮');
  assert.ok(hook.includes('MAX_CONSECUTIVE_RESUMES'), '续跑器须带连续续跑上限兜底');

  // 2）前端默认依赖对调
  const guide = await readFile(path.join(ADMIN, 'planning/planning-guide.md'), 'utf8');
  assert.ok(guide.includes('默认前端仅依赖 shared-base'), 'planning-guide 须把前端默认依赖改为仅 shared-base');
  // 1）规模上限与负责接口集
  assert.ok(guide.includes('V-TASK-11'), 'planning-guide 拆解节拍须引用规模上限机检');
  const beTpl = await readFile(path.join(ADMIN, 'planning/_template-be.md'), 'utf8');
  assert.ok(beTpl.includes('apis'), '_template-be 须说明 apis 负责接口集字段');
  const checklist = await readFile(path.join(ADMIN, 'planning/validate.checklist.md'), 'utf8');
  for (const rule of ['V-TASK-11', 'V-TASK-12']) {
    assert.ok(checklist.includes(rule), `validate.checklist 须逐条镜像 ${rule}`);
  }
});

test('A20 收敛期：收口闸门 + 收尾流水线模板 + 规则镜像（v2.1-amendments A20 验收判据镜像）', async () => {
  // 2）收口闸门写进 go.md 步骤 5
  const goMd = await readFile(path.join(ADMIN, 'workspace/commands/go.md'), 'utf8');
  assert.ok(goMd.includes('vima converge'), 'go.md 步骤 5 须调用 vima converge');
  assert.ok(goMd.includes('收口闸门'), 'go.md 须以「收口闸门」命名步骤 5');
  assert.ok(goMd.includes('byTask'), '修复轮次须按报告 byTask 归组派发（确定性归属）');
  assert.ok(goMd.includes('最多 3 轮'), '收敛循环须有轮次上限');
  assert.ok(
    !/所有任务 done 且流水线（layer=pipeline）任务全部通过 →\n\s*更新 lifecycle/.test(goMd),
    '旧的「直接进 MAINTAINING」写法须被收口闸门取代',
  );
  // 4）/check 收敛栏
  const checkMd = await readFile(path.join(ADMIN, 'workspace/commands/check.md'), 'utf8');
  assert.ok(checkMd.includes('converge'), 'check.md 须输出集成对账栏');
  // 修复轮标注归属（sustain-v3 实战反馈 F5：Builder 会自造假 taskId 被 trace 判野生）
  assert.ok(
    /不得新造 taskId/.test(goMd),
    'go.md 修复轮须禁止新造 taskId（否则追溯链上多一个查不到出处的洞）',
  );
  const builder = await readFile(path.join(ADMIN, 'workspace/agents/vima-builder.md'), 'utf8');
  assert.ok(/不得新造 taskId/.test(builder), 'vima-builder 须镜像修复轮标注归属规则');
  assert.ok(builder.includes('convergence.json'), 'vima-builder 须知道收口闸门修复读哪份报告');
  // 宪法同步（否则维护期 Agent 不知道 done ≠ 完成）
  const constitution = await readFile(path.join(ADMIN, 'workspace/CLAUDE.project.md'), 'utf8');
  assert.ok(constitution.includes('收口闸门'), '宪法工作协议须同步收口闸门口径');

  // 3）收尾流水线任务模板存在、进 taskTemplates、planning-guide 强制生成
  const tpl = JSON.parse(await readFile(path.join(ADMIN, 'template.json'), 'utf8'));
  for (const rel of ['planning/_template-full-test.md', 'planning/_template-code-audit.md']) {
    assert.ok(
      tpl.planning.taskTemplates.includes(rel),
      `template.json planning.taskTemplates 须含 ${rel}（否则 init 不会安装）`,
    );
    const text = await readFile(path.join(ADMIN, rel), 'utf8');
    assert.ok(text.includes('layer: pipeline'), `${rel} 须是 layer=pipeline 任务`);
  }
  const guide = await readFile(path.join(ADMIN, 'planning/planning-guide.md'), 'utf8');
  assert.ok(guide.includes('full-test'), 'planning-guide 任务拆解须要求生成 full-test');
  assert.ok(guide.includes('code-audit'), 'planning-guide 任务拆解须要求生成 code-audit');

  // 1/3）规则镜像：checklist 逐条登记 V-INT 族与 V-TASK-13
  const checklist = await readFile(path.join(ADMIN, 'planning/validate.checklist.md'), 'utf8');
  for (const rule of ['V-INT-01', 'V-INT-02', 'V-INT-03', 'V-INT-04', 'V-INT-05', 'V-TASK-13']) {
    assert.ok(checklist.includes(rule), `validate.checklist 须逐条镜像 ${rule}`);
  }
});

test('A31/A32/A33：变更事务纪律、交付等级口径与规则镜像落位（增补项验收判据镜像）', async () => {
  // A31：宪法的维护期条目须走变更事务，而不再是散文式「先改 spec 再改代码」
  const constitution = await readFile(path.join(ADMIN, 'workspace/CLAUDE.project.md'), 'utf8');
  assert.ok(constitution.includes('vima change open'), '宪法维护期条目须接 vima change');
  assert.ok(constitution.includes('vima change close'), '须写明关闭闸门这一步');
  assert.ok(
    /闸门不过|未传播完/.test(constitution),
    '闸门语义必须写明——否则 Agent 会把「改完代码」当成变更结束',
  );

  // A32：完成报告须用 certify 的等级词，且不得把 pipeline-green 说成可部署/稳定
  const goMd = await readFile(path.join(ADMIN, 'workspace/commands/go.md'), 'utf8');
  assert.ok(goMd.includes('vima certify'), 'go.md 完成报告须跑 vima certify');
  assert.ok(
    /不得把它说成「可部署 \/ 稳定运行」|不采集也不认证/.test(goMd),
    '显式非宣称是 A32 的灵魂，必须写进工作流资产',
  );

  // A33：规则镜像
  const checklist = await readFile(path.join(ADMIN, 'planning/validate.checklist.md'), 'utf8');
  for (const rule of ['V-SPEC-17', 'V-SPEC-18']) {
    assert.ok(checklist.includes(rule), `validate.checklist 须逐条镜像 ${rule}`);
  }
});

test('A21 经验反哺：go.md 步骤 6 询问环节落位（v2.1-amendments A21 验收判据镜像）', async () => {
  const goMd = await readFile(path.join(ADMIN, 'workspace/commands/go.md'), 'utf8');
  assert.ok(goMd.includes('vima retro'), 'go.md 步骤 6 须调用 vima retro');
  assert.ok(
    goMd.includes('想表达但框架表达不了'),
    '表达力缺口是 CLI 采不到、只有人知道的一问（A14/A16 的来源），必须留在询问里',
  );
  assert.ok(goMd.includes('gh issue create'), '同意反哺后须给出实际提交命令');
  assert.ok(goMd.includes('retro-state'), '须记录已询问，拒绝后不重复骚扰');
  assert.ok(goMd.includes('不静默失败'), 'gh 不在场时须降级为打印命令而非静默吞掉');
  assert.ok(
    /不.{0,6}代劳|不代为提 PR/.test(goMd),
    'PR 不由项目侧 Agent 代劳（仓库纪律：不执行真实 git push）',
  );
});

test('A34 经验反哺：实测交互决策只经用户确认写回 interaction-language', async () => {
  const goMd = await readFile(path.join(ADMIN, 'workspace/commands/go.md'), 'utf8');
  assert.match(goMd, /值得保留到后续维护的交互决策/);
  assert.match(goMd, /docs\/interaction-language\.md/);
  assert.match(goMd, /来源: retro/);
  assert.match(goMd, /没有用户确认就不得凭空追加/);
});

test('A22 字段级机检：规则镜像与规划引导落位（v2.1-amendments A22 验收判据镜像）', async () => {
  const checklist = await readFile(path.join(ADMIN, 'planning/validate.checklist.md'), 'utf8');
  for (const rule of ['V-SPEC-15', 'V-SPEC-16', 'V-CON-08', 'V-CON-09']) {
    assert.ok(checklist.includes(rule), `validate.checklist 须逐条镜像 ${rule}`);
  }
  // 误报边界必须写进 checklist——这四条规则的成败全在边界上（实测 54→32→13 前两个都是错的）
  assert.ok(checklist.includes('三条排除项'), 'V-SPEC-15 的排除项须可查');
  assert.ok(/只查「只进」方向/.test(checklist), 'V-CON-08 须写明只查一个方向及其理由');

  const guide = await readFile(path.join(ADMIN, 'planning/planning-guide.md'), 'utf8');
  assert.ok(guide.includes('弹窗字段必须与提交端点入参对齐'), 'planning-guide 须引导弹窗字段对齐');
  assert.ok(guide.includes('params'), 'planning-guide 须引导导航参数取值域');

  const example = await readFile(path.join(ADMIN, 'planning/contract.example.md'), 'utf8');
  for (const key of ['writeOnly', 'readOnly', 'enforced: false']) {
    assert.ok(example.includes(key), `contract.example 须示范可选键 ${key}`);
  }
});

test('A24 工具可信度与项目定制：文字资产落位（v2.1-amendments A24 验收判据镜像）', async () => {
  const goMd = await readFile(path.join(ADMIN, 'workspace/commands/go.md'), 'utf8');
  // F6：合法停点举例补全（不新增 stopReason 取值，只补举例——A17 白名单③已覆盖语义）
  assert.ok(goMd.includes('无其他可派批次'), 'go.md 停点举例须含「依赖未满足且无其他可派批次」');
  assert.ok(!goMd.includes('blocked-by-barrier'), '不得新增 stopReason 取值（gate 已够用）');
  // F7：预算与并行度的整除关系
  assert.ok(goMd.includes('floor(24'), 'go.md 须写明预算与 maxParallel 的整除关系');

  // 六：并发写策略只此一处官方口径，且指向 A8 就有的 conflictsWith
  const guide = await readFile(path.join(ADMIN, 'planning/planning-guide.md'), 'utf8');
  assert.ok(guide.includes('conflictsWith'), 'planning-guide 须引导用 conflictsWith 排开抢文件的任务');
  const std = await readFile(path.join(ADMIN, 'planning/coding-standards.md'), 'utf8');
  assert.ok(/追加，不要整体覆盖/.test(std), '编码规范须给出官方并发写策略');
  assert.ok(std.includes('conflictsWith'), '并发写策略须给出「不同批」这条出路');
  // F9：受管文件里指路到不受管的项目追加区
  assert.ok(std.includes('coding-standards.local.md'), '受管规范须指路 local 追加区');

  // 三：冷启动断言口径（降级为 pipeline 验收项，不做成 CLI 规则）
  const fullTest = await readFile(path.join(ADMIN, 'planning/_template-full-test.md'), 'utf8');
  assert.ok(fullTest.includes('能解析出全部'), 'full-test 须固化「A 跑完后 B 能解析出全部 N 条」的断言口径');
  assert.ok(fullTest.includes('空库'), 'full-test 须要求空库冷启动验证');
});

test('A9/A10/A11 吸收项满足验收 grep 判据（v2.1-amendments A9–A11，mattpocock 对标）', async () => {
  // A9 提问三规则：planning-guide §5 + vima-planner 镜像
  const guide = await readFile(path.join(ADMIN, 'planning/planning-guide.md'), 'utf8');
  for (const kw of ['先查后问', '推荐答案', '前置未定不问']) {
    assert.ok(guide.includes(kw), `planning-guide.md 须含提问规则「${kw}」`);
  }
  const planner = await readFile(path.join(ADMIN, 'workspace/agents/vima-planner.md'), 'utf8');
  assert.ok(planner.includes('推荐答案'), 'vima-planner.md 须镜像提问三规则（每问必附推荐答案）');

  // A10 同构断言禁令：coding-standards 后端节〔L5·verifier〕+ _template-be 步骤措辞
  const standards = await readFile(path.join(ADMIN, 'planning/coding-standards.md'), 'utf8');
  assert.ok(standards.includes('独立事实源'), 'coding-standards 须要求期望值来自独立事实源');
  assert.ok(standards.includes('同构'), 'coding-standards 须点名同构断言');
  const beTpl = await readFile(path.join(ADMIN, 'planning/_template-be.md'), 'utf8');
  assert.ok(beTpl.includes('独立事实源'), '_template-be 步骤 5 须提示期望值来源');

  // A11 红绿修复纪律：CLAUDE.project.md 工作协议
  const claude = await readFile(path.join(ADMIN, 'workspace/CLAUDE.project.md'), 'utf8');
  assert.ok(claude.includes('跑红'), 'CLAUDE.project.md 须要求先固化能跑红的命令');
  assert.ok(claude.includes('转绿'), 'CLAUDE.project.md 修复判定须为同一命令转绿');

  // A12 原型先行节拍：planning-guide §5 里程碑 2 逐模块「草→渲→看→定」
  assert.ok(guide.includes('草→渲→看→定'), 'planning-guide 须含 A12 节拍');
  assert.ok(guide.includes('在原型上看过并确认'), 'A12 页面对齐完成判据 = 用户在原型上看过并确认');
});

test('guard-shared.mjs 回退保护面与 template.json 端册 sharedDirs 逐项同步（契约 §6.3/A16 单一真源）', async () => {
  const guard = await readFile(path.join(ADMIN, 'workspace/hooks/guard-shared.mjs'), 'utf8');
  const tpl = JSON.parse(await readFile(path.join(ADMIN, 'template.json'), 'utf8'));
  const fe = /const frontendShared = \[([^\]]*)\]/.exec(guard);
  const be = /const backendShared = \[([^\]]*)\]/.exec(guard);
  assert.ok(fe && be, 'guard 脚本须含 frontendShared/backendShared 数组字面量（v1 manifest 回退面）');
  const parse = (m) =>
    m[1]
      .split(',')
      .map((x) => x.trim().replace(/^"(.*)"$/, '$1'))
      .filter(Boolean);
  const guardFe = parse(fe).map((d) => d.replace(/\/$/, ''));
  const guardBe = parse(be).map((d) => d.replaceAll('/', ''));
  // A16 新形态：guard 的 v1 回退字面量 = default 端（admin）的 sharedDirs + backend 末段
  const defaultApp = (tpl.apps ?? []).find((a) => a.default === true) ?? (tpl.apps ?? [])[0];
  const sharedFe = defaultApp?.sharedDirs ?? [];
  const sharedBe = (tpl.backend?.sharedDirs ?? []).map((d) => d.split('/').at(-1));
  assert.deepEqual([...guardFe].sort(), [...sharedFe].sort(), '前端回退保护面必须与端册 sharedDirs 一致');
  assert.deepEqual([...guardBe].sort(), [...sharedBe].sort(), '后端回退保护面必须与 backend.sharedDirs 一致');
});

test('红线文案与 sharedDirs 同步：CLAUDE.project.md 与 vima-builder.md 覆盖全部前端共享目录', async () => {
  const tpl = JSON.parse(await readFile(path.join(ADMIN, 'template.json'), 'utf8'));
  const defaultApp = (tpl.apps ?? []).find((a) => a.default === true) ?? (tpl.apps ?? [])[0];
  const sharedFe = defaultApp?.sharedDirs ?? [];
  for (const rel of ['workspace/CLAUDE.project.md', 'workspace/agents/vima-builder.md', 'workspace/AGENTS.project.md']) {
    const text = await readFile(path.join(ADMIN, rel), 'utf8');
    for (const dir of sharedFe) {
      assert.ok(text.includes(`${dir}/`), `${rel} 红线文案缺少共享目录 ${dir}/`);
    }
  }
});

test('全部模板 status ∈ {stable, preview} 且 admin=stable（A5 自洽）', async () => {
  const dir = path.join(CLI_ROOT, 'templates');
  const ids = (await readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  assert.ok(ids.length >= 5, `模板数异常: ${ids.join(',')}`);
  for (const id of ids) {
    const tpl = JSON.parse(await readFile(path.join(dir, id, 'template.json'), 'utf8'));
    assert.ok(['stable', 'preview'].includes(tpl.status), `模板 ${id} 的 status 非法: "${tpl.status}"`);
  }
  const admin = JSON.parse(await readFile(path.join(ADMIN, 'template.json'), 'utf8'));
  assert.equal(admin.status, 'stable');
});

test('coding-standards 资产存在、被 planning 声明，CLAUDE.project.md 指针不悬空（§5.2）', async () => {
  const tpl = JSON.parse(await readFile(path.join(ADMIN, 'template.json'), 'utf8'));
  assert.equal(tpl.planning.codingStandards, 'planning/coding-standards.md');
  const text = await readFile(path.join(ADMIN, tpl.planning.codingStandards), 'utf8');
  assert.match(text, /编码规范/);
  const claude = await readFile(path.join(ADMIN, 'workspace/CLAUDE.project.md'), 'utf8');
  assert.ok(claude.includes('docs/coding-standards.md'), 'CLAUDE.project.md 的详细规范指针应指向已安装资产');
});

// ── post-write.mjs 区块标记机械对账 + A6 机检（§13.3 hook 半，契约 §14）──

const HOOK = path.join(ADMIN, 'workspace/hooks/post-write.mjs');

async function markerProject(t, manifest) {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-d2-marker-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  // A40：hook 只在「确实是 vima 项目」的树里动作（判据 .vima/ 或 docs/lifecycle.json），
  // 落空即放行。夹具因此必须带项目标记——否则测的是「不在项目里」这个无关分支。
  await mkdir(path.join(root, '.vima'), { recursive: true });
  await mkdir(path.join(root, 'src/views'), { recursive: true });
  if (manifest) {
    await mkdir(path.join(root, 'docs/review'), { recursive: true });
    await writeFile(path.join(root, 'docs/review/prototype.manifest.json'), JSON.stringify(manifest));
  }
  return root;
}

function runHook(root, relFile) {
  const input = JSON.stringify({ cwd: root, tool_input: { file_path: relFile } });
  return spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8' });
}

const MANIFEST = { pages: [{ id: 'PAGE-01', layout: ['search', 'table'], modals: [{ id: 'MODAL-01' }] }] };

test('区块标记对账：标记齐全 → 放行；缺区块/缺弹窗 → exit 2 且指名', async (t) => {
  const root = await markerProject(t, MANIFEST);
  await writeFile(path.join(root, 'src/views/ok.vue'),
    '<template><div class="vui-page" data-page="PAGE-01"><div data-block="search"/><div data-block="table"/><M data-modal="MODAL-01"/></div></template>');
  assert.equal(runHook(root, 'src/views/ok.vue').status, 0);

  await writeFile(path.join(root, 'src/views/miss.vue'),
    '<template><div class="vui-page" data-page="PAGE-01"><div data-block="search"/></div></template>');
  const r = runHook(root, 'src/views/miss.vue');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /data-block：table/);
  assert.match(r.stderr, /data-modal：MODAL-01/);
});

test('区块标记对账：设计外区块 / 未知页面 → exit 2；无 data-page 或无 manifest → 跳过', async (t) => {
  const root = await markerProject(t, MANIFEST);
  await writeFile(path.join(root, 'src/views/extra.vue'),
    '<template><div class="vui-page" data-page="PAGE-01"><div data-block="search"/><div data-block="table"/><div data-block="cards"/><M data-modal="MODAL-01"/></div></template>');
  const r1 = runHook(root, 'src/views/extra.vue');
  assert.equal(r1.status, 2);
  assert.match(r1.stderr, /设计外区块.*cards/);

  await writeFile(path.join(root, 'src/views/ghost.vue'), '<template><div class="vui-page" data-page="PAGE-99"/></template>');
  const r2 = runHook(root, 'src/views/ghost.vue');
  assert.equal(r2.status, 2);
  assert.match(r2.stderr, /无此页面/);

  await writeFile(path.join(root, 'src/views/part.vue'), '<template><div class="x"/></template>');
  assert.equal(runHook(root, 'src/views/part.vue').status, 0, '无 data-page 的普通组件不参与对账');

  const bare = await markerProject(t, null);
  await writeFile(path.join(bare, 'src/views/a.vue'),
    '<template><div class="vui-page" data-page="PAGE-01"><div data-block="search"/></div></template>');
  assert.equal(runHook(bare, 'src/views/a.vue').status, 0, 'manifest 未渲染时静默跳过');
});

// ── A6 机检扩展（规范执行者阶梯：post-write 新增检查，契约 §14）──

test('A6 机检：幻包名导入 / 缺 vui-page / 字面量色值 / 操作列手写 width → exit 2 且逐项指名', async (t) => {
  const root = await markerProject(t, MANIFEST);

  await writeFile(path.join(root, 'src/views/bad-import.ts'), "import { layer } from '@vima/ui'\n");
  const r0 = runHook(root, 'src/views/bad-import.ts');
  assert.equal(r0.status, 2);
  assert.match(r0.stderr, /@vima\/ui/);

  await writeFile(path.join(root, 'src/views/bad-page.vue'), [
    '<template><div data-page="PAGE-01"><div data-block="search"/><div data-block="table"/><M data-modal="MODAL-01"/></div></template>',
    '<script setup lang="ts">',
    "const columns = [{ title: '操作', key: 'operator', width: 230, customSlot: 'operator' }]",
    '</script>',
    '<style scoped>.a { color: #ff0000; }</style>',
  ].join('\n'));
  const r1 = runHook(root, 'src/views/bad-page.vue');
  assert.equal(r1.status, 2);
  assert.match(r1.stderr, /vui-page/);
  assert.match(r1.stderr, /字面量色值/);
  assert.match(r1.stderr, /操作列手写了字面量 width/);
});

test('A6 机检：合规业务页放行（--x 定义行豁免 + 操作列无 width + 「操作时间」定宽列不误伤）；杜撰图标名拦截', async (t) => {
  const root = await markerProject(t, MANIFEST);
  await mkdir(path.join(root, 'vendor/vima-ui-admin/dist'), { recursive: true });
  await writeFile(
    path.join(root, 'vendor/vima-ui-admin/dist/ai-manifest.json'),
    JSON.stringify({ icons: [{ name: 'alert', aliases: ['warning'] }, 'search'] }),
  );

  const good = [
    '<template><div class="vui-page" data-page="PAGE-01"><div data-block="search"><VIcon name="search" /></div><div data-block="table"/><M data-modal="MODAL-01"/></div></template>',
    '<script setup lang="ts">',
    'const columns = [',
    "  { key: 'operTime', title: '操作时间', width: 170 },",
    "  { title: '操作', key: 'operator', customSlot: 'operator' },",
    ']',
    '</script>',
    '<style scoped>.p { --local-accent: #ff0000; color: var(--local-accent); border-color: var(--v-border); }</style>',
  ].join('\n');
  await writeFile(path.join(root, 'src/views/good.vue'), good);
  const rOk = runHook(root, 'src/views/good.vue');
  assert.equal(rOk.status, 0, rOk.stderr);

  await writeFile(path.join(root, 'src/views/bad-icon.vue'), good.replace('name="search"', 'name="ghost-icon"'));
  const rBad = runHook(root, 'src/views/bad-icon.vue');
  assert.equal(rBad.status, 2);
  assert.match(rBad.stderr, /ghost-icon/);
  assert.match(rBad.stderr, /近似候选：/, 'A8：拦截时须按编辑距离给近似候选');
});

test('任务点台账三件套的文字资产落位（B1/B2，契约 §6.9）', async () => {
  const verifier = await readFile(path.join(ADMIN, 'workspace/agents/vima-verifier.md'), 'utf8');
  assert.ok(verifier.includes('"points"'), 'verifier 报告格式须含 points 字段');
  assert.ok(verifier.includes('逐点展开'), 'verifier 须要求把 manifest 页条目逐点展开');
  assert.ok(verifier.includes('不得把整页折叠成一条结论'), '禁止整页折叠');
  const check = await readFile(path.join(ADMIN, 'workspace/commands/check.md'), 'utf8');
  assert.ok(check.includes('任务点完成度'), '/check 须含任务点完成度信号');
  assert.ok(check.includes('verifier.json'), '/check 须从 verifier 报告聚合');
});

test('waived 豁免语义的文字资产落位（A8，契约 §6.9）', async () => {
  const verifier = await readFile(path.join(ADMIN, 'workspace/agents/vima-verifier.md'), 'utf8');
  assert.ok(verifier.includes('waived'), 'verifier 报告格式须含 waived 字段');
  assert.ok(verifier.includes('不得自行发明豁免'), '豁免必须来自用户裁定');
  assert.ok(verifier.includes('reason'), '豁免必须带 reason');
  const check = await readFile(path.join(ADMIN, 'workspace/commands/check.md'), 'utf8');
  assert.ok(check.includes('豁免'), '/check 须按 通过/豁免/未过 三分计数');
});

test('vima context 集成的文字资产落位（A8）：go.md 派发前打包、builder 第一必读', async () => {
  const goMd = await readFile(path.join(ADMIN, 'workspace/commands/go.md'), 'utf8');
  assert.ok(goMd.includes('vima context'), 'go.md 派发批次前须运行 vima context');
  const builder = await readFile(path.join(ADMIN, 'workspace/agents/vima-builder.md'), 'utf8');
  assert.ok(builder.includes('.vima/context/'), 'builder 须以上下文包为第一必读');
});

test('A13 规格边界机检：planning-guide 终点清单 H + vima-verifier 规则/越界纪律（v2.1-amendments A13）', async () => {
  const guide = await readFile(path.join(ADMIN, 'planning/planning-guide.md'), 'utf8');
  assert.ok(guide.includes('A–H'), '终点清单须扩为 A–H（新增本期不做）');
  assert.ok(guide.includes('vima:rules'), 'planning-guide 须要求业务规则写入 vima:rules 块');
  assert.ok(guide.includes('本期不做'), 'planning-guide 须含终点清单 H 本期不做');
  assert.ok(guide.includes('non-goals: []'), '须写明「确实没有也要显式写空数组」');

  const verifier = await readFile(path.join(ADMIN, 'workspace/agents/vima-verifier.md'), 'utf8');
  assert.ok(verifier.includes('RULE-'), 'vima-verifier 须逐条核对 RULE-xx');
  assert.ok(verifier.includes('本期不做'), 'vima-verifier 须做 non-goals 越界判定');
  assert.ok(verifier.includes('越界不适用 waived'), '越界不得走豁免（边界真源是 spec 而非对话）');

  // spec 骨架：第五章 rules 块 + 第九章 non-goals 块，且章标题纪律同步为九章
  const skeleton = await readFile(path.join(ADMIN, 'planning/spec.admin.md'), 'utf8');
  assert.ok(skeleton.includes('```yaml vima:rules'), 'spec 骨架第五章须预置 vima:rules 块');
  assert.ok(skeleton.includes('## 9. 本期不做'), 'spec 骨架须含第九章');
  assert.ok(skeleton.includes('```yaml vima:non-goals'), 'spec 骨架第九章须预置 vima:non-goals 块');
  assert.ok(skeleton.includes('九个章标题一字不改'), '骨架填充纪律须同步为九章');

  // checklist 逐条镜像新规则编号（契约 §8 的 D1 镜像纪律）
  const checklist = await readFile(path.join(ADMIN, 'planning/validate.checklist.md'), 'utf8');
  for (const rule of ['V-SPEC-09', 'V-SPEC-10', 'V-SPEC-11']) {
    assert.ok(checklist.includes(rule), `validate.checklist 须镜像 ${rule}`);
  }
  assert.ok(checklist.includes('## 9. 本期不做'), 'checklist 的 V-SPEC-01 章节表须同步为九章');
});

test('A13 消费端接线不漏：builder 包内分节枚举与 check 聚合口径同步（防半截实现）', async () => {
  const builder = await readFile(path.join(ADMIN, 'workspace/agents/vima-builder.md'), 'utf8');
  assert.ok(builder.includes('业务规则切片'), 'vima-builder 的上下文包分节枚举须含业务规则切片');
  assert.ok(builder.includes('本期不做'), 'vima-builder 的上下文包分节枚举须含本期不做');
  assert.ok(builder.includes('顺便也支持一下'), 'builder 须被明确告知越界红线');

  const check = await readFile(path.join(ADMIN, 'workspace/commands/check.md'), 'utf8');
  assert.ok(check.includes('RULE-'), '/check 聚合口径须覆盖规则点');
  assert.ok(check.includes('越界'), '/check 须单列越界项');
});

// ── A16 端册化 hooks：guard-shared 读 manifest 端册；post-write 多端归属 + 新形态对账 ──

const GUARD = path.join(ADMIN, 'workspace/hooks/guard-shared.mjs');

function runGuard(root, relFile) {
  const input = JSON.stringify({ cwd: root, tool_input: { file_path: relFile } });
  return spawnSync(process.execPath, [GUARD], { input, encoding: 'utf8' });
}

const MULTI_VIMA_MANIFEST = {
  schemaVersion: '2',
  templateId: 'admin',
  apps: [
    { id: 'admin', kind: 'admin-web', dir: '.', codeDir: 'src', sharedDirs: ['src/components', 'src/utils', 'vendor'] },
    { id: 'patient', kind: 'mp-native', dir: 'apps/patient', codeDir: 'src', sharedDirs: ['src/components', 'src/utils'] },
  ],
  backend: { dir: 'backend', sharedDirs: ['src/main/java/demo/config', 'src/main/java/demo/security'] },
};

test('guard-shared A16：端册面拦 apps/<id>/ 共享层；无令牌 exit 2、业务目录放行；v1 回退面仍拦 src/', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-d2-guard-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.vima'), { recursive: true });
  await writeFile(path.join(root, '.vima/manifest.json'), JSON.stringify(MULTI_VIMA_MANIFEST));
  // 患者端共享层无令牌 → 拦
  assert.equal(runGuard(root, 'apps/patient/src/components/Btn.ts').status, 2, '患者端共享层应被拦');
  // admin 端（根布局）共享层 → 拦；后端 security → 拦
  assert.equal(runGuard(root, 'src/utils/request.ts').status, 2);
  assert.equal(runGuard(root, 'backend/src/main/java/demo/security/Token.java').status, 2);
  // 业务目录 → 放行
  assert.equal(runGuard(root, 'apps/patient/src/pages/booking.ts').status, 0, '业务目录应放行');
  assert.equal(runGuard(root, 'src/views/list.vue').status, 0);
  // v1 manifest（无 apps）→ 回退字面量面
  await writeFile(path.join(root, '.vima/manifest.json'), JSON.stringify({ schemaVersion: '1', templateId: 'admin' }));
  assert.equal(runGuard(root, 'src/components/X.vue').status, 2, 'v1 回退面仍拦 src/components');
  assert.equal(runGuard(root, 'apps/patient/src/components/Btn.ts').status, 0, 'v1 面不认 apps/（诚实回退）');
});

test('A37 证据边界：Agent 的 Write/Edit 不能直接篡改 journal 账本', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-d2-journal-guard-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.vima'), { recursive: true }); // A40 项目标记
  const blocked = runGuard(root, '.vima/reports/journal.jsonl');
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /过程账本写保护/);
  assert.equal(runGuard(root, '.vima/reports/task-1-verifier.json').status, 0, '报告仍由 verifier Agent 正常产出');
});

test('A37 report 采集：拒绝空壳/冒名 pass，并按完整报告内容而非 result 字符串裁定事件', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-d2-report-evidence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.vima/reports'), { recursive: true });
  const report = path.join(root, '.vima/reports/task-1-verifier.json');
  const journal = path.join(root, '.vima/reports/journal.jsonl');

  await writeFile(report, JSON.stringify({ result: 'pass' }));
  assert.equal(runHook(root, '.vima/reports/task-1-verifier.json').status, 0);
  await assert.rejects(readFile(journal, 'utf8'), { code: 'ENOENT' }, '空壳 pass 不得生成证据');

  const base = {
    taskId: 'task-1', round: 1, result: 'pass', checklist: [],
    points: [{ point: 'A', passed: false }], missing: [], contractViolations: [],
  };
  await writeFile(report, JSON.stringify(base));
  runHook(root, '.vima/reports/task-1-verifier.json');
  let rows = (await readFile(journal, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(rows.at(-1).outcome, 'fail', 'result=pass 不能覆盖未通过点位');

  await writeFile(report, JSON.stringify({
    ...base,
    round: 2,
    points: [{ point: 'A', passed: false, waived: true, reason: '用户明确裁定' }],
  }));
  runHook(root, '.vima/reports/task-1-verifier.json');
  rows = (await readFile(journal, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(rows.at(-1).outcome, 'pass', '合法 waived 不应被误算为 fail');
});

test('post-write A16/A23：多端业务代码不逃逸机检；admin-web 与 mp-native 各查各的规范面', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-d2-pw-multi-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'apps/patient/src/pages'), { recursive: true });
  await mkdir(path.join(root, 'src/views'), { recursive: true });
  await mkdir(path.join(root, '.vima'), { recursive: true });
  await mkdir(path.join(root, 'docs/review'), { recursive: true });
  await writeFile(path.join(root, '.vima/manifest.json'), JSON.stringify(MULTI_VIMA_MANIFEST));

  // ── admin-web 端（根布局）：幻包名导入 → exit 2（端册化后机检面不失覆盖，A16 回测缺口②）
  await writeFile(path.join(root, 'src/views/bad.ts'), "import { x } from '@vima/ui';\n");
  const rAdmin = runHook(root, 'src/views/bad.ts');
  assert.equal(rAdmin.status, 2, `stderr: ${rAdmin.stderr}`);
  assert.match(rAdmin.stderr, /幻包名/);

  // ── mp-native 端：Vue 那套规范不适用（该端没有 @vima/ui 这个概念），不误报
  await writeFile(path.join(root, 'apps/patient/src/pages/note.ts'), "// 患者端普通 ts\n");
  assert.equal(runHook(root, 'apps/patient/src/pages/note.ts').status, 0, 'mp 端不应套用 Vue 规范');

  // ── mp-native 端专属：页面根缺 vm-page → exit 2（A23）
  await writeFile(path.join(root, 'apps/patient/src/pages/p11.wxml'),
    '<view data-page="PAGE-11"><view data-block="banner"></view></view>');
  const rNoRoot = runHook(root, 'apps/patient/src/pages/p11.wxml');
  assert.equal(rNoRoot.status, 2, `stderr: ${rNoRoot.stderr}`);
  assert.match(rNoRoot.stderr, /页面根缺少 vm-page 类/);

  // ── mp-native 端专属：.wxss 裸色值 → exit 2；令牌写法放行（A23）
  await writeFile(path.join(root, 'apps/patient/src/pages/p11.wxss'), '.x { color: #ff0000; }\n');
  const rColor = runHook(root, 'apps/patient/src/pages/p11.wxss');
  assert.equal(rColor.status, 2, `stderr: ${rColor.stderr}`);
  assert.match(rColor.stderr, /字面量色值/);
  await writeFile(path.join(root, 'apps/patient/src/pages/p11.wxss'), '.x { color: var(--vm-primary); }\n');
  assert.equal(runHook(root, 'apps/patient/src/pages/p11.wxss').status, 0);

  // ── vendor 是共享层（guard-shared 已挡写），post-write 跳过，不报两套话
  await mkdir(path.join(root, 'apps/patient/src/vendor/vima-ui-mp/dist'), { recursive: true });
  await writeFile(path.join(root, 'apps/patient/src/vendor/vima-ui-mp/dist/t.wxss'), 'page { color: #123456; }\n');
  assert.equal(runHook(root, 'apps/patient/src/vendor/vima-ui-mp/dist/t.wxss').status, 0, 'vendor 应跳过');

  // ── 新形态 manifest（顶层 apps map）区块对账：.wxml 缺 data-block → exit 2
  await writeFile(path.join(root, 'docs/review/prototype.manifest.json'), JSON.stringify({
    schemaVersion: '1',
    apps: { patient: { pages: [{ id: 'PAGE-11', layout: ['banner', 'form'], modals: [] }] } },
  }));
  await writeFile(path.join(root, 'apps/patient/src/pages/p11.wxml'),
    '<view class="vm-page" data-page="PAGE-11"><view data-block="banner"></view></view>');
  const r2 = runHook(root, 'apps/patient/src/pages/p11.wxml');
  assert.equal(r2.status, 2, `stderr: ${r2.stderr}`);
  assert.match(r2.stderr, /缺区块标记 data-block：form/);
  // 标记齐全 → 放行
  await writeFile(path.join(root, 'apps/patient/src/pages/p11.wxml'),
    '<view class="vm-page" data-page="PAGE-11"><view data-block="banner"></view><view data-block="form"></view></view>');
  assert.equal(runHook(root, 'apps/patient/src/pages/p11.wxml').status, 0);
});

test('post-write 规范面按 kind 分派：h5 页面不被套用 admin 的 vui-page 规则（A25）', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-d2-pw-h5-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'apps/ph5/src/views'), { recursive: true });
  await mkdir(path.join(root, '.vima'), { recursive: true });
  await writeFile(path.join(root, '.vima/manifest.json'), JSON.stringify({
    schemaVersion: '2',
    templateId: 'admin',
    apps: [
      { id: 'admin', kind: 'admin-web', dir: '.', codeDir: 'src', sharedDirs: [] },
      { id: 'ph5', kind: 'h5-mobile', dir: 'apps/ph5', codeDir: 'src', sharedDirs: [] },
    ],
  }));

  // 正确的 h5 页面：根是 vm-body（vm-page 在 App.vue 根上）→ 放行。
  // 回归点：套 admin 面时这里会报「页面根缺少 vui-page 类」，把对的说成错的。
  await writeFile(path.join(root, 'apps/ph5/src/views/P07.vue'),
    '<template><div class="vm-body" data-page="PAGE-07"><div data-block="list"></div></div></template>');
  const ok = runHook(root, 'apps/ph5/src/views/P07.vue');
  assert.equal(ok.status, 0, `正确的 h5 页面应放行，stderr: ${ok.stderr}`);

  // 错误的 h5 页面：根既非 vm-body 也非 vm-sheet
  await writeFile(path.join(root, 'apps/ph5/src/views/Bad.vue'),
    '<template><div class="wrong" data-page="PAGE-08"></div></template>');
  const bad = runHook(root, 'apps/ph5/src/views/Bad.vue');
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /页面根缺少 vm-body \/ vm-sheet 类/);

  // h5 专属的两条导入/反馈规范
  await writeFile(path.join(root, 'apps/ph5/src/views/Imp.vue'),
    "<script setup lang=\"ts\">\nimport { toast } from '../../../../vendor/vima-ui-h5/dist/components/VmToast.vue'\n"
    + "function go(){ if (confirm('x')) toast('y') }\n</script>\n"
    + '<template><div class="vm-body" data-page="PAGE-07"><div data-block="list"></div></div></template>');
  const imp = runHook(root, 'apps/ph5/src/views/Imp.vue');
  assert.equal(imp.status, 2);
  assert.match(imp.stderr, /深路径导入 vendor\/vima-ui-h5/);
  assert.match(imp.stderr, /confirmAsync/);

  // .vue 的 <style> 块裸色值同样被拦
  await writeFile(path.join(root, 'apps/ph5/src/views/Color.vue'),
    '<template><div class="vm-body" data-page="PAGE-07"><div data-block="list"></div></div></template>\n'
    + '<style scoped>.x { color: #ff0000; }</style>');
  const col = runHook(root, 'apps/ph5/src/views/Color.vue');
  assert.equal(col.status, 2);
  assert.match(col.stderr, /字面量色值/);
  assert.match(col.stderr, /vima-ui-h5\/dist\/tokens\.css/, '提示应指向本端的 tokens');
});

test('post-write A27：业务页裸尺寸与页面根覆写被拦；密度档/令牌写法放行；壳层页不受伤', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-d2-pw-a27-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src/views'), { recursive: true });
  await mkdir(path.join(root, 'apps/patient/src/pages/p1'), { recursive: true });
  await mkdir(path.join(root, '.vima'), { recursive: true });
  await writeFile(path.join(root, '.vima/manifest.json'), JSON.stringify(MULTI_VIMA_MANIFEST));

  // ── admin 业务页：裸 padding → 拦；换 var() → 放行
  await writeFile(path.join(root, 'src/views/P01.vue'),
    '<template><div class="vui-page" data-page="PAGE-01"><div data-block="table"></div></div></template>\n'
    + '<style scoped>.x { padding: 0 14px; }</style>');
  let r = runHook(root, 'src/views/P01.vue');
  assert.equal(r.status, 2, `stderr: ${r.stderr}`);
  assert.match(r.stderr, /裸尺寸/);
  assert.match(r.stderr, /密度档/);

  await writeFile(path.join(root, 'src/views/P01.vue'),
    '<template><div class="vui-page" data-page="PAGE-01"><div data-block="table"></div></div></template>\n'
    + '<style scoped>.x { padding: 0 var(--v-gap-lg); --local-w: 14px; width: var(--local-w); }</style>');
  assert.equal(runHook(root, 'src/views/P01.vue').status, 0, '令牌与局部定义写法应放行');

  // ── admin 业务页：覆写页面根 height → 拦
  await writeFile(path.join(root, 'src/views/P01.vue'),
    '<template><div class="vui-page" data-page="PAGE-01"><div data-block="table"></div></div></template>\n'
    + '<style scoped>.vui-page { height: 100%; }</style>');
  r = runHook(root, 'src/views/P01.vue');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /覆写了页面根类 \.vui-page 的 height/);

  // ── 壳层页（无 data-page）写 px 不受伤（骨架内置页与组件不在管辖内）
  await writeFile(path.join(root, 'src/views/Shell.vue'),
    '<template><div class="whatever"></div></template>\n<style scoped>.x { padding: 14px; }</style>');
  assert.equal(runHook(root, 'src/views/Shell.vue').status, 0, '非业务页不查裸尺寸');

  // ── mp 端：页面 wxss 按 sibling wxml 的 data-page 判定
  await writeFile(path.join(root, 'apps/patient/src/pages/p1/index.wxml'),
    '<view class="vm-page" data-page="PAGE-11"><view data-block="list"></view></view>');
  await writeFile(path.join(root, 'apps/patient/src/pages/p1/index.wxss'), '.x { margin: 10px; }\n');
  r = runHook(root, 'apps/patient/src/pages/p1/index.wxss');
  assert.equal(r.status, 2, `stderr: ${r.stderr}`);
  assert.match(r.stderr, /裸尺寸/);
  await writeFile(path.join(root, 'apps/patient/src/pages/p1/index.wxss'), '.x { margin: var(--vm-gap-md); }\n');
  assert.equal(runHook(root, 'apps/patient/src/pages/p1/index.wxss').status, 0);

  // ── hook 永不检查组件使用（P17 声明落在头注，这里锁死语义：手写 <table> 不被拦）
  await writeFile(path.join(root, 'src/views/P02.vue'),
    '<template><div class="vui-page" data-page="PAGE-02"><div data-block="table"><table><tr><td>手写表格</td></tr></table></div></div></template>');
  assert.equal(runHook(root, 'src/views/P02.vue').status, 0, '不检查是否使用组件——表达形式的选择权在页面');
});

test('A34 收口 C-A34-03：方向裁定按 A6 阶梯**显式登记 L5·人审**，不留作无执行者的措辞', async () => {
  // 「Agent 不得自行选定胜者」是 A34 抗同质化的主杠杆，但 CLI 只能机检方向交付物齐全，
  // 分辨不出选择出自人还是 Agent。A6 的口径是「落不到 L1/L3 的才上 L5」——
  // 登记了才算数；不登记就是又一条「有承诺、无执行者」，正是 A34 立项要治的病型。
  const designer = await readFile(
    path.join(CLI_ROOT, 'templates/admin/workspace/agents/vima-designer.md'), 'utf8',
  );
  assert.match(designer, /不得自行选定胜者〔L5·人审〕/, '措辞必须带阶梯标签');
  assert.match(designer, /selection\.md/, '人裁定的留痕载体必须点名');

  const contracts = await readFile(path.join(CLI_ROOT, 'docs/internal-contracts.md'), 'utf8');
  assert.match(contracts, /方向裁定按 A6 阶梯登记为〔L5·人审〕/, '契约阶段推进事件表须登记');
});

test('A34 收口 C-A34-01/02：分级建议与阶段可见性写进契约（闸门看得见才算堵住 G2）', async () => {
  const contracts = await readFile(path.join(CLI_ROOT, 'docs/internal-contracts.md'), 'utf8');
  assert.match(contracts, /fidelitySuggestions/, '§6.20 须定义该字段');
  assert.match(contracts, /`fidelitySuggestions` 恒不阻断/, '恒不阻断的口径必须写死（D-A34-03）');
  assert.match(contracts, /gateApplies/, '非 DESIGNING 阶段的预览语义必须可区分');
});

test('A37 D-A37-04：settings.json 注册 statusLine 且直调 vima status --line（不新增脚本资产）', async () => {
  const settings = JSON.parse(await readFile(path.join(ADMIN, 'workspace/settings.json'), 'utf8'));
  assert.equal(settings.statusLine?.type, 'command', 'statusLine 须为 command 型');
  assert.equal(
    settings.statusLine?.command,
    'vima status --line',
    // 改成自建脚本就必须同步 init/doctor 的落点清单（CLAUDE.md 分层边界）——
    // 直调 CLI 是「落点清单零变更」的唯一形态，这条断言守住它。
    'statusLine 必须直调 CLI，不得改为 .claude/ 下的自建脚本',
  );
  const { existsSync } = await import('node:fs');
  assert.equal(
    existsSync(path.join(ADMIN, 'workspace/statusline.mjs')),
    false,
    'D-A37-04：不得新增 statusline 脚本资产',
  );
});

test('A38 规格 2：AGENTS.md 最低红线含 L3/L0 三条（跨工具口不能只有 Claude 才受约束）', async () => {
  // AGENTS.md 是读 AGENTS.md 的工具（Cursor / Codex / Jules）唯一拿得到的约束。
  // 此前它只有契约真源 / @vima 标注 / 自检命令三条，**没有一条说「确定性操作必须走 CLI」**——
  // 而项目宪法与四份 skill 正文里的那句是 Claude Code 专属，对这些工具毫无作用。
  const agents = await readFile(path.join(ADMIN, 'workspace/AGENTS.project.md'), 'utf8');
  assert.match(agents, /vima help/, 'L3：命令集真源必须点名，不许凭记忆猜');
  assert.match(agents, /vima sync/, 'L3：状态重建的唯一入口必须点名');
  assert.match(agents, /不要手改任务 frontmatter/, 'L3：手改 frontmatter 是 sustain-v4 的实际失效形态');
  assert.match(agents, /updatedAt/, 'L3：未来时间戳 = 伪造证据，须明写（与 doctor ⑬ 同一判据）');
  assert.match(agents, /非 vima 项目根/, 'L0：跨工具口能做到的最强形式是要求它主动自查一次');
  assert.match(agents, /vima status/, 'L0：自查动作必须给得出具体命令');
});

test('契约示例引用的响应包装类型，必须在骨架 dto 里真实存在', async () => {
  // 出自 sustain-v3 现场：示例写 `ApiResponse<PageResult<Device>>`，而骨架的 DTO 类
  // 叫 PageResponse（骨架 49 处全用它，PageResult 一个都没有）。照示例写契约的 Agent
  // 会产出一个后端根本不存在的类型名——sustain-v3 全线 246 处 PageResponse 与示例
  // 长期不一致，`vima update` 每次都把该文件报成「用户已修改」，掩盖了真正的错方在示例。
  const example = await readFile(path.join(ADMIN, 'planning', 'contract.example.md'), 'utf8');
  const dtoDir = path.join(
    ADMIN, 'scaffold', 'backend', 'src', 'main', 'java', 'com', '{{projectPkg}}', 'dto',
  );
  const dtoNames = new Set(
    (await readdir(dtoDir)).filter((n) => n.endsWith('.java')).map((n) => n.slice(0, -'.java'.length)),
  );
  assert.ok(dtoNames.size > 0, `骨架 dto 目录读不到类：${dtoDir}`);

  // 取 `ApiResponse<Xxx<...>>` 里的内层包装类型（分页等），逐个反查骨架是否有同名类。
  const referenced = [...example.matchAll(/ApiResponse<([A-Z]\w*)</g)].map((m) => m[1]);
  assert.ok(referenced.length > 0, '示例应至少演示一处泛型包装响应');
  for (const type of new Set(referenced)) {
    assert.ok(
      dtoNames.has(type),
      `契约示例引用了骨架里不存在的类型 ${type}；骨架 dto 现有：${[...dtoNames].sort().join(', ')}`,
    );
  }
});

// ── A40 hook 项目根定位：cwd 漂到子目录 / 父目录时仍须命中正确的根 ─────────────
// 立项实证：hook 命令与 hook 内部的根定位都按 cwd 解析，Agent 只要 `cd apps/admin`
// 再写共享层文件，guard 就静默放行——**失效没有任何输出**，正是 A37/A40 要治的那类故障。

/** 用指定 cwd 调 hook；file_path 传绝对路径（Claude Code 实际就是这么传的）。 */
function runHookAt(cwd, absFile, script) {
  const input = JSON.stringify({ cwd, tool_input: { file_path: absFile } });
  return spawnSync(process.execPath, [script], { input, encoding: 'utf8' });
}

test('A40 根定位：cwd 在子目录时，guard 仍按项目根判定共享层（回归：曾静默放行）', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'vima-d2-root-sub-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.vima'), { recursive: true });
  await mkdir(path.join(root, 'src/utils'), { recursive: true });
  await mkdir(path.join(root, 'apps/patient/src/pages'), { recursive: true });
  await writeFile(path.join(root, '.vima/manifest.json'), JSON.stringify(MULTI_VIMA_MANIFEST));

  const shared = path.join(root, 'src/utils/request.ts');
  const business = path.join(root, 'apps/patient/src/pages/booking.ts');
  const subCwd = path.join(root, 'apps/patient'); // Agent `cd apps/patient` 之后

  assert.equal(runHookAt(subCwd, shared, GUARD).status, 2, '子目录 cwd 下共享层仍须被拦');
  assert.equal(runHookAt(subCwd, business, GUARD).status, 0, '业务目录仍须放行');
});

test('A40 根定位：cwd 在项目之外时，按被写文件路径回溯到正确的项目根', async (t) => {
  const outer = await mkdtemp(path.join(tmpdir(), 'vima-d2-root-outer-'));
  t.after(() => rm(outer, { recursive: true, force: true }));
  const root = path.join(outer, 'proj');
  await mkdir(path.join(root, '.vima'), { recursive: true });
  await mkdir(path.join(root, 'src/utils'), { recursive: true });
  await writeFile(path.join(root, '.vima/manifest.json'), JSON.stringify(MULTI_VIMA_MANIFEST));

  // 会话开在项目的父目录（本次实战的真实形态）
  assert.equal(runHookAt(outer, path.join(root, 'src/utils/request.ts'), GUARD).status, 2,
    '父目录 cwd 下仍须按文件所在项目判定');
});

test('A40 根定位：完全不在 vima 项目里 → 放行（hook 防误不防恶意，不拿 cwd 硬凑根）', async (t) => {
  const bare = await mkdtemp(path.join(tmpdir(), 'vima-d2-root-bare-'));
  t.after(() => rm(bare, { recursive: true, force: true }));
  await mkdir(path.join(bare, 'src/utils'), { recursive: true });
  const f = path.join(bare, 'src/utils/request.ts');
  await writeFile(f, 'export const x = 1\n');
  assert.equal(runHookAt(bare, f, GUARD).status, 0, '非 vima 项目不应被 guard 干预');
  assert.equal(runHookAt(bare, f, HOOK).status, 0, '非 vima 项目不应触发写后巡检');
});

test('A40 根定位：嵌套项目下 CLAUDE_PROJECT_DIR 指向外层项目时，仍按被写文件所在的内层项目判（回归：曾静默放行）', async (t) => {
  const outer = await mkdtemp(path.join(tmpdir(), 'vima-d2-root-nest-'));
  t.after(() => rm(outer, { recursive: true, force: true }));
  await mkdir(path.join(outer, '.vima'), { recursive: true }); // 外层本身也是 vima 项目
  const inner = path.join(outer, 'inner');
  await mkdir(path.join(inner, '.vima'), { recursive: true });
  await mkdir(path.join(inner, 'src/utils'), { recursive: true });
  await writeFile(path.join(inner, '.vima/manifest.json'), JSON.stringify(MULTI_VIMA_MANIFEST));

  const input = JSON.stringify({ cwd: outer, tool_input: { file_path: path.join(inner, 'src/utils/request.ts') } });
  const proc = spawnSync(process.execPath, [GUARD], {
    input, encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: outer }, // 会话根 = 外层项目
  });
  assert.equal(proc.status, 2, '内层共享层必须按内层项目判定并拦截，env 不得把根拉到外层');
});
