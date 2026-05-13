import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { getDb } from '../../infrastructure/db/connection'
import { trendClusters, trendEvidence, settings } from '../../infrastructure/db/schema'
import { fetchHackerNews } from './sources/hackernews'
import { fetchReddit } from './sources/reddit'
import type { RawTrendItem } from './sources/hackernews'
import { createLogger } from '../../infrastructure/logger/logger'
import type { TrendCluster, TrendConfig } from '../../../shared/types/trend'
import { DEFAULT_TREND_CONFIG } from '../../../shared/types/trend'

const logger = createLogger('TrendWatcher')

async function readConfig(): Promise<TrendConfig> {
  try {
    const db = getDb()
    const rows = await db.select().from(settings).where(eq(settings.key, 'trend:config'))
    if (rows[0]) return JSON.parse(rows[0].value) as TrendConfig
  } catch { /* ignore */ }
  return DEFAULT_TREND_CONFIG
}

function velocityScore(cluster: RawTrendItem[]): number {
  const maxScore = Math.max(...cluster.map((i) => i.score))
  // log10 scale: score=10→0.25, score=100→0.5, score=1000→0.75, score=10000→1.0
  return Math.min(1, Math.log10(Math.max(1, maxScore) + 1) / 4)
}

function noveltyScore(cluster: RawTrendItem[]): number {
  // Fewer items in cluster = niche/novel; more items = saturated
  return Math.max(0.2, Math.min(0.95, 1 - (cluster.length - 1) * 0.07))
}

function relevanceScore(cluster: RawTrendItem[], config: TrendConfig): number {
  const title = cluster[0].title.toLowerCase()
  const allWords = cluster.map((i) => i.title.toLowerCase()).join(' ')

  if (config.keywords.length > 0) {
    const matchCount = config.keywords.filter((kw) =>
      allWords.includes(kw.toLowerCase()),
    ).length
    return Math.min(0.95, 0.3 + (matchCount / config.keywords.length) * 0.65)
  }

  // No keywords — use source diversity + score magnitude as proxy
  const sources = new Set(cluster.map((i) => i.source))
  const avgScore = cluster.reduce((s, i) => s + i.score, 0) / cluster.length
  const sourceBonus = Math.min(0.25, (sources.size - 1) * 0.15)
  const scoreBonus = Math.min(0.15, Math.log10(Math.max(1, avgScore) + 1) / 8)

  // Spread relevance across [0.35, 0.85] based on title length diversity
  const titleLengthFactor = Math.min(0.1, title.split(' ').length * 0.015)
  return Math.min(0.85, 0.35 + sourceBonus + scoreBonus + titleLengthFactor)
}

export class TrendWatcher {
  async refresh(): Promise<void> {
    logger.info({ msg: 'Refreshing trends' })

    const config = await readConfig()

    const tasks: Promise<RawTrendItem[]>[] = []
    if (config.sources.includes('hackernews')) tasks.push(fetchHackerNews(30))
    if (config.sources.includes('reddit')) tasks.push(fetchReddit(25))

    if (!tasks.length) {
      logger.warn({ msg: 'All sources disabled — nothing to fetch' })
      return
    }

    const settled = await Promise.allSettled(tasks)
    const allItems: RawTrendItem[] = settled.flatMap((r) =>
      r.status === 'fulfilled' ? r.value : [],
    )

    if (!allItems.length) {
      logger.warn({ msg: 'No trend items fetched' })
      return
    }

    const clusters = this.clusterByTitle(allItems)
    const db = getDb()
    const now = new Date()

    // Clear stale data so old hardcoded scores don't persist
    await db.delete(trendEvidence)
    await db.delete(trendClusters)

    for (const cluster of clusters) {
      const id = nanoid()
      const vel = velocityScore(cluster)
      const nov = noveltyScore(cluster)
      const rel = relevanceScore(cluster, config)
      const composite = vel * 0.4 + rel * 0.35 + nov * 0.25

      await db.insert(trendClusters).values({
        id,
        title: cluster[0].title,
        summary: `${cluster.length} signal${cluster.length !== 1 ? 's' : ''} from ${[...new Set(cluster.map((c) => c.source))].join(', ')}`,
        relevanceScore: rel,
        velocityScore: vel,
        noveltyScore: nov,
        compositeScore: composite,
        detectedAt: now,
      })

      for (const item of cluster.slice(0, 3)) {
        await db.insert(trendEvidence).values({
          id: nanoid(),
          clusterId: id,
          source: item.source,
          url: item.url,
          title: item.title,
          score: item.score,
          fetchedAt: item.fetchedAt,
        })
      }
    }

    logger.info({ msg: 'Trends refreshed', clusters: clusters.length })
  }

  async list(limit = 20): Promise<TrendCluster[]> {
    const config = await readConfig()
    const db = getDb()
    const clusters = await db.select().from(trendClusters)
    const evidence = await db.select().from(trendEvidence)

    const evByCluster = new Map<string, typeof evidence>()
    for (const e of evidence) {
      const arr = evByCluster.get(e.clusterId) ?? []
      arr.push(e)
      evByCluster.set(e.clusterId, arr)
    }

    return clusters
      .filter((c) => c.compositeScore >= config.minScore)
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, limit)
      .map((c) => ({
        id: c.id,
        title: c.title,
        summary: c.summary,
        relevanceScore: c.relevanceScore,
        velocityScore: c.velocityScore,
        noveltyScore: c.noveltyScore,
        compositeScore: c.compositeScore,
        evidence: (evByCluster.get(c.id) ?? []).map((e) => ({
          id: e.id,
          clusterId: e.clusterId,
          source: e.source as 'hackernews' | 'reddit',
          url: e.url,
          title: e.title,
          score: e.score,
          fetchedAt: e.fetchedAt,
        })),
        detectedAt: c.detectedAt,
      }))
  }

  async dismiss(id: string): Promise<void> {
    const db = getDb()
    await db.delete(trendClusters).where(eq(trendClusters.id, id))
  }

  private clusterByTitle(items: RawTrendItem[]): RawTrendItem[][] {
    const clusters: RawTrendItem[][] = []
    const used = new Set<number>()

    for (let i = 0; i < items.length; i++) {
      if (used.has(i)) continue
      const cluster = [items[i]]
      used.add(i)

      const wordsI = new Set(items[i].title.toLowerCase().split(/\W+/).filter((w) => w.length > 4))

      for (let j = i + 1; j < items.length; j++) {
        if (used.has(j)) continue
        const wordsJ = new Set(items[j].title.toLowerCase().split(/\W+/).filter((w) => w.length > 4))
        const intersection = [...wordsI].filter((w) => wordsJ.has(w))
        if (intersection.length >= 2) {
          cluster.push(items[j])
          used.add(j)
        }
      }

      clusters.push(cluster)
    }

    return clusters.sort(
      (a, b) => Math.max(...b.map((i) => i.score)) - Math.max(...a.map((i) => i.score)),
    )
  }
}
