import { useState, useEffect, type ReactElement } from 'react'
import { TrendingUp, RefreshCw, Loader2, ExternalLink, PenTool, X, Zap } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../lib/ipc'
import type { TrendCluster } from '@shared/types/trend'

interface ScoreBarProps {
  label: string
  value: number
  color: string
}

function ScoreBar({ label, value, color }: ScoreBarProps): ReactElement {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium text-[var(--color-text-muted)]">{label}</span>
        <span className="text-[10px] font-mono" style={{ color }}>
          {(value * 100).toFixed(0)}
        </span>
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
    </div>
  )
}

function TrendCard({ cluster, onDraft, onDismiss }: {
  cluster: TrendCluster
  onDraft: () => void
  onDismiss: () => void
}): ReactElement {
  const [dismissing, setDismissing] = useState(false)

  const handleDismiss = async (): Promise<void> => {
    setDismissing(true)
    await ipc.invoke(IPC_CHANNELS.TREND_DISMISS, { id: cluster.id })
    onDismiss()
  }

  const topScore = Math.max(cluster.relevanceScore, cluster.velocityScore, cluster.noveltyScore)
  const heat = topScore >= 0.8 ? 'Hot' : topScore >= 0.6 ? 'Rising' : 'Warm'
  const heatColor = topScore >= 0.8 ? 'var(--color-error)' : topScore >= 0.6 ? 'var(--color-warning)' : 'var(--color-brand-secondary)'

  return (
    <div className="glass-card p-5 rounded-2xl flex flex-col gap-3 group">
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ color: heatColor, background: `${heatColor}18` }}
            >
              {heat}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white/90 leading-snug">{cluster.title}</h3>
        </div>
        <button
          onClick={handleDismiss}
          disabled={dismissing}
          className="btn btn-ghost btn-icon opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          {dismissing
            ? <Loader2 size={12} className="animate-spin" />
            : <X size={12} />}
        </button>
      </div>

      {/* Summary */}
      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed -mt-1">
        {cluster.summary}
      </p>

      {/* Scores */}
      <div className="space-y-2.5">
        <ScoreBar label="Relevance" value={cluster.relevanceScore} color="var(--color-brand-primary)" />
        <ScoreBar label="Velocity" value={cluster.velocityScore} color="var(--color-brand-secondary)" />
        <ScoreBar label="Novelty" value={cluster.noveltyScore} color="var(--color-brand-accent)" />
      </div>

      {/* Evidence links */}
      {cluster.evidence.length > 0 && (
        <div className="space-y-1.5">
          {cluster.evidence.slice(0, 2).map((e) => (
            <a
              key={e.id}
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(ev) => ev.stopPropagation()}
              className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors group/link"
            >
              <span
                className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold shrink-0"
                style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)' }}
              >
                {e.source}
              </span>
              <span className="truncate group-hover/link:underline">{e.title}</span>
              <ExternalLink size={9} className="shrink-0 opacity-60" />
            </a>
          ))}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onDraft}
        className="btn btn-secondary w-full justify-center mt-auto"
        style={{ fontSize: 12 }}
      >
        <PenTool size={12} />
        Draft this topic
      </button>
    </div>
  )
}

export default function TrendsPage(): ReactElement {
  const [trends, setTrends] = useState<TrendCluster[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (): Promise<void> => {
    setLoading(true)
    const res = await ipc.invoke(IPC_CHANNELS.TREND_LIST, { limit: 20 })
    if (res.ok) setTrends(res.value)
    setLoading(false)
  }

  const refresh = async (): Promise<void> => {
    setRefreshing(true)
    await ipc.invoke(IPC_CHANNELS.TREND_REFRESH, {})
    await load()
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  const handleDraft = (cluster: TrendCluster): void => {
    window.dispatchEvent(new CustomEvent('nav', { detail: { page: 'composer', prefill: cluster.title } }))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trends</h1>
          <p className="page-subtitle">Topics scored for relevance, velocity, and novelty</p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="btn btn-secondary btn-sm"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Fetching…' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="empty-state flex-1">
          <Loader2 size={22} className="animate-spin text-[var(--color-brand-primary)]" />
        </div>
      ) : trends.length === 0 ? (
        <div className="empty-state flex-1">
          <div className="empty-icon-wrap">
            <TrendingUp size={24} />
          </div>
          <p className="empty-title">No trends yet</p>
          <p className="empty-text">
            Pull from HackerNews and Reddit to discover what&apos;s trending in your content pillars.
          </p>
          <button onClick={refresh} className="btn btn-primary">
            <Zap size={14} />
            Fetch Trends
          </button>
        </div>
      ) : (
        <div className="page-body">
          {refreshing && (
            <div className="flex items-center gap-2 mb-4 text-xs text-[var(--color-text-muted)]">
              <Loader2 size={12} className="animate-spin text-[var(--color-brand-primary)]" />
              Refreshing trends…
            </div>
          )}
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
          >
            {trends.map((t) => (
              <TrendCard
                key={t.id}
                cluster={t}
                onDraft={() => handleDraft(t)}
                onDismiss={() => setTrends((prev) => prev.filter((x) => x.id !== t.id))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
