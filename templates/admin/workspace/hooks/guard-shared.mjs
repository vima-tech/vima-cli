#!/usr/bin/env node
// guard-shared.mjs —— 共享层写保护（PreToolUse hook，matcher: Write|Edit）
//
// 机制（设计文档 §10.7 策略二 / §16.3，契约 §14）：
//   - 从 stdin 读取 hook JSON，取 tool_input.file_path 判断写入目标
//   - 命中共享目录且 .vima/shared-write-token 缺失或已过期 → exit 2 阻断。
//     保护面来源（A16 端册化）：运行时读 .vima/manifest.json 端册——
//     apps[].sharedDirs 相对各自 dir 解析 + backend.sharedDirs 相对 backend.dir；
//     v1 manifest（无 apps 键）回退内置字面量（与 template.json default 端
//     sharedDirs 同步，d2 断言），存量项目不裸奔
//   - DEVELOPING 阶段追加保护 docs/contracts/**（§9.5 契约纪律 4：并行批次中
//     Builder 不得改契约）；PLANNING/MAINTAINING 期契约由主 Agent 正常读写，不拦
//   - 令牌文件内容为 ISO 8601 过期时刻，主 Agent 派发共享层任务前写入、完成后删除
//   - 其他情况一律放行（exit 0）
//
// 边界声明：本 hook 只覆盖 Write/Edit 工具通道，定位为「防误不防恶意」。

import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  // 解析 hook 输入；解析失败不误伤，直接放行
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const filePath = (input && input.tool_input && input.tool_input.file_path) || '';
  if (!filePath) process.exit(0);

  const root = resolveRoot(input, filePath);
  if (!root) process.exit(0); // 不在 Vima 项目里：无共享层可守

  // 路径可能是绝对路径——统一换算成相对项目根的 posix 风格路径
  let rel = path.isAbsolute(filePath) ? path.relative(root, filePath) : filePath;
  rel = rel.split(path.sep).join('/').replace(/^\.\//, '');

  // A37：journal 由 hook/CLI 旁路追加，Agent 的 Write/Edit 不得直接改账本。
  // 这只能防止直改 journal；verifier 报告仍由 Agent 产出，status 不得宣称整条证据不可伪造。
  if (rel === '.vima/reports/journal.jsonl') {
    console.error(
      `过程账本写保护：拦截 Agent 直接修改 ${rel}\n` +
        'journal 只能由 Vima hook/CLI 旁路追加；请修改真实任务或报告，让采集链自然产生事件。',
    );
    process.exit(2);
  }

  // 共享目录判定：manifest 端册优先（A16），v1 无 apps 键回退字面量
  let hitFrontend = false;
  let hitBackend = false;
  let manifest = null;
  try {
    manifest = JSON.parse(readFileSync(path.join(root, '.vima', 'manifest.json'), 'utf8'));
  } catch {
    /* manifest 缺失/损坏 → 走回退面，不误伤 */
  }
  if (manifest && Array.isArray(manifest.apps)) {
    for (const a of manifest.apps) {
      const base = !a.dir || a.dir === '.' ? '' : `${String(a.dir).replace(/\/+$/, '')}/`;
      for (const d of Array.isArray(a.sharedDirs) ? a.sharedDirs : []) {
        const prefix = `${base}${String(d).replace(/\/+$/, '')}/`;
        if (rel.startsWith(prefix)) { hitFrontend = true; break; }
      }
      if (hitFrontend) break;
    }
    const be = manifest.backend;
    if (be && typeof be === 'object') {
      const base = `${String(be.dir ?? 'backend').replace(/\/+$/, '')}/`;
      for (const d of Array.isArray(be.sharedDirs) ? be.sharedDirs : []) {
        const prefix = `${base}${String(d).replace(/\/+$/, '')}/`;
        if (rel.startsWith(prefix)) { hitBackend = true; break; }
      }
    }
  } else {
    // v1 回退面（与 template.json default 端 sharedDirs 同步）
    const frontendShared = ["src/components/", "src/utils/", "vendor/"];
    hitFrontend = frontendShared.some((d) => rel.startsWith(d));
    const backendShared = ["/config/", "/security/"];
    hitBackend = rel.startsWith("backend/") && backendShared.some((d) => rel.includes(d));
  }

  // 契约保护（§9.5 契约纪律 4）：仅 DEVELOPING 阶段拦截 docs/contracts/** 写入
  let hitContracts = false;
  if (rel.startsWith('docs/contracts/')) {
    try {
      const lc = JSON.parse(readFileSync(path.join(root, 'docs', 'lifecycle.json'), 'utf8'));
      hitContracts = Boolean(lc) && lc.currentPhase === 'DEVELOPING';
    } catch {
      /* lifecycle 缺失/损坏不误伤，放行 */
    }
  }
  if (!hitFrontend && !hitBackend && !hitContracts) process.exit(0);

  // 命中保护目录：检查写令牌（内容为 ISO 过期时刻）
  const tokenPath = path.join(root, '.vima', 'shared-write-token');
  let reason;
  try {
    const expiry = readFileSync(tokenPath, 'utf8').trim();
    const expiryMs = Date.parse(expiry);
    if (!Number.isNaN(expiryMs) && expiryMs > Date.now()) process.exit(0); // 令牌有效，放行
    reason = Number.isNaN(expiryMs)
      ? `令牌文件 .vima/shared-write-token 内容不是合法的 ISO 时间（${expiry}）`
      : `令牌已于 ${expiry} 过期`;
  } catch {
    reason = '令牌文件 .vima/shared-write-token 不存在';
  }

  if (hitContracts) {
    console.error(
      `契约写保护：拦截 DEVELOPING 阶段对契约的写入 —— ${rel}\n` +
        `原因：${reason}。并行批次中契约是前后端唯一共享输入，Builder 不得单方面修改（§9.5）。\n` +
        `出路：停下，在结果摘要中声明变更请求，由主 Agent 按契约纪律先改契约再改任务。`,
    );
  } else {
    console.error(
      `共享层写保护：拦截对共享目录的写入 —— ${rel}\n` +
        `原因：${reason}。共享层对业务任务只读，防止并行批次互相破坏。\n` +
        `出路：不要直接修改共享层；在你的结果摘要中声明 sharedChangeRequest\n` +
        `（需要改什么、为什么改、影响范围），由主 Agent 创建共享层补偿任务串行处理。`,
    );
  }
  process.exit(2);
});


/**
 * 项目根定位（多源回退）。**不能只用 cwd**：hook 进程的 cwd 是会话 cwd，
 * 它可能是项目的子目录（Agent `cd apps/admin` 之后写文件）、也可能是项目的父目录
 * （会话开在工作区根、项目建在子目录）。任一情形下按 cwd 解析都会算出错误的根，
 * 后果是 guard 形同虚设、journal 写去别处——而且**静默**，正是 A37 立项要治的那类失效。
 *
 * 优先级：
 *   1. 被写文件路径**向上**回溯（写入类 hook 最可靠的信号：文件在哪个项目里，就是哪个根，
 *      嵌套项目下这是唯一不会判错的来源）；
 *   2. `CLAUDE_PROJECT_DIR`（Claude Code 注入的会话项目根）——命中判据才采信；
 *   3. hook JSON 的 `cwd` 向上回溯；
 *   4. 进程 cwd 向上回溯。
 * 判据与内核 findProjectRoot 一致（`.vima/` 或 `docs/lifecycle.json`），判据只能有一个真源。
 * 全部落空 = 不在 Vima 项目里，返回 null 由调用方直接放行——hook 是「防误不防恶意」，
 * 拿 cwd 硬凑一个根会让 guard 去比对不存在的共享目录、journal 写进用户的任意目录。
 */
function findProjectRoot(from) {
  if (!from) return null;
  let dir = path.resolve(from);
  for (;;) {
    for (const probe of ['.vima', path.join('docs', 'lifecycle.json')]) {
      try {
        statSync(path.join(dir, probe));
        return dir;
      } catch { /* 继续探下一个判据 */ }
    }
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function resolveRoot(input, filePath) {
  const env = process.env.CLAUDE_PROJECT_DIR;
  const candidates = [
    // 被写文件路径排第一：文件在哪个项目里，就按哪个项目判。嵌套项目场景
    // （会话根本身是 vima 项目、文件属于其中嵌套的另一个项目）下，env 先行会判到外层根，
    // guard 对内层共享层静默放行——这与 A40 要治的病是同一株。
    filePath ? findProjectRoot(path.dirname(path.resolve(filePath))) : null,
    env ? findProjectRoot(env) : null,
    input && input.cwd ? findProjectRoot(input.cwd) : null,
    findProjectRoot(process.cwd()),
  ];
  for (const c of candidates) {
    if (c) return c;
  }
  return null; // 四源都不在 Vima 项目里 → 由调用方退出，不拿 cwd 硬凑一个根
}
