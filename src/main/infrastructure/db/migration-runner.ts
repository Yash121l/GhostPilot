/**
 * @module migration-runner
 * Runs pending SQL migrations at startup using better-sqlite3.
 * All migrations are embedded as string constants — no filesystem reads,
 * no path resolution, works identically in dev, packaged builds, and tests.
 *
 * To add a migration: run `npm run db:generate`, then append a new entry
 * to the MIGRATIONS array below with the generated SQL content.
 */

import { getRawDb } from './connection'
import { createLogger } from '../logger/logger'

const logger = createLogger('MigrationRunner')

// ── Embedded migrations ────────────────────────────────────────────────────────
// SQL is inlined at compile time — never read from disk at runtime.
const MIGRATIONS: Array<{ filename: string; sql: string }> = [
  {
    filename: '0001_init.sql',
    sql: `
CREATE TABLE IF NOT EXISTS \`personas\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`name\` text NOT NULL,
  \`bio\` text NOT NULL DEFAULT '',
  \`pillars\` text NOT NULL DEFAULT '[]',
  \`style_hints\` text NOT NULL DEFAULT '',
  \`created_at\` integer NOT NULL,
  \`updated_at\` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS \`style_fingerprints\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`persona_id\` text NOT NULL REFERENCES \`personas\`(\`id\`) ON DELETE CASCADE,
  \`embedding_json\` text NOT NULL DEFAULT '[]',
  \`descriptors\` text NOT NULL DEFAULT '[]',
  \`avg_sentence_length\` real NOT NULL DEFAULT 0,
  \`tone\` text NOT NULL DEFAULT '',
  \`computed_at\` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS \`posts\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`persona_id\` text NOT NULL REFERENCES \`personas\`(\`id\`) ON DELETE CASCADE,
  \`status\` text NOT NULL DEFAULT 'draft',
  \`body\` text NOT NULL DEFAULT '',
  \`platforms\` text NOT NULL DEFAULT '[]',
  \`scheduled_at\` integer,
  \`published_at\` integer,
  \`attempts\` integer NOT NULL DEFAULT 0,
  \`created_at\` integer NOT NULL,
  \`updated_at\` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS \`draft_variants\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`post_id\` text NOT NULL REFERENCES \`posts\`(\`id\`) ON DELETE CASCADE,
  \`platform\` text NOT NULL,
  \`body\` text NOT NULL,
  \`char_count\` integer NOT NULL DEFAULT 0,
  \`style_drift_score\` real NOT NULL DEFAULT 0,
  \`provider\` text NOT NULL,
  \`model_id\` text NOT NULL,
  \`created_at\` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS \`jobs\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`post_id\` text NOT NULL REFERENCES \`posts\`(\`id\`) ON DELETE CASCADE,
  \`variant_id\` text NOT NULL REFERENCES \`draft_variants\`(\`id\`),
  \`platform\` text NOT NULL,
  \`scheduled_at\` integer NOT NULL,
  \`status\` text NOT NULL DEFAULT 'pending',
  \`attempts\` integer NOT NULL DEFAULT 0,
  \`last_error\` text,
  \`created_at\` integer NOT NULL,
  \`updated_at\` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS \`social_connections\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`platform\` text NOT NULL,
  \`platform_user_id\` text NOT NULL,
  \`display_name\` text NOT NULL DEFAULT '',
  \`keychain_key\` text NOT NULL,
  \`expires_at\` integer,
  \`scopes\` text NOT NULL DEFAULT '[]',
  \`created_at\` integer NOT NULL,
  \`updated_at\` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS \`llm_usage\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`ts\` integer NOT NULL,
  \`provider\` text NOT NULL,
  \`model_id\` text NOT NULL,
  \`task\` text NOT NULL,
  \`prompt_tokens\` integer NOT NULL DEFAULT 0,
  \`completion_tokens\` integer NOT NULL DEFAULT 0,
  \`estimated_cost_usd\` real NOT NULL DEFAULT 0,
  \`post_id\` text,
  \`persona_id\` text
);

CREATE TABLE IF NOT EXISTS \`intents\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`persona_id\` text NOT NULL REFERENCES \`personas\`(\`id\`) ON DELETE CASCADE,
  \`title\` text NOT NULL,
  \`description\` text NOT NULL DEFAULT '',
  \`horizon\` text NOT NULL,
  \`created_at\` integer NOT NULL,
  \`updated_at\` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS \`key_results\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`intent_id\` text NOT NULL REFERENCES \`intents\`(\`id\`) ON DELETE CASCADE,
  \`title\` text NOT NULL,
  \`target\` real NOT NULL DEFAULT 0,
  \`current\` real NOT NULL DEFAULT 0,
  \`unit\` text NOT NULL DEFAULT '',
  \`weekly_quota\` text NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS \`trend_clusters\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`title\` text NOT NULL,
  \`summary\` text NOT NULL DEFAULT '',
  \`relevance_score\` real NOT NULL DEFAULT 0,
  \`velocity_score\` real NOT NULL DEFAULT 0,
  \`novelty_score\` real NOT NULL DEFAULT 0,
  \`composite_score\` real NOT NULL DEFAULT 0,
  \`detected_at\` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS \`trend_evidence\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`cluster_id\` text NOT NULL REFERENCES \`trend_clusters\`(\`id\`) ON DELETE CASCADE,
  \`source\` text NOT NULL,
  \`url\` text NOT NULL,
  \`title\` text NOT NULL,
  \`score\` real NOT NULL DEFAULT 0,
  \`fetched_at\` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS \`context_chunks\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`persona_id\` text NOT NULL REFERENCES \`personas\`(\`id\`) ON DELETE CASCADE,
  \`source_file\` text NOT NULL,
  \`chunk_index\` integer NOT NULL,
  \`content\` text NOT NULL,
  \`embedding_json\` text NOT NULL DEFAULT '[]',
  \`created_at\` integer NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS \`context_chunks_fts\` USING fts5(
  content,
  content='context_chunks',
  content_rowid='rowid'
);

CREATE TABLE IF NOT EXISTS \`settings\` (
  \`key\` text PRIMARY KEY NOT NULL,
  \`value\` text NOT NULL DEFAULT '',
  \`updated_at\` integer NOT NULL
);
    `.trim(),
  },

  {
    filename: '0002_add_audit_log.sql',
    sql: `
CREATE TABLE IF NOT EXISTS \`audit_log\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`ts\` integer NOT NULL,
  \`actor\` text NOT NULL,
  \`action\` text NOT NULL,
  \`entity_type\` text NOT NULL,
  \`entity_id\` text,
  \`before_hash\` text,
  \`after_hash\` text,
  \`ip\` text NOT NULL DEFAULT 'local',
  \`outcome\` text NOT NULL CHECK(\`outcome\` IN ('success','failure','blocked')),
  \`error_code\` text,
  \`details_json\` text
);

CREATE TRIGGER IF NOT EXISTS prevent_audit_update
  BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is immutable: UPDATE forbidden');
END;

CREATE TRIGGER IF NOT EXISTS prevent_audit_delete
  BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is immutable: DELETE forbidden');
END;

CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
    `.trim(),
  },

  {
    filename: '0003_ai_provider_keys.sql',
    sql: `
CREATE TABLE IF NOT EXISTS \`ai_provider_keys\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`provider\` text NOT NULL,
  \`label\` text NOT NULL DEFAULT '',
  \`keychain_key\` text NOT NULL,
  \`is_default\` integer NOT NULL DEFAULT 0,
  \`last_used_at\` integer,
  \`created_at\` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_keys_provider ON ai_provider_keys(provider);
CREATE INDEX IF NOT EXISTS idx_ai_keys_default  ON ai_provider_keys(is_default);

CREATE INDEX IF NOT EXISTS idx_posts_status         ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at   ON posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status_sched     ON jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_ts          ON llm_usage(ts DESC);
CREATE INDEX IF NOT EXISTS idx_trend_clusters_score  ON trend_clusters(composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_social_platform       ON social_connections(platform);
    `.trim(),
  },
]

// ── Runner ─────────────────────────────────────────────────────────────────────

function ensureMigrationsTable(db: ReturnType<typeof getRawDb>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `)
}

function getAppliedMigrations(db: ReturnType<typeof getRawDb>): Set<string> {
  const rows = db.prepare('SELECT filename FROM _migrations').all() as { filename: string }[]
  return new Set(rows.map((r) => r.filename))
}

/**
 * Run all pending migrations in order.
 * Called once at startup before any service initialises.
 * @throws if any migration fails — caller shows an error dialog and quits.
 */
export function runMigrations(): void {
  const db = getRawDb()
  ensureMigrationsTable(db)

  const applied = getAppliedMigrations(db)
  let count = 0

  for (const { filename, sql } of MIGRATIONS) {
    if (applied.has(filename)) continue

    logger.info({ msg: `Applying migration: ${filename}` })

    db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)').run(
        filename,
        Date.now(),
      )
    })()

    logger.info({ msg: `Migration applied: ${filename}` })
    count++
  }

  if (count === 0) {
    logger.info({ msg: 'All migrations already applied — DB schema up to date' })
  } else {
    logger.info({ msg: `Applied ${count} migration(s) successfully` })
  }
}
