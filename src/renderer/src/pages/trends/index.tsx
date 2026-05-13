import { useState, useEffect, useCallback, type ReactElement, type KeyboardEvent } from 'react'
import {
  TrendingUp, RefreshCw, Loader2, ExternalLink, PenTool, X,
  Zap, SlidersHorizontal, Plus, ChevronUp, ChevronDown,
} from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import type { TrendCluster, TrendConfig } from '@shared/types/trend'
import { DEFAULT_TREND_CONFIG } from '@shared/types/trend'

const TREND_CONFIG_KEY = 'trend:config'

// ─── Shared helpers ───────────────────────────────────────────────────────────

function heatMeta(cluster: TrendCluster): { label: string; color: string } {
  const top = Math.max(cluster.relevanceScore, cluster.velocityScore, cluster.noveltyScore)
  if (top >= 0.75) return { label: 'Hot',    color: 'var(--color-error)' }
  if (top >= 0.5)  return { label: 'Rising', color: 'var(--color-warning)' }
  return              { label: 'Warm',    color: 'var(--color-brand-secondary)' }
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }): ReactElement {
  const pct = Math.round(value * 100)
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-medium text-[var(--color-text-muted)] w-16 shrink-0">{label}</span>
      <div className="flex-1 progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono w-8 text-right shrink-0" style={{ color }}>
        {pct}
      </span>
    </div>
  )
}

// ─── Trend card ───────────────────────────────────────────────────────────────

function TrendCard({ cluster, onDraft, onDismiss }: {
  cluster: TrendCluster
  onDraft: () => void
  onDismiss: () => void
}): ReactElement {
  const [dismissing, setDismissing] = useState(false)
  const { label: heat, color: heatColor } = heatMeta(cluster)

  const handleDismiss = async (): Promise<void> => {
    setDismissing(true)
    await ipc.invoke(IPC_CHANNELS.TREND_DISMISS, { id: cluster.id })
    onDismiss()
  }

  return (
    <div className="glass-card rounded-2xl flex flex-col group" style={{ padding: '20px' }}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <span
            className="inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded mb-2"
            style={{ color: heatColor, background: `${heatColor}18` }}
          >
            {heat}
          </span>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug line-clamp-2">
            {cluster.title}
          </h3>
        </div>
        <button
          onClick={handleDismiss}
          disabled={dismissing}
          className="btn btn-ghost btn-icon opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -mt-1 -mr-1"
        >
          {dismissing ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
        </button>
      </div>

      {/* Summary */}
      <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed mb-4">
        {cluster.summary}
      </p>

      {/* Scores — horizontal label + bar + number layout */}
      <div className="space-y-2 mb-4">
        <ScoreBar label="Relevance" value={cluster.relevanceScore} color="var(--color-brand-primary)" />
        <ScoreBar label="Velocity"  value={cluster.velocityScore}  color="var(--color-brand-secondary)" />
        <ScoreBar label="Novelty"   value={cluster.noveltyScore}   color="var(--color-brand-accent)" />
      </div>

      {/* Evidence links */}
      {cluster.evidence.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {cluster.evidence.slice(0, 2).map((e) => (
            <a
              key={e.id}
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(ev) => ev.stopPropagation()}
              className="flex items-center gap-2 text-[11px] hover:text-[var(--color-text-secondary)] transition-colors group/link"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <span
                className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold shrink-0"
                style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)' }}
              >
                {e.source}
              </span>
              <span className="truncate group-hover/link:underline">{e.title}</span>
              <ExternalLink size={9} className="shrink-0 opacity-50" />
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

// ─── Trend config panel ───────────────────────────────────────────────────────

function TrendConfigPanel({ onSave }: { onSave: () => Promise<void> }): ReactElement {
  const [config, setConfig] = useState<TrendConfig>(DEFAULT_TREND_CONFIG)
  const [input, setInput]   = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    ipc.invoke(IPC_CHANNELS.SETTINGS_GET, { key: TREND_CONFIG_KEY }).then((res) => {
      if (res.ok && res.value) {
        try { setConfig({ ...DEFAULT_TREND_CONFIG, ...(res.value as TrendConfig) }) } catch { /* ignore */ }
      }
    })
  }, [])

  const addKeyword = (): void => {
    const kw = input.trim().toLowerCase()
    if (kw && !config.keywords.includes(kw)) {
      setConfig((c) => ({ ...c, keywords: [...c.keywords, kw] }))
    }
    setInput('')
  }

  const removeKeyword = (kw: string): void => {
    setConfig((c) => ({ ...c, keywords: c.keywords.filter((k) => k !== kw) }))
  }

  const toggleSource = (src: 'hackernews' | 'reddit'): void => {
    setConfig((c) => ({
      ...c,
      sources: c.sources.includes(src)
        ? c.sources.filter((s) => s !== src)
        : [...c.sources, src],
    }))
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    await ipc.invoke(IPC_CHANNELS.SETTINGS_SET, { key: TREND_CONFIG_KEY, value: config })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    await onSave()
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKeyword() }
  }

  const pct = Math.round(config.minScore * 100)

  return (
    <div
      className="rounded-2xl"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '20px 24px' }}
    >
      <p className="section-label flex items-center gap-2">
        <SlidersHorizontal size={11} />
        Trend Configuration
        <span
          className="ml-1 text-[10px] px-2 py-0.5 rounded-full font-normal normal-case tracking-normal"
          style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--color-primary)', letterSpacing: 0 }}
        >
          Affects next Refresh
        </span>
      </p>

      <div className="space-y-5">
        {/* Keywords */}
        <div>
          <label className="form-label">Topics &amp; Keywords</label>
          <div className="flex gap-2">
            <input
              className="form-input flex-1"
              placeholder="ai, startups, web3 — press Enter to add"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
            />
            <button onClick={addKeyword} className="btn btn-secondary btn-sm shrink-0">
              <Plus size={12} />
              Add
            </button>
          </div>
          {config.keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {config.keywords.map((kw) => (
                <span
                  key={kw}
                  className="flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full font-medium"
                  style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--color-primary)' }}
                >
                  {kw}
                  <button
                    onClick={() => removeKeyword(kw)}
                    className="opacity-60 hover:opacity-100 transition-opacity leading-none"
                    style={{ lineHeight: 1 }}
                  >
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
              No keywords — relevance is estimated from engagement and source diversity.
            </p>
          )}
        </div>

        {/* Sources */}
        <div>
          <label className="form-label">Sources</label>
          <div className="flex gap-2">
            {(['hackernews', 'reddit'] as const).map((src) => {
              const on = config.sources.includes(src)
              return (
                <button
                  key={src}
                  onClick={() => toggleSource(src)}
                  className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg border transition-all"
                  style={{
                    background: on ? 'rgba(99,102,241,0.08)' : 'var(--color-surface-alt)',
                    borderColor: on ? 'var(--color-primary)' : 'var(--color-border)',
                    color: on ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: on ? 'var(--color-primary)' : 'var(--color-border)' }}
                  />
                  {src === 'hackernews' ? 'Hacker News' : 'Reddit'}
                </button>
              )
            })}
          </div>
          {config.sources.length === 0 && (
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-error)' }}>
              Enable at least one source.
            </p>
          )}
        </div>

        {/* Min score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="form-label" style={{ marginBottom: 0 }}>Minimum composite score</label>
            <span
              className="text-xs font-mono font-semibold"
              style={{ color: 'var(--color-primary)' }}
            >
              {pct}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={70}
            step={5}
            value={pct}
            onChange={(e) => setConfig((c) => ({ ...c, minScore: Number(e.target.value) / 100 }))}
            className="w-full"
            style={{ accentColor: 'var(--color-primary)' }}
          />
          <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
            <span>Show all</span>
            <span>High quality only</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || config.sources.length === 0}
            className="btn btn-primary btn-sm"
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save & Refresh'}
          </button>
          <button
            onClick={() => setConfig(DEFAULT_TREND_CONFIG)}
            className="btn btn-ghost btn-sm"
          >
            Reset defaults
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrendsPage(): ReactElement {
  const [trends, setTrends]         = useState<TrendCluster[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    const res = await ipc.invoke(IPC_CHANNELS.TREND_LIST, { limit: 20 })
    if (res.ok) setTrends(res.value)
    setLoading(false)
  }, [])

  const refresh = useCallback(async (): Promise<void> => {
    setRefreshing(true)
    await ipc.invoke(IPC_CHANNELS.TREND_REFRESH, {})
    await load()
    setRefreshing(false)
  }, [load])

  useEffect(() => { load() }, [load])

  const handleDraft = (cluster: TrendCluster): void => {
    window.dispatchEvent(new CustomEvent('nav', { detail: { page: 'composer', prefill: cluster.title } }))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Trends</h1>
          <p className="page-subtitle">Topics scored for relevance, velocity, and novelty</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig((v) => !v)}
            className={`btn btn-ghost btn-sm gap-1.5 ${showConfig ? 'text-[var(--color-primary)]' : ''}`}
          >
            <SlidersHorizontal size={13} />
            Configure
            {showConfig ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Fetching…' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state flex-1">
          <Loader2 size={22} className="animate-spin text-[var(--color-brand-primary)]" />
        </div>
      ) : (
        <div className="page-body">
          {/* Config panel (collapsed by default) */}
          {showConfig && (
            <div className="mb-6">
              <TrendConfigPanel onSave={refresh} />
            </div>
          )}

          {/* Refreshing indicator */}
          {refreshing && (
            <div className="flex items-center gap-2 mb-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <Loader2 size={12} className="animate-spin text-[var(--color-brand-primary)]" />
              Fetching fresh signals…
            </div>
          )}

          {/* Empty state */}
          {trends.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-wrap">
                <TrendingUp size={24} />
              </div>
              <p className="empty-title">No trends yet</p>
              <p className="empty-text">
                Pull from Hacker News and Reddit to discover what&apos;s trending. Add keywords in Configure to personalise relevance scores.
              </p>
              <button onClick={refresh} disabled={refreshing} className="btn btn-primary">
                <Zap size={14} />
                {refreshing ? 'Fetching…' : 'Fetch Trends'}
              </button>
            </div>
          ) : (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))' }}
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
          )}
        </div>
      )}
    </div>
  )
}
