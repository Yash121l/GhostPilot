import { describe, it, expect } from 'vitest'
import {
  APP_NAME,
  APP_URL_SCHEME,
  MAX_POST_ATTEMPTS,
  MAX_VARIANTS_PER_POST,
  AI_CALL_TIMEOUT_MS,
  DEFAULT_SPEND_CAP_USD,
  SCHEMA_VERSION,
  OAUTH_CALLBACK_PATH,
  TOKEN_REFRESH_BUFFER_MS,
  OAUTH_STATE_TTL_MS
} from './constants'
import { IPC_CHANNELS } from './ipc-types'

describe('App constants', () => {
  it('has correct app identity', () => {
    expect(APP_NAME).toBe('GhostPilot')
    expect(APP_URL_SCHEME).toBe('ghostpilot')
    expect(OAUTH_CALLBACK_PATH).toBe('/oauth/callback')
  })

  it('has sensible post limits', () => {
    expect(MAX_POST_ATTEMPTS).toBeGreaterThan(0)
    expect(MAX_VARIANTS_PER_POST).toBeGreaterThan(0)
  })

  it('has positive timeout values', () => {
    expect(AI_CALL_TIMEOUT_MS).toBeGreaterThan(0)
    expect(TOKEN_REFRESH_BUFFER_MS).toBeGreaterThan(0)
    expect(OAUTH_STATE_TTL_MS).toBeGreaterThan(0)
  })

  it('has default spend cap', () => {
    expect(DEFAULT_SPEND_CAP_USD).toBeGreaterThan(0)
  })

  it('has schema version', () => {
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(1)
  })
})

describe('IPC_CHANNELS', () => {
  it('contains post channels', () => {
    expect(IPC_CHANNELS.POST_CREATE).toBe('post:create')
    expect(IPC_CHANNELS.POST_LIST).toBe('post:list')
    expect(IPC_CHANNELS.POST_DELETE).toBe('post:delete')
  })

  it('contains auth channels', () => {
    expect(IPC_CHANNELS.AUTH_CONNECT).toBe('auth:connect')
    expect(IPC_CHANNELS.AUTH_STATUS).toBe('auth:status')
  })

  it('contains settings channels', () => {
    expect(IPC_CHANNELS.SETTINGS_GET).toBe('settings:get')
    expect(IPC_CHANNELS.SETTINGS_SET).toBe('settings:set')
  })
})
