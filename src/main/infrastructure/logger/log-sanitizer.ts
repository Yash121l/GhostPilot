/**
 * @module log-sanitizer
 * Strips secrets from log payloads before they are written to disk.
 * NEVER log raw API keys, tokens, or PII. This is the last line of defence.
 */

const REDACT_KEYS = new Set([
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'apiKey',
  'api_key',
  'key',
  'secret',
  'password',
  'authorization',
  'Authorization',
  'bearer',
  'Bearer'
])

const REDACTED = '[REDACTED]'

/**
 * Deep-clone an object, replacing any value whose key is in REDACT_KEYS
 * with the string '[REDACTED]'. Handles nested objects and arrays.
 */
export function sanitizeForLog(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sanitizeForLog)

  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = REDACT_KEYS.has(k) ? REDACTED : sanitizeForLog(v)
  }
  return result
}
