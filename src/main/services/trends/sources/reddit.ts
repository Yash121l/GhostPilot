import type { RawTrendItem } from './hackernews'

const SUBREDDITS = ['programming', 'MachineLearning', 'artificial', 'startups', 'IndieHackers', 'webdev']

/** Fetches top posts from relevant subreddits. */
export async function fetchReddit(limit = 20): Promise<RawTrendItem[]> {
  const items: RawTrendItem[] = []

  for (const sub of SUBREDDITS) {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/hot.json?limit=${Math.ceil(limit / SUBREDDITS.length)}`,
        {
          headers: { 'User-Agent': 'GhostPilot/1.0 (content research tool)' },
          signal: AbortSignal.timeout(8000),
        },
      )

      if (!res.ok) continue

      const data = (await res.json()) as {
        data: {
          children: {
            data: { title: string; url: string; score: number; permalink: string; is_self: boolean }
          }[]
        }
      }

      for (const child of data.data.children) {
        const post = child.data
        if (post.score < 100) continue
        items.push({
          source: 'reddit',
          title: post.title,
          url: post.is_self ? `https://reddit.com${post.permalink}` : post.url,
          score: post.score,
          fetchedAt: new Date(),
        })
      }
    } catch {
      // Skip failed subreddit, continue with others
    }
  }

  return items
}
