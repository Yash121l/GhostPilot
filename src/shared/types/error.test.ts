import { describe, it, expect } from 'vitest'
import { AppError, ErrorCode, ok, err } from './error'

describe('AppError', () => {
  it('sets required fields correctly', () => {
    const e = new AppError({ code: ErrorCode.UNKNOWN, message: 'oops' })
    expect(e.name).toBe('AppError')
    expect(e.code).toBe(ErrorCode.UNKNOWN)
    expect(e.message).toBe('oops')
    expect(e.retryable).toBe(false)
    expect(e.context).toBeUndefined()
  })

  it('sets optional fields when provided', () => {
    const cause = new Error('root cause')
    const ctx = { userId: 'u1' }
    const e = new AppError({
      code: ErrorCode.AI_CALL_FAILED,
      message: 'ai error',
      retryable: true,
      context: ctx,
      cause
    })
    expect(e.retryable).toBe(true)
    expect(e.context).toEqual(ctx)
    expect(e.cause).toBe(cause)
  })

  it('is instanceof Error', () => {
    const e = new AppError({ code: ErrorCode.NOT_FOUND, message: 'missing' })
    expect(e).toBeInstanceOf(Error)
    expect(e).toBeInstanceOf(AppError)
  })

  it('covers all ErrorCode variants', () => {
    const codes = Object.values(ErrorCode)
    expect(codes.length).toBeGreaterThan(0)
    for (const code of codes) {
      const e = new AppError({ code, message: code })
      expect(e.code).toBe(code)
    }
  })
})

describe('ok', () => {
  it('creates a success Result', () => {
    const result = ok(42)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe(42)
    }
  })

  it('works with object values', () => {
    const val = { id: 'abc' }
    const result = ok(val)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe(val)
  })

  it('works with null', () => {
    const result = ok(null)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBeNull()
  })
})

describe('err', () => {
  it('creates a failure Result', () => {
    const error = new AppError({ code: ErrorCode.DB_QUERY_FAILED, message: 'db error' })
    const result = err(error)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe(error)
  })

  it('works with plain strings', () => {
    const result = err('something went wrong')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('something went wrong')
  })
})
