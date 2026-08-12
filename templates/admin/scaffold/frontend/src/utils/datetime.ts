/**
 * 时间显示统一入口。
 *
 * 后端的 LocalDateTime 经 Jackson 默认序列化成 ISO-8601（`2026-08-12T19:17:15.973362`）：
 * 带 T、带微秒。直接丢进表格有两个后果——读起来费劲，以及它比任何合理的时间列都宽
 * （实测需要 213px，而列宽给的是 180px，每行被裁掉 33px）。
 *
 * 列表里一律用 formatDateTime，配合 --v-col-w-time（170px）的时间列宽度，一行正好放下。
 */

/** 后端可能给出的时间形态：ISO 字符串、毫秒时间戳、Date */
export type DateLike = string | number | Date | null | undefined

const pad = (n: number) => String(n).padStart(2, '0')

function toDate(value: DateLike): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** `2026-08-12 19:17:15`；无值或解析失败时给 `-`，不要让表格里出现 Invalid Date */
export function formatDateTime(value: DateLike): string {
  const d = toDate(value)
  if (!d) return '-'
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** `2026-08-12` */
export function formatDate(value: DateLike): string {
  const d = toDate(value)
  if (!d) return '-'
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
