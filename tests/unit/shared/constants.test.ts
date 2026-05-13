import { describe, it, expect } from 'vitest'
import {
  APP_NAME,
  APP_URL_SCHEME,
  OAUTH_CALLBACK_PATH,
  OAUTH_REDIRECT_URI,
  OAUTH_FALLBACK_PORT,
  MAX_POST_ATTEMPTS,
  MAX_VARIANTS_PER_POST,
  MAX_CONTEXT_CHUNKS,
  MAX_AUDIT_EXPORT_ROWS,
  OAUTH_STATE_TTL_MS,
  TOKEN_REFRESH_BUFFER_MS,
  AI_CALL_TIMEOUT_MS,
  DEFAULT_SPEND_CAP_USD,
  SCHEMA_VERSION,
  DB_FILE_NAME,
  CRON_PUBLISH_DISPATCHER,
} from '../../../src/shared/constants'

describe('App identity', () => {
  it('has correct app name', () => expect(APP_NAME).toBe('GhostPilot'))
  it('has correct URL scheme', () => expect(APP_URL_SCHEME).toBe('ghostpilot'))
  it('has correct OAuth callback path', () => expect(OAUTH_CALLBACK_PATH).toBe('/oauth/callback'))
  it('has correct OAuth redirect URI', () => {
    expect(OAUTH_REDIRECT_URI).toBe('https://ghostpilot.yashlunawat.com/oauth/callback')
  })
  it('has correct OAuth fallback port', () => {
    expect(OAUTH_FALLBACK_PORT).toBe(49152)
    expect(OAUTH_FALLBACK_PORT).toBeGreaterThan(1024) // not a privileged port
  })
})

describe('Post limits', () => {
  it('MAX_POST_ATTEMPTS is 3', () => expect(MAX_POST_ATTEMPTS).toBe(3))
  it('MAX_VARIANTS_PER_POST is positive', () => expect(MAX_VARIANTS_PER_POST).toBeGreaterThan(0))
  it('MAX_CONTEXT_CHUNKS is positive', () => expect(MAX_CONTEXT_CHUNKS).toBeGreaterThan(0))
  it('MAX_AUDIT_EXPORT_ROWS is positive', () => expect(MAX_AUDIT_EXPORT_ROWS).toBeGreaterThan(0))
})

describe('Timeouts', () => {
  it('OAUTH_STATE_TTL_MS is 10 minutes', () => {
    expect(OAUTH_STATE_TTL_MS).toBe(10 * 60 * 1000)
  })
  it('TOKEN_REFRESH_BUFFER_MS is 5 minutes', () => {
    expect(TOKEN_REFRESH_BUFFER_MS).toBe(5 * 60 * 1000)
  })
  it('AI_CALL_TIMEOUT_MS is positive', () => {
    expect(AI_CALL_TIMEOUT_MS).toBeGreaterThan(0)
  })
  it('TOKEN_REFRESH_BUFFER_MS < OAUTH_STATE_TTL_MS', () => {
    expect(TOKEN_REFRESH_BUFFER_MS).toBeLessThan(OAUTH_STATE_TTL_MS)
  })
})

describe('AI spend cap', () => {
  it('DEFAULT_SPEND_CAP_USD is $10', () => expect(DEFAULT_SPEND_CAP_USD).toBe(10.0))
  it('DEFAULT_SPEND_CAP_USD is positive', () => expect(DEFAULT_SPEND_CAP_USD).toBeGreaterThan(0))
})

describe('Database', () => {
  it('DB_FILE_NAME ends with .db', () => expect(DB_FILE_NAME).toMatch(/\.db$/))
  it('SCHEMA_VERSION is at least 1', () => expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(1))
})

describe('Cron schedules', () => {
  it('CRON_PUBLISH_DISPATCHER runs every minute', () => {
    expect(CRON_PUBLISH_DISPATCHER).toBe('* * * * *')
  })
})
