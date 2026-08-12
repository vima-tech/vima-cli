#!/usr/bin/env bash
# post-write.sh —— 写后巡检（PostToolUse hook，matcher: Write|Edit）
#
# 行为（设计文档 §5.4 体量保护 / §10.5 第三道防线 / §8.3 约束锁定 / §16.3）：
#   - CLAUDE.md 行数 > 50 → stderr 告警（exit 0，只告警不阻断）
#   - src/ 下 .vue/.ts 业务代码的导入规范检查，命中 → exit 2 反馈给 Agent 修复
#     （写入已发生，exit 2 的 stderr 会作为反馈让 Agent 立即改正）：
#       · 深路径导入底层库（vendor/vima-ui-admin/dist 或 @vima-tech/ui-admin/dist）
#         ——组件一律走 @vima/ui 包入口
#       · 原生 window.confirm()/alert()——用组件库反馈 API
#   - 区块标记机械对账（§13.3 机械化路径的 hook 半，契约 §14）：.vue 文件含
#     data-page="PAGE-xx" 时按 docs/review/prototype.manifest.json 逐项比对
#     layout 区块（data-block）与弹窗（data-modal），缺失/多余 → exit 2；
#     manifest 缺失或文件无 data-page 时跳过本项
#   - 其他情况静默通过

node -e '
let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  const fs = require("node:fs");
  const path = require("node:path");

  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }
  const filePath = (input && input.tool_input && input.tool_input.file_path) || "";
  if (!filePath) process.exit(0);

  // 项目根：优先取 hook JSON 的 cwd；相对 file_path 一律相对项目根解析
  const root = (input && input.cwd) || process.cwd();
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);

  // ── CLAUDE.md 体量告警（§5.4，第 3 条 Hook 兜底）──
  if (path.basename(filePath) === "CLAUDE.md") {
    let text;
    try { text = fs.readFileSync(absPath, "utf8"); } catch { process.exit(0); }
    const lines = text.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    if (lines.length > 50) {
      console.error(
        `⚠️ CLAUDE.md 体量告警：当前 ${lines.length} 行，超过 50 行上限。\n` +
        `CLAUDE.md 是常驻上下文，只放红线与指针；请把详情迁移到 docs/ 下，` +
        `宪法中只保留一行指针（见体量保护机制）。`
      );
    }
    process.exit(0);
  }

  // ── 导入规范检查（§10.5 第三道防线 / §8.3）：仅前端业务代码 ──
  let rel = path.isAbsolute(filePath) ? path.relative(root, filePath) : filePath;
  rel = rel.split(path.sep).join("/").replace(/^\.\//, "");
  if (!rel.startsWith("src/") || !/\.(vue|ts|tsx)$/.test(rel)) process.exit(0);

  let text;
  try { text = fs.readFileSync(absPath, "utf8"); } catch { process.exit(0); }

  const problems = [];
  // 注意：本脚本被 bash 单引号包裹，JS 内不得出现字面单引号（用 \x27 表示）
  if (/from\s+["\x27][^"\x27\n]*(?:vendor\/vima-ui-admin\/dist|@vima-tech\/ui-admin\/dist)/.test(text)) {
    problems.push("深路径导入底层库（…/vima-ui-admin/dist/…）：组件一律从 @vima/ui 包入口导入");
  }
  if (/(?:^|[^.\w])(?:window\.)?(?:confirm|alert)\s*\(/m.test(text)) {
    problems.push("使用了原生 confirm()/alert()：请改用组件库反馈 API（见 docs/coding-standards.md）");
  }
  if (problems.length > 0) {
    console.error(
      `导入规范检查未通过 —— ${rel}\n` +
      problems.map((p) => `  · ${p}`).join("\n") +
      `\n请立即修正后重写该文件（本检查为 §10.5 第三道防线）。`
    );
    process.exit(2);
  }

  // ── 区块标记机械对账（§13.3 机械化路径的 hook 半）──
  // 仅当 .vue 文件声明了 data-page 时执行；manifest 未渲染时静默跳过。
  if (/\.vue$/.test(rel)) {
    const pageM = /data-page="(PAGE-\d{2})"/.exec(text);
    if (pageM) {
      let manifest = null;
      try {
        manifest = JSON.parse(fs.readFileSync(path.join(root, "docs", "review", "prototype.manifest.json"), "utf8"));
      } catch { /* 原型尚未渲染，跳过本项 */ }
      if (manifest && Array.isArray(manifest.pages)) {
        const page = manifest.pages.find((p) => p && p.id === pageM[1]);
        if (!page) {
          console.error(
            `区块标记对账：${rel} 声明 data-page="${pageM[1]}"，但 prototype.manifest.json 中无此页面。\n` +
            `可能：spec 改动后未重跑 vima render-prototype，或页面 ID 拼错。`
          );
          process.exit(2);
        }
        const declared = [];
        const reBlock = /data-block="([^"]+)"/g;
        let mB; while ((mB = reBlock.exec(text)) !== null) declared.push(mB[1]);
        const layout = Array.isArray(page.layout) ? page.layout : [];
        const missing = [...new Set(layout)].filter((w) => !declared.includes(w));
        const extra = [...new Set(declared)].filter((w) => !layout.includes(w));
        const modalIds = (Array.isArray(page.modals) ? page.modals : [])
          .map((mo) => (mo && typeof mo === "object" ? mo.id : null)).filter(Boolean);
        const missModals = modalIds.filter((id) => text.indexOf(`data-modal="${id}"`) < 0);
        const issues = [];
        if (missing.length) issues.push(`缺区块标记 data-block：${missing.join("、")}`);
        if (extra.length) issues.push(`多出设计外区块标记 data-block：${extra.join("、")}（layout 词表见 manifest 该页）`);
        if (missModals.length) issues.push(`缺弹窗标记 data-modal：${missModals.join("、")}`);
        if (issues.length > 0) {
          console.error(
            `区块标记对账未通过 —— ${rel}（${pageM[1]}，基线 prototype.manifest.json）\n` +
            issues.map((p) => `  · ${p}`).join("\n") +
            `\n页面结构以 spec/manifest 为唯一真源：结构确需变更时先改 spec 并重渲染，再改代码（§13.4）。`
          );
          process.exit(2);
        }
      }
    }
  }
  process.exit(0);
});
'
