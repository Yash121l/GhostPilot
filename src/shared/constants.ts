/**
 * @module constants
 * App-wide constants. Import from here — never hardcode these values.
 */

export const APP_NAME = 'GhostPilot'
export const APP_URL_SCHEME = 'ghostpilot'
export const OAUTH_CALLBACK_PATH = '/oauth/callback'

// ─── Limits ───────────────────────────────────────────────────────────────────

export const MAX_POST_ATTEMPTS = 3
export const MAX_VARIANTS_PER_POST = 5
export const MAX_CONTEXT_CHUNKS = 20
export const MAX_AUDIT_EXPORT_ROWS = 10_000

// ─── Timeouts (ms) ───────────────────────────────────────────────────────────

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000 // refresh 5 min before expiry
export const AI_CALL_TIMEOUT_MS = 60_000
export const WORKER_RESTART_DELAY_MS = 3_000

// ─── Cron schedules ───────────────────────────────────────────────────────────

export const CRON_PUBLISH_DISPATCHER = '* * * * *' // every minute
export const CRON_TREND_WATCHER = '0 * * * *' // every hour
export const CRON_FINGERPRINT = '0 2 * * *' // 2 AM daily
export const CRON_TOKEN_REFRESH = '*/15 * * * *' // every 15 minutes
export const CRON_MORNING_BRIEF = '0 7 * * *' // 7 AM daily
export const CRON_WEEKLY_RECONCILER = '0 8 * * 1' // Monday 8 AM

// ─── DB ───────────────────────────────────────────────────────────────────────

export const DB_FILE_NAME = 'ghostpilot.db'
export const DB_WAL_CHECKPOINT_INTERVAL = 1_000 // pages

// ─── Logging ─────────────────────────────────────────────────────────────────

export const LOG_RETENTION_DAYS = 7
export const LOG_MAX_SIZE_MB = 50

// ─── AI ───────────────────────────────────────────────────────────────────────

export const DEFAULT_SPEND_CAP_USD = 10.0
export const TRUST_RAMP_REPLY_THRESHOLD = 50

// ─── Versions ─────────────────────────────────────────────────────────────────

export const SCHEMA_VERSION = 1
