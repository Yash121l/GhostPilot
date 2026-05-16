CREATE TABLE IF NOT EXISTS `platform_account_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `platform` text NOT NULL,
  `account_id` text NOT NULL,
  `display_name` text NOT NULL DEFAULT '',
  `followers` integer,
  `following` integer,
  `posts` integer,
  `impressions` integer,
  `views` integer,
  `likes` integer,
  `comments` integer,
  `shares` integer,
  `clicks` integer,
  `fetched_at` integer NOT NULL,
  `unavailable_reason` text
);

CREATE TABLE IF NOT EXISTS `platform_post_insights` (
  `id` text PRIMARY KEY NOT NULL,
  `platform` text NOT NULL,
  `external_id` text NOT NULL,
  `url` text,
  `body_preview` text NOT NULL DEFAULT '',
  `published_at` integer,
  `impressions` integer,
  `views` integer,
  `likes` integer,
  `comments` integer,
  `shares` integer,
  `saves` integer,
  `clicks` integer,
  `engagement_rate` real,
  `fetched_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `platform_hashtag_insights` (
  `id` text PRIMARY KEY NOT NULL,
  `platform` text NOT NULL,
  `tag` text NOT NULL DEFAULT '',
  `post_count` integer,
  `top_posts_json` text NOT NULL DEFAULT '[]',
  `recent_posts_json` text NOT NULL DEFAULT '[]',
  `fetched_at` integer NOT NULL,
  `unavailable_reason` text
);

CREATE INDEX IF NOT EXISTS idx_platform_account_snapshots_platform
  ON platform_account_snapshots(platform, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_post_insights_platform
  ON platform_post_insights(platform, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_hashtag_insights_platform
  ON platform_hashtag_insights(platform, tag, fetched_at DESC);
