/**
 * @module error
 * Shared error primitives used across main, preload, and renderer.
 * All IPC handlers return Result<T, AppError> — never throw across boundaries.
 */

/** Exhaustive error codes for every failure scenario in the app. */
export enum ErrorCode {
  // Auth
  OAUTH_FAILED = 'OAUTH_FAILED',
  OAUTH_STATE_MISMATCH = 'OAUTH_STATE_MISMATCH',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_REFRESH_FAILED = 'TOKEN_REFRESH_FAILED',
  TOKEN_NOT_FOUND = 'TOKEN_NOT_FOUND',
  // AI
  AI_PROVIDER_NOT_CONFIGURED = 'AI_PROVIDER_NOT_CONFIGURED',
  AI_CALL_FAILED = 'AI_CALL_FAILED',
  SPEND_CAP_EXCEEDED = 'SPEND_CAP_EXCEEDED',
  // Posts
  POST_NOT_FOUND = 'POST_NOT_FOUND',
  POST_INVALID_TRANSITION = 'POST_INVALID_TRANSITION',
  PUBLISH_FAILED = 'PUBLISH_FAILED',
  // Persona / Context
  PERSONA_NOT_FOUND = 'PERSONA_NOT_FOUND',
  CONTEXT_INGESTION_FAILED = 'CONTEXT_INGESTION_FAILED',
  // DB
  DB_QUERY_FAILED = 'DB_QUERY_FAILED',
  DB_MIGRATION_FAILED = 'DB_MIGRATION_FAILED',
  // Keychain
  KEYCHAIN_READ_FAILED = 'KEYCHAIN_READ_FAILED',
  KEYCHAIN_WRITE_FAILED = 'KEYCHAIN_WRITE_FAILED',
  // Generic
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Typed application error. Extend instead of throwing raw Error objects.
 * Always constructed with a code so callers can pattern-match without
 * inspecting message strings.
 */
export class AppError extends Error {
  /** Machine-readable error code. */
  public readonly code: ErrorCode
  /** Whether the caller should retry this operation. */
  public readonly retryable: boolean
  /** Extra structured context for logging (NO secrets). */
  public readonly context?: Record<string, unknown>

  constructor(opts: {
    code: ErrorCode
    message: string
    retryable?: boolean
    context?: Record<string, unknown>
    cause?: Error
  }) {
    super(opts.message, { cause: opts.cause })
    this.name = 'AppError'
    this.code = opts.code
    this.retryable = opts.retryable ?? false
    this.context = opts.context
  }
}

/**
 * Discriminated-union Result type — never throw across IPC.
 * Use `isOk` / `isErr` helpers to narrow the type.
 */
export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E }

/** Construct a success Result. */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })

/** Construct a failure Result. */
export const err = <E = AppError>(error: E): Result<never, E> => ({
  ok: false,
  error,
})
