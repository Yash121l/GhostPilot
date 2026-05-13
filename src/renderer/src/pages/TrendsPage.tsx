import { useState, useEffect, type ReactElement } from 'react'
import { TrendingUp, RefreshCw, Loader2, ExternalLink, PenTool, X, Zap } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../lib/ipc'
import type { TrendCluster } from '@shared/types/trend'

function ScorePip({ value, color }: { value: number; color: string }): ReactElement {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((threshold) => (
          <div
            key={threshold}
            className="w-1 h-3 rounded-full"
            style={{ background: value >= threshold ? color : 'var(--color-surface-3)' }}
          />
        ))}
      </div>
      <span className="text-[10px] text-[var(--color-text-muted)]">{(value * 100).toFixed(0)}%</span>
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

  return (
    <div className="glass-card p-5 rounded-2xl group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-white/90 leading-snug flex-1">{cluster.title}</h3>
        <button
          onClick={handleDismiss}
          disabled={dismissing}
          className="p-1 rounded-lg hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
        >
          {dismissing
            ? <Loader2 size={12} className="animate-spin text-[var(--color-text-muted)]" />
            : <X size={12} className="text-[var(--color-text-muted)]" />
          }
        </button>
      </div>

      <p className="text-xs text-[var(--color-text-muted)] mb-4 leading-relaxed">{cluster.summary}</p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <p className="text-[10px] text-[var(--color-text-muted)] mb-1">Relevance</p>
          <ScorePip value={cluster.relevanceScore} color="var(--color-brand-primary)" />
        </div>
        <div>
          <p className="text-[10px] text-[var(--color-text-muted)] mb-1">Velocity</p>
          <ScorePip value={cluster.velocityScore} color="var(--color-brand-secondary)" />
        </div>
        <div>
          <p className="text-[10px] text-[var(--color-text-muted)] mb-1">Novelty</p>
          <ScorePip value={cluster.noveltyScore} color="var(--color-brand-accent)" />
        </div>
      </div>

      {cluster.evidence.length > 0 && (
        <div className="space-y-1 mb-4">
          {cluster.evidence.slice(0, 2).map((e) => (
            <a
              key={e.id}
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              onClick={(ev) => ev.stopPropagation()}
            >
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-surface-3)]">{e.source}</span>
              <span className="truncate">{e.title}</span>
              <ExternalLink size={10} className="shrink-0" />
            </a>
          ))}
        </div>
      )}

      <button
        onClick={onDraft}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
        style={{ background: 'hsla(265,89%,65%,0.15)', color: 'var(--color-brand-primary)', border: '1px solid hsla(265,89%,65%,0.3)' }}
      >
        <PenTool size={12} />
        Draft this
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
    // Pre-fill composer with trend title as a starting point
    window.dispatchEvent(new CustomEvent('nav', { detail: { page: 'composer', prefill: cluster.title } }))
  }

  return (
    <div className="flex flex-col h-full animate-slide-up">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)]">
        <div>
          <h1 className="text-base font-semibold text-white/90">Trends</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Trending topics scored for your content pillars</p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
          style={{ background: 'hsla(265,89%,65%,0.1)', color: 'var(--color-brand-primary)' }}
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Fetching…' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-[var(--color-brand-primary)]" />
        </div>
      ) : trends.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center px-8">
          <TrendingUp size={32} className="text-[var(--color-text-muted)] mb-3" />
          <p className="text-sm font-medium text-white/70 mb-1">No trends yet</p>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">Pull from HackerNews and Reddit to find what's trending in your space</p>
          <button onClick={refresh} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'hsla(265,89%,65%,0.9)' }}>
            <Zap size={14} />
            Fetch Trends
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-2 gap-4 max-w-3xl">
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
