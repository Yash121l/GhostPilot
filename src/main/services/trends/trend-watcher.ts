import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { getDb } from '../../infrastructure/db/connection'
import { trendClusters, trendEvidence } from '../../infrastructure/db/schema'
import { fetchHackerNews } from './sources/hackernews'
import { fetchReddit } from './sources/reddit'
import type { RawTrendItem } from './sources/hackernews'
import { createLogger } from '../../infrastructure/logger/logger'
import type { TrendCluster } from '../../../shared/types/trend'

const logger = createLogger('TrendWatcher')

export class TrendWatcher {
  async refresh(): Promise<void> {
    logger.info({ msg: 'Refreshing trends' })

    const [hnItems, redditItems] = await Promise.allSettled([fetchHackerNews(30), fetchReddit(25)])

    const allItems: RawTrendItem[] = [
      ...(hnItems.status === 'fulfilled' ? hnItems.value : []),
      ...(redditItems.status === 'fulfilled' ? redditItems.value : []),
    ]

    if (!allItems.length) {
      logger.warn({ msg: 'No trend items fetched' })
      return
    }

    // Cluster by keyword overlap (simple title word matching)
    const clusters = this.clusterByTitle(allItems)

    const db = getDb()
    const now = new Date()

    for (const cluster of clusters) {
      const id = nanoid()
      const maxScore = Math.max(...cluster.map((i) => i.score))
      const normalizedScore = Math.min(1, maxScore / 10_000)

      await db.insert(trendClusters).values({
        id,
        title: cluster[0].title,
        summary: `${cluster.length} signals from ${[...new Set(cluster.map((c) => c.source))].join(', ')}`,
        relevanceScore: 0.5, // Would need vector similarity vs user pillars for real score
        velocityScore: normalizedScore,
        noveltyScore: 0.7,
        compositeScore: normalizedScore * 0.5 + 0.5 * 0.3 + 0.7 * 0.2,
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

    // Sort clusters by max score descending
    return clusters.sort((a, b) => Math.max(...b.map((i) => i.score)) - Math.max(...a.map((i) => i.score)))
  }
}
