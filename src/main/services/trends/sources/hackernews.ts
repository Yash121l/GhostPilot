export interface RawTrendItem {
  source: 'hackernews' | 'reddit'
  title: string
  url: string
  score: number
  fetchedAt: Date
}

/** Fetches top HN stories from the Algolia API — no auth required. */
export async function fetchHackerNews(limit = 30): Promise<RawTrendItem[]> {
  const res = await fetch(
    `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${limit}`,
    { signal: AbortSignal.timeout(10_000) }
  )

  if (!res.ok) return []

  const data = (await res.json()) as {
    hits: { objectID: string; title: string; url: string; points: number; story_text?: string }[]
  }

  return data.hits.map((h) => ({
    source: 'hackernews' as const,
    title: h.title,
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    score: h.points,
    fetchedAt: new Date()
  }))
}
