/**
 * Test database helper.
 * Creates an in-memory SQLite database with the full GhostPilot schema
 * without requiring Electron's app.getPath().
 */
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../src/main/infrastructure/db/schema'

// ─── Module-level singleton so tests share one DB per file ────────────────────

let _db: ReturnType<typeof drizzle> | null = null
let _sqlite: Database.Database | null = null

/**
 * Create (or return existing) in-memory test database.
 * Applies the full schema via raw SQL so we don't need migrations.
 */
export function createTestDb(): ReturnType<typeof drizzle> {
  if (_db) return _db

  _sqlite = new Database(':memory:')
  _sqlite.pragma('foreign_keys = ON')
  _sqlite.pragma('journal_mode = WAL')

  // Create all tables matching schema.ts
  _sqlite.exec(`
    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      pillars TEXT NOT NULL DEFAULT '[]',
      style_hints TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS style_fingerprints (
      id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
      embedding_json TEXT NOT NULL DEFAULT '[]',
      descriptors TEXT NOT NULL DEFAULT '[]',
      avg_sentence_length REAL NOT NULL DEFAULT 0,
      tone TEXT NOT NULL DEFAULT '',
      computed_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'draft',
      body TEXT NOT NULL DEFAULT '',
      platforms TEXT NOT NULL DEFAULT '[]',
      scheduled_at INTEGER,
      published_at INTEGER,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS draft_variants (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      body TEXT NOT NULL,
      char_count INTEGER NOT NULL DEFAULT 0,
      style_drift_score REAL NOT NULL DEFAULT 0,
      provider TEXT NOT NULL,
      model_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      variant_id TEXT NOT NULL REFERENCES draft_variants(id),
      platform TEXT NOT NULL,
      scheduled_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS social_connections (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      platform_user_id TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      keychain_key TEXT NOT NULL,
      expires_at INTEGER,
      scopes TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS llm_usage (
      id TEXT PRIMARY KEY,
      ts INTEGER NOT NULL,
      provider TEXT NOT NULL,
      model_id TEXT NOT NULL,
      task TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost_usd REAL NOT NULL DEFAULT 0,
      post_id TEXT,
      persona_id TEXT
    );

    CREATE TABLE IF NOT EXISTS intents (
      id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      horizon TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS key_results (
      id TEXT PRIMARY KEY,
      intent_id TEXT NOT NULL REFERENCES intents(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      target REAL NOT NULL DEFAULT 0,
      current REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT '',
      weekly_quota TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS trend_clusters (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      relevance_score REAL NOT NULL DEFAULT 0,
      velocity_score REAL NOT NULL DEFAULT 0,
      novelty_score REAL NOT NULL DEFAULT 0,
      composite_score REAL NOT NULL DEFAULT 0,
      detected_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trend_evidence (
      id TEXT PRIMARY KEY,
      cluster_id TEXT NOT NULL REFERENCES trend_clusters(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      score REAL NOT NULL DEFAULT 0,
      fetched_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_provider_keys (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      keychain_key TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      last_used_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      ts INTEGER NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      before_hash TEXT,
      after_hash TEXT,
      ip TEXT NOT NULL DEFAULT 'local',
      outcome TEXT NOT NULL,
      error_code TEXT,
      details_json TEXT
    );

    CREATE TABLE IF NOT EXISTS context_chunks (
      id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
      source_file TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL
    );
  `)

  _db = drizzle(_sqlite, { schema })
  return _db
}

/** Reset all tables between tests. */
export function clearTestDb(): void {
  if (!_sqlite) return
  _sqlite.exec(`
    DELETE FROM jobs;
    DELETE FROM draft_variants;
    DELETE FROM posts;
    DELETE FROM key_results;
    DELETE FROM intents;
    DELETE FROM style_fingerprints;
    DELETE FROM context_chunks;
    DELETE FROM personas;
    DELETE FROM social_connections;
    DELETE FROM llm_usage;
    DELETE FROM ai_provider_keys;
    DELETE FROM settings;
    DELETE FROM trend_evidence;
    DELETE FROM trend_clusters;
    DELETE FROM audit_log;
  `)
}

/** Return the raw better-sqlite3 instance (for mocking getRawDb in unit tests). */
export function getRawTestDb(): Database.Database {
  if (!_sqlite) createTestDb()
  return _sqlite!
}

/** Close and destroy the test database. */
export function closeTestDb(): void {
  _sqlite?.close()
  _sqlite = null
  _db = null
}
