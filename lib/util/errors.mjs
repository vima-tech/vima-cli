// 错误与退出码约定（internal-contracts §3）
export const EXIT = {
  OK: 0,           // 成功
  ERROR: 1,        // 未预期错误
  CHECK_FAILED: 2, // 校验/检查不通过（validate、plan 成环、trace 野生、render --check 漂移、doctor 异常）
  USAGE: 3,        // 用法/输入错误（未知命令、缺参数、找不到输入文件）
  PRECONDITION: 4, // 前置条件不满足（approve 前置缺失、preview 模板不支持、目录已存在）
};

export class VimaError extends Error {
  constructor(code, message, { path, exitCode } = {}) {
    super(message);
    this.name = 'VimaError';
    this.code = code;
    this.path = path;
    this.exitCode = exitCode ?? EXIT.ERROR;
  }
}

export function usageError(message) {
  return new VimaError('USAGE', message, { exitCode: EXIT.USAGE });
}

export function checkFailed(code, message, path) {
  return new VimaError(code, message, { path, exitCode: EXIT.CHECK_FAILED });
}

export function precondition(code, message, path) {
  return new VimaError(code, message, { path, exitCode: EXIT.PRECONDITION });
}

export function formatError(cmd, err) {
  const path = err.path ? ` (${err.path})` : '';
  const code = err.code || 'ERROR';
  return `vima ${cmd}: ${code}: ${err.message}${path}`;
}
