/**
 * base.test.js — 测试 DAL 基础层
 * 覆盖：DalError 错误码映射、safeCall 正常/异常、withRetry 重试逻辑
 */

// setup.js 已在 setupFilesAfterSetup 中执行，global.wx 已注入

const { DalError, ERROR_CODES, safeCall, withRetry } = require('../../utils/db/base')

// ─── DalError ─────────────────────────────────

describe('DalError', () => {
  test('构造函数正确设置 code / message / original', () => {
    const orig = new Error('boom')
    const err = new DalError(ERROR_CODES.NETWORK, '网络错误', orig)
    expect(err.name).toBe('DalError')
    expect(err.code).toBe(ERROR_CODES.NETWORK)
    expect(err.message).toBe('[DAL_NETWORK] 网络错误')
    expect(err.original).toBe(orig)
  })
})

// ─── _toDalError 错误码映射（通过 safeCall 间接测试）───

describe('_toDalError 错误码映射', () => {
  test('网络相关错误 → NETWORK', async () => {
    const result = await safeCall(() => Promise.reject({ errMsg: 'network fail' }))
    expect(result.success).toBe(false)
    expect(result.error.code).toBe(ERROR_CODES.NETWORK)
  })

  test('超时错误 → NETWORK', async () => {
    const result = await safeCall(() => Promise.reject({ message: 'request timeout' }))
    expect(result.success).toBe(false)
    expect(result.error.code).toBe(ERROR_CODES.NETWORK)
  })

  test('权限错误 → PERMISSION', async () => {
    const result = await safeCall(() => Promise.reject({ errMsg: 'permission denied' }))
    expect(result.success).toBe(false)
    expect(result.error.code).toBe(ERROR_CODES.PERMISSION)
  })

  test('未授权错误 → PERMISSION', async () => {
    const result = await safeCall(() => Promise.reject({ message: 'unauthorized' }))
    expect(result.success).toBe(false)
    expect(result.error.code).toBe(ERROR_CODES.PERMISSION)
  })

  test('不存在错误 → NOT_FOUND', async () => {
    const result = await safeCall(() => Promise.reject({ errMsg: 'not found' }))
    expect(result.success).toBe(false)
    expect(result.error.code).toBe(ERROR_CODES.NOT_FOUND)
  })

  test('无效 ID 错误 → NOT_FOUND', async () => {
    const result = await safeCall(() => Promise.reject({ message: 'invalid id' }))
    expect(result.success).toBe(false)
    expect(result.error.code).toBe(ERROR_CODES.NOT_FOUND)
  })

  test('配额超限 → LIMIT_EXCEEDED', async () => {
    const result = await safeCall(() => Promise.reject({ errMsg: 'quota exceeded' }))
    expect(result.success).toBe(false)
    expect(result.error.code).toBe(ERROR_CODES.LIMIT_EXCEEDED)
  })

  test('未知错误 → UNKNOWN', async () => {
    const result = await safeCall(() => Promise.reject(new Error('some weird error')))
    expect(result.success).toBe(false)
    expect(result.error.code).toBe(ERROR_CODES.UNKNOWN)
  })

  test('DalError 实例直接返回，不双重包装', async () => {
    const originalErr = new DalError(ERROR_CODES.PERMISSION, '原错误')
    const result = await safeCall(() => Promise.reject(originalErr))
    expect(result.error).toBe(originalErr) // 同一个实例
  })
})

// ─── safeCall ───────────────────────────────────

describe('safeCall', () => {
  test('正常执行 → { success:true, data, error:null }', async () => {
    const result = await safeCall(() => Promise.resolve(42))
    expect(result).toEqual({ success: true, data: 42, error: null })
  })

  test('异步函数返回 undefined → data 为 undefined', async () => {
    const result = await safeCall(() => Promise.resolve(undefined))
    expect(result.success).toBe(true)
    expect(result.data).toBeUndefined()
  })

  test('抛出错误 → { success:false, data:null, error:DalError }', async () => {
    const result = await safeCall(() => Promise.reject(new Error('boom')))
    expect(result.success).toBe(false)
    expect(result.data).toBeNull()
    expect(result.error).toBeInstanceOf(DalError)
  })

  test('console.warn 被调用（错误上报）', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    await safeCall(() => Promise.reject(new Error('test')))
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

// ─── withRetry ───────────────────────────────────

describe('withRetry', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  test('首次成功 → 只调用 1 次', async () => {
    const fn = jest.fn(() => Promise.resolve('ok'))
    const result = await withRetry(fn, 2, 10)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('首次失败（网络错误），第二次成功 → 重试 1 次', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce({ errMsg: 'network fail' })
      .mockResolvedValueOnce('recovered')
    const result = await withRetry(fn, 2, 10)
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  test('两次均网络失败（retries=1）→ 共调用 2 次后抛出', async () => {
    // retries=1 表示最多重试 1 次，总共尝试 2 次
    const fn = jest.fn()
      .mockRejectedValueOnce({ errMsg: 'network fail 1' })
      .mockRejectedValueOnce({ errMsg: 'network fail 2' })
    try {
      await withRetry(fn, 1, 10)
      // 如果没抛出，测试失败
      expect('should have thrown').toBe('but did not')
    } catch (e) {
      // 期望走到这里
      expect(fn).toHaveBeenCalledTimes(2)
    }
  })

  test('非网络错误（权限） → 不重试，立即抛出', async () => {
    const fn = jest.fn(() => Promise.reject({ errMsg: 'permission denied' }))
    let threw = false
    try {
      await withRetry(fn, 2, 10)
    } catch (e) {
      threw = true
      expect(e.message || e.errMsg).toBeDefined()
    }
    expect(threw).toBe(true)
    expect(fn).toHaveBeenCalledTimes(1) // 不重试
  })

  test('withRetry 默认参数（retries=2）→ 共调用 3 次', async () => {
    const fn = jest.fn(() => Promise.reject({ errMsg: 'network fail' }))
    try {
      await withRetry(fn) // 默认 retries=2
    } catch (e) {
      // 期望走到这里
    }
    // 默认 retries=2，最多调用 3 次（初始 + 2 次重试）
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
