-- 0003_ai_provider_keys.sql
-- AI provider key registry. Raw keys never stored — only keychain references.

CREATE TABLE IF NOT EXISTS `ai_provider_keys` (
  `id` text PRIMARY KEY NOT NULL,
  `provider` text NOT NULL,        -- 'openai' | 'anthropic' | 'ollama' | 'openrouter' | 'groq'
  `label` text NOT NULL DEFAULT '', -- user-visible name e.g. "My OpenAI key"
  `keychain_key` text NOT NULL,     -- reference into OS keychain; actual secret never here
  `is_default` integer NOT NULL DEFAULT 0,
  `last_used_at` integer,
  `created_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_keys_provider ON ai_provider_keys(provider);
CREATE INDEX IF NOT EXISTS idx_ai_keys_default  ON ai_provider_keys(is_default);

-- Indexes on hot query paths
CREATE INDEX IF NOT EXISTS idx_posts_status         ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at   ON posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status_sched     ON jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_ts          ON llm_usage(ts DESC);
CREATE INDEX IF NOT EXISTS idx_trend_clusters_score  ON trend_clusters(composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_social_platform       ON social_connections(platform);
