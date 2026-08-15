/**
 * A7 运行时证据（契约 §6.10）：把未捕获错误打到 console，
 * 显式运行 `npm run runtime:setup` 后，由 `npm run runtime:collect`
 *（miniprogram-automator 驱动开发者工具）采集落盘为
 * `.vima/reports/runtime-errors.<appId>.jsonl`，给不开开发者工具的 Agent 当眼睛。
 *
 * **诚实降级**：开发者工具不在场时不捕获，也不假装捕获——
 * 那种情况下 /check 会如实报「该端无运行时证据通道」，而不是报「零错误」。
 * 「没测到」和「测了没问题」是两件事，混为一谈比没有证据更危险。
 */

/** 采集器据此从满屏 console 里挑出上报行，不要改。 */
const MARKER = '[vima-runtime]';

/** 同错误去重 + 单次会话上限，防错误风暴刷爆文件（与 admin 骨架同口径）。 */
const seen = new Set<string>();
const MAX = 20;

export interface RuntimeErrorPayload {
  kind: 'error' | 'unhandledrejection';
  message: string;
}

export function reportRuntimeError(payload: RuntimeErrorPayload): void {
  const pages = getCurrentPages();
  const route = pages.length > 0 ? `/${pages[pages.length - 1].route}` : '';
  const record = { ...payload, page: route };
  const key = JSON.stringify(record);
  if (seen.has(key) || seen.size >= MAX) return;
  seen.add(key);
  console.error(MARKER, JSON.stringify(record));
}
