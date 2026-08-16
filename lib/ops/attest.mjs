// 取证 —— 为一条命题产生证据（R2 第一问「这条做对了吗」）。
//
// ─────────────────────────────────────────────────────────────────────────
// 一条纪律决定了本模块的全部形状：**系统自己取证，不信 agent 自述**。
//
// 落到签名上就是：`attest(ctx, claimId, how)` 里的 `how` 描述的是**用什么方式验**，
// 不是**验的结果**。结果由本模块自己算——扫码、跑命令，然后自己决定要不要出证据。
// agent 能左右的只有「什么时候发起取证」和「用哪种方式」，左右不了结论。
// 这条塌了，整套观测退化成自称：上一代实测过它塌掉的样子——43 个任务全都写了
// 「Service 层单元测试」验收项，实际覆盖 0/58，而每一项都是绿的。
//
// 四种方式一一对应 E 轴四档，且**只能对应这一档**：
//   claimed  agent 自述        → 永远是最弱档，不伪装成别的
//   derived  从产物机械推出    → 走 core/extract.mjs，不自造扫描器
//   executed 跑一条命令        → 绿了才算，命令与退出码记进 by，可重放
//   observed 真跑一遍界面      → 本轮不建采集设施（AR-1），如实返回未实现
//
// 方式名与强度名故意同名：每一档**有且只有一条挣到它的路**。若哪天出现第二条
// （比如「读 CI 产物」也算 executed），那时才需要把两个名字拆开。
//
// 关于 observed：接口留着，调用时如实返回「未实现」，**绝不降级用 derived 冒充**。
// 冒充比缺失贵得多——缺失是已知的洞，冒充是一份看起来已经验过的假账。
// ─────────────────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process';
import path from 'node:path';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { STRENGTH, readAll } from '../core/events.mjs';
import { project } from '../core/claims.mjs';
import { scanTree, CAPABILITY } from '../core/extract.mjs';

/**
 * 证据事件的 actor 恒为 'system'。
 *
 * 与 run 事件的 actor（= 触发者，通常是某个 agent）分开记，是「事件的发生由
 * agent 触发、事件的内容由系统生成」这条纪律在数据里的样子：
 * 日志里能一眼看出哪些行是有人说的、哪些行是系统自己看出来的。
 */
export const SYSTEM = 'system';

/** 跑命令的默认上限。没有默认值就等于「可以永远挂着」，那不是取证是卡死。 */
export const DEFAULT_TIMEOUT_MS = 120_000;

/** 输出留证上限：够定位失败原因，又不至于把一条日志撑成几 MB。 */
const TAIL = 4000;

// ── 证据策略：把「怎么验」从交活时现挑，前移到项目里预先登记 ─────────────────
//
// 为什么必须有这一层：`executed` 的命令此前由调用方在 submit 那一刻自己给，
// 于是 `node -e "process.exit(0)"` 也能换来一份 executed 证据——**挑什么命令
// 就验出什么结论**。冒烟脚本自己就在这么干，而 meets() 只比强度不看来路，
// 这条链路端到端产出的就是「正式假绿」。
//
// 策略是项目里的文件：`.vima/policies/<id>.json`，人写、可 review、可 diff、
// 进版本控制。命题在 docs 里声明 `policy: <id>`，submit 只触发它、改不了它。
// MCP 那一侧的 submit 本来就只收 claimId——策略机制让它第一次真的够得着
// `need: executed`，而不必给 agent 开一个「自己挑命令」的口子。
const POLICY_DIR = ['.vima', 'policies'];

/**
 * 读一条证据策略。
 *
 * `expects` **必须非空**，这是整层的牙齿所在：只看退出码的策略等于没有策略。
 * 退出 0 的命令太容易造了（空过滤器、零用例、恒真脚本），必须声明一条对
 * **产出**的期望，才谈得上「这条命令验的是目标能力」。
 */
export async function loadPolicy(root, id) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(id ?? ''))) {
    throw new Error(`策略 id ${JSON.stringify(id)} 不合法（小写字母数字连字符）`);
  }
  const rel = `${POLICY_DIR.join('/')}/${id}.json`;
  let raw;
  try {
    raw = await readFile(path.join(root, ...POLICY_DIR, `${id}.json`), 'utf8');
  } catch {
    throw new Error(`命题声明了证据策略 ${id}，但 ${rel} 不存在——`
      + '策略是项目里人写的文件，不是 agent 现编的命令');
  }
  let p;
  try { p = JSON.parse(raw); } catch (e) { throw new Error(`${rel} 不是合法 JSON：${e.message}`); }

  if (p.mode !== 'executed') {
    throw new Error(`${rel} 的 mode 目前只支持 'executed'（给的是 ${JSON.stringify(p.mode)}）`);
  }
  if (!Array.isArray(p.cmd) || p.cmd.length === 0 || p.cmd.some((x) => typeof x !== 'string')) {
    throw new Error(`${rel} 的 cmd 必须是非空 argv 字符串数组`);
  }
  const ex = p.expects ?? {};
  const hasCheck = typeof ex.stdoutMatch === 'string'
    || Number.isFinite(ex.minLines)
    || typeof ex.artifact === 'string';
  if (!hasCheck) {
    throw new Error(`${rel} 缺 expects——只看退出码不构成证据。`
      + '至少声明一条：stdoutMatch（输出要匹配的正则）/ minLines（输出至少几行）/ artifact（跑完要产出的文件）');
  }
  return { id, ...p, expects: ex };
}

/** 策略指纹：证据里记它，策略改了就能看出「这份证据验的是旧策略」。 */
function policyDigest(policy) {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify({ cmd: policy.cmd, cwd: policy.cwd ?? '.', expects: policy.expects }))
    .digest('hex').slice(0, 16)}`;
}

/** 检查策略声明的期望。返回未满足的清单——空数组才算通过。 */
async function checkExpects(policy, r, cwdAbs) {
  const miss = [];
  const ex = policy.expects;
  if (typeof ex.stdoutMatch === 'string') {
    let re;
    try { re = new RegExp(ex.stdoutMatch); } catch (e) {
      miss.push(`stdoutMatch 不是合法正则（${e.message}）`);
      re = null;
    }
    if (re && !re.test(r.stdout)) miss.push(`输出不匹配 /${ex.stdoutMatch}/`);
  }
  if (Number.isFinite(ex.minLines)) {
    const n = r.stdout.split('\n').filter((l) => l.trim() !== '').length;
    if (n < ex.minLines) miss.push(`输出只有 ${n} 行，策略要求至少 ${ex.minLines} 行`);
  }
  if (typeof ex.artifact === 'string') {
    try { await access(path.resolve(cwdAbs, ex.artifact)); } catch {
      miss.push(`跑完没有产出 ${ex.artifact}`);
    }
  }
  return miss;
}

/**
 * 给一条命题取证。
 *
 * ctx      { root, config?, actor, dirs? }
 * claimId  命题 id
 * how      'derived' | { mode, ... }
 *            claimed  { note }                       —— 自述内容，必填
 *            derived  {}                             —— 扫 ctx 的代码目录找 @vima 标注
 *            executed { cmd:[...], cwd?, timeoutMs? } —— cmd 必须是 argv 数组
 *            observed {}                             —— 未实现
 *
 * → { events, ok, strength, reason, detail, unimplemented }
 *   events 事件草稿数组，不写盘（写不写由调用方决定，和 compile 同一个道理）
 *   ok     取到证据没有。false 时 events 里只有 run，没有 evidence
 */
export async function attest(ctx = {}, claimId, how) {
  const actor = requireActor(ctx);
  const spec = typeof how === 'string' ? { mode: how } : { ...(how ?? {}) };
  const mode = spec.mode;
  if (!STRENGTH.includes(mode)) {
    throw new Error(`未知取证方式 ${mode}（合法：${STRENGTH.join(' / ')}）`);
  }
  if (!ctx.root) throw new Error('attest 需要 ctx.root');

  const { events: log } = await readAll(ctx.root);
  const { claims } = project(log);
  const claim = claims.get(claimId);

  let outcome;
  if (!claim) {
    // 不给不存在的命题出证据：那会变成 audit 里的「野生证据」，
    // 一条谁也挂不上的记录，看着像验过了其实什么都没验。
    outcome = { ok: false, reason: `命题 ${claimId} 不在事件流里——先 compile 出命题再取证` };
  } else if (mode === 'claimed') {
    outcome = attestClaimed(spec, actor);
  } else if (mode === 'derived') {
    outcome = await attestDerived(ctx, claimId, claim);
  } else if (mode === 'executed') {
    // 命题声明了策略、调用方又没自带 cmd → 走策略（正式）。
    // 自带 cmd 时**不覆盖策略**，走现挑那条路并标 adHoc——
    // 「声明了策略却拿别的命令交差」不该悄悄算成正式证据。
    let policy = null;
    if (claim.policy && !Array.isArray(spec.cmd)) {
      try {
        policy = await loadPolicy(ctx.root, claim.policy);
      } catch (err) {
        outcome = { ok: false, reason: err.message };
      }
    }
    if (!outcome) outcome = await attestExecuted(ctx, spec, policy);
  } else {
    outcome = attestObserved();
  }

  const events = [];
  // run 先于 evidence：先有人发起，系统才去看。顺序即因果。
  // 每次取证都记一条 run（哪怕没取到），否则「试过、红了、又试」这段过程
  // 在日志里完全不存在——R2 第三问「过程怎么走的」会只剩下成功的那些步。
  events.push({
    kind: 'run',
    actor,
    subject: claimId,
    payload: {
      op: 'attest',
      mode,
      ok: outcome.ok,
      ...(outcome.ok ? {} : { reason: outcome.reason }),
      ...(outcome.runDetail ? { detail: outcome.runDetail } : {}),
    },
  });
  if (outcome.ok) {
    events.push({
      kind: 'evidence',
      actor: SYSTEM,
      subject: claimId,
      payload: { strength: mode, by: outcome.by, detail: outcome.detail ?? null },
    });
  }

  return {
    events,
    ok: outcome.ok,
    strength: outcome.ok ? mode : null,
    reason: outcome.reason ?? null,
    detail: outcome.detail ?? outcome.runDetail ?? null,
    unimplemented: outcome.unimplemented === true,
  };
}

/**
 * claimed —— agent 自述。
 *
 * 它照样进日志，但**只以最弱档进**：`by.mode` 写死 'claimed'，`by.actor` 记下
 * 是谁说的。它的用处不是达标（命题的 need 默认就是 derived，自述够不着），
 * 而是让「有人说过这句话」本身可追溯——日后对不上账时，能查到是谁在什么位置说的。
 */
function attestClaimed(spec, actor) {
  const note = typeof spec.note === 'string' ? spec.note.trim() : '';
  if (!note) {
    return { ok: false, reason: 'claimed 取证必须带 note：一句「做完了」不带内容，连自述都算不上' };
  }
  return { ok: true, by: { mode: 'claimed', actor }, detail: { note } };
}

/**
 * derived —— 从产物机械推出。
 *
 * 唯一的事实来源是 core/extract.mjs：本模块不认识正则、不知道注释怎么跳、
 * 不换算行号。「判据的实现与用法必须一起收口」——上一代同一条正则散成三份拷贝，
 * 281 个调用点里 216 个被静默跳过而两条规则都显示通过。
 *
 * 取证结论：代码里存在 `@vima <claimId>` 标注即成立。
 * 记进 by 的除了标注位置还有 engine/granularity——证据要自陈它是用多粗的工具看出来的，
 * 日后换 AST 时，旧证据不会被误以为是符号级的。
 */
async function attestDerived(ctx, claimId, claim) {
  const dirs = codeDirs(ctx);
  if (dirs.length === 0) {
    return { ok: false, reason: '没有可扫描的代码目录（ctx.dirs 与 config.apps 都是空的）——推不出来的就是推不出来' };
  }
  const { marks } = await scanTree(ctx.root, dirs);
  const hits = marks.filter((m) => m.claimId === claimId).map((m) => ({ file: m.file, line: m.line }));
  if (hits.length === 0) {
    return {
      ok: false,
      reason: `代码里找不到 @vima ${claimId} 标注（扫了 ${dirs.join(', ')}）`,
      runDetail: { dirs },
    };
  }

  // ── 落点校验：命题声明了路径式 impl 时，标注必须落在声明范围内 ────────
  // 没有这一步，「在任意文件里加一行 @vima 注释」就能给任何命题换一份 derived
  // 证据——标注写在 README 里也算实现了。impl 是命题自己声明的实现落点，
  // 标注落在范围外，多半是复制粘贴错了地方，当场说清比让它混进证据里强。
  //
  // 只校验**路径式**条目（含 `/` 且不是 `VERB /path` 端点形态）。端点式 impl
  // 的落点是符号级的，regex/file 引擎自陈看不见（CAPABILITY.blind），
  // 由 audit 的闭合对账兜——这里不硬卡，也不假装校验过。
  const pathScopes = (claim?.impl ?? []).filter((s) => typeof s === 'string' && s.includes('/') && !/^[A-Z]+ \//.test(s));
  if (pathScopes.length > 0) {
    const inScope = hits.filter((h) => pathScopes.some((s) => h.file === s || h.file.startsWith(`${s.replace(/\/+$/, '')}/`)));
    if (inScope.length === 0) {
      return {
        ok: false,
        reason: `@vima ${claimId} 标注只出现在 ${hits.map((h) => h.file).join(', ')}，`
          + `不在命题声明的落点（${pathScopes.join(', ')}）里——标注写错了地方，还是 impl 声明过期了？`,
        runDetail: { dirs, hits, declaredScopes: pathScopes },
      };
    }
  }

  return {
    ok: true,
    by: {
      mode: 'derived',
      engine: CAPABILITY.engine,
      granularity: CAPABILITY.granularity,
      marks: hits,
      // 落点核过没有，如实记进证据。scopeChecked:false ≠ 核过了——
      // 命题没声明路径式 impl 时，这份证据只证明「标注存在」，不证明「落对了」。
      scopeChecked: pathScopes.length > 0,
    },
  };
}

/**
 * executed —— 跑一条命令，退出码 0 才算。
 *
 * cmd 只收 argv 数组，不收字符串。收字符串就得过 shell，shell 的引号与展开规则
 * 让「可重放」变成一句空话——同一行字在不同 shell 里跑出不同的东西，那这条证据
 * 就和自称没区别（「取证方式必须可重放，否则与自称无异」）。
 *
 * 绿的：只记 by（cmd + cwd + exitCode），不留输出——需要看的话按 by 重放一遍就有。
 * 红的：不出证据，但把输出尾巴记进 run 事件——红的输出不当场留就永远丢了。
 */
/**
 * executed —— 跑一条命令。
 *
 * 两条来路，**在证据里必须分得开**：
 *   策略（policy）  命令来自 `.vima/policies/<id>.json`，人写、可 review、进版本控制。
 *                   还要过 expects 检查（退出 0 只是及格线之一）。→ adHoc:false，正式
 *   现挑（--how）   命令由调用方在 submit 那一刻给。挑什么命令验什么。→ adHoc:true
 *
 * 而 `meets()` **只认正式证据**（见 core/claims.isFormal）：现挑命令进得了日志、
 * 帮得上排查，但换不来「达标」。这一条不落地的话，`adHoc` 就只是个没人看的标签——
 * codex 评估的原话：「adHoc 当前只是留下了标签，尚未真正阻止放水」。
 */
async function attestExecuted(ctx, spec, policy = null) {
  const cmd = policy ? policy.cmd : spec.cmd;
  if (!Array.isArray(cmd) || cmd.length === 0 || cmd.some((x) => typeof x !== 'string')) {
    return {
      ok: false,
      reason: 'executed 的 cmd 必须是非空 argv 字符串数组（如 ["npm","test"]）——字符串要过 shell，引号规则一变就不可重放',
    };
  }
  const src = policy ?? spec;
  const cwdRel = typeof src.cwd === 'string' && src.cwd ? src.cwd : '.';
  const cwdAbs = path.resolve(ctx.root, cwdRel);
  const timeoutMs = Number.isFinite(src.timeoutMs) && src.timeoutMs > 0 ? src.timeoutMs : DEFAULT_TIMEOUT_MS;

  const r = await runCommand(cmd, { cwd: cwdAbs, timeoutMs });
  const by = {
    mode: 'executed',
    cmd,
    cwd: cwdRel,
    exitCode: r.exitCode,
    adHoc: !policy,
    ...(policy ? { policy: policy.id, policyDigest: policyDigest(policy) } : {}),
  };

  const base = {
    cmd, cwd: cwdRel, exitCode: r.exitCode, timedOut: r.timedOut,
    stdoutTail: tail(r.stdout), stderrTail: tail(r.stderr),
  };

  if (r.exitCode !== 0) {
    return {
      ok: false,
      reason: r.timedOut
        ? `命令超时（${timeoutMs}ms）：${cmd.join(' ')}`
        : r.spawnError
          ? `命令起不来：${cmd.join(' ')} —— ${r.stderr}`
          : `命令退出码 ${r.exitCode}（非 0 即未达成）：${cmd.join(' ')}`,
      runDetail: base,
    };
  }

  // 退出 0 之后才轮到 expects。「跑成功了」和「验到了东西」是两件事——
  // 零用例的测试、空过滤器、被跳过的套件，退出码全是 0。
  if (policy) {
    const miss = await checkExpects(policy, r, cwdAbs);
    if (miss.length) {
      return {
        ok: false,
        reason: `命令退出 0，但没满足策略 ${policy.id} 的期望：${miss.join('；')}`
          + '——执行成功不等于取到证据',
        runDetail: { ...base, policy: policy.id, unmetExpects: miss },
      };
    }
    by.expects = policy.expects;
  }
  return { ok: true, by };
}

/**
 * observed —— 真跑一遍界面。
 *
 * 本轮不建采集设施，这是**已接受的风险 AR-1**，不是遗漏。
 * 接口留在这里、如实说「未实现」，比悄悄回落到 derived 强：
 * 回落之后审计报告上这条会显示为「已验」，而实际上没有任何人跑过那个界面。
 * 缺失是已知的洞，冒充是一份假账。
 */
function attestObserved() {
  return {
    ok: false,
    unimplemented: true,
    reason: 'observed 采集设施本轮未建（AR-1 已接受的风险）。接口在此，但不会降级用 derived 冒充——冒充比缺失贵。',
  };
}

/**
 * 项目的代码目录。
 *
 * attest(derived) 与 audit 都要回答「这个项目的代码在哪」，这是同一个判据，
 * 因此只能有一处实现——上一代「项目根在哪」有两份判据，对未 init 的项目当场误报。
 * 放在这里是权宜：它其实属于 core/project.mjs（配置的解释权在那儿），
 * 但 core 本轮冻结。下次动 core 时应该搬过去，本文件改成 re-export。
 */
export function codeDirs(ctx = {}) {
  if (Array.isArray(ctx.dirs)) return ctx.dirs.filter((d) => typeof d === 'string' && d);
  const apps = ctx.config?.apps ?? [];
  return apps.filter((a) => a && typeof a.id === 'string' && a.id).map((a) => `apps/${a.id}`);
}

function runCommand([prog, ...args], { cwd, timeoutMs }) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(prog, args, { cwd, shell: false });
    } catch (err) {
      resolve({ exitCode: null, stdout: '', stderr: String(err.message), spawnError: true, timedOut: false });
      return;
    }
    let out = '';
    let err = '';
    let timedOut = false;
    let done = false;
    const finish = (r) => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    // 累计到上限就停止拼接：跑挂的命令能刷出 GB 级输出，留证不该把内存吃光。
    child.stdout?.on('data', (d) => { if (out.length < TAIL * 4) out += d; });
    child.stderr?.on('data', (d) => { if (err.length < TAIL * 4) err += d; });
    child.on('error', (e) => finish({
      exitCode: null, stdout: out, stderr: String(e.message), spawnError: true, timedOut,
    }));
    child.on('close', (code) => finish({
      exitCode: code, stdout: out, stderr: err, spawnError: false, timedOut,
    }));
  });
}

/** 留尾巴不留头：命令失败的原因几乎总在最后几行。 */
function tail(s) {
  const t = String(s ?? '');
  return t.length <= TAIL ? t : t.slice(-TAIL);
}

function requireActor(ctx) {
  if (typeof ctx.actor !== 'string' || ctx.actor === '') {
    throw new Error('attest 需要 ctx.actor——「谁发起的取证」是 R2 第三问，不可缺');
  }
  return ctx.actor;
}
