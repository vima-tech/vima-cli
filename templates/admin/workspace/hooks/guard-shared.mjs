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

import { readFileSync } from 'node:fs';
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

  // 项目根：优先取 hook JSON 的 cwd，退回进程 cwd
  const root = (input && input.cwd) || process.cwd();

  // 路径可能是绝对路径——统一换算成相对项目根的 posix 风格路径
  let rel = path.isAbsolute(filePath) ? path.relative(root, filePath) : filePath;
  rel = rel.split(path.sep).join('/').replace(/^\.\//, '');

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
