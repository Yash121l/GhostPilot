/**
 * @module trend
 * Trend detection and scoring types.
 */

/** A cluster of trending signals from multiple sources. */
export interface TrendCluster {
  id: string
  title: string
  summary: string
  /** Relevance to user's content pillars [0, 1]. */
  relevanceScore: number
  /** How fast the trend is growing [0, 1]. */
  velocityScore: number
  /** How novel / unsaturated the topic is [0, 1]. */
  noveltyScore: number
  /** Composite score = weighted avg of above three. */
  compositeScore: number
  evidence: TrendEvidence[]
  detectedAt: Date
}

/** User configuration for which trends to surface. */
export interface TrendConfig {
  /** Keywords/topics the user wants to track (empty = no filter). */
  keywords: string[]
  /** Which sources to pull from. */
  sources: ('hackernews' | 'reddit')[]
  /** Hide clusters whose compositeScore is below this value (0–1). */
  minScore: number
}

export const DEFAULT_TREND_CONFIG: TrendConfig = {
  keywords: [],
  sources: ['hackernews', 'reddit'],
  minScore: 0,
}

/** A single signal backing a trend cluster. */
export interface TrendEvidence {
  id: string
  clusterId: string
  source: 'reddit' | 'hackernews' | 'youtube' | 'producthunt' | 'rss'
  url: string
  title: string
  score: number
  fetchedAt: Date
}
