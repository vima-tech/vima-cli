/**
 * 常用数据校验：手机号、身份证号、邮箱、金额等。
 *
 * 两段式 API，按需取用：
 *   1. `isXxx(value)` 纯断言函数——随处可用（提交前兜底、列表过滤、导入校验）。
 *   2. `rule.xxx()` 规则工厂——直接塞进 VForm 的 `rules`。
 *
 *   import { rule, isMobile } from '@/utils/validate'
 *
 *   const rules = {
 *     phone: [rule.required('请输入手机号'), rule.mobile()],
 *     amount: [rule.amount({ decimals: 2, max: 999999 })],
 *   }
 *
 * 关于空值：VForm 只对 `required` 规则校验空值，其余规则遇到空值一律放行。
 * 所以「必填 + 格式」要写成两条规则，本文件的工厂函数也一律不自行判空。
 *
 * 后端有一份同口径实现（backend utils/ValidateUtil.java），改这里的规则请同步改那边，
 * 否则会出现前端放行、后端 400 的错位。
 */

// ---------------------------------------------------------------------------
// 断言函数
// ---------------------------------------------------------------------------

const MOBILE_RE = /^1[3-9]\d{9}$/
// 固话：区号（可选）+ 7~8 位号码 + 分机号（可选）
const TELEPHONE_RE = /^(0\d{2,3}-?)?[1-9]\d{6,7}(-\d{1,6})?$/
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/
const URL_RE = /^https?:\/\/[^\s/$.?#][^\s]*$/i
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
const POSTAL_CODE_RE = /^[1-9]\d{5}$/
const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{3,19}$/
// 中文姓名，允许 · 分隔的少数民族姓名
const CHINESE_NAME_RE = /^[一-龥]{2,20}(·[一-龥]{2,20})*$/
const ID_CARD_RE = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/

/** 统一转成待校验的字符串；null / undefined / 空白串一律视为「没填」。 */
function text(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

/** 手机号（中国大陆 11 位）。 */
export function isMobile(value: unknown): boolean {
  return MOBILE_RE.test(text(value))
}

/** 固定电话，如 010-12345678、0571-1234567-123、12345678。 */
export function isTelephone(value: unknown): boolean {
  return TELEPHONE_RE.test(text(value))
}

/** 邮箱地址。 */
export function isEmail(value: unknown): boolean {
  return EMAIL_RE.test(text(value))
}

/**
 * 居民身份证号（18 位）。
 * 格式 + 出生日期真实性 + ISO 7064:1983 MOD 11-2 校验位三重校验。
 * 15 位一代证 1999 年起停发，新录入不可能出现，故不支持。
 */
export function isIdCard(value: unknown): boolean {
  const id = text(value)
  if (!ID_CARD_RE.test(id)) return false

  // 出生日期必须是真实存在的日期（正则拦不住 2 月 30 日）
  const year = Number(id.slice(6, 10))
  const month = Number(id.slice(10, 12))
  const day = Number(id.slice(12, 14))
  const birth = new Date(year, month - 1, day)
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day
  ) {
    return false
  }

  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  let sum = 0
  for (let i = 0; i < 17; i++) sum += Number(id[i]) * weights[i]
  return checkCodes[sum % 11] === id[17].toUpperCase()
}

/** 银行卡号：15~19 位数字且通过 Luhn 校验。 */
export function isBankCard(value: unknown): boolean {
  const card = text(value).replace(/[\s-]/g, '')
  if (!/^\d{15,19}$/.test(card)) return false

  // Luhn：从右往左，偶数位（下标从 1 起）翻倍，超过 9 减 9，总和能被 10 整除
  let sum = 0
  for (let i = 0; i < card.length; i++) {
    let digit = Number(card[card.length - 1 - i])
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

/** 统一社会信用代码（GB 32100-2015，18 位）。 */
export function isUSCC(value: unknown): boolean {
  const code = text(value).toUpperCase()
  // 字符集去掉了形近的 I O S V Z
  const charset = '0123456789ABCDEFGHJKLMNPQRTUWXY'
  if (!/^[0-9A-HJ-NP-RTUW-Y]{18}$/.test(code)) return false

  const weights = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]
  let sum = 0
  for (let i = 0; i < 17; i++) {
    const index = charset.indexOf(code[i])
    if (index < 0) return false
    sum += index * weights[i]
  }
  const check = (31 - (sum % 31)) % 31
  return charset[check] === code[17]
}

export type NumberOptions = {
  /** 允许的最小值，默认 0（即默认不接受负数） */
  min?: number
  /** 允许的最大值，默认不限 */
  max?: number
}

export type AmountOptions = NumberOptions & {
  /** 允许的最大小数位数，默认 2 */
  decimals?: number
}

/**
 * 金额：默认非负、最多两位小数。
 * 先用字符串判小数位再转数字比范围——避免 0.1 + 0.2 这类浮点误差影响判定。
 * 需要接受负数时显式传 min，如 `isAmount(v, { min: -Infinity })`。
 */
export function isAmount(value: unknown, options: AmountOptions = {}): boolean {
  const { decimals = 2, min = 0, max = Number.POSITIVE_INFINITY } = options
  const amount = text(value)
  const pattern = decimals > 0
    ? new RegExp(`^-?\\d+(\\.\\d{1,${decimals}})?$`)
    : /^-?\d+$/
  if (!pattern.test(amount)) return false

  const num = Number(amount)
  return Number.isFinite(num) && num >= min && num <= max
}

/** 整数，默认非负。 */
export function isInteger(value: unknown, options: NumberOptions = {}): boolean {
  const { min = 0, max = Number.POSITIVE_INFINITY } = options
  const input = text(value)
  if (!/^-?\d+$/.test(input)) return false

  const num = Number(input)
  return Number.isSafeInteger(num) && num >= min && num <= max
}

/** http/https 链接。 */
export function isUrl(value: unknown): boolean {
  return URL_RE.test(text(value))
}

/** IPv4 地址。 */
export function isIPv4(value: unknown): boolean {
  return IPV4_RE.test(text(value))
}

/** 邮政编码（6 位，首位非 0）。 */
export function isPostalCode(value: unknown): boolean {
  return POSTAL_CODE_RE.test(text(value))
}

/** 中文姓名，2~20 个汉字。 */
export function isChineseName(value: unknown): boolean {
  return CHINESE_NAME_RE.test(text(value))
}

/** 用户名：字母开头，4~20 位字母、数字或下划线。 */
export function isUsername(value: unknown): boolean {
  return USERNAME_RE.test(text(value))
}

/**
 * 密码强度：8~20 位、不含空格，且大写字母 / 小写字母 / 数字 / 符号四类中至少占三类。
 * 注意用原值判定，不做 trim——首尾空格在密码里是有效字符且这里明确不允许。
 */
export function isStrongPassword(value: unknown): boolean {
  const password = value === null || value === undefined ? '' : String(value)
  if (!/^\S{8,20}$/.test(password)) return false

  const kinds = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/]
  return kinds.filter((re) => re.test(password)).length >= 3
}

// ---------------------------------------------------------------------------
// VForm 规则工厂
// ---------------------------------------------------------------------------

/**
 * VForm 认识的规则形状。
 * required / min / max / pattern 由 VForm 自己判定，validator 用于算法型校验
 * （身份证校验位、Luhn 之类正则表达不了的）。
 */
export type FormRule = {
  required?: boolean
  min?: number
  max?: number
  pattern?: RegExp
  message?: string
  validator?: (rule: FormRule, value: unknown, callback: (error?: Error) => void) => void
}

/** 把断言函数包成 VForm 规则。 */
function toRule(
  assert: (value: unknown) => boolean,
  defaultMessage: string,
  message?: string,
): FormRule {
  const text = message || defaultMessage
  return {
    message: text,
    validator: (_rule, value, callback) => {
      callback(assert(value) ? undefined : new Error(text))
    },
  }
}

export const rule = {
  /** 必填。VForm 只有这条规则会校验空值。 */
  required: (message = '此项为必填项'): FormRule => ({ required: true, message }),

  mobile: (message?: string): FormRule =>
    toRule(isMobile, '请输入正确的手机号', message),

  telephone: (message?: string): FormRule =>
    toRule(isTelephone, '请输入正确的固定电话', message),

  email: (message?: string): FormRule =>
    toRule(isEmail, '请输入正确的邮箱地址', message),

  idCard: (message?: string): FormRule =>
    toRule(isIdCard, '请输入正确的身份证号', message),

  bankCard: (message?: string): FormRule =>
    toRule(isBankCard, '请输入正确的银行卡号', message),

  uscc: (message?: string): FormRule =>
    toRule(isUSCC, '请输入正确的统一社会信用代码', message),

  amount: (options: AmountOptions = {}, message?: string): FormRule => {
    const { decimals = 2, min = 0, max } = options
    const fallback = max === undefined
      ? `请输入不小于 ${min} 的金额，最多 ${decimals} 位小数`
      : `请输入 ${min} ~ ${max} 之间的金额，最多 ${decimals} 位小数`
    return toRule((value) => isAmount(value, options), fallback, message)
  },

  integer: (options: NumberOptions = {}, message?: string): FormRule => {
    const { min = 0, max } = options
    const fallback = max === undefined
      ? `请输入不小于 ${min} 的整数`
      : `请输入 ${min} ~ ${max} 之间的整数`
    return toRule((value) => isInteger(value, options), fallback, message)
  },

  url: (message?: string): FormRule =>
    toRule(isUrl, '请输入以 http:// 或 https:// 开头的链接', message),

  ipv4: (message?: string): FormRule =>
    toRule(isIPv4, '请输入正确的 IP 地址', message),

  postalCode: (message?: string): FormRule =>
    toRule(isPostalCode, '请输入正确的邮政编码', message),

  chineseName: (message?: string): FormRule =>
    toRule(isChineseName, '请输入 2~20 位中文姓名', message),

  username: (message?: string): FormRule =>
    toRule(isUsername, '用户名需以字母开头，4~20 位字母、数字或下划线', message),

  password: (message?: string): FormRule =>
    toRule(isStrongPassword, '密码需 8~20 位且包含大写字母、小写字母、数字、符号中的至少三类', message),

  /** 长度区间（字符串按长度、数字按大小，由 VForm 原生判定）。 */
  length: (min: number, max: number, message?: string): FormRule => ({
    min,
    max,
    message: message || `长度需在 ${min} ~ ${max} 之间`,
  }),

  /** 自定义断言，省得为一次性规则手写 validator 样板。 */
  custom: (assert: (value: unknown) => boolean, message: string): FormRule =>
    toRule(assert, message),
}
