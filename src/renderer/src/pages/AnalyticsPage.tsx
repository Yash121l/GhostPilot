import { useState, useEffect, type ReactElement } from 'react'
import { BarChart3, Loader2, TrendingUp, DollarSign, Zap, RefreshCw } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../lib/ipc'
import type { Post } from '@shared/types/post'
import { PostStatus } from '@shared/types/post'
import type { LLMUsage } from '@shared/types/ai'

interface StatDef {
  label: string
  value: string | number
  sub: string
  icon: React.ElementType
  color: string
}

function StatTile({ stat }: { stat: StatDef }): ReactElement {
  const Icon = stat.icon
  return (
    <div
      className="glass-card p-5 rounded-2xl flex flex-col gap-3"
      style={{ background: 'var(--color-surface)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-text-muted)]">{stat.label}</span>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `${stat.color}18` }}
        >
          <Icon size={14} style={{ color: stat.color }} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight" style={{ color: stat.color, letterSpacing: '-0.03em' }}>
          {stat.value}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1">{stat.sub}</p>
      </div>
    </div>
  )
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }): ReactElement {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[var(--color-text-muted)] w-24 shrink-0 capitalize truncate">{label}</span>
      <div className="flex-1 progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold text-[var(--color-text-secondary)] w-6 text-right">{value}</span>
    </div>
  )
}

export default function AnalyticsPage(): ReactElement {
  const [posts, setPosts] = useState<Post[]>([])
  const [usage, setUsage] = useState<LLMUsage[]>([])
  const [loading, setLoading] = useState(true)

  const load = async (): Promise<void> => {
    setLoading(true)
    const [postsRes, usageRes] = await Promise.all([
      ipc.invoke(IPC_CHANNELS.POST_LIST, { limit: 200 }),
      ipc.invoke(IPC_CHANNELS.AI_USAGE_LIST, { limit: 200 }),
    ])
    if (postsRes.ok) setPosts(postsRes.value)
    if (usageRes.ok) setUsage(usageRes.value as unknown as LLMUsage[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const published = posts.filter((p) => p.status === PostStatus.PUBLISHED)
  const scheduled = posts.filter((p) => p.status === PostStatus.SCHEDULED)
  const totalCost = usage.reduce((s, u) => s + (u.estimatedCostUsd ?? 0), 0)
  const totalTokens = usage.reduce((s, u) => s + (u.promptTokens ?? 0) + (u.completionTokens ?? 0), 0)

  const stats: StatDef[] = [
    {
      label: 'Published',
      value: published.length,
      sub: `${scheduled.length} in queue`,
      icon: BarChart3,
      color: 'var(--color-success)',
    },
    {
      label: 'Total Posts',
      value: posts.length,
      sub: 'across all statuses',
      icon: TrendingUp,
      color: 'var(--color-brand-primary)',
    },
    {
      label: 'AI Spend',
      value: `$${totalCost.toFixed(4)}`,
      sub: `${totalTokens.toLocaleString()} tokens`,
      icon: DollarSign,
      color: 'var(--color-warning)',
    },
    {
      label: 'AI Calls',
      value: usage.length,
      sub: 'completed generations',
      icon: Zap,
      color: 'var(--color-brand-secondary)',
    },
  ]

  const byPlatform = published.reduce<Record<string, number>>((acc, post) => {
    for (const p of post.platforms) acc[p] = (acc[p] ?? 0) + 1
    return acc
  }, {})

  const maxPlatform = Math.max(...Object.values(byPlatform), 1)
  const recentCalls = usage.slice(0, 10)

  const platformColors: Record<string, string> = {
    linkedin: '#0077B5',
    twitter: '#1D9BF0',
    instagram: '#E1306C',
  }

  return (
    <div className="flex flex-col h-full">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Publishing performance and AI cost tracking</p>
        </div>
        <button onClick={load} className="btn btn-ghost btn-icon" title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="empty-state flex-1">
          <Loader2 size={22} className="animate-spin text-[var(--color-brand-primary)]" />
        </div>
      ) : posts.length === 0 && usage.length === 0 ? (
        <div className="empty-state flex-1">
          <div className="empty-icon-wrap">
            <BarChart3 size={24} />
          </div>
          <p className="empty-title">No data yet</p>
          <p className="empty-text">
            Start creating and publishing posts — performance metrics and AI cost breakdowns will appear here.
          </p>
        </div>
      ) : (
        <div className="page-body space-y-5">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4">
            {stats.map((s) => <StatTile key={s.label} stat={s} />)}
          </div>

          {/* Platform breakdown */}
          {Object.keys(byPlatform).length > 0 && (
            <div className="glass-card p-5 rounded-2xl">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Published by Platform</h3>
              <div className="space-y-4">
                {Object.entries(byPlatform).map(([platform, count]) => (
                  <BarRow
                    key={platform}
                    label={platform}
                    value={count}
                    max={maxPlatform}
                    color={platformColors[platform] ?? 'var(--color-brand-primary)'}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recent AI calls */}
          {recentCalls.length > 0 && (
            <div className="glass-card p-5 rounded-2xl">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Recent AI Calls</h3>
              <div className="space-y-1">
                {recentCalls.map((u, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-2.5"
                    style={{
                      borderBottom: i < recentCalls.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--color-text-secondary)]">{u.task}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                        {u.provider} · {u.modelId}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono text-[var(--color-text-secondary)]">
                        ${(u.estimatedCostUsd ?? 0).toFixed(5)}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                        {((u.promptTokens ?? 0) + (u.completionTokens ?? 0)).toLocaleString()}t
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
