#!/usr/bin/env node
// 把 templates/<模板> 的改动增量同步进已存在的沙箱项目，供 scripts/dev.sh sync/up 调用。
//
// 机制刻意不自己实现渲染：每次都用真实的 `vima create` 渲染到临时目录，
// 再把「渲染结果 → 沙箱」的差异写过去。好处是同步结果与用户真实起盘的产物
// 逐字节一致，模板变量替换/二进制透传/_gitignore 改名等语义不会与 lib/ 漂移。
// 全量渲染 200 个文件约 0.1s，足以每次文件变更都重跑。
//
// 安全边界：只覆盖「上次同步后沙箱侧没被动过」的文件。沙箱里手改过的文件默认跳过并
// 报告（用 --force 才以模板为准覆盖），避免把你在跑起来的项目里调的效果冲掉。
// 上次同步写入的内容哈希记在 <沙箱>/.devlog/sync-state.json。
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP_TOP = new Set(['.vima']); // .vima/manifest.json 含 createdAt/vimaVersion，且由 vima init 续写

const C = {
  info: (s) => `\x1b[36m${s}\x1b[0m`,
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function die(msg) {
  process.stderr.write(`\x1b[31m✘ ${msg}\x1b[0m\n`);
  process.exit(1);
}

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

function walk(dir, base = '', out = []) {
  for (const e of fs.readdirSync(path.join(dir, base), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (!base && SKIP_TOP.has(e.name)) continue;
    if (e.isDirectory()) walk(dir, rel, out);
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

/** 用真实 CLI 渲染一份干净产物，返回 Map(相对路径 → {buf, mode})。 */
function render(templateId, projectName) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vima-sync-'));
  try {
    const r = spawnSync(
      process.execPath,
      [path.join(ROOT, 'bin', 'vima.mjs'), 'create', projectName, '--template', templateId, '--no-git', '--no-install'],
      { cwd: tmp, encoding: 'utf8' },
    );
    if (r.status !== 0) die(`vima create 渲染失败（退出码 ${r.status}）：\n${r.stderr || r.stdout}`);
    const src = path.join(tmp, projectName);
    const files = new Map();
    for (const rel of walk(src)) {
      const p = path.join(src, rel);
      files.set(rel, { buf: fs.readFileSync(p), mode: fs.statSync(p).mode });
    }
    return files;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const statePath = (proj) => path.join(proj, '.devlog', 'sync-state.json');

function loadState(proj) {
  try {
    return JSON.parse(fs.readFileSync(statePath(proj), 'utf8')).files ?? {};
  } catch {
    return {};
  }
}

function saveState(proj, files) {
  fs.mkdirSync(path.dirname(statePath(proj)), { recursive: true });
  const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(statePath(proj), `${JSON.stringify({ files: sorted }, null, 2)}\n`);
}

/**
 * 逐文件三方比对：渲染结果 R / 沙箱现状 S / 上次同步写入的哈希 H。
 *   S 不存在                → 新增
 *   sha(S) === sha(R)       → 一致，跳过
 *   H 缺失 或 sha(S) !== H  → 沙箱侧被改过，报告并跳过（--force 才覆盖）
 *   sha(S) === H            → 沙箱未动过，安全覆盖为模板新版本
 * 删除只针对「上次同步写过、这次渲染里没有」且沙箱内容仍等于上次写入值的文件。
 */
function sync(templateId, proj, { dryRun = false, force = false } = {}) {
  const projectName = path.basename(proj);
  const rendered = render(templateId, projectName);
  const prev = loadState(proj);
  const next = {};
  const added = [];
  const updated = [];
  const kept = []; // 沙箱侧本地改动，未覆盖
  const removed = [];

  for (const [rel, { buf, mode }] of rendered) {
    const dest = path.join(proj, rel);
    const rHash = sha(buf);
    let sBuf = null;
    try {
      sBuf = fs.readFileSync(dest);
    } catch {
      /* 沙箱里还没有这个文件 */
    }

    if (sBuf === null) {
      if (!dryRun) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
        if (mode & 0o111) fs.chmodSync(dest, mode & 0o777);
      }
      added.push(rel);
      next[rel] = rHash;
      continue;
    }

    const sHash = sha(sBuf);
    if (sHash === rHash) {
      next[rel] = rHash;
      continue;
    }
    const touchedLocally = prev[rel] === undefined || prev[rel] !== sHash;
    if (touchedLocally && !force) {
      kept.push(rel);
      next[rel] = prev[rel] ?? sHash; // 保留原基线，下次仍能识别为本地改动
      continue;
    }
    if (!dryRun) {
      fs.writeFileSync(dest, buf);
      if (mode & 0o111) fs.chmodSync(dest, mode & 0o777);
    }
    updated.push(rel);
    next[rel] = rHash;
  }

  for (const rel of Object.keys(prev)) {
    if (rendered.has(rel)) continue;
    const dest = path.join(proj, rel);
    if (!fs.existsSync(dest)) continue;
    if (sha(fs.readFileSync(dest)) !== prev[rel]) {
      kept.push(`${rel} ${C.dim('(模板已删除，但沙箱里被改过，保留)')}`);
      next[rel] = prev[rel];
      continue;
    }
    if (!dryRun) fs.rmSync(dest);
    removed.push(rel);
  }

  if (!dryRun) saveState(proj, next);
  return { added, updated, kept, removed, depsChanged: [...added, ...updated].includes('package.json') };
}

function report(res, { dryRun }) {
  const n = res.added.length + res.updated.length + res.removed.length;
  const tag = dryRun ? '待同步' : '已同步';
  for (const f of res.added) process.stdout.write(`  ${C.ok('+')} ${f}\n`);
  for (const f of res.updated) process.stdout.write(`  ${C.info('~')} ${f}\n`);
  for (const f of res.removed) process.stdout.write(`  ${C.warn('-')} ${f}\n`);
  for (const f of res.kept) process.stdout.write(`  ${C.warn('!')} ${f} ${C.dim('沙箱侧已改，未覆盖')}\n`);
  if (n === 0 && res.kept.length === 0) process.stdout.write(`  ${C.dim('模板与沙箱一致')}\n`);
  else process.stdout.write(`  ${C.dim(`${tag} ${n} 个文件`)}${res.kept.length ? C.warn(`，跳过 ${res.kept.length} 个本地改动`) : ''}\n`);
  if (res.kept.length && !dryRun) {
    process.stdout.write(`  ${C.dim('↑ 这些改动只在沙箱里，想进模板需自己搬回 templates/；要丢弃改动用 --force')}\n`);
  }
  if (res.depsChanged) process.stdout.write(`  ${C.warn('⚠ package.json 变了，沙箱里需要重跑 npm install')}\n`);
}

// ── 入口 ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const [templateId, proj] = argv.filter((a) => !a.startsWith('--'));
if (!templateId || !proj) die('用法：node scripts/sync.mjs <模板id> <沙箱项目目录> [--watch] [--dry-run] [--force]');
if (!fs.existsSync(proj)) die(`沙箱不存在：${proj}`);

const opts = { dryRun: flags.has('--dry-run'), force: flags.has('--force') };
report(sync(templateId, proj, opts), opts);

if (flags.has('--watch')) {
  const watchDir = path.join(ROOT, 'templates', templateId);
  process.stdout.write(`${C.info(`▸ 监听 templates/${templateId}/ 变更中（Ctrl-C 停止）`)}\n`);
  let timer = null;
  const onChange = () => {
    clearTimeout(timer);
    // 防抖：编辑器保存常触发多次事件，且渲染要在写盘落定后再跑
    timer = setTimeout(() => {
      const res = sync(templateId, proj, opts);
      if (res.added.length + res.updated.length + res.removed.length + res.kept.length > 0) {
        process.stdout.write(`${C.info('▸ 模板变更')}\n`);
        report(res, opts);
      }
    }, 150);
  };
  try {
    fs.watch(watchDir, { recursive: true }, onChange);
  } catch {
    // 递归监听不可用时回落到轮询（1s 扫一次 mtime 汇总值）
    let last = '';
    setInterval(() => {
      const sig = walk(watchDir)
        .map((rel) => `${rel}:${fs.statSync(path.join(watchDir, rel)).mtimeMs}`)
        .join('|');
      if (sig !== last) {
        last = sig;
        onChange();
      }
    }, 1000);
  }
}
