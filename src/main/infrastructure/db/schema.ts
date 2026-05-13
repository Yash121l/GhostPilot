/**
 * @module schema
 * Drizzle ORM table definitions — single source of truth for the DB schema.
 * All migrations are generated from this file via `drizzle-kit generate`.
 *
 * RULES:
 *  - Never store raw API keys or tokens in any column.
 *  - audit_log is append-only (enforced by SQLite triggers).
 *  - Use nanoid() for all primary keys.
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// ─── Personas ─────────────────────────────────────────────────────────────────

export const personas = sqliteTable('personas', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  bio: text('bio').notNull().default(''),
  pillars: text('pillars').notNull().default('[]'), // JSON array
  styleHints: text('style_hints').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Style Fingerprints ───────────────────────────────────────────────────────

export const styleFingerprints = sqliteTable('style_fingerprints', {
  id: text('id').primaryKey(),
  personaId: text('persona_id')
    .notNull()
    .references(() => personas.id, { onDelete: 'cascade' }),
  /** Serialized float32 vector (stored as BLOB via sqlite-vec). */
  embeddingJson: text('embedding_json').notNull().default('[]'),
  descriptors: text('descriptors').notNull().default('[]'), // JSON array
  avgSentenceLength: real('avg_sentence_length').notNull().default(0),
  tone: text('tone').notNull().default(''),
  computedAt: integer('computed_at', { mode: 'timestamp' }).notNull(),
})

// ─── Posts ────────────────────────────────────────────────────────────────────

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  personaId: text('persona_id')
    .notNull()
    .references(() => personas.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('draft'),
  body: text('body').notNull().default(''),
  platforms: text('platforms').notNull().default('[]'), // JSON array
  scheduledAt: integer('scheduled_at', { mode: 'timestamp' }),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  attempts: integer('attempts').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Draft Variants ───────────────────────────────────────────────────────────

export const draftVariants = sqliteTable('draft_variants', {
  id: text('id').primaryKey(),
  postId: text('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  body: text('body').notNull(),
  charCount: integer('char_count').notNull().default(0),
  styleDriftScore: real('style_drift_score').notNull().default(0),
  provider: text('provider').notNull(),
  modelId: text('model_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  postId: text('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  variantId: text('variant_id')
    .notNull()
    .references(() => draftVariants.id),
  platform: text('platform').notNull(),
  scheduledAt: integer('scheduled_at', { mode: 'timestamp' }).notNull(),
  status: text('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Social Connections ───────────────────────────────────────────────────────

export const socialConnections = sqliteTable('social_connections', {
  id: text('id').primaryKey(),
  platform: text('platform').notNull(),
  /** External platform user ID — safe to store, NOT the token. */
  platformUserId: text('platform_user_id').notNull(),
  displayName: text('display_name').notNull().default(''),
  /** Keychain service key for looking up tokens — never store token here. */
  keychainKey: text('keychain_key').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  scopes: text('scopes').notNull().default('[]'), // JSON array
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── LLM Usage ───────────────────────────────────────────────────────────────

export const llmUsage = sqliteTable('llm_usage', {
  id: text('id').primaryKey(),
  ts: integer('ts', { mode: 'timestamp' }).notNull(),
  provider: text('provider').notNull(),
  modelId: text('model_id').notNull(),
  task: text('task').notNull(),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  estimatedCostUsd: real('estimated_cost_usd').notNull().default(0),
  postId: text('post_id'),
  personaId: text('persona_id'),
})

// ─── Intent / Goals ───────────────────────────────────────────────────────────

export const intents = sqliteTable('intents', {
  id: text('id').primaryKey(),
  personaId: text('persona_id')
    .notNull()
    .references(() => personas.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  horizon: text('horizon').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const keyResults = sqliteTable('key_results', {
  id: text('id').primaryKey(),
  intentId: text('intent_id')
    .notNull()
    .references(() => intents.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  target: real('target').notNull().default(0),
  current: real('current').notNull().default(0),
  unit: text('unit').notNull().default(''),
  weeklyQuota: text('weekly_quota').notNull().default('{}'), // JSON ContentQuota
})

// ─── Trend Clusters ───────────────────────────────────────────────────────────

export const trendClusters = sqliteTable('trend_clusters', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  summary: text('summary').notNull().default(''),
  relevanceScore: real('relevance_score').notNull().default(0),
  velocityScore: real('velocity_score').notNull().default(0),
  noveltyScore: real('novelty_score').notNull().default(0),
  compositeScore: real('composite_score').notNull().default(0),
  detectedAt: integer('detected_at', { mode: 'timestamp' }).notNull(),
})

export const trendEvidence = sqliteTable('trend_evidence', {
  id: text('id').primaryKey(),
  clusterId: text('cluster_id')
    .notNull()
    .references(() => trendClusters.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  url: text('url').notNull(),
  title: text('title').notNull(),
  score: real('score').notNull().default(0),
  fetchedAt: integer('fetched_at', { mode: 'timestamp' }).notNull(),
})

// ─── Context Chunks (for hybrid BM25+vec retrieval) ──────────────────────────

export const contextChunks = sqliteTable('context_chunks', {
  id: text('id').primaryKey(),
  personaId: text('persona_id')
    .notNull()
    .references(() => personas.id, { onDelete: 'cascade' }),
  sourceFile: text('source_file').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(), // for FTS5
  /** Serialized float32 embedding for sqlite-vec. */
  embeddingJson: text('embedding_json').notNull().default('[]'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// ─── AI Provider Keys ─────────────────────────────────────────────────────────

export const aiProviderKeys = sqliteTable('ai_provider_keys', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(), // 'openai' | 'anthropic' | 'ollama' | 'openrouter' | 'groq'
  label: text('label').notNull().default(''),
  /** Keychain reference — actual secret is NEVER stored in DB. */
  keychainKey: text('keychain_key').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// ─── Settings ─────────────────────────────────────────────────────────────────

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull().default(''), // JSON-encoded
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Audit Log (APPEND-ONLY) ──────────────────────────────────────────────────
// Immutability enforced by SQLite triggers (see migration 0002).

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  ts: integer('ts', { mode: 'timestamp' }).notNull(),
  actor: text('actor').notNull(), // userId | 'system' | 'worker:{name}'
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  beforeHash: text('before_hash'),
  afterHash: text('after_hash'),
  ip: text('ip').notNull().default('local'),
  outcome: text('outcome', { enum: ['success', 'failure', 'blocked'] }).notNull(),
  errorCode: text('error_code'),
  /** Safe metadata JSON — NO tokens, NO key values. */
  detailsJson: text('details_json'),
})

// ─── Audit Action Enum ────────────────────────────────────────────────────────

export enum AuditAction {
  // Auth
  OAUTH_INITIATED = 'OAUTH_INITIATED',
  OAUTH_CALLBACK = 'OAUTH_CALLBACK',
  TOKEN_STORED = 'TOKEN_STORED',
  TOKEN_REFRESHED = 'TOKEN_REFRESHED',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  CONNECTION_DELETED = 'CONNECTION_DELETED',
  // AI Keys
  AI_KEY_ADDED = 'AI_KEY_ADDED',
  AI_KEY_REMOVED = 'AI_KEY_REMOVED',
  AI_KEY_ACCESSED = 'AI_KEY_ACCESSED',
  // LLM Calls
  LLM_CALL_STARTED = 'LLM_CALL_STARTED',
  LLM_CALL_COMPLETED = 'LLM_CALL_COMPLETED',
  LLM_CALL_FAILED = 'LLM_CALL_FAILED',
  SPEND_CAP_HIT = 'SPEND_CAP_HIT',
  // Posts
  POST_CREATED = 'POST_CREATED',
  POST_VARIANT_GENERATED = 'POST_VARIANT_GENERATED',
  POST_APPROVED = 'POST_APPROVED',
  POST_SCHEDULED = 'POST_SCHEDULED',
  POST_PUBLISHED = 'POST_PUBLISHED',
  POST_PUBLISH_FAILED = 'POST_PUBLISH_FAILED',
  POST_DELETED = 'POST_DELETED',
  // Auto-reply
  REPLY_GENERATED = 'REPLY_GENERATED',
  REPLY_SENT = 'REPLY_SENT',
  REPLY_BLOCKED_MODERATION = 'REPLY_BLOCKED_MODERATION',
  AUTO_REPLY_ENABLED = 'AUTO_REPLY_ENABLED',
  AUTO_REPLY_DISABLED = 'AUTO_REPLY_DISABLED',
  // Persona / Context
  CONTEXT_INGESTED = 'CONTEXT_INGESTED',
  FINGERPRINT_COMPUTED = 'FINGERPRINT_COMPUTED',
  PERSONA_UPDATED = 'PERSONA_UPDATED',
  PERSONA_EXPORTED = 'PERSONA_EXPORTED',
  // Jobs / Background
  JOB_CREATED = 'JOB_CREATED',
  JOB_RETRIED = 'JOB_RETRIED',
  JOB_CANCELLED = 'JOB_CANCELLED',
  // Settings
  SETTINGS_CHANGED = 'SETTINGS_CHANGED',
  SPEND_CAP_CHANGED = 'SPEND_CAP_CHANGED',
  TELEMETRY_OPT_IN = 'TELEMETRY_OPT_IN',
  TELEMETRY_OPT_OUT = 'TELEMETRY_OPT_OUT',
}
