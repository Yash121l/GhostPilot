/**
 * @module ipc-types
 * Single source of truth for ALL IPC channel names and their typed payloads.
 */

import type { Result, AppError } from './types/error'
import type { Post, Job, ImageAttachment } from './types/post'
import type { Platform } from './types/platform'
import type { Persona } from './types/persona'
import type { Intent } from './types/intent'
import type { TrendCluster } from './types/trend'
import type {
  AIGatewayRequest,
  AIGatewayResponse,
  LLMUsage,
  ProviderKeyConfig,
  OllamaStatus,
} from './types/ai'

export const IPC_CHANNELS = {
  // Posts
  POST_CREATE: 'post:create',
  POST_GET: 'post:get',
  POST_LIST: 'post:list',
  POST_GENERATE_VARIANTS: 'post:generate-variants',
  POST_APPROVE: 'post:approve',
  POST_SCHEDULE: 'post:schedule',
  POST_DELETE: 'post:delete',
  POST_UPDATE_BODY: 'post:updateBody',

  // Jobs
  JOB_LIST: 'job:list',

  // AI
  AI_COMPLETE: 'ai:complete',
  AI_STREAM_START: 'ai:stream:start',
  AI_STREAM_CHUNK: 'ai:stream:chunk',
  AI_STREAM_END: 'ai:stream:end',
  AI_USAGE_LIST: 'ai:usage:list',
  AI_USAGE_DAILY: 'ai:usage:daily',
  AI_STYLE_DRIFT: 'ai:styleDrift',

  // AI Provider Keys
  AI_KEYS_LIST: 'ai:keys:list',
  AI_KEYS_ADD: 'ai:keys:add',
  AI_KEYS_DELETE: 'ai:keys:delete',
  AI_KEYS_SET_DEFAULT: 'ai:keys:set-default',
  AI_KEYS_TEST: 'ai:keys:test',
  AI_OLLAMA_STATUS: 'ai:ollama:status',

  // Connections (extended Phase 1 channels)
  CONNECTIONS_GET_AUTH_URL: 'connections:getAuthURL',
  CONNECTIONS_LIST: 'connections:list',
  CONNECTIONS_REVOKE: 'connections:revoke',
  CONNECTIONS_RATE_LIMIT_STATE: 'connections:rateLimitState',

  // Persona
  PERSONA_GET: 'persona:get',
  PERSONA_LIST: 'persona:list',
  PERSONA_CREATE: 'persona:create',
  PERSONA_UPDATE: 'persona:update',
  PERSONA_DELETE: 'persona:delete',

  // Intent
  INTENT_LIST: 'intent:list',
  INTENT_CREATE: 'intent:create',
  INTENT_UPDATE: 'intent:update',
  INTENT_DELETE: 'intent:delete',

  // Trends
  TREND_LIST: 'trend:list',
  TREND_REFRESH: 'trend:refresh',
  TREND_DISMISS: 'trend:dismiss',

  // Auth
  AUTH_CONNECT: 'auth:connect',
  AUTH_DISCONNECT: 'auth:disconnect',
  AUTH_STATUS: 'auth:status',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Audit
  AUDIT_QUERY: 'audit:query',

  // Media
  MEDIA_OPEN_DIALOG: 'media:openDialog',
  POST_SET_IMAGES: 'post:setImages',
  AI_IMAGE_GENERATE: 'ai:image:generate',
} as const

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

// ─── Shared payload types ─────────────────────────────────────────────────────

export interface CreatePostInput {
  personaId: string
  body: string
  platforms: Platform[]
  images?: ImageAttachment[]
}

export interface GenerateVariantsInput {
  postId: string
  platforms: Platform[]
  traceId: string
}

export interface ApprovePostInput {
  postId: string
  variantId: string
}

export interface SchedulePostInput {
  postId: string
  variantId: string
  platform: Platform
  scheduledAt: string
}

export interface AuditQueryInput {
  limit?: number
  offset?: number
  entityType?: string
  action?: string
  fromTs?: number
  toTs?: number
}

export interface AuditRow {
  id: string
  ts: number
  actor: string
  action: string
  entityType: string
  entityId?: string
  outcome: 'success' | 'failure' | 'blocked'
  errorCode?: string
  detailsJson?: string
}

export interface SettingsGetInput {
  key: string
}

export interface SettingsSetInput {
  key: string
  value: unknown
}

export interface AuthConnectInput {
  platform: Platform
}

export interface AuthStatusOutput {
  platform: Platform
  connected: boolean
  displayName?: string
  expiresAt?: number
}

export interface AddProviderKeyInput {
  provider: string
  label: string
  secret: string
}

export interface DailyUsage {
  date: string
  totalCostUsd: number
  totalTokens: number
  byProvider: Record<string, number>
}

// ─── Typed IPC Map ────────────────────────────────────────────────────────────

export interface IPCMap {
  [IPC_CHANNELS.POST_CREATE]: { req: CreatePostInput; res: Result<Post, AppError> }
  [IPC_CHANNELS.POST_GET]: { req: { id: string }; res: Result<Post, AppError> }
  [IPC_CHANNELS.POST_LIST]: {
    req: { personaId?: string; limit?: number; offset?: number }
    res: Result<Post[], AppError>
  }
  [IPC_CHANNELS.POST_GENERATE_VARIANTS]: {
    req: GenerateVariantsInput
    res: Result<Post, AppError>
  }
  [IPC_CHANNELS.POST_APPROVE]: { req: ApprovePostInput; res: Result<Post, AppError> }
  [IPC_CHANNELS.POST_SCHEDULE]: { req: SchedulePostInput; res: Result<Job, AppError> }
  [IPC_CHANNELS.POST_DELETE]: { req: { id: string }; res: Result<void, AppError> }

  [IPC_CHANNELS.AI_COMPLETE]: {
    req: AIGatewayRequest
    res: Result<AIGatewayResponse, AppError>
  }
  [IPC_CHANNELS.AI_USAGE_LIST]: {
    req: { limit?: number }
    res: Result<LLMUsage[], AppError>
  }
  [IPC_CHANNELS.AI_USAGE_DAILY]: {
    req: { days?: number }
    res: Result<DailyUsage[], AppError>
  }
  [IPC_CHANNELS.AI_KEYS_LIST]: {
    req: Record<string, never>
    res: Result<ProviderKeyConfig[], AppError>
  }
  [IPC_CHANNELS.AI_KEYS_ADD]: {
    req: AddProviderKeyInput
    res: Result<ProviderKeyConfig, AppError>
  }
  [IPC_CHANNELS.AI_KEYS_DELETE]: {
    req: { id: string }
    res: Result<void, AppError>
  }
  [IPC_CHANNELS.AI_KEYS_SET_DEFAULT]: {
    req: { id: string }
    res: Result<void, AppError>
  }
  [IPC_CHANNELS.AI_KEYS_TEST]: {
    req: { id: string }
    res: Result<{ latencyMs: number; model: string }, AppError>
  }
  [IPC_CHANNELS.AI_OLLAMA_STATUS]: {
    req: Record<string, never>
    res: Result<OllamaStatus, AppError>
  }

  [IPC_CHANNELS.PERSONA_GET]: { req: { id: string }; res: Result<Persona, AppError> }
  [IPC_CHANNELS.PERSONA_LIST]: { req: Record<string, never>; res: Result<Persona[], AppError> }
  [IPC_CHANNELS.PERSONA_CREATE]: {
    req: Omit<Persona, 'id' | 'createdAt' | 'updatedAt' | 'latestFingerprint'>
    res: Result<Persona, AppError>
  }
  [IPC_CHANNELS.PERSONA_UPDATE]: {
    req: Partial<Omit<Persona, 'id' | 'createdAt' | 'updatedAt'>> & { id: string }
    res: Result<Persona, AppError>
  }
  [IPC_CHANNELS.PERSONA_DELETE]: { req: { id: string }; res: Result<void, AppError> }

  [IPC_CHANNELS.INTENT_LIST]: {
    req: { personaId?: string }
    res: Result<Intent[], AppError>
  }
  [IPC_CHANNELS.INTENT_CREATE]: {
    req: Omit<Intent, 'id' | 'createdAt' | 'updatedAt' | 'keyResults'>
    res: Result<Intent, AppError>
  }
  [IPC_CHANNELS.INTENT_UPDATE]: {
    req: Partial<Omit<Intent, 'id' | 'createdAt' | 'updatedAt'>> & { id: string }
    res: Result<Intent, AppError>
  }
  [IPC_CHANNELS.INTENT_DELETE]: { req: { id: string }; res: Result<void, AppError> }

  [IPC_CHANNELS.TREND_LIST]: {
    req: { limit?: number }
    res: Result<TrendCluster[], AppError>
  }
  [IPC_CHANNELS.TREND_REFRESH]: {
    req: Record<string, never>
    res: Result<void, AppError>
  }
  [IPC_CHANNELS.TREND_DISMISS]: {
    req: { id: string }
    res: Result<void, AppError>
  }

  [IPC_CHANNELS.AUTH_CONNECT]: {
    req: AuthConnectInput
    res: Result<void, AppError>
  }
  [IPC_CHANNELS.AUTH_DISCONNECT]: {
    req: { platform: Platform }
    res: Result<void, AppError>
  }
  [IPC_CHANNELS.AUTH_STATUS]: {
    req: Record<string, never>
    res: Result<AuthStatusOutput[], AppError>
  }

  [IPC_CHANNELS.SETTINGS_GET]: {
    req: SettingsGetInput
    res: Result<unknown, AppError>
  }
  [IPC_CHANNELS.SETTINGS_SET]: {
    req: SettingsSetInput
    res: Result<void, AppError>
  }

  [IPC_CHANNELS.AUDIT_QUERY]: {
    req: AuditQueryInput
    res: Result<AuditRow[], AppError>
  }

  [IPC_CHANNELS.MEDIA_OPEN_DIALOG]: {
    req: Record<string, never>
    res: Result<ImageAttachment[], AppError>
  }
  [IPC_CHANNELS.POST_SET_IMAGES]: {
    req: { postId: string; images: ImageAttachment[] }
    res: Result<Post, AppError>
  }
  [IPC_CHANNELS.AI_IMAGE_GENERATE]: {
    req: { prompt: string }
    res: Result<ImageAttachment, AppError>
  }

  // Phase 1 — Posts
  [IPC_CHANNELS.POST_UPDATE_BODY]: {
    req: { id: string; body: string }
    res: Result<Post, AppError>
  }

  // Phase 1 — Jobs
  [IPC_CHANNELS.JOB_LIST]: {
    req: { postId?: string; status?: string; limit?: number }
    res: Result<Job[], AppError>
  }

  // Phase 1 — AI style drift
  [IPC_CHANNELS.AI_STYLE_DRIFT]: {
    req: { personaId: string; text: string }
    res: Result<{ score: number }, AppError>
  }

  // Phase 1 — Connections
  [IPC_CHANNELS.CONNECTIONS_GET_AUTH_URL]: {
    req: { platform: Platform }
    res: Result<string, AppError>
  }
  [IPC_CHANNELS.CONNECTIONS_LIST]: {
    req: Record<string, never>
    res: Result<ConnectionInfo[], AppError>
  }
  [IPC_CHANNELS.CONNECTIONS_REVOKE]: {
    req: { platform: Platform }
    res: Result<void, AppError>
  }
  [IPC_CHANNELS.CONNECTIONS_RATE_LIMIT_STATE]: {
    req: { platform: Platform }
    res: Result<RateLimitInfo, AppError>
  }
}

export interface ConnectionInfo {
  platform: Platform
  connected: boolean
  displayName?: string
  expiresAt?: number
  /** Whether the token is expired or about to expire (<1h). */
  needsReauth: boolean
}

export interface RateLimitInfo {
  platform: Platform
  remaining: number
  limit: number
  resetsAt: number
  exceeded: boolean
}
