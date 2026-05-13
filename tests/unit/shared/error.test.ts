import { describe, it, expect } from 'vitest'
import { AppError, ErrorCode, ok, err } from '../../../src/shared/types/error'

describe('AppError', () => {
  it('constructs with required fields', () => {
    const e = new AppError({ code: ErrorCode.UNKNOWN, message: 'test error' })
    expect(e.name).toBe('AppError')
    expect(e.code).toBe(ErrorCode.UNKNOWN)
    expect(e.message).toBe('test error')
    expect(e.retryable).toBe(false)
    expect(e.context).toBeUndefined()
  })

  it('constructs with all optional fields', () => {
    const cause = new Error('root')
    const ctx = { requestId: 'req-1', userId: 'u-1' }
    const e = new AppError({
      code: ErrorCode.AI_CALL_FAILED,
      message: 'ai failed',
      retryable: true,
      context: ctx,
      cause,
    })
    expect(e.retryable).toBe(true)
    expect(e.context).toEqual(ctx)
    expect(e.cause).toBe(cause)
  })

  it('is instanceof both Error and AppError', () => {
    const e = new AppError({ code: ErrorCode.NOT_FOUND, message: 'missing' })
    expect(e).toBeInstanceOf(Error)
    expect(e).toBeInstanceOf(AppError)
  })

  it('can be constructed for every ErrorCode', () => {
    for (const code of Object.values(ErrorCode)) {
      const e = new AppError({ code, message: `test ${code}` })
      expect(e.code).toBe(code)
    }
  })

  it('retryable defaults to false', () => {
    const e = new AppError({ code: ErrorCode.DB_QUERY_FAILED, message: 'db error' })
    expect(e.retryable).toBe(false)
  })

  it('AI_CALL_FAILED is typically retryable', () => {
    const e = new AppError({ code: ErrorCode.AI_CALL_FAILED, message: 'timeout', retryable: true })
    expect(e.retryable).toBe(true)
  })
})

describe('ok()', () => {
  it('creates a success Result with primitive', () => {
    const r = ok(42)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(42)
  })

  it('creates a success Result with object', () => {
    const val = { id: 'abc', name: 'test' }
    const r = ok(val)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(val)
  })

  it('creates a success Result with null', () => {
    const r = ok(null)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBeNull()
  })

  it('creates a success Result with undefined', () => {
    const r = ok(undefined)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBeUndefined()
  })

  it('creates a success Result with array', () => {
    const r = ok([1, 2, 3])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual([1, 2, 3])
  })
})

describe('err()', () => {
  it('creates a failure Result with AppError', () => {
    const error = new AppError({ code: ErrorCode.POST_NOT_FOUND, message: 'not found' })
    const r = err(error)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe(error)
  })

  it('creates a failure Result with string', () => {
    const r = err('something went wrong')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('something went wrong')
  })

  it('creates a failure Result with plain Error', () => {
    const e = new Error('plain error')
    const r = err(e)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe(e)
  })
})

describe('Result type narrowing', () => {
  it('ok result narrows correctly in if-check', () => {
    const r = ok('hello')
    if (r.ok) {
      // TypeScript should allow r.value here
      expect(r.value).toBe('hello')
    } else {
      throw new Error('Should not reach here')
    }
  })

  it('err result narrows correctly in if-check', () => {
    const e = new AppError({ code: ErrorCode.UNKNOWN, message: 'x' })
    const r = err(e)
    if (!r.ok) {
      expect(r.error.code).toBe(ErrorCode.UNKNOWN)
    } else {
      throw new Error('Should not reach here')
    }
  })
})
