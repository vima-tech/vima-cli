// 错误与退出码约定（internal-contracts §3 / §3.1 错误码登记表）
export const EXIT = {
  OK: 0,           // 成功
  ERROR: 1,        // 未预期错误
  CHECK_FAILED: 2, // 校验/检查不通过（validate、plan 成环、trace 野生、render --check 漂移、doctor 异常）
  USAGE: 3,        // 用法/输入错误（未知命令、缺参数、找不到输入文件）
  PRECONDITION: 4, // 前置条件不满足（approve 前置缺失、preview 模板不支持、目录已存在）
};

/** 统一错误类型：code 为契约 §3.1 登记的稳定错误码，path 作为 stderr 尾段输出。 */
export class VimaError extends Error {
  constructor(code, message, { path, exitCode } = {}) {
    super(message);
    this.name = 'VimaError';
    this.code = code;
    this.path = path;
    this.exitCode = exitCode ?? EXIT.ERROR;
  }
}

/** 用法/输入错误（code=USAGE，exit 3）。 */
export function usageError(message) {
  return new VimaError('USAGE', message, { exitCode: EXIT.USAGE });
}

/** 校验/检查不通过（exit 2）。 */
export function checkFailed(code, message, path) {
  return new VimaError(code, message, { path, exitCode: EXIT.CHECK_FAILED });
}

/** 前置条件不满足（exit 4）。 */
export function precondition(code, message, path) {
  return new VimaError(code, message, { path, exitCode: EXIT.PRECONDITION });
}

/** stderr 首行稳定格式：`vima <cmd>: <CODE>: <message> (<path>)`（契约 §3）。 */
export function formatError(cmd, err) {
  const path = err.path ? ` (${err.path})` : '';
  const code = err.code || 'ERROR';
  return `vima ${cmd}: ${code}: ${err.message}${path}`;
}

/**
 * 把 node:util parseArgs 的英文异常翻译为统一中文 usage 错误（契约 §3）。
 * 识别四类：未知选项 / 选项缺少取值 / 选项不接受取值 / 多余的位置参数；
 * 未识别形态回退为「参数解析失败：<原文>」。
 */
export function usageFromParseArgs(err) {
  const raw = String(err?.message ?? err);
  const pick = (re) => raw.match(re)?.[1]?.replace(/\s*<value>$/, '');
  switch (err?.code) {
    case 'ERR_PARSE_ARGS_UNKNOWN_OPTION':
      return usageError(`未知选项 "${pick(/Unknown option '([^']+)'/) ?? raw}"`);
    case 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE': {
      const name = pick(/Option '([^']+)'/) ?? raw;
      return usageError(
        raw.includes('does not take an argument') ? `选项 "${name}" 不接受取值` : `选项 "${name}" 缺少取值`,
      );
    }
    case 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL':
      return usageError(`多余的位置参数 "${pick(/Unexpected argument '([^']+)'/) ?? raw}"`);
    default:
      return usageError(`参数解析失败：${raw}`);
  }
}
