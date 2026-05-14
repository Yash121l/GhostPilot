import { useState, useEffect, type ReactElement } from 'react'
import { Briefcase, AtSign, Camera, RefreshCw } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import type { DailyUsage } from '@shared/ipc-types'
import type { Post } from '@shared/types/post'
import { PostStatus } from '@shared/types/post'
import { Platform } from '@shared/types/platform'

const PLATFORM_ICON: Record<string, React.ElementType> = {
  linkedin: Briefcase,
  twitter: AtSign,
  instagram: Camera
}


interface PlatformStat {
  id: string
  label: string
  posts: number
  color: string
  Icon: React.ElementType
}

function Kpi({
  label,
  value,
  sub
}: {
  label: string
  value: string
  sub?: string
}): ReactElement {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
          fontWeight: 600
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 8, letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-3)' }}>{sub}</div>
      )}
    </div>
  )
}

function SpendStat({
  label,
  amount,
  calls,
  pct,
  color = 'var(--accent)'
}: {
  label: string
  amount: string
  calls: string
  pct: number
  color?: string
}): ReactElement {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{amount}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 6 }}>{calls}</div>
      <div className="progress">
        <div className="fill" style={{ width: pct * 100 + '%', background: color }} />
      </div>
    </div>
  )
}

export default function AnalyticsPage(): ReactElement {
  const [loading, setLoading] = useState(false)
  const [posts, setPosts] = useState<Post[]>([])
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([])

  const refresh = async (): Promise<void> => {
    setLoading(true)
    const [postsRes, usageRes] = await Promise.all([
      ipc.invoke(IPC_CHANNELS.POST_LIST, { limit: 200 }),
      ipc.invoke(IPC_CHANNELS.AI_USAGE_DAILY, { days: 30 }),
    ])
    if (postsRes.ok) setPosts(postsRes.value)
    if (usageRes.ok) setDailyUsage(usageRes.value)
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [])

  // Derive stats from real posts
  const publishedPosts = posts.filter((p) => p.status === PostStatus.PUBLISHED)
  const scheduledPosts = posts.filter((p) => p.status === PostStatus.SCHEDULED)

  const byPlatform: PlatformStat[] = [
    { id: Platform.LINKEDIN, label: 'LinkedIn', Icon: Briefcase, color: 'var(--linkedin)', posts: 0 },
    { id: Platform.TWITTER, label: 'X', Icon: AtSign, color: '#111', posts: 0 },
    { id: Platform.INSTAGRAM, label: 'Instagram', Icon: Camera, color: 'var(--instagram)', posts: 0 },
  ].map((p) => ({
    ...p,
    posts: publishedPosts.filter((post) => post.platforms.includes(p.id as Platform)).length,
  }))

  const totalSpend = dailyUsage.reduce((s, d) => s + d.totalCostUsd, 0)

  // Aggregate spend by provider
  const spendByProvider: Record<string, { cost: number; tokens: number }> = {}
  for (const day of dailyUsage) {
    for (const [provider, cost] of Object.entries(day.byProvider)) {
      if (!spendByProvider[provider]) spendByProvider[provider] = { cost: 0, tokens: 0 }
      spendByProvider[provider].cost += cost
    }
  }
  const providerEntries = Object.entries(spendByProvider).sort((a, b) => b[1].cost - a[1].cost)

  // Sparkline from daily usage (last 14 days)
  const trendData = dailyUsage.slice(-14).map((d) => d.totalTokens)
  const maxT = Math.max(...trendData, 1)
  const points = trendData
    .map((v, i) => {
      const x = trendData.length > 1 ? (i / (trendData.length - 1)) * 100 : 50
      const y = 100 - (v / maxT) * 100
      return `${x},${y}`
    })
    .join(' ')

  const now = new Date()
  const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col h-full">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Publishing metrics &amp; AI cost breakdown</p>
        </div>
        <button onClick={refresh} className="btn ghost icon" title="Refresh">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <Kpi label="Total Posts" value={posts.length.toString()} sub="all time" />
            <Kpi label="Published" value={publishedPosts.length.toString()} sub="successfully sent" />
            <Kpi label="Scheduled" value={scheduledPosts.length.toString()} sub="queued" />
            <Kpi label="AI Spend" value={'$' + totalSpend.toFixed(2)} sub="last 30 days" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            {/* AI token usage sparkline */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--text-3)',
                    fontWeight: 600
                  }}
                >
                  AI token usage · last 14d
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                  {trendData.reduce((s, v) => s + v, 0).toLocaleString()} tokens
                </div>
              </div>
              {trendData.length > 0 ? (
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ width: '100%', height: 160 }}
                >
                  <defs>
                    <linearGradient id="trendGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon points={`0,100 ${points} 100,100`} fill="url(#trendGrad)" />
                  <polyline
                    points={points}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="0.8"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {trendData.map((v, i) => {
                    const x = trendData.length > 1 ? (i / (trendData.length - 1)) * 100 : 50
                    const y = 100 - (v / maxT) * 100
                    return <circle key={i} cx={x} cy={y} r="0.7" fill="var(--accent)" />
                  })}
                </svg>
              ) : (
                <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: 13 }}>
                  No AI usage yet
                </div>
              )}
            </div>

            {/* Platform breakdown */}
            <div className="card" style={{ padding: 20 }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--text-3)',
                  fontWeight: 600,
                  marginBottom: 14
                }}
              >
                By platform
              </div>
              {byPlatform.map((p) => {
                const Icon = p.Icon
                const maxPosts = Math.max(...byPlatform.map((x) => x.posts), 1)
                return (
                  <div key={p.id} style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 6
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <Icon size={14} /> {p.label}
                      </span>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {p.posts} posts
                      </span>
                    </div>
                    <div className="progress" style={{ height: 6 }}>
                      <div
                        className="fill"
                        style={{ width: (p.posts / maxPosts) * 100 + '%', background: p.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent posts */}
          <div className="card" style={{ padding: 20 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-3)',
                fontWeight: 600,
                marginBottom: 12
              }}
            >
              Recent posts
            </div>
            {posts.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-4)', fontStyle: 'italic', padding: '12px 0' }}>
                No posts yet — create one in the Composer.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {posts.slice(0, 5).map((p, i) => {
                  const platform = p.platforms[0] ?? 'linkedin'
                  const Icon = PLATFORM_ICON[platform] ?? Briefcase
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '10px 4px',
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none'
                      }}
                    >
                      <div className="mono" style={{ width: 24, color: 'var(--text-4)', fontSize: 13 }}>
                        {i + 1}
                      </div>
                      <Icon size={14} />
                      <div style={{ flex: 1, fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.body.slice(0, 80) || '(empty)'}
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: p.status === PostStatus.PUBLISHED ? 'var(--success)' : 'var(--text-3)',
                          width: 80,
                          textAlign: 'right'
                        }}
                      >
                        {p.status}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* AI spend breakdown */}
          <div className="card" style={{ padding: 20 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--text-3)',
                  fontWeight: 600
                }}
              >
                AI spend breakdown
              </div>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {monthLabel}
              </span>
            </div>
            {providerEntries.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-4)', fontStyle: 'italic' }}>
                No AI usage recorded yet. Add a provider key in Settings to get started.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {providerEntries.slice(0, 3).map(([provider, stat]) => (
                  <SpendStat
                    key={provider}
                    label={provider}
                    amount={'$' + stat.cost.toFixed(2)}
                    calls={stat.tokens.toLocaleString() + ' tokens'}
                    pct={totalSpend > 0 ? stat.cost / totalSpend : 0}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
