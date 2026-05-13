import { useState, useEffect, type ReactElement } from 'react'
import { BarChart3, Loader2, TrendingUp, DollarSign, Zap, RefreshCw } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../lib/ipc'
import type { Post } from '@shared/types/post'
import { PostStatus } from '@shared/types/post'
import type { LLMUsage } from '@shared/types/ai'

interface StatCard {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
}

function StatTile({ stat }: { stat: StatCard }): ReactElement {
  const Icon = stat.icon
  return (
    <div className="glass-card p-5 rounded-2xl">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-xl" style={{ background: `${stat.color}20` }}>
          <Icon size={14} style={{ color: stat.color }} />
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">{stat.label}</span>
      </div>
      <p className="text-2xl font-bold text-white/90">{stat.value}</p>
      {stat.sub && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{stat.sub}</p>}
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

  const stats: StatCard[] = [
    { label: 'Posts Published', value: published.length, sub: `${scheduled.length} scheduled`, icon: BarChart3, color: 'var(--color-success)' },
    { label: 'Total Posts', value: posts.length, sub: 'across all statuses', icon: TrendingUp, color: 'var(--color-brand-primary)' },
    { label: 'AI Spend', value: `$${totalCost.toFixed(4)}`, sub: `${totalTokens.toLocaleString()} tokens total`, icon: DollarSign, color: 'var(--color-warning)' },
    { label: 'AI Calls', value: usage.length, sub: 'completed generations', icon: Zap, color: 'var(--color-brand-secondary)' },
  ]

  const byPlatform = published.reduce<Record<string, number>>((acc, post) => {
    for (const p of post.platforms) {
      acc[p] = (acc[p] ?? 0) + 1
    }
    return acc
  }, {})

  const recentCalls = usage.slice(0, 10)

  return (
    <div className="flex flex-col h-full overflow-y-auto animate-slide-up">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)]">
        <div>
          <h1 className="text-base font-semibold text-white/90">Analytics</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Publishing performance and AI cost tracking</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <RefreshCw size={14} className="text-[var(--color-text-muted)]" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-[var(--color-brand-primary)]" />
        </div>
      ) : (
        <div className="px-6 py-6 space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4">
            {stats.map((s) => <StatTile key={s.label} stat={s} />)}
          </div>

          {/* Platform breakdown */}
          {Object.keys(byPlatform).length > 0 && (
            <div className="glass-card p-5 rounded-2xl">
              <h3 className="text-sm font-semibold text-white/90 mb-4">Published by Platform</h3>
              <div className="space-y-3">
                {Object.entries(byPlatform).map(([platform, count]) => {
                  const max = Math.max(...Object.values(byPlatform))
                  return (
                    <div key={platform} className="flex items-center gap-3">
                      <span className="text-xs text-[var(--color-text-muted)] w-20 shrink-0 capitalize">{platform}</span>
                      <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(count / max) * 100}%`, background: 'var(--color-brand-primary)' }}
                        />
                      </div>
                      <span className="text-xs font-medium text-[var(--color-text-secondary)] w-6 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent AI calls */}
          {recentCalls.length > 0 && (
            <div className="glass-card p-5 rounded-2xl">
              <h3 className="text-sm font-semibold text-white/90 mb-4">Recent AI Calls</h3>
              <div className="space-y-2">
                {recentCalls.map((u, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-[var(--color-border-subtle)] last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--color-text-secondary)]">{u.task}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{u.provider} · {u.modelId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-[var(--color-text-secondary)]">${(u.estimatedCostUsd ?? 0).toFixed(5)}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{((u.promptTokens ?? 0) + (u.completionTokens ?? 0)).toLocaleString()}t</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {posts.length === 0 && usage.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <BarChart3 size={32} className="text-[var(--color-text-muted)] mb-3" />
              <p className="text-sm text-[var(--color-text-muted)]">No data yet — start creating and publishing posts to see analytics</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
