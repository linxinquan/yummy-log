/**
 * DAL 基础层 — 统一错误处理、安全调用包装、自动重试
 *
 * 所有 DAL 方法通过 safeCall() 包装，
 * 业务层无需 try-catch，统一接收 { success, data, error } 结构。
 */

const { getDB } = require('./client')

// ─── 错误码枚举 ───────────────────────────────────
const ERROR_CODES = {
  UNKNOWN:        'DAL_UNKNOWN',
  NETWORK:        'DAL_NETWORK',
  PERMISSION:     'DAL_PERMISSION',
  NOT_FOUND:      'DAL_NOT_FOUND',
  VALIDATION:     'DAL_VALIDATION',
  LIMIT_EXCEEDED: 'DAL_LIMIT_EXCEEDED',
}

// ─── 标准错误类 ───────────────────────────────────
class DalError extends Error {
  /**
   * @param {string} code    - ERROR_CODES 中的错误码
   * @param {string} message  - 人类可读的错误描述
   * @param {*}      original - 原始错误对象（用于调试）
   */
  constructor(code, message, original = null) {
    super(`[${code}] ${message}`)
    this.name = 'DalError'
    this.code = code
    this.original = original
  }
}

// ─── 安全调用包装 ─────────────────────────────────
/**
 * 将所有异步调用统一为 { success, data, error } 返回值。
 * 业务层不需要 try-catch。
 *
 * @template T
 * @param {Function} fn - 返回 Promise 的异步函数
 * @returns {Promise<{ success: boolean, data: T|null, error: DalError|null }>}
 */
async function safeCall(fn) {
  try {
    const data = await fn()
    return { success: true, data, error: null }
  } catch (err) {
    const dalErr = _toDalError(err)
    _reportError(dalErr)
    return { success: false, data: null, error: dalErr }
  }
}

// ─── 自动重试 ─────────────────────────────────────
/**
 * 应对网络抖动的自动重试包装。
 *
 * @template T
 * @param {Function} fn      - 返回 Promise 的异步函数
 * @param {number}   retries - 最大重试次数（默认 2）
 * @param {number}   delayMs - 重试间隔毫秒数（默认 300，指数退避）
 * @returns {Promise<T>}
 */
async function withRetry(fn, retries = 2, delayMs = 300) {
  let lastErr = null
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      // 判断错误类型：只有网络类错误值得重试
      const dalErr = err instanceof DalError ? err : _toDalError(err)
      if (dalErr.code !== ERROR_CODES.NETWORK) {
        throw err // 权限/参数/不存在等错误，直接抛出，不浪费重试
      }
      if (i < retries) {
        await _sleep(delayMs * (i + 1))
      }
    }
  }
  throw lastErr
}

// ─── 私有辅助函数 ─────────────────────────────────

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 将微信云数据库错误转换为统一的 DalError
 * @param {*} err - 原始错误
 * @returns {DalError}
 */
function _toDalError(err) {
  if (err instanceof DalError) return err

  const errMsg = (err && (err.errMsg || err.message || '')) || ''

  if (/network|fail|timeout/i.test(errMsg)) {
    return new DalError(ERROR_CODES.NETWORK, '网络连接失败，请检查网络后重试', err)
  }
  if (/permission|unauthorized|auth/i.test(errMsg)) {
    return new DalError(ERROR_CODES.PERMISSION, '权限不足，请重新登录', err)
  }
  if (/not found|404|invalid id/i.test(errMsg)) {
    return new DalError(ERROR_CODES.NOT_FOUND, '请求的数据不存在', err)
  }
  if (/limit|exceed|quota/i.test(errMsg)) {
    return new DalError(ERROR_CODES.LIMIT_EXCEEDED, '操作过于频繁，请稍后再试', err)
  }

  return new DalError(ERROR_CODES.UNKNOWN, errMsg || '未知错误', err)
}

/**
 * 错误上报（当前仅 console.warn，后续可扩展为监控平台）
 * @param {DalError} dalErr
 */
function _reportError(dalErr) {
  console.warn(`[DAL] ${dalErr.code}: ${dalErr.message}`, dalErr.original || '')
}

// ─── 导出 ─────────────────────────────────────────
module.exports = {
  ERROR_CODES,
  DalError,
  safeCall,
  withRetry,
}
